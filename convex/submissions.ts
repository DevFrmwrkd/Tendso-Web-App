import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation, internalAction } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { BASE_PRICE, PRICE_CEILING, WEBSITE_PRICE, STANDARD_PRICE, COMMISSION_RATE, CUSTOM_DOMAIN_ADDON, clampSellPrice, commissionFor, ownerTotal, domainAddOnFor, isComped, ownerChargeFor } from '../lib/pricing';
import { assertGiveawayCanActivate, assertGiveawayIdentityAvailable, normalizeGiveawayEmail, normalizeGiveawayPhone, readGiveaway } from './lib/giveaway';
import { requireAccountOwner, requireAdmin, requireCreatorAccount } from './lib/auth';
import { isCreatorAccount } from '../lib/accounts';

/** Capture edits belong to their creator; admin publishing can edit any account's content. */
async function requireSubmissionEditor(ctx: MutationCtx, creatorId: Id<'creators'>) {
    const { me } = await requireCreatorAccount(ctx);
    if (me.role !== 'admin' && me._id !== creatorId) {
        throw new Error('Forbidden: you can only edit your own submission');
    }
}

/** Mobile reads drafts before its token hydrates; preserve that read contract. */
async function canReadCreatorContext(ctx: QueryCtx, creatorId: Id<'creators'>): Promise<boolean> {
    if (await ctx.auth.getUserIdentity()) {
        await requireCreatorAccount(ctx, creatorId);
        return true;
    }
    const account = await ctx.db.get(creatorId);
    return !!account && (isCreatorAccount(account) || account.role === 'admin') &&
        !account.isDeleted && account.status !== 'deleted' && account.status !== 'suspended';
}

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
        await requireAdmin(ctx);
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
                    ...(creator.role === 'affiliate' ? { role: creator.role, affiliateHandle: creator.affiliateHandle, affiliateDisplayName: creator.affiliateDisplayName } : {}),
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
        await requireAccountOwner(ctx, args.creatorId);
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
        if (!await canReadCreatorContext(ctx, args.creatorId)) return null;
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
        await requireAdmin(ctx);
        return await ctx.db.query('submissions').order('desc').collect();
    },
});

/**
 * Get all submissions with creator info (admin only)
 */
export const getAllWithCreator = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
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
                            ...(creator.role === 'affiliate' ? { role: creator.role, affiliateHandle: creator.affiliateHandle, affiliateDisplayName: creator.affiliateDisplayName } : {}),
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
        await requireAdmin(ctx);
        return await ctx.db
            .query('submissions')
            .withIndex('by_status', (q) => q.eq('status', args.status))
            .order('desc')
            .collect();
    },
});

/**
 * A creator's price band: the bounds of the price slider.
 *
 * Referenced by the mobile app — do not remove. docs/changes/OWNER-PORTAL-PRICING-PLAN.md
 * has its slider read these bounds and show only when `unlocked`. Since 2026-10-06
 * every creator has the whole band from their first site, so `unlocked` is always
 * true, `priceCeiling` is PRICE_CEILING and `threshold` (approvals needed) is 0. The
 * shape stays the same so an installed app keeps working. `approvedCount` is still
 * the creator's approved-or-later count.
 */
export const getPricingContext = query({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        if (!await canReadCreatorContext(ctx, args.creatorId)) return null;
        const approvedStatuses = ['approved', 'deployed', 'pending_payment', 'paid', 'completed', 'website_generated', 'unpublished'];
        const subs = await ctx.db
            .query('submissions')
            .withIndex('by_creator_id', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        const approvedCount = subs.filter((s) => approvedStatuses.includes(s.status)).length;
        return {
            approvedCount,
            priceCeiling: PRICE_CEILING,
            unlocked: true,
            threshold: 0,
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
        await requireAdmin(ctx);
        const account = await ctx.db.get(args.creatorId);
        if (account?.role === 'affiliate') throw new Error('Affiliate accounts do not have creator pricing summaries.');
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
                // Promo site: the owner was charged nothing. `sellPrice` stays
                // at the list value (it is what the site was worth, and the
                // creator's ₱500 is half of it), but ownerTotal must be the ₱0
                // that actually changed hands — this row feeds a view whose
                // whole subject is what creators charge businesses.
                const comped = isComped(s as any);
                return {
                    submissionId: s._id,
                    businessName: s.businessName,
                    sellPrice,
                    domainAddOn,
                    discountPct,
                    creatorPayout: s.creatorPayout ?? commissionFor(sellPrice),
                    ownerTotal: ownerChargeFor(s as any),
                    listPrice: amount,
                    isComped: comped,
                    status: s.status,
                    createdAt: s._creationTime,
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt);

        const paidRows = rows.filter((r) => paidStatuses.includes(r.status));
        // Comped rows are excluded from the price spread: a giveaway is not
        // evidence of what this creator charges, and leaving them in would drag
        // the average toward a price nobody was ever quoted. They stay in
        // lifetimeEarned — the creator earned that money for real.
        const sellPrices = rows.filter((r) => !r.isComped).map((r) => r.sellPrice).filter((n) => n > 0);
        const avgSellPrice = sellPrices.length
            ? Math.round(sellPrices.reduce((a, b) => a + b, 0) / sellPrices.length)
            : 0;
        const lifetimeEarned = paidRows.reduce((a, r) => a + r.creatorPayout, 0);
        const compedRows = rows.filter((r) => r.isComped);

        return {
            rows,
            avgSellPrice,
            minSellPrice: sellPrices.length ? Math.min(...sellPrices) : 0,
            maxSellPrice: sellPrices.length ? Math.max(...sellPrices) : 0,
            lifetimeEarned,
            paidCount: paidRows.length,
            compedCount: compedRows.length,
            compedPayoutTotal: compedRows.reduce((a, r) => a + r.creatorPayout, 0),
            totalCount: rows.length,
        };
    },
});

// ==================== MUTATIONS ====================

/**
 * Validate an incoming ?prospectLeadId= before we store it on a submission.
 *
 * NEVER throws. The creator is standing in front of the business on a phone —
 * a stale, already-interviewed, or hand-edited id must degrade to a normal
 * unlinked submission, not block the interview. Returns undefined when the id
 * can't be linked, and the caller just omits the field.
 */
async function resolveProspectLead(
    ctx: MutationCtx,
    leadId: Id<'leads'> | undefined,
): Promise<Id<'leads'> | undefined> {
    if (!leadId) return undefined;
    const lead = await ctx.db.get(leadId);
    if (!lead) return undefined;
    // Only scraped prospects convert — never a real customer lead.
    if (lead.source !== 'outscraper') return undefined;
    // Someone already interviewed it; don't steal their link.
    if (lead.submissionId) return undefined;
    // Already ported to the new prospects pool — linking here would leave its
    // twin 'available' and leak the business back onto Discover.
    if ((lead as any).migratedToProspectId) return undefined;
    return leadId;
}

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
        // Set when this interview was started from a scraped prospect
        // (/submit/info?prospectLeadId=…). Validated server-side; an
        // unusable id is silently dropped rather than failing the create.
        prospectLeadId: v.optional(v.id('leads')),
    },
    handler: async (ctx, args) => {
        const { me } = await requireCreatorAccount(ctx, args.creatorId);
        if (args.status && args.status !== 'draft' && args.status !== 'submitted' && me.role !== 'admin') {
            throw new Error('Forbidden: admin access required to set submission status');
        }
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
            prospectLeadId: await resolveProspectLead(ctx, args.prospectLeadId),
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
        // See create(). Set-once — never re-pointed or cleared here.
        prospectLeadId: v.optional(v.id('leads')),
    },
    handler: async (ctx, args) => {
        // prospectLeadId is pulled out of the generic spread deliberately: it
        // needs validation, and letting it flow through filteredUpdates would
        // let a re-entry silently re-point an in-progress interview at a
        // different business.
        const { id, prospectLeadId, ...updates } = args;

        // Filter out undefined values
        const filteredUpdates: Record<string, unknown> = Object.fromEntries(
            Object.entries(updates).filter(([, value]) => value !== undefined)
        );

        const submission = await ctx.db.get(id);
        if (!submission) throw new Error('Submission not found');
        await requireSubmissionEditor(ctx, submission.creatorId);
        const attributedAccount = await ctx.db.get(submission.creatorId);
        if (submission.contentSource === 'owner_intake' || attributedAccount?.role === 'affiliate') {
            // Shared publish/transcription callers can still edit content. They
            // cannot replace the price and commission frozen at owner intake.
            delete filteredUpdates.amount;
            delete filteredUpdates.creatorPayout;
            delete filteredUpdates.platformFee;
        }
        if (submission.giveawayApplication) {
            // An applicant's zero-price offer survives shared mobile/admin edits.
            filteredUpdates.amount = 0;
            filteredUpdates.creatorPayout = 0;
            filteredUpdates.platformFee = 0;
            filteredUpdates.giveawayPhoneKey = submission.giveawayPhoneKey ?? normalizeGiveawayPhone(submission.ownerPhone);
            if (submission.ownerEmail) {
                filteredUpdates.giveawayEmailKey = submission.giveawayEmailKey ?? normalizeGiveawayEmail(submission.ownerEmail);
            }
            if (submission.status !== 'rejected' &&
                (updates.ownerPhone !== undefined || updates.ownerEmail !== undefined)) {
                const giveaway = await readGiveaway(ctx);
                assertGiveawayIdentityAvailable(giveaway.applications, {
                    ownerPhone: updates.ownerPhone ?? submission.ownerPhone,
                    ownerEmail: updates.ownerEmail ?? submission.ownerEmail,
                }, id);
            }
        }

        if (prospectLeadId) {
            const existing = await ctx.db.get(id);
            // Only ever SET the link — never overwrite one that's already there.
            if (existing && !existing.prospectLeadId) {
                const resolved = await resolveProspectLead(ctx, prospectLeadId);
                if (resolved) filteredUpdates.prospectLeadId = resolved;
            }
        }

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
                // Determine which media we just set. A video interview from the
                // mobile app arrives with an audio file recorded beside it
                // (interview-audio.m4a). Transcribe the video, which holds the
                // whole interview; that audio can stop early (seen: 0:19 of a
                // 1:45 interview), so it is only the fallback.
                const audio =
                    (updates.audioStorageId as string | undefined) ||
                    (updates.audioUrl as string | undefined);
                const video =
                    (updates.videoStorageId as string | undefined) ||
                    (updates.videoUrl as string | undefined);

                await ctx.scheduler.runAfter(0, internal.transcription.transcribeMedia, {
                    submissionId: id,
                    storageId: video || audio,
                    mediaType: video ? 'video' : 'audio',
                    ...(video && audio ? { audioFallback: audio } : {}),
                });
            }
        }
    },
});

/**
 * Set the custom domain tier and domain on a submission (creator review page).
 *
 * Signed-in callers must be creators or admins; affiliate prices are configured
 * on the affiliate account instead. Shared server calls without Clerk tokens
 * retain their contract while affiliate-owned orders cannot use this capture path.
 */
export const setDomainTier = mutation({
    args: {
        id: v.id('submissions'),
        submissionType: v.union(v.literal('standard'), v.literal('with_custom_domain')),
        requestedDomain: v.optional(v.string()),
        // Creator-chosen sell price. Clamped server-side to [BASE_PRICE, PRICE_CEILING].
        sellPrice: v.optional(v.number()),
        // The domain's REAL registrar price (PHP), as fetched by /api/check-domain.
        // Frozen onto domainCostPHP so the payment link/email/webhook all match.
        domainPricePHP: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');

        await requireSubmissionEditor(ctx, submission.creatorId);
        const account = await ctx.db.get(submission.creatorId);
        if (account?.role === 'affiliate') throw new Error('Affiliate orders cannot use creator pricing.');
        if (submission.contentSource === 'owner_intake' && !submission.giveawayApplication) {
            throw new Error('Owner-intake orders cannot use creator pricing.');
        }

        if (submission.giveawayApplication) {
            if (args.submissionType !== 'standard' || args.requestedDomain?.trim()) {
                throw new Error('Giveaway websites use a Tendso web address; custom domains are not included.');
            }
            await ctx.db.patch(args.id, {
                submissionType: 'standard',
                amount: 0,
                creatorPayout: 0,
                platformFee: 0,
                campaign: undefined,
                websiteListPrice: undefined,
                requestedDomain: undefined,
                domainCostPHP: undefined,
                domainStatus: 'not_requested',
            });
            return;
        }

        // Determine amount based on tier
        const isWithDomain = args.submissionType === 'with_custom_domain';
        if (isWithDomain && !args.requestedDomain) {
            throw new Error('Custom domain is required for the with_custom_domain tier');
        }

        // Clamp the creator-chosen sell price to the band every creator has,
        // [BASE_PRICE, PRICE_CEILING]. Owner pays sellPrice + the domain
        // add-on; creator commission is 50% of the sell price (the domain is a
        // registrar pass-through, not commissioned). See lib/pricing.ts.
        // A missing sellPrice stays BASE_PRICE, not WEBSITE_PRICE: an APK that
        // predates the slider sends none, and its creator quoted the owner ₱999.
        const sellPrice = clampSellPrice(args.sellPrice ?? BASE_PRICE);

        // Resolve the domain add-on from the REAL registrar price when present,
        // else fall back to the flat CUSTOM_DOMAIN_ADDON. domainAddOnFor returns
        // 0 for the standard tier.
        const domainAddOn = domainAddOnFor(args.submissionType, args.domainPricePHP);

        const updates: any = {
            submissionType: args.submissionType,
            amount: sellPrice + domainAddOn,
            creatorPayout: commissionFor(sellPrice),
            // The list price this sale is discounted from, frozen with it: the
            // owner's bill strikes it through beside sellPrice.
            websiteListPrice: WEBSITE_PRICE,
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
        await requireAdmin(ctx);
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');
        if (submission.giveawayApplication && args.status === 'rejected') {
            throw new Error('Reject giveaway applications through the admin review action so the owner receives the reason.');
        }
        if (submission.giveawayApplication && !isComped(submission) &&
            (args.status === 'paid' || args.status === 'completed' || args.status === 'pending_payment')) {
            throw new Error('Giveaway websites must be given away rather than marked paid.');
        }
        if (args.status !== 'rejected') await assertGiveawayCanActivate(ctx, submission);
        await ctx.db.patch(args.id, { status: args.status });
    },
});

/**
 * Mark a submission's website as taken offline.
 *
 * Separate from updateStatus because `unpublishedAt` has to move with the
 * status — the admin queue and the payment-chase emails both read it to say
 * *when* a site went dark. The non-payment cron sets the same pair
 * (convex/unpublish.ts), so a manual takedown and an automatic one are
 * indistinguishable downstream, which is the point.
 */
export const setUnpublished = mutation({
    args: { id: v.id('submissions') },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');
        await assertGiveawayCanActivate(ctx, submission);
        await ctx.db.patch(args.id, {
            status: 'unpublished',
            unpublishedAt: Date.now(),
        });
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
        await requireCreatorAccount(ctx, submission.creatorId);

        // Idempotency. Without this a double-tap on the review page re-inserts
        // the lead, double-fires both analytics increments, and re-triggers the
        // Studio render. Applies to every submission, not just prospect ones.
        if (submission.status !== 'draft') return;

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

        // 2. Link the interview to its source prospect, or create a fresh lead.
        //
        // When this interview started from a scraped Outscraper prospect we
        // PATCH that existing row instead of inserting a second one. That's the
        // whole point: one row per physical business. It also brings two
        // already-written but permanently dead guards to life for the first
        // time — claimProspect's "already been interviewed" check and the
        // stale-claim cron's `submissionId === undefined` filter, which is what
        // currently launders an interviewed prospect back into the pool at 24h.
        let converted = false;
        if (submission.prospectLeadId) {
            const prospect = await ctx.db.get(submission.prospectLeadId);
            if (prospect && prospect.source === 'outscraper') {
                if (!prospect.submissionId) {
                    await ctx.db.patch(prospect._id, {
                        submissionId: args.id,
                        // Credit the interviewer, not the scraper. outscraper.ts
                        // always stamps the SCRAPER's creatorId on scraped rows,
                        // so a `??` fallback would never fire and the business
                        // would show under whoever ran the scrape.
                        creatorId: submission.creatorId,
                        status: 'converted',
                        name: submission.ownerName,
                        email: submission.ownerEmail,
                        // phone deliberately left as the scraped listing number;
                        // the owner's direct number is exposed separately as
                        // ownerPhone through the submission join.
                        claimedByCreatorId: undefined,
                        claimedAt: undefined,
                    });
                    converted = true;
                } else if (String(prospect.submissionId) === String(args.id)) {
                    converted = true; // idempotent replay
                }
                // else: someone else converted it first. Fall through and create
                // a normal lead — never destroy an interview already completed.
            }
        }
        if (!converted) {
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
        }

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

        // 4. Trigger Tendso Studio (Hyperagent) render — replaces the Airtable AI step.
        // airtable.ts stays wired as the rollback (revert this one line to restore it).
        await ctx.scheduler.runAfter(0, internal.hyperagent.triggerStudioRender, {
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
        await requireAdmin(ctx);
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');
        await assertGiveawayCanActivate(ctx, submission);
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
        await requireAdmin(ctx);
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');
        if (submission.giveawayApplication) {
            throw new Error('Giveaway websites must be given away rather than marked paid.');
        }
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
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');
        await requireAccountOwner(ctx, submission.creatorId);
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
        await requireAdmin(ctx);
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');

        if (submission.giveawayApplication && !isComped(submission)) {
            throw new Error('Give the giveaway website away before completing its payout.');
        }
        // Update submission
        await assertGiveawayCanActivate(ctx, submission);
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
        await requireSubmissionEditor(ctx, submission.creatorId);

        if (submission.status !== 'draft') {
            throw new Error('Can only delete draft submissions');
        }

        await ctx.db.delete(args.id);
    },
});

// ==================== TRANSCRIPTION INTERNALS ====================

/** Existing server transcription bridge, limited to transcript bookkeeping. */
export const recordTranscriptionFromServer = mutation({
    args: {
        id: v.id('submissions'),
        internalSecret: v.string(),
        transcriptionStatus: v.union(v.literal('processing'), v.literal('complete'), v.literal('failed')),
        transcript: v.optional(v.string()),
        transcriptionUpdatedAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const expectedSecret = process.env.INTERNAL_API_SECRET;
        if (!expectedSecret || args.internalSecret !== expectedSecret) throw new Error('Forbidden: internal access required');
        const submission = await ctx.db.get(args.id);
        if (!submission) throw new Error('Submission not found');
        await ctx.db.patch(args.id, {
            transcriptionStatus: args.transcriptionStatus,
            ...(args.transcript !== undefined ? { transcript: args.transcript } : {}),
            ...(args.transcriptionUpdatedAt !== undefined ? { transcriptionUpdatedAt: args.transcriptionUpdatedAt } : {}),
        });
    },
});
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

/**
 * Fail a transcription still "processing" long after it started. The action
 * that ran it was killed (out of memory, or past its time limit) before it could
 * record the failure, and the creator would otherwise wait for good. Scheduled
 * by transcription.transcribeMedia as it starts.
 */
export const failStalledTranscription = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        startedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission || submission.transcriptionStatus !== 'processing') return;
        // Finished or failed since then, and processing again: a later attempt.
        if ((submission.transcriptionUpdatedAt ?? 0) > args.startedAt) return;
        await ctx.db.patch(args.submissionId, {
            transcriptionStatus: 'failed',
            transcriptionError: 'Transcription stopped before it finished.',
            transcriptionUpdatedAt: Date.now(),
        });
    },
});

/**
 * The old home of interview transcription, kept under its name for jobs already
 * scheduled when this deploys, and for the mobile parity list
 * (docs/changes/MOBILE-FUNCTION-PARITY.md). The work is
 * transcription.transcribeMedia, a Node action: this runtime caps a function at
 * 64 MB of memory, and an interview video does not fit in that.
 */
export const transcribeMedia = internalAction({
    args: {
        submissionId: v.id('submissions'),
        storageId: v.optional(v.string()),
        mediaType: v.optional(v.union(v.literal('video'), v.literal('audio'))),
    },
    handler: async (ctx, args) => {
        await ctx.scheduler.runAfter(0, internal.transcription.transcribeMedia, args);
    },
});
