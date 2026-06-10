"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Input } from "@/components/ui/input"
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
import { motion, AnimatePresence } from "framer-motion"
import AdminLayout from "./components/AdminLayout"
import { 
    Search, 
    Filter, 
    ArrowUpDown, 
    MoreVertical, 
    Eye, 
    Trash2, 
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

function getInitials(name: string) {
    return name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
}

export default function AdminDashboard() {
    const router = useRouter()
    const { isAdmin, loading: authLoading } = useAdminAuth()
    const { submissions, loading: submissionsLoading } = useSubmissions()
    const [searchQuery, setSearchQuery] = useState("")
    const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "az" | "za" | "status" | "highest_payout">("newest")
    const [showSortDropdown, setShowSortDropdown] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 5
    const [backfilling, setBackfilling] = useState(false)
    const [backfillResult, setBackfillResult] = useState<{ updatedSubmissions: number; updatedWebsites: number } | null>(null)
    // Safely handle checkBackfillNeeded query with error fallback
    const isBackfillNeeded = useQuery(api.admin.checkBackfillNeeded) ?? false
    const backfillWebsiteUrls = useMutation(api.admin.backfillWebsiteUrls)

    // Delete submission state
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
    const [deleteTargetName, setDeleteTargetName] = useState("")
    const [deleting, setDeleting] = useState(false)
    const [deleteResult, setDeleteResult] = useState<{ type: "success" | "error"; message: string } | null>(null)

    // Analytics data
    const allAnalytics = useQuery(api.analytics.getAllAnalytics, {})
    // Hostinger custom-domain fees the platform paid (deducted from gross earnings)
    const totalHostingerCosts = useQuery(api.domains.getTotalHostingerDomainCostsPHP, {})

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

    const handleDeleteSubmission = async () => {
        if (!deleteTargetId) return
        setDeleting(true)
        try {
            const response = await fetch("/api/delete-submission", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId: deleteTargetId }),
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || "Failed to delete submission")
            }
            setDeleteResult({ type: "success", message: `"${deleteTargetName}" deleted successfully.` })
        } catch (error: any) {
            setDeleteResult({ type: "error", message: error.message || "Failed to delete submission." })
        } finally {
            setDeleting(false)
            setShowDeleteModal(false)
            setDeleteTargetId(null)
        }
    }

    // Status order for sorting
    const statusOrder: Record<string, number> = {
        submitted: 0, in_review: 1, draft: 2, approved: 3, website_generated: 4,
        deployed: 5, pending_payment: 6, paid: 7, completed: 8, rejected: 9, unpublished: 10,
    }

    // Filter by stat card + search + sort
    const filteredSubmissions = useMemo(() => {
        let result = [...submissions]

        if (activeFilter === "pending") {
            result = result.filter((s) => ["draft", "submitted", "in_review"].includes(s.status))
        } else if (activeFilter === "approved") {
            result = result.filter((s) => ["approved", "deployed", "pending_payment", "paid", "completed", "website_generated"].includes(s.status))
        } else if (activeFilter === "rejected") {
            result = result.filter((s) => s.status === "rejected")
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            result = result.filter(
                (s) =>
                    s.business_name.toLowerCase().includes(query) ||
                    s.owner_name.toLowerCase().includes(query) ||
                    s.business_type.toLowerCase().includes(query)
            )
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case "newest": return b.created_at - a.created_at
                case "oldest": return a.created_at - b.created_at
                case "az": return a.business_name.localeCompare(b.business_name)
                case "za": return b.business_name.localeCompare(a.business_name)
                case "status": return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
                case "highest_payout": return (b.creator_payout || 0) - (a.creator_payout || 0)
                default: return 0
            }
        })

        return result
    }, [submissions, activeFilter, searchQuery, sortBy])

    // Pagination
    const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage)
    const paginatedSubmissions = filteredSubmissions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    useMemo(() => {
        setCurrentPage(1)
    }, [searchQuery, activeFilter, sortBy])

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

    // Net earnings = gross minus Hostinger custom-domain fees the platform paid
    const hostingerCosts = totalHostingerCosts ?? 0
    const totalEarnings = Math.max(0, grossEarnings - hostingerCosts)

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

    if (authLoading || submissionsLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
        )
    }

    if (!isAdmin) return null

    // Pagination display logic
    const getPageNumbers = () => {
        const pages: (number | string)[] = []
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
        } else {
            pages.push(1, 2, 3)
            if (currentPage > 4) pages.push("...")
            if (currentPage > 3 && currentPage < totalPages - 2) pages.push(currentPage)
            if (currentPage < totalPages - 3) pages.push("...")
            pages.push(totalPages)
        }
        return [...new Set(pages)]
    }

    return (
        <AdminLayout>
            {/* Delete Result Banner */}
            {deleteResult && (
                <div className={`-mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-6 border-b ${deleteResult.type === "success" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                    <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                        <p className={`text-sm font-medium ${deleteResult.type === "success" ? "text-amber-800" : "text-red-800"}`}>
                            {deleteResult.message}
                        </p>
                        <button onClick={() => setDeleteResult(null)} className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Delete &ldquo;{deleteTargetName}&rdquo;</h3>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                            <p className="text-sm font-semibold text-red-800 mb-2">This action is permanent and cannot be undone:</p>
                            <ul className="text-sm text-red-700 space-y-1">
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>Business submission record</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>Generated website &amp; content</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>All media files (images, audio, video)</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>Cloudflare Pages deployment &amp; Airtable record</li>
                            </ul>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null) }} disabled={deleting} className="flex-1 py-2.5 px-4 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 text-sm">Cancel</button>
                            <button onClick={handleDeleteSubmission} disabled={deleting} className="flex-1 py-2.5 px-4 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 text-sm">
                                {deleting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Processing...
                                    </span>
                                ) : "Delete Permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Title — editorial */}
            <div className="mb-8 lg:mb-10">
                <div className="ed-eyebrow mb-3">Dashboard · Submissions Overview</div>
                <h1 className="ed-display-md" style={{ color: "var(--ed-ink)" }}>
                    Manage <em style={{ color: "var(--ed-accent)" }}>business applications</em>.
                </h1>
                <p
                    className="ed-body mt-3"
                    style={{ color: "var(--ed-ink-2)", maxWidth: "60ch" }}
                >
                    Review submissions, watch revenue, and approve creators across the platform.
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
                    {hostingerCosts > 0 && (
                        <p className="text-[10px] font-medium text-gray-400 mt-2">
                            Gross ₱{grossEarnings.toLocaleString()} − Hostinger ₱{hostingerCosts.toLocaleString()}
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
                    {isBackfillNeeded === true && (
                        <button
                            onClick={handleBackfill}
                            disabled={backfilling}
                            className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                        >
                            {backfilling ? "Running..." : "Run Backfill"}
                        </button>
                    )}
                </div>
            )}

            {/* Search + Sort */}
            <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by business, owner, or category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 h-12 bg-white border-gray-100 rounded-2xl text-sm font-medium focus:ring-amber-100 focus:border-amber-400 transition-all shadow-sm"
                    />
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group/sort">
                        <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            className="flex items-center gap-2.5 px-5 h-12 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-700 hover:border-amber-400 transition-all shadow-sm whitespace-nowrap"
                        >
                            <ArrowUpDown size={16} className="text-gray-400 group-hover/sort:text-amber-500 transition-colors" />
                            <span>Sort By</span>
                            <div className={`w-1.5 h-1.5 rounded-full bg-amber-500 transition-all ${sortBy !== "newest" ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} />
                        </button>
                        <AnimatePresence>
                            {showSortDropdown && (
                                <>
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 z-10" 
                                        onClick={() => setShowSortDropdown(false)} 
                                    />
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-[22px] shadow-2xl z-20 overflow-hidden p-1.5"
                                    >
                                        {([
                                            { key: "newest", label: "Newest First" },
                                            { key: "oldest", label: "Oldest First" },
                                            { key: "az", label: "A - Z (Name)" },
                                            { key: "za", label: "Z - A (Name)" },
                                            { key: "status", label: "Workflow Status" },
                                            { key: "highest_payout", label: "Highest Payout" },
                                        ] as const).map((option) => (
                                            <button
                                                key={option.key}
                                                onClick={() => { setSortBy(option.key); setShowSortDropdown(false) }}
                                                className={`
                                                    w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-tight rounded-xl transition-all
                                                    ${sortBy === option.key
                                                        ? "bg-amber-50 text-amber-700"
                                                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}
                                                `}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Submissions Table */}
            <div className="bg-white rounded-2xl border border-amber-500 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Business Entity</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Owner Representative</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Workflow Status</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Creator</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Submission Date</th>
                                <th className="px-6 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pr-10">Management</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedSubmissions.length === 0 ? (
                                <tr key="empty">
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="text-gray-200 w-10 h-10 mb-2" strokeWidth={1} />
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                                                {searchQuery ? "No entries match search" : "No entries found"}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedSubmissions.map((submission: any, idx: number) => {
                                    const badge = getStatusBadge(submission.status)
                                    return (
                                        <tr 
                                            key={submission.id} 
                                            className="border-b border-gray-50 hover:bg-gray-50/80 transition-all cursor-pointer group" 
                                            onClick={() => router.push(`/admin/submissions/${submission.id}`)}
                                        >
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-gray-900 group-hover:text-amber-600 transition-colors uppercase tracking-tight">{submission.business_name}</span>
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{submission.business_type}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500 uppercase border border-white shadow-sm">
                                                            {submission.owner_name[0]}
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-600">{submission.owner_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col">
                                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight w-fit ${badge.bg} ${badge.text}`}>
                                                            <span className={`w-1 h-1 rounded-full bg-current ${submission.status === 'submitted' ? 'animate-pulse' : ''}`} />
                                                            {badge.label}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                                            {submission.creators 
                                                                ? `${submission.creators.first_name} ${submission.creators.last_name}`.trim() 
                                                                : "Unknown Creator"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2 text-gray-400 font-bold text-[11px] uppercase tracking-tighter">
                                                        <Calendar size={12} strokeWidth={2.5} />
                                                        {new Date(submission.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link
                                                            href={`/admin/submissions/${submission.id}`}
                                                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                        >
                                                            <ArrowRight size={18} />
                                                        </Link>
                                                        <button
                                                            onClick={() => {
                                                                setDeleteTargetId(submission.id)
                                                                setDeleteTargetName(submission.business_name)
                                                                setShowDeleteModal(true)
                                                            }}
                                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100">
                        <p className="text-xs sm:text-sm text-gray-500">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                            {Math.min(currentPage * itemsPerPage, filteredSubmissions.length)} of{" "}
                            {filteredSubmissions.length.toLocaleString()} results
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            {getPageNumbers().map((page, i) =>
                                page === "..." ? (
                                    <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-sm text-gray-400">...</span>
                                ) : (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page as number)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                                            currentPage === page
                                                ? "bg-amber-500 text-white"
                                                : "text-gray-600 hover:bg-gray-100"
                                        }`}
                                    >
                                        {page}
                                    </button>
                                )
                            )}
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
