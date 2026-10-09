import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './knowledge.ts': () => import('../../convex/knowledge'),
};

const NOW = Date.UTC(2026, 9, 9, 8);
const ADMIN_ID = 'knowledge-test-admin';
const CREATOR_ID = 'knowledge-test-creator';

beforeEach(() => {
    // The embedding job remains pending; these tests never call an AI service.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

async function setup() {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
        await ctx.db.insert('creators', { clerkId: ADMIN_ID, email: 'admin@example.com', role: 'admin' });
        await ctx.db.insert('creators', { clerkId: CREATOR_ID, email: 'creator@example.com', role: 'creator' });

        const originalCategoryId = await ctx.db.insert('knowledgeCategories', {
            slug: 'wiki-questions', title: 'Questions', description: 'Original category',
            icon: 'help', hue: 'blue', workspace: 'wiki',
        });
        const selectedCategoryId = await ctx.db.insert('knowledgeCategories', {
            slug: 'wiki-payments', title: 'Payments', description: 'Selected category',
            icon: 'money', hue: 'green', workspace: 'wiki',
        });
        await ctx.db.insert('knowledgeCategories', {
            slug: 'help-payments', title: 'Customer payments', description: 'Public help category',
            icon: 'money', hue: 'green', workspace: 'help',
        });

        const articleId = await ctx.db.insert('knowledgeArticles', {
            slug: 'qa-how-do-payments-work', title: 'How do payments work?',
            summary: 'Original drafted summary.', categoryId: originalCategoryId, workspace: 'wiki',
            body: [{ t: 'p', text: 'The existing answer stays intact.' }],
            keywords: ['payments', 'owners'], author: 'Support team', readMin: 2,
            popular: true, status: 'published', source: 'qa', createdAt: NOW - 10000,
            updatedAt: NOW - 5000, helpfulYes: 12, helpfulNo: 3,
            embedding: [0.1, 0.2, 0.3], embeddingUpdatedAt: NOW - 4000,
        });
        const article = await ctx.db.get(articleId);
        if (!article) throw new Error('Missing test article');
        return { article, selectedCategoryId };
    });

    const { article } = fixture;
    const edit = {
        slug: article.slug, title: article.title, summary: 'A summary written manually by the admin.',
        categorySlug: 'wiki-payments', workspace: article.workspace, body: article.body,
        keywords: article.keywords, author: article.author, readMin: article.readMin,
        popular: article.popular, status: article.status,
    };
    return { t, ...fixture, edit };
}

async function seedOtherArticle(
    t: ReturnType<typeof convexTest<typeof schema.tables>>,
    reference: Doc<'knowledgeArticles'>,
    slug: string,
) {
    return t.run(async (ctx) => {
        const articleId = await ctx.db.insert('knowledgeArticles', {
            slug, title: 'Another question', summary: 'Another summary', categoryId: reference.categoryId,
            workspace: reference.workspace, body: [{ t: 'p', text: 'Another answer' }],
            keywords: ['another'], author: 'Another author', readMin: 1,
            status: 'published', source: 'qa', createdAt: NOW - 20000, updatedAt: NOW - 10000,
        });
        const article = await ctx.db.get(articleId);
        if (!article) throw new Error('Missing second test article');
        return article;
    });
}

describe('knowledge.upsertArticle editing', () => {
    it('saves a manually edited summary and category on an existing QA article while preserving other metadata', async () => {
        const { t, article, selectedCategoryId, edit } = await setup();
        const id = await t.withIdentity({ subject: ADMIN_ID }).mutation(api.knowledge.upsertArticle, edit);

        expect(id).toBe(article._id);
        expect(await t.run(async (ctx) => ctx.db.get(id))).toEqual({
            ...article, summary: edit.summary, categoryId: selectedCategoryId, updatedAt: NOW,
        });
        expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toHaveLength(1);
        const jobs = await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.map(({ name, args }) => ({ name, args }))).toEqual([
            { name: 'knowledgeAI:generateEmbeddingForArticle', args: [{ articleId: id }] },
        ]);
    });

    it('renames an existing QA article and replaces its keywords in place without losing metadata', async () => {
        const { t, article, selectedCategoryId, edit } = await setup();
        const renamed = { ...edit, articleId: article._id, slug: 'payment-guide-for-creators', keywords: ['getting paid', 'creator payouts'] };
        const id = await t.withIdentity({ subject: ADMIN_ID }).mutation(api.knowledge.upsertArticle, renamed);

        expect(id).toBe(article._id);
        expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toEqual([{
            ...article, slug: renamed.slug, keywords: renamed.keywords, summary: edit.summary,
            categoryId: selectedCategoryId, updatedAt: NOW,
        }]);
        const jobs = await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.map(({ name, args }) => ({ name, args }))).toEqual([
            { name: 'knowledgeAI:generateEmbeddingForArticle', args: [{ articleId: article._id }] },
        ]);
    });

    it('refuses another article\'s slug without changing either article or scheduling an embedding', async () => {
        const { t, article, edit } = await setup();
        const other = await seedOtherArticle(t, article, 'existing-other-question');

        await expect(t.withIdentity({ subject: ADMIN_ID }).mutation(api.knowledge.upsertArticle, {
            ...edit, articleId: article._id, slug: other.slug, keywords: ['should not be saved'],
        })).rejects.toThrow(/slug.*(already|use|taken)|already.*slug/i);

        expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toEqual([article, other]);
        expect(await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('refuses a missing article id instead of creating an article at the requested new slug', async () => {
        const { t, article, edit } = await setup();
        await t.run(async (ctx) => ctx.db.delete(article._id));

        await expect(t.withIdentity({ subject: ADMIN_ID }).mutation(api.knowledge.upsertArticle, {
            ...edit, articleId: article._id, slug: 'replacement-for-missing-article',
        })).rejects.toThrow(/article.*(not found|missing|does not exist|no longer exists)/i);

        expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toEqual([]);
        expect(await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it.each(['', 'Uppercase-slug', 'two words', 'under_score', 'double--hyphen', '-leading', 'trailing-', 'nested/path'])
        ('rejects invalid slug "%s" before any write', async (slug) => {
            const { t, article, edit } = await setup();
            await expect(t.withIdentity({ subject: ADMIN_ID }).mutation(api.knowledge.upsertArticle, {
                ...edit, articleId: article._id, slug,
            })).rejects.toThrow('Use lowercase letters and numbers, with hyphens between words.');

            expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toEqual([article]);
            expect(await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
        });

    it('keeps no-id callers compatible by creating once and then upserting the same slug', async () => {
        const { t, article, edit } = await setup();
        const admin = t.withIdentity({ subject: ADMIN_ID });
        const create = { ...edit, slug: 'new-question-42', keywords: ['new keyword'] };
        const id = await admin.mutation(api.knowledge.upsertArticle, create);
        const first = await t.run(async (ctx) => ctx.db.get(id));
        expect(first?.createdAt).toBe(NOW);
        vi.setSystemTime(NOW + 1000);
        const update = { ...create, summary: 'The next summary', keywords: [] };
        expect(await admin.mutation(api.knowledge.upsertArticle, update)).toBe(id);

        expect(await t.run(async (ctx) => ctx.db.get(id))).toEqual({
            ...first, summary: update.summary, keywords: [], updatedAt: NOW + 1000,
        });
        expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toHaveLength(2);
        expect(await t.run(async (ctx) => ctx.db.get(article._id))).toEqual(article);
    });

    it('allows only one competing rename to claim a new unique slug', async () => {
        const { t, article, edit } = await setup();
        const other = await seedOtherArticle(t, article, 'another-question');
        const admin = t.withIdentity({ subject: ADMIN_ID });
        // convex-test serializes transactions. This checks the uniqueness read
        // and rename happen inside one mutation; production Convex retries OCC conflicts.
        const results = await Promise.allSettled([
            admin.mutation(api.knowledge.upsertArticle, { ...edit, articleId: article._id, slug: 'claimed-slug' }),
            admin.mutation(api.knowledge.upsertArticle, { ...edit, articleId: other._id, slug: 'claimed-slug' }),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        const articles = await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect());
        expect(articles).toHaveLength(2);
        expect(articles.filter(({ slug }) => slug === 'claimed-slug')).toHaveLength(1);
        for (const original of [article, other]) {
            const saved = articles.find(({ _id }) => _id === original._id);
            expect(saved).toMatchObject({ _id: original._id, source: original.source, createdAt: original.createdAt });
            if (saved?.slug !== 'claimed-slug') expect(saved).toEqual(original);
        }
        expect(await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect())).toHaveLength(1);
    });

    it('repairs exact FAQ article links on rename while preserving unrelated FAQ fields and links', async () => {
        const { t, article, edit } = await setup();
        const before = await t.run(async (ctx) => {
            await ctx.db.insert('knowledgeFaqs', {
                workspace: 'wiki', question: 'How do creators get paid?', answer: 'Read the payment guide.',
                linkArticleSlug: article.slug, order: 1,
            });
            await ctx.db.insert('knowledgeFaqs', {
                workspace: 'help', question: 'How do I pay?', answer: 'Read the payment guide.',
                linkArticleSlug: article.slug, order: 2,
            });
            await ctx.db.insert('knowledgeFaqs', {
                workspace: 'wiki', question: 'Another question?', answer: 'Another answer.',
                linkArticleSlug: `${article.slug}-more`, order: 3,
            });
            await ctx.db.insert('knowledgeFaqs', {
                workspace: 'wiki', question: 'A question with no article?', answer: 'A standalone answer.', order: 4,
            });
            return ctx.db.query('knowledgeFaqs').collect();
        });
        const slug = 'renamed-payment-guide';
        await t.withIdentity({ subject: ADMIN_ID }).mutation(api.knowledge.upsertArticle, { ...edit, articleId: article._id, slug });

        expect(await t.run(async (ctx) => ctx.db.query('knowledgeFaqs').collect())).toEqual(before.map((faq) =>
            faq.linkArticleSlug === article.slug ? { ...faq, linkArticleSlug: slug } : faq));
    });

    it.each(['by-id', 'by-slug'])('allows metadata edits on an unchanged legacy slug (%s)', async (mode) => {
        const { t, article, selectedCategoryId, edit } = await setup();
        const slug = 'qa--legacy-suffix';
        await t.run(async (ctx) => ctx.db.patch(article._id, { slug }));
        const keywords = ['legacy article', 'manual keyword'];
        const id = await t.withIdentity({ subject: ADMIN_ID }).mutation(api.knowledge.upsertArticle, {
            ...edit, ...(mode === 'by-id' ? { articleId: article._id } : {}), slug, keywords,
        });

        expect(id).toBe(article._id);
        expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toEqual([{
            ...article, slug, summary: edit.summary, categoryId: selectedCategoryId, keywords, updatedAt: NOW,
        }]);
    });

    it('refuses a historical duplicate slug even when the edited article is the first indexed owner', async () => {
        const { t, article, edit } = await setup();
        const other = await seedOtherArticle(t, article, article.slug);
        const first = await t.run(async (ctx) => ctx.db.query('knowledgeArticles')
            .withIndex('by_slug', (q) => q.eq('slug', article.slug)).first());
        expect(first?._id).toBe(article._id);

        await expect(t.withIdentity({ subject: ADMIN_ID }).mutation(api.knowledge.upsertArticle, {
            ...edit, articleId: article._id,
        })).rejects.toThrow(/slug.*(already|use|taken)|already.*slug/i);

        expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toEqual([article, other]);
        expect(await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('rejects a category from another workspace before changing the article or scheduling an embedding', async () => {
        const { t, article, edit } = await setup();
        await expect(t.withIdentity({ subject: ADMIN_ID }).mutation(api.knowledge.upsertArticle, {
            ...edit, categorySlug: 'help-payments',
        })).rejects.toThrow('The category must belong to the selected workspace.');

        expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toEqual([article]);
        expect(await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it.each([
        ['a signed-in creator', CREATOR_ID, 'Forbidden: admin access required'],
        ['an anonymous viewer', undefined, 'Not authenticated'],
    ])('rejects edits from %s without changing the article', async (_viewer, subject, error) => {
        const { t, article, edit } = await setup();
        const caller = subject ? t.withIdentity({ subject }) : t;
        await expect(caller.mutation(api.knowledge.upsertArticle, edit)).rejects.toThrow(error);
        expect(await t.run(async (ctx) => ctx.db.query('knowledgeArticles').collect())).toEqual([article]);
        expect(await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });
});
