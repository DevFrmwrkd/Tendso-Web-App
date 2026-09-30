import { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'

import { api } from '@/convex/_generated/api'
import { resolveWebsiteHtml } from '@/lib/website-html'
import { slugFromHost, SITES_SUFFIX, siteUrlForSlug, customDomainOrigin, SITE_PATH_HEADER } from '@/lib/siteSlug'
import { holdingPageHtml, resolveHoldingTheme } from '@/lib/holding-page'
import {
    buildLocalBusinessJsonLd,
    injectSiteSeo,
    readHeadFacts,
    readMapCoords,
    serializeJsonLd,
    siteRobotsTxt,
    siteSitemapXml,
} from '@/lib/site-seo'

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

/**
 * The only paths other than `/` a customer host answers. Both are generated per
 * site from its canonical URL — there is no file to serve, and the wildcard
 * means a shared one could not be right for every host anyway.
 */
const CRAWLER_PATHS = new Set(['/robots.txt', '/sitemap.xml'])

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

    // What the visitor actually asked for. proxy.ts sets the header because the
    // rewrite replaces the pathname with this route's own; see the note there.
    // The fallback is `request.nextUrl`, which after a rewrite still holds the
    // ORIGINAL url — belt and braces, so a request that somehow arrives without
    // the header is read correctly rather than treated as the homepage.
    const headerPath = request.headers.get(SITE_PATH_HEADER)
    const nextPath = request.nextUrl.pathname
    const requestedPath = headerPath || (nextPath.startsWith('/hosted/') ? '/' : nextPath)
    if (requestedPath !== '/' && !CRAWLER_PATHS.has(requestedPath)) {
        // A path that is not the site and not one of the two crawler files. It
        // used to answer with the homepage and a 200, which made every invented
        // address an indexable duplicate of the one real page.
        return notFound('This Tendso site is a single page. Try the address without anything after the slash.')
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

    // THE ONE ADDRESS THIS SITE SHOULD BE INDEXED AT.
    //
    // Right now the same page is reachable at three hostnames — the workers.dev
    // URL publish still deploys, the .sites.tendso.com address, and a real
    // domain for the handful of owners who bought one — and without a canonical
    // Google picks one of them itself and splits the ranking signals of a page
    // that has very few to spare. A live custom domain wins, because that is the
    // address the owner paid for and the one on their signage.
    const canonicalOrigin = customDomainOrigin(site.customDomain) ?? siteUrlForSlug(slug)
    const canonicalUrl = `${canonicalOrigin}/`

    if (requestedPath === '/robots.txt') {
        return new Response(
            // An offline site is served noindex everywhere else, so its
            // robots.txt has to agree — a crawler that reads Allow here and
            // noindex on the page has been told two different things.
            site.offlineAt ? 'User-agent: *\nDisallow: /\n' : siteRobotsTxt(canonicalOrigin),
            {
                status: 200,
                headers: {
                    'content-type': 'text/plain;charset=UTF-8',
                    'cache-control': 'public, max-age=0, s-maxage=3600',
                },
            },
        )
    }

    if (requestedPath === '/sitemap.xml') {
        if (site.offlineAt) {
            return notFound('This website is offline.')
        }
        return new Response(siteSitemapXml(canonicalUrl, site.publishedAt), {
            status: 200,
            headers: {
                'content-type': 'application/xml;charset=UTF-8',
                'cache-control': 'public, max-age=0, s-maxage=3600',
            },
        })
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

    // The head the templates cannot write for themselves: the canonical URL
    // (unknowable at build time — the slug is assigned at publish, and a domain
    // later) and LocalBusiness structured data. Injected here so every site
    // already published gains both without being republished one at a time, and
    // every future template gets them for free. See lib/site-seo.ts.
    const headFacts = readHeadFacts(html)
    // The row's coordinates when it has them, else the ones the page's own map is
    // centred on. Aurora Villa needs the fallback: the build geocoded its address
    // and never wrote the result back to Convex, so the live map is in the right
    // place and the row is empty. See readMapCoords.
    const coords = site.seo?.latitude != null && site.seo?.longitude != null
        ? { latitude: site.seo.latitude, longitude: site.seo.longitude }
        : readMapCoords(html)
    const jsonLd = buildLocalBusinessJsonLd({
        canonicalUrl,
        businessName: site.businessName ?? '',
        businessType: site.businessType,
        heroStyle: (site.customizations as { heroStyle?: string } | null)?.heroStyle ?? null,
        description: headFacts.description,
        image: headFacts.image,
        telephone: site.seo?.telephone,
        address: site.seo?.address,
        city: site.seo?.city,
        region: site.seo?.region,
        postalCode: site.seo?.postalCode,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        mapUrl: site.seo?.mapUrl,
        socialUrls: site.seo?.socialUrls,
    })

    return new Response(injectSiteSeo(html, {
        canonicalUrl,
        jsonLd: jsonLd ? serializeJsonLd(jsonLd) : null,
    }), {
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
