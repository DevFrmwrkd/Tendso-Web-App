"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAction, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

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
}

export type ScheduledCall = {
    key: string
    startMs: number
    name: string
    email: string
    meetUrl: string | null
    /** Booked on our page, or found only on the calendar. A calendar-only call
     *  holds no slot in our table, which is worth showing rather than hiding. */
    source: "page" | "calendar"
}

export type CallSchedule = {
    upcoming: ScheduledCall[]
    /** Our own rows only — the calendar fetch looks forward, not back. */
    past: Array<{ _id: string; name: string; email: string; startMs: number; status: string }>
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
            if (b.status !== "confirmed" || b.startMs < now) continue
            merged.set(b.calendarEventId ?? String(b._id), {
                key: String(b._id),
                startMs: b.startMs,
                name: b.name,
                email: b.email,
                meetUrl: b.meetUrl ?? null,
                source: "page",
            })
        }
        for (const c of calendarCalls) {
            if (c.startMs < now) continue
            const existing = merged.get(c.eventId)
            if (existing) {
                existing.meetUrl = c.meetUrl ?? existing.meetUrl
                continue
            }
            merged.set(c.eventId, {
                key: c.eventId,
                startMs: c.startMs,
                name: c.name ?? c.summary,
                email: c.email ?? "",
                meetUrl: c.meetUrl,
                source: "calendar",
            })
        }
        return [...merged.values()].sort((a, b) => a.startMs - b.startMs)
    }, [bookings, calendarCalls, now])

    const past = useMemo(() => {
        return (bookings ?? [])
            .filter((b) => b.startMs < now || b.status === "cancelled")
            .map((b) => ({
                _id: String(b._id),
                name: b.name,
                email: b.email,
                startMs: b.startMs,
                status: b.status,
            }))
    }, [bookings, now])

    return {
        upcoming,
        past,
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

/** "just now", "4 minutes ago" — how stale what you are looking at is. */
export function timeSince(ms: number, now: number): string {
    const minutes = Math.floor((now - ms) / 60000)
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
    const hours = Math.round(minutes / 60)
    return `${hours} hour${hours === 1 ? "" : "s"} ago`
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
