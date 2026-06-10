"use client"

import { useState, useEffect, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import Logo from "@/public/tendso-logo.png"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, CheckCircle, XCircle, UserPlus, Banknote, Globe, Plus, User, Lock, Info, Bell, Award, X, Download } from "lucide-react"
import { toPng } from "html-to-image"

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
    submission_approved: { icon: CheckCircle, color: "text-amber-500", bg: "bg-amber-50" },
    submission_rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
    new_lead: { icon: UserPlus, color: "text-blue-500", bg: "bg-blue-50" },
    payout_sent: { icon: Banknote, color: "text-amber-500", bg: "bg-amber-50" },
    website_live: { icon: Globe, color: "text-purple-500", bg: "bg-purple-50" },
    submission_created: { icon: Plus, color: "text-indigo-500", bg: "bg-indigo-50" },
    profile_updated: { icon: User, color: "text-amber-500", bg: "bg-amber-50" },
    password_changed: { icon: Lock, color: "text-zinc-500", bg: "bg-zinc-100" },
    certification: { icon: Award, color: "text-amber-500", bg: "bg-amber-50" },
    system: { icon: Info, color: "text-zinc-500", bg: "bg-zinc-100" },
}

function timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return "Just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
}

function CertificateCard({ name, date }: { name: string; date: string }) {
    return (
        <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-100">
            <div className="bg-amber-500 py-4 px-6 text-center">
                <div className="flex justify-center">
                    <Image src={Logo} alt="Tendso" width={130} height={23} />
                </div>
            </div>
            <div className="px-6 py-8 text-center space-y-5">
                <div className="flex justify-center">
                    <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
                        <Award className="w-7 h-7 text-amber-500" />
                    </div>
                </div>
                <div>
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-[0.2em] mb-1">Certificate of Completion</p>
                    <h2 className="text-xl font-bold text-zinc-900">Certified Creator</h2>
                </div>
                <div className="flex justify-center">
                    <div className="w-12 h-0.5 bg-amber-400 rounded-full" />
                </div>
                <div>
                    <p className="text-xs text-zinc-400 mb-2">This certifies that</p>
                    <div className="inline-block bg-zinc-800 text-white px-6 py-2.5 rounded-lg">
                        <p className="font-bold text-sm tracking-wide uppercase">{name}</p>
                    </div>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-[260px] mx-auto">
                    has demonstrated proficiency in <span className="font-semibold text-zinc-700">Local Business Digitization</span> and is authorized to provide verified digital services to MSMEs in the Philippines.
                </p>
                <div className="pt-2">
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-[0.15em]">Date Issued</p>
                    <p className="text-sm font-bold text-zinc-900">{date}</p>
                </div>
            </div>
            <div className="bg-amber-500 py-3 text-center">
                <p className="text-white text-xs font-bold">You can now start earning!</p>
            </div>
        </div>
    )
}

export default function NotificationsPage() {
    const router = useRouter()
    const { user, isLoaded } = useUser()
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip")
    const notifications = useQuery(api.notifications.getByCreator, creator?._id ? { creatorId: creator._id } : "skip")
    const markAsRead = useMutation(api.notifications.markAsRead)
    const markAllAsRead = useMutation(api.notifications.markAllAsRead)

    const [showCertModal, setShowCertModal] = useState(false)
    const certRef = useRef<HTMLDivElement>(null)

    const handleDownloadCertificate = async () => {
        if (!certRef.current) return
        try {
            const dataUrl = await toPng(certRef.current, { pixelRatio: 3 })
            const link = document.createElement("a")
            link.download = `certificate-${creator?.firstName || "creator"}.png`
            link.href = dataUrl
            link.click()
        } catch (err) {
            console.error("Failed to download certificate:", err)
        }
    }

    useEffect(() => {
        if (isLoaded && !user) router.push("/login")
    }, [isLoaded, user, router])

    if (!isLoaded || creator === undefined || notifications === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    const fullName = creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || "Creator" : "Creator"
    const certDate = creator?.certifiedAt
        ? new Date(creator.certifiedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : ""

    const handleNotificationClick = async (notification: any) => {
        if (!notification.read) {
            await markAsRead({ id: notification._id })
        }

        // Certificate notification — open modal
        if (notification.data?.showCertificate) {
            setShowCertModal(true)
            return
        }

        // Submission-related — navigate to detail
        if (notification.data?.submissionId) {
            router.push(`/submissions/${notification.data.submissionId}`)
        }
    }

    const handleMarkAllRead = async () => {
        if (creator?._id) {
            await markAllAsRead({ creatorId: creator._id })
        }
    }

    const hasUnread = notifications?.some((n: any) => !n.read)

    return (
        <div
            className="editorial min-h-screen pb-12"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <header className="px-4 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-xl font-bold text-zinc-900">Notifications</h1>
                    </div>
                    {hasUnread && (
                        <button onClick={handleMarkAllRead} className="text-xs font-semibold text-amber-600 hover:text-amber-700">
                            Mark all read
                        </button>
                    )}
                </div>
            </header>

            <main className="px-4">
                {notifications && notifications.length > 0 ? (
                    <div className="space-y-2">
                        {notifications.map((n: any) => {
                            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
                            const Icon = config.icon
                            return (
                                <button
                                    key={n._id}
                                    onClick={() => handleNotificationClick(n)}
                                    className="w-full flex items-start gap-3 p-4 rounded-xl border border-zinc-100 shadow-sm text-left hover:bg-zinc-50 transition-colors"
                                >
                                    <div className="relative shrink-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bg}`}>
                                            <Icon className={`w-5 h-5 ${config.color}`} />
                                        </div>
                                        {!n.read && (
                                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-white" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${n.read ? 'text-zinc-600' : 'text-zinc-900 font-semibold'}`}>{n.title}</p>
                                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{n.body}</p>
                                        <p className="text-[10px] text-zinc-400 mt-1">{timeAgo(n.sentAt)}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bell className="w-8 h-8 text-zinc-300" />
                        </div>
                        <h3 className="text-zinc-900 font-bold mb-1">No notifications yet</h3>
                        <p className="text-zinc-500 text-sm">You'll see updates about your submissions here.</p>
                    </div>
                )}
            </main>

            {/* Certificate Modal */}
            {showCertModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCertModal(false)}>
                    <div
                        className="w-full max-w-sm bg-white rounded-3xl overflow-hidden max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                            <button
                                onClick={() => setShowCertModal(false)}
                                className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-700"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <h3 className="text-sm font-bold text-zinc-900">My Certificate</h3>
                            <div className="w-8" />
                        </div>
                        <div className="overflow-y-auto p-4">
                            <div ref={certRef}>
                                <CertificateCard name={fullName} date={certDate} />
                            </div>
                        </div>
                        <div className="p-4 border-t border-zinc-100 space-y-2">
                            <Button
                                onClick={handleDownloadCertificate}
                                className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Download Certificate
                            </Button>
                            <Button
                                onClick={() => setShowCertModal(false)}
                                variant="ghost"
                                className="w-full h-10 text-zinc-500 hover:text-zinc-700 font-medium rounded-xl"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
