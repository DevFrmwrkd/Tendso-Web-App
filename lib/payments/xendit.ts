/**
 * Xendit Invoices API — pure helpers (no fetch, no DB). Used by convex/xendit.ts.
 *
 * API used: POST https://api.xendit.co/v2/invoices, HTTP Basic auth with the
 * secret key as the username and an empty password. Request fields (snake_case,
 * from Xendit's CreateInvoiceRequest model): external_id, amount, currency,
 * description, payer_email, invoice_duration (seconds), success_redirect_url,
 * failure_redirect_url, payment_methods, metadata. Response: id, invoice_url,
 * status, expiry_date.
 *
 * Callback (InvoiceCallback model): id, external_id, status, amount,
 * paid_amount, paid_at, payment_method, payment_channel, currency. Every
 * webhook carries the account's verification token in the `x-callback-token`
 * header.
 *
 * UNCERTAIN (verify in the Xendit dashboard before go-live, see
 * docs/v2-api-owners.md): the exact status strings (we treat PAID and SETTLED
 * as paid, EXPIRED as expired), and the payment_methods codes for GCash / Maya
 * / card (we send none by default, so the invoice offers every method enabled
 * on the account; XENDIT_PAYMENT_METHODS overrides, e.g. "GCASH,PAYMAYA,CREDIT_CARD").
 */

export const XENDIT_INVOICES_URL = 'https://api.xendit.co/v2/invoices';
/** How long a checkout stays open (24 hours). The pay token itself lasts 30 days. */
export const XENDIT_INVOICE_DURATION_SECONDS = 24 * 60 * 60;

export interface XenditInvoiceInput {
    referenceCode: string;
    amount: number;
    businessName: string;
    kind: 'full' | 'deposit' | 'balance';
    payerEmail?: string | null;
    successRedirectUrl?: string | null;
    failureRedirectUrl?: string | null;
    paymentMethods?: string[];
    metadata?: Record<string, string>;
}

const KIND_WORDS: Record<XenditInvoiceInput['kind'], string> = {
    full: 'Website',
    deposit: 'Website down payment',
    balance: 'Website balance',
};

/** The JSON body for POST /v2/invoices. `external_id` is our reference code. */
export function buildInvoiceRequest(input: XenditInvoiceInput): Record<string, unknown> {
    const body: Record<string, unknown> = {
        external_id: input.referenceCode,
        amount: input.amount,
        currency: 'PHP',
        description: `${KIND_WORDS[input.kind]} for ${input.businessName} (${input.referenceCode})`.slice(0, 250),
        invoice_duration: XENDIT_INVOICE_DURATION_SECONDS,
    };
    if (input.payerEmail) body.payer_email = input.payerEmail;
    if (input.successRedirectUrl) body.success_redirect_url = input.successRedirectUrl;
    if (input.failureRedirectUrl) body.failure_redirect_url = input.failureRedirectUrl;
    if (input.paymentMethods && input.paymentMethods.length > 0) body.payment_methods = input.paymentMethods;
    if (input.metadata) body.metadata = input.metadata;
    return body;
}

/** "GCASH, PAYMAYA" → ['GCASH','PAYMAYA']; empty → undefined (all enabled methods). */
export function parsePaymentMethods(raw: string | undefined | null): string[] | undefined {
    const list = (raw ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    return list.length > 0 ? list : undefined;
}

/** Basic auth header: secret key as username, empty password. */
export function basicAuthHeader(secretKey: string): string {
    return `Basic ${btoa(`${secretKey}:`)}`;
}

/** Only https:// pages or the app's own scheme may be redirect targets. */
export function isAllowedRedirect(url: string | undefined | null): boolean {
    if (!url) return false;
    return /^https:\/\/[^\s]+$/i.test(url) || /^tendso:\/\/[^\s]*$/i.test(url);
}

export interface InvoiceCreated {
    invoiceId: string;
    invoiceUrl: string;
    expiresAt?: number;
}

export function parseInvoiceResponse(json: unknown): InvoiceCreated | null {
    if (!json || typeof json !== 'object') return null;
    const r = json as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.invoice_url !== 'string') return null;
    const expiry = typeof r.expiry_date === 'string' ? Date.parse(r.expiry_date) : NaN;
    return { invoiceId: r.id, invoiceUrl: r.invoice_url, expiresAt: Number.isFinite(expiry) ? expiry : undefined };
}

export interface InvoiceCallback {
    invoiceId: string;
    externalId: string;
    status: string;
    amount?: number;
    paidAmount?: number;
    paymentMethod?: string;
    paymentChannel?: string;
}

export function parseInvoiceCallback(json: unknown): InvoiceCallback | null {
    if (!json || typeof json !== 'object') return null;
    const r = json as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.external_id !== 'string' || typeof r.status !== 'string') return null;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
    return {
        invoiceId: r.id,
        externalId: r.external_id,
        status: r.status.toUpperCase(),
        amount: num(r.amount),
        paidAmount: num(r.paid_amount),
        paymentMethod: typeof r.payment_method === 'string' ? r.payment_method : undefined,
        paymentChannel: typeof r.payment_channel === 'string' ? r.payment_channel : undefined,
    };
}

export function isPaidStatus(status: string): boolean {
    return status === 'PAID' || status === 'SETTLED';
}

/** Constant-time string compare for the callback token. */
export function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
