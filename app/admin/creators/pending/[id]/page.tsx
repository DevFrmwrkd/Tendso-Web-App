"use client"

/**
 * Pending creator overview — opened when an admin clicks a creator in the
 * Pending Approvals queue. Shows a high-level profile (identity, contact,
 * referral, quiz/waiting status, payout) so the admin can decide before
 * approving or rejecting. Approve/Reject reuse the same mutations + reject
 * dialog as the queue view.
 */

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import AdminLayout from "../../../components/AdminLayout"
import RejectCreatorDialog from "../../../components/RejectCreatorDialog"
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    Loader2,
    Mail,
    Phone,
    UserCheck,
    Users,
    Clock,
    Wallet,
} from "lucide-react"
import { toast } from "sonner"

function timeAgo(ts?: number | null): string {
    if (!ts) return "—"
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

function fmtDate(ts?: number | null): string {
    if (!ts) return "—"
    return new Date(ts).toLocaleString()
}

function fullName(c: { firstName?: string | null; middleName?: string | null; lastName?: string | null; email?: string }): string {
    const parts = [c.firstName, c.middleName, c.lastName].filter(Boolean) as string[]
    return parts.length > 0 ? parts.join(" ") : (c.email ?? "Unnamed creator")
}

export default function PendingCreatorOverviewPage() {
    const params = useParams()
    const router = useRouter()
    const creatorId = params.id as string
    const { user, isLoaded } = useUser()

    const currentCreator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )
    const isAdmin = currentCreator?.role === "admin"

    const creator = useQuery(
        api.creators.getById,
        isAdmin && creatorId ? { id: creatorId as Id<"creators"> } : "skip"
    )

    const approveCreator = useMutation(api.creators.approveCreator)

    const [approving, setApproving] = useState(false)
    const [showReject, setShowReject] = useState(false)

    const loading = !isLoaded || (user && currentCreator === undefined) || (isAdmin && creator === undefined)

    async function handleApprove() {
        if (!creator) return
        setApproving(true)
        try {
            await approveCreator({ id: creator._id })
            toast.success(`${fullName(creator)} approved — they're now a certified creator.`)
            router.push("/admin/creators")
        } catch (e: any) {
            toast.error(e?.message ?? "Approval failed")
        } finally {
            setApproving(false)
        }
    }

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--ed-ink-3)" }} />
                </div>
            </AdminLayout>
        )
    }

    if (!isAdmin) {
        return <AdminLayout><p className="p-6 text-red-600">Forbidden: admin access required.</p></AdminLayout>
    }

    if (!creator) {
        return (
            <AdminLayout>
                <div className="ed-card-xl text-center">
                    <p className="ed-body" style={{ color: "var(--ed-ink-2)" }}>Creator not found.</p>
                    <Link href="/admin/creators" className="ed-door ed-door-ghost inline-flex items-center mt-4" style={{ padding: "8px 14px" }}>
                        <ArrowLeft className="w-4 h-4" /><span style={{ marginLeft: 8 }}>Back to creators</span>
                    </Link>
                </div>
            </AdminLayout>
        )
    }

    // Derive a human status for this creator.
    const isPending = !!creator.quizPassedAt && !creator.certifiedAt && !creator.rejectedAt && !creator.isDeleted
    const statusLabel = creator.certifiedAt ? "Approved"
        : creator.rejectedAt ? "Rejected"
        : creator.quizPassedAt ? "Pending approval"
        : "In onboarding"

    const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
        <div className="flex items-start gap-3 py-3" style={{ borderTop: "1px solid var(--ed-rule)" }}>
            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--ed-ink-3)" }} />
            <div className="min-w-0">
                <div className="ed-label">{label}</div>
                <div className="text-sm mt-0.5" style={{ color: "var(--ed-ink)", wordBreak: "break-word" }}>{value ?? "—"}</div>
            </div>
        </div>
    )

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Back */}
                <Link
                    href="/admin/creators"
                    className="inline-flex items-center gap-2 text-sm"
                    style={{ color: "var(--ed-ink-3)" }}
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Pending Approvals
                </Link>

                {/* Header: identity + status */}
                <div className="flex items-start justify-between gap-6 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                            style={{ background: "var(--ed-paper-2)", border: "1px solid var(--ed-rule)" }}
                        >
                            {creator.profileImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={creator.profileImage} alt={fullName(creator)} className="w-full h-full object-cover" />
                            ) : (
                                <span style={{ fontFamily: "var(--ed-serif)", fontSize: 24, color: "var(--ed-ink-2)" }}>
                                    {(creator.firstName?.[0] ?? creator.email[0]).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div>
                            <span className="ed-eyebrow">Creator overview</span>
                            <h1 className="ed-display-md mt-1" style={{ color: "var(--ed-ink)" }}>{fullName(creator)}</h1>
                            <div className="ed-label mt-1">
                                {statusLabel}{creator.quizPassedAt ? ` · quiz passed ${timeAgo(creator.quizPassedAt)}` : ""}
                            </div>
                        </div>
                    </div>

                    {/* Approve / Reject — only meaningful while pending */}
                    {isPending && (
                        <div className="inline-flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowReject(true)}
                                disabled={approving}
                                className="ed-door ed-door-danger-ghost inline-flex items-center"
                                style={{ minHeight: 40, padding: "9px 16px", fontSize: 14 }}
                            >
                                <XCircle className="w-4 h-4" /><span style={{ marginLeft: 8 }}>Reject</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleApprove}
                                disabled={approving}
                                className="ed-door ed-door-accent inline-flex items-center"
                                style={{ minHeight: 40, padding: "9px 18px", fontSize: 14 }}
                            >
                                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                <span style={{ marginLeft: 8 }}>{approving ? "Approving…" : "Approve"}</span>
                            </button>
                        </div>
                    )}
                </div>

                <hr className="ed-rule" />

                {/* Detail grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                    {/* Contact */}
                    <div>
                        <h2 className="ed-display-sm mb-1" style={{ color: "var(--ed-ink)" }}>Contact</h2>
                        <InfoRow icon={Mail} label="Email" value={creator.email} />
                        <InfoRow icon={Phone} label="Phone" value={creator.phone ?? "—"} />
                        <InfoRow icon={Wallet} label="Payout method" value={creator.payoutMethod ?? creator.wiseEmail ?? "—"} />
                    </div>

                    {/* Onboarding / referral */}
                    <div>
                        <h2 className="ed-display-sm mb-1" style={{ color: "var(--ed-ink)" }}>Onboarding</h2>
                        <InfoRow icon={UserCheck} label="Quiz passed" value={fmtDate(creator.quizPassedAt)} />
                        <InfoRow icon={Clock} label="Account created" value={fmtDate(creator.createdAt)} />
                        <InfoRow icon={Users} label="Referred by" value={creator.referredByName ?? creator.referredByCode ?? "—"} />
                    </div>
                </div>

                {/* Pending banner */}
                {isPending && (
                    <div
                        className="ed-card p-4 flex items-start gap-3"
                        style={{ background: "var(--ed-paper-2)", border: "1px solid var(--ed-rule)" }}
                    >
                        <UserCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--ed-accent)" }} />
                        <p className="ed-body" style={{ maxWidth: "60ch" }}>
                            This creator passed the onboarding quiz and is waiting for certification.
                            Approving releases the mobile Pending Review gate; rejecting sends them to the
                            verification-rejected screen with your reason.
                        </p>
                    </div>
                )}
            </div>

            <RejectCreatorDialog
                creator={{ _id: creator._id, firstName: creator.firstName ?? null, lastName: creator.lastName ?? null }}
                open={showReject}
                onClose={() => setShowReject(false)}
                onSuccess={({ displayName }) => {
                    toast.success(`${displayName} rejected — they'll see the rejection screen on next app open.`)
                    router.push("/admin/creators")
                }}
            />
        </AdminLayout>
    )
}
