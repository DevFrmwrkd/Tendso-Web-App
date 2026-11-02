import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import schema from '../../convex/schema';
import { api } from '../../convex/_generated/api';

const modules = { './_generated/server.js': () => import('../../convex/_generated/server'), './referrals.ts': () => import('../../convex/referrals'), './affiliates.ts': () => import('../../convex/affiliates') };
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const owner = await ctx.db.insert('creators', { clerkId: 'owner', role: 'creator', status: 'active', email: 'owner@example.test' });
    const other = await ctx.db.insert('creators', { clerkId: 'other', role: 'affiliate', status: 'active', email: 'other@example.test' });
    await ctx.db.insert('creators', { clerkId: 'admin', role: 'admin', status: 'active', email: 'admin@example.test' });
    for (const status of ['pending', 'qualified', 'paid']) {
      const referredId = await ctx.db.insert('creators', { clerkId: status, role: 'creator', status: 'active', email: `${status}@example.test`, firstName: status === 'pending' ? 'Sam' : undefined });
      await ctx.db.insert('referrals', { referrerId: owner, referredId, referralCode: 'OWNER', status, createdAt: 1, bonusAmount: status === 'pending' ? 5000 : 1000 });
    }
    return { owner, other };
  });
  return { t, ...ids };
}
describe('private referral reads', () => {
  it('returns only earned bonuses and clean names to the signed-in owner', async () => {
    const { t, owner } = await setup(); const client = t.withIdentity({ subject: 'owner' });
    expect(await client.query(api.referrals.getStats, { referrerId: owner })).toEqual({ total: 3, pending: 1, qualified: 1, paid: 1, totalEarned: 2000 });
    const rows = await client.query(api.referrals.getByReferrer, { referrerId: owner });
    expect(rows).toHaveLength(3); expect(rows.map(row => row.referredName)).toContain('Sam');
    expect(rows.some(row => row.referredName.includes('undefined'))).toBe(false);
  });
  it('rejects anonymous and other-account reads of names and totals', async () => {
    const { t, owner } = await setup();
    for (const query of [api.referrals.getStats, api.referrals.getByReferrer]) {
      await expect(t.query(query, { referrerId: owner })).rejects.toThrow('Not authenticated');
      await expect(t.withIdentity({ subject: 'other' }).query(query, { referrerId: owner })).rejects.toThrow('own account');
    }
  });
  it('preserves own affiliate reads and authenticated administrator access', async () => {
    const { t, owner, other } = await setup();
    expect(await t.withIdentity({ subject: 'other' }).query(api.referrals.getStats, { referrerId: other })).toMatchObject({ total: 0, totalEarned: 0 });
    expect(await t.withIdentity({ subject: 'admin' }).query(api.referrals.getByReferrer, { referrerId: owner })).toHaveLength(3);
  });
  it('preserves a paused affiliate’s own settlement history without exposing another account', async () => {
    const { t, owner, other } = await setup(); await t.run(ctx => ctx.db.patch(other, { status: 'suspended' }));
    const client = t.withIdentity({ subject: 'other' });
    expect(await client.query(api.referrals.getStats, { referrerId: other })).toMatchObject({ total: 0 });
    await expect(client.query(api.referrals.getStats, { referrerId: owner })).rejects.toThrow('own account');
  });
  it('uses the same earned-only bonus total in the affiliate portal', async () => {
    const { t, owner, other } = await setup();
    await t.run(async ctx => {
      for (const row of await ctx.db.query('referrals').collect()) await ctx.db.patch(row._id, { referrerId: other });
    });
    const client = t.withIdentity({ subject: 'other' });
    const portal = await client.query(api.affiliates.portal, {});
    expect(portal.referralStats).toEqual(await client.query(api.referrals.getStats, { referrerId: other }));
    expect(portal.referralStats.totalEarned).toBe(2000);
    expect(await t.withIdentity({ subject: 'owner' }).query(api.referrals.getStats, { referrerId: owner })).toMatchObject({ total: 0 });
  });
  it.each(['suspended', 'deleted'])('rejects %s account reads', async status => {
    const { t, owner } = await setup(); await t.run(ctx => ctx.db.patch(owner, { status }));
    await expect(t.withIdentity({ subject: 'owner' }).query(api.referrals.getStats, { referrerId: owner })).rejects.toThrow('account access');
  });
});
