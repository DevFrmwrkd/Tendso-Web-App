"use client"

import { useId, useMemo } from "react"
import { RotateCw } from "lucide-react"

import { Button, Dot, Icon, Loading, PageHeader, Skeleton, SkeletonRows } from "@/components/r1"
import { formatCallTime, manilaDayKey, timeSince, useCallSchedule, useNow } from "@/hooks/useCallSchedule"

import { CalendarNote, CallRow, OutOfHoursNote } from "./CallList"
import { callsLeftLine, dayPart, focusKey, fromScheduled, longDay, plural } from "./calls"
import PriorityRow from "./PriorityRow"

/**
 * What an internal staff account sees when they open Tendso (board AdminHome,
 * the staff view): "What needs me today?"
 *
 * They run the 10-minute Field Agent calls and nothing else, so this answers
 * the questions that job has: what is on today and whether one is starting
 * soon, each call with its Join. The Join is the point — the whole role exists
 * so nobody needs the tendso.hr mailbox to get on a call.
 *
 * It also asks one question back: of the calls that have finished, which ones
 * did anybody turn up to. Only the person who sat the call knows — Google will
 * say how long the Meet room was open and nothing more — so that answer has to
 * be typed by a human. The count is here; the answering happens on Calls.
 */
export default function StaffDashboard() {
    const { upcoming, needsAttendance, calendarError, loading, refresh, refreshing, lastRefreshed } = useCallSchedule(true)
    const now = useNow()
    const listId = useId()
    const owedId = useId()
    const outId = useId()

    // Today's calls still to come, the one on now included: the schedule keeps
    // a call until it ends.
    const today = useMemo(() => {
        const key = manilaDayKey(now)
        return upcoming.filter((c) => manilaDayKey(c.startMs) === key).map(fromScheduled)
    }, [upcoming, now])
    const focus = focusKey(today, now)
    const next = upcoming[0] ?? null

    // Surfaced as well as marked in the list: it is the one number that means
    // somebody has to do something before the call, not after it.
    const outOfHours = useMemo(() => upcoming.filter((c) => c.outsideHours).length, [upcoming])
    const owed = needsAttendance.length

    return (
        <>
            <div className="flex flex-col gap-4">
                <PageHeader title="Today" sub="What needs me today?" />
                {loading ? (
                    <Loading label="Loading your calls">
                        <Skeleton width="60%" height={14} />
                    </Loading>
                ) : (
                    <p className="t-body flex items-start gap-2.5">
                        <Dot tone="progress" className="mt-1.5" />
                        <span>
                            <strong className="font-medium text-r1-ink">{longDay(now)}</strong> · {callsLeftLine(upcoming, now)} · Philippine time
                        </span>
                    </p>
                )}
            </div>

            <div className="flex w-full max-w-[880px] flex-col gap-6 lg:gap-8">
                {calendarError && <CalendarNote error={calendarError} />}

                <section className="flex flex-col gap-3" aria-labelledby={listId}>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <h2 className="t-h2" id={listId}>
                                {today.length > 0
                                    ? `${today.length} ${plural(today.length, "call", "calls")} ${dayPart(today)}`
                                    : "No more calls today"}
                            </h2>
                            <span className="t-meta">10-minute Field Agent calls</span>
                        </div>
                        {/* Bookings made HERE arrive on their own — that side is
                            reactive. A call booked through TidyCal or added to the
                            calendar by hand only shows up when the calendar is
                            read again, which is what this does. */}
                        <div className="flex items-center gap-2">
                            {lastRefreshed && !refreshing && <span className="t-meta">Updated {timeSince(lastRefreshed, now)}</span>}
                            <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>
                                <Icon icon={RotateCw} />
                                {refreshing ? "Refreshing…" : "Refresh"}
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <Loading label="Loading today's calls">
                            <SkeletonRows count={3} />
                        </Loading>
                    ) : today.length > 0 ? (
                        <div className="t-card @container overflow-hidden">
                            <OutOfHoursNote count={today.filter((c) => c.outsideHours).length} />
                            <div className="t-list">
                                {today.map((call) => (
                                    <CallRow
                                        key={call.key}
                                        call={call}
                                        now={now}
                                        focus={call.key === focus}
                                        highlight="label"
                                        // The page's one primary is "Mark who came"; Join stays quiet.
                                        join="ghost"
                                        onChanged={refresh}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="t-card px-4 py-5 sm:px-6">
                            <p className="t-body">
                                {next ? `The next call is ${formatCallTime(next.startMs)}, with ${next.name}.` : "Nothing booked. Enjoy the quiet."}
                            </p>
                        </div>
                    )}
                </section>

                {/* The one thing on this page that is owed. Cut when there is
                    nothing owed: every answer given makes the number smaller. */}
                {!loading && owed > 0 && (
                    <section className="t-card overflow-hidden" aria-labelledby={owedId}>
                        <PriorityRow
                            headingId={owedId}
                            figure={owed}
                            tone="attn"
                            reason={`finished ${plural(owed, "call has", "calls have")} no outcome yet`}
                            meta="Only the person on the call knows who came. Google only records how long the room was open."
                            action={{ label: "Mark who came", href: "/admin/bookings", primary: true }}
                        />
                    </section>
                )}

                {!loading && outOfHours > 0 && (
                    <section className="t-card overflow-hidden" aria-labelledby={outId}>
                        <PriorityRow
                            headingId={outId}
                            figure={outOfHours}
                            tone="attn"
                            reason={`booked ${plural(outOfHours, "call falls", "calls fall")} outside your hours`}
                            meta="Nobody is working then. Cancel each one and the person gets the current booking link."
                            action={{ label: "See the calls", href: "/admin/bookings", primary: owed === 0 }}
                        />
                    </section>
                )}
            </div>
        </>
    )
}
