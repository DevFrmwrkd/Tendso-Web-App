import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { Doc } from '../../convex/_generated/dataModel';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './ownerInbox.ts': () => import('../../convex/ownerInbox'),
    './notifications.ts': () => import('../../convex/notifications'),
};
const NOW = Date.UTC(2026, 10, 3, 19);
const DEVICE = 'ExpoPushToken[shared_test_device]';
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No real push delivery in inbox tests.'); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function setup(fields: Partial<Doc<'submissions'>> = {}) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'creator', role: 'creator', email: 'creator@example.test', status: 'active' });
        const ownerId = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', createdAt: NOW });
        const otherOwnerId = await ctx.db.insert('businessOwners', { clerkId: 'other-owner', email: 'other@example.test', createdAt: NOW });
        const submissionId = await ctx.db.insert('submissions', { creatorId, businessName: 'Test Shop', businessType: 'Other',
            ownerName: 'Owner', ownerPhone: '09171234567', address: 'Main St', city: 'Marikina', status: 'website_generated', amount: 4999, ...fields });
        const linkId = await ctx.db.insert('websiteOwnerships', { businessOwnerId: ownerId, submissionId, role: 'owner', claimedAt: NOW });
        const websiteId = await ctx.db.insert('generatedWebsites', { submissionId, templateName: 'test', status: 'draft', htmlContent: '<p>Private preview</p>', extractedContent: {} });
        const visitId = await ctx.db.insert('ownerVisitRequests', { ownerId, requestKey: 'request-key', shopName: 'Visit Shop', ownerName: 'Owner',
            phone: '+639171234567', address: 'Main St', city: 'Marikina', coordinates: { lat: 14.65, lng: 121.1 }, preferredWhen: 'Saturday',
            status: 'requested', createdAt: NOW, updatedAt: NOW, revision: 0 });
        return { creatorId, ownerId, otherOwnerId, submissionId, linkId, websiteId, visitId };
    });
    const owner = t.withIdentity({ subject: 'owner', email: 'owner@example.test', emailVerified: true });
    const other = t.withIdentity({ subject: 'other-owner', email: 'other@example.test', emailVerified: true });
    const creator = t.withIdentity({ subject: 'creator' });
    const list = () => owner.query(api.ownerInbox.list, { clerkId: 'owner' });
    const reads = () => t.run(ctx => ctx.db.query('ownerNotificationReads').collect());
    const jobs = () => t.run(ctx => ctx.db.system.query('_scheduled_functions').collect());
    return { t, ...ids, owner, other, creator, list, reads, jobs };
}

describe('owner inbox read semantics and factual history', () => {
    it('opening and leaving the inbox never marks its items read or schedules delivery', async () => {
        const { list, reads, jobs } = await setup({ previewReadyAt: NOW - 1000, paidInFullAt: NOW - 500 });
        expect((await list())?.unreadCount).toBe(2);
        expect((await list())?.unreadCount).toBe(2);
        expect(await reads()).toEqual([]);
        expect(await jobs()).toEqual([]);
    });

    it('marks only the clicked notification read, is idempotent, and updates the unread badge', async () => {
        const { owner, list, reads } = await setup({ previewReadyAt: NOW - 1000, paidInFullAt: NOW - 500 });
        const first = (await list())!;
        const key = first.items[0].key;
        await Promise.all([owner.mutation(api.ownerInbox.markRead, { key, clerkId: 'owner' }), owner.mutation(api.ownerInbox.markRead, { key, clerkId: 'owner' })]);
        const after = (await list())!;
        expect(after.unreadCount).toBe(1);
        expect(after.items.filter(item => item.read).map(item => item.key)).toEqual([key]);
        expect(await reads()).toHaveLength(1);
    });

    it('marks all existing notifications read only on the explicit action and keeps new events unread', async () => {
        const { t, owner, submissionId, list, reads } = await setup({ previewReadyAt: NOW - 1000, paidInFullAt: NOW - 500 });
        await owner.mutation(api.ownerInbox.markAllRead, { clerkId: 'owner' });
        expect((await list())?.unreadCount).toBe(0);
        await owner.mutation(api.ownerInbox.markAllRead, { clerkId: 'owner' });
        expect(await reads()).toHaveLength(2);
        await t.run(ctx => ctx.db.patch(submissionId, { depositPaidAt: NOW - 750 }));
        expect((await list())?.unreadCount).toBe(1);
    });

    it('derives timestamps only from actual facts, not a generic status or saved HTML', async () => {
        const { t, submissionId, websiteId, list } = await setup({ status: 'completed' });
        expect((await list())?.items).toEqual([]);
        await t.run(async ctx => {
            await ctx.db.patch(submissionId, { previewReadyAt: NOW - 5000, depositPaidAt: NOW - 4000, paidInFullAt: NOW - 3000 });
            await ctx.db.patch(websiteId, { status: 'published', publishedAt: NOW - 2000, offlineAt: NOW - 1000 });
        });
        const items = (await list())!.items;
        expect(items.map(item => [item.type, item.createdAt])).toEqual([
            ['website_offline', NOW - 1000], ['website_live', NOW - 2000], ['payment_received', NOW - 3000],
            ['deposit_received', NOW - 4000], ['preview_ready', NOW - 5000],
        ]);
        expect(new Set(items.map(item => item.key)).size).toBe(items.length);
    });

    it('retains captured workflow history once without duplicate rows or push jobs', async () => {
        const { t, submissionId, list, jobs } = await setup({ previewReadyAt: NOW - 1000 });
        await t.mutation(internal.ownerInbox.captureSiteUpdates, { submissionId });
        await t.mutation(internal.ownerInbox.captureSiteUpdates, { submissionId });
        expect(await t.run(ctx => ctx.db.query('ownerSiteEvents').collect())).toHaveLength(1);
        expect((await list())?.items).toHaveLength(1);
        expect((await jobs()).filter(job => job.name === 'ownerInbox:sendPush')).toHaveLength(1);
        await t.run(ctx => ctx.db.patch(submissionId, { previewReadyAt: undefined }));
        expect((await list())?.items).toHaveLength(1);
        expect((await list())?.items[0].createdAt).toBe(NOW - 1000);
    });

    it('keeps the factual request timestamp and never invents a closed-change update date', async () => {
        const { t, submissionId, list } = await setup();
        const changeId = await t.run(ctx => ctx.db.insert('changeRequests', { submissionId, text: 'Update hours', status: 'done',
            requestedBy: 'owner:test', createdAt: NOW - 5000 }));
        expect((await list())?.items.map(item => [item.type, item.createdAt])).toEqual([['change_requested', NOW - 5000]]);
        await t.run(ctx => ctx.db.patch(changeId, { resolvedAt: NOW - 1000 }));
        expect((await list())?.items.map(item => [item.type, item.createdAt])).toEqual([
            ['change_updated', NOW - 1000], ['change_requested', NOW - 5000],
        ]);
    });

    it('merges persistent visit updates with owned website facts in timestamp order', async () => {
        const { t, ownerId, visitId, submissionId, list } = await setup({ previewReadyAt: NOW - 2000 });
        const eventId = await t.run(ctx => ctx.db.insert('ownerVisitEvents', { ownerId, visitRequestId: visitId, type: 'visit_confirmed',
            title: 'Confirmed', body: 'Visit time confirmed', createdAt: NOW - 1000, dedupeKey: 'visit-confirmation' }));
        const items = (await list())!.items;
        expect(items[0]).toMatchObject({ key: `visit:${eventId}`, visitRequestId: visitId, submissionId: null, type: 'visit_confirmed', read: false });
        expect(items[1]).toMatchObject({ submissionId, visitRequestId: null, type: 'preview_ready' });
    });

    it('rejects foreign and fabricated event keys, actor mismatches and revoked website ownership', async () => {
        const { t, owner, other, creator, list, submissionId, linkId } = await setup({ previewReadyAt: NOW - 1000 });
        const key = (await list())!.items[0].key;
        await expect(other.mutation(api.ownerInbox.markRead, { key })).rejects.toThrow('not available');
        await expect(owner.mutation(api.ownerInbox.markRead, { key: 'forged-key' })).rejects.toThrow('not available');
        await expect(owner.mutation(api.ownerInbox.markRead, { key, clerkId: 'previous-account' })).rejects.toThrow('account changed');
        await expect(owner.query(api.ownerInbox.list, { clerkId: 'previous-account' })).rejects.toThrow('account changed');
        expect(await creator.query(api.ownerInbox.list, {})).toBeNull();
        await t.mutation(internal.ownerInbox.captureSiteUpdates, { submissionId });
        await t.run(ctx => ctx.db.delete(linkId));
        expect((await list())?.items).toEqual([]);
        await expect(owner.mutation(api.ownerInbox.markRead, { key })).rejects.toThrow('not available');
    });
});

describe('owner push recipient isolation', () => {
    it.each([undefined, true])('retains enabled registration compatibility when enabled=%s', async enabled => {
        const { t, owner, ownerId } = await setup();
        expect(await owner.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios', clerkId: 'owner', ...(enabled === undefined ? {} : { enabled }) })).toEqual({ registered: true });
        expect(await t.run(ctx => ctx.db.query('ownerPushTokens').collect())).toEqual([expect.objectContaining({ ownerId, token: DEVICE, active: true })]);
    });

    it('atomically moves an old account device to the opted-out current owner and keeps stale cleanup isolated', async () => {
        const { t, owner, other, ownerId, otherOwnerId, creatorId, submissionId, list } = await setup({ previewReadyAt: NOW - 1000 });
        await t.run(ctx => ctx.db.insert('websiteOwnerships', { businessOwnerId: otherOwnerId, submissionId, role: 'owner', claimedAt: NOW }));
        const key = (await list())!.items[0].key;
        await owner.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios', clerkId: 'owner' });
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId, eventKey: key })).toHaveLength(1);
        const generic = await t.run(ctx => ctx.db.insert('pushTokens', { creatorId, token: DEVICE, platform: 'ios', active: true }));

        expect(await other.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios', clerkId: 'other-owner', enabled: false })).toEqual({ registered: false });
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId, eventKey: key })).toEqual([]);
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId: otherOwnerId, eventKey: key })).toEqual([]);
        expect(await t.run(ctx => ctx.db.query('ownerPushTokens').collect())).toEqual([expect.objectContaining({ ownerId: otherOwnerId, token: DEVICE, active: false })]);
        expect((await t.run(ctx => ctx.db.get(generic)))?.active).toBe(false);

        // The new owner can enable the same device later. An old, delayed logout
        // remains owner-scoped and cannot disable that new registration.
        await other.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios', clerkId: 'other-owner', enabled: true });
        await owner.mutation(api.ownerInbox.removePushToken, { token: DEVICE, clerkId: 'owner' });
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId, eventKey: key })).toEqual([]);
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId: otherOwnerId, eventKey: key })).toHaveLength(1);
    });

    it('can claim an unregistered device inactive without scheduling or delivering a push', async () => {
        const { t, owner, ownerId, jobs } = await setup();
        expect(await owner.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'android', clerkId: 'owner', enabled: false })).toEqual({ registered: false });
        expect(await t.run(ctx => ctx.db.query('ownerPushTokens').collect())).toEqual([expect.objectContaining({ ownerId, token: DEVICE, platform: 'android', active: false })]);
        expect(await jobs()).toEqual([]);
    });

    it('rejects stale actors and unauthenticated inactive claims without changing the current registration', async () => {
        const { t, owner, other, ownerId } = await setup();
        await owner.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios', clerkId: 'owner' });
        await expect(other.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios', clerkId: 'owner', enabled: false })).rejects.toThrow('account changed');
        await expect(t.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios', enabled: false })).rejects.toThrow('sign in');
        expect(await t.run(ctx => ctx.db.query('ownerPushTokens').collect())).toEqual([expect.objectContaining({ ownerId, token: DEVICE, active: true })]);
    });

    it('requires an authenticated owner and a valid native token', async () => {
        const { t, owner, creator } = await setup();
        await expect(t.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios' })).rejects.toThrow('sign in');
        await expect(creator.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios' })).rejects.toThrow('sign in');
        await expect(owner.mutation(api.ownerInbox.registerPushToken, { token: 'not-a-token', platform: 'ios' })).rejects.toThrow('Invalid device');
        await expect(owner.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios', clerkId: 'old-owner' })).rejects.toThrow('account changed');
    });

    it('owner registration deactivates the same device’s creator token', async () => {
        const { t, owner, ownerId, creatorId } = await setup();
        const old = await t.run(ctx => ctx.db.insert('pushTokens', { creatorId, token: DEVICE, platform: 'ios', active: true }));
        await owner.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios', clerkId: 'owner' });
        expect((await t.run(ctx => ctx.db.get(old)))?.active).toBe(false);
        expect(await t.run(ctx => ctx.db.query('ownerPushTokens').collect())).toEqual([expect.objectContaining({ ownerId, token: DEVICE, active: true })]);
    });

    it.each([false, true])('creator registration disables prior owner delivery even when creator token exists=%s', async existing => {
        const { t, creator, creatorId, owner, ownerId, list } = await setup({ previewReadyAt: NOW - 1000 });
        if (existing) await t.run(ctx => ctx.db.insert('pushTokens', { creatorId, token: DEVICE, platform: 'ios', active: false }));
        await owner.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios' });
        const key = (await list())!.items[0].key;
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId, eventKey: key })).toHaveLength(1);
        await creator.mutation(api.notifications.registerPushToken, { creatorId, token: DEVICE, platform: 'ios' });
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId, eventKey: key })).toEqual([]);
        expect((await t.run(ctx => ctx.db.query('pushTokens').collect()))[0]).toMatchObject({ creatorId, active: true });
    });

    it('reassigns a shared owner token and prevents stale cleanup from disabling the new account', async () => {
        const { t, owner, other, ownerId, otherOwnerId, list } = await setup({ previewReadyAt: NOW - 1000 });
        await owner.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios' });
        const key = (await list())!.items[0].key;
        await other.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'android' });
        await owner.mutation(api.ownerInbox.removePushToken, { token: DEVICE, clerkId: 'owner' });
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId, eventKey: key })).toEqual([]);
        expect((await t.run(ctx => ctx.db.query('ownerPushTokens').collect()))[0]).toMatchObject({ ownerId: otherOwnerId, active: true });
    });

    it('never sends an event after ownership was revoked or for an unknown/foreign event key', async () => {
        const { t, owner, ownerId, otherOwnerId, linkId, list } = await setup({ previewReadyAt: NOW - 1000 });
        await owner.mutation(api.ownerInbox.registerPushToken, { token: DEVICE, platform: 'ios' });
        const key = (await list())!.items[0].key;
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId, eventKey: 'unknown' })).toEqual([]);
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId: otherOwnerId, eventKey: key })).toEqual([]);
        await t.run(ctx => ctx.db.delete(linkId));
        expect(await t.query(internal.ownerInbox.pushRecipients, { ownerId, eventKey: key })).toEqual([]);
    });
});
