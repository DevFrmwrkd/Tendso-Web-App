"use client"

import {
    formatCallDate,
    formatClockTime,
    manilaDayKey,
    useNow,
    type ScheduledCall,
} from "@/hooks/useCallSchedule"
import AttendanceTag from "./AttendanceTag"
import OutOfHoursAction from "./OutOfHoursAction"

/**
 * A list of Field Agent calls, grouped by day.
 *
 * THE DATE IS A HEADING, NOT A COLUMN. Every row used to carry its own
 * "Wed, Sep 9, 6:45 PM", which repeats the same date six times down a day's
 * worth of calls and buries the only part that differs — the time. The date is
 * said once per group; the rows keep the clock time alone.
 *
 * A CALL STAYS HERE FOR ITS FULL TEN MINUTES. The schedule drops a call when it
 * ends, not when it starts, so the row is still on screen through the window
 * where nobody has turned up — which is when somebody wants to say so. Once it
 * has started, the row grows the attended / no-show control.
 *
 * Shared by the staff dashboard and /admin/bookings so the two cannot drift.
 */
export default function CallList({
    title,
    calls,
    empty,
    loading,
    onChanged,
}: {
    title: string
    calls: ScheduledCall[]
    empty: string
    loading: boolean
    /** Re-read the schedule after a call is cancelled from this list. */
    onChanged?: () => void
}) {
    const now = useNow()
    const outOfHours = calls.filter((c) => c.outsideHours)
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

            {/* Said once at the top, because one differently-coloured button
                thirty rows down is not something anyone scrolls to find. */}
            {outOfHours.length > 0 && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {outOfHours.length === 1
                        ? "1 call falls outside your bookable hours."
                        : `${outOfHours.length} calls fall outside your bookable hours.`}{" "}
                    Nobody is working then — cancel and send them the current link.
                </p>
            )}

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
                                        className="flex items-start justify-between gap-4 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-zinc-900">
                                                {call.name}
                                                {call.outsideHours ? (
                                                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                                        Outside hours
                                                    </span>
                                                ) : (
                                                    call.source === "calendar" && (
                                                        <span className="ml-2 text-xs font-normal text-zinc-400">
                                                            from the calendar
                                                        </span>
                                                    )
                                                )}
                                            </p>
                                            {call.email && (
                                                <p className="truncate text-xs text-zinc-500">
                                                    {call.email}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-2">
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`text-sm font-medium tabular-nums ${
                                                        call.outsideHours
                                                            ? "text-amber-800"
                                                            : "text-zinc-600"
                                                    }`}
                                                >
                                                    {formatClockTime(call.startMs)}
                                                </span>
                                                {/* No Join on these: joining a call at a time
                                                    nobody works is not an action to offer. */}
                                                {call.outsideHours ? (
                                                    <OutOfHoursAction
                                                        call={call}
                                                        onDone={() => onChanged?.()}
                                                    />
                                                ) : (
                                                    call.meetUrl && (
                                                        <a
                                                            href={call.meetUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
                                                        >
                                                            Join
                                                        </a>
                                                    )
                                                )}
                                            </div>
                                            {/* Only once it has started: there is nothing to
                                                report about a call that has not happened, and a
                                                calendar-only call has no row of ours to write to. */}
                                            {now >= call.startMs && !call.outsideHours && (
                                                <AttendanceTag
                                                    bookingId={call.bookingId}
                                                    attendance={call.attendance}
                                                />
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
