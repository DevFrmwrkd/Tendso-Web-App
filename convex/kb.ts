import { v } from 'convex/values';
import { internalAction, internalQuery, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import {
    articleToText,
    embedTextForSearch,
    queryTerms,
    keywordScore,
    KEYWORD_MAX_PER_TERM,
    KEYWORD_POPULAR_BONUS,
} from './knowledgeAI';
import type { Doc, Id } from './_generated/dataModel';

/**
 * Read-only search over the public knowledge base, exposed for external bots (a
 * Discord coach and an HR email responder in a separate `owner-engine` app) to
 * ground their answers. The HTTP surface lives in convex/http.ts (`POST
 * /kb/search`, gated by the `x-kb-secret` header). This file holds the search.
 *
 * KEYWORD-FIRST (mirrors convex/knowledgeAI.ts): traditional term scoring over
 * the published Help Center runs first and, at the current KB size, answers most
 * queries at zero inference cost. Gemini embeddings + the `by_embedding` vector
 * index are a fallback used ONLY when keyword finds nothing. The response's
 * `mode` says which path served the hits so callers can calibrate `score`:
 *   - 'keyword' → score is a normalized 0–1 lexical-match confidence
 *   - 'vector'  → score is the raw cosine similarity (0–1) from the vector index
 *   - 'none'    → no hits (articles empty)
 * Only the public 'help' workspace and `status === 'published'` articles are
 * ever searchable; drafts and the internal 'wiki' can never leak.
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
    mode: 'keyword' | 'vector' | 'none';
};

// Project a published Help Center article into the external response shape.
async function toSearchArticle(
    ctx: { db: { get: (id: Id<'knowledgeCategories'>) => Promise<Doc<'knowledgeCategories'> | null> } },
    article: Doc<'knowledgeArticles'>,
    score: number,
): Promise<KbSearchArticle> {
    const category = await ctx.db.get(article.categoryId);
    return {
        id: String(article._id),
        title: article.title,
        category: category?.title ?? '',
        body: articleToText(article),
        score,
    };
}

// Keyword search over the published Help Center. Loads the (small) corpus,
// scores each article with the SAME scorer the internal RAG uses, and returns
// the top-K as external articles with a normalized 0–1 score. No embedding call.
export const keywordSearch = internalQuery({
    args: { query: v.string(), topK: v.number() },
    handler: async (ctx, args): Promise<KbSearchArticle[]> => {
        const terms = queryTerms(args.query);
        if (!terms.length) return [];
        const topK = Math.min(10, Math.max(1, Math.floor(args.topK) || 5));

        const corpus = await ctx.db
            .query('knowledgeArticles')
            .withIndex('by_workspace_status', (q) => q.eq('workspace', 'help').eq('status', 'published'))
            .collect();

        const denom = KEYWORD_MAX_PER_TERM * terms.length; // normalize raw score → 0–1
        const ranked = corpus
            .map((a) => ({ a, raw: keywordScore(a, terms) }))
            // Require a GENUINE term match: strip the popularity nudge so a merely
            // `popular` article can't phantom-match a query it shares no words with
            // (that would mask true misses and starve the vector fallback).
            .filter((r) => r.raw - (r.a.popular ? KEYWORD_POPULAR_BONUS : 0) > 0)
            .sort((x, y) => y.raw - x.raw)
            .slice(0, topK);

        const out: KbSearchArticle[] = [];
        for (const { a, raw } of ranked) {
            out.push(await toSearchArticle(ctx, a, Math.min(1, raw / denom)));
        }
        return out;
    },
});

// Resolve vector-search hits (id + score) into the external response shape:
// load each article, keep only published Help Center rows, attach the category.
// Scores are carried in via a parallel array so ordering/score survive the query
// boundary (vectorSearch runs in the action, db reads run here).
export const resolveHits = internalQuery({
    args: {
        ids: v.array(v.id('knowledgeArticles')),
        scores: v.array(v.number()),
    },
    handler: async (ctx, args): Promise<KbSearchArticle[]> => {
        const scoreById = new Map<Id<'knowledgeArticles'>, number>();
        args.ids.forEach((id, i) => scoreById.set(id, args.scores[i] ?? 0));

        const out: KbSearchArticle[] = [];
        for (const id of args.ids) {
            const article: Doc<'knowledgeArticles'> | null = await ctx.db.get(id);
            // Never leak drafts or the internal 'wiki' workspace through the
            // public endpoint — only published Help Center articles.
            if (!article || article.status !== 'published' || article.workspace !== 'help') continue;
            out.push(await toSearchArticle(ctx, article, scoreById.get(id) ?? 0));
        }
        return out;
    },
});

// Search core called by the HTTP handler. Keyword-first: try term scoring over
// the published Help Center; only when it finds nothing, embed the query and run
// the 'help'-scoped vector search as a fallback. Embedding failure degrades to
// an empty result with an `error` flag rather than throwing, so callers get a
// clean 200.
export const search = internalAction({
    args: {
        query: v.string(),
        topK: v.number(),
    },
    handler: async (ctx: ActionCtx, args): Promise<KbSearchResult> => {
        const topK = Math.min(10, Math.max(1, Math.floor(args.topK) || 5));

        // 1) Keyword search first — no embedding call, zero inference cost.
        const kw: KbSearchArticle[] = await ctx.runQuery(internal.kb.keywordSearch, {
            query: args.query,
            topK,
        });
        if (kw.length) {
            return { articles: kw, maxScore: kw[0].score, error: null, mode: 'keyword' };
        }

        // 2) Vector/similarity fallback — only when keyword found nothing.
        let vector: number[];
        try {
            vector = await embedTextForSearch(ctx, args.query);
        } catch (err) {
            console.warn('[KB-SEARCH] embed failed:', (err as Error).message);
            return { articles: [], maxScore: 0, error: 'embed_failed', mode: 'none' };
        }

        const hits = await ctx.vectorSearch('knowledgeArticles', 'by_embedding', {
            vector,
            limit: topK,
            filter: (q) => q.eq('workspace', 'help'),
        });
        if (!hits.length) return { articles: [], maxScore: 0, error: null, mode: 'none' };

        const articles: KbSearchArticle[] = await ctx.runQuery(internal.kb.resolveHits, {
            ids: hits.map((h) => h._id as Id<'knowledgeArticles'>),
            scores: hits.map((h) => h._score),
        });
        // resolveHits can drop hits (drafts/wiki); if nothing survives, report none.
        if (!articles.length) return { articles: [], maxScore: 0, error: null, mode: 'none' };
        return { articles, maxScore: articles[0]?.score ?? 0, error: null, mode: 'vector' };
    },
});
