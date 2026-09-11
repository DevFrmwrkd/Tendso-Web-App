"use client"

import type { ReactNode } from "react"

import {
    type FinishedCall,
    formatCallDate,
    formatClockTime,
    formatRoomTime,
    manilaDayKey,
    originLabel,
} from "@/hooks/useCallSchedule"
import AttendanceTag from "./AttendanceTag"

/**
 * Calls that are over, and what happened in them.
 *
 * Two call sites, two shapes. The staff dashboard shows the short list still
 * waiting on an answer and leaves it open, because it is a thing to clear. The
 * bookings page shows the whole archive and collapses it, because it is a thing
 * to look something up in.
 *
 * Grouped by day like the upcoming list, so the date is said once rather than
 * repeated down every row.
 */
export default function FinishedCallList({
    title,
    calls,
    empty,
    loading,
    intro,
    action,
    collapsible = false,
}: {
    title: string
    calls: FinishedCall[]
    empty: string
    loading: boolean
    /** One line under the heading saying why this list exists. */
    intro?: string
    /** Header slot, for whatever refreshes what the list shows. */
    action?: ReactNode
    collapsible?: boolean
}) {
    const groups: Array<{ key: string; label: string; calls: FinishedCall[] }> = []
    for (const call of calls) {
        const key = manilaDayKey(call.startMs)
        const last = groups[groups.length - 1]
        if (last?.key === key) last.calls.push(call)
        else groups.push({ key, label: formatCallDate(call.startMs), calls: [call] })
    }

    const body = loading ? (
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
                                key={String(call._id)}
                                className="flex items-start justify-between gap-4 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-zinc-900">
                                        {call.name}
                                        {call.status === "cancelled" && (
                                            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                                                Cancelled
                                            </span>
                                        )}
                                    </p>
                                    {call.email && (
                                        <p className="truncate text-xs text-zinc-500">
                                            {call.email}
                                            {originLabel(call.origin) && (
                                                <span className="text-zinc-400">
                                                    {" · "}
                                                    {originLabel(call.origin)}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    <RoomTime seconds={call.conferenceSeconds} />
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    <span className="text-sm font-medium tabular-nums text-zinc-500">
                                        {formatClockTime(call.startMs)}
                                    </span>
                                    {/* A call nobody was going to sit is not a
                                        no-show, so there is nothing to answer. */}
                                    {call.status === "confirmed" && (
                                        <AttendanceTag
                                            bookingId={call._id}
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
    )

    if (collapsible) {
        return (
            <section className="rounded-xl border border-zinc-200 bg-white p-6">
                <details>
                    <summary className="cursor-pointer font-semibold text-zinc-900">
                        {title}
                    </summary>
                    {intro && <p className="pt-1 text-sm text-zinc-500">{intro}</p>}
                    {action && <div className="pt-3">{action}</div>}
                    {body}
                </details>
            </section>
        )
    }

    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <h2 className="font-semibold text-zinc-900">{title}</h2>
                    {intro && <p className="text-sm text-zinc-500">{intro}</p>}
                </div>
                {action}
            </div>
            {body}
        </section>
    )
}

/**
 * How long the Meet room was open — the only thing Google will tell a consumer
 * account about a call. Silent until something has looked, because "0m" and
 * "not checked yet" mean opposite things and a blank is the honest one.
 */
function RoomTime({ seconds }: { seconds?: number }) {
    if (seconds === undefined) return null
    return (
        <p className="pt-0.5 text-xs text-zinc-400">
            {seconds === 0 ? (
                "Meet room never opened"
            ) : (
                <>
                    Meet room open <span className="tabular-nums">{formatRoomTime(seconds)}</span>
                </>
            )}
        </p>
    )
}
