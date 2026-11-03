import type { FunctionReturnType } from "convex/server";

import { submissionStatus, type StatusWord } from "@/components/r1/statusWords";
import type { api } from "@/convex/_generated/api";

/**
 * Canonical ownership-gated summary shared with the mobile app. Phase and
 * receipt-derived balances distinguish private preview, approval and payment;
 * a raw submission status or retained URL cannot establish those facts.
 */
export type OwnerSite = NonNullable<FunctionReturnType<typeof api.owners.me>>['sites'][number];

/** Legacy raw-status mapping retained for callers that do not have a canonical phase. */
const DUE = new Set(["deployed", "pending_payment"]);
const PAID = new Set(["paid", "completed"]);

export type OwnerStage = "due" | "paid" | "other";

export function ownerStage(status: string): OwnerStage {
    if (DUE.has(status)) return "due";
    if (PAID.has(status)) return "paid";
    return "other";
}

/**
 * The status an owner reads for their own site.
 *
 * submissionStatus(s, "owner") says what a creator sees: "Live — awaiting
 * payment" with the grey waiting-on-someone-else ring. For the owner that
 * payment is theirs to make, so the legacy owner mapping calls it due.
 * Paid and every other state keep the kit's word.
 */
export function ownerSiteStatus(status: string): StatusWord {
    return ownerStage(status) === "due" ? { tone: "attn", word: "Payment due" } : submissionStatus(status, "owner");
}

/** Owner-facing workflow state. Keep publication and payment separate. */
export function ownerPhaseStatus(site: OwnerSite): StatusWord {
    switch (site.phase) {
        case 'draft': return { tone: 'attn', word: 'Finish setup' };
        case 'building': return { tone: 'progress', word: 'Building' };
        case 'ready_to_check': return { tone: 'attn', word: 'Check preview' };
        case 'changes_requested': return { tone: 'progress', word: 'Updating site' };
        case 'awaiting_payment': return { tone: 'attn', word: site.amountPaid > 0 && site.balanceDue > 0 ? 'Balance due' : 'Payment due' };
        case 'publishing': return { tone: 'progress', word: 'Publishing' };
        case 'live': return { tone: 'done', word: 'Live' };
        case 'offline': return { tone: 'off', word: 'Offline' };
        case 'in_review': return { tone: 'progress', word: 'In review' };
        case 'rejected': return { tone: 'bad', word: 'Needs attention' };
        default: return { tone: 'off', word: 'View business' };
    }
}

function hasActiveAddress(site: OwnerSite): boolean {
    if (site.phase !== 'live' || !site.publishedUrl) return false;
    try {
        const url = new URL(site.publishedUrl);
        return url.protocol === 'https:' && !url.username && !url.password;
    } catch { return false; }
}

/** The next useful action, without claiming an order was paid or is public. */
export function ownerSiteAction(site: OwnerSite): string {
    switch (site.phase) {
        case 'draft': return 'Finish setup';
        case 'ready_to_check': return 'Check preview';
        case 'awaiting_payment': return site.amountPaid > 0 && site.balanceDue > 0 ? 'Pay balance' : 'View payment';
        case 'building':
        case 'publishing':
        case 'in_review': return 'View progress';
        case 'changes_requested': return 'View request';
        case 'live':
            if (!site.paidInFull && site.balanceDue > 0) return site.amountPaid > 0 ? 'Pay balance' : 'View payment';
            return hasActiveAddress(site) ? 'Open website' : 'View business';
        default: return 'View business';
    }
}

/** "https://neighborhood.sites.tendso.com/" → "neighborhood.sites.tendso.com", the address an owner shares. */
export function hostOf(url: string): string {
    try {
        return new URL(url).host || url;
    } catch {
        return url;
    }
}
