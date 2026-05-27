"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { Wallet, Store, Clock, Loader2, Bell, User, Users, ChevronRight } from "lucide-react"
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

    // Team leads feed (for the "STEP 02 / TEAM LEADS" card). Subscribes the
    // dashboard to the same listForMobileCRM query the /leads page uses so the
    // count stays in sync as new leads land.
    const leadsFeed = useQuery(
        api.leads.listForMobileCRM,
        creator?._id && creator.role !== 'admin' ? {} : "skip"
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
            <div
                className="min-h-screen flex items-center justify-center"
                style={{ background: "var(--ed-paper)" }}
            >
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    // Get recent submissions (limit to 3)
    const recentSubmissions = submissions?.slice(0, 3) || []
    const initials = `${(creator.firstName || "")[0] || ""}${(creator.lastName || "")[0] || ""}`.toUpperCase()

    return (
        <div
            className="editorial min-h-screen pb-24 overflow-x-hidden"
            style={{
                background: "var(--ed-paper)",
                color: "var(--ed-ink)",
                fontFamily: "var(--ed-sans)",
            }}
        >
            {/* Header */}
            <header className="px-4 pt-6 pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/profile"
                            className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
                            style={{
                                background: "var(--ed-paper-3)",
                                border: "1px solid var(--ed-rule)",
                            }}
                        >
                            {creator.profileImage ? (
                                <img src={creator.profileImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span
                                    className="text-sm"
                                    style={{
                                        fontFamily: "var(--ed-serif)",
                                        color: "var(--ed-ink-2)",
                                    }}
                                >
                                    {initials}
                                </span>
                            )}
                        </Link>
                        <div>
                            <p className="ed-label">Welcome back</p>
                            <h1
                                className="text-2xl leading-none mt-1"
                                style={{
                                    fontFamily: "var(--ed-serif)",
                                    color: "var(--ed-ink)",
                                    letterSpacing: "-0.015em",
                                }}
                            >
                                Mabuhay,{" "}
                                <em style={{ color: "var(--ed-accent)" }}>
                                    {creator.firstName || "Creator"}.
                                </em>
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/notifications"
                            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                            style={{
                                background: "var(--ed-paper-3)",
                                border: "1px solid var(--ed-rule)",
                                color: "var(--ed-ink-2)",
                            }}
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
                            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                            style={{
                                background: "var(--ed-paper-3)",
                                border: "1px solid var(--ed-rule)",
                                color: "var(--ed-ink-2)",
                            }}
                        >
                            <User className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </header>

            <main className="px-4 space-y-5">
                {/* Balance Card — ink surface with serif amount */}
                <div
                    className="rounded-3xl p-6 relative overflow-hidden"
                    style={{
                        background: "var(--ed-ink)",
                        color: "var(--ed-paper-3)",
                        boxShadow: "var(--ed-shadow-md)",
                    }}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" style={{ background: "rgba(16, 185, 129, 0.12)" }}></div>

                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <span
                            style={{
                                fontFamily: "var(--ed-mono)",
                                fontSize: 11,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "rgba(252,250,245,0.55)",
                            }}
                        >
                            Available Balance
                        </span>
                        <div
                            className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(255,255,255,0.08)", color: "var(--ed-accent-solid)" }}
                        >
                            <Wallet className="w-3.5 h-3.5" />
                        </div>
                    </div>

                    <div className="mb-1 relative z-10 flex items-baseline gap-2">
                        <span
                            style={{
                                fontFamily: "var(--ed-serif)",
                                fontSize: 20,
                                color: "rgba(252,250,245,0.55)",
                            }}
                        >
                            ₱
                        </span>
                        <span
                            style={{
                                fontFamily: "var(--ed-serif)",
                                fontSize: 56,
                                lineHeight: 1.0,
                                letterSpacing: "-0.025em",
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {creator.balance?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </span>
                    </div>
                </div>

                {/* Quick Stats — paper-3 cards with mono labels + serif numbers */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "Submissions", value: submissions?.length ?? 0, tone: "ink" as const },
                        { label: "In Review", value: submissions?.filter((s: any) => s.status === 'submitted' || s.status === 'in_review').length ?? 0, tone: "warn" as const },
                        { label: "Verified", value: submissions?.filter((s: any) => s.status === 'approved' || s.status === 'paid' || s.status === 'deployed' || s.status === 'completed').length ?? 0, tone: "accent" as const },
                    ].map((s) => (
                        <div
                            key={s.label}
                            className="p-3 text-center"
                            style={{
                                background: "var(--ed-paper-3)",
                                border: "1px solid var(--ed-rule)",
                                borderRadius: "var(--ed-radius-md)",
                            }}
                        >
                            <p
                                className="mb-1"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    fontSize: 9,
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    color: "var(--ed-ink-3)",
                                }}
                            >
                                {s.label}
                            </p>
                            <p
                                style={{
                                    fontFamily: "var(--ed-serif)",
                                    fontSize: 28,
                                    lineHeight: 1.0,
                                    fontVariantNumeric: "tabular-nums",
                                    color:
                                        s.tone === "accent" ? "var(--ed-accent)" :
                                        s.tone === "warn" ? "var(--ed-warn)" :
                                        "var(--ed-ink)",
                                }}
                            >
                                {s.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* STEP 02 / TEAM LEADS — feed entry card */}
                {(() => {
                    const total = leadsFeed?.stats.total ?? 0
                    const mine = leadsFeed?.stats.mine ?? 0
                    const converted = leadsFeed?.stats.converted ?? 0
                    const hot = leadsFeed?.leads.filter((l: any) => l.isHot).length ?? 0
                    return (
                        <Link
                            href="/leads"
                            className="block rounded-2xl overflow-hidden transition-transform hover:translate-y-[-1px]"
                            style={{
                                background: "var(--ed-paper-3)",
                                border: "1px solid var(--ed-rule)",
                            }}
                        >
                            <div className="p-4 sm:p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-[10px]" style={{
                                        fontFamily: "var(--ed-mono)",
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        color: "var(--ed-ink-3)",
                                    }}>
                                        <span>Step 02 / Team Leads</span>
                                        <span className="ed-live-dot" />
                                    </div>
                                    <ChevronRight className="w-4 h-4" style={{ color: "var(--ed-ink-3)" }} />
                                </div>
                                <h2
                                    style={{
                                        fontFamily: "var(--ed-serif)",
                                        fontSize: 26,
                                        lineHeight: 1.1,
                                        letterSpacing: "-0.015em",
                                        color: "var(--ed-ink)",
                                        margin: 0,
                                    }}
                                >
                                    {total} {total === 1 ? "lead" : "leads"},{" "}
                                    <em style={{ color: "var(--ed-accent)" }}>browse the feed.</em>
                                </h2>
                                <p className="text-[13px] mt-2" style={{ color: "var(--ed-ink-2)" }}>
                                    See every business the team has interviewed — including yours.
                                </p>
                            </div>
                            <div
                                className="grid grid-cols-4 divide-x"
                                style={{
                                    borderTop: "1px solid var(--ed-rule)",
                                    background: "var(--ed-paper-2)",
                                }}
                            >
                                {[
                                    { label: "Total", value: total, tone: "ink" as const },
                                    { label: "Hot", value: hot, tone: "danger" as const },
                                    { label: "Yours", value: mine, tone: "ink" as const },
                                    { label: "Converted", value: converted, tone: "accent" as const },
                                ].map((stat) => (
                                    <div key={stat.label} className="px-2 py-3 text-center" style={{ borderColor: "var(--ed-rule)" }}>
                                        <div
                                            style={{
                                                fontFamily: "var(--ed-serif)",
                                                fontSize: 22,
                                                lineHeight: 1.05,
                                                fontVariantNumeric: "tabular-nums",
                                                color:
                                                    stat.tone === "accent" ? "var(--ed-accent)" :
                                                    stat.tone === "danger" ? "var(--ed-danger)" :
                                                    "var(--ed-ink)",
                                            }}
                                        >
                                            {stat.value}
                                        </div>
                                        <div
                                            className="mt-0.5"
                                            style={{
                                                fontFamily: "var(--ed-mono)",
                                                fontSize: 9,
                                                letterSpacing: "0.14em",
                                                textTransform: "uppercase",
                                                color: "var(--ed-ink-3)",
                                            }}
                                        >
                                            {stat.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Link>
                    )
                })()}

                {/* Submission Status — eyebrow + serif heading */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="ed-label">§ Recent activity</p>
                            <h2
                                className="mt-1"
                                style={{
                                    fontFamily: "var(--ed-serif)",
                                    fontSize: 22,
                                    lineHeight: 1.15,
                                    letterSpacing: "-0.015em",
                                    color: "var(--ed-ink)",
                                }}
                            >
                                Recent <em style={{ color: "var(--ed-accent)" }}>submissions</em>
                            </h2>
                        </div>
                        <Link
                            href="/submissions"
                            className="text-xs"
                            style={{
                                fontFamily: "var(--ed-mono)",
                                fontSize: 11,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "var(--ed-accent)",
                            }}
                        >
                            View all →
                        </Link>
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
                                    <div
                                        className="p-3 flex items-center justify-between transition-all cursor-pointer hover:translate-y-[-1px]"
                                        style={{
                                            background: "var(--ed-paper-3)",
                                            border: "1px solid var(--ed-rule)",
                                            borderRadius: "var(--ed-radius-md)",
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getStatusBg()}`}>
                                                {isDraft ? <Clock className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h3
                                                    style={{
                                                        fontFamily: "var(--ed-serif)",
                                                        fontSize: 17,
                                                        lineHeight: 1.2,
                                                        color: "var(--ed-ink)",
                                                    }}
                                                >
                                                    {sub.businessName}
                                                </h3>
                                                <p
                                                    className="mt-0.5"
                                                    style={{
                                                        fontFamily: "var(--ed-mono)",
                                                        fontSize: 10,
                                                        letterSpacing: "0.1em",
                                                        textTransform: "uppercase",
                                                        color: "var(--ed-ink-3)",
                                                    }}
                                                >
                                                    {new Date(sub._creationTime).toLocaleDateString()}
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
                            <div
                                className="text-center py-8"
                                style={{
                                    background: "var(--ed-paper-2)",
                                    border: "1px dashed var(--ed-rule-strong)",
                                    borderRadius: "var(--ed-radius-md)",
                                }}
                            >
                                <p
                                    style={{
                                        fontFamily: "var(--ed-serif)",
                                        fontSize: 16,
                                        fontStyle: "italic",
                                        color: "var(--ed-ink-2)",
                                    }}
                                >
                                    No submissions yet.
                                </p>
                                <p
                                    className="mt-1"
                                    style={{
                                        fontFamily: "var(--ed-mono)",
                                        fontSize: 10,
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        color: "var(--ed-ink-3)",
                                    }}
                                >
                                    Start by tapping the + button below
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <BottomNav active="home" />
        </div>
    )
}
