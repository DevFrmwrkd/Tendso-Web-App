import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { MIN_DOWN_PAYMENT, isComped } from '../lib/pricing';
import { generateReferenceCode } from '../lib/payments/referenceCode';
import { validatePaymentPricing } from './lib/paymentPricing';
import { linkOwnerToSubmission, requirePayerAccess } from './lib/ownerAuth';
import { hasOutstandingBalance, isOwnerApp, isPaidInFull, publishPolicyFor } from './lib/ownerApp';
import { creditCreatorForPaymentImpl, type CreditStage } from './payments';

/**
 * Owner payments v2 — full payments, down payments and balances, shared by
 * Wise (payments.processDeposit) and Xendit (xendit.ts). Contract:
 * docs/v2-api-owners.md.
 *
 *   - A pay token is one payment request: kind 'full' (the whole owner total),
 *     'deposit' (>= MIN_DOWN_PAYMENT and < total) or 'balance' (what is left
 *     after a deposit). Legacy tokens have no kind and mean 'full'.
 *   - applyTokenPayment is THE place money lands: it validates the token
 *     against what is owed, credits through the existing crediting path
 *     (payments.creditCreatorForPaymentImpl, same transaction) and consumes
 *     the token. A token that is already paid is a no-op ('duplicate'), so
 *     webhook retries are safe.
 *   - Status contract: 'deposit_paid' = down payment in, balance due.
 *     Paid in full = 'completed' (what the crediting path writes; legacy
 *     'paid' also counts) and `paidInFullAt` is set.
 */

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // same as the legacy pay link

export type PayKind = 'full' | 'deposit' | 'balance';
const payKind = v.union(v.literal('full'), v.literal('deposit'), v.literal('balance'));

type DbCtx = QueryCtx | MutationCtx;

function requestExpired(token: Doc<'paymentTokens'>, now: number): boolean {
    return token.status === 'expired' || token.expiresAt <= now
        || !!token.xenditInvoiceId && token.xenditExpiresAt !== undefined && token.xenditExpiresAt <= now;
}
function providerOpen(token: Doc<'paymentTokens'>, now: number): boolean {
    return !!token.xenditCheckoutState || !!(token.xenditInvoiceId && token.xenditInvoiceUrl
        && (token.xenditExpiresAt === undefined || token.xenditExpiresAt > now));
}
function approvalRequired(submission: Doc<'submissions'>): boolean {
    return publishPolicyFor(submission) === 'pay_then_publish'
        && (!submission.ownerApprovedAt || submission.status === 'draft' || submission.status === 'rejected');
}
function kindFor(token: Doc<'paymentTokens'>): PayKind {
    const kind = token.kind ?? 'full';
    if (kind !== 'full' && kind !== 'deposit' && kind !== 'balance') throw new ConvexError('Choose a payment option again.');
    return kind;
}

/** A missing legacy invite can only be repaired for this positively verified owner identity. */
async function retryPayer(ctx: DbCtx, submission: Doc<'submissions'>) {
    try { return { createdBy: await requirePayerAccess(ctx, submission), repairOwnerId: null }; }
    catch (error) {
        const identity = await ctx.auth.getUserIdentity();
        const email = typeof identity?.email === 'string' ? identity.email.trim().toLowerCase() : '';
        if (!identity || identity.emailVerified !== true || !email || email !== submission.ownerEmail?.trim().toLowerCase()) throw error;
        const owner = await ctx.db.query('businessOwners').withIndex('by_clerk_id', q => q.eq('clerkId', identity.subject)).first();
        if (!owner || owner.email.trim().toLowerCase() !== email) throw error;
        return { createdBy: `owner:${owner._id}`, repairOwnerId: owner._id };
    }
}

type ReadyRequest = { status: 'ready'; submissionId: Id<'submissions'>; token: string; referenceCode: string; kind: PayKind; amount: number; expiresAt: number };
type RetryResult = ReadyRequest | { status: 'paid' | 'needs_approval' | 'processing'; submissionId: Id<'submissions'> };
const readyRequest = (token: Doc<'paymentTokens'>): ReadyRequest => ({ status: 'ready', submissionId: token.submissionId,
    token: token.token, referenceCode: token.referenceCode, kind: kindFor(token), amount: token.amount, expiresAt: token.expiresAt });

async function currentRequest(ctx: MutationCtx, submission: Doc<'submissions'>, charge: { kind: PayKind; amount: number }, createdBy: string,
    retireOthers = false): Promise<ReadyRequest | { status: 'processing'; submissionId: Id<'submissions'> }> {
    const now = Date.now();
    const requests = await ctx.db.query('paymentTokens').withIndex('by_submissionId', q => q.eq('submissionId', submission._id)).collect();
    const compatible = (row: Doc<'paymentTokens'>) => row.status === 'pending' && !requestExpired(row, now)
        && (row.kind ?? 'full') === charge.kind && row.amount === charge.amount;
    // A timed-out provider POST may have succeeded remotely. Never open a
    // second checkout until that uncertain attempt has been reconciled.
    if (requests.some(row => row.status !== 'paid' && providerOpen(row, now)
        && (row.xenditCheckoutState || !compatible(row)))) return { status: 'processing', submissionId: submission._id };
    const reusable = requests.find(row => compatible(row) && providerOpen(row, now)) ?? requests.find(compatible);
    for (const row of requests) {
        if (row.status === 'pending' && row._id !== reusable?._id && (retireOthers || requestExpired(row, now))) {
            // Expired references remain matchable when money arrives late.
            await ctx.db.patch(row._id, { status: 'expired', adminNotes: 'Payment request replaced; late receipts still match this reference.' });
        }
    }
    if (reusable) return readyRequest(reusable);
    let referenceCode = generateReferenceCode();
    let unique = false;
    for (let attempt = 0; attempt < 10; attempt++) {
        if (!await ctx.db.query('paymentTokens').withIndex('by_reference', q => q.eq('referenceCode', referenceCode)).first()) { unique = true; break; }
        referenceCode = generateReferenceCode();
    }
    if (!unique) throw new ConvexError('Could not create a payment reference. Please try again.');
    const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
    const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const expiresAt = now + TOKEN_TTL_MS;
    await ctx.db.insert('paymentTokens', { submissionId: submission._id, token, referenceCode, amount: charge.amount,
        status: 'pending', createdAt: now, expiresAt, kind: charge.kind, createdBy });
    if (!submission.paymentReference) await ctx.db.patch(submission._id, { paymentReference: referenceCode });
    return { status: 'ready', submissionId: submission._id, token, referenceCode, kind: charge.kind, amount: charge.amount, expiresAt };
}

/** What is owed on an order. Throws (plain Error) when it cannot be billed. */
export function orderMoney(submission: Doc<'submissions'>) {
    if (submission.giveawayApplication) {
        throw new Error('Giveaway applications cannot be billed. Give the website through the comped flow instead.');
    }
    if (isComped(submission)) throw new Error('Comped websites cannot be billed.');
    const { amount: total } = validatePaymentPricing(submission);
    const paidInFull = isPaidInFull(submission);
    const amountPaid = submission.amountPaid ?? (paidInFull ? total : 0);
    const balanceDue = paidInFull ? 0 : Math.max(0, total - amountPaid);
    return { total, amountPaid, balanceDue, paidInFull, depositOutstanding: hasOutstandingBalance(submission) };
}

/** Validate a requested payment and return the kind and amount to charge. */
function resolveCharge(submission: Doc<'submissions'>, kind: PayKind, requested?: number): { kind: PayKind; amount: number } {
    const money = orderMoney(submission);
    if (money.paidInFull) throw new ConvexError('This website is already paid.');
    if (kind === 'balance') {
        if (!money.depositOutstanding) throw new ConvexError('There is no balance to pay yet.');
        return { kind, amount: money.balanceDue };
    }
    if (money.depositOutstanding || money.amountPaid > 0) {
        throw new ConvexError('A down payment is already in. Pay the balance instead.');
    }
    if (kind === 'full') return { kind, amount: money.total };
    const amount = requested ?? NaN;
    if (!Number.isFinite(amount) || Math.round(amount) !== amount) {
        throw new ConvexError('Please enter a whole peso amount.');
    }
    if (amount < MIN_DOWN_PAYMENT) throw new ConvexError(`The smallest down payment is ₱${MIN_DOWN_PAYMENT}.`);
    if (amount > money.total) throw new ConvexError('That is more than the price.');
    // Paying everything up front is a full payment.
    if (amount === money.total) return { kind: 'full', amount };
    return { kind: 'deposit', amount };
}

async function pendingTokens(ctx: DbCtx, submissionId: Id<'submissions'>) {
    return (await ctx.db
        .query('paymentTokens')
        .withIndex('by_submissionId', (q) => q.eq('submissionId', submissionId))
        .collect()).filter((t) => t.status === 'pending');
}

function xenditEnabled(): boolean {
    return !!process.env.XENDIT_SECRET_KEY && !!process.env.XENDIT_CALLBACK_TOKEN;
}

// ==================== QUERIES ====================

/** Public capability only. Credentials stay on Convex; clients need no build-time flag. */
export const getCheckoutAvailability = query({
    args: {},
    handler: () => ({ xenditEnabled: xenditEnabled() }),
});

/** What the owner owes and how they may pay. Owner / admin / selling agent. */
export const getPaymentState = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new ConvexError('We could not find that website.');
        await requirePayerAccess(ctx, submission);
        let money: ReturnType<typeof orderMoney>;
        try {
            money = orderMoney(submission);
        } catch {
            return { billable: false as const, status: submission.status };
        }
        const pending = await pendingTokens(ctx, args.submissionId);
        return {
            billable: true as const,
            status: submission.status,
            total: money.total,
            amountPaid: money.amountPaid,
            balanceDue: money.balanceDue,
            paidInFull: money.paidInFull,
            depositPaid: !!submission.depositPaidAt,
            minDownPayment: MIN_DOWN_PAYMENT,
            // What the app may offer right now.
            canPayFull: !money.paidInFull && money.amountPaid === 0 && !money.depositOutstanding,
            canPayDeposit: !money.paidInFull && money.amountPaid === 0 && !money.depositOutstanding && money.total > MIN_DOWN_PAYMENT,
            canPayBalance: money.depositOutstanding,
            // Owner-app sites need "Looks good" before paying.
            needsApproval: publishPolicyFor(submission) === 'pay_then_publish'
                && (!submission.ownerApprovedAt || submission.status === 'draft' || submission.status === 'rejected'),
            xenditEnabled: xenditEnabled(),
            pendingTokens: pending.map((t) => ({
                token: t.token,
                referenceCode: t.referenceCode,
                kind: (t.kind ?? 'full') as PayKind,
                amount: t.amount,
                expiresAt: t.expiresAt,
                checkoutUrl: t.xenditInvoiceUrl ?? null,
            })),
        };
    },
});

// ==================== CREATE A PAY TOKEN ====================

/**
 * Create (or reuse) a pay token for a full payment, a down payment or the
 * balance. The token's reference code works for Wise bank transfers; pass the
 * token to xendit.createCheckout for GCash / Maya / card.
 */
export const createPayToken = mutation({
    args: {
        submissionId: v.id('submissions'),
        kind: payKind,
        // Down payment amount in whole pesos (kind 'deposit' only).
        amount: v.optional(v.number()),
        // The displayed whole-order quote; old clients may omit it.
        expectedTotal: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new ConvexError('We could not find that website.');
        const createdBy = await requirePayerAccess(ctx, submission);
        if (publishPolicyFor(submission) === 'pay_then_publish' && (!submission.ownerApprovedAt || submission.status === 'draft' || submission.status === 'rejected')
            && (!isOwnerApp(submission) || !createdBy.startsWith('admin:'))) {
            throw new ConvexError('Check your site first, then tap "Looks good".');
        }
        let charge: { kind: PayKind; amount: number };
        try {
            if (args.expectedTotal !== undefined) {
                if (!Number.isFinite(args.expectedTotal) || args.expectedTotal <= 0) {
                    throw new ConvexError('Refresh the price and try again.');
                }
                if (orderMoney(submission).total !== args.expectedTotal) {
                    throw new ConvexError('The price has changed. Check the latest total before paying.');
                }
            }
            charge = resolveCharge(submission, args.kind, args.amount);
        } catch (error) {
            if (error instanceof ConvexError) throw error;
            throw new ConvexError('This website cannot be paid for online. Please contact us.');
        }

        const request = await currentRequest(ctx, submission, charge, createdBy);
        if (request.status === 'processing') throw new ConvexError('An earlier checkout may still be open. Check its payment status before trying again.');
        const { token, referenceCode, kind, amount, expiresAt } = request;
        return { token, referenceCode, kind, amount, expiresAt };
    },
});

const retryArgs = { token: v.string(), expectedSubmissionId: v.optional(v.id('submissions')) };

/** Authenticated status only; an invalid or foreign route cannot open another account's order. */
export const getPaymentAttempt = query({
    args: retryArgs,
    handler: async (ctx, args) => {
        const source = await ctx.db.query('paymentTokens').withIndex('by_token', q => q.eq('token', args.token)).first();
        if (!source || args.expectedSubmissionId && source.submissionId !== args.expectedSubmissionId) return null;
        const submission = await ctx.db.get(source.submissionId);
        if (!submission) return null;
        try {
            await retryPayer(ctx, submission);
            const money = orderMoney(submission);
            let status: 'ready' | 'expired' | 'paid' | 'needs_approval' | 'cancelled' | 'processing';
            const now = Date.now();
            if (money.paidInFull || source.status === 'paid') status = 'paid';
            else if (source.status === 'cancelled') status = 'cancelled';
            else if (approvalRequired(submission)) status = 'needs_approval';
            else if (source.xenditCheckoutState || requestExpired(source, now) && providerOpen(source, now)) status = 'processing';
            else status = requestExpired(source, now) ? 'expired' : 'ready';
            const balance = status !== 'paid' && money.depositOutstanding;
            return { status, submissionId: submission._id, kind: balance ? 'balance' as const : kindFor(source),
                amount: balance ? money.balanceDue : source.amount, expiresAt: source.expiresAt };
        } catch { return null; }
    },
});

/** Renew a request against the signed-in payer's current order, never a public token-only grant. */
export const retryExpiredPayment = mutation({
    args: { ...retryArgs, expectedTotal: v.optional(v.number()) },
    handler: async (ctx, args): Promise<RetryResult> => {
        const source = await ctx.db.query('paymentTokens').withIndex('by_token', q => q.eq('token', args.token)).first();
        if (!source) throw new ConvexError('That pay link was not found.');
        if (args.expectedSubmissionId && source.submissionId !== args.expectedSubmissionId) throw new ConvexError('Your selected business changed. Open its payment page again.');
        const submission = await ctx.db.get(source.submissionId);
        if (!submission) throw new ConvexError('We could not find that website.');
        const payer = await retryPayer(ctx, submission);
        const money = orderMoney(submission);
        if (source.status === 'cancelled') throw new ConvexError('This pay link was cancelled. Open your business page or contact the team.');
        if (payer.repairOwnerId) await linkOwnerToSubmission(ctx, payer.repairOwnerId, submission._id);
        if (money.paidInFull) return { status: 'paid', submissionId: submission._id };
        if (approvalRequired(submission)) return { status: 'needs_approval', submissionId: submission._id };
        if (args.expectedTotal !== undefined && (!Number.isFinite(args.expectedTotal) || args.expectedTotal !== money.total)) {
            throw new ConvexError('The price has changed. Check the latest total before paying.');
        }
        if (source.status === 'paid') {
            // A paid deposit is a receipt, not permission to create another
            // charge. Only reuse a balance request the owner already chose.
            const balance = (await pendingTokens(ctx, submission._id)).find(row => !requestExpired(row, Date.now())
                && row.kind === 'balance' && row.amount === money.balanceDue);
            if (!money.depositOutstanding || !balance) return { status: 'paid', submissionId: submission._id };
        }
        const kind = money.depositOutstanding ? 'balance' : kindFor(source);
        const charge = resolveCharge(submission, kind, kind === 'deposit' ? source.amount : undefined);
        return currentRequest(ctx, submission, charge, payer.createdBy, true);
    },
});

// ==================== APPLY A PAYMENT (shared by Wise + Xendit) ====================

export type ApplyResult =
    | { result: 'applied'; submissionId: Id<'submissions'>; stage: CreditStage | null; status: string }
    | { result: 'duplicate'; submissionId: Id<'submissions'> }
    | { result: 'rejected'; submissionId: Id<'submissions'>; reason: string };

/**
 * Mark a pay token paid and credit the order — idempotent.
 *
 * Throws (plain Error, transaction rolled back, token stays pending) when the
 * order no longer matches the token: changed price/payout, a whole-order token
 * after a deposit, a stale balance. Returns 'rejected' for a token an admin
 * cancelled or a short payment, and 'duplicate' for one already paid.
 */
export async function applyTokenPaymentImpl(
    ctx: MutationCtx,
    args: {
        token: string;
        provider: 'wise' | 'xendit' | 'manual';
        triggeredBy: string;
        externalId?: string;
        amountReceived?: number;
    },
): Promise<ApplyResult> {
    const tokenRow = await ctx.db.query('paymentTokens')
        .withIndex('by_token', (q) => q.eq('token', args.token)).first();
    if (!tokenRow) throw new Error('Payment token not found');
    const submissionId = tokenRow.submissionId;
    if (tokenRow.status === 'paid') return { result: 'duplicate', submissionId };
    if (tokenRow.status === 'cancelled') {
        return { result: 'rejected', submissionId, reason: 'This pay link was cancelled. Admin: check the order and mark it paid by hand.' };
    }
    if (args.amountReceived !== undefined && args.amountReceived + 1 < tokenRow.amount) {
        return { result: 'rejected', submissionId, reason: `Short payment: ₱${args.amountReceived} of ₱${tokenRow.amount}.` };
    }

    const submission = await ctx.db.get(submissionId);
    if (!submission) throw new Error('Submission not found');
    const money = orderMoney(submission); // throws for giveaway / comped / invalid pricing
    const kind = (tokenRow.kind ?? 'full') as PayKind;

    let stage: CreditStage;
    let depositAmount: number | undefined;
    if (kind === 'balance') {
        if (!money.depositOutstanding) throw new Error('There is no outstanding balance for this payment.');
        if (tokenRow.amount !== money.total - money.amountPaid) throw new Error('Payment token amount no longer matches the order.');
        stage = 'balance';
    } else if (money.paidInFull) {
        // Already settled another way (e.g. an admin marked it paid). Same as
        // the legacy path: the crediting step is a no-op, the token is consumed.
        stage = 'full';
    } else {
        if (money.depositOutstanding || money.amountPaid > 0) {
            throw new Error('A down payment is already recorded; this payment does not match the balance.');
        }
        if (kind === 'deposit' && tokenRow.amount < money.total) {
            stage = 'deposit';
            depositAmount = tokenRow.amount;
        } else {
            if (tokenRow.amount !== money.total) throw new Error('Payment token amount no longer matches the order.');
            stage = 'full';
        }
    }

    const credit = await creditCreatorForPaymentImpl(ctx, {
        submissionId,
        triggeredBy: args.triggeredBy,
        paymentRefCode: tokenRow.referenceCode,
        expectedOwnerCharge: stage === 'full' ? tokenRow.amount : undefined,
        stage,
        depositAmount,
    });

    const now = Date.now();
    await ctx.db.patch(tokenRow._id, {
        status: 'paid',
        usedAt: now,
        paymentReceivedAt: now,
        provider: args.provider,
        ...(args.amountReceived !== undefined ? { paidAmount: args.amountReceived } : {}),
        ...(args.externalId ? { externalPaymentId: args.externalId } : {}),
        ...(args.provider === 'wise' && args.externalId ? { wiseTransactionId: args.externalId } : {}),
    });
    // Other open requests for this order are now stale (and would make Wise
    // amount-matching ambiguous). Cancel them.
    for (const other of await pendingTokens(ctx, submissionId)) {
        await ctx.db.patch(other._id, { status: 'cancelled', adminNotes: `Superseded by payment ${tokenRow.referenceCode}` });
    }
    const after = await ctx.db.get(submissionId);
    await ctx.scheduler.runAfter(0, internal.ownerInbox.captureSiteUpdates, { submissionId });
    return { result: 'applied', submissionId, stage: credit.stage, status: after?.status ?? submission.status };
}

export const applyTokenPayment = internalMutation({
    args: {
        token: v.string(),
        provider: v.union(v.literal('wise'), v.literal('xendit'), v.literal('manual')),
        triggeredBy: v.string(),
        externalId: v.optional(v.string()),
        amountReceived: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<ApplyResult> => applyTokenPaymentImpl(ctx, args),
});

// ==================== XENDIT SUPPORT (called from xendit.ts) ====================

/** Auth-checked token context for creating a checkout. Runs as the caller. */
async function checkoutContext(ctx: DbCtx, token: string) {
        const tokenRow = await ctx.db.query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', token)).first();
        if (!tokenRow) throw new ConvexError('That pay link was not found.');
        const submission = await ctx.db.get(tokenRow.submissionId);
        if (!submission) throw new ConvexError('We could not find that website.');
        await requirePayerAccess(ctx, submission);
        if (tokenRow.status !== 'pending') throw new ConvexError('This pay link is no longer open.');
        if (requestExpired(tokenRow, Date.now())) throw new ConvexError('This checkout expired. Tap Pay again for a fresh payment link.');
        if (submission.giveawayApplication || isComped(submission)) {
            throw new ConvexError('This website cannot be paid for.');
        }
        if (!isOwnerApp(submission) && publishPolicyFor(submission) === 'pay_then_publish'
            && (!submission.ownerApprovedAt || submission.status === 'draft' || submission.status === 'rejected')) {
            throw new ConvexError('Check your site first, then tap "Looks good".');
        }
        const charge = resolveCharge(submission, kindFor(tokenRow), tokenRow.amount);
        if (charge.amount !== tokenRow.amount) throw new ConvexError('Payment details changed. Open your business payment page again.');
        return {
            token: tokenRow.token,
            referenceCode: tokenRow.referenceCode,
            amount: tokenRow.amount,
            kind: (tokenRow.kind ?? 'full') as PayKind,
            expiresAt: tokenRow.expiresAt,
            xenditInvoiceId: tokenRow.xenditInvoiceId ?? null,
            xenditInvoiceUrl: tokenRow.xenditInvoiceUrl ?? null,
            xenditExpiresAt: tokenRow.xenditExpiresAt ?? null,
            submissionId: submission._id,
            businessName: submission.businessName,
            payerEmail: submission.ownerEmail ?? null,
            checkoutState: tokenRow.xenditCheckoutState ?? null,
        };
}

export const checkoutContextInternal = internalQuery({
    args: { token: v.string() },
    handler: (ctx, args) => checkoutContext(ctx, args.token),
});

/** One provider request per token, including calls racing across devices. */
export const beginXenditCheckout = internalMutation({
    args: { token: v.string(), attemptId: v.string() },
    handler: async (ctx, args) => {
        const pay = await checkoutContext(ctx, args.token);
        const others = await ctx.db.query('paymentTokens')
            .withIndex('by_submissionId', q => q.eq('submissionId', pay.submissionId)).collect();
        // Different full/deposit requests can both predate the first provider
        // call. Claim the order, not just this token, in the same transaction.
        if (others.some(row => row.token !== pay.token && row.status !== 'paid' && providerOpen(row, Date.now()))) {
            return { status: 'processing' as const };
        }
        if (pay.xenditInvoiceUrl && pay.xenditInvoiceId && (pay.xenditExpiresAt === null || pay.xenditExpiresAt > Date.now())) {
            return { status: 'ready' as const, pay };
        }
        if (pay.checkoutState) return { status: 'processing' as const };
        const row = await ctx.db.query('paymentTokens').withIndex('by_token', q => q.eq('token', args.token)).first();
        if (!row) throw new ConvexError('That pay link was not found.');
        await ctx.db.patch(row._id, { xenditCheckoutAttempt: args.attemptId, xenditCheckoutStartedAt: Date.now(), xenditCheckoutState: 'creating' });
        return { status: 'claimed' as const, pay };
    },
});

export const markXenditCheckoutUncertain = internalMutation({
    args: { token: v.string(), attemptId: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db.query('paymentTokens').withIndex('by_token', q => q.eq('token', args.token)).first();
        if (row?.xenditCheckoutAttempt === args.attemptId && row.xenditCheckoutState === 'creating') {
            await ctx.db.patch(row._id, { xenditCheckoutState: 'uncertain' });
        }
    },
});

/** Authentication rejection proves this attempt did not create an invoice. */
export const releaseXenditAuthFailure = internalMutation({
    args: { token: v.string(), attemptId: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db.query('paymentTokens').withIndex('by_token', q => q.eq('token', args.token)).first();
        if (row?.xenditCheckoutAttempt === args.attemptId && row.xenditCheckoutState === 'creating') {
            await ctx.db.patch(row._id, { xenditCheckoutState: undefined });
        }
    },
});

export const recordXenditInvoice = internalMutation({
    args: {
        token: v.string(),
        invoiceId: v.string(),
        invoiceUrl: v.string(),
        expiresAt: v.optional(v.number()),
        attemptId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const tokenRow = await ctx.db.query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token)).first();
        if (!tokenRow || tokenRow.xenditCheckoutAttempt && tokenRow.xenditCheckoutAttempt !== args.attemptId) return { recorded: false };
        let usable = false;
        try { await checkoutContext(ctx, args.token); usable = true; } catch { /* Keep the remote invoice identity for reconciliation. */ }
        // An authenticated EXPIRED callback may arrive before the POST returns.
        // Its known deadline must not be replaced by the stale POST response.
        const expiresAt = tokenRow.xenditInvoiceId === args.invoiceId && tokenRow.xenditExpiresAt !== undefined && tokenRow.xenditExpiresAt <= Date.now()
            ? tokenRow.xenditExpiresAt : args.expiresAt;
        if (expiresAt !== undefined && expiresAt <= Date.now()) usable = false;
        await ctx.db.patch(tokenRow._id, {
            xenditInvoiceId: args.invoiceId,
            xenditInvoiceUrl: args.invoiceUrl,
            xenditExpiresAt: expiresAt,
            xenditCheckoutState: undefined,
        });
        return { recorded: usable };
    },
});
