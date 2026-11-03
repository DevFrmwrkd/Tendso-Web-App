import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { signOwnerBuild } from '../../lib/ownerBuildProof';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './http.ts': () => import('../../convex/http'),
    './ownerSiteEdits.ts': () => import('../../convex/ownerSiteEdits'),
    './generatedWebsites.ts': () => import('../../convex/generatedWebsites'),
};

const SECRET = 'test-internal-secret';
const NOW = Date.UTC(2026, 9, 21, 9);
const NOT_FOUND = 'We could not find that website.';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.INTERNAL_API_SECRET = SECRET;
    process.env.CONVEX_SITE_URL = 'https://test.convex.site';
});
afterEach(() => {
    vi.useRealTimers();
    delete process.env.INTERNAL_API_SECRET;
    delete process.env.CONVEX_SITE_URL;
});

const CONTENT = {
    business_name: 'Forge Barbers',
    tagline: 'Cuts that last',
    contact: { email: 'real@forge.ph', phone: '0917 000 0000', address: '12 Rizal St' },
    hero: { sub: 'Original intro' },
    testimonials: { items: [{ quote: 'Real quote', who: 'Kuya Ben' }] },
};

interface World {
    t: ReturnType<typeof convexTest>;
    submissionId: Id<'submissions'>;
    otherSubmissionId: Id<'submissions'>;
    websiteId: Id<'generatedWebsites'>;
    owner: ReturnType<ReturnType<typeof convexTest>['withIdentity']>;
    stranger: ReturnType<ReturnType<typeof convexTest>['withIdentity']>;
    admin: ReturnType<ReturnType<typeof convexTest>['withIdentity']>;
    anon: ReturnType<typeof convexTest>;
}

async function world(opts: { live?: boolean; customDomain?: boolean; status?: string } = {}): Promise<World> {
    const { live = true, customDomain = false, status = 'deployed' } = opts;
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'agent-1', email: 'agent@example.com', role: 'creator' });
        await ctx.db.insert('creators', { clerkId: 'admin-1', email: 'admin@example.com', role: 'admin' });
        const base = { creatorId, businessType: 'Barber', ownerName: 'Ben', ownerPhone: '09170000000', address: '12 Rizal St', city: 'Manila' };
        const submissionId = await ctx.db.insert('submissions', { ...base, businessName: 'Forge Barbers', status: status as 'deployed', photos: ['https://img.example/a.jpg'] });
        const otherSubmissionId = await ctx.db.insert('submissions', { ...base, businessName: 'Other Shop', status: 'deployed' });
        const ownerId = await ctx.db.insert('businessOwners', { clerkId: 'owner-a', email: 'ben@forge.ph', createdAt: 1 });
        const strangerId = await ctx.db.insert('businessOwners', { clerkId: 'owner-b', email: 'zed@other.ph', createdAt: 1 });
        await ctx.db.insert('websiteOwnerships', { businessOwnerId: ownerId, submissionId, role: 'owner', claimedAt: 1 });
        await ctx.db.insert('websiteOwnerships', { businessOwnerId: strangerId, submissionId: otherSubmissionId, role: 'owner', claimedAt: 1 });
        const oldBlob = await ctx.storage.store(new Blob(['<html>old</html>'], { type: 'text/html' }));
        const websiteId = await ctx.db.insert('generatedWebsites', {
            submissionId,
            templateName: 'astro',
            extractedContent: CONTENT,
            customizations: { heroStyle: 'barbershop:F', colorScheme: 'brown', colorSchemeId: 'brown' },
            htmlStorageId: oldBlob,
            status: live ? 'published' : 'draft',
            ...(live ? { publishedUrl: 'https://forge.sites.tendso.com', slug: 'forge', publishedAt: 1 } : {}),
            ...(customDomain ? { customDomain: 'forgebarbers.com' } : {}),
        });
        await ctx.db.insert('generatedWebsites', { submissionId: otherSubmissionId, templateName: 'astro', extractedContent: {}, status: 'draft' });
        return { submissionId, otherSubmissionId, websiteId };
    });
    return {
        t, ...ids,
        owner: t.withIdentity({ subject: 'owner-a' }),
        stranger: t.withIdentity({ subject: 'owner-b' }),
        admin: t.withIdentity({ subject: 'admin-1' }),
        anon: t,
    };
}

describe('ownership: only the owner of THIS site gets in', () => {
    it('refuses a signed-out caller on every function', async () => {
        const w = await world();
        const a = { submissionId: w.submissionId };
        await expect(w.anon.query(api.ownerSiteEdits.getEditorState, a)).rejects.toThrow('Please sign in again.');
        await expect(w.anon.query(api.ownerSiteEdits.getDraftForBuild, a)).rejects.toThrow('Please sign in again.');
        await expect(w.anon.mutation(api.ownerSiteEdits.saveDraft, { ...a, content: {}, customizations: {} })).rejects.toThrow('Please sign in again.');
        await expect(w.anon.mutation(api.ownerSiteEdits.discardDraft, a)).rejects.toThrow('Please sign in again.');
        await expect(w.anon.action(api.ownerSiteEdits.generateUploadUrl, a)).rejects.toThrow('Please sign in again.');
        await expect(w.anon.action(api.ownerSiteEdits.commitBuild, { ...a, html: '<p/>', proof: 'x', draftUpdatedAt: 0 })).rejects.toThrow('Please sign in again.');
    });

    it('treats another owner, an admin and a stranger exactly like a missing site', async () => {
        const w = await world();
        const a = { submissionId: w.submissionId };
        for (const who of [w.stranger, w.admin, w.t.withIdentity({ subject: 'nobody' })]) {
            await expect(who.query(api.ownerSiteEdits.getEditorState, a)).rejects.toThrow(NOT_FOUND);
            await expect(who.query(api.ownerSiteEdits.getDraftForBuild, a)).rejects.toThrow(NOT_FOUND);
            await expect(who.mutation(api.ownerSiteEdits.saveDraft, { ...a, content: CONTENT, customizations: {} })).rejects.toThrow(NOT_FOUND);
            await expect(who.mutation(api.ownerSiteEdits.discardDraft, a)).rejects.toThrow(NOT_FOUND);
            await expect(who.action(api.ownerSiteEdits.generateUploadUrl, a)).rejects.toThrow(NOT_FOUND);
        }
    });

    it('an owner cannot reach a site that is not theirs, even one that exists', async () => {
        const w = await world();
        await expect(w.owner.query(api.ownerSiteEdits.getEditorState, { submissionId: w.otherSubmissionId })).rejects.toThrow(NOT_FOUND);
        await expect(w.owner.mutation(api.ownerSiteEdits.saveDraft, { submissionId: w.otherSubmissionId, content: {}, customizations: {} })).rejects.toThrow(NOT_FOUND);
    });

    it('a site that was rejected is closed to its owner', async () => {
        const w = await world({ status: 'rejected' });
        await expect(w.owner.query(api.ownerSiteEdits.getEditorState, { submissionId: w.submissionId })).rejects.toThrow(NOT_FOUND);
    });

    it('the owner sees their own site', async () => {
        const w = await world();
        const state = await w.owner.query(api.ownerSiteEdits.getEditorState, { submissionId: w.submissionId });
        expect(state.businessName).toBe('Forge Barbers');
        expect(state.live).toBe(true);
        expect(state.draft).toBeNull();
        expect(state.base.content.business_name).toBe('Forge Barbers');
        expect(state.photos).toEqual(['https://img.example/a.jpg']);
        expect(state.htmlUrl).toMatch(/^https?:/);
    });
});

const CHANGES_BY_REQUEST = 'Ask for a change';

async function historicalDraft(w: World) {
    return w.t.run(async ctx => {
        const owner = (await ctx.db.query('businessOwners').collect()).find(row => row.clerkId === 'owner-a')!;
        return ctx.db.insert('ownerSiteDrafts', { submissionId: w.submissionId, businessOwnerId: owner._id, websiteId: w.websiteId,
            content: { ...CONTENT, hero: { sub: 'Historical working copy' } }, customizations: { heroStyle: 'barbershop:G' }, updatedAt: NOW - 1000 });
    });
}

async function snapshot(w: World) {
    return w.t.run(async ctx => ({
        website: await ctx.db.get(w.websiteId), submission: await ctx.db.get(w.submissionId),
        drafts: await ctx.db.query('ownerSiteDrafts').collect(), uploads: await ctx.db.query('ownerSiteUploads').collect(),
        logs: await ctx.db.query('auditLogs').collect(), storage: await ctx.db.system.query('_storage').collect(),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
}

describe('retired self-editor: owners request website changes instead', () => {
    it('keeps the linked owner’s historical snapshot readable without permitting deletion or save', async () => {
        const w = await world(); await historicalDraft(w);
        const before = await snapshot(w);
        const state = await w.owner.query(api.ownerSiteEdits.getEditorState, { submissionId: w.submissionId });
        expect(state.draft?.content.hero.sub).toBe('Historical working copy');
        expect(state.base.content.hero.sub).toBe('Original intro');
        expect(state.htmlUrl).toMatch(/^https?:/);
        await expect(w.owner.mutation(api.ownerSiteEdits.saveDraft, { submissionId: w.submissionId, content: CONTENT, customizations: {} })).rejects.toThrow(CHANGES_BY_REQUEST);
        await expect(w.owner.mutation(api.ownerSiteEdits.discardDraft, { submissionId: w.submissionId })).rejects.toThrow(CHANGES_BY_REQUEST);
        expect(await snapshot(w)).toEqual(before);
    });

    it.each([
        { label: 'live', live: true }, { label: 'private preview', live: false },
        { label: 'custom domain', customDomain: true }, { label: 'unpaid', status: 'pending_payment' },
    ])('refuses edit, upload and build requests for a $label website without changing content, payments or storage', async options => {
        const w = await world(options); await historicalDraft(w);
        const before = await snapshot(w);
        const args = { submissionId: w.submissionId };
        await expect(w.owner.mutation(api.ownerSiteEdits.saveDraft, { ...args, content: { ...CONTENT, hero: { sub: 'New words' } }, customizations: { heroStyle: 'salonspa:N' } })).rejects.toThrow(CHANGES_BY_REQUEST);
        await expect(w.owner.mutation(api.ownerSiteEdits.discardDraft, args)).rejects.toThrow(CHANGES_BY_REQUEST);
        await expect(w.owner.query(api.ownerSiteEdits.getDraftForBuild, args)).rejects.toThrow(CHANGES_BY_REQUEST);
        await expect(w.owner.action(api.ownerSiteEdits.generateUploadUrl, args)).rejects.toThrow(CHANGES_BY_REQUEST);
        const html = '<html>Signed before retirement</html>';
        await expect(w.owner.action(api.ownerSiteEdits.commitBuild, { ...args, html, proof: await signOwnerBuild(SECRET, w.submissionId, html), draftUpdatedAt: NOW - 1000 })).rejects.toThrow(CHANGES_BY_REQUEST);
        expect(await snapshot(w)).toEqual(before);
    });

    it('keeps an offline website offline even when a formerly valid signed build is retried', async () => {
        const w = await world(); await historicalDraft(w);
        await w.t.run(ctx => ctx.db.patch(w.websiteId, { offlineAt: NOW - 1000 }));
        const before = await snapshot(w), html = '<html>Do not republish</html>';
        await expect(w.owner.action(api.ownerSiteEdits.commitBuild, { submissionId: w.submissionId, html, proof: await signOwnerBuild(SECRET, w.submissionId, html), draftUpdatedAt: NOW - 1000 })).rejects.toThrow(CHANGES_BY_REQUEST);
        expect(await snapshot(w)).toEqual(before);
        expect((await w.owner.query(api.ownerSiteEdits.getEditorState, { submissionId: w.submissionId })).offline).toBe(true);
    });

    it.each(['not-signed', 'wrong-site', 'changed-html', 'missing-secret'])('refuses retired commits before storing a page regardless of build proof: %s', async proofKind => {
        const w = await world(); const before = await snapshot(w), html = '<html>New page</html>';
        let proof = proofKind === 'not-signed' ? 'x' : await signOwnerBuild(SECRET, proofKind === 'wrong-site' ? w.otherSubmissionId : w.submissionId, html);
        if (proofKind === 'changed-html') proof = await signOwnerBuild(SECRET, w.submissionId, `${html}changed`);
        if (proofKind === 'missing-secret') delete process.env.INTERNAL_API_SECRET;
        await expect(w.owner.action(api.ownerSiteEdits.commitBuild, { submissionId: w.submissionId, html, proof, draftUpdatedAt: 0 })).rejects.toThrow(CHANGES_BY_REQUEST);
        expect(await snapshot(w)).toEqual(before);
    });

    it('still hides build access from other owners and admins even with a valid signature', async () => {
        const w = await world(), html = '<html>Valid signature, wrong owner</html>';
        const before = await snapshot(w), proof = await signOwnerBuild(SECRET, w.submissionId, html);
        for (const who of [w.stranger, w.admin]) {
            await expect(who.action(api.ownerSiteEdits.commitBuild, { submissionId: w.submissionId, html, proof, draftUpdatedAt: 0 })).rejects.toThrow(NOT_FOUND);
        }
        expect(await snapshot(w)).toEqual(before);
    });
});

describe('retired uploads: old capabilities cannot receive or register new photos', () => {
    it('blocks direct ticket creation, upload registration and internal build commits before any side effects', async () => {
        const w = await world();
        const image = await w.t.run(ctx => ctx.storage.store(new Blob(['old image'], { type: 'image/jpeg' })));
        const before = await snapshot(w);
        await expect(w.t.mutation(internal.ownerSiteEdits.createUploadTicket, { submissionId: w.submissionId, clerkId: 'owner-a', token: 'new-ticket' })).rejects.toThrow(CHANGES_BY_REQUEST);
        await expect(w.t.mutation(internal.ownerSiteEdits.recordUpload, { submissionId: w.submissionId, clerkId: 'owner-a', storageId: image })).rejects.toThrow(CHANGES_BY_REQUEST);
        await expect(w.owner.mutation(api.ownerSiteEdits.registerUpload, { submissionId: w.submissionId, storageId: image })).rejects.toThrow(CHANGES_BY_REQUEST);
        await expect(w.t.mutation(internal.ownerSiteEdits.applyBuild, { submissionId: w.submissionId, clerkId: 'owner-a', storageId: image, draftUpdatedAt: 0 })).rejects.toThrow(CHANGES_BY_REQUEST);
        expect(await snapshot(w)).toEqual(before);
    });

    it.each([['image/jpeg', 'photo'], ['text/html', '<script/>'], ['image/jpeg', 'x'.repeat(10 * 1024 * 1024 + 1)]])('refuses old upload URLs before receiving a %s request body', async (contentType, body) => {
        const w = await world();
        await w.t.run(async ctx => {
            const owner = (await ctx.db.query('businessOwners').collect()).find(row => row.clerkId === 'owner-a')!;
            await ctx.db.insert('ownerSiteUploads', { submissionId: w.submissionId, businessOwnerId: owner._id, token: 'old-ticket', expiresAt: NOW + 10 * 60_000 });
        });
        const before = await snapshot(w);
        await expect(w.t.mutation(internal.ownerSiteEdits.consumeUpload, { token: 'old-ticket' })).rejects.toThrow(CHANGES_BY_REQUEST);
        const response = await w.t.fetch('/owner-site-upload?token=old-ticket', { method: 'POST', headers: { 'Content-Type': contentType }, body });
        expect(response.status).toBe(403);
        expect(await snapshot(w)).toEqual(before);
    });

    it('refuses guessed and expired upload capabilities without revealing the website', async () => {
        const w = await world();
        await w.t.run(async ctx => {
            const owner = (await ctx.db.query('businessOwners').collect()).find(row => row.clerkId === 'owner-a')!;
            await ctx.db.insert('ownerSiteUploads', { submissionId: w.submissionId, businessOwnerId: owner._id, token: 'expired-ticket', expiresAt: NOW - 1 });
        });
        const before = await snapshot(w);
        for (const token of ['guessed', 'expired-ticket']) {
            await expect(w.t.mutation(internal.ownerSiteEdits.consumeUpload, { token })).rejects.toThrow(NOT_FOUND);
            expect((await w.t.fetch(`/owner-site-upload?token=${token}`, { method: 'POST', body: 'photo' })).status).toBe(403);
        }
        expect(await snapshot(w)).toEqual(before);
    });

    it('does not delete existing storage when registering untracked, published, or another owner’s objects', async () => {
        const w = await world();
        const website = (await w.t.run(ctx => ctx.db.get(w.websiteId)))!;
        const image = await w.t.run(ctx => ctx.storage.store(new Blob(['photo'])));
        const before = await snapshot(w);
        for (const storageId of [website.htmlStorageId!, image]) {
            await expect(w.owner.mutation(api.ownerSiteEdits.registerUpload, { submissionId: w.submissionId, storageId })).rejects.toThrow(CHANGES_BY_REQUEST);
            await expect(w.stranger.mutation(api.ownerSiteEdits.registerUpload, { submissionId: w.submissionId, storageId })).rejects.toThrow(NOT_FOUND);
            expect(await w.t.run(async ctx => (await ctx.storage.get(storageId)) !== null)).toBe(true);
        }
        expect(await snapshot(w)).toEqual(before);
    });
});
