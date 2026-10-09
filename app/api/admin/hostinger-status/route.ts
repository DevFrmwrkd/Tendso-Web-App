import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery, fetchAction } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security'

/**
 * GET /api/admin/hostinger-status
 *
 * Admin-only endpoint that returns the saved Hostinger payment method status.
 * Used by the admin domain page widget to confirm the Visa card is connected.
 */
export async function GET(request: NextRequest) {
    try {
        const { userId, getToken } = await auth()
        if (!userId) {
            return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 })
        }
        const token = await getToken({ template: 'convex' })
        if (!token) return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 })

        const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId }, { token })
        if (!creator || creator.role !== 'admin' || creator.isDeleted || creator.status === 'deleted' || creator.status === 'suspended') {
            return NextResponse.json({ connected: false, error: 'Admin access required' }, { status: 403 })
        }

        // Rate limit: standard
        const { allowed } = checkRateLimit(
            `hostinger-status:${userId}`,
            RATE_LIMITS.standard.maxRequests,
            RATE_LIMITS.standard.windowMs
        )
        if (!allowed) {
            return NextResponse.json({ connected: false, error: 'Too many requests' }, { status: 429 })
        }

        const status = await fetchAction(api.domains.getHostingerPaymentMethodStatus, {}, { token })
        return NextResponse.json(status)
    } catch (error: any) {
        console.error('Hostinger status error:', error)
        return NextResponse.json(
            { connected: false, error: error.message || 'Failed to fetch payment method status' },
            { status: 500 }
        )
    }
}
