import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { KnowledgeAccess, KnowledgeWorkspace } from '../../packages/shared/knowledge';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './knowledge.ts': () => import('../../convex/knowledge'),
    './knowledgeTraining.ts': () => import('../../convex/knowledgeTraining'),
    './escalations.ts': () => import('../../convex/escalations'),
    './kb.ts': () => import('../../convex/kb'),
    './ownerInbox.ts': () => import('../../convex/ownerInbox'),
};
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 10, 5)); });
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async ctx => {
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.test', role: 'admin' });
        await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', certifiedAt: 1 });
        await ctx.db.insert('creators', { clerkId: 'new-agent', email: 'new-agent@example.test', role: 'creator' });
        await ctx.db.insert('creators', { clerkId: 'affiliate', email: 'affiliate@example.test', role: 'affiliate' });
        await ctx.db.insert('creators', { clerkId: 'staff', email: 'staff@example.test', role: 'staff' });
        await ctx.db.insert('creators', { clerkId: 'suspended', email: 'suspended@example.test', role: 'admin', status: 'suspended' });
        await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', createdAt: 1 });
        // An owner row must not restore a disabled creator's privileged access.
        await ctx.db.insert('businessOwners', { clerkId: 'suspended', email: 'suspended@example.test', createdAt: 1 });
        const category = async (slug: string, workspace: KnowledgeWorkspace, access?: KnowledgeAccess) => ctx.db.insert('knowledgeCategories', {
            slug, title: slug, description: 'Category', icon: 'help', hue: 'blue', workspace, ...access,
        });
        const help = await category('help', 'help');
        const wiki = await category('wiki', 'wiki');
        const privateCategory = await category('owner-category', 'help', { audiences: ['owner'], visibility: 'authenticated' });
        const article = async (slug: string, workspace: KnowledgeWorkspace, access?: KnowledgeAccess, status: 'draft' | 'published' = 'published', categoryId = workspace === 'wiki' ? wiki : help) => ctx.db.insert('knowledgeArticles', {
            slug, title: `${slug} zircon`, summary: `${slug} confidential details`, categoryId, workspace,
            body: [{ t: 'p', text: `${slug} body` }], keywords: ['zircon'], author: 'Support', readMin: 1,
            status, popular: true, createdAt: 1, updatedAt: 1, embedding: [0.1, 0.2], ...access,
        });
        const publicArticle = await article('public', 'help');
        await article('public-owner', 'help', { audiences: ['owner'], visibility: 'public' });
        const ownerArticle = await article('owner-only', 'help', { audiences: ['owner'], visibility: 'authenticated' });
        await article('affiliate-only', 'help', { audiences: ['affiliate'], visibility: 'authenticated' });
        await article('signed-in', 'help', { audiences: ['everyone'], visibility: 'authenticated' });
        await article('internal-admin', 'help', { audiences: ['admin'], visibility: 'internal' });
        await article('internal-agent', 'help', { audiences: ['field_agent'], visibility: 'internal' });
        const legacyWiki = await article('legacy-wiki', 'wiki');
        await article('public-child-private-category', 'help', undefined, 'published', privateCategory);
        const draft = await article('draft', 'help', { audiences: ['everyone'], visibility: 'public' }, 'draft');
        await ctx.db.insert('knowledgeFaqs', { workspace: 'help', question: 'Public', answer: 'Allowed' });
        await ctx.db.insert('knowledgeFaqs', { workspace: 'help', question: 'Owner', answer: 'Private owner answer', audiences: ['owner'], visibility: 'authenticated' });
        await ctx.db.insert('knowledgeFaqs', { workspace: 'help', question: 'Private linked answer', answer: 'Must follow linked access', linkArticleSlug: 'owner-only' });
        return { help, wiki, publicArticle, ownerArticle, legacyWiki, draft };
    });
    return { t, ...fixture };
}

describe('knowledge access and relevance', () => {
    it('derives the actor from identity and retains the certified wiki gate', async () => {
        const { t } = await setup();
        expect(await t.query(api.knowledge.viewerContext, {})).toMatchObject({ clerkId: null, audience: 'everyone', authenticated: false });
        for (const [subject, audience, wiki] of [['owner', 'owner', false], ['affiliate', 'affiliate', false], ['agent', 'field_agent', true], ['new-agent', 'field_agent', false], ['admin', 'admin', true], ['staff', 'everyone', false]] as const) {
            expect(await t.withIdentity({ subject }).query(api.knowledge.viewerContext, {})).toMatchObject({ clerkId: subject, audience, canAccessWiki: wiki });
        }
        expect(await t.withIdentity({ subject: 'suspended' }).query(api.knowledge.viewerContext, {})).toMatchObject({ blocked: true, isAdmin: false, canAccessWiki: false });
    });

    it.each([
        [null, ['public', 'public-owner']],
        ['owner', ['public', 'public-owner', 'owner-only', 'signed-in', 'public-child-private-category']],
        ['affiliate', ['public', 'public-owner', 'affiliate-only', 'signed-in']],
        ['agent', ['public', 'public-owner', 'signed-in', 'internal-agent']],
        ['new-agent', ['public', 'public-owner', 'signed-in']],
        ['suspended', ['public', 'public-owner']],
    ] as const)('filters browse, direct URLs and retained article data for %s', async (subject, expected) => {
        const { t } = await setup();
        const viewer = subject ? t.withIdentity({ subject }) : t;
        const docs = await viewer.query(api.knowledge.listArticles, { workspace: 'help' });
        expect(docs.map(doc => doc.slug).sort()).toEqual([...expected].sort());
        expect(docs.every(doc => !('embedding' in doc))).toBe(true);
        const paired = await viewer.query(api.knowledge.libraryForViewer, { workspace: 'help' });
        expect(paired.viewer.clerkId).toBe(subject);
        expect(paired.articles).toEqual(docs);
        for (const slug of ['public', 'public-owner', 'owner-only', 'affiliate-only', 'internal-admin', 'internal-agent', 'public-child-private-category', 'draft']) {
            const article = await viewer.query(api.knowledge.getArticleBySlug, { slug });
            expect(!!article).toBe((expected as readonly string[]).includes(slug));
            const result = await viewer.query(api.knowledge.articleForViewer, { slug });
            expect(result.viewer.clerkId).toBe(subject);
            expect(!!result.article).toBe(!!article);
        }
    });

    it('public audience tags affect assistant relevance without hiding shareable public advice', async () => {
        const { t } = await setup();
        const anon = await t.query(internal.knowledge.listForAssistantInternal, {});
        expect(anon.map(a => a.slug)).toEqual(['public']);
        const affiliate = await t.withIdentity({ subject: 'affiliate' }).query(internal.knowledge.listForAssistantInternal, {});
        expect(affiliate.map(a => a.slug).sort()).toEqual(['public', 'affiliate-only', 'signed-in'].sort());
        const agent = await t.withIdentity({ subject: 'agent' }).query(internal.knowledge.listForAssistantInternal, {});
        expect(agent.map(a => a.slug)).toContain('legacy-wiki');
        expect(agent.map(a => a.slug)).not.toContain('internal-admin');
        expect(await t.withIdentity({ subject: 'owner' }).query(api.knowledge.listArticles, { workspace: 'wiki' })).toEqual([]);
    });

    it('never advertises private slugs in a sitemap, including for admin callers', async () => {
        const { t } = await setup();
        const result = await t.withIdentity({ subject: 'admin' }).query(api.knowledge.listPublishedHelpSlugs, {});
        expect(result.map(a => a.slug).sort()).toEqual(['public', 'public-owner']);
    });

    it('protects category/FAQ content, linked answers and feedback writes', async () => {
        const { t, ownerArticle, draft } = await setup();
        expect((await t.query(api.knowledge.listCategories, { workspace: 'help' })).map(c => c.slug)).toEqual(['help']);
        expect((await t.query(api.knowledge.listFaqs, { workspace: 'help' })).map(f => f.question)).toEqual(['Public']);
        expect((await t.withIdentity({ subject: 'owner' }).query(api.knowledge.listFaqs, { workspace: 'help' }))).toHaveLength(3);
        await t.mutation(api.knowledge.recordFeedback, { slug: 'owner-only', helpful: true });
        await t.mutation(api.knowledge.recordFeedback, { slug: 'draft', helpful: true });
        expect((await t.run(ctx => ctx.db.get(ownerArticle)))?.helpfulYes).toBeUndefined();
        expect((await t.run(ctx => ctx.db.get(draft)))?.helpfulYes).toBeUndefined();
        await t.withIdentity({ subject: 'owner' }).mutation(api.knowledge.recordFeedback, { slug: 'owner-only', helpful: true });
        expect((await t.run(ctx => ctx.db.get(ownerArticle)))?.helpfulYes).toBe(1);
    });

    it('keeps external keyword and vector-hit resolution public even when its HTTP secret is valid', async () => {
        const { t, publicArticle, ownerArticle, legacyWiki, draft } = await setup();
        const keywords = await t.query(internal.kb.keywordSearch, { query: 'zircon', topK: 10 });
        expect(keywords.map(a => a.id).sort()).toEqual([publicArticle, (await t.query(api.knowledge.getArticleBySlug, { slug: 'public-owner' }))!._id].sort());
        const resolved = await t.query(internal.kb.resolveHits, { ids: [ownerArticle, legacyWiki, draft, publicArticle], scores: [1, 1, 1, 0.8] });
        expect(resolved.map(a => a.id)).toEqual([publicArticle]);
    });

    it('restricts administration and changes metadata without flattening content', async () => {
        const { t, ownerArticle } = await setup();
        await expect(t.withIdentity({ subject: 'owner' }).query(api.knowledge.listAdminArticles, {})).rejects.toThrow(/admin/);
        await expect(t.withIdentity({ subject: 'affiliate' }).mutation(api.knowledge.setKnowledgeAccess, { kind: 'article', id: ownerArticle, audiences: ['everyone'], visibility: 'public' })).rejects.toThrow(/admin/);
        const before = await t.run(ctx => ctx.db.get(ownerArticle));
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledge.setKnowledgeAccess, { kind: 'article', id: ownerArticle, audiences: ['owner'], visibility: 'internal' });
        expect(await t.run(ctx => ctx.db.get(ownerArticle))).toEqual({ ...before, visibility: 'internal' });
        const adminArticle = await t.withIdentity({ subject: 'admin' }).query(api.knowledge.getAdminArticle, { articleId: ownerArticle });
        expect(adminArticle?.body).toEqual(before?.body);
        expect(adminArticle).not.toHaveProperty('embedding');
        expect((await t.withIdentity({ subject: 'admin' }).query(api.knowledge.listAdminArticles, {})).map(a => a.slug)).toContain('draft');
    });

    it('keeps learned private answers as scoped drafts until an admin reviews them', async () => {
        const { t } = await setup();
        const id = await t.mutation(internal.knowledgeTraining.saveTrainedQA, { question: 'Private question?', answer: 'A private team reply', workspace: 'help', grounded: true });
        const saved = await t.run(ctx => ctx.db.get(id));
        expect(saved).toMatchObject({ status: 'draft', audiences: ['admin'], visibility: 'internal' });
        expect(await t.query(api.knowledge.getArticleBySlug, { slug: saved!.slug })).toBeNull();
        const tagged = await t.mutation(internal.knowledgeTraining.saveTrainedQA, { question: 'Owner draft?', answer: 'Review this first', workspace: 'help', grounded: true, audiences: ['owner'], visibility: 'authenticated' });
        expect(await t.run(ctx => ctx.db.get(tagged))).toMatchObject({ status: 'draft', audiences: ['owner'], visibility: 'authenticated' });
    });

    it('preserves training scope through scheduled job claims and explicit Q&A publication', async () => {
        const { t } = await setup();
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeTraining.enqueueTraining, { questions: ['Scoped job?'], workspace: 'help', audiences: ['affiliate'], visibility: 'authenticated' });
        expect(await t.mutation(internal.knowledgeTraining.claimNextTrainingJob, {})).toMatchObject({ audiences: ['affiliate'], visibility: 'authenticated' });
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeTraining.trainQAPairs, { text: 'How do owners pay? Use checkout.', workspace: 'help', audiences: ['owner'], visibility: 'authenticated' });
        const published = await t.run(async ctx => (await ctx.db.query('knowledgeArticles').collect()).find(a => a.title === 'How do owners pay?'));
        expect(published).toMatchObject({ status: 'published', audiences: ['owner'], visibility: 'authenticated' });
        expect(await t.query(api.knowledge.getArticleBySlug, { slug: published!.slug })).toBeNull();
    });

    it('allows scheduled training only its claimed job scope, including parent categories', async () => {
        const { t } = await setup();
        await expect(t.withIdentity({ subject: 'owner' }).mutation(internal.knowledgeTraining.openDirectTrainingJob, { question: 'Impersonate admin?', workspace: 'wiki' })).rejects.toThrow(/admin/);
        const jobId = await t.run(ctx => ctx.db.insert('knowledgeTrainingJobs', {
            question: 'Owner training?', workspace: 'help', audiences: ['owner'], visibility: 'authenticated', status: 'queued', batchId: 'scope-test', createdAt: 1, updatedAt: 1,
        }));
        expect(await t.query(internal.knowledge.listForTrainingInternal, { jobId })).toEqual([]);
        await t.run(ctx => ctx.db.patch(jobId, { status: 'processing' }));
        expect((await t.query(internal.knowledge.listForTrainingInternal, { jobId })).map(a => a.slug).sort()).toEqual(['public', 'public-owner', 'owner-only', 'signed-in', 'public-child-private-category'].sort());
        await t.run(ctx => ctx.db.patch(jobId, { visibility: 'public' }));
        expect((await t.query(internal.knowledge.listForTrainingInternal, { jobId })).map(a => a.slug).sort()).toEqual(['public', 'public-owner']);
        await t.run(ctx => ctx.db.patch(jobId, { visibility: 'authenticated', audiences: ['owner', 'affiliate'] }));
        expect((await t.query(internal.knowledge.listForTrainingInternal, { jobId })).map(a => a.slug).sort()).toEqual(['public', 'signed-in']);
    });

    it('does not deduplicate the same wording across different intended audiences', async () => {
        const { t } = await setup();
        const admin = t.withIdentity({ subject: 'admin' });
        for (const audience of ['owner', 'affiliate'] as const) {
            const result = await admin.mutation(api.knowledgeTraining.trainQAPairs, {
                text: 'How do I get paid? Role-specific answer.', workspace: 'help', audiences: [audience], visibility: 'authenticated',
            });
            expect(result.saved).toBe(1);
        }
        const saved = (await t.run(ctx => ctx.db.query('knowledgeArticles').collect())).filter(a => a.title === 'How do I get paid?');
        expect(saved).toHaveLength(2);
        expect(new Set(saved.map(article => article.slug)).size).toBe(2);
    });

    it('preserves internal legacy defaults when an admin moves an article into Help', async () => {
        const { t, legacyWiki } = await setup();
        const article = await t.run(ctx => ctx.db.get(legacyWiki));
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledge.upsertArticle, {
            articleId: legacyWiki, slug: article!.slug, title: article!.title, summary: article!.summary,
            categorySlug: 'help', workspace: 'help', body: article!.body, keywords: article!.keywords,
            author: article!.author, readMin: article!.readMin,
        });
        expect(await t.run(ctx => ctx.db.get(legacyWiki))).toMatchObject({ workspace: 'help', audiences: ['field_agent', 'admin'], visibility: 'internal' });
        expect(await t.query(api.knowledge.getArticleBySlug, { slug: article!.slug })).toBeNull();
    });

    it('separates escalations by asker and access scope', async () => {
        const { t } = await setup();
        await t.mutation(internal.escalations.insertEscalation, { question: 'My payout?', normalizedQuestion: 'my payout?', workspace: 'help', askerUserId: 'affiliate', audiences: ['affiliate'], visibility: 'authenticated' });
        const args = { normalizedQuestion: 'my payout?', workspace: 'help' as const, audiences: ['affiliate' as const], visibility: 'authenticated' as const };
        expect(await t.query(internal.escalations.findOpenByQuestion, { ...args, askerUserId: 'owner' })).toBeNull();
        expect(await t.query(internal.escalations.findOpenByQuestion, { ...args, askerUserId: 'affiliate' })).toMatchObject({ askerUserId: 'affiliate' });
    });

    it('keeps team replies out of owner notices until published and authorized', async () => {
        const { t, draft } = await setup();
        const escalationId = await t.mutation(internal.escalations.insertEscalation, {
            question: 'My private business question?', normalizedQuestion: 'my private business question?', workspace: 'help', askerUserId: 'owner', audiences: ['owner'], visibility: 'authenticated',
        });
        await t.mutation(internal.escalations.patchEscalation, {
            id: escalationId, status: 'learned', answer: 'UNREVIEWED PRIVATE TEAM REPLY', answeredAt: 5, learnedArticleId: draft,
        });
        const owner = t.withIdentity({ subject: 'owner' });
        const initial = await owner.query(api.ownerInbox.list, {});
        expect(initial?.items).toHaveLength(1);
        expect(initial?.items[0]).toMatchObject({ title: 'Your question is being reviewed', type: 'knowledge_answer_review' });
        expect(initial?.items[0]).not.toHaveProperty('articleSlug');
        expect(JSON.stringify(initial)).not.toContain('UNREVIEWED');
        expect(await t.mutation(internal.escalations.notifyAsker, { escalationId, askerUserId: 'owner', question: 'Private question?', answer: 'UNREVIEWED PRIVATE TEAM REPLY' })).toBe(true);
        const jobs = await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.some(job => job.name === 'ownerInbox:sendPush')).toBe(true);
        expect(JSON.stringify(jobs)).not.toContain('UNREVIEWED');

        // A published article for another role is still not an available answer.
        await t.run(ctx => ctx.db.patch(draft, { status: 'published', audiences: ['affiliate'], visibility: 'authenticated' }));
        expect((await owner.query(api.ownerInbox.list, {}))?.items[0]).not.toHaveProperty('articleSlug');
        await t.run(ctx => ctx.db.patch(draft, { audiences: ['owner'], updatedAt: 10 }));
        const published = (await owner.query(api.ownerInbox.list, {}))?.items[0];
        expect(published).toMatchObject({ title: 'Your answer is ready', type: 'knowledge_answer_ready', articleSlug: 'draft' });
        expect(published?.key).not.toBe(initial?.items[0].key);

        await t.run(ctx => ctx.db.insert('businessOwners', { clerkId: 'other-owner', email: 'other@example.test', createdAt: 1 }));
        expect((await t.withIdentity({ subject: 'other-owner' }).query(api.ownerInbox.list, {}))?.items).toEqual([]);
        await expect(t.withIdentity({ subject: 'other-owner' }).mutation(api.ownerInbox.markRead, { key: published!.key })).rejects.toThrow(/not available/);
        expect(await t.mutation(internal.escalations.notifyAsker, { escalationId, askerUserId: 'suspended', question: 'Q', answer: 'Private' })).toBe(false);
    });
});
