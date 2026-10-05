/**
 * /admin/leads, the pure part: the rows the page reads, the add/edit form
 * rules (unchanged from the old page), and "how long has this waited" in
 * words. No React and no Convex client in here, so every function is plain
 * input to output.
 */
import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { computeQualityScore, DEFAULT_WEIGHTS } from "@/convex/lib/quality";

export const PAGE_TITLE = "Leads";
export const PAGE_SUB = "Which leads are going cold?";

// ── Rows ────────────────────────────────────────────────────────────────

/**
 * One row of api.leads.getAll: the lead document plus `businessName` (its
 * submission's name, or the literal "Unlinked") and `creatorName` ("N/A"
 * when there is none). The query returns the newest 500 leads of EVERY
 * source, Google Maps prospects included.
 */
export type LeadRow = FunctionReturnType<typeof api.leads.getAll>[number];

/** One row of api.submissions.getAll: the "Link to a submission" picker, and a linked site's city. */
export type SubmissionRow = FunctionReturnType<typeof api.submissions.getAll>[number];

/** One note from api.leadNotes.getByLead. */
export type NoteRow = FunctionReturnType<typeof api.leadNotes.getByLead>[number];

/**
 * One row of api.outscraper.listScrapedLeads: a Google Maps business a
 * creator pulled with Find a local business and nobody has interviewed yet.
 * The query builds its rows by hand and is untyped, hence this shape.
 */
export type Prospect = {
    _id: Id<"leads">;
    status: string;
    phone: string | null;
    businessName: string | null;
    businessAddress: string | null;
    businessCity: string | null;
    businessCategory: string | null;
    businessWebsite: string | null;
    businessLatitude: number | null;
    businessLongitude: number | null;
    businessRating: number | null;
    businessReviewCount: number | null;
    scrapedAt: number | null;
    createdAt: number;
    claimedAt?: number | null;
    claimedBy?: { creatorId: string; displayName: string; profileImage: string | null; isMine: boolean } | null;
};

// ── Query results ───────────────────────────────────────────────────────

/** A query read through useQueries: its data (undefined while loading), or the error it ended in. */
export type Loaded<T> = { data: T | undefined; error: Error | null };

/**
 * useQueries hands a failing query back as an Error value instead of
 * throwing it into the render, which is what useQuery does and what takes a
 * whole page down with it. A list that is not an array reads as an empty one
 * rather than crashing the first .filter().
 */
export function asList<T>(raw: unknown): Loaded<T[]> {
    if (raw instanceof Error) return { data: undefined, error: raw };
    if (raw === undefined) return { data: undefined, error: null };
    return { data: Array.isArray(raw) ? (raw as T[]) : [], error: null };
}

/**
 * The deployed listScrapedLeads has at times answered `{ leads, stats }`
 * instead of the array (see app/leads/_map/useDiscoverPins.ts). The old
 * Prospects tab iterated whatever came back and threw on that shape, so both
 * are accepted here.
 */
export function asProspects(raw: unknown): Loaded<Prospect[]> {
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw) && !(raw instanceof Error)) {
        const inner = (raw as { leads?: unknown }).leads;
        return { data: Array.isArray(inner) ? (inner as Prospect[]) : [], error: null };
    }
    return asList<Prospect>(raw);
}

/** The id Convex prints in a server error ("[Request ID: 1a2b3c…]"), which the team can look up in the logs. */
export function requestRef(error: Error | null | undefined): string | null {
    return /\[Request ID: ([^\]]+)\]/.exec(error?.message ?? "")?.[1] ?? null;
}

/**
 * A mutation's failure in words a person can act on. In production Convex
 * redacts a thrown Error to "Server Error"; a dev deployment keeps the
 * "Uncaught Error: …" line, and a client-side failure (an R2 upload) has its
 * own message.
 */
export function errorText(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : "";
    const uncaught = /Uncaught (?:Convex)?Error: ([^\n]+)/.exec(message)?.[1]?.trim();
    if (uncaught) return uncaught;
    if (!message || message.startsWith("[CONVEX") || message.includes("Server Error")) return fallback;
    return message;
}

// ── Status ──────────────────────────────────────────────────────────────

/** leads.status, in pipeline order. The words come from leadStatus() in components/r1. */
export const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];
export type StatusFilter = "all" | LeadStatusValue;

export function isLeadStatus(value: string): value is LeadStatusValue {
    return (LEAD_STATUSES as readonly string[]).includes(value);
}

/** Converted and lost are the two ends of the pipeline: nothing waits on them. */
export function isClosed(status: string): boolean {
    return status === "converted" || status === "lost";
}

export function countByStatus(rows: { status: string }[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
}

// ── Add / edit form (rules unchanged from the old page) ─────────────────

export type LeadForm = { name: string; phone: string; email: string; message: string };
export type LeadFormErrors = Partial<Record<"name" | "phone" | "email", string>>;
export const EMPTY_FORM: LeadForm = { name: "", phone: "", email: "", message: "" };

export function validateName(name: string): string | null {
    if (!name.trim()) return "Name is required";
    if (name.trim().length < 2) return "Name must be at least 2 characters";
    return null;
}

export function validatePhone(phone: string): string | null {
    if (!phone.trim()) return "Phone number is required";
    const digits = phone.replace(/[^\d+]/g, "");
    if (digits.length < 7) return "Phone number is too short";
    if (digits.length > 15) return "Phone number is too long";
    return null;
}

export function validateEmail(email: string): string | null {
    if (!email) return null; // optional
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
    return null;
}

export function validateLeadForm(form: LeadForm): LeadFormErrors {
    const errors: LeadFormErrors = {};
    const name = validateName(form.name);
    const phone = validatePhone(form.phone);
    const email = validateEmail(form.email);
    if (name) errors.name = name;
    if (phone) errors.phone = phone;
    if (email) errors.email = email;
    return errors;
}

// ── Customer leads ──────────────────────────────────────────────────────

/** The site a lead is linked to, or null. getAll says "Unlinked" when there is none. */
export function siteOf(lead: LeadRow): string | null {
    const name = lead.businessName?.trim();
    return name && name !== "Unlinked" ? name : null;
}

/** The creator credited with the lead, or null. getAll says "N/A" when there is none. */
export function creatorOf(lead: LeadRow): string | null {
    const name = lead.creatorName?.trim();
    return name && name !== "N/A" ? name : null;
}

/** name became optional when Google Maps prospects joined the table; never render an empty title. */
export function leadName(lead: LeadRow): string {
    return lead.name?.trim() || siteOf(lead) || "Unnamed lead";
}

const SOURCE_WORDS: Record<string, string> = {
    website: "Website",
    qr_code: "QR code",
    direct: "Direct",
    outscraper: "Google Maps",
};

export function sourceWord(source: string): string {
    if (SOURCE_WORDS[source]) return SOURCE_WORDS[source];
    const s = source.replace(/_/g, " ").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
}

/**
 * Where the lead came from, for the drawer's subtitle. "direct" is not only
 * an admin's manual add: submissions.submit and the owner's own /start intake
 * both write a direct lead for the business owner, so it does not claim who.
 */
export function originLine(lead: LeadRow): string {
    const site = siteOf(lead);
    switch (lead.source) {
        case "website":
            return site ? `Messaged through the ${site} website` : "Messaged through a Tendso site";
        case "qr_code":
            return site ? `Scanned the QR code at ${site}` : "Scanned a Tendso QR code";
        case "outscraper":
            return site ? `Found on Google Maps, then interviewed for ${site}` : "Found on Google Maps";
        default:
            return site ? `Direct lead for ${site}` : "Direct lead, no site linked";
    }
}

// ── Time ────────────────────────────────────────────────────────────────

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A new lead with no reply for this long is going cold (the board's 3 days). */
export const COLD_AFTER_MS = 3 * DAY;
/** A prospect claim lasts 24 hours: outscraper.releaseStaleClaimsInternal clears older ones hourly, at :45. */
export const CLAIM_MS = 24 * HOUR;
/** A claim this close to lapsing counts as going cold. */
export const LAPSING_MS = 6 * HOUR;

/** "Just now", "45 min", "6 hours", "3 days". */
export function ageText(ms: number): string {
    if (ms < MINUTE) return "Just now";
    if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min`;
    const hours = Math.floor(ms / HOUR);
    if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? "day" : "days"}`;
}

/** "Sep 23", with the year only when it is not this year. */
export function shortDate(ts: number, now: number): string {
    const d = new Date(ts);
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return d.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

/** For notes: "Just now", "12 min ago", "3 hours ago", then the date. */
export function whenText(ts: number, now: number): string {
    const ms = now - ts;
    if (ms < MINUTE) return "Just now";
    if (ms < DAY) return `${ageText(ms)} ago`;
    return shortDate(ts, now);
}

export type Waiting = { text: string; sub: string | null; cold: boolean };

/**
 * How long a customer lead has waited. leads has no "last updated" field, so
 * waiting counts from when the lead came in (createdAt). For a New lead that
 * is exact (nobody has moved it yet); for Contacted and Qualified the sub
 * line says what the number measures instead of implying a last touch.
 */
export function leadWaiting(lead: { status: string; createdAt: number }, now: number): Waiting {
    if (isClosed(lead.status)) return { text: "Closed", sub: null, cold: false };
    const age = Math.max(0, now - lead.createdAt);
    if (lead.status === "new") {
        const cold = age >= COLD_AFTER_MS;
        return { text: ageText(age), sub: cold ? "No reply yet" : null, cold };
    }
    return { text: ageText(age), sub: "since received", cold: false };
}

export function isColdLead(lead: { status: string; createdAt: number }, now: number): boolean {
    return lead.status === "new" && now - lead.createdAt >= COLD_AFTER_MS;
}

// ── Prospects ───────────────────────────────────────────────────────────

export function prospectName(p: Prospect): string {
    return p.businessName?.trim() || "Unnamed business";
}

export function prospectPlace(p: Prospect): string {
    return [p.businessCategory, p.businessCity].filter(Boolean).join(" · ") || p.businessAddress || "Google Maps listing";
}

export function claimerName(p: Prospect): string {
    return p.claimedBy?.displayName || "A creator";
}

/** Milliseconds until a prospect's claim lapses, or null when nobody has claimed it. */
export function claimLeft(p: Prospect, now: number): number | null {
    return p.claimedAt ? p.claimedAt + CLAIM_MS - now : null;
}

/**
 * After "the claim": "lapses in 3 hours", "lapses within the hour", or "is
 * lapsing now" once the 24 hours are up and the hourly sweep has not run yet.
 */
export function lapsePhrase(ms: number): string {
    if (ms <= 0) return "is lapsing now";
    if (ms < HOUR) return "lapses within the hour";
    const hours = Math.floor(ms / HOUR);
    return `lapses in ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** The same on its own, for a table cell: "Lapses in 3 hours", "Lapsing now". */
export function lapseLabel(ms: number): string {
    if (ms <= 0) return "Lapsing now";
    const phrase = lapsePhrase(ms);
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export function isColdProspect(p: Prospect, now: number): boolean {
    const left = claimLeft(p, now);
    return !isClosed(p.status) && left !== null && left <= LAPSING_MS;
}

/** The Waiting column: how long the current claim has run, or that nobody has claimed it. */
export function prospectWaiting(p: Prospect, now: number): Waiting {
    if (isClosed(p.status)) return { text: "Closed", sub: null, cold: false };
    if (!p.claimedAt) return { text: "Not claimed", sub: null, cold: false };
    const cold = isColdProspect(p, now);
    return { text: ageText(Math.max(0, now - p.claimedAt)), sub: cold ? "Lapsing" : null, cold };
}

export type ScoreRow = { label: string; points: number };

/**
 * The 0–100 quality score. Legacy Google Maps leads carry no stored score,
 * so it is worked out here with the backend's own computeQualityScore and
 * DEFAULT_WEIGHTS (convex/lib/quality.ts), the formula the board's fold
 * spells out. The breakdown rows mirror that function's caps (reviews up to
 * 30, rating up to 20); the total always comes from the function itself.
 */
export function prospectScore(p: Prospect): { total: number; rows: ScoreRow[] } {
    const w = DEFAULT_WEIGHTS;
    const hasWebsite = !!p.businessWebsite?.trim();
    const hasPhone = !!p.phone?.trim();
    const reviews = p.businessReviewCount;
    const rating = p.businessRating;
    const reviewPts = reviews != null ? Math.min(reviews * w.reviewCountMultiplier, 30) : 0;
    const ratingPts = rating != null && rating > w.minRating ? Math.min((rating - w.minRating) * 10, 20) : 0;
    return {
        total: computeQualityScore({ hasWebsite, hasPhone, rating, reviewCount: reviews }, w),
        rows: [
            { label: `Website found (${w.hasWebsite})`, points: hasWebsite ? w.hasWebsite : 0 },
            { label: `Phone number found (${w.hasPhone})`, points: hasPhone ? w.hasPhone : 0 },
            { label: `Reviews, ${w.reviewCountMultiplier} each (up to 30)`, points: Math.round(reviewPts * 10) / 10 },
            { label: `Rating above ${w.minRating.toFixed(1)} (up to 20)`, points: Math.round(ratingPts * 10) / 10 },
        ],
    };
}

export function pointsText(points: number): string {
    return `+${Number.isInteger(points) ? points : points.toFixed(1)}`;
}

export function ratingLine(p: Prospect): string {
    const reviews = p.businessReviewCount ?? 0;
    const count = `${reviews.toLocaleString("en-US")} ${reviews === 1 ? "review" : "reviews"}`;
    if (p.businessRating != null) return `${p.businessRating.toFixed(1)} from ${count}`;
    return reviews ? `No rating, ${count}` : "No rating yet";
}

// ── Lists ───────────────────────────────────────────────────────────────

/** Case-insensitive "does any of these contain the query". An empty query matches everything. */
export function matches(fields: Array<string | null | undefined>, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/** "A, B, C and 2 more": the going-cold answer names the first few, not fifty. */
export function listNames(names: string[], max = 3): string {
    if (names.length <= max) return names.join(", ");
    return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/** List pages show 8–10 rows with the page text under them. */
export const PAGE_SIZE = 10;

export function pageOf<T>(rows: T[], page: number): { rows: T[]; page: number; pages: number } {
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const current = Math.min(Math.max(1, page), pages);
    return { rows: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, pages };
}

/** "Waiting longest first · showing 10 of 236 · page 1 of 24". */
export function pageText(order: string, shown: number, total: number, page: number, pages: number): string {
    const base = `${order} · showing ${shown} of ${total}`;
    return pages > 1 ? `${base} · page ${page} of ${pages}` : base;
}

// ── Links ───────────────────────────────────────────────────────────────

export function telHref(phone: string): string {
    return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

/** Google Maps sometimes gives a bare domain; a link without a scheme would resolve inside the admin. */
export function websiteHref(url: string): string {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function websiteText(url: string): string {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function mapsHref(lat: number, lng: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// ── Social card ─────────────────────────────────────────────────────────

/**
 * What the fold says while closed, from the SAVED fields. Mobile renders the
 * social card as soon as any one of them is set (hasEnrichedContent).
 */
export function cardSummary(lead: { adminDescription?: string | null; externalPreviewUrl?: string | null; previewImageUrl?: string | null }): string {
    const image = !!lead.previewImageUrl;
    const description = !!lead.adminDescription?.trim();
    const link = !!lead.externalPreviewUrl?.trim();
    if (image && description) return "Image and description set";
    if (image) return "Image set, no description";
    if (description) return "Description set, no image";
    if (link) return "Link set, no image or description";
    return "Empty. Creators see the plain lead.";
}
