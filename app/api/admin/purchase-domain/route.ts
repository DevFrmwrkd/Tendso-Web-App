import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery, fetchAction } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { checkRateLimit, RATE_LIMITS, validateString, validateId } from '@/lib/security'

/**
 * POST /api/admin/purchase-domain
 * Body: { submissionId: string, domain: string }
 *
 * Admin-only endpoint to manually trigger custom domain purchase for a submission.
 * Runs the full pipeline: register with Porkbun → Cloudflare zone → Pages attachment → SSL.
 */
export async function POST(request: NextRequest) {
    try {
        const { userId, getToken } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = await getToken({ template: 'convex' })
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId }, { token })
        if (!creator || creator.role !== 'admin' || creator.isDeleted || creator.status === 'deleted' || creator.status === 'suspended') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        // Rate limit: destructive (low — domain purchase is expensive and irreversible)
        const { allowed } = checkRateLimit(
            `domain-purchase:${userId}`,
            RATE_LIMITS.destructive.maxRequests,
            RATE_LIMITS.destructive.windowMs
        )
        if (!allowed) {
            return NextResponse.json({ error: 'Too many purchase requests. Please wait.' }, { status: 429 })
        }

        const body = await request.json()
        const submissionId = validateId(body.submissionId, 'submissionId')
        const domain = validateString(body.domain, 'domain', { maxLength: 253 })

        const result = await fetchAction(api.domains.purchaseDomainForSubmission, {
            submissionId: submissionId as Id<'submissions'>,
            domain,
            adminClerkId: userId,
        }, { token })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Purchase domain error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to purchase domain' },
            { status: 500 }
        )
    }
}
