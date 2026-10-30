/**
 * The pipeline's state machine: step order, retries, waits and the deadline.
 * Shared by the Convex orchestrator (convex/aiPipeline/*) and the in-memory
 * runner used in tests, so both make exactly the same decisions. Pure.
 */

import type { StepKey } from './types';

export const STEPS: StepKey[] = ['reading_interview', 'writing_pages', 'polishing_photos', 'building_site'];

export const STEP_LABELS: Record<StepKey, string> = {
    reading_interview: 'Reading your interview',
    writing_pages: 'Writing your pages',
    polishing_photos: 'Polishing your photos',
    building_site: 'Building your site',
};

/** Attempts per step, including the first. */
export const MAX_ATTEMPTS: Record<StepKey, number> = {
    reading_interview: 3,
    writing_pages: 3,
    polishing_photos: 2,
    building_site: 3,
};

/** Delay before attempt n+1 (index = attempts already made − 1). */
const BACKOFF_MS = [20_000, 60_000, 120_000];

export function backoffMs(attemptsMade: number): number {
    return BACKOFF_MS[Math.min(Math.max(attemptsMade - 1, 0), BACKOFF_MS.length - 1)];
}

/**
 * An error that retrying cannot fix. `fallback: false` means the run stops
 * without handing the submission to Tendso Studio (e.g. a site is already
 * built or the submission was rejected: nothing to fall back to).
 */
export class PipelineError extends Error {
    readonly permanent = true;
    constructor(message: string, readonly code: string, readonly fallback = true) {
        super(message);
        this.name = 'PipelineError';
    }
}

export const isPermanent = (e: unknown): e is PipelineError =>
    !!e && typeof e === 'object' && (e as { permanent?: unknown }).permanent === true;

export function nextStep(step: StepKey): StepKey | null {
    const i = STEPS.indexOf(step);
    return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : null;
}

export type FailurePlan =
    | { action: 'retry'; delayMs: number; attempt: number }
    | { action: 'fail'; reason: string; fallback: boolean };

/** What to do after a step threw. */
export function planAfterFailure(args: {
    step: StepKey;
    attempt: number;
    now: number;
    deadlineAt: number;
    error: unknown;
}): FailurePlan {
    const message = args.error instanceof Error ? args.error.message : String(args.error);
    if (isPermanent(args.error)) return { action: 'fail', reason: message, fallback: args.error.fallback };
    if (args.attempt >= MAX_ATTEMPTS[args.step]) {
        return { action: 'fail', reason: `${args.step} failed ${args.attempt} times: ${message}`, fallback: true };
    }
    const delayMs = backoffMs(args.attempt);
    if (args.now + delayMs >= args.deadlineAt) {
        return { action: 'fail', reason: `no time left to retry ${args.step}: ${message}`, fallback: true };
    }
    return { action: 'retry', delayMs, attempt: args.attempt + 1 };
}

export type WaitPlan = { action: 'wait'; delayMs: number } | { action: 'fail'; reason: string; fallback: boolean };

/** A step asked to wait (e.g. the recording is still being transcribed). */
export function planWait(args: { now: number; deadlineAt: number; delayMs: number; note: string }): WaitPlan {
    if (args.now + args.delayMs >= args.deadlineAt) {
        return { action: 'fail', reason: `timed out waiting: ${args.note}`, fallback: true };
    }
    return { action: 'wait', delayMs: args.delayMs };
}

export function isTimedOut(run: { deadlineAt: number }, now: number): boolean {
    return now >= run.deadlineAt;
}
