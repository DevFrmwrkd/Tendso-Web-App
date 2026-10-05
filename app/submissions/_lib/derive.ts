/**
 * What the Submissions screen says about one submission, worked out from the
 * row alone (board: Submissions). Pure: no React, no Convex and no clock; the
 * caller passes `now`, so a render never reads the time itself.
 *
 * Status WORDS still come from components/r1 statusWords.submissionStatus();
 * this file only groups the raw statuses into the chips, the drawer's
 * "what happens next", and the progress steps.
 */
// The two plain modules behind the components/r1 barrel, so this file stays
// free of React.
import { formatMoney } from "@/components/r1/money";
import type { Tone } from "@/components/r1/statusWords";
import type { Doc } from "@/convex/_generated/dataModel";
import { COMMISSION_RATE, isComped, ownerChargeFor } from "@/lib/pricing";

export type Submission = Doc<"submissions">;

/** The creator's share as a whole percentage (50), for copy that states the rule rather than a peso figure. */
export const SHARE_PERCENT = Math.round(COMMISSION_RATE * 100);

// ── Where a submission is ────────────────────────────────────────────────

/**
 * Where a submission is on its way to being paid. Several raw statuses share
 * a stage, exactly the groups submissionStatus() gives one word each.
 */
export type Stage = "draft" | "review" | "building" | "live" | "paid" | "rejected" | "offline" | "other";

export function stageOf(status: string): Stage {
    switch (status) {
        case "draft":
            return "draft";
        case "pending":
        case "submitted":
        case "in_review":
            return "review";
        case "approved":
        case "website_generated":
            return "building";
        case "deployed":
        case "pending_payment":
            return "live";
        case "paid":
        case "completed":
            return "paid";
        case "rejected":
            return "rejected";
        case "unpublished":
            return "offline";
        default:
            return "other";
    }
}

// ── Filter chips ─────────────────────────────────────────────────────────

export type Filter = "all" | "progress" | "paid" | "drafts" | "rejected";

export const FILTERS: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "progress", label: "In progress" },
    { value: "paid", label: "Paid" },
    { value: "drafts", label: "Drafts" },
    { value: "rejected", label: "Rejected" },
];

/** `?filter=` from the URL; anything unknown is All. */
export function parseFilter(raw: string | null): Filter {
    return FILTERS.some((f) => f.value === raw) ? (raw as Filter) : "all";
}

/**
 * The chip a stage sits under. A site taken offline for non-payment
 * ("Unpublished", an Off status) and any status this page does not know
 * belong to none of the four and show under All only.
 */
export function filterOf(stage: Stage): Exclude<Filter, "all"> | null {
    switch (stage) {
        case "draft":
            return "drafts";
        case "review":
        case "building":
        case "live":
            return "progress";
        case "paid":
            return "paid";
        case "rejected":
            return "rejected";
        default:
            return null;
    }
}

// ── A draft and what it still needs ──────────────────────────────────────

/** submissions.submit refuses a draft with fewer photos than this (convex/submissions.ts). */
export const MIN_PHOTOS = 3;

export function photoCount(s: Submission): number {
    return s.photos?.length ?? 0;
}

/**
 * The interview's kind, or null when there is none. R2 URLs (videoUrl /
 * audioUrl) count as well as the legacy Convex storage ids; video wins over
 * audio, as on the old detail page.
 */
export function interviewKind(s: Submission): "video" | "audio" | null {
    if (s.videoUrl || s.videoStorageId) return "video";
    if (s.audioUrl || s.audioStorageId) return "audio";
    return null;
}

const INFO_FIELDS = [
    ["businessName", "name"],
    ["businessType", "type"],
    ["address", "address"],
    ["city", "city"],
    ["ownerName", "owner"],
    ["ownerPhone", "owner's phone"],
] as const;

/** Step 1 of New submission: the business details still blank. */
export function missingInfo(s: Submission): string[] {
    return INFO_FIELDS.filter(([key]) => !(s[key] ?? "").trim()).map(([, label]) => label);
}

export type DraftGap = "details" | "photos" | "interview";

/** What a draft still needs, in the order the New submission flow asks for it. */
export function draftGaps(s: Submission): DraftGap[] {
    const gaps: DraftGap[] = [];
    if (missingInfo(s).length > 0) gaps.push("details");
    if (photoCount(s) < MIN_PHOTOS) gaps.push("photos");
    if (!interviewKind(s)) gaps.push("interview");
    return gaps;
}

const GAP_NOTE: Record<DraftGap, string> = {
    details: "details missing",
    photos: "photos missing",
    interview: "interview missing",
};

/** The list row's "Draft · photos missing": the first thing the draft needs. */
export function draftNote(s: Submission): string {
    const first = draftGaps(s)[0];
    return first ? GAP_NOTE[first] : "ready to send";
}

/** "a", "a and b", "a, b and c". */
export function listWords(words: string[]): string {
    if (words.length <= 1) return words.join("");
    return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function photosText(n: number): string {
    return n > 0 ? plural(n, "photo") : "None yet";
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The drawer's "What happens next" for a draft. */
export function draftNextStep(s: Submission): string {
    const photos = photoCount(s);
    const todo = draftGaps(s).map((gap) => {
        if (gap === "details") return "finish the business details";
        if (gap === "photos") {
            return photos === 0 ? `add at least ${MIN_PHOTOS} photos` : `add ${plural(MIN_PHOTOS - photos, "more photo")}`;
        }
        return "record the owner interview";
    });
    if (todo.length === 0) return "Check the details and the price, then send it in — Tendso reviews it from there.";
    return `${capitalize(listWords(todo))}, then send it in — Tendso reviews it from there.`;
}

export type CheckItem = { tone: Tone; name: string; meta: string; todo?: boolean };

/** The drawer's "Still to do" for a draft: the four steps of New submission. */
export function draftChecklist(s: Submission): CheckItem[] {
    const missing = missingInfo(s);
    const photos = photoCount(s);
    const kind = interviewKind(s);
    return [
        missing.length > 0
            ? { tone: "attn", name: "Business info", meta: `Missing the ${listWords(missing)}` }
            : { tone: "done", name: "Business info", meta: "Done · name, type, address, owner" },
        photos >= MIN_PHOTOS
            ? { tone: "done", name: "Photos", meta: `Done · ${plural(photos, "photo")}` }
            : { tone: "attn", name: "Photos", meta: `${photos} of ${MIN_PHOTOS} minimum · storefront, inside, products` },
        kind
            ? { tone: "done", name: "Owner interview", meta: `Done · ${kind} recording` }
            : { tone: "attn", name: "Owner interview", meta: "Not recorded · about 30 minutes" },
        { tone: "off", name: "Review and submit", meta: "Check the details and the price, then send", todo: true },
    ];
}

// ── Money ────────────────────────────────────────────────────────────────

/**
 * The creator's share as stored on the row: commissionFor(sell price), set
 * when the price is chosen at the review step. Null when the row has none,
 * and then no figure is shown rather than a guessed one.
 */
export function shareOf(s: Submission): number | null {
    return typeof s.creatorPayout === "number" ? s.creatorPayout : null;
}

/** What the share is waiting on, under the amount in a list row. Null: nothing to earn (rejected). */
export function rowShareNote(stage: Stage): string | null {
    switch (stage) {
        case "draft":
        case "review":
        case "building":
            return "once it's paid";
        case "live":
            return "pending";
        case "offline":
            return "if the owner pays";
        case "paid":
            return "earned";
        default:
            return null;
    }
}

/** The same, beside the status in the drawer's head. */
export function headShareNote(stage: Stage): string | null {
    if (stage === "draft" || stage === "review" || stage === "building") return "once it's live and paid";
    return rowShareNote(stage);
}

/**
 * The line beside the chips: "₱500 earned so far · ₱500 waiting on the owner
 * of Neighborhood". Earned is the share on every Paid row (the Paid chip);
 * waiting is the share on every live site whose owner has not paid yet. A
 * part that would read ₱0 is left out, and so is the line.
 */
export function summaryOf(list: Submission[]): string | null {
    const earned = list.filter((s) => stageOf(s.status) === "paid").reduce((sum, s) => sum + (shareOf(s) ?? 0), 0);
    const waiting = list.filter((s) => stageOf(s.status) === "live" && (shareOf(s) ?? 0) > 0);
    const waitingTotal = waiting.reduce((sum, s) => sum + (shareOf(s) ?? 0), 0);
    const parts: string[] = [];
    if (earned > 0) parts.push(`${formatMoney(earned)} earned so far`);
    if (waitingTotal > 0) {
        const who = waiting.length === 1 ? `the owner of ${waiting[0].businessName}` : `${waiting.length} owners`;
        parts.push(`${formatMoney(waitingTotal)} waiting on ${who}`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
}

// ── Words and dates ──────────────────────────────────────────────────────

/** The owner by name, for sentences ("When Raflyn S. pays…"). */
export function ownerOf(s: Submission): string {
    return s.ownerName?.trim() || "the owner";
}

/** "Restaurant · Jaro, Iloilo City" */
export function metaOf(s: Submission): string {
    const place = [s.barangay, s.city].filter((p) => p && p.trim()).join(", ");
    return [s.businessType, place].filter(Boolean).join(" · ");
}

/** "Sep 27", or "Sep 27, 2025" outside the current year. */
export function formatDay(ts: number, now: number): string {
    const d = new Date(ts);
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return d.toLocaleDateString(
        "en-US",
        sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
    );
}

/** "Sep 27, 2026, 3:14 PM": the old detail page's "Created on", which kept the time. */
export function formatMoment(ts: number): string {
    return new Date(ts).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

// ── The site ─────────────────────────────────────────────────────────────

/**
 * The latest live URL. submission.websiteUrl can go stale after edits or
 * custom-domain activation; the generatedWebsites record holds the
 * authoritative current deployment.
 * Priority: custom domain when live → generatedWebsite.customDomain →
 * publishedUrl → legacy websiteUrl. (Unchanged from the old detail page.)
 */
export function latestSiteUrl(
    s: Submission,
    website: { customDomain?: string | null; publishedUrl?: string | null } | null | undefined,
): string | null {
    const normalize = (u: string) => (u.startsWith("http") ? u : `https://${u}`);
    return (
        (s.domainStatus === "live" && s.requestedDomain ? normalize(s.requestedDomain) : null) ||
        (website?.customDomain ? normalize(website.customDomain) : null) ||
        website?.publishedUrl ||
        s.websiteUrl ||
        null
    );
}

/** "neighborhood.sites.tendso.com" from "https://neighborhood.sites.tendso.com/". */
export function hostOf(url: string): string {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// ── Progress ─────────────────────────────────────────────────────────────

export type Step = { tone: Tone; name: string; meta?: string | null; todo?: boolean };

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;

/**
 * The drawer's "Progress" (board: Submitted → Reviewed → Site live → Owner
 * paid → You get paid), dated from what the row records: reviewedAt, the
 * site's publishedAt, paidAt (or the pay link's paymentReceivedAt, or the
 * moment the creator was credited, which the same mutation writes),
 * compedAt, creatorPaidAt, unpublishedAt. The row keeps no time of
 * submission, so "Submitted" has no date.
 */
export function progressSteps(
    s: Submission,
    stage: Stage,
    now: number,
    dates: { publishedAt?: number | null; paymentReceivedAt?: number | null } = {},
): Step[] {
    const day = (ts?: number | null) => (ts ? formatDay(ts, now) : null);
    const share = shareOf(s);
    const steps: Step[] = [{ tone: "done", name: "Submitted" }];
    if (stage === "other" || stage === "draft") return steps;

    if (stage === "review") {
        steps.push({ tone: "progress", name: "Reviewed", meta: "Tendso is reviewing it" });
    } else if (stage === "rejected") {
        steps.push({ tone: "bad", name: "Reviewed", meta: join(day(s.reviewedAt), "rejected") });
        return steps;
    } else {
        steps.push({ tone: "done", name: "Reviewed", meta: join(day(s.reviewedAt), "approved") });
    }

    if (stage === "review") steps.push({ tone: "off", name: "Site live", todo: true });
    else if (stage === "building") steps.push({ tone: "progress", name: "Site live", meta: "Site generated, not live yet" });
    else steps.push({ tone: "done", name: "Site live", meta: day(dates.publishedAt) });

    if (stage === "offline") {
        steps.push({ tone: "off", name: "Taken offline", meta: join(day(s.unpublishedAt), "the owner had not paid") });
    }

    const ownerPaidAt = s.paidAt ?? dates.paymentReceivedAt ?? s.creatorPaidAt;
    if (stage === "paid") {
        steps.push(
            isComped(s)
                ? { tone: "done", name: "Owner paid", meta: join(day(s.compedAt), `free promo site, ${formatMoney(0)}`) }
                : { tone: "done", name: "Owner paid", meta: join(day(ownerPaidAt), s.amount ? formatMoney(ownerChargeFor(s)) : null) },
        );
        steps.push({
            tone: "done",
            name: "You get paid",
            meta: join(day(s.creatorPaidAt ?? ownerPaidAt), share !== null ? `${formatMoney(share)} to your Wallet` : "to your Wallet"),
        });
        return steps;
    }

    if (stage === "live" || stage === "offline") {
        steps.push({ tone: "progress", name: "Owner paid", meta: join(`Waiting for ${ownerOf(s)}`, s.amount ? formatMoney(s.amount) : null) });
    } else {
        steps.push({ tone: "off", name: "Owner paid", todo: true });
    }
    steps.push({
        tone: "off",
        name: "You get paid",
        todo: true,
        meta: share !== null ? `${formatMoney(share)} to your Wallet after the owner pays` : "Your share goes to your Wallet after the owner pays",
    });
    return steps;
}
