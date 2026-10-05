/**
 * The creator's Home, read from their own rows (board Main). Pure helpers:
 * the one-line state, the next step, the shop and referral cards, and the
 * recent-activity rows. Every word and amount comes from data; nothing here
 * is the board's sample.
 *
 * Also used by the Notifications drawer, which links to the same places.
 */
import type { FunctionReturnType } from "convex/server";

// The kit's pure modules, not its index: this file stays free of React.
import { formatMoney } from "@/components/r1/money";
import { submissionStatus, withdrawalStatus, type StatusWord, type Tone } from "@/components/r1/statusWords";
import type { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { isComped, ownerChargeFor } from "@/lib/pricing";

type Submission = Doc<"submissions">;
type Withdrawal = Doc<"withdrawals">;
export type FeedLead = FunctionReturnType<typeof api.leads.listForMobileCRM>["leads"][number];

/** Live and waiting on the owner's payment: the kit's "Live — awaiting payment". */
const AWAITING_PAYMENT = new Set(["deployed", "pending_payment"]);
/** Sent in, waiting on review. */
const IN_REVIEW = new Set(["pending", "submitted", "in_review"]);
/** Approved: the site is generated but not live yet. */
const SITE_GENERATED = new Set(["approved", "website_generated"]);
/** `paid` = the owner paid; `completed` = the creator's share is in their wallet (convex/payments.ts). */
const PAID = new Set(["paid", "completed"]);
/** Every status that has, or had, a website: what the state line calls "your sites". */
const HAS_SITE = new Set([...SITE_GENERATED, ...AWAITING_PAYMENT, ...PAID, "unpublished"]);

/**
 * Where a submission opens: its details drawer on My submissions
 * (`?open=<id>`). The old /submissions/<id> route redirects to the same place,
 * for the links already out in emails and the mobile app; linking here
 * directly saves that hop.
 */
export function submissionHref(id: string): string {
    return `/submissions?open=${encodeURIComponent(id)}`;
}

/** "Aug 28"; the year only when it is not this year. */
export function shortDate(ms: number): string {
    const d = new Date(ms);
    const thisYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString("en-US", thisYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** A count at the start of a sentence: "Three more…". */
export function countWord(n: number): string {
    return WORDS[n] ?? String(n);
}

function nameOf(s: Submission): string {
    return s.businessName?.trim() || "your submission";
}

/** "Raflyn Santos" → "Raflyn S.", as the boards write an owner's name. */
export function ownerShortName(full: string | null | undefined): string {
    const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "the owner";
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export function ownerFirstName(full: string | null | undefined): string {
    return (full ?? "").trim().split(/\s+/).filter(Boolean)[0] ?? "the owner";
}

/** "jefferson@gmail.com" → "j•••@gmail.com": enough to recognise, not to copy. */
function maskEmail(email: string): string {
    const at = email.indexOf("@");
    if (at < 1) return email;
    return `${email.charAt(0)}•••${email.slice(at)}`;
}

/** What the owner still owes, or null when the row has no amount. */
export function owedOf(s: Submission): string | null {
    const owed = ownerChargeFor(s);
    return owed > 0 ? formatMoney(owed) : null;
}

/** The creator's share as stored on the row: the amount convex/payments.ts credits. */
export function payoutOf(s: Submission): string | null {
    return s.creatorPayout && s.creatorPayout > 0 ? formatMoney(s.creatorPayout) : null;
}

/** When a live site started waiting on its owner: the pay-link email, else the review, else the day it was made. */
function waitingSince(s: Submission): number {
    return s.sentEmailAt ?? s.reviewedAt ?? s._creationTime;
}

/**
 * The live site that has waited longest for its owner to pay. It is the one
 * closest to being unpublished for non-payment, so it is the one to chase.
 */
export function oldestAwaitingPayment(subs: Submission[]): Submission | null {
    const waiting = subs.filter((s) => AWAITING_PAYMENT.has(s.status)).sort((a, b) => waitingSince(a) - waitingSince(b));
    return waiting[0] ?? null;
}

/** The one line under the title: where the creator's sites stand. Null when there is nothing to say. */
export function stateLine(subs: Submission[]): { tone: Tone; text: string } | null {
    const count = (set: Set<string>) => subs.filter((s) => set.has(s.status)).length;
    const sites = count(HAS_SITE);

    const waiting = count(AWAITING_PAYMENT);
    if (waiting > 0) {
        if (waiting === sites) {
            return { tone: "progress", text: sites === 1 ? "Your site is waiting on payment" : `All ${sites} of your sites are waiting on payment` };
        }
        return { tone: "progress", text: `${waiting} of your ${sites} sites ${waiting === 1 ? "is" : "are"} waiting on payment` };
    }
    const review = count(IN_REVIEW);
    if (review > 0) return { tone: "progress", text: `${plural(review, "submission")} in review` };
    const generated = count(SITE_GENERATED);
    if (generated > 0) return { tone: "progress", text: `${plural(generated, "site")} approved, not live yet` };
    const paid = count(PAID);
    if (paid > 0) {
        if (paid === sites) return { tone: "done", text: sites === 1 ? "Your site is paid" : `All ${sites} of your sites are paid` };
        return { tone: "done", text: `${paid} of your ${sites} sites ${paid === 1 ? "is" : "are"} paid` };
    }
    const drafts = subs.filter((s) => s.status === "draft").length;
    if (drafts > 0) return { tone: "off", text: `${plural(drafts, "draft")} not submitted yet` };
    return null;
}

/**
 * "Your next step": the one thing worth doing now, in this order.
 *
 *  1. A live site whose owner has not paid: chasing it is what turns a site into money.
 *  2. A draft: unfinished work. /submit/info resumes the NEWEST draft, so that is the one named.
 *  3. Money ready to withdraw.
 *  4. Waiting on Tendso (in review, or approved and not live yet): line up the next shop meanwhile.
 *  5. Nothing pending: line up the next shop. No submissions at all: the first interview.
 */
export type NextStep =
    | { kind: "payment"; submission: Submission }
    | { kind: "draft"; submission: Submission }
    | { kind: "withdraw"; balance: number }
    | { kind: "review"; submission: Submission }
    | { kind: "generated"; submission: Submission }
    | { kind: "next" }
    | { kind: "first" };

/** `subs` newest first, as submissions.getByCreatorId returns them. */
export function pickNextStep(subs: Submission[], balance: number): NextStep {
    const awaiting = oldestAwaitingPayment(subs);
    if (awaiting) return { kind: "payment", submission: awaiting };
    const draft = subs.find((s) => s.status === "draft");
    if (draft) return { kind: "draft", submission: draft };
    if (balance > 0) return { kind: "withdraw", balance };
    const review = subs.find((s) => IN_REVIEW.has(s.status));
    if (review) return { kind: "review", submission: review };
    const generated = subs.find((s) => SITE_GENERATED.has(s.status));
    if (generated) return { kind: "generated", submission: generated };
    return subs.length === 0 ? { kind: "first" } : { kind: "next" };
}

/** listForMobileCRM's stand-in name when a lead has none; never a shop to suggest. */
const UNAVAILABLE = "(business unavailable)";
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * A shop to visit: a scraped prospect from the team feed that nobody has
 * interviewed yet (no linked submission), still New. Prefer one in a city the
 * creator has already worked in; the newest otherwise. The feed has no rating
 * and the creator has no location on file, so this cannot claim "near you".
 */
export function pickShop(leads: FeedLead[], subs: Submission[]): FeedLead | null {
    const fresh = leads.filter((l) => l.source === "outscraper" && l.submissionStatus == null && l.status === "new" && l.businessName !== UNAVAILABLE);
    if (fresh.length === 0) return null;
    const cities = new Set(subs.map((s) => norm(s.city)).filter(Boolean));
    return fresh.find((l) => cities.has(norm(l.businessCity))) ?? fresh[0];
}

/** The referral card's status, from referrals.getStats. None until someone has used the code. */
export function referralStatus(stats: { pending: number; qualified: number; paid: number } | undefined): StatusWord | null {
    if (!stats) return null;
    if (stats.pending > 0) return { tone: "progress", word: `${stats.pending} referred, not qualified yet` };
    const done = stats.qualified + stats.paid;
    return done > 0 ? { tone: "done", word: `${done} qualified` } : null;
}

export type ActivityItem = { key: string; at: number; text: string; status: StatusWord; href: string };

/** One row per submission, saying what last happened to it, dated when it happened. */
function submissionItem(s: Submission): ActivityItem {
    const biz = nameOf(s);
    const owner = ownerShortName(s.ownerName);
    const payout = payoutOf(s);
    let text = biz;
    let at = s._creationTime;
    switch (s.status) {
        case "draft":
            text = `You started ${biz}`;
            break;
        case "pending":
        case "submitted":
        case "in_review":
            text = `You submitted ${biz}`;
            break;
        case "approved":
        case "website_generated":
            text = `${biz} was approved`;
            at = s.reviewedAt ?? at;
            break;
        case "deployed":
        case "pending_payment": {
            const owed = owedOf(s);
            text = `${biz} went live — waiting for ${owner} to pay${owed ? ` ${owed}` : ""}`;
            at = waitingSince(s);
            break;
        }
        case "paid":
            // The owner paid; the creator's share is credited when the row moves to completed.
            text = payout ? `${owner} paid for ${biz} — your ${payout} is on its way` : `${owner} paid for ${biz}`;
            at = s.paidAt ?? at;
            break;
        case "completed":
            text = isComped(s)
                ? `${biz} — free promo site${payout ? `, ${payout} added to your wallet` : ""}`
                : `${biz} paid${payout ? ` — ${payout} added to your wallet` : ""}`;
            at = s.creatorPaidAt ?? s.paidAt ?? at;
            break;
        case "rejected":
            text = `${biz} was rejected`;
            at = s.reviewedAt ?? at;
            break;
        case "unpublished":
            text = `${biz} was unpublished`;
            at = s.unpublishedAt ?? at;
            break;
    }
    return { key: s._id, at, text, status: submissionStatus(s.status, "creator"), href: submissionHref(s._id) };
}

function withdrawalItem(w: Withdrawal): ActivityItem {
    const amount = formatMoney(w.amount);
    const to = w.wiseEmail ? ` to your Wise email ${maskEmail(w.wiseEmail)}` : "";
    let text: string;
    switch (w.status) {
        case "completed":
            text = `${amount} paid out${to}`;
            break;
        case "failed":
            // A failed transfer is refunded to the balance (convex/withdrawals.ts), so say so.
            text = `${amount} withdrawal failed — the money is back in your balance`;
            break;
        default:
            text = `${amount} withdrawal on its way${to}`;
    }
    const at = w.status === "completed" || w.status === "failed" ? (w.processedAt ?? w.createdAt) : w.createdAt;
    return { key: w._id, at, text, status: withdrawalStatus(w.status), href: "/wallet" };
}

/** Submissions and withdrawals together, newest first. */
export function activityItems(subs: Submission[], withdrawals: Withdrawal[]): ActivityItem[] {
    return [...subs.map(submissionItem), ...withdrawals.map(withdrawalItem)].sort((a, b) => b.at - a.at);
}
