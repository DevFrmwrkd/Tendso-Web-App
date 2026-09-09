"use client"

import { formatCallDate, formatClockTime, manilaDayKey, type ScheduledCall } from "@/hooks/useCallSchedule"

/**
 * A list of Field Agent calls, grouped by day.
 *
 * THE DATE IS A HEADING, NOT A COLUMN. Every row used to carry its own
 * "Wed, Sep 9, 6:45 PM", which repeats the same date six times down a day's
 * worth of calls and buries the only part that differs — the time. The date is
 * said once per group; the rows keep the clock time alone.
 *
 * Shared by the staff dashboard and /admin/bookings so the two cannot drift.
 */
export default function CallList({
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
    // Calls arrive sorted, so first-seen order is chronological.
    const groups: Array<{ key: string; label: string; calls: ScheduledCall[] }> = []
    for (const call of calls) {
        const key = manilaDayKey(call.startMs)
        const last = groups[groups.length - 1]
        if (last?.key === key) last.calls.push(call)
        else groups.push({ key, label: formatCallDate(call.startMs), calls: [call] })
    }

    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="font-semibold text-zinc-900">{title}</h2>

            {loading ? (
                <p className="pt-3 text-sm text-zinc-400">Loading…</p>
            ) : groups.length === 0 ? (
                <p className="pt-3 text-sm text-zinc-400">{empty}</p>
            ) : (
                <div className="space-y-5 pt-4">
                    {groups.map((group) => (
                        <div key={group.key}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                {group.label}
                            </p>
                            <ul className="divide-y divide-zinc-100">
                                {group.calls.map((call) => (
                                    <li
                                        key={call.key}
                                        className="flex items-center justify-between gap-4 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-zinc-900">
                                                {call.name}
                                                {call.source === "calendar" && (
                                                    <span className="ml-2 text-xs font-normal text-zinc-400">
                                                        from the calendar
                                                    </span>
                                                )}
                                            </p>
                                            {call.email && (
                                                <p className="truncate text-xs text-zinc-500">
                                                    {call.email}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-3">
                                            <span className="text-sm font-medium tabular-nums text-zinc-600">
                                                {formatClockTime(call.startMs)}
                                            </span>
                                            {call.meetUrl && (
                                                <a
                                                    href={call.meetUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
                                                >
                                                    Join
                                                </a>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}
