import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { signOwnerBuild } from '../../lib/ownerBuildProof';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
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
});
afterEach(() => {
    vi.useRealTimers();
    delete process.env.INTERNAL_API_SECRET;
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
        await expect(w.anon.mutation(api.ownerSiteEdits.generateUploadUrl, a)).rejects.toThrow('Please sign in again.');
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
            await expect(who.mutation(api.ownerSiteEdits.generateUploadUrl, a)).rejects.toThrow(NOT_FOUND);
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

describe('saveDraft: a private working copy, cleaned', () => {
    it('stores a cleaned draft and leaves the live site exactly as it was', async () => {
        const w = await world();
        const before = await w.t.run((ctx) => ctx.db.get(w.websiteId));
        await w.owner.mutation(api.ownerSiteEdits.saveDraft, {
            submissionId: w.submissionId,
            content: {
                ...CONTENT,
                business_name: 'Hacked',
                contact: { email: 'x@x.com', phone: '1', address: 'x' },
                testimonials: { items: [{ quote: 'Invented', who: 'Nobody' }] },
                hero: { sub: 'New <script>alert(1)</script>intro <em>here</em>' },
                about: { lead: 'javascript:alert(1)' },
                visibility: { faq_block: false, hero_section: false },
            },
            customizations: { heroStyle: 'salonspa:N', colorScheme: 'green', fontPairing: 'nonsense', roleColors: { a: 'b' } },
        });
        const state = await w.owner.query(api.ownerSiteEdits.getEditorState, { submissionId: w.submissionId });
        const d = state.draft!;
        expect(d.content.hero.sub).toBe('New alert(1)intro <em>here</em>');
        expect(d.content.about.lead).toBe('');
        expect(d.content.business_name).toBe('Forge Barbers');
        expect(d.content.contact).toEqual(CONTENT.contact);
        expect(d.content.testimonials).toEqual(CONTENT.testimonials);
        expect(d.content.visibility).toEqual({ faq_block: false });
        expect(d.customizations.heroStyle).toBe('salonspa:N');
        expect(d.customizations.roleColors).toBeUndefined();
        expect(d.customizations.fontPairing).not.toBe('nonsense');

        const after = await w.t.run((ctx) => ctx.db.get(w.websiteId));
        expect(after).toEqual(before);
    });

    it('updates the same row on the next save and one owner never sees another\'s draft', async () => {
        const w = await world();
        const save = (text: string) => w.owner.mutation(api.ownerSiteEdits.saveDraft, { submissionId: w.submissionId, content: { ...CONTENT, hero: { sub: text } }, customizations: {} });
        await save('one');
        await save('two');
        const rows = await w.t.run((ctx) => ctx.db.query('ownerSiteDrafts').collect());
        expect(rows).toHaveLength(1);
        expect(rows[0]!.content.hero.sub).toBe('two');
        await expect(w.stranger.query(api.ownerSiteEdits.getEditorState, { submissionId: w.submissionId })).rejects.toThrow(NOT_FOUND);
    });

    it('refuses a draft that is not an object, and discard throws the copy away', async () => {
        const w = await world();
        await expect(w.owner.mutation(api.ownerSiteEdits.saveDraft, { submissionId: w.submissionId, content: 'nope', customizations: {} })).rejects.toThrow();
        await w.owner.mutation(api.ownerSiteEdits.saveDraft, { submissionId: w.submissionId, content: CONTENT, customizations: {} });
        await w.owner.mutation(api.ownerSiteEdits.discardDraft, { submissionId: w.submissionId });
        expect(await w.t.run((ctx) => ctx.db.query('ownerSiteDrafts').collect())).toHaveLength(0);
    });
});

describe('edit -> republish', () => {
    const HTML = '<html><body><h1>Forge, rebuilt</h1></body></html>';
    const edit = (w: World, sub = 'Brand new intro') =>
        w.owner.mutation(api.ownerSiteEdits.saveDraft, {
            submissionId: w.submissionId,
            content: { ...CONTENT, hero: { sub } },
            customizations: { heroStyle: 'barbershop:G', colorScheme: 'green' },
        });
    const commit = async (w: World, html = HTML, proof?: string, who = w.owner, draftUpdatedAt?: number) => {
        const stamp = draftUpdatedAt ?? (await w.owner.query(api.ownerSiteEdits.getDraftForBuild, { submissionId: w.submissionId })).updatedAt;
        return who.action(api.ownerSiteEdits.commitBuild, { submissionId: w.submissionId, html, proof: proof ?? (await signOwnerBuild(SECRET, w.submissionId, html)), draftUpdatedAt: stamp });
    };

    it('a live site: the saved draft becomes the site and the new page is the live page', async () => {
        const w = await world();
        await edit(w);
        const res = await commit(w);
        expect(res).toMatchObject({ live: true, republished: true, pendingWorker: false, slug: 'forge', publishedUrl: 'https://forge.sites.tendso.com' });

        const site = (await w.t.run((ctx) => ctx.db.get(w.websiteId)))!;
        expect(site.extractedContent.hero.sub).toBe('Brand new intro');
        expect(site.customizations.heroStyle).toBe('barbershop:G');
        expect(site.customizations.colorScheme).toBe('green');
        expect(site.status).toBe('published');
        expect(site.publishedUrl).toBe('https://forge.sites.tendso.com');
        expect(site.slug).toBe('forge');
        const blob = await w.t.run(async (ctx) => await (await ctx.storage.get(site.htmlStorageId!))!.text());
        expect(blob).toBe(HTML);
        expect(site.htmlContent).toBeUndefined();

        const state = await w.owner.query(api.ownerSiteEdits.getEditorState, { submissionId: w.submissionId });
        expect(state.draft!.lastPublishedAt).toBe(NOW);
        const logs = await w.t.run((ctx) => ctx.db.query('auditLogs').collect());
        expect(logs.map((l) => l.action)).toContain('owner_site_edit_published');
    });

    it('collects the superseded page and never touches the submission\'s payment status', async () => {
        const w = await world({ status: 'pending_payment' });
        const oldBlob = (await w.t.run((ctx) => ctx.db.get(w.websiteId)))!.htmlStorageId!;
        await edit(w);
        await commit(w);
        await w.t.finishAllScheduledFunctions(vi.runAllTimers);
        expect(await w.t.run(async (ctx) => (await ctx.storage.get(oldBlob)) === null)).toBe(true);
        const sub = (await w.t.run((ctx) => ctx.db.get(w.submissionId)))!;
        expect(sub.status).toBe('pending_payment');
    });

    it('a site that is not live yet is built and kept, never published', async () => {
        const w = await world({ live: false });
        await edit(w);
        const res = await commit(w);
        expect(res).toMatchObject({ live: false, republished: false, pendingWorker: false });
        const site = (await w.t.run((ctx) => ctx.db.get(w.websiteId)))!;
        expect(site.status).toBe('draft');
        expect(site.publishedUrl).toBeUndefined();
        expect(site.extractedContent.hero.sub).toBe('Brand new intro');
    });

    it('a site served from a custom domain is stored and flagged for the team to republish', async () => {
        const w = await world({ customDomain: true });
        await edit(w);
        const res = await commit(w);
        expect(res).toMatchObject({ live: true, republished: false, pendingWorker: true });
        const state = await w.owner.query(api.ownerSiteEdits.getEditorState, { submissionId: w.submissionId });
        expect(state.draft!.pendingWorkerRepublish).toBe(true);
    });

    it('a site taken offline stays offline', async () => {
        const w = await world();
        await w.t.run((ctx) => ctx.db.patch(w.websiteId, { offlineAt: 5 }));
        await edit(w);
        const res = await commit(w);
        expect(res.live).toBe(false);
        expect((await w.t.run((ctx) => ctx.db.get(w.websiteId)))!.offlineAt).toBe(5);
    });

    it('refuses a page built from an older draft than the one now saved, and keeps the site as it was', async () => {
        const w = await world();
        await edit(w, 'first');
        const built = await w.owner.query(api.ownerSiteEdits.getDraftForBuild, { submissionId: w.submissionId });
        vi.setSystemTime(NOW + 5_000); // the owner kept typing while the page built
        await edit(w, 'second');
        const before = await w.t.run((ctx) => ctx.db.get(w.websiteId));
        await expect(commit(w, HTML, undefined, w.owner, built.updatedAt)).rejects.toThrow('You changed something while we were building');
        expect(await w.t.run((ctx) => ctx.db.get(w.websiteId))).toEqual(before);
        // built from the current draft, it goes through
        await expect(commit(w)).resolves.toMatchObject({ republished: true });
    });

    it('refuses HTML our server did not sign: wrong proof, edited HTML, no secret configured', async () => {
        const w = await world();
        await edit(w);
        const before = await w.t.run((ctx) => ctx.db.get(w.websiteId));
        await expect(commit(w, HTML, 'a'.repeat(64))).rejects.toThrow('not built by Tendso');
        const proof = await signOwnerBuild(SECRET, w.submissionId, HTML);
        await expect(commit(w, HTML + '<script>steal()</script>', proof)).rejects.toThrow('not built by Tendso');
        delete process.env.INTERNAL_API_SECRET;
        await expect(commit(w, HTML, proof)).rejects.toThrow('not built by Tendso');
        expect(await w.t.run((ctx) => ctx.db.get(w.websiteId))).toEqual(before);
    });

    it('a signature made for one site does not publish on another, and a stranger cannot commit even with a valid one', async () => {
        const w = await world();
        await edit(w);
        const proofForOther = await signOwnerBuild(SECRET, w.otherSubmissionId, HTML);
        await expect(commit(w, HTML, proofForOther)).rejects.toThrow('not built by Tendso');
        const valid = await signOwnerBuild(SECRET, w.submissionId, HTML);
        await expect(commit(w, HTML, valid, w.stranger)).rejects.toThrow(NOT_FOUND);
        await expect(commit(w, HTML, valid, w.admin)).rejects.toThrow(NOT_FOUND);
    });
});

describe('registerUpload', () => {
    // convex-test's storage records no content type (the real _storage table
    // does, from the upload's Content-Type), so the accept path cannot be driven
    // here; what it must refuse is what these cover.
    it('throws away a file that is not declared as a photo', async () => {
        const w = await world();
        const text = await w.t.run((ctx) => ctx.storage.store(new Blob(['<script/>'])));
        const res = await w.owner.mutation(api.ownerSiteEdits.registerUpload, { submissionId: w.submissionId, storageId: text });
        expect(res).toMatchObject({ ok: false, message: expect.stringContaining('Please choose a photo') });
        expect(await w.t.run(async (ctx) => (await ctx.storage.get(text)) === null)).toBe(true);
    });

    it('refuses another owner\'s upload and leaves the file alone', async () => {
        const w = await world();
        const img = await w.t.run((ctx) => ctx.storage.store(new Blob(['x'], { type: 'image/jpeg' })));
        await expect(w.stranger.mutation(api.ownerSiteEdits.registerUpload, { submissionId: w.submissionId, storageId: img })).rejects.toThrow(NOT_FOUND);
        expect(await w.t.run(async (ctx) => (await ctx.storage.get(img)) !== null)).toBe(true);
    });
});
