import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

// Payment-lifecycle statuses a republish must never regress. /api/publish-website
// is written for the FIRST publish, so it force-sets the submission to 'deployed';
// on an already-live site that would drop a creator-funnel submission out of
// pending_payment (losing "Mark as paid", the follow-up email and the reminders).
// Mirrors the same guard generate-website applies on regenerate (keepStatuses).
const PAYMENT_LIFECYCLE_STATUSES = ['pending_payment', 'paid', 'completed']

export async function POST(request: NextRequest) {
    try {
        // Check Clerk authentication
        const { userId, getToken } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = await getToken({ template: 'convex' })
        if (!token) {
            return NextResponse.json({ error: 'Unable to authenticate admin session' }, { status: 401 })
        }

        // Check if user is admin using Convex
        const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId }, { token })
        if (!creator || creator.role !== 'admin' || creator.isDeleted || creator.status === 'deleted' || creator.status === 'suspended') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const { submissionId, content, customizations } = await request.json()

        if (!submissionId || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Get existing website to get current template and other data
        const existingWebsite = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
            submissionId: submissionId
        }, { token })

        if (!existingWebsite) {
            return NextResponse.json({ error: 'Website not found. Generate it first.' }, { status: 404 })
        }

        // Update the website's extracted content in Convex
        await fetchMutation(api.generatedWebsites.upsert, {
            submissionId: submissionId,
            templateName: existingWebsite.templateName || 'default',
            extractedContent: content,
            customizations: customizations || existingWebsite.customizations,
            // Preserve whatever HTML the row currently has — inline htmlContent
            // for legacy rows, htmlStorageId for migrated rows — so a legacy site
            // is NOT left with no HTML during (or after a failed) regenerate. This
            // upsert is transient; generate-website re-saves the fresh HTML below.
            htmlContent: existingWebsite.htmlContent,
            htmlStorageId: existingWebsite.htmlStorageId,
            status: existingWebsite.status,
        }, { token })

        // Regenerate the website with new content
        const regenerateResponse = await fetch(`${request.nextUrl.origin}/api/generate-website`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || ''
            },
            body: JSON.stringify({
                submissionId,
                customizations: customizations || existingWebsite.customizations
            })
        })

        if (!regenerateResponse.ok) {
            const errorData = await regenerateResponse.json()
            console.error('Regeneration failed:', errorData)
            return NextResponse.json({ error: 'Content saved but regeneration failed', details: errorData }, { status: 500 })
        }

        const regenerateData = await regenerateResponse.json()

        // ── Auto-republish ────────────────────────────────────────────────
        // The regenerate above resets generatedWebsites.status to 'draft'
        // (generate-website/route.ts) while publishedUrl stays put — i.e. the
        // live Cloudflare Worker keeps serving the OLD HTML until someone
        // clicks Republish. That manual click is how an admin edit silently
        // fails to reach the customer's site, so do it here: one Save, one
        // live site. Same auth pattern as the regenerate call above (forward
        // the admin's cookie to a route that re-checks the admin role).
        //
        // ONLY for a site that is ALREADY live. Publishing a site that was
        // never published is a deliberate, much more consequential action and
        // is never done implicitly.
        //
        // Failure here is non-fatal to the save (the content and the rebuilt
        // HTML are already stored) but it is NEVER silent: the response says
        // republished:false so the editor can tell the admin the live site is
        // still behind, and generatedWebsites.status stays 'draft' so the
        // stale-publish badge stays lit.
        const wasPublished = !!existingWebsite.publishedUrl
        let republished = false
        let republishError: string | undefined

        if (wasPublished) {
            // Snapshot what a republish must NOT change (see restore below).
            const submissionBefore = await fetchQuery(api.submissions.getById, {
                id: submissionId as Id<'submissions'>
            }, { token }).catch(() => null)

            let republishedUrl: string | undefined
            try {
                const republishResponse = await fetch(`${request.nextUrl.origin}/api/publish-website`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': request.headers.get('cookie') || ''
                    },
                    body: JSON.stringify({ submissionId })
                })
                const republishData = await republishResponse.json().catch(() => ({} as any))
                if (republishResponse.ok) {
                    republished = true
                    republishedUrl = republishData?.url
                } else {
                    republishError = republishData?.error || `Republish failed (HTTP ${republishResponse.status})`
                }
            } catch (err: any) {
                republishError = err?.message || 'Republish request failed'
            }

            if (!republished) {
                console.error('Auto-republish failed — live site is stale:', republishError)
            }

            if (republished) {
                // publish-website recomputes the workers.dev URL and force-sets
                // the submission to 'deployed' — correct on a first publish,
                // wrong on a republish. Put back the two things it moved:
                //
                // 1. publishedUrl. A ₱1,499 custom-domain site stores
                //    https://{customDomain} here (domains.setCustomDomainOnWebsite);
                //    the Worker itself is the same one the domain is attached
                //    to (service: cfPagesProjectName), so the deploy DOES
                //    refresh both addresses — only the stored URL needs
                //    putting back so the UI and emails keep the real domain.
                // 2. The submission's payment status and websiteUrl.
                if (republishedUrl && existingWebsite.publishedUrl && republishedUrl !== existingWebsite.publishedUrl) {
                    try {
                        await fetchMutation(api.generatedWebsites.updatePublishingInfo, {
                            submissionId: submissionId as Id<'submissions'>,
                            publishedUrl: existingWebsite.publishedUrl,
                        }, { token })
                    } catch (err: any) {
                        console.error('Could not restore publishedUrl after auto-republish:', err?.message || err)
                    }
                }

                if (submissionBefore) {
                    if (PAYMENT_LIFECYCLE_STATUSES.includes(submissionBefore.status)) {
                        try {
                            await fetchMutation(api.submissions.updateStatus, {
                                id: submissionId as Id<'submissions'>,
                                status: submissionBefore.status as any,
                            }, { token })
                        } catch (err: any) {
                            console.error('Could not restore submission status after auto-republish:', err?.message || err)
                        }
                    }
                    if (submissionBefore.websiteUrl && republishedUrl && submissionBefore.websiteUrl !== republishedUrl) {
                        try {
                            await fetchMutation(api.submissions.update, {
                                id: submissionId as Id<'submissions'>,
                                websiteUrl: submissionBefore.websiteUrl,
                            }, { token })
                        } catch (err: any) {
                            console.error('Could not restore submission websiteUrl after auto-republish:', err?.message || err)
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: !wasPublished
                ? 'Content updated and website regenerated'
                : republished
                    ? 'Content updated, website regenerated and live site republished'
                    : 'Content updated and website regenerated, but the live site could not be republished',
            htmlContent: regenerateData.htmlContent,
            // Flags the editor renders — never report a bare "Saved" when the
            // live site is still serving the old HTML.
            wasPublished,
            republished,
            ...(republishError ? { republishError } : {}),
            // Forward the testimonial guard verbatim. An editor Save IS a
            // regenerate (we POST /api/generate-website above), so this is the
            // path most likely to strip quotes — and dropping the field here
            // would silently swallow the only notice the admin ever gets that
            // customer praise was removed from their page.
            ...(regenerateData.testimonialGuard ? { testimonialGuard: regenerateData.testimonialGuard } : {}),
        })
    } catch (error) {
        console.error('Save content error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
