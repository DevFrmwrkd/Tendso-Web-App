"use client"

import Link from "next/link"
import { useId, useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Inbox } from "lucide-react"
import { toast } from "sonner"

import {
    Button,
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
import { useCallSchedule, useNow, type FinishedCall } from "@/hooks/useCallSchedule"

import { CalendarNote } from "./CallList"
import { betweenLabel, busiestWindow, callsLeftLine, longDay, plural, shortDate } from "./calls"
import FoldTitle from "./FoldTitle"
import PriorityRow, { type Priority } from "./PriorityRow"
import { monthlyEarnings } from "@/app/admin/payouts/_lib/model"

type Submissions = FunctionReturnType<typeof api.submissions.getAllWithCreator>
type Submission = Submissions[number]
type Withdrawals = FunctionReturnType<typeof api.withdrawals.getByStatus>
type Analytics = FunctionReturnType<typeof api.analytics.getAllAnalytics>
type PromoStats = FunctionReturnType<typeof api.admin.getPromoStats>

/**
 * The admin's Today (board AdminHome): "What needs me today?"
 *
 * The date and a one-line count of what is waiting; then the things waiting,
 * each as one count, one reason and one action (a count of 0 is cut, not
 * shown); the money in one line with the working in a fold; and a glance at
 * the newest submissions.
 *
 * Every number here comes from a query that already existed: the queue from
 * submissions.getAllWithCreator, failed payouts from the same
 * withdrawals.getByStatus the sidebar badge counts, calls from the schedule
 * the staff Today and Calls read, and the money from the analytics, domains
 * and promo queries this page has always used.
 *
 * NO REVENUE CHART. It moved to the money summary on Payouts (scope:
 * "Revenue chart, moved elsewhere"); the money fold here says where.
 */
export default function AdminToday() {
    const now = useNow()

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
            schedule.loading ||
            slotConfig === undefined
        ) {
            return null
        }
        return buildPriorities({
            submissions,
            failed: failedPayouts,
            inFlight: pendingPayouts.length + processingPayouts.length,
            unanswered: schedule.needsAttendance,
            windows: slotConfig.windows.map((w) => [w[0], w[1]] as [number, number]),
        })
    }, [submissions, failedPayouts, pendingPayouts, processingPayouts, schedule.loading, schedule.needsAttendance, slotConfig])

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
        <>
            <div className="flex flex-col gap-4">
                <PageHeader title="Today" sub="What needs me today?" />
                {priorities ? (
                    <p className="t-body flex items-start gap-2.5">
                        <Dot tone={priorities.length > 0 ? "attn" : "done"} className="mt-1.5" />
                        <span>
                            <strong className="font-medium text-r1-ink">{longDay(now)}</strong> ·{" "}
                            {priorities.length === 0
                                ? "nothing is waiting on you"
                                : `${priorities.length} ${plural(priorities.length, "thing is", "things are")} waiting on you`}{" "}
                            · {callsLeftLine(schedule.upcoming, now)}
                        </span>
                    </p>
                ) : (
                    <Loading label="Loading today's summary">
                        <Skeleton width="60%" height={14} />
                    </Loading>
                )}
            </div>

            <div className="flex w-full max-w-[880px] flex-col gap-6 lg:gap-8">
                {/* The calls part of the line above is then our own rows alone. */}
                {schedule.calendarError && <CalendarNote error={schedule.calendarError} />}

                <section aria-label="Needs you" className="t-card overflow-hidden">
                    {priorities === null ? (
                        <Loading label="Loading what needs you">
                            <div className="t-list" aria-hidden="true">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="t-row min-h-[88px] gap-4 px-4 sm:gap-5 sm:px-6">
                                        <Skeleton width={40} height={32} />
                                        <span className="flex flex-1 flex-col gap-2">
                                            <Skeleton width="45%" height={16} />
                                            <Skeleton width="75%" height={12} />
                                        </span>
                                        <Skeleton width={176} height={40} className="hidden sm:block" />
                                    </div>
                                ))}
                            </div>
                        </Loading>
                    ) : priorities.length > 0 ? (
                        <div className="t-list">
                            {priorities.map(({ key, ...p }) => (
                                <PriorityRow key={key} {...p} />
                            ))}
                        </div>
                    ) : (
                        <p className="t-body flex min-h-16 items-center gap-2.5 px-4 py-4 sm:px-6">
                            <Dot tone="done" />
                            Nothing is waiting on you: no submission to review, no failed payout, no call without an outcome.
                        </p>
                    )}
                </section>

                {/* The website-link repair. Shown only while the check says one
                    is needed; it fills blanks on either side and never
                    overwrites a link that is already there. */}
                {isBackfillNeeded === true && (
                    <div className="flex flex-col items-start gap-3 rounded-r1-card border border-r1-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <p className="t-body flex items-start gap-2.5">
                            <Dot tone="attn" className="mt-1.5" />
                            Some live sites and their submissions disagree about the site link.
                        </p>
                        <Button size="sm" onClick={handleBackfill} disabled={backfilling} aria-busy={backfilling}>
                            {backfilling ? "Syncing…" : "Sync site links"}
                        </Button>
                    </div>
                )}

                <MoneyFold analytics={allAnalytics} hostinger={totalHostingerCosts} promo={promoStats} />

                <RecentSubmissions submissions={submissions} />
            </div>
        </>
    )
}

/** Today while the page's own auth check runs: the header, the line and the card, in shape. */
export function TodaySkeleton() {
    return (
        <Loading label="Loading Today" className="flex flex-col gap-6 lg:gap-8">
            <div className="flex flex-col gap-3" aria-hidden="true">
                <Skeleton width={140} height={36} />
                <Skeleton width={200} height={16} />
                <Skeleton width="60%" height={14} className="mt-1" />
            </div>
            <SkeletonRows count={3} className="max-w-[880px]" />
        </Loading>
    )
}

// ── What is waiting ────────────────────────────────────────────────────────

function possessive(name: string): string {
    return `${name}'s`
}

/**
 * The rows of the "Needs you" card, in the board's order: the review queue,
 * failed payouts, calls with no outcome. A row whose count would be 0 is not
 * built (kit: a card that would read 0 is cut).
 */
function buildPriorities({
    submissions,
    failed,
    inFlight,
    unanswered,
    windows,
}: {
    submissions: Submissions
    failed: Withdrawals
    inFlight: number
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

/** Who brought it in: the owner on a self-serve site, otherwise the creator. */
function byLine(s: Submission): string {
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
