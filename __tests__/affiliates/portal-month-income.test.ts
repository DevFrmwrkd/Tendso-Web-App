import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { creatorOverrideEndsAt } from '../../lib/pricing';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
};
const NOW = Date.UTC(2027, 10, 15, 4);
const START = Date.UTC(2027, 9, 31, 16);
const END = Date.UTC(2027, 10, 30, 16);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

it('splits Manila-month credited income without dropping historical pending, withdrawn, or deleted-sale ledger rows', async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const affiliate = await ctx.db.insert('creators', { clerkId: 'affiliate', email: 'affiliate@example.test', role: 'affiliate', status: 'active' });
        const foreign = await ctx.db.insert('creators', { clerkId: 'foreign', email: 'foreign@example.test', role: 'affiliate', status: 'active' });
        const joinedAt = Date.UTC(2027, 5, 1);
        const agent = await ctx.db.insert('creators', { clerkId: 'agent', email: 'private-agent@example.test', phone: 'private-phone',
            role: 'creator', firstName: 'Sam', recruitedByCreatorId: affiliate, recruitedAt: joinedAt,
            profileImage: 'https://images.example.test/sam.jpg' });
        const expiredAt = Date.UTC(2026, 9, 22);
        const expired = await ctx.db.insert('creators', { clerkId: 'expired', email: 'expired@example.test', role: 'creator',
            recruitedByCreatorId: affiliate, recruitedAt: expiredAt, profileImage: 'file://private-image.jpg' });
        const makeSale = (creatorId: typeof affiliate, status = 'completed') => ctx.db.insert('submissions', { creatorId,
            businessName: 'Private Shop', businessType: 'Shop', ownerName: 'Owner', ownerPhone: 'private-owner-phone',
            address: 'Private address', city: 'Marikina', status, photos: ['https://images.example.test/private-capture.jpg'] });
        const direct = await makeSale(affiliate, 'deposit_paid');
        const team = await makeSale(agent);
        const deleted = await makeSale(affiliate);
        const credit = (submissionId: typeof direct, type: string, amount: number, createdAt: number, status = 'available', creatorId = affiliate) =>
            ctx.db.insert('earnings', { creatorId, submissionId, type, amount, createdAt, status });
        await credit(direct, 'submission_approved', 1000, START); // first instant in Manila November
        await credit(direct, 'submission_approved', 200, START - 1); // still October
        await credit(direct, 'submission_approved', 300, END); // first instant in December
        await credit(deleted, 'submission_approved', 125.5, END - 1, 'withdrawn');
        await credit(direct, 'submission_approved', 5000, NOW, 'pending');
        await credit(direct, 'referral_bonus', 1000, NOW); // legacy program remains separate
        await credit(team, 'creator_override', 150, START);
        await credit(team, 'creator_override', 50, END - 1, 'withdrawn');
        await credit(team, 'creator_override', 9000, NOW, 'pending');
        await credit(team, 'creator_override', 100, START - 1);
        await credit(team, 'creator_override', 99999, NOW, 'available', foreign);
        await ctx.db.delete(deleted);
        return { affiliate, agent, expired, joinedAt, expiredAt };
    });
    const result = await t.withIdentity({ subject: 'affiliate' }).query(api.affiliates.portal, {});
    expect(result.month).toEqual({ start: START, end: END, label: '2027-11' });
    expect(result.income).toEqual({ directThisMonth: 1125.5, teamThisMonth: 200, totalThisMonth: 1325.5 });
    expect(result.summary.totalEarned).toBe(16925.5); // unchanged all-status fallback
    expect(result.recruitStats.totalEarned).toBe(9300); // unchanged legacy total semantics
    expect(result.earnings).toHaveLength(10);
    expect(result.recruits.find(row => row._id === ids.agent)).toMatchObject({
        photo: 'https://images.example.test/sam.jpg', monthEarned: 200, totalEarned: 9300, creditedTotalEarned: 300,
        createdAt: ids.joinedAt, endsAt: creatorOverrideEndsAt(ids.joinedAt), earning: true,
    });
    expect(result.recruits.find(row => row._id === ids.agent)).toMatchObject({ monthsLeft: expect.any(Number) });
    expect(result.recruits.find(row => row._id === ids.expired)).toMatchObject({ photo: null, monthEarned: 0, monthsLeft: 0, earning: false });
    expect(JSON.stringify(result.recruits)).not.toContain('private-agent@example.test');
    expect(JSON.stringify(result.recruits)).not.toContain('private-phone');
    expect(JSON.stringify(result.recruits)).not.toContain('private-capture');
    expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
});

it('reports truthful zero income for a new account while allowing suspended creators to read credited income', async () => {
    const t = convexTest(schema, modules);
    await t.run(ctx => ctx.db.insert('creators', { clerkId: 'affiliate', email: 'affiliate@example.test', role: 'affiliate', status: 'suspended' }));
    expect((await t.withIdentity({ subject: 'affiliate' }).query(api.affiliates.portal, {})).income)
        .toEqual({ directThisMonth: 0, teamThisMonth: 0, totalThisMonth: 0 });
});
