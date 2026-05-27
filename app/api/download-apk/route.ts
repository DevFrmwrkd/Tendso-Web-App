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
 * App Release page) intentionally stores each release at a collision-safe
 * R2 key like `releases/1704812345678-a8b2c1d4.apk`. That keeps re-uploads
 * safe but makes the user-facing filename ugly when the browser downloads
 * directly from the public R2 URL.
 *
 * This route fixes only the user-facing filename. It:
 *  1. Looks up the current `apk_r2_key` from Convex settings.
 *  2. Mints a fresh presigned GET URL with
 *     `ResponseContentDisposition: attachment; filename="negosyo-digital.apk"`.
 *     R2 honors that header on the response, so the browser saves the file
 *     with the friendly name regardless of the cryptic R2 key.
 *  3. 302-redirects to it. The R2 download stream then handles the bytes
 *     directly — Next.js never proxies the 200 MB payload.
 *
 * NO changes to the upload side. NO migration of existing R2 keys.
 */
export async function GET(request: NextRequest) {
    try {
        // Resolve the current release's R2 key from Convex settings. The
        // admin App Release page persists this on every upload.
        const apkR2Key = (await fetchQuery(api.settings.get, {
            key: 'apk_r2_key',
        })) as string | null | undefined

        if (!apkR2Key) {
            return NextResponse.json(
                { error: 'No APK release available right now.' },
                { status: 404 },
            )
        }

        const r2AccountId = process.env.R2_ACCOUNT_ID
        const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
        const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY
        const r2BucketName = process.env.R2_BUCKET_NAME

        if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
            console.error('download-apk: R2 env vars are not configured')
            return NextResponse.json(
                { error: 'APK storage is not configured.' },
                { status: 500 },
            )
        }

        const client = new S3Client({
            region: 'auto',
            endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: r2AccessKeyId,
                secretAccessKey: r2SecretAccessKey,
            },
        })

        // Generate a short-lived presigned URL whose `Content-Disposition`
        // response header overrides whatever R2 would have served. The
        // browser uses this header to name the saved file.
        const command = new GetObjectCommand({
            Bucket: r2BucketName,
            Key: apkR2Key,
            ResponseContentDisposition: 'attachment; filename="negosyo-digital.apk"',
            ResponseContentType: 'application/vnd.android.package-archive',
        })
        const signedUrl = await getSignedUrl(client, command, {
            expiresIn: 60 * 60, // 1 hour — plenty for the redirect to land
        })

        return NextResponse.redirect(signedUrl, { status: 302 })
    } catch (err: any) {
        console.error('download-apk error:', err)
        return NextResponse.json(
            { error: err?.message || 'Internal server error' },
            { status: 500 },
        )
    }
}
