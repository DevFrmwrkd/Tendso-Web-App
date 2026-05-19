"use client"

import { useState, useMemo } from "react"
import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { CheckCircle, AlertCircle, Clock, Loader2, Eye, X, Wallet } from "lucide-react"
import AdminLayout from "../components/AdminLayout"

/**
 * Payout Management — READ-ONLY transaction view.
 *
 * Displays every creator withdrawal pulled from the `withdrawals` table. The
 * actual withdrawal pipeline (creator triggers in mobile/web → Convex
 * `withdrawals.create` → Wise transfer → webhook flips status) is untouched.
 * Admins can only VIEW transactions here — no Mark Paid / Process / Approve
 * buttons. To inspect a transaction click "View" and a read-only modal opens.
 */

type WithdrawalStatus = 'all' | 'pending' | 'processing' | 'completed' | 'failed'

interface WithdrawalRecord {
    _id: string
    creatorId: string
    amount: number
    payoutMethod: string
    accountDetails: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    reference?: string
    wiseTransferId?: string
    wiseStatus?: string
    errorMessage?: string
    failureReason?: string
    transactionRef?: string
    createdAt: number
    processedAt?: number
    creatorName?: string
    creatorEmail?: string
}

const STATUS_TABS: Array<{ key: WithdrawalStatus; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'processing', label: 'Processing' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Failed' },
]

function statusPill(status: WithdrawalRecord['status']) {
    const map: Record<WithdrawalRecord['status'], { bg: string; text: string; Icon: typeof CheckCircle; label: string }> = {
        completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', Icon: CheckCircle, label: 'Completed' },
        processing: { bg: 'bg-blue-50', text: 'text-blue-700', Icon: Loader2, label: 'Processing' },
        pending: { bg: 'bg-amber-50', text: 'text-amber-700', Icon: Clock, label: 'Pending' },
        failed: { bg: 'bg-red-50', text: 'text-red-700', Icon: AlertCircle, label: 'Failed' },
    }
    return map[status]
}

export default function PayoutsPage() {
    const { user, isLoaded } = useUser()

    const currentCreator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    const isAdmin = currentCreator?.role === 'admin'

    // Single source of truth: every withdrawal, every status, newest first
    const withdrawals = useQuery(
        api.withdrawals.getAll,
        isAdmin ? {} : "skip"
    ) as WithdrawalRecord[] | undefined

    const loading = !isLoaded || (user && currentCreator === undefined) || (isAdmin && withdrawals === undefined)

    const [statusFilter, setStatusFilter] = useState<WithdrawalStatus>('all')
    const [selected, setSelected] = useState<WithdrawalRecord | null>(null)

    // Stats derived locally (no mutation, no extra round-trip)
    const stats = useMemo(() => {
        if (!withdrawals) return { totalCompleted: 0, totalAmount: 0, pendingCount: 0, failedCount: 0, weekAmount: 0 }

        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        let totalCompleted = 0
        let totalAmount = 0
        let pendingCount = 0
        let failedCount = 0
        let weekAmount = 0

        for (const w of withdrawals) {
            if (w.status === 'completed') {
                totalCompleted++
                totalAmount += w.amount
                if ((w.processedAt || w.createdAt) >= oneWeekAgo) weekAmount += w.amount
            } else if (w.status === 'pending' || w.status === 'processing') {
                pendingCount++
            } else if (w.status === 'failed') {
                failedCount++
            }
        }

        return { totalCompleted, totalAmount, pendingCount, failedCount, weekAmount }
    }, [withdrawals])

    // Status counts for the filter pill badges
    const statusCounts = useMemo(() => {
        const counts: Record<WithdrawalStatus, number> = { all: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
        if (!withdrawals) return counts
        counts.all = withdrawals.length
        for (const w of withdrawals) counts[w.status] = (counts[w.status] || 0) + 1
        return counts
    }, [withdrawals])

    const filtered = useMemo(() => {
        if (!withdrawals) return []
        if (statusFilter === 'all') return withdrawals
        return withdrawals.filter((w) => w.status === statusFilter)
    }, [withdrawals, statusFilter])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    if (!isAdmin) return null

    return (
        <AdminLayout>
            {/* Page Title */}
            <div className="mb-6 lg:mb-8">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Payout Management</h1>
                <p className="text-sm text-gray-500 mt-1">
                    View-only ledger of creator withdrawal transactions. Withdrawals are processed automatically via the Wise pipeline.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 lg:mb-8">
                <StatCard
                    label="Completed (week)"
                    value={`₱${stats.weekAmount.toLocaleString()}`}
                    sub={`${stats.totalCompleted} all-time`}
                    accent="emerald"
                />
                <StatCard
                    label="Total paid out"
                    value={`₱${stats.totalAmount.toLocaleString()}`}
                    sub="across all creators"
                    accent="emerald"
                />
                <StatCard
                    label="In progress"
                    value={String(stats.pendingCount)}
                    sub="pending + processing"
                    accent="amber"
                />
                <StatCard
                    label="Failed"
                    value={String(stats.failedCount)}
                    sub="needs attention"
                    accent="red"
                />
            </div>

            {/* Filter Tabs */}
            <div className="bg-white rounded-2xl border border-emerald-500 shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
                <div className="flex gap-2 flex-wrap">
                    {STATUS_TABS.map((tab) => {
                        const active = statusFilter === tab.key
                        const count = statusCounts[tab.key]
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors inline-flex items-center gap-2 ${active
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {tab.label}
                                {count > 0 && (
                                    <span
                                        className={`px-2 py-0.5 text-xs rounded-full ${active ? 'bg-white/25 text-white' : 'bg-white text-gray-600 border border-gray-200'
                                            }`}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-emerald-500 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Creator</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Method</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Reference</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Requested</th>
                                <th className="px-6 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">View</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-sm text-gray-400">
                                        <Wallet className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                        {statusFilter === 'all'
                                            ? 'No withdrawal transactions yet.'
                                            : `No ${statusFilter} withdrawals.`}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((w) => {
                                    const pill = statusPill(w.status)
                                    return (
                                        <tr key={w._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                                                        <span className="text-xs font-bold text-green-700">
                                                            {(w.creatorName || '?').split(' ').map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase() || '?'}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{w.creatorName || 'Unknown'}</p>
                                                        <p className="text-xs text-gray-500 truncate">{w.creatorEmail || '—'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-base font-bold text-green-600">
                                                    ₱{w.amount.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-900 capitalize">
                                                    {w.payoutMethod?.replace(/_/g, ' ') || '—'}
                                                </p>
                                                <p className="text-xs text-gray-500 font-mono truncate max-w-[180px]">
                                                    {w.accountDetails || '—'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${pill.bg} ${pill.text}`}>
                                                    <pill.Icon className={`w-3.5 h-3.5 ${w.status === 'processing' ? 'animate-spin' : ''}`} />
                                                    {pill.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-mono text-gray-600 truncate max-w-[160px]">
                                                    {w.reference || w.wiseTransferId || w.transactionRef || '—'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setSelected(w)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t border-gray-100">
                    <p className="text-xs sm:text-sm text-gray-500">
                        Showing {filtered.length} of {withdrawals?.length || 0} transactions
                    </p>
                </div>
            </div>

            {/* Read-only detail modal */}
            {selected && <TransactionDetailModal w={selected} onClose={() => setSelected(null)} />}
        </AdminLayout>
    )
}

function StatCard({
    label,
    value,
    sub,
    accent,
}: {
    label: string
    value: string
    sub: string
    accent: 'emerald' | 'amber' | 'red'
}) {
    const accentMap: Record<typeof accent, string> = {
        emerald: 'text-green-600',
        amber: 'text-amber-600',
        red: 'text-red-600',
    }
    return (
        <div className="bg-white rounded-2xl p-5 border border-emerald-500 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
            <p className={`text-3xl font-bold ${accentMap[accent]}`}>{value}</p>
            <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
        </div>
    )
}

function TransactionDetailModal({ w, onClose }: { w: WithdrawalRecord; onClose: () => void }) {
    const pill = statusPill(w.status)
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-6 flex items-center justify-between">
                    <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wider text-emerald-100">Transaction</p>
                        <p className="text-lg font-bold truncate">{w.reference || w.wiseTransferId || w._id}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0 ml-3"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <Section title="Creator">
                        <Field label="Name" value={w.creatorName || 'Unknown'} />
                        <Field label="Email" value={w.creatorEmail || '—'} />
                    </Section>

                    <Section title="Transaction">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                                <p className="text-xs text-gray-600 mb-1">Amount</p>
                                <p className="text-2xl font-bold text-green-700">₱{w.amount.toLocaleString()}</p>
                            </div>
                            <div className={`p-4 rounded-xl border ${pill.bg} ${pill.text} border-current/30`}>
                                <p className="text-xs text-gray-600 mb-1">Status</p>
                                <p className={`text-lg font-semibold ${pill.text} inline-flex items-center gap-1.5`}>
                                    <pill.Icon className={`w-5 h-5 ${w.status === 'processing' ? 'animate-spin' : ''}`} />
                                    {pill.label}
                                </p>
                            </div>
                        </div>
                    </Section>

                    <Section title="Payout method">
                        <Field label="Method" value={(w.payoutMethod || '—').replace(/_/g, ' ').toUpperCase()} />
                        <Field label="Account details" value={w.accountDetails || '—'} mono />
                    </Section>

                    {(w.wiseTransferId || w.wiseStatus) && (
                        <Section title="Wise transfer">
                            {w.wiseTransferId && <Field label="Transfer ID" value={w.wiseTransferId} mono />}
                            {w.wiseStatus && <Field label="Wise status" value={w.wiseStatus} />}
                            {w.transactionRef && <Field label="Webhook ref" value={w.transactionRef} mono />}
                        </Section>
                    )}

                    {(w.errorMessage || w.failureReason) && (
                        <Section title="Error">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                                {w.errorMessage || w.failureReason}
                            </div>
                        </Section>
                    )}

                    <Section title="Timeline">
                        <Field
                            label="Created"
                            value={new Date(w.createdAt).toLocaleString()}
                        />
                        {w.processedAt && (
                            <Field
                                label="Processed"
                                value={new Date(w.processedAt).toLocaleString()}
                            />
                        )}
                    </Section>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-xs text-gray-500">Read-only view. Pipeline is handled by Wise + webhooks.</p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-semibold text-sm transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-2">{title}</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">{children}</div>
        </div>
    )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <p className="text-xs text-gray-500 shrink-0">{label}</p>
            <p
                className={`text-sm text-gray-900 break-all ${mono ? 'font-mono text-xs bg-white border border-gray-200 rounded px-2 py-1' : 'font-medium'
                    }`}
            >
                {value}
            </p>
        </div>
    )
}
