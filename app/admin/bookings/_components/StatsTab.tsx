"use client"

import { useId, useMemo, useState, type ReactNode } from "react"
import { useQuery } from "convex/react"

import { Button, EmptyState, Fold, Folds, Loading, Segmented, SkeletonCard } from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { useNow } from "@/hooks/useCallSchedule"
import {
    bounds,
    MIN_ANSWERS_FOR_RATE,
    minuteLabel,
    showRate,
    summarise,
    THIN_COVERAGE,
    type OriginStat,
    type Outcome,
    type StatsRow,
    type WindowStat,
} from "@/lib/callStats"

import { fullDate, plural } from "@/app/admin/_components/calls"
import FoldTitle from "@/app/admin/_components/FoldTitle"

/**
 * What the 10-minute calls actually did (board Calls, the Stats tab; this was
 * /admin/call-stats).
 *
 * THE PROBLEM THIS TAB IS BUILT AROUND. Attendance is typed by the person who
 * sat the call, and most calls will never be typed. A page that quietly divided
 * by the tagged ones would report a show rate off a self-selected handful — and
 * the selection is not neutral, because an empty room is easier to remember than
 * a conversation that went fine. So the untagged are a third state everywhere on
 * this tab, the headline is a RANGE rather than a rate, and no percentage is
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
    { value: "7", label: "7 days" },
    { value: "14", label: "14 days" },
    { value: "30", label: "30 days" },
] as const
type Range = (typeof RANGES)[number]["value"]

const DAY_MS = 24 * 60 * 60 * 1000

type Stats = ReturnType<typeof summarise>

export default function StatsTab({ onMarkCalls }: { onMarkCalls: () => void }) {
    const [range, setRange] = useState<Range>("14")
    const days = Number(range)
    const now = useNow()
    // Quantised to the hour. The clock ticks once a minute so that "finished"
    // stays true as calls end, but feeding that straight into the query argument
    // would resubscribe every sixty seconds for a window that moves by a minute.
    const fromMs = useMemo(() => {
        const hour = Math.floor(now / 3_600_000) * 3_600_000
        return hour - days * DAY_MS
    }, [now, days])

    const rows = useQuery(api.nativeBookings.statsRows, { fromMs }) as StatsRow[] | undefined
    const config = useQuery(api.nativeBookings.getSlotConfig, {})

    const stats = useMemo(() => {
        if (!rows || !config) return null
        return summarise(rows, now, config.windows.map((w) => [w[0], w[1]] as [number, number]))
    }, [rows, config, now])

    const rangePicker = (
        <Segmented label="How far back" options={[...RANGES]} value={range} onChange={setRange} className="flex-none" />
    )

    if (!stats) {
        return (
            <div className="flex max-w-[1000px] flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="t-meta min-w-0 flex-1">Last {days} days</p>
                    {rangePicker}
                </div>
                <Loading label="Loading call stats" className="flex flex-col gap-6">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </Loading>
            </div>
        )
    }

    const { overall } = stats
    return (
        <div className="flex max-w-[1000px] flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="t-meta min-w-0 flex-1">{provenance(stats, days, fromMs)}</p>
                {rangePicker}
            </div>

            {overall.finished === 0 ? (
                <div className="t-card">
                    <EmptyState
                        title="No calls have finished in this window"
                        body={
                            stats.firstCallMs
                                ? `The earliest call on record here is ${fullDate(stats.firstCallMs)}.`
                                : "Calls are recorded from the day the calendar sync was switched on. Nothing before that was imported."
                        }
                    />
                </div>
            ) : (
                <>
                    <TurnedUp stats={stats} onMarkCalls={onMarkCalls} />
                    <WhenTheyCome stats={stats} />
                    <WhereFrom stats={stats} />
                    <Folds>
                        <MeetRooms stats={stats} />
                    </Folds>
                    <p className="t-meta">Nothing records who ran a call: the Came button saves whoever pressed it, not the interviewer.</p>
                </>
            )}
        </div>
    )
}

/**
 * What the numbers below are drawn from, said before they are shown. "Recorded
 * since" only when the table plainly starts inside the window, because the
 * earliest row in a window is otherwise just the window's own edge.
 */
function provenance(stats: Stats, days: number, fromMs: number): string {
    const parts = [
        `Last ${days} days`,
        `${stats.overall.finished} finished ${plural(stats.overall.finished, "call", "calls")}${
            stats.cancelled > 0 ? `, ${stats.cancelled} cancelled and not counted` : ""
        }`,
    ]
    if (stats.firstCallMs && stats.firstCallMs - fromMs > DAY_MS) {
        parts.push(`recorded since ${fullDate(stats.firstCallMs)}, nothing earlier was imported`)
    }
    return `${parts.join(" · ")}.`
}

function pct(n: number, of: number): string {
    return of > 0 ? `${((n / of) * 100).toFixed(2)}%` : "0%"
}

/** A came / no-show / not answered bar. Its label carries the same three counts in words. */
function OutcomeBar({ outcome, thin = false }: { outcome: Outcome; thin?: boolean }) {
    const of = outcome.finished
    const label = `${outcome.attended} came, ${outcome.noShow} no-show, ${outcome.untagged} not answered, of ${of}`
    return (
        <span
            className={`flex overflow-hidden rounded-full bg-r1-fill ${thin ? "h-2 min-w-0 flex-1" : "h-3"}`}
            role="img"
            aria-label={label}
        >
            <span className="block h-full bg-r1-ink" style={{ width: pct(outcome.attended, of) }} />
            <span className="block h-full bg-r1-red-dot" style={{ width: pct(outcome.noShow, of) }} />
            <span className="block h-full bg-r1-line" style={{ width: pct(outcome.untagged, of) }} />
        </span>
    )
}

/** One answer card: the figure on the left, the question and its working on the right. */
function Answer({ figure, caption, title, children }: { figure: number; caption: string; title: string; children: ReactNode }) {
    const titleId = useId()
    return (
        <section className="t-card t-card-pad grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8" aria-labelledby={titleId}>
            <div className="flex flex-col gap-1">
                <span className="t-figure">{figure}</span>
                <span className="t-meta">{caption}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
                <h2 className="t-h2" id={titleId}>
                    {title}
                </h2>
                {children}
            </div>
        </section>
    )
}

function TurnedUp({ stats, onMarkCalls }: { stats: Stats; onMarkCalls: () => void }) {
    const { overall, openQuestions } = stats
    const { low, high } = bounds(overall)
    const rate = showRate(overall)
    const coverage = overall.finished > 0 ? overall.answered / overall.finished : 0
    const thin = coverage < THIN_COVERAGE

    return (
        <Answer figure={overall.attended} caption={`of ${overall.finished} ${plural(overall.finished, "call", "calls")}: someone came`} title="Did anyone turn up?">
            {/* The range, not a point. Its width is what tagging buys back. */}
            <p className="t-body">
                {overall.untagged > 0
                    ? `Between ${low} and ${high} of ${overall.finished} calls had someone turn up. The gap is the ${overall.untagged} ${plural(overall.untagged, "call", "calls")} nobody has marked yet.`
                    : `Every call in this window has an answer: ${overall.attended} of ${overall.finished} had someone turn up.`}
            </p>
            <OutcomeBar outcome={overall} />
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                <Key swatch="bg-r1-ink">{overall.attended} came</Key>
                <Key swatch="bg-r1-red-dot">{overall.noShow} no-show</Key>
                <Key swatch="bg-r1-line shadow-[inset_0_0_0_1px_var(--r1-line-2)]">{overall.untagged} not answered</Key>
            </div>
            {/* Coverage travels with the rate it qualifies, never as small
                print under it, and no rate is drawn off too few answers. */}
            <p className="t-meta">
                {rate === null
                    ? `No show-up rate yet: ${overall.answered} of the ${MIN_ANSWERS_FOR_RATE} answers one needs.`
                    : `Of the ${overall.answered} calls with an answer, ${Math.round(rate * 100)}% had someone turn up${
                          thin ? `, but only ${Math.round(coverage * 100)}% of calls have an answer, so that is thin.` : "."
                      }`}
            </p>
            {/* The one thing on this tab anybody can act on. The fortnight is the
                same one the Needs an outcome list keeps, so the two agree. */}
            {openQuestions > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="t-meta">Every call you mark narrows that range by one. Calls older than a fortnight are left alone.</p>
                    <Button onClick={onMarkCalls}>Mark the {openQuestions}</Button>
                </div>
            )}
        </Answer>
    )
}

function Key({ swatch, children }: { swatch: string; children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-[13px] tabular-nums text-r1-ink-2">
            <span className={`h-2.5 w-2.5 rounded-[3px] ${swatch}`} aria-hidden="true" />
            {children}
        </span>
    )
}

/** "between 8:00 PM and 12:00 AM", or "outside bookable hours" for the old link's calls. */
function windowPhrase(w: WindowStat): string {
    return w.startMinute < 0 ? "outside bookable hours" : `between ${minuteLabel(w.startMinute)} and ${minuteLabel(w.endMinute)}`
}

/**
 * The bookable windows, as counts. No rates here: each window holds a
 * fraction of an already-thin sample, and a percentage of eight calls reads
 * like a finding. The figure is the window with the most calls nobody has
 * answered for, the board's "of 51 evening calls have no answer".
 */
function WhenTheyCome({ stats }: { stats: Stats }) {
    const windows = stats.windows
    const worst = windows.reduce<WindowStat | null>((best, w) => (!best || w.outcome.untagged > best.outcome.untagged ? w : best), null)
    const busiest = windows.reduce<WindowStat | null>((best, w) => (!best || w.outcome.finished > best.outcome.finished ? w : best), null)
    const lead = worst && worst.outcome.untagged > 0 ? worst : busiest
    if (!lead) return null

    const leadIsGap = lead.outcome.untagged > 0
    const unclear = windows.find((w) => w.outcome.finished > 0 && w.outcome.untagged * 2 > w.outcome.finished)

    return (
        <Answer
            figure={leadIsGap ? lead.outcome.untagged : lead.outcome.attended}
            caption={
                leadIsGap
                    ? `of ${lead.outcome.finished} calls ${windowPhrase(lead)} have no answer`
                    : `of ${lead.outcome.finished} calls ${windowPhrase(lead)}: someone came`
            }
            title="When do they come?"
        >
            <p className="t-body">
                {windows
                    .filter((w) => w.outcome.finished > 0)
                    .map((w) => `${w.label}: ${w.outcome.attended} of ${w.outcome.finished} came.`)
                    .join(" ")}
                {unclear && ` Most calls ${windowPhrase(unclear)} have no answer yet, so nobody knows how that window does.`}
            </p>
            <div className="flex flex-col gap-2">
                {windows.map((w) => (
                    <BarRow key={w.label} label={w.label} value={w.outcome.finished === 0 ? "No calls" : `${w.outcome.attended} of ${w.outcome.finished} came`}>
                        <OutcomeBar outcome={w.outcome} thin />
                    </BarRow>
                ))}
            </div>
            <p className="t-meta">Counts, not rates: each window is a slice of an already thin sample.</p>
        </Answer>
    )
}

/** A label, a bar, a number. Stacked on a phone, three columns on a desk. */
function BarRow({ label, value, children }: { label: string; value: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:min-h-7 sm:grid-cols-[180px_minmax(0,1fr)_150px] sm:gap-x-4">
            <span className="t-body col-span-2 sm:col-span-1">{label}</span>
            <span className="flex min-w-0">{children}</span>
            <span className="text-right text-[13px] tabular-nums text-r1-ink-2">{value}</span>
        </div>
    )
}

/** The figure's caption for the source most calls came through. */
function originCaption(origin: OriginStat, total: number): string {
    switch (origin.origin) {
        case "page":
            return `of ${total} booked on our own page`
        case "tidycal":
            return `of ${total} booked through TidyCal`
        case "hr_pipeline":
            return `of ${total} came from the HR pipeline`
        case "calendar":
            return `of ${total} were added by hand`
        default:
            return `of ${total} were booked before we recorded the source`
    }
}

/** A one-colour share bar. A small count keeps a visible sliver; a zero draws nothing. */
function InkBar({ n, of }: { n: number; of: number }) {
    return (
        <span className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-r1-fill" aria-hidden="true">
            <span className={`block h-full bg-r1-ink-2 ${n > 0 ? "min-w-[3px]" : ""}`} style={{ width: pct(n, of) }} />
        </span>
    )
}

/**
 * Where they came from. Composition only: these are three different funnels
 * reaching different people, and one of them is being retired, so comparing
 * their outcomes would measure the migration rather than the calls.
 */
function WhereFrom({ stats }: { stats: Stats }) {
    const total = stats.origins.reduce((sum, o) => sum + o.finished, 0)
    const top = stats.origins[0]
    if (!top || total === 0) return null

    return (
        <Answer figure={top.finished} caption={originCaption(top, total)} title="Where do they come from?">
            <p className="t-body">Which system booked each finished call.</p>
            <div className="flex flex-col gap-2">
                {stats.origins.map((o) => (
                    <BarRow key={o.origin} label={o.label} value={`${o.finished} · ${Math.round((o.finished / total) * 100)}%`}>
                        <InkBar n={o.finished} of={total} />
                    </BarRow>
                ))}
            </div>
            <p className="t-meta">
                Composition only: these funnels reach different people and one is being retired, so their show rates are not compared.
                {stats.repeatBookers > 0 &&
                    ` ${stats.repeatBookers} ${plural(stats.repeatBookers, "person", "people")} booked more than once; the table does not say whether that was a rebooking after a missed call or a second conversation.`}
            </p>
        </Answer>
    )
}

/**
 * The Meet rooms, folded away: how long each call's room was open. Google tells
 * this account that and refuses to say who was in it, so a long reading could
 * be somebody sitting alone and a short one could be a call that moved to a
 * phone. Nothing above is derived from these numbers.
 *
 * "Not asked yet" and "no room to check" are kept apart on purpose: the first
 * drains on its own as the hourly job catches up, the second never will.
 */
function MeetRooms({ stats }: { stats: Stats }) {
    const { rooms, durations } = stats
    const noRoom = rooms.noRoom + rooms.refused
    return (
        <Fold
            title={<FoldTitle label="Meet rooms: how long each was open" meta={`${rooms.opened} opened · ${rooms.neverOpened} never opened`} />}
        >
            <div className="flex flex-col gap-3 pb-2">
                <p className="t-meta">Google says how long a room was open, never who was in it. Nothing above is derived from these readings.</p>
                {durations.read > 0 ? (
                    <div className="flex flex-col gap-2">
                        {[
                            { label: "Never opened", n: durations.neverOpened },
                            { label: "Under 2 minutes", n: durations.underTwoMinutes },
                            { label: "2 to 5 minutes", n: durations.twoToFive },
                            { label: "5 minutes or more", n: durations.fiveOrMore },
                        ].map((b) => (
                            <BarRow key={b.label} label={b.label} value={`${b.n} ${plural(b.n, "room", "rooms")}`}>
                                <InkBar n={b.n} of={durations.read} />
                            </BarRow>
                        ))}
                    </div>
                ) : (
                    <p className="t-body">No room has been read yet.</p>
                )}
                {(rooms.notAsked > 0 || noRoom > 0) && (
                    <p className="t-meta">
                        {[
                            rooms.notAsked > 0 ? `${rooms.notAsked} not asked yet (resolves on its own)` : null,
                            noRoom > 0 ? `${noRoom} with no room to check (will never resolve)` : null,
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                        .
                    </p>
                )}
                <p className="t-meta">Buckets, not an average: readings cluster at both ends, so a middle would describe none of the calls.</p>
            </div>
        </Fold>
    )
}
