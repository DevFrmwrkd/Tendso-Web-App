import { bookingStatus, type StatusWord } from "@/components/r1"
import {
    formatCallDate,
    formatClockTime,
    formatRoomTime,
    manilaDayKey,
    type CallOrigin,
    type FinishedCall,
    type ScheduledCall,
} from "@/hooks/useCallSchedule"
import type { Id } from "@/convex/_generated/dataModel"
import { manilaMinuteOfDay, minuteLabel } from "@/lib/callStats"

/*
 * The arithmetic and the words behind the call rows on Today and Calls, kept
 * out of the components so the two screens say the same thing about the same
 * call. Pure: no React, no Convex.
 */

/** Where a call is in its ten minutes. */
export type Phase = "soon" | "live" | "done"

export function phaseOf(call: { startMs: number; endMs: number }, now: number): Phase {
    if (now >= call.endMs) return "done"
    if (now >= call.startMs) return "live"
    return "soon"
}

/**
 * The status word for a call row: bookingStatus(), plus the Calls board's
 * "On now" for a call that is running and has no answer yet. bookingStatus()
 * has no word for that moment and would call it "Not answered yet" while the
 * person is still in the room.
 */
export function callStatus(
    call: { status?: string; startMs: number; endMs: number; attendance?: "attended" | "no_show" },
    now: number,
): StatusWord {
    const status = call.status ?? "confirmed"
    if (status === "confirmed" && !call.attendance && now >= call.startMs && now < call.endMs) {
        return { tone: "progress", word: "On now" }
    }
    return bookingStatus({ status, attendance: call.attendance ?? null, startMs: call.startMs }, now)
}

/**
 * One call on a day's list, whichever list it came from. The day's list mixes
 * calls that are still ahead (the schedule) with calls that ended earlier the
 * same day (our own rows), so both are put into the same shape here.
 */
export type DayCall = {
    key: string
    startMs: number
    endMs: number
    name: string
    meetUrl: string | null
    /** Null for a call that exists only on the calendar: nothing to write an outcome onto. */
    bookingId: Id<"native_bookings"> | null
    attendance?: "attended" | "no_show"
    origin?: CallOrigin
    outsideHours: boolean
    /** Seconds the Meet room was open; undefined until somebody has looked. */
    conferenceSeconds?: number
    /** The schedule's own record, for the out-of-hours cancel (upcoming calls only). */
    scheduled: ScheduledCall | null
}

export function fromScheduled(call: ScheduledCall): DayCall {
    return {
        key: call.key,
        startMs: call.startMs,
        endMs: call.endMs,
        name: call.name,
        meetUrl: call.meetUrl,
        bookingId: call.bookingId,
        attendance: call.attendance,
        origin: call.origin,
        outsideHours: call.outsideHours,
        scheduled: call,
    }
}

export function fromFinished(call: FinishedCall): DayCall {
    return {
        key: String(call._id),
        startMs: call.startMs,
        endMs: call.endMs,
        name: call.name,
        meetUrl: null,
        bookingId: call._id,
        attendance: call.attendance,
        origin: call.origin,
        outsideHours: false,
        conferenceSeconds: call.conferenceSeconds,
        scheduled: null,
    }
}

/**
 * Every call on today's Manila calendar day: the ones that already ended
 * (confirmed, from our own rows) and the ones still running or ahead. Ended
 * and upcoming cannot overlap — the schedule drops a call the moment it ends,
 * which is when the finished list picks it up. The schedule's own clock
 * decides which list a call is on, so nothing here re-tests the end time: a
 * second clock a few seconds apart would drop a call that has just ended.
 */
export function callsToday(upcoming: ScheduledCall[], past: FinishedCall[], now: number): DayCall[] {
    const today = manilaDayKey(now)
    const ended = past
        .filter((c) => c.status === "confirmed" && manilaDayKey(c.startMs) === today)
        .map(fromFinished)
    const ahead = upcoming.filter((c) => manilaDayKey(c.startMs) === today).map(fromScheduled)
    return [...ended, ...ahead].sort((a, b) => a.startMs - b.startMs)
}

/** The row a day's list leads with: the call on now, else the next one. */
export function focusKey(calls: DayCall[], now: number): string | null {
    const live = calls.find((c) => phaseOf(c, now) === "live")
    if (live) return live.key
    return calls.find((c) => phaseOf(c, now) === "soon")?.key ?? null
}

/**
 * "tonight" when every call in the list is in the evening, otherwise "today".
 * The bookable hours include a midday window, so "tonight" is only true some
 * of the time; saying it at 10 AM about an 11 AM call would be wrong.
 */
export function dayPart(calls: { startMs: number }[]): "today" | "tonight" {
    return calls.length > 0 && calls.every((c) => manilaMinuteOfDay(c.startMs) >= 18 * 60) ? "tonight" : "today"
}

export function plural(n: number, one: string, many: string): string {
    return n === 1 ? one : many
}

/**
 * The calls still to come today, as the statusline says them: "4 calls
 * tonight, the first at 8:00 PM", "3 calls today, one on now", "no more calls
 * today". Read off the schedule, which keeps a call until it ends.
 */
export function callsLeftLine(upcoming: ScheduledCall[], now: number): string {
    const today = manilaDayKey(now)
    const left = upcoming.filter((c) => manilaDayKey(c.startMs) === today)
    if (left.length === 0) return "no more calls today"
    const count = `${left.length} ${plural(left.length, "call", "calls")} ${dayPart(left)}`
    if (left.some((c) => phaseOf(c, now) === "live")) return `${count}, one on now`
    return left.length === 1
        ? `${count}, at ${formatClockTime(left[0].startMs)}`
        : `${count}, the first at ${formatClockTime(left[0].startMs)}`
}

export function capitalise(text: string): string {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

/** "Tuesday, September 29", in Manila, where the calls happen. */
export function longDay(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        timeZone: "Asia/Manila",
        weekday: "long",
        month: "long",
        day: "numeric",
    })
}

/** "Sep 28", in Manila. */
export function shortDate(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" })
}

/** "Sep 15, 2026", in Manila. */
export function fullDate(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

/**
 * What Google said about the Meet room. Silent-but-honest when nobody has
 * looked yet, because "never opened" and "not checked" mean opposite things.
 * A hint for whoever marks the call, never the answer.
 */
export function roomLine(seconds: number | undefined): string {
    if (seconds === undefined) return "No room reading yet"
    if (seconds === 0) return "Room never opened"
    return `Room open ${formatRoomTime(seconds)}`
}

/** Consecutive calls on the same Manila day, in the order given. */
export function groupByDay<T extends { startMs: number }>(items: T[]): { key: string; label: string; items: T[] }[] {
    const groups: { key: string; label: string; items: T[] }[] = []
    for (const item of items) {
        const key = manilaDayKey(item.startMs)
        const last = groups[groups.length - 1]
        if (last?.key === key) last.items.push(item)
        else groups.push({ key, label: formatCallDate(item.startMs), items: [item] })
    }
    return groups
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** "Mon–Fri" for a run of three or more days, else "Mon, Wed, Fri". */
export function daysSummary(days: number[]): string {
    const on = [...new Set(days)].sort((a, b) => a - b)
    if (!on.length) return "No days"
    const run = on.every((d, i) => i === 0 || d === on[i - 1] + 1)
    if (run && on.length > 2) return `${DAY_NAMES[on[0]]}–${DAY_NAMES[on[on.length - 1]]}`
    return on.map((d) => DAY_NAMES[d]).join(", ")
}

/** "between 8:00 PM and 12:00 AM" for a bookable window in minutes past midnight. */
export function betweenLabel([start, end]: [number, number]): string {
    return `between ${minuteLabel(start)} and ${minuteLabel(end)}`
}

/**
 * Which bookable window holds most of these calls, when one clearly does:
 * "50 of them were between 8:00 PM and 12:00 AM". Null when there is one
 * window or none, or when no window holds more than half, because then the
 * split says nothing worth a sentence.
 */
export function busiestWindow(
    calls: { startMs: number }[],
    windows: Array<[number, number]>,
): { count: number; window: [number, number] } | null {
    if (windows.length < 2 || calls.length === 0) return null
    let best: { count: number; window: [number, number] } | null = null
    for (const window of windows) {
        const count = calls.filter((c) => {
            const minute = manilaMinuteOfDay(c.startMs)
            return minute >= window[0] && minute < window[1]
        }).length
        if (!best || count > best.count) best = { count, window }
    }
    return best && best.count * 2 > calls.length ? best : null
}
