import { v } from 'convex/values';
import { knowledgeImageUrl, knowledgeSlugError } from '../lib/knowledgeArticle';
import { query, mutation, internalQuery, internalMutation, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { requireAdmin } from './lib/auth';
import { normalizeKnowledgeAudiences, resolveKnowledgeAccess, type KnowledgeAccess, type KnowledgeAccessRecord } from '../packages/shared/knowledge';
import { ANONYMOUS_KNOWLEDGE_VIEWER, canReadKnowledgeArticle, canReadKnowledgeContent, getKnowledgeViewer, knowledgeAccessArgs, knowledgeAudienceValidator, knowledgeVisibilityValidator, type KnowledgeViewer } from './lib/knowledgeAccess';
import type { Doc, Id } from './_generated/dataModel';

/**
 * Knowledge base — public reads, gated wiki reads, admin authoring.
 *
 * Two workspaces:
 *  - "help": public customer Help Center (no auth required)
 *  - "wiki": internal field-agent Wiki (requires a certified creator or admin)
 *
 * Browse/search is done client-side from the full published set (the corpus
 * is small and this mirrors the original design prototype exactly). The only
 * server surface is: list categories/articles/faqs, access check, feedback,
 * admin upserts, and the internal helpers the Gemini RAG action needs.
 */

const workspaceArg = v.union(v.literal('help'), v.literal('wiki'));

export const viewerContext = query({ args: {}, handler: getKnowledgeViewer });
export const viewerContextInternal = internalQuery({ args: {}, handler: getKnowledgeViewer });

function withoutEmbedding(article: Doc<'knowledgeArticles'>) {
    const { embedding: _embedding, embeddingUpdatedAt: _embeddingUpdatedAt, ...rest } = article;
    void _embedding;
    void _embeddingUpdatedAt;
    return rest;
}

async function readableArticles(ctx: QueryCtx, workspace: 'help' | 'wiki' | undefined, viewer: KnowledgeViewer, assistant = false) {
    const rows = workspace
        ? await ctx.db.query('knowledgeArticles').withIndex('by_workspace_status', q => q.eq('workspace', workspace).eq('status', 'published')).collect()
        : await ctx.db.query('knowledgeArticles').filter(q => q.eq(q.field('status'), 'published')).collect();
    const readable = await Promise.all(rows.map(async article => await canReadKnowledgeArticle(ctx, article, viewer, assistant) ? article : null));
    return readable.filter((article): article is Doc<'knowledgeArticles'> => article !== null);
}

// ==================== QUERIES ====================

/** Whether the current viewer can read the internal field-agent wiki. */
export const canAccessWiki = query({
    args: {},
    handler: async (ctx) => {
        return (await getKnowledgeViewer(ctx)).canAccessWiki;
    },
});

/** All categories in a workspace, ordered. Wiki gated. */
export const listCategories = query({
    args: { workspace: workspaceArg },
    handler: async (ctx, args) => {
        const viewer = await getKnowledgeViewer(ctx);
        const cats = await ctx.db
            .query('knowledgeCategories')
            .withIndex('by_workspace', (q) => q.eq('workspace', args.workspace))
            .collect();
        return cats.filter(category => canReadKnowledgeContent(category, viewer)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    },
});

/**
 * All PUBLISHED articles in a workspace (full docs incl. body). Wiki gated.
 * Browse/search/related/popular are derived client-side from this set.
 */
export const listArticles = query({
    args: { workspace: workspaceArg },
    handler: async (ctx, args) => {
        const articles = await readableArticles(ctx, args.workspace, await getKnowledgeViewer(ctx));
        // Never ship the embedding vector to the client (large + useless there).
        return articles
            .map((a) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { embedding, embeddingUpdatedAt, ...rest } = a;
                return rest;
            })
            .sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

/**
 * One published article by slug (for the SSR /knowledge/[slug] route).
 * Returns null for missing/draft articles, or for a gated wiki article the
 * current viewer can't read. Never ships the embedding vector.
 */
export const getArticleBySlug = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const article = await ctx.db
            .query('knowledgeArticles')
            .withIndex('by_slug', (q) => q.eq('slug', args.slug))
            .first();
        if (!article || article.status !== 'published') return null;
        if (!await canReadKnowledgeArticle(ctx, article, await getKnowledgeViewer(ctx))) return null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { embedding, embeddingUpdatedAt, ...rest } = article;
        return rest;
    },
});

/**
 * Slugs of all published HELP articles — for generateStaticParams on the SSR
 * route. Help workspace only (wiki is gated and must not be statically built).
 */
export const listPublishedHelpSlugs = query({
    args: {},
    handler: async (ctx) => {
        // Sitemaps/static params stay public even when the caller is an admin.
        const articles = await readableArticles(ctx, 'help', ANONYMOUS_KNOWLEDGE_VIEWER);
        return articles.map((a) => ({ slug: a.slug, updatedAt: a.updatedAt }));
    },
});

/** FAQs in a workspace, ordered. Wiki gated. */
export const listFaqs = query({
    args: { workspace: workspaceArg },
    handler: async (ctx, args) => {
        const viewer = await getKnowledgeViewer(ctx);
        const faqs = await ctx.db
            .query('knowledgeFaqs')
            .withIndex('by_workspace', (q) => q.eq('workspace', args.workspace))
            .collect();
        const allowed = await Promise.all(faqs.map(async faq => {
            if (!canReadKnowledgeContent(faq, viewer)) return null;
            if (faq.linkArticleSlug && !viewer.isAdmin) {
                const article = await ctx.db.query('knowledgeArticles').withIndex('by_slug', q => q.eq('slug', faq.linkArticleSlug!)).first();
                if (!article || !await canReadKnowledgeArticle(ctx, article, viewer)) return null;
            }
            return faq;
        }));
        return allowed.filter((faq): faq is Doc<'knowledgeFaqs'> => faq !== null).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    },
});

/** The actor accompanies all browse data, allowing clients to fence retained session caches. */
export const libraryForViewer = query({
    args: { workspace: workspaceArg },
    handler: async (ctx, args) => {
        const viewer = await getKnowledgeViewer(ctx);
        const [categoryRows, articleRows, faqRows] = await Promise.all([
            ctx.db.query('knowledgeCategories').withIndex('by_workspace', q => q.eq('workspace', args.workspace)).collect(),
            readableArticles(ctx, args.workspace, viewer),
            ctx.db.query('knowledgeFaqs').withIndex('by_workspace', q => q.eq('workspace', args.workspace)).collect(),
        ]);
        const faqs = await Promise.all(faqRows.map(async faq => {
            if (!canReadKnowledgeContent(faq, viewer)) return null;
            if (faq.linkArticleSlug && !viewer.isAdmin) {
                const article = await ctx.db.query('knowledgeArticles').withIndex('by_slug', q => q.eq('slug', faq.linkArticleSlug!)).first();
                if (!article || !await canReadKnowledgeArticle(ctx, article, viewer)) return null;
            }
            return faq;
        }));
        return {
            viewer,
            categories: categoryRows.filter(row => canReadKnowledgeContent(row, viewer)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
            articles: articleRows.map(withoutEmbedding).sort((a, b) => b.updatedAt - a.updatedAt),
            faqs: faqs.filter((faq): faq is Doc<'knowledgeFaqs'> => faq !== null).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
        };
    },
});

// ==================== MUTATIONS ====================

/**
 * Record article helpfulness. Public (anonymous allowed) — just bumps a
 * counter, used by the article-page feedback widget.
 */
export const recordFeedback = mutation({
    args: { slug: v.string(), helpful: v.boolean() },
    handler: async (ctx, args) => {
        const article = await ctx.db
            .query('knowledgeArticles')
            .withIndex('by_slug', (q) => q.eq('slug', args.slug))
            .first();
        if (!article || !await canReadKnowledgeArticle(ctx, article, await getKnowledgeViewer(ctx))) return;
        await ctx.db.patch(article._id, {
            helpfulYes: (article.helpfulYes ?? 0) + (args.helpful ? 1 : 0),
            helpfulNo: (article.helpfulNo ?? 0) + (args.helpful ? 0 : 1),
        });
    },
});

/** Admin: create or update a category (idempotent by slug). */
export const upsertCategory = mutation({
    args: {
        ...knowledgeAccessArgs,
        slug: v.string(),
        title: v.string(),
        description: v.string(),
        icon: v.string(),
        hue: v.string(),
        workspace: workspaceArg,
        order: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const existing = await ctx.db
            .query('knowledgeCategories')
            .withIndex('by_slug', (q) => q.eq('slug', args.slug))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, {
                ...(existing.workspace !== args.workspace ? resolveKnowledgeAccess(existing) : {}),
                ...args, ...(args.audiences ? { audiences: normalizeKnowledgeAudiences(args.audiences) } : {}),
            });
            return existing._id;
        }
        return await ctx.db.insert('knowledgeCategories', { ...args, ...(args.audiences ? { audiences: normalizeKnowledgeAudiences(args.audiences) } : {}) });
    },
});

/** Admin: create or update an FAQ (idempotent by workspace + question). */
export const upsertFaq = mutation({
    args: {
        ...knowledgeAccessArgs,
        workspace: workspaceArg,
        question: v.string(),
        answer: v.string(),
        linkArticleSlug: v.optional(v.string()),
        order: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const existing = await ctx.db
            .query('knowledgeFaqs')
            .withIndex('by_workspace', (q) => q.eq('workspace', args.workspace))
            .collect();
        const match = existing.find((f) => f.question === args.question);
        if (match) {
            await ctx.db.patch(match._id, { ...args, ...(args.audiences ? { audiences: normalizeKnowledgeAudiences(args.audiences) } : {}) });
            return match._id;
        }
        return await ctx.db.insert('knowledgeFaqs', { ...args, ...(args.audiences ? { audiences: normalizeKnowledgeAudiences(args.audiences) } : {}) });
    },
});

const bodyBlockArg = v.array(v.any());

/**
 * Admin: create or update an article (idempotent by slug, or by an explicit
 * article id when renaming). Resolves the
 * category by slug and schedules an embedding regeneration so RAG stays fresh.
 */
export const upsertArticle = mutation({
    args: {
        ...knowledgeAccessArgs,
        articleId: v.optional(v.id('knowledgeArticles')),
        slug: v.string(),
        title: v.string(),
        summary: v.string(),
        categorySlug: v.string(),
        workspace: workspaceArg,
        body: bodyBlockArg,
        keywords: v.array(v.string()),
        author: v.string(),
        readMin: v.number(),
        popular: v.optional(v.boolean()),
        status: v.optional(v.union(v.literal('draft'), v.literal('published'))),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        for (const block of args.body) {
            if (block?.t === 'image' && block.url !== undefined && !knowledgeImageUrl(block.url)) {
                throw new Error('Article photos must use a valid HTTPS image URL.');
            }
        }
        const category = await ctx.db
            .query('knowledgeCategories')
            .withIndex('by_slug', (q) => q.eq('slug', args.categorySlug))
            .first();
        if (!category) throw new Error(`Unknown category slug: ${args.categorySlug}`);
        if (category.workspace !== args.workspace) {
            throw new Error('The category must belong to the selected workspace.');
        }

        const now = Date.now();
        const slugOwners = await ctx.db
            .query('knowledgeArticles')
            .withIndex('by_slug', (q) => q.eq('slug', args.slug))
            .collect();
        const existing = args.articleId ? await ctx.db.get(args.articleId) : slugOwners[0];
        if (args.articleId && !existing) {
            throw new Error('This article no longer exists. Reload the page before saving.');
        }
        if (args.articleId && slugOwners.some((owner) => owner._id !== args.articleId)) {
            throw new Error('That slug is already used by another article.');
        }
        // Existing legacy slugs remain editable without forcing a rename.
        if (!existing || existing.slug !== args.slug) {
            const slugError = knowledgeSlugError(args.slug);
            if (slugError) throw new Error(slugError);
        }

        const fields = {
            // Moving a legacy internal article to Help must not make it public.
            ...(existing && existing.workspace !== args.workspace ? resolveKnowledgeAccess(existing) : {}),
            ...(args.audiences ? { audiences: normalizeKnowledgeAudiences(args.audiences) } : {}),
            ...(args.visibility ? { visibility: args.visibility } : {}),
            slug: args.slug,
            title: args.title,
            summary: args.summary,
            categoryId: category._id,
            workspace: args.workspace,
            body: args.body,
            keywords: args.keywords,
            author: args.author,
            readMin: args.readMin,
            // Write an explicit boolean — Convex patch ignores `undefined`, so
            // omitting it would never clear a previously-set popular flag.
            popular: args.popular ?? false,
            status: args.status ?? ('published' as const),
            updatedAt: now,
        };

        let id: Id<'knowledgeArticles'>;
        if (existing) {
            await ctx.db.patch(existing._id, fields);
            id = existing._id;
            if (existing.slug !== args.slug) {
                const faqs = await ctx.db.query('knowledgeFaqs').collect();
                for (const faq of faqs) {
                    if (faq.linkArticleSlug === existing.slug) {
                        await ctx.db.patch(faq._id, { linkArticleSlug: args.slug });
                    }
                }
            }
        } else {
            id = await ctx.db.insert('knowledgeArticles', { ...fields, createdAt: now });
        }
        // Regenerate the embedding off the write path.
        await ctx.scheduler.runAfter(0, internal.knowledgeAI.generateEmbeddingForArticle, {
            articleId: id,
        });
        return id;
    },
});

/** Viewer context travels with the article so native caches can fence session switches. */
export const articleForViewer = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const viewer = await getKnowledgeViewer(ctx);
        const article = await ctx.db.query('knowledgeArticles').withIndex('by_slug', q => q.eq('slug', args.slug)).first();
        return { viewer, article: article && await canReadKnowledgeArticle(ctx, article, viewer) ? withoutEmbedding(article) : null };
    },
});

/** Admin library includes drafts and every scope; embeddings never leave the server. */
export const listAdminArticles = query({
    args: { workspace: v.optional(workspaceArg) },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const rows = await ctx.db.query('knowledgeArticles').collect();
        return rows.filter(row => !args.workspace || row.workspace === args.workspace).map(withoutEmbedding).sort((a, b) => b.updatedAt - a.updatedAt);
    },
});
export const getAdminArticle = query({
    args: { articleId: v.id('knowledgeArticles') },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const article = await ctx.db.get(args.articleId);
        return article ? withoutEmbedding(article) : null;
    },
});

/** Change access only; preserve typed blocks and the complete editorial content. */
export const setKnowledgeAccess = mutation({
    args: {
        kind: v.union(v.literal('article'), v.literal('category'), v.literal('faq')),
        id: v.union(v.id('knowledgeArticles'), v.id('knowledgeCategories'), v.id('knowledgeFaqs')),
        audiences: v.array(knowledgeAudienceValidator), visibility: knowledgeVisibilityValidator,
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const table = args.kind === 'article' ? 'knowledgeArticles' : args.kind === 'category' ? 'knowledgeCategories' : 'knowledgeFaqs';
        const id = ctx.db.normalizeId(table, args.id);
        if (!id || !await ctx.db.get(id)) throw new Error('Knowledge item not found.');
        await ctx.db.patch(id, { audiences: normalizeKnowledgeAudiences(args.audiences), visibility: args.visibility });
    },
});

/** Action identity propagates; neither workspace nor a client role grants access. */
export const listForAssistantInternal = internalQuery({
    args: { workspace: v.optional(workspaceArg) },
    handler: async (ctx, args) => readableArticles(ctx, args.workspace, await getKnowledgeViewer(ctx), true),
});

/** Trusted draft context; a supplied job ID must already have been claimed. */
export const trainingContextInternal = internalQuery({
    args: { jobId: v.id('knowledgeTrainingJobs') },
    handler: async (ctx, { jobId }) => {
        const job = await ctx.db.get(jobId);
        if (!job || job.status !== 'processing') throw new Error('A processing training job is required.');
        const scope = resolveKnowledgeAccess({ workspace: job.workspace, audiences: job.audiences ?? ['admin'], visibility: job.visibility ?? 'internal' });
        return { ...scope, workspace: job.workspace };
    },
});

/** Only a claimed, admin-enqueued job can request a wider training corpus. */
export const listForTrainingInternal = internalQuery({
    args: { jobId: v.id('knowledgeTrainingJobs') },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job || job.status !== 'processing') return [];
        const scope: KnowledgeAccess = { audiences: job.audiences ?? ['admin'], visibility: job.visibility ?? 'internal' };
        const ranks = { public: 0, authenticated: 1, internal: 2 };
        const permittedScope = (record: KnowledgeAccessRecord) => ranks[resolveKnowledgeAccess(record).visibility] <= ranks[scope.visibility];
        const viewers: KnowledgeViewer[] = scope.audiences.map(audience => ({
            ...ANONYMOUS_KNOWLEDGE_VIEWER, audience,
            authenticated: scope.visibility !== 'public',
            isAdmin: scope.visibility !== 'public' && audience === 'admin',
            canAccessWiki: scope.visibility === 'internal' && (audience === 'field_agent' || audience === 'admin'),
        }));
        const articles = await ctx.db.query('knowledgeArticles').withIndex('by_workspace_status', q => q.eq('workspace', job.workspace).eq('status', 'published')).collect();
        const allowed = await Promise.all(articles.map(async article => {
            const category = await ctx.db.get(article.categoryId);
            if (!category || !permittedScope(article) || !permittedScope(category)) return null;
            // Every intended audience must be allowed to see each source. A public
            // draft can never accidentally summarize an internal/admin answer.
            for (const viewer of viewers) if (!await canReadKnowledgeArticle(ctx, article, viewer, true)) return null;
            return article;
        }));
        return allowed.filter((article): article is Doc<'knowledgeArticles'> => article !== null);
    },
});

// ==================== INTERNAL (maintenance only, never user retrieval) ====================

/** Read-only inventory for an explicit deployment audit; no bodies, answers or embeddings. */
export const accessAuditInternal = internalQuery({
    args: {},
    handler: async ctx => {
        const [articles, categories, faqs] = await Promise.all([
            ctx.db.query('knowledgeArticles').collect(), ctx.db.query('knowledgeCategories').collect(), ctx.db.query('knowledgeFaqs').collect(),
        ]);
        return {
            articles: articles.map(({ _id, slug, title, categoryId, workspace, audiences, visibility, status, source }) => ({ _id, slug, title, categoryId, workspace, audiences, visibility, status, source })),
            categories: categories.map(({ _id, slug, title, workspace, audiences, visibility }) => ({ _id, slug, title, workspace, audiences, visibility })),
            faqs: faqs.map(({ _id, question, workspace, audiences, visibility }) => ({ _id, question, workspace, audiences, visibility })),
        };
    },
});

/** Load article docs by id, preserving order, dropping missing ones. */
export const getArticlesByIds = internalQuery({
    args: { ids: v.array(v.id('knowledgeArticles')) },
    handler: async (ctx, args) => {
        const docs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
        return docs.filter((d): d is Doc<'knowledgeArticles'> => d !== null);
    },
});

/** Published articles, optionally filtered by workspace (RAG keyword fallback + embedding backfill). */
export const listPublishedInternal = internalQuery({
    args: { workspace: v.optional(workspaceArg) },
    handler: async (ctx, args) => {
        if (args.workspace) {
            return await ctx.db
                .query('knowledgeArticles')
                .withIndex('by_workspace_status', (q) =>
                    q.eq('workspace', args.workspace!).eq('status', 'published'),
                )
                .collect();
        }
        return await ctx.db
            .query('knowledgeArticles')
            .filter((q) => q.eq(q.field('status'), 'published'))
            .collect();
    },
});

/** Persist a freshly-computed embedding onto an article. */
export const patchEmbedding = internalMutation({
    args: { articleId: v.id('knowledgeArticles'), embedding: v.array(v.float64()) },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.articleId, {
            embedding: args.embedding,
            embeddingUpdatedAt: Date.now(),
        });
    },
});

/**
 * Fixed-window rate limiter on the shared `rateLimits` table. Returns whether
 * the call is allowed. Used to cap AI `ask` volume per user / Discord user.
 */
export const consumeRateLimit = internalMutation({
    args: { key: v.string(), limit: v.number(), windowMs: v.number() },
    handler: async (ctx, args) => {
        const now = Date.now();
        const row = await ctx.db
            .query('rateLimits')
            .withIndex('by_key', (q) => q.eq('key', args.key))
            .first();
        if (!row || now - row.windowStart > args.windowMs) {
            if (row) await ctx.db.patch(row._id, { count: 1, windowStart: now });
            else await ctx.db.insert('rateLimits', { key: args.key, count: 1, windowStart: now });
            return { allowed: true };
        }
        if (row.count >= args.limit) return { allowed: false };
        await ctx.db.patch(row._id, { count: row.count + 1 });
        return { allowed: true };
    },
});

/** Append a row to the AI query log (called by the RAG action). */
export const logQuery = internalMutation({
    args: {
        ...knowledgeAccessArgs,
        source: v.union(v.literal('web'), v.literal('discord'), v.literal('chatbot')),
        workspace: workspaceArg,
        query: v.string(),
        answer: v.string(),
        sourceArticleIds: v.array(v.id('knowledgeArticles')),
        userId: v.optional(v.string()),
        discordUserId: v.optional(v.string()),
        grounded: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert('knowledgeQueries', { ...args, createdAt: Date.now() });
    },
});
