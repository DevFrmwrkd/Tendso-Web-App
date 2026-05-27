import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * GET /api/download-apk
 *
 * Stable, friendly-named download endpoint for the Negosyo Digital APK.
 *
 * The APK upload pipeline (convex/r2.ts:generateApkUploadUrl + the admin
 * App Release page) stores each release at a collision-safe R2 key like
 * `releases/1704812345678-a8b2c1d4.apk` and persists FOUR Convex settings:
 *
 *   apk_r2_key       — R2 storage key, used to mint presigned URLs
 *   apk_download_url — public R2 URL, used as a fallback
 *   apk_file_name    — original filename
 *   apk_uploaded_at  — upload timestamp
 *
 * The Navbar/Footer link decision is based on `apk_download_url`. This route
 * MUST be at least as available as that decision — otherwise a setting drift
 * (where apk_download_url is present but apk_r2_key isn't, e.g. legacy
 * uploads or a manual edit in the Convex dashboard) makes the download
 * appear available in the UI but 404 on click.
 *
 * Resolution strategy (most-friendly first, last-resort last):
 *   1. apk_r2_key present                    → presigned URL + friendly name
 *   2. apk_download_url + R2_PUBLIC_URL set  → derive key from URL → same
 *   3. apk_download_url present              → 302 to public URL (cryptic name, but works)
 *   4. neither present                       → real 404
 */
export async function GET(_request: NextRequest) {
    try {
        // Read both settings up front — cheap, single round trip.
        const [apkR2Key, apkDownloadUrl] = (await Promise.all([
            fetchQuery(api.settings.get, { key: 'apk_r2_key' }),
            fetchQuery(api.settings.get, { key: 'apk_download_url' }),
        ])) as Array<string | null | undefined>

        // Fail fast on the genuine "nothing uploaded" case.
        if (!apkR2Key && !apkDownloadUrl) {
            return NextResponse.json(
                { error: 'No APK release available right now.' },
                { status: 404 },
            )
        }

        // Strategy 2: derive the R2 key from the public URL when apk_r2_key
        // is missing. R2 public URLs are built as `${R2_PUBLIC_URL}/${key}`
        // (see convex/r2.ts:generateApkUploadUrl), so stripping the prefix
        // gives us the key back. This recovers gracefully from settings
        // drift without forcing the admin to re-upload.
        const r2PublicUrlRaw = process.env.R2_PUBLIC_URL
        const r2PublicUrl = r2PublicUrlRaw ? r2PublicUrlRaw.replace(/\/$/, '') : null
        let resolvedKey: string | null = apkR2Key ?? null
        if (!resolvedKey && apkDownloadUrl && r2PublicUrl && apkDownloadUrl.startsWith(r2PublicUrl + '/')) {
            resolvedKey = apkDownloadUrl.slice(r2PublicUrl.length + 1)
        }

        // Strategies 1 + 2: mint a presigned URL so the browser gets the
        // friendly `negosyo-digital.apk` filename via response headers.
        if (resolvedKey) {
            const r2AccountId = process.env.R2_ACCOUNT_ID
            const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
            const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY
            const r2BucketName = process.env.R2_BUCKET_NAME

            if (r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2BucketName) {
                try {
                    const client = new S3Client({
                        region: 'auto',
                        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
                        credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey },
                    })
                    const command = new GetObjectCommand({
                        Bucket: r2BucketName,
                        Key: resolvedKey,
                        ResponseContentDisposition: 'attachment; filename="negosyo-digital.apk"',
                        ResponseContentType: 'application/vnd.android.package-archive',
                    })
                    const signedUrl = await getSignedUrl(client, command, { expiresIn: 60 * 60 })
                    return NextResponse.redirect(signedUrl, { status: 302 })
                } catch (signErr) {
                    // Fall through to strategy 3 — never block the download
                    // because the signing step itself failed.
                    console.error('download-apk: presign failed, falling back to public URL', signErr)
                }
            } else {
                console.warn('download-apk: R2 env vars missing, falling back to public URL')
            }
        }

        // Strategy 3: last-resort direct redirect to the public R2 URL. The
        // user gets the cryptic R2 key as the filename but at least the
        // download succeeds — strictly better than a 404.
        if (apkDownloadUrl) {
            return NextResponse.redirect(apkDownloadUrl, { status: 302 })
        }

        // Should be unreachable given the early return above, but kept for
        // exhaustiveness.
        return NextResponse.json(
            { error: 'No APK release available right now.' },
            { status: 404 },
        )
    } catch (err: any) {
        console.error('download-apk error:', err)
        return NextResponse.json(
            { error: err?.message || 'Internal server error' },
            { status: 500 },
        )
    }
}
