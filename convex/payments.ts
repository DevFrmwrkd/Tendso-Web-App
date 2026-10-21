import { v } from 'convex/values'
import { internalAction, internalMutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { extractReferenceFromText } from '../lib/payments/referenceCode'
import { determinePaymentStatus } from '../lib/payments/webhookParser'
import { REFERRAL_BONUS, PRICING_MODE_COMPED, MIN_DOWN_PAYMENT, isComped, ownerChargeFor } from '../lib/pricing'
import { hasOutstandingBalance, isOwnerApp } from './lib/ownerApp'
import { isCreatorAccount } from '../lib/accounts'
import { validatePaymentPricing } from './lib/paymentPricing'

// ==================== SHARED CREDIT LOGIC ====================
// Used by both admin.markPaid (manual) and auto-payment (webhook)

/**
 * Credit a creator for a paid submission.
 * Shared logic: updates submission, credits balance, creates earnings,
 * sends notification, logs audit, checks referral qualification.
 *
 * `comped: true` is the promo path (admin.markComped): the owner paid nothing,
 * the creator is still owed their commission. Everything about the CREDIT is
 * identical — same balance, same earnings row, same analytics — because the
 * creator's money is real either way. What changes is everything that assumes
 * cash arrived: no registrar purchase, no referral bonus, and an audit trail
 * that says which it was. See the numbered notes below.
 */
export const creditCreatorForPayment = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        triggeredBy: v.string(), // 'admin:<clerkId>' or 'system:auto-payment'
        paymentRefCode: v.optional(v.string()),
        comped: v.optional(v.boolean()),
        expectedOwnerCharge: v.optional(v.number()),
        // v2 down payments (docs/v2-api-owners.md). Absent = 'full', or
        // 'balance' when a down payment is already in — so an admin "Mark paid"
        // on a deposit_paid order settles the balance without paying twice.
        stage: v.optional(v.union(v.literal('full'), v.literal('deposit'), v.literal('balance'))),
        // The down payment amount (stage 'deposit' only).
        depositAmount: v.optional(v.number()),
    },
    handler: async (ctx, args) => creditCreatorForPaymentImpl(ctx, args),
})

export type CreditStage = 'full' | 'deposit' | 'balance'

/**
 * The crediting path, callable inside another mutation's transaction
 * (convex/ownerPayments.ts applies a token payment and credits atomically).
 *
 * Stages (v2, 2026-10-21):
 *   full    — today's behaviour, unchanged: credit the creator, status
 *             'completed', referral + domain run.
 *   deposit — a down payment (>= MIN_DOWN_PAYMENT, < total) landed. The
 *             selling agent gets their WHOLE cut now (Theo's rule), status
 *             'deposit_paid', balance recorded. Referral bonus and domain
 *             purchase wait for the balance: they are "paid in full" events.
 *   balance — the rest landed. NO second credit (creatorPaidAt is already set);
 *             status 'completed'; referral + domain run now.
 *
 * "Paid in full" happens exactly once per order, in stage full or balance —
 * the block marked PAID-IN-FULL below. Anything that must fire only when the
 * shop has paid everything belongs there.
 */
export async function creditCreatorForPaymentImpl(
    ctx: MutationCtx,
    args: {
        submissionId: Id<'submissions'>
        triggeredBy: string
        paymentRefCode?: string
        comped?: boolean
        expectedOwnerCharge?: number
        stage?: CreditStage
        depositAmount?: number
    },
): Promise<{ credited: boolean; paidInFull: boolean; stage: CreditStage | null }> {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new Error('Submission not found')

    const stage: CreditStage = args.stage
        ?? (hasOutstandingBalance(submission) ? 'balance' : 'full')

    if (stage === 'balance') {
        if (!hasOutstandingBalance(submission)) {
            console.log(`[PAYMENTS] Submission ${args.submissionId} has no outstanding balance, skipping`)
            return { credited: false, paidInFull: false, stage: null }
        }
    } else if (submission.status === 'completed' || submission.creatorPaidAt) {
        // Don't double-pay
        console.log(`[PAYMENTS] Submission ${args.submissionId} already paid, skipping`)
        return { credited: false, paidInFull: false, stage: null }
    }

    // Trust the row over the caller. admin.markComped patches pricingMode
    // BEFORE scheduling this, so a comped submission stays comped even if
    // some future call site forgets the flag — and the Wise webhook can
    // never accidentally re-classify one as a real sale.
    const comped = args.comped === true || isComped(submission as any)
    if (comped && stage !== 'full') throw new Error('Comped websites have no down payment or balance.')

    if (submission.giveawayApplication) {
        // Only admin.markComped can turn a held application into a given
        // site. A paid webhook or legacy caller cannot settle it first.
        if (!isComped(submission)) throw new Error('Giveaway websites must be comped, not marked paid.')
        // An admin can reject while this scheduled credit is pending. Do
        // not revive the row and silently reacquire its released slot.
        if (submission.status === 'rejected') return { credited: false, paidInFull: false, stage: null }
    }

    let orderTotal = 0
    if (!comped && !submission.giveawayApplication) {
        const { amount } = validatePaymentPricing(submission)
        orderTotal = amount
        if (stage === 'full' && args.expectedOwnerCharge !== undefined && amount !== args.expectedOwnerCharge) {
            throw new Error('Payment token amount no longer matches the order.')
        }
        if (stage === 'deposit') {
            const deposit = args.depositAmount ?? NaN
            if (!Number.isFinite(deposit) || deposit < MIN_DOWN_PAYMENT || deposit >= amount) {
                throw new Error(`A down payment must be at least ₱${MIN_DOWN_PAYMENT} and less than the total.`)
            }
        }
    }

    const now = Date.now()
    // Money bookkeeping (v2). Comped orders collected nothing: leave it unset.
    const money = comped ? {} : stage === 'deposit'
        ? {
            amountPaid: args.depositAmount!,
            depositAmount: args.depositAmount!,
            depositPaidAt: now,
            balanceDue: orderTotal - args.depositAmount!,
        }
        : {
            amountPaid: orderTotal,
            balanceDue: 0,
            paidInFullAt: now,
            ...(submission.paidAt ? {} : { paidAt: now }),
        }

    if (stage === 'balance') {
        // The creator was credited with the down payment. Settle the order only.
        await ctx.db.patch(args.submissionId, { ...money, status: 'completed' })
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.triggeredBy,
            // No new audit action (the union is shared): a balance is a
            // confirmed payment with metadata.stage 'balance'.
            action: 'payment_confirmed',
            targetType: 'payment',
            targetId: args.submissionId,
            metadata: {
                stage: 'balance',
                businessName: submission.businessName,
                paymentRefCode: args.paymentRefCode,
                balance: orderTotal - (submission.amountPaid ?? 0),
                orderTotal,
            },
        })
        await paidInFullEffects(ctx, submission, args.submissionId, false)
        await ownerFollowUps(ctx, submission, args.submissionId)
        return { credited: false, paidInFull: true, stage }
    }

    const payoutAmount = submission.giveawayApplication ? 0 : submission.creatorPayout ?? 0

    // 1. Update submission status
    await ctx.db.patch(args.submissionId, {
        creatorPaidAt: now,
        status: stage === 'deposit' ? 'deposit_paid' : 'completed',
        ...money,
    })

    // 2. Credit creator balance
    const creator = await ctx.db.get(submission.creatorId)
    if (creator) {
        await ctx.db.patch(submission.creatorId, {
            balance: (creator.balance || 0) + payoutAmount,
            totalEarnings: ((creator as any).totalEarnings || 0) + payoutAmount,
        })
    }

    // 3. Create earning record
    await ctx.scheduler.runAfter(0, internal.earnings.create, {
        creatorId: submission.creatorId,
        submissionId: args.submissionId,
        amount: payoutAmount,
        type: 'submission_approved',
    })

    // 4. Audit log
    // A comped site must never look like a collected payment in the log —
    // that log is the only place the two can be told apart after the fact.
    const isAuto = args.triggeredBy.startsWith('system:')
    await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
        adminId: args.triggeredBy,
        action: comped
            ? 'submission_comped' as any
            : (isAuto ? 'payment_auto_matched' as any : 'payment_sent'),
        targetType: comped ? 'submission' : (isAuto ? 'payment' as any : 'submission'),
        targetId: args.submissionId,
        metadata: {
            businessName: submission.businessName,
            amount: payoutAmount,
            creatorId: submission.creatorId,
            paymentRefCode: args.paymentRefCode,
            automated: isAuto,
            comped,
            // What the owner was actually charged (₱0 on the promo) against
            // what the site was listed at, so the giveaway's cost is
            // auditable without re-deriving it from pricing constants.
            ownerCharged: comped ? 0 : ownerChargeFor(submission as any),
            listPrice: submission.amount ?? 0,
            compedReason: comped ? (submission as any).compedReason : undefined,
            stage,
            ...(stage === 'deposit' ? { depositAmount: args.depositAmount, balanceDue: orderTotal - args.depositAmount! } : {}),
        },
    })

    // 5. Notification to creator
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
        creatorId: submission.creatorId,
        type: 'payout_sent',
        title: comped ? 'Promo Website Credited!' : 'Payment Received!',
        body: comped
            ? `You earned ₱${payoutAmount} for "${submission.businessName}" — given free under the promo.`
            : `You received ₱${payoutAmount} for "${submission.businessName}".`,
        data: { submissionId: args.submissionId, amount: payoutAmount, comped },
    })

    // 6. Analytics
    const today = new Date().toISOString().split('T')[0]
    const month = today.substring(0, 7)
    await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
        creatorId: submission.creatorId,
        period: today,
        periodType: 'daily',
        field: 'earningsTotal',
        delta: payoutAmount,
    })
    await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
        creatorId: submission.creatorId,
        period: month,
        periodType: 'monthly',
        field: 'earningsTotal',
        delta: payoutAmount,
    })

    console.log(
        `[PAYMENTS] Credited ₱${payoutAmount} to creator ${submission.creatorId} for submission ${args.submissionId} ` +
        `(triggered by ${args.triggeredBy}${comped ? ', COMPED — owner paid ₱0' : ''})`
    )

    // PAID-IN-FULL. A down payment credits the agent above but leaves
    // these for the balance (stage 'balance' calls the same function).
    if (stage === 'full') await paidInFullEffects(ctx, submission, args.submissionId, comped)
    if (!comped) await ownerFollowUps(ctx, submission, args.submissionId)
    return { credited: true, paidInFull: stage === 'full' && !comped, stage }
}

/**
 * Everything that happens once, when an order is paid in full (stage 'full'
 * or 'balance'): referral qualification and the custom-domain purchase.
 * Hook other "paid in full" effects here.
 */
async function paidInFullEffects(
    ctx: MutationCtx,
    submission: Doc<'submissions'>,
    submissionId: Id<'submissions'>,
    comped: boolean,
) {
    const args = { submissionId }
    const creator = await ctx.db.get(submission.creatorId)
    // 7. Referral qualification check
    //
    // REFERRAL_BONUS is ₱1,000 and its rule is "on a referred creator's
    // first PAID submission" (lib/pricing.ts:41). A comped site is not a
    // paid one, so it cannot be the trigger — otherwise refer-a-friend plus
    // one promo site mints ₱1,500 against ₱0 of revenue, with nobody having
    // sold anything. Comped rows are excluded on BOTH sides: they never fire
    // the bonus, and they never count toward "is this the first", so the
    // referred creator's first REAL sale still qualifies later.
    // Affiliate sales still use the shared commission ledger, but nobody
    // can earn a referral bonus for recruiting an affiliate account.
    if (!comped && isCreatorAccount(creator)) {
        const referral = await ctx.db
            .query('referrals')
            .withIndex('by_referred', (q) => q.eq('referredId', submission.creatorId))
            .filter((q) => q.eq(q.field('status'), 'pending'))
            .first()

        if (referral) {
            const completed = await ctx.db
                .query('submissions')
                .withIndex('by_creator_id', (q) => q.eq('creatorId', submission.creatorId))
                .filter((q) => q.eq(q.field('status'), 'completed'))
                .collect()

            const paidSubmissions = completed.filter((s) => !isComped(s as any))

            if (paidSubmissions.length <= 1) {
                await ctx.scheduler.runAfter(0, internal.referrals.qualifyByCreator, {
                    referredId: submission.creatorId,
                    bonusAmount: REFERRAL_BONUS,
                })
            }
        }
    }

    // 8. Custom domain auto-setup
    // If this submission has a requested custom domain, kick off the registration pipeline.
    //
    // NEVER on the comped path. setupForSubmission buys a real domain on a
    // saved card, so a comped custom-domain site would cost the platform the
    // registrar fee AND the ₱500 payout while collecting nothing.
    // admin.markComped already refuses the custom-domain tier up front; this
    // is the second lock, because this mutation is also reachable from the
    // Wise webhook and from any future caller.
    const subm = submission as any
    if (!comped && subm.requestedDomain && subm.submissionType === 'with_custom_domain') {
        console.log(`[PAYMENTS] Scheduling domain setup for ${subm.requestedDomain}`)
        await ctx.scheduler.runAfter(0, internal.domains.setupForSubmission, {
            submissionId: args.submissionId,
        })
    }
}

/** v2: invite the owner to the app (agent sales) / publish a paid owner-app site. */
async function ownerFollowUps(ctx: MutationCtx, submission: Doc<'submissions'>, submissionId: Id<'submissions'>) {
    if (submission.giveawayApplication) return
    if (isOwnerApp(submission)) {
        await ctx.scheduler.runAfter(0, internal.ownerApp.publishIfReady, { submissionId })
    } else if (submission.ownerEmail) {
        await ctx.scheduler.runAfter(0, internal.owners.inviteForSubmission, { submissionId })
    }
}

// ==================== AUTO-PAYMENT PROCESSING ====================

/**
 * Process an incoming Wise deposit.
 * Called by the /wise-deposit-webhook handler.
 *
 * Uses the existing paymentTokens system:
 * - paymentTokens.referenceCode matches the code in the Wise payment note
 * - paymentTokens has the expected amount and submissionId
 * - paymentTokens.markUsed marks it as paid
 */
export const processDeposit = internalAction({
    args: {
        referenceText: v.string(),
        amount: v.number(),
        currency: v.string(),
        transactionId: v.string(),
        senderName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        console.log(`[PAYMENTS] Processing deposit: ₱${args.amount} ${args.currency}, ref="${args.referenceText}", txn=${args.transactionId}`)

        // ── STRATEGY 1: Match by reference code (most precise) ──
        const refCode = extractReferenceFromText(args.referenceText)
        let paymentToken: any = null
        let matchMethod = ''

        if (refCode) {
            paymentToken = await ctx.runQuery(internal.paymentTokens.getByReferenceInternal, { referenceCode: refCode })
            if (paymentToken) {
                matchMethod = 'reference_code'
                console.log(`[PAYMENTS] Matched by reference code: ${refCode}`)
            }
        }

        // ── STRATEGY 2: Match by amount (fallback when Wise doesn't include reference) ──
        // Wise's balances#credit event doesn't include the payment note/reference.
        // So we find ALL pending payment tokens with a matching amount.
        // If exactly 1 match → auto-credit. If 0 or 2+ → log for admin.
        if (!paymentToken) {
            console.log(`[PAYMENTS] No reference match, trying amount-based matching for ₱${args.amount}`)
            const candidates = await ctx.runQuery(internal.paymentTokens.findPendingByAmount, {
                amount: args.amount,
                tolerance: 1, // ₱1 tolerance for InstaPay rounding/fees
            })

            if (candidates.length === 1) {
                paymentToken = candidates[0]
                matchMethod = 'amount_single_match'
                console.log(`[PAYMENTS] ✓ Single pending token matched by amount: ₱${paymentToken.amount}, ref=${paymentToken.referenceCode}, submission=${paymentToken.submissionId}`)
            } else if (candidates.length === 0) {
                console.warn(`[PAYMENTS] No pending payment tokens found for ₱${args.amount}`)
                await ctx.runMutation(internal.auditLogs.log, {
                    adminId: 'system:auto-payment',
                    action: 'payment_unmatched' as any,
                    targetType: 'payment' as any,
                    targetId: args.transactionId,
                    metadata: {
                        amount: args.amount,
                        currency: args.currency,
                        referenceText: args.referenceText,
                        senderName: args.senderName,
                        reason: 'No pending payment token found matching this amount. Admin: click "Mark as Paid" on the submission manually.',
                        matchAttempt: refCode ? 'reference_failed_then_amount_zero' : 'amount_zero',
                    },
                })
                return
            } else {
                // Multiple pending tokens with the same amount — ambiguous, admin must resolve
                console.warn(`[PAYMENTS] ${candidates.length} pending tokens match ₱${args.amount} — ambiguous, skipping auto-match`)
                await ctx.runMutation(internal.auditLogs.log, {
                    adminId: 'system:auto-payment',
                    action: 'payment_unmatched' as any,
                    targetType: 'payment' as any,
                    targetId: args.transactionId,
                    metadata: {
                        amount: args.amount,
                        currency: args.currency,
                        senderName: args.senderName,
                        reason: `${candidates.length} pending submissions have the same amount (₱${args.amount}). Cannot auto-match — admin must click "Mark as Paid" on the correct submission.`,
                        candidateSubmissionIds: candidates.map((c: any) => c.submissionId),
                        candidateRefCodes: candidates.map((c: any) => c.referenceCode),
                    },
                })
                return
            }
        }

        // ── Token found (by reference or amount) — process the payment ──

        // Check if already paid (duplicate)
        if (paymentToken.status === 'paid') {
            console.warn(`[PAYMENTS] Token ${paymentToken.referenceCode} already paid (duplicate deposit)`)
            await ctx.runMutation(internal.auditLogs.log, {
                adminId: 'system:auto-payment',
                action: 'payment_unmatched' as any,
                targetType: 'payment' as any,
                targetId: args.transactionId,
                metadata: { refCode: paymentToken.referenceCode, amount: args.amount, reason: 'Duplicate — already paid' },
            })
            return
        }

        const orderPricing = await ctx.runQuery(internal.paymentTokens.getOrderPricingInternal, {
            submissionId: paymentToken.submissionId,
        })
        // Whole-order tokens must still match the order. Down payment and
        // balance tokens are checked against what is owed by applyTokenPayment.
        if ((paymentToken.kind ?? 'full') === 'full' && orderPricing.amount !== paymentToken.amount) {
            throw new Error('Payment token amount no longer matches the order.')
        }

        // Determine payment status
        const paymentStatus = determinePaymentStatus(args.amount, paymentToken.amount)
        console.log(`[PAYMENTS] Token ${paymentToken.referenceCode}: status=${paymentStatus}, expected=₱${paymentToken.amount}, received=₱${args.amount}, matched_by=${matchMethod}`)

        // If partial, log and stop
        if (paymentStatus === 'partial') {
            await ctx.runMutation(internal.auditLogs.log, {
                adminId: 'system:auto-payment',
                action: 'payment_partial' as any,
                targetType: 'payment' as any,
                targetId: args.transactionId,
                metadata: {
                    refCode: paymentToken.referenceCode,
                    expectedAmount: paymentToken.amount,
                    receivedAmount: args.amount,
                    submissionId: paymentToken.submissionId,
                },
            })
            return
        }

        // Validate, credit and consume the token in ONE mutation (shared with
        // the Xendit webhook — convex/ownerPayments.ts applyTokenPayment). A
        // changed price or payout throws and leaves the invoice for review.
        console.log(`[PAYMENTS] ✓ Auto-crediting submission ${paymentToken.submissionId} (matched_by=${matchMethod})`)
        const applied = await ctx.runMutation(internal.ownerPayments.applyTokenPayment, {
            token: paymentToken.token,
            provider: 'wise',
            externalId: args.transactionId,
            amountReceived: args.amount,
            triggeredBy: 'system:auto-payment',
        })
        if (applied.result === 'rejected') {
            await ctx.runMutation(internal.auditLogs.log, {
                adminId: 'system:auto-payment',
                action: 'payment_unmatched',
                targetType: 'payment',
                targetId: args.transactionId,
                metadata: { refCode: paymentToken.referenceCode, amount: args.amount, reason: applied.reason },
            })
        }
    },
})
