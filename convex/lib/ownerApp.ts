/**
 * Owner app v2 — pure constants and rules shared by convex/ownerApp.ts,
 * convex/buildProgress.ts, convex/ownerPayments.ts and the tests.
 * No DB access here. Contract: docs/v2-api-owners.md.
 */
import type { Doc } from '../_generated/dataModel';

/** The `contentSource` of a submission the owner made in the app. */
export const OWNER_APP_SOURCE = 'owner_app';

/**
 * The guided interview: ten simple questions, then "Anything else?".
 * Index 0-9 = the questions, index 10 = the extra. Same wording as the
 * design mock (docs/landing-mock/js/data.js TD.interview).
 */
export const OWNER_APP_QUESTIONS: ReadonlyArray<{ en: string; tl: string }> = [
    { en: "What's your shop called?", tl: 'Ano ang pangalan ng tindahan mo?' },
    { en: 'Where are you?', tl: 'Saan ka matatagpuan?' },
    { en: 'What do you sell?', tl: 'Ano ang binebenta mo?' },
    { en: 'What do people love most?', tl: 'Ano ang pinakagusto ng mga tao?' },
    { en: 'How did you start?', tl: 'Paano ka nagsimula?' },
    { en: 'What makes you special?', tl: 'Ano ang espesyal sa inyo?' },
    { en: 'What are your prices?', tl: 'Magkano ang mga presyo mo?' },
    { en: 'When are you open?', tl: 'Anong oras kayo bukas?' },
    { en: 'How can people reach you?', tl: 'Paano ka makokontak?' },
    { en: 'What should people know?', tl: 'Ano ang dapat malaman ng tao?' },
    { en: 'Anything else?', tl: 'May iba pa?' },
];
export const EXTRA_QUESTION_INDEX = 10;

/** Ten guided shots, then extras. */
export const GUIDED_SHOT_COUNT = 10;
export const MAX_EXTRA_SHOTS = 10;
/** Same floor as the agent app and /start. */
export const MIN_REAL_PHOTOS = 3;

/** The four build steps the owner watches, in order. */
export const BUILD_STEPS = ['reading_interview', 'writing_pages', 'polishing_photos', 'building_site'] as const;
export type BuildStepKey = (typeof BUILD_STEPS)[number];
export const BUILD_STEP_LABELS: Record<BuildStepKey, string> = {
    reading_interview: 'Reading your interview',
    writing_pages: 'Writing your pages',
    polishing_photos: 'Polishing your photos',
    building_site: 'Building your site',
};
export const BUILD_STEP_STATUSES = ['pending', 'running', 'done', 'failed'] as const;
export type BuildStepStatus = (typeof BUILD_STEP_STATUSES)[number];
/** "About 20 minutes" — the only build-time promise we make. */
export const BUILD_ESTIMATE_MINUTES = 20;

export function isOwnerApp(s: Pick<Doc<'submissions'>, 'contentSource'> | null | undefined): boolean {
    return s?.contentSource === OWNER_APP_SOURCE;
}

/**
 * Publish rule per source.
 *  - 'publish_first'    field-agent sales (and every legacy source): the site is
 *                       published by the admin before payment, stays live once
 *                       paid, and is taken down by the existing unpaid cron.
 *  - 'pay_then_publish' owner self-serve in the app: private preview, owner
 *                       says "Looks good", pays (down payment or full), then
 *                       the site is published automatically.
 */
export type PublishPolicy = 'publish_first' | 'pay_then_publish';
export function publishPolicyFor(s: Pick<Doc<'submissions'>, 'contentSource'>): PublishPolicy {
    return isOwnerApp(s) ? 'pay_then_publish' : 'publish_first';
}

/** A down payment is in, the balance is not. Fields are the truth, not `status`. */
export function hasOutstandingBalance(s: Pick<Doc<'submissions'>, 'depositPaidAt' | 'paidInFullAt'>): boolean {
    return !!s.depositPaidAt && !s.paidInFullAt;
}

/**
 * Has the owner paid anything that unlocks publishing an owner-app site?
 * A down payment counts (same rule as a field-agent sale, where the agent's
 * cut is paid on the down payment and Tendso collects the rest).
 */
export function hasPaidToPublish(s: Pick<Doc<'submissions'>, 'depositPaidAt' | 'paidInFullAt' | 'status'>): boolean {
    return !!s.depositPaidAt || !!s.paidInFullAt || s.status === 'paid' || s.status === 'completed';
}

/** Paid in full: the whole owner total is in. Legacy rows only carry the status. */
export function isPaidInFull(s: Pick<Doc<'submissions'>, 'paidInFullAt' | 'status' | 'depositPaidAt'>): boolean {
    if (s.paidInFullAt) return true;
    if (hasOutstandingBalance(s)) return false;
    return s.status === 'paid' || s.status === 'completed';
}

/** Trim + lowercase. The owner identity anchor is the verified email. */
export function normalizeOwnerEmail(email: string | null | undefined): string {
    return (email ?? '').trim().toLowerCase();
}

/**
 * Where an owner's site is, in one word, for the app's home and build screens.
 *   draft · building · ready_to_check · changes_requested · awaiting_payment ·
 *   publishing · live · offline · in_review (an agent's site not yet published) · rejected
 */
export type OwnerPhase =
    | 'draft' | 'building' | 'ready_to_check' | 'changes_requested' | 'awaiting_payment'
    | 'publishing' | 'live' | 'offline' | 'in_review' | 'rejected';

export function computeOwnerPhase(
    s: Pick<Doc<'submissions'>, 'status' | 'contentSource' | 'previewReadyAt' | 'ownerApprovedAt' | 'depositPaidAt' | 'paidInFullAt'>,
    website: Pick<Doc<'generatedWebsites'>, 'status' | 'offlineAt'> | null | undefined,
    openChangeRequests: number,
): OwnerPhase {
    if (s.status === 'draft') return 'draft';
    if (s.status === 'rejected') return 'rejected';
    const published = website?.status === 'published';
    if (published && !website?.offlineAt) return 'live';
    if ((published && website?.offlineAt) || s.status === 'unpublished') return 'offline';
    if (!isOwnerApp(s)) return 'in_review';
    if (openChangeRequests > 0) return 'changes_requested';
    if (!s.previewReadyAt) return 'building';
    if (hasPaidToPublish(s)) return 'publishing';
    if (!s.ownerApprovedAt) return 'ready_to_check';
    return 'awaiting_payment';
}
