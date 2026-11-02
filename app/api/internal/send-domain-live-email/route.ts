import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { sendDomainLiveEmail } from '@/lib/email/service'

/**
 * POST /api/internal/send-domain-live-email
 *
 * Internal endpoint called by Convex action `domains.sendDomainLiveEmailAction` after a custom
 * domain successfully goes live. Sends the renewal-disclaimer email to the business owner.
 *
 * Auth: shared secret in X-Internal-Secret header (matches INTERNAL_API_SECRET env var)
 */
export async function POST(request: NextRequest) {
    try {
        // Verify internal secret
        const providedSecret = request.headers.get('x-internal-secret')
        const expectedSecret = process.env.INTERNAL_API_SECRET
        if (!expectedSecret || providedSecret !== expectedSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { submissionId } = body
        if (!submissionId) {
            return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
        }

        // Fetch submission
        const submission = await fetchQuery(api.submissions.getById, {
            id: submissionId as Id<'submissions'>,
            internalSecret: expectedSecret,
        })
        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        const submissionAny = submission as any
        const customDomain = submissionAny.requestedDomain
        const expiresAt = submissionAny.domainExpiresAt

        if (!customDomain) {
            return NextResponse.json({ error: 'No custom domain on submission' }, { status: 400 })
        }
        if (!submission.ownerEmail) {
            return NextResponse.json({ error: 'No owner email on submission' }, { status: 400 })
        }

        await sendDomainLiveEmail({
            businessName: submission.businessName,
            businessOwnerName: submission.ownerName,
            businessOwnerEmail: submission.ownerEmail,
            customDomain,
            expiresAt: expiresAt || Date.now() + 365 * 24 * 60 * 60 * 1000,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('send-domain-live-email error:', error)
        return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 })
    }
}
