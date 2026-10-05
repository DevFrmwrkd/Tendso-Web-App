"use client"

import { Fragment, useId, useState } from "react"

import { Status } from "@/components/r1"
import type { Id } from "@/convex/_generated/dataModel"
import { formatCallDate, formatClockTime, originLabel, type FinishedCall } from "@/hooks/useCallSchedule"

import AttendanceTag from "./AttendanceTag"
import { callStatus, groupByDay, roomLine, shortDate } from "./calls"

/*
 * Calls that are over, and what happened in them (board Calls).
 *
 * Two lists, two shapes. "Needs an outcome" is the short list still waiting
 * on an answer: a thing to clear, open in a card. "Past & cancelled" is the
 * whole archive in a fold: a thing to look something up in, and where a
 * mis-tap gets fixed after a call has scrolled off.
 *
 * Grouped by day in the archive, so the date is said once rather than
 * repeated down every row.
 */

/** A call nobody was going to sit is not a no-show, so a cancelled one has nothing to answer. */
function answerable(call: FinishedCall): boolean {
    return call.status === "confirmed"
}

/**
 * The unanswered finished calls, newest first, in a card that empties as
 * they get answered.
 *
 * AN ANSWERED ROW STAYS UNTIL THE PAGE IS LEFT. The list itself only holds
 * calls with no answer, so a row would vanish the moment it was tapped and a
 * mis-tap could only be fixed from the archive. Rows answered here are kept
 * in view, showing their answer and Change, the way the board draws them.
 */
export function NeedsOutcomeCard({
    needs,
    past,
    now,
    initial = 5,
}: {
    /** Finished, confirmed, unanswered, from the last fortnight (the schedule's needsAttendance). */
    needs: FinishedCall[]
    /** Every finished or cancelled call the schedule holds, newest first: where answered rows are found again. */
    past: FinishedCall[]
    now: number
    initial?: number
}) {
    const titleId = useId()
    const [kept, setKept] = useState<Set<string>>(() => new Set())
    const [expanded, setExpanded] = useState(false)

    const open = new Set(needs.map((c) => String(c._id)))
    const rows = past.filter((c) => open.has(String(c._id)) || kept.has(String(c._id)))
    // Cut, not shown, when there is nothing to answer (kit: an empty count is not a card).
    if (rows.length === 0) return null

    const keep = (id: Id<"native_bookings">) =>
        setKept((cur) => (cur.has(String(id)) ? cur : new Set(cur).add(String(id))))
    const visible = expanded ? rows : rows.slice(0, initial)

    return (
        <section className="t-card @container overflow-hidden" aria-labelledby={titleId}>
            <div className="flex flex-col gap-1 border-b border-r1-line px-4 pb-4 pt-5 sm:px-6">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2 className="t-h2" id={titleId}>
                        Needs an outcome
                    </h2>
                    {needs.length > 0 && <Status tone="attn" word={String(needs.length)} />}
                </div>
                <p className="t-meta">
                    Finished calls from the last two weeks that nobody has marked. The Meet room time is a hint, never the answer.
                </p>
            </div>
            <div className="t-list">
                {visible.map((call) => (
                    <FinishedRow key={String(call._id)} call={call} now={now} onMarked={keep} />
                ))}
            </div>
            {rows.length > initial && (
                <button type="button" className="t-showall" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
                    {expanded ? "Show fewer" : `Show all ${rows.length}`}
                </button>
            )}
        </section>
    )
}

/**
 * One finished call in the Needs list: time, who, the day and the room
 * reading, status, the answer buttons. Laid out by its card's width (the card
 * carries `@container`): narrow, the status and buttons drop under the name.
 */
function FinishedRow({ call, now, onMarked }: { call: FinishedCall; now: number; onMarked?: (id: Id<"native_bookings">) => void }) {
    const sub = [formatCallDate(call.startMs), roomLine(call.conferenceSeconds), originLabel(call.origin)].filter(Boolean).join(" · ")
    return (
        <div className="t-row grid min-h-16 grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 sm:px-6 @2xl:flex @2xl:gap-4">
            <span className="self-start font-r1-mono text-[13px] leading-5 tabular-nums text-r1-ink @2xl:w-[76px] @2xl:flex-none @2xl:self-center">
                {formatClockTime(call.startMs)}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 @2xl:flex-1">
                <span className="truncate text-[14px] font-medium leading-5 text-r1-ink">{call.name}</span>
                <span className="t-meta">{sub}</span>
            </span>
            <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-2 @2xl:contents">
                <span className="@2xl:w-[136px] @2xl:flex-none">
                    <Status {...callStatus(call, now)} />
                </span>
                {answerable(call) && (
                    <div className="ml-auto flex flex-none items-center justify-end">
                        <AttendanceTag bookingId={call._id} attendance={call.attendance} name={call.name} onMarked={onMarked} />
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * The archive (board Calls, the "Past & cancelled" fold): every finished or
 * cancelled call the schedule holds, newest first, grouped by day. The outcome
 * is editable here too, because a mis-tap has to be fixable somewhere after
 * the call has scrolled off the day's list.
 */
export function PastCalls({ calls, now, step = 10 }: { calls: FinishedCall[]; now: number; step?: number }) {
    const [shown, setShown] = useState(step)
    if (calls.length === 0) return <p className="t-meta">Nothing has finished yet.</p>

    const visible = calls.slice(0, shown)
    const oldest = calls.reduce((min, c) => Math.min(min, c.startMs), calls[0].startMs)

    return (
        <div className="flex flex-col gap-3">
            <div className="@container overflow-hidden rounded-r1-card border border-r1-line">
                <div className="t-list">
                    {groupByDay(visible).map((group) => (
                        <Fragment key={group.key}>
                            <span className="t-label block border-b border-r1-line-3 bg-r1-fill-2 px-4 pb-1 pt-2.5">{group.label}</span>
                            {group.items.map((call) => (
                                <PastRow key={String(call._id)} call={call} now={now} />
                            ))}
                        </Fragment>
                    ))}
                </div>
                {calls.length > shown && (
                    <button type="button" className="t-showall gap-1.5" onClick={() => setShown((n) => n + step)}>
                        Show {Math.min(step, calls.length - shown)} more
                        <span className="t-count">
                            {shown} of {calls.length}
                        </span>
                    </button>
                )}
            </div>
            <p className="t-meta">
                Newest first · {calls.length} since {shortDate(oldest)}. Fix a mis-tap here after a call has scrolled off.
            </p>
        </div>
    )
}

/** An archive row: time, who with the status under it, the answer buttons (under the name in a narrow fold). */
function PastRow({ call, now }: { call: FinishedCall; now: number }) {
    return (
        <div className="t-row grid min-h-14 grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-2.5 @md:flex">
            <span className="self-start font-r1-mono text-[13px] leading-5 tabular-nums text-r1-ink @md:w-16 @md:flex-none @md:self-center">
                {formatClockTime(call.startMs)}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 @md:flex-1">
                <span className="truncate text-[14px] font-medium leading-5 text-r1-ink">{call.name}</span>
                <Status {...callStatus(call, now)} />
            </span>
            {answerable(call) && (
                <span className="col-start-2 @md:ml-auto @md:flex-none">
                    <AttendanceTag bookingId={call._id} attendance={call.attendance} name={call.name} />
                </span>
            )}
        </div>
    )
}
