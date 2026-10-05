/**
 * Words for the Referrals screen. Pure: no React, no Convex client.
 */
import type { FunctionReturnType } from "convex/server";

import type { StatusWord } from "@/components/r1/statusWords";
import type { api } from "@/convex/_generated/api";

export type Referral = FunctionReturnType<typeof api.referrals.getByReferrer>[number];

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const DAY_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** "Sep 20" this year, "Sep 20, 2025" before it. */
export function shortDate(ts: number): string {
    const d = new Date(ts);
    return d.getFullYear() === new Date().getFullYear() ? DAY.format(d) : DAY_YEAR.format(d);
}

/**
 * The state of one referral, from the referrals row itself.
 *
 * The board's status column shows the invited creator's certification state
 * ("In training"), but referrals.getByReferrer returns only their name, not
 * their certification timestamps, so creatorStatus() cannot be used here (a
 * backend gap, see the report). This is the referral's own state instead:
 *
 *   pending    joined with the code, first paid site not yet  → In progress
 *   qualified  first paid site happened, bonus credited       → Earned
 *   paid       (in the schema; nothing sets it today)         → Earned
 *
 * "In progress" is the kit's word for waiting on someone else; "Earned" is the
 * word the Wallet board gives money that has landed. statusWords.ts has no
 * referral mapper yet; this belongs there.
 */
export function referralStatus(status: string): StatusWord {
    switch (status) {
        case "pending":
            return { tone: "progress", word: "In progress" };
        case "qualified":
        case "paid":
            return { tone: "done", word: "Earned" };
        default: {
            const s = status.replace(/_/g, " ").trim();
            return { tone: "off", word: s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown" };
        }
    }
}

/** The line under the bonus: when it comes, or when it landed. No new peso figure. */
export function bonusNote(r: Referral): string {
    if (r.status === "pending") return "After their first paid site";
    if (r.status === "qualified") return r.qualifiedAt ? `In your wallet since ${shortDate(r.qualifiedAt)}` : "In your wallet";
    if (r.status === "paid") return r.paidAt ? `Paid ${shortDate(r.paidAt)}` : "Paid";
    return "";
}

/**
 * "Ria Mendoza" → "Ria M.": first name and last initial, as the board shows
 * invitees. getByReferrer joins the two name fields with a space even when one
 * is missing, so a literal "undefined" is dropped rather than printed.
 */
export function shortName(full: string | undefined): string {
    const words = (full ?? "").split(/\s+/).filter((w) => w && w !== "undefined" && w !== "null" && w !== "Unknown");
    if (words.length === 0) return "A creator";
    if (words.length === 1) return words[0];
    return `${words[0]} ${words[words.length - 1].charAt(0).toUpperCase()}.`;
}

export const OWN_CODE_ERROR = "That's your own code. Enter the code of the creator who invited you.";

/**
 * Words for a failed applyReferralCode. In production Convex sends the client
 * only "Server Error" for a thrown Error, so the server's own messages are
 * matched where they arrive and everything else gets the fallback.
 */
export function referralErrorText(err: unknown): string {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("Invalid referral code")) return "We can't find that code. Check it with the creator who invited you.";
    if (raw.includes("own referral code")) return OWN_CODE_ERROR;
    if (raw.includes("already applied")) return "You've already added an invite code.";
    if (raw.includes("already been recorded")) return "Your account already has an invite on record, so a code can't be added.";
    return "That code didn't work. Check it with the creator who invited you, then try again.";
}
