import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './aiPipeline/persist.ts': () => import('../../convex/aiPipeline/persist'),
    './generatedWebsites.ts': () => import('../../convex/generatedWebsites'),
};

async function setup(force = false) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert('creators', {
            clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active',
        });
        const submissionId = await ctx.db.insert('submissions', {
            creatorId, businessName: 'Shop', businessType: 'Barber', ownerName: 'Owner',
            ownerPhone: '', address: '', city: '', status: 'submitted',
        });
        const runId = await ctx.db.insert('aiPipelineRuns', {
            submissionId, status: 'running', step: 'building_site', attempt: 1,
            force, startedAt: Date.now(), deadlineAt: Date.now() + 1_000_000, updatedAt: Date.now(),
        });
        const humanHtml = await ctx.storage.store(new Blob(['<html>Human approved site</html>'], { type: 'text/html' }));
        const aiHtml = await ctx.storage.store(new Blob(['<html>AI draft</html>'], { type: 'text/html' }));
        return { runId, submissionId, humanHtml, aiHtml };
    });
    expect(await t.mutation(internal.aiPipeline.persist.prepareBuild, {
        runId: ids.runId, submissionId: ids.submissionId, content: { hero: { headline: 'AI draft' } },
    })).toMatchObject({ ok: true });
    const save = () => t.mutation(internal.aiPipeline.persist.saveBuiltSite, {
        runId: ids.runId, submissionId: ids.submissionId, htmlStorageId: ids.aiHtml,
        templateName: 'astro', extractedContent: { hero: { headline: 'AI draft' } },
        websiteContent: { businessName: 'Shop', tagline: 'AI draft', aboutText: 'AI draft' },
    });
    const admin = t.withIdentity({ subject: 'admin', email: 'admin@example.com' });
    return { t, ids, save, admin };
}

describe('AI build commit eligibility', () => {
    it.each(['draft', 'published'] as const)('preserves an intervening human %s build and discards only the incoming AI blob', async (status) => {
        const { t, ids, save, admin } = await setup();
        const websiteId = await admin.mutation(api.generatedWebsites.upsert, {
            submissionId: ids.submissionId, templateName: 'astro',
            extractedContent: { hero: { headline: 'Human approved' } }, htmlStorageId: ids.humanHtml,
        });
        if (status === 'published') {
            await admin.mutation(api.generatedWebsites.publish, {
                submissionId: ids.submissionId, publishedUrl: 'https://shop.sites.tendso.com', slug: 'shop',
            });
        }
        const before = await t.run((ctx) => ctx.db.get(websiteId));
        expect(await save()).toEqual({ saved: false });
        expect(await t.run((ctx) => ctx.db.get(websiteId))).toEqual(before);
        expect(await t.run((ctx) => ctx.db.query('websiteContent').collect())).toEqual([]);
        expect(await t.run(async (ctx) => (await ctx.storage.get(ids.humanHtml))!.text())).toContain('Human approved');
        const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        const cleanup = scheduled.filter((job) => job.name === 'generatedWebsites:deleteBlob');
        expect(cleanup.map((job) => (job.args[0] as { storageId: string }).storageId)).toEqual([ids.aiHtml]);
        if (status === 'published') {
            const humanUrl = await t.run((ctx) => ctx.storage.getUrl(ids.humanHtml));
            expect(await t.query(api.generatedWebsites.getPublishedBySlug, { slug: 'shop' }))
                .toMatchObject({ htmlUrl: humanUrl, slug: 'shop' });
        }
    });

    it.each(['inline', 'published_without_html'])('rechecks eligibility for an intervening %s site', async (kind) => {
        const { t, save } = await setup();
        const websiteId = await t.run(async (ctx) => {
            const website = await ctx.db.query('generatedWebsites').first();
            await ctx.db.patch(website!._id, kind === 'inline' ? { htmlContent: '<html>Human</html>' } : { status: 'published' });
            return website!._id;
        });
        const before = await t.run((ctx) => ctx.db.get(websiteId));
        expect(await save()).toEqual({ saved: false });
        expect(await t.run((ctx) => ctx.db.get(websiteId))).toEqual(before);
    });

    it('allows an explicitly forced rebuild to replace a built site', async () => {
        const { t, ids, save, admin } = await setup(true);
        const websiteId = await admin.mutation(api.generatedWebsites.upsert, {
            submissionId: ids.submissionId, templateName: 'astro', extractedContent: {}, htmlStorageId: ids.humanHtml,
        });
        expect(await save()).toEqual({ saved: true, websiteId });
        expect(await t.run((ctx) => ctx.db.get(websiteId))).toMatchObject({ htmlStorageId: ids.aiHtml });
    });

    it('saves an eligible draft and makes retries harmless to later content edits', async () => {
        const { t, ids, save } = await setup();
        const first = await save();
        expect(first.saved).toBe(true);
        const website = await t.run((ctx) => ctx.db.query('generatedWebsites').first());
        await t.run((ctx) => ctx.db.patch(website!._id, { extractedContent: { headline: 'Later human edit' } }));
        expect(await save()).toEqual(first);
        expect(await t.run((ctx) => ctx.db.get(website!._id))).toMatchObject({ extractedContent: { headline: 'Later human edit' } });
        await t.run((ctx) => ctx.db.patch(ids.runId, { status: 'done' }));
        expect(await save()).toEqual({ saved: false });
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'generatedWebsites:deleteBlob')).toEqual([]);
    });
});
