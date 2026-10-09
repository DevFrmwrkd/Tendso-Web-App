import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { sendPaymentConfirmationEmail } from '@/lib/email/service'

/**
 * Mark a submission as paid, send confirmation email to business owner, and log audit.
 * POST /api/mark-paid
 */
export async function POST(request: NextRequest) {
    try {
        const { userId, getToken } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = await getToken({ template: 'convex' })
        if (!token) {
            return NextResponse.json({ error: 'Unable to authenticate admin session' }, { status: 401 })
        }

        // Verify admin role
        const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId }, { token })
        if (!creator || creator.role !== 'admin' || creator.isDeleted || creator.status === 'deleted' || creator.status === 'suspended') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const body = await request.json()
        const { submissionId } = body

        if (!submissionId) {
            return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 })
        }

        // Get submission
        const submission = await fetchQuery(api.submissions.getById, {
            id: submissionId as Id<"submissions">
        }, { token })

        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        // Mark as paid (updates creator balance, earnings, analytics, etc.)
        await fetchMutation(api.admin.markPaid, {
            submissionId: submissionId as Id<"submissions">,
            adminId: userId,
        }, { token })

        // Send confirmation email to business owner if email exists
        let emailSent = false
        if (submission.ownerEmail) {
            // Get published URL
            let publishedUrl = ''
            try {
                const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
                    submissionId: submissionId as Id<"submissions">
                }, { token })
                publishedUrl = website?.publishedUrl || ''
            } catch {
                // Website URL is optional for confirmation email
            }

            try {
                await sendPaymentConfirmationEmail({
                    businessName: submission.businessName,
                    businessOwnerName: submission.ownerName,
                    businessOwnerEmail: submission.ownerEmail,
                    websiteUrl: publishedUrl || 'Your website is live!',
                    amount: submission.amount ?? 0,
                })
                emailSent = true
            } catch (emailError: any) {
                console.error('Failed to send payment confirmation email:', emailError)
                // Don't fail the whole operation if email fails — payment is already marked
            }
        }

        // Log payment confirmed audit entry
        await fetchMutation(api.admin.logPaymentConfirmed, {
            submissionId: submissionId as Id<"submissions">,
            adminId: userId,
            emailSent,
        }, { token })

        return NextResponse.json({
            success: true,
            emailSent,
            message: emailSent
                ? `Payment confirmed and confirmation email sent to ${submission.ownerEmail}`
                : 'Payment confirmed. No business owner email on file — confirmation email skipped.',
        })

    } catch (error: any) {
        console.error('Mark paid error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to mark as paid' },
            { status: 500 }
        )
    }
}
