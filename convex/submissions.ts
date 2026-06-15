import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { BASE_PRICE, STANDARD_PRICE, UNLOCK_THRESHOLD, COMMISSION_RATE, CUSTOM_DOMAIN_ADDON, commissionFor, ownerTotal, domainAddOnFor } from '../lib/pricing';

// ==================== QUERIES ====================

/**
 * Get submission by ID
 */
export const getById = query({
    args: { id: v.id('submissions') },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

/**
 * Internal version — callable from actions
 */
export const getByIdInternal = internalQuery({
    args: { id: v.id('submissions') },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

/**
 * Get submission by ID with creator info
 */
export const getByIdWithCreator = query({
    args: { id: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.id);
        if (!submission) return null;

        const creator = await ctx.db.get(submission.creatorId);

        // Resolve reviewedBy Clerk ID to a name
        let reviewedByName: string | null = null;
        if (submission.reviewedBy) {
            const reviewer = await ctx.db
                .query('creators')
                .withIndex('by_clerk_id', (q) => q.eq('clerkId', submission.reviewedBy!))
                .unique();
            reviewedByName = reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null;
        }

        return {
            ...submission,
            reviewedByName,
            creator: creator
                ? {
                    firstName: creator.firstName,
                    lastName: creator.lastName,
                    email: creator.email,
                    phone: creator.phone,
                }
                : null,
        };
    },
});

/**
 * Get all submissions by creator
 */
export const getByCreatorId = query({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('submissions')
            .withIndex('by_creator_id', (q) => q.eq('creatorId', args.creatorId))
            .order('desc')
            .collect();
    },
});

/**
 * Get draft submission by creator (for continuing an unfinished submission)
 */
export const getDraftByCreatorId = query({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        const drafts = await ctx.db
            .query('submissions')
            .withIndex('by_creator_id', (q) => q.eq('creatorId', args.creatorId))
            .filter((q) => q.eq(q.field('status'), 'draft'))
            .order('desc')
            .take(1);
        return drafts[0] || null;
    },
});

/**
 * Get all submissions (admin only)
 */
export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query('submissions').order('desc').collect();
    },
});

/**
 * Get all submissions with creator info (admin only)
 */
export const getAllWithCreator = query({
    args: {},
    handler: async (ctx) => {
        const submissions = await ctx.db.query('submissions').order('desc').collect();

        // Cache reviewer lookups to avoid repeated queries
        const reviewerCache = new Map<string, string | null>();

        const submissionsWithCreator = await Promise.all(
            submissions.map(async (submission) => {
                const creator = await ctx.db.get(submission.creatorId);

                // Resolve reviewedBy Clerk ID to a name
                let reviewedByName: string | null = null;
                if (submission.reviewedBy) {
                    if (!reviewerCache.has(submission.reviewedBy)) {
                        const reviewer = await ctx.db
                            .query('creators')
                            .withIndex('by_clerk_id', (q) => q.eq('clerkId', submission.reviewedBy!))
                            .unique();
                        reviewerCache.set(
                            submission.reviewedBy,
                            reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null
                        );
                    }
                    reviewedByName = reviewerCache.get(submission.reviewedBy) ?? null;
                }

                return {
                    ...submission,
                    reviewedByName,
                    creator: creator
                        ? {
                            firstName: creator.firstName,
                            lastName: creator.lastName,
                            email: creator.email,
                            phone: creator.phone,
                        }
                        : null,
                };
            })
        );

        return submissionsWithCreator;
    },
});

/**
 * Get submissions by status
 */
export const getByStatus = query({
    args: {
        status: v.union(
            v.literal('draft'),
            v.literal('submitted'),
            v.literal('in_review'),
            v.literal('approved'),
            v.literal('rejected'),
            v.literal('deployed'),
            v.literal('pending_payment'),
            v.literal('paid'),
            v.literal('completed'),
            v.literal('website_generated')
        ),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('submissions')
            .withIndex('by_status', (q) => q.eq('status', args.status))
            .order('desc')
            .collect();
    },
});

/**
 * Pricing context for a creator: how many approved submissions they have, and
 * whether that unlocks the higher price ceiling. Used by the dashboard progress
 * meter and the review-page price picker. Keep the status set in sync with
 * admin.ts APPROVED_OR_LATER.
 */
export const getPricingContext = query({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        const approvedStatuses = ['approved', 'deployed', 'pending_payment', 'paid', 'completed', 'website_generated', 'unpublished'];
        const creator: any = await ctx.db.get(args.creatorId);
        const subs = await ctx.db
            .query('submissions')
            .withIndex('by_creator_id', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        const approvedCount = subs.filter((s) => approvedStatuses.includes(s.status)).length;
        const ceiling = creator?.priceCeiling ?? BASE_PRICE;
        return {
            approvedCount,
            priceCeiling: ceiling,
            unlocked: !!creator?.priceUnlockedAt || ceiling > BASE_PRICE,
            threshold: UNLOCK_THRESHOLD,
            basePrice: BASE_PRICE,
        };
    },
});

/**
 * Per-creator pricing summary for the admin creator detail page.
 * Shows what a creator is charging businesses, per submission + aggregates.
 *
 * Theo's model stores `amount` (owner total) and `creatorPayout` (50% of sell
 * price) on each submission; the sell price is derived as amount − domain add-on
 * (exact, no rounding drift). Domain add-on is the frozen real cost when present,
 * else the flat CUSTOM_DOMAIN_ADDON for the custom-domain tier.
 */
export const getCreatorPricingSummary = query({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        const subs = await ctx.db
            .query('submissions')
            .withIndex('by_creator_id', (q) => q.eq('creatorId', args.creatorId))
            .collect();

        const paidStatuses = ['paid', 'completed'];

        const rows = subs
            .filter((s) => s.amount !== undefined || s.creatorPayout !== undefined)
            .map((s) => {
                const isWithDomain = (s as any).submissionType === 'with_custom_domain';
                const domainAddOn = isWithDomain
                    ? (s.domainCostPHP ?? CUSTOM_DOMAIN_ADDON)
                    : 0;
                const amount = s.amount ?? 0;
                // Prefer deriving from amount (exact); fall back to creatorPayout.
                const sellPrice = amount > 0
                    ? Math.max(0, amount - domainAddOn)
                    : Math.round((s.creatorPayout ?? 0) / COMMISSION_RATE);
                const discountPct = sellPrice > 0
                    ? Math.max(0, Math.round((1 - sellPrice / 4999) * 100))
                    : 0;
                return {
                    submissionId: s._id,
                    businessName: s.businessName,
                    sellPrice,
                    domainAddOn,
                    discountPct,
                    creatorPayout: s.creatorPayout ?? commissionFor(sellPrice),
                    ownerTotal: amount,
                    status: s.status,
                    createdAt: s._creationTime,
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt);

        const paidRows = rows.filter((r) => paidStatuses.includes(r.status));
        const sellPrices = rows.map((r) => r.sellPrice).filter((n) => n > 0);
        const avgSellPrice = sellPrices.length
            ? Math.round(sellPrices.reduce((a, b) => a + b, 0) / sellPrices.length)
            : 0;
        const lifetimeEarned = paidRows.reduce((a, r) => a + r.creatorPayout, 0);

        return {
            rows,
            avgSellPrice,
            minSellPrice: sellPrices.length ? Math.min(...sellPrices) : 0,
            maxSellPrice: sellPrices.length ? Math.max(...sellPrices) : 0,
            lifetimeEarned,
            paidCount: paidRows.length,
            totalCount: rows.length,
        };
    },
});

// ==================== MUTATIONS ====================

/**
 * Create a new submission
 */
export const create = mutation({
    args: {
        creatorId: v.id('creators'),
        businessName: v.string(),
        businessType: v.string(),
        ownerName: v.string(),
        ownerPhone: v.string(),
        ownerEmail: v.optional(v.string()),
        address: v.string(),
        city: v.string(),
        province: v.optional(v.string()),
        barangay: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
        hasProducts: v.optional(v.boolean()),
        photos: v.optional(v.array(v.string())),
        // Accept plain strings — the mobile APK stores R2 object keys here
        // (e.g. "audio/1721293-a2b3c4d5.m4a"), which are NOT Convex storage IDs.
        // schema.ts declares these as v.string() too, so patching works either way.
        videoStorageId: v.optional(v.string()),
        audioStorageId: v.optional(v.string()),
        transcript: v.optional(v.string()),
        amount: v.optional(v.number()),
        creatorPayout: v.optional(v.number()),
        status: v.optional(v.union(
            v.literal('draft'),
            v.literal('submitted'),
            v.literal('in_review'),
            v.literal('approved'),
            v.literal('rejected'),
            v.literal('deployed'),
            v.literal('pending_payment'),
            v.literal('paid'),
            v.literal('completed'),
            v.literal('website_generated')
        )),
    },
    handler: async (ctx, args) => {
        const submissionId = await ctx.db.insert('submissions', {
            creatorId: args.creatorId,
            businessName: args.businessName,
            businessType: args.businessType,
            ownerName: args.ownerName,
            ownerPhone: args.ownerPhone,
            ownerEmail: args.ownerEmail,
            address: args.address,
            city: args.city,
            province: args.province,
            barangay: args.barangay,
            postalCode: args.postalCode,
            coordinates: args.coordinates,
            hasProducts: args.hasProducts,
            photos: args.photos ?? [],
            videoStorageId: args.videoStorageId,
            audioStorageId: args.audioStorageId,
            transcript: args.transcript,
            status: args.status ?? 'draft',
            amount: args.amount ?? STANDARD_PRICE,
            creatorPayout: args.creatorPayout ?? commissionFor(BASE_PRICE),
        });

        // Increment creator's submissionCount and lastActiveAt
        const creator = await ctx.db.get(args.creatorId);
        if (creator) {
            await ctx.db.patch(args.creatorId, {
                submissionCount: (creator.submissionCount || 0) + 1,
                lastActiveAt: Date.now(),
            });
        }

        return submissionId;
    },
});

/**
 * Update submission
 */
export const update = mutation({
    args: {
        id: v.id('submissions'),
        businessName: v.optional(v.string()),
        businessType: v.optional(v.string()),
        ownerName: v.optional(v.string()),
        ownerPhone: v.optional(v.string()),
        ownerEmail: v.optional(v.string()),
        address: v.optional(v.string()),
        city: v.optional(v.string()),
        province: v.optional(v.string()),
        barangay: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
        businessDescription: v.optional(v.string()),
        hasProducts: v.optional(v.boolean()),
        photos: v.optional(v.array(v.string())),
        // Accept plain strings — mobile APK stores R2 object keys here
        // ("audio/1721293-a2b3c4d5.m4a"), NOT Convex internal storage IDs.
        // schema.ts already declares these as v.string() for the same reason.
        // Mobile-referenced — do not tighten back to v.id('_storage').
        videoStorageId: v.optional(v.string()),
        audioStorageId: v.optional(v.string()),
        // R2 URLs (preferred for new uploads)
        videoUrl: v.optional(v.string()),
        audioUrl: v.optional(v.string()),
        transcript: v.optional(v.string()),
        transcriptionStatus: v.optional(v.string()), // processing, complete, failed
        transcriptionError: v.optional(v.string()),
        transcriptionUpdatedAt: v.optional(v.number()),
        websiteUrl: v.optional(v.string()),
        websiteCode: v.optional(v.string()),
        amount: v.optional(v.number()),
        creatorPayout: v.optional(v.number()),
        platformFee: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;

        // Filter out undefined values
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, value]) => value !== undefined)
        );

        await ctx.db.patch(id, filteredUpdates);

        // Auto-schedule transcription when media is freshly attached and there's
        // no existing transcript. This mirrors the behavior mobile's submissions.update
        // used to have — keeping the contract alive so mobile users stop seeing
        // "Transcript generating…" spinners that never resolve. See
        // docs/00-Overview-Mobile.md §submissions.
        const mediaFieldSet = !!(
            updates.audioStorageId ||
            updates.videoStorageId ||
            updates.audioUrl ||
            updates.videoUrl
        );
        const touchedTranscriptDirectly = updates.transcript !== undefined || updates.transcriptionStatus !== undefined;

        if (mediaFieldSet && !touchedTranscriptDirectly) {
            const current = await ctx.db.get(id);
            if (current && !current.transcript && current.transcriptionStatus !== 'processing') {
                // Determine which media we just set. Prefer video over audio if both were set.
                const isVideo = !!(updates.videoStorageId || updates.videoUrl);
                const storageId =
                    (updates.videoStorageId as string | undefined) ||
                    (updates.videoUrl as string | undefined) ||
                    (updates.audioStorageId as string | undefined) ||
                    (updates.audioUrl as string | undefined);

                await ctx.scheduler.runAfter(0, internal.submissions.transcribeMedia, {
                    submissionId: id,
                    storageId,
                    mediaType: isVideo ? 'video' : 'audio',
                });
            }
        }
    },
});

/**
 * Set the custom domain tier and domain on a submission (creator review page).
 * Requires ownership: caller must own the creator that owns the submission.
 */
export const setDomainTier = mutation({
    args: {
        id: v.id('submissions'),
        submissionType: v.union(v.literal('standard'), v.literal('with_custom_domain')),
        requestedDomain: v.optional(v.string()),
        // Creator-chosen sell price. Clamped server-side to the creator's band.
        sellPrice: v.optional(v.number()),
        // The domain's REAL registrar price (PHP), as fetched by /api/check-domain.
        // Frozen onto domainCostPHP so the payment link/email/webhook all match.
        domainPricePHP: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');

        // Determine amount based on tier
        const isWithDomain = args.submissionType === 'with_custom_domain';
        if (isWithDomain && !args.requestedDomain) {
            throw new Error('Custom domain is required for the with_custom_domain tier');
        }

        // Clamp the creator-chosen sell price to their allowed band
        // [BASE_PRICE, creator.priceCeiling]. Owner pays sellPrice + the domain
        // add-on; creator commission is 50% of the sell price (the domain is a
        // registrar pass-through, not commissioned). See lib/pricing.ts.
        const creator: any = await ctx.db.get(submission.creatorId);
        const ceiling = creator?.priceCeiling ?? BASE_PRICE;
        const sellPrice = Math.min(Math.max(Math.round(args.sellPrice ?? BASE_PRICE), BASE_PRICE), ceiling);

        // Resolve the domain add-on from the REAL registrar price when present,
        // else fall back to the flat CUSTOM_DOMAIN_ADDON. domainAddOnFor returns
        // 0 for the standard tier.
        const domainAddOn = domainAddOnFor(args.submissionType, args.domainPricePHP);

        const updates: any = {
            submissionType: args.submissionType,
            amount: sellPrice + domainAddOn,
            creatorPayout: commissionFor(sellPrice),
            domainStatus: isWithDomain ? 'pending_payment' : 'not_requested',
        };
        if (isWithDomain) {
            updates.requestedDomain = args.requestedDomain!.trim().toLowerCase();
            // Freeze the quoted domain price so downstream payment matches it.
            updates.domainCostPHP = domainAddOn;
        } else {
            updates.requestedDomain = undefined;
            updates.domainCostPHP = undefined;
        }

        await ctx.db.patch(args.id, updates);
    },
});

/**
 * Update submission status
 * Workflow: submitted -> in_review -> approved -> deployed -> pending_payment -> paid
 */
export const updateStatus = mutation({
    args: {
        id: v.id('submissions'),
        status: v.union(
            v.literal('draft'),
            v.literal('submitted'),
            v.literal('in_review'),
            v.literal('approved'),
            v.literal('rejected'),
            v.literal('deployed'),
            v.literal('pending_payment'),
            v.literal('paid'),
            v.literal('completed'),
            v.literal('website_generated'),
            v.literal('unpublished')
        ),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { status: args.status });
    },
});

/**
 * Submit a draft submission.
 * Sets status to "submitted", creates a lead, increments analytics,
 * and triggers the Airtable AI content pipeline.
 */
export const submit = mutation({
    args: { id: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');

        // Validate: at least 3 photos
        if (!submission.photos || submission.photos.length < 3) {
            throw new Error('At least 3 photos are required');
        }

        // 1. Update submission status
        // Preserve tier-based amount set by setDomainTier (base + domain add-on
        // for with_custom_domain, base only for standard). See lib/pricing.ts.
        const tier = (submission as any).submissionType === 'with_custom_domain'
            ? 'with_custom_domain'
            : 'standard';
        await ctx.db.patch(args.id, {
            status: 'submitted',
            // Preserve the creator-set amount (from setDomainTier / create);
            // only fall back to the base tier price if it was never set.
            amount: submission.amount ?? ownerTotal(BASE_PRICE, tier),
            airtableSyncStatus: 'pending_push',
        });

        // 2. Create a lead record from business owner info
        await ctx.db.insert('leads', {
            submissionId: args.id,
            creatorId: submission.creatorId,
            source: 'direct',
            name: submission.ownerName,
            phone: submission.ownerPhone,
            email: submission.ownerEmail,
            status: 'new',
            createdAt: Date.now(),
        });

        // 3. Increment analytics (daily + monthly)
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: today,
            periodType: 'daily',
            field: 'submissionsCount',
            delta: 1,
        });
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: month,
            periodType: 'monthly',
            field: 'submissionsCount',
            delta: 1,
        });

        // 4. Trigger Airtable AI pipeline
        await ctx.scheduler.runAfter(0, internal.airtable.pushToAirtableInternal, {
            submissionId: args.id,
        });
    },
});

/**
 * Save generated website
 */
export const saveWebsite = mutation({
    args: {
        id: v.id('submissions'),
        websiteUrl: v.string(),
        websiteCode: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            websiteUrl: args.websiteUrl,
            websiteCode: args.websiteCode,
            status: 'website_generated',
        });
    },
});

/**
 * Mark submission as paid
 */
export const markPaid = mutation({
    args: {
        id: v.id('submissions'),
        paymentReference: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            status: 'paid',
            paymentReference: args.paymentReference,
            paidAt: Date.now(),
        });
    },
});

/**
 * Record that a payment follow-up email has just been sent (auto cron OR manual
 * admin button). The unpublish cron leaves the pipeline alone; this flag only
 * stops the follow-up cron from re-sending the same submission.
 */
export const markFollowUpSent = mutation({
    args: { id: v.id('submissions') },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            followUpEmailSentAt: Date.now(),
        });
    },
});

/**
 * Request payout
 */
export const requestPayout = mutation({
    args: { id: v.id('submissions') },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            payoutRequestedAt: Date.now(),
        });
    },
});

/**
 * Mark payout as complete
 */
export const markPayoutComplete = mutation({
    args: { id: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');

        // Update submission
        await ctx.db.patch(args.id, {
            creatorPaidAt: Date.now(),
            status: 'completed',
        });

        // Update creator balance
        const creator = await ctx.db.get(submission.creatorId);
        if (creator) {
            await ctx.db.patch(submission.creatorId, {
                balance: (creator.balance || 0) - (submission.creatorPayout ?? 0),
                totalEarnings: (creator.totalEarnings || 0) + (submission.creatorPayout ?? 0),
            });
        }
    },
});

/**
 * Delete submission (draft only)
 */
export const remove = mutation({
    args: { id: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');

        if (submission.status !== 'draft') {
            throw new Error('Can only delete draft submissions');
        }

        await ctx.db.delete(args.id);
    },
});

// ==================== TRANSCRIPTION INTERNALS ====================
//
// These three functions are referenced by the mobile app (Google Play binary).
// Mobile's `submissions.update` mutation and internal transcription pipeline
// call them by name. Do NOT remove any of them — the deployed mobile binary
// will start throwing "function not found" errors on submission media flows if
// any of these are missing from the Convex deployment.
//
// See docs/00-Overview-Mobile.md §submissions for the mobile-side contract.

/**
 * Persist a completed transcript on a submission.
 * Mirrors mobile's internal mutation name.
 */
export const updateTranscription = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        transcription: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.submissionId, {
            transcript: args.transcription,
            transcriptionStatus: 'complete',
            transcriptionUpdatedAt: Date.now(),
        });
    },
});

/**
 * Update the transcription lifecycle status on a submission.
 * Mirrors mobile's internal mutation name.
 */
export const updateTranscriptionStatus = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        status: v.string(), // processing | complete | failed (string for cross-deploy safety)
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const patch: Record<string, unknown> = {
            transcriptionStatus: args.status,
        };
        if (args.error !== undefined) patch.transcriptionError = args.error;
        if (args.status === 'complete' || args.status === 'failed') {
            patch.transcriptionUpdatedAt = Date.now();
        }
        await ctx.db.patch(args.submissionId, patch);
    },
});

// ==================== GROQ WHISPER HELPER ====================

/**
 * POST one media chunk to Groq Whisper and return the transcript text.
 * Retries once on transient connection errors. Throws on unrecoverable failures.
 */
async function callGroqWhisper(
    chunk: ArrayBuffer,
    filename: string,
    groqKey: string
): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([chunk]), filename);
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${groqKey}` },
                body: form,
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`Groq API ${res.status}: ${text.slice(0, 300)}`);
            }
            const json: any = await res.json();
            return typeof json?.text === 'string' ? json.text : '';
        } catch (err: any) {
            const isTransient =
                err?.code === 'ECONNRESET' ||
                err?.cause?.code === 'ECONNRESET' ||
                /Connection error|fetch failed|network/i.test(err?.message || '');
            if (isTransient && attempt < 2) {
                await new Promise((r) => setTimeout(r, 3000));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Groq transcription failed after retries');
}

/**
 * Trigger transcription for a submission's media file.
 *
 * Mobile-referenced via scheduler from submissions.update. Calls Groq Whisper
 * directly with chunking support for 500MB+ files. DO NOT replace with a Next.js
 * round-trip — see docs/changes/MOBILE-PARTY-FIX-TRANSCRIBE.md for the incident
 * (2026-04-23) where the round-trip pattern 404'd in production because:
 *   1. Clerk middleware was blocking the server-to-server call, AND
 *   2. Convex in the cloud can't reach localhost during dev anyway.
 *
 * Direct-Groq removes one network hop, one auth surface, and one env-var
 * dependency. Chunking lives in convex/lib/media-chunker.ts and handles
 * webm/mp3/wav/mp4 at EBML Cluster / MP3 frame / PCM / AAC ADTS boundaries.
 *
 * Env vars required on the Convex deployment: GROQ_API_KEY, R2_PUBLIC_URL.
 */
export const transcribeMedia = internalAction({
    args: {
        submissionId: v.id('submissions'),
        storageId: v.optional(v.string()),
        mediaType: v.optional(v.union(v.literal('video'), v.literal('audio'))),
    },
    handler: async (ctx, args) => {
        // Mark as processing so UIs can show a spinner while Groq works.
        await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
            submissionId: args.submissionId,
            status: 'processing',
        });

        try {
            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) {
                throw new Error('GROQ_API_KEY env var not set on this Convex deployment');
            }

            // Resolve the storageId/URL/path to a fetchable HTTPS URL.
            const r2Prefix = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
            const raw = args.storageId || '';
            let mediaUrl: string | null = null;
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
                mediaUrl = raw;
            } else if (/^(images|videos|audio)\//.test(raw) && r2Prefix) {
                mediaUrl = `${r2Prefix}/${raw}`;
            }
            // Fallback: re-read the submission fields directly.
            if (!mediaUrl) {
                const fresh: any = await ctx.runQuery(internal.submissions.getByIdInternal, {
                    id: args.submissionId,
                });
                const candidates = [fresh?.videoUrl, fresh?.audioUrl, fresh?.videoStorageId, fresh?.audioStorageId]
                    .filter(Boolean) as string[];
                for (const f of candidates) {
                    if (f.startsWith('http')) { mediaUrl = f; break; }
                    if (/^(images|videos|audio)\//.test(f) && r2Prefix) {
                        mediaUrl = `${r2Prefix}/${f}`;
                        break;
                    }
                }
            }
            if (!mediaUrl) {
                throw new Error(`Could not resolve a fetchable URL for storageId "${args.storageId}"`);
            }

            // Download the media into memory as an ArrayBuffer.
            console.log(`[transcribeMedia] Fetching ${mediaUrl}`);
            const mediaRes = await fetch(mediaUrl);
            if (!mediaRes.ok) {
                throw new Error(`Failed to download media (HTTP ${mediaRes.status}): ${mediaUrl}`);
            }
            const contentType = mediaRes.headers.get('content-type') || '';
            const buffer = await mediaRes.arrayBuffer();
            const sizeMB = buffer.byteLength / 1024 / 1024;
            console.log(
                `[transcribeMedia] Downloaded ${sizeMB.toFixed(1)}MB, content-type="${contentType}"`
            );

            // Chunk if necessary — handles webm/mp3/wav/mp4. Files under the limit
            // return as a single-element array.
            const { chunkMediaFile, getFileExtension } = await import('./lib/mediaChunker');
            const chunks = chunkMediaFile(buffer, contentType, undefined, mediaUrl);
            const extension = getFileExtension(contentType, mediaUrl);
            console.log(`[transcribeMedia] Split into ${chunks.length} chunk(s)`);

            // Transcribe each chunk. Serial rather than parallel to respect Groq's
            // rate limits and avoid memory spikes for very large files.
            const transcripts: string[] = [];
            for (let i = 0; i < chunks.length; i++) {
                const filename = chunks.length > 1
                    ? `chunk-${i + 1}-of-${chunks.length}.${extension}`
                    : `audio.${extension}`;
                console.log(
                    `[transcribeMedia] Groq request ${i + 1}/${chunks.length} (${(chunks[i].byteLength / 1024 / 1024).toFixed(1)}MB)`
                );
                const text = await callGroqWhisper(chunks[i], filename, groqKey);
                transcripts.push(text);
            }

            const fullTranscript = transcripts.join(' ').trim();
            if (!fullTranscript) {
                throw new Error('Groq returned an empty transcript');
            }

            await ctx.runMutation(internal.submissions.updateTranscription, {
                submissionId: args.submissionId,
                transcription: fullTranscript,
            });
            console.log(
                `[transcribeMedia] Saved transcript for ${args.submissionId} (${fullTranscript.length} chars)`
            );
        } catch (error) {
            const reason = error instanceof Error ? error.message : 'Unknown transcription error';
            console.error(`[transcribeMedia] submissionId=${args.submissionId}:`, reason);
            await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
                submissionId: args.submissionId,
                status: 'failed',
                error: reason,
            });
        }
    },
});
