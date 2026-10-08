import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchAction, fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { checkRateLimit, RATE_LIMITS, validateString } from '@/lib/security'
import { isCreatorAccount } from '@/lib/accounts'

/**
 * POST /api/check-domain
 *
 * CREATOR-FACING domain availability check (no admin role required).
 * Used by the submission review page to let creators search for available custom domains.
 *
 * Auth: any logged-in user (creator)
 * Rate-limited: standard tier (30/min) to prevent abuse
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ valid: false, error: 'Unauthorized' }, { status: 401 })
        }

        const account = await fetchQuery(api.creators.getByClerkId, { clerkId: userId })
        if (!account || (!isCreatorAccount(account) && account.role !== 'admin') || account.status === 'suspended' || account.status === 'deleted') {
            return NextResponse.json({ valid: false, error: 'Creator access required' }, { status: 403 })
        }

        const { allowed } = checkRateLimit(
            `domain-check-creator:${userId}`,
            RATE_LIMITS.standard.maxRequests,
            RATE_LIMITS.standard.windowMs
        )
        if (!allowed) {
            return NextResponse.json({ valid: false, error: 'Too many requests' }, { status: 429 })
        }

        const body = await request.json()
        const domain = validateString(body.domain, 'domain', { maxLength: 253 })
        const maxBudgetPHP = typeof body.maxBudgetPHP === 'number' ? body.maxBudgetPHP : 500

        const result = await fetchAction(api.domains.checkDomainAvailability, {
            domain,
            maxBudgetPHP,
        })
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Check domain (creator) error:', error)
        return NextResponse.json(
            { valid: false, error: error.message || 'Failed to check domain' },
            { status: 500 }
        )
    }
}
