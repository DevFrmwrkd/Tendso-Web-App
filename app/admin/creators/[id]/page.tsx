"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Id } from "@/convex/_generated/dataModel"

type CreatorStatus = 'pending' | 'active' | 'suspended' | 'deleted'

export default function CreatorDetailPage() {
    const params = useParams()
    const router = useRouter()
    const creatorId = params.id as string
    const { user, isLoaded } = useUser()

    // Get current user's creator profile to check admin status
    const currentCreator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    const isAdmin = currentCreator?.role === 'admin'

    // Get creator by ID
    const creator = useQuery(
        api.creators.getById,
        isAdmin && creatorId ? { id: creatorId as Id<"creators"> } : "skip"
    )

    // Get submissions for this creator
    const submissions = useQuery(
        api.submissions.getByCreatorId,
        isAdmin && creator ? { creatorId: creator._id } : "skip"
    )

    // Per-creator pricing summary — what this creator charges businesses.
    const pricingSummary = useQuery(
        api.submissions.getCreatorPricingSummary,
        isAdmin && creator ? { creatorId: creator._id } : "skip"
    )

    // Mutation to update status
    const updateStatus = useMutation(api.creators.updateStatus)

    const loading = !isLoaded || (user && currentCreator === undefined) || (isAdmin && creator === undefined)

    const [updating, setUpdating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Confirmation modal
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [pendingAction, setPendingAction] = useState<'suspend' | 'reactivate' | null>(null)

    // Delete modal
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleStatusChange = async () => {
        if (!creator || !pendingAction) return

        setUpdating(true)
        setError(null)
        try {
            const newStatus = pendingAction === 'suspend' ? 'suspended' : 'active'
            await updateStatus({
                id: creator._id,
                status: newStatus as CreatorStatus
            })
            setShowConfirmModal(false)
            setPendingAction(null)
        } catch (err: any) {
            setError(err.message || 'Failed to update status')
        } finally {
            setUpdating(false)
        }
    }

    const openConfirmModal = (action: 'suspend' | 'reactivate') => {
        setPendingAction(action)
        setShowConfirmModal(true)
    }

    const handleDeleteCreator = async () => {
        if (!creator) return
        setDeleting(true)
        setError(null)
        try {
            const response = await fetch('/api/delete-creator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creatorId: creator._id }),
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to delete creator')
            }
            setShowDeleteModal(false)
            router.push('/admin/creators')
        } catch (err: any) {
            setError(err.message || 'Failed to delete creator')
            setShowDeleteModal(false)
        } finally {
            setDeleting(false)
        }
    }

    const getStatusBadge = (status: string | undefined) => {
        const safeStatus = status || 'pending'
        const styles: Record<string, string> = {
            active: 'bg-amber-100 text-amber-800 border-amber-200',
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            suspended: 'bg-red-100 text-red-800 border-red-200',
            deleted: 'bg-gray-100 text-gray-800 border-gray-200',
        }
        return (
            <span className={`px-3 py-1 text-sm font-medium rounded-full border ${styles[safeStatus]}`}>
                {safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)}
            </span>
        )
    }

    const getSubmissionStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-600',
            submitted: 'bg-blue-100 text-blue-700',
            in_review: 'bg-yellow-100 text-yellow-700',
            approved: 'bg-amber-100 text-amber-700',
            rejected: 'bg-red-100 text-red-700',
            website_generated: 'bg-purple-100 text-purple-700',
            published: 'bg-amber-100 text-amber-700',
        }
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
                {status.replace('_', ' ')}
            </span>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
        )
    }

    if (!isAdmin) return null

    if (!creator) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Creator Not Found</h2>
                    <Link href="/admin/creators">
                        <Button>Back to Creators</Button>
                    </Link>
                </div>
            </div>
        )
    }

    const submissionCount = submissions?.length || 0

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-4">
                            <Link href="/admin/creators">
                                <Button variant="outline" size="sm">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {creator.firstName} {creator.middleName ? `${creator.middleName} ` : ''}{creator.lastName}
                                </h1>
                                <p className="text-sm text-gray-500">Creator Details</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {creator.role !== 'admin' && (
                                <Button
                                    onClick={() => setShowDeleteModal(true)}
                                    variant="outline"
                                    className="border-red-600 text-red-600 hover:bg-red-50"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                </Button>
                            )}
                            {creator.status === 'suspended' ? (
                                <Button
                                    onClick={() => openConfirmModal('reactivate')}
                                    disabled={updating}
                                    className="bg-amber-500 hover:bg-amber-600 text-white"
                                >
                                    {updating ? 'Updating...' : 'Reactivate Creator'}
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => openConfirmModal('suspend')}
                                    disabled={updating || creator.role === 'admin'}
                                    variant="outline"
                                    className="border-amber-600 text-amber-600 hover:bg-amber-50"
                                >
                                    {updating ? 'Updating...' : 'Suspend Creator'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Pricing this creator charges businesses */}
                {pricingSummary && pricingSummary.rows.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold text-gray-900">Pricing charged to businesses</h3>
                            <span className="text-xs text-gray-500">
                                Avg ₱{pricingSummary.avgSellPrice.toLocaleString()}
                                {pricingSummary.minSellPrice > 0 && (
                                    <> · Range ₱{pricingSummary.minSellPrice.toLocaleString()}–₱{pricingSummary.maxSellPrice.toLocaleString()}</>
                                )}
                                {' '}· Lifetime earned ₱{pricingSummary.lifetimeEarned.toLocaleString()} · {pricingSummary.paidCount} paid
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                                        <th className="px-6 py-2 font-medium">Business</th>
                                        <th className="px-4 py-2 font-medium">Sell price</th>
                                        <th className="px-4 py-2 font-medium">Discount</th>
                                        <th className="px-4 py-2 font-medium">Domain</th>
                                        <th className="px-4 py-2 font-medium">Owner total</th>
                                        <th className="px-4 py-2 font-medium">Creator earned</th>
                                        <th className="px-4 py-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pricingSummary.rows.map((r) => (
                                        <tr
                                            key={r.submissionId}
                                            className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                                            onClick={() => router.push(`/admin/submissions/${r.submissionId}`)}
                                        >
                                            <td className="px-6 py-3 text-gray-900">{r.businessName}</td>
                                            <td className="px-4 py-3 text-gray-900">₱{r.sellPrice.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-gray-600">{r.discountPct > 0 ? `${r.discountPct}% off` : '—'}</td>
                                            <td className="px-4 py-3 text-gray-600">{r.domainAddOn > 0 ? `₱${r.domainAddOn.toLocaleString()}` : '—'}</td>
                                            <td className="px-4 py-3 text-gray-600">₱{r.ownerTotal.toLocaleString()}</td>
                                            <td className="px-4 py-3 font-medium text-amber-700">₱{r.creatorPayout.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-gray-600 capitalize">{r.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Profile */}
                    <div className="space-y-6">
                        {/* Profile Card */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xl font-bold">
                                    {(creator.firstName || 'U').charAt(0)}{(creator.lastName || '').charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">
                                        {creator.firstName || ''} {creator.lastName || ''}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        {getStatusBadge(creator.status)}
                                        {creator.role === 'admin' && (
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                                                👑 Admin
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Email</span>
                                    <span className="text-gray-900 font-medium">{creator.email || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Phone</span>
                                    <span className="text-gray-900 font-medium">{creator.phone || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Referral Code</span>
                                    <span className="text-gray-900 font-medium font-mono">{creator.referralCode}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Referred By</span>
                                    <span className="text-gray-900 font-medium">{creator.referredBy || '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payout Info */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h3 className="font-bold text-gray-900 mb-4">Payout Information</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Method</span>
                                    <span className="text-gray-900 font-medium">{creator.payoutMethod || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Details</span>
                                    <span className="text-gray-900 font-medium">{creator.payoutDetails || 'Not set'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Stats & Submissions */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <p className="text-sm text-gray-500 mb-1">Total Earnings</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    ₱{(creator.totalEarnings || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                                <p className="text-2xl font-bold text-amber-600">
                                    ₱{(creator.balance || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <p className="text-sm text-gray-500 mb-1">Total Submissions</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {submissionCount}
                                </p>
                            </div>
                        </div>

                        {/* Submission History */}
                        <div className="bg-white rounded-xl border border-gray-200">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h3 className="font-bold text-gray-900">Submission History</h3>
                            </div>
                            {!submissions || submissions.length === 0 ? (
                                <div className="px-6 py-12 text-center text-gray-500">
                                    No submissions yet
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200">
                                    {submissions.map((submission: any) => (
                                        <div key={submission._id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => router.push(`/admin/submissions/${submission._id}`)}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="font-medium text-gray-900">
                                                        {submission.businessName}
                                                    </span>
                                                    <p className="text-sm text-gray-500">{submission.businessType}</p>
                                                </div>
                                                <div className="text-right">
                                                    {getSubmissionStatusBadge(submission.status)}
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-4 text-sm">
                                                <span className="text-gray-500">
                                                    Payout: <span className="text-amber-600 font-medium">₱{submission.creatorPayout}</span>
                                                </span>
                                                <span className="text-gray-500">
                                                    {submission.city}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                            {pendingAction === 'suspend' ? 'Suspend Creator?' : 'Reactivate Creator?'}
                        </h3>
                        <p className="text-gray-600 mb-6">
                            {pendingAction === 'suspend'
                                ? `Are you sure you want to suspend ${creator.firstName} ${creator.lastName}? They will not be able to access the platform.`
                                : `Are you sure you want to reactivate ${creator.firstName} ${creator.lastName}? They will regain full access to the platform.`
                            }
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowConfirmModal(false)
                                    setPendingAction(null)
                                }}
                                disabled={updating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleStatusChange}
                                disabled={updating}
                                className={pendingAction === 'suspend' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}
                            >
                                {updating ? 'Processing...' : pendingAction === 'suspend' ? 'Suspend' : 'Reactivate'}
                            </Button>
                        </div>
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
                            <h3 className="text-lg font-bold text-gray-900">
                                Delete {creator.firstName} {creator.lastName}?
                            </h3>
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
                                    All {submissionCount} submission{submissionCount !== 1 ? 's' : ''} &amp; generated websites
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
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={deleting}
                                className="flex-1 py-2.5 px-4 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteCreator}
                                disabled={deleting}
                                className="flex-1 py-2.5 px-4 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 text-sm"
                            >
                                {deleting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Deleting...
                                    </span>
                                ) : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
