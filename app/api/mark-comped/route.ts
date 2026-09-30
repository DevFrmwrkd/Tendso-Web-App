import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { sendPromoWebsiteLiveEmail } from '@/lib/email/service'
import { cleanGiftedBy, isHouseCreator } from '@/lib/houseCreator'

/**
 * PROMO — give the website away, pay the creator anyway.
 * POST /api/mark-comped
 *
 * The sibling of /api/mark-paid, and deliberately a separate route rather than
 * a `comped: true` flag on that one. The two differ in what they tell the
 * business owner — a receipt versus a gift notice — and a boolean deep in a
 * shared handler is one careless edit away from mailing the wrong one.
 */
export async function POST(request: NextRequest) {
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

        const body = await request.json()
        const { submissionId, reason } = body
        const giftedBy = cleanGiftedBy(body.giftedBy)

        if (!submissionId) {
            return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 })
        }

        // Read with the creator joined — the promo email names the person who
        // gave the site away, and this is the query that already resolves them.
        const submission = await fetchQuery(api.submissions.getByIdWithCreator, {
            id: submissionId as Id<'submissions'>,
        })

        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        // A self-serve site is attributed to the house creator, which is not a
        // person — the email would read "Tendso Self-Serve chose <business>…".
        // There the admin names the giver instead, and it is REQUIRED: checked
        // here, before anything is credited, so a missing name costs nothing.
        const selfServe = isHouseCreator(submission.creator)
        if (selfServe && !giftedBy) {
            return NextResponse.json(
                { error: 'This is a self-serve site, so there is no creator to name. Enter the name the owner should see as the giver.' },
                { status: 400 },
            )
        }

        // The typed giver is also kept in the internal reason, so the record says
        // which name the owner was told.
        const reasonText = typeof reason === 'string' ? reason.trim() : ''
        const storedReason = selfServe
            ? `${reasonText ? `${reasonText} · ` : ''}gifted as "${giftedBy}"`
            : reasonText

        // Credit the creator and stamp the row as comped. Every refusal that
        // matters (already settled, custom-domain tier, no website yet) lives in
        // the mutation, so it applies to any caller and not just this route.
        await fetchMutation(api.admin.markComped, {
            submissionId: submissionId as Id<'submissions'>,
            adminId: userId,
            reason: storedReason || undefined,
        })

        // Tell the owner their site is live and free. NOT the payment
        // confirmation email — see sendPromoWebsiteLiveEmail.
        let emailSent = false
        if (submission.ownerEmail) {
            let publishedUrl = ''
            try {
                const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
                    submissionId: submissionId as Id<'submissions'>,
                })
                publishedUrl = website?.publishedUrl || ''
            } catch {
                // Non-fatal: the credit is already booked and the owner can be
                // mailed by hand. Never fail the comp over a missing URL.
            }

            // Only mail a link that actually resolves. The payment-confirmation
            // route falls back to the string 'Your website is live!' here, which
            // renders as a dead href — fine-ish on a receipt the owner expected,
            // wrong on an unsolicited "here is your free website" email, where a
            // broken link is the difference between a gift and a phishing smell.
            // Self-serve: the name the admin typed. Otherwise the real creator.
            const creatorName = selfServe
                ? giftedBy
                : [submission.creator?.firstName, submission.creator?.lastName]
                    .filter(Boolean)
                    .join(' ')
                    .trim()

            if (publishedUrl) {
                try {
                    await sendPromoWebsiteLiveEmail({
                        businessName: submission.businessName,
                        businessOwnerName: submission.ownerName,
                        businessOwnerEmail: submission.ownerEmail,
                        websiteUrl: publishedUrl,
                        creatorName: creatorName || undefined,
                    })
                    emailSent = true
                } catch (emailError: any) {
                    console.error('Failed to send promo website live email:', emailError)
                    // Don't fail the whole operation — the creator is already credited.
                }
            }
        }

        return NextResponse.json({
            success: true,
            emailSent,
            message: emailSent
                ? `Website given free. Creator credited, and ${submission.ownerEmail} was told it is live at no charge${selfServe ? `, from "${giftedBy}"` : ''}.`
                : 'Website given free and creator credited. No email went out — publish the site and/or add an owner email, then notify them manually.',
        })
    } catch (error: any) {
        console.error('Mark comped error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to give this website away' },
            { status: 500 }
        )
    }
}
