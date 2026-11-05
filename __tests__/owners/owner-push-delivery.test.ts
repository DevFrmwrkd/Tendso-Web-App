import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = { './_generated/server.js': () => import('../../convex/_generated/server'), './ownerInbox.ts': () => import('../../convex/ownerInbox') };
const PHONE = 'ExpoPushToken[owner_test_phone]';
const SECOND = 'ExpoPushToken[owner_second_phone]';
afterEach(() => vi.unstubAllGlobals());

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const ownerId = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', createdAt: Date.now() });
        const otherOwnerId = await ctx.db.insert('businessOwners', { clerkId: 'other', email: 'other@example.test', createdAt: Date.now() });
        const creatorId = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active' });
        const submissionId = await ctx.db.insert('submissions', { creatorId, businessName: 'Test Shop', businessType: 'Other', ownerName: 'Owner', ownerPhone: '', address: '', city: '', status: 'website_generated', previewReadyAt: Date.now() - 1000 });
        const linkId = await ctx.db.insert('websiteOwnerships', { businessOwnerId: ownerId, submissionId, role: 'owner', claimedAt: Date.now() });
        return { ownerId, otherOwnerId, linkId };
    });
    const owner = t.withIdentity({ subject: 'owner', email: 'owner@example.test', emailVerified: true });
    const inbox = (await owner.query(api.ownerInbox.list, { clerkId: 'owner' }))!;
    const event = inbox.items[0];
    const send = () => t.action(internal.ownerInbox.sendPush, { ownerId: ids.ownerId, eventKey: event.key, title: event.title, body: event.body });
    return { t, owner, event, send, ...ids };
}

describe('owner push delivery boundary (mock Expo service only)', () => {
    it('sends the verified event only to active devices belonging to that owner', async () => {
        const { t, owner, event, send, ownerId, otherOwnerId } = await setup();
        await owner.mutation(api.ownerInbox.registerPushToken, { token: PHONE, platform: 'ios', clerkId: 'owner' });
        await t.run(async ctx => {
            await ctx.db.insert('ownerPushTokens', { ownerId: otherOwnerId, token: SECOND, platform: 'android', active: true });
            await ctx.db.insert('ownerPushTokens', { ownerId, token: 'ExpoPushToken[disabled_phone]', platform: 'ios', active: false });
        });
        const service = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ status: 'ok', id: 'mock-ticket' }] }) });
        vi.stubGlobal('fetch', service);
        await send();
        expect(service).toHaveBeenCalledTimes(1);
        const [url, request] = service.mock.calls[0];
        expect(url).toBe('https://exp.host/--/api/v2/push/send');
        expect(request.method).toBe('POST');
        expect(JSON.parse(request.body)).toEqual([{ to: PHONE, sound: 'default', title: event.title, body: event.body, data: { ownerId, ownerEventKey: event.key } }]);
        expect((await owner.query(api.ownerInbox.list, {}))?.unreadCount).toBe(1);
    });

    it.each(['no-device', 'unknown-event', 'revoked-ownership'])('makes no network request for %s', async reason => {
        const { t, owner, ownerId, event, linkId } = await setup();
        if (reason !== 'no-device') await owner.mutation(api.ownerInbox.registerPushToken, { token: PHONE, platform: 'ios' });
        if (reason === 'revoked-ownership') await t.run(ctx => ctx.db.delete(linkId));
        const service = vi.fn(); vi.stubGlobal('fetch', service);
        await t.action(internal.ownerInbox.sendPush, { ownerId, eventKey: reason === 'unknown-event' ? 'made-up-event' : event.key, title: event.title, body: event.body });
        expect(service).not.toHaveBeenCalled();
    });

    it('deactivates an unregistered phone while keeping the other device active', async () => {
        const { t, owner, send } = await setup();
        for (const token of [PHONE, SECOND]) await owner.mutation(api.ownerInbox.registerPushToken, { token, platform: 'ios' });
        const service = vi.fn(async (_url: string, request: { body: string }) => ({ ok: true, json: async () => ({ data: JSON.parse(request.body).map((item: { to: string }) =>
            item.to === PHONE ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'mock-ticket' }) }) }));
        vi.stubGlobal('fetch', service);
        await send();
        const devices = await t.run(ctx => ctx.db.query('ownerPushTokens').collect());
        expect(devices.find(row => row.token === PHONE)?.active).toBe(false);
        expect(devices.find(row => row.token === SECOND)?.active).toBe(true);
    });

    it.each(['offline-service', 'http-error'])('retains the in-app update when delivery has an %s failure', async reason => {
        const { owner, send } = await setup();
        await owner.mutation(api.ownerInbox.registerPushToken, { token: PHONE, platform: 'ios' });
        const service = reason === 'offline-service' ? vi.fn().mockRejectedValue(new Error('Offline')) : vi.fn().mockResolvedValue({ ok: false, status: 503 });
        vi.stubGlobal('fetch', service);
        await expect(send()).resolves.toBeNull();
        const inbox = await owner.query(api.ownerInbox.list, {});
        expect(inbox?.unreadCount).toBe(1); expect(inbox?.items).toHaveLength(1);
    });
});
