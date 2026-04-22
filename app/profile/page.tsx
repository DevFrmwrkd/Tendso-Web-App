"use client"

import { useState, useEffect, useRef } from "react"
import { useUser, SignOutButton } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import Logo from "@/public/logo.png"
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
            <div className="bg-emerald-500 py-4 px-6 text-center">
                <div className="flex justify-center mb-1">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <Image src={Logo} alt="Logo" width={20} height={20} className="opacity-90" />
                    </div>
                </div>
                <p className="text-white text-xs font-bold tracking-[0.2em] uppercase">Negosyo Digital</p>
            </div>
            <div className="px-6 py-8 text-center space-y-5">
                <div className="flex justify-center">
                    <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                        <Award className="w-7 h-7 text-emerald-500" />
                    </div>
                </div>
                <div>
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-[0.2em] mb-1">Certificate of Completion</p>
                    <h2 className="text-xl font-bold text-zinc-900">Certified Creator</h2>
                </div>
                <div className="flex justify-center">
                    <div className="w-12 h-0.5 bg-emerald-400 rounded-full" />
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
            <div className="bg-emerald-500 py-3 text-center">
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
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
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
            iconColor: "text-emerald-500",
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
        <div className="min-h-screen bg-white font-sans pb-24 overflow-x-hidden">
            <main className="px-4 py-6">
                {/* Back Button */}
                <div className="flex items-center justify-between mb-2">
                    <Link
                        href="/dashboard"
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                </div>

                {/* Profile Header */}
                <div className="flex flex-col items-center mt-2 mb-6">
                    {creator.profileImage ? (
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg mb-3">
                            <img src={creator.profileImage} alt={fullName} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg mb-3">
                            {initials}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-zinc-900">{fullName}</h1>
                        {creator.certifiedAt && <BadgeCheck className="w-5 h-5 text-emerald-500" />}
                    </div>

                    <p className="text-sm text-zinc-500 mt-0.5">{creator.email || user?.primaryEmailAddress?.emailAddress}</p>

                    {creator.referralCode && (
                        <div className="mt-2 px-3 py-1 bg-zinc-100 rounded-full flex items-center gap-1.5">
                            <Gift className="w-3 h-3 text-zinc-400" />
                            <span className="text-xs font-bold text-zinc-900 font-mono tracking-wider">
                                {creator.referralCode}
                            </span>
                        </div>
                    )}

                    {creator.certifiedAt && (
                        <div className="mt-2 px-3 py-1 bg-emerald-50 rounded-full flex items-center gap-1.5">
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                                Certified Creator
                            </span>
                        </div>
                    )}
                </div>

                {/* Stats Strip */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-100 text-center">
                        <p className="text-lg font-bold text-zinc-900">{submissionCount}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Submissions</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-100 text-center">
                        <p className="text-lg font-bold text-zinc-900">₱{formatCurrency(balance)}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Balance</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-100 text-center">
                        <p className="text-lg font-bold text-zinc-900">₱{formatCurrency(totalEarned)}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Earned</p>
                    </div>
                </div>

                {/* Menu Sections */}
                <div className="space-y-5">
                    {menuSections.map((section) => (
                        <div key={section.title}>
                            <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">
                                {section.title}
                            </h2>
                            <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden divide-y divide-zinc-100">
                                {section.items.map((item: any, i: number) => {
                                    const Icon = item.icon
                                    const content = (
                                        <div className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer">
                                            <div className="flex items-center gap-3">
                                                <Icon className={`w-5 h-5 ${item.iconColor || "text-zinc-400"}`} />
                                                <div>
                                                    <span className="text-sm font-medium text-zinc-900 block">{item.label}</span>
                                                    {item.sublabel && (
                                                        <span className="text-[11px] text-zinc-400">{item.sublabel}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-zinc-300" />
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
                <div className="mt-6">
                    <SignOutButton redirectUrl="/login">
                        <button className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border border-red-200 bg-white text-red-500 hover:bg-red-50 font-semibold transition-colors">
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </button>
                    </SignOutButton>
                </div>

                {/* Version */}
                <p className="text-center text-[11px] text-zinc-300 mt-6">Negosyo Digital v1.0.0</p>
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
                                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <BadgeCheck className="w-7 h-7 text-emerald-500" />
                                </div>
                                <p className="text-sm font-semibold text-emerald-600">Referral code applied!</p>
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
                                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
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
