/**
 * AI site pipeline — state and scheduling (brief §4C, docs/v2-ai-pipeline.md).
 *
 * One `aiPipelineRuns` row per build. Each of the four steps runs as its own
 * scheduled action (`steps.runStep`), saves its output here, and schedules the
 * next one, so every step is retryable on its own and a retry skips work that
 * already finished. The decisions (retry, wait, give up) come from
 * lib/aiPipeline/stateMachine.ts, the same rules the tests run.
 *
 * Failure never strands an owner: the run is marked failed, the submission is
 * left in the admin review state it was in (status untouched — the human queue
 * stays as today), and Tendso Studio is triggered as the fallback.
 */

import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import { requireAdmin } from '../lib/auth';
import { giveawayCanRender } from '../lib/giveaway';
import { aiPipelineEnabled, pipelineTimeoutMs, studioFallbackEnabled } from '../../lib/aiPipeline/config';
import { buildPipelineInput } from '../../lib/aiPipeline/input';
import { nextStep, planAfterFailure, planWait, PipelineError, STEPS } from '../../lib/aiPipeline/stateMachine';
import { addUsage } from '../../lib/aiPipeline/runner';
import { costRates, estimateCost } from '../../lib/aiPipeline/costs';
import type { StepKey, StepStatus } from '../../lib/aiPipeline/types';
import { stepValidator } from './validators';


type Run = Doc<'aiPipelineRuns'>;
type StepRecord = { status: StepStatus; attempts: number; startedAt?: number; finishedAt?: number; error?: string };

const pendingSteps = (): Record<StepKey, StepRecord> =>
    Object.fromEntries(STEPS.map((s) => [s, { status: 'pending', attempts: 0 }])) as Record<StepKey, StepRecord>;

// ─── start ──────────────────────────────────────────────────────────────────

const startArgs = {
    submissionId: v.id('submissions'),
    /** What started it: submitted | owner_app | admin | rebuild. */
    reason: v.optional(v.string()),
    /** Build again even if a site exists or a run already finished (rebuild after a change). */
    force: v.optional(v.boolean()),
};

async function startImpl(
    ctx: MutationCtx,
    args: { submissionId: Id<'submissions'>; reason?: string; force?: boolean },
): Promise<{ runId: Id<'aiPipelineRuns'> | null; started: boolean; reason: string }> {
    const reason = args.reason ?? 'submitted';
    // The switch: off unless AI_PIPELINE_ENABLED. An admin may run one
    // submission by hand while it is off (that is how Theo tries it first).
    if (reason !== 'admin' && !aiPipelineEnabled(process.env)) {
        return { runId: null, started: false, reason: 'AI_PIPELINE_ENABLED is off' };
    }
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return { runId: null, started: false, reason: 'submission not found' };
    if (submission.status === 'draft' || submission.status === 'rejected') {
        return { runId: null, started: false, reason: `submission is ${submission.status}` };
    }
    if (!giveawayCanRender(submission)) return { runId: null, started: false, reason: 'giveaway not approved yet' };

    const latest = await ctx.db
        .query('aiPipelineRuns')
        .withIndex('by_submission', (q) => q.eq('submissionId', args.submissionId))
        .order('desc')
        .first();
    // Idempotent: a double trigger joins the run in flight; a finished run is
    // not repeated unless asked (force).
    if (latest?.status === 'running') return { runId: latest._id, started: false, reason: 'already running' };
    if (latest?.status === 'done' && !args.force) return { runId: latest._id, started: false, reason: 'already built' };

    const now = Date.now();
    const runId = await ctx.db.insert('aiPipelineRuns', {
        submissionId: args.submissionId,
        status: 'running',
        step: STEPS[0],
        attempt: 1,
        reason,
        force: args.force === true,
        startedAt: now,
        deadlineAt: now + pipelineTimeoutMs(process.env),
        updatedAt: now,
        steps: pendingSteps(),
        // A rebuild keeps the photos already polished (they cost money and the
        // owner has seen them). The other steps run again.
        ...(args.force && latest?.photos ? { photos: latest.photos } : {}),
    });
    await ctx.scheduler.runAfter(0, internal.aiPipeline.steps.runStep, { runId, step: STEPS[0], attempt: 1 });
    await ctx.scheduler.runAt(now + pipelineTimeoutMs(process.env), internal.aiPipeline.steps.checkTimeout, { runId });
    console.log(`[ai-pipeline] started run ${runId} for ${args.submissionId} (${reason})`);
    return { runId, started: true, reason };
}

/**
 * Start (or join) a build. Called by hyperagent.triggerStudioRender when the
 * switch is on, and by buildProgress.startPipeline for owner-app submissions
 * (reason 'owner_app'). A rebuild after a change request goes through
 * buildProgress.rebuild ({ reason: 'rebuild', force: true } after restart).
 */
export const start = internalMutation({ args: startArgs, handler: startImpl });

/** Admin: run the pipeline for one submission, even with the switch off. */
export const adminStart = mutation({
    args: { submissionId: v.id('submissions'), force: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return await startImpl(ctx, { submissionId: args.submissionId, reason: 'admin', force: args.force });
    },
});

// ─── reads ──────────────────────────────────────────────────────────────────

export const getRunInternal = internalQuery({
    args: { runId: v.id('aiPipelineRuns') },
    handler: async (ctx, args) => ctx.db.get(args.runId),
});

/** The submission as a PipelineInput, with every photo / recording as a fetchable URL. */
export const loadInput = internalQuery({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) return null;
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        const s = submission as Record<string, unknown>;
        const raw = new Set<string>();
        const add = (x: unknown) => { if (typeof x === 'string' && x.trim()) raw.add(x.trim()); };
        (Array.isArray(s.photos) ? s.photos : []).forEach(add);
        for (const shot of Array.isArray(s.ownerShots) ? s.ownerShots : []) add((shot as { url?: unknown })?.url);
        for (const ans of Array.isArray(s.ownerInterview) ? s.ownerInterview : []) add((ans as { mediaUrl?: unknown })?.mediaUrl);
        [s.videoUrl, s.audioUrl, s.videoStorageId, s.audioStorageId].forEach(add);

        const r2 = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
        const resolved = new Map<string, string | null>();
        for (const value of raw) {
            if (/^https?:\/\//.test(value)) resolved.set(value, value);
            else if (/^(images|videos|audio)\//.test(value)) resolved.set(value, r2 ? `${r2}/${value}` : null);
            else {
                try {
                    resolved.set(value, await ctx.storage.getUrl(value.replace(/^convex:/, '') as Id<'_storage'>));
                } catch {
                    resolved.set(value, null);
                }
            }
        }
        return buildPipelineInput(s, website as Record<string, unknown> | null, (value) => resolved.get(value) ?? null);
    },
});

/** Admin: the latest run for a submission, with step states, reports and the cost estimate. */
export const getForSubmission = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const run = await ctx.db
            .query('aiPipelineRuns')
            .withIndex('by_submission', (q) => q.eq('submissionId', args.submissionId))
            .order('desc')
            .first();
        if (!run) return null;
        return {
            runId: run._id,
            status: run.status,
            step: run.step,
            attempt: run.attempt,
            reason: run.reason,
            steps: run.steps,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt ?? null,
            deadlineAt: run.deadlineAt,
            error: run.error ?? null,
            fallback: run.fallback ?? null,
            templateCode: run.templateCode ?? null,
            facts: run.facts ?? null,
            reports: run.reports ?? null,
            usage: run.usage ?? null,
            costEstimateUsd: estimateCost(run.usage ?? {}, costRates(process.env)),
        };
    },
});

// ─── step bookkeeping (called from steps.ts) ────────────────────────────────

function isCurrent(run: Run | null, step: StepKey, attempt: number): run is Run {
    return !!run && run.status === 'running' && run.step === step && run.attempt === attempt;
}

/** Record a step's status on the run (the run's copy of build progress). */
export const markStep = internalMutation({
    args: {
        runId: v.id('aiPipelineRuns'),
        step: stepValidator,
        status: v.union(v.literal('pending'), v.literal('running'), v.literal('done'), v.literal('failed')),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!run) return;
        const steps = { ...pendingSteps(), ...(run.steps ?? {}) } as Record<StepKey, StepRecord>;
        const prev = steps[args.step];
        const now = Date.now();
        steps[args.step] = {
            status: args.status,
            attempts: args.status === 'running' ? prev.attempts + 1 : prev.attempts,
            startedAt: prev.startedAt ?? (args.status === 'running' ? now : undefined),
            finishedAt: args.status === 'done' || args.status === 'failed' ? now : undefined,
            ...(args.status === 'failed' ? { error: (args.error ?? 'failed').slice(0, 500) } : {}),
        };
        await ctx.db.patch(args.runId, { steps, updatedAt: now });
    },
});

const PATCHABLE = ['input', 'facts', 'copy', 'content', 'templateCode', 'clipTranscripts', 'photos', 'enhancedImages'] as const;

/** Save a finished step's output and move on (or finish). */
export const completeStep = internalMutation({
    args: {
        runId: v.id('aiPipelineRuns'),
        step: stepValidator,
        attempt: v.number(),
        patch: v.any(),
        usage: v.any(),
        report: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!isCurrent(run, args.step, args.attempt)) return { next: null, stale: true };
        const now = Date.now();
        const patch: Record<string, unknown> = { updatedAt: now };
        for (const key of PATCHABLE) {
            if (args.patch && args.patch[key] !== undefined) patch[key] = args.patch[key];
        }
        patch.usage = addUsage(run.usage ?? {}, args.usage ?? {});
        if (args.report !== undefined) patch.reports = { ...(run.reports ?? {}), [args.step]: args.report };
        const next = nextStep(args.step);
        if (next) {
            patch.step = next;
            patch.attempt = 1;
            await ctx.db.patch(run._id, patch);
            await ctx.scheduler.runAfter(0, internal.aiPipeline.steps.runStep, { runId: run._id, step: next, attempt: 1 });
        } else {
            patch.status = 'done';
            patch.finishedAt = now;
            await ctx.db.patch(run._id, patch);
            console.log(`[ai-pipeline] run ${run._id} done in ${Math.round((now - run.startedAt) / 1000)}s`);
        }
        return { next, stale: false };
    },
});

/** Save one polished (or kept) photo as soon as it is decided. */
export const savePhotoResult = internalMutation({
    args: { runId: v.id('aiPipelineRuns'), result: v.any() },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!run || run.status !== 'running') return;
        const index = String((args.result as { index?: unknown })?.index ?? '');
        if (!index) return;
        await ctx.db.patch(run._id, { photos: { ...(run.photos ?? {}), [index]: args.result }, updatedAt: Date.now() });
    },
});

async function failRunImpl(ctx: MutationCtx, run: Run, reason: string, fallback: boolean) {
    const useStudio = fallback && studioFallbackEnabled(process.env);
    await ctx.db.patch(run._id, {
        status: fallback ? 'failed' : 'canceled',
        error: reason.slice(0, 1000),
        finishedAt: Date.now(),
        updatedAt: Date.now(),
        ...(useStudio ? { fallback: 'studio' } : {}),
    });
    // The submission's status is NOT touched: it stays in the admin review
    // queue exactly as today, and Studio fills in copy + photos for the admin.
    if (useStudio) {
        await ctx.scheduler.runAfter(0, internal.hyperagent.triggerStudioRender, {
            submissionId: run.submissionId,
            viaStudio: true,
        });
    }
    console.error(`[ai-pipeline] run ${run._id} ${fallback ? 'failed' : 'stopped'} at ${run.step}: ${reason}${useStudio ? ' → Tendso Studio fallback' : ''}`);
}

/** A step threw. Retry with backoff, or give up (→ fallback). */
export const stepFailed = internalMutation({
    args: {
        runId: v.id('aiPipelineRuns'),
        step: stepValidator,
        attempt: v.number(),
        error: v.string(),
        permanent: v.boolean(),
        code: v.optional(v.string()),
        fallback: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!isCurrent(run, args.step, args.attempt)) return { action: 'stale' as const };
        const error = args.permanent ? new PipelineError(args.error, args.code ?? 'error', args.fallback ?? true) : new Error(args.error);
        const plan = planAfterFailure({ step: args.step, attempt: args.attempt, now: Date.now(), deadlineAt: run.deadlineAt, error });
        if (plan.action === 'retry') {
            await ctx.db.patch(run._id, { attempt: plan.attempt, updatedAt: Date.now(), error: args.error.slice(0, 1000) });
            await ctx.scheduler.runAfter(plan.delayMs, internal.aiPipeline.steps.runStep, { runId: run._id, step: args.step, attempt: plan.attempt });
            return { action: 'retry' as const, delayMs: plan.delayMs };
        }
        await failRunImpl(ctx, run, plan.reason, plan.fallback);
        return { action: 'fail' as const, reason: plan.reason };
    },
});

/** A step asked to wait (the recording is still being transcribed). */
export const waitStep = internalMutation({
    args: { runId: v.id('aiPipelineRuns'), step: stepValidator, attempt: v.number(), delayMs: v.number(), note: v.string() },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!isCurrent(run, args.step, args.attempt)) return { action: 'stale' as const };
        const plan = planWait({ now: Date.now(), deadlineAt: run.deadlineAt, delayMs: args.delayMs, note: args.note });
        if (plan.action === 'wait') {
            await ctx.scheduler.runAfter(plan.delayMs, internal.aiPipeline.steps.runStep, { runId: run._id, step: args.step, attempt: args.attempt });
            return { action: 'wait' as const };
        }
        await failRunImpl(ctx, run, plan.reason, plan.fallback);
        return { action: 'fail' as const, reason: plan.reason };
    },
});

/** The overall deadline passed. Fails a run that is still going. */
export const timeoutRun = internalMutation({
    args: { runId: v.id('aiPipelineRuns') },
    handler: async (ctx, args): Promise<{ failedStep: StepKey | null; submissionId: Id<'submissions'> | null }> => {
        const run = await ctx.db.get(args.runId);
        if (!run || run.status !== 'running') return { failedStep: null, submissionId: null };
        if (Date.now() < run.deadlineAt) return { failedStep: null, submissionId: null };
        const minutes = Math.round((run.deadlineAt - run.startedAt) / 60_000);
        await failRunImpl(ctx, run, `timed out after ${minutes} minutes during ${run.step}`, true);
        return { failedStep: run.step as StepKey, submissionId: run.submissionId };
    },
});
