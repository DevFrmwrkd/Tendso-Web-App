import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { creatorOverrideEndsAt, creatorOverrideMonthsLeft } from '../../lib/pricing';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './creatorPortal.ts': () => import('../../convex/creatorPortal'),
};
const NOW = Date.UTC(2028, 2, 1, 4);
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const affiliate = await ctx.db.insert('creators', {
            clerkId: 'test-affiliate', email: 'mobile+clerk_test@example.com', role: 'affiliate', status: 'active',
            affiliateHandle: 'test-affiliate', referralCode: 'TESTAFF', balance: 950, totalEarnings: 3250, totalWithdrawn: 2300,
        });
        const joined = [NOW, Date.UTC(2027, 11, 1, 4), Date.UTC(2027, 5, 1, 4), Date.UTC(2027, 2, 1, 4)];
        const recruits = await Promise.all(joined.map((recruitedAt, index) => ctx.db.insert('creators', {
            clerkId: `dev_affiliate_sample_v1:agent:bar-${index}`, email: `agent-${index}@example.invalid`,
            role: 'creator', status: 'active', recruitedByCreatorId: affiliate, recruitedAt, firstName: `Agent ${index}`,
        })));
        const sale = await ctx.db.insert('submissions', {
            creatorId: recruits[0], businessName: 'Sample shop', businessType: 'Other',
            ownerName: 'Owner', ownerPhone: '', address: 'Address', city: 'Marikina', status: 'completed',
        });
        await ctx.db.insert('earnings', {
            creatorId: affiliate, submissionId: sale, amount: 250, type: 'creator_override', status: 'available', createdAt: NOW,
        });
        return { affiliate, recruits, joined };
    });
    return { t, ids, caller: t.withIdentity({ subject: 'test-affiliate' }) };
}

it('ignores a stale development override and returns the same real period on web and mobile without changing records', async () => {
    const { t, ids, caller } = await setup();
    const baseline = await caller.query(api.affiliates.portal, {});
    const webBaseline = await caller.query(api.creatorPortal.summary, {});
    const before = await t.run(async ctx => ({
        creators: await ctx.db.query('creators').collect(), earnings: await ctx.db.query('earnings').collect(),
    }));
    vi.stubEnv('CONVEX_CLOUD_URL', 'https://diligent-ibex-454.convex.cloud');
    vi.stubEnv('DEV_AFFILIATE_BAR_PREVIEW', JSON.stringify({
        clerkId: 'test-affiliate', creatorId: ids.affiliate,
        monthsLeftByRecruit: Object.fromEntries(ids.recruits.map((id, index) => [id, [9, 6, 3, 12][index]])),
    }));

    const mobile = await caller.query(api.affiliates.portal, {});
    const web = await caller.query(api.creatorPortal.summary, {});
    expect(mobile).toEqual(baseline);
    expect(web).toEqual(webBaseline);
    for (const [index, id] of ids.recruits.entries()) {
        const joinedAt = ids.joined[index], endsAt = creatorOverrideEndsAt(joinedAt);
        const expected = { monthsLeft: creatorOverrideMonthsLeft(joinedAt, NOW), endsAt, earning: NOW < endsAt };
        expect(mobile.recruits.find(row => row._id === id)).toMatchObject({ ...expected, createdAt: joinedAt });
        expect(web.recruits.find(row => row.creatorId === id)).toMatchObject({ ...expected, joinedAt });
    }
    expect(mobile.recruits.every(row => !('demoMonthsLeft' in row))).toBe(true);
    expect(await t.run(async ctx => ({
        creators: await ctx.db.query('creators').collect(), earnings: await ctx.db.query('earnings').collect(),
    }))).toEqual(before);
    expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
});

it.each([0, 30 * DAY, 365 * DAY, 366 * DAY])('keeps both portals bounded and equal across a leap-year period at +%s ms', async elapsed => {
    const { caller } = await setup();
    vi.setSystemTime(NOW + elapsed);
    const mobile = await caller.query(api.affiliates.portal, {});
    const web = await caller.query(api.creatorPortal.summary, {});
    for (const recruit of mobile.recruits) {
        const peer = web.recruits.find(row => row.creatorId === recruit._id)!;
        expect(recruit.monthsLeft).toBeGreaterThanOrEqual(0);
        expect(recruit.monthsLeft).toBeLessThanOrEqual(12);
        expect(peer).toMatchObject({ monthsLeft: recruit.monthsLeft, endsAt: recruit.endsAt, earning: recruit.earning });
    }
});
