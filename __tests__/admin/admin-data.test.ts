import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './creators.ts': () => import('../../convex/creators'),
    './submissions.ts': () => import('../../convex/submissions'),
    './withdrawals.ts': () => import('../../convex/withdrawals'),
    './auditLogs.ts': () => import('../../convex/auditLogs'),
    './analytics.ts': () => import('../../convex/analytics'),
    './domains.ts': () => import('../../convex/domains'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
    './announcements.ts': () => import('../../convex/announcements'),
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    const fixtures = await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert('creators', {
            clerkId: 'creator', email: 'creator@example.com', role: 'creator', status: 'active', balance: 2000,
        });
        const affiliateId = await ctx.db.insert('creators', {
            clerkId: 'affiliate', email: 'affiliate@example.com', role: 'affiliate', status: 'active', balance: 2000,
        });
        const legacyId = await ctx.db.insert('creators', {
            clerkId: 'legacy', email: 'legacy@example.com', balance: 2000,
        });
        for (const account of [
            { clerkId: 'admin', role: 'admin', status: 'active' },
            { clerkId: 'other-admin', role: 'admin', status: 'active' },
            { clerkId: 'staff', role: 'staff', status: 'active' },
            { clerkId: 'suspended-admin', role: 'admin', status: 'suspended' },
            { clerkId: 'deleted-admin', role: 'admin', isDeleted: true },
            { clerkId: 'removed-admin', role: 'admin', status: 'deleted' },
            { clerkId: 'suspended-creator', role: 'creator', status: 'suspended', balance: 2000 },
        ]) await ctx.db.insert('creators', { email: `${account.clerkId}@example.com`, ...account });
        const submissionId = await ctx.db.insert('submissions', {
            creatorId, businessName: 'Creator shop', businessType: 'Salon', ownerName: 'Owner',
            ownerPhone: '09170000000', address: 'Main Street', city: 'Quezon City', status: 'pending_payment',
            amount: 1999, submissionType: 'with_custom_domain', domainStatus: 'live', domainCostPHP: 600,
        });
        const affiliateSubmissionId = await ctx.db.insert('submissions', {
            creatorId: affiliateId, businessName: 'Affiliate shop', businessType: 'Salon', ownerName: 'Owner',
            ownerPhone: '09170000001', address: 'Main Street', city: 'Quezon City', status: 'pending_payment',
            amount: 2499, submissionType: 'standard',
        });
        const withdrawalId = await ctx.db.insert('withdrawals', {
            creatorId, amount: 500, payoutMethod: 'wise_email', accountDetails: 'private-wise@example.com',
            wiseEmail: 'private-wise@example.com', status: 'pending', createdAt: Date.now(),
        });
        return { creatorId, affiliateId, legacyId, submissionId, affiliateSubmissionId, withdrawalId };
    });
    await t.mutation(internal.auditLogs.log, {
        adminId: 'admin', action: 'manual_override', targetType: 'withdrawal', targetId: fixtures.withdrawalId,
        metadata: { private: 'admin notes' },
    });
    for (const creatorId of [fixtures.creatorId, fixtures.affiliateId]) {
        await t.mutation(internal.analytics.upsertCreatorStats, {
            creatorId, period: '2026-10', periodType: 'monthly', stats: { earningsTotal: 1000 },
        });
    }
    await t.mutation(internal.analytics.upsertWebsiteStats, {
        submissionId: fixtures.submissionId, date: '2026-10-09', stats: { pageViews: 5 },
    });
    const token = await t.action(api.paymentTokens.createPaymentToken, {
        submissionId: fixtures.submissionId, referenceCode: 'CREATOR-REFERENCE', amount: 1,
    });
    const affiliateToken = await t.action(api.paymentTokens.createPaymentToken, {
        submissionId: fixtures.affiliateSubmissionId, referenceCode: 'AFFILIATE-REFERENCE', amount: 1,
    });
    return { t, ...fixtures, token, affiliateToken, admin: t.withIdentity({ subject: 'admin' }) };
}

describe('private admin data', () => {
    it.each([undefined, 'creator', 'legacy', 'affiliate', 'staff', 'unknown', 'suspended-admin', 'deleted-admin', 'removed-admin'])(
        'rejects administrator reads and writes for %s', async (subject) => {
            const { t, token, withdrawalId } = await setup();
            const client = subject ? t.withIdentity({ subject }) : t;
            const calls = [
                () => client.query(api.withdrawals.getAll),
                () => client.query(api.withdrawals.getByStatus, { status: 'pending' }),
                () => client.query(api.auditLogs.getRecent, {}),
                () => client.query(api.auditLogs.getByTarget, { targetType: 'withdrawal', targetId: withdrawalId }),
                () => client.query(api.auditLogs.getByAdmin, { adminId: 'admin' }),
                () => client.mutation(api.auditLogs.backfillFromSubmissions),
                () => client.query(api.analytics.getAllAnalytics, {}),
                () => client.query(api.analytics.getPlatformStats, { periodType: 'monthly', period: '2026-10' }),
                () => client.query(api.analytics.getWebsiteStatsByDate, { date: '2026-10-09' }),
                () => client.query(api.domains.getTotalHostingerDomainCostsPHP),
                () => client.action(api.domains.getHostingerPaymentMethodStatus),
                () => client.query(api.paymentTokens.listPending, {}),
                () => client.query(api.paymentTokens.getExpiringTokens, {}),
                () => client.query(api.paymentTokens.getByReference, { referenceCode: 'CREATOR-REFERENCE' }),
                () => client.mutation(api.paymentTokens.markCancelled, { token: token.token }),
                () => client.mutation(api.paymentTokens.recordEmailSent, { token: token.token }),
            ];
            for (const call of calls) await expect(call()).rejects.toThrow(/Not authenticated|Forbidden/);
            expect(await t.query(api.paymentTokens.getByToken, { token: token.token })).toMatchObject({ status: 'pending' });
            expect((await t.run((ctx) => ctx.db.query('withdrawals').collect()))).toHaveLength(1);
        },
    );

    it('lets an authenticated admin read totals, private audit data and token lists, and manage tokens', async () => {
        const { admin, token, withdrawalId } = await setup();
        expect(await admin.query(api.withdrawals.getAll)).toEqual([expect.objectContaining({ wiseEmail: 'private-wise@example.com' })]);
        expect(await admin.query(api.withdrawals.getByStatus, { status: 'pending' })).toHaveLength(1);
        expect(await admin.query(api.auditLogs.getRecent, {})).toEqual([expect.objectContaining({ adminId: 'admin' })]);
        expect(await admin.query(api.auditLogs.getByTarget, { targetType: 'withdrawal', targetId: withdrawalId })).toHaveLength(1);
        expect(await admin.query(api.auditLogs.getByAdmin, { adminId: 'admin' })).toHaveLength(1);
        expect(await admin.query(api.analytics.getAllAnalytics, {})).toHaveLength(2);
        expect(await admin.query(api.analytics.getPlatformStats, { periodType: 'monthly', period: '2026-10' })).toMatchObject({ earningsTotal: 2000 });
        expect(await admin.query(api.analytics.getWebsiteStatsByDate, { date: '2026-10-09' })).toHaveLength(1);
        expect(await admin.query(api.domains.getTotalHostingerDomainCostsPHP)).toBe(600);
        expect(await admin.query(api.paymentTokens.listPending, {})).toHaveLength(2);
        expect(await admin.query(api.paymentTokens.getExpiringTokens, { withinDays: 40 })).toHaveLength(2);
        expect(await admin.query(api.paymentTokens.getByReference, { referenceCode: 'CREATOR-REFERENCE' })).toMatchObject({ token: token.token });
        await admin.mutation(api.paymentTokens.recordEmailSent, { token: token.token });
        await admin.mutation(api.paymentTokens.markCancelled, { token: token.token, reason: 'Admin cancelled' });
        expect(await admin.query(api.paymentTokens.getByToken, { token: token.token })).toMatchObject({
            status: 'cancelled', emailSentAt: expect.any(Number), adminNotes: 'Admin cancelled',
        });
        expect(await admin.mutation(api.auditLogs.backfillFromSubmissions)).toEqual({ created: 4 });
    });
});

describe('session-bound administrator arguments', () => {
    it.each([undefined, 'creator', 'affiliate', 'staff', 'other-admin'])(
        'rejects a supplied admin identity from %s before any effects', async (subject) => {
            const { t, withdrawalId, submissionId } = await setup();
            const client = subject ? t.withIdentity({ subject }) : t;
            const calls = [
                () => client.mutation(api.withdrawals.adminRetry, { id: withdrawalId, status: 'failed', adminId: 'admin' }),
                () => client.mutation(api.withdrawals.updateStatus, { id: withdrawalId, status: 'completed', adminId: 'admin' }),
                () => client.action(api.withdrawals.refreshFromWise, { withdrawalId, adminId: 'admin' }),
                () => client.query(api.announcements.previewAudience, { adminId: 'admin', audience: 'all' }),
                () => client.query(api.announcements.searchRecipients, { adminId: 'admin', q: 'creator' }),
                () => client.query(api.announcements.list, { adminId: 'admin' }),
                () => client.action(api.announcements.send, { adminId: 'admin', audience: 'all', title: 'Hello', body: 'Message' }),
                () => client.action(api.domains.purchaseDomainForSubmission, { submissionId, domain: 'shop.example.com', adminClerkId: 'admin' }),
            ];
            for (const call of calls) await expect(call()).rejects.toThrow(/Not authenticated|Forbidden/);
            expect(await t.run((ctx) => ctx.db.get(withdrawalId))).toMatchObject({ status: 'pending' });
            expect(await t.run((ctx) => ctx.db.query('announcements').collect())).toHaveLength(0);
            expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toHaveLength(0);
        },
    );

    it('allows real admin actions with the matching identity', async () => {
        const { t, admin, withdrawalId, creatorId, submissionId } = await setup();
        expect(await admin.action(api.withdrawals.refreshFromWise, { withdrawalId, adminId: 'admin' })).toMatchObject({ refreshed: false });
        expect(await admin.query(api.announcements.previewAudience, { adminId: 'admin', audience: 'active' })).toMatchObject({ count: 3 });
        expect(await admin.query(api.announcements.searchRecipients, { adminId: 'admin', q: 'creator' })).not.toHaveLength(0);
        expect(await admin.query(api.announcements.list, { adminId: 'admin' })).toEqual([]);
        const sent = await admin.action(api.announcements.send, {
            adminId: 'admin', audience: 'all', creatorIds: [creatorId], title: 'Hello', body: 'Message',
        });
        expect(sent).toMatchObject({ sent: 1 });
        expect(await t.run((ctx) => ctx.db.query('announcements').collect())).toEqual([expect.objectContaining({ sentBy: 'admin' })]);
        await admin.mutation(api.withdrawals.updateStatus, { id: withdrawalId, status: 'completed', adminId: 'admin' });
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ totalWithdrawn: 500 });
        expect(await admin.action(api.domains.purchaseDomainForSubmission, {
            submissionId, domain: 'creator-shop.example.com', adminClerkId: 'admin',
        })).toMatchObject({ success: true });
    });
});

describe('private account data and own payouts', () => {
    it('denies another account’s wallet, analytics, website analytics, domain info and payment token', async () => {
        const { t, creatorId, submissionId } = await setup();
        for (const subject of [undefined, 'affiliate', 'staff', 'unknown', 'suspended-creator']) {
            const client = subject ? t.withIdentity({ subject }) : t;
            const calls = [
                () => client.query(api.withdrawals.getByCreator, { creatorId }),
                () => client.query(api.analytics.getCreatorStats, { creatorId, periodType: 'monthly' }),
                () => client.query(api.analytics.getWebsiteStats, { submissionId }),
                () => client.query(api.domains.getSubmissionDomainInfo, { submissionId }),
                () => client.query(api.paymentTokens.getBySubmissionId, { submissionId }),
                () => client.mutation(api.withdrawals.create, { creatorId, amount: 100, wiseEmail: 'attacker@example.com' }),
            ];
            for (const call of calls) await expect(call()).rejects.toThrow(/Not authenticated|Forbidden/);
        }
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ balance: 2000 });
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toHaveLength(0);
    });

    it('preserves creator and affiliate own-data reads, and admin overrides', async () => {
        const { t, admin, creatorId, affiliateId, submissionId, affiliateSubmissionId, affiliateToken } = await setup();
        const creator = t.withIdentity({ subject: 'creator' });
        const affiliate = t.withIdentity({ subject: 'affiliate' });
        expect(await creator.query(api.withdrawals.getByCreator, { creatorId })).toHaveLength(1);
        expect(await affiliate.query(api.withdrawals.getByCreator, { creatorId: affiliateId })).toEqual([]);
        expect(await creator.query(api.analytics.getCreatorStats, { creatorId, periodType: 'monthly' })).toHaveLength(1);
        expect(await affiliate.query(api.analytics.getCreatorStats, { creatorId: affiliateId, periodType: 'monthly' })).toHaveLength(1);
        expect(await creator.query(api.analytics.getWebsiteStats, { submissionId })).toMatchObject({ totals: { pageViews: 5 } });
        expect(await creator.query(api.domains.getSubmissionDomainInfo, { submissionId })).toMatchObject({ domainStatus: 'live' });
        expect(await affiliate.query(api.paymentTokens.getBySubmissionId, { submissionId: affiliateSubmissionId })).toMatchObject({ token: affiliateToken.token });
        expect(await admin.query(api.paymentTokens.getBySubmissionId, { submissionId })).toMatchObject({ amount: 1999 });
        expect(await admin.query(api.withdrawals.getByCreator, { creatorId })).toHaveLength(1);
        expect(await t.query(internal.paymentTokens.getBySubmissionIdInternal, { submissionId })).toMatchObject({ amount: 1999 });
    });

    it('preserves mobile Wise and legacy web payout shapes for each account owner', async () => {
        const { t, creatorId, affiliateId, legacyId } = await setup();
        const mobile = await t.withIdentity({ subject: 'creator' }).mutation(api.withdrawals.create, {
            creatorId, amount: 100, wiseEmail: 'MOBILE@example.com',
        });
        const affiliate = await t.withIdentity({ subject: 'affiliate' }).mutation(api.withdrawals.create, {
            creatorId: affiliateId, amount: 200, payoutMethod: 'wise_email', accountDetails: 'affiliate-wallet@example.com',
        });
        const legacy = await t.withIdentity({ subject: 'legacy' }).mutation(api.withdrawals.create, {
            creatorId: legacyId, amount: 300, payoutMethod: 'bank_transfer', accountDetails: 'Legacy bank account',
        });
        expect(await t.run((ctx) => ctx.db.get(mobile._id))).toMatchObject({ creatorId, amount: 100, wiseEmail: 'mobile@example.com', status: 'pending' });
        expect(await t.run((ctx) => ctx.db.get(affiliate._id))).toMatchObject({ creatorId: affiliateId, amount: 200, wiseEmail: 'affiliate-wallet@example.com' });
        expect(await t.run((ctx) => ctx.db.get(legacy._id))).toMatchObject({ creatorId: legacyId, amount: 300, payoutMethod: 'bank_transfer' });
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ balance: 1900 });
        expect(await t.run((ctx) => ctx.db.get(affiliateId))).toMatchObject({ balance: 1800 });
        expect(await t.run((ctx) => ctx.db.get(legacyId))).toMatchObject({ balance: 1700 });
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'withdrawals:processWiseTransfer')).toHaveLength(2);
    });

    it('rejects nonfinite or nonpositive payout amounts without changing balances', async () => {
        const { t, creatorId } = await setup();
        const creator = t.withIdentity({ subject: 'creator' });
        for (const amount of [0, -1, NaN, Infinity]) {
            await expect(creator.mutation(api.withdrawals.create, { creatorId, amount, wiseEmail: 'wallet@example.com' })).rejects.toThrow('greater than zero');
        }
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ balance: 2000 });
        expect(await t.run((ctx) => ctx.db.query('withdrawals').collect())).toHaveLength(1);
    });
});
