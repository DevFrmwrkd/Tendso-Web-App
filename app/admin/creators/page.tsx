"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Input } from "@/components/ui/input"
import AdminLayout from "../components/AdminLayout"

type CreatorStatus = 'pending' | 'active' | 'suspended' | 'deleted'

function getInitials(first: string, last: string) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

export default function CreatorsPage() {
    const router = useRouter()
    const { user, isLoaded } = useUser()

    const currentCreator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    const creators = useQuery(
        api.creators.getAllWithStats,
        currentCreator?.role === 'admin' ? {} : "skip"
    )

    const isAdmin = currentCreator?.role === 'admin'
    const loading = !isLoaded || (user && currentCreator === undefined) || (isAdmin && creators === undefined)

    // Filters
    const [statusFilter, setStatusFilter] = useState<CreatorStatus | 'all'>('all')
    const [roleFilter, setRoleFilter] = useState<'all' | 'creator' | 'admin'>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az' | 'za' | 'status' | 'most_submissions' | 'highest_earnings' | 'highest_balance'>('newest')
    const [showSortDropdown, setShowSortDropdown] = useState(false)

    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
    const [deleteTargetName, setDeleteTargetName] = useState("")
    const [deleteTargetSubmissions, setDeleteTargetSubmissions] = useState(0)
    const [deleting, setDeleting] = useState(false)
    const [deleteResult, setDeleteResult] = useState<{ type: "success" | "error"; message: string } | null>(null)

    const handleDeleteCreator = async () => {
        if (!deleteTargetId) return
        setDeleting(true)
        try {
            const response = await fetch('/api/delete-creator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creatorId: deleteTargetId }),
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to delete creator')
            }
            setDeleteResult({ type: "success", message: `"${deleteTargetName}" deleted successfully.` })
        } catch (error: any) {
            setDeleteResult({ type: "error", message: error.message || "Failed to delete creator." })
        } finally {
            setDeleting(false)
            setShowDeleteModal(false)
            setDeleteTargetId(null)
        }
    }

    // Status order for sorting
    const creatorStatusOrder: Record<string, number> = {
        active: 0, pending: 1, suspended: 2, deleted: 3,
    }

    // Filtered + sorted creators
    const filteredCreators = useMemo(() => {
        if (!creators) return []

        let result = creators.filter((creator: any) => {
            if (statusFilter !== 'all' && creator.status !== statusFilter) {
                return false
            }

            if (roleFilter !== 'all' && creator.role !== roleFilter) {
                return false
            }

            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                const fullName = `${creator.firstName} ${creator.lastName}`.toLowerCase()
                const email = (creator.email || '').toLowerCase()
                const phone = (creator.phone || '').toLowerCase()

                if (!fullName.includes(query) && !email.includes(query) && !phone.includes(query)) {
                    return false
                }
            }

            return true
        })

        // Sort
        result = [...result].sort((a, b) => {
            switch (sortBy) {
                case 'newest': return (b.createdAt || b._creationTime || 0) - (a.createdAt || a._creationTime || 0)
                case 'oldest': return (a.createdAt || a._creationTime || 0) - (b.createdAt || b._creationTime || 0)
                case 'az': return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
                case 'za': return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`)
                case 'status': return (creatorStatusOrder[a.status || 'pending'] ?? 99) - (creatorStatusOrder[b.status || 'pending'] ?? 99)
                case 'most_submissions': return (b.submissionCount || 0) - (a.submissionCount || 0)
                case 'highest_earnings': return (b.totalEarnings || 0) - (a.totalEarnings || 0)
                case 'highest_balance': return (b.balance || 0) - (a.balance || 0)
                default: return 0
            }
        })

        return result
    }, [creators, statusFilter, roleFilter, searchQuery, sortBy])

    // Stats
    const stats = useMemo(() => ({
        total: creators?.length || 0,
        active: creators?.filter((c: any) => c.status === 'active').length || 0,
        pending: creators?.filter((c: any) => c.status === 'pending').length || 0,
        suspended: creators?.filter((c: any) => c.status === 'suspended').length || 0,
    }), [creators])

    const getStatusBadge = (status: CreatorStatus | undefined) => {
        const safeStatus = status || 'pending'
        const config: Record<string, { bg: string; text: string }> = {
            active: { bg: 'bg-green-50', text: 'text-green-700' },
            pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
            suspended: { bg: 'bg-red-50', text: 'text-red-700' },
            deleted: { bg: 'bg-gray-50', text: 'text-gray-700' },
        }
        const style = config[safeStatus] || config.pending
        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${style.bg} ${style.text}`}>
                {safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)}
            </span>
        )
    }

    // Certification state — derived from quizPassedAt + certifiedAt + isDeleted.
    // Per DIAGNOSIS-APPROVAL.md "nice-to-have" §1.
    const getCertificationBadge = (creator: { quizPassedAt?: number; certifiedAt?: number; isDeleted?: boolean }) => {
        if (creator.isDeleted) {
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-600">
                    Deleted
                </span>
            )
        }
        if (creator.certifiedAt) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    Certified
                </span>
            )
        }
        if (creator.quizPassedAt) {
            return (
                <Link
                    href="/admin/pending-approvals"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                    title="Open the Pending Approval queue"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Pending approval
                </Link>
            )
        }
        return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-50 text-gray-500">
                Not started
            </span>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
        )
    }

    if (!isAdmin) return null

    return (
        <AdminLayout>
            {/* Delete Result Banner */}
            {deleteResult && (
                <div className={`-mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-6 border-b ${deleteResult.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                        <p className={`text-sm font-medium ${deleteResult.type === "success" ? "text-green-800" : "text-red-800"}`}>
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
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    Creator account &amp; Clerk authentication
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    All {deleteTargetSubmissions} submission{deleteTargetSubmissions !== 1 ? 's' : ''} &amp; generated websites
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    All media files (images, audio, video)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    Cloudflare deployments &amp; Airtable records
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                    Earnings, withdrawals &amp; referral records
                                </li>
                            </ul>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null) }} disabled={deleting} className="flex-1 py-2.5 px-4 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 text-sm">Cancel</button>
                            <button onClick={handleDeleteCreator} disabled={deleting} className="flex-1 py-2.5 px-4 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 text-sm">
                                {deleting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Deleting...
                                    </span>
                                ) : "Delete Permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Title */}
            <div className="mb-6 lg:mb-8">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Creator Management</h1>
                <p className="text-sm text-gray-500 mt-1">Manage platform creators and their accounts.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 lg:mb-8">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`bg-white rounded-2xl p-5 border shadow-sm text-left transition-all cursor-pointer ${statusFilter === 'all' ? "border-green-400 ring-2 ring-green-100" : "border-emerald-500 hover:border-emerald-600"}`}
                >
                    <p className="text-xs font-medium text-gray-500 mb-2">Total Creators</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </button>

                <button
                    onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                    className={`bg-white rounded-2xl p-5 border shadow-sm text-left transition-all cursor-pointer ${statusFilter === 'active' ? "border-green-400 ring-2 ring-green-100" : "border-emerald-500 hover:border-emerald-600"}`}
                >
                    <p className="text-xs font-medium text-gray-500 mb-2">Active</p>
                    <p className="text-3xl font-bold text-green-600">{stats.active}</p>
                </button>

                <button
                    onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                    className={`bg-white rounded-2xl p-5 border shadow-sm text-left transition-all cursor-pointer ${statusFilter === 'pending' ? "border-amber-400 ring-2 ring-amber-100" : "border-emerald-500 hover:border-emerald-600"}`}
                >
                    <p className="text-xs font-medium text-gray-500 mb-2">Pending</p>
                    <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
                </button>

                <button
                    onClick={() => setStatusFilter(statusFilter === 'suspended' ? 'all' : 'suspended')}
                    className={`bg-white rounded-2xl p-5 border shadow-sm text-left transition-all cursor-pointer ${statusFilter === 'suspended' ? "border-red-400 ring-2 ring-red-100" : "border-emerald-500 hover:border-emerald-600"}`}
                >
                    <p className="text-xs font-medium text-gray-500 mb-2">Suspended</p>
                    <p className="text-3xl font-bold text-red-600">{stats.suspended}</p>
                </button>
            </div>

            {/* Nav Filter + Search */}
            <div className="bg-white rounded-2xl border border-emerald-500 shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
                {/* Role Filter Tabs */}
                <div className="flex items-center gap-1 mb-4 border-b border-gray-100 pb-3">
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'creator', label: 'Creators' },
                        { key: 'admin', label: 'Admins' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setRoleFilter(tab.key as typeof roleFilter)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                roleFilter === tab.key
                                    ? 'bg-green-50 text-green-700'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search + Sort */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <Input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 border-gray-200 rounded-lg h-10 text-sm"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {/* Sort Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            className="flex items-center gap-2 px-3 py-2 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                        >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                            Sort
                            {sortBy !== 'newest' && (
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            )}
                        </button>
                        {showSortDropdown && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                                    {([
                                        { key: 'newest', label: 'Newest First' },
                                        { key: 'oldest', label: 'Oldest First' },
                                        { key: 'az', label: 'A - Z' },
                                        { key: 'za', label: 'Z - A' },
                                        { key: 'status', label: 'Status' },
                                        { key: 'most_submissions', label: 'Most Submissions' },
                                        { key: 'highest_earnings', label: 'Highest Earnings' },
                                        { key: 'highest_balance', label: 'Highest Balance' },
                                    ] as const).map((option) => (
                                        <button
                                            key={option.key}
                                            onClick={() => { setSortBy(option.key); setShowSortDropdown(false) }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                                sortBy === option.key
                                                    ? 'bg-green-50 text-green-700 font-medium'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Creators Table */}
            <div className="bg-white rounded-2xl border border-emerald-500 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Creator</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Certification</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Submissions</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Earnings</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Balance</th>
                                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCreators.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center text-sm text-gray-400">
                                        {searchQuery || statusFilter !== 'all' || roleFilter !== 'all'
                                            ? 'No creators match your filters'
                                            : 'No creators found'}
                                    </td>
                                </tr>
                            ) : (
                                filteredCreators.map((creator: any) => (
                                    <tr
                                        key={creator._id}
                                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/admin/creators/${creator._id}`)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-bold text-green-700">
                                                        {getInitials(creator.firstName, creator.lastName)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {creator.firstName} {creator.middleName ? `${creator.middleName} ` : ''}{creator.lastName}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {creator.role === 'admin' ? 'Admin' : 'Creator'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-900">{creator.email || '\u2014'}</p>
                                            <p className="text-xs text-gray-500">{creator.phone || '\u2014'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(creator.status)}
                                        </td>
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            {getCertificationBadge(creator)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
                                                {creator.submissionCount || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            ₱{(creator.totalEarnings || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            ₱{(creator.balance || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/admin/creators/${creator._id}`}
                                                    className="text-gray-400 hover:text-green-600 transition-colors"
                                                    title="View details"
                                                >
                                                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                </Link>
                                                {creator.role !== 'admin' && (
                                                    <button
                                                        onClick={() => {
                                                            setDeleteTargetId(creator._id)
                                                            setDeleteTargetName(`${creator.firstName} ${creator.lastName}`)
                                                            setDeleteTargetSubmissions(creator.submissionCount || 0)
                                                            setShowDeleteModal(true)
                                                        }}
                                                        className="text-gray-300 hover:text-red-500 transition-colors ml-1"
                                                        title="Delete creator"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Results count */}
                <div className="px-6 py-4 border-t border-gray-100">
                    <p className="text-xs sm:text-sm text-gray-500">
                        Showing {filteredCreators.length} of {creators?.length || 0} creators
                    </p>
                </div>
            </div>
        </AdminLayout>
    )
}
