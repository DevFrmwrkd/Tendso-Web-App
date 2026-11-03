import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { Id } from '../../convex/_generated/dataModel';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './payments.ts': () => import('../../convex/payments'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
    './ownerPayments.ts': () => import('../../convex/ownerPayments'),
    './auditLogs.ts': () => import('../../convex/auditLogs'),
};
const NOW = Date.UTC(2026, 10, 3, 16);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

async function setup(count = 1, expired = false) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active', balance: 0, totalEarnings: 0 });
        const submissions: Id<'submissions'>[] = [], tokens: Id<'paymentTokens'>[] = [];
        for (let index = 0; index < count; index++) {
            const submissionId = await ctx.db.insert('submissions', { creatorId, businessName: `Shop ${index + 1}`, businessType: 'Other',
                ownerName: 'Sam', ownerPhone: '09171234567', ownerEmail: 'sam@example.test', address: '1 Main St', city: 'Marikina',
                status: 'pending_payment', amount: 4999, creatorPayout: 2500, submissionType: 'standard' });
            const referenceCode = index === 0 ? 'ND-AAAA-BBBB' : 'ND-CCCC-DDDD';
            const tokenId = await ctx.db.insert('paymentTokens', { submissionId, token: `request-${index}`, referenceCode, kind: 'full', amount: 4999,
                status: expired ? 'expired' : 'pending', createdAt: NOW - 10000, expiresAt: expired ? NOW - 1 : NOW + 86400000 });
            submissions.push(submissionId); tokens.push(tokenId);
        }
        return { creatorId, submissions, tokens };
    });
    const snapshot = () => t.run(async ctx => ({ creator: await ctx.db.get(ids.creatorId),
        submissions: await Promise.all(ids.submissions.map(id => ctx.db.get(id))),
        tokens: await Promise.all(ids.tokens.map(id => ctx.db.get(id))),
        earnings: await ctx.db.query('earnings').collect(), jobs: await ctx.db.system.query('_scheduled_functions').collect(),
        audit: await ctx.db.query('auditLogs').collect() }));
    const receive = (fields: { referenceText?: string; currency?: string; amount?: number } = {}) => t.action(internal.payments.processDeposit, {
        referenceText: '', amount: 4999, currency: 'PHP', transactionId: 'wise-transfer', senderName: 'Sam Sender', ...fields,
    });
    return { t, ...ids, receive, snapshot };
}

function expectUnconfirmed(state: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>['snapshot']>>) {
    expect(state.creator).toMatchObject({ balance: 0, totalEarnings: 0 });
    expect(state.submissions.every(submission => !submission?.paidInFullAt && !submission?.amountPaid)).toBe(true);
    expect(state.tokens.every(token => token?.status === 'pending')).toBe(true);
    expect(state.earnings).toEqual([]);
    expect(state.jobs.filter(job => job.name === 'earnings:create' || job.name === 'ownerApp:publishIfReady')).toHaveLength(0);
}

describe('Wise transfers require exact reference identity', () => {
    it.each([0, 1, 2])('queues a missing reference with %i amount candidates and never credits from the amount', async count => {
        const { receive, snapshot, submissions } = await setup(count);
        await receive();
        const state = await snapshot();
        expectUnconfirmed(state);
        expect(state.audit).toEqual([expect.objectContaining({ action: 'payment_unmatched', targetId: 'wise-transfer', metadata: expect.objectContaining({
            requiresReview: true, matchAttempt: 'reference_missing', amount: 4999, currency: 'PHP', senderName: 'Sam Sender', candidateSubmissionIds: submissions,
        }) })]);
    });

    it('queues an unknown reference even when exactly one request has the same amount', async () => {
        const { receive, snapshot, submissions } = await setup();
        await receive({ referenceText: 'Payment ND-EEEE-FFFF' });
        const state = await snapshot();
        expectUnconfirmed(state);
        expect(state.audit[0].metadata).toMatchObject({ requiresReview: true, matchAttempt: 'reference_not_found',
            referenceText: 'Payment ND-EEEE-FFFF', candidateSubmissionIds: submissions, candidateRefCodes: ['ND-AAAA-BBBB'] });
    });

    it.each(['USD', 'EUR', ''])('queues a %s receipt even when the reference exists', async currency => {
        const { receive, snapshot } = await setup();
        await receive({ referenceText: 'Payment ND-AAAA-BBBB', currency });
        const state = await snapshot();
        expectUnconfirmed(state);
        expect(state.audit[0].metadata).toMatchObject({ requiresReview: true, matchAttempt: 'invalid_currency_or_amount', currency });
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('queues an invalid amount %s without settling the referenced request', async amount => {
        const { receive, snapshot } = await setup();
        await receive({ referenceText: 'Payment ND-AAAA-BBBB', amount });
        const state = await snapshot();
        expectUnconfirmed(state);
        expect(state.audit[0].metadata).toMatchObject({ requiresReview: true, matchAttempt: 'invalid_currency_or_amount' });
    });

    it('still settles an exact PHP reference after expiry and credits once across duplicate delivery', async () => {
        const { receive, snapshot } = await setup(1, true);
        await receive({ referenceText: 'Payment ND-AAAA-BBBB' });
        let state = await snapshot();
        expect(state.creator).toMatchObject({ balance: 2500, totalEarnings: 2500 });
        expect(state.submissions[0]).toMatchObject({ status: 'completed', amountPaid: 4999, paidInFullAt: NOW });
        expect(state.tokens[0]).toMatchObject({ status: 'paid', wiseTransactionId: 'wise-transfer', paidAmount: 4999 });
        expect(state.jobs.filter(job => job.name === 'earnings:create')).toHaveLength(1);
        await receive({ referenceText: 'Payment ND-AAAA-BBBB' });
        state = await snapshot();
        expect(state.creator).toMatchObject({ balance: 2500, totalEarnings: 2500 });
        expect(state.jobs.filter(job => job.name === 'earnings:create')).toHaveLength(1);
    });
});
