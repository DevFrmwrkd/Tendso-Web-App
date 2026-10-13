import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { sendGiveawayApprovedEmail } from '@/lib/email/service'

/** Convex invokes this secret bridge after OTR's approval commits. */
export async function POST(request: NextRequest) {
    try {
        const expected = process.env.INTERNAL_API_SECRET
        if (!expected || request.headers.get('x-internal-secret') !== expected) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { submissionId, reviewedAt } = await request.json()
        if (typeof submissionId !== 'string' || typeof reviewedAt !== 'number' || !Number.isFinite(reviewedAt)) {
            return NextResponse.json({ error: 'submissionId and reviewedAt required' }, { status: 400 })
        }
        const submission = await fetchQuery(api.submissions.getById, { id: submissionId as Id<'submissions'> })
        if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        // Do not deliver an old approval after another review has changed the
        // decision, or after this exact event was already mailed.
        if (!submission.giveawayApplication || submission.status === 'rejected'
            || submission.reviewedAt !== reviewedAt || submission.giveawayApprovedEmailSentAt) {
            return NextResponse.json({ success: true, sent: false })
        }
        if (!submission.ownerEmail) return NextResponse.json({ error: 'No owner email on submission' }, { status: 400 })
        await sendGiveawayApprovedEmail({
            businessName: submission.businessName,
            businessOwnerName: submission.ownerName,
            businessOwnerEmail: submission.ownerEmail,
            platformEmail: process.env.WISE_EMAIL,
            idempotencyKey: `giveaway-approved:${submissionId}:${reviewedAt}`,
        })
        return NextResponse.json({ success: true, sent: true })
    } catch (error) {
        console.error('send-giveaway-approved-email error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send email' }, { status: 500 })
    }
}
