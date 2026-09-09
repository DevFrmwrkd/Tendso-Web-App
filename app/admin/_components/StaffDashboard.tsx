"use client"

import Link from "next/link"
import { useMemo } from "react"
import { CalendarClock, Video } from "lucide-react"

import {
    formatCallTime,
    manilaDayKey,
    timeUntil,
    useCallSchedule,
    useNow,
    type ScheduledCall,
} from "@/hooks/useCallSchedule"

/**
 * What an internal staff account sees when they open Tendso.
 *
 * They run the 10-minute Field Agent calls and nothing else, so this answers
 * the only three questions that job has: is one starting soon, what is on today,
 * and what is coming. Every call carries its Join link, which is the point —
 * the whole role exists so nobody needs the tendso.hr mailbox to get on a call.
 *
 * Read-only by construction. Nothing here changes anything; the Sync button and
 * the bookable hours are admin-only and refused server-side either way.
 */
export default function StaffDashboard({ firstName }: { firstName?: string }) {
    const { upcoming, calendarError, loading } = useCallSchedule(true)
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
        <div className="max-w-4xl space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-bold text-zinc-900">
                    {firstName ? `Hi ${firstName}` : "Your calls"}
                </h1>
                <p className="text-sm text-zinc-500">
                    The 10-minute Field Agent calls. Philippine time.
                </p>
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

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Today" value={today.length} />
                <Stat label="Next 7 days" value={thisWeek} />
                <Stat label="Booked ahead" value={upcoming.length} />
            </div>

            <CallList
                title={`Today${today.length ? ` (${today.length})` : ""}`}
                calls={today}
                empty="No calls left today."
                loading={loading}
            />

            <CallList
                title="Coming up"
                calls={upcoming.filter((c) => !today.includes(c))}
                empty="Nothing further booked yet."
                loading={loading}
            />

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

function CallList({
    title,
    calls,
    empty,
    loading,
}: {
    title: string
    calls: ScheduledCall[]
    empty: string
    loading: boolean
}) {
    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="font-semibold text-zinc-900">{title}</h2>
            {loading ? (
                <p className="pt-3 text-sm text-zinc-400">Loading…</p>
            ) : calls.length === 0 ? (
                <p className="pt-3 text-sm text-zinc-400">{empty}</p>
            ) : (
                <ul className="divide-y divide-zinc-100 pt-1">
                    {calls.map((c) => (
                        <li key={c.key} className="flex items-baseline justify-between gap-4 py-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-zinc-900">
                                    {c.name}
                                    {c.source === "calendar" && (
                                        <span className="ml-2 text-xs font-normal text-zinc-400">
                                            from the calendar
                                        </span>
                                    )}
                                </p>
                                {c.email && (
                                    <p className="truncate text-xs text-zinc-500">{c.email}</p>
                                )}
                            </div>
                            <div className="flex items-baseline gap-3 whitespace-nowrap">
                                {c.meetUrl && (
                                    <a
                                        href={c.meetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-medium text-zinc-900 underline"
                                    >
                                        Join
                                    </a>
                                )}
                                <span className="text-sm text-zinc-600">
                                    {formatCallTime(c.startMs)}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
