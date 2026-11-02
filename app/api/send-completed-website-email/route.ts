import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import {
    sendDomainLiveEmail,
    sendPaymentConfirmationEmail,
    sendDomainSetupInProgressEmail,
    sendDomainRenewalReminderEmail,
} from '@/lib/email/service'

/**
 * Send the "your website is complete" email to the business owner.
 *
 * Branches on whether the submission has a custom domain:
 *   - With requestedDomain → sends the domain-live email (with renewal disclaimer)
 *   - Without              → sends the payment-confirmation email (workers.dev URL)
 *
 * Auth: either an authenticated admin (Clerk) OR the internal shared secret
 * (X-Internal-Secret header). This lets both the admin UI button and the
 * Convex pipeline use the same endpoint.
 *
 * POST /api/send-completed-website-email
 * Body: { submissionId: string }
 */
export async function POST(request: NextRequest) {
    try {
        // Auth: admin Clerk session OR internal secret
        let authorized = false
        let token: string | undefined
        let internalSecret: string | undefined
        const providedSecret = request.headers.get('x-internal-secret')
        const expectedSecret = process.env.INTERNAL_API_SECRET
        if (expectedSecret && providedSecret === expectedSecret) {
            authorized = true
            internalSecret = expectedSecret
        } else {
            const { userId, getToken } = await auth()
            if (userId) {
                token = await getToken({ template: 'convex' }) ?? undefined
                if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
                const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId }, { token })
                if (creator?.role === 'admin' && !creator.isDeleted && creator.status !== 'deleted' && creator.status !== 'suspended') {
                    authorized = true
                }
            }
        }
        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { submissionId, type } = body as { submissionId?: string; type?: string }
        if (!submissionId) {
            return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
        }

        const submission = await fetchQuery(api.submissions.getById, {
            id: submissionId as Id<'submissions'>,
            ...(internalSecret ? { internalSecret } : {}),
        }, { token })
        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }
        if (!submission.ownerEmail) {
            return NextResponse.json({ error: 'No owner email on submission' }, { status: 400 })
        }

        const submissionAny = submission as any
        const customDomain = submissionAny.requestedDomain as string | undefined

        // Explicit type → setup-in-progress email
        if (type === 'domain_setup_progress') {
            if (!customDomain) {
                return NextResponse.json({ error: 'No custom domain on submission' }, { status: 400 })
            }
            await sendDomainSetupInProgressEmail({
                businessName: submission.businessName,
                businessOwnerName: submission.ownerName,
                businessOwnerEmail: submission.ownerEmail,
                customDomain,
            })
            return NextResponse.json({ success: true, type: 'domain_setup_progress', sentTo: submission.ownerEmail })
        }

        // Explicit type → 30-day renewal reminder
        if (type === 'domain_renewal_reminder') {
            if (!customDomain) {
                return NextResponse.json({ error: 'No custom domain on submission' }, { status: 400 })
            }
            await sendDomainRenewalReminderEmail({
                businessName: submission.businessName,
                businessOwnerName: submission.ownerName,
                businessOwnerEmail: submission.ownerEmail,
                customDomain,
                expiresAt: submissionAny.domainExpiresAt || Date.now() + 365 * 24 * 60 * 60 * 1000,
            })
            return NextResponse.json({ success: true, type: 'domain_renewal_reminder', sentTo: submission.ownerEmail })
        }

        // Default behavior: completed website email (branches on requestedDomain)
        if (customDomain) {
            await sendDomainLiveEmail({
                businessName: submission.businessName,
                businessOwnerName: submission.ownerName,
                businessOwnerEmail: submission.ownerEmail,
                customDomain,
                expiresAt: submissionAny.domainExpiresAt || Date.now() + 365 * 24 * 60 * 60 * 1000,
            })
            return NextResponse.json({ success: true, type: 'domain_live', sentTo: submission.ownerEmail })
        }

        // No custom domain — fall back to the payment-confirmation template with workers.dev URL
        const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
            submissionId: submissionId as Id<'submissions'>,
            ...(internalSecret ? { internalSecret } : {}),
        }, { token })
        const websiteUrl = website?.publishedUrl || ''
        if (!websiteUrl) {
            return NextResponse.json({ error: 'No published website URL found' }, { status: 400 })
        }

        await sendPaymentConfirmationEmail({
            businessName: submission.businessName,
            businessOwnerName: submission.ownerName,
            businessOwnerEmail: submission.ownerEmail,
            websiteUrl,
            amount: submission.amount ?? 0,
        })

        return NextResponse.json({ success: true, type: 'payment_confirmation', sentTo: submission.ownerEmail })
    } catch (error: any) {
        console.error('send-completed-website-email error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to send completed website email' },
            { status: 500 }
        )
    }
}
