import type { StatusWord } from "@/components/r1/statusWords";

/** Giveaway eligibility and website fulfillment are separate decisions. */
export type GiveawayReviewRecord = {
    giveawayApplication?: boolean;
    status?: string;
    pricingMode?: string;
    giveawayReviewSource?: "otr" | "admin";
    reviewedBy?: string;
    reviewedByName?: string | null;
    reviewedAt?: number;
};

export type GiveawayReviewState = "pending" | "approved" | "rejected" | "unknown";
export type GiveawayReview = StatusWord & {
    state: GiveawayReviewState;
    reviewer: string | null;
    reviewedAt: number | null;
    nextStep: string;
};

const APPROVED_STATUSES = new Set([
    "approved", "website_generated", "deployed", "pending_payment", "paid", "completed", "unpublished",
]);
const PENDING_STATUSES = new Set(["submitted", "in_review", "pending", "draft"]);

export function giveawayReview(record: GiveawayReviewRecord): GiveawayReview | null {
    if (!record.giveawayApplication) return null;
    const reviewer = record.reviewedByName?.trim()
        || (record.giveawayReviewSource === "otr" ? "Off the Record" : record.giveawayReviewSource === "admin" ? "Admin" : null);
    const reviewedAt = typeof record.reviewedAt === "number" && Number.isFinite(record.reviewedAt) && Math.abs(record.reviewedAt) <= 8.64e15
        ? record.reviewedAt : null;
    const source = record.giveawayReviewSource === "otr" ? "OTR" : record.giveawayReviewSource === "admin" ? "admin" : null;
    if (record.status === "rejected") return {
        state: "rejected", tone: "bad", word: source ? `Rejected by ${source}` : "Giveaway rejected",
        reviewer, reviewedAt,
        nextStep: "Do not start this website. The giveaway application was rejected.",
    };
    // Reopened applications can retain an older review audit. The current
    // pending status still needs another decision before work can begin.
    if (PENDING_STATUSES.has(record.status ?? "")) return {
        state: "pending", tone: "progress", word: "Awaiting OTR review",
        reviewer: null, reviewedAt: null,
        nextStep: "Wait for OTR or an admin to approve the poster before starting the website.",
    };
    if (APPROVED_STATUSES.has(record.status ?? "") && reviewedAt !== null && record.reviewedBy?.trim()) return {
        state: "approved", tone: "done", word: source ? `Approved by ${source}` : "Giveaway approved",
        reviewer, reviewedAt,
        nextStep: record.pricingMode === "comped"
            ? "This website has already been given free."
            : record.status === "approved"
                ? "Giveaway approved. Website preparation can proceed."
                : record.status === "website_generated"
                    ? "Check the website, then publish and give it free to the owner."
                    : record.status === "unpublished"
                        ? "The website is unpublished. Check it before restoring it."
                        : "Continue the free website handover. No owner payment is due.",
    };
    // A workflow status alone is not proof of eligibility. This also keeps
    // legacy/imported rows without a review audit out of Approved giveaways.
    return {
        state: "unknown", tone: "attn", word: "Giveaway review required",
        reviewer: null, reviewedAt: null,
        nextStep: "No approval is recorded. Check giveaway eligibility before starting work.",
    };
}

export function giveawayWebsiteStatus(record: GiveawayReviewRecord): StatusWord | null {
    const review = giveawayReview(record);
    if (!review) return null;
    if (review.state === "rejected") return { tone: "off", word: "Not proceeding" };
    if (record.status === "unpublished") return { tone: "off", word: "Unpublished" };
    if (record.pricingMode === "comped") return { tone: "done", word: "Website given free" };
    if (review.state === "pending") return { tone: "off", word: "Not started" };
    if (review.state === "unknown") return { tone: "attn", word: "Review required" };
    switch (record.status) {
        case "approved": return { tone: "progress", word: "Ready to build" };
        case "website_generated": return { tone: "progress", word: "Site generated" };
        case "deployed":
        case "pending_payment": return { tone: "progress", word: "Website live" };
        default: return { tone: "done", word: "Handover recorded" };
    }
}
