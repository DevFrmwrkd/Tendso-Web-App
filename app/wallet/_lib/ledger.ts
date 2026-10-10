/**
 * The wallet's arithmetic and words, kept out of the page so the page reads as
 * layout. Pure: no React, no Convex client.
 *
 * Every peso here comes from a row (an earning, a withdrawal, a submission's
 * creatorPayout) or from lib/pricing, and is printed with formatMoney: ₱ with
 * no space, comma thousands, a true minus on money out.
 */
import type { FunctionReturnType } from "convex/server";

import { formatMoney } from "@/components/r1/money";
import { withdrawalStatus, type StatusWord, type Tone } from "@/components/r1/statusWords";
import type { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { needsFunding } from "@/lib/payouts/fundingState";
import { isComped, ownerChargeFor } from "@/lib/pricing";

export type Earning = FunctionReturnType<typeof api.earnings.getByCreator>[number];
/** A private portal can provide ledger copy without exposing its submission. */
export type LedgerEarning = Pick<Earning, "_id" | "amount" | "type" | "status" | "createdAt" | "businessName"> & {
    submissionId?: Earning["submissionId"];
};
export type Withdrawal = Doc<"withdrawals">;
export type Submission = Doc<"submissions">;

/** The same check the wallet has always used on a Wise email. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A failed withdrawal the creator can send again from its row. */
export type Retry = { amount: number; at: number };

// ── Dates ────────────────────────────────────────────────────────────────

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const DAY_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** "Sep 29" this year, "Sep 29, 2025" before it. */
export function shortDate(ts: number): string {
    const d = new Date(ts);
    return d.getFullYear() === new Date().getFullYear() ? DAY.format(d) : DAY_YEAR.format(d);
}

// ── The withdraw form ────────────────────────────────────────────────────

/**
 * The amount as typed, checked against the same two rules the server applies
 * in withdrawals.create: more than zero, and no more than the balance.
 *
 * There is deliberately NO minimum. The old ₱100 floor was removed on purpose
 * when Tendso started paying Wise's transfer fee (convex/withdrawals.ts and
 * docs/changes/WISE-WITHDRAWAL-FIX-MIN.md), so a floor here would refuse money
 * the server would pay out. The Round 1 board still draws one; it is not built.
 *
 * `strict` is set once the person has left the field or tried to submit.
 * Before that an empty or zero field is not yet an error, while a typo or an
 * amount above the balance is said straight away.
 */
export function checkAmount(raw: string, available: number, strict: boolean): { value: number | null; error: string } {
    const v = raw.replace(/[,\s₱]/g, "");
    if (v === "") return { value: null, error: strict ? "Enter an amount." : "" };
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return { value: null, error: "Use numbers only." };
    const n = Number(v);
    if (n <= 0) return { value: null, error: strict ? "Enter an amount above zero." : "" };
    if (n > available) return { value: null, error: `You have ${formatMoney(available)} available.` };
    return { value: n, error: "" };
}

/** A number as the amount field shows it: no ₱, no commas, centavos only when there are any. */
export function amountInput(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "";
    // Round DOWN to the centavo, so a prefilled amount never exceeds the balance.
    const cents = Math.floor(n * 100 + 1e-6) / 100;
    return Number.isInteger(cents) ? String(cents) : cents.toFixed(2);
}

/**
 * The Wise email, typed twice. Normalised the way the wallet always saved it
 * (trimmed, lower case) before it is compared or stored.
 */
export function checkEmails(first: string, second: string): { email: string; error: string; againError: string } {
    const email = first.trim().toLowerCase();
    const again = second.trim().toLowerCase();
    let error = "";
    let againError = "";
    if (!email) error = "Enter your Wise email.";
    else if (!EMAIL_REGEX.test(email)) error = "Enter a full email, like name@gmail.com.";
    if (!again) againError = "Type the email again.";
    else if (email !== again) againError = "The two emails don't match.";
    return { email, error, againError };
}

/**
 * Words for a failed Convex call. In production Convex sends the client only
 * "Server Error" for a thrown Error, so the known messages are matched where
 * they do arrive (development) and everything else gets the fallback.
 */
export function errorText(err: unknown, fallback: string, known: Record<string, string> = {}): string {
    const raw = err instanceof Error ? err.message : "";
    for (const [needle, text] of Object.entries(known)) {
        if (raw.includes(needle)) return text;
    }
    return fallback;
}

// ── Withdrawals ──────────────────────────────────────────────────────────

/**
 * Where a withdrawal went. Prefer the persisted wiseEmail column; fall back to
 * accountDetails, which is the raw email for wise_email withdrawals.
 */
export function payoutEmailOf(w: Withdrawal): string | null {
    return w.wiseEmail || (w.payoutMethod === "wise_email" ? w.accountDetails : null) || null;
}

const LEGACY_METHODS: Record<string, string> = { gcash: "GCash", maya: "Maya", bank_transfer: "a bank account" };

function isWise(w: Withdrawal): boolean {
    return w.payoutMethod === "wise_email" || Boolean(w.wiseEmail);
}

function withdrawalSub(w: Withdrawal): string {
    const email = payoutEmailOf(w);
    const to = email ? `To ${email}` : `To ${LEGACY_METHODS[w.payoutMethod] ?? "Wise"}`;
    if (w.status === "failed") return `${to} · didn't go through, so ${formatMoney(w.amount)} is back in your wallet`;
    if (w.status === "pending" || w.status === "processing") {
        // A new transfer waits for an admin to release it in the Wise dashboard
        // (nothing funds one automatically). needsFunding is the payouts page's
        // own tested reading of that, from the hourly Wise poll.
        return w.status === "pending" || needsFunding(w)
            ? `${to} · waiting for Tendso to approve it in Wise`
            : `${to} · approved, watch for Wise's email`;
    }
    return to;
}

// ── The ledger: money in and out ─────────────────────────────────────────

export type LedgerRow = {
    key: string;
    kind: "earning" | "withdrawal";
    at: number;
    date: string;
    title: string;
    sub: string;
    status: StatusWord;
    amount: string;
    /** Set on the newest withdrawal when it failed: its row offers Try again. */
    retry?: Retry;
};

function earningCopy(e: LedgerEarning, sub: Submission | undefined): { title: string; sub: string } {
    if (e.type === "referral_bonus") {
        return { title: "Referral bonus", sub: "A creator you invited had their first site paid for" };
    }
    // A referral earning points its submissionId at a creator, so its lookup
    // comes back "Unknown"; any other miss reads the same way.
    const name = e.businessName && e.businessName !== "Unknown" ? e.businessName : "A website";
    if (e.type === "lead_bonus") return { title: name, sub: "Lead bonus" };
    if (!sub) return { title: name, sub: "Your share of the sale" };
    if (isComped(sub)) return { title: name, sub: "Free promo site · you still earn your share" };
    const paid = ownerChargeFor(sub);
    return { title: name, sub: paid > 0 ? `Owner paid ${formatMoney(paid)} · your share` : "Owner paid · your share" };
}

function earningStatus(status: string): StatusWord {
    return status === "pending" ? { tone: "progress", word: "Pending" } : { tone: "done", word: "Earned" };
}

/**
 * Earnings and withdrawals in one list, newest first.
 *
 * A failed withdrawal is one line that nets to ₱0 (ComponentKit, "Money line":
 * "Withdrawal failed, returned · ₱0"). The backend puts the money back in the
 * balance when a withdrawal fails but records no separate return, nor when it
 * happened, so the board's extra "Back in your wallet" row has no data behind it.
 *
 * Only the NEWEST withdrawal offers Try again: once a later one exists, the
 * failure has been dealt with and a button on it would invite a double send.
 */
export function buildLedger(earnings: LedgerEarning[], withdrawals: Withdrawal[], submissions: Submission[] | undefined): LedgerRow[] {
    const byId = new Map((submissions ?? []).map((s) => [s._id as string, s]));
    const newest = withdrawals.reduce<Withdrawal | null>((best, w) => (!best || w.createdAt > best.createdAt ? w : best), null);
    const rows: LedgerRow[] = [];

    for (const e of earnings) {
        rows.push({
            key: `e-${e._id}`,
            kind: "earning",
            at: e.createdAt,
            date: shortDate(e.createdAt),
            ...earningCopy(e, e.submissionId ? byId.get(e.submissionId as string) : undefined),
            status: earningStatus(e.status),
            amount: formatMoney(e.amount, "credit"),
        });
    }

    for (const w of withdrawals) {
        const failed = w.status === "failed";
        rows.push({
            key: `w-${w._id}`,
            kind: "withdrawal",
            at: w.createdAt,
            date: shortDate(w.createdAt),
            title: isWise(w) ? "Withdrawal to Wise" : "Withdrawal",
            sub: withdrawalSub(w),
            status: withdrawalStatus(w.status),
            amount: failed ? formatMoney(0) : formatMoney(w.amount, "debit"),
            retry: failed && newest?._id === w._id ? { amount: w.amount, at: w.createdAt } : undefined,
        });
    }

    return rows.sort((a, b) => b.at - a.at);
}

// ── Totals and the one line under the balance ────────────────────────────

/** "A", "A, B", "A, B and 3 more". */
export function joinNames(names: string[]): string {
    const unique = Array.from(new Set(names.filter(Boolean)));
    if (unique.length <= 2) return unique.join(", ");
    return `${unique[0]}, ${unique[1]} and ${unique.length - 2} more`;
}

/**
 * Money that lands when an owner pays: each of the creator's sites that is
 * live and waiting for payment, at the creatorPayout the payment credits
 * (convex/payments.ts reads exactly that field).
 */
export function awaitingOwners(submissions: Submission[]): { total: number; names: string[] } {
    const waiting = submissions.filter(
        (s) => (s.status === "deployed" || s.status === "pending_payment") && !s.creatorPaidAt && (s.creatorPayout ?? 0) > 0,
    );
    return { total: waiting.reduce((sum, s) => sum + (s.creatorPayout ?? 0), 0), names: waiting.map((s) => s.businessName) };
}

/** Withdrawals that have left the balance and not yet landed or failed. */
export function inFlight(withdrawals: Withdrawal[]): { total: number; email: string | null } {
    const moving = withdrawals.filter((w) => w.status === "pending" || w.status === "processing");
    const newest = moving.reduce<Withdrawal | null>((best, w) => (!best || w.createdAt > best.createdAt ? w : best), null);
    return { total: moving.reduce((sum, w) => sum + w.amount, 0), email: newest ? payoutEmailOf(newest) : null };
}

/** One sentence that explains the big number: what is moving, what is coming, or what is ready. */
export function balanceLine(args: {
    balance: number;
    moving: { total: number; email: string | null };
    waiting: { total: number; names: string[] };
}): { tone: Tone; text: string } {
    const { balance, moving, waiting } = args;
    if (moving.total > 0) {
        const watch = moving.email ? ` Watch ${moving.email} for Wise's email.` : "";
        return { tone: "progress", text: `${formatMoney(moving.total)} is on its way to Wise.${watch}` };
    }
    if (waiting.total > 0) {
        const who = waiting.names.length === 1 ? `${waiting.names[0]}'s owner pays` : `${waiting.names.length} owners pay`;
        return { tone: "progress", text: `${formatMoney(waiting.total)} arrives when ${who}.` };
    }
    if (balance > 0) return { tone: "done", text: "Ready to withdraw." };
    return { tone: "off", text: "Your share lands here when an owner pays." };
}
