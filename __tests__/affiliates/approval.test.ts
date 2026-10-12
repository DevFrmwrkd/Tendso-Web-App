import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './creators.ts': () => import('../../convex/creators'),
    './referrals.ts': () => import('../../convex/referrals'),
    './withdrawals.ts': () => import('../../convex/withdrawals'),
};
const signup = { firstName: 'Alex Santos', email: 'alex@example.com', phone: '09171234567', handle: 'alex-shops' };
const paginationOpts = { numItems: 10, cursor: null };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active',
    }));
    const admin = t.withIdentity({ subject: 'admin' });
    const affiliate = t.withIdentity({ subject: 'affiliate', email: signup.email });
    const id = await affiliate.mutation(api.affiliates.create, signup);
    return { t, admin, affiliate, id };
}

describe('affiliate admin approval', () => {
    it.each(['anonymous', 'affiliate', 'creator', 'staff', 'suspended-admin', 'deleted-admin'])(
        'rejects approval by %s without writes or scheduled work', async (actor) => {
            const { t, id, affiliate } = await setup();
            if (actor !== 'anonymous' && actor !== 'affiliate') {
                await t.run((ctx) => ctx.db.insert('creators', {
                    clerkId: actor, email: `${actor}@example.com`,
                    role: actor.endsWith('admin') ? 'admin' : actor,
                    status: actor === 'suspended-admin' ? 'suspended' : actor === 'deleted-admin' ? 'deleted' : 'active',
                }));
            }
            const caller = actor === 'anonymous' ? t : actor === 'affiliate' ? affiliate : t.withIdentity({ subject: actor });
            const before = await t.run((ctx) => ctx.db.get(id));
            await expect(caller.mutation(api.creators.updateStatus, { id, status: 'active' })).rejects.toThrow();
            expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);
            expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
        },
    );

    it('lists a new pending affiliate for admins and unlocks its page, sales and wallet only after approval', async () => {
        const { t, admin, affiliate, id } = await setup();
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ role: 'affiliate', status: 'pending', balance: 0 });
        expect((await admin.query(api.affiliates.list, {})).map((row) => [row._id, row.status])).toEqual([[id, 'pending']]);
        expect(await t.query(api.affiliates.publicPage, { handle: signup.handle })).toBeNull();
        await expect(affiliate.mutation(api.affiliates.updatePage, { price: 1999 })).rejects.toThrow('admin approval');
        await expect(affiliate.query(api.affiliates.sales, { paginationOpts })).rejects.toThrow('admin approval');
        await expect(affiliate.query(api.affiliates.portal, {})).rejects.toThrow('admin approval');
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliatePrice).toBeUndefined();

        await admin.mutation(api.creators.updateStatus, { id, status: 'active' });
        await affiliate.mutation(api.affiliates.updatePage, { price: 1999 });
        expect(await t.query(api.affiliates.publicPage, { handle: signup.handle })).toMatchObject({ handle: signup.handle, price: 1999 });
        expect((await affiliate.query(api.affiliates.sales, { paginationOpts })).page).toEqual([]);
        expect((await affiliate.query(api.affiliates.portal, {})).summary.balance).toBe(0);
        expect((await t.run((ctx) => ctx.db.get(id)))?.certifiedAt).toBeUndefined();
    });

    it.each(['active', 'suspended', 'pending'])('keeps an existing %s affiliate unchanged when signup is retried', async (status) => {
        const { t, affiliate, id } = await setup();
        await t.run((ctx) => ctx.db.patch(id, { status, affiliatePrice: 2999, balance: 1200 }));
        const before = await t.run((ctx) => ctx.db.get(id));
        expect(await affiliate.mutation(api.affiliates.create, { ...signup, firstName: 'Changed name', handle: 'changed-handle' })).toBe(id);
        expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);
    });

    it('rejects unapproved codes at lookup, creator signup, application and internal creation; approval enables them', async () => {
        const { t, affiliate, admin, id } = await setup();
        const code = (await t.run((ctx) => ctx.db.get(id)))!.referralCode!;
        const creator = t.withIdentity({ subject: 'new-creator' });
        const creatorArgs = { clerkId: 'new-creator', email: 'new@example.com', referralCode: 'OWNCREATOR', referredByCode: code };
        const referredId = await t.run((ctx) => ctx.db.insert('creators', {
            clerkId: 'existing-creator', email: 'existing@example.com', role: 'creator', status: 'active',
        }));
        const referred = t.withIdentity({ subject: 'existing-creator' });
        expect(await t.query(api.creators.getByReferralCode, { referralCode: code })).toBeNull();
        await expect(creator.mutation(api.creators.create, creatorArgs)).rejects.toThrow('Invalid referral code');
        await expect(creator.mutation(api.creators.create, { ...creatorArgs, referredByCode: undefined, referredBy: id })).rejects.toThrow('Invalid referral code');
        await expect(referred.mutation(api.creators.applyReferralCode, { id: referredId, referredByCode: code })).rejects.toThrow('Invalid referral code');
        await expect(t.mutation(internal.referrals.createFromSignup, { referrerId: id, referredId, referralCode: code })).rejects.toThrow('Invalid referrer');
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([]);
        expect((await t.run((ctx) => ctx.db.get(referredId)))?.referredByCode).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.query('creators').withIndex('by_clerk_id', (q) => q.eq('clerkId', 'new-creator')).first())).toBeNull();
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);

        await admin.mutation(api.creators.updateStatus, { id, status: 'active' });
        expect((await t.query(api.creators.getByReferralCode, { referralCode: code }))?._id).toBe(id);
        const newCreatorId = await creator.mutation(api.creators.create, creatorArgs);
        expect(await t.run((ctx) => ctx.db.get(newCreatorId))).toMatchObject({ referredBy: id, referredByCode: code });
        await referred.mutation(api.creators.applyReferralCode, { id: referredId, referredByCode: code });
        await t.mutation(internal.referrals.createFromSignup, { referrerId: id, referredId, referralCode: code });
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([
            expect.objectContaining({ referrerId: id, referredId, status: 'pending' }),
        ]);
        await expect(affiliate.mutation(api.creators.applyReferralCode, { id, referredByCode: code })).rejects.toThrow('Affiliates cannot be referred');
    });

    it('does not credit a bad pre-approval referral, and settles it once approved without duplicate credit', async () => {
        const { t, id, admin } = await setup();
        const { referredId, referralId } = await t.run(async (ctx) => {
            const referredId = await ctx.db.insert('creators', { clerkId: 'referred', email: 'referred@example.com', role: 'creator', status: 'active' });
            const referralId = await ctx.db.insert('referrals', { referrerId: id, referredId, referralCode: 'LEGACY', status: 'pending', createdAt: Date.now() });
            await ctx.db.insert('submissions', {
                creatorId: referredId, businessName: 'Paid Shop', businessType: 'shop', ownerName: 'Owner', ownerPhone: '09171234567',
                address: 'Main Street', city: 'Manila', status: 'completed', amount: 1999, creatorPayout: 1000,
            });
            return { referredId, referralId };
        });
        await t.mutation(internal.referrals.qualifyByCreator, { referredId, bonusAmount: 1000 });
        expect((await t.run((ctx) => ctx.db.get(id)))?.balance).toBe(0);
        expect((await t.run((ctx) => ctx.db.get(referralId)))?.status).toBe('pending');
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);

        await admin.mutation(api.creators.updateStatus, { id, status: 'active' });
        await t.mutation(internal.referrals.qualifyByCreator, { referredId, bonusAmount: 1000 });
        await t.mutation(internal.referrals.qualifyByCreator, { referredId, bonusAmount: 1000 });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ balance: 1000, totalEarnings: 1000 });
        expect((await t.run((ctx) => ctx.db.get(referralId)))?.status).toBe('qualified');
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'earnings:create')).toHaveLength(1);
    });

    it('preserves legacy creator referral ids without a code or explicit role/status', async () => {
        const { t } = await setup();
        const referrerId = await t.run((ctx) => ctx.db.insert('creators', {
            clerkId: 'legacy-creator', email: 'legacy@example.com', referralCode: 'LEGACY',
        }));
        const id = await t.withIdentity({ subject: 'new-creator' }).mutation(api.creators.create, {
            clerkId: 'new-creator', email: 'new@example.com', referralCode: 'OWNCODE', referredBy: referrerId,
        });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ role: 'creator', status: 'active', referredBy: referrerId });
        expect((await t.query(api.creators.getByReferralCode, { referralCode: 'LEGACY' }))?._id).toBe(referrerId);
    });

    it.each(['mobile', 'web'])('blocks pending %s payouts, including admin requests, before reserving funds or scheduling Wise', async (shape) => {
        const { t, admin, affiliate, id } = await setup();
        await t.run((ctx) => ctx.db.patch(id, { balance: 1500 }));
        const args = {
            creatorId: id, amount: 500,
            ...(shape === 'mobile' ? { wiseEmail: 'alex-wise@example.com' }
                : { payoutMethod: 'wise_email' as const, accountDetails: 'alex-wise@example.com' }),
        };
        for (const caller of [affiliate, admin]) {
            await expect(caller.mutation(api.withdrawals.create, args)).rejects.toThrow('admin approval');
        }
        expect((await t.run((ctx) => ctx.db.get(id)))?.balance).toBe(1500);
        expect(await t.run((ctx) => ctx.db.query('withdrawals').collect())).toEqual([]);
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);

        await admin.mutation(api.creators.updateStatus, { id, status: 'active' });
        expect(await affiliate.mutation(api.withdrawals.create, args)).toMatchObject({ amount: 500, status: 'pending' });
        expect((await t.run((ctx) => ctx.db.get(id)))?.balance).toBe(1000);
        const rows = await t.run((ctx) => ctx.db.query('withdrawals').collect());
        expect(rows).toEqual([expect.objectContaining({ creatorId: id, amount: 500, wiseEmail: 'alex-wise@example.com', status: 'pending' })]);
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'withdrawals:processWiseTransfer')).toHaveLength(1);
        expect(jobs.filter((job) => job.name === 'withdrawals:sendRequestedEmailAction')).toHaveLength(1);
    });
});
