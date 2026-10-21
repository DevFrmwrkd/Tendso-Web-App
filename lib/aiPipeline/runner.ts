/**
 * The four steps, written against injected providers (`PipelineDeps`).
 *
 * The Convex orchestrator (convex/aiPipeline/steps.ts) runs ONE step per
 * scheduled action with real providers; `runPipelineLocally` runs them all in a
 * loop with the same state machine, for tests and local dry runs. Either way the
 * step code below is the code that runs. Pure apart from what `deps` does.
 */

import type { Copy, Facts, LlmUsage, PhotoResult, PipelineInput, StepKey, UsageTotals } from './types';
import { buildFactsPrompt, factsAreEmpty, FACTS_SYSTEM, groundFacts, validateFacts } from './facts';
import { buildCopyPrompt, COPY_SYSTEM, validateCopy } from './copy';
import { buildTemplateContent, templateCoverage } from './fieldMapping';
import { assembleInterviewText, clipsToTranscribe, formText } from './input';
import { placementKeys, planPolish, type PolishPlanItem } from './photos';
import { basicImageChecks, decideQc, parseVisionVerdict, VISION_QC_PROMPT } from './qc';
import { maxPolishedPhotos, polishingOffReason } from './config';
import { PipelineError, STEPS, nextStep, planAfterFailure, planWait } from './stateMachine';

// Free-form template content (see fieldMapping.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Content = Record<string, any>;

export interface LlmRequest {
    purpose: 'facts' | 'copy';
    system: string;
    prompt: string;
}

export interface PipelineDeps {
    env: Record<string, string | undefined>;
    now(): number;
    log(message: string): void;
    /** A JSON answer from the text LLM chain (Gemini pool → Groq). */
    llmJson(req: LlmRequest): Promise<{ json: unknown; usage?: LlmUsage }>;
    /** Whisper on one short recording (owner-app answers). */
    transcribeClip(url: string): Promise<string>;
    /**
     * The main recording's transcript: ready, still being made (wait), or none.
     * Convex reuses transcription.transcribeMedia for this.
     */
    ensureMainTranscript(input: PipelineInput): Promise<{ kind: 'ready'; transcript: string } | { kind: 'wait'; delayMs: number; note: string }>;
    /** Template code that will be used, and the text paths it binds. */
    templateInfo(input: PipelineInput): { code: string; paths: string[] };
    /** Submit one image job and wait for its result URL. */
    generateImage(req: { prompt: string; imageUrls: string[] }): Promise<{ url: string; requestId?: string }>;
    fetchBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }>;
    /** Raw JSON from the vision model, or null when no vision model is available. */
    visionCheck(req: { prompt: string; images: Array<{ bytes: Uint8Array; contentType: string }> }): Promise<{ json: unknown; usage?: LlmUsage } | null>;
    storeImage(bytes: Uint8Array, contentType: string): Promise<{ storageId: string; url: string | null }>;
    /** Persist one finished photo as soon as it is done (lets a retry skip it). */
    savePhotoResult(result: PhotoResult): Promise<void>;
    /** Fill the template, render and save the draft through the existing builder. */
    buildSite(req: { input: PipelineInput; content: Content; enhancedImages: Record<string, { url: string; storageId?: string }> | null; templateCode?: string }): Promise<{ templateName?: string; htmlStorageId?: string }>;
}

/** Everything earlier steps produced. Stored on the run between steps. */
export interface RunState {
    input: PipelineInput;
    facts?: Facts;
    copy?: Copy;
    content?: Content;
    templateCode?: string;
    clipTranscripts?: Record<number, string>;
    photos?: Record<string, PhotoResult>;
    enhancedImages?: Record<string, { url: string; storageId?: string }> | null;
}

export type StepOutput =
    | { kind: 'done'; patch: Partial<RunState> & { report?: Record<string, unknown> }; usage: Partial<UsageTotals> }
    | { kind: 'wait'; delayMs: number; note: string };

const addLlm = (u: Partial<UsageTotals>, usage?: LlmUsage) => {
    u.llmCalls = (u.llmCalls ?? 0) + 1;
    u.llmInputTokens = (u.llmInputTokens ?? 0) + (usage?.inputTokens ?? 0);
    u.llmOutputTokens = (u.llmOutputTokens ?? 0) + (usage?.outputTokens ?? 0);
};

// ─── 1. reading_interview ────────────────────────────────────────────────────
async function readingInterview(state: RunState, deps: PipelineDeps): Promise<StepOutput> {
    const usage: Partial<UsageTotals> = {};
    const input = { ...state.input };

    const main = await deps.ensureMainTranscript(input);
    if (main.kind === 'wait') return main;
    if (main.transcript && main.transcript !== input.transcript) {
        input.transcript = main.transcript;
        usage.transcribedMainRecording = 1;
    }

    const clipTranscripts = { ...(state.clipTranscripts ?? {}) };
    for (const clip of clipsToTranscribe(input, clipTranscripts)) {
        clipTranscripts[clip.position] = (await deps.transcribeClip(clip.url)).trim();
        usage.transcribedClips = (usage.transcribedClips ?? 0) + 1;
    }

    const interviewText = assembleInterviewText(input, clipTranscripts);
    if (!interviewText.trim()) {
        throw new PipelineError('There is no interview to read (no transcript, answers or recording).', 'no_interview');
    }

    const res = await deps.llmJson({ purpose: 'facts', system: FACTS_SYSTEM, prompt: buildFactsPrompt(input, interviewText) });
    addLlm(usage, res.usage);
    const validated = validateFacts(res.json);
    const { facts, report } = groundFacts(validated, `${interviewText}\n${formText(input)}`, input);
    if (factsAreEmpty(facts)) deps.log(`[ai-pipeline] facts are thin for ${input.submissionId}: page will carry the form values only`);
    return {
        kind: 'done',
        usage,
        patch: { facts, clipTranscripts, input, report: { grounding: report, interviewChars: interviewText.length } },
    };
}

// ─── 2. writing_pages ────────────────────────────────────────────────────────
async function writingPages(state: RunState, deps: PipelineDeps): Promise<StepOutput> {
    if (!state.facts) throw new PipelineError('writing_pages ran before the facts existed', 'state');
    const usage: Partial<UsageTotals> = {};
    const res = await deps.llmJson({ purpose: 'copy', system: COPY_SYSTEM, prompt: buildCopyPrompt(state.facts) });
    addLlm(usage, res.usage);
    const { copy, report } = validateCopy(res.json, state.facts);
    const content = buildTemplateContent(state.facts, copy, state.input);
    const template = deps.templateInfo(state.input);
    const coverage = templateCoverage(content, template.paths);
    return {
        kind: 'done',
        usage,
        patch: { copy, content, templateCode: template.code, report: { copy: report, coverage } },
    };
}

// ─── 3. polishing_photos ─────────────────────────────────────────────────────
async function polishOne(item: PolishPlanItem, deps: PipelineDeps, usage: Partial<UsageTotals>): Promise<PhotoResult> {
    const base = { index: item.shot.index, shotType: item.shotType, originalUrl: item.shot.url };
    try {
        usage.imageJobs = (usage.imageJobs ?? 0) + 1;
        const job = await deps.generateImage({ prompt: item.prompt, imageUrls: item.referenceUrls });
        const [result, original] = await Promise.all([deps.fetchBytes(job.url), deps.fetchBytes(item.shot.url)]);
        const basic = basicImageChecks(result.bytes, original.bytes);
        let verdict = null;
        if (basic.ok) {
            const vision = await deps.visionCheck({ prompt: VISION_QC_PROMPT, images: [original, result] });
            if (vision) {
                usage.visionChecks = (usage.visionChecks ?? 0) + 1;
                addLlm(usage, vision.usage);
                verdict = parseVisionVerdict(vision.json);
            }
        }
        const decision = decideQc(basic, verdict);
        if (!decision.pass) {
            return { ...base, outcome: 'kept', reason: `quality check: ${decision.reason}`, providerRequestId: job.requestId, qcScore: verdict?.score };
        }
        const stored = await deps.storeImage(result.bytes, result.contentType || basic.info.mime);
        return { ...base, outcome: 'polished', reason: decision.reason, storageId: stored.storageId, url: stored.url ?? undefined, providerRequestId: job.requestId, qcScore: verdict?.score };
    } catch (e) {
        return { ...base, outcome: 'kept', reason: `polishing failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) };
    }
}

/** Placement map for the builder, or null when nothing was polished (originals as today). */
export function enhancedImagesFrom(results: PhotoResult[]): Record<string, { url: string; storageId?: string }> | null {
    if (!results.some((r) => r.outcome === 'polished')) return null;
    const keys = placementKeys(results);
    const out: Record<string, { url: string; storageId?: string }> = {};
    for (const r of results) {
        const key = keys.get(r.index);
        if (!key) continue;
        out[key] = r.outcome === 'polished' && r.storageId
            ? { url: r.url ?? r.originalUrl, storageId: r.storageId }
            : { url: r.originalUrl };
    }
    return out;
}

async function polishingPhotos(state: RunState, deps: PipelineDeps): Promise<StepOutput> {
    const usage: Partial<UsageTotals> = {};
    const plan = planPolish(state.input.shots, {
        maxPolished: maxPolishedPhotos(deps.env),
        keepOriginals: state.input.keepOriginals,
        offReason: polishingOffReason(deps.env),
        businessType: state.input.businessType,
    });
    const done: Record<string, PhotoResult> = { ...(state.photos ?? {}) };
    const results: PhotoResult[] = [];

    for (const s of plan.skipped) {
        results.push({ index: s.shot.index, shotType: s.shotType, outcome: 'kept', reason: s.reason, originalUrl: s.shot.url });
    }
    const todo = plan.items.filter((item) => {
        const prior = done[String(item.shot.index)];
        if (prior) results.push(prior);
        return !prior;
    });

    // Three at a time: fast enough for the 20-minute target, gentle on the provider.
    const queue = [...todo];
    const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
            const result = await polishOne(item, deps, usage);
            await deps.savePhotoResult(result);
            done[String(result.index)] = result;
            results.push(result);
        }
    };
    await Promise.all([worker(), worker(), worker()]);

    results.sort((a, b) => a.index - b.index);
    const polished = results.filter((r) => r.outcome === 'polished').length;
    deps.log(`[ai-pipeline] photos for ${state.input.submissionId}: ${polished} polished, ${results.length - polished} kept`);
    return {
        kind: 'done',
        usage,
        patch: {
            photos: done,
            enhancedImages: enhancedImagesFrom(results),
            report: { photos: results.map((r) => ({ index: r.index, shotType: r.shotType, outcome: r.outcome, reason: r.reason, qcScore: r.qcScore })) },
        },
    };
}

// ─── 4. building_site ────────────────────────────────────────────────────────
async function buildingSite(state: RunState, deps: PipelineDeps): Promise<StepOutput> {
    if (!state.content) throw new PipelineError('building_site ran before the page content existed', 'state');
    const built = await deps.buildSite({
        input: state.input,
        content: state.content,
        enhancedImages: state.enhancedImages ?? null,
        templateCode: state.templateCode,
    });
    return { kind: 'done', usage: {}, patch: { report: { build: built } } };
}

export async function executeStep(step: StepKey, state: RunState, deps: PipelineDeps): Promise<StepOutput> {
    switch (step) {
        case 'reading_interview': return readingInterview(state, deps);
        case 'writing_pages': return writingPages(state, deps);
        case 'polishing_photos': return polishingPhotos(state, deps);
        case 'building_site': return buildingSite(state, deps);
    }
}

export function addUsage(total: Partial<UsageTotals>, add: Partial<UsageTotals>): UsageTotals {
    const keys: Array<keyof UsageTotals> = ['llmCalls', 'llmInputTokens', 'llmOutputTokens', 'visionChecks', 'imageJobs', 'transcribedClips', 'transcribedMainRecording'];
    const out = {} as UsageTotals;
    for (const k of keys) out[k] = (total[k] ?? 0) + (add[k] ?? 0);
    return out;
}

export interface LocalRunResult {
    status: 'done' | 'failed';
    state: RunState;
    error?: string;
    fallback?: boolean;
    events: Array<{ step: StepKey; status: 'running' | 'done' | 'failed' | 'retry' | 'wait'; at: number; note?: string }>;
    usage: UsageTotals;
}

/**
 * Run all four steps in-process with the orchestrator's decision rules.
 * `sleep` advances the (fake) clock in tests.
 */
export async function runPipelineLocally(
    input: PipelineInput,
    deps: PipelineDeps,
    opts: { timeoutMs: number; sleep: (ms: number) => Promise<void>; onStep?: (step: StepKey, status: string) => void },
): Promise<LocalRunResult> {
    const deadlineAt = deps.now() + opts.timeoutMs;
    let state: RunState = { input };
    let usage = addUsage({}, {});
    const events: LocalRunResult['events'] = [];
    let step: StepKey | null = STEPS[0];
    let attempt = 1;
    const mark = (s: StepKey, status: LocalRunResult['events'][number]['status'], note?: string) => {
        events.push({ step: s, status, at: deps.now(), note });
        opts.onStep?.(s, status);
    };

    while (step) {
        const current: StepKey = step;
        if (deps.now() >= deadlineAt) {
            mark(current, 'failed', 'timeout');
            return { status: 'failed', state, error: 'timed out', fallback: true, events, usage };
        }
        mark(current, 'running');
        try {
            const out = await executeStep(current, state, deps);
            if (out.kind === 'wait') {
                const plan = planWait({ now: deps.now(), deadlineAt, delayMs: out.delayMs, note: out.note });
                if (plan.action === 'fail') {
                    mark(current, 'failed', plan.reason);
                    return { status: 'failed', state, error: plan.reason, fallback: plan.fallback, events, usage };
                }
                mark(current, 'wait', out.note);
                await opts.sleep(plan.delayMs);
                continue;
            }
            const patch = { ...out.patch };
            delete patch.report;
            state = { ...state, ...patch };
            usage = addUsage(usage, out.usage);
            mark(current, 'done');
            step = nextStep(current);
            attempt = 1;
        } catch (error) {
            const plan = planAfterFailure({ step: current, attempt, now: deps.now(), deadlineAt, error });
            if (plan.action === 'fail') {
                mark(current, 'failed', plan.reason);
                return { status: 'failed', state, error: plan.reason, fallback: plan.fallback, events, usage };
            }
            mark(current, 'retry', error instanceof Error ? error.message : String(error));
            await opts.sleep(plan.delayMs);
            attempt = plan.attempt;
        }
    }
    return { status: 'done', state, events, usage };
}
