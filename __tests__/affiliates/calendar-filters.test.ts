import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = { './_generated/server.js': () => import('../../convex/_generated/server'), './affiliates.ts': () => import('../../convex/affiliates') };
const NOW = Date.UTC(2026, 9, 29, 8);
const SEP = Date.UTC(2026, 7, 31, 16), OCT = Date.UTC(2026, 8, 30, 16);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

async function setup() {
  // Convex creation times are monotonic; create the actors before all sale fixtures.
  vi.setSystemTime(SEP - 10000);
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const affiliate = await ctx.db.insert('creators', { clerkId: 'affiliate', email: 'creator@example.test', role: 'affiliate', status: 'active', balance: 6200.25, totalEarnings: 8000.5, totalWithdrawn: 1800.25 });
    const other = await ctx.db.insert('creators', { clerkId: 'other', email: 'other@example.test', role: 'affiliate', status: 'active' });
    return { affiliate, other };
  });
  vi.setSystemTime(NOW);
  const insert = async (createdAt: number, status: string, name: string, creatorId = ids.affiliate) => {
    vi.setSystemTime(createdAt);
    const id = await t.run(ctx => ctx.db.insert('submissions', { creatorId, businessName: name, businessType: 'Other', ownerName: 'Private owner', ownerPhone: 'private-phone', ownerEmail: 'private@example.test', address: 'private-address', city: 'Marikina', photos: ['private-photo'], status, amount: 3499, creatorPayout: 1750 }));
    vi.setSystemTime(NOW);
    return id;
  };
  return { t, ids, caller: t.withIdentity({ subject: 'affiliate' }), insert };
}

it('selects a Manila calendar month without changing the live wallet, records or commission period', async () => {
  const { t, ids, caller, insert } = await setup();
  const id = await insert(SEP, 'paid', 'September sale');
  await t.run(async ctx => {
    await ctx.db.insert('earnings', { creatorId: ids.affiliate, submissionId: id, amount: 500.25, type: 'submission_approved', status: 'available', createdAt: SEP });
    await ctx.db.insert('earnings', { creatorId: ids.affiliate, submissionId: id, amount: 200.5, type: 'submission_approved', status: 'withdrawn', createdAt: OCT - 1 });
    await ctx.db.insert('earnings', { creatorId: ids.affiliate, submissionId: id, amount: 999, type: 'submission_approved', status: 'pending', createdAt: SEP });
    await ctx.db.insert('earnings', { creatorId: ids.affiliate, submissionId: id, amount: 150, type: 'submission_approved', status: 'available', createdAt: OCT });
  });
  const current = await caller.query(api.affiliates.portal, {}), past = await caller.query(api.affiliates.portal, { month: '2026-09' });
  expect(current.income.totalThisMonth).toBe(150);
  expect(past.month).toEqual({ start: SEP, end: OCT, label: '2026-09' });
  expect(past.income).toEqual({ directThisMonth: 700.75, teamThisMonth: 0, totalThisMonth: 700.75 });
  expect(past.summary).toEqual(current.summary);
  expect(past.earnings).toEqual(current.earnings);
  expect(past.recruits).toEqual(current.recruits);
  expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
});

it('filters paid sales and creation month before pagination, including the exact Manila boundary', async () => {
  const { ids, caller, insert } = await setup();
  await insert(SEP - 1, 'paid', 'August');
  await insert(SEP, 'paid', 'First September');
  await insert(SEP + 1, 'pending_payment', 'Awaiting');
  await insert(SEP + 2, 'completed', 'Second September');
  await insert(OCT, 'paid', 'October');
  await insert(SEP + 3, 'paid', 'Someone else', ids.other);
  const first = await caller.query(api.affiliates.sales, { month: '2026-09', status: 'paid', paginationOpts: { numItems: 1, cursor: null } });
  const second = await caller.query(api.affiliates.sales, { month: '2026-09', status: 'paid', paginationOpts: { numItems: 1, cursor: first.continueCursor } });
  expect(first.page.map(row => row.businessName)).toEqual(['Second September']);
  expect(second.page.map(row => row.businessName)).toEqual(['First September']);
  expect(first.isDone).toBe(false);
  const all = await caller.query(api.affiliates.sales, { paginationOpts: { numItems: 20, cursor: null } });
  expect(all.page).toHaveLength(5);
  expect(JSON.stringify(all)).not.toMatch(/private-(?:phone|address|photo)|private@example/);
  expect(first.page[0]).toMatchObject({ price: 3499, commission: 1750, status: 'completed' });
});

it.each(['2026-13', '2026-00', '2026-9', '2026-09-01', '1999-12', '', '2026-11'])('rejects an invalid/future calendar selection %s', async month => {
  const { caller } = await setup();
  await expect(caller.query(api.affiliates.portal, { month })).rejects.toThrow(/month/i);
  await expect(caller.query(api.affiliates.sales, { month, paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow(/month/i);
});

it('keeps historical reads behind the existing affiliate session and approval gates', async () => {
  const { t, ids, caller } = await setup();
  await expect(t.query(api.affiliates.portal, { month: '2026-09' })).rejects.toThrow('Not authenticated');
  await t.run(ctx => ctx.db.patch(ids.affiliate, { status: 'pending' }));
  await expect(caller.query(api.affiliates.portal, { month: '2026-09' })).rejects.toThrow('approval');
  await t.run(ctx => ctx.db.patch(ids.affiliate, { status: 'suspended' }));
  expect((await caller.query(api.affiliates.portal, { month: '2026-09' })).summary.balance).toBe(6200.25);
  await t.run(ctx => ctx.db.patch(ids.affiliate, { role: 'creator', status: 'active' }));
  await expect(caller.query(api.affiliates.sales, { month: '2026-09', paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow('affiliate');
});

it('includes an older order credited in the selected month while keeping foreign sales private', async () => {
  const { t, ids, caller, insert } = await setup();
  const old = await insert(SEP - 1, 'paid', 'Created earlier, credited September');
  const other = await insert(SEP, 'paid', 'Private foreign sale', ids.other);
  await t.run(async ctx => {
    for (const submissionId of [old, other]) await ctx.db.insert('earnings', { creatorId: ids.affiliate, submissionId, amount: 1750, type: 'submission_approved', status: 'available', createdAt: SEP + 500 });
  });
  const result = await caller.query(api.affiliates.sales, { month: '2026-09', status: 'paid', paginationOpts: { numItems: 10, cursor: null } });
  expect(result.page.map(row => row.businessName)).toEqual(['Created earlier, credited September']);
});
