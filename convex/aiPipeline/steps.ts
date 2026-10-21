"use node";

/**
 * AI site pipeline — the step runner (docs/v2-ai-pipeline.md).
 *
 * `runStep` runs ONE step of one run with the real providers and hands the
 * result to the orchestrator, which saves it and schedules the next step (or a
 * retry, or the Studio fallback). The step code itself is lib/aiPipeline/runner.ts.
 *
 * Node runtime: Whisper chunking (transcription.transcribeFrom) and base64
 * images for the vision check need it, and a Node action may use 512 MB.
 */

import { v } from 'convex/values';
import { internalAction, type ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import type { Doc } from '../_generated/dataModel';
import { stepValidator } from './validators';
import { reportBuildStep } from './progress';
import { fetchBytes, higgsfieldGenerate, llmJson, visionJson } from './providers';
import { transcribeFrom } from '../transcription';
import { executeStep, type PipelineDeps, type RunState } from '../../lib/aiPipeline/runner';
import { higgsfieldConfig } from '../../lib/aiPipeline/config';
import { isPermanent, PipelineError } from '../../lib/aiPipeline/stateMachine';
import type { PipelineInput, StepKey } from '../../lib/aiPipeline/types';
import { resolveHeroStyle } from '../../lib/templatePicker';
import { TEMPLATE_FIELD_PATHS } from '../../components/editor/templateFieldPaths.generated';

/** Convex values have no `undefined`; drop it (and nulls inside objects) before a mutation call. */
function plain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value, (_k, v) => (v === null ? undefined : v))) as T;
}

/** The customizations sent to the builder: what is stored, the template the copy was written for, and the owner's style picks. */
function customizationsFor(stored: Record<string, unknown> | null, templateCode: string | undefined, input: PipelineInput) {
    return {
        ...(stored ?? {}),
        ...(templateCode ? { heroStyle: templateCode } : {}),
        // INTEGRATE: feat/v2-backend-owners stores the owner's picks as
        // submissions.fontChoice / colorChoice (ownerApp.setStyle). They are
        // passed through as the builder's font pairing / colour scheme ids;
        // confirm the id vocabularies match once that branch is merged.
        ...(input.fontChoice ? { fontPairing: input.fontChoice, fontPairingId: input.fontChoice } : {}),
        ...(input.colorChoice ? { colorScheme: input.colorChoice, colorSchemeId: input.colorChoice } : {}),
    };
}

function makeDeps(ctx: ActionCtx, run: Doc<'aiPipelineRuns'>): PipelineDeps {
    const hf = higgsfieldConfig(process.env);
    return {
        env: process.env,
        now: () => Date.now(),
        log: (m) => console.log(m),
        llmJson: (req) => llmJson(ctx, req.system, req.prompt),

        async transcribeClip(url) {
            const key = process.env.GROQ_API_KEY;
            if (!key) throw new Error('GROQ_API_KEY is not set (needed to transcribe recorded answers)');
            return transcribeFrom(url, key);
        },

        async ensureMainTranscript(input) {
            if (input.transcript || !input.mainMediaUrl) return { kind: 'ready', transcript: input.transcript };
            if (input.transcriptionStatus === 'processing') {
                return { kind: 'wait', delayMs: 30_000, note: 'the interview recording is still being transcribed' };
            }
            // Reuse the existing transcription action (Groq Whisper, chunking,
            // status bookkeeping on the submission). It records its own failure.
            await ctx.runAction(internal.transcription.transcribeMedia, {
                submissionId: run.submissionId,
                storageId: input.mainMediaUrl,
                mediaType: input.mainMediaType,
            });
            const fresh = await ctx.runQuery(internal.submissions.getByIdInternal, { id: run.submissionId });
            return { kind: 'ready', transcript: (fresh?.transcript ?? '').trim() };
        },

        templateInfo(input) {
            const code = resolveHeroStyle(input.chosenTemplate, input.businessType, input.submissionId, input.businessName);
            return { code, paths: TEMPLATE_FIELD_PATHS[code] ?? [] };
        },

        async generateImage(req) {
            if (!hf) throw new Error('photo polishing is off');
            const timeoutMs = Number(process.env.AI_PIPELINE_IMAGE_TIMEOUT_MS) || 150_000;
            return higgsfieldGenerate(hf, req, { timeoutMs });
        },
        fetchBytes,
        visionCheck: (req) => visionJson(ctx, req.prompt, req.images),

        async storeImage(bytes, contentType) {
            const storageId = await ctx.storage.store(new Blob([Uint8Array.from(bytes)], { type: contentType || 'image/jpeg' }));
            return { storageId, url: await ctx.storage.getUrl(storageId) };
        },
        async savePhotoResult(result) {
            await ctx.runMutation(internal.aiPipeline.orchestrator.savePhotoResult, { runId: run._id, result: plain(result) });
        },

        async buildSite({ input, content, enhancedImages, templateCode }) {
            const prep = await ctx.runMutation(internal.aiPipeline.persist.prepareBuild, {
                runId: run._id,
                submissionId: run.submissionId,
                content: plain(content),
                ...(enhancedImages ? { enhancedImages: plain(enhancedImages) } : {}),
            });
            if (!prep.ok) throw new PipelineError(prep.message, prep.code, false);

            const secret = process.env.INTERNAL_API_SECRET;
            if (!secret) throw new PipelineError('INTERNAL_API_SECRET is not set on Convex', 'config');
            const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'https://tendso.vercel.app').replace(/\/$/, '');
            const res = await fetch(`${baseUrl}/api/internal/ai-pipeline-build`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
                body: JSON.stringify({ submissionId: run.submissionId, customizations: customizationsFor(prep.customizations, templateCode, input) }),
                signal: AbortSignal.timeout(290_000),
            });
            if (!res.ok) {
                const text = (await res.text().catch(() => '')).slice(0, 300);
                // 4xx = the request itself is wrong (secret, rejected submission,
                // missing content): retrying will not help.
                if (res.status >= 400 && res.status < 500) throw new PipelineError(`builder ${res.status}: ${text}`, 'builder_rejected', res.status !== 400);
                throw new Error(`builder ${res.status}: ${text}`);
            }
            const built = await res.json() as {
                html?: string; templateName?: string; extractedContent?: unknown; customizations?: unknown; websiteContent?: Record<string, unknown>;
            };
            if (!built.html || !built.websiteContent) throw new Error('builder returned no HTML');
            const htmlStorageId = await ctx.storage.store(new Blob([built.html], { type: 'text/html' }));
            const saved = await ctx.runMutation(internal.aiPipeline.persist.saveBuiltSite, {
                runId: run._id,
                submissionId: run.submissionId,
                htmlStorageId,
                templateName: built.templateName || 'astro',
                extractedContent: plain(built.extractedContent),
                customizations: plain(built.customizations),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                websiteContent: plain(built.websiteContent) as any,
            });
            if (!saved.saved) throw new PipelineError('the run ended while the site was building', 'stale', false);
            return { templateName: built.templateName, htmlStorageId: String(htmlStorageId) };
        },
    };
}

export const runStep = internalAction({
    args: { runId: v.id('aiPipelineRuns'), step: stepValidator, attempt: v.number() },
    handler: async (ctx, args): Promise<void> => {
        const run = await ctx.runQuery(internal.aiPipeline.orchestrator.getRunInternal, { runId: args.runId });
        // Stale schedule (a retry superseded it, the run finished or failed): do nothing.
        if (!run || run.status !== 'running' || run.step !== args.step || run.attempt !== args.attempt) return;
        const step = args.step as StepKey;
        const report = (status: 'running' | 'done' | 'failed', error?: string) =>
            reportBuildStep(ctx, { runId: run._id, submissionId: run.submissionId, step, status, error });

        if (Date.now() >= run.deadlineAt) {
            const out = await ctx.runMutation(internal.aiPipeline.orchestrator.timeoutRun, { runId: run._id });
            if (out.failedStep) await report('failed', 'timed out');
            return;
        }

        await report('running');
        try {
            const fresh = await ctx.runQuery(internal.aiPipeline.orchestrator.loadInput, { submissionId: run.submissionId });
            if (!fresh) throw new PipelineError('the submission no longer exists', 'gone', false);
            const saved = run.input as PipelineInput | undefined;
            const state: RunState = {
                // Fresh photos and choices, but keep a transcript made earlier in this run.
                input: saved?.transcript && !fresh.transcript ? { ...fresh, transcript: saved.transcript } : fresh,
                facts: run.facts,
                copy: run.copy,
                content: run.content,
                templateCode: run.templateCode,
                clipTranscripts: run.clipTranscripts,
                photos: run.photos,
                enhancedImages: run.enhancedImages,
            };
            const out = await executeStep(step, state, makeDeps(ctx, run));
            if (out.kind === 'wait') {
                const res = await ctx.runMutation(internal.aiPipeline.orchestrator.waitStep, {
                    runId: run._id, step, attempt: args.attempt, delayMs: out.delayMs, note: out.note,
                });
                if (res.action === 'fail') await report('failed', res.reason);
                return;
            }
            const { report: stepReport, ...patch } = out.patch;
            const res = await ctx.runMutation(internal.aiPipeline.orchestrator.completeStep, {
                runId: run._id,
                step,
                attempt: args.attempt,
                patch: plain(patch),
                usage: plain(out.usage),
                ...(stepReport ? { report: plain(stepReport) } : {}),
            });
            if (!res.stale) await report('done');
        } catch (e) {
            const message = (e instanceof Error ? e.message : String(e)).slice(0, 1000);
            const res = await ctx.runMutation(internal.aiPipeline.orchestrator.stepFailed, {
                runId: run._id,
                step,
                attempt: args.attempt,
                error: message,
                permanent: isPermanent(e),
                ...(isPermanent(e) ? { code: e.code, fallback: e.fallback } : {}),
            });
            if (res.action === 'fail') await report('failed', res.reason);
            else console.warn(`[ai-pipeline] ${step} attempt ${args.attempt} failed (${message}); ${res.action}`);
        }
    },
});

/** Scheduled at the deadline by orchestrator.start. */
export const checkTimeout = internalAction({
    args: { runId: v.id('aiPipelineRuns') },
    handler: async (ctx, args): Promise<void> => {
        const out = await ctx.runMutation(internal.aiPipeline.orchestrator.timeoutRun, { runId: args.runId });
        if (out.failedStep && out.submissionId) {
            await reportBuildStep(ctx, {
                runId: args.runId,
                submissionId: out.submissionId,
                step: out.failedStep,
                status: 'failed',
                error: 'timed out',
            });
        }
    },
});
