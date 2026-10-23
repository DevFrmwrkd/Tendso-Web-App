/**
 * The owner path as a small, pure state machine: the order of the screens, where
 * a returning owner resumes, and the one thing the Today tab asks them to do.
 *
 * Board order (docs/landing-mock/app/owner.html, FEATURES-QUESTIONS Q15):
 *   sell → place → how → talk → photos → design → building → check → pay → live → home
 */
import { INTERVIEW_QUESTIONS } from './captureContent';
import type { OwnerPhase, SiteSummary } from './ownerTypes';
import { peso } from './ownerContent';

export type OwnerStep =
  | 'sell'
  | 'place'
  | 'how'
  | 'talk-intro'
  | 'talk'
  | 'talk-done'
  | 'photos-intro'
  | 'photos'
  | 'photos-done'
  | 'design'
  | 'building'
  | 'check'
  | 'change'
  | 'pay'
  | 'live'
  | 'home';

/** expo-router paths. Keep in sync with app/(owner)/**. */
export const STEP_ROUTE: Record<OwnerStep, string> = {
  sell: '/(owner)/start/sell',
  place: '/(owner)/start/place',
  how: '/(owner)/start/how',
  'talk-intro': '/(owner)/talk',
  talk: '/(owner)/talk/record',
  'talk-done': '/(owner)/talk/done',
  'photos-intro': '/(owner)/photos',
  photos: '/(owner)/photos/shoot',
  'photos-done': '/(owner)/photos/done',
  design: '/(owner)/design',
  building: '/(owner)/building',
  check: '/(owner)/check',
  change: '/(owner)/change',
  pay: '/(owner)/pay',
  live: '/(owner)/live',
  home: '/(owner)/(tabs)/today',
};

const ORDER: OwnerStep[] = [
  'sell', 'place', 'how',
  'talk-intro', 'talk', 'talk-done',
  'photos-intro', 'photos', 'photos-done',
  'design', 'building', 'check', 'pay', 'live', 'home',
];

/** The screen after `step` on the happy path. `change` goes back to building. */
export function nextStep(step: OwnerStep): OwnerStep {
  if (step === 'change') return 'building';
  const i = ORDER.indexOf(step);
  return i === -1 || i === ORDER.length - 1 ? 'home' : ORDER[i + 1];
}

/** Top progress for the three start questions (mock stepBar n / 3). */
export function startProgress(step: OwnerStep): number | undefined {
  if (step === 'sell') return 1 / 3;
  if (step === 'place') return 2 / 3;
  if (step === 'how') return 1;
  return undefined;
}

/** What a draft on the server already has. */
export interface DraftSnapshot {
  businessName?: string | null;
  businessType?: string | null;
  /** Answers with a recording or text. */
  answered: number[];
  /** Photos saved (guided + extras). */
  photos: number;
  templateId?: string | null;
}

export const MIN_PHOTOS_TO_SEND = 3;

/** The extra question is optional; all regular questions need an answer. */
export function firstMissingAnswer(answered: readonly number[]): number {
  const indices = new Set(answered);
  const missing = INTERVIEW_QUESTIONS.findIndex((_, index) => !indices.has(index));
  return missing === -1 ? INTERVIEW_QUESTIONS.length : missing;
}

/**
 * Where to send an owner who opens the app. `phase` is the server's word for
 * their newest site (null = no site yet).
 */
export function resumeStep(phase: OwnerPhase | null, draft?: DraftSnapshot | null): OwnerStep {
  switch (phase) {
    case null:
      return 'sell';
    case 'draft': {
      if (!draft || !draft.businessName || !draft.businessType) return 'sell';
      if (firstMissingAnswer(draft.answered) < INTERVIEW_QUESTIONS.length) {
        return draft.answered.length === 0 ? 'talk-intro' : 'talk';
      }
      if (draft.photos < MIN_PHOTOS_TO_SEND) return 'photos-intro';
      return 'design';
    }
    case 'building':
    case 'changes_requested':
      return 'building';
    case 'ready_to_check':
      return 'check';
    case 'awaiting_payment':
      return 'pay';
    case 'publishing':
      return 'live';
    case 'live':
    case 'offline':
    case 'in_review':
    case 'rejected':
    default:
      return 'home';
  }
}

/** Phases that belong in the tabs (the owner has a site to look after). */
export function hasSiteHome(phase: OwnerPhase | null): boolean {
  return phase === 'live' || phase === 'offline' || phase === 'in_review' || phase === 'rejected' || phase === 'publishing';
}

/** The one big action on the Today tab for a phase. */
export function outstandingPayment(site: Pick<SiteSummary, 'total' | 'amountPaid' | 'balanceDue' | 'paidInFull'> | null | undefined): { label: string; step: 'pay' } | null {
  if (!site || site.paidInFull || site.total <= 0 || site.balanceDue <= 0) return null;
  return { label: `Pay ${peso(site.balanceDue)}`, step: 'pay' };
}

export function todayAction(phase: OwnerPhase | null, site?: SiteSummary | null): { label: string; step: OwnerStep } {
  const payment = outstandingPayment(site);
  if (phase === 'live' && payment) return payment;
  switch (phase) {
    case null:
      return { label: 'Make my website', step: 'sell' };
    case 'draft':
      return { label: 'Keep going', step: 'sell' };
    case 'building':
    case 'changes_requested':
      return { label: 'See progress', step: 'building' };
    case 'ready_to_check':
      return { label: 'Check my site', step: 'check' };
    case 'awaiting_payment':
      return { label: 'Pay to publish', step: 'pay' };
    case 'publishing':
      return { label: 'See my site', step: 'live' };
    case 'live':
      return { label: 'Share my site', step: 'live' };
    default:
      return { label: 'Book a visit', step: 'home' };
  }
}

/** One short line for the site card on Today / My site. */
export function phaseLine(phase: OwnerPhase | null): string {
  switch (phase) {
    case 'draft': return 'Not sent yet';
    case 'building': return 'Being built';
    case 'changes_requested': return 'Making your change';
    case 'ready_to_check': return 'Ready to check';
    case 'awaiting_payment': return 'Waiting for payment';
    case 'publishing': return 'Going live';
    case 'live': return 'Live';
    case 'offline': return 'Offline';
    case 'in_review': return 'Being checked';
    case 'rejected': return 'Needs a fix';
    default: return 'No site yet';
  }
}
