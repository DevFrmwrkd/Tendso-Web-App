import { v } from 'convex/values';
import { internalAction, internalMutation, mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/auth';
import { internal } from './_generated/api';
import { BUILD_STEPS, isOwnerApp, type BuildStepKey } from './lib/ownerApp';

/**
 * Build progress — the contract between the AI pipeline and the owner app.
 * Full contract: docs/v2-api-owners.md ("Build progress").
 *
 * The owner watches four steps (about 20 minutes in all):
 *   reading_interview · writing_pages · polishing_photos · building_site
 * each 'pending' → 'running' → 'done' (or 'failed').
 *
 * THE PIPELINE AGENT OWNS THE AI WORK. Its only obligations here:
 *   1. Replace the body of `startPipeline` below (scheduled by ownerApp.submit)
 *      with the real pipeline kick-off.
 *   2. Report each step with
 *        ctx.runMutation(internal.buildProgress.setStep, { submissionId, step, status })
 *      ('failed' may carry `error`, a short message for logs and admin).
 *   3. Before reporting building_site 'done', write the built site the usual
 *      way (generatedWebsites row with htmlStorageId, status 'draft'). That
 *      'done' sets previewReadyAt (the owner sees "Ready to check") and, if the
 *      owner already paid, publishes.
 */

const step = v.union(
    v.literal('reading_interview'),
    v.literal('writing_pages'),
    v.literal('polishing_photos'),
    v.literal('building_site'),
);
const status = v.union(v.literal('pending'), v.literal('running'), v.literal('done'), v.literal('failed'));
const MAX_ERROR = 500;

const setStepArgs = {
    submissionId: v.id('submissions'),
    step,
    status,
    error: v.optional(v.string()),
};

export const setStep = internalMutation({
    args: setStepArgs,
    handler: async (ctx, args) => setStepImpl(ctx, args),
});

async function setStepImpl(
    ctx: MutationCtx,
    args: { submissionId: Id<'submissions'>; step: BuildStepKey; status: 'pending' | 'running' | 'done' | 'failed'; error?: string },
) {
    const s = await ctx.db.get(args.submissionId);
    if (!s) throw new Error('Submission not found');
    if (s.status === 'draft') throw new Error('Cannot report build progress on a draft');

    const now = Date.now();
    const steps = { ...(s.buildSteps ?? {}) } as NonNullable<typeof s.buildSteps>;
    const prev = steps[args.step as BuildStepKey];
    steps[args.step as BuildStepKey] = {
        status: args.status,
        startedAt: args.status === 'pending' ? undefined : prev?.startedAt ?? now,
        finishedAt: args.status === 'done' || args.status === 'failed' ? now : undefined,
        updatedAt: now,
        error: args.status === 'failed' ? (args.error ?? 'failed').slice(0, MAX_ERROR) : undefined,
    };
    // Fill the other steps so the owner always sees all four.
    for (const key of BUILD_STEPS) {
        if (!steps[key]) steps[key] = { status: 'pending', updatedAt: now };
    }

    const patch: Record<string, unknown> = { buildSteps: steps };
    if (!s.buildStartedAt && args.status !== 'pending') patch.buildStartedAt = now;
    const finished = args.step === 'building_site' && args.status === 'done';
    if (finished) patch.previewReadyAt = now;
    await ctx.db.patch(args.submissionId, patch);

    if (finished && isOwnerApp(s)) {
        // Paid before the build finished (or a rebuild after a change): publish.
        await ctx.scheduler.runAfter(0, internal.ownerApp.publishIfReady, { submissionId: args.submissionId });
        // Only the first finish emails the owner; a rebuild shows in the app.
        if (!s.previewReadyAt) {
            await ctx.scheduler.runAfter(0, internal.ownerEmails.send, { submissionId: args.submissionId, kind: 'preview_ready' });
        }
    }
    return { steps, previewReadyAt: finished ? now : s.previewReadyAt ?? null };
}

/**
 * Reset the four steps to 'pending' for a rebuild (e.g. after a change
 * request). Keeps previewReadyAt: the owner can still look at the last build.
 */
export const restart = internalMutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const s = await ctx.db.get(args.submissionId);
        if (!s) throw new Error('Submission not found');
        const now = Date.now();
        const pending = { status: 'pending', updatedAt: now };
        await ctx.db.patch(args.submissionId, {
            buildSteps: { reading_interview: pending, writing_pages: pending, polishing_photos: pending, building_site: pending },
        });
    },
});

/**
 * Scheduled by ownerApp.submit. PLACEHOLDER for the pipeline agent: today it
 * only logs, so an owner-app submission waits at "building" (all steps
 * 'pending') until the pipeline is wired or an admin builds the site and
 * reports building_site 'done'.
 */
export const startPipeline = internalAction({
    args: { submissionId: v.id('submissions') },
    handler: async (_ctx, args) => {
        console.log(`[build-progress] Owner-app submission ${args.submissionId} is waiting for the AI pipeline (not wired yet).`);
    },
});

/**
 * Admin stand-in for the pipeline (testing, or a site built by hand in the
 * admin editor): report a step exactly as the pipeline would.
 */
export const adminSetStep = mutation({
    args: { submissionId: v.id('submissions'), step, status },
    handler: async (ctx, args): Promise<void> => {
        await requireAdmin(ctx);
        await setStepImpl(ctx, args);
    },
});
