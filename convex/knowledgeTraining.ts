import { v } from 'convex/values';
import { action, query, mutation, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { requireAdmin } from './lib/auth';
import type { Id } from './_generated/dataModel';

/**
 * Admin "Train the AI" — paste QUESTIONS, the AI writes the answers, both get
 * embedded into the knowledge base so the /knowledge chatbot AND Discord /ask
 * can answer them. See docs/changes/ADMIN-KB-TRAINING-PLAN.md.
 *
 * The flow per question:
 *   1. Run the existing RAG (knowledgeAI.answerQuery) to DRAFT a grounded answer
 *      from the current knowledge base.
 *   2. Persist the Q&A as a published `knowledgeArticles` row (source:'qa') and
 *      schedule its embedding — so the RAG retrieves it next time.
 *   3. Report which questions the AI could NOT ground, so the admin can give
 *      those a real answer (a future edit pass) rather than shipping a weak one.
 *
 * Why reuse articles+embeddings: runRag only vector-searches `knowledgeArticles`.
 * Making each Q&A an embedded article means "training" needs ZERO change to the
 * retrieval path — the AI's own knowledge source simply grows.
 */

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);
}

// ---- internal: persist one AI-answered Q&A as an embedded article ----
export const saveTrainedQA = internalMutation({
    args: {
        question: v.string(),
        answer: v.string(),
        workspace: v.union(v.literal('help'), v.literal('wiki')),
        categorySlug: v.optional(v.string()),
        grounded: v.boolean(),
    },
    handler: async (ctx, args): Promise<Id<'knowledgeArticles'>> => {
        // Resolve category: the requested one, else the first in the workspace.
        let category = args.categorySlug
            ? await ctx.db
                  .query('knowledgeCategories')
                  .withIndex('by_slug', (q) => q.eq('slug', args.categorySlug!))
                  .first()
            : null;
        if (!category) {
            category = await ctx.db
                .query('knowledgeCategories')
                .withIndex('by_workspace', (q) => q.eq('workspace', args.workspace))
                .first();
        }
        if (!category) throw new Error('No knowledge category exists yet — seed the KB first.');

        const now = Date.now();
        // Unique slug (append a short time suffix to avoid collisions on similar Qs).
        const slug = `qa-${slugify(args.question)}-${now.toString(36).slice(-4)}`;

        // Body is the typed-block array the schema uses: the answer as one paragraph.
        const body = [{ t: 'p' as const, text: args.answer }];

        const id = await ctx.db.insert('knowledgeArticles', {
            slug,
            title: args.question,
            summary: args.answer.slice(0, 300),
            categoryId: category._id,
            workspace: args.workspace,
            body,
            keywords: [],
            author: 'admin (trained)',
            readMin: 1,
            popular: false,
            status: 'published',
            source: 'qa',
            // Only grounded answers reach this mutation (trainFromQuestions filters
            // ungrounded ones out), so it's safe to publish + embed directly.
            createdAt: now,
            updatedAt: now,
        });

        // Embed it (off the write path) so the RAG can retrieve it.
        await ctx.scheduler.runAfter(0, internal.knowledgeAI.generateEmbeddingForArticle, {
            articleId: id,
        });
        return id;
    },
});

/**
 * The page's main action: take pasted questions, let the AI answer each, save +
 * embed. Returns a per-question result so the UI can show answered/needs-review.
 */
export const trainFromQuestions = action({
    args: {
        questions: v.array(v.string()),
        workspace: v.union(v.literal('help'), v.literal('wiki')),
        categorySlug: v.optional(v.string()),
    },
    handler: async (
        ctx,
        args,
    ): Promise<Array<{ question: string; answer: string; grounded: boolean }>> => {
        await requireAdmin(ctx);

        const cleaned = args.questions
            .map((q) => q.trim())
            .filter((q) => q.length > 0)
            .slice(0, 50); // sane cap per batch

        const results: Array<{ question: string; answer: string; grounded: boolean }> = [];
        for (const question of cleaned) {
            // Draft a grounded answer from the CURRENT knowledge base.
            const rag = await ctx.runAction(internal.knowledgeAI.answerQuery, {
                query: question,
                workspace: args.workspace,
                source: 'web',
            });
            // Only save + embed answers the AI could GROUND in existing knowledge.
            // An ungrounded answer is a generic/hallucinated fallback — embedding it
            // would poison the KB (the RAG would then "retrieve" its own bad guess on
            // the next ask). We still return it with grounded:false so the admin sees
            // the gap and can author a real article, but it never enters retrieval.
            if (rag.grounded) {
                await ctx.runMutation(internal.knowledgeTraining.saveTrainedQA, {
                    question,
                    answer: rag.answer,
                    workspace: args.workspace,
                    categorySlug: args.categorySlug,
                    grounded: true,
                });
            }
            results.push({ question, answer: rag.answer, grounded: rag.grounded });
        }
        return results;
    },
});

// ---- admin: list / delete trained Q&A ----

export const listTrainingQA = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const all = await ctx.db.query('knowledgeArticles').collect();
        return all
            .filter((a) => a.source === 'qa')
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((a) => ({
                _id: a._id,
                question: a.title,
                answer: a.summary,
                workspace: a.workspace,
                embedded: !!a.embedding && a.embedding.length > 0,
                updatedAt: a.updatedAt,
            }));
    },
});

export const deleteTrainingQA = mutation({
    args: { id: v.id('knowledgeArticles') },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const row = await ctx.db.get(args.id);
        if (row && row.source === 'qa') await ctx.db.delete(args.id);
        return { ok: true };
    },
});

/**
 * Admin: delete ALL trained Q&A rows in one shot. Used to wipe a poisoned batch
 * (e.g. answers saved while the Gemini key was dead and every answer was an
 * ungrounded fallback). Only touches source:'qa' rows — hand-authored articles
 * are never affected. Returns the count removed.
 */
export const purgeAllTrainedQA = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const all = await ctx.db.query('knowledgeArticles').collect();
        const qa = all.filter((a) => a.source === 'qa');
        for (const a of qa) await ctx.db.delete(a._id);
        return { removed: qa.length };
    },
});

/**
 * Recent questions the AI could NOT ground — the content-gap feed. The admin
 * turns these into trained Q&A (one click pre-fills the paste box).
 */
export const listUnansweredQueries = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const recent = await ctx.db
            .query('knowledgeQueries')
            .withIndex('by_createdAt')
            .order('desc')
            .take(100);
        return recent
            .filter((q) => q.grounded === false)
            .slice(0, 30)
            .map((q) => ({ query: q.query, source: q.source, createdAt: q.createdAt }));
    },
});
