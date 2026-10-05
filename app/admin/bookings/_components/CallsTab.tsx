"use client"

import { useId, useMemo, useState } from "react"
import { useAction } from "convex/react"
import { RotateCw } from "lucide-react"

import { Button, Fold, Folds, Icon, Loading, Skeleton, SkeletonRows } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { formatCallDate, manilaDayKey, timeUntil, useNow, type CallSchedule } from "@/hooks/useCallSchedule"

import { CalendarNote, CallRow, OutOfHoursNote, UpcomingList } from "@/app/admin/_components/CallList"
import { callsToday, capitalise, dayPart, focusKey, phaseOf, plural, type DayCall } from "@/app/admin/_components/calls"
import { NeedsOutcomeCard, PastCalls } from "@/app/admin/_components/FinishedCallList"
import FoldTitle from "@/app/admin/_components/FoldTitle"
import RefreshFinishedCalls from "@/app/admin/_components/RefreshFinishedCalls"

import BookableHours from "./BookableHours"

/**
 * The Calls tab (board Calls): today's calls with their Join and their
 * outcome, the finished calls nobody has marked, what is booked later, and,
 * folded away, the archive and the bookable hours.
 *
 * On a wide desk it is two columns, the day's work on the left; anywhere
 * narrower it is one, in the same order.
 */
export default function CallsTab({ schedule, isAdmin }: { schedule: CallSchedule; isAdmin: boolean }) {
    const { upcoming, past, needsAttendance, calendarError, loading, refresh } = schedule
    const now = useNow()

    const todayKey = manilaDayKey(now)
    const today = useMemo(() => callsToday(upcoming, past, now), [upcoming, past, now])
    const later = useMemo(() => upcoming.filter((c) => manilaDayKey(c.startMs) !== todayKey), [upcoming, todayKey])
    // Today's finished calls are answered on today's list; this one holds the
    // days before, so no call is on screen twice.
    const needs = useMemo(() => needsAttendance.filter((c) => manilaDayKey(c.startMs) !== todayKey), [needsAttendance, todayKey])
    const pastBeforeToday = useMemo(() => past.filter((c) => manilaDayKey(c.startMs) !== todayKey), [past, todayKey])

    if (loading) return <CallsTabSkeleton />

    return (
        <div className="flex flex-col gap-6">
            {calendarError && <CalendarNote error={calendarError} />}
            <div className="grid items-start gap-6 min-[1400px]:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex min-w-0 flex-col gap-6">
                    <TodayCard calls={today} now={now} onChanged={refresh} />
                    <NeedsOutcomeCard needs={needs} past={pastBeforeToday} now={now} />
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                    <LaterCard calls={later} now={now} isAdmin={isAdmin} onChanged={refresh} />
                    <Folds>
                        <Fold title={<FoldTitle label="Past & cancelled" meta={<span className="t-count">{past.length}</span>} />}>
                            <div className="pb-2">
                                <PastCalls calls={past} now={now} />
                            </div>
                        </Fold>
                        <BookableHours />
                    </Folds>
                </div>
            </div>
        </div>
    )
}

/**
 * "4 calls · 1 needs an outcome", "4 calls · one on now", "4 calls · next in
 * 10 minutes". Null with no calls: the card's body says that once.
 */
function todayMeta(calls: DayCall[], now: number): string | null {
    if (calls.length === 0) return null
    const count = `${calls.length} ${plural(calls.length, "call", "calls")}`
    const open = calls.filter((c) => phaseOf(c, now) === "done" && !c.attendance && c.bookingId !== null).length
    if (open > 0) return `${count} · ${open} ${plural(open, "needs", "need")} an outcome`
    if (calls.some((c) => phaseOf(c, now) === "live")) return `${count} · one on now`
    const next = calls.find((c) => phaseOf(c, now) === "soon")
    return next ? `${count} · next ${timeUntil(next.startMs, now)}` : `${count} · all done`
}

/**
 * Today's calls, ended and ahead (board Calls, "Tonight"). The call on now,
 * or else the next one, is the gold row and its Join is the page's one
 * primary button.
 */
function TodayCard({ calls, now, onChanged }: { calls: DayCall[]; now: number; onChanged: () => void }) {
    const titleId = useId()
    const focus = focusKey(calls, now)
    const outOfHours = calls.filter((c) => c.outsideHours && phaseOf(c, now) !== "done").length
    const meta = todayMeta(calls, now)

    return (
        <section className="t-card @container overflow-hidden" aria-labelledby={titleId}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-r1-line px-4 pb-4 pt-5 sm:px-6">
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="t-h2" id={titleId}>
                        {capitalise(dayPart(calls))}
                    </h2>
                    <p className="t-meta">
                        {formatCallDate(now)}
                        {meta && ` · ${meta}`}
                    </p>
                </div>
                {/* Calls booked anywhere but our page get their row only once
                    they are adopted; this does it now instead of within the hour. */}
                <RefreshFinishedCalls />
            </div>
            <OutOfHoursNote count={outOfHours} />
            {calls.length === 0 ? (
                <p className="t-meta px-4 py-5 sm:px-6">Nothing is booked for today.</p>
            ) : (
                <div className="t-list">
                    {calls.map((call) => (
                        <CallRow
                            key={call.key}
                            call={call}
                            now={now}
                            focus={call.key === focus}
                            highlight="row"
                            join={call.key === focus ? "primary" : "secondary"}
                            onChanged={onChanged}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

/** What is booked after today (board Calls, "Later"), and for an admin the calendar sync. */
function LaterCard({
    calls,
    now,
    isAdmin,
    onChanged,
}: {
    calls: CallSchedule["upcoming"]
    now: number
    isAdmin: boolean
    onChanged: () => void
}) {
    const titleId = useId()
    const outOfHours = calls.filter((c) => c.outsideHours).length

    return (
        <section className="t-card overflow-hidden" aria-labelledby={titleId}>
            <div className="flex flex-col gap-1 border-b border-r1-line px-4 pb-4 pt-5 sm:px-6">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2 className="t-h2" id={titleId}>
                        Later
                    </h2>
                    {calls.length > 0 && <span className="t-count">{calls.length} booked</span>}
                </div>
                <p className="t-meta">Philippine time. Calls are 10 minutes.</p>
            </div>
            <OutOfHoursNote count={outOfHours} />
            {calls.length === 0 ? (
                <p className="t-meta px-4 py-5 sm:px-6">Nothing is booked after today yet.</p>
            ) : (
                <UpcomingList calls={calls} now={now} onChanged={onChanged} />
            )}
            {isAdmin && <SyncFooter onSynced={onChanged} />}
        </section>
    )
}

/**
 * SYNC (admin only). Deleting a booking in Google Calendar frees the calendar
 * but not the page: availability blocks a slot if EITHER the calendar or our
 * own row says taken, and a confirmed row counts forever. Sync reconciles the
 * two and releases anything cancelled there. An hourly cron runs the same job;
 * this button is for when you have just cancelled something and want the slot
 * back now rather than within the hour. The calendar is read again afterwards,
 * so the lists show what the sync left.
 */
function SyncFooter({ onSynced }: { onSynced: () => void }) {
    const syncCancelled = useAction(api.booking.syncCancelledBookings)
    const [syncing, setSyncing] = useState(false)
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

    async function handleSync() {
        setSyncing(true)
        setResult(null)
        try {
            const res = await syncCancelled({})
            setResult({
                ok: true,
                text:
                    res.released === 0
                        ? `Synced just now. Checked ${res.checked} ${plural(res.checked, "booking", "bookings")}, nothing to release.`
                        : `Synced just now. Released ${res.released} of ${res.checked}: those slots are open again.`,
            })
            onSynced()
        } catch (err) {
            setResult({ ok: false, text: err instanceof Error ? err.message : "Sync failed." })
        } finally {
            setSyncing(false)
        }
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-r1-line-3 py-2 pl-4 pr-3 sm:pl-6">
            {/* Always a live region, so the result is announced when it replaces the hint. */}
            <span className={result && !result.ok ? "t-error" : "t-meta"} role="status">
                {result?.text ?? "Synced hourly with Google Calendar. Delete an event there to cancel a call."}
            </span>
            <Button variant="ghost" onClick={handleSync} disabled={syncing} aria-busy={syncing}>
                <Icon icon={RotateCw} />
                {syncing ? "Syncing…" : "Sync now"}
            </Button>
        </div>
    )
}

/** The tab while the schedule loads: today's card, the later card, in shape. */
export function CallsTabSkeleton() {
    return (
        <Loading label="Loading calls">
            <CallsTabShapes />
        </Loading>
    )
}

/** The shapes alone, for a loading region that already announces itself. */
export function CallsTabShapes() {
    return (
        <div className="grid items-start gap-6 min-[1400px]:grid-cols-[minmax(0,1fr)_380px]" aria-hidden="true">
            <div className="flex flex-col gap-3">
                <Skeleton width={120} height={18} />
                <SkeletonRows count={4} />
            </div>
            <div className="flex flex-col gap-3">
                <Skeleton width={80} height={18} />
                <SkeletonRows count={3} />
            </div>
        </div>
    )
}
