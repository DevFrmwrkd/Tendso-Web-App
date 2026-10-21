/**
 * Guided capture content (owner app + field agents): the 10 interview questions
 * (English + Tagalog) and the 10 guided photo tasks per kind of shop.
 *
 * Source: docs/landing-mock/js/data.js (TD.interview, TD.shots), Theo 2026-10-21.
 * The interview wording must match the backend (convex/lib/ownerApp.ts
 * OWNER_APP_QUESTIONS on feat/v2-backend-owners): index 0-9 = questions, 10 = extra.
 */

export type Lang = 'en' | 'tl';

export interface Question {
  en: string;
  tl: string;
}

export const INTERVIEW_QUESTIONS: readonly Question[] = [
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
];

/** The open question after the ten. Backend index 10. */
export const EXTRA_QUESTION: Question = { en: 'Anything else?', tl: 'May iba pa?' };
export const EXTRA_QUESTION_INDEX = INTERVIEW_QUESTIONS.length; // 10

/** Words on the recording screen, per language (mock `interviewCam` L). */
export const CAM_LABELS: Record<Lang, {
  next: string; finish: string; hold: string; ok: string; last: string; paused: string; resume: string;
}> = {
  en: {
    next: 'Next question', finish: 'Finish', hold: 'Hold the phone straight', ok: 'Good. Start talking',
    last: 'Last one', paused: 'Paused', resume: 'Go on',
  },
  tl: {
    next: 'Susunod na tanong', finish: 'Tapos na', hold: 'Hawakan nang diretso', ok: 'Ayos. Magsalita na',
    last: 'Huli na', paused: 'Naka-pause', resume: 'Ituloy',
  },
};

/** The question (or the extra) at index k, in the chosen language. */
export function questionAt(k: number, lang: Lang): string {
  const q = k >= INTERVIEW_QUESTIONS.length ? EXTRA_QUESTION : INTERVIEW_QUESTIONS[Math.max(0, k)];
  return q[lang];
}

// ---------------------------------------------------------------- photos

/** What the shot is of. Drives the simple feedback hint (no outlines are drawn). */
export type ShotKind = 'head' | 'half' | 'front' | 'sign' | 'room' | 'object';

export interface ShotTask {
  /** Task title, shown like a subtitle. */
  t: string;
  /** One short hint under it. */
  h: string;
  kind: ShotKind;
}

export type ShotListKey = 'barber' | 'salon' | 'repair' | 'craft' | 'food' | 'shop';

export const SHOT_LISTS: Record<ShotListKey, readonly ShotTask[]> = {
  barber: [
    { t: 'Owner headshot', h: 'Face and shoulders, plain background', kind: 'head' },
    { t: 'Profile picture', h: 'Owner at work, half body', kind: 'half' },
    { t: 'Haircut in progress', h: 'Barber and client, side angle', kind: 'half' },
    { t: 'Inside', h: 'Wide, from the door', kind: 'room' },
    { t: 'Chairs and equipment', h: 'The chairs, mirrors and stations', kind: 'room' },
    { t: 'Finished cut', h: 'Back and side of the client', kind: 'head' },
    { t: 'Outside', h: 'The whole shop front from across', kind: 'front' },
    { t: 'Sign', h: 'Straight on, fill the frame', kind: 'sign' },
    { t: 'Tools', h: 'Clippers and scissors, close up', kind: 'object' },
    { t: 'Price list', h: 'Straight on, readable', kind: 'sign' },
  ],
  salon: [
    { t: 'Owner headshot', h: 'Face and shoulders', kind: 'head' },
    { t: 'Profile picture', h: 'Owner at the station', kind: 'half' },
    { t: 'Outside', h: 'The whole front', kind: 'front' },
    { t: 'Inside', h: 'Wide, from the door', kind: 'room' },
    { t: 'Stations', h: 'Chairs and mirrors', kind: 'room' },
    { t: 'Products', h: 'Shelf, straight on', kind: 'object' },
    { t: 'Work in progress', h: 'Stylist and client', kind: 'half' },
    { t: 'Result', h: 'Finished hair, good light', kind: 'head' },
    { t: 'Detail', h: 'Colour or nails, close up', kind: 'object' },
    { t: 'Price list', h: 'Readable', kind: 'sign' },
  ],
  repair: [
    { t: 'Owner headshot', h: 'Face and shoulders', kind: 'head' },
    { t: 'Profile picture', h: 'Owner at the shop, half body', kind: 'half' },
    { t: 'Outside', h: 'The whole shop from across', kind: 'front' },
    { t: 'At work', h: 'Hands on the job', kind: 'half' },
    { t: 'Work bay', h: 'Wide, a car inside', kind: 'room' },
    { t: 'Wheels and tyres', h: 'Close, side angle', kind: 'object' },
    { t: 'Sign', h: 'Straight on, fill the frame', kind: 'sign' },
    { t: 'Tools', h: 'The tools you use most', kind: 'object' },
    { t: 'Finished job', h: 'Clean, close up', kind: 'object' },
    { t: 'Price list', h: 'Straight on, readable', kind: 'sign' },
  ],
  craft: [
    { t: 'Owner headshot', h: 'Face and shoulders', kind: 'head' },
    { t: 'At work', h: 'Hands on the craft', kind: 'half' },
    { t: 'Outside', h: 'The whole front, with the sign', kind: 'front' },
    { t: 'Workshop', h: 'Wide, from the door', kind: 'room' },
    { t: 'Best piece', h: 'Close, good light', kind: 'object' },
    { t: 'Another piece', h: 'Something people often order', kind: 'object' },
    { t: 'Tools', h: 'The tools you use most', kind: 'object' },
    { t: 'Materials', h: 'Wood, fabric or flowers', kind: 'object' },
    { t: 'Detail', h: 'The fine work, close up', kind: 'object' },
    { t: 'Price list', h: 'Straight on, readable', kind: 'sign' },
  ],
  food: [
    { t: 'Owner headshot', h: 'Face and shoulders', kind: 'head' },
    { t: 'Owner cooking', h: 'At the stove or counter', kind: 'half' },
    { t: 'Outside', h: 'The whole front, with the sign', kind: 'front' },
    { t: 'Dining area', h: 'Wide, tables set', kind: 'room' },
    { t: 'Best seller', h: 'One plate, close, side light', kind: 'object' },
    { t: 'Second dish', h: 'Another favourite', kind: 'object' },
    { t: 'Drinks', h: 'Coffee, juice or merienda', kind: 'object' },
    { t: 'Kitchen', h: 'Clean, pots and prep', kind: 'room' },
    { t: 'Menu and prices', h: 'Straight on, readable', kind: 'sign' },
    { t: 'Customers', h: 'People eating, faces optional', kind: 'room' },
  ],
  shop: [
    { t: 'Owner headshot', h: 'Face and shoulders', kind: 'head' },
    { t: 'Profile picture', h: 'Owner at the counter', kind: 'half' },
    { t: 'Outside', h: 'The whole front from across', kind: 'front' },
    { t: 'Inside', h: 'Wide, from the door', kind: 'room' },
    { t: 'Best seller', h: 'Close, good light', kind: 'object' },
    { t: 'Shelves', h: 'Straight on, full shelves', kind: 'room' },
    { t: 'Counter', h: 'Where people pay', kind: 'room' },
    { t: 'Sign', h: 'Straight on, fill the frame', kind: 'sign' },
    { t: 'Products', h: 'A few things, close up', kind: 'object' },
    { t: 'Price list', h: 'Straight on, readable', kind: 'sign' },
  ],
};

/** The task-specific tip while the phone is still moving (mock FIX_HINT). */
export const KIND_HINT: Record<ShotKind, string> = {
  head: 'Face in the middle',
  half: 'Step back a little',
  front: 'Step back a little',
  sign: 'Hold the phone straight',
  room: 'Step back a little',
  object: 'Move a bit closer',
};

export function shotList(key: string | null | undefined): readonly ShotTask[] {
  return (key && SHOT_LISTS[key as ShotListKey]) || SHOT_LISTS.shop;
}

/**
 * The shot list for a business type as the backend stores it (BUSINESS_TYPES).
 * Used by the field-agent flow, which only knows the type.
 */
export function shotListKeyForBusinessType(businessType: string | null | undefined): ShotListKey {
  const t = (businessType || '').toLowerCase();
  if (/barber/.test(t)) return 'barber';
  if (/salon|spa|massage|beauty|nail|hair/.test(t)) return 'salon';
  if (/auto|repair|mechanic|vulcan|garage/.test(t)) return 'repair';
  if (/craft|producer|tailor|carpent|florist|wood/.test(t)) return 'craft';
  if (/restaurant|food|cafe|bakery|eatery|carinderia/.test(t)) return 'food';
  return 'shop';
}

/** Guided photos per run, and the most the agent flow accepts in total. */
export const GUIDED_SHOT_COUNT = 10;
export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 10;
