"use client"

import { Fragment, useState } from "react"
import { ExternalLink } from "lucide-react"

import { ButtonLink, cx, Dot, Icon, Status } from "@/components/r1"
import { formatClockTime, originLabel, timeUntil, type ScheduledCall } from "@/hooks/useCallSchedule"

import AttendanceTag from "./AttendanceTag"
import { callStatus, capitalise, fromScheduled, groupByDay, phaseOf, plural, roomLine, type DayCall } from "./calls"
import OutOfHoursAction from "./OutOfHoursAction"

/*
 * The Field Agent calls that are still ahead, or on today's list (boards Calls
 * and Today). Shared by the staff Today and /admin/bookings so the two cannot
 * drift.
 *
 * THE DATE IS A HEADING, NOT A COLUMN. Every row used to carry its own
 * "Wed, Sep 9, 6:45 PM", which repeats the same date six times down a day's
 * worth of calls and buries the only part that differs — the time. The date is
 * said once per group; the rows keep the clock time alone.
 *
 * A CALL STAYS ON TODAY'S LIST FOR ITS FULL TEN MINUTES, and after. The
 * schedule keeps a call until it ends, not until it starts, so the row is on
 * screen through the window where nobody has turned up — which is when
 * somebody wants to say so. Once it has started, the row grows the came /
 * no-show buttons.
 */

/** The clock time, the one thing that differs from row to row. */
function Time({ ms, className }: { ms: number; className?: string }) {
    return <span className={cx("font-r1-mono text-[13px] leading-5 tabular-nums text-r1-ink", className)}>{formatClockTime(ms)}</span>
}

/**
 * One call on a day's list: its time, who, where it is in its ten minutes,
 * its status, and what can be done about it now.
 *
 * Laid out by the width of the card it sits in (a container query), not the
 * screen: in a narrow card, a phone or the side column of a desk, the status
 * and the buttons drop under the name; in a wide one they are columns. The
 * card must carry `@container`.
 */
export function CallRow({
    call,
    now,
    focus = false,
    highlight = "row",
    join = "secondary",
    onChanged,
}: {
    call: DayCall
    now: number
    /** The call on now, or else the next one. */
    focus?: boolean
    /** How the focus call stands out: a gold row (Calls) or a gold "Next call" line (Today). */
    highlight?: "row" | "label"
    /** Join's look on this row. One primary per view, so the page decides. */
    join?: "primary" | "secondary" | "ghost"
    /** Re-read the schedule after a call is cancelled from this row. */
    onChanged?: () => void
}) {
    const phase = phaseOf(call, now)
    const status = callStatus(call, now)

    const when =
        phase === "done"
            ? [`Ended ${formatClockTime(call.endMs)}`, call.conferenceSeconds !== undefined ? roomLine(call.conferenceSeconds) : null]
            : phase === "live"
              ? [`Ends ${formatClockTime(call.endMs)}`]
              : [focus && highlight === "label" ? `Next call, ${timeUntil(call.startMs, now)}` : capitalise(timeUntil(call.startMs, now))]
    const sub = [...when, call.outsideHours ? "outside your bookable hours" : null, originLabel(call.origin)]
        .filter(Boolean)
        .join(" · ")
    const goldLine = focus && highlight === "label" && phase === "soon"

    // Only once it has started: there is nothing to report about a call that
    // has not happened, and a calendar-only call has no row of ours to write to.
    const canMark = phase !== "soon" && !call.outsideHours && call.bookingId !== null
    // No Join on an out-of-hours call: joining a call at a time nobody works
    // is not an action to offer. Cancelling it is.
    const canCancel = call.outsideHours && call.scheduled !== null && phase !== "done"
    const canJoin = phase !== "done" && !call.outsideHours && !!call.meetUrl

    return (
        <div
            className={cx(
                "t-row grid min-h-16 grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 sm:px-6 @2xl:flex @2xl:gap-4",
                focus && highlight === "row" && "bg-r1-gold-bg",
            )}
        >
            <Time ms={call.startMs} className="self-start @2xl:w-[76px] @2xl:flex-none @2xl:self-center" />
            <span className="flex min-w-0 flex-col gap-0.5 @2xl:flex-1">
                <span className="truncate text-[14px] font-medium leading-5 text-r1-ink">{call.name}</span>
                {sub && (
                    <span className={cx("t-meta flex items-center gap-1.5", goldLine && "font-medium text-r1-gold-ink")}>
                        {call.outsideHours && <Dot tone="attn" />}
                        <span>{capitalise(sub)}</span>
                    </span>
                )}
            </span>
            {/* Narrow card: one more line under the name. Wide card: two more columns. */}
            <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-2 @2xl:contents">
                <span className="@2xl:w-[136px] @2xl:flex-none">
                    <Status {...status} />
                </span>
                {(canMark || canCancel || canJoin) && (
                    <div className="ml-auto flex flex-none flex-wrap items-center justify-end gap-2">
                        {canMark && <AttendanceTag bookingId={call.bookingId} attendance={call.attendance} name={call.name} />}
                        {canCancel && call.scheduled && <OutOfHoursAction call={call.scheduled} onDone={() => onChanged?.()} />}
                        {canJoin && call.meetUrl && (
                            <ButtonLink
                                variant={join}
                                size="sm"
                                href={call.meetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Join the call with ${call.name}`}
                            >
                                Join
                                <Icon icon={ExternalLink} />
                            </ButtonLink>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * The calendar could not be read, so the lists hold our own rows alone. Worth
 * saying out loud rather than quietly showing less: TidyCal and hand-made
 * bookings exist only on the calendar.
 */
export function CalendarNote({ error }: { error: string }) {
    return (
        <p className="t-meta flex items-start gap-2 rounded-r1 bg-r1-fill-2 px-3 py-2.5" role="status">
            <Dot tone="bad" className="mt-[5px]" />
            <span>Showing calls booked through this app only. The calendar could not be read: {error}</span>
        </p>
    )
}

/**
 * Said once at the top of a list, because one differently-marked row thirty
 * rows down is not something anyone scrolls to find.
 */
export function OutOfHoursNote({ count }: { count: number }) {
    if (count === 0) return null
    return (
        <p className="t-meta flex items-start gap-2 border-b border-r1-line-3 bg-r1-fill-2 px-4 py-3 sm:px-6">
            <Dot tone="attn" className="mt-[5px]" />
            <span>
                {count} {plural(count, "call falls", "calls fall")} outside your bookable hours. Nobody is working then: cancel{" "}
                {plural(count, "it", "each one")} from its More menu and the person gets the current booking link.
            </span>
        </p>
    )
}

/**
 * The calls booked after today (board Calls, "Later"): grouped by day, the
 * time, who, and Booked. Capped like every list in a card, with Show all
 * expanding in place.
 */
export function UpcomingList({
    calls,
    now,
    onChanged,
    initial = 5,
}: {
    calls: ScheduledCall[]
    now: number
    onChanged?: () => void
    initial?: number
}) {
    const [expanded, setExpanded] = useState(false)
    const visible = expanded ? calls : calls.slice(0, initial)

    return (
        <>
            <div className="t-list">
                {groupByDay(visible).map((group) => (
                    <Fragment key={group.key}>
                        <span className="t-label block px-4 pb-1.5 pt-3.5 sm:px-6">{group.label}</span>
                        {group.items.map((call) => (
                            <LaterRow key={call.key} call={fromScheduled(call)} now={now} onChanged={onChanged} />
                        ))}
                    </Fragment>
                ))}
            </div>
            {calls.length > initial && (
                <button type="button" className="t-showall" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
                    {expanded ? "Show fewer" : `Show all ${calls.length}`}
                </button>
            )}
        </>
    )
}

function LaterRow({ call, now, onChanged }: { call: DayCall; now: number; onChanged?: () => void }) {
    const sub = [call.outsideHours ? "Outside your bookable hours" : null, originLabel(call.origin)].filter(Boolean).join(" · ")
    return (
        <div className="t-row min-h-14 gap-3 px-4 py-2.5 sm:px-6">
            <Time ms={call.startMs} className="w-16 flex-none sm:w-[76px]" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] font-medium leading-5 text-r1-ink">{call.name}</span>
                {sub && (
                    <span className="t-meta flex items-center gap-1.5">
                        {call.outsideHours && <Dot tone="attn" />}
                        <span>{capitalise(sub)}</span>
                    </span>
                )}
            </span>
            <Status {...callStatus(call, now)} />
            {call.outsideHours && call.scheduled && <OutOfHoursAction call={call.scheduled} onDone={() => onChanged?.()} />}
        </div>
    )
}
