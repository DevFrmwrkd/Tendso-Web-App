"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

const BUSINESS_TYPES = [
    "Barber/Salon",
    "Auto Shop",
    "Spa/Massage",
    "Restaurant",
    "Clinic",
    "Law Office",
    "Craft/Producer",
    "Other"
]

export default function BusinessInfoPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()

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

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    // Load draft data when available
    useEffect(() => {
        if (existingDraft && !initialized) {
            setBusinessName(existingDraft.businessName || "")
            setBusinessType(existingDraft.businessType || "")
            setOwnerName(existingDraft.ownerName || "")
            setOwnerPhone(existingDraft.ownerPhone || "")
            setOwnerEmail(existingDraft.ownerEmail || "")
            setAddress(existingDraft.address || "")
            setCity(existingDraft.city || "")
            // Store ID in session for other steps
            sessionStorage.setItem('current_submission_id', existingDraft._id)
            setInitialized(true)
        }
    }, [existingDraft, initialized])

    const handleNext = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (!creator) {
                throw new Error('You must complete your profile first')
            }

            let submissionId: string

            if (existingDraft) {
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
                })
                submissionId = existingDraft._id
            } else {
                // Create new draft
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
                        Tell us about the business you're submitting
                    </p>

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
                            disabled={loading}
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
