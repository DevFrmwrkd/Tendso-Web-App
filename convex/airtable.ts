import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/auth';
import { giveawayCanRender } from './lib/giveaway';

// ==================== HELPERS ====================

/**
 * Sanitize text to prevent Airtable formula injection.
 * Strips leading characters that could trigger formula evaluation.
 */
function sanitizeText(text: string | undefined): string {
    if (!text) return '';
    return text.replace(/^[=+\-@|]+/, '');
}

/**
 * Extract value from Airtable AI field format.
 * Handles multiple formats:
 * - Plain string: "Some text"
 * - Airtable AI object: { state: "generated", value: "Some text" }
 * - Nested key object: { "hero_headline": "Some text", ... }
 * - Any object with a string value in its first key
 */
function extractAiFieldValue(field: unknown): string | null {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && field !== null) {
        const obj = field as Record<string, unknown>;
        // Format: { state: "generated", value: "..." }
        if ('value' in obj && typeof obj.value === 'string' && obj.value) {
            return obj.value;
        }
        // Format: { "hero_headline": "...", ... } — grab first string value
        const values = Object.values(obj);
        for (const val of values) {
            if (typeof val === 'string' && val.length > 0) {
                return val;
            }
        }
    }
    return null;
}

/**
 * Get the first URL from an Airtable attachment field.
 * Attachments are arrays of { url, filename, ... }.
 */
function getAttachmentUrl(field: unknown): string | null {
    if (!field) return null;
    if (Array.isArray(field) && field.length > 0 && field[0]?.url) {
        return field[0].url;
    }
    return null;
}

/**
 * Get ALL URLs from an Airtable attachment field (supports multiple variations).
 * Attachments are arrays of { url, filename, ... }.
 */
function getAllAttachmentUrls(field: unknown): string[] {
    if (!field) return [];
    if (Array.isArray(field)) {
        return field
            .filter((item): item is { url: string; filename?: string } => item && typeof item === 'object' && 'url' in item && typeof item.url === 'string')
            .map((item) => item.url);
    }
    return [];
}

/** Exponential backoff delays in milliseconds */
const RETRY_DELAYS = [30_000, 60_000, 120_000, 300_000, 600_000];
const MAX_RETRIES = 5;

// ==================== INTERNAL QUERIES ====================

export const getSubmissionById = internalQuery({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.submissionId);
    },
});

// ==================== INTERNAL MUTATIONS ====================

export const updateAirtableRecordId = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        airtableRecordId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.submissionId, {
            airtableRecordId: args.airtableRecordId,
        });
    },
});

export const updateSyncStatus = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.submissionId, {
            airtableSyncStatus: args.status,
        });
    },
});

export const saveEnhancedContent = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        enhancedImages: v.any(),
        heroHeadline: v.optional(v.string()),
        heroSubHeadline: v.optional(v.string()),
        aboutDescription: v.optional(v.string()),
        servicesDescription: v.optional(v.string()),
        contactCta: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        const contentFields = {
            enhancedImages: args.enhancedImages,
            heroHeadline: args.heroHeadline,
            heroSubHeadline: args.heroSubHeadline,
            aboutDescription: args.aboutDescription,
            servicesDescription: args.servicesDescription,
            contactCta: args.contactCta,
            airtableSyncedAt: Date.now(),
            updatedAt: Date.now(),
        };

        if (existing) {
            await ctx.db.patch(existing._id, contentFields);
        } else {
            await ctx.db.insert('generatedWebsites', {
                submissionId: args.submissionId,
                ...contentFields,
            });
        }
    },
});

// ==================== INTERNAL ACTIONS ====================

/**
 * Push submission data to Airtable.
 * Creates a record with business info, transcript, and original photos.
 * Waits for transcription to complete before pushing (up to 10 retries).
 */
export const pushToAirtable = internalAction({
    args: {
        submissionId: v.id('submissions'),
        transcriptRetry: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.runQuery(internal.airtable.getSubmissionById, {
            submissionId: args.submissionId,
        });
        if (!submission) throw new Error('Submission not found');

        // Old queued retries cannot spend on an unapproved/rejected giveaway.
        if (!giveawayCanRender(submission)) return;

        // Wait for transcription to complete before pushing
        const retryCount = args.transcriptRetry ?? 0;
        const hasMedia = submission.videoUrl || submission.audioUrl || submission.videoStorageId || submission.audioStorageId;
        const transcriptionPending = hasMedia && (!submission.transcript || submission.transcriptionStatus === 'processing');

        if (transcriptionPending && retryCount < 10) {
            const delay = retryCount < 3 ? 10_000 : 30_000;
            console.log(`Transcript not ready for ${args.submissionId}, retry ${retryCount + 1} in ${delay / 1000}s`);
            await ctx.scheduler.runAfter(delay, internal.airtable.pushToAirtable, {
                submissionId: args.submissionId,
                transcriptRetry: retryCount + 1,
            });
            return;
        }

        if (transcriptionPending) {
            console.warn(`Pushing ${args.submissionId} to Airtable without transcript (timed out after ${retryCount} retries)`);
        }

        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const tableId = process.env.AIRTABLE_TABLE_ID;
        if (!apiKey || !baseId || !tableId) {
            throw new Error('Missing Airtable environment variables');
        }

        // Resolve photo URLs — photos may be R2 URLs or Convex storage IDs/R2 paths
        const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
        const photos = submission.photos || [];
        const resolvedPhotos: string[] = [];
        for (const photo of photos) {
            if (photo.startsWith('http://') || photo.startsWith('https://')) {
                resolvedPhotos.push(photo);
            } else if (/^(images|videos|audio)\//.test(photo) && r2PublicUrl) {
                resolvedPhotos.push(`${r2PublicUrl}/${photo}`);
            } else {
                // Convex storage ID — resolve to URL
                try {
                    const storageId = photo.startsWith('convex:') ? photo.replace('convex:', '') : photo;
                    const url = await ctx.storage.getUrl(storageId as any);
                    if (url) resolvedPhotos.push(url);
                } catch {
                    console.warn(`Could not resolve photo URL: ${photo}`);
                }
            }
        }

        // Determine hasProducts based on photo count (>4 photos = has products)
        const hasProducts = submission.hasProducts ?? resolvedPhotos.length > 4;

        // Build photo attachment fields by index
        const photoFields: Record<string, Array<{ url: string }>> = {};
        if (resolvedPhotos[0]) photoFields.original_headshot = [{ url: resolvedPhotos[0] }];
        if (resolvedPhotos[1]) photoFields.original_interior_1 = [{ url: resolvedPhotos[1] }];
        if (resolvedPhotos[2]) photoFields.original_interior_2 = [{ url: resolvedPhotos[2] }];
        if (resolvedPhotos[3]) photoFields.original_exterior = [{ url: resolvedPhotos[3] }];
        if (hasProducts) {
            if (resolvedPhotos[4]) photoFields.original_product_1 = [{ url: resolvedPhotos[4] }];
            if (resolvedPhotos[5]) photoFields.original_product_2 = [{ url: resolvedPhotos[5] }];
        }

        console.log(`Pushing ${args.submissionId}: ${resolvedPhotos.length} photos resolved, hasProducts=${hasProducts}`);

        const fields = {
            convex_record_id: args.submissionId,
            client_name: sanitizeText(submission.ownerName),
            business_name: sanitizeText(submission.businessName),
            business_type: sanitizeText(submission.businessType),
            transcript: sanitizeText(submission.transcript),
            has_products: hasProducts,
            Status: 'pending',
            ...photoFields,
        };

        let airtableRecordId = submission.airtableRecordId;

        if (airtableRecordId) {
            // Record already exists — update Status to 'pending' to retrigger image generation
            console.log(`Resetting existing Airtable record ${airtableRecordId} to pending`);
            const patchResponse = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}/${airtableRecordId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fields: {
                        Status: 'pending',
                        ...photoFields,
                        transcript: sanitizeText(submission.transcript),
                    },
                }),
            });

            if (!patchResponse.ok) {
                const errorText = await patchResponse.text();
                // If 403 or 404, fall through to create a new record
                if (patchResponse.status === 403 || patchResponse.status === 404) {
                    console.warn(`Cannot update Airtable record ${airtableRecordId} (${patchResponse.status}), creating new one`);
                    airtableRecordId = undefined;
                } else {
                    throw new Error(`Airtable PATCH failed (${patchResponse.status}): ${errorText}`);
                }
            } else {
                // Update succeeded — skip creation, go straight to polling
                await ctx.runMutation(internal.airtable.updateSyncStatus, {
                    submissionId: args.submissionId,
                    status: 'pushed',
                });

                await ctx.scheduler.runAfter(30_000, internal.airtable.fetchEnhancedContentWithRetry, {
                    submissionId: args.submissionId,
                    airtableRecordId,
                    retryCount: 0,
                    hasProducts,
                });
                return;
            }
        }

        {
            // Create new record
            const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fields }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Airtable POST failed (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            airtableRecordId = result.id;

            // Store the new Airtable record ID
            await ctx.runMutation(internal.airtable.updateAirtableRecordId, {
                submissionId: args.submissionId,
                airtableRecordId: airtableRecordId!,
            });
        }

        // Update sync status
        await ctx.runMutation(internal.airtable.updateSyncStatus, {
            submissionId: args.submissionId,
            status: 'pushed',
        });

        // Schedule polling for enhanced content after 30s
        await ctx.scheduler.runAfter(30_000, internal.airtable.fetchEnhancedContentWithRetry, {
            submissionId: args.submissionId,
            airtableRecordId: airtableRecordId!,
            retryCount: 0,
            hasProducts,
        });
    },
});

/**
 * Wrapper around pushToAirtable with error handling.
 * This is the entry point scheduled by submissions.submit().
 */
export const pushToAirtableInternal = internalAction({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        try {
            await ctx.runAction(internal.airtable.pushToAirtable, {
                submissionId: args.submissionId,
                transcriptRetry: 0,
            });
        } catch (error) {
            console.error(`Airtable push failed for ${args.submissionId}:`, error);
            await ctx.runMutation(internal.airtable.updateSyncStatus, {
                submissionId: args.submissionId,
                status: 'error',
            });
        }
    },
});

/**
 * Poll Airtable for AI-enhanced content with exponential backoff.
 *
 * Strategy: Save whatever enhanced content is available.
 * - At least 1 enhanced image = proceed (don't wait for all 4)
 * - AI text fields are best-effort
 * - After MAX_RETRIES, save whatever we have instead of marking error
 */
export const fetchEnhancedContentWithRetry = internalAction({
    args: {
        submissionId: v.id('submissions'),
        airtableRecordId: v.string(),
        retryCount: v.number(),
        hasProducts: v.boolean(),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const tableId = process.env.AIRTABLE_TABLE_ID;
        if (!apiKey || !baseId || !tableId) {
            throw new Error('Missing Airtable environment variables');
        }

        // GET the Airtable record
        const response = await fetch(
            `https://api.airtable.com/v0/${baseId}/${tableId}/${args.airtableRecordId}`,
            {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Airtable GET failed (${response.status}): ${errorText}`);
            await ctx.runMutation(internal.airtable.updateSyncStatus, {
                submissionId: args.submissionId,
                status: 'error',
            });
            return;
        }

        const record = await response.json();
        const fields = record.fields || {};

        // Dynamically collect ALL enhanced images from the record (including multiple variations per field)
        const enhancedImagesFromRecord: Record<string, string> = {};
        let imageCounter = 0;
        
        for (const [key, value] of Object.entries(fields)) {
            if (key.startsWith('enhanced_') || key.startsWith('Optimized')) {
                // Get ALL URLs from this field (not just the first one)
                const allUrls = getAllAttachmentUrls(value);
                
                if (allUrls.length > 0) {
                    // If there's only one URL, store it with the original key
                    if (allUrls.length === 1) {
                        enhancedImagesFromRecord[key] = allUrls[0];
                    } else {
                        // If multiple URLs, store each with a numbered suffix to preserve all
                        allUrls.forEach((url, index) => {
                            enhancedImagesFromRecord[`${key}_v${index + 1}`] = url;
                        });
                    }
                    imageCounter += allUrls.length;
                }
            }
        }
        
        console.log(`Collected ${imageCounter} total enhanced images across ${Object.keys(enhancedImagesFromRecord).length} fields`);


        // Collect all available AI text fields
        const heroHeadline = extractAiFieldValue(fields.hero_headline);
        const heroSubheadline = extractAiFieldValue(fields.hero_subheadline);
        const aboutContent = extractAiFieldValue(fields.about_content);
        const servicesDescription = extractAiFieldValue(fields.services_description);
        const contactCta = extractAiFieldValue(fields.contact_cta);

        // Count what's available - now counting ALL collected images, not just legacy ones
        const totalCollectedImages = Object.keys(enhancedImagesFromRecord).length;
        const availableText = [heroHeadline, heroSubheadline, aboutContent, servicesDescription, contactCta].filter(Boolean);
        const hasAnyContent = totalCollectedImages > 0 || availableText.length > 0;

        console.log(`Submission ${args.submissionId} [retry ${args.retryCount}]: ${totalCollectedImages} total images, ${availableText.length}/5 text fields`);

        // If no content at all and we have retries left, wait
        if (!hasAnyContent && args.retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAYS[args.retryCount] ?? 600_000;
            console.log(`No content yet for ${args.submissionId}, retry in ${delay / 1000}s`);
            await ctx.scheduler.runAfter(delay, internal.airtable.fetchEnhancedContentWithRetry, {
                submissionId: args.submissionId,
                airtableRecordId: args.airtableRecordId,
                retryCount: args.retryCount + 1,
                hasProducts: args.hasProducts,
            });
            return;
        }

        // If we have some images but fewer than 3, and retries left, wait for more
        const minImages = 3;
        if (totalCollectedImages < minImages && totalCollectedImages > 0 && args.retryCount < MAX_RETRIES) {
            if (args.retryCount < 2) {
                const delay = RETRY_DELAYS[args.retryCount] ?? 60_000;
                console.log(`Got ${totalCollectedImages}/${minImages} images, waiting for more...`);
                await ctx.scheduler.runAfter(delay, internal.airtable.fetchEnhancedContentWithRetry, {
                    submissionId: args.submissionId,
                    airtableRecordId: args.airtableRecordId,
                    retryCount: args.retryCount + 1,
                    hasProducts: args.hasProducts,
                });
                return;
            }
        }

        // No content after all retries
        if (!hasAnyContent) {
            console.error(`No enhanced content found for ${args.submissionId} after ${args.retryCount} retries`);
            await ctx.runMutation(internal.airtable.updateSyncStatus, {
                submissionId: args.submissionId,
                status: 'error',
            });
            return;
        }

        // ===== SAVE WHATEVER WE HAVE =====
        await ctx.runMutation(internal.airtable.updateSyncStatus, {
            submissionId: args.submissionId,
            status: 'content_received',
        });

        // Download and store ALL collected enhanced images with their versioning
        const enhancedImages: Record<string, { url: string; storageId: string }> = {};

        // Iterate through ALL collected images (including all versions: enhanced_headshot_v1, enhanced_headshot_v2, etc.)
        for (const [fieldKey, imageUrl] of Object.entries(enhancedImagesFromRecord)) {
            if (imageUrl) {
                try {
                    const storageId = await ctx.runAction(internal.airtable.downloadAndStoreEnhancedImage, {
                        submissionId: args.submissionId,
                        sourceImageUrl: imageUrl,
                    });
                    // Store with original versioned key so we keep all variations
                    enhancedImages[fieldKey] = { url: imageUrl, storageId };
                    console.log(`Stored enhanced image: ${fieldKey}`);
                } catch (error) {
                    console.error(`Failed to download image ${fieldKey} for ${args.submissionId}:`, error);
                }
            }
        }

        console.log(`Successfully downloaded and stored ${Object.keys(enhancedImages).length} enhanced images`);

        // Save all enhanced content to generatedWebsites
        await ctx.runMutation(internal.airtable.saveEnhancedContent, {
            submissionId: args.submissionId,
            enhancedImages,
            heroHeadline: heroHeadline ?? undefined,
            heroSubHeadline: heroSubheadline ?? undefined,
            aboutDescription: aboutContent ?? undefined,
            servicesDescription: servicesDescription ?? undefined,
            contactCta: contactCta ?? undefined,
        });

        // Mark as synced
        await ctx.runMutation(internal.airtable.updateSyncStatus, {
            submissionId: args.submissionId,
            status: 'synced',
        });

        // PATCH Airtable record status to done
        try {
            await fetch(
                `https://api.airtable.com/v0/${baseId}/${tableId}/${args.airtableRecordId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ fields: { Status: 'done' } }),
                }
            );
        } catch (error) {
            console.error('Failed to update Airtable status to done:', error);
        }

        console.log(`Submission ${args.submissionId}: synced ${Object.keys(enhancedImages).length} images, ${availableText.length} text fields`);
    },
});

/**
 * Download an image from URL and store in Convex file storage.
 */
export const downloadAndStoreEnhancedImage = internalAction({
    args: {
        submissionId: v.id('submissions'),
        sourceImageUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const response = await fetch(args.sourceImageUrl);
        if (!response.ok) {
            throw new Error(`Failed to download image (${response.status}): ${args.sourceImageUrl}`);
        }

        const blob = await response.blob();
        const storageId = await ctx.storage.store(blob);
        return storageId;
    },
});

// ==================== PUBLIC MUTATIONS ====================

/**
 * Trigger (or re-trigger) the Airtable push for a submission.
 * If the submission already has an Airtable record, it resets the sync status
 * and re-pushes to create a fresh record.
 */
export const triggerAirtablePush = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');

        // Preserve ordinary installed-client contracts, while protecting the
        // campaign's pending-review marker and eligibility-before-spend rule.
        if (submission.giveawayApplication) {
            await requireAdmin(ctx);
            if (!giveawayCanRender(submission)) throw new Error('Approve the giveaway poster before enhancing its photos.');
        }

        // Reset sync status but keep airtableRecordId if it exists
        // pushToAirtable will update the existing record or create a new one
        await ctx.db.patch(args.submissionId, {
            airtableSyncStatus: 'pending_push',
        });

        // Schedule the push
        await ctx.scheduler.runAfter(0, internal.airtable.pushToAirtableInternal, {
            submissionId: args.submissionId,
        });

        return { success: true };
    },
});

// ==================== PUBLIC QUERIES ====================

/**
 * Get current Airtable sync status for a submission.
 */
export const getSyncStatus = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        return submission?.airtableSyncStatus ?? null;
    },
});

/**
 * Get enhanced content (images + AI text) from generatedWebsites.
 */
export const getEnhancedContent = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (!website) return null;

        return {
            enhancedImages: website.enhancedImages,
            heroHeadline: website.heroHeadline,
            heroSubHeadline: website.heroSubHeadline,
            aboutDescription: website.aboutDescription,
            servicesDescription: website.servicesDescription,
            contactCta: website.contactCta,
            airtableSyncedAt: website.airtableSyncedAt,
        };
    },
});
