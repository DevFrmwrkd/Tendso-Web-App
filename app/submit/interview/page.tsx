"use client"

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation, useAction } from "convex/react"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Camera, Check, ChevronLeft, ChevronRight, Mic, SwitchCamera, Upload, Video } from "lucide-react"
import { toast } from "sonner"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button, Dialog, Dot, Fold, Icon, Status, cx } from "@/components/r1"

import {
    INTERVIEW_QUESTIONS,
    MAX_AUDIO_BYTES,
    MAX_VIDEO_BYTES,
    clock,
    errorText,
    fileSize,
    infoErrors,
    infoFromDoc,
    needRows,
    savedInterviewKind,
} from "../_components/flow"
import { ActionBar, DraftMissing, NeedsCard, StepLoading, SubmitFrame } from "../_components/SubmitFrame"
import { useRequiredDraftId } from "../_components/useDraftId"

type Kind = "video" | "audio"

/**
 * choose     the three ways in (and the saved interview, when the draft has one)
 * ready      video only: the camera is on, not recording yet, so the creator
 *            can frame the owner and flip the camera first
 * recording, paused
 * recorded   a recording waiting to be uploaded, with its playback
 * file       a picked file waiting to be uploaded
 */
type Phase = "choose" | "ready" | "recording" | "paused" | "recorded" | "file"

// The audio waveform is decoration (board): fixed heights, so the bars do not
// jump on every render.
const WAVE = Array.from({ length: 44 }, (_, i) => 10 + Math.round(Math.abs(Math.sin(i * 1.7) * 36 + Math.cos(i * 0.6) * 18)))

const TIPS = [
    { title: "Find good light", body: "Face a window or a lamp. No bright light behind the owner." },
    { title: "Choose a quiet spot", body: "Away from the TV, the fan and the street. Noise ruins the transcript." },
    { title: "Frame the owner well", body: "Face in the middle, phone at eye level." },
    { title: "Let them talk", body: "Ask, then listen. Their own words make the best site." },
]

function MethodButton({ icon, name, meta, onClick }: { icon: LucideIcon; name: string; meta: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-w-0 flex-col items-start gap-2 rounded-r1-card border border-r1-line bg-r1-paper p-5 text-left text-sm text-r1-ink hover:border-r1-line-2 hover:bg-r1-fill-row sm:min-h-[140px]"
        >
            <Icon icon={icon} size={20} />
            <span className="text-[15px] font-semibold leading-[22px]">{name}</span>
            <span className="t-meta">{meta}</span>
        </button>
    )
}

/** The interview as a row: what it is, where it stands, and the one way to redo it. */
function InterviewRow({ icon, title, meta, status, action, children }: { icon: LucideIcon; title: string; meta: string; status: ReactNode; action: ReactNode; children?: ReactNode }) {
    return (
        <section className="t-card" aria-label="Interview">
            <div className="flex min-h-[72px] flex-wrap items-center gap-3 px-5 py-4 sm:gap-4">
                <span className="t-avatar h-10 w-10 rounded-[10px]">
                    <Icon icon={icon} size={18} />
                </span>
                <div className="flex min-w-[140px] flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-r1-ink">{title}</span>
                    <span className="t-meta t-num">{meta}</span>
                </div>
                {status}
                {action}
            </div>
            {children && <div className="border-t border-r1-line-3 px-5 py-4">{children}</div>}
        </section>
    )
}

export default function InterviewUploadPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()

    const [loading, setLoading] = useState(false)
    // Camera, microphone and file problems (shown in the step).
    const [error, setError] = useState<string | null>(null)
    // Upload failures (shown in the action bar).
    const [uploadError, setUploadError] = useState<string | null>(null)

    // Load submission ID from session (back to step 1 without one)
    const submissionId = useRequiredDraftId()

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

    // Mutations and Actions
    const generateR2UploadUrl = useAction(api.r2.generateUploadUrl)
    const updateSubmission = useMutation(api.submissions.update)

    // The NEW interview's kind (a recording or a picked file). The one
    // already on the draft is read from the draft itself.
    const [interviewType, setInterviewType] = useState<Kind | null>(null)
    const [phase, setPhase] = useState<Phase>("choose")
    const [file, setFile] = useState<File | null>(null)
    // The creator chose to record over the interview the draft already has.
    const [replacing, setReplacing] = useState(false)
    // Continue was pressed with nothing recorded or uploaded.
    const [showErrors, setShowErrors] = useState(false)

    // Recording state
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
    const [recordingTime, setRecordingTime] = useState(0)
    const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null)
    const [showReminderModal, setShowReminderModal] = useState(false)
    const [hasSeenReminder, setHasSeenReminder] = useState(false)
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
    const [cameraInitializing, setCameraInitializing] = useState(false)
    const [stream, setStream] = useState<MediaStream | null>(null)

    // Quality feedback
    const [lightingQuality, setLightingQuality] = useState<"good" | "poor" | "checking">("checking")

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const previewUrlRef = useRef<string | null>(null)

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    // Cleanup on unmount: camera and microphone off, timer stopped, preview freed.
    useEffect(() => {
        previewUrlRef.current = recordedPreviewUrl
    }, [recordedPreviewUrl])
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((track) => track.stop())
            if (timerRef.current) clearInterval(timerRef.current)
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        }
    }, [])

    // Show the camera once both the stream and the <video> exist, and watch
    // the light while it is on. The check runs twice a second on a small copy
    // of the frame: plenty for "too dark / too bright", light on a phone.
    useEffect(() => {
        const video = videoRef.current
        if (!video || !stream || interviewType !== "video") return

        if (video.srcObject !== stream) {
            video.srcObject = stream
            video.play().catch((playErr) => console.error("Error playing video:", playErr))
        }

        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d", { willReadFrequently: true })
        let raf = 0
        let last = 0
        const analyzeFrame = (t: number) => {
            raf = requestAnimationFrame(analyzeFrame)
            if (!canvas || !ctx || t - last < 500) return
            last = t
            // Wait for video to have valid dimensions
            if (video.videoWidth === 0 || video.videoHeight === 0) return
            canvas.width = 160
            canvas.height = Math.max(1, Math.round((160 * video.videoHeight) / video.videoWidth))
            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
                let totalBrightness = 0
                for (let i = 0; i < data.length; i += 4) {
                    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3
                }
                const brightness = totalBrightness / (data.length / 4)
                setLightingQuality(brightness > 80 && brightness < 200 ? "good" : "poor")
            } catch (err) {
                // Silently handle canvas errors during initialization
                console.debug("Canvas analysis error:", err)
            }
        }
        raf = requestAnimationFrame(analyzeFrame)
        return () => cancelAnimationFrame(raf)
    }, [stream, interviewType, phase])

    // Start camera/microphone
    const startCamera = async (kind: Kind, facing: "user" | "environment" = facingMode): Promise<MediaStream> => {
        setCameraInitializing(true)
        setLightingQuality("checking")
        try {
            const constraints = kind === "video"
                ? { video: { facingMode: facing, width: 1280, height: 720 }, audio: true }
                : { audio: true }

            const s = await navigator.mediaDevices.getUserMedia(constraints)
            streamRef.current = s
            setStream(s)
            setCameraInitializing(false)
            return s
        } catch (err) {
            console.error("Error accessing media devices:", err)
            setError(kind === "video"
                ? "The camera did not open. Allow the camera and microphone for this site, then try again."
                : "The microphone did not open. Allow it for this site, then try again.")
            setCameraInitializing(false)
            throw err
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        setStream(null)
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
    }

    // Flip camera
    const flipCamera = async () => {
        const newFacingMode = facingMode === "user" ? "environment" : "user"
        const previousFacingMode = facingMode

        try {
            setFacingMode(newFacingMode)

            // Restart camera with new facing mode (passed in: the state above
            // has not updated yet inside this handler)
            if (streamRef.current) {
                stopCamera()
                await startCamera("video", newFacingMode)
            }
        } catch {
            // Revert to previous facing mode if camera switch fails
            setFacingMode(previousFacingMode)

            // Show error message
            const cameraType = newFacingMode === "environment" ? "back" : "front"
            setError(`This phone has no ${cameraType} camera. Using the ${previousFacingMode === "user" ? "front" : "back"} camera instead.`)

            // Clear error after 3 seconds
            setTimeout(() => setError(null), 3000)

            // Restart with previous camera
            try {
                await startCamera("video", previousFacingMode)
            } catch (restartErr) {
                console.error("Failed to restart camera:", restartErr)
            }
        }
    }

    const startRecording = async (kind: Kind) => {
        let s: MediaStream
        try {
            s = streamRef.current || (await startCamera(kind))
        } catch {
            // startCamera already said what went wrong.
            return
        }

        try {
            const options = kind === "video"
                ? { mimeType: "video/webm;codecs=vp9" }
                : { mimeType: "audio/webm" }

            const mediaRecorder = new MediaRecorder(s, options)
            mediaRecorderRef.current = mediaRecorder

            const chunks: Blob[] = []
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data)
                }
            }

            mediaRecorder.onstop = () => {
                setRecordedChunks(chunks)
                // Create preview URL
                const blob = new Blob(chunks, {
                    type: kind === "video" ? "video/webm" : "audio/webm",
                })
                setRecordedPreviewUrl(URL.createObjectURL(blob))
            }

            mediaRecorder.start()
            setError(null)
            setPhase("recording")
            setRecordingTime(0)

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1)
            }, 1000)
        } catch (err) {
            console.error("Error starting recording:", err)
            // A microphone left open with nothing recording keeps the
            // browser's recording light on.
            if (kind === "audio") stopCamera()
            setError("The recording did not start. Try again, or record in another app and choose Upload a file.")
        }
    }

    // The three ways in.
    const chooseAudio = () => {
        setError(null)
        setShowErrors(false)
        setInterviewType("audio")
        // Show reminder modal only if user hasn't seen it yet
        if (!hasSeenReminder) setShowReminderModal(true)
        else void startRecording("audio")
    }

    const chooseVideo = async () => {
        setError(null)
        setShowErrors(false)
        setInterviewType("video")
        // Camera preview first, so the creator can frame the owner and flip
        // cameras before recording.
        setPhase("ready")
        try {
            await startCamera("video")
        } catch {
            setPhase("choose")
        }
    }

    const chooseFile = () => fileInputRef.current?.click()

    // Video: the tips come before the first recording, as before.
    const initiateRecording = () => {
        if (!hasSeenReminder) setShowReminderModal(true)
        else void startRecording("video")
    }

    const beginFromTips = () => {
        setShowReminderModal(false)
        setHasSeenReminder(true)
        void startRecording(interviewType ?? "audio")
    }

    const cancelReady = () => {
        stopCamera()
        setPhase("choose")
    }

    const pauseRecording = () => {
        if (mediaRecorderRef.current && phase === "recording") {
            mediaRecorderRef.current.pause()
            setPhase("paused")
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }

    const resumeRecording = () => {
        if (mediaRecorderRef.current && phase === "paused") {
            mediaRecorderRef.current.resume()
            setPhase("recording")

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1)
            }, 1000)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop()
            setPhase("recorded")
            if (timerRef.current) clearInterval(timerRef.current)
            stopCamera()
        }
    }

    const retakeRecording = () => {
        // Clean up preview
        if (recordedPreviewUrl) {
            URL.revokeObjectURL(recordedPreviewUrl)
        }
        setRecordedPreviewUrl(null)
        setRecordedChunks([])
        setRecordingTime(0)
        setCurrentQuestion(0)
        setError(null) // Clear any previous errors
        setPhase("choose")
    }

    // One picker for audio and video: the file's own type decides which
    // limits apply and how it is filed, as choosing Audio or Video first did.
    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const input = e.target
        const selectedFile = input.files?.[0]
        // Let the same file be picked again.
        input.value = ""
        if (!selectedFile) return

        let kind: Kind
        if (selectedFile.type.startsWith("video/")) {
            if (selectedFile.size > MAX_VIDEO_BYTES) {
                setError("That video is over 500 MB. Pick a smaller file.")
                return
            }
            kind = "video"
        } else if (selectedFile.type.startsWith("audio/")) {
            if (selectedFile.size > MAX_AUDIO_BYTES) {
                setError("That audio file is over 50 MB. Pick a smaller file.")
                return
            }
            kind = "audio"
        } else {
            setError("Pick an audio file (MP3, WAV) or a video (MP4, MOV).")
            return
        }

        setError(null)
        setShowErrors(false)
        setInterviewType(kind)
        setFile(selectedFile)
        setPhase("file")
    }

    // The new interview waiting to be uploaded, as a file.
    const pendingUpload = (): { file: File; kind: Kind } | null => {
        if (!interviewType) return null
        if (phase === "file" && file) return { file, kind: interviewType }
        if (phase === "recorded" && recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, {
                type: interviewType === "video" ? "video/webm" : "audio/webm",
            })
            return { file: new File([blob], `interview.webm`, { type: blob.type }), kind: interviewType }
        }
        return null
    }

    const uploadInterview = async (fileToUpload: File, kind: Kind, id: string) => {
        // Get presigned upload URL from R2 action
        const { uploadUrl, publicUrl } = await generateR2UploadUrl({
            fileName: fileToUpload.name,
            fileType: fileToUpload.type,
            submissionId: id,
            mediaType: kind === "video" ? "video" : "audio",
        })

        // Upload the file directly to R2
        const result = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": fileToUpload.type },
            body: fileToUpload,
        })

        if (!result.ok) {
            throw new Error("Failed to upload interview")
        }

        // Update submission with R2 URL. Payout is 50% of the website sell
        // price, set with the draft and finalized on the review page; the
        // interview does not touch it. See lib/pricing.ts.
        await updateSubmission({
            id: id as Id<"submissions">,
            ...(kind === "video" ? { videoUrl: publicUrl } : { audioUrl: publicUrl }),
        })
    }

    const savedKind = savedInterviewKind(submission)

    const handleNext = async () => {
        if (!submissionId) return

        const pending = pendingUpload()

        if (!pending && !savedKind) {
            setShowErrors(true)
            return
        }

        // Nothing new: keep the interview the draft already has.
        if (!pending) {
            router.push("/submit/review")
            return
        }

        setLoading(true)
        setUploadError(null)

        try {
            await uploadInterview(pending.file, pending.kind, submissionId)
            router.push("/submit/review")
        } catch (err) {
            console.error("Error uploading interview:", err)
            setUploadError(errorText(err, "Failed to upload interview. Please try again."))
        } finally {
            setLoading(false)
        }
    }

    const handleSaveDraft = async () => {
        if (!submissionId) return
        const pending = pendingUpload()
        if (!pending) {
            toast.success("Draft saved. It is waiting in Submissions.")
            return
        }
        setLoading(true)
        setUploadError(null)
        try {
            await uploadInterview(pending.file, pending.kind, submissionId)
            // Saved: it is the draft's interview now, shown as such.
            if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl)
            setRecordedPreviewUrl(null)
            setRecordedChunks([])
            setFile(null)
            setReplacing(false)
            setPhase("choose")
            toast.success("Draft saved. It is waiting in Submissions.")
        } catch (err) {
            console.error("Error uploading interview:", err)
            setUploadError(errorText(err, "Failed to upload interview. Please try again."))
        } finally {
            setLoading(false)
        }
    }

    const nextQuestion = () => {
        setCurrentQuestion((prev) => Math.min(INTERVIEW_QUESTIONS.length - 1, prev + 1))
    }

    const prevQuestion = () => {
        setCurrentQuestion((prev) => Math.max(0, prev - 1))
    }

    // Loading state
    if (!isLoaded || !isSignedIn || creator === undefined || !submissionId || submission === undefined) {
        return (
            <SubmitFrame step={2}>
                <StepLoading label="Loading the interview" shape="cards" />
            </SubmitFrame>
        )
    }

    if (submission === null) {
        return (
            <SubmitFrame step={2}>
                <DraftMissing />
            </SubmitFrame>
        )
    }

    const live = phase === "ready" || phase === "recording" || phase === "paused"
    const hasPending = phase === "recorded" || phase === "file"
    const showSaved = phase === "choose" && !!savedKind && !replacing
    // A stopped recording is assembled a moment later (the recorder's onstop);
    // until then there is nothing to upload yet.
    const assembling = phase === "recorded" && recordedPreviewUrl === null

    const rows = needRows({
        step: 2,
        businessErrors: infoErrors(infoFromDoc(submission)),
        photoCount: (submission.photos ?? []).filter(Boolean).length,
        interview: hasPending ? "pending" : phase === "recording" || phase === "paused" ? "recording" : savedKind,
        ownerName: submission.ownerName,
    })

    let barMessage: ReactNode = `Step 3 of 4 · ${hasPending ? "Not saved yet" : "Draft saved"}`
    let barError = false
    if (uploadError) {
        barMessage = uploadError
        barError = true
    } else if (phase === "recording" || phase === "paused") {
        barMessage = "Stop the recording to continue."
    } else if (phase === "ready") {
        barMessage = "Start recording, or cancel to pick another way."
    } else if (showErrors && !savedKind && !hasPending) {
        barMessage = "Record or upload the interview to continue."
        barError = true
    }

    return (
        <SubmitFrame
            step={2}
            rail={<NeedsCard rows={rows} />}
            railLabel="What is still needed"
            bar={
                <ActionBar back="/submit/photos" message={barMessage} error={barError}>
                    <Button onClick={handleSaveDraft} disabled={loading || live || assembling}>
                        Save draft
                    </Button>
                    {!live && (
                        <Button variant="primary" onClick={handleNext} disabled={loading || assembling} aria-busy={loading}>
                            {loading ? "Uploading…" : "Continue"}
                            {!loading && <Icon icon={ArrowRight} />}
                        </Button>
                    )}
                </ActionBar>
            }
        >
            <div className="flex flex-col gap-1.5">
                <h2 className="t-h2">The owner’s story</h2>
                <p className="t-body">
                    Ask the owner the {INTERVIEW_QUESTIONS.length} questions and record the answers, about 30 minutes. The website is written from what they say.
                </p>
            </div>

            {error && (
                <p className="t-error -mt-4" role="alert">
                    {error}
                </p>
            )}

            {/* The interview the draft already has. */}
            {showSaved && savedKind && (
                <InterviewRow
                    icon={savedKind === "video" ? Video : Mic}
                    title={savedKind === "video" ? "Video interview" : "Audio interview"}
                    meta="Saved with this draft"
                    status={<Status tone="done" word="Added" />}
                    action={
                        <Button size="sm" onClick={() => setReplacing(true)}>
                            Record again
                        </Button>
                    }
                />
            )}

            {phase === "choose" && !showSaved && (
                <>
                    {savedKind && replacing && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-r1-card bg-r1-fill-2 px-4 py-3">
                            <p className="t-meta">The saved {savedKind} interview stays on this draft until you add a new one.</p>
                            <Button size="sm" variant="ghost" onClick={() => setReplacing(false)}>
                                Keep the saved one
                            </Button>
                        </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <MethodButton icon={Mic} name="Record audio" meta="Just the voice. Easiest for a shy owner or a busy counter." onClick={chooseAudio} />
                        <MethodButton icon={Video} name="Record video" meta="Face and voice, with the phone’s camera." onClick={chooseVideo} />
                        <MethodButton
                            icon={Upload}
                            name="Upload a file"
                            meta="Recorded in another app. MP3 or WAV up to 50 MB; MP4 or MOV up to 500 MB."
                            onClick={chooseFile}
                        />
                    </div>
                    {showErrors && !savedKind && <p className="t-error -mt-4">Record or upload the interview to continue.</p>}
                    <Fold title={`The ${INTERVIEW_QUESTIONS.length} questions to ask`}>
                        <ol className="m-0 flex list-none flex-col gap-4 p-0 pb-2">
                            {INTERVIEW_QUESTIONS.map((q, i) => (
                                <li key={q} className="flex items-start gap-3.5">
                                    <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-r1-fill text-xs font-semibold text-r1-ink-2">
                                        {i + 1}
                                    </span>
                                    <span className="t-body">{q}</span>
                                </li>
                            ))}
                        </ol>
                        <p className="t-meta">They stay on screen while you record, one at a time.</p>
                    </Fold>
                </>
            )}

            {live && interviewType && (
                <section className="t-card t-card-pad flex flex-col gap-4" aria-label="Recording">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {phase === "ready" ? (
                            <Status tone="off" word={cameraInitializing ? "Opening the camera…" : "Not recording yet"} />
                        ) : (
                            <span className="t-status">
                                <Dot tone="bad" />
                                <span className="font-medium text-r1-ink">{phase === "paused" ? "Paused" : "Recording"}</span>
                                <span className="t-mono t-num text-[13px] text-r1-ink">{clock(recordingTime)}</span>
                            </span>
                        )}
                        <span className="t-meta">Aim for about 30 minutes</span>
                    </div>

                    {interviewType === "video" ? (
                        <div className="relative h-[min(56vh,420px)] overflow-hidden rounded-[10px] bg-r1-ink sm:h-[300px]">
                            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                            <canvas ref={canvasRef} className="hidden" />
                            {!stream && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px] text-r1-ink-4">
                                    <Icon icon={Camera} size={28} />
                                    {cameraInitializing ? "Opening the camera…" : "Camera preview"}
                                </div>
                            )}
                            {phase !== "ready" && (
                                <span className="absolute left-3.5 top-3.5 inline-flex h-7 items-center gap-2 rounded-full bg-r1-ink/80 px-2.5 text-xs text-r1-paper">
                                    <Dot tone="bad" />
                                    <span className="t-mono t-num">{clock(recordingTime)}</span>
                                </span>
                            )}
                            {stream && lightingQuality !== "checking" && (
                                <span className="absolute bottom-3.5 left-3.5 inline-flex h-7 items-center gap-2 rounded-full bg-r1-paper px-2.5 text-xs text-r1-ink">
                                    <Dot tone={lightingQuality === "good" ? "done" : "attn"} />
                                    {lightingQuality === "good" ? "Lighting is good" : "Improve the lighting"}
                                </span>
                            )}
                            <Button
                                size="sm"
                                icon
                                className="absolute right-3.5 top-3.5 bg-r1-paper"
                                onClick={flipCamera}
                                disabled={phase !== "ready" || !stream}
                                aria-label={facingMode === "user" ? "Switch to the back camera" : "Switch to the front camera"}
                                title={phase !== "ready" ? "The camera cannot be switched while recording" : undefined}
                            >
                                <Icon icon={SwitchCamera} />
                            </Button>
                        </div>
                    ) : (
                        <div
                            className={cx(
                                "flex h-[120px] items-center justify-center gap-1 overflow-hidden rounded-[10px] bg-r1-fill-2",
                                phase === "recording" && "motion-safe:animate-pulse",
                            )}
                            aria-hidden="true"
                        >
                            {WAVE.map((h, i) => (
                                <span key={i} className="inline-block w-1 flex-none rounded-sm bg-r1-ink-4" style={{ height: h }} />
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-2.5 rounded-[10px] border border-r1-line px-5 py-[18px]">
                        <span className="t-label t-num">
                            Question {currentQuestion + 1} of {INTERVIEW_QUESTIONS.length}
                        </span>
                        <p className="text-lg font-medium leading-[26px] text-r1-ink" aria-live="polite">
                            {INTERVIEW_QUESTIONS[currentQuestion]}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={prevQuestion} disabled={currentQuestion === 0}>
                                <Icon icon={ChevronLeft} />
                                Previous
                            </Button>
                            <Button size="sm" onClick={nextQuestion} disabled={currentQuestion === INTERVIEW_QUESTIONS.length - 1}>
                                Next question
                                <Icon icon={ChevronRight} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        {phase === "ready" && (
                            <>
                                <Button onClick={cancelReady}>Cancel</Button>
                                <Button variant="primary" onClick={initiateRecording} disabled={!stream}>
                                    Start recording
                                </Button>
                            </>
                        )}
                        {phase === "recording" && <Button onClick={pauseRecording}>Pause</Button>}
                        {phase === "paused" && <Button onClick={resumeRecording}>Resume</Button>}
                        {(phase === "recording" || phase === "paused") && (
                            <Button variant="primary" onClick={stopRecording}>
                                Stop and keep recording
                            </Button>
                        )}
                    </div>
                </section>
            )}

            {phase === "recorded" && interviewType && (
                <InterviewRow
                    icon={interviewType === "video" ? Video : Mic}
                    title={interviewType === "video" ? "Video recording" : "Audio recording"}
                    meta={`Length ${clock(recordingTime)} · recorded on this phone`}
                    status={<Status tone="done" word="Recorded" />}
                    action={
                        <Button size="sm" onClick={retakeRecording} disabled={loading}>
                            Record again
                        </Button>
                    }
                >
                    {recordedPreviewUrl ? (
                        interviewType === "video" ? (
                            <video src={recordedPreviewUrl} controls playsInline className="max-h-[60vh] w-full rounded-[10px] bg-r1-ink" />
                        ) : (
                            <audio src={recordedPreviewUrl} controls className="w-full" />
                        )
                    ) : (
                        <p className="t-meta">Preparing the recording…</p>
                    )}
                </InterviewRow>
            )}

            {phase === "file" && file && (
                <InterviewRow
                    icon={Upload}
                    title={file.name}
                    meta={`${fileSize(file.size)} · ${interviewType === "video" ? "video" : "audio"} file`}
                    status={<Status tone="done" word="Ready" />}
                    action={
                        <Button size="sm" onClick={chooseFile} disabled={loading}>
                            Replace file
                        </Button>
                    }
                />
            )}

            {hasPending && <p className="t-meta -mt-4">It uploads when you continue. Keep this screen open until the next step opens.</p>}

            <input
                ref={fileInputRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/wav,video/mp4,video/quicktime"
                onChange={handleFileSelect}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                disabled={loading}
            />

            {/* Pre-Recording Reminder ("Ready to record?") */}
            <Dialog
                open={showReminderModal}
                onClose={() => setShowReminderModal(false)}
                title="Ready to record?"
                footer={
                    <>
                        <Button onClick={() => setShowReminderModal(false)}>Not yet</Button>
                        <Button variant="primary" onClick={beginFromTips}>
                            Start recording
                        </Button>
                    </>
                }
            >
                <p className="t-meta">Four things that make the interview easy to use.</p>
                <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
                    {TIPS.map((tip) => (
                        <li key={tip.title} className="flex items-start gap-3">
                            <span className="mt-0.5 flex flex-none text-r1-ink">
                                <Icon icon={Check} />
                            </span>
                            <span className="flex flex-col">
                                <span className="text-sm font-medium text-r1-ink">{tip.title}</span>
                                <span className="t-meta">{tip.body}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            </Dialog>
        </SubmitFrame>
    )
}
