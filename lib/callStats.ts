/**
 * The arithmetic behind the call statistics page, in one place.
 *
 * WHY IT IS SEPARATE. Every figure on that screen is a count over the same few
 * hundred rows, and the hard part is not the counting — it is being honest about
 * what the counts can and cannot support. Keeping the formulas together makes
 * the denominators legible side by side, which is where dashboards usually go
 * wrong.
 *
 * THE ONE RULE EVERYTHING ELSE FOLLOWS: an untagged call is a third state, never
 * a no-show. Most calls in this table will never be tagged, and folding the
 * untagged into either answer turns a gap in our record-keeping into a claim
 * about people who booked.
 */

export type CallOriginKey = "page" | "tidycal" | "hr_pipeline" | "calendar"

/** One row as `nativeBookings.statsRows` returns it. */
export type StatsRow = {
    startMs: number
    endMs: number
    status: string
    origin?: CallOriginKey
    conferenceSeconds?: number
    conferenceCheckedAt?: number
    attendance?: "attended" | "no_show"
    email: string
    rescheduledFromMs?: number
    hasMeetUrl: boolean
}

/**
 * Below this many answered calls no percentage is drawn at all.
 *
 * Twenty is not a statistical ceremony, it is the point where one more answer
 * stops moving the figure by five points. Under it the raw counts are shown
 * instead, which say the same thing without inviting anyone to read a trend.
 */
export const MIN_ANSWERS_FOR_RATE = 20

/** Below this share of calls answered, every rate on the page is marked thin. */
export const THIN_COVERAGE = 0.6

/** Manila minute-of-day, for sorting a call into a bookable window. */
export function manilaMinuteOfDay(ms: number): number {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        // h23 rather than the default: some engines render midnight as 24 under
        // hour12:false, which would sort a 00:05 call past the end of the day.
        hourCycle: "h23",
    }).formatToParts(new Date(ms))
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
    return hour * 60 + minute
}

/** "10:00" from minutes past midnight, with 1440 meaning midnight. */
export function minuteLabel(minutes: number): string {
    const m = minutes % 1440
    const h = Math.floor(m / 60)
    const suffix = h < 12 ? "AM" : "PM"
    const hour12 = h % 12 === 0 ? 12 : h % 12
    const mm = String(m % 60).padStart(2, "0")
    return `${hour12}:${mm} ${suffix}`
}

export type Outcome = {
    finished: number
    attended: number
    noShow: number
    untagged: number
    answered: number
}

function emptyOutcome(): Outcome {
    return { finished: 0, attended: 0, noShow: 0, untagged: 0, answered: 0 }
}

function addTo(outcome: Outcome, row: StatsRow) {
    outcome.finished++
    if (row.attendance === "attended") outcome.attended++
    else if (row.attendance === "no_show") outcome.noShow++
    else outcome.untagged++
    outcome.answered = outcome.attended + outcome.noShow
}

/**
 * The share of answered calls somebody turned up to, or null when too few have
 * been answered to say. Never falls back to a number — a rate withheld is the
 * finding.
 */
export function showRate(outcome: Outcome): number | null {
    if (outcome.answered < MIN_ANSWERS_FOR_RATE) return null
    return outcome.attended / outcome.answered
}

/**
 * The range the true count of attended calls must lie in.
 *
 * The low end counts only the calls somebody confirmed; the high end assumes
 * every untagged call went well. It is the one figure on the page that survives
 * sparse tagging intact, because it makes no assumption about the calls nobody
 * answered for — and its WIDTH is the thing tagging narrows.
 */
export function bounds(outcome: Outcome): { low: number; high: number } {
    return { low: outcome.attended, high: outcome.attended + outcome.untagged }
}

export type WindowStat = {
    label: string
    startMinute: number
    endMinute: number
    outcome: Outcome
}

export type OriginStat = {
    origin: CallOriginKey | "unknown"
    label: string
    finished: number
}

/**
 * What we know about the Meet rooms, in four states that must not be merged.
 *
 * The distinction that matters is the last two: `notAsked` drains on its own as
 * the hourly job catches up, while `noRoom` never will, because there was no
 * room to ask about. A single "unknown" bucket would hide a permanent blind spot
 * inside a temporary backlog.
 */
export type RoomLedger = {
    opened: number
    neverOpened: number
    /** Asked, and Google would not answer for that room. */
    refused: number
    /** Has a room, nobody has asked yet. Resolves itself. */
    notAsked: number
    /** No room on the booking at all. Never resolves. */
    noRoom: number
}

export type DurationBuckets = {
    neverOpened: number
    underTwoMinutes: number
    twoToFive: number
    fiveOrMore: number
    /** How many rooms these buckets are drawn from. */
    read: number
}

export type CallStats = {
    /** Calls that were going to happen and did: confirmed, and now over. */
    overall: Outcome
    cancelled: number
    windows: WindowStat[]
    origins: OriginStat[]
    rooms: RoomLedger
    durations: DurationBuckets
    /** Finished, untagged, and recent enough that somebody might still remember.
     *  The same fortnight the tagging inbox uses, so the two agree. */
    openQuestions: number
    /** How many people in this window booked more than once. */
    repeatBookers: number
    /** The earliest call in the table, which is when recording began. */
    firstCallMs: number | null
}

const ORIGIN_LABELS: Record<CallOriginKey | "unknown", string> = {
    page: "Our booking page",
    tidycal: "TidyCal",
    hr_pipeline: "HR pipeline",
    calendar: "Added by hand",
    unknown: "Booked before we recorded the source",
}

export function summarise(
    rows: StatsRow[],
    now: number,
    slotWindows: Array<[number, number]>,
): CallStats {
    const overall = emptyOutcome()
    let cancelled = 0
    let openQuestions = 0

    const windows: WindowStat[] = slotWindows.map(([startMinute, endMinute]) => ({
        label: `${minuteLabel(startMinute)} – ${minuteLabel(endMinute)}`,
        startMinute,
        endMinute,
        outcome: emptyOutcome(),
    }))
    // Calls that landed outside every bookable window — the old link sold these.
    const offHours: Outcome = emptyOutcome()

    const originCounts = new Map<CallOriginKey | "unknown", number>()
    const rooms: RoomLedger = { opened: 0, neverOpened: 0, refused: 0, notAsked: 0, noRoom: 0 }
    const durations: DurationBuckets = {
        neverOpened: 0,
        underTwoMinutes: 0,
        twoToFive: 0,
        fiveOrMore: 0,
        read: 0,
    }
    const seenEmails = new Map<string, number>()
    let firstCallMs: number | null = null

    const fortnightAgo = now - 14 * 24 * 60 * 60 * 1000

    for (const row of rows) {
        if (firstCallMs === null || row.startMs < firstCallMs) firstCallMs = row.startMs

        if (row.status === "cancelled") {
            // A cancelled call was never an opportunity to attend, so it stays
            // out of every denominator below and is reported on its own.
            cancelled++
            continue
        }
        if (row.status !== "confirmed") continue
        // Still ahead of us. Nothing about it is known yet, and adopted calls do
        // not even get a row until they are over, so counting them here would
        // describe our own booking page rather than the calendar.
        if (row.endMs >= now) continue

        addTo(overall, row)
        seenEmails.set(row.email, (seenEmails.get(row.email) ?? 0) + 1)

        if (!row.attendance && row.startMs > fortnightAgo) openQuestions++

        const minute = manilaMinuteOfDay(row.startMs)
        const window = windows.find((w) => minute >= w.startMinute && minute < w.endMinute)
        addTo(window ? window.outcome : offHours, row)

        const originKey = row.origin ?? "unknown"
        originCounts.set(originKey, (originCounts.get(originKey) ?? 0) + 1)

        if (!row.hasMeetUrl) rooms.noRoom++
        else if (row.conferenceSeconds === undefined) {
            if (row.conferenceCheckedAt === undefined) rooms.notAsked++
            else rooms.refused++
        } else {
            durations.read++
            if (row.conferenceSeconds === 0) {
                rooms.neverOpened++
                durations.neverOpened++
            } else {
                rooms.opened++
                if (row.conferenceSeconds < 120) durations.underTwoMinutes++
                else if (row.conferenceSeconds < 300) durations.twoToFive++
                else durations.fiveOrMore++
            }
        }
    }

    if (offHours.finished > 0) {
        windows.push({
            label: "Outside bookable hours",
            startMinute: -1,
            endMinute: -1,
            outcome: offHours,
        })
    }

    const origins: OriginStat[] = [...originCounts.entries()]
        .map(([origin, finished]) => ({ origin, label: ORIGIN_LABELS[origin], finished }))
        .sort((a, b) => b.finished - a.finished)

    let repeatBookers = 0
    for (const count of seenEmails.values()) if (count > 1) repeatBookers++

    return {
        overall,
        cancelled,
        windows,
        origins,
        rooms,
        durations,
        openQuestions,
        repeatBookers,
        firstCallMs,
    }
}
