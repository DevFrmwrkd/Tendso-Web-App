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
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        )
    }

    if (!creator) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
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
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md uppercase">
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

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-zinc-900 leading-tight">
                        Referral <span className="text-emerald-500">Program</span>
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Invite creators and earn rewards.</p>
                </div>

                {/* Referral Code Card */}
                <div className="bg-zinc-900 text-white rounded-3xl p-5 relative overflow-hidden shadow-xl shadow-zinc-900/20 mb-6">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                    <div className="relative z-10">
                        <p className="text-zinc-400 text-xs font-medium mb-1">Your Referral Code</p>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-2xl font-bold tracking-widest font-mono">
                                {creator.referralCode}
                            </span>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-semibold transition-colors"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                        <span className="text-zinc-400">Copy</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-zinc-500 text-[10px] mt-3">
                            Share this code with other creators to earn referral bonuses.
                        </p>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-100 text-center">
                        <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <Users className="w-4 h-4 text-zinc-600" />
                        </div>
                        <p className="text-lg font-bold text-zinc-900">{stats?.total || 0}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Referred</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-100 text-center">
                        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                        </div>
                        <p className="text-lg font-bold text-zinc-900">{stats?.qualified || 0}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Qualified</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-100 text-center">
                        <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <Gift className="w-4 h-4 text-yellow-600" />
                        </div>
                        <p className="text-lg font-bold text-zinc-900">
                            PHP {(stats?.totalEarned || 0).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Rewards</p>
                    </div>
                </div>

                {/* Referred Creators */}
                <div className="mb-6">
                    <h2 className="text-base font-bold text-zinc-900 mb-3">Referred Creators</h2>
                    <div className="space-y-3">
                        {referrals && referrals.length > 0 ? (
                            referrals.map((referral: any) => (
                                <div
                                    key={referral._id}
                                    className="bg-white rounded-xl p-3 border border-zinc-100 shadow-sm flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                                            <UserPlus className="w-5 h-5 text-zinc-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm text-zinc-900">
                                                {referral.referredName}
                                            </h3>
                                            <p className="text-[10px] text-zinc-500">
                                                Joined {formatDate(referral.createdAt)}
                                                {referral.bonusAmount
                                                    ? ` · PHP ${referral.bonusAmount.toLocaleString()} bonus`
                                                    : ""}
                                            </p>
                                        </div>
                                    </div>
                                    {getStatusBadge(referral.status)}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                                <p className="text-zinc-500 text-xs">No referrals yet. Share your code to get started!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* How it Works */}
                <div>
                    <h2 className="text-base font-bold text-zinc-900 mb-3">How it Works</h2>
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                                1
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-zinc-900">Share Your Code</h3>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    Give your referral code to fellow creators who want to join Negosyo Digital.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                                2
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-zinc-900">They Sign Up & Submit</h3>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    Your referral signs up using your code and submits their first business.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                                3
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-zinc-900">Earn Your Bonus</h3>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    Once their first submission is approved, you receive a referral bonus in your wallet.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <BottomNav active="referral" />
        </div>
    )
}
