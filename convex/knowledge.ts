import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation, type QueryCtx, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { requireAdmin } from './lib/auth';
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

// ---- viewer / wiki access ----
async function getViewer(ctx: QueryCtx | MutationCtx): Promise<Doc<'creators'> | null> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
        .query('creators')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .first();
}

// A creator may read the internal wiki if they're an admin or a certified
// (approved) field-agent creator.
function creatorCanAccessWiki(me: Doc<'creators'> | null): boolean {
    if (!me) return false;
    return me.role === 'admin' || !!me.certifiedAt;
}

async function ensureWorkspaceReadable(
    ctx: QueryCtx | MutationCtx,
    workspace: 'help' | 'wiki',
): Promise<boolean> {
    if (workspace === 'help') return true;
    return creatorCanAccessWiki(await getViewer(ctx));
}

// ==================== QUERIES ====================

/** Whether the current viewer can read the internal field-agent wiki. */
export const canAccessWiki = query({
    args: {},
    handler: async (ctx) => {
        return creatorCanAccessWiki(await getViewer(ctx));
    },
});

/** All categories in a workspace, ordered. Wiki gated. */
export const listCategories = query({
    args: { workspace: workspaceArg },
    handler: async (ctx, args) => {
        if (!(await ensureWorkspaceReadable(ctx, args.workspace))) return [];
        const cats = await ctx.db
            .query('knowledgeCategories')
            .withIndex('by_workspace', (q) => q.eq('workspace', args.workspace))
            .collect();
        return cats.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    },
});

/**
 * All PUBLISHED articles in a workspace (full docs incl. body). Wiki gated.
 * Browse/search/related/popular are derived client-side from this set.
 */
export const listArticles = query({
    args: { workspace: workspaceArg },
    handler: async (ctx, args) => {
        if (!(await ensureWorkspaceReadable(ctx, args.workspace))) return [];
        const articles = await ctx.db
            .query('knowledgeArticles')
            .withIndex('by_workspace_status', (q) =>
                q.eq('workspace', args.workspace).eq('status', 'published'),
            )
            .collect();
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

/** FAQs in a workspace, ordered. Wiki gated. */
export const listFaqs = query({
    args: { workspace: workspaceArg },
    handler: async (ctx, args) => {
        if (!(await ensureWorkspaceReadable(ctx, args.workspace))) return [];
        const faqs = await ctx.db
            .query('knowledgeFaqs')
            .withIndex('by_workspace', (q) => q.eq('workspace', args.workspace))
            .collect();
        return faqs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
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
        if (!article) return;
        await ctx.db.patch(article._id, {
            helpfulYes: (article.helpfulYes ?? 0) + (args.helpful ? 1 : 0),
            helpfulNo: (article.helpfulNo ?? 0) + (args.helpful ? 0 : 1),
        });
    },
});

/** Admin: create or update a category (idempotent by slug). */
export const upsertCategory = mutation({
    args: {
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
            await ctx.db.patch(existing._id, args);
            return existing._id;
        }
        return await ctx.db.insert('knowledgeCategories', args);
    },
});

/** Admin: create or update an FAQ (idempotent by workspace + question). */
export const upsertFaq = mutation({
    args: {
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
            await ctx.db.patch(match._id, args);
            return match._id;
        }
        return await ctx.db.insert('knowledgeFaqs', args);
    },
});

const bodyBlockArg = v.array(v.any());

/**
 * Admin: create or update an article (idempotent by slug). Resolves the
 * category by slug and schedules an embedding regeneration so RAG stays fresh.
 */
export const upsertArticle = mutation({
    args: {
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
        const category = await ctx.db
            .query('knowledgeCategories')
            .withIndex('by_slug', (q) => q.eq('slug', args.categorySlug))
            .first();
        if (!category) throw new Error(`Unknown category slug: ${args.categorySlug}`);

        const now = Date.now();
        const existing = await ctx.db
            .query('knowledgeArticles')
            .withIndex('by_slug', (q) => q.eq('slug', args.slug))
            .first();

        const fields = {
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

// ==================== INTERNAL (used by the RAG action) ====================

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
        source: v.union(v.literal('web'), v.literal('discord'), v.literal('chatbot')),
        workspace: workspaceArg,
        query: v.string(),
        answer: v.string(),
        sourceArticleIds: v.array(v.id('knowledgeArticles')),
        userId: v.optional(v.string()),
        discordUserId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert('knowledgeQueries', { ...args, createdAt: Date.now() });
    },
});
