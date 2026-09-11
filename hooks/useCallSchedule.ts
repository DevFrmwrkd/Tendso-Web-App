"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAction, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

/**
 * The Field Agent call schedule, as one list.
 *
 * TWO SOURCES, ON PURPOSE. Bookings made through /field-agent/book live in our
 * own table, Meet link and all. Bookings made any other way — the TidyCal
 * fallback, or an event someone creates by hand — exist ONLY on the tendso.hr
 * calendar. Whoever is running the calls needs to see both without opening that
 * mailbox, which is the entire reason the 'staff' role exists.
 *
 * Shared by /admin/bookings and the staff dashboard so the two can never
 * disagree about what is booked.
 */

/** A Tendso call as the calendar has it — mirrors booking.listCalendarCalls. */
export type CalendarCall = {
    eventId: string
    startMs: number
    endMs: number
    summary: string
    meetUrl: string | null
    name: string | null
    email: string | null
    outsideHours: boolean
}

export type ScheduledCall = {
    key: string
    startMs: number
    /** When the call is over. A call stays in `upcoming` until this passes, not
     *  until it starts — otherwise it vanishes from the screen at the moment
     *  someone is sitting in it, which is exactly when it is being looked at. */
    endMs: number
    name: string
    email: string
    meetUrl: string | null
    /** Booked on our page, or found only on the calendar. A calendar-only call
     *  holds no slot in our table, which is worth showing rather than hiding. */
    source: "page" | "calendar"
    /** Booked at a time we do not work — the old link sold these. Comes from the
     *  server, which checks it against the same schedule the booking form uses;
     *  the page never re-derives the hours. Null when only our own row is known
     *  and the calendar could not be read to say. */
    outsideHours: boolean
    /** The calendar event, which is what cancelling one of these acts on. */
    eventId: string | null
    /** Our own booking row, when the call came through our page. Null for a
     *  calendar-only call: there is no row of ours to write an outcome onto, so
     *  those cannot be tagged attended or no-show. */
    bookingId: Id<"native_bookings"> | null
    /** What the person who sat it says happened, once they have said. Set here
     *  as well as on the finished list because a call can be tagged while it is
     *  still running — three minutes of an empty room is already an answer. */
    attendance?: "attended" | "no_show"
}

/**
 * A call that is over, where the only open question is what happened in it.
 *
 * Our own rows only — the calendar fetch looks forward, not back, so a call
 * booked through the old link leaves nothing behind to tag.
 */
export type FinishedCall = {
    _id: Id<"native_bookings">
    name: string
    email: string
    startMs: number
    endMs: number
    status: string
    /** How long a conference ran in this booking's Meet room. Undefined means
     *  nobody has looked yet; 0 means we looked and the room was never opened.
     *  It proposes an answer and never gives one — see setAttendance. */
    conferenceSeconds?: number
    attendance?: "attended" | "no_show"
}

export type CallSchedule = {
    upcoming: ScheduledCall[]
    /** Our own rows only — the calendar fetch looks forward, not back. */
    past: FinishedCall[]
    /** Finished, not cancelled, and nobody has yet said whether it happened.
     *  An inbox rather than a report: it empties as calls get tagged, and an
     *  empty one means every call is accounted for. */
    needsAttendance: FinishedCall[]
    /** Set when the calendar could not be read. The list is then our rows alone,
     *  which is worth saying out loud rather than quietly showing less. */
    calendarError: string | null
    loading: boolean
    /** Re-read the calendar. The Convex side is reactive and needs no help; the
     *  calendar is a one-shot action, so a call booked elsewhere — TidyCal, or
     *  by hand — only appears when something asks again. */
    refresh: () => void
    refreshing: boolean
    /** When the calendar was last read, so the page can say how fresh it is. */
    lastRefreshed: number | null
}

/**
 * The current time, as state rather than a Date.now() in render.
 *
 * Two reasons. Reading the clock while rendering is impure — React may render
 * twice and get two answers — and a schedule that never re-reads it would go on
 * showing a finished call as "next" all afternoon. Ticking once a minute is
 * plenty for a page counting in minutes.
 */
export function useNow(intervalMs = 60_000): number {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])
    return now
}

export function useCallSchedule(enabled: boolean): CallSchedule {
    const bookings = useQuery(api.nativeBookings.listForAdmin, enabled ? { limit: 200 } : "skip")
    const listCalendarCalls = useAction(api.booking.listCalendarCalls)

    const [calendarCalls, setCalendarCalls] = useState<CalendarCall[]>([])
    const [calendarError, setCalendarError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)

    // Split in two on purpose. `load` touches state only after the await, so the
    // mount effect below does not set state synchronously — React's lint rule
    // flags that as a cascading render, and it is right to.
    const load = useCallback(async () => {
        if (!enabled) return
        try {
            const calls = await listCalendarCalls({})
            setCalendarCalls(calls)
            setCalendarError(null)
            setLastRefreshed(Date.now())
        } catch (err) {
            setCalendarError(
                err instanceof Error ? err.message : "Could not read the calendar.",
            )
        }
    }, [enabled, listCalendarCalls])

    /** The button's version: shows a spinner for as long as the read takes. */
    const refresh = useCallback(() => {
        setRefreshing(true)
        void load().finally(() => setRefreshing(false))
    }, [load])

    useEffect(() => {
        // The lint rule cannot see past the await inside `load`: nothing here
        // sets state synchronously, so there is no cascading render to prevent.
        // Inlining the fetch to satisfy it would mean two copies of it.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load()
    }, [load])

    /**
     * Merged and keyed by calendar event id. Our row wins on what we recorded
     * directly (who booked, their email); the calendar wins on the Meet link,
     * because if the event was recreated ours is the stale one.
     */
    const now = useNow()

    const upcoming = useMemo(() => {
        const merged = new Map<string, ScheduledCall>()

        for (const b of bookings ?? []) {
            if (b.status !== "confirmed" || b.endMs < now) continue
            merged.set(b.calendarEventId ?? String(b._id), {
                key: String(b._id),
                startMs: b.startMs,
                endMs: b.endMs,
                name: b.name,
                email: b.email,
                meetUrl: b.meetUrl ?? null,
                source: "page",
                // Anything booked through our own page passed the same check at
                // booking time, so it is in hours by construction. The calendar
                // pass below corrects this if it disagrees.
                outsideHours: false,
                eventId: b.calendarEventId ?? null,
                bookingId: b._id,
                attendance: b.attendance,
            })
        }
        for (const c of calendarCalls) {
            if (c.endMs < now) continue
            const existing = merged.get(c.eventId)
            if (existing) {
                existing.meetUrl = c.meetUrl ?? existing.meetUrl
                // The calendar is the one that was asked; if the schedule moved
                // after a booking was made, its answer is the current one.
                existing.outsideHours = c.outsideHours
                existing.eventId = c.eventId
                continue
            }
            merged.set(c.eventId, {
                key: c.eventId,
                startMs: c.startMs,
                endMs: c.endMs,
                name: c.name ?? c.summary,
                email: c.email ?? "",
                meetUrl: c.meetUrl,
                source: "calendar",
                outsideHours: c.outsideHours,
                eventId: c.eventId,
                bookingId: null,
            })
        }
        return [...merged.values()].sort((a, b) => a.startMs - b.startMs)
    }, [bookings, calendarCalls, now])

    const past = useMemo(() => {
        return (bookings ?? [])
            .filter((b) => b.endMs < now || b.status === "cancelled")
            .map((b) => ({
                _id: b._id,
                name: b.name,
                email: b.email,
                startMs: b.startMs,
                endMs: b.endMs,
                status: b.status,
                conferenceSeconds: b.conferenceSeconds,
                attendance: b.attendance,
            }))
    }, [bookings, now])

    /**
     * The ones still waiting on a human answer.
     *
     * CANCELLED CALLS ARE NOT IN HERE. A call nobody was going to sit is not a
     * no-show, and asking about it would make the list something to dismiss
     * rather than something to empty.
     *
     * STOPS AT A FORTNIGHT. Past that nobody remembers who turned up, so an
     * answer would be a guess — and a list that only ever grows gets ignored.
     */
    const needsAttendance = useMemo(() => {
        const floor = now - 14 * 24 * 60 * 60 * 1000
        return past
            .filter(
                (b) =>
                    b.status === "confirmed" &&
                    !b.attendance &&
                    b.endMs < now &&
                    b.startMs > floor,
            )
            .sort((a, b) => b.startMs - a.startMs)
    }, [past, now])

    return {
        upcoming,
        past,
        needsAttendance,
        calendarError,
        loading: bookings === undefined,
        refresh,
        refreshing,
        lastRefreshed,
    }
}

/** Manila-time day key, so "today" means today where the calls happen. */
export function manilaDayKey(ms: number): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(ms))
}

/** "Wed, Sep 9" — said once per day group, not on every row. */
export function formatCallDate(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        timeZone: "Asia/Manila",
        weekday: "short",
        month: "short",
        day: "numeric",
    })
}

/** "6:45 PM" — what actually differs between one row and the next. */
export function formatClockTime(ms: number): string {
    return new Date(ms).toLocaleTimeString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
    })
}

/** Date and time together. Still used where a row stands alone. */
export function formatCallTime(ms: number): string {
    return new Date(ms).toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })
}

/**
 * How long the Meet room was open, in words.
 *
 * Deliberately vague about what it proves. "9s" is somebody opening the room and
 * leaving; "12m" is a call that happened. Neither says who was in it — Google
 * will not tell a consumer account that — so this informs the person tagging the
 * call and never decides for them.
 */
export function formatRoomTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    // Seconds still shown below ten minutes, because on a ten-minute call the
    // difference between a minute and two is the difference between somebody
    // looking in and somebody starting a conversation.
    if (minutes < 10 && rest > 0) return `${minutes}m ${rest}s`
    return `${minutes}m`
}

/** "just now", "4 minutes ago" — how stale what you are looking at is. */
export function timeSince(ms: number, now: number): string {
    const minutes = Math.floor((now - ms) / 60000)
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
    const hours = Math.round(minutes / 60)
    return `${hours} hour${hours === 1 ? "" : "s"} ago`
}

/** True while the call is happening: started, not yet over. */
export function isInProgress(call: { startMs: number; endMs: number }, now: number): boolean {
    return now >= call.startMs && now < call.endMs
}

/** "in 25 minutes", "in 3 hours", "tomorrow" — how far off the next call is. */
export function timeUntil(ms: number, now: number): string {
    const diff = ms - now
    if (diff <= 0) return "now"
    const minutes = Math.round(diff / 60000)
    if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`
    const days = Math.round(hours / 24)
    return days === 1 ? "tomorrow" : `in ${days} days`
}
