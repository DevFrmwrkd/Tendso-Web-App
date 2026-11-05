/**
 * Pure state machines behind the two camera screens. The components only
 * render these states and fire the events; tests drive them directly.
 */

// =============================================================== interview

export type InterviewPhase = 'framing' | 'asking' | 'paused' | 'done';

export interface InterviewState {
  phase: InterviewPhase;
  /** 0..total-1 = the questions, total = "Anything else?". */
  q: number;
  /** Number of regular questions (10). */
  total: number;
  /** The framing check passed (shown as "Good. Start talking" for a moment). */
  framingGood: boolean;
  /** Optional last question when replacing one saved answer. */
  stopAfterQuestion?: number;
}

export type InterviewEvent =
  | { type: 'FRAMING_GOOD' }
  | { type: 'BEGIN' }
  | { type: 'NEXT' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'FINISH' };

export function initialInterview(total = 10, startAt = 0, stopAfterQuestion?: number): InterviewState {
  const q = Math.max(0, Math.min(startAt, total));
  return { phase: 'framing', q, total, framingGood: false,
    ...(stopAfterQuestion !== undefined && Number.isInteger(stopAfterQuestion)
      ? { stopAfterQuestion: Math.max(q, Math.min(stopAfterQuestion, total)) } : {}) };
}

export function interviewReducer(s: InterviewState, e: InterviewEvent): InterviewState {
  switch (e.type) {
    case 'FRAMING_GOOD':
      return s.phase === 'framing' ? { ...s, framingGood: true } : s;
    case 'BEGIN':
      return s.phase === 'framing' ? { ...s, phase: 'asking', framingGood: true } : s;
    case 'NEXT':
      if (s.phase !== 'asking') return s;
      return isLastQuestion(s) ? { ...s, phase: 'done' } : { ...s, q: s.q + 1 };
    case 'PAUSE':
      return s.phase === 'asking' ? { ...s, phase: 'paused' } : s;
    case 'RESUME':
      return s.phase === 'paused' ? { ...s, phase: 'asking' } : s;
    case 'FINISH':
      return { ...s, phase: 'done' };
    default:
      return s;
  }
}

/** On the extra question the big button says Finish. */
export function isLastQuestion(s: InterviewState): boolean {
  return s.q >= (s.stopAfterQuestion ?? s.total);
}

export type SegmentState = 'done' | 'cur' | 'todo';

/** The 10-step bar: answered = done, current = cur (accent). On the extra all are done. */
export function segmentStates(s: InterviewState): SegmentState[] {
  return Array.from({ length: s.total }, (_, i) => (i < s.q ? 'done' : i === s.q ? 'cur' : 'todo'));
}

// =============================================================== photos

export interface ShotState {
  /** Number of tasks. */
  n: number;
  /** The task on screen. n = all asked. */
  cur: number;
  /** Photo uri per task, null = not taken (skipped or not yet). */
  taken: (string | null)[];
  /** The photo taken most recently (the little square left of the shutter). */
  last: string | null;
}

export type ShotEvent =
  | { type: 'TAKE'; uri: string }
  | { type: 'SKIP' }
  | { type: 'GOTO'; index: number };

export function initialShots(n: number, existing?: (string | null)[]): ShotState {
  const taken = Array.from({ length: n }, (_, i) => existing?.[i] ?? null);
  const firstOpen = taken.findIndex((t) => t === null);
  const last = [...taken].reverse().find((t) => t !== null) ?? null;
  return { n, cur: firstOpen === -1 ? n : firstOpen, taken, last };
}

/** The next task index after `from` that still has no photo, or n. */
function nextOpen(taken: (string | null)[], from: number): number {
  for (let i = from + 1; i < taken.length; i++) if (taken[i] === null) return i;
  return taken.length;
}

export function shotReducer(s: ShotState, e: ShotEvent): ShotState {
  switch (e.type) {
    case 'TAKE': {
      if (s.cur >= s.n) return s;
      const taken = s.taken.slice();
      taken[s.cur] = e.uri;
      return { ...s, taken, last: e.uri, cur: nextOpen(taken, s.cur) };
    }
    case 'SKIP':
      // Skipping moves on in order (a skipped task can be picked again from the strip).
      return s.cur >= s.n ? s : { ...s, cur: s.cur + 1 };
    case 'GOTO':
      return e.index >= 0 && e.index < s.n ? { ...s, cur: e.index } : s;
    default:
      return s;
  }
}

export function shotsDone(s: ShotState): boolean {
  return s.cur >= s.n;
}

export function takenCount(s: ShotState): number {
  return s.taken.filter(Boolean).length;
}

