"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { Wallet, Store, Clock, Loader2, Bell, User } from "lucide-react"
import { BottomNav } from "@/components/BottomNav"

export default function DashboardPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()

    // Get creator profile from Convex
    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    // Get submissions from Convex
    const submissions = useQuery(
        api.submissions.getByCreatorId,
        creator?._id ? { creatorId: creator._id } : "skip"
    )

    // Get unread notification count
    const unreadCount = useQuery(
        api.notifications.getUnreadCount,
        creator?._id ? { creatorId: creator._id } : "skip"
    )

    // Redirect to login if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    // Redirect to onboarding if no creator profile
    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) {
            router.push("/onboarding")
        }
    }, [isLoaded, isSignedIn, creator, router])

    // Redirect admin users to admin dashboard
    useEffect(() => {
        if (isLoaded && isSignedIn && creator && creator.role === 'admin') {
            router.push("/admin")
        }
    }, [isLoaded, isSignedIn, creator, router])

    // Redirect uncertified creators to training
    useEffect(() => {
        if (isLoaded && isSignedIn && creator && creator.role !== 'admin' && !creator.certifiedAt) {
            router.replace("/training")
        }
    }, [isLoaded, isSignedIn, creator, router])

    // Track last active timestamp
    const updateLastActive = useMutation(api.creators.updateLastActive)
    useEffect(() => {
        if (isLoaded && isSignedIn && user?.id) {
            updateLastActive({ clerkId: user.id })
        }
    }, [isLoaded, isSignedIn, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // Show spinner while loading, or while any redirect condition is active
    if (
        !isLoaded ||
        !isSignedIn ||
        creator === undefined ||
        !creator ||
        creator.role === 'admin' ||
        !creator.certifiedAt
    ) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        )
    }

    // Get recent submissions (limit to 3)
    const recentSubmissions = submissions?.slice(0, 3) || []
    const initials = `${(creator.firstName || "")[0] || ""}${(creator.lastName || "")[0] || ""}`.toUpperCase()

    return (
        <div className="min-h-screen bg-white font-sans pb-24 overflow-x-hidden">
            {/* Header */}
            <header className="px-4 pt-6 pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/profile" className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center overflow-hidden border border-zinc-200">
                            {creator.profileImage ? (
                                <img src={creator.profileImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold text-zinc-500">{initials}</span>
                            )}
                        </Link>
                        <div>
                            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Welcome back</p>
                            <h1 className="text-lg font-bold text-zinc-900 leading-none">
                                Mabuhay, {creator.firstName || "Creator"}!
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/notifications"
                            className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 transition-colors"
                        >
                            <Bell className="w-5 h-5" />
                            {(unreadCount ?? 0) > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {unreadCount! > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </Link>
                        <Link
                            href="/profile"
                            className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 transition-colors"
                        >
                            <User className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </header>

            <main className="px-4 space-y-5">
                {/* Balance Card */}
                <div className="bg-zinc-900 text-white rounded-3xl p-5 relative overflow-hidden shadow-xl shadow-emerald-500/20 border border-emerald-500">
                    {/* Abstract background effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <span className="text-zinc-400 text-xs font-medium">Available Balance</span>
                        <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-emerald-400">
                            <Wallet className="w-3.5 h-3.5" />
                        </div>
                    </div>

                    <div className="mb-5 relative z-10">
                        <span className="text-3xl font-bold tracking-tight">
                            ₱ {creator.balance?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </span>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-2xl border border-emerald-500 shadow-sm text-center">
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1">Submissions</p>
                        <p className="text-lg font-bold text-zinc-900">{submissions?.length ?? 0}</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-emerald-500 shadow-sm text-center">
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1">In Review</p>
                        <p className="text-lg font-bold text-yellow-600">
                            {submissions?.filter((s: any) => s.status === 'submitted' || s.status === 'in_review').length ?? 0}
                        </p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-emerald-500 shadow-sm text-center">
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1">Verified</p>
                        <p className="text-lg font-bold text-emerald-600">
                            {submissions?.filter((s: any) => s.status === 'approved' || s.status === 'paid' || s.status === 'deployed' || s.status === 'completed').length ?? 0}
                        </p>
                    </div>
                </div>

                {/* Submission Status */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-zinc-900">Recent Submissions</h2>
                        <Link href="/submissions" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">View All</Link>
                    </div>
                    <div className="space-y-3">
                        {recentSubmissions.map((sub: any) => {
                            const isIncomplete = (!sub.photos || sub.photos.length === 0) || (!sub.videoStorageId && !sub.audioStorageId && !sub.videoUrl && !sub.audioUrl)
                            const isDraft = sub.status === 'draft' || isIncomplete

                            const getStatusBg = () => {
                                if (sub.status === 'approved') return 'bg-emerald-100 text-emerald-600'
                                if (sub.status === 'rejected') return 'bg-red-100 text-red-600'
                                if (isDraft) return 'bg-zinc-100 text-zinc-500'
                                return 'bg-yellow-100 text-yellow-600'
                            }

                            const getStatusBadge = () => {
                                if (sub.status === 'completed') return { bg: 'bg-emerald-100 text-emerald-700', text: 'Completed' }
                                if (sub.status === 'paid') return { bg: 'bg-emerald-100 text-emerald-700', text: 'Paid' }
                                if (sub.status === 'deployed') return { bg: 'bg-emerald-100 text-emerald-700', text: 'Live' }
                                if (sub.status === 'approved') return { bg: 'bg-blue-100 text-blue-700', text: 'Approved' }
                                if (sub.status === 'rejected') return { bg: 'bg-red-100 text-red-700', text: 'Rejected' }
                                if (sub.status === 'submitted' || sub.status === 'in_review') return { bg: 'bg-yellow-100 text-yellow-700', text: 'In Review' }
                                if (isDraft) return { bg: 'bg-zinc-100 text-zinc-600', text: 'Draft' }
                                return { bg: 'bg-yellow-100 text-yellow-700', text: 'Pending' }
                            }

                            const badge = getStatusBadge()

                            return (
                                <Link key={sub._id} href={`/submissions/${sub._id}`}>
                                    <div className="bg-white rounded-2xl p-3 border border-emerald-500 shadow-sm flex items-center justify-between hover:border-emerald-600 hover:shadow-md transition-all cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getStatusBg()}`}>
                                                {isDraft ? <Clock className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-zinc-900">{sub.businessName}</h3>
                                                <p className="text-[10px] text-zinc-500">
                                                    Submitted {new Date(sub._creationTime).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${badge.bg}`}>
                                            {badge.text}
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                        {recentSubmissions.length === 0 && (
                            <div className="text-center py-6 bg-emerald-50/10 rounded-2xl border border-dashed border-emerald-500">
                                <p className="text-zinc-500 text-xs">No submissions yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <BottomNav active="home" />
        </div>
    )
}
