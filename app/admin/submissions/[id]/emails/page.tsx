"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

interface EmailPreview {
    type: string
    label: string
    description: string
    html: string
    /** API endpoint to POST { submissionId } to in order to (re)send this email */
    sendEndpoint: string
    /** Optional `type` body field forwarded to the send endpoint */
    sendType?: string
}

export default function EmailsSentPage() {
    const params = useParams()
    const submissionId = params.id as string
    const { user, isLoaded } = useUser()

    const currentCreator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )
    const isAdmin = currentCreator?.role === 'admin'

    const submissionData = useQuery(
        api.submissions.getByIdWithCreator,
        isAdmin && submissionId ? { id: submissionId as Id<"submissions"> } : "skip"
    )

    const [emails, setEmails] = useState<EmailPreview[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sendingType, setSendingType] = useState<string | null>(null)
    const [sendResult, setSendResult] = useState<{ type: string; ok: boolean; message: string } | null>(null)

    const hasCustomDomain = Boolean((submissionData as any)?.requestedDomain)

    useEffect(() => {
        if (!submissionData) return

        const fetchEmails = async () => {
            setLoading(true)
            setError(null)

            const emailsToFetch: {
                type: string
                label: string
                description: string
                sendEndpoint: string
                sendType?: string
            }[] = []

            if (['pending_payment', 'paid', 'completed'].includes(submissionData.status)) {
                emailsToFetch.push({
                    type: 'approval',
                    label: 'Send to Client Email',
                    description:
                        'Sent when the website was deployed and shared with the client. Contains website preview link and payment instructions.',
                    sendEndpoint: '/api/send-website-email',
                })
            }

            if (['paid', 'completed'].includes(submissionData.status)) {
                emailsToFetch.push({
                    type: 'payment_confirmation',
                    label: 'Payment Confirmed Email',
                    description:
                        'Sent after the admin confirmed payment was received. Contains payment confirmation and live website link.',
                    sendEndpoint: '/api/send-completed-website-email',
                })
            }

            // Completed-website email — available once the submission has been paid or
            // marked completed. Branches automatically based on whether a custom domain
            // is attached.
            if (['paid', 'completed'].includes(submissionData.status)) {
                emailsToFetch.push({
                    type: 'completed_website',
                    label: hasCustomDomain
                        ? 'Website Live (Custom Domain) Email'
                        : 'Website Live Email',
                    description: hasCustomDomain
                        ? 'Sent when the custom domain finishes provisioning. Includes the live URL and a year-1-paid renewal disclaimer for the business owner.'
                        : 'Sent when the website is live on its workers.dev URL. Contains the published link and a thank-you message.',
                    sendEndpoint: '/api/send-completed-website-email',
                })
            }

            // Custom-domain-only emails: setup in progress + 30-day renewal reminder
            if (hasCustomDomain && ['paid', 'completed'].includes(submissionData.status)) {
                emailsToFetch.push({
                    type: 'domain_setup_progress',
                    label: 'Domain Setup In Progress Email',
                    description:
                        'Auto-sent when SSL provisioning starts. Tells the business owner the domain is registered and DNS is pointed, SSL cert is being issued by Cloudflare (2–10 min).',
                    sendEndpoint: '/api/send-completed-website-email',
                    sendType: 'domain_setup_progress',
                })
                emailsToFetch.push({
                    type: 'domain_renewal_reminder',
                    label: 'Domain Renewal Reminder Email',
                    description:
                        'Auto-scheduled to send 30 days before the domain expires. Reminds the business owner that year 2 onwards is their responsibility.',
                    sendEndpoint: '/api/send-completed-website-email',
                    sendType: 'domain_renewal_reminder',
                })
            }

            if (emailsToFetch.length === 0) {
                setEmails([])
                setLoading(false)
                return
            }

            try {
                const results = await Promise.all(
                    emailsToFetch.map(async ({ type, label, description, sendEndpoint, sendType }) => {
                        const response = await fetch(
                            `/api/preview-email?submissionId=${submissionData._id}&type=${type}`
                        )
                        if (!response.ok) throw new Error(`Failed to load ${label}`)
                        const html = await response.text()
                        return { type, label, description, html, sendEndpoint, sendType }
                    })
                )
                setEmails(results)
            } catch (err: any) {
                setError(err.message || 'Failed to load email previews')
            } finally {
                setLoading(false)
            }
        }

        fetchEmails()
    }, [submissionData, hasCustomDomain])

    async function handleSend(email: EmailPreview) {
        if (!submissionData) return
        setSendingType(email.type)
        setSendResult(null)
        try {
            const response = await fetch(email.sendEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submissionId: submissionData._id,
                    ...(email.sendType ? { type: email.sendType } : {}),
                }),
            })
            const json = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(json.error || `Failed (${response.status})`)
            }
            setSendResult({
                type: email.type,
                ok: true,
                message: `Sent to ${submissionData.ownerEmail || 'business owner'}`,
            })
        } catch (err: any) {
            setSendResult({ type: email.type, ok: false, message: err.message || 'Send failed' })
        } finally {
            setSendingType(null)
        }
    }

    const authLoading = !isLoaded || (user && currentCreator === undefined)

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Admin access required.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/admin/submissions/${submissionId}`}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Emails Sent to Client</h1>
                            {submissionData && (
                                <p className="text-sm text-gray-500 mt-1">
                                    {submissionData.businessName} — {submissionData.ownerEmail || 'No email on file'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <p className="text-sm text-gray-500">Loading email previews...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                        <p className="text-red-700 font-medium">{error}</p>
                    </div>
                ) : emails.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
                        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-500">No emails have been sent for this submission yet.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {emails.map((email, index) => (
                            <div key={email.type} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                {/* Email header */}
                                <div className="px-6 py-4 border-b border-gray-100">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            email.type === 'payment_confirmation' || email.type === 'completed_website'
                                                ? 'bg-amber-100'
                                                : 'bg-indigo-100'
                                        }`}>
                                            {email.type === 'payment_confirmation' || email.type === 'completed_website' ? (
                                                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-base font-semibold text-gray-900">{email.label}</h2>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                    email.type === 'payment_confirmation' || email.type === 'completed_website'
                                                        ? 'bg-amber-50 text-amber-700'
                                                        : 'bg-indigo-50 text-indigo-700'
                                                }`}>
                                                    Email {index + 1} of {emails.length}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-0.5">{email.description}</p>
                                            {sendResult?.type === email.type && (
                                                <p className={`text-xs mt-2 font-medium ${sendResult.ok ? 'text-amber-700' : 'text-red-700'}`}>
                                                    {sendResult.ok ? '✓ ' : '✗ '}{sendResult.message}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSend(email)}
                                            disabled={sendingType === email.type || !submissionData?.ownerEmail}
                                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                            title={!submissionData?.ownerEmail ? 'Business owner email is missing' : `Send to ${submissionData.ownerEmail}`}
                                        >
                                            {sendingType === email.type ? (
                                                <>
                                                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    Sending…
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                    </svg>
                                                    Send Email
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Email body rendered in iframe */}
                                <iframe
                                    srcDoc={email.html}
                                    className="w-full border-0"
                                    style={{ height: '700px' }}
                                    title={email.label}
                                    sandbox="allow-same-origin"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
