import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { fetchAction } from 'convex/nextjs';
import { ConvexError } from 'convex/values';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';

// Deployment setup: LANDING_LEADS_SECRET must match in Next.js and Convex.
// Next.js also needs NEXT_PUBLIC_TURNSTILE_SITE_KEY; Convex needs
// TURNSTILE_SECRET_KEY and TURNSTILE_HOSTNAME (exact widget hostname).
const OWNER_REQUEST_URL = '/my-business/visits/new';

function trustedCallerIp(request: NextRequest) {
    // Keep public caller-rate limiting bound to a platform-overwritten IP.
    const ip = process.env.VERCEL === '1' ? request.headers.get('x-forwarded-for')?.trim() : undefined;
    return ip && isIP(ip) ? ip : null;
}

function ownerRequestFallback() {
    return NextResponse.json({
        message: 'Request a shop visit through your owner account.', requestUrl: OWNER_REQUEST_URL,
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

/** Capability only: never expose the secret, IP or challenge configuration. */
export async function GET(request: NextRequest) {
    const publicFormAvailable = !!process.env.LANDING_LEADS_SECRET
        && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !!trustedCallerIp(request);
    return NextResponse.json({ publicFormAvailable }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
    const secret = process.env.LANDING_LEADS_SECRET;
    const ip = trustedCallerIp(request);
    if (!secret || !ip) return ownerRequestFallback();
    try {
        const { shopName, area, mobile, token } = await request.json();
        if ([shopName, area, mobile, token].some((value) => typeof value !== 'string')) {
            return NextResponse.json({ message: 'Check your details and complete the bot check.' }, { status: 400 });
        }
        const result = await fetchAction(api.landingLeads.requestVisit, {
            shopName, area, mobile, token, secret,
            caller: createHmac('sha256', secret).update(ip).digest('hex'),
        });
        return NextResponse.json(result);
    } catch (error) {
        const data = error instanceof ConvexError ? error.data : null;
        // A missing/mismatched deployment secret or challenge configuration is
        // a short-form setup issue; the authenticated visit flow remains usable.
        if (data === 'Unauthorized' || data === 'Visit requests are temporarily unavailable.') return ownerRequestFallback();
        return NextResponse.json(typeof data === 'object' && data ? data : {
            message: typeof data === 'string' ? data : 'That did not go through. Please try again.',
        }, { status: 400 });
    }
}
