"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { Check } from "lucide-react"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { ButtonLink, Icon, Loading, PageHeader, Skeleton, Status, formatMoney, submissionStatus } from "@/components/r1"

import { DRAFT_ID_KEY, errorText, firstNameOf } from "../_components/flow"
import { useDraftId } from "../_components/useDraftId"

type Transcription = { state: "idle" } | { state: "running" } | { state: "done" } | { state: "error"; message: string }

const noSubscribe = () => () => {}

function NextStep({ n, title, children }: { n: number; title: ReactNode; children: ReactNode }) {
    return (
        <li className="flex items-start gap-3.5">
            <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-r1-fill text-xs font-semibold text-r1-ink-2">{n}</span>
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-r1-ink">{title}</span>
                {children}
            </div>
        </li>
    )
}

export default function SubmissionSuccessPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()
    // False on the server and while hydrating, when sessionStorage cannot be read yet.
    const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false)

    // Load submission ID from session, once: keep it here, then clear it so
    // the next New submission starts fresh.
    const storedId = useDraftId()
    const [submissionId, setSubmissionId] = useState<string | null>(null)
    if (storedId && submissionId !== storedId) {
        setSubmissionId(storedId)
    }
    useEffect(() => {
        // Clear session storage so user can start fresh next time
        if (submissionId) sessionStorage.removeItem(DRAFT_ID_KEY)
    }, [submissionId])

    const [transcription, setTranscription] = useState<Transcription>({ state: "idle" })
    const transcriptionRef = useRef<Transcription["state"]>("idle")

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

    // Trigger transcription when submission is loaded. Not again while one is
    // running or after it succeeded; after a failure, the next change to the
    // submission tries again (as before).
    useEffect(() => {
        const hasMedia = submission?.videoStorageId || submission?.audioStorageId || submission?.videoUrl || submission?.audioUrl
        if (!submissionId || !submission || !hasMedia) return
        if (transcriptionRef.current === "running" || transcriptionRef.current === "done") return
        transcriptionRef.current = "running"

        const triggerTranscription = async () => {
            setTranscription({ state: "running" })
            try {
                // Call transcription API with storage info or R2 URLs
                const res = await fetch("/api/transcribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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
                    throw new Error(data.error || "Transcription failed")
                }

                transcriptionRef.current = "done"
                setTranscription({ state: "done" })
            } catch (err) {
                console.error("Transcription error:", err)
                transcriptionRef.current = "error"
                setTranscription({ state: "error", message: errorText(err, "Failed to transcribe audio") })
            }
        }
        void triggerTranscription()
    }, [submission, submissionId])

    // Loading state - wait for submission to load too
    if (!hydrated || !isLoaded || !isSignedIn || creator === undefined || (submissionId && submission === undefined)) {
        return (
            <Loading label="Loading" className="flex max-w-[640px] flex-col gap-8">
                <Skeleton width={48} height={48} round />
                <div className="flex flex-col gap-3">
                    <Skeleton width={260} height={36} />
                    <Skeleton width="70%" height={14} />
                </div>
                <div className="t-card t-card-pad flex flex-col gap-4">
                    <Skeleton width="50%" height={16} />
                    <Skeleton height={120} />
                </div>
            </Loading>
        )
    }

    const businessName = submission?.businessName
    const firstName = firstNameOf(submission?.ownerName)
    const who = firstName || "the owner"
    const Who = firstName || "The owner"
    const ownerPays = typeof submission?.amount === "number" ? formatMoney(submission.amount) : null
    const payout = typeof submission?.creatorPayout === "number" ? formatMoney(submission.creatorPayout) : null

    return (
        <div className="flex max-w-[640px] flex-col gap-8">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-r1-ink text-r1-paper">
                <Icon icon={Check} size={24} />
            </span>

            <PageHeader
                title="Sent for review"
                sub={businessName ? `Usually 48–72 hours. Nothing more is needed from ${businessName}.` : "Usually 48–72 hours."}
            />

            <section className="t-card t-card-pad flex flex-col gap-5" aria-labelledby="ns-next-h">
                {submission && (
                    <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-[15px] font-semibold text-r1-ink">{submission.businessName}</span>
                                <span className="t-meta">{[submission.businessType, submission.city].filter(Boolean).join(" · ")}</span>
                            </div>
                            <Status {...submissionStatus(submission.status, "creator")} />
                        </div>
                        <hr className="t-divider" />
                    </>
                )}
                <h2 id="ns-next-h" className="t-h2">
                    What happens next
                </h2>
                <ol className="m-0 flex list-none flex-col gap-4 p-0">
                    <NextStep n={1} title="We build the site">
                        <span className="t-meta">The interview is transcribed now. We write the site from it, pick a design, and check it.</span>
                        {transcription.state === "running" && <Status tone="progress" word="Transcribing the interview" className="pt-1" />}
                        {transcription.state === "done" && <Status tone="done" word="Interview transcribed" className="pt-1" />}
                        {transcription.state === "error" && (
                            <>
                                <Status tone="bad" word="Transcription failed" className="pt-1" />
                                <span className="t-error">{transcription.message}</span>
                            </>
                        )}
                    </NextStep>
                    <NextStep n={2} title={`It goes live, and ${who} pays`}>
                        <span className="t-meta t-num">
                            {Who} gets the link and pays {ownerPays ? `${ownerPays} ` : ""}once, by bank transfer.
                        </span>
                    </NextStep>
                    <NextStep n={3} title={payout ? `You get ${payout}` : "You get paid"}>
                        <span className="t-meta">It lands in your Wallet the day the payment is confirmed. We notify you at each step.</span>
                    </NextStep>
                </ol>
            </section>

            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                    <ButtonLink variant="primary" href="/submissions">
                        Track it in Submissions
                    </ButtonLink>
                    <ButtonLink href="/dashboard">Go to Home</ButtonLink>
                    <ButtonLink variant="ghost" href="/submit/info">
                        Start another submission
                    </ButtonLink>
                </div>
                {submissionId && <p className="t-meta">Reference <span className="t-mono">{submissionId.slice(0, 8)}</span></p>}
            </div>
        </div>
    )
}
