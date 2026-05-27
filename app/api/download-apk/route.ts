import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'

/**
 * GET /api/download-apk
 *
 * Thin backward-compat passthrough. The landing-page Navbar and Footer now
 * link DIRECTLY to `apk_download_url` (the R2 public URL) — that's the
 * canonical download path. This route exists only so any external link or
 * bookmark to `/api/download-apk` keeps working.
 *
 * The filename problem ("downloaded as 1704812345678-a8b2c1d4.apk instead
 * of negosyo-digital.apk") is now solved at the upload layer in
 * convex/r2.ts: the APK is stored at a stable key `releases/negosyo-digital.apk`,
 * so R2 derives the friendly filename from the storage key. No
 * Content-Disposition rewrites, no presigned URLs, no settings drift.
 */
export async function GET(_request: NextRequest) {
    try {
        const apkDownloadUrl = (await fetchQuery(api.settings.get, {
            key: 'apk_download_url',
        })) as string | null | undefined

        if (!apkDownloadUrl) {
            return NextResponse.json(
                { error: 'No APK release available right now.' },
                { status: 404 },
            )
        }

        return NextResponse.redirect(apkDownloadUrl, { status: 302 })
    } catch (err: any) {
        console.error('download-apk error:', err)
        return NextResponse.json(
            { error: err?.message || 'Internal server error' },
            { status: 500 },
        )
    }
}
