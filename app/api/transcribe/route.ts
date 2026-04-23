import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { groqService } from '@/lib/services/groq.service'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Allow up to 3 minutes for large file chunked transcription (500MB+ files)
export const maxDuration = 180

export async function POST(request: NextRequest) {
    let submissionId: string | undefined

    try {
        // Allow server-to-server calls from Convex (scheduled transcribeMedia action)
        // to bypass Clerk auth via a shared secret header. Server-side only —
        // never surface this header to the browser.
        const providedSecret = request.headers.get('X-Internal-Secret')
        const expectedSecret = process.env.INTERNAL_API_SECRET
        const isInternalCall = !!expectedSecret && providedSecret === expectedSecret

        let authedUserId: string | null = null
        if (!isInternalCall) {
            const { userId } = await auth()
            if (!userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
            authedUserId = userId

            // Rate limit: expensive operation (5/min) — only applied to user-initiated calls.
            // Internal calls come from our own scheduler so we don't rate-limit them.
            const { checkRateLimit, RATE_LIMITS } = await import('@/lib/security')
            const { allowed } = checkRateLimit(
                `transcribe:${userId}`,
                RATE_LIMITS.expensive.maxRequests,
                RATE_LIMITS.expensive.windowMs
            )
            if (!allowed) {
                return NextResponse.json({ error: 'Too many transcription requests. Please wait a moment.' }, { status: 429 })
            }
        }
        // Suppress unused-var warning when called as internal (userId may be used
        // later for per-user audit logs).
        void authedUserId

        const body = await request.json()
        const { audioUrl, useConvexStorage, videoStorageId, audioStorageId, videoUrl } = body
        submissionId = body.submissionId

        // Resolve a submitted field (url or storage id) into a fetchable URL.
        // Handles full https URLs, R2 relative paths (audio/..., videos/..., images/...),
        // and the `convex:` prefix. Returns null for Convex storage IDs we can't resolve here.
        const r2Prefix = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
        const resolveToUrl = (val?: string | null): string | null => {
            if (!val) return null
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
        if (!mediaUrl && submissionId) {
            try {
                const fresh: any = await convex.query(api.submissions.getById, {
                    id: submissionId as Id<"submissions">,
                })
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
        if (submissionId) {
            try {
                await convex.mutation(api.submissions.update, {
                    id: submissionId as Id<"submissions">,
                    transcriptionStatus: 'processing',
                })
            } catch (err) {
                console.error('Error setting transcription status:', err)
            }
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
        if (submissionId) {
            try {
                await convex.mutation(api.submissions.update, {
                    id: submissionId as Id<"submissions">,
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
    } catch (error: any) {
        console.error('Transcription API error:', error)

        // Check for specific error types
        let statusCode = 500
        let errorMessage = error.message || 'Failed to transcribe audio'

        if (error.message?.includes('413') || error.message?.includes('Entity Too Large')) {
            statusCode = 413
            errorMessage = 'File is too large for transcription. Please upload a smaller file.'
        } else if (error.message?.includes('Invalid file')) {
            errorMessage = 'Invalid audio/video file format. Please use MP3, WAV, MP4, or WebM.'
        } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
            statusCode = 504
            errorMessage = 'Transcription took too long. Please try again with a shorter file.'
        }

        // Set transcription status to failed
        if (submissionId) {
            try {
                await convex.mutation(api.submissions.update, {
                    id: submissionId as Id<"submissions">,
                    transcriptionStatus: 'failed',
                })
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
