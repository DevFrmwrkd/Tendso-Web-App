"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft } from "lucide-react"
import {
    BUSINESS_TYPES,
    mapCategoryToBusinessType,
    toLocalPhDigits,
    looksLikeConvexId,
} from "@/lib/prospectPrefill"

function Spinner() {
    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
        </div>
    )
}

// useSearchParams() needs a Suspense boundary or the Next build fails with a
// CSR-bailout error.
export default function BusinessInfoPage() {
    return (
        <Suspense fallback={<Spinner />}>
            <BusinessInfoForm />
        </Suspense>
    )
}

function BusinessInfoForm() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()
    const searchParams = useSearchParams()

    // Prefill params, written by the "Start interview" link on the prospect
    // detail page (app/leads/[leadId]/page.tsx) and the prospects tab.
    const rawProspectLeadId = searchParams.get("prospectLeadId")
    // Shape-check before this ever reaches a v.id('leads') validator — a
    // place_id or hand-edited string would throw and dead-end step 1.
    const prospectLeadId = looksLikeConvexId(rawProspectLeadId) ? rawProspectLeadId : null
    const paramBusinessName = searchParams.get("businessName") ?? ""
    const paramPhone = searchParams.get("phone")
    const paramAddress = searchParams.get("address") ?? ""
    const paramCity = searchParams.get("city") ?? ""
    const paramCategory = searchParams.get("category")

    // Get creator from Convex
    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    // Get existing draft submission
    const existingDraft = useQuery(
        api.submissions.getDraftByCreatorId,
        creator?._id ? { creatorId: creator._id } : "skip"
    )

    // Mutations
    const createSubmission = useMutation(api.submissions.create)
    const updateSubmission = useMutation(api.submissions.update)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [businessName, setBusinessName] = useState("")
    const [businessType, setBusinessType] = useState("")
    const [ownerName, setOwnerName] = useState("")
    const [ownerPhone, setOwnerPhone] = useState("")
    const [ownerEmail, setOwnerEmail] = useState("")
    const [address, setAddress] = useState("")
    const [city, setCity] = useState("")
    const [initialized, setInitialized] = useState(false)
    // 'unresolved' only matters when there's a draft-vs-prospect collision.
    const [draftChoice, setDraftChoice] = useState<"unresolved" | "continue" | "fresh">("unresolved")

    // getDraftByCreatorId returns the creator's single NEWEST draft with no
    // business filter, and this page patches whatever it hands back. If that
    // draft belongs to a different business than the prospect we arrived for,
    // reusing it would rename it — and on submit mark the WRONG business
    // interviewed. Detect that and ask instead of guessing.
    const draftIsForThisProspect =
        !!existingDraft &&
        !!prospectLeadId &&
        (((existingDraft as any).prospectLeadId ?? null) === prospectLeadId ||
            // An unlinked draft for the same business is a back-navigation, not
            // a collision.
            (!(existingDraft as any).prospectLeadId &&
                (existingDraft.businessName ?? "") === paramBusinessName))
    const draftCollision = !!existingDraft && !!prospectLeadId && !draftIsForThisProspect
    const awaitingChoice = draftCollision && draftChoice === "unresolved"
    const startingFresh = draftCollision && draftChoice === "fresh"

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    // Single hydration effect. A saved draft always wins over URL params; the
    // params only fill a genuinely empty form. These must NOT be two effects —
    // existingDraft resolves asynchronously, so a separate prefill effect gets
    // clobbered when the draft lands later.
    useEffect(() => {
        if (initialized) return
        // undefined is Convex's loading state, NOT "no draft". Treating it as
        // "no draft" (the old `if (existingDraft)` check) let a fast tap on
        // Next create a second draft.
        if (existingDraft === undefined) return
        if (awaitingChoice) return

        if (existingDraft && !startingFresh) {
            setBusinessName(existingDraft.businessName || "")
            setBusinessType(existingDraft.businessType || "")
            setOwnerName(existingDraft.ownerName || "")
            setOwnerPhone(existingDraft.ownerPhone || "")
            setOwnerEmail(existingDraft.ownerEmail || "")
            setAddress(existingDraft.address || "")
            setCity(existingDraft.city || "")
            // Store ID in session for other steps
            sessionStorage.setItem('current_submission_id', existingDraft._id)
        } else if (prospectLeadId) {
            // Prefill from the scraped prospect. Owner name and email are
            // deliberately left empty — a scrape can't know them.
            setBusinessName(paramBusinessName)
            setAddress(paramAddress)
            setCity(paramCity)
            setOwnerPhone(toLocalPhDigits(paramPhone))
            setBusinessType(mapCategoryToBusinessType(paramCategory))
        }
        setInitialized(true)
    }, [
        existingDraft, initialized, awaitingChoice, startingFresh, prospectLeadId,
        paramBusinessName, paramAddress, paramCity, paramPhone, paramCategory,
    ])

    const handleNext = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (!creator) {
                throw new Error('You must complete your profile first')
            }

            let submissionId: string
            const linkArg = prospectLeadId
                ? { prospectLeadId: prospectLeadId as Id<'leads'> }
                : {}

            if (existingDraft && !startingFresh) {
                // Update existing draft
                await updateSubmission({
                    id: existingDraft._id,
                    businessName,
                    businessType,
                    ownerName,
                    ownerPhone,
                    ownerEmail: ownerEmail || undefined,
                    address,
                    city,
                    ...linkArg,
                })
                submissionId = existingDraft._id
            } else {
                // Create new draft — either the creator has none, or they chose
                // to start fresh rather than reuse an unrelated one.
                submissionId = await createSubmission({
                    creatorId: creator._id,
                    businessName,
                    businessType,
                    ownerName,
                    ownerPhone,
                    ownerEmail: ownerEmail || undefined,
                    address,
                    city,
                    status: 'draft',
                    ...linkArg,
                })
            }

            // Store submission ID in session storage for next steps
            sessionStorage.setItem('current_submission_id', submissionId)

            // Navigate to next step
            router.push('/submit/photos')
        } catch (err: any) {
            console.error('Error saving business info:', err)
            setError(err.message || 'Failed to save business information')
        } finally {
            setLoading(false)
        }
    }

    // Loading state
    if (!isLoaded || !isSignedIn || creator === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    // Redirect to onboarding if no creator profile
    if (!creator) {
        router.push("/onboarding")
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    return (
        <div
            className="editorial min-h-screen flex flex-col"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="text-sm text-gray-500 font-medium">STEP 1 OF 4</span>
            </div>

            {/* Progress Bar */}
            <div className="px-4 mb-6">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '25%' }}></div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 px-6 pb-6">
                <div className="max-w-md mx-auto">
                    {/* Title */}
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Business Information</h1>
                    <p className="text-sm text-gray-500 mb-8">
                        Tell us about the business you&apos;re submitting
                    </p>

                    {/* Arrived from a scraped prospect — say so, and offer a way
                        back, so the creator can see this interview is attached
                        to that record rather than floating free. */}
                    {prospectLeadId && !awaitingChoice && (
                        <div
                            className="mb-6 p-4 rounded-lg"
                            style={{ background: "var(--ed-accent-bg, #F5E4C0)", border: "1px solid var(--ed-accent)" }}
                        >
                            <p className="text-sm font-medium" style={{ color: "var(--ed-accent-ink, #5C3A0F)" }}>
                                Interviewing {paramBusinessName || "this business"}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--ed-ink-2)" }}>
                                Details below are from the listing — correct anything that&apos;s wrong.
                                The phone is the listed number, not necessarily the owner&apos;s.
                            </p>
                            <Link
                                href={`/leads/${prospectLeadId}`}
                                className="inline-flex items-center gap-1.5 text-xs mt-2"
                                style={{ color: "var(--ed-accent-ink, #5C3A0F)" }}
                            >
                                <ArrowLeft className="w-3 h-3" /> Back to the prospect
                            </Link>
                        </div>
                    )}

                    {/* Draft collision — the creator has an unfinished interview
                        for a DIFFERENT business. Reusing it silently would mark
                        the wrong business interviewed, so ask. */}
                    {awaitingChoice && (
                        <div
                            className="mb-6 p-4 rounded-lg"
                            style={{ background: "#FBE9C4", border: "1px solid var(--ed-warn, #C68A12)" }}
                        >
                            <p className="text-sm font-semibold text-gray-900">
                                You have an unfinished interview
                            </p>
                            <p className="text-sm mt-1 text-gray-700">
                                There&apos;s a draft for{" "}
                                <strong>{existingDraft?.businessName || "another business"}</strong>.
                                Continue that one, or start fresh for{" "}
                                <strong>{paramBusinessName || "this business"}</strong>?
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <button
                                    type="button"
                                    onClick={() => setDraftChoice("continue")}
                                    className="px-3 py-2 text-sm font-semibold rounded-lg"
                                    style={{ background: "var(--ed-ink)", color: "var(--ed-paper-3)" }}
                                >
                                    Continue {existingDraft?.businessName || "the draft"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDraftChoice("fresh")}
                                    className="px-3 py-2 text-sm font-semibold rounded-lg"
                                    style={{
                                        background: "transparent",
                                        color: "var(--ed-ink)",
                                        border: "1px solid var(--ed-rule)",
                                    }}
                                >
                                    Start fresh for {paramBusinessName || "this business"}
                                </button>
                            </div>
                            <p className="text-xs mt-2 text-gray-600">
                                Starting fresh keeps the other draft — it isn&apos;t deleted.
                            </p>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleNext} className="space-y-5">
                        {/* Business Name */}
                        <div className="space-y-2">
                            <Label htmlFor="businessName" className="text-sm font-medium text-gray-700">
                                Business Name *
                            </Label>
                            <Input
                                id="businessName"
                                type="text"
                                placeholder="e.g., Juan's Barbershop"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                required
                                disabled={loading}
                                className="h-12 bg-white border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                            />
                        </div>

                        {/* Business Type */}
                        <div className="space-y-2">
                            <Label htmlFor="businessType" className="text-sm font-medium text-gray-700">
                                Business Type *
                            </Label>
                            <select
                                id="businessType"
                                value={businessType}
                                onChange={(e) => setBusinessType(e.target.value)}
                                required
                                disabled={loading}
                                className="w-full h-12 text-black px-3 bg-white border border-gray-200 rounded-lg focus:border-amber-500 focus:ring-amber-500 focus:outline-none"
                            >
                                <option value="">Select business type</option>
                                {BUSINESS_TYPES.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {/* Owner Full Name */}
                        <div className="space-y-2">
                            <Label htmlFor="ownerName" className="text-sm font-medium text-gray-700">
                                Owner Full Name *
                            </Label>
                            <Input
                                id="ownerName"
                                type="text"
                                placeholder="e.g., Juan Dela Cruz"
                                value={ownerName}
                                onChange={(e) => setOwnerName(e.target.value)}
                                required
                                disabled={loading}
                                className="h-12 bg-white border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                            />
                        </div>

                        {/* Owner Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="ownerPhone" className="text-sm font-medium text-gray-700">
                                Owner Phone Number *
                            </Label>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-2 px-3 h-12 bg-white border border-gray-200 rounded-lg">
                                    <span className="text-sm font-medium text-gray-700">+63</span>
                                </div>
                                <Input
                                    id="ownerPhone"
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={10}
                                    placeholder="912 345 4567"
                                    value={ownerPhone}
                                    onChange={(e) => setOwnerPhone(e.target.value.replace(/\D/g, ''))}
                                    required
                                    disabled={loading}
                                    className="flex-1 h-12 bg-white border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        {/* Owner Email */}
                        <div className="space-y-2">
                            <Label htmlFor="ownerEmail" className="text-sm font-medium text-gray-700">
                                Owner Email <span className="text-gray-400">(Optional)</span>
                            </Label>
                            <Input
                                id="ownerEmail"
                                type="email"
                                placeholder="owner@example.com"
                                value={ownerEmail}
                                onChange={(e) => setOwnerEmail(e.target.value)}
                                disabled={loading}
                                className="h-12 bg-white border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                            />
                        </div>

                        {/* Full Address */}
                        <div className="space-y-2">
                            <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                                Full Address *
                            </Label>
                            <Input
                                id="address"
                                type="text"
                                placeholder="123 Main St, Barangay Example"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                required
                                disabled={loading}
                                className="h-12 bg-white border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                            />
                        </div>

                        {/* City */}
                        <div className="space-y-2">
                            <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                                City *
                            </Label>
                            <Input
                                id="city"
                                type="text"
                                placeholder="e.g., Manila"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                required
                                disabled={loading}
                                className="h-12 bg-white border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                            />
                        </div>

                        {/* Next Button */}
                        <Button
                            type="submit"
                            // existingDraft === undefined is Convex still
                            // loading; submitting through it creates a second
                            // draft that would carry the prospect link while
                            // the first is orphaned.
                            disabled={loading || existingDraft === undefined || awaitingChoice}
                            className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors mt-8"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="animate-spin h-5 w-5" />
                                    Saving...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    Next: Upload Photos
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </span>
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
