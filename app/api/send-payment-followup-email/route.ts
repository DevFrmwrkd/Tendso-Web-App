import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { sendPaymentFollowUpEmail } from '@/lib/email/service'
import { BASE_PRICE } from '@/lib/pricing'

/**
 * Send the payment follow-up email to a business owner.
 *
 * Dual-auth: admin Clerk session OR internal shared secret. This way both
 * the admin's manual "Follow up" button AND the Convex cron action can hit
 * the same endpoint.
 *
 * POST /api/send-payment-followup-email
 * Body: { submissionId: string, isManual?: boolean }
 *
 * On success the submission's `followUpEmailSentAt` is bumped to Date.now()
 * via api.submissions.markFollowUpSent so the cron doesn't double-send.
 */
export async function POST(request: NextRequest) {
    try {
        // Dual auth: internal secret OR admin Clerk session
        let authorized = false
        let triggeredBy: 'cron' | 'admin' = 'cron'

        const providedSecret = request.headers.get('x-internal-secret')
        const expectedSecret = process.env.INTERNAL_API_SECRET
        if (expectedSecret && providedSecret === expectedSecret) {
            authorized = true
            triggeredBy = 'cron'
        } else {
            const { userId } = await auth()
            if (userId) {
                const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId })
                if (creator?.role === 'admin') {
                    authorized = true
                    triggeredBy = 'admin'
                }
            }
        }
        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { submissionId, isManual: explicitIsManual } = body as {
            submissionId?: string
            isManual?: boolean
        }
        if (!submissionId) {
            return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
        }

        // Default: admin triggers = manual variant; cron = automated final-day variant
        const isManual = explicitIsManual ?? triggeredBy === 'admin'

        const submission = await fetchQuery(api.submissions.getById, {
            id: submissionId as Id<'submissions'>,
        })
        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }
        if (!submission.ownerEmail) {
            return NextResponse.json({ error: 'No owner email on submission' }, { status: 400 })
        }
        if (submission.status !== 'pending_payment') {
            return NextResponse.json(
                { error: `Submission status is "${submission.status}". Follow-up is only valid for pending_payment.` },
                { status: 400 }
            )
        }

        // Pull website URL from generatedWebsites so the email can link back
        const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
            submissionId: submissionId as Id<'submissions'>,
        }).catch(() => null)
        const websiteUrl = website?.publishedUrl || (submission as any).websiteUrl || undefined

        // Hours remaining until auto-unpublish (3 days from sentEmailAt)
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
        const deadline = (submission.sentEmailAt || submission._creationTime) + THREE_DAYS_MS
        const hoursLeft = Math.max(1, Math.round((deadline - Date.now()) / (60 * 60 * 1000)))

        const amount = (submission as any).amount || BASE_PRICE
        const referenceCode = (submission as any).paymentReference

        await sendPaymentFollowUpEmail({
            businessName: submission.businessName,
            businessOwnerName: submission.ownerName,
            businessOwnerEmail: submission.ownerEmail,
            amount,
            websiteUrl,
            referenceCode,
            hoursLeft,
            isManual,
        })

        // Record the send so the cron doesn't repeat
        try {
            await fetchMutation(api.submissions.markFollowUpSent, {
                id: submissionId as Id<'submissions'>,
            })
        } catch (markErr: any) {
            console.error('[followup] markFollowUpSent failed:', markErr?.message || markErr)
        }

        return NextResponse.json({
            success: true,
            triggeredBy,
            isManual,
            sentTo: submission.ownerEmail,
            hoursLeft,
        })
    } catch (error: any) {
        console.error('[send-payment-followup-email] error:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to send follow-up email' },
            { status: 500 }
        )
    }
}
