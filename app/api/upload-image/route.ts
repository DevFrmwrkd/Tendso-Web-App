import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

/**
 * POST /api/upload-image
 *
 * Admin-only image upload used by the sandbox editor (Images tab) and the
 * legacy VisualEditor. Persists the file to Cloudflare R2 under
 * `submission-photos/<submissionId>/<timestamp>.<ext>` and returns the
 * R2-public URL so the caller can append it to the website content payload.
 *
 * Auth: Clerk session → Convex `creators.role === 'admin'`. The previous
 * implementation used Supabase which the project no longer uses — hence the
 * spurious 401 admins were seeing.
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const creator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId })
        if (!creator || creator.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const submissionId = formData.get('submissionId') as string | null

        if (!file || !submissionId) {
            return NextResponse.json({ error: 'Missing file or submission ID' }, { status: 400 })
        }

        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
        }

        // 10MB cap — see /components/editor/SandboxEditor.tsx for the
        // matching client-side check; keep them in sync.
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
        }

        const r2AccountId = process.env.R2_ACCOUNT_ID
        const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
        const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY
        const r2BucketName = process.env.R2_BUCKET_NAME
        const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')

        if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName || !r2PublicUrl) {
            console.error('Upload image: missing R2 env vars', {
                hasAccountId: !!r2AccountId,
                hasAccessKey: !!r2AccessKeyId,
                hasSecret: !!r2SecretAccessKey,
                hasBucket: !!r2BucketName,
                hasPublicUrl: !!r2PublicUrl,
            })
            return NextResponse.json(
                { error: 'Image storage is not configured on this environment.' },
                { status: 500 },
            )
        }

        const r2 = new S3Client({
            region: 'auto',
            endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: r2AccessKeyId,
                secretAccessKey: r2SecretAccessKey,
            },
            requestHandler: { requestTimeout: 30_000 },
        })

        const timestamp = Date.now()
        const safeExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
        const key = `submission-photos/${submissionId}/${timestamp}.${safeExt || 'jpg'}`

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        await r2.send(
            new PutObjectCommand({
                Bucket: r2BucketName,
                Key: key,
                Body: buffer,
                ContentType: file.type,
                CacheControl: 'public, max-age=31536000, immutable',
            }),
        )

        const publicUrl = `${r2PublicUrl}/${key}`

        return NextResponse.json({
            success: true,
            url: publicUrl,
            key,
        })
    } catch (error: any) {
        console.error('Upload image error:', error)
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 },
        )
    }
}
