"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { AlertCircle, Clock, CheckCircle, Banknote, Store, Plus, ArrowLeft, Loader2, Globe } from "lucide-react"

export default function SubmissionsPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()

    const creator = useQuery(
        api.creators.getByClerkId,
        isLoaded && isSignedIn && user?.id ? { clerkId: user.id } : "skip"
    )

    const submissions = useQuery(
        api.submissions.getByCreatorId,
        creator?._id ? { creatorId: creator._id } : "skip"
    )

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    if (!isLoaded || !isSignedIn || creator === undefined || submissions === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    const totalEarned = creator?.totalEarnings || 0
    const inReviewCount = submissions?.filter((s: any) =>
        s.status === 'submitted' || s.status === 'in_review'
    ).length || 0

    const isIncomplete = (sub: any) => {
        const hasPhotos = sub.photos && sub.photos.length > 0
        const hasMedia = sub.videoStorageId || sub.audioStorageId || sub.videoUrl || sub.audioUrl
        return !hasPhotos || !hasMedia
    }

    const getStatusBadge = (sub: any) => {
        const s = sub.status?.toLowerCase()
        const badges: Record<string, { bg: string; text: string }> = {
            completed: { bg: 'bg-emerald-100 text-emerald-700', text: 'Completed' },
            deployed: { bg: 'bg-emerald-100 text-emerald-700', text: 'Live' },
            paid: { bg: 'bg-emerald-100 text-emerald-700', text: 'Paid' },
            website_generated: { bg: 'bg-emerald-100 text-emerald-700', text: 'Website Ready' },
            approved: { bg: 'bg-blue-100 text-blue-700', text: 'Approved' },
            rejected: { bg: 'bg-red-100 text-red-700', text: 'Revision' },
            revision: { bg: 'bg-red-100 text-red-700', text: 'Revision' },
            submitted: { bg: 'bg-yellow-100 text-yellow-700', text: 'In Review' },
            in_review: { bg: 'bg-yellow-100 text-yellow-700', text: 'In Review' },
        }
        if (s === 'draft' || isIncomplete(sub)) {
            return <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-[10px] font-bold rounded-md uppercase">Draft</span>
        }
        const badge = badges[s || ''] || { bg: 'bg-orange-100 text-orange-700', text: 'Pending' }
        return <span className={`px-2 py-1 ${badge.bg} text-[10px] font-bold rounded-md uppercase`}>{badge.text}</span>
    }

    const getStatusIcon = (sub: any) => {
        const s = sub.status?.toLowerCase()
        if (s === 'completed' || s === 'deployed') return <Globe className="w-5 h-5 text-emerald-500" />
        if (s === 'approved' || s === 'paid' || s === 'website_generated') return <CheckCircle className="w-5 h-5 text-green-500" />
        if (s === 'rejected' || s === 'revision') return <AlertCircle className="w-5 h-5 text-red-500" />
        if (s === 'draft' || isIncomplete(sub)) return <Clock className="w-5 h-5 text-zinc-400" />
        return <Store className="w-5 h-5 text-orange-500" />
    }

    const getStatusBg = (sub: any) => {
        const s = sub.status?.toLowerCase()
        if (s === 'completed' || s === 'deployed') return 'bg-emerald-50'
        if (s === 'approved' || s === 'paid' || s === 'website_generated') return 'bg-green-50'
        if (s === 'rejected' || s === 'revision') return 'bg-red-50'
        if (s === 'draft' || isIncomplete(sub)) return 'bg-zinc-50'
        return 'bg-orange-50'
    }

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return (
        <div
            className="editorial min-h-screen pb-24 relative"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <main className="px-4 py-6">
                <div className="flex items-center justify-between mb-2">
                    <Link href="/dashboard" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 text-zinc-600 hover:text-zinc-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                </div>

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-zinc-900 leading-tight">
                        My <span className="text-emerald-500">Submissions</span>
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Track your business onboardings.</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Total Earned</p>
                        <p className="text-xl font-bold text-zinc-900">₱ {totalEarned.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">In Review</p>
                        <p className="text-xl font-bold text-orange-500">{inReviewCount}</p>
                    </div>
                </div>

                {/* Submissions List */}
                <div className="space-y-3">
                    {submissions && submissions.length > 0 ? (
                        submissions.map((sub: any) => (
                            <Link key={sub._id} href={`/submissions/${sub._id}`}>
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-gray-200 hover:shadow-md transition-all cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${getStatusBg(sub)}`}>
                                            {getStatusIcon(sub)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-zinc-900 text-sm">{sub.businessName}</h3>
                                            <p className="text-xs text-zinc-500 truncate max-w-[140px]">
                                                {sub.city || 'Location N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {getStatusBadge(sub)}
                                        <span className="text-[10px] text-zinc-400 font-medium">
                                            {sub._creationTime ? formatDate(sub._creationTime) : ''}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Store className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-zinc-900 font-bold mb-1">No submissions yet</h3>
                            <p className="text-zinc-500 text-sm">Start by adding a new business.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Floating New Entry FAB */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <Link
                    href="/submit/info"
                    className="group flex items-center gap-0 bg-emerald-500 rounded-full text-white shadow-lg shadow-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/50 transition-all duration-300 ease-out overflow-hidden"
                >
                    <div className="w-14 h-14 flex items-center justify-center shrink-0">
                        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
                    </div>
                    <span className="max-w-0 overflow-hidden whitespace-nowrap font-bold text-sm group-hover:max-w-[120px] group-hover:pr-5 transition-all duration-300 ease-out">
                        Add Submission
                    </span>
                </Link>
            </div>
        </div>
    )
}
