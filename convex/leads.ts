import { v } from 'convex/values';
import { query, mutation, action, internalQuery, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { normalizePhone } from './lib/phone';

// Admin-curated lead-content image upload constraints
const PREVIEW_IMAGE_MAX_BYTES = 2_000_000; // 2MB cap
const ALLOWED_PREVIEW_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ==================== MUTATIONS ====================

/**
 * Create a new lead
 */
export const create = mutation({
    args: {
        submissionId: v.optional(v.id('submissions')),
        creatorId: v.optional(v.id('creators')),
        source: v.union(v.literal('website'), v.literal('qr_code'), v.literal('direct')),
        name: v.string(),
        phone: v.string(),
        email: v.optional(v.string()),
        message: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const leadId = await ctx.db.insert('leads', {
            submissionId: args.submissionId,
            creatorId: args.creatorId,
            source: args.source,
            name: args.name,
            phone: args.phone,
            email: args.email,
            message: args.message,
            status: 'new',
            createdAt: Date.now(),
        });

        // Analytics + notification only if linked to a creator
        if (args.creatorId) {
            const today = new Date().toISOString().split('T')[0];
            const month = today.substring(0, 7);

            await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
                creatorId: args.creatorId,
                period: today,
                periodType: 'daily',
                field: 'leadsGenerated',
                delta: 1,
            });
            await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
                creatorId: args.creatorId,
                period: month,
                periodType: 'monthly',
                field: 'leadsGenerated',
                delta: 1,
            });

            // Send notification to creator
            const submission = args.submissionId ? await ctx.db.get(args.submissionId) : null;
            await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
                creatorId: args.creatorId,
                type: 'new_lead',
                title: 'New Lead!',
                body: `${args.name} inquired about ${submission?.businessName ?? 'your business'}`,
                data: { submissionId: args.submissionId, leadId },
            });
        }

        return leadId;
    },
});

/**
 * Update lead status through the pipeline
 */
export const updateStatus = mutation({
    args: {
        id: v.id('leads'),
        status: v.union(
            v.literal('new'),
            v.literal('contacted'),
            v.literal('qualified'),
            v.literal('converted'),
            v.literal('lost')
        ),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { status: args.status });
    },
});

/**
 * Update a lead's details (name, phone, email, message, status)
 */
export const update = mutation({
    args: {
        id: v.id('leads'),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        message: v.optional(v.string()),
        status: v.optional(v.union(
            v.literal('new'),
            v.literal('contacted'),
            v.literal('qualified'),
            v.literal('converted'),
            v.literal('lost')
        )),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args
        // Remove undefined fields so we don't overwrite with undefined
        const patch: Record<string, any> = {}
        if (updates.name !== undefined) patch.name = updates.name
        if (updates.phone !== undefined) patch.phone = updates.phone
        if (updates.email !== undefined) patch.email = updates.email
        if (updates.message !== undefined) patch.message = updates.message
        if (updates.status !== undefined) patch.status = updates.status
        if (Object.keys(patch).length > 0) {
            await ctx.db.patch(id, patch)
        }
    },
})

/**
 * Delete a lead and its notes
 */
export const remove = mutation({
    args: { id: v.id('leads') },
    handler: async (ctx, args) => {
        // Delete associated notes
        const notes = await ctx.db
            .query('leadNotes')
            .withIndex('by_lead', (q) => q.eq('leadId', args.id))
            .collect();

        for (const note of notes) {
            await ctx.db.delete(note._id);
        }

        await ctx.db.delete(args.id);
    },
});

// ==================== QUERIES ====================

/**
 * Get all leads for a business website
 */
export const getBySubmission = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('leads')
            .withIndex('by_submission', (q) => q.eq('submissionId', args.submissionId))
            .order('desc')
            .collect();
    },
});

/**
 * Get all leads in the system (admin)
 */
export const getAll = query({
    args: {},
    handler: async (ctx) => {
        const leads = await ctx.db.query('leads').order('desc').take(500)
        const enriched = await Promise.all(
            leads.map(async (lead) => {
                const submission = lead.submissionId ? await ctx.db.get(lead.submissionId) : null
                const creator = lead.creatorId ? await ctx.db.get(lead.creatorId) : null
                return {
                    ...lead,
                    businessName: submission?.businessName || 'Unlinked',
                    creatorName: creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() : 'N/A',
                }
            })
        )
        return enriched
    },
})

/**
 * Get all leads across all of a creator's businesses
 */
export const getByCreator = query({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('leads')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .order('desc')
            .collect();
    },
});

/**
 * Get leads by pipeline status
 */
export const getByStatus = query({
    args: {
        status: v.union(
            v.literal('new'),
            v.literal('contacted'),
            v.literal('qualified'),
            v.literal('converted'),
            v.literal('lost')
        ),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('leads')
            .withIndex('by_status', (q) => q.eq('status', args.status))
            .order('desc')
            .collect();
    },
});

/**
 * Get lead count breakdown by status for a submission
 */
export const getCountBySubmission = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const leads = await ctx.db
            .query('leads')
            .withIndex('by_submission', (q) => q.eq('submissionId', args.submissionId))
            .collect();

        return {
            total: leads.length,
            new: leads.filter((l) => l.status === 'new').length,
            contacted: leads.filter((l) => l.status === 'contacted').length,
            qualified: leads.filter((l) => l.status === 'qualified').length,
            converted: leads.filter((l) => l.status === 'converted').length,
            lost: leads.filter((l) => l.status === 'lost').length,
        };
    },
});

// ============================================================================
// Inline auth helpers — web repo doesn't have a shared `lib/auth.ts`, so we
// inline the same pattern the spec assumes (`requireAuth` / `requireAdmin`).
// Typed as `any` so the helper accepts both QueryCtx and MutationCtx — every
// Convex generated type uses different TableNamesInDataModel generics, and
// hand-writing a union is more friction than the type signal is worth here.
// ============================================================================
async function requireIdentity(ctx: any) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    return identity;
}

async function requireAdminIdentity(ctx: any) {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
        .query('creators')
        .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', identity.subject))
        .first();
    if (!me || me.role !== 'admin') throw new Error('Forbidden: admin access required');
    return identity;
}

// ----------------------------------------------------------------------------
// MOBILE CRM VIEW QUERIES (team-wide social feed)
//
// Per product spec: every signed-in creator sees ALL leads in the database
// (not just their own) and the original submitter is prominently surfaced on
// each card. Admin-curated content (description / image / link) appears when
// present and triggers the social-card render on mobile.
//
// These queries do NOT modify any existing data or behavior. They are
// consumed only by the mobile CRM screens at app/(app)/leads/*.
// ----------------------------------------------------------------------------

/**
 * Pure-function helper for rendering creator display names consistently.
 * Exported so unit tests can exercise it without spinning up Convex.
 * Format: "Firstname L." (e.g., "Maria S."). If only first name, returns it as-is.
 * If both missing, returns "Unknown creator".
 */
export function formatCreatorDisplayName(
    firstName: string | undefined | null,
    lastName: string | undefined | null,
): string {
    const first = (firstName ?? '').trim();
    const last = (lastName ?? '').trim();
    if (!first && !last) return 'Unknown creator';
    if (!last) return first;
    return `${first} ${last[0]}.`;
}

export const listForMobileCRM = query({
    args: {
        search: v.optional(v.string()),
        statusFilter: v.optional(
            v.union(
                v.literal('all'),
                v.literal('new'),
                v.literal('contacted'),
                v.literal('qualified'),
                v.literal('converted'),
                v.literal('lost'),
            ),
        ),
        onlyMine: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await requireIdentity(ctx);

        const currentCreator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!currentCreator) {
            return {
                leads: [],
                stats: { total: 0, new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0, mine: 0 },
            };
        }

        // Show ALL leads in the database so the CRM feed reflects team output.
        const allLeads = await ctx.db.query('leads').order('desc').collect();

        // Stat rollup over the unfiltered set so badge counts remain accurate.
        const stats = {
            total: allLeads.length,
            new: allLeads.filter((l) => l.status === 'new').length,
            contacted: allLeads.filter((l) => l.status === 'contacted').length,
            qualified: allLeads.filter((l) => l.status === 'qualified').length,
            converted: allLeads.filter((l) => l.status === 'converted').length,
            lost: allLeads.filter((l) => l.status === 'lost').length,
            mine: allLeads.filter((l) => String(l.creatorId) === String(currentCreator._id)).length,
        };

        let filtered = allLeads;
        if (args.onlyMine) {
            filtered = filtered.filter((l) => String(l.creatorId) === String(currentCreator._id));
        }

        const statusFilter = args.statusFilter ?? 'all';
        if (statusFilter !== 'all') {
            filtered = filtered.filter((l) => l.status === statusFilter);
        }

        const search = args.search?.trim().toLowerCase();

        // Cache submissions/creators to avoid repeated DB hits when the same id
        // appears across many leads.
        const submissionCache = new Map<string, any>();
        const creatorCache = new Map<string, any>();
        const allSubmissions = await ctx.db.query('submissions').collect();
        for (const sub of allSubmissions) submissionCache.set(String(sub._id), sub);

        const enriched = await Promise.all(
            filtered.map(async (lead) => {
                const submission = lead.submissionId
                    ? (submissionCache.get(String(lead.submissionId)) ?? null)
                    : null;

                let creatorRecord: any = null;
                if (lead.creatorId) {
                    creatorRecord = creatorCache.get(String(lead.creatorId));
                    if (!creatorRecord) {
                        creatorRecord = await ctx.db.get(lead.creatorId);
                        if (creatorRecord) creatorCache.set(String(lead.creatorId), creatorRecord);
                    }
                }

                // Count distinct creators who interviewed the same business by normalized phone.
                let interviewerCount = 0;
                if (submission) {
                    const targetPhone = normalizePhone(submission.ownerPhone);
                    if (targetPhone) {
                        const matches = allSubmissions.filter(
                            (s) => normalizePhone(s.ownerPhone) === targetPhone,
                        );
                        const creatorIds = new Set(matches.map((s) => String(s.creatorId)));
                        interviewerCount = creatorIds.size;
                    }
                }

                const isMine = lead.creatorId
                    ? String(lead.creatorId) === String(currentCreator._id)
                    : false;

                return {
                    _id: lead._id,
                    _creationTime: lead._creationTime,
                    name: lead.name,
                    phone: lead.phone,
                    email: lead.email ?? null,
                    source: lead.source,
                    status: lead.status,
                    createdAt: lead.createdAt,
                    // Per WEB-PROPECT-POOL.md §"Field-test fixes 2026-06-04" Fix #1:
                    // when there's no submission linked, fall back to the lead
                    // row's own business fields (populated by Outscraper-source
                    // leads + by markConverted from a reserved prospect).
                    businessName:
                        submission?.businessName ??
                        lead.businessName ??
                        '(business unavailable)',
                    businessType: submission?.businessType ?? lead.businessCategory ?? null,
                    businessCity: submission?.city ?? lead.businessCity ?? null,
                    businessAddress: submission?.address ?? lead.businessAddress ?? null,
                    // Per WEB-PROPECT-POOL.md §"Field-test fixes 2026-06-04" Fix #4:
                    // expose coords + place_id so the card UI can render a
                    // "Show direction" fallback CTA for phoneless leads.
                    // These already exist on the leads table schema — the
                    // query just wasn't returning them.
                    businessLatitude: lead.businessLatitude ?? null,
                    businessLongitude: lead.businessLongitude ?? null,
                    businessGooglePlaceId: lead.businessGooglePlaceId ?? null,
                    ownerName: submission?.ownerName ?? null,
                    ownerPhone: submission?.ownerPhone ?? null,
                    interviewerCount,
                    websiteUrl: (submission as any)?.websiteUrl ?? null,
                    submissionStatus: submission?.status ?? null,
                    isHot: interviewerCount >= 3,
                    submittedBy: creatorRecord
                        ? {
                              creatorId: String(creatorRecord._id),
                              displayName: formatCreatorDisplayName(
                                  creatorRecord.firstName,
                                  creatorRecord.lastName,
                              ),
                              profileImage: creatorRecord.profileImage ?? null,
                          }
                        : null,
                    isMine,
                    // Admin-curated content (mobile renders social card when present)
                    adminDescription: (lead as any).adminDescription ?? null,
                    previewImageUrl: (lead as any).previewImageUrl ?? null,
                    externalPreviewUrl: (lead as any).externalPreviewUrl ?? null,
                    hasEnrichedContent: !!(
                        (lead as any).adminDescription ||
                        (lead as any).previewImageUrl ||
                        (lead as any).externalPreviewUrl
                    ),
                };
            }),
        );

        let result = enriched;
        if (search) {
            // name + phone became optional when Outscraper leads landed;
            // guard the .toLowerCase() calls so a prospect lead without a
            // customer name doesn't crash the search filter.
            result = enriched.filter(
                (row) =>
                    (row.name?.toLowerCase().includes(search) ?? false) ||
                    (row.phone?.toLowerCase().includes(search) ?? false) ||
                    (row.email?.toLowerCase().includes(search) ?? false) ||
                    row.businessName.toLowerCase().includes(search) ||
                    (row.submittedBy?.displayName.toLowerCase().includes(search) ?? false),
            );
        }

        return { leads: result, stats };
    },
});

/**
 * Minimal coordinates feed used by the creator-side "Businesses near me" map
 * view. Returns every lead that has resolvable lat/lng — either from a linked
 * submission (`submission.coordinates`) or from an Outscraper prospect
 * (`businessLatitude`/`businessLongitude`). Auth is the same as
 * listForMobileCRM (any signed-in identity).
 *
 * Kept additive and read-only on purpose — mobile callers don't see this
 * query and the existing CRM queries aren't touched.
 */
export const listForMap = query({
    args: {},
    handler: async (ctx) => {
        await requireIdentity(ctx);

        const allLeads = await ctx.db.query('leads').order('desc').collect();

        // Cache submissions/creators so we don't re-fetch per row.
        const allSubmissions = await ctx.db.query('submissions').collect();
        const submissionCache = new Map<string, any>();
        for (const sub of allSubmissions) submissionCache.set(String(sub._id), sub);
        const creatorCache = new Map<string, any>();

        // Build a submissionId → publishedUrl lookup from the generatedWebsites
        // table. The canonical "live URL" lives on submission.websiteUrl, but
        // when the auto-backfill hasn't run yet (or got cleared by unpublish),
        // submission.websiteUrl is null even though generatedWebsites.publishedUrl
        // is populated. The admin code at convex/admin.ts:354-361 does the
        // same fallback resolution — we mirror it here so Map A actually pins
        // leads whose websites are live but whose submission rows haven't
        // been backfilled.
        const allWebsites = await ctx.db.query('generatedWebsites').collect();
        const publishedUrlBySubmission = new Map<string, string>();
        for (const w of allWebsites) {
            const url = (w as any).publishedUrl;
            if (url && w.submissionId) {
                publishedUrlBySubmission.set(String(w.submissionId), url);
            }
        }

        const result: Array<{
            _id: any;
            businessName: string;
            businessAddress: string | null;
            businessCity: string | null;
            // lat/lng may be null when the lead has only an address (not yet
            // geocoded). Client geocodes via the Google Maps API and renders
            // the pin once coords arrive.
            lat: number | null;
            lng: number | null;
            status: string;
            source: string;
            hasSubmission: boolean;
            websiteUrl: string | null;
            hasLiveWebsite: boolean;
            submissionId: string | null;
            submittedBy: {
                creatorId: string;
                displayName: string;
                profileImage: string | null;
            } | null;
        }> = [];

        for (const lead of allLeads) {
            const sub = lead.submissionId
                ? submissionCache.get(String(lead.submissionId))
                : null;

            // Resolve coords from submission first, then Outscraper fields.
            let lat: number | null = null;
            let lng: number | null = null;
            if (sub?.coordinates?.lat != null && sub?.coordinates?.lng != null) {
                lat = sub.coordinates.lat;
                lng = sub.coordinates.lng;
            } else if (lead.businessLatitude != null && lead.businessLongitude != null) {
                lat = lead.businessLatitude;
                lng = lead.businessLongitude;
            }

            // Resolve a display address (used for client-side geocoding when
            // no coords are available).
            const businessAddressForResolve =
                sub?.address ?? lead.businessAddress ?? null;

            // Only drop leads that have NEITHER coords NOR an address —
            // those are genuinely unmappable. Anything with an address can
            // be geocoded on the client.
            if (lat == null && lng == null && !businessAddressForResolve) continue;

            // Pick a display name; fall back through known fields.
            const businessName =
                sub?.businessName ?? lead.businessName ?? '(unnamed business)';
            const businessAddress = sub?.address ?? lead.businessAddress ?? null;
            const businessCity = sub?.city ?? lead.businessCity ?? null;

            let submittedBy: {
                creatorId: string;
                displayName: string;
                profileImage: string | null;
            } | null = null;
            if (lead.creatorId) {
                let c = creatorCache.get(String(lead.creatorId));
                if (!c) {
                    c = await ctx.db.get(lead.creatorId);
                    if (c) creatorCache.set(String(lead.creatorId), c);
                }
                if (c) {
                    submittedBy = {
                        creatorId: String(c._id),
                        displayName: formatCreatorDisplayName(c.firstName, c.lastName),
                        profileImage: c.profileImage ?? null,
                    };
                }
            }

            // Same fallback chain admin.ts:354-361 uses to resolve a live URL:
            // submission.websiteUrl → generatedWebsites.publishedUrl.
            const websiteUrl =
                (sub as any)?.websiteUrl ??
                (lead.submissionId
                    ? publishedUrlBySubmission.get(String(lead.submissionId)) ?? null
                    : null);
            result.push({
                _id: lead._id,
                businessName,
                businessAddress,
                businessCity,
                lat,
                lng,
                status: lead.status,
                source: lead.source,
                hasSubmission: !!sub,
                websiteUrl,
                hasLiveWebsite: !!websiteUrl,
                submissionId: sub ? String(sub._id) : null,
                submittedBy,
            });
        }

        return result;
    },
});

export const getDetailForMobileCRM = query({
    args: { id: v.id('leads') },
    handler: async (ctx, args) => {
        const identity = await requireIdentity(ctx);

        const currentCreator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!currentCreator) return null;

        const lead = await ctx.db.get(args.id);
        if (!lead) return null;

        const submitterCreator = lead.creatorId ? await ctx.db.get(lead.creatorId) : null;
        const submission = lead.submissionId ? await ctx.db.get(lead.submissionId) : null;

        let interviewers: Array<{
            creatorId: string;
            creatorName: string;
            creatorProfileImage: string | null;
            interviewedAt: number;
            submissionId: string;
            submissionStatus: string;
            isMine: boolean;
        }> = [];

        if (submission) {
            const targetPhone = normalizePhone(submission.ownerPhone);
            if (targetPhone) {
                const allSubs = await ctx.db.query('submissions').collect();
                const matches = allSubs.filter(
                    (s) => normalizePhone(s.ownerPhone) === targetPhone,
                );
                interviewers = await Promise.all(
                    matches.map(async (s) => {
                        const interviewerCreator = await ctx.db.get(s.creatorId);
                        return {
                            creatorId: String(s.creatorId),
                            creatorName: formatCreatorDisplayName(
                                interviewerCreator?.firstName,
                                interviewerCreator?.lastName,
                            ),
                            creatorProfileImage: interviewerCreator?.profileImage ?? null,
                            interviewedAt: s._creationTime,
                            submissionId: String(s._id),
                            submissionStatus: s.status,
                            isMine: String(s.creatorId) === String(currentCreator._id),
                        };
                    }),
                );
                interviewers.sort((a, b) => b.interviewedAt - a.interviewedAt);
            }
        }

        const notes = await ctx.db
            .query('leadNotes')
            .withIndex('by_lead', (q) => q.eq('leadId', args.id))
            .order('desc')
            .collect();

        return {
            lead: {
                _id: lead._id,
                _creationTime: lead._creationTime,
                name: lead.name,
                phone: lead.phone,
                email: lead.email ?? null,
                source: lead.source,
                status: lead.status,
                createdAt: lead.createdAt,
            },
            submittedBy: submitterCreator
                ? {
                      creatorId: String(submitterCreator._id),
                      displayName: formatCreatorDisplayName(
                          submitterCreator.firstName,
                          submitterCreator.lastName,
                      ),
                      profileImage: submitterCreator.profileImage ?? null,
                  }
                : null,
            isMine: lead.creatorId
                ? String(lead.creatorId) === String(currentCreator._id)
                : false,
            business: submission
                ? {
                      submissionId: String(submission._id),
                      businessName: submission.businessName,
                      businessType: submission.businessType,
                      ownerName: submission.ownerName,
                      ownerPhone: submission.ownerPhone,
                      ownerEmail: submission.ownerEmail ?? null,
                      address: submission.address,
                      city: submission.city,
                      province: (submission as any).province ?? null,
                      barangay: (submission as any).barangay ?? null,
                      websiteUrl: (submission as any).websiteUrl ?? null,
                      businessDescription: (submission as any).businessDescription ?? null,
                      photos: (submission as any).photos ?? [],
                      status: submission.status,
                  }
                : null,
            adminContent: {
                description: (lead as any).adminDescription ?? null,
                previewImageUrl: (lead as any).previewImageUrl ?? null,
                externalPreviewUrl: (lead as any).externalPreviewUrl ?? null,
                updatedAt: (lead as any).adminUpdatedAt ?? null,
                hasEnrichedContent: !!(
                    (lead as any).adminDescription ||
                    (lead as any).previewImageUrl ||
                    (lead as any).externalPreviewUrl
                ),
            },
            interviewers,
            interviewerCount: interviewers.length,
            notes: notes.map((n) => ({
                _id: n._id,
                content: n.content,
                createdAt: n.createdAt,
                creatorId: String(n.creatorId),
            })),
        };
    },
});

// ----------------------------------------------------------------------------
// ADMIN-CURATED LEAD CONTENT (Facebook-style social card data + image upload)
// ----------------------------------------------------------------------------

export const updateAdminContent = mutation({
    args: {
        id: v.id('leads'),
        description: v.optional(v.string()),
        externalPreviewUrl: v.optional(v.string()),
        previewImageUrl: v.optional(v.string()),
        previewImageStorageKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await requireAdminIdentity(ctx);
        const lead = await ctx.db.get(args.id);
        if (!lead) throw new Error('Lead not found');

        const patch: Record<string, unknown> = {
            adminUpdatedAt: Date.now(),
            adminUpdatedBy: identity.subject,
        };

        if (args.description !== undefined) {
            const trimmed = args.description.trim();
            if (trimmed.length > 500) {
                throw new Error('Description too long (max 500 characters)');
            }
            patch.adminDescription = trimmed === '' ? undefined : trimmed;
        }

        if (args.externalPreviewUrl !== undefined) {
            const trimmed = args.externalPreviewUrl.trim();
            if (trimmed && !/^https?:\/\//i.test(trimmed)) {
                throw new Error('External preview URL must start with http:// or https://');
            }
            patch.externalPreviewUrl = trimmed === '' ? undefined : trimmed;
        }

        if (args.previewImageUrl !== undefined) {
            patch.previewImageUrl = args.previewImageUrl === '' ? undefined : args.previewImageUrl;
        }

        if (args.previewImageStorageKey !== undefined) {
            patch.previewImageStorageKey =
                args.previewImageStorageKey === '' ? undefined : args.previewImageStorageKey;
        }

        await ctx.db.patch(args.id, patch);
    },
});

// Pure helpers — exported so unit tests can exercise them without Convex.
export function validatePreviewImageUploadArgs(args: {
    mimeType: string;
    sizeBytes: number;
}): { ok: true } | { ok: false; reason: string } {
    if (!ALLOWED_PREVIEW_IMAGE_TYPES.includes(args.mimeType)) {
        return {
            ok: false,
            reason: `Unsupported image type ${args.mimeType}. Allowed: ${ALLOWED_PREVIEW_IMAGE_TYPES.join(', ')}`,
        };
    }
    if (args.sizeBytes <= 0) return { ok: false, reason: 'Image size must be positive' };
    if (args.sizeBytes > PREVIEW_IMAGE_MAX_BYTES) {
        return {
            ok: false,
            reason: `Image too large (${args.sizeBytes} bytes > ${PREVIEW_IMAGE_MAX_BYTES} byte limit)`,
        };
    }
    return { ok: true };
}

export function buildPreviewImageStorageKey(
    leadId: string,
    mimeType: string,
    now: number,
): string {
    const ext = mimeType.split('/')[1] ?? 'bin';
    return `lead-previews/${leadId}/${now}.${ext}`;
}

export const generatePreviewImageUploadUrl = action({
    args: {
        leadId: v.id('leads'),
        mimeType: v.string(),
        sizeBytes: v.number(),
    },
    handler: async (ctx, args): Promise<{ uploadUrl: string; publicUrl: string; storageKey: string }> => {
        // Action-context auth: query the admin role via internal query is overkill,
        // so we resolve the calling identity + look it up directly.
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const me = await ctx.runQuery(internal.leads.getCreatorRoleByClerkIdInternal, {
            clerkId: identity.subject,
        });
        if (!me || me.role !== 'admin') throw new Error('Forbidden: admin access required');

        const validation = validatePreviewImageUploadArgs({
            mimeType: args.mimeType,
            sizeBytes: args.sizeBytes,
        });
        if (!validation.ok) throw new Error(validation.reason);

        const accountId = process.env.R2_ACCOUNT_ID;
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const bucketName = process.env.R2_BUCKET_NAME;
        const publicBase = process.env.R2_PUBLIC_URL;
        if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
            throw new Error('R2 credentials not configured on this Convex deployment');
        }
        if (!publicBase) throw new Error('R2_PUBLIC_URL is not configured on this Convex deployment');

        const storageKey = buildPreviewImageStorageKey(args.leadId, args.mimeType, Date.now());

        const client = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
        });
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: storageKey,
            ContentType: args.mimeType,
        });
        const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
        const publicUrl = `${publicBase.replace(/\/$/, '')}/${storageKey}`;
        return { uploadUrl, publicUrl, storageKey };
    },
});

// Internal helper used by the action above (actions can't read the DB directly).
export const getCreatorRoleByClerkIdInternal = internalQuery({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        const me = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
            .first();
        return me ? { role: me.role ?? null } : null;
    },
});

export const getDetailForAdmin = query({
    args: { id: v.id('leads') },
    handler: async (ctx, args) => {
        await requireAdminIdentity(ctx);
        const lead = await ctx.db.get(args.id);
        if (!lead) return null;
        const submission = lead.submissionId ? await ctx.db.get(lead.submissionId) : null;
        const creator = lead.creatorId ? await ctx.db.get(lead.creatorId) : null;
        return {
            lead,
            submission,
            creator: creator
                ? {
                      _id: creator._id,
                      firstName: creator.firstName ?? null,
                      lastName: creator.lastName ?? null,
                      email: creator.email,
                      profileImage: creator.profileImage ?? null,
                  }
                : null,
        };
    },
});


// ============================================================================
// SERVER-SIDE GEOCODING
//
// Many submissions have an `address` but no `coordinates`. Without coordinates,
// the live-business map can't pin them. We solve this with a Convex action
// that calls Google's Geocoding REST API server-side, then patches
// `submission.coordinates` so the result is cached forever — listForMap
// surfaces the coords on the next reactive re-fetch and the pin shows up.
//
// Env var required: GOOGLE_MAPS_GEOCODING_API_KEY (set via `npx convex env set`).
// The mobile / web Maps API key can be reused — the only requirement is that
// the key has the Geocoding API enabled in the GCP project.
// ============================================================================

/**
 * Internal — patch a submission with resolved lat/lng.
 */
export const _patchSubmissionCoordinates = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        lat: v.number(),
        lng: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.submissionId, {
            coordinates: { lat: args.lat, lng: args.lng },
        });
    },
});

/**
 * Geocode every submission that has an address but no coordinates. Calls
 * Google's Geocoding REST API server-side, then persists the result to
 * `submission.coordinates` so the next listForMap call surfaces it.
 *
 * Returns a summary { scanned, geocoded, skipped, failed } so the caller
 * can show a progress badge.
 *
 * The action is auth-gated — any signed-in user can trigger it. The work
 * is idempotent (already-geocoded submissions are skipped) so calling
 * repeatedly is safe.
 */
export const geocodePendingSubmissions = action({
    args: { limit: v.optional(v.number()) },
    handler: async (
        ctx,
        args,
    ): Promise<{
        scanned: number;
        geocoded: number;
        skipped: number;
        failed: number;
    }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');

        // Fetch pending submissions (address but no coordinates) via an
        // internal query. We cap at `limit` to keep each invocation bounded.
        const pending = (await ctx.runQuery(
            internal.leads._listSubmissionsPendingGeocode,
            { limit: args.limit ?? 25 },
        )) as Array<{
            _id: any;
            address: string;
            city: string | null;
            province: string | null;
        }>;

        let geocoded = 0;
        let skipped = 0;
        let failed = 0;

        for (const sub of pending) {
            const queryParts = [sub.address, sub.city, sub.province, 'Philippines']
                .filter(Boolean)
                .join(', ');
            if (!queryParts) {
                skipped++;
                continue;
            }

            // OpenStreetMap Nominatim — free, no API key, no billing setup.
            // Slower than Google (1 req/sec rate limit) and less accurate
            // for informal PH addresses, but it doesn't require any GCP
            // configuration and works out of the box.
            let coords: { lat: number; lng: number } | null = null;
            try {
                const url = new URL('https://nominatim.openstreetmap.org/search');
                url.searchParams.set('q', queryParts);
                url.searchParams.set('format', 'json');
                url.searchParams.set('countrycodes', 'ph');
                url.searchParams.set('limit', '1');

                const res = await fetch(url.toString(), {
                    headers: {
                        // Nominatim ToS requires a User-Agent that
                        // identifies the application.
                        'User-Agent': 'NegosyoDigital/1.0 (frmwrkd.media@gmail.com)',
                        Accept: 'application/json',
                    },
                });
                if (res.ok) {
                    const payload: any = await res.json();
                    if (Array.isArray(payload) && payload[0]) {
                        const lat = parseFloat(payload[0].lat);
                        const lng = parseFloat(payload[0].lon);
                        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                            coords = { lat, lng };
                        }
                    } else {
                        console.warn(
                            `[geocode] Nominatim zero results for "${queryParts}"`,
                        );
                    }
                } else {
                    console.warn(`[geocode] Nominatim HTTP ${res.status} for "${queryParts}"`);
                }
                // Polite delay — Nominatim asks for ≤1 req/sec.
                await new Promise((r) => setTimeout(r, 1100));
            } catch (err: any) {
                console.warn(
                    `[geocode] Nominatim threw for "${queryParts}": ${err?.message ?? err}`,
                );
            }

            if (coords) {
                await ctx.runMutation(internal.leads._patchSubmissionCoordinates, {
                    submissionId: sub._id,
                    lat: coords.lat,
                    lng: coords.lng,
                });
                geocoded++;
            } else {
                failed++;
            }
        }

        return {
            scanned: pending.length,
            geocoded,
            skipped,
            failed,
        };
    },
});

/**
 * Internal — fetch submissions that have an address but no coordinates.
 * Used by the action above; not exposed publicly.
 */
export const _listSubmissionsPendingGeocode = internalQuery({
    args: { limit: v.number() },
    handler: async (ctx, args) => {
        const all = await ctx.db.query('submissions').collect();
        const pending = all
            .filter(
                (s: any) =>
                    typeof s.address === 'string' &&
                    s.address.trim().length > 0 &&
                    (!s.coordinates ||
                        s.coordinates.lat == null ||
                        s.coordinates.lng == null),
            )
            .slice(0, args.limit);
        return pending.map((s: any) => ({
            _id: s._id,
            address: s.address,
            city: s.city ?? null,
            province: s.province ?? null,
        }));
    },
});
