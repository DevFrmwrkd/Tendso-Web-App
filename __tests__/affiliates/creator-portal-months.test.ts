import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './creatorPortal.ts': () => import('../../convex/creatorPortal'),
    './affiliates.ts': () => import('../../convex/affiliates'),
};
const OCT = Date.UTC(2026, 8, 30, 16);
const NOV = Date.UTC(2026, 9, 31, 16);
const NOW = Date.UTC(2026, 10, 15, 4);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

it('selects historical Manila earnings while keeping balances, all-time activity and months left live', async () => {
    const t = convexTest(schema, modules);
    const creator = await t.run(ctx => ctx.db.insert('creators', {
        clerkId: 'affiliate', email: 'affiliate@example.test', role: 'affiliate', status: 'active',
        affiliateHandle: 'affiliate', referralCode: 'AFF30', balance: 1750,
    }));
    const recruit = await t.run(ctx => ctx.db.insert('creators', {
        clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active',
        recruitedByCreatorId: creator, recruitedAt: Date.UTC(2026, 9, 22), firstName: 'Agent',
    }));
    await t.run(async ctx => {
        for (const [at, payout] of [[OCT, 1000], [NOV - 1, 1250], [NOV, 1750]]) {
            await ctx.db.insert('submissions', {
                creatorId: creator, businessName: `Shop ${at}`, businessType: 'Other', ownerName: 'Owner',
                ownerPhone: '09170000000', address: 'Marikina', city: 'Marikina', photos: [],
                status: 'paid', amount: 3499, creatorPayout: payout, paidInFullAt: at,
            });
        }
        const sale = await ctx.db.insert('submissions', {
            creatorId: recruit, businessName: 'Agent shop', businessType: 'Other', ownerName: 'Owner',
            ownerPhone: '09170000000', address: 'Marikina', city: 'Marikina', photos: [],
            status: 'paid', amount: 3499, creatorPayout: 1750, paidInFullAt: NOV - 1,
        });
        await ctx.db.insert('earnings', { creatorId: creator, submissionId: sale, type: 'creator_override', amount: 150, status: 'available', createdAt: NOV - 1 });
        await ctx.db.insert('earnings', { creatorId: creator, submissionId: sale, type: 'creator_override', amount: 200, status: 'available', createdAt: NOV });
    });
    const caller = t.withIdentity({ subject: 'affiliate' });
    const current = await caller.query(api.creatorPortal.summary, {});
    const past = await caller.query(api.creatorPortal.summary, { month: '2026-10' });
    const nativePast = await caller.query(api.affiliates.portal, { month: '2026-10' });
    expect(past.month).toEqual({ start: OCT, end: NOV, label: '2026-10' });
    expect(past.month).toEqual(nativePast.month);
    expect(current.now.thisMonth).toBe(1750);
    expect(past.now.thisMonth).toBe(2250);
    expect(past.now.shopsThisMonth).toBe(2);
    expect(past.monthly.thisMonth).toBe(150);
    expect(current.monthly.thisMonth).toBe(200);
    expect(past.recruits[0]).toMatchObject({ salesThisMonth: 1, overrideThisMonth: 150 });
    expect(current.recruits[0]).toMatchObject({ salesThisMonth: 0, overrideThisMonth: 200 });
    expect(past.recruits[0].monthsLeft).toBe(current.recruits[0].monthsLeft);
    expect(past.recruits[0].monthsLeft).toBe(nativePast.recruits[0].monthsLeft);
    expect(past.payouts).toEqual(current.payouts);
    expect(past.funnel).toEqual(current.funnel);
    expect(past.shops).toEqual(current.shops);
    expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
});

it.each(['2026-13', '2026-1', '1999-12', '2026-12', 'invalid'])('rejects invalid or future portal months: %s', async month => {
    const t = convexTest(schema, modules);
    await t.run(ctx => ctx.db.insert('creators', { clerkId: 'affiliate', email: 'a@example.test', role: 'affiliate', status: 'active' }));
    await expect(t.withIdentity({ subject: 'affiliate' }).query(api.creatorPortal.summary, { month })).rejects.toThrow(/Choose/);
});
