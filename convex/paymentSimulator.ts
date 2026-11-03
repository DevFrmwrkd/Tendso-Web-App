import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { MIN_DOWN_PAYMENT, isComped } from '../lib/pricing';
import { getOwner, ownsSubmission } from './lib/ownerAuth';
import { validatePaymentPricing } from './lib/paymentPricing';

// This module intentionally has no scheduler, action, payment processor or
// provider imports. It can only write its own isolated practice document.
const DEV_CLOUD = 'https://diligent-ibex-454.convex.cloud';
const DEV_SITE = 'https://diligent-ibex-454.convex.site';
const TEST_OWNER = 'poru.fetaruvero@gmail.com';
const MAX_OPERATIONS = 500; // Bound a practice generation; reset always starts a fresh one.
const actions = v.union(v.literal('full'), v.literal('deposit'), v.literal('balance'), v.literal('unmatched'),
    v.literal('approve_review'), v.literal('duplicate'), v.literal('expire'), v.literal('renew'), v.literal('reset'));
export type SimulatorAction = 'full' | 'deposit' | 'balance' | 'unmatched' | 'approve_review' | 'duplicate' | 'expire' | 'renew' | 'reset';
type Session = Doc<'paymentSimulatorSessions'>;
type Kind = 'full' | 'deposit' | 'balance';
type Receipt = { receiptId: string; amount: number; kind: Kind };
type Context = QueryCtx | MutationCtx;
type Access = { owner: Doc<'businessOwners'>; submission: Doc<'submissions'>; total: number; actorClerkId: string };

export type PaymentSimulatorSnapshot = {
    simulationOnly: true; withdrawable: false; currency: 'PHP'; canReset: boolean;
    actorClerkId: string; ownerId: Id<'businessOwners'>; submissionId: Id<'submissions'>; businessName: string;
    sessionId: Id<'paymentSimulatorSessions'> | null;
    total: number; amountPaid: number; balanceDue: number; minDeposit: number;
    revision: number; attempt: number; referenceCode: string; priceChanged: boolean;
    paymentStatus: 'unpaid' | 'deposit_paid' | 'paid';
    requestStatus: 'open' | 'expired' | 'paid'; reviewStatus: 'none' | 'needs_review' | 'approved';
    pendingReview: Receipt | null; lastReceiptId: string | null;
    events: Session['events'];
};

async function access(ctx: Context, submissionId: Id<'submissions'>): Promise<Access | null> {
    if (process.env.PAYMENT_SIMULATOR_ENABLED !== 'true'
        || process.env.CONVEX_CLOUD_URL !== DEV_CLOUD || process.env.CONVEX_SITE_URL !== DEV_SITE) return null;
    const identity = await ctx.auth.getUserIdentity();
    const email = typeof identity?.email === 'string' ? identity.email.trim().toLowerCase() : '';
    const allowed = (process.env.PAYMENT_SIMULATOR_ALLOWLIST ?? '').split(',').map(value => value.trim().toLowerCase());
    if (!identity || identity.emailVerified !== true || email !== TEST_OWNER || !allowed.includes(email)) return null;
    const owner = await getOwner(ctx);
    if (!owner || owner.email.trim().toLowerCase() !== email) return null;
    const submission = await ctx.db.get(submissionId);
    if (!submission || !/^\[TEST\]\s+\S/i.test(submission.businessName)
        || submission.giveawayApplication || isComped(submission)
        || !await ownsSubmission(ctx, owner._id, submissionId)) return null;
    try {
        const { amount: total } = validatePaymentPricing(submission);
        if (!Number.isSafeInteger(total)) return null;
        return { owner, submission, total, actorClerkId: identity.subject };
    } catch { return null; }
}

async function sessionFor(ctx: Context, info: Access) {
    return ctx.db.query('paymentSimulatorSessions')
        .withIndex('by_owner_submission', q => q.eq('ownerId', info.owner._id).eq('submissionId', info.submission._id)).unique();
}

function snapshot(info: Access, session: Session | null): PaymentSimulatorSnapshot {
    const paid = session?.amountPaid ?? 0;
    return {
        simulationOnly: true, withdrawable: false, currency: 'PHP', canReset: true,
        actorClerkId: info.actorClerkId, ownerId: info.owner._id, submissionId: info.submission._id,
        businessName: info.submission.businessName, sessionId: session?._id ?? null,
        total: info.total, amountPaid: paid, balanceDue: Math.max(0, info.total - paid), minDeposit: MIN_DOWN_PAYMENT,
        revision: session?.revision ?? 0, attempt: session?.attempt ?? 1,
        referenceCode: session?.referenceCode ?? 'SIM-NOT-STARTED',
        priceChanged: !!session && session.total !== info.total,
        paymentStatus: paid === 0 ? 'unpaid' : paid >= (session?.total ?? info.total) ? 'paid' : 'deposit_paid',
        requestStatus: session?.requestStatus ?? 'open', reviewStatus: session?.reviewStatus ?? 'none',
        pendingReview: session?.pendingReview ?? null, lastReceiptId: session?.lastReceipt?.receiptId ?? null,
        events: (session?.events ?? []).slice(-25).reverse(),
    };
}

function whole(value: number | undefined): value is number {
    return value !== undefined && Number.isSafeInteger(value) && value > 0;
}
function receiptKind(session: Session, amount: number): Kind {
    const due = session.total - session.amountPaid;
    if (due <= 0 || amount > due) throw new ConvexError('That is more than the simulated balance.');
    if (session.amountPaid > 0) {
        if (amount !== due) throw new ConvexError('Pay the exact simulated remaining balance.');
        return 'balance';
    }
    if (amount === session.total) return 'full';
    if (amount < MIN_DOWN_PAYMENT) throw new ConvexError(`The simulated down payment starts at ₱${MIN_DOWN_PAYMENT}.`);
    return 'deposit';
}
function reference(id: Id<'paymentSimulatorSessions'>, attempt: number) {
    return `SIM-${String(id).slice(-12).toUpperCase()}-${attempt}`;
}

/** Eligibility and practice state only. This never creates any record. */
export const get = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args): Promise<PaymentSimulatorSnapshot | null> => {
        const info = await access(ctx, args.submissionId);
        return info ? snapshot(info, await sessionFor(ctx, info)) : null;
    },
});

/** All writes are confined to paymentSimulatorSessions. No real money is moved. */
export const run = mutation({
    args: { submissionId: v.id('submissions'), action: actions, requestId: v.string(),
        expectedRevision: v.number(), expectedTotal: v.number(), amount: v.optional(v.number()) },
    handler: async (ctx, args): Promise<PaymentSimulatorSnapshot> => {
        const info = await access(ctx, args.submissionId);
        if (!info) throw new ConvexError('Payment practice is unavailable for this account or business.');
        if (!/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestId)) throw new ConvexError('Choose a new simulator request ID.');
        let session = await sessionFor(ctx, info);
        const fingerprint = JSON.stringify({ action: args.action, amount: args.amount ?? null });
        const replay = session?.requests.find(request => request.requestId === args.requestId);
        if (replay) {
            if (replay.fingerprint !== fingerprint) throw new ConvexError('That simulator request ID was already used for another action.');
            return snapshot(info, session);
        }
        if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0
            || args.expectedRevision !== (session?.revision ?? 0)) throw new ConvexError('Practice changed. Refresh before trying again.');
        if (!whole(args.expectedTotal) || args.expectedTotal !== info.total) throw new ConvexError('The business price changed. Refresh before trying again.');
        if (session && session.total !== info.total && args.action !== 'reset') throw new ConvexError('The business price changed. Reset practice before continuing.');
        if (session && session.requests.length >= MAX_OPERATIONS && args.action !== 'reset') throw new ConvexError('This practice generation reached its limit. Reset practice to continue.');
        if (args.action === 'deposit' || args.action === 'unmatched') {
            if (!whole(args.amount)) throw new ConvexError('Enter a positive whole-peso practice amount.');
        } else if (args.amount !== undefined) throw new ConvexError('This practice action does not take an amount.');

        const now = Date.now();
        if (!session) {
            const id = await ctx.db.insert('paymentSimulatorSessions', {
                ownerId: info.owner._id, submissionId: args.submissionId, total: info.total, amountPaid: 0,
                revision: 0, attempt: 1, referenceCode: 'SIM-NOT-STARTED', requestStatus: 'open', reviewStatus: 'none',
                pendingReview: null, lastReceipt: null, events: [], requests: [], createdAt: now, updatedAt: now,
            });
            await ctx.db.patch(id, { referenceCode: reference(id, 1) });
            session = await ctx.db.get(id);
        }
        if (!session) throw new ConvexError('Could not start payment practice.');
        const next = { ...session };
        let outcome: Session['events'][number]['outcome'];
        let amount: number | null = null;
        let message: string;
        if (args.action === 'reset') {
            next.total = info.total;
            next.amountPaid = 0;
            next.attempt += 1;
            next.referenceCode = reference(session._id, next.attempt);
            next.requestStatus = 'open'; next.reviewStatus = 'none'; next.pendingReview = null; next.lastReceipt = null;
            outcome = 'reset'; message = 'Practice reset. The real business and its payments are unchanged.';
        } else if (args.action === 'duplicate') {
            if (!session.lastReceipt) throw new ConvexError('Confirm a simulated receipt before replaying it.');
            outcome = 'duplicate'; amount = session.lastReceipt.amount; message = 'Duplicate simulated receipt ignored. No second credit.';
        } else if (args.action === 'expire') {
            if (session.requestStatus !== 'open' || session.pendingReview || session.amountPaid >= session.total) throw new ConvexError('There is no open practice request to expire.');
            next.requestStatus = 'expired'; outcome = 'expired'; message = 'The simulated request expired. No money was received.';
        } else if (args.action === 'renew') {
            if (session.requestStatus !== 'expired') throw new ConvexError('Expire the practice request before renewing it.');
            next.requestStatus = 'open'; next.attempt += 1; next.referenceCode = reference(session._id, next.attempt);
            outcome = 'renewed'; message = 'A fresh SIM reference is ready. The simulated balance is unchanged.';
        } else {
            let receipt: Receipt;
            if (args.action === 'approve_review') {
                if (!session.pendingReview) throw new ConvexError('There is no simulated receipt waiting for review.');
                receipt = session.pendingReview;
                receiptKind(session, receipt.amount);
            } else {
                if (session.requestStatus !== 'open') throw new ConvexError('Renew or reset the practice request before simulating a receipt.');
                if (session.pendingReview) throw new ConvexError('Review the pending simulated receipt first.');
                if (args.action === 'full' && session.amountPaid > 0) throw new ConvexError('A simulated deposit is already in. Pay the balance instead.');
                if (args.action === 'deposit' && session.amountPaid > 0) throw new ConvexError('A simulated deposit is already in. Pay the balance instead.');
                if (args.action === 'balance' && session.amountPaid === 0) throw new ConvexError('Simulate a deposit before paying the balance.');
                amount = args.action === 'deposit' || args.action === 'unmatched' ? args.amount! : session.total - session.amountPaid;
                const kind = receiptKind(session, amount);
                if (args.action === 'deposit' && kind !== 'deposit') throw new ConvexError('Use Full payment to simulate paying the whole price.');
                receipt = { receiptId: `SIM-RECEIPT-${session._id}-${session.revision + 1}`, amount, kind };
            }
            amount = receipt.amount;
            if (args.action === 'unmatched') {
                next.pendingReview = receipt; next.reviewStatus = 'needs_review';
                outcome = 'needs_review'; message = 'No matching reference. Simulated team verification is required; no money credited.';
            } else {
                next.amountPaid += receipt.amount;
                next.lastReceipt = receipt; next.pendingReview = null;
                if (args.action === 'approve_review') next.reviewStatus = 'approved';
                next.requestStatus = next.amountPaid === session.total ? 'paid' : 'open';
                outcome = 'applied'; message = receipt.kind === 'deposit' ? 'Simulated down payment received. Balance remains.'
                    : receipt.kind === 'balance' ? 'Simulated balance received. Practice is paid in full.' : 'Simulated full payment received.';
            }
        }
        next.revision += 1;
        const event = { id: args.requestId, action: args.action, outcome, amount, createdAt: now, message };
        await ctx.db.patch(session._id, {
            total: next.total, amountPaid: next.amountPaid, revision: next.revision, attempt: next.attempt,
            referenceCode: next.referenceCode, requestStatus: next.requestStatus, reviewStatus: next.reviewStatus,
            pendingReview: next.pendingReview, lastReceipt: next.lastReceipt,
            // Reset clears visible history and replay keys for this generation.
            // Revision never resets, so delayed requests from any old generation
            // fail their required revision check instead of applying again.
            events: args.action === 'reset' ? [event] : [...session.events, event],
            requests: args.action === 'reset' ? [{ requestId: args.requestId, fingerprint }]
                : [...session.requests, { requestId: args.requestId, fingerprint }], updatedAt: now,
        });
        return snapshot(info, (await ctx.db.get(session._id))!);
    },
});
