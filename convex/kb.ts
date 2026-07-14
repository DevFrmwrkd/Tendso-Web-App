import { v } from 'convex/values';
import { internalAction, internalQuery, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import { articleToText, embedTextForSearch } from './knowledgeAI';
import type { Doc, Id } from './_generated/dataModel';

/**
 * Read-only semantic search over the public knowledge base, exposed for external
 * bots (a Discord coach and an HR email responder in a separate `owner-engine`
 * app) to ground their answers. The HTTP surface lives in convex/http.ts
 * (`POST /kb/search`, gated by the `x-kb-secret` header). This file holds the
 * search itself.
 *
 * Purely additive: no schema, table, or existing-function changes. Retrieval
 * reuses the SAME Gemini embed model / dimensions / normalization and the SAME
 * `by_embedding` vector index as convex/knowledgeAI.ts, so query and stored
 * vectors are comparable — mismatched models would return garbage. Only the
 * public 'help' workspace and `status === 'published'` articles are searchable.
 */

export type KbSearchArticle = {
    id: string;
    title: string;
    category: string;
    body: string;
    score: number;
};

export type KbSearchResult = {
    articles: KbSearchArticle[];
    maxScore: number;
    error: string | null;
};

// Resolve vector-search hits (id + score) into the external response shape:
// load each article, keep only published, attach its human-readable category.
// Scores are carried in via a parallel array so ordering/score survive the
// query boundary (vectorSearch runs in the action, db reads run here).
export const resolveHits = internalQuery({
    args: {
        ids: v.array(v.id('knowledgeArticles')),
        scores: v.array(v.number()),
    },
    handler: async (ctx, args) => {
        const scoreById = new Map<Id<'knowledgeArticles'>, number>();
        args.ids.forEach((id, i) => scoreById.set(id, args.scores[i] ?? 0));

        const out: KbSearchArticle[] = [];
        for (const id of args.ids) {
            const article: Doc<'knowledgeArticles'> | null = await ctx.db.get(id);
            // Never leak drafts or the internal 'wiki' workspace through the
            // public endpoint — only published Help Center articles.
            if (!article || article.status !== 'published' || article.workspace !== 'help') continue;

            const category = await ctx.db.get(article.categoryId);
            out.push({
                id: String(article._id),
                title: article.title,
                category: category?.title ?? '',
                body: articleToText(article),
                score: scoreById.get(id) ?? 0,
            });
        }
        return out;
    },
});

// Internal search core called by the HTTP handler. Embeds the query with the
// shared helper, runs the 'help'-scoped vector search, resolves hits, and
// returns the external shape. Embedding failure degrades to an empty result
// with an `error` flag rather than throwing, so callers get a clean 200.
export const semanticSearch = internalAction({
    args: {
        query: v.string(),
        topK: v.number(),
    },
    handler: async (ctx: ActionCtx, args): Promise<KbSearchResult> => {
        const topK = Math.min(10, Math.max(1, Math.floor(args.topK) || 5));

        let vector: number[];
        try {
            vector = await embedTextForSearch(ctx, args.query);
        } catch (err) {
            console.warn('[KB-SEARCH] embed failed:', (err as Error).message);
            return { articles: [], maxScore: 0, error: 'embed_failed' };
        }

        const hits = await ctx.vectorSearch('knowledgeArticles', 'by_embedding', {
            vector,
            limit: topK,
            filter: (q) => q.eq('workspace', 'help'),
        });
        if (!hits.length) return { articles: [], maxScore: 0, error: null };

        const articles: KbSearchArticle[] = await ctx.runQuery(internal.kb.resolveHits, {
            ids: hits.map((h) => h._id as Id<'knowledgeArticles'>),
            scores: hits.map((h) => h._score),
        });
        // resolveHits preserves vector-search order, so [0] is the top hit.
        return { articles, maxScore: articles[0]?.score ?? 0, error: null };
    },
});
