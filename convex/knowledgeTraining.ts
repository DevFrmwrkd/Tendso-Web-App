import { v } from 'convex/values';
import { action, query, mutation, internalMutation, internalAction } from './_generated/server';
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

// ============================================================================
// QUEUED TRAINING (fixes "Connection lost while action was in flight")
//
// The old trainFromQuestions loops over every question inside ONE client-called
// action — a big batch (RAG + embed per question) runs longer than the client
// websocket keeps the call in flight, so the client drops it. Instead:
//   1. enqueueTraining (fast mutation) writes one job row per question + kicks
//      off the processor, then returns immediately — no long client wait.
//   2. processNextTrainingJob (internalAction) processes ONE job server-side and
//      schedules the next. Fully server-driven; nothing to time out.
// The page watches listTrainingJobs / listTrainingQA reactively for progress.
// ============================================================================

// ---- Cost guardrails (protect Convex + Gemini billing) ----
const MAX_PER_PASTE = 25;        // per single paste
const MAX_QUEUE_BACKLOG = 60;    // refuse if the queue is already this deep
const MAX_PER_DAY = 100;         // hard daily ceiling on questions processed
const JOB_INTERVAL_MS = 3000;    // throttle: ~1 question every 3s (not a burst)

export const enqueueTraining = mutation({
    args: {
        questions: v.array(v.string()),
        workspace: v.union(v.literal('help'), v.literal('wiki')),
        categorySlug: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ batchId: string; count: number; skipped: number; note?: string }> => {
        await requireAdmin(ctx);

        let cleaned = args.questions
            .map((q) => q.trim())
            .filter((q) => q.length > 0)
            .slice(0, MAX_PER_PASTE);
        if (cleaned.length === 0) return { batchId: '', count: 0, skipped: 0 };

        // GUARD 1: backlog ceiling — don't let queued work pile up unbounded.
        const backlog = (
            await ctx.db
                .query('knowledgeTrainingJobs')
                .withIndex('by_status', (q) => q.eq('status', 'queued'))
                .collect()
        ).length;
        if (backlog >= MAX_QUEUE_BACKLOG) {
            return { batchId: '', count: 0, skipped: cleaned.length, note: `Queue is full (${backlog}). Wait for it to drain before adding more.` };
        }

        // GUARD 2: dedup — skip questions already trained (avoid paying to re-embed
        // the same Q&A). Match on the exact question title of existing qa articles.
        const existingQa = (await ctx.db.query('knowledgeArticles').collect())
            .filter((a) => a.source === 'qa')
            .map((a) => a.title.trim().toLowerCase());
        const existingSet = new Set(existingQa);
        // Also dedup within/against the current queue.
        const queuedTitles = new Set(
            (await ctx.db.query('knowledgeTrainingJobs').withIndex('by_status', (q) => q.eq('status', 'queued')).collect())
                .map((j) => j.question.trim().toLowerCase()),
        );
        const before = cleaned.length;
        cleaned = cleaned.filter((q) => {
            const key = q.toLowerCase();
            if (existingSet.has(key) || queuedTitles.has(key)) return false;
            queuedTitles.add(key);
            return true;
        });
        let skipped = before - cleaned.length;

        // GUARD 3: daily cap — reuse the shared fixed-window rate limiter. Only
        // enqueue up to whatever remains of today's budget.
        const room = Math.min(cleaned.length, MAX_QUEUE_BACKLOG - backlog);
        const allowedToday: string[] = [];
        for (const q of cleaned.slice(0, room)) {
            const { allowed } = await ctx.runMutation(internal.knowledge.consumeRateLimit, {
                key: 'kb-training-daily',
                limit: MAX_PER_DAY,
                windowMs: 24 * 60 * 60 * 1000,
            });
            if (allowed) allowedToday.push(q);
            else break; // daily budget exhausted
        }
        skipped += cleaned.length - allowedToday.length;

        if (allowedToday.length === 0) {
            return { batchId: '', count: 0, skipped, note: `Daily training limit (${MAX_PER_DAY}/day) reached, or all duplicates.` };
        }

        const now = Date.now();
        const batchId = `batch_${now.toString(36)}_${allowedToday.length}`;
        for (const question of allowedToday) {
            await ctx.db.insert('knowledgeTrainingJobs', {
                question,
                workspace: args.workspace,
                categorySlug: args.categorySlug,
                status: 'queued',
                batchId,
                createdAt: now,
                updatedAt: now,
            });
        }

        // Kick the worker. It self-chains (throttled) through the queue.
        await ctx.scheduler.runAfter(0, internal.knowledgeTraining.processNextTrainingJob, {});
        return { batchId, count: allowedToday.length, skipped };
    },
});

/**
 * Train from authoritative Q&A PAIRS the admin provides directly, e.g.
 *   "How much does a website cost? 999, with a custom domain add-on."
 * Splits each line on the first '?' into question + answer and saves the answer
 * VERBATIM (no RAG, no Gemini answer-generation) — so admin-provided facts are
 * used exactly, and it doesn't touch the daily RAG budget. Still embeds each so
 * the chatbot can retrieve it. Dedups against existing trained Q&A.
 */
export const trainQAPairs = mutation({
    args: {
        text: v.string(),
        workspace: v.union(v.literal('help'), v.literal('wiki')),
        categorySlug: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ saved: number; skipped: number }> => {
        await requireAdmin(ctx);

        // Parse "Question? Answer" per line (split on the FIRST '?').
        const pairs: { question: string; answer: string }[] = [];
        for (const line of args.text.split('\n')) {
            const t = line.trim();
            if (!t) continue;
            const qi = t.indexOf('?');
            if (qi === -1) continue; // no question mark → skip (can't split)
            const question = t.slice(0, qi + 1).trim();
            const answer = t.slice(qi + 1).trim();
            if (question.length > 3 && answer.length > 1) pairs.push({ question, answer });
        }
        if (pairs.length === 0) return { saved: 0, skipped: 0 };

        // Dedup against existing trained Q&A titles.
        const existing = new Set(
            (await ctx.db.query('knowledgeArticles').collect())
                .filter((a) => a.source === 'qa')
                .map((a) => a.title.trim().toLowerCase()),
        );

        // Resolve category once (requested, else first in workspace).
        let category = args.categorySlug
            ? await ctx.db.query('knowledgeCategories').withIndex('by_slug', (q) => q.eq('slug', args.categorySlug!)).first()
            : null;
        if (!category) {
            category = await ctx.db.query('knowledgeCategories').withIndex('by_workspace', (q) => q.eq('workspace', args.workspace)).first();
        }
        if (!category) throw new Error('No knowledge category exists yet — seed the KB first.');

        let saved = 0;
        let skipped = 0;
        for (const p of pairs.slice(0, MAX_PER_PASTE)) {
            if (existing.has(p.question.toLowerCase())) { skipped++; continue; }
            existing.add(p.question.toLowerCase());
            const now = Date.now();
            const slug = `qa-${slugify(p.question)}-${now.toString(36).slice(-4)}`;
            const id = await ctx.db.insert('knowledgeArticles', {
                slug,
                title: p.question,
                summary: p.answer.slice(0, 300),
                categoryId: category._id,
                workspace: args.workspace,
                body: [{ t: 'p' as const, text: p.answer }],
                keywords: [],
                author: 'admin (Q&A)',
                readMin: 1,
                popular: false,
                status: 'published',
                source: 'qa',
                createdAt: now,
                updatedAt: now,
            });
            // Embed off the write path so the chatbot can retrieve it.
            await ctx.scheduler.runAfter(0, internal.knowledgeAI.generateEmbeddingForArticle, { articleId: id });
            saved++;
        }
        return { saved, skipped };
    },
});

// Admin: reset the daily training rate-limit window (e.g. after a batch of
// authoritative Q&A that shouldn't have counted against the RAG budget).
export const resetTrainingDailyLimit = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const rows = (await ctx.db.query('rateLimits').collect())
            .filter((r) => r.key === 'kb-training-daily');
        for (const r of rows) await ctx.db.delete(r._id);
        return { reset: rows.length };
    },
});

// Internal variant (no auth) so it can be run from the CLI / dashboard for ops.
export const resetTrainingDailyLimitInternal = internalMutation({
    args: {},
    handler: async (ctx) => {
        const rows = (await ctx.db.query('rateLimits').collect()).filter((r) => r.key === 'kb-training-daily');
        for (const r of rows) await ctx.db.delete(r._id);
        return { reset: rows.length };
    },
});

// Re-run learning (embeddings) for any trained Q&A that hasn't finished learning
// yet. The embedding is what lets the chatbot FIND an answer; it's generated in a
// background job that can occasionally fail (e.g. the AI key was briefly busy).
// This retries those so a stuck "Learning…" item finishes.
export const reEmbedPendingQA = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const qa = (await ctx.db.query('knowledgeArticles').collect())
            .filter((a) => a.source === 'qa' && (!a.embedding || a.embedding.length === 0));
        for (const a of qa) {
            await ctx.scheduler.runAfter(0, internal.knowledgeAI.generateEmbeddingForArticle, { articleId: a._id });
        }
        return { retried: qa.length };
    },
});

// Clear the "Questions the AI couldn't answer" feed (ungrounded knowledgeQueries).
// These are logged every time a chatbot/ask attempt can't be grounded; clearing
// removes the current gap list (it repopulates as new unanswered asks come in).
export const clearUnansweredQueries = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const rows = (await ctx.db.query('knowledgeQueries').collect())
            .filter((q) => q.grounded === false);
        for (const r of rows) await ctx.db.delete(r._id);
        return { removed: rows.length };
    },
});

// No-auth variant for CLI/ops.
export const clearUnansweredQueriesInternal = internalMutation({
    args: {},
    handler: async (ctx) => {
        const rows = (await ctx.db.query('knowledgeQueries').collect())
            .filter((q) => q.grounded === false);
        for (const r of rows) await ctx.db.delete(r._id);
        return { removed: rows.length };
    },
});

// Delete trained Q&A rows whose answer is an ungrounded fallback ("I don't have
// information in the knowledge base…") — these were saved before the guard and
// poison retrieval. Matches the tell-tale phrasings in the summary/body.
const UNGROUNDED_MARKERS = [
    "i don't have information",
    'i do not have information',
    "i couldn't find",
    'no information in the knowledge',
    'please contact tendso support',
    'ask in discord',
    'ask in the discord',
];

function looksUngrounded(text: string): boolean {
    const t = (text || '').toLowerCase();
    return UNGROUNDED_MARKERS.some((m) => t.includes(m));
}

export const purgeUngroundedQA = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const qa = (await ctx.db.query('knowledgeArticles').collect()).filter((a) => a.source === 'qa');
        let removed = 0;
        for (const a of qa) {
            const bodyText = Array.isArray(a.body)
                ? a.body.map((b: any) => ('text' in b ? b.text : '')).join(' ')
                : '';
            if (looksUngrounded(a.summary || '') || looksUngrounded(bodyText)) {
                await ctx.db.delete(a._id);
                removed += 1;
            }
        }
        return { removed, total: qa.length };
    },
});

// No-auth variant for CLI/ops.
export const purgeUngroundedQAInternal = internalMutation({
    args: {},
    handler: async (ctx) => {
        const qa = (await ctx.db.query('knowledgeArticles').collect()).filter((a) => a.source === 'qa');
        let removed = 0;
        for (const a of qa) {
            const bodyText = Array.isArray(a.body)
                ? a.body.map((b: any) => ('text' in b ? b.text : '')).join(' ')
                : '';
            if (looksUngrounded(a.summary || '') || looksUngrounded(bodyText)) {
                await ctx.db.delete(a._id);
                removed += 1;
            }
        }
        return { removed, total: qa.length };
    },
});

// Claim the oldest queued job (mark processing). SINGLE-WORKER guard: if a job is
// already 'processing', refuse — this stops two self-chains (from two pastes) from
// running Gemini calls concurrently and doubling burn. Mutations are transactional,
// so this claim is atomic.
export const claimNextTrainingJob = internalMutation({
    args: {},
    handler: async (ctx): Promise<{ jobId: Id<'knowledgeTrainingJobs'>; question: string; workspace: 'help' | 'wiki'; categorySlug?: string } | null> => {
        const inFlight = await ctx.db
            .query('knowledgeTrainingJobs')
            .withIndex('by_status', (q) => q.eq('status', 'processing'))
            .first();
        if (inFlight) return null; // another worker is active; don't run in parallel

        const job = await ctx.db
            .query('knowledgeTrainingJobs')
            .withIndex('by_status', (q) => q.eq('status', 'queued'))
            .first();
        if (!job) return null;
        await ctx.db.patch(job._id, { status: 'processing', updatedAt: Date.now() });
        return {
            jobId: job._id,
            question: job.question,
            workspace: job.workspace,
            categorySlug: job.categorySlug,
        };
    },
});

export const finishTrainingJob = internalMutation({
    args: {
        jobId: v.id('knowledgeTrainingJobs'),
        status: v.string(),
        grounded: v.optional(v.boolean()),
        answer: v.optional(v.string()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, {
            status: args.status,
            grounded: args.grounded,
            answer: args.answer,
            error: args.error,
            updatedAt: Date.now(),
        });
    },
});

// Process ONE queued job, then schedule itself again for the next. Runs entirely
// server-side (scheduler), so no client connection can time out.
export const processNextTrainingJob = internalAction({
    args: {},
    handler: async (ctx): Promise<void> => {
        const job = await ctx.runMutation(internal.knowledgeTraining.claimNextTrainingJob, {});
        if (!job) return; // queue drained

        try {
            const rag = await ctx.runAction(internal.knowledgeAI.answerQuery, {
                query: job.question,
                workspace: job.workspace,
                source: 'web',
            });
            // Only save + embed grounded answers (same rule as trainFromQuestions).
            if (rag.grounded) {
                await ctx.runMutation(internal.knowledgeTraining.saveTrainedQA, {
                    question: job.question,
                    answer: rag.answer,
                    workspace: job.workspace,
                    categorySlug: job.categorySlug,
                    grounded: true,
                });
            }
            await ctx.runMutation(internal.knowledgeTraining.finishTrainingJob, {
                jobId: job.jobId,
                status: 'done',
                grounded: rag.grounded,
                answer: rag.answer,
            });
        } catch (e) {
            await ctx.runMutation(internal.knowledgeTraining.finishTrainingJob, {
                jobId: job.jobId,
                status: 'error',
                error: e instanceof Error ? e.message : 'processing failed',
            });
        }

        // Chain to the next job — THROTTLED (JOB_INTERVAL_MS) so training never
        // bursts Gemini quota or Convex action-compute. Each job runs in its own
        // action so a single failure never takes down the batch.
        await ctx.scheduler.runAfter(JOB_INTERVAL_MS, internal.knowledgeTraining.processNextTrainingJob, {});
    },
});

// Live batch/queue status for the page.
export const listTrainingJobs = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const jobs = await ctx.db
            .query('knowledgeTrainingJobs')
            .withIndex('by_createdAt')
            .order('desc')
            .take(50);
        return jobs.map((j) => ({
            _id: j._id,
            question: j.question,
            status: j.status,
            grounded: j.grounded ?? null,
            answer: j.answer ?? null,
            error: j.error ?? null,
            batchId: j.batchId,
        }));
    },
});

// Clear finished/errored jobs (housekeeping — the trained Q&A live in articles).
export const clearFinishedTrainingJobs = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const done = (await ctx.db.query('knowledgeTrainingJobs').collect())
            .filter((j) => j.status === 'done' || j.status === 'error');
        for (const j of done) await ctx.db.delete(j._id);
        return { removed: done.length };
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
