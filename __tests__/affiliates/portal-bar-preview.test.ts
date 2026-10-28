import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { CREATOR_OVERRIDE_CUTOVER, creatorOverrideEndsAt } from '../../lib/pricing';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
};
const DEV_URL = 'https://diligent-ibex-454.convex.cloud';
const NOW = Date.UTC(2026, 9, 28, 4);
const JOINED = Date.UTC(2026, 9, 22, 4);

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv('CONVEX_CLOUD_URL', DEV_URL);
    vi.stubEnv('DEV_AFFILIATE_BAR_PREVIEW', undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const affiliate = await ctx.db.insert('creators', {
            clerkId: 'test-affiliate', email: 'mobile+clerk_test@example.com', role: 'affiliate', status: 'active',
            balance: 950, totalEarnings: 3250, totalWithdrawn: 2300,
        });
        const foreign = await ctx.db.insert('creators', {
            clerkId: 'foreign-affiliate', email: 'foreign+clerk_test@example.com', role: 'affiliate', status: 'active',
        });
        const addRecruit = (clerkId: string, recruiter = affiliate, recruitedAt = JOINED, role = 'creator') =>
            ctx.db.insert('creators', {
                clerkId, email: `${clerkId.replace(/:/g, '-')}@example.invalid`, role, status: 'active',
                recruitedByCreatorId: recruiter, recruitedAt, firstName: '[TEST] Agent',
            });
        const examples = await Promise.all([9, 6, 3, 0].map(months => addRecruit(`dev_affiliate_sample_v1:agent:bar-${months}`)));
        const real = await addRecruit('real-agent');
        const foreignAgent = await addRecruit('dev_affiliate_other_v1:agent:foreign', foreign);
        const legacy = await addRecruit('dev_affiliate_sample_v1:agent:legacy', affiliate, CREATOR_OVERRIDE_CUTOVER - 1);
        const wrongRole = await addRecruit('dev_affiliate_sample_v1:agent:not-an-agent', affiliate, JOINED, 'affiliate');
        const sale = await ctx.db.insert('submissions', {
            creatorId: examples[0], businessName: '[TEST] Sample shop', businessType: 'Other',
            ownerName: 'Sample Owner', ownerPhone: '', address: 'Sample address', city: 'Marikina', status: 'completed',
        });
        await ctx.db.insert('earnings', {
            creatorId: affiliate, submissionId: sale, amount: 250, type: 'creator_override', status: 'available', createdAt: NOW,
        });
        return { affiliate, foreign, examples, real, foreignAgent, legacy, wrongRole };
    });
    const caller = t.withIdentity({ subject: 'test-affiliate' });
    const config = {
        clerkId: 'test-affiliate', creatorId: ids.affiliate,
        monthsLeftByRecruit: Object.fromEntries(ids.examples.map((id, index) => [id, [9, 6, 3, 0][index]])),
    };
    return { t, ids, caller, config };
}

it('adds only optional presentation metadata, preserves zero, and leaves canonical dates, money and records untouched', async () => {
    const { t, ids, caller, config } = await setup();
    const baseline = await caller.query(api.affiliates.portal, {});
    const accountBefore = await t.run(ctx => ctx.db.get(ids.affiliate));
    vi.stubEnv('DEV_AFFILIATE_BAR_PREVIEW', JSON.stringify(config));
    const result = await caller.query(api.affiliates.portal, {});
    for (const [index, id] of ids.examples.entries()) {
        expect(result.recruits.find(row => row._id === id)).toMatchObject({
            demoMonthsLeft: [9, 6, 3, 0][index], monthsLeft: 12, createdAt: JOINED,
            endsAt: creatorOverrideEndsAt(JOINED), earning: true,
        });
    }
    expect({ ...result, recruits: result.recruits.map(({ demoMonthsLeft: _demo, ...row }) => row) }).toEqual(baseline);
    expect(await t.run(ctx => ctx.db.get(ids.affiliate))).toEqual(accountBefore);
    expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
});

it.each([
    ['unset', undefined], ['empty', ''], ['off', 'off'], ['malformed', '{'],
    ['null', 'null'], ['array', '[]'], ['scalar', '42'],
])('omits preview metadata when configuration is %s', async (_name, raw) => {
    const { caller } = await setup();
    const baseline = await caller.query(api.affiliates.portal, {});
    vi.stubEnv('DEV_AFFILIATE_BAR_PREVIEW', raw);
    expect(await caller.query(api.affiliates.portal, {})).toEqual(baseline);
});

it.each([-1, 13, 1.5, '6', null, true])('rejects the entire map when a month value is invalid: %s', async value => {
    const { caller, config, ids } = await setup();
    const baseline = await caller.query(api.affiliates.portal, {});
    vi.stubEnv('DEV_AFFILIATE_BAR_PREVIEW', JSON.stringify({
        ...config, monthsLeftByRecruit: { ...config.monthsLeftByRecruit, [ids.real]: value },
    }));
    expect(await caller.query(api.affiliates.portal, {})).toEqual(baseline);
});

it.each(['missing-map', 'array-map', 'extra-field', 'wrong-clerk', 'wrong-creator', 'empty-recruit-id', 'invalid-recruit-id'])(
    'omits metadata for invalid or mismatched configuration: %s', async kind => {
        const { caller, config, ids } = await setup();
        const baseline = await caller.query(api.affiliates.portal, {});
        const invalid = kind === 'missing-map' ? { clerkId: config.clerkId, creatorId: config.creatorId }
            : kind === 'array-map' ? { ...config, monthsLeftByRecruit: [9] }
            : kind === 'extra-field' ? { ...config, enabled: true }
            : kind === 'wrong-clerk' ? { ...config, clerkId: 'foreign-affiliate' }
            : kind === 'wrong-creator' ? { ...config, creatorId: ids.foreign }
            : kind === 'invalid-recruit-id' ? { ...config, monthsLeftByRecruit: { ...config.monthsLeftByRecruit, 'not-a-creator-id': 9 } }
            : { ...config, monthsLeftByRecruit: { '': 9 } };
        vi.stubEnv('DEV_AFFILIATE_BAR_PREVIEW', JSON.stringify(invalid));
        expect(await caller.query(api.affiliates.portal, {})).toEqual(baseline);
    },
);

it.each([undefined, '', 'https://energetic-panther-693.convex.cloud', `${DEV_URL}/`, `${DEV_URL}.example.com`])(
    'fails closed on an absent or nonmatching deployment URL: %s', async deployment => {
        const { caller, config } = await setup();
        const baseline = await caller.query(api.affiliates.portal, {});
        vi.stubEnv('CONVEX_CLOUD_URL', deployment);
        vi.stubEnv('DEV_AFFILIATE_BAR_PREVIEW', JSON.stringify(config));
        expect(await caller.query(api.affiliates.portal, {})).toEqual(baseline);
    },
);

it('requires a test-account email, synthetic field-agent subject and existing owned post-cutover membership', async () => {
    const { t, ids, caller, config } = await setup();
    vi.stubEnv('DEV_AFFILIATE_BAR_PREVIEW', JSON.stringify({
        ...config, monthsLeftByRecruit: {
            ...config.monthsLeftByRecruit, [ids.real]: 3, [ids.foreignAgent]: 6, [ids.legacy]: 9, [ids.wrongRole]: 0,
        },
    }));
    const result = await caller.query(api.affiliates.portal, {});
    expect(result.recruits.find(row => row._id === ids.real)).not.toHaveProperty('demoMonthsLeft');
    expect(result.recruits.find(row => row._id === ids.wrongRole)).not.toHaveProperty('demoMonthsLeft');
    expect(result.recruits.some(row => row._id === ids.foreignAgent || row._id === ids.legacy)).toBe(false);
    const foreign = await t.withIdentity({ subject: 'foreign-affiliate' }).query(api.affiliates.portal, {});
    expect(foreign.recruits.every(row => !('demoMonthsLeft' in row))).toBe(true);
    await t.run(ctx => ctx.db.patch(ids.affiliate, { email: 'real@example.com' }));
    expect((await caller.query(api.affiliates.portal, {})).recruits.every(row => !('demoMonthsLeft' in row))).toBe(true);
});
