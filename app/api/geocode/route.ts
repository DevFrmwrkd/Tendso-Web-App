import { NextRequest, NextResponse } from 'next/server'

import { geocodeAddress } from '@/lib/geocode'
import { checkRateLimit, validateString, ValidationError } from '@/lib/security'

/**
 * GET /api/geocode?q=<address>
 *
 * Turns the address the owner typed on /start step 1 into a starting centre for
 * the desktop map picker. NOT the answer — the pin the owner drops is the
 * answer. This only decides where the map opens, so a miss is survivable: the
 * component falls back to a wide view and says so.
 *
 * WHY A ROUTE AND NOT A FETCH FROM THE BROWSER. Nominatim's AUP requires a
 * User-Agent identifying the app, and `User-Agent` is a forbidden header name
 * in the Fetch spec — a browser silently drops it. Calling Nominatim from the
 * page would therefore breach the AUP on every keystroke-free load, from every
 * one of our owners' IPs, with no way to identify or throttle us. Server-side,
 * lib/geocode.ts sends the right UA and we stay one well-behaved client.
 *
 * PUBLIC, UNLIKE EVERY OTHER ROUTE HERE. /start has no account by design (see
 * proxy.ts), so there is no userId to rate-limit on and this is listed on the
 * auth allowlist. That makes it the only open route in the app that reaches a
 * third party, so it is limited by IP and limited hard: the funnel needs about
 * one call per owner per sitting, and Nominatim's public endpoint allows 1
 * req/s across all of us. Ten a minute leaves room for someone editing their
 * address and re-centring, and no room to use us as a free geocoder.
 */

/** Deliberately below RATE_LIMITS.expensive (5/min). This is cheap for us and
 *  costly for Nominatim, which is the opposite of the usual trade-off, so the
 *  number is set by their AUP rather than our load. */
const GEOCODE_LIMIT = { maxRequests: 10, windowMs: 60_000 }

function clientIp(request: NextRequest): string {
    // Vercel sets both; the first hop in x-forwarded-for is the real client.
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]!.trim()
    return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export async function GET(request: NextRequest) {
    try {
        const { allowed } = checkRateLimit(
            `geocode:${clientIp(request)}`,
            GEOCODE_LIMIT.maxRequests,
            GEOCODE_LIMIT.windowMs
        )
        if (!allowed) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        const q = validateString(request.nextUrl.searchParams.get('q'), 'q', { maxLength: 300 })
        const result = await geocodeAddress(q)

        // A miss is a 200 with a null, not a 404. The caller is a map deciding
        // where to open, and "we could not place this address" is an ordinary
        // answer to that question, not an error worth a console entry on a
        // shop owner's screen.
        return NextResponse.json({ result: result ?? null })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
    }
}
