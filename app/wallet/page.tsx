"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    ArrowLeft,
    Wallet,
    Loader2,
    X,
    TrendingUp,
    TrendingDown,
    ArrowDownRight,
    Clock,
    CheckCircle,
    XCircle,
    RefreshCw,
    Mail,
    ExternalLink,
} from "lucide-react"
import { BottomNav } from "@/components/BottomNav"

const WISE_REFERRAL_URL =
    "https://wise.com/invite/dic/theoimmorosalesv?utm_source=desktop-invite-tab-copylink&utm_medium=invite&utm_campaign=&utm_content=&referralCode=theoimmorosalesv"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function WalletPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()
    const [showSetupModal, setShowSetupModal] = useState(false)
    const [showWithdrawModal, setShowWithdrawModal] = useState(false)
    const [amount, setAmount] = useState("")
    const [wiseEmailInput, setWiseEmailInput] = useState("")
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    const earnings = useQuery(
        api.earnings.getByCreator,
        creator?._id ? { creatorId: creator._id } : "skip"
    )

    const earningsSummary = useQuery(
        api.earnings.getSummary,
        creator?._id ? { creatorId: creator._id } : "skip"
    )

    const withdrawals = useQuery(
        api.withdrawals.getByCreator,
        creator?._id ? { creatorId: creator._id } : "skip"
    )

    const createWithdrawal = useMutation(api.withdrawals.create)
    const updateCreator = useMutation(api.creators.update)

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

    // Pre-fill saved Wise email when modals open
    useEffect(() => {
        if (creator?.wiseEmail && !wiseEmailInput) {
            setWiseEmailInput(creator.wiseEmail)
        }
    }, [creator?.wiseEmail]) // eslint-disable-line react-hooks/exhaustive-deps

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

    const balance = creator.balance || 0
    const totalEarned = earningsSummary?.total || creator.totalEarnings || 0
    const totalWithdrawn = earningsSummary?.withdrawn || creator.totalWithdrawn || 0

    const handleStartWithdraw = () => {
        setError("")
        if (creator.wiseEmail) {
            setWiseEmailInput(creator.wiseEmail)
            setShowWithdrawModal(true)
        } else {
            setShowSetupModal(true)
        }
    }

    const handleSaveWiseEmail = async () => {
        setError("")
        const normalized = wiseEmailInput.trim().toLowerCase()
        if (!EMAIL_REGEX.test(normalized)) {
            setError("Please enter a valid email address.")
            return
        }
        try {
            setIsSubmitting(true)
            await updateCreator({ id: creator._id, wiseEmail: normalized })
            setWiseEmailInput(normalized)
            setShowSetupModal(false)
            setShowWithdrawModal(true)
        } catch (err: any) {
            setError(err.message || "Failed to save Wise email. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleWithdraw = async () => {
        setError("")

        const withdrawAmount = parseFloat(amount)
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
            setError("Withdrawal amount must be greater than zero.")
            return
        }
        if (withdrawAmount > balance) {
            setError("Insufficient balance.")
            return
        }
        const normalizedEmail = wiseEmailInput.trim().toLowerCase()
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            setError("Please enter a valid Wise email address.")
            return
        }

        try {
            setIsSubmitting(true)
            // Persist updated Wise email on the creator profile so it's remembered next time
            if (normalizedEmail !== creator.wiseEmail) {
                await updateCreator({ id: creator._id, wiseEmail: normalizedEmail })
            }
            await createWithdrawal({
                creatorId: creator._id,
                amount: withdrawAmount,
                payoutMethod: "wise_email",
                accountDetails: normalizedEmail,
            })
            setShowWithdrawModal(false)
            setAmount("")
        } catch (err: any) {
            setError(err.message || "Withdrawal failed. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const getWithdrawalStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md uppercase">
                        <CheckCircle className="w-3 h-3" /> Completed
                    </span>
                )
            case "processing":
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md uppercase">
                        <RefreshCw className="w-3 h-3" /> Processing
                    </span>
                )
            case "failed":
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-md uppercase">
                        <XCircle className="w-3 h-3" /> Failed
                    </span>
                )
            default:
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-md uppercase">
                        <Clock className="w-3 h-3" /> Pending
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

    const formatCurrency = (value: number) => {
        return value.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
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
                    <p className="ed-label">§ Wallet · Withdrawals</p>
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
                        Your <em style={{ color: "var(--ed-accent)" }}>earnings.</em>
                    </h1>
                    <p
                        className="mt-2"
                        style={{
                            fontFamily: "var(--ed-sans)",
                            fontSize: 14,
                            color: "var(--ed-ink-2)",
                            lineHeight: 1.55,
                            maxWidth: "44ch",
                        }}
                    >
                        Track what you&apos;ve made, request a payout to Wise, see every transaction.
                    </p>
                </div>

                {/* Balance hero — ink with serif amount */}
                <div
                    className="rounded-3xl p-6 relative overflow-hidden mb-6"
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

                    <div className="mb-5 relative z-10 flex items-baseline gap-2">
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
                            {formatCurrency(balance)}
                        </span>
                    </div>

                    <div
                        className="flex gap-6 relative z-10 pt-4"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--ed-accent-solid)" }} />
                            <div>
                                <p style={{ fontFamily: "var(--ed-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(252,250,245,0.55)" }}>
                                    Earned
                                </p>
                                <p style={{ fontFamily: "var(--ed-serif)", fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
                                    ₱{formatCurrency(totalEarned)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingDown className="w-3.5 h-3.5" style={{ color: "#f4a261" }} />
                            <div>
                                <p style={{ fontFamily: "var(--ed-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(252,250,245,0.55)" }}>
                                    Withdrawn
                                </p>
                                <p style={{ fontFamily: "var(--ed-serif)", fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
                                    ₱{formatCurrency(totalWithdrawn)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Withdraw door — accent variant */}
                <Button
                    onClick={handleStartWithdraw}
                    disabled={balance <= 0}
                    className="ed-door ed-door-accent w-full mb-2"
                    style={{ minHeight: 52, justifyContent: "center", fontSize: 15 }}
                >
                    <ArrowDownRight className="w-5 h-5 mr-2" />
                    Withdraw Funds
                </Button>
                <p
                    className="text-center mb-6"
                    style={{
                        fontFamily: "var(--ed-sans)",
                        fontSize: 11,
                        color: "var(--ed-ink-3)",
                    }}
                >
                    Paid via Wise to{" "}
                    <span style={{ fontWeight: 600, color: "var(--ed-ink-2)" }}>
                        {creator.wiseEmail || "your Wise email"}
                    </span>
                    . You receive the full amount — Wise transfer fees are on us.
                </p>

                {/* Recent Earnings */}
                <div className="mb-6">
                    <p className="ed-label">§ History</p>
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
                        Recent <em style={{ color: "var(--ed-accent)" }}>earnings</em>
                    </h2>
                    <div className="space-y-3">
                        {earnings && earnings.length > 0 ? (
                            earnings.slice(0, 10).map((earning: any) => (
                                <div
                                    key={earning._id}
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
                                            style={{ background: "var(--ed-accent-bg)" }}
                                        >
                                            <TrendingUp className="w-5 h-5" style={{ color: "var(--ed-accent)" }} />
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
                                                {earning.businessName}
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
                                                {earning.type === "submission_approved"
                                                    ? "Submission"
                                                    : earning.type === "referral_bonus"
                                                      ? "Referral"
                                                      : "Lead"}{" "}
                                                · {formatDate(earning.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        style={{
                                            fontFamily: "var(--ed-serif)",
                                            fontSize: 18,
                                            fontVariantNumeric: "tabular-nums",
                                            color: "var(--ed-accent)",
                                        }}
                                    >
                                        +₱{formatCurrency(earning.amount)}
                                    </span>
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
                                    No earnings yet.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Withdrawal History */}
                <div>
                    <h2 className="text-base font-bold text-zinc-900 mb-3">Withdrawal History</h2>
                    <div className="space-y-3">
                        {withdrawals && withdrawals.length > 0 ? (
                            withdrawals.map((withdrawal: any) => {
                                // Prefer the persisted wiseEmail column; fall back to accountDetails
                                // (which is the raw email for wise_email withdrawals).
                                const wiseEmail =
                                    withdrawal.wiseEmail ||
                                    (withdrawal.payoutMethod === "wise_email"
                                        ? withdrawal.accountDetails
                                        : null)
                                const label = wiseEmail
                                    ? `Wise: ${wiseEmail}`
                                    : "Wise Transfer"

                                return (
                                    <div
                                        key={withdrawal._id}
                                        className="bg-white rounded-xl p-3 border border-zinc-100 shadow-sm flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                                                <ArrowDownRight className="w-5 h-5 text-zinc-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-sm text-zinc-900">
                                                    PHP {formatCurrency(withdrawal.amount)}
                                                </h3>
                                                <p className="text-[10px] text-zinc-500 truncate">
                                                    {label} · {formatDate(withdrawal.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        {getWithdrawalStatusBadge(withdrawal.status)}
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-center py-6 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                                <p className="text-zinc-500 text-xs">No withdrawals yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Wise Setup Modal — first-time Wise email capture */}
            {showSetupModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 pb-10 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Mail className="w-4 h-4 text-amber-600" />
                                </div>
                                <h2 className="text-lg font-bold text-zinc-900">Set up Wise payouts</h2>
                            </div>
                            <button
                                onClick={() => {
                                    setShowSetupModal(false)
                                    setError("")
                                }}
                                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-sm text-zinc-600 mb-5">
                            We&apos;ll send your earnings to your Wise account by email. Enter the email
                            you use (or plan to use) on Wise — we&apos;ll remember it for next time.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="setupEmail" className="text-sm font-semibold text-zinc-700">
                                    Wise account email
                                </Label>
                                <Input
                                    id="setupEmail"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={wiseEmailInput}
                                    onChange={(e) => setWiseEmailInput(e.target.value)}
                                    className="mt-1 rounded-xl border-zinc-200 focus:border-amber-500 focus:ring-amber-500"
                                />
                            </div>

                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-zinc-700 space-y-2">
                                <p className="font-semibold text-amber-700">
                                    Don&apos;t have a Wise account yet?
                                </p>
                                <p>
                                    Wise is free. Sign up with our referral link — you and Tendso
                                    both get a bonus when your first payout clears.
                                </p>
                                <a
                                    href={WISE_REFERRAL_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-800"
                                >
                                    Sign up on Wise <ExternalLink className="w-3 h-3" />
                                </a>
                                <p className="text-zinc-500">
                                    Then come back and enter the same email here.
                                </p>
                            </div>

                            {error && (
                                <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-xl">{error}</p>
                            )}

                            <Button
                                onClick={handleSaveWiseEmail}
                                disabled={isSubmitting}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl h-12 shadow-lg shadow-amber-500/20"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    "Save & Continue"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 pb-10 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-zinc-900">Withdraw Funds</h2>
                            <button
                                onClick={() => {
                                    setShowWithdrawModal(false)
                                    setError("")
                                }}
                                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="bg-zinc-50 rounded-xl p-3 mb-5 text-center">
                            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Available Balance</p>
                            <p className="text-xl font-bold text-zinc-900">PHP {formatCurrency(balance)}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="amount" className="text-sm font-semibold text-zinc-700">
                                    Amount (PHP)
                                </Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    min={1}
                                    max={balance}
                                    placeholder="Any positive amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="mt-1 rounded-xl border-zinc-200 focus:border-amber-500 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <Label htmlFor="wiseEmail" className="text-sm font-semibold text-zinc-700">
                                    Wise account email
                                </Label>
                                <Input
                                    id="wiseEmail"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={wiseEmailInput}
                                    onChange={(e) => setWiseEmailInput(e.target.value)}
                                    className="mt-1 rounded-xl border-zinc-200 focus:border-amber-500 focus:ring-amber-500"
                                />
                                <p className="text-[11px] text-zinc-500 mt-1">
                                    Must match the email on your Wise account. If you don&apos;t have one,{" "}
                                    <a
                                        href={WISE_REFERRAL_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-amber-600 hover:text-amber-700 underline"
                                    >
                                        sign up with our referral link
                                    </a>{" "}
                                    first — otherwise you have 7 days to claim via email before the transfer
                                    auto-refunds.
                                </p>
                            </div>

                            {error && (
                                <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-xl">{error}</p>
                            )}

                            <Button
                                onClick={handleWithdraw}
                                disabled={isSubmitting}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl h-12 shadow-lg shadow-amber-500/20"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    "Submit Withdrawal"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <BottomNav active="wallet" />
        </div>
    )
}
