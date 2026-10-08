/**
 * The submissions queue as data (board Queue). Pure functions over the rows
 * api.submissions.getAllWithCreator returns: which tab a row sits in, how the
 * list is searched, filtered and sorted, and the words, money and dates a row
 * and the details drawer show. No React here, so the row, its phone layout
 * and the drawer can never disagree about a submission.
 */
import type { FunctionReturnType } from "convex/server"

import { formatMoney } from "@/components/r1/money"
import { domainStatus, submissionStatus, type StatusWord } from "@/components/r1/statusWords"
import type { api } from "@/convex/_generated/api"
import { isComped, normalizeCampaign, ownerChargeFor } from "@/lib/pricing"

export type QueueRow = FunctionReturnType<typeof api.submissions.getAllWithCreator>[number]

// ── Tabs ─────────────────────────────────────────────────────────────────

/** Every status the schema documents (convex/schema.ts:132), grouped by what an
 *  admin actually does next. `status` is a v.string(), not a union, so unknown
 *  values must still render — they fall through to "All" and a grey status. */
export type TabKey = "all" | "review" | "drafts" | "progress" | "settled" | "rejected" | "unpublished"

export const STATUS_TABS: { key: TabKey; label: string; statuses: string[] | null }[] = [
    { key: "all", label: "All", statuses: null },
    { key: "review", label: "Needs review", statuses: ["submitted", "in_review"] },
    { key: "drafts", label: "Drafts", statuses: ["draft"] },
    { key: "progress", label: "In progress", statuses: ["approved", "website_generated", "deployed", "pending_payment"] },
    { key: "settled", label: "Paid", statuses: ["paid", "completed"] },
    { key: "rejected", label: "Rejected", statuses: ["rejected"] },
    { key: "unpublished", label: "Unpublished", statuses: ["unpublished"] },
]

/**
 * The queue opens on Needs review: the page answers "which submission do I
 * review next?", and the sidebar's Submissions badge counts exactly this tab.
 * So a bare /admin/submissions is Needs review and "All" is ?status=all. The
 * other tabs keep the ?status= keys they always had, so the dashboard's
 * "Review now" link (?status=review) still lands where it did.
 */
export const DEFAULT_TAB: TabKey = "review"

export function parseTab(value: string | null): TabKey {
    return STATUS_TABS.some((t) => t.key === value) ? (value as TabKey) : DEFAULT_TAB
}

export function tabLabel(key: TabKey): string {
    return STATUS_TABS.find((t) => t.key === key)?.label ?? "All"
}

const REVIEW_STATUSES = STATUS_TABS.find((t) => t.key === "review")?.statuses ?? []

/** Waiting on an admin: the rows the Needs review tab holds. */
export function isWaiting(s: QueueRow): boolean {
    return REVIEW_STATUSES.includes(s.status)
}

// Tab counts are computed over everything, not over the current filter —
// a tab that hides its own count when you leave it is useless.
export function tabCounts(rows: QueueRow[]): Record<TabKey, number> {
    const counts = { all: rows.length } as Record<TabKey, number>
    for (const t of STATUS_TABS) {
        const statuses = t.statuses
        if (!statuses) continue
        counts[t.key] = rows.filter((s) => statuses.includes(s.status)).length
    }
    return counts
}

// ── Sort ─────────────────────────────────────────────────────────────────

export const SORT_OPTIONS = [
    { key: "newest", label: "Newest first" },
    { key: "oldest", label: "Oldest first" },
    { key: "az", label: "A–Z" },
    { key: "za", label: "Z–A" },
    { key: "status", label: "Status" },
    { key: "highest_value", label: "Highest value" },
    { key: "highest_payout", label: "Highest payout" },
] as const

export type SortKey = (typeof SORT_OPTIONS)[number]["key"]

/** Needs review reads oldest first (the top row has waited longest); every other tab newest first. */
export function defaultSortFor(tab: TabKey): SortKey {
    return tab === "review" ? "oldest" : "newest"
}

// Sort order for "Status" — the queue an admin works top-down.
const STATUS_ORDER: Record<string, number> = {
    submitted: 0, in_review: 1, draft: 2, approved: 3, website_generated: 4,
    deployed: 5, pending_payment: 6, paid: 7, completed: 8, rejected: 9, unpublished: 10,
}

// Ties keep the query's own order (newest first): Array.prototype.sort is stable.
function compareRows(sort: SortKey, a: QueueRow, b: QueueRow): number {
    switch (sort) {
        case "newest": return b._creationTime - a._creationTime
        case "oldest": return a._creationTime - b._creationTime
        case "az": return a.businessName.localeCompare(b.businessName)
        case "za": return b.businessName.localeCompare(a.businessName)
        case "status": return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
        case "highest_value": return ownerChargeFor(b) - ownerChargeFor(a)
        case "highest_payout": return (b.creatorPayout || 0) - (a.creatorPayout || 0)
        default: return 0
    }
}

// ── Search and filters ───────────────────────────────────────────────────

/** What the search box looks at, in words, for the "nothing matches" state. */
export const SEARCH_SCOPE = "Search looks at business, owner, creator, city, phone, email and domain."

/** `q` is already trimmed and lower-cased. */
export function matchesSearch(s: QueueRow, q: string): boolean {
    return [
        s.businessName,
        s.ownerName,
        s.businessType,
        s.city,
        s.ownerEmail,
        s.ownerPhone,
        s.requestedDomain,
        s.websiteUrl,
        creatorName(s.creator),
    ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
}

export type ListFilter = { tab: TabKey; query: string; domainOnly: boolean; ownerOnly: boolean; giveawayOnly: boolean; sort: SortKey }

/** The rows the table lists, in order: tab, then filter chips, then search, then sort. */
export function listRows(rows: QueueRow[], f: ListFilter): QueueRow[] {
    const statuses = STATUS_TABS.find((t) => t.key === f.tab)?.statuses ?? null
    let result = statuses ? rows.filter((s) => statuses.includes(s.status)) : rows
    if (f.domainOnly) result = result.filter((s) => s.submissionType === "with_custom_domain")
    if (f.ownerOnly) result = result.filter(isOwnerSubmitted)
    if (f.giveawayOnly) result = result.filter((s) => s.giveawayApplication === true)
    const q = f.query.trim().toLowerCase()
    if (q) result = result.filter((s) => matchesSearch(s, q))
    const sorted = [...result]
    sorted.sort((a, b) => compareRows(f.sort, a, b))
    return sorted
}

// ── Who ──────────────────────────────────────────────────────────────────

/** Both creator names are optional in the schema; a row whose creator is gone still needs a name. */
export function creatorName(creator: QueueRow["creator"]): string {
    if (!creator) return "Unknown creator"
    const name = `${creator.firstName ?? ""} ${creator.lastName ?? ""}`.trim()
    return name || "Unknown creator"
}

/**
 * Sent in by the owner through the self-serve /start funnel. 'owner_intake' is
 * the only value and it never changes (convex/schema.ts). Those rows sit under
 * the house creator ("Tendso Self-Serve"), which makes them look like any
 * other, so the queue says it out loud: no field visit, no recorded interview.
 */
export function isOwnerSubmitted(s: QueueRow): boolean {
    return s.contentSource === "owner_intake"
}

/** Strings arrive empty from the mobile app; never render a blank title. */
export function businessName(s: QueueRow): string {
    return s.businessName.trim() || "Unnamed business"
}

export function joinDot(...parts: (string | null | undefined)[]): string {
    return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(" · ")
}

/** "Restaurant · Iloilo": the meta line under a business name. */
export function placeLine(s: QueueRow): string {
    return joinDot(s.businessType, s.city)
}

// ── Status ───────────────────────────────────────────────────────────────

export function statusOf(s: QueueRow): StatusWord {
    return submissionStatus(s.status, "admin")
}

/** A line under the status word. `problem` lines are red, and the words say why too. */
export type Note = { text: string; problem?: boolean }

/**
 * The domain lifecycle is independent of the submission status, so a custom
 * domain row can be live long before the submission is marked paid — and can
 * fail while everything else looks healthy. Only "failed" is worth alarming.
 * One derivation for the row, its phone layout and the drawer: a domain that
 * failed has to look failed on whichever one the admin is triaging from.
 */
export function domainNote(s: QueueRow): Note | null {
    if (s.domainStatus && s.domainStatus !== "not_requested") {
        const word = domainStatus(s.domainStatus)
        return { text: `Custom domain · ${word.word.toLowerCase()}`, problem: word.tone === "bad" }
    }
    if (s.submissionType === "with_custom_domain") return { text: "Custom domain" }
    return null
}

/** A comped row is a website the owner got for free (lib/pricing.ts, isComped). */
export function promoNote(s: QueueRow): Note | null {
    return isComped(s) ? { text: "Free · promo" } : null
}

/**
 * `in_review` means an admin pressed "Mark in review" (here or on the review
 * page). The board also names who did; updateStatus records no one, and the
 * reviewedBy field belongs to approve and reject, so no name is shown.
 */
export function reviewNote(s: QueueRow): Note | null {
    return s.status === "in_review" ? { text: "Marked in review" } : null
}

/** Every line under the status, most urgent first. A row shows the first; the drawer shows them all. */
export function statusNotes(s: QueueRow): Note[] {
    return [domainNote(s), promoNote(s), reviewNote(s)].filter((n): n is Note => n !== null)
}

// ── Money ────────────────────────────────────────────────────────────────

/**
 * What the owner pays: ₱0 on a promo site, otherwise the stored total
 * (ownerChargeFor, the same figure the old Value column and the "Highest value"
 * sort use). Null when no price was ever set, so the table shows a dash
 * instead of a ₱0 that would read as free.
 */
export function ownerPays(s: QueueRow): number | null {
    if (isComped(s)) return 0
    return typeof s.amount === "number" ? ownerChargeFor(s) : null
}

/** "OTR price", "With domain": why the figure is what it is. None on a promo site. */
export function priceNote(s: QueueRow): string | null {
    if (isComped(s)) return null
    const notes: string[] = []
    // normalizeCampaign only resolves campaigns we actually run, so an unknown
    // value stamped on a row is not dressed up as a price.
    const campaign = normalizeCampaign(s.campaign)
    if (campaign) notes.push(`${campaign.toUpperCase()} price`)
    if (s.submissionType === "with_custom_domain") notes.push(notes.length ? "with domain" : "With domain")
    return notes.length ? notes.join(" · ") : null
}

/** The amount for a table cell: ₱ with no space, or a dash when there is none. */
export function moneyCell(amount: number | null): string {
    return amount === null ? "—" : formatMoney(amount)
}

/** Giveaway applications have no owner charge throughout review and fulfillment. */
export function ownerPrice(s: QueueRow): string {
    return s.giveawayApplication ? "Free" : moneyCell(ownerPays(s))
}

/** The drawer's "Owner pays" line: "₱3,499 · OTR price", "₱0 · free promo site". */
export function ownerPaysLine(s: QueueRow): string {
    if (s.giveawayApplication) return "Free · giveaway"
    const amount = ownerPays(s)
    if (amount === null) return "No price set yet"
    if (isComped(s)) return `${formatMoney(0)} · free promo site`
    const note = priceNote(s)
    return note ? `${formatMoney(amount)} · ${note}` : formatMoney(amount)
}

/** When the owner pays. Nothing on a promo site (it is free) or a rejected one (nothing will be due). */
export function ownerPaysWhen(s: QueueRow): string | null {
    if (s.giveawayApplication || isComped(s) || s.status === "rejected") return null
    switch (s.status) {
        case "paid":
        case "completed":
            return "Paid"
        case "deployed":
        case "pending_payment":
            return "Due now: the site is live"
        default:
            return "Once, after the site is live"
    }
}

/**
 * The drawer's "Creator gets". The creator's share is credited when the owner
 * pays (or when an admin gives the site away: the promo still pays the
 * creator), which moves the row to `completed` and stamps creatorPaidAt.
 * Owner-submitted rows carry an explicit ₱0 (convex/ownerIntake.ts).
 */
export function creatorGets(s: QueueRow): string {
    const payout = s.creatorPayout ?? 0
    if (payout <= 0 || s.status === "rejected") return formatMoney(0)
    if (s.creatorPaidAt || s.status === "paid" || s.status === "completed") return formatMoney(payout)
    return `${formatMoney(payout)} when the owner pays`
}

// ── Dates ────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

/** "Sep 28", with the year only when it is not this year's. */
export function shortDate(ts: number, now: number): string {
    const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear()
    return new Date(ts).toLocaleDateString(
        "en-US",
        sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
    )
}

/** "Sep 28, 2026". */
export function longDate(ts: number): string {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/**
 * Whole days a Needs review row has waited; null for every other row. Counted
 * from when the row was created: the schema has no submittedAt, so for a
 * creator's draft that sat before it was sent this runs long. It is the same
 * date the old "Submission Date" column and the Oldest first sort use.
 */
export function waitingDays(s: QueueRow, now: number): number | null {
    if (!isWaiting(s)) return null
    return Math.max(0, Math.floor((now - s._creationTime) / DAY_MS))
}

export function daysText(days: number): string {
    if (days < 1) return "under a day"
    return days === 1 ? "1 day" : `${days} days`
}

// ── Quality checklist ────────────────────────────────────────────────────

/** submissions.submit and the owner intake both refuse fewer photos than this (convex/submissions.ts, convex/ownerIntake.ts). */
export const MIN_PHOTOS = 3

export type Check = { label: string; done: boolean }

const filled = (value: string | null | undefined) => Boolean(value && value.trim())

/**
 * What a reviewer checks first, from the row itself. Owner-submitted rows have
 * a typed interview instead of a recording (and a transcript written from it),
 * so they are checked for that rather than marked as missing audio forever.
 * Business and contact info are the fields New submission requires.
 */
export function checklist(s: QueueRow): Check[] {
    const photos = s.photos?.length ?? 0
    const owner = isOwnerSubmitted(s)
    const interview = owner
        ? (s.interviewQa?.length ?? 0) > 0
        : Boolean(s.videoUrl || s.videoStorageId || s.audioUrl || s.audioStorageId)
    return [
        { label: `Photos (${photos})`, done: photos >= MIN_PHOTOS },
        { label: owner ? "Typed interview" : "Audio or video", done: interview },
        { label: "Transcript", done: filled(s.transcript) },
        { label: "Business info complete", done: [s.businessName, s.businessType, s.address, s.city].every(filled) },
        { label: "Contact info complete", done: [s.ownerName, s.ownerPhone].every(filled) },
    ]
}

// ── Empty list and paging ────────────────────────────────────────────────

export type EmptyCopy = {
    title: string
    body: string
    action: string
    /** Where the one action goes: another tab, or clear the search and the chips. */
    next: { kind: "tab"; tab: TabKey } | { kind: "clear" }
}

const EMPTY_TAB: Record<TabKey, Omit<EmptyCopy, "next"> & { tab: TabKey }> = {
    all: { title: "No submissions yet", body: "When a creator or an owner sends a business in, it shows up here.", action: "Back to Needs review", tab: "review" },
    review: { title: "Nothing waiting for review", body: "New submissions from creators and owners land here, oldest first.", action: "See all submissions", tab: "all" },
    drafts: { title: "No drafts", body: "Drafts are submissions a creator started but has not sent yet.", action: "Back to Needs review", tab: "review" },
    progress: { title: "Nothing in progress", body: "Approved sites waiting to go live or to be paid show up here.", action: "Back to Needs review", tab: "review" },
    settled: { title: "Nothing paid yet", body: "Sites move here once the owner has paid.", action: "Back to Needs review", tab: "review" },
    rejected: { title: "No rejected submissions", body: "When you reject one, it moves here with the reason sent to its creator.", action: "Back to Needs review", tab: "review" },
    unpublished: { title: "Nothing unpublished", body: "Sites you take offline show up here, ready to restore.", action: "Back to Needs review", tab: "review" },
}

/** What an empty table says, and its one way out. */
export function emptyCopy(tab: TabKey, query: string, chipsOn: boolean): EmptyCopy {
    const q = query.trim()
    if (q || chipsOn) {
        const title = q ? `No submissions match “${q}”` : "No submissions match these filters"
        if (tab !== "all") {
            return {
                title,
                body: q ? `Nothing in ${tabLabel(tab)} matches. ${SEARCH_SCOPE}` : `Nothing in ${tabLabel(tab)} matches these filters.`,
                action: q ? "Search all submissions" : "See all submissions",
                next: { kind: "tab", tab: "all" },
            }
        }
        return {
            title,
            body: q ? SEARCH_SCOPE : "Turn a filter off to see more.",
            action: "Clear search and filters",
            next: { kind: "clear" },
        }
    }
    const e = EMPTY_TAB[tab]
    return { title: e.title, body: e.body, action: e.action, next: { kind: "tab", tab: e.tab } }
}

const count = (n: number) => n.toLocaleString("en-US")

/** "1–10 of 25 · page 1 of 3". */
export function pageText(first: number, last: number, total: number, page: number, pages: number): string {
    const range = `${count(first)}–${count(last)} of ${count(total)}`
    return pages > 1 ? `${range} · page ${count(page)} of ${count(pages)}` : range
}
