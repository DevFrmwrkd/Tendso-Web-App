import type { FunctionReturnType } from "convex/server"

import { formatMoney, withdrawalStatus } from "@/components/r1"
import type { api } from "@/convex/_generated/api"

/*
 * The audit log, made readable (board Audit): every event becomes one
 * sentence ("Theo VA approved Neighborhood"), a kind, a note and a link.
 *
 * Built from what the backend actually writes (convex/auditLogs.ts `log`, and
 * its callers in admin.ts, payments.ts, withdrawals.ts, domains.ts and
 * businessOwners.ts). The schema keeps `action` a plain string because the
 * mobile app shares this deployment and may add its own, so anything this
 * file does not know still gets a plain sentence, never a crash.
 *
 * Pure: no React, no Convex calls.
 */

export type AuditLog = FunctionReturnType<typeof api.auditLogs.getRecent>[number]

// ── Who ─────────────────────────────────────────────────────────────────

export type Actor =
    /** An admin (or staff) account; `key` is "p:" + their Clerk id. */
    | { kind: "person"; key: string; name: string; known: boolean }
    /** The automations (Wise payouts, payment matching, domain setup, the backfill). */
    | { kind: "system"; key: "system"; name: string; role: string }
    /** A business owner editing their own site (adminId "owner:<id>"). */
    | { kind: "owner"; key: "owner"; name: string; role: string }

const SYSTEM_ROLES: Record<string, string> = {
    "system:wise": "Automatic · Wise payout",
    "system:auto-payment": "Automatic · payment matching",
    "system:domain-setup": "Automatic · custom domain setup",
    "system-backfill": "Automatic · rebuilt from old records",
}

function humanize(raw: string): string {
    const s = raw.replace(/[_:-]+/g, " ").trim()
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""
}

export function actorOf(log: AuditLog): Actor {
    const id = log.adminId
    if (id === "system" || id === "system-backfill" || id.startsWith("system:")) {
        const rest = humanize(id.replace(/^system[:-]?/, ""))
        return { kind: "system", key: "system", name: "System", role: SYSTEM_ROLES[id] ?? (rest ? `Automatic · ${rest.toLowerCase()}` : "Automatic") }
    }
    if (id.startsWith("owner:")) return { kind: "owner", key: "owner", name: "The owner", role: "Business owner" }
    // getRecent resolves the name from the creators table: "" for an account
    // with no name on it, the raw id when there is no such account any more.
    const name = (log.adminName ?? "").trim()
    if (name !== "" && name !== id) return { kind: "person", key: `p:${id}`, name, known: true }
    return { kind: "person", key: `p:${id}`, name: name === "" ? "Unnamed account" : "Unknown account", known: false }
}

/** creators.role, as a word. */
export function roleWord(role: string | null | undefined): string {
    switch (role) {
        case "admin":
            return "Admin"
        case "staff":
            return "Staff"
        case "creator":
            return "Creator"
        default:
            return humanize(role ?? "") || "No role"
    }
}

// ── When (always Philippine time: the team and the log's readers are there) ──

const TZ = "Asia/Manila"
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
const yearFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" })
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" })
const dayYearFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", year: "numeric" })
const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" })
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })
const secondsFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit" })

const DAY = 86_400_000

/** "2026-09-29", the calendar day in Manila. */
export function dayKey(ms: number): string {
    return keyFmt.format(ms)
}

/** Whole calendar days between two moments, in Manila. */
function calendarDays(ms: number, now: number): number {
    const utc = (key: string) => {
        const [y, m, d] = key.split("-").map(Number)
        return Date.UTC(y, m - 1, d)
    }
    return Math.round((utc(dayKey(now)) - utc(dayKey(ms))) / DAY)
}

/** A day group's heading: "Today" + "Tue, Sep 29", "Yesterday" + …, or "Fri, Sep 25" alone. */
export function dayHeading(ms: number, now: number): { label: string; sub: string | null } {
    const date = yearFmt.format(ms) === yearFmt.format(now) ? dayFmt.format(ms) : dayYearFmt.format(ms)
    const days = calendarDays(ms, now)
    if (days === 0) return { label: "Today", sub: date }
    if (days === 1) return { label: "Yesterday", sub: date }
    return { label: date, sub: null }
}

/** The row's time: "2h ago" within a week, then the time of day (the day heading carries the date). */
export function shortWhen(ms: number, now: number): string {
    const minutes = Math.floor(Math.max(0, now - ms) / 60_000)
    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return timeFmt.format(ms)
}

/** For a line without a day heading: "2h ago", or "on Sep 25, 2026" past a week. */
export function sinceText(ms: number, now: number): string {
    return now - ms < 7 * DAY ? shortWhen(ms, now) : `on ${dateFmt.format(ms)}`
}

/** The drawer's "Sep 29, 2026 · 12:28:04 PM PHT". */
export function exactTime(ms: number): string {
    return `${dateFmt.format(ms)} · ${secondsFmt.format(ms)} PHT`
}

/** The drawer's "2 hours ago", "Yesterday", "4 days ago", "A month ago". */
export function longWhen(ms: number, now: number): string {
    const minutes = Math.floor(Math.max(0, now - ms) / 60_000)
    if (minutes < 1) return "Just now"
    if (minutes < 60) return minutes === 1 ? "A minute ago" : `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return hours === 1 ? "An hour ago" : `${hours} hours ago`
    const days = Math.max(1, calendarDays(ms, now))
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`
    if (days < 30) {
        const weeks = Math.floor(days / 7)
        return weeks === 1 ? "A week ago" : `${weeks} weeks ago`
    }
    if (days < 365) {
        const months = Math.floor(days / 30)
        return months === 1 ? "A month ago" : `${months} months ago`
    }
    const years = Math.floor(days / 365)
    return years === 1 ? "A year ago" : `${years} years ago`
}

// ── What ────────────────────────────────────────────────────────────────

export type ChipKey = "all" | "approvals" | "rejections" | "deployments" | "payments"

export const CHIPS: { value: ChipKey; label: string }[] = [
    { value: "all", label: "All" },
    { value: "approvals", label: "Approvals" },
    { value: "rejections", label: "Rejections" },
    { value: "deployments", label: "Deployments" },
    { value: "payments", label: "Payments" },
]

/**
 * Which chip an action belongs to. Payments takes every payment_* and
 * payout_* action and the free promo (the old page's Payments tab held only
 * payment_sent, which hid confirmations, Wise payouts and overrides).
 */
export function chipOf(action: string): Exclude<ChipKey, "all"> | "other" {
    if (action === "submission_approved") return "approvals"
    if (action === "submission_rejected") return "rejections"
    if (action === "website_deployed" || action === "website_generated") return "deployments"
    if (action.startsWith("payment_") || action.startsWith("payout_") || action === "submission_comped") return "payments"
    return "other"
}

const KINDS: Record<string, string> = {
    submission: "Submission",
    creator: "Creator",
    withdrawal: "Payout",
    payment: "Payment",
    website: "Website",
}

/** "Submission", "Payout"…: what kind of thing the event changed. */
function kindOf(targetType: string): string {
    return KINDS[targetType] ?? (humanize(targetType) || "Record")
}

export type EventView = {
    id: string
    log: AuditLog
    actor: Actor
    /** The drawer's label: "Approved", "Payout sent". */
    label: string
    /** The sentence is `${actor.name} ${verb} ${target}${tail}`; actor and target are drawn heavier. */
    verb: string
    target: string
    tail: string
    kind: string
    chip: Exclude<ChipKey, "all"> | "other"
    /** What the event is about, for the drawer's Target line: a business, a person, a domain. */
    subject: string
    note: string | null
    link: { href: string; label: string } | null
    /** A live site the event points at (published, a custom domain). */
    liveUrl: string | null
    /** Why there is no link: the target is gone. */
    gone: string | null
    /** Lowercased text the search box matches. */
    haystack: string
}

type Meta = Record<string, unknown>

function metaOf(log: AuditLog): Meta {
    const m: unknown = log.metadata
    return m && typeof m === "object" && !Array.isArray(m) ? (m as Meta) : {}
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const money = (v: unknown): string | null => {
    const n = num(v)
    return n === null ? null : formatMoney(n)
}
const sentences = (...parts: Array<string | null>): string | null => parts.filter(Boolean).join(" ") || null

const submissionLink = (id: string) => ({ href: `/admin/submissions/${id}`, label: "Open submission" })
const creatorLink = (id: string) => ({ href: `/admin/creators?open=${encodeURIComponent(id)}`, label: "Open creator" })
const payoutLink = (id: string) => ({ href: `/admin/payouts?open=${encodeURIComponent(id)}`, label: "Open payout" })

type Described = {
    label: string
    verb: string
    target: string
    tail?: string
    note?: string | null
    subject?: string | null
    link?: EventView["link"] | "none"
    liveUrl?: string | null
    gone?: string | null
}

/**
 * One event, read. `payoutName` resolves a withdrawal id to the creator it
 * paid: payout events carry the amount but not the name.
 */
export function describe(log: AuditLog, payoutName: (withdrawalId: string) => string | null): EventView {
    const m = metaOf(log)
    const actor = actorOf(log)
    const biz = str(m.businessName)
    const backfilled = m.backfilled === true ? "Rebuilt later from the submission’s status, so the time is approximate." : null

    const d = read(log, m, biz, backfilled, payoutName)

    // The thing the event changed, when it still exists and has a screen.
    let link: EventView["link"] =
        log.targetType === "submission"
            ? submissionLink(log.targetId)
            : log.targetType === "creator"
              ? creatorLink(log.targetId)
              : log.targetType === "withdrawal"
                ? payoutLink(log.targetId)
                : null
    if (d.link === "none" || d.gone) link = null
    else if (d.link) link = d.link
    // "a submission" in a sentence, "A submission" on a line of its own; a
    // domain or an amount is left as it is.
    const subject = d.subject ?? biz ?? (/^an? /.test(d.target) ? d.target.charAt(0).toUpperCase() + d.target.slice(1) : d.target)
    const haystack = [biz, str(m.creatorName), str(m.domain), d.subject, d.target].filter(Boolean).join(" ").toLowerCase()

    return {
        id: String(log._id),
        log,
        actor,
        label: d.label,
        verb: d.verb,
        target: d.target,
        tail: d.tail ?? "",
        kind: kindOf(log.targetType),
        chip: chipOf(log.action),
        subject,
        note: d.note ?? null,
        link,
        liveUrl: d.liveUrl ?? null,
        gone: d.gone ?? null,
        haystack,
    }
}

function read(log: AuditLog, m: Meta, biz: string | null, backfilled: string | null, payoutName: (id: string) => string | null): Described {
    const what = biz ?? "a submission"
    switch (log.action) {
        case "submission_approved":
            return { label: "Approved", verb: "approved", target: what, note: backfilled }
        case "submission_rejected":
            return { label: "Rejected", verb: "rejected", target: what, note: str(m.reason) ?? backfilled }
        case "website_generated":
            return { label: "Website generated", verb: "generated the website for", target: what, liveUrl: str(m.websiteUrl) }
        case "website_deployed": {
            const domain = str(m.domain)
            // domains.ts logs the custom-domain steps under this action too.
            if (m.action === "custom_domain_purchase_initiated") {
                return { label: "Domain purchase started", verb: "started buying the domain", target: domain ?? "a custom domain", tail: biz ? ` for ${biz}` : "", subject: biz ?? domain }
            }
            if (m.action === "custom_domain_live") {
                return {
                    label: "Custom domain live",
                    verb: "put the domain",
                    target: domain ?? "a custom domain",
                    tail: " live",
                    note: m.sslReady === false ? "The domain answered, but its security certificate was not ready yet." : null,
                    liveUrl: domain ? `https://${domain}` : null,
                }
            }
            return { label: "Published", verb: "published", target: what, liveUrl: str(m.websiteUrl), note: backfilled }
        }
        case "payment_sent": {
            // admin.ts logs this when the payment email goes to the owner…
            if (str(m.note) === "Payment email sent to client") {
                return { label: "Payment link emailed", verb: "emailed the payment link for", target: what, note: str(m.note) }
            }
            // …payments.ts when an admin records the payment (Mark as paid; it
            // always writes `automated`), and the backfill for paid submissions.
            if ("automated" in m || m.backfilled === true) {
                return { label: "Marked as paid", verb: "marked", target: what, tail: " as paid", note: paidNote(m) ?? backfilled }
            }
            return { label: "Payment sent", verb: "logged a payment for", target: what, note: str(m.note) ?? paidNote(m) }
        }
        case "payment_confirmed":
            return { label: "Payment confirmed", verb: "confirmed the payment for", target: what, note: str(m.note) }
        case "payment_auto_matched":
            // Logged against the submission's id even though the target type is "payment".
            return { label: "Payment matched", verb: "matched the owner’s payment for", target: what, note: paidNote(m), link: submissionLink(log.targetId) }
        case "payment_partial": {
            const received = money(m.receivedAmount)
            const expected = money(m.expectedAmount)
            const ref = str(m.refCode)
            const sub = str(m.submissionId)
            return {
                label: "Partial payment",
                verb: "received a partial payment of",
                target: received ?? "an amount",
                tail: expected ? ` (expected ${expected})` : "",
                subject: ref ? `Payment ${ref}` : "A payment",
                note: sentences("It was not marked as paid.", ref ? `Reference ${ref}.` : null),
                link: sub ? submissionLink(sub) : "none",
            }
        }
        case "payment_unmatched": {
            const amount = money(m.amount)
            const sender = str(m.senderName)
            return {
                label: "Payment not matched",
                verb: "could not match a",
                target: amount ? `${amount} payment` : "payment",
                tail: sender ? ` from ${sender}` : "",
                subject: sender ? `A payment from ${sender}` : "A payment",
                note: str(m.reason),
                link: "none",
            }
        }
        case "submission_comped": {
            const owner = num(m.ownerCharged)
            const earns = money(m.amount)
            const why = str(m.compedReason)
            return {
                label: "Given free (promo)",
                verb: "made",
                target: what,
                tail: " a free promo site",
                note: sentences(
                    owner !== null ? `The owner pays ${formatMoney(owner)}.` : null,
                    earns ? `The creator still earns ${earns}.` : null,
                    why ? `Reason: ${why}.` : null,
                ),
            }
        }
        case "submission_deleted": {
            const assets = Array.isArray(m.deletedAssets) ? m.deletedAssets.filter((a): a is string => typeof a === "string") : []
            return {
                label: "Submission deleted",
                verb: "deleted the submission",
                target: what,
                note: assets.length ? `Also removed: ${assets.map((a) => humanize(a).toLowerCase()).join(", ")}.` : null,
                gone: "This submission was deleted, so there is nothing to open.",
            }
        }
        case "creator_updated": {
            const name = str(m.creatorName)
            if (m.action === "deleted") {
                const n = num(m.submissionsDeleted)
                return {
                    label: "Creator deleted",
                    verb: "deleted the creator",
                    target: name ?? "a creator",
                    note: n ? `${n === 1 ? "Their 1 submission was" : `Their ${n} submissions were`} deleted with them.` : null,
                    gone: "This creator was deleted, so there is nothing to open.",
                }
            }
            if (m.field === "role" && str(m.to)) {
                return {
                    label: "Role changed",
                    verb: "changed the role of",
                    target: name ?? "a creator",
                    tail: ` to ${roleWord(str(m.to))}`,
                    note: str(m.from) ? `${roleWord(str(m.from))} → ${roleWord(str(m.to))}.` : null,
                }
            }
            return { label: "Creator updated", verb: "updated", target: name ?? "a creator" }
        }
        case "manual_override": {
            const domain = str(m.domain)
            if (m.action === "domain_price_ceiling_overridden_by_admin") {
                return { label: "Domain price approved", verb: "bought the domain", target: domain ?? "a custom domain", tail: " above the price ceiling", note: str(m.note) }
            }
            if (m.action === "auto_renewal_disable_failed") {
                return { label: "Auto-renewal still on", verb: "could not turn off auto-renewal for", target: domain ?? "a custom domain", note: str(m.warning) }
            }
            if (m.action === "custom_domain_failed") {
                return { label: "Custom domain failed", verb: "could not set up the domain", target: domain ?? "a custom domain", note: str(m.reason) }
            }
            return { label: "Manual override", verb: "made a manual change to", target: domain ?? what, note: str(m.note) ?? str(m.reason) }
        }
        case "transcription_regenerated":
            return { label: "Transcription regenerated", verb: "regenerated the transcription for", target: what, note: str(m.reason) }
        case "images_enhanced":
            return { label: "Images enhanced", verb: "enhanced images on", target: what, note: str(m.reason) }
        case "payout_sent": {
            const name = payoutName(log.targetId)
            const amount = money(m.amount)
            const viaWise = m.method === "wise_email" || str(m.wiseTransferId) !== null
            return {
                label: "Payout sent",
                verb: name ? `sent a ${amount ? `${amount} ` : ""}payout to` : "sent a",
                target: name ?? (amount ? `${amount} payout` : "payout"),
                tail: viaWise ? " through Wise" : "",
                subject: name ?? (amount ? `${amount} payout` : "A payout"),
                note: m.stage === "transfer_created_awaiting_funding" ? "Transfer created in Wise, waiting for funding." : null,
            }
        }
        case "payout_admin_override": {
            const name = payoutName(log.targetId)
            const amount = money(m.amount)
            const status = str(m.status)
            const word = status ? withdrawalStatus(status).word.toLowerCase() : null
            const payout = amount ? `${amount} payout` : "payout"
            return {
                label: word ? `Payout marked ${word}` : "Payout updated",
                verb: word ? "marked" : "updated",
                target: name ? `${name}’s ${payout}` : `a ${payout}`,
                tail: word ? ` as ${word}` : "",
                subject: name ?? (amount ? `${amount} payout` : "A payout"),
                note: str(m.failureReason) ?? str(m.notes) ?? (str(m.transactionRef) ? `Transfer reference ${str(m.transactionRef)}.` : null),
            }
        }
        case "owner_content_edit": {
            const fields = Array.isArray(m.fields) ? m.fields.filter((f): f is string => typeof f === "string") : []
            return {
                label: "Owner edited the site",
                verb: "edited",
                target: "their site’s text",
                subject: biz ?? "Their site",
                note: fields.length ? `Changed: ${fields.map((f) => humanize(f).toLowerCase()).join(", ")}.` : null,
            }
        }
        default: {
            // An action this page does not know yet (the mobile app shares the log).
            const label = humanize(log.action) || "Event"
            return biz
                ? { label, verb: `logged ${label.toLowerCase()} on`, target: biz }
                : { label, verb: "logged", target: label.toLowerCase(), subject: "No name in the log" }
        }
    }
}

/** What a recorded payment meant in money: the owner's charge and the creator's share. */
function paidNote(m: Meta): string | null {
    const owner = num(m.ownerCharged)
    const earns = money(m.amount)
    return sentences(owner !== null ? `The owner paid ${formatMoney(owner)}.` : null, earns ? `The creator earns ${earns}.` : null)
}

/** Every field the event was stored with, for the drawer's raw fold. */
export function rawRows(log: AuditLog): { k: string; v: string }[] {
    const rows: [string, string][] = [
        ["action", log.action],
        ["targetType", log.targetType],
        ["targetId", log.targetId],
        ["adminId", log.adminId],
        ["timestamp", String(log.timestamp)],
    ]
    const m: unknown = log.metadata
    if (m && typeof m === "object" && !Array.isArray(m)) {
        for (const [k, v] of Object.entries(m as Meta)) {
            if (v === undefined) continue
            rows.push([`metadata.${k}`, typeof v === "string" ? v : JSON.stringify(v)])
        }
    } else if (m !== undefined && m !== null) {
        rows.push(["metadata", typeof m === "string" ? m : JSON.stringify(m)])
    }
    return rows.map(([k, v]) => ({ k, v }))
}
