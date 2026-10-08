import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

function extractR2Key(url: string, r2PublicUrl: string | undefined): string | null {
    if (!r2PublicUrl || !url.startsWith(r2PublicUrl)) return null
    return url.replace(r2PublicUrl + '/', '')
}

async function deleteR2File(client: S3Client, bucketName: string, key: string): Promise<{ key: string; success: boolean; error?: string }> {
    try {
        await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
        return { key, success: true }
    } catch (error: any) {
        return { key, success: false, error: error.message }
    }
}

function collectR2UrlsFromSubmission(submission: any): string[] {
    const urls: string[] = []

    if (submission.photos && Array.isArray(submission.photos)) {
        for (const photo of submission.photos) {
            if (typeof photo === 'string' && photo.startsWith('http')) urls.push(photo)
        }
    }
    if (submission.videoUrl && submission.videoUrl.startsWith('http')) urls.push(submission.videoUrl)
    if (submission.audioUrl && submission.audioUrl.startsWith('http')) urls.push(submission.audioUrl)
    if (submission.giveawayPosterPhoto) urls.push(submission.giveawayPosterPhoto)

    return urls
}

function collectEnhancedImageUrls(enhancedImages: any): string[] {
    if (!enhancedImages || typeof enhancedImages !== 'object') return []
    const urls: string[] = []
    for (const [, img] of Object.entries(enhancedImages)) {
        const imgData = img as any
        if (imgData && typeof imgData === 'object') {
            const url = imgData.url || imgData.storageId
            if (typeof url === 'string' && url.startsWith('http')) urls.push(url)
        }
    }
    return urls
}

function collectSectionImageUrls(images: any): string[] {
    if (!images || typeof images !== 'object') return []
    const urls: string[] = []
    for (const [, sectionImages] of Object.entries(images)) {
        if (Array.isArray(sectionImages)) {
            for (const url of sectionImages) {
                if (typeof url === 'string' && url.startsWith('http')) urls.push(url)
            }
        }
    }
    return urls
}

/**
 * Cascading Creator Deletion API Route
 * Deletes a creator and ALL related data:
 * 1. All submissions with their external assets (R2, Cloudflare Pages, Airtable)
 * 2. All Convex DB records (submissions, websites, content, earnings, etc.)
 * 3. Clerk user account
 * 4. Creator record
 *
 * POST /api/delete-creator
 * Body: { creatorId: string }
 */
export async function POST(request: NextRequest) {
    try {
        // Auth
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminCreator = await fetchQuery(api.creators.getByClerkId, { clerkId: userId })
        if (!adminCreator || adminCreator.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const body = await request.json()
        const { creatorId } = body

        if (!creatorId) {
            return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 })
        }

        // Fetch creator
        const creator = await fetchQuery(api.creators.getById, {
            id: creatorId as Id<"creators">
        })

        if (!creator) {
            return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
        }

        // Prevent deleting admin accounts
        if (creator.role === 'admin') {
            return NextResponse.json({ error: 'Cannot delete admin accounts' }, { status: 403 })
        }

        // Prevent self-deletion
        if (creator.clerkId === userId) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 })
        }

        const creatorName = `${creator.firstName} ${creator.lastName}`
        console.log(`[delete-creator] Deleting creator "${creatorName}" (${creatorId})`)

        const deletedAssets: string[] = []
        const failedAssets: { asset: string; error: string }[] = []

        // Step 1: Get all submissions for this creator
        const submissions = await fetchQuery(api.submissions.getByCreatorId, {
            creatorId: creatorId as Id<"creators">
        })

        console.log(`[delete-creator] Found ${submissions?.length || 0} submissions to delete`)

        // Step 2: Delete external assets for each submission
        if (submissions && submissions.length > 0) {
            const r2AccountId = process.env.R2_ACCOUNT_ID
            const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
            const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY
            const r2BucketName = process.env.R2_BUCKET_NAME
            const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
            const cfApiToken = process.env.CLOUDFLARE_API_TOKEN
            const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID
            const airtablePat = process.env.AIRTABLE_PAT
            const airtableBaseId = process.env.AIRTABLE_BASE_ID
            const airtableTableId = process.env.AIRTABLE_TABLE_ID

            let r2Client: S3Client | null = null
            if (r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2BucketName) {
                r2Client = new S3Client({
                    region: 'auto',
                    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
                    credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey },
                    requestHandler: { requestTimeout: 10_000 },
                })
            }

            const allR2Urls: string[] = []

            for (const submission of submissions) {
                // Collect R2 URLs from submission
                allR2Urls.push(...collectR2UrlsFromSubmission(submission))

                // Get website records for enhanced/section images
                try {
                    const website = await fetchQuery(api.generatedWebsites.getBySubmissionId, {
                        submissionId: submission._id
                    })

                    if (website) {
                        // Delete Cloudflare Pages project
                        if (website.cfPagesProjectName && cfApiToken && cfAccountId) {
                            try {
                                const res = await fetch(
                                    `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${website.cfPagesProjectName}`,
                                    { method: 'DELETE', headers: { 'Authorization': `Bearer ${cfApiToken}` } }
                                )
                                if (res.ok || res.status === 404) {
                                    deletedAssets.push(`cf_pages:${website.cfPagesProjectName}`)
                                } else {
                                    failedAssets.push({ asset: `cf_pages:${website.cfPagesProjectName}`, error: `HTTP ${res.status}` })
                                }
                            } catch (error: any) {
                                failedAssets.push({ asset: `cf_pages:${website.cfPagesProjectName}`, error: error.message })
                            }
                        }

                        allR2Urls.push(...collectEnhancedImageUrls(website.enhancedImages))
                        allR2Urls.push(...collectEnhancedImageUrls((website.extractedContent as any)?.enhancedImages))
                        allR2Urls.push(...collectSectionImageUrls(website.images))
                        if (website.featuredImages && Array.isArray(website.featuredImages)) {
                            for (const img of website.featuredImages) {
                                if (typeof img === 'string' && img.startsWith('http')) allR2Urls.push(img)
                            }
                        }
                    }

                    const websiteContent = await fetchQuery(api.websiteContent.getBySubmissionId, {
                        submissionId: submission._id
                    })
                    if (websiteContent) {
                        allR2Urls.push(...collectEnhancedImageUrls(websiteContent.enhancedImages))
                        allR2Urls.push(...collectSectionImageUrls(websiteContent.images))
                        if (websiteContent.featuredImages && Array.isArray(websiteContent.featuredImages)) {
                            for (const img of websiteContent.featuredImages) {
                                if (typeof img === 'string' && img.startsWith('http')) allR2Urls.push(img)
                            }
                        }
                    }
                } catch {
                    // Website records may not exist
                }

                // Delete Airtable record
                if (submission.airtableRecordId && airtablePat && airtableBaseId && airtableTableId) {
                    try {
                        const res = await fetch(
                            `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableId}/${submission.airtableRecordId}`,
                            { method: 'DELETE', headers: { 'Authorization': `Bearer ${airtablePat}` } }
                        )
                        if (res.ok || res.status === 404) {
                            deletedAssets.push(`airtable:${submission.airtableRecordId}`)
                        } else {
                            failedAssets.push({ asset: `airtable:${submission.airtableRecordId}`, error: `HTTP ${res.status}` })
                        }
                    } catch (error: any) {
                        failedAssets.push({ asset: `airtable:${submission.airtableRecordId}`, error: error.message })
                    }
                }
            }

            // Delete all R2 files in bulk
            if (r2Client && r2BucketName) {
                const uniqueR2Urls = [...new Set(allR2Urls)]
                console.log(`[delete-creator] Deleting ${uniqueR2Urls.length} R2 files`)

                const r2Results = await Promise.allSettled(
                    uniqueR2Urls
                        .map(url => extractR2Key(url, r2PublicUrl))
                        .filter((key): key is string => key !== null)
                        .map(key => deleteR2File(r2Client!, r2BucketName, key))
                )

                let r2Deleted = 0
                for (const result of r2Results) {
                    if (result.status === 'fulfilled' && result.value.success) r2Deleted++
                }
                if (r2Deleted > 0) deletedAssets.push(`r2_files (${r2Deleted})`)

                r2Client.destroy()
            }
        }

        // Step 3: Delete Clerk account
        try {
            const clerk = await clerkClient()
            await clerk.users.deleteUser(creator.clerkId)
            deletedAssets.push('clerk_account')
            console.log(`[delete-creator] Clerk account deleted: ${creator.clerkId}`)
        } catch (error: any) {
            console.error(`[delete-creator] Failed to delete Clerk account:`, error.message)
            failedAssets.push({ asset: 'clerk_account', error: error.message })
        }

        // Step 4: Delete all Convex records
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                await fetchMutation(api.admin.deleteCreatorRecords, {
                    creatorId: creatorId as Id<"creators">,
                    adminId: userId,
                    deletedAssets: {
                        deleted: deletedAssets,
                        failed: failedAssets,
                    },
                })
                break
            } catch (err: any) {
                if (attempt === 1 && (err?.cause?.code === 'ECONNRESET' || err?.message?.includes('fetch failed'))) {
                    console.warn(`[delete-creator] Convex mutation failed (attempt 1), retrying...`, err.message)
                    continue
                }
                throw err
            }
        }

        console.log(`[delete-creator] Deletion complete for "${creatorName}"`)

        return NextResponse.json({
            success: true,
            message: `Successfully deleted creator "${creatorName}" and all associated data`,
            deletedAssets,
            failedAssets: failedAssets.length > 0 ? failedAssets : undefined,
        })

    } catch (error: any) {
        console.error('Delete creator error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to delete creator' },
            { status: 500 }
        )
    }
}
