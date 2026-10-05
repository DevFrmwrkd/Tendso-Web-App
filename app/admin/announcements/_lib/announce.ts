import type { StatusWord } from "@/components/r1"
import { AUDIENCES, type AudienceKey } from "@/lib/announcements/audience"
import { greetingName } from "@/lib/email/greeting"

/**
 * Words and small formatting for the Announcements page (board Announcements).
 * Pure: no React, no Convex. Who receives a broadcast is decided ONLY by
 * lib/announcements/audience.ts on the server; nothing here filters people.
 */

/**
 * What the page targets: one of the audience rules, or people picked by hand.
 * Picking is not a fifth AudienceKey on purpose (see the page): it bypasses
 * the rules rather than being one of them.
 */
export type Target = AudienceKey | "pick"

/** The audience a fresh page starts on; the board marks its card "Default". */
export const DEFAULT_AUDIENCE: AudienceKey = "certified"

/** The send action's own limits (convex/announcements.ts `send`). */
export const TITLE_MAX = 120
export const BODY_MAX = 4000

export function fmt(n: number): string {
    return n.toLocaleString("en-US")
}

/**
 * The word for the people being counted. "creators" for the creator
 * audiences; "people" where admins can be in it ("Everyone, admins included")
 * or where they were picked by hand (a pick can name an admin).
 */
export function noun(target: Target, n: number): string {
    if (target === "all" || target === "pick") return n === 1 ? "person" : "people"
    return n === 1 ? "creator" : "creators"
}

export function recipientsText(n: number): string {
    return `${fmt(n)} ${n === 1 ? "recipient" : "recipients"}`
}

/**
 * A few real names behind a count, because a bare number hides a wrong filter:
 * "e.g. Jefferson Kam, Steven Madali, Mikee Joy Cumal and 162 more".
 */
export function sampleText(names: string[], count: number): string {
    if (count === 0) return "Nobody yet"
    const shown = names.slice(0, 3)
    if (shown.length === 0) return ""
    const more = count - shown.length
    return `e.g. ${shown.join(", ")}${more > 0 ? ` and ${fmt(more)} more` : ""}`
}

/**
 * The paragraphs exactly as the email builds them (getAnnouncementEmailHtml
 * in lib/email/templates.ts): split on blank lines, trimmed, empties dropped.
 * A single line break stays inside its paragraph.
 */
export function paragraphs(body: string): string[] {
    return body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
}

/**
 * The "Hi …," line of the preview. The real email greets with
 * greetingName(firstName, lastName); previewAudience only returns the joined
 * display name (or the email when a creator has no name), so this takes its
 * first word, and falls back to "there" rather than an email address, the way
 * greetingName does. A two-word first name ("Mikee Joy") previews as its
 * first word only.
 */
export function previewGreeting(displayName: string | null | undefined): string {
    const name = (displayName ?? "").trim()
    if (!name || name.includes("@")) return greetingName({})
    return greetingName({ firstName: name.split(/\s+/)[0] })
}

/**
 * The audience column of a sent announcement: an AudienceKey, or "3 picked"
 * for a hand-picked send (convex/announcements.ts records it that way so the
 * history never claims a rule it did not use).
 */
export function audienceLabel(raw: string): string {
    const rule = AUDIENCES.find((a) => a.key === raw)
    if (rule) return rule.label
    if (/^\d+ picked$/.test(raw)) return "Picked people"
    return raw
}

/** announcements.status: 'sending' | 'sent' | 'failed' (convex/schema.ts). */
export function announcementStatus(status: string): StatusWord {
    switch (status) {
        case "sent":
            return { tone: "done", word: "Sent" }
        case "failed":
            return { tone: "bad", word: "Failed" }
        case "sending":
            return { tone: "progress", word: "Sending" }
        default:
            return { tone: "off", word: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown" }
    }
}

/** "Sep 24", with the year only when it is not this year's. */
export function shortDate(ts: number, now: number = Date.now()): string {
    const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear()
    return new Date(ts).toLocaleDateString(
        "en-US",
        sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
    )
}

/**
 * The sentence to show for a failed send. The action throws plain Errors with
 * a readable message ("That audience matches nobody — nothing was sent.");
 * Convex wraps it as "… Uncaught Error: <message>", so the message is lifted
 * out of the wrapper when it is there.
 */
export function errorText(e: unknown): string {
    const data = (e as { data?: unknown } | null)?.data
    if (typeof data === "string" && data) return data
    const message = e instanceof Error ? e.message : ""
    const inner = /Uncaught Error: ([^\n]+)/.exec(message)?.[1]
    return (inner ?? message) || "Something went wrong."
}
