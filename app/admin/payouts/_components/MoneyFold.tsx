"use client"

import { useQuery } from "convex/react"
import { ChevronDown } from "lucide-react"
import dynamic from "next/dynamic"
import { useId, useMemo, useState, type ReactNode } from "react"

import { formatMoney, Icon, Loading, MoneyLine, MoneyLines, Segmented, Skeleton } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { ledgerSummary, monthlyEarnings, monthLabel, monthOf, type Withdrawal } from "../_lib/model"
import { Boundary } from "./Boundary"
import type { ChartPoint } from "./RevenueChart"

// chart.js is only fetched when the fold opens. The skeleton is the chart's own size.
const RevenueChart = dynamic(() => import("./RevenueChart"), {
    ssr: false,
    loading: () => <Skeleton height={256} className="w-full" />,
})

/*
 * The money summary (board Payouts): the old dashboard's revenue tile and
 * revenue chart, moved here (README scope: "Revenue chart → moved to the money
 * fold on Payouts"). Closed by default, like every fold.
 *
 * Its three queries (analytics, Hostinger costs, promo) used to run on every
 * /admin load. Here they run only once the fold is first opened: the content
 * mounts then, which is why this is not the shared <Fold> (that one mounts
 * its content while closed, hidden). Same classes, same button, same
 * behaviour.
 */
export function MoneyFold({ adminId, rows, now }: { adminId: string | null; rows: Withdrawal[]; now: number }) {
    return (
        <LazyFold label="Money summary" meta="Gross, costs and net revenue, all-time">
            <Boundary what="Money summary">
                <MoneyBody adminId={adminId} rows={rows} now={now} />
            </Boundary>
        </LazyFold>
    )
}

function LazyFold({ label, meta, children }: { label: string; meta: string; children: ReactNode }) {
    const [open, setOpen] = useState(false)
    // Mounted on the first open and kept: closing and reopening does not reload it.
    const [mounted, setMounted] = useState(false)
    const id = useId()
    const toggle = () => {
        setMounted(true)
        setOpen((o) => !o)
    }
    return (
        <section className="t-fold" aria-label={label}>
            <button type="button" className="t-fold-btn" aria-expanded={open} aria-controls={id} onClick={toggle}>
                <span className="flex min-w-0 items-baseline gap-3">
                    <span>{label}</span>
                    {/* One line on a phone: the fold button is a fixed 52px. */}
                    <span className="t-meta hidden min-w-0 truncate font-normal sm:block">{meta}</span>
                </span>
                <span className="t-fold-chev">
                    <Icon icon={ChevronDown} />
                </span>
            </button>
            <div className="t-fold-in" id={id} hidden={!open}>
                {mounted && children}
            </div>
        </section>
    )
}

function MoneyBody({ adminId, rows, now }: { adminId: string | null; rows: Withdrawal[]; now: number }) {
    // The same three queries, with the same arguments, the old /admin page read.
    const analytics = useQuery(api.analytics.getAllAnalytics, adminId ? {} : "skip")
    // Hostinger custom-domain fees the platform paid (deducted from gross earnings).
    const hostinger = useQuery(api.domains.getTotalHostingerDomainCostsPHP, adminId ? {} : "skip")
    const promo = useQuery(api.admin.getPromoStats, adminId ? {} : "skip")
    const [view, setView] = useState<"chart" | "table">("chart")

    const months = useMemo(() => monthlyEarnings(analytics ?? []), [analytics])
    const ledger = useMemo(() => ledgerSummary(rows, now), [rows, now])

    if (analytics === undefined || hostinger === undefined || promo === undefined) {
        return (
            <Loading label="Loading the money summary" className="flex flex-col gap-6 pb-2">
                <div className="flex max-w-[560px] flex-col gap-3">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex justify-between gap-6 py-1">
                            <Skeleton width="40%" height={12} />
                            <Skeleton width={64} height={12} />
                        </div>
                    ))}
                </div>
                <Skeleton height={256} className="w-full" />
            </Loading>
        )
    }

    // Gross: creator payouts credited on every paid or comped site, all-time
    // (the old dashboard's "Gross"; see monthlyEarnings for why the daily rows
    // are summed). Net takes off the Hostinger custom-domain fees the platform
    // paid and the promo: a free site's payout is real money out, and the ₱0
    // collected for it is not revenue. Left unfloored: if costs ever pass
    // gross, the summary says so (−₱300) rather than showing ₱0.
    const gross = months.reduce((sum, m) => sum + m.amount, 0)
    const promoCosts = promo.compedPayoutTotal ?? 0
    const net = gross - hostinger - promoCosts

    const thisMonth = monthOf(now)
    const spansYears = months.length > 0 && months[0].month.slice(0, 4) !== months[months.length - 1].month.slice(0, 4)
    const points: ChartPoint[] = months.map((m) => ({
        label: monthLabel(m.month, spansYears),
        long: `${monthLabel(m.month, true)}${m.month === thisMonth ? " (so far)" : ""}`,
        amount: m.amount,
    }))

    return (
        <div className="flex flex-col gap-6 pb-2">
            <MoneyLines className="max-w-[560px]">
                {/* Not "paid by owners" (the board's words): no query returns what
                    owners paid, and this figure is the creators' side of each sale. */}
                <MoneyLine label="Gross earnings" meta="Creator payouts credited per site, paid or free" amount={formatMoney(gross)} />
                {hostinger > 0 && <MoneyLine label="Hostinger domain costs" amount={formatMoney(hostinger, "debit")} />}
                {promoCosts > 0 && (
                    <MoneyLine
                        label={`Promo sites (${promo.compedCount} free)`}
                        amount={formatMoney(promoCosts, "debit")}
                    />
                )}
                <MoneyLine total label="Net revenue" amount={formatMoney(net)} />
                <MoneyLine
                    label="Paid out to creators"
                    meta={`${ledger.paidCount} ${ledger.paidCount === 1 ? "withdrawal" : "withdrawals"}, our ledger${ledger.paidWeek > 0 ? ` · ${formatMoney(ledger.paidWeek)} in the last 7 days` : ""}`}
                    amount={formatMoney(ledger.paidTotal)}
                />
            </MoneyLines>

            <section className="flex flex-col gap-3" aria-label="Gross earnings by month">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="t-h2 text-[14px]">Gross earnings by month</h3>
                    {points.length > 0 && (
                        <Segmented
                            label="Show earnings as"
                            options={[
                                { value: "chart", label: "Chart" },
                                { value: "table", label: "Table" },
                            ]}
                            value={view}
                            onChange={setView}
                        />
                    )}
                </div>
                {points.length === 0 ? (
                    <p className="t-meta flex h-32 items-center justify-center rounded-r1-card border border-r1-line px-4 text-center">
                        No earnings yet. This fills in once a creator is credited for a paid site.
                    </p>
                ) : view === "chart" ? (
                    <RevenueChart points={points} label="Gross earnings by month" />
                ) : (
                    <EarningsTable points={points} />
                )}
            </section>

            <p className="t-meta">Moved here from the old dashboard’s revenue chart. Amounts in PHP.</p>
        </div>
    )
}

/** The chart's table twin (every value readable without hovering), newest month first. */
function EarningsTable({ points }: { points: ChartPoint[] }) {
    return (
        <div className="max-h-64 overflow-auto rounded-r1-card border border-r1-line">
            <table className="w-full border-collapse text-left">
                <caption className="sr-only">Gross earnings by month</caption>
                <thead className="sticky top-0 bg-r1-fill-2">
                    <tr>
                        <th scope="col" className="t-label px-4 py-2">
                            Month
                        </th>
                        <th scope="col" className="t-label px-4 py-2 text-right">
                            Gross earnings
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {[...points].reverse().map((p) => (
                        <tr key={p.long} className="border-t border-r1-line-3">
                            <th scope="row" className="t-body px-4 py-2 font-normal">
                                {p.long}
                            </th>
                            <td className="t-body t-num px-4 py-2 text-right text-r1-ink">{formatMoney(p.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
