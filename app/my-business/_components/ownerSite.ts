import type { FunctionReturnType } from "convex/server";

import { submissionStatus, type StatusWord } from "@/components/r1";
import type { api } from "@/convex/_generated/api";

/**
 * One row of businessOwners.getMyWebsites: name, status, live address, leads
 * count. It is the only read these pages make. Every other fact the OwnerHome
 * board draws (live-since date, amount due, pay link, template, domain, the
 * creator) has no owner-gated query yet, so the pages leave it out rather
 * than reach for an unguarded one.
 */
export type OwnerSite = FunctionReturnType<typeof api.businessOwners.getMyWebsites>[number];

/** Live, and the owner's payment is what is outstanding. Same sets as the owner sidebar's Due / Paid badge (components/shells/OwnerShell.tsx). */
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
 * payment is theirs to make, so the OwnerHome board gives it the gold
 * needs-you dot and calls it due (the sidebar badge already says "Due").
 * Paid and every other state keep the kit's word.
 */
export function ownerSiteStatus(status: string): StatusWord {
    return ownerStage(status) === "due" ? { tone: "attn", word: "Payment due" } : submissionStatus(status, "owner");
}

/** "https://neighborhood.sites.tendso.com/" → "neighborhood.sites.tendso.com", the address an owner shares. */
export function hostOf(url: string): string {
    try {
        return new URL(url).host || url;
    } catch {
        return url;
    }
}
