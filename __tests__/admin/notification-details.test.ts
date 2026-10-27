import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './notifications.ts': () => import('../../convex/notifications'),
};

const fullBody = [
    'Here is the full announcement. '.repeat(15),
    'A second paragraph with details the inbox preview cannot display.',
    'Please keep these final instructions available in the app.',
].join('\n\n');

async function setup(role: 'creator' | 'affiliate' = 'creator') {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const recipientId = await ctx.db.insert('creators', {
            clerkId: 'recipient', email: 'recipient@example.test', role, status: 'active',
        });
        const strangerId = await ctx.db.insert('creators', {
            clerkId: 'stranger', email: 'stranger@example.test', role: 'creator', status: 'active',
        });
        await ctx.db.insert('creators', {
            clerkId: 'admin', email: 'admin@example.test', role: 'admin', status: 'active',
        });
        const announcementId = await ctx.db.insert('announcements', {
            title: 'Announcement record title', body: fullBody, audience: 'all', recipientCount: 1,
            status: 'sent', sentBy: 'admin', createdAt: 1,
        });
        const notificationId = await ctx.db.insert('notifications', {
            creatorId: recipientId, type: 'system', title: 'Your original notification title',
            body: 'A short inbox preview. Full message sent to your email.',
            data: { announcementId }, read: false, sentAt: 2,
        });
        return { recipientId, strangerId, announcementId, notificationId };
    });
    return { t, ids, recipient: t.withIdentity({ subject: 'recipient' }) };
}

describe('recipient notification details', () => {
    it.each(['creator', 'affiliate'] as const)('returns the entire announcement to its %s recipient without changing the stored preview', async (role) => {
        const { t, ids, recipient } = await setup(role);
        const before = await t.run((ctx) => ctx.db.get(ids.notificationId));
        const detail = await recipient.query(api.notifications.getDetails, { id: ids.notificationId });
        expect(detail).toEqual({ ...before, body: fullBody });
        expect(detail?.title).toBe('Your original notification title');
        expect(detail?.body).toContain('\n\nPlease keep these final instructions');
        expect(await t.run((ctx) => ctx.db.get(ids.notificationId))).toEqual(before);
    });

    it('returns an ordinary full notification body without requiring an announcement', async () => {
        const { t, ids, recipient } = await setup();
        await t.run((ctx) => ctx.db.patch(ids.notificationId, { data: { withdrawalId: 'payout' }, body: fullBody }));
        expect(await recipient.query(api.notifications.getDetails, { id: ids.notificationId }))
            .toMatchObject({ _id: ids.notificationId, body: fullBody, read: false });
    });

    it('rejects anonymous reads', async () => {
        const { t, ids } = await setup();
        await expect(t.query(api.notifications.getDetails, { id: ids.notificationId })).rejects.toThrow('Not authenticated');
    });

    it.each(['stranger', 'admin', 'no-account'])('rejects a foreign recipient even for %s', async (subject) => {
        const { t, ids } = await setup();
        await expect(t.withIdentity({ subject }).query(api.notifications.getDetails, { id: ids.notificationId }))
            .rejects.toThrow('Forbidden');
    });

    it.each(['suspended', 'deleted'] as const)('rejects a %s recipient account', async (status) => {
        const { t, ids, recipient } = await setup();
        await t.run((ctx) => ctx.db.patch(ids.recipientId, { status }));
        await expect(recipient.query(api.notifications.getDetails, { id: ids.notificationId })).rejects.toThrow('Forbidden');
    });

    it('returns null when an authenticated recipient opens a removed notification', async () => {
        const { t, ids, recipient } = await setup();
        await t.run((ctx) => ctx.db.delete(ids.notificationId));
        expect(await recipient.query(api.notifications.getDetails, { id: ids.notificationId })).toBeNull();
    });

    it('falls back to the stored preview if the announcement was removed', async () => {
        const { t, ids, recipient } = await setup();
        await t.run((ctx) => ctx.db.delete(ids.announcementId));
        const stored = await t.run((ctx) => ctx.db.get(ids.notificationId));
        expect(await recipient.query(api.notifications.getDetails, { id: ids.notificationId })).toEqual(stored);
    });

    it.each([undefined, null, 'not-an-object', [], { announcementId: 123 }, { announcementId: 'malformed-id' }])(
        'falls back safely for legacy or malformed data %j', async (data) => {
            const { t, ids, recipient } = await setup();
            await t.run((ctx) => ctx.db.patch(ids.notificationId, { data }));
            const stored = await t.run((ctx) => ctx.db.get(ids.notificationId));
            expect(await recipient.query(api.notifications.getDetails, { id: ids.notificationId })).toEqual(stored);
        },
    );

    it('does not treat an ID from another table as an announcement', async () => {
        const { t, ids, recipient } = await setup();
        await t.run((ctx) => ctx.db.patch(ids.notificationId, { data: { announcementId: ids.strangerId } }));
        const stored = await t.run((ctx) => ctx.db.get(ids.notificationId));
        expect(await recipient.query(api.notifications.getDetails, { id: ids.notificationId })).toEqual(stored);
    });

    it.each(['recipient', 'stranger', null])('blocks client-forged announcement access from %s before inserting a notification', async (subject) => {
        const { t, ids } = await setup();
        const caller = subject ? t.withIdentity({ subject }) : t;
        await expect(caller.mutation(api.notifications.createForClient, {
            creatorId: ids.recipientId, type: 'system', title: 'Forged broadcast', body: 'Preview',
            data: { announcementId: ids.announcementId },
        })).rejects.toThrow('reserved for internal notifications');
        const notifications = await t.run((ctx) => ctx.db.query('notifications').collect());
        expect(notifications).toHaveLength(1);
        expect(notifications[0]._id).toBe(ids.notificationId);
    });

    it('preserves ordinary client-created account notices', async () => {
        const { t, ids, recipient } = await setup();
        await recipient.mutation(api.notifications.createForClient, {
            creatorId: ids.recipientId, type: 'password_changed', title: 'Password changed',
            body: 'Your password was changed.', data: { source: 'account-settings' },
        });
        const notifications = await t.run((ctx) => ctx.db.query('notifications').collect());
        const created = notifications.find((item) => item.type === 'password_changed');
        expect(created).toMatchObject({ creatorId: ids.recipientId, body: 'Your password was changed.' });
        expect(await recipient.query(api.notifications.getDetails, { id: created!._id })).toEqual(created);
    });
});
