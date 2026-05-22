"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

const INTERVIEW_QUESTIONS = [
    "What does your business do and who are your customers?",
    "What are the main services or products you offer?",
    "What makes your business different from others? Why do customers choose you?",
    "Can you share a favorite customer story or project you're proud of?",
    "What should customers know before visiting or contacting you?",
]

type RecordingMode = 'upload' | 'record'
type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped'

export default function InterviewUploadPage() {
    const router = useRouter()
    const { user, isLoaded, isSignedIn } = useUser()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [submissionId, setSubmissionId] = useState<string | null>(null)

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

    // Form state
    const [interviewType, setInterviewType] = useState<'video' | 'audio' | null>(null)
    const [mode, setMode] = useState<RecordingMode>('record')
    const [file, setFile] = useState<File | null>(null)
    const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null)

    // Recording state
    const [recordingState, setRecordingState] = useState<RecordingState>('idle')
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
    const [recordingTime, setRecordingTime] = useState(0)
    const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null)
    const [showReminderModal, setShowReminderModal] = useState(false)
    const [hasSeenReminder, setHasSeenReminder] = useState(false)
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
    const [cameraInitializing, setCameraInitializing] = useState(false)

    // Quality feedback
    const [lightingQuality, setLightingQuality] = useState<'good' | 'poor' | 'checking'>('checking')
    const [faceDetected, setFaceDetected] = useState(false)
    const [faceCentered, setFaceCentered] = useState(false)

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null)
    const playbackRef = useRef<HTMLVideoElement | HTMLAudioElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Redirect if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login")
        }
    }, [isLoaded, isSignedIn, router])

    // Load submission ID from session
    useEffect(() => {
        const id = sessionStorage.getItem('current_submission_id')
        if (!id) {
            router.push('/submit/info')
            return
        }
        setSubmissionId(id)
    }, [router])

    // Load existing data when submission is available
    useEffect(() => {
        if (submission) {
            if (submission.videoStorageId) {
                setInterviewType('video')
                setExistingFileUrl('video_exists') // Placeholder - has video
            } else if (submission.audioStorageId) {
                setInterviewType('audio')
                setExistingFileUrl('audio_exists') // Placeholder - has audio
            }
        }
    }, [submission])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera()
            if (timerRef.current) clearInterval(timerRef.current)
            if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl)
        }
    }, [recordedPreviewUrl])

    // Start camera/microphone
    const startCamera = async () => {
        setCameraInitializing(true)
        try {
            const constraints = interviewType === 'video'
                ? { video: { facingMode: facingMode, width: 1280, height: 720 }, audio: true }
                : { audio: true }

            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            streamRef.current = stream

            if (videoRef.current && interviewType === 'video') {
                videoRef.current.srcObject = stream

                // Ensure video plays
                try {
                    await videoRef.current.play()
                } catch (playErr) {
                    console.error('Error playing video:', playErr)
                }

                // Start quality analysis
                startQualityAnalysis()
            } else if (interviewType === 'video') {
                // Video ref not ready, wait a bit and try again
                console.warn('Video element not ready, retrying...')
                setTimeout(() => {
                    if (videoRef.current && streamRef.current) {
                        videoRef.current.srcObject = streamRef.current
                        videoRef.current.play().catch(err => console.error('Retry play error:', err))
                        startQualityAnalysis()
                    }
                }, 100)
            }

            setCameraInitializing(false)
            return stream
        } catch (err) {
            console.error('Error accessing media devices:', err)
            setError('Unable to access camera/microphone. Please grant permissions.')
            setCameraInitializing(false)
            throw err
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
    }

    // Quality analysis
    const startQualityAnalysis = () => {
        if (!videoRef.current || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const analyzeFrame = () => {
            if (!videoRef.current || recordingState === 'stopped') return

            const video = videoRef.current

            // Wait for video to have valid dimensions
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                requestAnimationFrame(analyzeFrame)
                return
            }

            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

                const brightness = analyzeBrightness(imageData)
                setLightingQuality(brightness > 80 && brightness < 200 ? 'good' : 'poor')

                const centerDetection = analyzeCenterRegion(imageData)
                setFaceDetected(centerDetection.hasContent)
                setFaceCentered(centerDetection.isCentered)
            } catch (err) {
                // Silently handle canvas errors during initialization
                console.debug('Canvas analysis error:', err)
            }

            requestAnimationFrame(analyzeFrame)
        }

        analyzeFrame()
    }

    const analyzeBrightness = (imageData: ImageData): number => {
        let totalBrightness = 0
        for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i]
            const g = imageData.data[i + 1]
            const b = imageData.data[i + 2]
            totalBrightness += (r + g + b) / 3
        }
        return totalBrightness / (imageData.data.length / 4)
    }

    const analyzeCenterRegion = (imageData: ImageData): { hasContent: boolean, isCentered: boolean } => {
        const width = imageData.width
        const height = imageData.height

        const centerX = width * 0.3
        const centerY = height * 0.2
        const centerWidth = width * 0.4
        const centerHeight = height * 0.6

        let centerBrightness = 0
        let edgeBrightness = 0
        let centerPixels = 0
        let edgePixels = 0

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4
                const brightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3

                if (x >= centerX && x <= centerX + centerWidth && y >= centerY && y <= centerY + centerHeight) {
                    centerBrightness += brightness
                    centerPixels++
                } else {
                    edgeBrightness += brightness
                    edgePixels++
                }
            }
        }

        const avgCenter = centerBrightness / centerPixels
        const avgEdge = edgeBrightness / edgePixels

        const hasContent = Math.abs(avgCenter - avgEdge) > 15
        const isCentered = hasContent && avgCenter > avgEdge - 20

        return { hasContent, isCentered }
    }

    // Flip camera
    const flipCamera = async () => {
        const newFacingMode = facingMode === 'user' ? 'environment' : 'user'
        const previousFacingMode = facingMode

        try {
            setFacingMode(newFacingMode)

            // Restart camera with new facing mode
            if (streamRef.current) {
                stopCamera()
                await startCamera()
            }
        } catch (err) {
            // Revert to previous facing mode if camera switch fails
            setFacingMode(previousFacingMode)

            // Show error message
            const cameraType = newFacingMode === 'environment' ? 'back' : 'front'
            setError(`This device doesn't have a ${cameraType} camera. Using ${previousFacingMode === 'user' ? 'front' : 'back'} camera instead.`)

            // Clear error after 3 seconds
            setTimeout(() => setError(null), 3000)

            // Restart with previous camera
            try {
                await startCamera()
            } catch (restartErr) {
                console.error('Failed to restart camera:', restartErr)
            }
        }
    }

    // Recording controls
    const initiateRecording = () => {
        // Show reminder modal only if user hasn't seen it yet
        if (!hasSeenReminder) {
            setShowReminderModal(true)
        } else {
            // If already seen, start recording directly
            startRecording()
        }
    }

    const handleReminderClose = async () => {
        setShowReminderModal(false)
        setHasSeenReminder(true)

        // Start camera preview so user can see and flip cameras before recording
        if (interviewType === 'video') {
            await startCamera()
        }
    }

    const startRecording = async () => {
        try {
            const stream = streamRef.current || await startCamera()

            const options = interviewType === 'video'
                ? { mimeType: 'video/webm;codecs=vp9' }
                : { mimeType: 'audio/webm' }

            const mediaRecorder = new MediaRecorder(stream, options)
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
                    type: interviewType === 'video' ? 'video/webm' : 'audio/webm'
                })
                const url = URL.createObjectURL(blob)
                setRecordedPreviewUrl(url)
            }

            mediaRecorder.start()
            setRecordingState('recording')
            setRecordingTime(0)

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)

        } catch (err) {
            console.error('Error starting recording:', err)
            setError('Failed to start recording. Please try again.')
        }
    }

    const pauseRecording = () => {
        if (mediaRecorderRef.current && recordingState === 'recording') {
            mediaRecorderRef.current.pause()
            setRecordingState('paused')
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }

    const resumeRecording = () => {
        if (mediaRecorderRef.current && recordingState === 'paused') {
            mediaRecorderRef.current.resume()
            setRecordingState('recording')

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop()
            setRecordingState('stopped')
            if (timerRef.current) clearInterval(timerRef.current)
            stopCamera()
        }
    }

    const retakeRecording = async () => {
        // Clean up preview
        if (recordedPreviewUrl) {
            URL.revokeObjectURL(recordedPreviewUrl)
        }
        setRecordedPreviewUrl(null)
        setRecordedChunks([])
        setRecordingState('idle')
        setRecordingTime(0)
        setCurrentQuestion(0)
        setError(null) // Clear any previous errors

        // Restart camera preview so user can flip cameras before recording again
        if (interviewType === 'video') {
            try {
                await startCamera()
            } catch (err) {
                console.error('Failed to start camera after retake:', err)
                setError('Failed to start camera. Please try again or check permissions.')
            }
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]

            if (interviewType === 'video') {
                if (!selectedFile.type.startsWith('video/')) {
                    setError("Please select a valid video file (MP4, MOV).")
                    return
                }
                if (selectedFile.size > 500 * 1024 * 1024) {
                    setError("Video file is too large. Maximum size is 500MB.")
                    return
                }
            } else {
                if (!selectedFile.type.startsWith('audio/')) {
                    setError("Please select a valid audio file (MP3, WAV).")
                    return
                }
                if (selectedFile.size > 50 * 1024 * 1024) {
                    setError("Audio file is too large. Maximum size is 50MB.")
                    return
                }
            }

            setError(null)
            setFile(selectedFile)
        }
    }

    const handleNext = async () => {
        if (!submissionId || !interviewType) return

        let fileToUpload: File | null = file

        if (mode === 'record' && recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, {
                type: interviewType === 'video' ? 'video/webm' : 'audio/webm'
            })
            fileToUpload = new File([blob], `interview.webm`, {
                type: blob.type
            })
        }

        if (!fileToUpload && !existingFileUrl) {
            setError("Please record or upload an interview file.")
            return
        }

        if (!fileToUpload && existingFileUrl) {
            router.push('/submit/review')
            return
        }

        if (!fileToUpload) return

        setLoading(true)
        setError(null)

        try {
            // Get presigned upload URL from R2 action
            const { uploadUrl, publicUrl } = await generateR2UploadUrl({
                fileName: fileToUpload.name,
                fileType: fileToUpload.type,
                submissionId: submissionId,
                mediaType: interviewType === 'video' ? 'video' : 'audio',
            })

            // Upload the file directly to R2
            const result = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": fileToUpload.type },
                body: fileToUpload,
            })

            if (!result.ok) {
                throw new Error('Failed to upload interview')
            }

            // Update submission with R2 URL and payout
            await updateSubmission({
                id: submissionId as Id<"submissions">,
                ...(interviewType === 'video'
                    ? { videoUrl: publicUrl, creatorPayout: 500 }
                    : { audioUrl: publicUrl, creatorPayout: 300 }
                ),
            })

            router.push('/submit/review')
        } catch (err: any) {
            console.error('Error uploading interview:', err)
            setError(err.message || 'Failed to upload interview. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const nextQuestion = () => {
        setCurrentQuestion(prev => Math.min(INTERVIEW_QUESTIONS.length - 1, prev + 1))
    }

    const prevQuestion = () => {
        setCurrentQuestion(prev => Math.max(0, prev - 1))
    }

    // Check if we have a recorded preview to show
    const hasRecordedPreview = recordedPreviewUrl !== null

    return (
        <div
            className="editorial min-h-screen"
            style={{
                background: "linear-gradient(to bottom right, var(--ed-paper), var(--ed-paper-2))",
                color: "var(--ed-ink)",
                fontFamily: "var(--ed-sans)",
            }}
        >
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 px-4 py-3 sticky top-0 z-50">
                <div className="flex items-center max-w-2xl mx-auto">
                    <button onClick={() => router.back()} className="mr-3 p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex-1 text-center">
                        <h1 className="text-lg font-bold text-gray-900">Upload Interview</h1>
                        <p className="text-xs text-gray-500">Record or upload your business story</p>
                    </div>
                    <div className="w-9"></div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl animate-in slide-in-from-top">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Hide mode toggle and type cards when preview exists */}
                {!hasRecordedPreview && (
                    <>
                        {/* Mode Toggle - At the very top */}
                        <div className="flex gap-2 p-1.5 bg-white rounded-2xl shadow-sm border border-gray-200">
                            <button
                                onClick={() => { setMode('record'); stopCamera(); setRecordingState('idle'); }}
                                className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${mode === 'record'
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Record
                                </div>
                            </button>
                            <button
                                onClick={() => { setMode('upload'); stopCamera(); setRecordingState('idle'); }}
                                className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${mode === 'upload'
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Upload
                                </div>
                            </button>
                        </div>

                        {/* Type Selection Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <div
                                onClick={() => {
                                    if (recordedPreviewUrl && interviewType === 'audio') return; // Disable if audio recorded
                                    setInterviewType('video');
                                    setFile(null);
                                    setRecordedChunks([]);
                                }}
                                className={`relative rounded-2xl p-5 cursor-pointer transition-all transform hover:scale-105 ${recordedPreviewUrl && interviewType === 'audio'
                                    ? 'opacity-50 cursor-not-allowed'
                                    : interviewType === 'video'
                                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 shadow-lg shadow-green-500/20'
                                        : 'bg-white border-2 border-gray-200 hover:border-gray-300 shadow-sm'
                                    }`}
                            >
                                <div className="flex flex-col items-center text-center space-y-3">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${interviewType === 'video' ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg' : 'bg-gray-100'
                                        }`}>
                                        <svg className={`w-7 h-7 ${interviewType === 'video' ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">Video</p>
                                        <p className="text-sm text-green-600 font-bold">₱500</p>
                                    </div>
                                </div>
                                {interviewType === 'video' && (
                                    <div className="absolute top-2 right-2">
                                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            <div
                                onClick={() => {
                                    if (recordedPreviewUrl && interviewType === 'video') return; // Disable if video recorded
                                    setInterviewType('audio');
                                    setFile(null);
                                    setRecordedChunks([]);
                                }}
                                className={`relative rounded-2xl p-5 cursor-pointer transition-all transform hover:scale-105 ${recordedPreviewUrl && interviewType === 'video'
                                    ? 'opacity-50 cursor-not-allowed'
                                    : interviewType === 'audio'
                                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 shadow-lg shadow-green-500/20'
                                        : 'bg-white border-2 border-gray-200 hover:border-gray-300 shadow-sm'
                                    }`}
                            >
                                <div className="flex flex-col items-center text-center space-y-3">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${interviewType === 'audio' ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg' : 'bg-gray-100'
                                        }`}>
                                        <svg className={`w-7 h-7 ${interviewType === 'audio' ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">Audio</p>
                                        <p className="text-sm text-green-600 font-bold">₱300</p>
                                    </div>
                                </div>
                                {interviewType === 'audio' && (
                                    <div className="absolute top-2 right-2">
                                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {interviewType && (
                    <>
                        {/* Show Preview if recording exists */}
                        {hasRecordedPreview && (
                            <div className="space-y-4">
                                <div className="bg-white rounded-2xl p-4 border-2 border-green-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-gray-900">Your Recording</h3>
                                        <span className="text-xs text-gray-500">{formatTime(recordingTime)}</span>
                                    </div>

                                    {/* Video/Audio Player */}
                                    <div className={`relative bg-black rounded-xl overflow-hidden w-full max-h-[70vh] ${interviewType === 'video' ? 'aspect-[9/16]' : 'aspect-[16/9]'}`}>
                                        {interviewType === 'video' ? (
                                            <video
                                                ref={playbackRef as React.RefObject<HTMLVideoElement>}
                                                src={recordedPreviewUrl}
                                                controls
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center p-8">
                                                <audio
                                                    ref={playbackRef as React.RefObject<HTMLAudioElement>}
                                                    src={recordedPreviewUrl}
                                                    controls
                                                    className="w-full"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Retake Button */}
                                    <button
                                        onClick={retakeRecording}
                                        className="w-full mt-4 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Retake Recording
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Recording Mode - Only show if no preview */}
                        {mode === 'record' && !hasRecordedPreview && (
                            <div className="space-y-4">
                                {/* Camera/Audio Preview */}
                                <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl w-full max-h-[70vh] aspect-[9/16] md:aspect-[9/16]">
                                    {interviewType === 'video' ? (
                                        <>
                                            <video
                                                ref={videoRef}
                                                className="w-full h-full object-cover"
                                                playsInline
                                                muted
                                            />
                                            <canvas ref={canvasRef} className="hidden" />

                                            {/* Overlay Content */}
                                            {streamRef.current && (
                                                <div className="absolute inset-0 flex flex-col justify-between p-5">
                                                    {/* Top Status Bar */}
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-2">
                                                            {recordingState === 'recording' && (
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/95 backdrop-blur-sm text-white rounded-full text-xs font-bold">
                                                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                                                                    {formatTime(recordingTime)}
                                                                </div>
                                                            )}

                                                            {lightingQuality === 'good' && (
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/95 backdrop-blur-sm text-white rounded-full text-xs font-semibold">
                                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                    </svg>
                                                                    Lighting is good!
                                                                </div>
                                                            )}

                                                            {lightingQuality === 'poor' && (
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/95 backdrop-blur-sm text-white rounded-full text-xs font-semibold">
                                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                    </svg>
                                                                    Improve lighting
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col items-end gap-2">
                                                            <div className="px-3 py-2 bg-black/60 backdrop-blur-sm text-white rounded-full text-xs font-medium">
                                                                {currentQuestion + 1}/{INTERVIEW_QUESTIONS.length}
                                                            </div>

                                                            {/* Flip Camera Button */}
                                                            <button
                                                                onClick={flipCamera}
                                                                disabled={recordingState === 'recording' || recordingState === 'paused'}
                                                                className={`p-2 bg-black/60 backdrop-blur-sm rounded-full transition-colors ${recordingState === 'recording' || recordingState === 'paused'
                                                                    ? 'opacity-50 cursor-not-allowed'
                                                                    : 'hover:bg-black/80'
                                                                    }`}
                                                                title={
                                                                    recordingState === 'recording' || recordingState === 'paused'
                                                                        ? 'Cannot flip camera while recording'
                                                                        : facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'
                                                                }
                                                            >
                                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Bottom Question with Navigation */}
                                                    <div className="space-y-3">
                                                        <div className="bg-gradient-to-t from-black/90 via-black/70 to-transparent backdrop-blur-md rounded-3xl p-5">
                                                            <p className="text-white text-base font-medium leading-relaxed text-center mb-4">
                                                                "{INTERVIEW_QUESTIONS[currentQuestion]}"
                                                            </p>

                                                            {/* Navigation Arrows */}
                                                            <div className="flex items-center justify-center gap-3">
                                                                <button
                                                                    onClick={prevQuestion}
                                                                    disabled={currentQuestion === 0}
                                                                    className="p-3 bg-white/20 backdrop-blur-sm rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/30 transition-all active:scale-95"
                                                                >
                                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                                                    </svg>
                                                                </button>

                                                                <div className="flex gap-1.5">
                                                                    {INTERVIEW_QUESTIONS.map((_, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className={`h-1.5 rounded-full transition-all ${idx === currentQuestion
                                                                                ? 'w-8 bg-white'
                                                                                : 'w-1.5 bg-white/40'
                                                                                }`}
                                                                        />
                                                                    ))}
                                                                </div>

                                                                <button
                                                                    onClick={nextQuestion}
                                                                    disabled={currentQuestion === INTERVIEW_QUESTIONS.length - 1}
                                                                    className="p-3 bg-white/20 backdrop-blur-sm rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/30 transition-all active:scale-95"
                                                                >
                                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {!streamRef.current && recordingState === 'idle' && !cameraInitializing && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                                                    <div className="text-center text-white">
                                                        <div className="w-20 h-20 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                                                            <svg className="w-10 h-10 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                        <p className="text-sm opacity-75">Camera preview will appear here</p>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 to-black">
                                            {recordingState !== 'idle' ? (
                                                <>
                                                    <div className="flex items-end gap-1.5 h-32 mb-8">
                                                        {[...Array(20)].map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className="w-2 bg-gradient-to-t from-green-500 to-emerald-400 rounded-full"
                                                                style={{
                                                                    height: `${20 + Math.random() * 80}%`,
                                                                    animation: 'pulse 0.8s ease-in-out infinite',
                                                                    animationDelay: `${i * 0.05}s`
                                                                }}
                                                            ></div>
                                                        ))}
                                                    </div>
                                                    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 text-center max-w-sm">
                                                        <p className="text-white text-base font-medium leading-relaxed mb-4">
                                                            "{INTERVIEW_QUESTIONS[currentQuestion]}"
                                                        </p>
                                                        <div className="flex items-center justify-center gap-3">
                                                            <button
                                                                onClick={prevQuestion}
                                                                disabled={currentQuestion === 0}
                                                                className="p-2 bg-white/20 rounded-full disabled:opacity-30"
                                                            >
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                                </svg>
                                                            </button>
                                                            <span className="text-white/60 text-xs">{currentQuestion + 1}/{INTERVIEW_QUESTIONS.length}</span>
                                                            <button
                                                                onClick={nextQuestion}
                                                                disabled={currentQuestion === INTERVIEW_QUESTIONS.length - 1}
                                                                className="p-2 bg-white/20 rounded-full disabled:opacity-30"
                                                            >
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center text-white">
                                                    <div className="w-20 h-20 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                                                        <svg className="w-10 h-10 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-sm opacity-75">Ready to record audio</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Recording Controls */}
                                <div className="flex justify-center items-center gap-4 py-4">
                                    {recordingState === 'idle' && (
                                        <button
                                            onClick={initiateRecording}
                                            className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center shadow-2xl shadow-red-500/40 transition-all active:scale-95"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-white"></div>
                                        </button>
                                    )}

                                    {recordingState === 'recording' && (
                                        <>
                                            <button
                                                onClick={pauseRecording}
                                                className="w-16 h-16 rounded-full bg-gray-800 hover:bg-gray-900 flex items-center justify-center shadow-xl"
                                            >
                                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={stopRecording}
                                                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl"
                                            >
                                                <div className="w-6 h-6 bg-white rounded-sm"></div>
                                            </button>
                                        </>
                                    )}

                                    {recordingState === 'paused' && (
                                        <>
                                            <button
                                                onClick={resumeRecording}
                                                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-xl"
                                            >
                                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={stopRecording}
                                                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl"
                                            >
                                                <div className="w-6 h-6 bg-white rounded-sm"></div>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Upload Mode */}
                        {mode === 'upload' && !hasRecordedPreview && (
                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-gray-300 rounded-3xl p-12 text-center hover:border-green-400 transition-all relative bg-white shadow-sm">
                                    <input
                                        type="file"
                                        accept={interviewType === 'video' ? "video/mp4,video/quicktime" : "audio/mpeg,audio/mp4,audio/wav"}
                                        onChange={handleFileSelect}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={loading}
                                    />
                                    {file ? (
                                        <div className="flex flex-col items-center gap-3 text-green-600">
                                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <span className="font-semibold">{file.name}</span>
                                        </div>
                                    ) : existingFileUrl ? (
                                        <div className="space-y-3">
                                            <div className="mx-auto w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <p className="text-green-600 font-semibold">File already uploaded</p>
                                            <p className="text-xs text-gray-400">Click to replace</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400 rounded-full flex items-center justify-center">
                                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-gray-700 font-semibold text-lg">Click to upload {interviewType}</p>
                                                <p className="text-sm text-gray-400 mt-2">
                                                    {interviewType === 'video' ? 'MP4, MOV • Max 500MB' : 'MP3, WAV • Max 50MB'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Next Button */}
                        <Button
                            onClick={handleNext}
                            disabled={loading || (mode === 'upload' && !file && !existingFileUrl) || (mode === 'record' && recordedChunks.length === 0 && !existingFileUrl)}
                            className="w-full h-14 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-green-500/30"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Uploading...
                                </span>
                            ) : (
                                'Next: Review & Submit →'
                            )}
                        </Button>
                    </>
                )}
            </div>

            {/* Pre-Recording Reminder Modal */}
            {showReminderModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to Record?</h3>
                            <p className="text-sm text-gray-500">Follow these tips for the best interview</p>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">Find good lighting</h4>
                                    <p className="text-xs text-gray-600">Face a window or light source. Avoid backlighting.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">Choose a quiet place</h4>
                                    <p className="text-xs text-gray-600">Minimize background noise for clear audio.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">Position yourself well</h4>
                                    <p className="text-xs text-gray-600">Center your face in the frame at eye level.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">Be yourself</h4>
                                    <p className="text-xs text-gray-600">Speak naturally and tell your story with passion!</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleReminderClose}
                            className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-500/30"
                        >
                            Got it!
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
