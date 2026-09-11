"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "convex/react"

import { api } from "@/convex/_generated/api"
import { useAdminAuth } from "@/hooks/useAdmin"
import { useNow } from "@/hooks/useCallSchedule"
import {
    bounds,
    MIN_ANSWERS_FOR_RATE,
    showRate,
    summarise,
    THIN_COVERAGE,
    type Outcome,
    type StatsRow,
} from "@/lib/callStats"
import AdminLayout from "../components/AdminLayout"

/**
 * What the 10-minute calls actually did.
 *
 * THE PROBLEM THIS PAGE IS BUILT AROUND. Attendance is typed by the person who
 * sat the call, and most calls will never be typed. A page that quietly divided
 * by the tagged ones would report a show rate off a self-selected handful — and
 * the selection is not neutral, because an empty room is easier to remember than
 * a conversation that went fine. So the untagged are a third state everywhere on
 * this page, the headline is a RANGE rather than a rate, and no percentage is
 * drawn until enough calls have been answered for one more answer to stop moving
 * it by five points.
 *
 * WHAT IT REFUSES TO SHOW, and why each one is a refusal rather than an omission:
 *
 *   - No average or median room duration. The readings are bimodal by nature —
 *     seconds when nobody came, minutes when they did — so a centre would
 *     describe none of the calls.
 *   - No show rate compared between sources. Three systems book onto one
 *     calendar, they select different people, and one of them is being retired
 *     mid-window. Composition only.
 *   - Nothing per interviewer. `attendanceBy` records who tapped the button, not
 *     who ran the call, and nothing in this table records the latter.
 *   - No trend lines. The table began the day the adopter was switched on and
 *     was deliberately not backfilled, so there is no earlier period to compare.
 *
 * NOTHING HERE IS DERIVED FROM ROOM DURATIONS. Google tells a consumer account
 * how long a Meet room was open and refuses to say who was in it, so a duration
 * can suggest an answer and can never be one.
 */

const RANGES = [
    { days: 7, label: "7 days" },
    { days: 14, label: "14 days" },
    { days: 30, label: "30 days" },
]

export default function CallStatsPage() {
    const { isAdmin, loading: authLoading, creator } = useAdminAuth()
    const canView = isAdmin || creator?.role === "staff"

    const [days, setDays] = useState(14)
    const now = useNow()
    // Quantised to the hour. The clock ticks once a minute so that "finished"
    // stays true as calls end, but feeding that straight into the query argument
    // would resubscribe every sixty seconds for a window that moves by a minute.
    const fromMs = useMemo(() => {
        const hour = Math.floor(now / 3_600_000) * 3_600_000
        return hour - days * 24 * 60 * 60 * 1000
    }, [now, days])

    const rows = useQuery(
        api.nativeBookings.statsRows,
        canView ? { fromMs } : "skip",
    ) as StatsRow[] | undefined
    const config = useQuery(api.nativeBookings.getSlotConfig, canView ? {} : "skip")

    const stats = useMemo(() => {
        if (!rows || !config) return null
        return summarise(rows, now, config.windows.map((w) => [w[0], w[1]] as [number, number]))
    }, [rows, config, now])

    if (authLoading) {
        return (
            <AdminLayout>
                <p className="text-sm text-zinc-500">Loading…</p>
            </AdminLayout>
        )
    }
    if (!canView) return null

    return (
        <AdminLayout>
            <div className="max-w-5xl space-y-6">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold text-zinc-900">Call stats</h1>
                        <p className="text-sm text-zinc-500">
                            The 10-minute Field Agent calls. Philippine time.
                        </p>
                    </div>
                    <div className="flex rounded-lg border border-zinc-200 bg-white p-1">
                        {RANGES.map((range) => (
                            <button
                                key={range.days}
                                onClick={() => setDays(range.days)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                    days === range.days
                                        ? "bg-zinc-900 text-white"
                                        : "text-zinc-600 hover:text-zinc-900"
                                }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                </header>

                {!stats ? (
                    <p className="text-sm text-zinc-400">Loading…</p>
                ) : stats.overall.finished === 0 ? (
                    <Empty firstCallMs={stats.firstCallMs} />
                ) : (
                    <>
                        <Provenance stats={stats} days={days} />
                        <TurnedUp stats={stats} />
                        <OpenQuestions count={stats.openQuestions} />
                        <WhenSection stats={stats} />
                        <SourceSection stats={stats} />
                        <RoomSection stats={stats} />
                    </>
                )}
            </div>
        </AdminLayout>
    )
}

type Stats = NonNullable<ReturnType<typeof summarise>>

function Empty({ firstCallMs }: { firstCallMs: number | null }) {
    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">
                No calls have finished in this window.
            </p>
            <p className="pt-2 text-xs text-zinc-400">
                {firstCallMs
                    ? `The earliest call on record is ${formatDay(firstCallMs)}.`
                    : "Calls are recorded from the day the calendar sync was switched on. Nothing before that was imported."}
            </p>
        </section>
    )
}

/** What the numbers below are drawn from, said before they are shown. */
function Provenance({ stats, days }: { stats: Stats; days: number }) {
    return (
        <p className="text-xs text-zinc-500">
            {stats.overall.finished} finished{" "}
            {stats.overall.finished === 1 ? "call" : "calls"} in the last {days} days
            {stats.cancelled > 0 && `, ${stats.cancelled} cancelled and not counted`}
            {stats.firstCallMs && ` · recording started ${formatDay(stats.firstCallMs)}`}
            {". "}
            Calls before that were never imported, so this page cannot reach further back
            than it says.
        </p>
    )
}

function TurnedUp({ stats }: { stats: Stats }) {
    const { overall } = stats
    const { low, high } = bounds(overall)
    const rate = showRate(overall)
    const coverage = overall.finished > 0 ? overall.answered / overall.finished : 0
    const thin = coverage < THIN_COVERAGE

    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
            <h2 className="font-semibold text-zinc-900">Did anyone turn up</h2>

            {/* The unconditional truth of the window: three counts, no division.
                This line never degrades and never hides. */}
            <p className="text-2xl font-bold text-zinc-900">
                {overall.attended} came
                <span className="text-zinc-300"> · </span>
                {overall.noShow} no-show
                <span className="text-zinc-300"> · </span>
                <span className={overall.untagged > 0 ? "text-amber-700" : ""}>
                    {overall.untagged} not answered
                </span>
            </p>

            {/* The range, not a point. Its width is what tagging buys back. */}
            {overall.untagged > 0 ? (
                <div className="rounded-lg bg-zinc-50 px-4 py-3">
                    <p className="text-sm font-semibold text-zinc-900">
                        Somewhere between {low} and {high} of {overall.finished} calls had
                        someone turn up.
                    </p>
                    <p className="pt-1 text-xs text-zinc-500">
                        The gap is the {overall.untagged} calls nobody answered for. Every
                        answer given narrows it by one.
                    </p>
                </div>
            ) : (
                <p className="text-sm text-zinc-600">
                    Every call in this window has an answer.
                </p>
            )}

            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
                {/* Coverage travels at the same weight as the rate it qualifies,
                    never as small print underneath it. */}
                <Figure
                    label="Answered"
                    value={`${overall.answered} of ${overall.finished}`}
                    note={`${Math.round(coverage * 100)}%`}
                    tone={thin ? "warn" : "plain"}
                />
                {rate === null ? (
                    <Figure
                        label="Turned up"
                        value="Not enough answers"
                        note={`${overall.answered} of the ${MIN_ANSWERS_FOR_RATE} needed`}
                        tone="muted"
                    />
                ) : (
                    <Figure
                        label="Turned up, of those answered"
                        value={`${Math.round(rate * 100)}%`}
                        note={thin ? "thin — most calls are unanswered" : undefined}
                        tone={thin ? "warn" : "plain"}
                    />
                )}
            </div>
        </section>
    )
}

/** The one thing on this page anybody can act on. */
function OpenQuestions({ count }: { count: number }) {
    if (count === 0) return null
    return (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="font-semibold text-amber-900">
                        {count} finished {count === 1 ? "call is" : "calls are"} still
                        waiting on an answer
                    </p>
                    <p className="pt-1 text-sm text-amber-800">
                        Nothing above can get sharper until somebody says what happened in
                        them. Calls older than a fortnight are left alone.
                    </p>
                </div>
                <Link
                    href="/admin/bookings"
                    className="shrink-0 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
                >
                    Answer them
                </Link>
            </div>
        </section>
    )
}

function WhenSection({ stats }: { stats: Stats }) {
    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
            <div className="space-y-1">
                <h2 className="font-semibold text-zinc-900">When they happen</h2>
                <p className="text-sm text-zinc-500">
                    The bookable windows, as counts. No rates here: each window holds a
                    fraction of an already-thin sample, and a percentage of eight calls
                    reads like a finding.
                </p>
            </div>

            <div className="divide-y divide-zinc-100">
                {stats.windows.map((window) => (
                    <div
                        key={window.label}
                        className="flex flex-wrap items-baseline justify-between gap-3 py-3"
                    >
                        <span className="text-sm font-semibold text-zinc-900">
                            {window.label}
                        </span>
                        <OutcomeLine outcome={window.outcome} />
                    </div>
                ))}
            </div>

            <p className="rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
                Nothing in this data records who sat a call. The button that marks a call
                attended records whoever pressed it, which is not the same thing. To credit
                calls to the person who ran them, the interviewer has to be written onto
                each booking from now on — it cannot be recovered for calls already here.
            </p>
        </section>
    )
}

function SourceSection({ stats }: { stats: Stats }) {
    const total = stats.origins.reduce((sum, o) => sum + o.finished, 0)
    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
            <div className="space-y-1">
                <h2 className="font-semibold text-zinc-900">Where they came from</h2>
                <p className="text-sm text-zinc-500">
                    Composition only. These are three different funnels reaching different
                    people, and one of them is being retired, so comparing their outcomes
                    would measure the migration rather than the calls.
                </p>
            </div>
            <div className="divide-y divide-zinc-100">
                {stats.origins.map((origin) => (
                    <div
                        key={origin.origin}
                        className="flex items-baseline justify-between gap-3 py-2.5"
                    >
                        <span className="text-sm text-zinc-700">{origin.label}</span>
                        <span className="text-sm font-semibold tabular-nums text-zinc-900">
                            {origin.finished}
                            <span className="pl-2 font-normal text-zinc-400">
                                {total > 0 ? `${Math.round((origin.finished / total) * 100)}%` : ""}
                            </span>
                        </span>
                    </div>
                ))}
            </div>
            {stats.repeatBookers > 0 && (
                <p className="text-xs text-zinc-500">
                    {stats.repeatBookers}{" "}
                    {stats.repeatBookers === 1 ? "person" : "people"} in this window booked
                    more than once. That may be someone rebooking after a missed call or
                    someone who wanted a second conversation — the table does not say
                    which.
                </p>
            )}
        </section>
    )
}

function RoomSection({ stats }: { stats: Stats }) {
    const { rooms, durations } = stats
    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
            <div className="space-y-1">
                <h2 className="font-semibold text-zinc-900">Meet rooms</h2>
                <p className="text-sm text-zinc-500">
                    How long each call&apos;s room was open. Google tells this account that
                    and refuses to say who was in it, so a long reading could be somebody
                    sitting alone and a short one could be a call that moved to a phone.
                    Nothing in the figures above is derived from these numbers.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <Tally label="Room was opened" value={rooms.opened} />
                <Tally label="Room never opened" value={rooms.neverOpened} />
                <Tally
                    label="Not asked yet"
                    value={rooms.notAsked}
                    note={rooms.notAsked > 0 ? "resolves on its own" : undefined}
                />
                <Tally
                    label="No room to check"
                    value={rooms.noRoom + rooms.refused}
                    note={rooms.noRoom + rooms.refused > 0 ? "will never resolve" : undefined}
                    tone={rooms.noRoom + rooms.refused > 0 ? "warn" : "plain"}
                />
            </div>

            {durations.read > 0 && (
                <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        How long, across {durations.read} rooms we could read
                    </p>
                    <div className="divide-y divide-zinc-100">
                        <Bucket label="Never opened" value={durations.neverOpened} />
                        <Bucket label="Under 2 minutes" value={durations.underTwoMinutes} />
                        <Bucket label="2 to 5 minutes" value={durations.twoToFive} />
                        <Bucket label="5 minutes or more" value={durations.fiveOrMore} />
                    </div>
                    <p className="text-xs text-zinc-400">
                        Buckets rather than an average: these readings cluster at both ends,
                        so a middle would describe none of the calls.
                    </p>
                </div>
            )}
        </section>
    )
}

function OutcomeLine({ outcome }: { outcome: Outcome }) {
    if (outcome.finished === 0) {
        return <span className="text-sm text-zinc-400">No calls</span>
    }
    return (
        <span className="text-sm tabular-nums text-zinc-600">
            <span className="font-semibold text-zinc-900">{outcome.finished}</span> calls
            <span className="text-zinc-300"> · </span>
            {outcome.attended} came
            <span className="text-zinc-300"> · </span>
            {outcome.noShow} no-show
            <span className="text-zinc-300"> · </span>
            <span className={outcome.untagged > 0 ? "text-amber-700" : ""}>
                {outcome.untagged} unanswered
            </span>
        </span>
    )
}

function Figure({
    label,
    value,
    note,
    tone = "plain",
}: {
    label: string
    value: string
    note?: string
    tone?: "plain" | "warn" | "muted"
}) {
    const colour =
        tone === "warn" ? "text-amber-800" : tone === "muted" ? "text-zinc-400" : "text-zinc-900"
    return (
        <div>
            <p className={`text-xl font-bold tabular-nums ${colour}`}>{value}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {label}
            </p>
            {note && <p className={`pt-0.5 text-xs ${colour}`}>{note}</p>}
        </div>
    )
}

function Tally({
    label,
    value,
    note,
    tone = "plain",
}: {
    label: string
    value: number
    note?: string
    tone?: "plain" | "warn"
}) {
    return (
        <div className="rounded-lg bg-zinc-50 px-4 py-3">
            <p
                className={`text-lg font-bold tabular-nums ${
                    tone === "warn" ? "text-amber-800" : "text-zinc-900"
                }`}
            >
                {value}
            </p>
            <p className="text-xs text-zinc-600">{label}</p>
            {note && <p className="pt-0.5 text-xs text-zinc-400">{note}</p>}
        </div>
    )
}

function Bucket({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-2">
            <span className="text-sm text-zinc-700">{label}</span>
            <span className="text-sm font-semibold tabular-nums text-zinc-900">{value}</span>
        </div>
    )
}

function formatDay(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}
