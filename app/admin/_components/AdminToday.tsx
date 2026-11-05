"use client"

import Link from "next/link"
import { useId, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ArrowUpRight, CalendarDays, CheckCheck, ClipboardList, Inbox, Users, Wallet } from "lucide-react"
import { toast } from "sonner"

import {
    Button,
    ButtonLink,
    Dot,
    EmptyState,
    Fold,
    Folds,
    formatMoney,
    Icon,
    List,
    Loading,
    MoneyLine,
    MoneyLines,
    PageHeader,
    RowLink,
    Skeleton,
    SkeletonRows,
    Status,
    submissionStatus,
} from "@/components/r1"
import { api } from "@/convex/_generated/api"
import { affiliateAttribution } from "@/lib/submissionAttribution"
import { formatCallTime, useCallSchedule, useNow, type FinishedCall, type ScheduledCall } from "@/hooks/useCallSchedule"

import { CalendarNote } from "./CallList"
import { betweenLabel, busiestWindow, callsLeftLine, longDay, plural, shortDate } from "./calls"
import FoldTitle from "./FoldTitle"
import PriorityRow, { type Priority } from "./PriorityRow"
import { monthlyEarnings } from "@/app/admin/payouts/_lib/model"
import styles from "./TodayDashboard.module.css"

type Submissions = FunctionReturnType<typeof api.submissions.getAllWithCreator>
type Submission = Submissions[number]
type Withdrawals = FunctionReturnType<typeof api.withdrawals.getByStatus>
type Analytics = FunctionReturnType<typeof api.analytics.getAllAnalytics>
type PromoStats = FunctionReturnType<typeof api.admin.getPromoStats>
type VisitRequests = FunctionReturnType<typeof api.visitRequests.listAdmin>["requests"]
type PendingAgents = FunctionReturnType<typeof api.creators.listPendingApproval>

/**
 * Real work queues, the shared call schedule and the existing money summary.
 * Page-level admin access is resolved before this component mounts. Every
 * metric opens its authoritative queue; the visit response also carries the
 * expected Clerk subject so another actor's result is never displayed.
 */
export default function AdminToday() {
    const now = useNow()
    const { userId } = useAuth()

    const submissions = useQuery(api.submissions.getAllWithCreator, {})
    // Safely handle checkBackfillNeeded query with error fallback
    const isBackfillNeeded = useQuery(api.admin.checkBackfillNeeded) ?? false
    const backfillWebsiteUrls = useMutation(api.admin.backfillWebsiteUrls)
    const [backfilling, setBackfilling] = useState(false)

    // Analytics data
    const allAnalytics = useQuery(api.analytics.getAllAnalytics, {})
    // Hostinger custom-domain fees the platform paid (deducted from gross earnings)
    const totalHostingerCosts = useQuery(api.domains.getTotalHostingerDomainCostsPHP, {})
    const promoStats = useQuery(api.admin.getPromoStats, {})

    // The failed list is the one the sidebar's Payouts badge counts, so the
    // two always agree; pending and processing say whether anything is still
    // moving.
    const failedPayouts = useQuery(api.withdrawals.getByStatus, { status: "failed" })
    const pendingPayouts = useQuery(api.withdrawals.getByStatus, { status: "pending" })
    const processingPayouts = useQuery(api.withdrawals.getByStatus, { status: "processing" })
    const pendingAgents = useQuery(api.creators.listPendingApproval, {})
    const visitResult = useQuery(api.visitRequests.listAdmin, userId ? { status: "requested", clerkId: userId } : "skip")
    const visits = visitResult?.actorClerkId === userId ? visitResult?.requests : undefined

    // The same schedule the staff Today and Calls read, so the three cannot
    // disagree about what is booked or still unanswered.
    const schedule = useCallSchedule(true)
    const slotConfig = useQuery(api.nativeBookings.getSlotConfig, {})

    const priorities = useMemo(() => {
        if (
            submissions === undefined ||
            failedPayouts === undefined ||
            pendingPayouts === undefined ||
            processingPayouts === undefined ||
            visits === undefined ||
            pendingAgents === undefined ||
            schedule.loading ||
            slotConfig === undefined
        ) {
            return null
        }
        return buildPriorities({
            submissions,
            failed: failedPayouts,
            inFlight: pendingPayouts.length + processingPayouts.length,
            visits,
            pendingAgents,
            unanswered: schedule.needsAttendance,
            windows: slotConfig.windows.map((w) => [w[0], w[1]] as [number, number]),
        })
    }, [submissions, failedPayouts, pendingPayouts, processingPayouts, visits, pendingAgents, schedule.loading, schedule.needsAttendance, slotConfig])

    const reviewCount = submissions?.filter(submission => submission.status === "submitted" || submission.status === "in_review").length

    const handleBackfill = async () => {
        setBackfilling(true)
        try {
            const result = await backfillWebsiteUrls({})
            toast.success(
                `Site links synced: ${result.updatedSubmissions} ${plural(result.updatedSubmissions, "submission", "submissions")} and ` +
                    `${result.updatedWebsites} ${plural(result.updatedWebsites, "site", "sites")} updated.`,
            )
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not sync the site links.")
        } finally {
            setBackfilling(false)
        }
    }

    return (
        <div className={styles.dashboard}>
            <PageHeader title="Today" sub="Keep websites moving and your team in sync." />
            <section className={styles.overview} aria-label="Today's work">
                <div className={styles.overviewCopy}>
                    <span className={styles.date}><CalendarDays size={16} aria-hidden="true" />{longDay(now)}</span>
                    {priorities === null ? <Loading label="Loading today's summary"><Skeleton width="80%" height={38} /></Loading> : <>
                        <h2>{priorities.length ? `${priorities.length} ${plural(priorities.length, "queue needs", "queues need")} your attention.` : "You’re up to date."}</h2>
                        <p>{priorities.length ? "Start with the work waiting below. Each action takes you straight to the right queue." : "No reviews, visit requests, failed payouts or call outcomes are waiting on you."}</p>
                    </>}
                    <span className={styles.overviewNote}><Dot tone="progress" />{schedule.loading ? "Loading call schedule…" : callsLeftLine(schedule.upcoming, now)} · Philippine time</span>
                </div>
                <div className={styles.overviewMark} aria-hidden="true">{priorities?.length ? <ClipboardList size={43} strokeWidth={1.5} /> : <CheckCheck size={48} strokeWidth={1.5} />}</div>
            </section>

            <div className={styles.metrics} aria-label="Work queues">
                <DashboardMetric href="/admin/submissions" label="Submissions to review" value={reviewCount} icon={ClipboardList} accent />
                <DashboardMetric href="/admin/creators?view=pending" label="Agents to approve" value={pendingAgents?.length} icon={Users} />
                <DashboardMetric href="/admin/visits" label="Visits to assign" value={visits?.length} icon={CalendarDays} capped />
                <DashboardMetric href="/admin/payouts" label="Failed payouts" value={failedPayouts?.length} icon={Wallet} />
            </div>

            {schedule.calendarError && <CalendarNote error={schedule.calendarError} />}
            <div className={styles.workspace}>
                <section aria-label="Needs you" className={styles.workSection}>
                    <div className={styles.sectionHeading}><h2 className="t-h2">Needs attention</h2><span>Where to focus next</span></div>
                    <div className={`t-card ${styles.priorityCard}`}>
                        {priorities === null ? <Loading label="Loading what needs you"><SkeletonRows count={3} /></Loading>
                            : priorities.length ? <div className="t-list">{priorities.map(({ key, ...priority }) => <PriorityRow key={key} {...priority} />)}</div>
                                : <div className={styles.caughtUp}><span><CheckCheck size={25} aria-hidden="true" /></span><h3>Everything is moving.</h3><p>New work will appear here when it needs your attention.</p></div>}
                    </div>
                    {isBackfillNeeded === true && <div className={styles.repair}>
                        <p><Dot tone="attn" />Some live sites and their submissions disagree about the site link.</p>
                        <Button size="sm" onClick={handleBackfill} disabled={backfilling} aria-busy={backfilling}>{backfilling ? "Syncing…" : "Sync site links"}</Button>
                    </div>}
                </section>
                <aside className={styles.sideColumn} aria-label="Call schedule and money summary">
                    <UpcomingCalls calls={schedule.upcoming} loading={schedule.loading} />
                    <section className={styles.moneyCard} aria-label="Money summary"><div className={styles.smallHeading}><span className={styles.iconTile}><Wallet size={20} aria-hidden="true" /></span><div><h2>Money summary</h2><p>Recorded earnings and costs</p></div></div><MoneyFold analytics={allAnalytics} hostinger={totalHostingerCosts} promo={promoStats} /></section>
                </aside>
            </div>
            <div className={styles.recent}><RecentSubmissions submissions={submissions} /></div>
        </div>
    )
}

function DashboardMetric({ href, label, value, icon: MetricIcon, accent = false, capped = false }: {
    href: string; label: string; value: number | undefined; icon: typeof Inbox; accent?: boolean; capped?: boolean
}) {
    return <Link href={href} className={`${styles.metric} ${accent ? styles.metricAccent : ""}`}>
        <span className={styles.metricHead}><span className={styles.iconTile}><MetricIcon size={20} aria-hidden="true" /></span><ArrowUpRight size={18} aria-hidden="true" /></span>
        {value === undefined ? <Skeleton width={60} height={37} /> : <strong>{value}{capped && value >= 200 ? "+" : ""}</strong>}
        <span>{label}</span>
    </Link>
}

function UpcomingCalls({ calls, loading }: { calls: ScheduledCall[]; loading: boolean }) {
    return <section className={styles.scheduleCard} aria-label="Upcoming calls">
        <div className={styles.sectionHeading}><h2>Coming up</h2><Link href="/admin/bookings">View calls <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
        <p className={styles.cardSubtitle}>Field agent calls · Philippine time</p>
        {loading ? <Loading label="Loading upcoming calls"><SkeletonRows count={2} /></Loading> : calls.length ? <ol className={styles.callList}>{calls.slice(0, 3).map(call => <li key={call.key}><span className={styles.callDot} aria-hidden="true" /><div><strong>{call.name}</strong><span>{formatCallTime(call.startMs)}</span></div></li>)}</ol> : <p className={styles.quiet}>No upcoming calls. New bookings will appear here.</p>}
        <ButtonLink href="/admin/bookings" variant="ghost" className={styles.scheduleButton}>Open call schedule</ButtonLink>
    </section>
}

/** Today while the page's own auth check runs: the header, the line and the card, in shape. */
export function TodaySkeleton() {
    return (
        <Loading label="Loading Today" className={styles.dashboard}>
            <div className="flex flex-col gap-3" aria-hidden="true">
                <Skeleton width={140} height={36} />
                <Skeleton width={200} height={16} />
                <Skeleton width="60%" height={14} className="mt-1" />
            </div>
            <Skeleton height={190} />
            <div className={styles.metrics} aria-hidden="true">{[0, 1, 2, 3].map(key => <Skeleton key={key} height={150} />)}</div>
            <SkeletonRows count={3} />
        </Loading>
    )
}

// ── What is waiting ────────────────────────────────────────────────────────

function possessive(name: string): string {
    return `${name}'s`
}

/**
 * Only nonempty work queues become action rows. The first queue owns the
 * primary action; the financial and call-outcome rules match their screens.
 */
function buildPriorities({
    submissions,
    failed,
    inFlight,
    visits,
    pendingAgents,
    unanswered,
    windows,
}: {
    submissions: Submissions
    failed: Withdrawals
    inFlight: number
    visits: VisitRequests
    pendingAgents: PendingAgents
    unanswered: FinishedCall[]
    windows: Array<[number, number]>
}): Priority[] {
    const rows: Priority[] = []

    // Same statuses as the sidebar's Submissions badge and the queue's
    // "Needs review" tab.
    const toReview = submissions
        .filter((s) => s.status === "submitted" || s.status === "in_review")
        .sort((a, b) => b._creationTime - a._creationTime)
    if (toReview.length > 0) {
        const newest = toReview[0]
        const oldest = toReview[toReview.length - 1]
        rows.push({
            key: "review",
            figure: toReview.length,
            tone: "attn",
            reason: `${plural(toReview.length, "submission needs", "submissions need")} review`,
            meta:
                toReview.length === 1
                    ? `${newest.businessName}, sent ${shortDate(newest._creationTime)}.`
                    : `Newest is ${newest.businessName} (${shortDate(newest._creationTime)}). ${oldest.businessName} has waited since ${shortDate(oldest._creationTime)}.`,
            // The queue itself: a bare /admin/submissions opens on Needs review.
            action: { label: "Start reviewing", href: "/admin/submissions" },
        })
    }

    if (pendingAgents.length > 0) {
        const first = pendingAgents[0]
        const name = [first.firstName, first.lastName].filter(Boolean).join(" ") || "The first applicant"
        rows.push({
            key: "agents",
            figure: pendingAgents.length,
            tone: "attn",
            reason: `${plural(pendingAgents.length, "field agent is", "field agents are")} waiting for approval`,
            meta: `${name} passed the quiz ${shortDate(first.quizPassedAt)}. Review their profile before approving access.`,
            action: { label: "Review field agents", href: "/admin/creators?view=pending" },
        })
    }

    if (visits.length > 0) {
        const newest = visits[0]
        rows.push({
            key: "visits",
            figure: visits.length,
            tone: "attn",
            reason: `${plural(visits.length, "shop visit needs", "shop visits need")} an agent`,
            meta: visits.length === 1
                ? `${newest.shopName} in ${newest.city}. Assign an agent and propose a time.`
                : "Owners are waiting for an agent and a proposed time. The visit is confirmed after the agent accepts.",
            action: { label: "Assign shop visits", href: "/admin/visits" },
        })
    }

    if (failed.length > 0) {
        const oldest = failed.reduce((a, b) => (b.createdAt < a.createdAt ? b : a))
        const moving =
            inFlight === 0 ? "None are in flight." : `${inFlight} other ${plural(inFlight, "payout is", "payouts are")} still processing.`
        const example = `${possessive(oldest.creatorName)} ${formatMoney(oldest.amount)} from ${shortDate(oldest.createdAt)}`
        rows.push({
            key: "payouts",
            figure: failed.length,
            tone: "bad",
            reason: `creator ${plural(failed.length, "payout", "payouts")} failed`,
            meta: `${moving} ${failed.length === 1 ? `It is ${example}.` : `The oldest is ${example}.`}`,
            action: { label: "See failed payouts", href: "/admin/payouts" },
        })
    }

    if (unanswered.length > 0) {
        // Which bookable window most of them fell in, when one clearly holds
        // most: the board's "50 of them are evening calls". Below a handful the
        // split says nothing.
        const split = unanswered.length >= 4 ? busiestWindow(unanswered, windows) : null
        const where = split
            ? split.count === unanswered.length
                ? `All of them were ${betweenLabel(split.window)}. `
                : `${split.count} of them were ${betweenLabel(split.window)}. `
            : ""
        rows.push({
            key: "calls",
            figure: unanswered.length,
            tone: "attn",
            reason: `${plural(unanswered.length, "call has", "calls have")} no outcome yet`,
            meta: `${where}The show-up rate means nothing until ${plural(unanswered.length, "it is", "they are")} marked.`,
            action: { label: "Mark who came", href: "/admin/bookings" },
        })
    }

    // One primary per view: the first thing waiting gets it.
    if (rows[0]) rows[0].action = { ...rows[0].action, primary: true }
    return rows
}

// ── Money ──────────────────────────────────────────────────────────────────

/**
 * Gross earnings across all time, from the analytics rows, by the same rule as
 * the money fold on Payouts (monthlyEarnings): per month, the daily rows when a
 * month has them, the monthly row otherwise. The monthly rows cannot be summed
 * on their own: payments.creditCreatorForPayment adds each payment to its month
 * AND the nightly aggregateDailyToMonthly adds the day again, so they count a
 * month roughly twice. One rule, so Today and Payouts show the same gross.
 */
function grossOf(analytics: Analytics): number {
    return monthlyEarnings(analytics).reduce((sum, m) => sum + m.amount, 0)
}

/**
 * The money in one line, the working in a fold (closed by default).
 *
 * Net = gross minus the Hostinger custom-domain fees the platform paid, minus
 * the promo. Gross sums the analytics earningsTotal rows, which are written
 * for EVERY credited submission — including sites given away free, where the
 * creator's payout is real but the ₱0 collected is not revenue. Left in, each
 * free site would inflate net by the payout it actually cost. Subtracted, the
 * same way Hostinger fees already are.
 */
function MoneyFold({
    analytics,
    hostinger,
    promo,
}: {
    analytics: Analytics | undefined
    hostinger: number | undefined
    promo: PromoStats | undefined
}) {
    if (analytics === undefined || hostinger === undefined || promo === undefined) {
        return (
            <Loading label="Loading the money summary">
                <Skeleton height={52} />
            </Loading>
        )
    }

    const gross = grossOf(analytics)
    const promoCosts = promo.compedPayoutTotal ?? 0
    const net = Math.max(0, gross - hostinger - promoCosts)

    return (
        <Folds>
            <Fold
                title={
                    <FoldTitle
                        label={
                            <span className="text-[15px] font-normal text-r1-ink-2">
                                Net <strong className="t-num text-[16px] font-semibold text-r1-ink">{formatMoney(net)}</strong> all-time
                            </span>
                        }
                        meta={<span className="hidden sm:inline">Gross and costs</span>}
                    />
                }
            >
                <div className="flex flex-col gap-3 pb-2 sm:max-w-[320px]">
                    <MoneyLines>
                        <MoneyLine label="Gross, all-time" amount={formatMoney(gross)} />
                        {hostinger > 0 && <MoneyLine label="Hostinger domain costs" amount={formatMoney(hostinger, "debit")} />}
                        {promoCosts > 0 && (
                            <MoneyLine
                                label={`Promo · ${promo.compedCount} free ${plural(promo.compedCount, "site", "sites")}`}
                                amount={formatMoney(promoCosts, "debit")}
                            />
                        )}
                        <MoneyLine total label="Net" amount={formatMoney(net)} />
                    </MoneyLines>
                    <p className="t-meta">
                        Revenue over time is in the money summary on{" "}
                        <Link className="t-link" href="/admin/payouts">
                            Payouts
                        </Link>
                        .
                    </p>
                </div>
            </Fold>
        </Folds>
    )
}

// ── Recent submissions ─────────────────────────────────────────────────────

/** Who brought it in: the affiliate, self-serve owner, or field creator. */
function byLine(s: Submission): string {
    const affiliate = affiliateAttribution(s)
    if (affiliate) return `${affiliate.label} · ${affiliate.name}`
    if (s.contentSource === "owner_intake") return s.ownerName ? `Owner self-serve · ${s.ownerName}` : "Owner self-serve"
    const name = [s.creator?.firstName, s.creator?.lastName].filter(Boolean).join(" ")
    return name ? `by ${name}` : "Creator unknown"
}

/**
 * The five most recent submissions — a glance, not a workbench. The full
 * list, with its filters, search, sort and paging, lives at
 * /admin/submissions; keeping a second copy here is how the two drift.
 */
function RecentSubmissions({ submissions }: { submissions: Submissions | undefined }) {
    const titleId = useId()
    const recent = useMemo(
        () => (submissions ? [...submissions].sort((a, b) => b._creationTime - a._creationTime).slice(0, 5) : []),
        [submissions],
    )

    return (
        <section className="flex flex-col gap-3" aria-labelledby={titleId}>
            <div className="flex items-baseline justify-between gap-4">
                <h2 className="t-h2" id={titleId}>
                    Recent submissions
                </h2>
                {submissions && submissions.length > 0 && (
                    <span className="t-count">
                        {recent.length} of {submissions.length}
                    </span>
                )}
            </div>
            {submissions === undefined ? (
                <Loading label="Loading recent submissions">
                    <SkeletonRows count={5} />
                </Loading>
            ) : submissions.length === 0 ? (
                <div className="t-card">
                    <EmptyState
                        icon={<Icon icon={Inbox} size={18} />}
                        title="No submissions yet"
                        body="Creators' interviews and owners' self-serve sites land here as they come in."
                    />
                </div>
            ) : (
                <div className="t-card overflow-hidden">
                    <List>
                        {recent.map((s) => (
                            <RecentRow key={s._id} s={s} />
                        ))}
                    </List>
                    {/* Every submission, so the queue's All tab, not its default Needs review. */}
                    <Link className="t-showall" href="/admin/submissions?status=all">
                        Show all {submissions.length} {plural(submissions.length, "submission", "submissions")}
                    </Link>
                </div>
            )}
        </section>
    )
}

/**
 * One submission. The row opens its details drawer on the queue (Round 1:
 * details open in a drawer, never a new page), on the All tab because this
 * list is every status; the drawer leads on to the full review. On a desk the
 * creator, status and date are columns; on a phone they fold into the lines
 * under the name.
 */
function RecentRow({ s }: { s: Submission }) {
    const status = submissionStatus(s.status, "admin")
    const by = byLine(s)
    const date = shortDate(s._creationTime)
    const place = [s.businessType, s.city].filter(Boolean).join(" · ")
    return (
        <RowLink href={`/admin/submissions?status=all&open=${s._id}`} className="min-h-16 sm:px-5">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] font-medium leading-5 text-r1-ink">{s.businessName}</span>
                <span className="t-meta truncate">
                    {place}
                    <span className="lg:hidden">
                        {place ? " · " : ""}
                        {by}
                    </span>
                </span>
                <span className="t-meta flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
                    <Status {...status} />
                    <span className="t-num">{date}</span>
                </span>
            </span>
            <span className="t-meta hidden w-[200px] flex-none truncate lg:block">{by}</span>
            <span className="hidden w-[176px] flex-none sm:block">
                <Status {...status} />
            </span>
            <span className="t-meta t-num hidden w-14 flex-none text-right sm:block">{date}</span>
        </RowLink>
    )
}
