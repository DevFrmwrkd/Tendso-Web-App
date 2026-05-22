"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export default function SubmissionSuccessPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()

    const [submissionId, setSubmissionId] = useState<string | null>(null)
    const [transcribing, setTranscribing] = useState(false)
    const [transcriptionComplete, setTranscriptionComplete] = useState(false)
    const [transcriptionError, setTranscriptionError] = useState<string | null>(null)

    // Get creator from Convex
    const creator = useQuery(
        api.creators.getByClerkId,
        user ? { clerkId: user.id } : "skip"
    )

    // Get submission from Convex
    const submission = useQuery(
        api.submissions.getById,
        submissionId ? { id: submissionId as Id<"submissions"> } : "skip"
    )

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    // Load submission ID from session
    useEffect(() => {
        const id = sessionStorage.getItem('current_submission_id')
        if (id) {
            setSubmissionId(id)
            // Clear session storage so user can start fresh next time
            sessionStorage.removeItem('current_submission_id')
        }
    }, [])

    // Trigger transcription when submission is loaded
    useEffect(() => {
        const hasMedia = submission?.videoStorageId || submission?.audioStorageId || submission?.videoUrl || submission?.audioUrl
        if (submission && hasMedia && !transcribing && !transcriptionComplete) {
            triggerTranscription()
        }
    }, [submission])

    const triggerTranscription = async () => {
        if (!submissionId || !submission) return

        try {
            setTranscribing(true)
            setTranscriptionError(null)

            // For Convex storage, we need to get the actual URL
            // The transcription API will need to handle Convex storage IDs
            // For now, we'll skip transcription if using Convex storage
            // This can be enhanced later with proper Convex file URL resolution

            const hasMedia = submission.videoStorageId || submission.audioStorageId || submission.videoUrl || submission.audioUrl
            if (!hasMedia) {
                setTranscribing(false)
                return
            }

            // Call transcription API with storage info or R2 URLs
            const res = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submissionId: submissionId,
                    useConvexStorage: !!(submission.videoStorageId || submission.audioStorageId),
                    videoStorageId: submission.videoStorageId,
                    audioStorageId: submission.audioStorageId,
                    videoUrl: submission.videoUrl,
                    audioUrl: submission.audioUrl,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Transcription failed')
            }

            setTranscriptionComplete(true)
        } catch (err: any) {
            console.error('Transcription error:', err)
            setTranscriptionError(err.message || 'Failed to transcribe audio')
        } finally {
            setTranscribing(false)
        }
    }

    // Determine payout based on interview type (check both R2 URLs and storage IDs)
    const hasVideo = submission?.videoUrl || submission?.videoStorageId
    const hasAudio = submission?.audioUrl || submission?.audioStorageId
    const payout = hasVideo ? 500 : (hasAudio ? 300 : null)

    // Loading state - wait for submission to load too
    if (!isLoaded || !isSignedIn || creator === undefined || (submissionId && submission === undefined)) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-paper)" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ed-accent)" }} />
            </div>
        )
    }

    return (
        <div
            className="editorial min-h-screen flex flex-col items-center justify-center p-6"
            style={{ background: "var(--ed-paper)", color: "var(--ed-ink)", fontFamily: "var(--ed-sans)" }}
        >
            <div className="max-w-md w-full text-center space-y-8">
                {/* Success Animation/Icon */}
                <div className="relative">
                    <div className="w-24 h-24 bg-green-100 rounded-full mx-auto flex items-center justify-center animate-in zoom-in duration-500">
                        <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>

                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Submission Received!</h1>
                    <p className="text-gray-500 text-lg">
                        Great job! We've received your submission and will start processing it right away.
                    </p>
                </div>

                {/* Info Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                    <div className="pb-4 border-b border-gray-100">
                        <p className="text-sm text-gray-500 uppercase font-medium tracking-wide">Expected Payout</p>
                        <p className="text-3xl font-bold text-green-600 mt-1">
                            ₱{payout || '---'}
                        </p>
                    </div>

                    <div className="space-y-3 text-left">
                        {/* Transcription Status */}
                        {(transcribing || transcriptionComplete || transcriptionError) && (
                            <div className={`flex items-start gap-3 p-3 rounded-lg ${transcribing ? 'bg-blue-50' :
                                transcriptionComplete ? 'bg-green-50' :
                                    'bg-red-50'
                                }`}>
                                <div className="flex-shrink-0 mt-0.5">
                                    {transcribing && (
                                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                    )}
                                    {transcriptionComplete && (
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    {transcriptionError && (
                                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-medium ${transcribing ? 'text-blue-900' :
                                        transcriptionComplete ? 'text-green-900' :
                                            'text-red-900'
                                        }`}>
                                        {transcribing && 'AI is transcribing your interview...'}
                                        {transcriptionComplete && 'Interview transcribed successfully!'}
                                        {transcriptionError && 'Transcription failed'}
                                    </p>
                                    {transcriptionError && (
                                        <p className="text-xs text-red-600 mt-1">{transcriptionError}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-bold">1</span>
                            </div>
                            <p className="text-sm text-gray-600">
                                We'll review the submission and generate the website within <span className="font-semibold text-gray-900">24–48 hours</span>.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-bold">2</span>
                            </div>
                            <p className="text-sm text-gray-600">
                                You'll receive your payout once the client pays the service fee.
                            </p>
                        </div>
                    </div>

                    {submissionId && (
                        <div className="pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                Submission ID: <span className="font-mono">{submissionId.slice(0, 8)}...</span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <Link href="/dashboard">
                        <Button className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl text-md shadow-lg shadow-gray-900/20">
                            Back to Dashboard
                        </Button>
                    </Link>

                    <Link href="/submit/info">
                        <Button variant="ghost" className="w-full text-gray-600 hover:text-gray-900">
                            Submit Another Business
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
