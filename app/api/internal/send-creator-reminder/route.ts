import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { sendCreatorReminderEmail } from '@/lib/email/service'

/**
 * POST /api/internal/send-creator-reminder
 *
 * Internal endpoint called by the Convex action `creatorReminders.sendReminder`
 * once it has checked the creator owns the site, the site is waiting on a
 * payment and the reminder limit allows one. It only sends: the action
 * records the reminder, and takes it back if this fails.
 *
 * Auth: shared secret in X-Internal-Secret header (matches INTERNAL_API_SECRET env var)
 * Body: { submissionId: string, creatorName: string, referenceCode?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const providedSecret = request.headers.get('x-internal-secret')
        const expectedSecret = process.env.INTERNAL_API_SECRET
        if (!expectedSecret || providedSecret !== expectedSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { submissionId, creatorName, referenceCode } = (await request.json()) as { submissionId?: string; creatorName?: string; referenceCode?: string }
        if (!submissionId || !creatorName) {
            return NextResponse.json({ error: 'submissionId and creatorName required' }, { status: 400 })
        }

        const id = submissionId as Id<'submissions'>
        const submission = await fetchQuery(api.submissions.getById, { id })
        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }
        if (!submission.ownerEmail) {
            return NextResponse.json({ error: 'Business owner email not found' }, { status: 400 })
        }

        const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, { submissionId: id }).catch(() => null)

        await sendCreatorReminderEmail({
            creatorName,
            businessName: submission.businessName,
            businessOwnerName: submission.ownerName,
            businessOwnerEmail: submission.ownerEmail,
            amount: submission.amount ?? 0,
            websiteUrl: website?.publishedUrl || submission.websiteUrl || undefined,
            referenceCode: referenceCode ?? submission.paymentReference,
            customDomain: submission.requestedDomain || undefined,
            domainCostPHP: submission.domainCostPHP || undefined,
            domainChargedPHP: submission.domainChargedPHP,
            websiteListPrice: submission.websiteListPrice,
        })

        return NextResponse.json({ success: true, sentTo: submission.ownerEmail })
    } catch (error) {
        console.error('send-creator-reminder error:', error)
        const message = error instanceof Error ? error.message : 'Failed to send email'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
