import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { resolveWebsiteHtml } from '@/lib/website-html'
import { resolveSiteSlug, siteUrlForSlug } from '@/lib/siteSlug'
import { revalidatePath } from 'next/cache'

/**
 * Publish a generated website to Cloudflare Pages
 * Uses free .pages.dev subdomains (projectname.pages.dev)
 * POST /api/publish-website
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

        // Rate limit: expensive operation (5/min)
        const { checkRateLimit, RATE_LIMITS } = await import('@/lib/security')
        const { allowed } = checkRateLimit(`publish:${userId}`, RATE_LIMITS.expensive.maxRequests, RATE_LIMITS.expensive.windowMs)
        if (!allowed) {
            return NextResponse.json({ error: 'Too many publish requests. Please wait a moment.' }, { status: 429 })
        }

        const body = await request.json()
        const { submissionId } = body

        if (!submissionId) {
            return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 })
        }

        // Get the generated website from Convex
        const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
            submissionId: submissionId as Id<"submissions">
        })

        if (!website) {
            return NextResponse.json({ error: 'Website not found. Generate it first.' }, { status: 404 })
        }

        const htmlToDeploy = await resolveWebsiteHtml(website)
        if (!htmlToDeploy) {
            return NextResponse.json({ error: 'No HTML content to deploy' }, { status: 400 })
        }

        // Get the submission for business name
        const submission = await fetchQuery(api.submissions.getById, {
            id: submissionId as Id<"submissions">
        })

        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        // Get Cloudflare credentials
        const cfApiToken = process.env.CLOUDFLARE_API_TOKEN
        const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID

        if (!cfApiToken || !cfAccountId) {
            return NextResponse.json(
                { error: 'Cloudflare credentials not configured. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.' },
                { status: 500 }
            )
        }

        // Generate project name from business name
        const businessName = submission.businessName || 'business'
        const projectName = generateProjectName(businessName)

        // Deploy as a Cloudflare Worker (simple PUT request, no Pages Direct Upload hassles)
        const workerName = website.cfPagesProjectName || projectName
        await deployAsWorker(cfApiToken, cfAccountId, workerName, htmlToDeploy)

        // Get the workers.dev subdomain for this account
        const workerSubdomain = await getWorkersSubdomain(cfApiToken, cfAccountId)
        const publishedUrl = `https://${workerName}.${workerSubdomain}.workers.dev`

        // ── The <slug>.sites.tendso.com address ───────────────────────────
        // Assigned ONCE and never recomputed: the address is emailed to the
        // owner and printed on their signage, so re-slugging a live site would
        // break a link somebody already has. A rename of the business does not
        // move the site.
        let siteSlug = website.slug ?? null
        if (!siteSlug) {
            const taken = await fetchQuery(api.generatedWebsites.listSlugs, {})
            siteSlug = resolveSiteSlug(submission.businessName, taken, String(submissionId))
        }

        // Update generated website in Convex with published info
        try {
            await fetchMutation(api.generatedWebsites.publish, {
                submissionId: submissionId as Id<"submissions">,
                publishedUrl,
                cfPagesProjectName: workerName,
                slug: siteSlug,
            })
        } catch (updateError: any) {
            console.error('Database update error:', updateError?.message || updateError)
        }

        // Update submission status to deployed and set websiteUrl
        try {
            await fetchMutation(api.submissions.updateStatus, {
                id: submissionId as Id<"submissions">,
                status: 'deployed'
            })
        } catch (statusError: any) {
            console.error('Status update error:', statusError?.message || statusError)
        }

        try {
            await fetchMutation(api.submissions.update, {
                id: submissionId as Id<"submissions">,
                websiteUrl: publishedUrl,
            })
        } catch (urlError: any) {
            console.error('Submission websiteUrl update error:', urlError?.message || urlError)
        }

        // The hosted route caches a published page effectively forever and
        // relies on THIS to drop it, which is what makes a publish show up
        // immediately instead of after a TTL. Never let a purge failure fail a
        // publish that already succeeded — the worst case is a stale page for a
        // minute, against a site that is actually live.
        try {
            revalidatePath(`/hosted/${siteSlug}`)
        } catch (purgeError: unknown) {
            console.warn('[publish] cache purge failed for', siteSlug, purgeError)
        }

        const hostedUrl = siteUrlForSlug(siteSlug)
        return NextResponse.json({
            success: true,
            // The workers.dev URL stays the reported one until the hosted route
            // is verified in production. Both serve the same site; links already
            // sent to owners keep working either way.
            url: publishedUrl,
            hostedUrl,
            slug: siteSlug,
            projectName: workerName,
            message: `Website published successfully to ${publishedUrl}`
        })

    } catch (error: any) {
        console.error('Publish error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to publish website' },
            { status: 500 }
        )
    }
}

/**
 * Generate a URL-safe worker name from business name.
 * Workers names: lowercase, alphanumeric + hyphens, max 63 chars.
 */
function generateProjectName(businessName: string): string {
    return businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 63)
        || 'business'
}

/**
 * Get the workers.dev subdomain for this Cloudflare account.
 */
async function getWorkersSubdomain(token: string, accountId: string): Promise<string> {
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    )
    const data = await response.json() as any
    if (response.ok && data.result?.subdomain) {
        return data.result.subdomain
    }
    // Fallback: use account ID as subdomain (shouldn't happen for active accounts)
    throw new Error('Could not determine workers.dev subdomain. Ensure Workers is enabled on your Cloudflare account.')
}

/**
 * Deploy HTML as a Cloudflare Worker.
 * Single PUT request — no multipart, no hashes, no Pages Direct Upload issues.
 * The Worker serves the HTML with proper content-type headers.
 * URL: https://{workerName}.{subdomain}.workers.dev
 */
async function deployAsWorker(
    token: string,
    accountId: string,
    workerName: string,
    htmlContent: string,
): Promise<void> {
    // Escape backticks and ${} in HTML to safely embed in template literal
    const escapedHtml = htmlContent
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${')

    // Worker script that serves the static HTML
    const workerScript = `
export default {
  async fetch(request) {
    const html = \`${escapedHtml}\`;
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
      },
    });
  },
};
`

    console.log(`[CF Worker] Deploying ${workerName}, script size: ${(workerScript.length / 1024).toFixed(0)}KB`)

    // Deploy Worker script via PUT — ESM format (module worker)
    // https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/
    const metadata = JSON.stringify({
        main_module: 'worker.js',
        compatibility_date: '2024-01-01',
    })

    const boundary = `----WorkerDeploy${Date.now()}`
    const parts: Buffer[] = []

    // Part 1: metadata
    parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="metadata"; filename="metadata.json"\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${metadata}\r\n`
    ))

    // Part 2: worker script
    parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n` +
        `Content-Type: application/javascript+module\r\n\r\n`
    ))
    parts.push(Buffer.from(workerScript, 'utf-8'))
    parts.push(Buffer.from(`\r\n`))

    // Closing boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`))

    const body = Buffer.concat(parts)

    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body,
        }
    )

    const data = await response.json() as any

    if (!response.ok) {
        const errorMsg = data?.errors?.map((e: any) => e.message).join(', ') || JSON.stringify(data)
        throw new Error(`Worker deploy failed (${response.status}): ${errorMsg}`)
    }

    // Enable the workers.dev route for this worker
    try {
        await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ enabled: true }),
            }
        )
    } catch (e) {
        console.warn('[CF Worker] Could not enable subdomain route (may already be enabled)')
    }

    console.log(`[CF Worker] Deployed ${workerName} successfully`)
}
