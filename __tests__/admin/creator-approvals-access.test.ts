import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
  './_generated/server.js': () => import('../../convex/_generated/server'),
  './creators.ts': () => import('../../convex/creators'),
};

afterEach(() => vi.useRealTimers());

describe('creator approval authorization used by mobile admin', () => {
  it.each([
    { role: 'creator', status: 'active' },
    { role: 'affiliate', status: 'active' },
    { role: 'staff', status: 'active' },
    { role: 'admin', status: 'suspended' },
    { role: 'admin', status: 'deleted' },
    { role: 'admin', status: 'active', isDeleted: true },
  ])('rejects queue, approve and reject for %j', async actor => {
    const t = convexTest(schema, modules);
    const id = await t.run(async ctx => {
      await ctx.db.insert('creators', { clerkId: 'actor', email: 'actor@example.com', ...actor });
      return ctx.db.insert('creators', { clerkId: 'creator', email: 'creator@example.com', role: 'creator', quizPassedAt: 1, status: 'active' });
    });
    const caller = t.withIdentity({ subject: 'actor' });
    await expect(caller.query(api.creators.listPendingApproval, {})).rejects.toThrow();
    await expect(caller.mutation(api.creators.approveCreator, { id })).rejects.toThrow();
    await expect(caller.mutation(api.creators.rejectCreator, { id, reason: 'Test' })).rejects.toThrow();
    const row = await t.run(ctx => ctx.db.get(id));
    expect(row?.certifiedAt).toBeUndefined();
    expect(row?.rejectedAt).toBeUndefined();
  });
  it('allows an active admin queue and keeps affiliates out of creator certification', async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(async ctx => {
      await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active' });
      return ctx.db.insert('creators', { clerkId: 'affiliate', email: 'affiliate@example.com', role: 'affiliate', quizPassedAt: 1, status: 'active' });
    });
    const admin = t.withIdentity({ subject: 'admin' });
    expect(await admin.query(api.creators.listPendingApproval, {})).toEqual([]);
    await expect(admin.mutation(api.creators.approveCreator, { id })).rejects.toThrow('Only creator');
  });

  it('clears the previous rejection on admin approval and sends the approval notification once', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const t = convexTest(schema, modules);
    const id = await t.run(async ctx => {
      await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active' });
      return ctx.db.insert('creators', {
        clerkId: 'creator', email: 'creator@example.com', role: 'creator', status: 'active',
        quizPassedAt: 100, rejectedAt: 200, rejectionReason: 'Correct your name', rejectedBy: 'admin',
      });
    });
    const admin = t.withIdentity({ subject: 'admin' });

    await admin.mutation(api.creators.approveCreator, { id });

    const approved = await t.run(ctx => ctx.db.get(id));
    expect(approved).toMatchObject({ certifiedAt: 20_000, quizPassedAt: 100, lastActiveAt: 20_000 });
    for (const field of ['rejectedAt', 'rejectionReason', 'rejectedBy'] as const) {
      expect(approved?.[field]).toBeUndefined();
    }
    const jobs = await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect());
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      name: 'notifications:createAndSend',
      args: [{ creatorId: id, type: 'certification', title: "You're approved!", data: { approvedByAdmin: true } }],
    });

    vi.setSystemTime(30_000);
    await admin.mutation(api.creators.approveCreator, { id });
    expect(await t.run(ctx => ctx.db.get(id))).toEqual(approved);
    expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual(jobs);
  });

  it('repairs an already-certified row with stale rejection metadata without recertifying or notifying', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const t = convexTest(schema, modules);
    const id = await t.run(async ctx => {
      await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active' });
      return ctx.db.insert('creators', {
        clerkId: 'creator', email: 'creator@example.com', role: 'creator', status: 'active',
        quizPassedAt: 100, certifiedAt: 500, lastActiveAt: 600,
        rejectedAt: 200, rejectionReason: 'Old rejection', rejectedBy: 'admin',
      });
    });
    const admin = t.withIdentity({ subject: 'admin' });

    await admin.mutation(api.creators.approveCreator, { id });

    const repaired = await t.run(ctx => ctx.db.get(id));
    expect(repaired).toMatchObject({ certifiedAt: 500, quizPassedAt: 100, lastActiveAt: 600 });
    for (const field of ['rejectedAt', 'rejectionReason', 'rejectedBy'] as const) {
      expect(repaired?.[field]).toBeUndefined();
    }
    expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);

    vi.setSystemTime(30_000);
    await admin.mutation(api.creators.approveCreator, { id });
    expect(await t.run(ctx => ctx.db.get(id))).toEqual(repaired);
    expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
  });
});
