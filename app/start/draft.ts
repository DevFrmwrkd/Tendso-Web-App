/**
 * The /start draft — everything the owner has typed, kept in localStorage.
 *
 * WHY localStorage and not a Convex table: /start is a single-sitting 5–8 minute
 * form behind no account, and it writes to Convex exactly once, at the end. A
 * server-side draft table would exist only to authorise an anonymous session
 * that spans nothing. The cost is honest and accepted: no cross-device resume.
 *
 * What it DOES buy is the thing that actually matters for this audience — a
 * sari-sari store owner on a phone, on mobile data, eight paragraphs deep. A
 * refresh, a backgrounded browser, an accidental back-swipe, or a tab the OS
 * reclaims must not cost them their answers. sessionStorage (what the creator
 * funnel uses) dies with the tab; localStorage does not.
 *
 * Photo URLs are in here too, not File objects: each photo is uploaded to R2 the
 * moment it is picked, so what survives a refresh is a real, already-uploaded
 * URL rather than a browser handle that cannot be serialised.
 */

import { INTAKE_QUESTIONS, type IntakeQuestionKey } from "@/lib/narrativeFromQa";

const DRAFT_KEY = "tendso:start:draft:v1";
/** Where the thanks page reads the address we promised to email. Session-scoped
 *  on purpose — it is a receipt for this visit, not something to keep. */
const RECEIPT_KEY = "tendso:start:receipt:v1";

/** A draft older than this is stale intent, not a resume: the shop, the photos
 *  and the prices have all moved on. Start clean rather than half-prefilled. */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 1 basics · 2 interview · 3 photos · 4 confirm. Lives beside the draft rather
 *  than in page.tsx because loadDraft clamps `step` to it — a bound that can
 *  drift from the steps actually rendered is the exact bug it exists to stop. */
export const TOTAL_STEPS = 4;
export const GIVEAWAY_STEPS = 5;

export interface StartBasics {
    businessName: string;
    businessType: string;
    ownerName: string;
    /** 10 local digits, no +63 — the same shape the creator funnel stores, which
     *  convex/domains.ts:53 already normalises to +639XXXXXXXXX. */
    ownerPhone: string;
    ownerEmail: string;
    address: string;
    city: string;
    province: string;
    barangay: string;
    postalCode: string;
}

export interface StartDraft {
    version: 1;
    updatedAt: number;
    /** 1 basics · 2 interview · 3 photos · 4 confirm; giveaways insert
     *  the poster at 4 and move confirmation to 5. */
    step: number;
    /** Which of the 8 interview questions is on screen during step 2. */
    questionIndex: number;
    basics: StartBasics;
    answers: Partial<Record<IntakeQuestionKey, string>>;
    /** null = not asked yet. Gates the two product photo slots. */
    hasProducts: boolean | null;
    /** Photo slot index (which IS the role — see photoSlots.ts) → R2 public URL. */
    photos: Record<number, string>;
    coordinates: { lat: number; lng: number } | null;
    /** The tier chosen on the confirm step. false = the standard tier (no
     *  custom domain), which is also what an owner who never touches the
     *  choice submits. */
    wantsCustomDomain: boolean;
    /** The address typed for the custom-domain tier. Kept even when the owner
     *  switches back to standard: toggling is one mis-tap, and re-typing a
     *  domain on a phone is not something to make anyone do twice. */
    requestedDomain: string;
    /** Giveaway intent survives a closure while the owner is filling the form. */
    giveawayApplication: boolean;
    giveawaySource: string | null;
    /** Eligibility evidence, separate from the website's indexed photo roles. */
    giveawayPosterPhoto: string | null;
}

export function emptyDraft(): StartDraft {
    return {
        version: 1,
        updatedAt: Date.now(),
        step: 1,
        questionIndex: 0,
        basics: {
            businessName: "",
            businessType: "",
            ownerName: "",
            ownerPhone: "",
            ownerEmail: "",
            address: "",
            city: "",
            province: "",
            barangay: "",
            postalCode: "",
        },
        answers: {},
        hasProducts: null,
        photos: {},
        coordinates: null,
        wantsCustomDomain: false,
        requestedDomain: "",
        giveawayApplication: false,
        giveawaySource: null,
        giveawayPosterPhoto: null,
    };
}

/** A position remembered by a build that is no longer the one reading it. Both
 *  cursors index into things whose length the draft does not control: remove one
 *  interview question and a saved `questionIndex: 7` points at nothing. That
 *  value is in localStorage, so the resulting crash survives every refresh and
 *  the owner's only escape is clearing site data — clamp instead, so the shape
 *  of a stored draft can never be load-bearing and `version` never has to be
 *  bumped just to reorder a question. */
function clampCursor(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
}

/** Same argument as clampCursor, one level down: the cursors are not the only
 *  thing a stored draft can get wrong. JSON.parse hands back `any`, so a draft
 *  written by an older build — or hand-edited in devtools — can put a number,
 *  an object or null where the form expects a string, and `.trim()` on it
 *  throws during render. Drop anything that is not a string rather than trying
 *  to coerce it: a missing answer re-asks one question, a wrong-typed one
 *  white-screens the page it is stored on. */
function stringValuesOnly<K extends string | number>(value: unknown, keep?: (key: string) => boolean): Record<K, string> {
    const out = {} as Record<K, string>;
    if (!value || typeof value !== "object") return out;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (typeof entry !== "string") continue;
        if (keep && !keep(key)) continue;
        out[key as K] = entry;
    }
    return out;
}

const QUESTION_KEYS: ReadonlySet<string> = new Set(INTAKE_QUESTIONS.map((q) => q.key));

/** Photo slot indices are numbers in StartDraft but come back from JSON as
 *  numeric strings; anything non-numeric is not a slot this build renders. */
function isSlotIndex(key: string): boolean {
    return /^\d+$/.test(key);
}

/**
 * Read the saved draft, or a fresh one.
 *
 * Every failure mode — private browsing with storage disabled, a half-written
 * value, a draft from an older shape — returns an empty draft instead of
 * throwing. Losing a draft is a bad morning; a crashed intake page is a lost
 * customer.
 */
export function loadDraft(): StartDraft {
    if (typeof window === "undefined") return emptyDraft();
    try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (!raw) return emptyDraft();

        const parsed = JSON.parse(raw) as Partial<StartDraft>;
        if (parsed?.version !== 1) return emptyDraft();
        if (!parsed.updatedAt || Date.now() - parsed.updatedAt > DRAFT_TTL_MS) return emptyDraft();

        const fresh = emptyDraft();
        return {
            ...fresh,
            ...parsed,
            version: 1,
            step: clampCursor(parsed.step, 1, parsed.giveawayApplication === true ? GIVEAWAY_STEPS : TOTAL_STEPS, fresh.step),
            questionIndex: clampCursor(parsed.questionIndex, 0, INTAKE_QUESTIONS.length - 1, fresh.questionIndex),
            // Merge rather than replace so a field added to StartBasics later
            // reads as "" for an in-flight draft instead of undefined.
            basics: { ...fresh.basics, ...stringValuesOnly<keyof StartBasics>(parsed.basics) },
            // Drop answers whose question this build no longer asks — the same
            // drift clampCursor guards against, one level down.
            answers: stringValuesOnly<IntakeQuestionKey>(parsed.answers, (key) => QUESTION_KEYS.has(key)),
            photos: stringValuesOnly<number>(parsed.photos, isSlotIndex),
            hasProducts: typeof parsed.hasProducts === "boolean" ? parsed.hasProducts : null,
            // Same reason stringValuesOnly exists, for the two scalars it cannot
            // cover: the spread above would otherwise hand a number or an object
            // straight to `.trim()` during render, on a draft that survives every
            // refresh. A dropped tier re-asks one question on the last screen.
            wantsCustomDomain: typeof parsed.wantsCustomDomain === "boolean" ? parsed.wantsCustomDomain : false,
            requestedDomain: typeof parsed.requestedDomain === "string" ? parsed.requestedDomain : "",
            giveawayApplication: parsed.giveawayApplication === true,
            giveawaySource: stringOrNull(parsed.giveawaySource),
            giveawayPosterPhoto: stringOrNull(parsed.giveawayPosterPhoto),
            coordinates:
                parsed.coordinates &&
                typeof parsed.coordinates.lat === "number" &&
                typeof parsed.coordinates.lng === "number"
                    ? { lat: parsed.coordinates.lat, lng: parsed.coordinates.lng }
                    : null,
        };
    } catch {
        return emptyDraft();
    }
}

/** A remembered offer alone does not reserve a slot. Work already entered into
 *  a giveaway draft retains its intent if the offer closes before submission. */
export function hasDraftProgress(draft: StartDraft): boolean {
    return draft.step > 1 || Object.values(draft.basics).some((value) => value.trim().length > 0)
        || Object.values(draft.answers).some((value) => value?.trim())
        || Object.keys(draft.photos).length > 0 || !!draft.giveawayPosterPhoto;
}

export function resolveGiveawayDraft(
    draft: StartDraft,
    wantsGiveaway: boolean,
    source: string | null,
    open: boolean,
    fullPrice = false,
): StartDraft {
    const resume = draft.giveawayApplication && hasDraftProgress(draft);
    const giveawayApplication = !fullPrice && (resume || (wantsGiveaway && open));
    return {
        ...draft,
        giveawayApplication,
        giveawaySource: giveawayApplication ? source ?? draft.giveawaySource : null,
        // Existing standard drafts on the review screen land on the poster
        // step when they opt into the giveaway, before they can submit.
        step: Math.min(draft.step, giveawayApplication ? GIVEAWAY_STEPS : TOTAL_STEPS),
        wantsCustomDomain: giveawayApplication || fullPrice ? false : draft.wantsCustomDomain,
    };
}

export function saveDraft(draft: StartDraft): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }));
    } catch {
        // Quota or a locked-down browser. The form keeps working from React
        // state; only the refresh-safety net is gone, and saying so mid-form
        // would just frighten someone who cannot act on it.
    }
}

/** Called once, immediately after the mutation returns. */
export function clearDraft(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(DRAFT_KEY);
    } catch {
        /* see saveDraft */
    }
}

/** What the thanks page needs to repeat back: where we will write, what we said
 *  it costs, and whose site it is. The amount is the total the form quoted,
 *  discount and domain included, rather than anything the next page re-derives.
 *
 *  The last four fields arrived with the Round 1 thanks page, which repeats the
 *  business and the price breakdown back. Every one is null on a receipt written
 *  by an older build, and the page drops the line it would have filled. */
export interface SubmittedReceipt {
    email: string;
    amount: number | null;
    businessName: string | null;
    city: string | null;
    /** The campaign the form quoted under (a lib/pricing key, e.g. "otr"). Only
     *  ever used to word the breakdown; the amount above is what was promised. */
    campaign: string | null;
    /** null = unknown (an older receipt), not "standard". */
    customDomain: boolean | null;
    giveawayApplication?: boolean;
}

export function rememberSubmitted(receipt: SubmittedReceipt): void {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
    } catch {
        /* the thanks page falls back to generic copy */
    }
}

function stringOrNull(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseReceipt(raw: string | null): SubmittedReceipt | null {
    if (!raw) return null;
    // The oldest receipt shape is a bare email string. Someone can be
    // mid-submission across a deploy, so read that shape too — and the
    // { email, amount } one that followed it, which simply lacks the rest.
    if (!raw.startsWith("{")) {
        return { email: raw, amount: null, businessName: null, city: null, campaign: null, customDomain: null };
    }
    try {
        const parsed = JSON.parse(raw) as Partial<Record<keyof SubmittedReceipt, unknown>>;
        if (typeof parsed?.email !== "string") return null;
        return {
            email: parsed.email,
            amount: typeof parsed.amount === "number" ? parsed.amount : null,
            businessName: stringOrNull(parsed.businessName),
            city: stringOrNull(parsed.city),
            campaign: stringOrNull(parsed.campaign),
            customDomain: typeof parsed.customDomain === "boolean" ? parsed.customDomain : null,
            giveawayApplication: parsed.giveawayApplication === true,
        };
    } catch {
        return null;
    }
}

/**
 * THE SNAPSHOT MUST BE THE SAME OBJECT EVERY CALL.
 *
 * This is read through useSyncExternalStore (app/start/thanks/page.tsx), which
 * compares snapshots with Object.is and re-renders whenever they differ. While
 * this returned the stored string, that was free — two equal strings are
 * Object.is-equal. Returning a freshly built `{ email, amount }` is not: every
 * call is a new reference, so React sees the store change on every render,
 * loops, and dies with "Maximum update depth exceeded".
 *
 * That crash was not cosmetic. It lands on the ONE page that tells an owner
 * their intake went through, so they saw a client-side exception over a
 * submission that had already been written and billed — and had no reason to
 * believe it worked. Reported from the field: "Jennifer & Agie's Flowershop",
 * 2026-09-28, whose row was perfect while the owner was staring at an error.
 *
 * So the parsed value is cached against the exact raw string it came from, and
 * re-parsed only when sessionStorage actually changes. The cache lives at module
 * scope on purpose: it must outlive the component, which is precisely the thing
 * being remounted on every one of those wasted renders.
 */
let cachedRaw: string | null | undefined;
let cachedReceipt: SubmittedReceipt | null = null;

export function readSubmitted(): SubmittedReceipt | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(RECEIPT_KEY);
        // `undefined` is the "never read" sentinel — getItem only ever returns
        // string | null, so it can never collide with a real stored value.
        if (raw === cachedRaw) return cachedReceipt;
        cachedRaw = raw;
        cachedReceipt = parseReceipt(raw);
        return cachedReceipt;
    } catch {
        return null;
    }
}
