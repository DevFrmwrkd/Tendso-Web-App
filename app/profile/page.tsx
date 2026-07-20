"use client"

import { useState, useEffect, useRef } from "react"
import { useUser, SignOutButton } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import Logo from "@/public/tendso-logo.png"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    ArrowLeft,
    Loader2,
    LogOut,
    ChevronRight,
    User,
    Bell,
    Lock,
    FileText,
    Users,
    Wallet,
    HelpCircle,
    ScrollText,
    ShieldCheck,
    BadgeCheck,
    Gift,
    Award,
    X,
    Download,
} from "lucide-react"
import { toPng } from "html-to-image"
import { BottomNav } from "@/components/BottomNav"

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

export default function ProfilePage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()

    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    const submissions = useQuery(
        api.submissions.getByCreatorId,
        creator?._id ? { creatorId: creator._id } : "skip"
    )

    const applyReferralCode = useMutation(api.creators.applyReferralCode)

    // Referral code modal state
    const [showReferralModal, setShowReferralModal] = useState(false)
    const [referralCodeInput, setReferralCodeInput] = useState("")
    const [referralLoading, setReferralLoading] = useState(false)
    const [referralError, setReferralError] = useState<string | null>(null)
    const [referralSuccess, setReferralSuccess] = useState(false)

    // Certificate modal state
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
        if (isLoaded && !isSignedIn) router.push("/login")
    }, [isLoaded, isSignedIn, router])

    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) router.push("/onboarding")
    }, [isLoaded, isSignedIn, creator, router])

    if (!isLoaded || !isSignedIn || creator === undefined || !creator) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    const initials = `${(creator.firstName || "")[0] || ""}${(creator.lastName || "")[0] || ""}`.toUpperCase()
    const fullName = `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || "Creator"
    const balance = creator.balance || 0
    const totalEarned = creator.totalEarnings || 0
    const submissionCount = submissions?.length || creator.submissionCount || 0

    const formatCurrency = (value: number) =>
        value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const certDate = creator.certifiedAt
        ? new Date(creator.certifiedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : ""

    const handleApplyReferralCode = async () => {
        if (!referralCodeInput.trim() || !creator) return
        setReferralError(null)
        setReferralLoading(true)
        try {
            await applyReferralCode({
                id: creator._id,
                referredByCode: referralCodeInput.trim().toUpperCase(),
            })
            setReferralSuccess(true)
            setTimeout(() => {
                setShowReferralModal(false)
                setReferralSuccess(false)
                setReferralCodeInput("")
            }, 2000)
        } catch (err: any) {
            setReferralError(err.message || "Failed to apply referral code")
        } finally {
            setReferralLoading(false)
        }
    }

    // Build account menu items dynamically
    const accountItems: Array<{ label: string; sublabel: string; icon: any; iconColor?: string; href?: string; onClick?: () => void }> = [
        { label: "Edit Profile", sublabel: "Update your name and details", icon: User, href: "/edit-profile" },
        { label: "Notifications", sublabel: "Manage your notification settings", icon: Bell, href: "/notifications" },
        { label: "Change Password", sublabel: "Update your account password", icon: Lock, href: "/change-password" },
    ]

    // Show "Enter Referral Code" only if creator hasn't applied one yet
    if (!creator.referredByCode) {
        accountItems.push({
            label: "Enter Referral Code",
            sublabel: "Apply a code from another creator",
            icon: Gift,
            iconColor: "text-indigo-500",
            onClick: () => {
                setReferralError(null)
                setReferralCodeInput("")
                setShowReferralModal(true)
            },
        })
    }

    // Show "Show My Certificate" only if certified
    if (creator.certifiedAt) {
        accountItems.push({
            label: "Show My Certificate",
            sublabel: "View your certification",
            icon: Award,
            iconColor: "text-amber-500",
            onClick: () => setShowCertModal(true),
        })
    }

    const menuSections = [
        {
            title: "Account",
            items: accountItems,
        },
        {
            title: "My Activity",
            items: [
                { label: "My Submissions", sublabel: `${submissionCount} total submissions`, icon: FileText, href: "/submissions" },
                { label: "Referrals", sublabel: "View your referral stats", icon: Users, href: "/referrals" },
                { label: "Wallet", sublabel: `₱${formatCurrency(totalEarned)} total earned`, icon: Wallet, href: "/wallet" },
            ],
        },
        {
            title: "Support",
            items: [
                { label: "Help & FAQ", sublabel: "", icon: HelpCircle, href: "/help-faq" },
                { label: "Terms of Service", sublabel: "", icon: ScrollText, href: "/terms-of-service" },
                { label: "Privacy Policy", sublabel: "", icon: ShieldCheck, href: "/privacy-policy" },
            ],
        },
    ]

    return (
        <div
            className="editorial min-h-screen pb-24 overflow-x-hidden"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <main className="px-4 py-6">
                {/* Back Button */}
                <div className="flex items-center justify-between mb-2">
                    <Link
                        href="/dashboard"
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                        style={{
                            background: "var(--ed-paper-3)",
                            border: "1px solid var(--ed-rule)",
                            color: "var(--ed-ink-2)",
                        }}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                </div>

                {/* Editorial eyebrow */}
                <p className="ed-label mt-2">Your Profile</p>

                {/* Profile Header — avatar + serif name */}
                <div className="flex flex-col items-center mt-4 mb-8">
                    {creator.profileImage ? (
                        <div
                            className="w-28 h-28 rounded-full overflow-hidden mb-4"
                            style={{
                                border: "4px solid var(--ed-paper-3)",
                                boxShadow: "var(--ed-shadow-md)",
                            }}
                        >
                            <img src={creator.profileImage} alt={fullName} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div
                            className="w-28 h-28 rounded-full flex items-center justify-center mb-4"
                            style={{
                                background: "var(--ed-ink)",
                                color: "var(--ed-paper-3)",
                                border: "4px solid var(--ed-paper-3)",
                                boxShadow: "var(--ed-shadow-md)",
                                fontFamily: "var(--ed-serif)",
                                fontSize: 36,
                                lineHeight: 1.0,
                            }}
                        >
                            {initials}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <h1
                            style={{
                                fontFamily: "var(--ed-serif)",
                                fontSize: 30,
                                lineHeight: 1.1,
                                letterSpacing: "-0.02em",
                                color: "var(--ed-ink)",
                            }}
                        >
                            {fullName}
                        </h1>
                        {creator.certifiedAt && <BadgeCheck className="w-5 h-5" style={{ color: "var(--ed-accent)" }} />}
                    </div>

                    <p
                        className="mt-1"
                        style={{
                            fontFamily: "var(--ed-sans)",
                            fontSize: 14,
                            color: "var(--ed-ink-3)",
                        }}
                    >
                        {creator.email || user?.primaryEmailAddress?.emailAddress}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        {creator.referralCode && (
                            <div
                                className="px-3 py-1 rounded-full flex items-center gap-1.5"
                                style={{
                                    background: "var(--ed-paper-3)",
                                    border: "1px solid var(--ed-rule)",
                                }}
                            >
                                <Gift className="w-3 h-3" style={{ color: "var(--ed-ink-3)" }} />
                                <span
                                    style={{
                                        fontFamily: "var(--ed-mono)",
                                        fontSize: 11,
                                        letterSpacing: "0.14em",
                                        color: "var(--ed-ink-2)",
                                    }}
                                >
                                    {creator.referralCode}
                                </span>
                            </div>
                        )}

                        {creator.certifiedAt && (
                            <div
                                className="px-3 py-1 rounded-full flex items-center gap-1.5"
                                style={{ background: "var(--ed-accent-bg)" }}
                            >
                                <BadgeCheck className="w-3.5 h-3.5" style={{ color: "var(--ed-accent)" }} />
                                <span
                                    style={{
                                        fontFamily: "var(--ed-mono)",
                                        fontSize: 10,
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        color: "var(--ed-accent-ink)",
                                    }}
                                >
                                    Certified Creator
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Strip — serif numbers + mono labels */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                    {[
                        { value: submissionCount, label: "Submissions" },
                        { value: `₱${formatCurrency(balance)}`, label: "Balance" },
                        { value: `₱${formatCurrency(totalEarned)}`, label: "Earned" },
                    ].map((s, i) => (
                        <div
                            key={i}
                            className="p-4 text-center"
                            style={{
                                background: "var(--ed-paper-3)",
                                border: "1px solid var(--ed-rule)",
                                borderRadius: "var(--ed-radius-md)",
                            }}
                        >
                            <p
                                style={{
                                    fontFamily: "var(--ed-serif)",
                                    fontSize: 22,
                                    lineHeight: 1.0,
                                    fontVariantNumeric: "tabular-nums",
                                    color: "var(--ed-ink)",
                                }}
                            >
                                {s.value}
                            </p>
                            <p className="ed-label mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Menu Sections — paper cards with warm rule dividers */}
                <div className="space-y-6">
                    {menuSections.map((section) => (
                        <div key={section.title}>
                            <p className="ed-label mb-2 px-1">{section.title}</p>
                            <div
                                className="overflow-hidden"
                                style={{
                                    background: "var(--ed-paper-3)",
                                    border: "1px solid var(--ed-rule)",
                                    borderRadius: "var(--ed-radius-md)",
                                }}
                            >
                                {section.items.map((item: any, i: number) => {
                                    const Icon = item.icon
                                    const content = (
                                        <div
                                            className="flex items-center justify-between px-4 py-3.5 transition-colors cursor-pointer"
                                            style={{
                                                borderTop: i === 0 ? "none" : "1px solid var(--ed-rule)",
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon
                                                    className={`w-5 h-5`}
                                                    style={{
                                                        color: item.iconColor ? undefined : "var(--ed-ink-3)",
                                                    }}
                                                />
                                                <div>
                                                    <span
                                                        className="block"
                                                        style={{
                                                            fontFamily: "var(--ed-sans)",
                                                            fontSize: 14,
                                                            color: "var(--ed-ink)",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        {item.label}
                                                    </span>
                                                    {item.sublabel && (
                                                        <span
                                                            style={{
                                                                fontFamily: "var(--ed-mono)",
                                                                fontSize: 10,
                                                                letterSpacing: "0.1em",
                                                                color: "var(--ed-ink-3)",
                                                            }}
                                                        >
                                                            {item.sublabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4" style={{ color: "var(--ed-ink-3)" }} />
                                        </div>
                                    )

                                    if (item.onClick) {
                                        return (
                                            <button key={i} onClick={item.onClick} className="w-full text-left">
                                                {content}
                                            </button>
                                        )
                                    }

                                    return (
                                        <Link key={item.href} href={item.href}>
                                            {content}
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Sign Out */}
                <div className="mt-8">
                    <SignOutButton redirectUrl="/login">
                        <button
                            className="w-full flex items-center justify-center gap-2 h-12 transition-colors"
                            style={{
                                background: "var(--ed-paper-3)",
                                border: "1px solid var(--ed-danger)",
                                borderRadius: "var(--ed-radius-md)",
                                color: "var(--ed-danger)",
                                fontFamily: "var(--ed-sans)",
                                fontWeight: 500,
                                fontSize: 15,
                            }}
                        >
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </button>
                    </SignOutButton>
                </div>

                <p
                    className="text-center mt-8"
                    style={{
                        fontFamily: "var(--ed-mono)",
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--ed-ink-3)",
                    }}
                >
                    Tendso · v1.0.0
                </p>
            </main>

            {/* ==================== REFERRAL CODE MODAL ==================== */}
            {showReferralModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowReferralModal(false)}>
                    <div
                        className="w-full max-w-md bg-white rounded-3xl p-6 pb-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center mb-4">
                            <div className="w-10 h-1 bg-zinc-200 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
                                <Gift className="w-7 h-7 text-indigo-500" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900">Enter Referral Code</h3>
                            <p className="text-sm text-zinc-500 mt-1">Got a code from a fellow creator?</p>
                        </div>

                        {referralSuccess ? (
                            <div className="text-center py-4">
                                <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <BadgeCheck className="w-7 h-7 text-amber-500" />
                                </div>
                                <p className="text-sm font-semibold text-amber-600">Referral code applied!</p>
                            </div>
                        ) : (
                            <>
                                {/* Input */}
                                <div className="mb-4">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Gift className="w-5 h-5 text-zinc-400" />
                                        </div>
                                        <Input
                                            value={referralCodeInput}
                                            onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                                            placeholder="e.g. JUD8A3BK"
                                            className="pl-11 h-12 bg-zinc-50 border-zinc-200 rounded-xl text-center font-mono text-lg tracking-[0.2em] uppercase"
                                            disabled={referralLoading}
                                        />
                                    </div>
                                    {referralError && (
                                        <p className="text-xs text-red-500 mt-2 text-center">{referralError}</p>
                                    )}
                                </div>

                                {/* Buttons */}
                                <Button
                                    onClick={handleApplyReferralCode}
                                    disabled={!referralCodeInput.trim() || referralLoading}
                                    className={`w-full h-12 font-semibold rounded-xl ${referralCodeInput.trim() ? "bg-indigo-500 hover:bg-indigo-600 text-white" : "bg-zinc-200 text-zinc-400"}`}
                                >
                                    {referralLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Apply Code"}
                                </Button>
                                <button
                                    onClick={() => setShowReferralModal(false)}
                                    className="w-full mt-3 text-sm font-medium text-zinc-500 hover:text-zinc-700 text-center"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== CERTIFICATE MODAL ==================== */}
            {showCertModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCertModal(false)}>
                    <div
                        className="w-full max-w-sm bg-white rounded-3xl overflow-hidden max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal header */}
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

                        {/* Certificate content */}
                        <div className="overflow-y-auto p-4">
                            <div ref={certRef}>
                                <CertificateCard name={fullName} date={certDate} />
                            </div>
                        </div>

                        {/* Actions */}
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

            <BottomNav active="profile" />
        </div>
    )
}
