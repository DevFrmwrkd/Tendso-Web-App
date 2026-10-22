/**
 * Rough per-site cost from the run's usage counters, in US dollars.
 * Rates are list prices checked 2026-10-21 and are overridable by env, because
 * they change on the providers' schedule, not ours. Estimates only; the
 * providers' dashboards are the truth. See docs/v2-ai-pipeline.md.
 */

import type { UsageTotals } from './types';

type Env = Record<string, string | undefined>;

const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
};

export interface CostRates {
    /** Groq whisper-large-v3, per audio hour. */
    whisperPerHour: number;
    /** Assumed interview length when we do not know it, minutes. */
    interviewMinutes: number;
    /** Assumed length of one recorded answer, minutes. */
    clipMinutes: number;
    /** Text/vision LLM, per million tokens (paid Gemini Flash list price; the BYOK pool is free). */
    llmInPerM: number;
    llmOutPerM: number;
    /** One polished image (Higgsfield credits at 1K). */
    perImage: number;
}

export function costRates(env: Env): CostRates {
    return {
        whisperPerHour: num(env.AI_PIPELINE_COST_WHISPER_PER_HOUR, 0.111),
        interviewMinutes: num(env.AI_PIPELINE_COST_INTERVIEW_MINUTES, 10),
        clipMinutes: num(env.AI_PIPELINE_COST_CLIP_MINUTES, 0.75),
        llmInPerM: num(env.AI_PIPELINE_COST_LLM_IN_PER_M, 0.3),
        llmOutPerM: num(env.AI_PIPELINE_COST_LLM_OUT_PER_M, 2.5),
        perImage: num(env.AI_PIPELINE_COST_PER_IMAGE, 0.1),
    };
}

export interface CostEstimate {
    transcriptionUsd: number;
    llmUsd: number;
    imagesUsd: number;
    totalUsd: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function estimateCost(usage: Partial<UsageTotals>, rates: CostRates): CostEstimate {
    const minutes = (usage.transcribedMainRecording ?? 0) * rates.interviewMinutes + (usage.transcribedClips ?? 0) * rates.clipMinutes;
    const transcriptionUsd = (minutes / 60) * rates.whisperPerHour;
    const llmUsd = ((usage.llmInputTokens ?? 0) / 1e6) * rates.llmInPerM + ((usage.llmOutputTokens ?? 0) / 1e6) * rates.llmOutPerM;
    const imagesUsd = (usage.imageJobs ?? 0) * rates.perImage;
    return {
        transcriptionUsd: round(transcriptionUsd),
        llmUsd: round(llmUsd),
        imagesUsd: round(imagesUsd),
        totalUsd: round(transcriptionUsd + llmUsd + imagesUsd),
    };
}
