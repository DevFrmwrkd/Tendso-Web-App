import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { deployHoldingPage, resolveHoldingTheme } from '@/lib/holding-page'
import { revalidatePath } from 'next/cache'
import { needsCloudflareWorker } from '@/lib/publish-target'

/**
 * Take a published website offline.
 * POST /api/unpublish-website
 *
 * This used to DELETE a Cloudflare Pages project. Sites are deployed as
 * Workers, so that call 404'd on every site this platform has ever published,
 * the 404 was treated as success, and the site stayed live while the admin was
 * told it had been unpublished.
 *
 * It now redeploys the same Worker with a holding page: the content genuinely
 * stops being served, and the Worker, its URL and any attached custom domain
 * survive so that publishing again restores the exact site at the same address.
 *
 * SINCE THE MOVE TO <slug>.sites.tendso.com, most sites have no Worker at all —
 * publishing stops at the row (see app/api/publish-website/route.ts). For those,
 * `markOffline` IS the takedown: app/hosted/[slug]/route.ts reads `offlineAt` and
 * serves the holding page instead of the site, so nothing has to be deployed
 * anywhere. This route only talks to Cloudflare for the custom-domain sites that
 * still have a script, where the Worker is what serves the paid domain.
 *
 * That is also what the non-payment cron already does (convex/unpublish.ts:
 * no cfPagesProjectName → markSubmissionUnpublished directly, which sets
 * offlineAt); this brings the manual admin path in line with it.
 */
export async function POST(request: NextRequest) {
    try {
        // Verify Clerk authentication
        const { userId, getToken } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = await getToken({ template: 'convex' })
        if (!token) {
            return NextResponse.json({ error: 'Unable to authenticate admin session' }, { status: 401 })
        }

        // Verify admin role using Convex
        const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId }, { token })
        if (!creator || creator.role !== 'admin' || creator.isDeleted || creator.status === 'deleted' || creator.status === 'suspended') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const body = await request.json()
        const { submissionId } = body

        if (!submissionId) {
            return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 })
        }

        const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
            submissionId: submissionId as Id<"submissions">
        }, { token })

        if (!website) {
            return NextResponse.json({ error: 'Website not found' }, { status: 404 })
        }

        if (website.status !== 'published') {
            return NextResponse.json({ error: 'Website is not published' }, { status: 400 })
        }

        const submission = await fetchQuery(api.submissions.getById, {
            id: submissionId as Id<"submissions">
        }, { token })

        // cfPagesProjectName holds the Worker script name despite the field's
        // name (see convex/domains.ts, which attaches custom domains to it).
        // ABSENT IS NORMAL NOW — see the note above.
        //
        // GATED ON THE SAME PREDICATE PUBLISH USES, not on the presence of the
        // field. The field records that a Worker was once deployed, not that one
        // exists — two have already been deleted by hand — and
        // deployHoldingPage's PUT is create-or-update, so taking one of those
        // sites offline would have RECREATED its Worker and published a holding
        // page at an address that was deliberately retired. Pointing the two
        // routes at one predicate is what keeps them from disagreeing about which
        // sites Cloudflare still serves.
        const workerName = needsCloudflareWorker(website, submission)
            ? website.cfPagesProjectName
            : undefined

        if (workerName) {
            const cfApiToken = process.env.CLOUDFLARE_API_TOKEN
            const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID

            // Refuse rather than report a takedown that cannot have happened.
            // This site has a Worker serving it — very likely on a paid domain —
            // and without credentials that Worker keeps serving the live site.
            if (!cfApiToken || !cfAccountId) {
                return NextResponse.json(
                    { error: 'Cloudflare credentials not configured — this site has a Worker (and possibly a custom domain) that would keep serving it. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.' },
                    { status: 500 }
                )
            }

            // The holding page wears the site's own palette and the character of
            // its font pairing, resolved from the same two fields the astro build
            // reads.
            const theme = resolveHoldingTheme(
                (website as { customizations?: Record<string, unknown> })?.customizations,
                submission?.businessType,
            )

            // Any failure here throws and is reported. The database is only
            // touched once Cloudflare has confirmed the holding page is live.
            await deployHoldingPage(cfApiToken, cfAccountId, workerName, submission?.businessName || '', theme)
        }

        await fetchMutation(api.generatedWebsites.markOffline, {
            submissionId: submissionId as Id<"submissions">
        }, { token })

        // The hosted route caches a live page effectively forever, so without
        // this purge a site taken offline would keep being served from the edge
        // until the TTL expired. Same reason publish revalidates; never let a
        // purge failure fail a takedown the database has already recorded.
        if (website.slug) {
            try {
                revalidatePath(`/hosted/${website.slug}`)
            } catch (purgeError: unknown) {
                console.warn('[unpublish] cache purge failed for', website.slug, purgeError)
            }
        }

        // 'unpublished', matching what the non-payment cron sets — so a site
        // taken down by hand and one pulled for non-payment land in the same
        // place in the admin queue. It used to be set to 'approved', which hid
        // manual takedowns among the in-progress submissions.
        try {
            await fetchMutation(api.submissions.setUnpublished, {
                id: submissionId as Id<"submissions">
            }, { token })
        } catch (statusError) {
            console.error('Status update error:', statusError)
        }

        return NextResponse.json({
            success: true,
            message: 'Website taken offline. Publish again to restore it at the same address.'
        })

    } catch (error) {
        console.error('Unpublish error:', error)
        const message = error instanceof Error ? error.message : ''
        return NextResponse.json(
            { error: message || 'Failed to take the website offline' },
            { status: 500 }
        )
    }
}
