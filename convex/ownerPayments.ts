import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { MIN_DOWN_PAYMENT, isComped } from '../lib/pricing';
import { generateReferenceCode } from '../lib/payments/referenceCode';
import { validatePaymentPricing } from './lib/paymentPricing';
import { requirePayerAccess } from './lib/ownerAuth';
import { hasOutstandingBalance, isOwnerApp, isPaidInFull } from './lib/ownerApp';
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
            needsApproval: isOwnerApp(submission) && !submission.ownerApprovedAt,
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
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new ConvexError('We could not find that website.');
        const createdBy = await requirePayerAccess(ctx, submission);
        if (isOwnerApp(submission) && !submission.ownerApprovedAt && !createdBy.startsWith('admin:')) {
            throw new ConvexError('Check your site first, then tap "Looks good".');
        }
        let charge: { kind: PayKind; amount: number };
        try {
            charge = resolveCharge(submission, args.kind, args.amount);
        } catch (error) {
            if (error instanceof ConvexError) throw error;
            throw new ConvexError('This website cannot be paid for online. Please contact us.');
        }

        // Reuse a matching pending token so a double tap gives one reference.
        const now = Date.now();
        const reusable = (await pendingTokens(ctx, args.submissionId)).find(
            (t) => (t.kind ?? 'full') === charge.kind && t.amount === charge.amount && t.expiresAt > now,
        );
        if (reusable) {
            return { token: reusable.token, referenceCode: reusable.referenceCode, kind: charge.kind, amount: reusable.amount, expiresAt: reusable.expiresAt };
        }

        let referenceCode = generateReferenceCode();
        for (let i = 0; i < 5; i++) {
            const clash = await ctx.db.query('paymentTokens')
                .withIndex('by_reference', (q) => q.eq('referenceCode', referenceCode)).first();
            if (!clash) break;
            referenceCode = generateReferenceCode();
        }
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        const expiresAt = now + TOKEN_TTL_MS;
        await ctx.db.insert('paymentTokens', {
            submissionId: args.submissionId,
            token,
            referenceCode,
            amount: charge.amount,
            status: 'pending',
            createdAt: now,
            expiresAt,
            kind: charge.kind,
            createdBy,
        });
        if (!submission.paymentReference) await ctx.db.patch(args.submissionId, { paymentReference: referenceCode });
        return { token, referenceCode, kind: charge.kind, amount: charge.amount, expiresAt };
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
export const checkoutContextInternal = internalQuery({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const tokenRow = await ctx.db.query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token)).first();
        if (!tokenRow) throw new ConvexError('That pay link was not found.');
        const submission = await ctx.db.get(tokenRow.submissionId);
        if (!submission) throw new ConvexError('We could not find that website.');
        await requirePayerAccess(ctx, submission);
        if (tokenRow.status !== 'pending') throw new ConvexError('This pay link is no longer open.');
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
        };
    },
});

export const recordXenditInvoice = internalMutation({
    args: {
        token: v.string(),
        invoiceId: v.string(),
        invoiceUrl: v.string(),
        expiresAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const tokenRow = await ctx.db.query('paymentTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token)).first();
        if (!tokenRow || tokenRow.status !== 'pending') return;
        await ctx.db.patch(tokenRow._id, {
            xenditInvoiceId: args.invoiceId,
            xenditInvoiceUrl: args.invoiceUrl,
            xenditExpiresAt: args.expiresAt,
        });
    },
});
