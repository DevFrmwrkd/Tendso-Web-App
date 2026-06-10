"use client"

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import AdminLayout from '../../../components/AdminLayout'
import {
    ArrowLeft,
    Globe,
    Search,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle,
    ExternalLink,
    Clock,
    CreditCard,
} from 'lucide-react'

interface PaymentMethodStatus {
    connected: boolean
    brand?: string
    lastFour?: string
    error?: string
}

interface DomainCheckResult {
    valid: boolean
    available?: boolean
    domain?: string
    priceUSD?: number
    pricePHP?: number
    withinBudget?: boolean
    premium?: boolean
    reason?: string
    error?: string
    suggestions?: Array<{
        domain: string
        priceUSD: number
        pricePHP: number
        withinBudget: boolean
    }>
}

type StatusBadge = {
    label: string
    color: string
    icon: any
}

const STATUS_BADGES: Record<string, StatusBadge> = {
    not_requested: { label: 'No domain', color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Globe },
    pending_payment: { label: 'Awaiting payment', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
    registering: { label: 'Registering', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Loader2 },
    configuring_dns: { label: 'Configuring DNS', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Loader2 },
    provisioning_ssl: { label: 'Provisioning SSL', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Loader2 },
    live: { label: 'Live', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
}

export default function CustomDomainPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: submissionId } = use(params)
    const router = useRouter()

    const submission = useQuery(api.submissions.getById, { id: submissionId as Id<'submissions'> })
    const domainInfo = useQuery(api.domains.getSubmissionDomainInfo, {
        submissionId: submissionId as Id<'submissions'>,
    })

    const [domainInput, setDomainInput] = useState('')
    const [checking, setChecking] = useState(false)
    const [result, setResult] = useState<DomainCheckResult | null>(null)
    const [purchasing, setPurchasing] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [paymentStatus, setPaymentStatus] = useState<PaymentMethodStatus | null>(null)

    // Fetch Hostinger payment method status on mount
    useEffect(() => {
        fetch('/api/admin/hostinger-status')
            .then((r) => r.json())
            .then((data) => setPaymentStatus(data))
            .catch(() => setPaymentStatus({ connected: false, error: 'Failed to fetch' }))
    }, [])

    useEffect(() => {
        if (domainInfo?.requestedDomain && !domainInput) {
            setDomainInput(domainInfo.requestedDomain)
        }
    }, [domainInfo?.requestedDomain])

    const handleCheck = async (domain?: string) => {
        const target = (domain ?? domainInput).trim().toLowerCase()
        if (!target) return

        setChecking(true)
        setResult(null)
        setMessage(null)

        try {
            const response = await fetch('/api/admin/check-domain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: target, maxBudgetPHP: 500 }),
            })
            const data = await response.json()
            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Check failed' })
            } else {
                setResult(data)
                if (domain) setDomainInput(domain)
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Network error' })
        } finally {
            setChecking(false)
        }
    }

    const handlePurchase = async () => {
        if (!result?.available || !result?.domain) return
        if (!confirm(`Purchase ${result.domain} for ₱${result.pricePHP}?\n\nThis will:\n1. Register the domain via Hostinger (year 1 included, auto-renewal disabled)\n2. Create a Cloudflare zone\n3. Attach it to the website\n4. Wait for SSL\n\nTotal time: 2-6 minutes.`)) return

        setPurchasing(true)
        setMessage(null)

        try {
            const response = await fetch('/api/admin/purchase-domain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submissionId,
                    domain: result.domain,
                }),
            })
            const data = await response.json()
            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Purchase failed' })
            } else {
                setMessage({ type: 'success', text: data.message || 'Purchase started' })
                setResult(null)
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Network error' })
        } finally {
            setPurchasing(false)
        }
    }

    if (!submission) {
        return (
            <AdminLayout>
                <div className="p-8 text-center text-gray-500">Loading submission...</div>
            </AdminLayout>
        )
    }

    const currentStatus = domainInfo?.domainStatus || 'not_requested'
    const badge = STATUS_BADGES[currentStatus]
    const BadgeIcon = badge.icon
    const isInProgress = ['registering', 'configuring_dns', 'provisioning_ssl'].includes(currentStatus)

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto p-6 lg:p-8">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        href={`/admin/submissions/${submissionId}`}
                        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-3"
                    >
                        <ArrowLeft size={16} />
                        Back to submission
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                            <Globe className="text-amber-600" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Custom Domain</h1>
                            <p className="text-sm text-gray-500">
                                {submission.businessName} · Purchase and configure a custom domain
                            </p>
                        </div>
                    </div>
                </div>

                {/* Hostinger Payment Method Widget */}
                <div className={`mb-4 p-4 rounded-2xl border flex items-center justify-between ${
                    paymentStatus?.connected
                        ? 'bg-white border-amber-500'
                        : 'bg-red-50 border-red-300'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${paymentStatus?.connected ? 'bg-amber-50' : 'bg-red-100'}`}>
                            <CreditCard className={paymentStatus?.connected ? 'text-amber-600' : 'text-red-600'} size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hostinger Payment Method</p>
                            {paymentStatus === null ? (
                                <p className="text-sm text-gray-500">Checking…</p>
                            ) : paymentStatus.connected ? (
                                <p className="text-sm font-semibold text-gray-900">{paymentStatus.brand} ****{paymentStatus.lastFour}</p>
                            ) : (
                                <p className="text-sm font-semibold text-red-700">{paymentStatus.error || 'Not configured'}</p>
                            )}
                        </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        paymentStatus?.connected
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                    }`}>
                        {paymentStatus?.connected ? '✓ Active' : '✗ Inactive'}
                    </span>
                </div>

                {/* Current Status Card */}
                <div className="bg-white rounded-2xl border border-amber-500 p-6 mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current Status</p>
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${badge.color}`}>
                                <BadgeIcon size={14} className={isInProgress ? 'animate-spin' : ''} />
                                {badge.label}
                            </div>
                        </div>
                        {domainInfo?.requestedDomain && currentStatus === 'live' && (
                            <a
                                href={`https://${domainInfo.requestedDomain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:text-amber-700"
                            >
                                Visit <ExternalLink size={14} />
                            </a>
                        )}
                    </div>

                    {domainInfo?.requestedDomain && (
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-medium w-24">Domain:</span>
                                <span className="font-mono font-semibold text-gray-900">{domainInfo.requestedDomain}</span>
                            </div>
                            {domainInfo.registrarOrderId && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 font-medium w-24">Order ID:</span>
                                    <span className="font-mono text-xs text-gray-700">{domainInfo.registrarOrderId}</span>
                                </div>
                            )}
                            {domainInfo.domainExpiresAt && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 font-medium w-24">Expires:</span>
                                    <span className="text-gray-700">{new Date(domainInfo.domainExpiresAt).toLocaleDateString()}</span>
                                </div>
                            )}
                            {domainInfo.cloudflareZoneId && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 font-medium w-24">Zone ID:</span>
                                    <span className="font-mono text-xs text-gray-700">{domainInfo.cloudflareZoneId}</span>
                                </div>
                            )}
                            {domainInfo.domainFailureReason && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                                    <AlertTriangle size={14} className="inline mr-1" />
                                    <span className="font-semibold">Failure:</span> {domainInfo.domainFailureReason}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Domain Search Section */}
                {(currentStatus === 'not_requested' || currentStatus === 'failed' || currentStatus === 'pending_payment') && (
                    <div className="bg-white rounded-2xl border border-amber-500 p-6 mb-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Check Domain Availability</h2>

                        <div className="flex gap-3 mb-4">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={domainInput}
                                    onChange={(e) => setDomainInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                                    placeholder="e.g. juansbakery.com"
                                    className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    disabled={checking || purchasing}
                                />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            </div>
                            <button
                                onClick={() => handleCheck()}
                                disabled={checking || !domainInput.trim() || purchasing}
                                className="px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {checking ? <Loader2 className="animate-spin" size={18} /> : 'Check'}
                            </button>
                        </div>

                        {/* Result */}
                        {result && (
                            <div className="mt-4">
                                {result.error && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                        <AlertTriangle size={16} className="inline mr-2" />
                                        {result.error}
                                    </div>
                                )}

                                {result.valid && result.available && (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <CheckCircle2 className="text-amber-600" size={20} />
                                                    <span className="font-bold text-amber-900">{result.domain}</span>
                                                    <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Available</span>
                                                </div>
                                                <p className="text-sm text-amber-700">
                                                    Cost: <span className="font-bold">₱{result.pricePHP}</span> (${result.priceUSD?.toFixed(2)} USD)
                                                    {!result.withinBudget && (
                                                        <span className="ml-2 text-amber-700 font-semibold">⚠ Over ₱500 budget</span>
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onClick={handlePurchase}
                                                disabled={purchasing}
                                                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold text-sm hover:bg-amber-700 disabled:bg-gray-300 transition-colors"
                                            >
                                                {purchasing ? (
                                                    <span className="flex items-center gap-2">
                                                        <Loader2 className="animate-spin" size={14} /> Purchasing...
                                                    </span>
                                                ) : (
                                                    'Purchase & Setup'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {result.valid && !result.available && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <XCircle className="text-red-600" size={20} />
                                            <span className="font-bold text-red-900">{result.domain}</span>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Not available</span>
                                        </div>
                                        <p className="text-sm text-red-700">{result.reason || 'Not available'}</p>
                                    </div>
                                )}

                                {/* Suggestions */}
                                {result.suggestions && result.suggestions.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-sm font-semibold text-gray-700 mb-2">Try these alternatives:</p>
                                        <div className="space-y-2">
                                            {result.suggestions.map((sug) => (
                                                <button
                                                    key={sug.domain}
                                                    onClick={() => handleCheck(sug.domain)}
                                                    disabled={checking || !sug.withinBudget}
                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${sug.withinBudget
                                                            ? 'bg-white hover:border-amber-400 border-gray-200 hover:shadow-sm'
                                                            : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                                                        }`}
                                                >
                                                    <span className="font-mono font-semibold text-gray-900">{sug.domain}</span>
                                                    <span className={`text-xs font-semibold ${sug.withinBudget ? 'text-amber-700' : 'text-amber-700'}`}>
                                                        ₱{sug.pricePHP} {sug.withinBudget ? '✓' : '(over budget)'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Info Card — for in-progress status */}
                {isInProgress && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
                        <div className="flex items-start gap-3">
                            <Loader2 className="text-blue-600 animate-spin flex-shrink-0 mt-1" size={20} />
                            <div>
                                <h3 className="font-bold text-blue-900 mb-1">Setup in progress</h3>
                                <p className="text-sm text-blue-700">
                                    The domain is being configured automatically. This typically takes 2-6 minutes:
                                    registration → DNS zone → Pages attachment → SSL provisioning. This page will update when complete.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status message */}
                {message && (
                    <div
                        className={`p-4 rounded-xl border text-sm font-semibold ${message.type === 'success'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                            }`}
                    >
                        {message.text}
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
