import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery, fetchMutation, fetchAction } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { sendPaymentLinkEmail } from '@/lib/email/service'
import { getPaymentConfig } from '@/lib/payment/config'

/**
 * Send payment link to business owner via email (replaces old approval email)
 * Generates cryptographic payment token for secure, one-time payment verification
 * POST /api/send-website-email
 */
export async function POST(request: NextRequest) {
    try {
        // Verify Clerk authentication
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify admin role using Convex
        const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId })
        if (!creator || creator.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const body = await request.json()
        const { submissionId, websiteUrl } = body

        if (!submissionId) {
            return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 })
        }

        // Get the submission from Convex
        const submission = await fetchQuery(api.submissions.getById, {
            id: submissionId as Id<"submissions">
        })

        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        if (!submission.ownerEmail) {
            return NextResponse.json({ error: 'Business owner email not found' }, { status: 400 })
        }

        // Check if payment token already exists for this submission
        const existingToken = await fetchQuery(api.paymentTokens.getBySubmissionId, {
            submissionId: submissionId as Id<"submissions">
        })

        let paymentToken = existingToken

        // If no token exists, create one
        if (!paymentToken) {
            // Use existing payment reference or generate a new one
            let referenceCode = submission.paymentReference
            if (!referenceCode) {
                // Generate a reference code locally (same logic as paymentReferences.ts)
                const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
                const chars: string[] = []
                for (let i = 0; i < 8; i++) {
                    chars.push(SAFE_ALPHABET[Math.floor(Math.random() * SAFE_ALPHABET.length)])
                }
                referenceCode = `ND-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
            }

            // Create payment token
            paymentToken = await fetchAction(api.paymentTokens.createPaymentToken, {
                submissionId: submissionId as Id<"submissions">,
                referenceCode: referenceCode,
                amount: submission.amount ?? 0,
            })
        }

        if (!paymentToken) {
            throw new Error('Failed to create payment token')
        }

        // Get published website URL
        let publishedUrl = websiteUrl
        if (!publishedUrl) {
            const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
                submissionId: submissionId as Id<"submissions">
            })
            publishedUrl = website?.publishedUrl
        }

        const paymentConfig = getPaymentConfig()
        const paymentLink = paymentConfig.getPaymentLink(paymentToken.token)

        // Mint an owner claim token → "Edit my website" link (Phase 1 owner portal).
        // Best-effort: if it fails, still send the payment email (claim is additive).
        let editMyWebsiteUrl: string | undefined
        try {
            const claim = await fetchMutation(api.businessOwners.issueClaimTokenForEmail, {
                submissionId: submissionId as Id<"submissions">,
            })
            const base = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://')
                ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
                : 'https://tendso.com'
            editMyWebsiteUrl = `${base}/my-business/claim?token=${claim.token}`
        } catch (e) {
            console.error('Failed to mint owner claim token (non-fatal):', e)
        }

        // Send payment link email (includes custom domain breakdown if applicable)
        await sendPaymentLinkEmail({
            businessName: submission.businessName,
            businessOwnerName: submission.ownerName,
            businessOwnerEmail: submission.ownerEmail,
            amount: submission.amount ?? 0,
            paymentLink,
            referenceCode: paymentToken.referenceCode,
            platformEmail: process.env.WISE_EMAIL,
            customDomain: (submission as any).requestedDomain || undefined,
            editMyWebsiteUrl,
        })

        // Record email sent timestamp
        await fetchMutation(api.paymentTokens.recordEmailSent, {
            token: paymentToken.token,
        })

        // Mark status as pending_payment and record sentEmailAt
        await fetchMutation(api.admin.markEmailSent, {
            submissionId: submissionId as Id<"submissions">,
            adminId: userId,
        })

        return NextResponse.json({
            success: true,
            message: `Payment link sent successfully to ${submission.ownerEmail}`,
            paymentLink,
            referenceCode: paymentToken.referenceCode,
        })

    } catch (error: any) {
        console.error('Send payment link error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to send payment link' },
            { status: 500 }
        )
    }
}
