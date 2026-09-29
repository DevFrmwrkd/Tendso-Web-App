import { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'

import { api } from '@/convex/_generated/api'
import { resolveWebsiteHtml } from '@/lib/website-html'
import { slugFromHost, SITES_SUFFIX } from '@/lib/siteSlug'
import { holdingPageHtml, resolveHoldingTheme } from '@/lib/holding-page'

/**
 * Serves a customer's website at <slug>.sites.tendso.com.
 *
 * THIS REPLACES A WORKER PER BUSINESS. Publishing used to embed the built HTML
 * inside a generated JavaScript file and PUT it to Cloudflare as its own Worker
 * script. That worked, but Cloudflare caps scripts per account (100 on the free
 * plan, shared with other projects), so it could never reach the thousands of
 * businesses the product is aimed at. One route serves any number of them.
 *
 * It is a Route Handler, not a page, deliberately: the stored HTML is a
 * complete document with its own <html> and <head>, so rendering it through a
 * React layout would nest it inside ours. This returns the bytes.
 *
 * REACHABLE ONLY THROUGH THE HOSTNAME. proxy.ts rewrites the wildcard host onto
 * this path, but a rewrite preserves the original Host header, so the handler
 * re-derives the slug from it and refuses anything else. Without that check,
 * www.tendso.com/hosted/<slug> would serve every customer's site off the main
 * domain as well — duplicate content on the domain we least want it on.
 */

// The HTML is fetched per request and cached by the response headers below;
// there is no build-time knowledge of which slugs exist.
export const dynamic = 'force-dynamic'

/** Sent on anything that is not a live customer site. */
const NO_INDEX = 'noindex, nofollow'

function notFound(message: string) {
    return new Response(
        `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
        `<meta name="robots" content="${NO_INDEX}">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<title>Site not found</title></head>` +
        `<body style="margin:0;font-family:system-ui,sans-serif;background:#f7f4ed;color:#1f1d1a">` +
        `<main style="max-width:32rem;margin:0 auto;padding:12vh 1.5rem">` +
        `<h1 style="font-size:1.5rem;margin:0 0 .75rem">Site not found</h1>` +
        `<p style="color:#4a453d;line-height:1.6">${message}</p>` +
        `</main></body></html>`,
        {
            status: 404,
            headers: {
                'content-type': 'text/html;charset=UTF-8',
                'x-robots-tag': NO_INDEX,
                // Never cache a miss for long: the usual reason for one is a
                // site that is about to be published.
                'cache-control': 'public, max-age=0, s-maxage=60',
            },
        },
    )
}

export async function GET(request: NextRequest) {
    // The Host is the source of truth, NOT the path. See the note above.
    const slug = slugFromHost(request.headers.get('host'))
    if (!slug) {
        return notFound(`This address is not a Tendso site. Customer sites live at a ${SITES_SUFFIX} address.`)
    }

    let site: Awaited<ReturnType<typeof fetchQuery<typeof api.generatedWebsites.getPublishedBySlug>>>
    try {
        site = await fetchQuery(api.generatedWebsites.getPublishedBySlug, { slug })
    } catch {
        // Convex unreachable. This is our fault, not a missing site, so do not
        // tell a visitor the business does not exist — and do not let a CDN
        // cache the lie either.
        return new Response('Temporarily unavailable', {
            status: 503,
            headers: { 'cache-control': 'no-store', 'x-robots-tag': NO_INDEX },
        })
    }

    if (!site) {
        return notFound('This website has not been published yet, or the address is misspelled.')
    }

    // ABSENT MEANS LIVE. A site taken offline keeps its row, its slug and its
    // address; it serves the holding page instead of its content, which is the
    // behaviour the Worker flow already had.
    if (site.offlineAt) {
        const theme = resolveHoldingTheme(site.customizations, site.businessType)
        return new Response(holdingPageHtml(site.businessName ?? '', theme), {
            status: 200,
            headers: {
                'content-type': 'text/html;charset=UTF-8',
                'x-robots-tag': NO_INDEX,
                'cache-control': 'public, max-age=0, s-maxage=60',
            },
        })
    }

    const html = await resolveWebsiteHtml(site)
    if (!html) {
        // Published, online, and no HTML — a broken row rather than a missing
        // site. 404 would tell the owner their site vanished; 503 says it is
        // our problem and keeps it out of the index.
        return new Response('Temporarily unavailable', {
            status: 503,
            headers: { 'cache-control': 'no-store', 'x-robots-tag': NO_INDEX },
        })
    }

    return new Response(html, {
        status: 200,
        headers: {
            'content-type': 'text/html;charset=UTF-8',
            // Cached hard at the edge and revalidated by the publish path, so a
            // visitor never pays for the Convex lookup plus the ~200 KB fetch,
            // and a publish still shows up immediately. See the publish route.
            'cache-control': 'public, max-age=0, s-maxage=31536000, stale-while-revalidate=60',
            'x-tendso-site': slug,
        },
    })
}
