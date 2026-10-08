import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { sendGiveawayRejectedEmail } from '@/lib/email/service'

/** Convex invokes this secret bridge after the rejection and slot release commit. */
export async function POST(request: NextRequest) {
    try {
        const expected = process.env.INTERNAL_API_SECRET
        if (!expected || request.headers.get('x-internal-secret') !== expected) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { submissionId, reviewedAt, reason } = await request.json()
        if (typeof submissionId !== 'string' || typeof reviewedAt !== 'number' || !Number.isFinite(reviewedAt)
            || typeof reason !== 'string' || !reason.trim()) {
            return NextResponse.json({ error: 'submissionId, reviewedAt and reason required' }, { status: 400 })
        }
        const submission = await fetchQuery(api.submissions.getById, { id: submissionId as Id<'submissions'> })
        if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        const storedReason = submission.rejectionReason
        // Do not deliver an old rejection after another review has changed the
        // decision, or after this exact event was already mailed.
        if (!submission.giveawayApplication || submission.status !== 'rejected'
            || submission.reviewedAt !== reviewedAt || typeof storedReason !== 'string' || storedReason !== reason
            || submission.giveawayRejectedEmailSentAt) {
            return NextResponse.json({ success: true, sent: false })
        }
        if (!submission.ownerEmail) return NextResponse.json({ error: 'No owner email on submission' }, { status: 400 })
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'https://tendso.vercel.app'
        await sendGiveawayRejectedEmail({
            businessName: submission.businessName,
            businessOwnerName: submission.ownerName,
            businessOwnerEmail: submission.ownerEmail,
            reason: storedReason,
            applyUrl: `${baseUrl.replace(/\/$/, '')}/100-pages-giveaway`,
            platformEmail: process.env.WISE_EMAIL,
            idempotencyKey: `giveaway-rejected:${submissionId}:${reviewedAt}`,
        })
        return NextResponse.json({ success: true, sent: true })
    } catch (error) {
        console.error('send-giveaway-rejected-email error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send email' }, { status: 500 })
    }
}
