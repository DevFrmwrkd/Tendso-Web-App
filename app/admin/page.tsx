"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAdminAuth, useSubmissions } from "@/hooks/useAdmin"
import {
    Chart,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js"
import { Line } from "react-chartjs-2"
import { motion } from "framer-motion"
import AdminLayout from "./components/AdminLayout"
import StaffDashboard from "./_components/StaffDashboard"
import {
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Calendar,
    ArrowRight
} from "lucide-react"

Chart.register(
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
)

export default function AdminDashboard() {
    const { isAdmin, loading: authLoading, creator } = useAdminAuth()
    const { submissions, loading: submissionsLoading } = useSubmissions()
    const [backfilling, setBackfilling] = useState(false)
    const [backfillResult, setBackfillResult] = useState<{ updatedSubmissions: number; updatedWebsites: number } | null>(null)
    // Safely handle checkBackfillNeeded query with error fallback
    const isBackfillNeeded = useQuery(api.admin.checkBackfillNeeded) ?? false
    const backfillWebsiteUrls = useMutation(api.admin.backfillWebsiteUrls)

    // Analytics data
    const allAnalytics = useQuery(api.analytics.getAllAnalytics, {})
    // Hostinger custom-domain fees the platform paid (deducted from gross earnings)
    const totalHostingerCosts = useQuery(api.domains.getTotalHostingerDomainCostsPHP, {})
    const promoStats = useQuery(api.admin.getPromoStats, {})

    const handleBackfill = async () => {
        setBackfilling(true)
        setBackfillResult(null)
        try {
            const result = await backfillWebsiteUrls({})
            setBackfillResult(result)
        } finally {
            setBackfilling(false)
        }
    }

    // The five most recent submissions — a glance, not a workbench. The full
    // list, with its filters, search, sort and paging, lives at
    // /admin/submissions; keeping a second copy here is how the two drift.
    const recentSubmissions = useMemo(
        () => [...submissions].sort((a, b) => b.created_at - a.created_at).slice(0, 5),
        [submissions]
    )

    // Needs attention items
    const needsAttention = submissions.filter((s: any) => s.status === "submitted" || s.status === "in_review")

    // Stats
    const pendingCount = submissions.filter((s: any) => ["draft", "submitted", "in_review"].includes(s.status)).length
    const approvedCount = submissions.filter((s: any) => ["approved", "deployed", "pending_payment", "paid", "completed", "website_generated"].includes(s.status)).length
    const rejectedCount = submissions.filter((s: any) => s.status === "rejected").length
    const successRate = submissions.length > 0 ? Math.round((approvedCount / submissions.length) * 100) : 0
    const rejectionRate = submissions.length > 0 ? Math.round((rejectedCount / submissions.length) * 100) : 0
    const reviewedCount = approvedCount + rejectedCount

    // ==================== EARNINGS ANALYTICS ====================

    const earningsTimeSeries = useMemo(() => {
        if (!allAnalytics) return []
        const daily = allAnalytics.filter((r: any) => r.periodType === "daily")
        const source = daily.length > 0 ? daily : allAnalytics.filter((r: any) => r.periodType === "monthly")
        const byPeriod: Record<string, number> = {}
        for (const r of source) {
            byPeriod[r.period] = (byPeriod[r.period] ?? 0) + r.earningsTotal
        }
        return Object.entries(byPeriod)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, earnings]) => ({ period, earnings }))
    }, [allAnalytics])

    // Gross earnings across all time (sum of creator payouts before fees)
    const grossEarnings = useMemo(() => {
        if (!allAnalytics) return 0
        // Use monthly to avoid double-counting (monthly aggregates daily)
        const monthly = allAnalytics.filter((r: any) => r.periodType === "monthly")
        if (monthly.length > 0) {
            return monthly.reduce((sum: number, r: any) => sum + (r.earningsTotal || 0), 0)
        }
        // Fallback to daily if no monthly data
        const daily = allAnalytics.filter((r: any) => r.periodType === "daily")
        return daily.reduce((sum: number, r: any) => sum + (r.earningsTotal || 0), 0)
    }, [allAnalytics])

    // Net earnings = gross minus Hostinger custom-domain fees the platform paid,
    // minus the promo. `grossEarnings` sums the analytics earningsTotal rows,
    // which are written for EVERY credited submission — including sites given
    // away free, where the creator's payout is real but the ₱0 collected is not
    // revenue. Left in, each free site would inflate this tile by the payout it
    // actually cost. Subtracted, the same way Hostinger fees already are.
    const hostingerCosts = totalHostingerCosts ?? 0
    const promoCosts = promoStats?.compedPayoutTotal ?? 0
    const totalEarnings = Math.max(0, grossEarnings - hostingerCosts - promoCosts)

    const earningsChartData = {
        labels: earningsTimeSeries.map((r) => {
            const d = new Date(r.period + "T00:00:00")
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        }),
        datasets: [
            {
                label: "Revenue",
                data: earningsTimeSeries.map((r) => r.earnings),
                borderColor: "rgb(34, 197, 94)",
                backgroundColor: "rgba(34, 197, 94, 0.08)",
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: "rgb(34, 197, 94)",
            },
        ],
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "white",
                titleColor: "#111827",
                bodyColor: "#111827",
                borderColor: "#e5e7eb",
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: (ctx: any) => `₱${ctx.parsed.y.toLocaleString()}`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: "#9ca3af", font: { size: 11 } },
                border: { display: false },
            },
            y: {
                beginAtZero: true,
                grid: { color: "#f3f4f6" },
                ticks: {
                    color: "#9ca3af",
                    font: { size: 11 },
                    callback: (val: any) => `₱${(val / 1000).toFixed(val >= 1000 ? 1 : 0)}K`,
                },
                border: { display: false },
            },
        },
    }

    const hasEarningsData = earningsTimeSeries.length > 0

    const getStatusBadge = (status: string) => {
        const config: Record<string, { bg: string; text: string; label: string }> = {
            draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
            submitted: { bg: "bg-blue-50", text: "text-blue-700", label: "Submitted" },
            in_review: { bg: "bg-amber-50", text: "text-amber-700", label: "In Review" },
            approved: { bg: "bg-amber-50", text: "text-amber-700", label: "Approved" },
            rejected: { bg: "bg-red-50", text: "text-red-700", label: "Rejected" },
            deployed: { bg: "bg-cyan-50", text: "text-cyan-700", label: "Deployed" },
            pending_payment: { bg: "bg-orange-50", text: "text-orange-700", label: "Pending Payment" },
            paid: { bg: "bg-amber-50", text: "text-amber-700", label: "Paid" },
            unpublished: { bg: "bg-rose-50", text: "text-rose-700", label: "Unpublished" },
            completed: { bg: "bg-amber-50", text: "text-amber-700", label: "Completed" },
            website_generated: { bg: "bg-teal-50", text: "text-teal-700", label: "Generated" },
        }
        return config[status] || { bg: "bg-gray-100", text: "text-gray-700", label: status }
    }

    // The internal 'staff' role lands here like everyone else, and gets the
    // one view its job needs instead of an empty admin dashboard. Placed after
    // every hook above so the hook order never changes between renders; those
    // hooks fetch nothing for a non-admin, they are all gated on isAdmin.
    if (!authLoading && creator?.role === "staff") {
        return (
            <AdminLayout>
                <StaffDashboard firstName={creator.firstName ?? undefined} />
            </AdminLayout>
        )
    }

    if (authLoading || submissionsLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
        )
    }

    if (!isAdmin) return null

    return (
        <AdminLayout>
            {/* Page Title — editorial */}
            <div className="mb-8 lg:mb-10">
                <div className="ed-eyebrow mb-3">Dashboard · Platform Overview</div>
                <h1 className="ed-display-md" style={{ color: "var(--ed-ink)" }}>
                    The platform at a <em style={{ color: "var(--ed-accent)" }}>glance</em>.
                </h1>
                <p
                    className="ed-body mt-3"
                    style={{ color: "var(--ed-ink-2)", maxWidth: "60ch" }}
                >
                    Revenue, review load and the latest arrivals. The full queue — search, filters and
                    every business application — lives under Submissions.
                </p>
            </div>

            {/* Stats Cards (3 widgets, read-only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {/* Widget 1: Total Earnings */}
                <div className="relative overflow-hidden bg-white p-6 rounded-[24px] border border-amber-500 hover:shadow-xl hover:shadow-gray-200/40 hover:-translate-y-1 transition-all duration-300 group">
                    <div className="p-2.5 rounded-xl bg-amber-50/50 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                        <TrendingUp className="text-amber-600" size={20} />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Earnings (Net)</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-gray-900 tracking-tight">₱{totalEarnings.toLocaleString()}</p>
                        <span className="text-[10px] font-bold text-gray-400">All time</span>
                    </div>
                    {(hostingerCosts > 0 || promoCosts > 0) && (
                        <p className="text-[10px] font-medium text-gray-400 mt-2">
                            Gross ₱{grossEarnings.toLocaleString()}
                            {hostingerCosts > 0 && <> − Hostinger ₱{hostingerCosts.toLocaleString()}</>}
                            {promoCosts > 0 && (
                                <> − Promo ₱{promoCosts.toLocaleString()} ({promoStats?.compedCount} free)</>
                            )}
                        </p>
                    )}
                </div>

                {/* Widget 2: Submissions (total + pending review combined) */}
                <div className="relative overflow-hidden bg-white p-6 rounded-[24px] border border-amber-500 hover:shadow-xl hover:shadow-gray-200/40 hover:-translate-y-1 transition-all duration-300 group">
                    <div className="p-2.5 rounded-xl bg-blue-50/50 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                        <AlertCircle className="text-blue-600" size={20} />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Submissions</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-gray-900 tracking-tight">{submissions.length.toLocaleString()}</p>
                        <span className="text-[10px] font-bold text-amber-600">{pendingCount} pending review</span>
                    </div>
                    {pendingCount > 0 && (
                        <div className="absolute top-6 right-6 flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-full border border-red-100">
                            <span className="w-1 h-1 bg-red-500 rounded-full animate-ping" />
                            <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">Urgent</span>
                        </div>
                    )}
                </div>

                {/* Widget 3: Reviewed (accepted + rejected combined) */}
                <div className="relative overflow-hidden bg-white p-6 rounded-[24px] border border-amber-500 hover:shadow-xl hover:shadow-gray-200/40 hover:-translate-y-1 transition-all duration-300 group">
                    <div className="p-2.5 rounded-xl bg-amber-50/50 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                        <CheckCircle2 className="text-amber-600" size={20} />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Reviewed</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-gray-900 tracking-tight">{reviewedCount.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-bold">
                        <span className="text-amber-600 flex items-center gap-1">
                            <CheckCircle2 size={11} /> {approvedCount} approved
                        </span>
                        <span className="text-red-600 flex items-center gap-1">
                            <XCircle size={11} /> {rejectedCount} rejected
                        </span>
                    </div>
                </div>
            </div>

            {/* Earnings Chart Section */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[32px] border border-amber-500 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 sm:p-8 mb-8 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50/30 blur-[100px] -mr-32 -mt-32 rounded-full pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Revenue Analytics</h3>
                        </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.1em]">Performance overview &bull; Last 30 days</p>
                    </div>
                    <div className="flex items-center gap-6 px-5 py-2.5 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Gross Revenue</span>
                        </div>
                    </div>
                </div>
                
                <div className="h-72 w-full relative z-10">
                    {hasEarningsData ? (
                        <Line data={earningsChartData} options={chartOptions} />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <TrendingUp className="text-gray-100 w-16 h-16 mb-2" strokeWidth={1} />
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No revenue data available</p>
                            <p className="text-[10px] text-gray-300 mt-1 max-w-[200px]">Revenue will be tracked once creators start earning from approved submissions.</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Needs Attention + Backfill Row */}
            {needsAttention.length > 0 && (
                <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-amber-900">
                                {needsAttention.length} submission{needsAttention.length !== 1 ? "s" : ""} need{needsAttention.length === 1 ? "s" : ""} your attention
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Pending reviews require immediate action to maintain SLA.
                            </p>
                            {backfillResult && (
                                <p className="text-xs text-amber-700 mt-1">
                                    Backfill done: {backfillResult.updatedSubmissions} submission(s), {backfillResult.updatedWebsites} website(s) updated.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {isBackfillNeeded === true && (
                            <button
                                onClick={handleBackfill}
                                disabled={backfilling}
                                className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {backfilling ? "Running..." : "Run Backfill"}
                            </button>
                        )}
                        {/* Straight into the review queue, pre-filtered. */}
                        <Link
                            href="/admin/submissions?status=review"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-900 bg-white border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors"
                        >
                            Review now
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            )}

            {/* Recent Submissions — a glance at the queue. The workbench (search,
                filters, sort, paging, delete) is the dedicated /admin/submissions page. */}
            <div className="bg-white rounded-2xl border border-amber-500 shadow-sm overflow-hidden">
                <div className="px-5 sm:px-6 py-5 flex items-center justify-between gap-4 border-b border-gray-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">Recent Submissions</h3>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mt-1">
                            Latest {Math.min(5, submissions.length)} of {submissions.length.toLocaleString()}
                        </p>
                    </div>
                    <Link
                        href="/admin/submissions"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-tight text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors whitespace-nowrap"
                    >
                        View all
                        <ArrowRight size={14} />
                    </Link>
                </div>

                {recentSubmissions.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No submissions yet</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-50">
                        {recentSubmissions.map((submission) => {
                            const badge = getStatusBadge(submission.status)
                            return (
                                <li key={submission.id}>
                                    <Link
                                        href={`/admin/submissions/${submission.id}`}
                                        className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 hover:bg-gray-50/80 transition-colors group"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-900 group-hover:text-amber-600 transition-colors uppercase tracking-tight truncate">
                                                {submission.business_name}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                                                {submission.business_type} &bull; {submission.owner_name}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${badge.bg} ${badge.text}`}>
                                                <span className={`w-1 h-1 rounded-full bg-current ${submission.status === 'submitted' ? 'animate-pulse' : ''}`} />
                                                {badge.label}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-gray-400 font-bold text-[11px] uppercase tracking-tighter">
                                                <Calendar size={12} strokeWidth={2.5} />
                                                {new Date(submission.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </div>
                                        </div>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </AdminLayout>
    )
}
