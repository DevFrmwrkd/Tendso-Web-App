/**
 * Shared types for the automatic AI site-building pipeline (brief §4C).
 * Pure: no Convex, no Node, no network. See docs/v2-ai-pipeline.md.
 */

/** The four steps the owner watches. Same keys as the buildProgress contract. */
export type StepKey = 'reading_interview' | 'writing_pages' | 'polishing_photos' | 'building_site';

export type StepStatus = 'pending' | 'running' | 'done' | 'failed';

/** One question and its answer, typed or recorded. */
export interface InterviewAnswer {
    q: string;
    /** Typed answer, or the transcript of the recording once we have it. */
    a: string;
    /** A recording still to transcribe (owner app). */
    mediaUrl?: string;
}

/** A photo to place on the site, in submission order. */
export interface PipelineShot {
    /** Position in the submission's photo list (stable key for idempotency). */
    index: number;
    url: string;
    /** Legacy positional role (headshot, interior_1, …) when known. */
    role?: string;
    /** Owner-app shot label ("Owner headshot", "Inside", …) when known. */
    label?: string;
}

/** Everything the pipeline reads from a submission, as one plain snapshot. */
export interface PipelineInput {
    submissionId: string;
    businessName: string;
    businessType: string;
    ownerName: string;
    ownerPhone: string;
    ownerEmail: string;
    address: string;
    city: string;
    coordinates?: { lat: number; lng: number };
    contentSource?: string;
    /** Q&A pairs (owner intake, owner app). */
    answers: InterviewAnswer[];
    /** Free transcript (creator funnel recording, or synthesized from answers). */
    transcript: string;
    transcriptionStatus?: string;
    /** A recording on the submission that has no transcript yet. */
    mainMediaUrl?: string;
    mainMediaType?: 'video' | 'audio';
    shots: PipelineShot[];
    /** Template code the owner or an admin chose (e.g. `barbershop:BP`). */
    chosenTemplate?: string;
    fontChoice?: string;
    colorChoice?: string;
    /** Owner asked to keep their own photos. */
    keepOriginals: boolean;
    /** A built site already exists (html stored). */
    hasBuiltSite: boolean;
    /** That site is published. */
    isPublished: boolean;
}

export interface ServiceFact {
    name: string;
    /** As the owner said it, normalised to "₱150" / "₱150–₱300". Empty when not said. */
    price: string;
    /** Short detail in the owner's words ("with hot towel"). Empty when not said. */
    note: string;
}

export interface HoursFact {
    days: string;
    time: string;
}

/** Structured facts. Every field is optional in spirit: missing → '' or []. */
export interface Facts {
    businessName: string;
    ownerName: string;
    businessType: string;
    address: string;
    city: string;
    landmark: string;
    phone: string;
    email: string;
    facebook: string;
    services: ServiceFact[];
    hours: HoursFact[];
    hoursNote: string;
    yearStarted: string;
    story: string;
    customersLove: string[];
    /** Words the owner reported customers saying. Never names. */
    customerQuotes: string[];
    paymentMethods: string[];
    areasServed: string[];
    /** Short phrases in the owner's own voice, verbatim. */
    ownerQuotes: string[];
    language: 'en' | 'tl' | 'taglish' | '';
}

/** Page copy written from the facts. Short, owner's words, nothing invented. */
export interface Copy {
    tagline: string;
    heroKicker: string;
    heroHeadline: string;
    heroSub: string;
    aboutHeadline: string;
    aboutLead: string;
    aboutParagraphs: string[];
    servicesHeadline: string;
    serviceDescriptions: Array<{ name: string; desc: string }>;
    ctaHeading: string;
    footerBlurb: string;
}

export type ShotType = 'portrait' | 'action' | 'interior' | 'exterior' | 'detail' | 'sign';

/** Outcome for one photo. `kept` = the original stays (failed QC, skipped, off). */
export interface PhotoResult {
    index: number;
    shotType: ShotType;
    outcome: 'polished' | 'kept';
    /** Why the original was kept, or 'passed'. */
    reason: string;
    originalUrl: string;
    /** Ordered source references used for this result; absent legacy results cannot be reused. */
    referenceUrls?: string[];
    /** Convex storage id of the polished image (when polished). */
    storageId?: string;
    url?: string;
    providerRequestId?: string;
    qcScore?: number;
}

export interface LlmUsage {
    provider: 'gemini' | 'groq';
    model: string;
    inputTokens: number;
    outputTokens: number;
}

/** Counters used for the per-site cost estimate. */
export interface UsageTotals {
    llmCalls: number;
    llmInputTokens: number;
    llmOutputTokens: number;
    visionChecks: number;
    imageJobs: number;
    transcribedClips: number;
    transcribedMainRecording: number;
}
