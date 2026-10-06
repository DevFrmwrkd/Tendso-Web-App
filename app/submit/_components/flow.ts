/**
 * The New submission flow's shared rules (board: NewSubmission). Pure: no
 * React, no Convex, so every step reads the same limits and says the same
 * words.
 *
 * Four steps, four routes: /submit/info → /submit/photos → /submit/interview →
 * /submit/review, then /submit/success. Each step saves to Convex before the
 * next one opens; the draft's id travels between them in sessionStorage
 * under DRAFT_ID_KEY, exactly as before the redesign.
 */

/** sessionStorage key the steps share. Unchanged: the mobile web view and old tabs read it too. */
export const DRAFT_ID_KEY = "current_submission_id"

export const STEP_NAMES = ["Business", "Photos", "Interview", "Review"]

/*
 * Limits. The photo floor is also enforced by submissions.submit (it throws
 * under 3); the type allow-list and the size caps are what the Airtable/Studio
 * pipeline downstream accepts. Same numbers as the pages before the redesign.
 */
export const MIN_PHOTOS = 3
export const MAX_PHOTOS = 10
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export const PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png"]
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024

export const INTERVIEW_QUESTIONS = [
    "What does your business do and who are your customers?",
    "What are the main services or products you offer?",
    "What makes your business different from others? Why do customers choose you?",
    "Can you share a favorite customer story or project you're proud of?",
    "What should customers know before visiting or contacting you?",
]

/**
 * A stored photo or media value as a URL the browser can load, without a
 * server round-trip: full URLs pass through, R2 relative paths (images/…,
 * videos/…, audio/…) get NEXT_PUBLIC_R2_PUBLIC_URL in front. Null for a
 * Convex storage id, which only files.getMultipleUrls / getUrlByString can
 * resolve.
 */
export function directMediaUrl(val: string | null | undefined): string | null {
    if (!val) return null
    if (val.startsWith("http://") || val.startsWith("https://")) return val
    const r2PublicUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/$/, "")
    if (/^(images|videos|audio)\//.test(val) && r2PublicUrl) return `${r2PublicUrl}/${val}`
    return null
}

/** "3.1 MB", for a file the creator just picked. */
export function fileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** "04:07": the recording clock. */
export function clock(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/* ── Recording format ──────────────────────────────────────────────────── */

/**
 * Recording formats, best first. Chrome and Android record WebM (VP8 is the
 * codec most phones encode in hardware); an iPhone records MP4 and may not
 * play WebM back at all. Recording was fixed to WebM VP9, so on such a phone
 * the creator could not watch what they had just recorded.
 */
const RECORDING_TYPES = {
    video: ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"],
    audio: ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"],
} as const

/**
 * The format to record in: the first this browser can both record and play
 * back, else the first it can record, else undefined (the browser's own pick).
 * `canPlay` is asked about the container ("video/webm").
 */
export function pickRecordingType(
    kind: "video" | "audio",
    canRecord: (type: string) => boolean,
    canPlay: (container: string) => boolean,
): string | undefined {
    const types: readonly string[] = RECORDING_TYPES[kind]
    return types.find((t) => canRecord(t) && canPlay(containerType(t))) ?? types.find((t) => canRecord(t))
}

/** "video/webm;codecs=vp8,opus" → "video/webm": the type a recording is filed under. */
export function containerType(type: string): string {
    return type.split(";")[0].trim().toLowerCase()
}

/** The name a recording uploads under; its R2 key takes the extension from it. */
export function recordingFileName(type: string): string {
    const container = containerType(type)
    const ext = container === "video/mp4" ? "mp4" : container === "audio/mp4" ? "m4a" : container.endsWith("/ogg") ? "ogg" : "webm"
    return `interview.${ext}`
}

/**
 * A browser's WebM recording carries no duration, so its player shows no
 * length and cannot seek. Seeking far past the end makes the browser work the
 * length out, then it goes back to the start. Call it on loadedmetadata.
 */
export function showFullLength(media: HTMLMediaElement) {
    if (media.duration !== Infinity) return
    media.addEventListener(
        "timeupdate",
        () => {
            media.currentTime = 0
        },
        { once: true },
    )
    media.currentTime = Number.MAX_SAFE_INTEGER
}

export function errorText(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback
}

/* ── The owner's phone ───────────────────────────────────────────────────
 *
 * The field shows the number the way people write it (0917 123 4567, 11
 * digits, ComponentKit "Phone, digits only"). The DRAFT keeps the format it
 * always had: the 10 digits after +63 ("9171234567"). That is what this
 * page stored behind its old "+63" chip, what lib/prospectPrefill's
 * toLocalPhDigits produces for a lead, and what existing drafts hold, so
 * nothing downstream sees a new shape. (Every reader normalises both forms
 * anyway: convex/lib/phone.ts, convex/domains.ts.)
 */

/** A stored phone, as the field shows it. */
export function phoneToField(stored: string | null | undefined): string {
    const d = (stored ?? "").replace(/\D/g, "")
    if (/^9\d{9}$/.test(d)) return `0${d}`
    if (/^639\d{9}$/.test(d)) return `0${d.slice(2)}`
    return d
}

/** The field's value, as the draft stores it. */
export function phoneToStored(field: string): string {
    return /^09\d{9}$/.test(field) ? field.slice(1) : field
}

/** "0917 123 4567" for reading back to the owner; anything odd is shown as stored. */
export function phoneForReading(stored: string | null | undefined): string {
    const f = phoneToField(stored)
    return /^09\d{9}$/.test(f) ? `${f.slice(0, 4)} ${f.slice(4, 7)} ${f.slice(7)}` : (stored ?? "")
}

/* ── Step 1: the business details ─────────────────────────────────────── */

export type InfoValues = {
    businessName: string
    businessType: string
    ownerName: string
    /** As the field shows it (0917…). */
    ownerPhone: string
    ownerEmail: string
    city: string
    address: string
}

export type InfoField = keyof InfoValues

/** On-screen order, which is also the order the errors are counted in. */
export const INFO_FIELDS: InfoField[] = ["businessName", "businessType", "ownerName", "ownerPhone", "ownerEmail", "city", "address"]

const FIELD_NAMES: Record<InfoField, string> = {
    businessName: "business name",
    businessType: "type",
    ownerName: "owner’s name",
    ownerPhone: "owner’s phone",
    ownerEmail: "email",
    city: "city",
    address: "street address",
}

/** One message per field that needs a fix. Empty when the step can be saved and left. */
export function infoErrors(v: InfoValues): Partial<Record<InfoField, string>> {
    const e: Partial<Record<InfoField, string>> = {}
    if (!v.businessName.trim()) e.businessName = "Add the business name."
    if (!v.businessType) e.businessType = "Pick the type of business."
    if (!v.ownerName.trim()) e.ownerName = "Add the owner’s full name."
    if (!v.ownerPhone) e.ownerPhone = "Add the owner’s phone number."
    else if (!/^09\d{9}$/.test(v.ownerPhone)) e.ownerPhone = "Use 11 digits starting with 09, like 0917 123 4567."
    if (v.ownerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.ownerEmail)) e.ownerEmail = "Check the email. It needs an @ and a domain, like name@gmail.com."
    if (!v.city.trim()) e.city = "Add the city or municipality."
    if (!v.address.trim()) e.address = "Add the street, and the house or stall number."
    return e
}

/** "Owner’s phone, street address": what is still missing, for the rail. */
export function missingLine(errors: Partial<Record<InfoField, string>>): string {
    const names = INFO_FIELDS.filter((k) => errors[k]).map((k) => FIELD_NAMES[k])
    const line = names.join(", ")
    return line.charAt(0).toUpperCase() + line.slice(1)
}

/** A saved draft's business details, in the shape step 1 validates. */
export function infoFromDoc(doc: {
    businessName?: string
    businessType?: string
    ownerName?: string
    ownerPhone?: string
    ownerEmail?: string
    city?: string
    address?: string
}): InfoValues {
    return {
        businessName: doc.businessName ?? "",
        businessType: doc.businessType ?? "",
        ownerName: doc.ownerName ?? "",
        ownerPhone: phoneToField(doc.ownerPhone),
        ownerEmail: doc.ownerEmail ?? "",
        city: doc.city ?? "",
        address: doc.address ?? "",
    }
}

/** "Noy", from "Noy Villanueva". Empty when no name is known yet. */
export function firstNameOf(ownerName: string | null | undefined): string {
    return (ownerName ?? "").trim().split(/\s+/)[0] ?? ""
}

/* ── The interview ───────────────────────────────────────────────────── */

/**
 * The interview already saved on a draft. Web uploads write videoUrl/audioUrl
 * (R2); older and mobile drafts carry the storage-id fields. Video wins when
 * both exist, as on the review page and in submissions.update.
 */
export function savedInterviewKind(doc: {
    videoUrl?: string
    videoStorageId?: string
    audioUrl?: string
    audioStorageId?: string
} | null | undefined): "video" | "audio" | null {
    if (!doc) return null
    if (doc.videoUrl || doc.videoStorageId) return "video"
    if (doc.audioUrl || doc.audioStorageId) return "audio"
    return null
}

/* ── The rail: what is still needed from this shop ───────────────────── */

export type NeedState = "done" | "now" | "todo"
export type NeedRow = { label: string; meta: string; state: NeedState }

/**
 * The four things a creator must leave the shop with (board rail, steps 1–3).
 * `step` is the 0-based step showing, so its own row reads "now".
 */
export function needRows({
    step,
    businessErrors,
    photoCount,
    interview,
    ownerName,
}: {
    step: 0 | 1 | 2
    businessErrors: Partial<Record<InfoField, string>>
    photoCount: number
    /** Saved kind; "recording" while the recorder runs; "pending" for a recording or file not uploaded yet. */
    interview: "video" | "audio" | "recording" | "pending" | null
    ownerName: string
}): NeedRow[] {
    const state = (ok: boolean, own: number): NeedState => (ok ? "done" : step === own ? "now" : "todo")
    const businessOk = Object.keys(businessErrors).length === 0
    const photosOk = photoCount >= MIN_PHOTOS
    const interviewOk = interview === "video" || interview === "audio"
    const first = firstNameOf(ownerName)
    const who = first || "the owner"
    return [
        { label: "Business details", meta: businessOk ? "All filled in" : missingLine(businessErrors), state: state(businessOk, 0) },
        {
            label: "Photos",
            meta: photosOk
                ? `${photoCount} added`
                : photoCount === 0
                  ? `None yet · at least ${MIN_PHOTOS} needed`
                  : `${photoCount} added · ${MIN_PHOTOS - photoCount} more needed`,
            state: state(photosOk, 1),
        },
        {
            label: "The interview",
            meta:
                interview === "video"
                    ? "Video"
                    : interview === "audio"
                      ? "Audio"
                      : interview === "recording"
                        ? "Recording now"
                        : interview === "pending"
                          ? "Recorded · uploads when you continue"
                          : "Not recorded yet",
            state: state(interviewOk, 2),
        },
        {
            label: first ? `${first}’s OK on the price` : "The owner’s OK on the price",
            meta: `Agree your price with ${who} on the last step. It is paid after the site is live.`,
            // Ticked on the review step only, where this rail gives way to the price card.
            state: "todo",
        },
    ]
}
