/**
 * Pure helpers for the admin Creators screen (Round 1, board Creators): the
 * name an admin reads, the role words, the one status a row shows, dates,
 * search, sort and paging. No React, no Convex calls.
 */
import type { FunctionReturnType } from "convex/server";

import { creatorStatus, type StatusWord } from "@/components/r1/statusWords";
import type { api } from "@/convex/_generated/api";

export type CreatorRow = FunctionReturnType<typeof api.creators.getAllWithStats>[number];
export type PendingRow = FunctionReturnType<typeof api.creators.listPendingApproval>[number];
export type RejectedRow = FunctionReturnType<typeof api.creators.listRejected>[number];

/** The three tabs, as `?view=` spells them. `pending` is the existing value the old routes redirect to. */
export type View = "pending" | "all" | "rejected";

export function parseView(value: string | null | undefined): View | null {
    return value === "pending" || value === "all" || value === "rejected" ? value : null;
}

// ── Names ──────────────────────────────────────────────────────────────────

type NameParts = {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    email?: string | null;
};

// Both names are OPTIONAL in the schema (mobile and Sign in with Apple allow
// signing up with neither). On 2026-08-12 one row with a firstName and no
// lastName took the whole creator list down with `undefined.charAt(0)`. Every
// name on this screen goes through these, which degrade and never throw.

function nameParts(c: NameParts): string[] {
    return [c.firstName, c.middleName, c.lastName].map((s) => s?.trim() ?? "").filter(Boolean);
}

/** First, middle and last name; the email when there is no name; never empty. */
export function fullName(c: NameParts): string {
    const parts = nameParts(c);
    if (parts.length > 0) return parts.join(" ");
    return c.email?.trim() || "Unnamed creator";
}

/** What the avatar's initials are drawn from: the name, or nothing (the avatar then shows "?"). */
export function avatarName(c: NameParts): string | null {
    const parts = nameParts(c);
    return parts.length > 0 ? parts.join(" ") : null;
}

/** For sentences: "Angel will see it." Falls back to the full name. */
export function firstNameOf(c: NameParts): string {
    return c.firstName?.trim() || fullName(c);
}

// ── Roles ──────────────────────────────────────────────────────────────────

export const ROLES = ["creator", "staff", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { creator: "Creator", staff: "Staff", admin: "Admin" };

/** What each role can reach. Same words the old detail page used. */
export const ROLE_DESC: Record<Role, string> = {
    creator: "The default. Submits businesses and gets paid. No access to /admin.",
    staff: "Reads the Field Agent call bookings — who is booked, when, and the Meet link — and nothing else. No mailbox access needed.",
    admin: "Everything: submissions, payouts, creators, roles, and the money.",
};

/** A row with no role is a creator: that is what `creators.create` writes. */
export function roleOf(c: { role?: string | null }): string {
    return c.role || "creator";
}

export function isRole(value: string): value is Role {
    return (ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: string): string {
    return isRole(role) ? ROLE_LABEL[role] : role.charAt(0).toUpperCase() + role.slice(1);
}

// ── Status ─────────────────────────────────────────────────────────────────

type StatusFacts = {
    status?: string | null;
    isDeleted?: boolean | null;
    certifiedAt?: number | null;
    quizPassedAt?: number | null;
    rejectedAt?: number | null;
};

/**
 * The one status a creator row shows. The certification word comes from the
 * shared `creatorStatus` (In training, Waiting for approval, Certified,
 * Rejected); the two account states it has no word for come first:
 * "Suspended" is the Creators board's own word, and "Deleted" marks an
 * account its owner deleted from the app (kept 30 days, `isDeleted`).
 */
export function accountStatus(c: StatusFacts): StatusWord {
    if (c.isDeleted || c.status === "deleted") return { tone: "off", word: "Deleted" };
    if (c.status === "suspended") return { tone: "bad", word: "Suspended" };
    return creatorStatus(c, "admin");
}

/**
 * Which drawer a creator opens in. Waiting and rejected use the same tests as
 * `listPendingApproval` and `listRejected`, so a row and its drawer agree.
 */
export type DrawerKind = "waiting" | "rejected" | "person";

export function drawerKindOf(c: StatusFacts): DrawerKind {
    if (c.isDeleted) return "person";
    if (c.rejectedAt && !c.certifiedAt) return "rejected";
    if (c.quizPassedAt && !c.certifiedAt) return "waiting";
    return "person";
}

// ── Dates and contact ──────────────────────────────────────────────────────

const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const CALL_TIME = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** "Sep 27" this year, "Sep 27, 2025" any other. */
export function shortDate(ts: number, now: number): string {
    const d = new Date(ts);
    return d.getFullYear() === new Date(now).getFullYear() ? MONTH_DAY.format(d) : MONTH_DAY_YEAR.format(d);
}

/** "Tue, Sep 29, 8:00 PM" */
export function callTime(ts: number): string {
    return CALL_TIME.format(new Date(ts));
}

/** How long someone has waited: "less than a day", "1 day", "12 days". */
export function waitedFor(since: number, now: number): string {
    const days = Math.floor((now - since) / 86_400_000);
    if (days < 1) return "less than a day";
    return days === 1 ? "1 day" : `${days} days`;
}

/** A Philippine mobile number in three groups (0995 123 2186); anything else as it was typed. */
export function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (/^09\d{9}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    return phone;
}

const PAYOUT_METHOD: Record<string, string> = { gcash: "GCash", maya: "Maya", bank_transfer: "Bank transfer", wise_email: "Wise" };

/**
 * Where a creator's money goes. The Wallet's payout setup writes `wiseEmail`;
 * `payoutMethod` / `payoutDetails` are the older admin fields the previous
 * detail page showed. Both are kept, newest first. Empty when nothing is set.
 */
export function payoutLines(c: { wiseEmail?: string | null; payoutMethod?: string | null; payoutDetails?: string | null }): string[] {
    const lines: string[] = [];
    if (c.wiseEmail) lines.push(`Wise · ${c.wiseEmail}`);
    if (c.payoutMethod || c.payoutDetails) {
        const method = c.payoutMethod ? (PAYOUT_METHOD[c.payoutMethod] ?? c.payoutMethod) : null;
        lines.push([method, c.payoutDetails].filter(Boolean).join(" · "));
    }
    return lines;
}

// ── Search, sort, pages ────────────────────────────────────────────────────

/** Case-insensitive; a number typed with spaces or dashes still finds a phone number. */
export function matchesSearch(query: string, fields: Array<string | null | undefined>): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const digits = needle.replace(/[\s()+.-]/g, "");
    const byDigits = /^\d{3,}$/.test(digits);
    return fields.some((f) => {
        if (!f) return false;
        const hay = f.toLowerCase();
        return hay.includes(needle) || (byDigits && hay.replace(/\D/g, "").includes(digits));
    });
}

/** The old list's eight sort orders, same keys. `phrase` leads the page text under the table. */
export const SORTS = [
    { value: "newest", label: "Newest first", phrase: "Newest first" },
    { value: "oldest", label: "Oldest first", phrase: "Oldest first" },
    { value: "az", label: "Name A–Z", phrase: "A to Z" },
    { value: "za", label: "Name Z–A", phrase: "Z to A" },
    { value: "status", label: "Status", phrase: "By status" },
    { value: "most_submissions", label: "Most submissions", phrase: "Most submissions first" },
    { value: "highest_earnings", label: "Most earned", phrase: "Most earned first" },
    { value: "highest_balance", label: "Highest balance", phrase: "Highest balance first" },
] as const;
export type SortKey = (typeof SORTS)[number]["value"];

/** Needs-you first, gone last. */
const STATUS_ORDER: Record<string, number> = {
    "Waiting for approval": 0,
    Certified: 1,
    "In training": 2,
    Rejected: 3,
    Suspended: 4,
    Deleted: 5,
};

function joinedAt(c: CreatorRow): number {
    return c.createdAt ?? c._creationTime;
}

export function sortCreators(rows: CreatorRow[], sort: SortKey): CreatorRow[] {
    const newest = (a: CreatorRow, b: CreatorRow) => joinedAt(b) - joinedAt(a);
    const compare: Record<SortKey, (a: CreatorRow, b: CreatorRow) => number> = {
        newest,
        oldest: (a, b) => joinedAt(a) - joinedAt(b),
        az: (a, b) => fullName(a).localeCompare(fullName(b)),
        za: (a, b) => fullName(b).localeCompare(fullName(a)),
        status: (a, b) => (STATUS_ORDER[accountStatus(a).word] ?? 9) - (STATUS_ORDER[accountStatus(b).word] ?? 9) || newest(a, b),
        most_submissions: (a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0) || newest(a, b),
        highest_earnings: (a, b) => (b.totalEarnings ?? 0) - (a.totalEarnings ?? 0) || newest(a, b),
        highest_balance: (a, b) => (b.balance ?? 0) - (a.balance ?? 0) || newest(a, b),
    };
    return [...rows].sort(compare[sort]);
}

/** A list page shows ten rows, then pages (ComponentKit "Table header and rows"). */
export const PAGE_ROWS = 10;

export function pageOf<T>(rows: T[], page: number): { rows: T[]; page: number; pages: number } {
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_ROWS));
    const p = Math.min(Math.max(1, page), pages);
    return { rows: rows.slice((p - 1) * PAGE_ROWS, p * PAGE_ROWS), page: p, pages };
}

/** "Oldest first · showing 3 of 6 · page 1 of 2" */
export function pageText(order: string, shown: number, total: number, page: number, pages: number): string {
    return `${order} · showing ${shown} of ${total} · page ${page} of ${pages}`;
}

/** Convex and fetch errors carry a message; anything else gets the fallback. */
export function messageOf(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}
