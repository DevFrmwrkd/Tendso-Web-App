"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import {
    ArrowLeft,
    Loader2,
    Copy,
    Check,
    Users,
    CheckCircle,
    Gift,
    Clock,
    UserPlus,
    Star,
    Banknote,
} from "lucide-react"
import { BottomNav } from "@/components/BottomNav"

export default function ReferralsPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()
    const [copied, setCopied] = useState(false)

    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    const referrals = useQuery(
        api.referrals.getByReferrer,
        creator?._id ? { referrerId: creator._id } : "skip"
    )

    const stats = useQuery(
        api.referrals.getStats,
        creator?._id ? { referrerId: creator._id } : "skip"
    )

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) {
            router.push("/onboarding")
        }
    }, [isLoaded, isSignedIn, creator, router])

    if (!isLoaded || !isSignedIn || creator === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    if (!creator) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(creator.referralCode || '')
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // fallback
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "qualified":
                return (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md uppercase">
                        Qualified
                    </span>
                )
            case "paid":
                return (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md uppercase">
                        Paid
                    </span>
                )
            default:
                return (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-md uppercase">
                        Pending
                    </span>
                )
        }
    }

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

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

                {/* Editorial header */}
                <div className="mb-6 mt-2">
                    <p className="ed-label">Referral Program</p>
                    <h1
                        className="mt-2"
                        style={{
                            fontFamily: "var(--ed-serif)",
                            fontSize: 40,
                            lineHeight: 1.05,
                            letterSpacing: "-0.02em",
                            color: "var(--ed-ink)",
                        }}
                    >
                        Bring a creator, <em style={{ color: "var(--ed-accent)" }}>earn for years.</em>
                    </h1>
                    <p
                        className="mt-2"
                        style={{
                            fontFamily: "var(--ed-sans)",
                            fontSize: 14,
                            color: "var(--ed-ink-2)",
                            lineHeight: 1.55,
                            maxWidth: "48ch",
                        }}
                    >
                        Share your code with a fellow creator. When their first submission lands, you both get paid.
                    </p>
                </div>

                {/* Referral Code Card — ink with mono code + copy door */}
                <div
                    className="rounded-3xl p-6 relative overflow-hidden mb-6"
                    style={{
                        background: "var(--ed-ink)",
                        color: "var(--ed-paper-3)",
                        boxShadow: "var(--ed-shadow-md)",
                    }}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" style={{ background: "rgba(16, 185, 129, 0.12)" }}></div>

                    <div className="relative z-10">
                        <p
                            style={{
                                fontFamily: "var(--ed-mono)",
                                fontSize: 11,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "rgba(252,250,245,0.55)",
                            }}
                        >
                            Your Referral Code
                        </p>
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                            <span
                                style={{
                                    fontFamily: "var(--ed-serif)",
                                    fontSize: 40,
                                    lineHeight: 1.0,
                                    letterSpacing: "0.1em",
                                }}
                            >
                                {creator.referralCode}
                            </span>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors"
                                style={{
                                    background: "rgba(255,255,255,0.06)",
                                    fontFamily: "var(--ed-mono)",
                                    fontSize: 10,
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                }}
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-3.5 h-3.5" style={{ color: "var(--ed-accent-solid)" }} />
                                        <span style={{ color: "var(--ed-accent-solid)" }}>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5" style={{ color: "rgba(252,250,245,0.6)" }} />
                                        <span style={{ color: "rgba(252,250,245,0.6)" }}>Copy</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <p
                            className="mt-4"
                            style={{
                                fontFamily: "var(--ed-sans)",
                                fontSize: 12,
                                color: "rgba(252,250,245,0.55)",
                                lineHeight: 1.5,
                            }}
                        >
                            Share this with other creators. When they sign up + land their first paid submission, ₱1,000 lands in your wallet.
                        </p>
                    </div>
                </div>

                {/* Stats Row — paper-3 cards with mono labels + serif numbers */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { Icon: Users, value: stats?.total ?? 0, label: "Referred", tone: "ink" as const },
                        { Icon: CheckCircle, value: stats?.qualified ?? 0, label: "Qualified", tone: "accent" as const },
                        { Icon: Gift, value: `₱${(stats?.totalEarned ?? 0).toLocaleString()}`, label: "Rewards", tone: "warn" as const },
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
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
                                style={{
                                    background:
                                        s.tone === "accent" ? "var(--ed-accent-bg)" :
                                        s.tone === "warn" ? "var(--ed-warn-bg)" :
                                        "var(--ed-paper-2)",
                                }}
                            >
                                <s.Icon
                                    className="w-4 h-4"
                                    style={{
                                        color:
                                            s.tone === "accent" ? "var(--ed-accent)" :
                                            s.tone === "warn" ? "var(--ed-warn)" :
                                            "var(--ed-ink-2)",
                                    }}
                                />
                            </div>
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

                {/* Referred Creators */}
                <div className="mb-6">
                    <p className="ed-label">Your tree</p>
                    <h2
                        className="mt-1 mb-3"
                        style={{
                            fontFamily: "var(--ed-serif)",
                            fontSize: 22,
                            lineHeight: 1.15,
                            letterSpacing: "-0.015em",
                            color: "var(--ed-ink)",
                        }}
                    >
                        Referred <em style={{ color: "var(--ed-accent)" }}>creators</em>
                    </h2>
                    <div className="space-y-3">
                        {referrals && referrals.length > 0 ? (
                            referrals.map((referral: any) => (
                                <div
                                    key={referral._id}
                                    className="p-3 flex items-center justify-between"
                                    style={{
                                        background: "var(--ed-paper-3)",
                                        border: "1px solid var(--ed-rule)",
                                        borderRadius: "var(--ed-radius-md)",
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                            style={{ background: "var(--ed-paper-2)" }}
                                        >
                                            <UserPlus className="w-5 h-5" style={{ color: "var(--ed-ink-2)" }} />
                                        </div>
                                        <div>
                                            <h3
                                                style={{
                                                    fontFamily: "var(--ed-serif)",
                                                    fontSize: 16,
                                                    lineHeight: 1.2,
                                                    color: "var(--ed-ink)",
                                                }}
                                            >
                                                {referral.referredName}
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
                                                Joined {formatDate(referral.createdAt)}
                                                {referral.bonusAmount
                                                    ? ` · ₱${referral.bonusAmount.toLocaleString()} bonus`
                                                    : ""}
                                            </p>
                                        </div>
                                    </div>
                                    {getStatusBadge(referral.status)}
                                </div>
                            ))
                        ) : (
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
                                    No referrals yet.
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
                                    Share your code to get started
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* How it Works */}
                <div>
                    <p className="ed-label">How it works</p>
                    <h2
                        className="mt-1 mb-4"
                        style={{
                            fontFamily: "var(--ed-serif)",
                            fontSize: 22,
                            lineHeight: 1.15,
                            letterSpacing: "-0.015em",
                            color: "var(--ed-ink)",
                        }}
                    >
                        Three <em style={{ color: "var(--ed-accent)" }}>steps</em>.
                    </h2>
                    <div className="space-y-4">
                        {[
                            { n: "01", title: "Share your code", body: "Give your code to fellow creators who want to join Tendso." },
                            { n: "02", title: "They sign up & submit", body: "Your referral signs up using your code and submits their first business." },
                            { n: "03", title: "Earn your bonus", body: "Once their first submission is paid, ₱1,000 lands in your wallet." },
                        ].map((step) => (
                            <div
                                key={step.n}
                                className="flex gap-4 p-4"
                                style={{
                                    background: "var(--ed-paper-3)",
                                    border: "1px solid var(--ed-rule)",
                                    borderRadius: "var(--ed-radius-md)",
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: "var(--ed-serif)",
                                        fontSize: 28,
                                        lineHeight: 1.0,
                                        color: "var(--ed-accent)",
                                        flexShrink: 0,
                                    }}
                                >
                                    {step.n}
                                </span>
                                <div>
                                    <h3
                                        style={{
                                            fontFamily: "var(--ed-serif)",
                                            fontSize: 17,
                                            lineHeight: 1.2,
                                            color: "var(--ed-ink)",
                                        }}
                                    >
                                        {step.title}
                                    </h3>
                                    <p
                                        className="mt-1"
                                        style={{
                                            fontFamily: "var(--ed-sans)",
                                            fontSize: 13,
                                            color: "var(--ed-ink-2)",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        {step.body}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <BottomNav active="referral" />
        </div>
    )
}
