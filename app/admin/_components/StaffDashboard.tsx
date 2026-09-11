"use client"

import Link from "next/link"
import { useMemo } from "react"
import { CalendarClock, RefreshCw, Video } from "lucide-react"

import {
    formatCallTime,
    manilaDayKey,
    timeSince,
    timeUntil,
    useCallSchedule,
    useNow,
} from "@/hooks/useCallSchedule"
import CallList from "./CallList"

/**
 * What an internal staff account sees when they open Tendso.
 *
 * They run the 10-minute Field Agent calls and nothing else, so this answers
 * the only three questions that job has: is one starting soon, what is on today,
 * and what is coming. Every call carries its Join link, which is the point —
 * the whole role exists so nobody needs the tendso.hr mailbox to get on a call.
 *
 * Read-only. Nothing on this page changes anything — the one thing the role can
 * write is the bookable hours, over on /admin/bookings.
 */
export default function StaffDashboard({ firstName }: { firstName?: string }) {
    const { upcoming, calendarError, loading, refresh, refreshing, lastRefreshed } =
        useCallSchedule(true)
    const now = useNow()

    const next = upcoming[0] ?? null

    const today = useMemo(() => {
        const key = manilaDayKey(now)
        return upcoming.filter((c) => manilaDayKey(c.startMs) === key)
    }, [upcoming, now])

    const thisWeek = useMemo(
        () => upcoming.filter((c) => c.startMs < now + 7 * 24 * 60 * 60 * 1000).length,
        [upcoming, now],
    )

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-zinc-900">
                        {firstName ? `Hi ${firstName}` : "Your calls"}
                    </h1>
                    <p className="text-sm text-zinc-500">
                        The 10-minute Field Agent calls. Philippine time.
                    </p>
                </div>

                {/* Bookings made HERE arrive on their own — that side is reactive.
                    A call booked through TidyCal or added to the calendar by hand
                    only shows up when the calendar is read again, which is what
                    this does. */}
                <div className="flex items-center gap-3">
                    {lastRefreshed && !refreshing && (
                        <span className="text-xs text-zinc-400">
                            Updated {timeSince(lastRefreshed, now)}
                        </span>
                    )}
                    <button
                        onClick={refresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        {refreshing ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
            </header>

            {calendarError && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Showing calls booked through the site only — {calendarError}
                </p>
            )}

            {/* The next call, given its own weight: it is the thing you act on. */}
            <section className="rounded-xl bg-zinc-900 p-6 text-white">
                {loading ? (
                    <p className="text-sm text-zinc-400">Loading your schedule…</p>
                ) : next ? (
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                Next call · {timeUntil(next.startMs, now)}
                            </span>
                            <p className="text-2xl font-bold truncate">{next.name}</p>
                            <p className="text-sm text-zinc-300">{formatCallTime(next.startMs)}</p>
                            {next.email && (
                                <p className="text-sm text-zinc-400 truncate">{next.email}</p>
                            )}
                        </div>
                        {next.meetUrl ? (
                            <a
                                href={next.meetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
                            >
                                <Video className="h-4 w-4" /> Join the call
                            </a>
                        ) : (
                            <span className="text-sm text-zinc-400">No Meet link on this one</span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-3 text-zinc-300">
                        <CalendarClock className="h-5 w-5" />
                        <p className="text-sm">Nothing booked. Enjoy the quiet.</p>
                    </div>
                )}
            </section>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:max-w-3xl">
                <Stat label="Today" value={today.length} />
                <Stat label="Next 7 days" value={thisWeek} />
                <Stat label="Booked ahead" value={upcoming.length} />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-2">
                <CallList
                    title={`Today${today.length ? ` (${today.length})` : ""}`}
                    calls={today}
                    empty="No calls left today."
                    loading={loading}
                    onChanged={refresh}
                />

                <CallList
                    title="Coming up"
                    calls={upcoming.filter((c) => !today.includes(c))}
                    empty="Nothing further booked yet."
                    loading={loading}
                    onChanged={refresh}
                />
            </div>

            <p className="text-sm text-zinc-500">
                Every booking, including past and cancelled ones, is on the{" "}
                <Link href="/admin/bookings" className="underline">
                    bookings page
                </Link>
                .
            </p>
        </div>
    )
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-2xl font-bold text-zinc-900">{value}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        </div>
    )
}
