import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { cleanGiftedBy, isHouseCreator } from '@/lib/houseCreator'

/**
 * Preview the email that was (or would be) sent to the client.
 * GET /api/preview-email?submissionId=xxx&type=approval|payment_confirmation|promo_free
 */
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify admin role
        const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId })
        if (!creator || creator.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const submissionId = searchParams.get('submissionId')
        const type = searchParams.get('type') || 'payment_confirmation'

        if (!submissionId) {
            return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 })
        }

        const submission = await fetchQuery(api.submissions.getById, {
            id: submissionId as Id<"submissions">
        })

        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        // Get published URL
        let publishedUrl = ''
        try {
            const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
                submissionId: submissionId as Id<"submissions">
            })
            publishedUrl = website?.publishedUrl || ''
        } catch {
            // Website URL is optional
        }

        // Dynamically import the template functions to avoid bundling nodemailer on client
        const {
            getPaymentLinkEmailHtml,
            getPaymentConfirmationEmailHtml,
            getDomainLiveEmailHtml,
            getDomainSetupInProgressEmailHtml,
            getDomainRenewalReminderEmailHtml,
            getPromoWebsiteLiveEmailHtml,
        } = await import('@/lib/email/templates')

        let html: string

        if (type === 'approval') {
            // Render the SAME template that send-website-email actually sends (payment-link
            // email). Fetch the existing payment token if any so the preview mirrors the
            // real email; otherwise show placeholder values.
            const submissionAny = submission as any
            const customDomain = submissionAny.requestedDomain as string | undefined

            let referenceCode = submission.paymentReference || 'ND-XXXX-XXXX'
            try {
                const token = await fetchQuery(api.paymentTokens.getBySubmissionId, {
                    submissionId: submissionId as Id<'submissions'>,
                })
                if (token) {
                    referenceCode = token.referenceCode
                }
            } catch {
                // Preview-only — placeholder is fine if token lookup fails
            }

            html = getPaymentLinkEmailHtml({
                businessName: submission.businessName,
                businessOwnerName: submission.ownerName,
                amount: submission.amount ?? 0,
                websiteUrl: publishedUrl || undefined,
                referenceCode,
                platformEmail: process.env.WISE_EMAIL,
                customDomain,
                domainCostPHP: (submission as any).domainCostPHP || undefined,
            })
        } else if (type === 'promo_free') {
            // The gift notice sent by /api/mark-comped. Resolve the creator the
            // same way that route does, so the preview shows the real name the
            // owner would read rather than the generic fallback.
            let creatorName = ''
            try {
                const withCreator = await fetchQuery(api.submissions.getByIdWithCreator, {
                    id: submissionId as Id<'submissions'>,
                })
                // A self-serve site's creator is the house account, not a person:
                // the real email names whoever the admin types at "Give free", so
                // the preview takes ?giftedBy= and otherwise shows the unnamed variant.
                creatorName = isHouseCreator(withCreator?.creator)
                    ? cleanGiftedBy(searchParams.get('giftedBy'))
                    : [withCreator?.creator?.firstName, withCreator?.creator?.lastName]
                        .filter(Boolean)
                        .join(' ')
                        .trim()
            } catch {
                // Preview-only — the unnamed variant is a legitimate render.
            }
            html = getPromoWebsiteLiveEmailHtml({
                businessName: submission.businessName,
                businessOwnerName: submission.ownerName,
                websiteUrl: publishedUrl || '#',
                creatorName: creatorName || undefined,
                platformEmail: process.env.WISE_EMAIL,
            })
        } else if (type === 'domain_setup_progress') {
            const submissionAny = submission as any
            const customDomain = (submissionAny.requestedDomain as string | undefined) || 'your-domain.com'
            html = getDomainSetupInProgressEmailHtml({
                businessName: submission.businessName,
                businessOwnerName: submission.ownerName,
                customDomain,
            })
        } else if (type === 'domain_renewal_reminder') {
            const submissionAny = submission as any
            const customDomain = (submissionAny.requestedDomain as string | undefined) || 'your-domain.com'
            html = getDomainRenewalReminderEmailHtml({
                businessName: submission.businessName,
                businessOwnerName: submission.ownerName,
                customDomain,
                expiresAt: submissionAny.domainExpiresAt || Date.now() + 365 * 24 * 60 * 60 * 1000,
            })
        } else if (type === 'completed_website') {
            // Branches on requestedDomain — same logic as send-completed-website-email
            const submissionAny = submission as any
            const customDomain = submissionAny.requestedDomain as string | undefined
            if (customDomain) {
                html = getDomainLiveEmailHtml({
                    businessName: submission.businessName,
                    businessOwnerName: submission.ownerName,
                    customDomain,
                    expiresAt: submissionAny.domainExpiresAt || Date.now() + 365 * 24 * 60 * 60 * 1000,
                })
            } else {
                html = getPaymentConfirmationEmailHtml({
                    businessName: submission.businessName,
                    businessOwnerName: submission.ownerName,
                    websiteUrl: publishedUrl || '#',
                    amount: submission.amount ?? 0,
                })
            }
        } else {
            html = getPaymentConfirmationEmailHtml({
                businessName: submission.businessName,
                businessOwnerName: submission.ownerName,
                websiteUrl: publishedUrl || '#',
                amount: submission.amount ?? 0,
            })
        }

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html' },
        })

    } catch (error: any) {
        console.error('Preview email error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate email preview' },
            { status: 500 }
        )
    }
}
