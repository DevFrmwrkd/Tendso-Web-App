"use client"

import Link from "next/link"
import { useId, useMemo } from "react"
import { ArrowUpRight, CalendarDays, CheckCheck, Clock3, RotateCw } from "lucide-react"

import { Button, Dot, Icon, Loading, PageHeader, Skeleton, SkeletonRows } from "@/components/r1"
import { formatCallTime, manilaDayKey, timeSince, useCallSchedule, useNow } from "@/hooks/useCallSchedule"

import { CalendarNote, CallRow, OutOfHoursNote } from "./CallList"
import { callsLeftLine, dayPart, focusKey, fromScheduled, longDay, plural } from "./calls"
import PriorityRow from "./PriorityRow"
import styles from "./TodayDashboard.module.css"

/** The staff workspace contains the call schedule and outcomes only. */
export default function StaffDashboard() {
    const { upcoming, needsAttendance, calendarError, loading, refresh, refreshing, lastRefreshed } = useCallSchedule(true)
    const now = useNow()
    const listId = useId()
    const owedId = useId()
    const outId = useId()

    // A call stays in the upcoming schedule until its end, including while live.
    const today = useMemo(() => {
        const key = manilaDayKey(now)
        return upcoming.filter(call => manilaDayKey(call.startMs) === key).map(fromScheduled)
    }, [upcoming, now])
    const focus = focusKey(today, now)
    const next = upcoming[0] ?? null
    const outOfHours = useMemo(() => upcoming.filter(call => call.outsideHours).length, [upcoming])
    const owed = needsAttendance.length

    return <div className={styles.dashboard}>
        <PageHeader title="Today" sub="Your calls, outcomes and next steps." />
        <section className={styles.overview} aria-label="Your call schedule">
            <div className={styles.overviewCopy}>
                <span className={styles.date}><CalendarDays size={16} aria-hidden="true" />{longDay(now)}</span>
                <h2>Your calls, together.</h2>
                <p>Join the next conversation, keep your schedule in view and record who came afterward.</p>
                {loading ? <Loading label="Loading your calls"><Skeleton width={250} height={16} /></Loading>
                    : <span className={styles.overviewNote}><Dot tone="progress" />{callsLeftLine(upcoming, now)} · Philippine time</span>}
            </div>
            <div className={styles.overviewMark} aria-hidden="true"><CalendarDays size={48} strokeWidth={1.5} /></div>
        </section>
        <div className={`${styles.metrics} ${styles.staffMetrics}`} aria-label="Call summary">
            <StaffMetric label="Calls ahead today" value={loading ? undefined : today.length} icon={CalendarDays} accent />
            <StaffMetric label="Outcomes to record" value={loading ? undefined : owed} icon={CheckCheck} />
            <StaffMetric label="Outside your hours" value={loading ? undefined : outOfHours} icon={Clock3} />
        </div>
        {calendarError && <CalendarNote error={calendarError} />}
        <div className={styles.workspace}>
            <section className={`${styles.staffSection} ${styles.staffCalls}`} aria-labelledby={listId}>
                <div className={styles.sectionHeading}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="t-h2" id={listId}>{loading ? "Your call schedule" : today.length ? `${today.length} ${plural(today.length, "call", "calls")} ${dayPart(today)}` : "No more calls today"}</h2>
                        <span className="t-meta">10-minute field agent calls</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {lastRefreshed && !refreshing && <span className="t-meta">Updated {timeSince(lastRefreshed, now)}</span>}
                        <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing} aria-busy={refreshing}><Icon icon={RotateCw} />{refreshing ? "Refreshing…" : "Refresh"}</Button>
                    </div>
                </div>
                {loading ? <Loading label="Loading today's calls"><SkeletonRows count={3} /></Loading>
                    : today.length ? <div className="t-card @container overflow-hidden">
                        <OutOfHoursNote count={today.filter(call => call.outsideHours).length} />
                        <div className="t-list">{today.map(call => <CallRow key={call.key} call={call} now={now} focus={call.key === focus}
                            highlight="label" join="ghost" onChanged={refresh} />)}</div>
                    </div> : <div className="t-card px-5 py-6"><p className="t-body">{next ? `The next call is ${formatCallTime(next.startMs)}, with ${next.name}.` : "No upcoming calls. New bookings will appear here."}</p></div>}
            </section>
            <aside className={`${styles.sideColumn} ${styles.staffAside}`} aria-label="Call follow-ups">
                {!loading && owed > 0 && <section className="t-card overflow-hidden" aria-labelledby={owedId}>
                    <PriorityRow headingId={owedId} figure={owed} tone="attn"
                        reason={`finished ${plural(owed, "call has", "calls have")} no outcome yet`}
                        meta="Only the person on the call knows who came. Google only records how long the room was open."
                        action={{ label: "Mark who came", href: "/admin/bookings", primary: true }} />
                </section>}
                {!loading && outOfHours > 0 && <section className="t-card overflow-hidden" aria-labelledby={outId}>
                    <PriorityRow headingId={outId} figure={outOfHours} tone="attn"
                        reason={`booked ${plural(outOfHours, "call falls", "calls fall")} outside your hours`}
                        meta="Nobody is working then. Cancel each one and the person gets the current booking link."
                        action={{ label: "See the calls", href: "/admin/bookings", primary: owed === 0 }} />
                </section>}
                {!loading && !owed && !outOfHours ? <div className={styles.scheduleCard}><div className={styles.smallHeading}><span className={styles.iconTile}><CheckCheck size={22} aria-hidden="true" /></span><h2>All caught up</h2></div><p className={styles.quiet}>There are no call outcomes or scheduling issues waiting for you.</p></div> : null}
            </aside>
        </div>
    </div>
}

function StaffMetric({ label, value, icon: MetricIcon, accent = false }: { label: string; value: number | undefined; icon: typeof CalendarDays; accent?: boolean }) {
    return <Link href="/admin/bookings" className={`${styles.metric} ${accent ? styles.metricAccent : ""}`}>
        <span className={styles.metricHead}><span className={styles.iconTile}><MetricIcon size={20} aria-hidden="true" /></span><ArrowUpRight size={18} aria-hidden="true" /></span>
        {value === undefined ? <Skeleton width={60} height={37} /> : <strong>{value}</strong>}
        <span>{label}</span>
    </Link>
}
