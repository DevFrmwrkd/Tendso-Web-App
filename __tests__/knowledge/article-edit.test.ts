import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
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
