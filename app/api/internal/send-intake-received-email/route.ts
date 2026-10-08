import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { sendIntakeReceivedEmail } from '@/lib/email/service'
import { BASE_PRICE } from '@/lib/pricing'

/**
 * POST /api/internal/send-intake-received-email
 *
 * Internal endpoint called by Convex action `ownerIntake.sendIntakeReceivedEmailAction`
 * immediately after a business owner submits the /start intake. Acknowledges the
 * submission and sets the 48-72h expectation — the same window /start, the thanks
 * page and the landing copy promise — so the owner's first contact from us is not
 * the payment email.
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
        })
        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        // ownerEmail is required by submitOwnerIntake, so this only trips if the
        // endpoint is pointed at a creator-funnel row, where it is still optional.
        if (!submission.ownerEmail) {
            return NextResponse.json({ error: 'No owner email on submission' }, { status: 400 })
        }

        await sendIntakeReceivedEmail({
            businessName: submission.businessName,
            businessOwnerName: submission.ownerName,
            businessOwnerEmail: submission.ownerEmail,
            // The stored amount is authoritative, including zero for giveaway
            // applications. The fallback only covers older rows.
            amount: submission.amount ?? BASE_PRICE,
            platformEmail: process.env.WISE_EMAIL,
            giveawayApplication: submission.giveawayApplication === true,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('send-intake-received-email error:', error)
        return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 })
    }
}
