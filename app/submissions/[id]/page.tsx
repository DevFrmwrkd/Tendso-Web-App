"use client"

import { useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2, Globe } from "lucide-react"
import { Id } from "@/convex/_generated/dataModel"

export default function SubmissionDetailPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string

    const { user, isLoaded, isSignedIn } = useUser()

    // Get creator from Convex
    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    // Get submission from Convex
    const submission = useQuery(
        api.submissions.getById,
        id ? { id: id as Id<"submissions"> } : "skip"
    )

    // Get latest deployed website info (publishedUrl / customDomain).
    // submission.websiteUrl can go stale after edits or custom-domain activation —
    // the generatedWebsites record holds the authoritative current deployment.
    const generatedWebsite = useQuery(
        api.generatedWebsites.getBySubmissionId,
        submission?._id ? { submissionId: submission._id } : "skip"
    )

    // Get resolved photo URLs (only for legacy Convex storage IDs)
    // R2 URLs start with http and don't need resolution
    const needsResolution = submission?.photos?.some((p: any) => p.startsWith('convex:') || !p.startsWith('http'))
    const photoUrls = useQuery(
        api.files.getMultipleUrls,
        needsResolution && submission?.photos?.length ? { storageIds: submission.photos } : "skip"
    )

    // Get interview URL
    // Prefer R2 URLs (videoUrl/audioUrl) over Convex storage IDs (legacy)
    const hasR2InterviewUrl = submission?.videoUrl || submission?.audioUrl
    const interviewStorageId = submission?.videoStorageId || submission?.audioStorageId
    const legacyInterviewUrl = useQuery(
        api.files.getUrlByString,
        !hasR2InterviewUrl && interviewStorageId ? { storageId: interviewStorageId.toString() } : "skip"
    )
    // Use R2 URL if available, otherwise fall back to resolved Convex URL
    const interviewUrl = hasR2InterviewUrl
        ? (submission?.videoUrl || submission?.audioUrl)
        : legacyInterviewUrl

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    // Loading state
    if (!isLoaded || !isSignedIn || creator === undefined || submission === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        )
    }

    // Check if user owns this submission
    if (!submission || (creator && submission.creatorId !== creator._id)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Submission not found</h1>
                <p className="text-gray-500 mb-6">This submission doesn't exist or you don't have access to it.</p>
                <Link href="/dashboard" className="text-emerald-600 hover:text-emerald-700 font-medium">
                    Back to Dashboard
                </Link>
            </div>
        )
    }

    // Resolve the latest live URL.
    // Priority: custom domain when live → generatedWebsite.customDomain → publishedUrl → legacy websiteUrl.
    const normalizeUrl = (u: string) => (u.startsWith('http') ? u : `https://${u}`)
    const latestWebsiteUrl =
        (submission.domainStatus === 'live' && submission.requestedDomain
            ? normalizeUrl(submission.requestedDomain)
            : null) ||
        (generatedWebsite?.customDomain ? normalizeUrl(generatedWebsite.customDomain) : null) ||
        generatedWebsite?.publishedUrl ||
        submission.websiteUrl ||
        null

    // Check if submission is incomplete (draft)
    // Now also check for R2 URLs (videoUrl/audioUrl) in addition to Convex storage IDs
    const hasInterview = submission.videoStorageId || submission.audioStorageId || submission.videoUrl || submission.audioUrl
    const isIncomplete = (!submission.photos || submission.photos.length === 0) || !hasInterview
    const isDraft = submission.status === 'draft' || isIncomplete

    const getStatusBadge = () => {
        const s = submission.status?.toLowerCase()
        const badges: Record<string, { bg: string; text: string }> = {
            completed: { bg: 'bg-emerald-100 text-emerald-800', text: 'Completed' },
            deployed: { bg: 'bg-emerald-100 text-emerald-800', text: 'Live' },
            paid: { bg: 'bg-emerald-100 text-emerald-800', text: 'Paid' },
            website_generated: { bg: 'bg-emerald-100 text-emerald-800', text: 'Website Generated' },
            approved: { bg: 'bg-blue-100 text-blue-800', text: 'Approved' },
            rejected: { bg: 'bg-red-100 text-red-800', text: 'Rejected' },
            submitted: { bg: 'bg-yellow-100 text-yellow-800', text: 'In Review' },
            in_review: { bg: 'bg-yellow-100 text-yellow-800', text: 'In Review' },
        }
        if (isDraft) {
            return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-zinc-100 text-zinc-700">Draft</span>
        }
        const badge = badges[s || ''] || { bg: 'bg-yellow-100 text-yellow-800', text: s || 'Pending' }
        return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.bg}`}>{badge.text}</span>
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard"
                                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">{submission.businessName}</h1>
                                <p className="text-sm text-gray-500">Submission Details</p>
                            </div>
                        </div>
                        {getStatusBadge()}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Business Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Business Information */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Business Information</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Business Name</label>
                                    <p className="text-gray-900 font-medium mt-1">{submission.businessName}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Business Type</label>
                                    <p className="text-gray-900 mt-1">{submission.businessType}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Owner Name</label>
                                    <p className="text-gray-900 mt-1">{submission.ownerName}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Owner Phone</label>
                                    <p className="text-gray-900 mt-1">{submission.ownerPhone}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Owner Email</label>
                                    <p className="text-gray-900 mt-1">{submission.ownerEmail || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">City</label>
                                    <p className="text-gray-900 mt-1">{submission.city}</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs text-gray-500 uppercase font-medium">Address</label>
                                    <p className="text-gray-900 mt-1">{submission.address}</p>
                                </div>
                            </div>
                        </div>

                        {/* Photos */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">
                                Photos ({submission.photos?.length || 0})
                            </h2>
                            {submission.photos && submission.photos.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {submission.photos.map((originalUrl: string, index: number) => {
                                        // Use original URL if it's an http URL (R2), otherwise use resolved URL from Convex
                                        const isR2Url = originalUrl.startsWith('http')
                                        const resolvedUrl = isR2Url ? originalUrl : (photoUrls?.[index] || null)
                                        const displayUrl = resolvedUrl && !resolvedUrl.startsWith('convex:') ? resolvedUrl : null

                                        return (
                                            <div
                                                key={index}
                                                className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center"
                                            >
                                                {displayUrl ? (
                                                    <img
                                                        src={displayUrl}
                                                        alt={`Photo ${index + 1}`}
                                                        className="absolute inset-0 w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="text-center p-4">
                                                        <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
                                                        <span className="text-xs text-gray-500">Loading...</span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-gray-500">No photos uploaded</p>
                            )}
                        </div>

                        {/* Interview */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Interview</h2>

                            {/* Transcript Section */}
                            {submission.transcript && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                            AI Transcript
                                        </h3>
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                            Generated
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto">
                                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {submission.transcript}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Media Player */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                                    {submission.transcript ? 'Original Recording' : 'Recording'}
                                </h3>

                                {interviewUrl && (
                                    <div className="rounded-xl overflow-hidden bg-black">
                                        {(submission.videoUrl || submission.videoStorageId) ? (
                                            <video
                                                src={interviewUrl}
                                                controls
                                                className="w-full max-h-96"
                                                preload="metadata"
                                            />
                                        ) : (submission.audioUrl || submission.audioStorageId) ? (
                                            <div className="p-4 bg-gray-100 rounded-xl">
                                                <audio
                                                    src={interviewUrl}
                                                    controls
                                                    className="w-full"
                                                    preload="metadata"
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                {hasInterview && !interviewUrl && (
                                    <div className="flex items-center justify-center py-8 bg-gray-50 rounded-xl">
                                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                        <span className="ml-2 text-sm text-gray-500">Loading recording...</span>
                                    </div>
                                )}

                                {!hasInterview && (
                                    <p className="text-gray-500">No interview uploaded</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Metadata */}
                    <div className="space-y-6">
                        {/* Status */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Status</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Current Status</label>
                                    <p className="text-lg font-semibold text-gray-900 capitalize mt-1">{submission.status.replace('_', ' ')}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Creator Payout</label>
                                    <p className="text-2xl font-bold text-green-600">₱{submission.creatorPayout || 0}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-medium">Created On</label>
                                    <p className="text-gray-900 mt-1">{new Date(submission._creationTime).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Website URL */}
                        {latestWebsiteUrl && (
                            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
                                <h2 className="text-lg font-bold text-gray-900 mb-3">Generated Website</h2>
                                <a
                                    href={latestWebsiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
                                >
                                    <Globe className="w-4 h-4" />
                                    Visit Live Website
                                </a>
                                <p className="mt-2 text-xs text-gray-600 break-all">{latestWebsiteUrl}</p>
                            </div>
                        )}

                        {/* Quality Checklist */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Submission Checklist</h2>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${submission.photos && submission.photos.length > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {submission.photos && submission.photos.length > 0 ? (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={submission.photos && submission.photos.length > 0 ? 'text-gray-900' : 'text-gray-500'}>
                                        Photos uploaded ({submission.photos?.length || 0})
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${hasInterview ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {hasInterview ? (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={hasInterview ? 'text-gray-900' : 'text-gray-500'}>
                                        Interview recording
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${submission.transcript ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {submission.transcript ? (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={submission.transcript ? 'text-gray-900' : 'text-gray-500'}>
                                        AI transcript generated
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${(submission.businessName && submission.businessType) ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {(submission.businessName && submission.businessType) ? (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={(submission.businessName && submission.businessType) ? 'text-gray-900' : 'text-gray-500'}>
                                        Business info complete
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Continue Draft Button */}
                        {isDraft && (
                            <Link
                                href="/submit/info"
                                className="block w-full text-center bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                            >
                                Continue Draft
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
