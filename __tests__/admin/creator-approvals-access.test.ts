import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
  './_generated/server.js': () => import('../../convex/_generated/server'),
  './creators.ts': () => import('../../convex/creators'),
};

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
});
