import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
  './_generated/server.js': () => import('../../convex/_generated/server'),
  './notifications.ts': () => import('../../convex/notifications'),
};

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const first = await ctx.db.insert('creators', { clerkId: 'first', email: 'first@example.test', role: 'affiliate', status: 'active' });
    const second = await ctx.db.insert('creators', { clerkId: 'second', email: 'second@example.test', role: 'creator', status: 'active' });
    await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.test', role: 'admin', status: 'active' });
    const notice = (creatorId: typeof first, title: string) => ctx.db.insert('notifications', { creatorId, title, type: 'system', body: 'Full message', read: false, sentAt: 1 });
    return { first, second, firstNotice: await notice(first, 'Tapped notice'), unreadNotice: await notice(first, 'Leave unread'), secondNotice: await notice(second, 'Private other notice') };
  });
  return { t, ids, first: t.withIdentity({ subject: 'first' }), second: t.withIdentity({ subject: 'second' }) };
}

describe('owned notification opening and push anchors', () => {
  it('schedules a server-issued notification and recipient ID without sending a live push or rewriting its stored payload', async () => {
    const { t, ids } = await setup();
    const data = { notificationId: 'forged-id', creatorId: ids.second, url: '/admin', source: 'test' };
    await t.mutation(internal.notifications.createAndSend, { creatorId: ids.first, type: 'system', title: 'New message', body: 'Body', data });
    const stored = (await t.run(ctx => ctx.db.query('notifications').collect())).find(row => row.title === 'New message')!;
    expect(stored).toMatchObject({ creatorId: ids.first, data, read: false });
    const jobs = await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect());
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ name: 'notifications:sendPushNotification', args: [{
      creatorId: ids.first, title: 'New message', body: 'Body', data: { ...data, notificationId: stored._id, creatorId: ids.first },
    }] });
  });

  it('reads an owned target without mutations, then marks only that selected message read', async () => {
    const { t, ids, first } = await setup();
    const before = await t.run(ctx => ctx.db.query('notifications').collect());
    expect(await first.query(api.notifications.getDetails, { id: ids.firstNotice })).toMatchObject({ _id: ids.firstNotice, creatorId: ids.first, read: false });
    expect(await t.run(ctx => ctx.db.query('notifications').collect())).toEqual(before);
    await first.mutation(api.notifications.markAsRead, { id: ids.firstNotice });
    expect(await first.query(api.notifications.getUnreadCount, { creatorId: ids.first })).toBe(1);
    expect(await t.run(ctx => ctx.db.get(ids.unreadNotice))).toMatchObject({ read: false });
    expect(await t.run(ctx => ctx.db.get(ids.secondNotice))).toMatchObject({ read: false });
    await first.mutation(api.notifications.markAllAsRead, { creatorId: ids.first });
    expect(await first.query(api.notifications.getUnreadCount, { creatorId: ids.first })).toBe(0);
    expect(await t.run(ctx => ctx.db.get(ids.secondNotice))).toMatchObject({ read: false });
  });

  it.each([null, 'second', 'admin'])('rejects anonymous or foreign inbox/read writes without an admin override: %s', async subject => {
    const { t, ids } = await setup();
    const caller = subject ? t.withIdentity({ subject }) : t;
    await expect(caller.query(api.notifications.getByCreator, { creatorId: ids.first })).rejects.toThrow();
    await expect(caller.query(api.notifications.getUnreadCount, { creatorId: ids.first })).rejects.toThrow();
    await expect(caller.mutation(api.notifications.markAsRead, { id: ids.firstNotice })).rejects.toThrow();
    await expect(caller.mutation(api.notifications.markAllAsRead, { creatorId: ids.first })).rejects.toThrow();
    await expect(caller.mutation(api.notifications.createForClient, { creatorId: ids.first, type: 'system', title: 'Forged', body: 'Body' })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.get(ids.firstNotice))).toMatchObject({ read: false });
    expect(await t.run(ctx => ctx.db.query('notifications').collect())).toHaveLength(3);
  });

  it('allows suspended affiliates to read their own notices but denies deleted accounts and suspended field agents', async () => {
    const { t, ids, first, second } = await setup();
    await t.run(ctx => ctx.db.patch(ids.first, { status: 'suspended' }));
    expect(await first.query(api.notifications.getDetails, { id: ids.firstNotice })).toMatchObject({ _id: ids.firstNotice });
    await first.mutation(api.notifications.markAsRead, { id: ids.firstNotice });
    expect(await first.query(api.notifications.getByCreator, { creatorId: ids.first })).toHaveLength(2);
    await t.run(ctx => ctx.db.patch(ids.second, { status: 'suspended' }));
    await expect(second.query(api.notifications.getDetails, { id: ids.secondNotice })).rejects.toThrow('Forbidden');
    await t.run(ctx => ctx.db.patch(ids.first, { isDeleted: true }));
    await expect(first.query(api.notifications.getByCreator, { creatorId: ids.first })).rejects.toThrow('Forbidden');
  });

  it('binds registration to the recipient and transfers a shared device token on the next verified login', async () => {
    const { t, ids, first, second } = await setup();
    const input = { token: 'ExponentPushToken[test-only]', platform: 'ios' as const };
    await expect(t.mutation(api.notifications.registerPushToken, { ...input, creatorId: ids.first })).rejects.toThrow('Not authenticated');
    await expect(second.mutation(api.notifications.registerPushToken, { ...input, creatorId: ids.first })).rejects.toThrow('Forbidden');
    const tokenId = await first.mutation(api.notifications.registerPushToken, { ...input, creatorId: ids.first });
    expect(await second.mutation(api.notifications.registerPushToken, { ...input, creatorId: ids.second })).toBe(tokenId);
    expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ creatorId: ids.second, active: true });
    // A late logout cleanup from the old account cannot disable the new account's token.
    await expect(first.mutation(api.notifications.removePushToken, { token: input.token })).rejects.toThrow('Forbidden');
    expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ creatorId: ids.second, active: true });
    await second.mutation(api.notifications.removePushToken, { token: input.token });
    expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ active: false });
  });
});
