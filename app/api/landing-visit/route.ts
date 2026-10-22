import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { fetchAction } from 'convex/nextjs';
import { ConvexError } from 'convex/values';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';

// Deployment setup: LANDING_LEADS_SECRET must match in Next.js and Convex.
// Next.js also needs NEXT_PUBLIC_TURNSTILE_SITE_KEY; Convex needs
// TURNSTILE_SECRET_KEY and TURNSTILE_HOSTNAME (exact widget hostname).
export async function POST(request: NextRequest) {
    const secret = process.env.LANDING_LEADS_SECRET;
    // Trust the platform-overwritten header only on Vercel, never arbitrary proxies.
    const ip = process.env.VERCEL === '1' ? request.headers.get('x-forwarded-for')?.trim() : undefined;
    if (!secret || !ip || !isIP(ip)) {
        return NextResponse.json({ message: 'Visit requests are temporarily unavailable.' }, { status: 503 });
    }
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
        return NextResponse.json(typeof data === 'object' && data ? data : {
            message: typeof data === 'string' ? data : 'That did not go through. Please try again.',
        }, { status: 400 });
    }
}
