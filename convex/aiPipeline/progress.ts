/**
 * The ONE place the AI pipeline reports build progress (brief §4C.5).
 *
 * Steps, as the owner sees them: reading_interview · writing_pages ·
 * polishing_photos · building_site, each pending → running → done | failed.
 *
 * Two sinks:
 *  1. the run row (aiPipelineRuns.steps), always — admins can read it now;
 *  2. internal.buildProgress.setStep — the owner-app contract that
 *     feat/v2-backend-owners adds (docs/v2-api-owners.md §4). Its 'done' on
 *     building_site sets previewReadyAt ("Ready to check"), emails the owner and
 *     publishes if they already paid.
 *
 * A failure in the owner-facing sink (e.g. setStep refusing a draft row) is
 * logged and never stops the build: the run row keeps the truth.
 */

import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { StepKey, StepStatus } from '../../lib/aiPipeline/types';

export async function reportBuildStep(
    ctx: ActionCtx,
    args: { runId: Id<'aiPipelineRuns'>; submissionId: Id<'submissions'>; step: StepKey; status: StepStatus; error?: string },
): Promise<void> {
    const error = args.status === 'failed' ? (args.error ?? 'failed').slice(0, 500) : undefined;
    console.log(`[ai-pipeline] progress ${args.submissionId} ${args.step} → ${args.status}${error ? ` (${error})` : ''}`);

    await ctx.runMutation(internal.aiPipeline.orchestrator.markStep, {
        runId: args.runId,
        step: args.step,
        status: args.status,
        ...(error ? { error } : {}),
    });

    try {
        await ctx.runMutation(internal.buildProgress.setStep, {
            submissionId: args.submissionId,
            step: args.step,
            status: args.status,
            ...(error ? { error } : {}),
        });
    } catch (e) {
        console.warn(`[ai-pipeline] buildProgress.setStep failed (${e instanceof Error ? e.message : String(e)}); progress kept on the run only`);
    }
}
