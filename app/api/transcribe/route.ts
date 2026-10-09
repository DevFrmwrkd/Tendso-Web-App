import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { groqService } from '@/lib/services/groq.service'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { isCreatorAccount } from '@/lib/accounts'

type TranscriptionUpdate = {
    transcriptionStatus: 'processing' | 'complete' | 'failed'
    transcript?: string
    transcriptionUpdatedAt?: number
}

// Allow up to 3 minutes for large file chunked transcription (500MB+ files)
export const maxDuration = 180

export async function POST(request: NextRequest) {
    let submissionId: string | undefined
    // Only assigned after the submission and caller are authorized. Errors
    // while checking access must never write "failed" onto somebody's row.
    let updateTranscription: ((update: TranscriptionUpdate) => Promise<unknown>) | undefined

    try {
        // Allow server-to-server calls from Convex (scheduled transcribeMedia action)
        // to bypass Clerk auth via a shared secret header. Server-side only —
        // never surface this header to the browser.
        const providedSecret = request.headers.get('X-Internal-Secret')
        const expectedSecret = process.env.INTERNAL_API_SECRET
        const isInternalCall = !!expectedSecret && providedSecret === expectedSecret

        let authedUserId: string | null = null
        let token: string | null = null
        if (!isInternalCall) {
            const { userId, getToken } = await auth()
            if (!userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
            authedUserId = userId
            token = await getToken({ template: 'convex' })
            if (!token) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        // A client belongs to this request only. Sharing a mutable auth token
        // between concurrent requests would let one caller act as another.
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
        if (token) convex.setAuth(token)

        let account: Doc<'creators'> | null = null
        if (!isInternalCall) {
            const session = await convex.query(api.adminAccess.me, {})
            account = session?.creator ?? null
            if (session?.clerkId !== authedUserId || !account || (!isCreatorAccount(account) && account.role !== 'admin') || account.isDeleted || account.status === 'suspended' || account.status === 'deleted') {
                return NextResponse.json({ error: 'Creator access required' }, { status: 403 })
            }
        }

        const body = await request.json()
        const { audioUrl, useConvexStorage, videoStorageId, audioStorageId, videoUrl } = body
        if (body.submissionId !== undefined && (typeof body.submissionId !== 'string' || !body.submissionId.trim())) {
            return NextResponse.json({ error: 'Invalid submission ID' }, { status: 400 })
        }
        submissionId = body.submissionId
        const submission = submissionId ? await convex.query(api.submissions.getById, {
            id: submissionId as Id<'submissions'>,
        }) : null
        if (submissionId) {
            if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
            if (!isInternalCall && account?.role !== 'admin' && submission.creatorId !== account?._id) {
                return NextResponse.json({ error: 'You can only transcribe your own submissions' }, { status: 403 })
            }
            const id = submissionId as Id<'submissions'>
            updateTranscription = (update) => isInternalCall
                ? convex.mutation(api.submissions.recordTranscriptionFromServer, { id, internalSecret: providedSecret!, ...update })
                : convex.mutation(api.submissions.update, { id, ...update })
        }

        if (!isInternalCall) {
            // Rate limit: expensive operation (5/min) — only applied to user-initiated calls.
            // Internal calls come from our own scheduler so we don't rate-limit them.
            const { checkRateLimit, RATE_LIMITS } = await import('@/lib/security')
            const { allowed } = checkRateLimit(
                `transcribe:${authedUserId}`,
                RATE_LIMITS.expensive.maxRequests,
                RATE_LIMITS.expensive.windowMs
            )
            if (!allowed) {
                return NextResponse.json({ error: 'Too many transcription requests. Please wait a moment.' }, { status: 429 })
            }
        }

        // Resolve a submitted field (url or storage id) into a fetchable URL.
        // Handles full https URLs, R2 relative paths (audio/..., videos/..., images/...),
        // and the `convex:` prefix. Returns null for Convex storage IDs we can't resolve here.
        const r2Prefix = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
        const resolveToUrl = (val?: string | null): string | null => {
            if (typeof val !== 'string' || !val) return null
            if (val.startsWith('http://') || val.startsWith('https://')) return val
            if (/^(images|videos|audio)\//.test(val) && r2Prefix) return `${r2Prefix}/${val}`
            return null
        }

        // Priority: full URLs first, then try R2-shaped storage IDs locally,
        // then fall back to a Convex round-trip for legacy Convex storage IDs.
        let mediaUrl =
            resolveToUrl(videoUrl) ||
            resolveToUrl(audioUrl) ||
            resolveToUrl(videoStorageId?.toString()) ||
            resolveToUrl(audioStorageId?.toString())

        if (!mediaUrl && (videoStorageId || audioStorageId)) {
            const storageId = (videoStorageId || audioStorageId).toString()
            try {
                const url = await convex.query(api.files.getUrlByString, { storageId })
                if (url) {
                    mediaUrl = url
                }
            } catch (err) {
                console.error('Error getting Convex storage URL:', err)
                return NextResponse.json({ error: 'Failed to get media URL' }, { status: 500 })
            }
        }

        // Last-resort: re-read the submission from Convex in case the client
        // sent stale values. A creator who just uploaded audio on an older tab
        // might have a submission row with audioUrl set even if the client
        // state didn't reflect it yet.
        if (!mediaUrl && submission) {
            try {
                const fresh = submission
                if (fresh) {
                    mediaUrl =
                        resolveToUrl(fresh.videoUrl) ||
                        resolveToUrl(fresh.audioUrl) ||
                        resolveToUrl(fresh.videoStorageId?.toString?.()) ||
                        resolveToUrl(fresh.audioStorageId?.toString?.())
                    if (!mediaUrl) {
                        const sid = fresh.videoStorageId || fresh.audioStorageId
                        if (sid) {
                            const url = await convex.query(api.files.getUrlByString, {
                                storageId: sid.toString(),
                            })
                            if (url) mediaUrl = url
                        }
                    }
                }
            } catch (err) {
                console.warn('Fallback submission fetch failed:', err)
            }
        }

        if (!mediaUrl) {
            console.error('[TRANSCRIBE] No URL resolvable', {
                submissionId,
                hasVideoUrl: !!videoUrl,
                hasAudioUrl: !!audioUrl,
                hasVideoStorageId: !!videoStorageId,
                hasAudioStorageId: !!audioStorageId,
                useConvexStorage,
                r2PrefixSet: !!r2Prefix,
            })
            return NextResponse.json({ error: 'Audio/Video URL is required' }, { status: 400 })
        }

        // Unused legacy flag; kept to avoid breaking older clients that still send it.
        void useConvexStorage

        // Set transcription status to processing
        if (updateTranscription) {
            // This also rechecks backend authorization before paid work. A
            // rejected write must stop here, even if access just changed.
            await updateTranscription({ transcriptionStatus: 'processing' })
        }

        // Check file size before transcribing
        try {
            const headResponse = await fetch(mediaUrl, { method: 'HEAD' })
            const contentLength = headResponse.headers.get('content-length')
            if (contentLength) {
                const fileSizeMB = parseInt(contentLength) / 1024 / 1024
                console.log(`Media file size: ${fileSizeMB.toFixed(1)}MB`)
                // Note: Files larger than 20MB will be chunked by groqService
                // This is just an early warning for extremely large files
                if (fileSizeMB > 1000) {
                    return NextResponse.json(
                        { error: `File is extremely large (${fileSizeMB.toFixed(1)}MB). Transcription may fail. Please use a file under 500MB.` },
                        { status: 413 }
                    )
                }
            }
        } catch (err) {
            console.warn('Could not check file size:', err)
            // Continue anyway, will catch errors during transcription
        }

        // Transcribe audio
        const transcript = await groqService.transcribeAudioFromUrl(mediaUrl)

        // Update submission with transcript and status if submissionId provided
        if (updateTranscription) {
            try {
                await updateTranscription({
                    transcript: transcript,
                    transcriptionStatus: 'complete',
                    transcriptionUpdatedAt: Date.now(),
                })
            } catch (err) {
                console.error('Error updating submission:', err)
                return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 })
            }
        }

        return NextResponse.json({
            success: true,
            transcript,
        })
    } catch (error: unknown) {
        console.error('Transcription API error:', error)
        const message = error instanceof Error ? error.message : 'Failed to transcribe audio'

        // Check for specific error types
        let statusCode = 500
        let errorMessage = message

        if (message.includes('413') || message.includes('Entity Too Large')) {
            statusCode = 413
            errorMessage = 'File is too large for transcription. Please upload a smaller file.'
        } else if (message.includes('Invalid file')) {
            errorMessage = 'Invalid audio/video file format. Please use MP3, WAV, MP4, or WebM.'
        } else if (message.includes('timeout') || message.includes('Timeout')) {
            statusCode = 504
            errorMessage = 'Transcription took too long. Please try again with a shorter file.'
        }

        // Set transcription status to failed
        if (updateTranscription) {
            try {
                await updateTranscription({ transcriptionStatus: 'failed' })
            } catch (updateErr) {
                console.error('Error setting failed status:', updateErr)
            }
        }

        return NextResponse.json(
            { error: errorMessage },
            { status: statusCode }
        )
    }
}
