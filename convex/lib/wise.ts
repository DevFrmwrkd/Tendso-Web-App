/**
 * Wise (TransferWise) API client.
 * https://api-docs.wise.com/
 *
 * Used by withdrawals.ts cron job to poll status of in-flight transfers
 * and send follow-up emails to creators.
 */

const SANDBOX_URL = 'https://api.sandbox.transferwise.tech'
const PROD_URL = 'https://api.wise.com'

function getBaseUrl(): string {
    return process.env.WISE_SANDBOX === 'true' ? SANDBOX_URL : PROD_URL
}

function getWiseToken(): string {
    const token = process.env.WISE_API_TOKEN
    if (!token) throw new Error('WISE_API_TOKEN env var must be set')
    return token
}

function getWiseProfileId(): string {
    const id = process.env.WISE_PROFILE_ID
    if (!id) throw new Error('WISE_PROFILE_ID env var must be set')
    return id
}

function getPayoutBalanceId(): string | undefined {
    const id = process.env.WISE_CREATOR_PAYOUT_BALANCE_ID
    return id && id.length > 0 ? id : undefined
}

async function wiseRequest(path: string, options: RequestInit = {}): Promise<any> {
    const token = getWiseToken()
    const response = await fetch(`${getBaseUrl()}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(options.headers || {}),
        },
    })

    let data: any = null
    try {
        data = await response.json()
    } catch {
        // Empty body OK
    }

    if (!response.ok) {
        const errorMsg = data?.errors?.[0]?.message || data?.message || `HTTP ${response.status}`
        throw new Error(`Wise API error (${response.status}): ${errorMsg}`)
    }
    return data
}

// ==================== TRANSFER CREATION ====================

/**
 * Create an email-type recipient on Wise.
 * Wise will send the funds to this email address; if the recipient doesn't have a
 * Wise account, Wise sends an invitation link (7-day claim window).
 */
export async function createEmailRecipient(params: {
    accountHolderName: string
    email: string
}): Promise<{ id: string }> {
    const profileId = getWiseProfileId()
    const data = await wiseRequest('/v1/accounts', {
        method: 'POST',
        body: JSON.stringify({
            currency: 'PHP',
            type: 'email',
            profile: Number(profileId),
            accountHolderName: params.accountHolderName,
            details: { email: params.email },
        }),
    })
    return { id: String(data?.id ?? '') }
}

/**
 * Create a PHP → PHP quote at fixed rate (1:1, no FX).
 * Sourced from the Creator Payout jar when WISE_CREATOR_PAYOUT_BALANCE_ID is set,
 * otherwise falls back to the profile's main balance.
 *
 * Mobile-referenced — DO NOT switch back to sourceAmount. Wise charges a
 * transfer fee on every quote; with `targetAmount` the recipient receives the
 * full amountPHP and the platform's PHP balance is debited amountPHP + fee.
 * With `sourceAmount` the fee is silently deducted from amountPHP and creators
 * receive less than they withdrew (e.g. ₱100 → ₱83.22 — that exact incident
 * triggered this change). See docs/changes/WISE-WITHDRAWAL-FIX-MIN.md.
 */
export async function createQuote(params: {
    amountPHP: number
}): Promise<{ id: string }> {
    const profileId = getWiseProfileId()
    const body: Record<string, unknown> = {
        profile: Number(profileId),
        source: 'PHP',
        target: 'PHP',
        rateType: 'FIXED',
        // Recipient gets exactly amountPHP; platform pays the fee.
        targetAmount: params.amountPHP,
        type: 'BALANCE_PAYOUT',
    }
    const balanceId = getPayoutBalanceId()
    if (balanceId) body.sourceBalanceId = Number(balanceId)

    const data = await wiseRequest('/v1/quotes', {
        method: 'POST',
        body: JSON.stringify(body),
    })
    return { id: String(data?.id ?? '') }
}

/**
 * Create a transfer tying a recipient to a quote.
 * `customerTransactionId` must be a UUID and enables Wise-side idempotency.
 * `reference` is the memo the admin sees in the Wise dashboard (≤ 30 chars).
 */
export async function createTransfer(params: {
    recipientId: string
    quoteId: string
    customerTransactionId: string
    reference: string
}): Promise<{ id: string }> {
    const data = await wiseRequest('/v1/transfers', {
        method: 'POST',
        body: JSON.stringify({
            targetAccount: Number(params.recipientId),
            quote: Number(params.quoteId),
            customerTransactionId: params.customerTransactionId,
            details: {
                reference: params.reference.slice(0, 30),
            },
        }),
    })
    return { id: String(data?.id ?? '') }
}

// ==================== TRANSFER STATUS ====================

export interface TransferStatus {
    id: string
    status: string                  // Wise's raw state
    detailedStatus: string          // Verbose status (e.g. "verifying_recipient", "outgoing_payment_sent")
    isFinal: boolean                // True if transfer is in a terminal state (completed/failed/cancelled)
    isCompleted: boolean            // True if successfully completed
    failureReason?: string
}

/**
 * Get the current status of a Wise transfer by its ID.
 * Used to poll transfers that are stuck in "processing" state.
 */
export async function getTransferStatus(transferId: string): Promise<TransferStatus> {
    const data = await wiseRequest(`/v1/transfers/${transferId}`)

    const rawStatus = String(data?.status || '').toLowerCase()
    const detailedStatus = String(data?.details?.status || data?.status || '').toLowerCase()

    // Map Wise states to our concepts
    const completedStates = ['outgoing_payment_sent', 'funds_converted', 'paid_out']
    const failedStates = ['cancelled', 'funds_refunded', 'bounced_back', 'charged_back', 'rejected']
    const isCompleted = completedStates.some((s) => rawStatus.includes(s) || detailedStatus.includes(s))
    const isFailed = failedStates.some((s) => rawStatus.includes(s) || detailedStatus.includes(s))

    return {
        id: String(data?.id || transferId),
        status: rawStatus,
        detailedStatus,
        isFinal: isCompleted || isFailed,
        isCompleted,
        failureReason: isFailed ? (data?.details?.reason || rawStatus) : undefined,
    }
}

/**
 * Map a Wise detailed status to a user-friendly label + description.
 * Used when sending follow-up status emails to creators.
 */
export function describeWiseStatus(detailedStatus: string): { label: string; description: string; isFinal: boolean } {
    const status = detailedStatus.toLowerCase()

    if (status.includes('outgoing_payment_sent') || status.includes('paid_out')) {
        return {
            label: 'Completed',
            description: "Your funds have been sent to your Wise account! It may take a few minutes to appear depending on your bank.",
            isFinal: true,
        }
    }
    if (status.includes('funds_converted')) {
        return {
            label: 'Converting funds',
            description: 'Wise has converted your funds and is preparing to send them to your bank. This usually completes within minutes.',
            isFinal: false,
        }
    }
    if (status.includes('processing')) {
        return {
            label: 'Processing',
            description: "Wise is processing your transfer. This usually takes a few minutes but can take 1-2 business days for some banks.",
            isFinal: false,
        }
    }
    if (status.includes('verifying') || status.includes('recipient')) {
        return {
            label: 'Verifying your details',
            description: "Wise is verifying the recipient details you provided. Once verified, your transfer will move to processing.",
            isFinal: false,
        }
    }
    if (status.includes('cancelled')) {
        return {
            label: 'Cancelled',
            description: "The transfer was cancelled. Your balance has been restored. Please contact support if you didn't request this.",
            isFinal: true,
        }
    }
    if (status.includes('refunded') || status.includes('bounced') || status.includes('charged_back') || status.includes('rejected')) {
        return {
            label: 'Failed',
            description: "Unfortunately, the transfer didn't go through. Your balance has been restored. Please double-check your Wise email and try again.",
            isFinal: true,
        }
    }

    // Unknown / generic
    return {
        label: 'In progress',
        description: `Current status: ${detailedStatus}. We'll send you another update when it changes.`,
        isFinal: false,
    }
}
