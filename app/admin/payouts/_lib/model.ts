import type { FunctionReturnType } from "convex/server"

import { formatMoney, withdrawalStatus, type StatusWord, type Tone } from "@/components/r1"
import type { api } from "@/convex/_generated/api"
import { AWAITING_FUNDING_STATES, needsFunding } from "@/lib/payouts/fundingState"

// ─────────────────────────────────────────────────────────────────────────────
// The pure half of /admin/payouts: what a withdrawal row SAYS (its one status,
// its note, its timeline), which filter it falls under, and the money
// summary's arithmetic. No React here, so every rule that decides what an
// admin is told about money reads in one place.
//
// The page is still read-only, as it always was: nothing on it moves money.
// Wise and its webhooks settle a withdrawal; this file only describes them.
// ─────────────────────────────────────────────────────────────────────────────

export type Withdrawal = FunctionReturnType<typeof api.withdrawals.getAll>[number]
export type LedgerStatus = Withdrawal["status"]
export type AuditEntry = FunctionReturnType<typeof api.auditLogs.getByTarget>[number]
export type AnalyticsRow = FunctionReturnType<typeof api.analytics.getAllAnalytics>[number]

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

function plural(n: number, one: string, many: string): string {
    return n === 1 ? one : many
}

// ── Names ────────────────────────────────────────────────────────────────

/**
 * withdrawals.getAll builds creatorName as `${firstName} ${lastName}`, so a
 * missing half arrives as the word "undefined", and a deleted creator as
 * "Unknown". Neither is a name to print.
 */
function cleanName(raw: string | null | undefined): string {
    const name = (raw ?? "")
        .split(/\s+/)
        .filter((w) => w && w !== "undefined" && w !== "null")
        .join(" ")
    return name === "Unknown" ? "" : name
}

export function displayName(w: Withdrawal): string {
    return cleanName(w.creatorName) || "Unknown creator"
}

export function firstName(w: Withdrawal): string {
    return cleanName(w.creatorName).split(" ")[0] || "the creator"
}

// ── Dates ────────────────────────────────────────────────────────────────

/** "Aug 28", with the year only when it is not this year's. */
export function shortDate(ts: number, now: number): string {
    const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear()
    return new Date(ts).toLocaleDateString(
        "en-US",
        sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
    )
}

/** "Aug 28, 2026" — the table's Requested column. */
export function longDate(ts: number): string {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function clock(ts: number): string {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

/** "Aug 28, 2026 · 9:37 AM" — the drawer's Requested row. */
export function dateTime(ts: number): string {
    return `${longDate(ts)} · ${clock(ts)}`
}

/** "Aug 28, 9:37 AM" — a timeline step. */
export function stepDate(ts: number, now: number): string {
    return `${shortDate(ts, now)}, ${clock(ts)}`
}

/** "just now", "12m ago", "2h ago", then a date. */
export function ago(ts: number, now: number): string {
    const mins = Math.floor(Math.max(0, now - ts) / MINUTE_MS)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `on ${shortDate(ts, now)}`
}

/** When anyone (the hourly cron or an admin) last asked Wise about any withdrawal. */
export function lastCheckOf(rows: Withdrawal[]): number | null {
    let last: number | null = null
    for (const w of rows) if (w.lastStatusCheckAt && (last === null || w.lastStatusCheckAt > last)) last = w.lastStatusCheckAt
    return last
}

// ── Wise's own state ─────────────────────────────────────────────────────

/*
 * The same keywords convex/lib/wise.ts reads in getTransferStatus (sent,
 * failed) and isAwaitingOurFunding, matched the same way (substring, lower
 * case). Kept in step by hand: convex/lib/wise.ts also holds the API client
 * and its secrets, so the browser cannot import it. Failure adds the bare
 * 'refunded' / 'bounced' aliases the webhook and describeWiseStatus accept.
 */
const SENT_STATES = ["outgoing_payment_sent", "funds_converted", "paid_out"]
const FAILED_STATES = ["cancelled", "refunded", "bounced", "charged_back", "rejected"]

export type WiseState = "sent" | "failed" | "awaiting_funding" | "moving"

/** Wise's verbose state in four words; null when Wise has never been asked. */
export function wiseStateOf(detail: string | null | undefined): WiseState | null {
    const s = (detail ?? "").trim().toLowerCase()
    if (!s) return null
    if (SENT_STATES.some((x) => s.includes(x))) return "sent"
    if (FAILED_STATES.some((x) => s.includes(x))) return "failed"
    if (AWAITING_FUNDING_STATES.some((x) => s.includes(x))) return "awaiting_funding"
    return "moving"
}

export type WiseOverride = { status: "processing" | "failed"; state: Exclude<WiseState, "sent"> }

/**
 * "Our ledger says paid, Wise says otherwise" (board: "Wise disagrees on one").
 *
 * Payouts shows Wise's own state as the one status. For almost every row that
 * IS the ledger status: the webhook, the hourly cron and the manual check all
 * move `status` in step with Wise. The exception is a row the ledger settled
 * as completed by another route (an admin override from the mobile app, for
 * one) while Wise still holds the money.
 *
 * Trusted ONLY when Wise was asked AFTER the ledger said paid
 * (lastStatusCheckAt > processedAt). wiseDetailedState is written by the cron
 * and the manual check, never by the webhook, so a row the webhook completed
 * keeps whatever state the last poll saw, typically
 * `incoming_payment_waiting` from before the admin funded it. Reading that
 * stale value as "not paid yet" would tell an admin to pay a creator who has
 * been paid: the double payment lib/payouts/fundingState.ts exists to
 * prevent. A row completed without a processedAt (adminRetry) is never
 * second-guessed, for the same reason.
 */
export function wiseOverride(w: Withdrawal): WiseOverride | null {
    if (w.status !== "completed") return null
    if (!w.lastStatusCheckAt || !w.processedAt || w.lastStatusCheckAt <= w.processedAt) return null
    const state = wiseStateOf(w.wiseDetailedState)
    if (state === null || state === "sent") return null
    return { status: state === "failed" ? "failed" : "processing", state }
}

/** The one status a row shows: Wise's own state (see wiseOverride), else the ledger's. */
export function shownStatus(w: Withdrawal): LedgerStatus {
    return wiseOverride(w)?.status ?? w.status
}

export function statusOf(w: Withdrawal): StatusWord {
    return withdrawalStatus(shownStatus(w))
}

/**
 * Rows Wise can still tell us something new about: a transfer exists and, by
 * Wise's own state, it has not settled. The ledger's in-flight rows (as
 * before), plus a paid row Wise disagrees with, which is exactly the one an
 * admin re-checks after releasing it. Settled rows stay out: refreshFromWise
 * would only re-read them, never move them.
 */
export function isSyncable(w: Withdrawal): boolean {
    if (!w.wiseTransferId) return false
    return w.status === "processing" || wiseOverride(w)?.status === "processing"
}

/** A refresh result in plain words: "still waiting for funding". */
export function plainWiseState(detail: string | null | undefined): string {
    const state = wiseStateOf(detail)
    if (state === null) return "Wise has no state for it yet"
    if (state === "sent") return "Wise has sent it"
    if (state === "failed") return "Wise cancelled it"
    if (state === "awaiting_funding") return "still waiting for funding"
    const s = (detail ?? "").toLowerCase()
    if (s.includes("processing")) return "Wise is still sending it"
    if (s.includes("recipient")) return "Wise is waiting on the creator"
    return `Wise says ${detail}`
}

// ── Filters, counts, order ───────────────────────────────────────────────

export type Filter = "failed" | "processing" | "completed" | "all"

export const FILTERS: { key: Filter; label: string; tone: Tone; noun: string }[] = [
    { key: "failed", label: "Failed", tone: "bad", noun: "failed" },
    { key: "processing", label: "Processing", tone: "progress", noun: "processing" },
    { key: "completed", label: "Paid out", tone: "done", noun: "paid out" },
    { key: "all", label: "All", tone: "off", noun: "withdrawals" },
]

/** ?status= values. The old page's 'pending' tab and a plain-English 'paid' still land somewhere. */
export function parseFilter(raw: string | null): Filter | null {
    switch (raw) {
        case "failed":
        case "processing":
        case "completed":
        case "all":
            return raw
        case "pending":
            return "processing"
        case "paid":
            return "completed"
        default:
            return null
    }
}

export function filterOf(w: Withdrawal): Exclude<Filter, "all"> {
    const s = shownStatus(w)
    return s === "pending" ? "processing" : s
}

export function countsOf(rows: Withdrawal[]): Record<Filter, number> {
    const counts: Record<Filter, number> = { failed: 0, processing: 0, completed: 0, all: rows.length }
    for (const w of rows) counts[filterOf(w)] += 1
    return counts
}

/**
 * With no ?status= in the URL: Failed, as the board opens (Today's "See failed
 * payouts" lands here), but only when something has failed. An empty table
 * as the first thing an admin sees answers nothing; All does.
 */
export function defaultFilter(rows: Withdrawal[]): Filter {
    return countsOf(rows).failed > 0 ? "failed" : "all"
}

/**
 * Processing is the work queue (money waiting to be released in Wise), so it
 * runs oldest first: the person who has waited longest gets paid first, as
 * the old funding banner ordered them. Everything else is history, newest
 * first, as the old table was.
 */
export function oldestFirst(filter: Filter): boolean {
    return filter === "processing"
}

export function listRows(rows: Withdrawal[], filter: Filter): Withdrawal[] {
    const picked = filter === "all" ? [...rows] : rows.filter((w) => filterOf(w) === filter)
    return picked.sort((a, b) => (oldestFirst(filter) ? a.createdAt - b.createdAt : b.createdAt - a.createdAt))
}

/** "Newest first · showing 7 failed of 8 withdrawals", with the range and page once there is more than one page. */
export function pageText(filter: Filter, range: { start: number; end: number; page: number; pages: number }, shown: number, total: number): string {
    const order = oldestFirst(filter) ? "Oldest first" : "Newest first"
    const noun = FILTERS.find((f) => f.key === filter)?.noun ?? "withdrawals"
    const all = plural(total, "withdrawal", "withdrawals")
    if (range.pages <= 1) {
        return filter === "all" ? `${order} · showing ${shown} of ${total} ${all}` : `${order} · showing ${shown} ${noun} of ${total} ${all}`
    }
    const what = filter === "all" ? plural(shown, "withdrawal", "withdrawals") : noun
    return `${order} · showing ${range.start}–${range.end} of ${shown} ${what} · page ${range.page} of ${range.pages}`
}

// ── The ledger's own count (the status line) ─────────────────────────────

export function ledgerSummary(rows: Withdrawal[], now: number) {
    const weekAgo = now - 7 * DAY_MS
    let failed = 0
    let inFlight = 0
    let paidCount = 0
    let paidTotal = 0
    let paidWeek = 0
    for (const w of rows) {
        if (w.status === "failed") failed += 1
        else if (w.status === "pending" || w.status === "processing") inFlight += 1
        else if (w.status === "completed") {
            paidCount += 1
            paidTotal += w.amount
            // The old "Completed (week)" card's rule, kept: settled in the
            // last seven days, by processedAt where it exists.
            if ((w.processedAt || w.createdAt) >= weekAgo) paidWeek += w.amount
        }
    }
    return { failed, inFlight, paidCount, paidTotal, paidWeek }
}

/** "the ₱500 to Jefferson Kam on Aug 28" */
export function describeOne(w: Withdrawal, now: number): string {
    return `the ${formatMoney(w.amount)} to ${displayName(w)} on ${shortDate(w.createdAt, now)}`
}

/** The status line's "Wise disagrees" sentence (after "Our ledger's count."). */
export function disagreeSentence(rows: Withdrawal[], now: number): string {
    if (rows.length === 1) {
        const w = rows[0]
        const o = wiseOverride(w)
        const verb =
            o?.state === "failed"
                ? "was cancelled in Wise"
                : o?.state === "moving"
                  ? "is still being sent by Wise"
                  : "is still waiting for funding in Wise"
        return `Wise disagrees on one: ${describeOne(w, now)} ${verb}.`
    }
    return `Wise disagrees on ${rows.length}: they are marked paid here, but Wise has not sent them.`
}

/**
 * The old orange banner ("N payouts waiting for you to release in Wise"), as
 * one sentence. Its three warnings stay: fund from the Creator Payout jar,
 * not the main PHP balance; and the state may be stale, so check before
 * paying again (the reading is only as fresh as the last sync).
 */
export function fundingSentence(rows: Withdrawal[]): string {
    const total = formatMoney(rows.reduce((sum, w) => sum + w.amount, 0))
    if (rows.length === 1) {
        const w = rows[0]
        return `${displayName(w)}’s ${formatMoney(w.amount)} is waiting for you to fund it in Wise. Release it from the Creator Payout jar, not the main PHP balance. Paid it already? Sync with Wise before paying again.`
    }
    return `${rows.length} payouts, ${total} in all, are waiting for you to fund them in Wise. Release each from the Creator Payout jar, not the main PHP balance. Paid one already? Sync with Wise before paying again.`
}

// ── What a row says ──────────────────────────────────────────────────────

/** The one line under a row's status. Failed rows keep theirs for the drawer, as on the board. */
export function rowNote(w: Withdrawal): string | null {
    const o = wiseOverride(w)
    if (o) {
        if (o.state === "awaiting_funding") return "Our ledger says paid · Wise is waiting for the money"
        if (o.state === "failed") return "Our ledger says paid · Wise cancelled it"
        return "Our ledger says paid · Wise is still sending it"
    }
    if (w.status === "pending") return "Creating the transfer in Wise"
    // lib/payouts/fundingState.ts decides this, unchanged: it has been wrong
    // once already in a way that invited a double payment, so it is tested.
    if (needsFunding(w)) return "Waiting for funding in Wise"
    if (w.status === "processing") {
        const s = (w.wiseDetailedState ?? "").toLowerCase()
        if (s.includes("processing")) return "Funded · Wise is sending it"
        if (s.includes("recipient")) return "Waiting on the creator in Wise"
    }
    return null
}

const METHOD: Record<string, string> = {
    wise_email: "Wise email",
    gcash: "GCash",
    maya: "Maya",
    bank_transfer: "Bank transfer",
}

/** "Wise email · j@gmail.com" */
export function payeeLine(w: Withdrawal): string {
    const method = METHOD[w.payoutMethod] ?? (w.payoutMethod ? w.payoutMethod.replace(/_/g, " ") : "")
    const to = w.wiseEmail || w.accountDetails
    return [method, to].filter(Boolean).join(" · ") || "—"
}

/** What to match the transfer on in Wise; the old table's fallback order. */
export function referenceOf(w: Withdrawal): string | null {
    return w.reference || w.wiseTransferId || w.transactionRef || null
}

/**
 * Why a withdrawal failed, and whether Wise said so. errorMessage is written
 * only by markFailed, from a Wise API error; failureReason alone came from an
 * admin (updateStatus). A webhook failure records neither.
 */
export function failureOf(w: Withdrawal): { text: string; fromWise: boolean } | null {
    if (w.errorMessage) return { text: w.errorMessage.replace(/^Wise API error \(\d+\):\s*/i, ""), fromWise: true }
    if (w.failureReason) return { text: w.failureReason, fromWise: false }
    return null
}

function clip(text: string, max = 160): string {
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Stored reasons are fragments as often as sentences; one runs into the next without this. */
function sentence(text: string): string {
    const t = text.trim()
    return /[.!?…]$/.test(t) ? t : `${t}.`
}

export type Note = { tone: Tone; text: string }

/** The drawer's summary note: what is true about this payout, and the one thing to do about it. */
export function drawerNote(w: Withdrawal): Note {
    const first = firstName(w)
    const amount = formatMoney(w.amount)
    const o = wiseOverride(w)
    if (o?.state === "awaiting_funding") {
        return {
            tone: "attn",
            text: `Our ledger marked this paid, but Wise still shows it waiting for funding, so ${first} has not been paid. Release it from the Creator Payout jar in Wise, then check again.`,
        }
    }
    if (o?.state === "failed") {
        return {
            tone: "bad",
            text: `Our ledger marked this paid, but Wise cancelled the transfer: ${first} has not been paid, and the ${amount} was not returned to their balance.`,
        }
    }
    if (o) {
        return { tone: "progress", text: "Our ledger marked this paid, but Wise is still sending it. Check again in a while." }
    }
    if (w.status === "pending") {
        return { tone: "progress", text: "Wise is still creating this transfer. There is nothing to fund yet." }
    }
    if (needsFunding(w)) {
        const ref = referenceOf(w)
        return {
            tone: "attn",
            text: `${first} has not been paid yet: Wise is waiting for the money. Release it from the Creator Payout jar, not the main PHP balance${ref ? `, matching reference ${ref}` : ""}. Already paid it? Check Wise now before paying again.`,
        }
    }
    if (w.status === "processing") {
        const s = (w.wiseDetailedState ?? "").toLowerCase()
        if (s.includes("recipient")) return { tone: "progress", text: `Funded. Wise is waiting for ${first} to claim it.` }
        return { tone: "progress", text: `Funded. Wise is sending it to ${w.wiseEmail || w.accountDetails || first}.` }
    }
    if (w.status === "completed") {
        return {
            tone: "done",
            text: `Paid out to ${w.wiseEmail || w.accountDetails || first}${w.processedAt ? ` on ${longDate(w.processedAt)}` : ""}.`,
        }
    }
    // failed: every route to 'failed' gives the balance back (markFailed,
    // adminRetry, updateStatus and both webhook paths), so this is always true.
    const why = failureOf(w)
    const reason = why ? `${why.fromWise ? "Wise" : "Reason"}: ${sentence(clip(why.text))}` : "No reason was recorded."
    return { tone: "bad", text: `${reason} The ${amount} went back to ${first}’s balance.` }
}

// ── Timeline ─────────────────────────────────────────────────────────────

export type Step = { tone: Tone; label: string; sub?: string; at?: number }

type OverrideMeta = { status?: string; notes?: string; failureReason?: string; transactionRef?: string }

/**
 * The drawer's history: the row's own timestamps, plus the audit log's
 * entries for this withdrawal when they have loaded (when the transfer was
 * created in Wise, and every manual override with its note). Built from the
 * row alone until then.
 */
export function timelineOf(w: Withdrawal, audit?: AuditEntry[]): Step[] {
    const first = firstName(w)
    const o = wiseOverride(w)
    const log = [...(audit ?? [])].sort((a, b) => a.timestamp - b.timestamp)
    const steps: Step[] = [{ tone: "done", label: `Requested by ${first}`, at: w.createdAt }]

    if (w.wiseTransferId) {
        const created = log.find((a) => a.action === "payout_sent")
        steps.push({ tone: "done", label: "Transfer created in Wise", sub: `Transfer ${w.wiseTransferId}`, at: created?.timestamp })
    }

    const overrides = log.filter((a) => a.action === "payout_admin_override")
    for (const a of overrides) {
        const m = (a.metadata ?? {}) as OverrideMeta
        const paid = m.status === "completed"
        steps.push({
            // A mark Wise has since contradicted is history, not the state.
            tone: m.status === "failed" ? "bad" : paid && o ? "off" : "done",
            label: paid ? "Marked paid by an admin" : m.status === "failed" ? "Marked failed by an admin" : `Marked ${m.status ?? "changed"} by an admin`,
            sub: [m.notes, m.failureReason, m.transactionRef && `Ref ${m.transactionRef}`].filter(Boolean).join(" · ") || undefined,
            at: a.timestamp,
        })
    }
    const markedPaid = overrides.some((a) => (a.metadata as OverrideMeta | undefined)?.status === "completed")
    const markedFailed = overrides.some((a) => (a.metadata as OverrideMeta | undefined)?.status === "failed")

    if (o) {
        if (!markedPaid) steps.push({ tone: "off", label: "Marked paid in our ledger", sub: "Before Wise confirmed. Wise’s state wins.", at: w.processedAt })
        if (o.state === "awaiting_funding") {
            steps.push({ tone: "attn", label: "Waiting for funding in Wise", sub: "Release it from the Creator Payout jar", at: w.lastStatusCheckAt })
        } else if (o.state === "failed") {
            steps.push({ tone: "bad", label: "Cancelled in Wise", at: w.lastStatusCheckAt })
        } else {
            steps.push({ tone: "progress", label: "Wise is still sending it", at: w.lastStatusCheckAt })
        }
        return steps
    }

    if (w.status === "pending") {
        steps.push({ tone: "progress", label: "Creating the transfer in Wise" })
    } else if (w.status === "processing") {
        if (needsFunding(w)) {
            steps.push({
                tone: "attn",
                label: "Waiting for funding in Wise",
                sub: w.lastStatusCheckAt ? "Release it from the Creator Payout jar" : "Release it from the Creator Payout jar · not checked with Wise yet",
                at: w.lastStatusCheckAt,
            })
        } else {
            const note = rowNote(w)
            steps.push({ tone: "progress", label: note ?? "With Wise", at: w.lastStatusCheckAt })
        }
    } else if (w.status === "completed") {
        if (!markedPaid) steps.push({ tone: "done", label: "Paid out", at: w.processedAt })
    } else if (!markedFailed) {
        const why = failureOf(w)
        steps.push({ tone: "bad", label: "Failed", sub: why ? clip(why.text) : undefined })
    }
    return steps
}

// ── Raw Wise fields (the fold) ───────────────────────────────────────────

export function rawFields(w: Withdrawal, now: number): { k: string; v: string }[] {
    const out = [
        { k: "Transfer ID", v: w.wiseTransferId || "—" },
        { k: "Wise status", v: w.wiseStatus || "—" },
        { k: "Wise detail", v: w.wiseDetailedState || "—" },
        { k: "Webhook ref", v: w.transactionRef || "—" },
    ]
    if (w.wiseRecipientId) out.push({ k: "Recipient ID", v: w.wiseRecipientId })
    if (w.errorMessage) out.push({ k: "Error", v: w.errorMessage })
    if (w.failureReason && w.failureReason !== w.errorMessage) out.push({ k: "Failure reason", v: w.failureReason })
    out.push({ k: "Last checked", v: w.lastStatusCheckAt ? stepDate(w.lastStatusCheckAt, now) : "never" })
    if (w.unfundedAlertAt) out.push({ k: "Unfunded alert", v: stepDate(w.unfundedAlertAt, now) })
    out.push({ k: "Ledger status", v: w.status })
    out.push({ k: "Payout method", v: w.payoutMethod || "—" })
    out.push({ k: "Withdrawal ID", v: w._id })
    return out
}

// ── Telling the creator ──────────────────────────────────────────────────

/** The notification title and email subject. announcements.send caps it at 120 characters. */
export function messageTitle(w: Withdrawal): string {
    return `About your ${formatMoney(w.amount)} withdrawal on ${longDate(w.createdAt)}`
}

/**
 * The board's draft, kept to what is true here: a failed withdrawal's money
 * is back in the creator's balance, and the Wise email lives in their Wallet.
 * A reason is quoted only when it reads like a sentence; a raw API payload is
 * for the admin, not the creator. Editable before it is sent.
 */
export function messageDraft(w: Withdrawal, supportEmail: string): string {
    const amount = formatMoney(w.amount)
    const why = failureOf(w)?.text.trim() ?? ""
    const reason = why && why.length <= 140 && !/[{}[\]]/.test(why) ? `: ${why.charAt(0).toLowerCase()}${why.slice(1).replace(/\.$/, "")}.` : "."
    return (
        `Hi ${firstName(w) === "the creator" ? "there" : firstName(w)}, your ${amount} withdrawal from ${longDate(w.createdAt)} didn’t go through${reason} ` +
        `The ${amount} is back in your Tendso balance. Please check that the Wise email in your Wallet is right, then withdraw again. ` +
        `If you need a hand, write to us at ${supportEmail}.`
    )
}

// ── Refresh results, in words ────────────────────────────────────────────

/** A thrown Convex error as words: a ConvexError's data, else the message. */
export function errorText(e: unknown, fallback: string): string {
    if (e && typeof e === "object" && "data" in e && typeof (e as { data: unknown }).data === "string") return (e as { data: string }).data
    if (e instanceof Error && e.message) return e.message
    return fallback
}

export type RefreshResult = {
    refreshed: boolean
    reason?: string
    wiseDetailedState?: string
    statusChangedTo?: string
}
export type Checked = { r: RefreshResult | null; error: string | null }
export type Said = { kind: "success" | "error" | "info"; text: string }

/** One row, from the drawer's "Check Wise now". */
export function oneCheckSaid(x: Checked): Said {
    if (x.error) return { kind: "error", text: `Could not check with Wise: ${x.error}` }
    if (!x.r?.refreshed) return { kind: "info", text: x.r?.reason ?? "There is nothing in Wise to check yet." }
    if (x.r.statusChangedTo) return { kind: "success", text: `Checked with Wise: now ${withdrawalStatus(x.r.statusChangedTo).word}.` }
    return { kind: "info", text: `Checked with Wise. Nothing new: ${plainWiseState(x.r.wiseDetailedState)}.` }
}

/**
 * "Sync with Wise". It says what the sync found even when nothing changed:
 * "no change yet" is the answer an admin most needs to trust the list.
 */
export function syncSaid(results: Checked[]): Said {
    const n = results.length
    const transfers = `${n} in-flight ${plural(n, "transfer", "transfers")}`
    const failed = results.filter((x) => x.error)
    if (failed.length) return { kind: "error", text: `Checked ${n} with Wise, but ${failed.length} failed: ${failed[0].error}` }
    const changed = results.filter((x) => x.r?.statusChangedTo)
    if (changed.length) {
        const paid = changed.filter((x) => x.r?.statusChangedTo === "completed").length
        const bad = changed.length - paid
        const parts = [paid ? `${paid} paid out` : "", bad ? `${bad} failed` : ""].filter(Boolean).join(", ")
        return { kind: "success", text: `Synced with Wise. ${transfers} checked: ${parts}.` }
    }
    const waiting = results.filter((x) => wiseStateOf(x.r?.wiseDetailedState) === "awaiting_funding").length
    const tail = waiting === n ? "still waiting for funding" : waiting ? `no change yet, ${waiting} still waiting for funding` : "no change yet"
    return { kind: "info", text: `Synced with Wise. ${transfers} checked, ${tail}.` }
}

// ── Money summary ────────────────────────────────────────────────────────

/** "2026-08" for a timestamp, in UTC, the way the analytics periods are cut (convex/payments.ts). */
export function monthOf(ts: number): string {
    return new Date(ts).toISOString().slice(0, 7)
}

function monthDate(month: string): Date {
    const [y, m] = month.split("-").map(Number)
    return new Date(Date.UTC(y, (m || 1) - 1, 1))
}

export function monthLabel(month: string, withYear: boolean): string {
    return monthDate(month).toLocaleDateString("en-US", withYear ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", timeZone: "UTC" })
}

function nextMonth(month: string): string {
    const d = monthDate(month)
    d.setUTCMonth(d.getUTCMonth() + 1)
    return d.toISOString().slice(0, 7)
}

/**
 * Earnings credited per month, every month from the first to the last
 * (an empty month is a ₱0 point, not a line drawn across the gap).
 *
 * The rows are the old dashboard chart's source (analytics.getAllAnalytics,
 * earningsTotal: the creator payout credited for each paid or comped site,
 * convex/payments.ts). A month is the sum of its DAILY rows when it has any,
 * and its monthly rows only when it has none. Monthly rows are written twice
 * for the same credit (creditCreatorForPayment increments the month directly,
 * and analyticsJobs.aggregateDailyToMonthly adds the day into it again every
 * night), so summing them would roughly double every month the cron has seen.
 * The daily rows are written once.
 */
export function monthlyEarnings(rows: AnalyticsRow[]): { month: string; amount: number }[] {
    const daily = new Map<string, number>()
    const monthly = new Map<string, number>()
    for (const r of rows) {
        const amount = r.earningsTotal || 0
        if (r.periodType === "daily") {
            const month = r.period.slice(0, 7)
            daily.set(month, (daily.get(month) ?? 0) + amount)
        } else {
            monthly.set(r.period, (monthly.get(r.period) ?? 0) + amount)
        }
    }
    // Only real months: a malformed period must not stretch the axis back a century.
    const months = [...new Set([...daily.keys(), ...monthly.keys()])].filter((m) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(m)).sort()
    if (months.length === 0) return []
    const out: { month: string; amount: number }[] = []
    const last = months[months.length - 1]
    for (let m = months[0]; m <= last; m = nextMonth(m)) {
        out.push({ month: m, amount: daily.has(m) ? (daily.get(m) ?? 0) : (monthly.get(m) ?? 0) })
    }
    return out
}
