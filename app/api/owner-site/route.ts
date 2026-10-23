import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery } from 'convex/nextjs'
import { revalidatePath } from 'next/cache'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

/**
 * POST /api/owner-site   { submissionId, mode: 'preview' | 'publish', template? }
 *
 * Builds a shop owner's saved draft into a real page with the SAME builder the
 * admin editor's Save uses (/api/generate-website, owner mode) — the build needs
 * Node (Astro), so it cannot run inside Convex.
 *
 *   preview  the exact page the draft would become, returned and not stored
 *            (~30–60s; the editor's instant preview is an approximation).
 *   publish  build, store, and — if the site is already live — make it the live
 *            page. A site that is not live yet (an owner who has not paid) stays
 *            a private preview. Same rule as the admin Save: never published
 *            implicitly.
 *
 * Who may call it: a signed-in business owner linked to this submission.
 * Ownership is enforced in Convex (ownerSiteEdits.getDraftForBuild throws for
 * anyone else), here and again inside the build and the commit — a guessed id
 * gets nothing. The draft itself is read from Convex, never from this request.
 */
// The builder works in one shared folder when the filesystem is writable, so
// builds in this process go one at a time.
let buildChain: Promise<unknown> = Promise.resolve()

export async function POST(request: NextRequest) {
    try {
        const { userId, getToken } = await auth()
        if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
        const token = await getToken({ template: 'convex' })
        if (!token) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

        const { submissionId, mode, template } = await request.json().catch(() => ({}))
        if (!submissionId || (mode !== 'preview' && mode !== 'publish')) {
            return NextResponse.json({ error: 'Missing website or mode.' }, { status: 400 })
        }

        // Ownership gate, before anything expensive.
        let target: { live: boolean; slug: string | null }
        try {
            target = await fetchQuery(api.ownerSiteEdits.getDraftForBuild, {
                submissionId: submissionId as Id<'submissions'>,
            }, { token })
        } catch {
            return NextResponse.json({ error: 'We could not find that website.' }, { status: 404 })
        }

        const run = buildChain.then(() => fetch(`${request.nextUrl.origin}/api/generate-website`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
                submissionId,
                asOwner: true,
                preview: mode === 'preview',
                // Preview only: see the saved draft in another design. Validated
                // against the real template list by the build.
                ...(mode === 'preview' && typeof template === 'string' ? { previewTemplate: template } : {}),
            }),
        }))
        buildChain = run.catch(() => undefined)
        const build = await run
        const data: {
            error?: string
            html?: string
            htmlContent?: string
            owner?: { live: boolean; republished: boolean; pendingWorker: boolean; slug: string | null; publishedUrl: string | null }
        } = await build.json().catch(() => ({}))
        if (!build.ok) {
            console.error('Owner site build failed:', data)
            return NextResponse.json(
                { error: data?.error || 'We could not build your site. Nothing was changed.' },
                { status: build.status === 429 ? 429 : 500 },
            )
        }

        if (mode === 'preview') {
            return NextResponse.json({ success: true, html: data.html })
        }

        const owner = data.owner
        // The hosted route caches a published page until this purge (see
        // /api/publish-website). A failure only means a stale page for a minute.
        if (owner?.republished && (owner.slug ?? target.slug)) {
            try { revalidatePath(`/hosted/${owner.slug ?? target.slug}`) } catch (err) { console.warn('[owner-site] cache purge failed', err) }
        }
        return NextResponse.json({
            success: true,
            html: data.htmlContent,
            live: !!owner?.live,
            republished: !!owner?.republished,
            pendingWorker: !!owner?.pendingWorker,
            publishedUrl: owner?.publishedUrl ?? null,
        })
    } catch (error) {
        console.error('Owner site error:', error)
        return NextResponse.json({ error: 'Something went wrong. Nothing was changed.' }, { status: 500 })
    }
}
