import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { allFlowGuides } from '../../convex/knowledgeFlowGuides';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './knowledge.ts': () => import('../../convex/knowledge'),
    './knowledgeFlowGuides.ts': () => import('../../convex/knowledgeFlowGuides'),
};
const NOW = Date.UTC(2026, 10, 5, 12);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async ctx => {
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.test', role: 'admin' });
        await ctx.db.insert('creators', { clerkId: 'suspended', email: 'suspended@example.test', role: 'admin', status: 'suspended' });
        await ctx.db.insert('creators', { clerkId: 'deleted', email: 'deleted@example.test', role: 'admin', isDeleted: true });
        await ctx.db.insert('creators', { clerkId: 'staff', email: 'staff@example.test', role: 'staff' });
        await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', certifiedAt: 1 });
        await ctx.db.insert('creators', { clerkId: 'new-agent', email: 'new-agent@example.test', role: 'creator' });
        await ctx.db.insert('creators', { clerkId: 'affiliate', email: 'affiliate@example.test', role: 'affiliate' });
        await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', createdAt: 1 });
        const help = await ctx.db.insert('knowledgeCategories', { slug: 'your-website', title: 'Your Website', description: 'Existing public category', icon: 'help', hue: 'blue', workspace: 'help' });
        const wiki = await ctx.db.insert('knowledgeCategories', { slug: 'legacy-certification', title: 'Legacy certification', description: 'Legacy internal collection', icon: 'help', hue: 'blue', workspace: 'wiki' });
        const fields = { summary: 'Legacy summary', body: [{ t: 'p' as const, text: 'Legacy text' }], keywords: ['legacy'], author: 'Previous editor', readMin: 1, status: 'published' as const, createdAt: NOW - 100, updatedAt: NOW - 10, embedding: [0.1, 0.2], embeddingUpdatedAt: NOW - 10 };
        const timeline = await ctx.db.insert('knowledgeArticles', { ...fields, slug: 'how-fast-can-it-go-live', title: 'Guaranteed in 48 hours', categoryId: help, workspace: 'help' });
        const certification = await ctx.db.insert('knowledgeArticles', { ...fields, slug: 'certification-quiz', title: 'Legacy quiz', categoryId: wiki, workspace: 'wiki' });
        const stricter = await ctx.db.insert('knowledgeArticles', { ...fields, slug: 'what-if-i-dont-like-it', title: 'Restricted existing policy', categoryId: help, workspace: 'help', audiences: ['admin'], visibility: 'internal' });
        const unrelatedQa = await ctx.db.insert('knowledgeArticles', { ...fields, slug: 'qa-keep-reviewed-separate', title: 'Existing unrelated answer', categoryId: help, workspace: 'help', source: 'qa', audiences: ['owner'], visibility: 'authenticated' });
        const faq = await ctx.db.insert('knowledgeFaqs', { workspace: 'help', question: 'When will it go live?', answer: 'Guaranteed in 48 hours.', linkArticleSlug: 'how-fast-can-it-go-live' });
        return { help, wiki, timeline, certification, stricter, unrelatedQa, faq };
    });
    return { t, ...fixture };
}

type TestStore = ReturnType<typeof convexTest<typeof schema.tables>>;
async function snapshot(t: TestStore) {
    return t.run(async ctx => ({
        categories: await ctx.db.query('knowledgeCategories').collect(),
        articles: await ctx.db.query('knowledgeArticles').collect(),
        faqs: await ctx.db.query('knowledgeFaqs').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
}
async function reviewed(t: TestStore) {
    const preview = await t.withIdentity({ subject: 'admin' }).query(api.knowledgeFlowGuides.preview, {});
    return {
        preview,
        guards: {
            articles: preview.articles.map(article => ({ slug: article.slug, updatedAt: article.updatedAt })),
            faqs: preview.faqs.map(faq => ({ id: faq.id, answer: faq.answer })),
        },
    };
}

describe('current-flow KB catalogue publication', () => {
    it.each([null, 'owner', 'affiliate', 'agent', 'staff', 'suspended', 'deleted'] as const)('requires an active administrator for preview and publication (%s)', async subject => {
        const { t } = await setup();
        const actor = subject ? t.withIdentity({ subject }) : t;
        await expect(actor.query(api.knowledgeFlowGuides.preview, {})).rejects.toThrow(/authenticated|admin/i);
        await expect(actor.mutation(api.knowledgeFlowGuides.publish, { articles: [], faqs: [] })).rejects.toThrow(/authenticated|admin/i);
    });

    it('previews the complete catalogue and FAQ corrections without writing or scheduling work', async () => {
        const { t, faq } = await setup();
        const before = await snapshot(t);
        const { preview } = await reviewed(t);
        expect(preview.articles).toHaveLength(allFlowGuides.length);
        expect(preview.articles.find(article => article.slug === 'how-fast-can-it-go-live')).toMatchObject({ action: 'update', updatedAt: NOW - 10 });
        expect(preview.articles.find(article => article.slug === 'owner-switch-businesses-and-resume-drafts')).toMatchObject({ action: 'create', updatedAt: null });
        expect(preview.faqs.find(row => row.id === faq)).toMatchObject({ answer: 'Guaranteed in 48 hours.' });
        expect(await snapshot(t)).toEqual(before);
    });

    it('publishes reviewed content once, repairs linked FAQs, and schedules embeddings only for changed articles', async () => {
        const { t, timeline, faq, unrelatedQa } = await setup();
        const qaBefore = await t.run(ctx => ctx.db.get(unrelatedQa));
        const { guards, preview } = await reviewed(t);
        const result = await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards);
        const changed = preview.articles.filter(article => article.action === 'create' || article.action === 'update').length;
        expect(result).toMatchObject({ created: preview.articles.filter(article => article.action === 'create').length, updated: preview.articles.filter(article => article.action === 'update').length, unchanged: preview.articles.filter(article => article.action === 'unchanged').length, faqsUpdated: preview.faqs.length, total: allFlowGuides.length });
        const stored = await snapshot(t);
        expect(stored.articles.filter(article => allFlowGuides.some(guide => guide.slug === article.slug))).toHaveLength(allFlowGuides.length);
        expect(new Set(stored.articles.map(article => article.slug)).size).toBe(stored.articles.length);
        expect(await t.run(ctx => ctx.db.get(unrelatedQa))).toEqual(qaBefore);
        const updated = await t.run(ctx => ctx.db.get(timeline));
        expect(updated?.embedding).toBeUndefined();
        expect(updated?.embeddingUpdatedAt).toBeUndefined();
        expect(updated?.title).toBe(allFlowGuides.find(guide => guide.slug === 'how-fast-can-it-go-live')?.title);
        expect((await t.run(ctx => ctx.db.get(faq)))?.answer).toBe(preview.faqs.find(row => row.id === faq)?.newAnswer);
        expect(stored.jobs).toHaveLength(changed);
        expect(stored.jobs.every(job => job.name === 'knowledgeAI:generateEmbeddingForArticle')).toBe(true);
        expect(new Set(stored.jobs.map(job => JSON.stringify(job.args))).size).toBe(changed);

        const second = await reviewed(t);
        expect(second.preview.articles.every(article => article.action === 'unchanged')).toBe(true);
        expect(second.preview.faqs).toEqual([]);
        expect(await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, second.guards)).toMatchObject({ created: 0, updated: 0, unchanged: allFlowGuides.length, faqsUpdated: 0 });
        expect(await snapshot(t)).toEqual(stored);
    });

    it('refuses incomplete, duplicate or extra article review guards before any writes', async () => {
        const { t } = await setup();
        const { guards } = await reviewed(t);
        const before = await snapshot(t);
        const actor = t.withIdentity({ subject: 'admin' });
        for (const articles of [guards.articles.slice(1), [...guards.articles, guards.articles[0]], [...guards.articles, { slug: 'not-in-the-reviewed-catalogue', updatedAt: null }]]) {
            await expect(actor.mutation(api.knowledgeFlowGuides.publish, { ...guards, articles })).rejects.toThrow();
            expect(await snapshot(t)).toEqual(before);
        }
        await expect(actor.mutation(api.knowledgeFlowGuides.publish, { ...guards, faqs: [] })).rejects.toThrow();
        expect(await snapshot(t)).toEqual(before);
    });

    it('refuses a stale article revision atomically without overwriting the newer edit', async () => {
        const { t, timeline } = await setup();
        const { guards } = await reviewed(t);
        await t.run(ctx => ctx.db.patch(timeline, { title: 'Newer manual edit', updatedAt: NOW + 1 }));
        const newer = await snapshot(t);
        await expect(t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards)).rejects.toThrow();
        expect(await snapshot(t)).toEqual(newer);
    });

    it('refuses a stale FAQ answer atomically', async () => {
        const { t, faq } = await setup();
        const { guards } = await reviewed(t);
        await t.run(ctx => ctx.db.patch(faq, { answer: 'Another editor just corrected this answer.' }));
        const newer = await snapshot(t);
        await expect(t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards)).rejects.toThrow();
        expect(await snapshot(t)).toEqual(newer);
    });

    it('rejects a create guard if another article takes the slug after preview', async () => {
        const { t, help } = await setup();
        const { guards } = await reviewed(t);
        await t.run(ctx => ctx.db.insert('knowledgeArticles', { slug: 'owner-switch-businesses-and-resume-drafts', title: 'Another editor created this', summary: 'Do not overwrite', categoryId: help, workspace: 'help', body: [{ t: 'p', text: 'Keep this newer article.' }], keywords: [], author: 'Admin', readMin: 1, status: 'published', createdAt: NOW + 1, updatedAt: NOW + 1 }));
        const newer = await snapshot(t);
        await expect(t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards)).rejects.toThrow();
        expect(await snapshot(t)).toEqual(newer);
    });

    it.each(['draft', 'qa'] as const)('blocks a stable-slug collision with an existing %s without publishing or flattening it', async kind => {
        const { t, help } = await setup();
        const id = await t.run(ctx => ctx.db.insert('knowledgeArticles', { slug: 'owner-switch-businesses-and-resume-drafts', title: 'Existing review item', summary: 'Keep review state', categoryId: help, workspace: 'help', body: [{ t: 'h2', text: 'Preserve typed content' }, { t: 'p', text: 'Not yet an approved flow guide' }], keywords: [], author: 'Support', readMin: 1, status: kind === 'draft' ? 'draft' : 'published', ...(kind === 'qa' ? { source: 'qa' } : {}), audiences: ['admin'], visibility: 'internal', createdAt: NOW - 100, updatedAt: NOW - 1 }));
        const before = await snapshot(t);
        const { guards, preview } = await reviewed(t);
        expect(preview.articles.find(article => article.slug === 'owner-switch-businesses-and-resume-drafts')?.action).toBe('blocked');
        await expect(t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards)).rejects.toThrow();
        expect(await snapshot(t)).toEqual(before);
        expect((await t.run(ctx => ctx.db.get(id)))?.title).toBe('Existing review item');
    });

    it('preserves stricter article and category scopes while making legacy certification help available before approval', async () => {
        const { t, stricter, certification } = await setup();
        const { guards } = await reviewed(t);
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards);
        expect(await t.run(ctx => ctx.db.get(stricter))).toMatchObject({ audiences: ['admin'], visibility: 'internal' });
        expect(await t.query(api.knowledge.getArticleBySlug, { slug: 'what-if-i-dont-like-it' })).toBeNull();
        expect(await t.run(ctx => ctx.db.get(certification))).toMatchObject({ workspace: 'help', audiences: ['field_agent'], visibility: 'authenticated' });
        expect(await t.withIdentity({ subject: 'new-agent' }).query(api.knowledge.getArticleBySlug, { slug: 'certification-quiz' })).not.toBeNull();
        expect(await t.withIdentity({ subject: 'owner' }).query(api.knowledge.getArticleBySlug, { slug: 'certification-quiz' })).toBeNull();
        expect(await t.withIdentity({ subject: 'affiliate' }).query(api.knowledge.getArticleBySlug, { slug: 'certification-quiz' })).toBeNull();

        const ownerCategory = await t.run(ctx => ctx.db.query('knowledgeCategories').withIndex('by_slug', q => q.eq('slug', 'owner-account-guides')).first());
        expect(ownerCategory).toMatchObject({ workspace: 'help', audiences: ['owner'], visibility: 'authenticated' });
        await t.run(ctx => ctx.db.patch(ownerCategory!._id, { audiences: ['admin'], visibility: 'internal' }));
        const tightened = await reviewed(t);
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, tightened.guards);
        expect(await t.run(ctx => ctx.db.get(ownerCategory!._id))).toMatchObject({ audiences: ['admin'], visibility: 'internal' });
        expect(await t.withIdentity({ subject: 'owner' }).query(api.knowledge.getArticleBySlug, { slug: 'owner-switch-businesses-and-resume-drafts' })).toBeNull();
    });

    it('does not expose the newly published role content through another role or anonymous source list', async () => {
        const { t } = await setup();
        const { guards } = await reviewed(t);
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards);
        for (const guide of allFlowGuides) {
            if (guide.visibility === 'public') continue;
            expect(await t.query(api.knowledge.getArticleBySlug, { slug: guide.slug })).toBeNull();
            for (const [subject, audience] of [['owner', 'owner'], ['affiliate', 'affiliate'], ['agent', 'field_agent']] as const) {
                const article = await t.withIdentity({ subject }).query(api.knowledge.getArticleBySlug, { slug: guide.slug });
                if (!guide.audiences.includes(audience) && !guide.audiences.includes('everyone')) expect(article).toBeNull();
            }
        }
        const publicSlugs = await t.query(api.knowledge.listPublishedHelpSlugs, {});
        expect(publicSlugs.some(row => row.slug === 'owner-switch-businesses-and-resume-drafts')).toBe(false);
        expect(publicSlugs.some(row => row.slug === 'admin-review-discord-answers')).toBe(false);
    });

    it('never drops a stricter old parent category when moving reviewed content', async () => {
        const { t, timeline } = await setup();
        await t.run(async ctx => {
            const categoryId = await ctx.db.insert('knowledgeCategories', { slug: 'old-private-parent', title: 'Private parent', description: '', icon: 'help', hue: 'blue', workspace: 'help', audiences: ['admin'], visibility: 'internal' });
            await ctx.db.patch(timeline, { categoryId, audiences: ['everyone'], visibility: 'public' });
        });
        const before = await snapshot(t);
        const { guards, preview } = await reviewed(t);
        if (preview.articles.find(article => article.slug === 'how-fast-can-it-go-live')?.action === 'blocked') {
            await expect(t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards)).rejects.toThrow();
            expect(await snapshot(t)).toEqual(before);
        } else {
            await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards);
            expect(await t.query(api.knowledge.getArticleBySlug, { slug: 'how-fast-can-it-go-live' })).toBeNull();
            expect(await t.withIdentity({ subject: 'owner' }).query(api.knowledge.getArticleBySlug, { slug: 'how-fast-can-it-go-live' })).toBeNull();
        }
    });

    it('retains the wiki gate for a non-certification article with explicit signed-in metadata', async () => {
        const { t, timeline, wiki } = await setup();
        await t.run(ctx => ctx.db.patch(timeline, { workspace: 'wiki', categoryId: wiki, audiences: ['field_agent'], visibility: 'authenticated' }));
        const before = await snapshot(t);
        const { guards, preview } = await reviewed(t);
        if (preview.articles.find(article => article.slug === 'how-fast-can-it-go-live')?.action === 'blocked') {
            await expect(t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards)).rejects.toThrow();
            expect(await snapshot(t)).toEqual(before);
        } else {
            await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeFlowGuides.publish, guards);
            expect(await t.withIdentity({ subject: 'new-agent' }).query(api.knowledge.getArticleBySlug, { slug: 'how-fast-can-it-go-live' })).toBeNull();
        }
    });

    it('keeps the editorial catalogue complete and role-specific without promising direct owner editing', () => {
        expect(new Set(allFlowGuides.map(guide => guide.slug)).size).toBe(allFlowGuides.length);
        expect(allFlowGuides.length).toBeGreaterThan(20);
        for (const guide of allFlowGuides) {
            expect(guide.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
            expect(guide.title.trim()).not.toBe('');
            expect(guide.summary.trim()).not.toBe('');
            expect(guide.keywords.length).toBeGreaterThan(0);
            expect(guide.paragraphs.length).toBeGreaterThan(1);
            expect(guide.paragraphs.every(paragraph => !!paragraph.trim())).toBe(true);
            expect(guide.audiences.length).toBeGreaterThan(0);
        }
        const owner = allFlowGuides.find(guide => guide.slug === 'owner-review-preview-and-request-changes');
        expect(owner?.paragraphs.join(' ')).toContain('owners cannot directly edit the completed website');
        const certification = allFlowGuides.find(guide => guide.slug === 'certification-quiz');
        expect(certification).toMatchObject({ workspace: 'help', audiences: ['field_agent'], visibility: 'authenticated' });
        expect(certification?.paragraphs.join(' ')).toContain('do not need to repeat training');
    });
});
