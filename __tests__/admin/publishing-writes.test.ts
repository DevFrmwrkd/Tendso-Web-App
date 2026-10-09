import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './creators.ts': () => import('../../convex/creators'),
    './generatedWebsites.ts': () => import('../../convex/generatedWebsites'),
    './websiteContent.ts': () => import('../../convex/websiteContent'),
    './businessOwners.ts': () => import('../../convex/businessOwners'),
};
const NOW = Date.UTC(2026, 9, 9, 9);
type Backend = ReturnType<typeof convexTest<typeof schema.tables>>;
type Caller = Pick<Backend, 'query' | 'mutation' | 'action' | 'run'>;
type Ids = { submissionId: Id<'submissions'>; websiteId: Id<'generatedWebsites'> };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        for (const role of ['admin', 'creator', 'affiliate', 'staff']) {
            await ctx.db.insert('creators', { clerkId: role, email: `${role}@example.com`, role, status: 'active' });
        }
        await ctx.db.insert('creators', { clerkId: 'suspended-admin', email: 'suspended@example.com', role: 'admin', status: 'suspended' });
        await ctx.db.insert('creators', { clerkId: 'deleted-admin', email: 'deleted@example.com', role: 'admin', status: 'deleted' });
        await ctx.db.insert('creators', { clerkId: 'soft-deleted-admin', email: 'soft-deleted@example.com', role: 'admin', isDeleted: true });
        const creator = await ctx.db.query('creators').withIndex('by_clerk_id', (q) => q.eq('clerkId', 'creator')).first();
        const submissionId = await ctx.db.insert('submissions', {
            creatorId: creator!._id, businessName: 'Corner Shop', businessType: 'Salon', ownerName: 'Sam',
            ownerPhone: '09171234567', ownerEmail: 'owner@example.com', address: 'Main Street', city: 'Quezon City',
            status: 'deployed', amount: 1999,
        });
        const websiteId = await ctx.db.insert('generatedWebsites', {
            submissionId, status: 'published', templateName: 'default', extractedContent: { about: 'Original' },
            htmlContent: '<html>Original</html>', publishedUrl: 'https://shop.sites.tendso.com', slug: 'shop',
        });
        await ctx.db.insert('websiteContent', { websiteId, businessName: 'Corner Shop', aboutText: 'Original', updatedAt: NOW });
        const ownerId = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.com', createdAt: NOW });
        await ctx.db.insert('websiteOwnerships', { businessOwnerId: ownerId, submissionId, role: 'owner', claimedAt: NOW });
        return { submissionId, websiteId };
    });
    return { t, ids, admin: t.withIdentity({ subject: 'admin' }) };
}

const mutations: readonly (readonly [string, (caller: Caller, ids: Ids) => Promise<unknown>])[] = [
    ['generated upsert', (t, ids) => t.mutation(api.generatedWebsites.upsert, {
        submissionId: ids.submissionId, templateName: 'updated', extractedContent: { about: 'Changed' }, htmlContent: '<html>Changed</html>',
    })],
    ['publishing info', (t, ids) => t.mutation(api.generatedWebsites.updatePublishingInfo, { submissionId: ids.submissionId, publishedUrl: 'https://example.com/new' })],
    ['publish', (t, ids) => t.mutation(api.generatedWebsites.publish, { submissionId: ids.submissionId, publishedUrl: 'https://example.com/new' })],
    ['offline', (t, ids) => t.mutation(api.generatedWebsites.markOffline, { submissionId: ids.submissionId })],
    ['unpublish', (t, ids) => t.mutation(api.generatedWebsites.unpublish, { submissionId: ids.submissionId })],
    ['generated remove', (t, ids) => t.mutation(api.generatedWebsites.remove, { submissionId: ids.submissionId })],
    ['content upsert', (t, ids) => t.mutation(api.websiteContent.upsert, {
        websiteId: ids.websiteId, businessName: 'Updated shop', tagline: 'A local favorite', aboutText: 'Updated content',
    })],
    ['content update', (t, ids) => t.mutation(api.websiteContent.update, { websiteId: ids.websiteId, aboutText: 'Updated about' })],
    ['content remove', (t, ids) => t.mutation(api.websiteContent.remove, { websiteId: ids.websiteId })],
];

async function snapshot(t: Backend) {
    return t.run(async (ctx) => ({
        websites: await ctx.db.query('generatedWebsites').collect(),
        content: await ctx.db.query('websiteContent').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect(),
        storage: await ctx.db.system.query('_storage').collect(),
    }));
}

describe('administrative website publishing writes', () => {
    it.each([null, 'creator', 'affiliate', 'staff', 'owner', 'suspended-admin', 'deleted-admin', 'soft-deleted-admin'])
    ('rejects %s before writes, blobs or scheduled cleanup', async (subject) => {
        const { t, ids } = await setup();
        const caller = subject ? t.withIdentity({ subject }) : t;
        const before = await snapshot(t);
        for (const [, mutate] of mutations) {
            await expect(mutate(caller, ids)).rejects.toThrow(subject ? 'admin access required' : 'Not authenticated');
        }
        await expect(caller.action(api.generatedWebsites.storeHtml, { html: '<html>Injected</html>' }))
            .rejects.toThrow(subject ? 'admin access required' : 'Not authenticated');
        expect(await snapshot(t)).toEqual(before);
    });

    it.each(mutations)('permits the active admin %s operation', async (_name, mutate) => {
        const { t, ids, admin } = await setup();
        const before = await snapshot(t);
        await mutate(admin, ids);
        expect(await snapshot(t)).not.toEqual(before);
    });

    it('stores HTML only for admin builds while keeping trusted blob cleanup internal', async () => {
        const { t, admin } = await setup();
        const storageId = await admin.action(api.generatedWebsites.storeHtml, { html: '<html>Built shop</html>' });
        expect(await t.run((ctx) => ctx.db.system.get(storageId))).toMatchObject({ size: 23 });
        await t.action(internal.generatedWebsites.deleteBlob, { storageId });
        expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
    });

    it('takes a published site offline and restores it without moving its address', async () => {
        const { t, ids, admin } = await setup();
        await admin.mutation(api.generatedWebsites.markOffline, { submissionId: ids.submissionId });
        expect(await t.query(api.generatedWebsites.getPublishedBySlug, { slug: 'shop' })).toMatchObject({ offlineAt: NOW });
        await admin.mutation(api.generatedWebsites.publish, {
            submissionId: ids.submissionId, publishedUrl: 'https://shop.sites.tendso.com', slug: 'attempted-new-slug',
        });
        expect(await t.query(api.generatedWebsites.getPublishedBySlug, { slug: 'shop' })).toMatchObject({ offlineAt: null, htmlContent: '<html>Original</html>' });
        expect(await t.query(api.generatedWebsites.getPublishedBySlug, { slug: 'attempted-new-slug' })).toBeNull();
        expect(await t.query(api.generatedWebsites.listSlugs, {})).toEqual(['shop']);
        expect(await t.query(api.generatedWebsites.countPublished, {})).toBe(1);
    });

    it('keeps the owner portal content-only editing path working independently of admin writes', async () => {
        const { t, ids } = await setup();
        const owner = t.withIdentity({ subject: 'owner' });
        await expect(owner.mutation(api.businessOwners.updateMyWebsiteContent, {
            submissionId: ids.submissionId, patch: { aboutText: 'Owner supplied edit' },
        })).resolves.toEqual({ ok: true, fieldsUpdated: 1 });
        expect(await owner.query(api.businessOwners.getMyWebsiteContent, { submissionId: ids.submissionId }))
            .toMatchObject({ aboutText: 'Owner supplied edit' });
        expect(await t.run((ctx) => ctx.db.get(ids.websiteId))).toMatchObject({ status: 'published', publishedUrl: 'https://shop.sites.tendso.com' });
    });
});
