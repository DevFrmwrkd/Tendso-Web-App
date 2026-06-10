"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AlertCircle, CheckCircle, Clock, Copy } from "lucide-react"
import { getPaymentConfig } from "@/lib/payment/config"

const paymentConfig = getPaymentConfig()

export default function PaymentPage() {
    const params = useParams()
    const token = params.token as string
    const [copied, setCopied] = useState(false)

    // Fetch payment token
    const paymentToken = useQuery(api.paymentTokens.getByToken, { token })

    // Fetch submission details
    const submission = useQuery(
        api.submissions.getById,
        paymentToken?.submissionId ? { id: paymentToken.submissionId } : "skip"
    )

    const wiseEmail = paymentConfig.wiseEmail || "support@negosyo.digital"
    const isExpired = paymentToken && paymentToken.expiresAt < Date.now()
    const isUsed = paymentToken?.status === "paid"
    const isPending = paymentToken?.status === "pending"
    const isValid = isPending && !isExpired

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (!paymentToken && paymentToken !== null) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
        )
    }

    if (!paymentToken) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
                <div className="max-w-md w-full">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Payment Link Not Found</h1>
                        <p className="text-zinc-500 mb-6">
                            This payment link is invalid or has expired. Please contact support.
                        </p>
                        <Link
                            href="/"
                            className="inline-block px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
                        >
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/" className="text-amber-600 hover:text-amber-700 font-medium text-sm mb-4 inline-block">
                        ← Back
                    </Link>
                    <h1 className="text-4xl font-bold text-zinc-900 mb-2">Complete Payment</h1>
                    <p className="text-zinc-500 text-lg">
                        {submission?.businessName} • Final step to activate your website
                    </p>
                </div>

                {/* Status alerts */}
                {isUsed && (
                    <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                        <CheckCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-amber-900 mb-1">Payment Already Received</h3>
                            <p className="text-amber-700 text-sm">
                                Your payment has been confirmed. Your website is now live!
                            </p>
                        </div>
                    </div>
                )}

                {isExpired && (
                    <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                        <Clock className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-amber-900 mb-1">Payment Link Expired</h3>
                            <p className="text-amber-700 text-sm">
                                This payment link has expired. Please contact support to request a new one.
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-8 mb-8">
                    {/* Left: Payment Details */}
                    <div className="md:col-span-2">
                        {/* Amount */}
                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-8 mb-8 border border-amber-200">
                            <p className="text-amber-700 text-sm font-semibold uppercase tracking-wider mb-2">Total Amount</p>
                            <p className="text-5xl font-bold text-amber-900">
                                ₱{paymentToken.amount.toLocaleString("en-PH")}
                            </p>
                        </div>

                        {/* Wise Account Details */}
                        <div className="bg-zinc-50 rounded-2xl p-8 border border-zinc-200 mb-8">
                            <h2 className="text-lg font-bold text-zinc-900 mb-6">Send Payment Via Wise</h2>

                            <div className="space-y-6">
                                {/* Recipient */}
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-3 uppercase tracking-wider">
                                        Recipient Email / ID
                                    </label>
                                    <div className="flex gap-3">
                                        <div className="flex-1 bg-white border border-zinc-300 rounded-lg px-4 py-3 font-mono text-sm text-zinc-900">
                                            {wiseEmail}
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(wiseEmail)}
                                            className="px-4 py-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors font-medium flex items-center gap-2"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-3 uppercase tracking-wider">
                                        Amount to Send
                                    </label>
                                    <div className="flex gap-3">
                                        <div className="flex-1 bg-white border border-zinc-300 rounded-lg px-4 py-3 font-mono text-sm text-zinc-900">
                                            ₱{paymentToken.amount.toLocaleString("en-PH")}
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(`₱${paymentToken.amount.toLocaleString("en-PH")}`)}
                                            className="px-4 py-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors font-medium flex items-center gap-2"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Reference Code */}
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-3 uppercase tracking-wider">
                                        Reference Code
                                    </label>
                                    <p className="text-sm text-zinc-600 mb-3">
                                        ⚠️ Always include this code when sending payment so we can match it to your account.
                                    </p>
                                    <div className="flex gap-3">
                                        <div className="flex-1 bg-white border-2 border-amber-200 rounded-lg px-4 py-3 font-mono text-lg font-bold text-amber-600">
                                            {paymentToken.referenceCode}
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(paymentToken.referenceCode)}
                                            className="px-4 py-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <Copy className="w-4 h-4" />
                                            {copied ? "Copied!" : "Copy"}
                                        </button>
                                    </div>
                                </div>

                                {/* Currency */}
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-3 uppercase tracking-wider">
                                        Currency
                                    </label>
                                    <div className="bg-white border border-zinc-300 rounded-lg px-4 py-3 text-sm text-zinc-900">
                                        PHP (Philippine Peso)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="bg-blue-50 rounded-2xl p-8 border border-blue-200">
                            <h3 className="text-lg font-bold text-blue-900 mb-4">How to Send Payment</h3>
                            <ol className="space-y-3 text-blue-900">
                                <li className="flex gap-3">
                                    <span className="font-bold text-blue-600 flex-shrink-0">1.</span>
                                    <span>Open your Wise app</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-blue-600 flex-shrink-0">2.</span>
                                    <span>Send money to the email/ID above</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
                                    <span>
                                        Enter exactly <strong className="font-mono">₱{paymentToken.amount.toLocaleString("en-PH")}</strong>
                                    </span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-blue-600 flex-shrink-0">4.</span>
                                    <span>
                                        Add reference code in the notes: <strong className="font-mono">{paymentToken.referenceCode}</strong>
                                    </span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-blue-600 flex-shrink-0">5.</span>
                                    <span>Confirm and send!</span>
                                </li>
                            </ol>
                        </div>
                    </div>

                    {/* Right: Timeline/Status */}
                    <div className="md:col-span-1">
                        <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-200 sticky top-8">
                            <h3 className="font-bold text-zinc-900 mb-6">Payment Status</h3>

                            <div className="space-y-4">
                                {/* Step 1 */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isValid ? "bg-amber-100 text-amber-700" : "bg-zinc-200 text-zinc-500"}`}>
                                            ✓
                                        </div>
                                        <div className="w-1 h-12 bg-zinc-200 my-1"></div>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-zinc-900">Payment Link Generated</p>
                                        <p className="text-sm text-zinc-500">{new Date(paymentToken.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isUsed ? "bg-amber-100 text-amber-700" : "bg-zinc-200 text-zinc-500"}`}>
                                            {isUsed ? "✓" : "2"}
                                        </div>
                                        <div className="w-1 h-12 bg-zinc-200 my-1"></div>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-zinc-900">Awaiting Payment</p>
                                        <p className="text-sm text-zinc-500">
                                            Expires: {new Date(paymentToken.expiresAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isUsed ? "bg-amber-100 text-amber-700" : "bg-zinc-200 text-zinc-500"}`}>
                                            {isUsed ? "✓" : "3"}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-zinc-900">Website Goes Live</p>
                                        <p className="text-sm text-zinc-500">
                                            {isUsed ? "Activated!" : "When payment confirmed"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Expiry warning */}
                            {isPending && !isExpired && (
                                <div className="mt-6 pt-6 border-t border-zinc-200">
                                    <p className="text-xs text-amber-700 font-semibold mb-2">⏰ TIME REMAINING</p>
                                    <p className="text-sm font-bold text-amber-900">
                                        {Math.ceil((paymentToken.expiresAt - Date.now()) / (1000 * 60 * 60))} hours left
                                    </p>
                                </div>
                            )}

                            {/* Support */}
                            <div className="mt-6 pt-6 border-t border-zinc-200">
                                <p className="text-xs text-zinc-600 mb-2">Need help?</p>
                                <a
                                    href="mailto:frmwrkd.media@gmail.com"
                                    className="text-amber-600 hover:text-amber-700 font-semibold text-sm"
                                >
                                    Contact Support
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile: Open Wise link (if we can deep link) */}
                {isValid && (
                    <div className="mt-8 text-center">
                        <a
                            href={`https://wise.com/send?recipient=${encodeURIComponent(wiseEmail)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors"
                        >
                            Open Wise App to Send →
                        </a>
                    </div>
                )}
            </div>
        </div>
    )
}
