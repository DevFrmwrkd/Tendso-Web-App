import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
};
type Backend = ReturnType<typeof convexTest>;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 9, 10)); });
afterEach(() => vi.useRealTimers());

async function setup(fields: Partial<Omit<Doc<'creators'>, '_id' | '_creationTime'>> = {}) {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'affiliate', email: 'affiliate@example.com', role: 'affiliate', status: 'active', ...fields,
    }));
    const otherId = await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'other-affiliate', email: 'other@example.com', role: 'affiliate', status: 'active', balance: 99999,
    }));
    return { t, id, otherId, affiliate: t.withIdentity({ subject: 'affiliate' }), other: t.withIdentity({ subject: 'other-affiliate' }) };
}

async function sale(t: Backend, creatorId: Id<'creators'>,
    fields: Partial<Omit<Doc<'submissions'>, '_id' | '_creationTime'>> = {}) {
    vi.advanceTimersByTime(1);
    return t.run((ctx) => ctx.db.insert('submissions', {
        creatorId, businessName: 'Own Shop', businessType: 'shop', ownerName: 'Private Owner',
        ownerPhone: '09171234567', ownerEmail: 'owner-private@example.com', address: 'Private Street', city: 'Quezon City',
        transcript: 'Private interview', photos: ['https://example.com/private.jpg'],
        status: 'completed', creatorPayout: 1000, ...fields,
    }));
}

async function earning(t: Backend, creatorId: Id<'creators'>, submissionId: Id<'submissions'>,
    fields: Partial<Omit<Doc<'earnings'>, '_id' | '_creationTime'>> = {}) {
    vi.advanceTimersByTime(1);
    return t.run((ctx) => ctx.db.insert('earnings', {
        creatorId, submissionId, amount: 1000, type: 'submission_approved', status: 'available', createdAt: Date.now(), ...fields,
    }));
}

async function withdrawal(t: Backend, creatorId: Id<'creators'>,
    fields: Partial<Omit<Doc<'withdrawals'>, '_id' | '_creationTime'>> = {}) {
    vi.advanceTimersByTime(1);
    return t.run((ctx) => ctx.db.insert('withdrawals', {
        creatorId, amount: 100, payoutMethod: 'wise_email', accountDetails: 'own-wise@example.com',
        wiseEmail: 'own-wise@example.com', status: 'pending', createdAt: Date.now(), ...fields,
    }));
}

async function referral(t: Backend, referrerId: Id<'creators'>,
    fields: Partial<Omit<Doc<'referrals'>, '_id' | '_creationTime' | 'referredId'>> = {},
    names: { firstName?: string; lastName?: string } = { firstName: 'Referred', lastName: 'Creator' }) {
    vi.advanceTimersByTime(1);
    return t.run(async (ctx) => {
        const referredId = await ctx.db.insert('creators', {
            clerkId: `referred-${Date.now()}`, email: 'private-referral@example.com', phone: '09170000000', role: 'creator', ...names,
        });
        const id = await ctx.db.insert('referrals', {
            referrerId, referredId, referralCode: 'PRIVATE-REFERRAL-CODE', status: 'pending', createdAt: Date.now(), ...fields,
        });
        return { id, referredId };
    });
}

describe('affiliate portal authorization', () => {
    it('requires a session and an affiliate profile, including for admin and staff sessions', async () => {
        const { t } = await setup();
        await expect(t.query(api.affiliates.portal, {})).rejects.toThrow('Not authenticated');
        await expect(t.withIdentity({ subject: 'no-account' }).query(api.affiliates.portal, {})).rejects.toThrow('affiliate account');
        for (const role of ['creator', 'admin', 'staff', undefined]) {
            const clerkId = role ?? 'legacy-creator';
            await t.run((ctx) => ctx.db.insert('creators', { clerkId, email: `${clerkId}@example.com`, role, status: 'active' }));
            await expect(t.withIdentity({ subject: clerkId }).query(api.affiliates.portal, {})).rejects.toThrow('affiliate account');
        }
    });

    it('rejects both deletion markers but lets a suspended affiliate read their own history', async () => {
        const { t, id, affiliate } = await setup({ status: 'suspended', balance: 750 });
        const submissionId = await sale(t, id);
        await earning(t, id, submissionId, { amount: 750 });
        const result = await affiliate.query(api.affiliates.portal, {});
        expect(result.summary.balance).toBe(750);
        expect(result.earnings).toHaveLength(1);
        expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe('suspended');
        await t.run((ctx) => ctx.db.patch(id, { isDeleted: true }));
        await expect(affiliate.query(api.affiliates.portal, {})).rejects.toThrow('affiliate account');
        await t.run((ctx) => ctx.db.patch(id, { isDeleted: false, status: 'deleted' }));
        await expect(affiliate.query(api.affiliates.portal, {})).rejects.toThrow('affiliate account');
    });

    it('rejects pending, unknown and missing affiliate statuses', async () => {
        const { t, id, affiliate } = await setup();
        for (const status of ['pending', 'unknown', undefined]) {
            await t.run((ctx) => ctx.db.patch(id, { status }));
            await expect(affiliate.query(api.affiliates.portal, {})).rejects.toThrow('affiliate account');
        }
    });

    it('accepts no selected account and isolates every history and total to the current identity', async () => {
        const { t, id, otherId, affiliate, other } = await setup({ balance: 250 });
        const ownSale = await sale(t, id, { businessName: 'Own Paid Shop' });
        const foreignSale = await sale(t, otherId, { businessName: 'Foreign Paid Shop' });
        await earning(t, id, ownSale, { amount: 250 });
        await earning(t, otherId, foreignSale, { amount: 9999 });
        await sale(t, otherId, { status: 'pending_payment', creatorPayout: 5000 });
        await withdrawal(t, otherId, { amount: 4000 });
        await referral(t, otherId, { status: 'paid', bonusAmount: 1000 });
        const forged = { creatorId: otherId };
        // @ts-expect-error Also verify runtime rejection of account selection forbidden by generated types.
        await expect(affiliate.query(api.affiliates.portal, forged)).rejects.toThrow();
        const result = await affiliate.query(api.affiliates.portal, {});
        expect(result.summary).toEqual({ balance: 250, totalEarned: 250, totalWithdrawn: 0, pendingCommission: 0, inFlight: 0 });
        expect(result.earnings.map((row) => row.businessName)).toEqual(['Own Paid Shop']);
        expect(result.withdrawals).toEqual([]);
        expect(result.referrals).toEqual([]);
        expect(result.referralStats).toEqual({ total: 0, pending: 0, qualified: 0, paid: 0, totalEarned: 0 });
        const foreign = await other.query(api.affiliates.portal, {});
        expect(foreign.summary).toEqual({ balance: 99999, totalEarned: 9999, totalWithdrawn: 0, pendingCommission: 5000, inFlight: 4000 });
        expect(foreign.earnings.map((row) => row.businessName)).toEqual(['Foreign Paid Shop']);
        expect(foreign.withdrawals).toHaveLength(1);
        expect(foreign.referrals).toHaveLength(1);
    });
});

describe('affiliate portal wallet and histories', () => {
    it('counts only deployed or payment-pending positive commissions without a recorded credit', async () => {
        const { t, id, affiliate } = await setup();
        await sale(t, id, { status: 'deployed', creatorPayout: 600 });
        await sale(t, id, { status: 'pending_payment', creatorPayout: 1200 });
        for (const status of ['draft', 'pending', 'submitted', 'in_review', 'approved', 'rejected', 'completed', 'paid', 'website_generated', 'unpublished']) {
            await sale(t, id, { status, creatorPayout: 777 });
        }
        await sale(t, id, { status: 'deployed', creatorPaidAt: Date.now(), creatorPayout: 900 });
        await sale(t, id, { status: 'pending_payment', creatorPaidAt: 0, creatorPayout: 900 });
        await sale(t, id, { status: 'deployed', creatorPayout: 0 });
        await sale(t, id, { status: 'pending_payment', creatorPayout: -500 });
        await sale(t, id, { status: 'pending_payment', creatorPayout: undefined });
        expect((await affiliate.query(api.affiliates.portal, {})).summary.pendingCommission).toBe(1800);
    });

    it('uses authoritative balances and stored totals while summing only in-flight withdrawals', async () => {
        const { t, id, affiliate } = await setup({ balance: 375, totalEarnings: 7000, totalWithdrawn: 2000 });
        const submissionId = await sale(t, id);
        await earning(t, id, submissionId, { amount: 300, status: 'available' });
        await earning(t, id, submissionId, { amount: 1000, type: 'referral_bonus', status: 'withdrawn' });
        await earning(t, id, submissionId, { amount: 50, status: 'pending' });
        await withdrawal(t, id, { amount: 500, status: 'completed' });
        await withdrawal(t, id, { amount: 100, status: 'pending' });
        await withdrawal(t, id, { amount: 200, status: 'processing' });
        const failed = await withdrawal(t, id, { amount: 400, status: 'failed', errorMessage: 'Wise transfer failed', failureReason: 'Recipient declined' });
        const result = await affiliate.query(api.affiliates.portal, {});
        expect(result.summary).toEqual({ balance: 375, totalEarned: 7000, totalWithdrawn: 2000, pendingCommission: 0, inFlight: 300 });
        expect(result.withdrawals[0]).toEqual(await t.run((ctx) => ctx.db.get(failed)));
        expect(result.withdrawals.map((row) => row.status)).toEqual(['failed', 'processing', 'pending', 'completed']);
    });

    it('falls back only for absent totals, preserves explicit zero totals and supplies empty-account zeros', async () => {
        const { t, id, affiliate } = await setup();
        expect((await affiliate.query(api.affiliates.portal, {})).summary)
            .toEqual({ balance: 0, totalEarned: 0, totalWithdrawn: 0, pendingCommission: 0, inFlight: 0 });
        const submissionId = await sale(t, id);
        await earning(t, id, submissionId, { amount: 200, status: 'available' });
        await earning(t, id, submissionId, { amount: 500, status: 'withdrawn' });
        await withdrawal(t, id, { amount: 400, status: 'completed' });
        await withdrawal(t, id, { amount: 900, status: 'failed' });
        expect((await affiliate.query(api.affiliates.portal, {})).summary)
            .toEqual({ balance: 0, totalEarned: 700, totalWithdrawn: 400, pendingCommission: 0, inFlight: 0 });
        await t.run((ctx) => ctx.db.patch(id, { totalEarnings: 0, totalWithdrawn: 0 }));
        expect((await affiliate.query(api.affiliates.portal, {})).summary)
            .toEqual({ balance: 0, totalEarned: 0, totalWithdrawn: 0, pendingCommission: 0, inFlight: 0 });
    });

    it('projects only public business/name details and safely handles removed linked records', async () => {
        const { t, id, affiliate } = await setup();
        const submissionId = await sale(t, id, { businessName: 'Safe Shop Name' });
        const earningId = await earning(t, id, submissionId);
        const firstReferral = await referral(t, id, { status: 'qualified', bonusAmount: 1000 }, { firstName: 'Alex' });
        const secondReferral = await referral(t, id, { status: 'paid', bonusAmount: 1000 });
        const missingSale = await sale(t, id);
        await earning(t, id, missingSale, { amount: 500 });
        await t.run(async (ctx) => {
            await ctx.db.delete(missingSale);
            await ctx.db.delete(secondReferral.referredId);
        });
        const result = await affiliate.query(api.affiliates.portal, {});
        expect(result.earnings.map((row) => row.businessName)).toEqual(['Unknown', 'Safe Shop Name']);
        expect(result.earnings.find((row) => row._id === earningId)).toEqual({
            _id: earningId, amount: 1000, type: 'submission_approved', status: 'available',
            createdAt: (await t.run((ctx) => ctx.db.get(earningId)))!.createdAt, businessName: 'Safe Shop Name',
        });
        expect(Object.keys(result.earnings[0]).sort()).toEqual(['_id', 'amount', 'businessName', 'createdAt', 'status', 'type']);
        expect(result.referrals.map((row) => row.referredName)).toEqual(['Unknown', 'Alex']);
        expect(Object.keys(result.referrals[0]).sort()).toEqual(['_id', 'bonusAmount', 'createdAt', 'referredName', 'status']);
        expect(result.referrals.find((row) => row._id === firstReferral.id)?.bonusAmount).toBe(1000);
        expect(JSON.stringify(result)).not.toContain('private@example.com');
        expect(JSON.stringify(result)).not.toContain('owner-private@example.com');
        expect(JSON.stringify(result)).not.toContain('Private interview');
        expect(JSON.stringify(result)).not.toContain('Private Street');
        expect(JSON.stringify(result)).not.toContain('private-referral@example.com');
        expect(JSON.stringify(result)).not.toContain('PRIVATE-REFERRAL-CODE');
    });

    it('includes complete newest-first histories and totals beyond the sales page size', async () => {
        const { t, id, affiliate } = await setup();
        const submissionId = await sale(t, id);
        const earningIds: Id<'earnings'>[] = [];
        const withdrawalIds: Id<'withdrawals'>[] = [];
        const referralIds: Id<'referrals'>[] = [];
        for (let index = 0; index < 12; index++) {
            await sale(t, id, { status: index % 2 === 0 ? 'deployed' : 'pending_payment', creatorPayout: 100 });
            earningIds.push(await earning(t, id, submissionId, { amount: 10 }));
            withdrawalIds.push(await withdrawal(t, id, { amount: 2, status: index % 3 === 0 ? 'completed' : index % 3 === 1 ? 'pending' : 'processing' }));
            const { id: referralId } = await referral(t, id, {
                status: index % 3 === 0 ? 'pending' : index % 3 === 1 ? 'qualified' : 'paid',
                bonusAmount: index % 3 === 0 ? undefined : 1000,
            });
            referralIds.push(referralId);
        }
        const firstSalesPage = await affiliate.query(api.affiliates.sales, { paginationOpts: { numItems: 1, cursor: null } });
        expect(firstSalesPage.page).toHaveLength(1);
        expect(firstSalesPage.isDone).toBe(false);
        const result = await affiliate.query(api.affiliates.portal, {});
        expect(result.earnings.map((row) => row._id)).toEqual(earningIds.reverse());
        expect(result.withdrawals.map((row) => row._id)).toEqual(withdrawalIds.reverse());
        expect(result.referrals.map((row) => row._id)).toEqual(referralIds.reverse());
        expect(result.summary).toEqual({ balance: 0, totalEarned: 120, totalWithdrawn: 8, pendingCommission: 1200, inFlight: 16 });
        expect(result.referralStats).toEqual({ total: 12, pending: 4, qualified: 4, paid: 4, totalEarned: 8000 });
        expect(result.referrals.filter((row) => row.status === 'pending').every((row) => row.bonusAmount === 0)).toBe(true);
    });
});
