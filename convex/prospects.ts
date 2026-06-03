/**
 * Prospect Pool — public reads, reservation state machine, scrape ingest.
 *
 * Per docs/changes/WEB-PROPECT-POOL.md (revised 2026-06):
 *   - On-demand only: NO crons, NO scheduled jobs.
 *   - Reservation expiry is enforced via lazy filter in `searchNearby` +
 *     reclaim-on-reserve in `reserve` — replaces the cron-based release.
 *   - Scrape flow lives in convex/scrape.ts (async-batch with inline poll).
 *   - This file holds: 1 public read + 6 reservation mutations + read-side
 *     helpers + scrape_history recorders + the load-bearing
 *     `ingestScrapeResults` mutation (4-layer dedup + quality + inventory).
 */
import {
    query,
    mutation,
    internalQuery,
    internalMutation,
} from './_generated/server';
import { v } from 'convex/values';
import { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { requireAuth } from './lib/auth';
import {
    latLngToH3Cells,
    getNeighborCellsRes7,
} from './lib/h3';
import { normalizePhoneE164 } from './lib/phone';
import {
    computeQualityScore,
    normalizeBusinessName,
    bucketCategory,
} from './lib/quality';

const RESERVATION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h — spec default

// Shared shape: a "pool row visible to a caller as available." Used by
// both `searchNearby` and `searchNearbyInternal`. The lazy-expiry filter
// promotes state=reserved rows whose `reservationExpiresAt` is in the
// past back to the caller as if they were "available" — without writing
// state back. The next `reserve` call reclaims them properly.
type AvailableProspect = Doc<'prospects'>;

/**
 * Lazy-expiry predicate: true for rows the caller should see as available.
 *
 * Replaces the deprecated `releaseExpiredReservations` cron. State is NOT
 * mutated here — that's `reserve`'s job. We just surface expired-reserved
 * rows alongside genuinely-available ones in the result set.
 */
function isAvailableLazy(p: Doc<'prospects'>, now: number): boolean {
    if (p.state === 'available') return true;
    if (
        p.state === 'reserved' &&
        p.reservationExpiresAt != null &&
        p.reservationExpiresAt < now
    ) {
        return true;
    }
    return false;
}

/**
 * PRIMARY READ — called by mobile + web discover map.
 *
 * Computes the caller's H3 res-7 cell + k-ring of neighbors, queries
 * each cell's `prospects` index, applies the lazy-expiry filter so
 * stale reservations surface as available, sorts by `qualityScore`,
 * caps at `limit`. No Outscraper call — pure read.
 */
export const searchNearby = query({
    args: {
        lat: v.number(),
        lng: v.number(),
        radiusKm: v.optional(v.number()),
        categoryBucket: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);
        const limit = Math.min(args.limit ?? 50, 200);

        const ringSize = args.radiusKm && args.radiusKm > 5 ? 2 : 1;
        const { res7 } = latLngToH3Cells(args.lat, args.lng);
        const cells = getNeighborCellsRes7(res7, ringSize);
        const now = Date.now();

        const all: AvailableProspect[] = [];
        for (const cell of cells) {
            // We pull both `available` AND `reserved` rows (the latter so the
            // lazy filter can promote expired ones). The per-cell take cap
            // bounds work: cells.length * limit * 2 worst case.
            const cellResults = args.categoryBucket
                ? await ctx.db
                    .query('prospects')
                    .withIndex('by_h3_res7_and_category', (q) =>
                        q.eq('h3CellRes7', cell).eq('categoryBucket', args.categoryBucket!),
                    )
                    .filter((q) =>
                        q.or(
                            q.eq(q.field('state'), 'available'),
                            q.eq(q.field('state'), 'reserved'),
                        ),
                    )
                    .take(limit * 2)
                : await ctx.db
                    .query('prospects')
                    .withIndex('by_h3_res7', (q) => q.eq('h3CellRes7', cell))
                    .filter((q) =>
                        q.or(
                            q.eq(q.field('state'), 'available'),
                            q.eq(q.field('state'), 'reserved'),
                        ),
                    )
                    .take(limit * 2);
            for (const row of cellResults) {
                if (isAvailableLazy(row, now)) all.push(row);
            }
        }

        all.sort((a, b) => b.qualityScore - a.qualityScore);
        return all.slice(0, limit);
    },
});

/**
 * Action-callable variant of searchNearby. Same logic; no requireAuth
 * (actions enforce their own auth before invoking). Used by the
 * pool-aware `outscraper.scrapeNearby` to check whether the pool can
 * serve the request before hitting Outscraper.
 */
export const searchNearbyInternal = internalQuery({
    args: {
        lat: v.number(),
        lng: v.number(),
        radiusKm: v.optional(v.number()),
        categoryBucket: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<AvailableProspect[]> => {
        const limit = Math.min(args.limit ?? 50, 400);
        const ringSize = args.radiusKm && args.radiusKm > 5 ? 2 : 1;
        const { res7 } = latLngToH3Cells(args.lat, args.lng);
        const cells = getNeighborCellsRes7(res7, ringSize);
        const now = Date.now();

        const all: AvailableProspect[] = [];
        for (const cell of cells) {
            const cellResults = args.categoryBucket
                ? await ctx.db
                    .query('prospects')
                    .withIndex('by_h3_res7_and_category', (q) =>
                        q.eq('h3CellRes7', cell).eq('categoryBucket', args.categoryBucket!),
                    )
                    .filter((q) =>
                        q.or(
                            q.eq(q.field('state'), 'available'),
                            q.eq(q.field('state'), 'reserved'),
                        ),
                    )
                    .take(limit * 2)
                : await ctx.db
                    .query('prospects')
                    .withIndex('by_h3_res7', (q) => q.eq('h3CellRes7', cell))
                    .filter((q) =>
                        q.or(
                            q.eq(q.field('state'), 'available'),
                            q.eq(q.field('state'), 'reserved'),
                        ),
                    )
                    .take(limit * 2);
            for (const row of cellResults) {
                if (isAvailableLazy(row, now)) all.push(row);
            }
        }
        all.sort((a, b) => b.qualityScore - a.qualityScore);
        return all.slice(0, limit);
    },
});

/**
 * Field-test fix #2 (2026-06-04) — list the calling creator's active
 * reservations, newest first. Powers the mobile "Reserved" filter chip
 * and the web equivalent on /creators/leads.
 *
 * Filters lazy-expired reservations (state=reserved, expiry past) — those
 * are claimable by anyone now and don't belong in this creator's view.
 * Uses the existing `by_reserved_creator` index — no new index needed.
 */
export const listMyReservations = query({
    args: {},
    handler: async (ctx) => {
        const identity = await requireAuth(ctx);
        const creator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!creator) return [];

        const now = Date.now();
        const all = await ctx.db
            .query('prospects')
            .withIndex('by_reserved_creator', (q) =>
                q.eq('reservedByCreatorId', creator._id),
            )
            .collect();

        const active = all.filter(
            (p) =>
                p.state === 'reserved' &&
                typeof p.reservationExpiresAt === 'number' &&
                p.reservationExpiresAt > now,
        );

        active.sort((a, b) => (b.reservedAt ?? 0) - (a.reservedAt ?? 0));
        return active;
    },
});

/**
 * Count available prospects in a single (cell, category, country) bucket.
 * Used by `outscraper.scrapeNearby` for a coarse pool-sufficiency check
 * (≥ 10 → skip Outscraper). Cheap — caps at 20 reads.
 */
export const countAvailableInCell = internalQuery({
    args: {
        h3CellRes7: v.string(),
        categoryBucket: v.string(),
    },
    handler: async (ctx, args): Promise<number> => {
        const now = Date.now();
        const rows = await ctx.db
            .query('prospects')
            .withIndex('by_h3_res7_and_category', (q) =>
                q.eq('h3CellRes7', args.h3CellRes7).eq('categoryBucket', args.categoryBucket),
            )
            .filter((q) =>
                q.or(
                    q.eq(q.field('state'), 'available'),
                    q.eq(q.field('state'), 'reserved'),
                ),
            )
            .take(50);
        let count = 0;
        for (const row of rows) if (isAvailableLazy(row, now)) count += 1;
        return count;
    },
});

/**
 * Internal lookup — dedup layer 2 (place_id is primary identity).
 * Used by ingestScrapeResults + the P1 backfill migration.
 */
export const getByPlaceId = internalQuery({
    args: { googlePlaceId: v.string() },
    handler: async (ctx, args): Promise<Doc<'prospects'> | null> => {
        const row = await ctx.db
            .query('prospects')
            .withIndex('by_place_id', (q) => q.eq('googlePlaceId', args.googlePlaceId))
            .first();
        return row;
    },
});

/**
 * Fetch the category_locales row for (country, categoryBucket).
 * Returns null if not seeded — caller decides whether to proceed with
 * defaults or abort.
 */
export const getLocaleConfig = internalQuery({
    args: {
        country: v.string(),
        categoryBucket: v.string(),
    },
    handler: async (ctx, args): Promise<Doc<'category_locales'> | null> => {
        return ctx.db
            .query('category_locales')
            .withIndex('by_country_and_bucket', (q) =>
                q.eq('country', args.country).eq('categoryBucket', args.categoryBucket),
            )
            .first();
    },
});

// ── Reservation mutations (P2) ────────────────────────────────────────

/**
 * Reserve a prospect for the calling creator.
 *
 * Allowed source states:
 *   - "available" → standard path
 *   - "reserved" with `reservationExpiresAt < now` → reclaim (replaces
 *     the deprecated `releaseExpiredReservations` cron)
 *
 * Rejects every other state with a clear error.
 *
 * Inventory: when reclaiming an expired reservation, no inventory delta
 * is recorded (the original reservation's `reserved` count stays put —
 * we're swapping owners, not moving buckets). When reserving a fresh
 * available row, we move 1 from `available` → `reserved`.
 */
export const reserve = mutation({
    args: { prospectId: v.id('prospects') },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const prospect = await ctx.db.get(args.prospectId);
        if (!prospect) throw new Error('Prospect not found');

        const now = Date.now();
        const isExpiredReserved =
            prospect.state === 'reserved' &&
            prospect.reservationExpiresAt != null &&
            prospect.reservationExpiresAt < now;

        if (prospect.state !== 'available' && !isExpiredReserved) {
            throw new Error(
                `Cannot reserve a prospect in state "${prospect.state}"`,
            );
        }

        const creator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!creator) throw new Error('Creator profile not found');

        await ctx.db.patch(args.prospectId, {
            state: 'reserved',
            stateUpdatedAt: now,
            reservedByCreatorId: creator._id,
            reservedAt: now,
            reservationExpiresAt: now + RESERVATION_DURATION_MS,
        });

        // Only adjust inventory on the fresh-available path. Reclaiming
        // an expired reservation is a no-op for counters (still 1
        // reserved, just with a new owner).
        if (!isExpiredReserved) {
            await ctx.runMutation(internal.prospects.adjustInventory, {
                h3CellRes7: prospect.h3CellRes7,
                categoryBucket: prospect.categoryBucket,
                country: prospect.country,
                from: 'available',
                to: 'reserved',
            });
        }

        return { prospectId: args.prospectId, reclaimed: isExpiredReserved };
    },
});

/**
 * Reserved → contacted. Only the reserving creator can advance state.
 * Clears `reservationExpiresAt` since contacts don't auto-expire (a
 * future P6 cron handles 7-day idle release; not in this revision).
 */
export const markContacted = mutation({
    args: { prospectId: v.id('prospects') },
    handler: async (ctx, args) => {
        const { prospect } = await assertOwnedByCaller(ctx, args.prospectId);
        if (prospect.state !== 'reserved') {
            throw new Error(
                `Cannot mark contacted from state "${prospect.state}"`,
            );
        }
        await ctx.db.patch(args.prospectId, {
            state: 'contacted',
            stateUpdatedAt: Date.now(),
            reservationExpiresAt: undefined,
        });
        await ctx.runMutation(internal.prospects.adjustInventory, {
            h3CellRes7: prospect.h3CellRes7,
            categoryBucket: prospect.categoryBucket,
            country: prospect.country,
            from: 'reserved',
            to: 'contacted',
        });
    },
});

/**
 * Contacted → qualified. Only the reserving creator can advance.
 */
export const markQualified = mutation({
    args: { prospectId: v.id('prospects') },
    handler: async (ctx, args) => {
        const { prospect } = await assertOwnedByCaller(ctx, args.prospectId);
        if (prospect.state !== 'contacted') {
            throw new Error(
                `Cannot mark qualified from state "${prospect.state}"`,
            );
        }
        await ctx.db.patch(args.prospectId, {
            state: 'qualified',
            stateUpdatedAt: Date.now(),
        });
        await ctx.runMutation(internal.prospects.adjustInventory, {
            h3CellRes7: prospect.h3CellRes7,
            categoryBucket: prospect.categoryBucket,
            country: prospect.country,
            from: 'contacted',
            to: 'qualified',
        });
    },
});

/**
 * Any non-terminal state → converted. Links the resulting submission
 * back to the prospect. Only the reserving creator can perform.
 */
export const markConverted = mutation({
    args: {
        prospectId: v.id('prospects'),
        submissionId: v.id('submissions'),
    },
    handler: async (ctx, args) => {
        const { prospect } = await assertOwnedByCaller(ctx, args.prospectId);
        if (prospect.state === 'converted' || prospect.state === 'lost') {
            throw new Error(
                `Cannot mark converted from terminal state "${prospect.state}"`,
            );
        }
        await ctx.db.patch(args.prospectId, {
            state: 'converted',
            stateUpdatedAt: Date.now(),
            submissionId: args.submissionId,
            reservationExpiresAt: undefined,
        });
        await ctx.runMutation(internal.prospects.adjustInventory, {
            h3CellRes7: prospect.h3CellRes7,
            categoryBucket: prospect.categoryBucket,
            country: prospect.country,
            from: prospect.state,
            to: 'converted',
        });
    },
});

/**
 * Any non-terminal state → lost. Reason is optional; if you want to
 * persist it, extend the schema with `lostReason` (not in this PR).
 */
export const markLost = mutation({
    args: {
        prospectId: v.id('prospects'),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { prospect } = await assertOwnedByCaller(ctx, args.prospectId);
        if (prospect.state === 'converted' || prospect.state === 'lost') {
            throw new Error(
                `Cannot mark lost from terminal state "${prospect.state}"`,
            );
        }
        await ctx.db.patch(args.prospectId, {
            state: 'lost',
            stateUpdatedAt: Date.now(),
            reservationExpiresAt: undefined,
        });
        await ctx.runMutation(internal.prospects.adjustInventory, {
            h3CellRes7: prospect.h3CellRes7,
            categoryBucket: prospect.categoryBucket,
            country: prospect.country,
            from: prospect.state,
            to: 'lost',
        });
    },
});

/**
 * Voluntary release: reserved → available, clears the creator + expiry.
 * Only the reserving creator can release their own claim.
 */
export const releaseReservation = mutation({
    args: { prospectId: v.id('prospects') },
    handler: async (ctx, args) => {
        const { prospect } = await assertOwnedByCaller(ctx, args.prospectId);
        if (prospect.state !== 'reserved') {
            throw new Error(
                `Cannot release a prospect in state "${prospect.state}"`,
            );
        }
        await ctx.db.patch(args.prospectId, {
            state: 'available',
            stateUpdatedAt: Date.now(),
            reservedByCreatorId: undefined,
            reservedAt: undefined,
            reservationExpiresAt: undefined,
        });
        await ctx.runMutation(internal.prospects.adjustInventory, {
            h3CellRes7: prospect.h3CellRes7,
            categoryBucket: prospect.categoryBucket,
            country: prospect.country,
            from: 'reserved',
            to: 'available',
        });
    },
});

/**
 * Shared guard for state-advance mutations. Loads the prospect, the
 * caller's creator row, and verifies the caller owns the reservation.
 * Mutations call this once at the top instead of duplicating the auth
 * + ownership check inline.
 */
async function assertOwnedByCaller(
    ctx: any,
    prospectId: Id<'prospects'>,
): Promise<{ prospect: Doc<'prospects'>; creator: Doc<'creators'> }> {
    const identity = await requireAuth(ctx);
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) throw new Error('Prospect not found');
    const creator = await ctx.db
        .query('creators')
        .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', identity.subject))
        .first();
    if (!creator) throw new Error('Creator profile not found');
    if (
        prospect.reservedByCreatorId &&
        prospect.reservedByCreatorId !== creator._id
    ) {
        throw new Error(
            'Only the reserving creator can advance this prospect.',
        );
    }
    return { prospect, creator };
}

// ── Scrape history recorders (audit trail) ────────────────────────────

/**
 * Insert a `scrape_history` row at job start with status="pending".
 */
export const recordScrapeStart = internalMutation({
    args: {
        jobId: v.string(),
        h3CellRes7: v.string(),
        h3CellRes8: v.optional(v.string()),
        categoryBucket: v.string(),
        country: v.string(),
        outscraperQuery: v.string(),
        outscraperCoordinates: v.string(),
        outscraperZoom: v.number(),
        outscraperLimit: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert('scrape_history', {
            jobId: args.jobId,
            h3CellRes7: args.h3CellRes7,
            h3CellRes8: args.h3CellRes8,
            categoryBucket: args.categoryBucket,
            country: args.country,
            outscraperQuery: args.outscraperQuery,
            outscraperCoordinates: args.outscraperCoordinates,
            outscraperZoom: args.outscraperZoom,
            outscraperLimit: args.outscraperLimit,
            status: 'pending',
            startedAt: Date.now(),
        });
    },
});

/**
 * Transition: pending → running, stamp Outscraper's async job ID.
 */
export const recordScrapeAsyncId = internalMutation({
    args: {
        jobId: v.string(),
        outscraperJobId: v.string(),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('scrape_history')
            .withIndex('by_job_id', (q) => q.eq('jobId', args.jobId))
            .first();
        if (!row) return;
        await ctx.db.patch(row._id, {
            status: 'running',
            outscraperJobId: args.outscraperJobId,
        });
    },
});

/**
 * Transition: running → completed. Stamps result counts + estimated cost
 * (raw Outscraper rate: ~$0.001 per business). Also touches the matching
 * `prospect_inventory.lastScrapedAt` so the next pool-sufficiency check
 * has fresh telemetry.
 */
export const recordScrapeComplete = internalMutation({
    args: {
        jobId: v.string(),
        rawResultCount: v.number(),
        insertedCount: v.number(),
        dedupedCount: v.optional(v.number()),
        hitLimitCap: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('scrape_history')
            .withIndex('by_job_id', (q) => q.eq('jobId', args.jobId))
            .first();
        if (!row) return;

        const estimatedCost = Math.round(args.rawResultCount * 0.001 * 100) / 100;
        await ctx.db.patch(row._id, {
            status: 'completed',
            rawResultCount: args.rawResultCount,
            insertedCount: args.insertedCount,
            dedupedCount: args.dedupedCount,
            hitLimitCap: args.hitLimitCap,
            estimatedCost,
            completedAt: Date.now(),
        });

        // Bump inventory.lastScrapedAt so cell stays "fresh" for the
        // pool-sufficiency heuristic.
        const inv = await ctx.db
            .query('prospect_inventory')
            .withIndex('by_h3_and_category', (q) =>
                q.eq('h3CellRes7', row.h3CellRes7).eq('categoryBucket', row.categoryBucket),
            )
            .first();
        if (inv) {
            await ctx.db.patch(inv._id, {
                lastScrapedAt: Date.now(),
                scrapesAttempted: inv.scrapesAttempted + 1,
                lastScrapeJobId: args.jobId,
                updatedAt: Date.now(),
            });
        }
    },
});

/**
 * Transition: any → failed. Logs the reason for debugging.
 */
export const recordScrapeFailed = internalMutation({
    args: {
        jobId: v.string(),
        errorMessage: v.string(),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('scrape_history')
            .withIndex('by_job_id', (q) => q.eq('jobId', args.jobId))
            .first();
        if (!row) return;
        await ctx.db.patch(row._id, {
            status: 'failed',
            errorMessage: args.errorMessage,
            completedAt: Date.now(),
        });
    },
});

// ── ingestScrapeResults — THE BIG ONE ─────────────────────────────────

/**
 * Ingest a batch of scraped businesses into the prospects pool.
 *
 * Dedup layers (in order):
 *   1. H3 cell coverage — implicit (the action only fires for cells that
 *      were under-stocked; we don't re-check here).
 *   2. Google place_id — the primary identity key. Existing row with
 *      same googlePlaceId is updated (lastRefreshedAt + quality) rather
 *      than duplicated.
 *   3. Normalized E.164 phone — when place_id is missing on the incoming
 *      record but phone matches an existing prospect, treat as same.
 *   4. Normalized business name within ~150m — last-resort fuzzy match.
 *
 * Quality scoring (lib/quality.ts) uses the category locale's weights
 * if seeded, else default weights.
 *
 * Inventory: for each NEW prospect, calls adjustInventory(from=available,
 * to=available) — a same-state pair that nets to +0 on the `from` side
 * and +1 on the `to` side, which is the right shape for fresh inserts.
 *
 * Returns the count of newly-inserted rows (not counting updates).
 */
export const ingestScrapeResults = internalMutation({
    args: {
        jobId: v.string(),
        businesses: v.array(v.any()),
        country: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db
            .query('scrape_history')
            .withIndex('by_job_id', (q) => q.eq('jobId', args.jobId))
            .first();
        const country = args.country ?? job?.country ?? 'PH';
        const fallbackCategoryBucket = job?.categoryBucket ?? 'other';

        // Cache scoring weights per (country, categoryBucket) — avoid
        // re-querying for every business.
        const localeCache = new Map<string, Doc<'category_locales'> | null>();
        const getLocale = async (
            categoryBucket: string,
        ): Promise<Doc<'category_locales'> | null> => {
            const key = `${country}:${categoryBucket}`;
            if (localeCache.has(key)) return localeCache.get(key)!;
            const row = await ctx.db
                .query('category_locales')
                .withIndex('by_country_and_bucket', (q) =>
                    q.eq('country', country).eq('categoryBucket', categoryBucket),
                )
                .first();
            localeCache.set(key, row);
            return row;
        };

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        // Per-batch in-memory dedup so two source rows with the same
        // place_id in the same payload don't both insert.
        const seenPlaceIds = new Set<string>();

        for (const raw of args.businesses) {
            const placeId: string | undefined =
                raw.placeId ??
                raw.place_id ??
                raw.google_id ??
                raw.businessGooglePlaceId ??
                undefined;
            const businessName: string | undefined =
                raw.businessName ?? raw.name ?? undefined;
            const lat: number | undefined =
                typeof raw.businessLatitude === 'number'
                    ? raw.businessLatitude
                    : typeof raw.latitude === 'number'
                        ? raw.latitude
                        : undefined;
            const lng: number | undefined =
                typeof raw.businessLongitude === 'number'
                    ? raw.businessLongitude
                    : typeof raw.longitude === 'number'
                        ? raw.longitude
                        : undefined;
            if (!businessName || lat == null || lng == null) {
                skipped += 1;
                continue;
            }

            // Layer 2 — place_id dedup (in-batch + against existing rows)
            let existing: Doc<'prospects'> | null = null;
            if (placeId) {
                if (seenPlaceIds.has(placeId)) {
                    skipped += 1;
                    continue;
                }
                seenPlaceIds.add(placeId);
                existing = await ctx.db
                    .query('prospects')
                    .withIndex('by_place_id', (q) => q.eq('googlePlaceId', placeId))
                    .first();
            }

            const phoneRaw: string | undefined =
                raw.businessPhone ?? raw.phone ?? undefined;
            const normalizedPhone = normalizePhoneE164(phoneRaw ?? null, 'PH');

            // Layer 3 — phone dedup when place_id missed
            if (!existing && normalizedPhone) {
                existing = await ctx.db
                    .query('prospects')
                    .withIndex('by_normalized_phone', (q) =>
                        q.eq('normalizedPhone', normalizedPhone),
                    )
                    .first();
            }

            const normalizedName = normalizeBusinessName(businessName);

            // Layer 4 — name + proximity dedup (last resort).
            // Bounded scan: we only check prospects in the same res-9
            // cell (~400m) with the same normalizedName. Convex doesn't
            // index normalizedName directly, so we filter post-pull.
            if (!existing) {
                const cells = latLngToH3Cells(lat, lng);
                const sameCellRows = await ctx.db
                    .query('prospects')
                    .withIndex('by_h3_res7', (q) => q.eq('h3CellRes7', cells.res7))
                    .filter((q) => q.eq(q.field('h3CellRes9'), cells.res9))
                    .take(20);
                for (const row of sameCellRows) {
                    if (row.normalizedName === normalizedName) {
                        existing = row;
                        break;
                    }
                }
            }

            const rawCategory: string =
                raw.businessCategory ??
                raw.category ??
                raw.type ??
                raw.subtypes ??
                '';
            const categoryBucket =
                bucketCategory(rawCategory) || fallbackCategoryBucket;
            const locale = await getLocale(categoryBucket);

            const website: string | undefined =
                raw.businessWebsite ?? raw.site ?? raw.website ?? undefined;
            const rating: number | null =
                typeof raw.businessRating === 'number'
                    ? raw.businessRating
                    : typeof raw.rating === 'number'
                        ? raw.rating
                        : null;
            const reviewCount: number | null =
                typeof raw.businessReviewCount === 'number'
                    ? raw.businessReviewCount
                    : typeof raw.reviews === 'number'
                        ? raw.reviews
                        : typeof raw.user_ratings_total === 'number'
                            ? raw.user_ratings_total
                            : null;

            const qualityScore = computeQualityScore(
                {
                    hasWebsite: !!website,
                    hasPhone: !!phoneRaw,
                    rating,
                    reviewCount,
                },
                locale?.scoringWeights,
            );

            const now = Date.now();

            if (existing) {
                // Refresh — bump lastRefreshedAt + recompute quality, keep
                // identity + state untouched.
                await ctx.db.patch(existing._id, {
                    lastRefreshedAt: now,
                    qualityScore,
                    rating: rating ?? existing.rating,
                    reviewCount: reviewCount ?? existing.reviewCount,
                    website: website ?? existing.website,
                    phone: phoneRaw ?? existing.phone,
                    normalizedPhone: normalizedPhone ?? existing.normalizedPhone,
                });
                updated += 1;
                continue;
            }

            // Fresh insert
            const cells = latLngToH3Cells(lat, lng);
            await ctx.db.insert('prospects', {
                googlePlaceId:
                    placeId ?? `synthetic:${normalizedName}:${lat},${lng}`,
                businessName,
                normalizedName,
                category: rawCategory,
                categoryBucket,
                address:
                    raw.businessAddress ?? raw.full_address ?? raw.address ?? undefined,
                phone: phoneRaw ?? undefined,
                normalizedPhone: normalizedPhone ?? undefined,
                website: website ?? undefined,
                latitude: lat,
                longitude: lng,
                city: raw.businessCity ?? raw.city ?? undefined,
                country,
                h3CellRes7: cells.res7,
                h3CellRes8: cells.res8,
                h3CellRes9: cells.res9,
                rating: rating ?? undefined,
                reviewCount: reviewCount ?? undefined,
                state: 'available',
                stateUpdatedAt: now,
                qualityScore,
                scrapedAt: now,
                lastRefreshedAt: now,
                scrapeJobId: args.jobId,
            });
            // Inventory bookkeeping — fresh available row.
            await ctx.runMutation(internal.prospects.adjustInventory, {
                h3CellRes7: cells.res7,
                categoryBucket,
                country,
                from: 'available',
                to: 'available',
            });
            inserted += 1;
        }

        console.log(
            `[ingestScrapeResults] jobId=${args.jobId} inserted=${inserted} updated=${updated} skipped=${skipped}`,
        );
        return { inserted, updated, skipped };
    },
});

// ── Inventory bookkeeping (unchanged from P1) ─────────────────────────

/**
 * Single source of truth for `prospect_inventory` counter updates.
 *
 * On first insert for a (cell, category): creates the inventory row,
 * seeded with the locale's `minAvailableThreshold` (falls back to 100).
 * On subsequent calls: atomically -1 from `<from>Count` (clamped at 0),
 * +1 to `<to>Count`. Same-state pairs (from === to) net to a fresh +1.
 */
export const adjustInventory = internalMutation({
    args: {
        h3CellRes7: v.string(),
        categoryBucket: v.string(),
        country: v.string(),
        from: v.union(
            v.literal('available'),
            v.literal('reserved'),
            v.literal('contacted'),
            v.literal('qualified'),
            v.literal('converted'),
            v.literal('lost'),
        ),
        to: v.union(
            v.literal('available'),
            v.literal('reserved'),
            v.literal('contacted'),
            v.literal('qualified'),
            v.literal('converted'),
            v.literal('lost'),
        ),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('prospect_inventory')
            .withIndex('by_h3_and_category', (q) =>
                q.eq('h3CellRes7', args.h3CellRes7).eq('categoryBucket', args.categoryBucket),
            )
            .first();

        const now = Date.now();

        if (!existing) {
            const locale = await ctx.db
                .query('category_locales')
                .withIndex('by_country_and_bucket', (q) =>
                    q.eq('country', args.country).eq('categoryBucket', args.categoryBucket),
                )
                .first();
            await ctx.db.insert('prospect_inventory', {
                h3CellRes7: args.h3CellRes7,
                categoryBucket: args.categoryBucket,
                country: args.country,
                availableCount: args.to === 'available' ? 1 : 0,
                reservedCount: args.to === 'reserved' ? 1 : 0,
                contactedCount: args.to === 'contacted' ? 1 : 0,
                qualifiedCount: args.to === 'qualified' ? 1 : 0,
                convertedCount: args.to === 'converted' ? 1 : 0,
                lostCount: args.to === 'lost' ? 1 : 0,
                scrapesAttempted: 0,
                minAvailableThreshold: locale?.minAvailableThreshold ?? 100,
                updatedAt: now,
            });
            return;
        }

        const fromKey = `${args.from}Count` as const;
        const toKey = `${args.to}Count` as const;
        const fromCount = (existing as any)[fromKey] as number;
        const toCount = (existing as any)[toKey] as number;

        const patch: Record<string, number> = {};
        patch[fromKey] = Math.max(0, fromCount - 1);
        patch[toKey] = toCount + 1;

        await ctx.db.patch(existing._id, {
            ...patch,
            updatedAt: now,
        });
    },
});
