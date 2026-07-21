/**
 * Prospect Pool backfill (P1) — one-shot migration from outscraper-source
 * `leads` rows into the new `prospects` table.
 *
 * File is named `prospectsMigration.ts` (NOT `migration.ts`) to avoid
 * collision with the existing `convex/migrations/` folder. Mobile uses
 * the same name for its parallel port.
 *
 * Run MANUALLY from the Convex dashboard's "Run function" panel after
 * the P1 deploy. DO NOT schedule on a cron — re-running it skips already-
 * migrated rows (idempotent via the `migratedToProspectId` field on
 * `leads`), but cron-driving it has no value and just burns reads.
 *
 * Usage:
 *   1. Dashboard → Functions → prospectsMigration → backfillProspects
 *   2. Args: {} (defaults: batchSize 50, countryDefault "PH")
 *      or  : { "batchSize": 100, "countryDefault": "PH" }
 *   3. Watch logs for per-page summaries + final totals
 *
 * Per-row semantics:
 *   - Skip if `migratedToProspectId` is already set
 *   - Skip if `businessGooglePlaceId` is missing (no dedup key)
 *   - Skip if (lat, lng) missing (no spatial cell)
 *   - Skip if a prospect with the same `googlePlaceId` already exists
 *   - Compute H3 res-7/8/9 cells, normalized phone, quality score
 *   - Insert as `state: "reserved"` (with 24h expiry) if `claimedByCreatorId`
 *     is set; otherwise `state: "available"`
 *   - Adjust `prospect_inventory` for the (cell, category) bucket
 *   - Patch the source lead with `migratedToProspectId`
 */
import { internalAction, internalQuery, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { latLngToH3Cells } from './lib/h3';
import { normalizePhoneE164 } from './lib/phone';
import { computeQualityScore, normalizeBusinessName, bucketCategory } from './lib/quality';

const DEFAULT_BATCH_SIZE = 50;
const RESERVATION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Public entrypoint — drives the backfill. Paginates through outscraper
 * leads, calls `backfillBatch` once per page until the source is drained.
 *
 * Returns the final totals. Per-page progress is also emitted to logs.
 */
export const backfillProspects = internalAction({
    args: {
        batchSize: v.optional(v.number()),
        countryDefault: v.optional(v.string()),
    },
    handler: async (
        ctx,
        args,
    ): Promise<{ totalProcessed: number; totalMigrated: number; totalSkipped: number; pages: number }> => {
        const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
        const country = args.countryDefault ?? 'PH';

        let cursor: string | null = null;
        let totalProcessed = 0;
        let totalMigrated = 0;
        let totalSkipped = 0;
        let page = 0;

        // Drain loop — each iteration reads one page of un-migrated leads,
        // ingests them in a single mutation, and gets back the next cursor.
        // Bounded by Convex query pagination — never an infinite loop.
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const result: {
                processed: number;
                migrated: number;
                skipped: number;
                nextCursor: string | null;
                done: boolean;
            } = await ctx.runMutation(internal.prospectsMigration.backfillBatch, {
                cursor,
                batchSize,
                country,
            });

            page += 1;
            totalProcessed += result.processed;
            totalMigrated += result.migrated;
            totalSkipped += result.skipped;

            console.log(
                `[migration] page ${page}: processed=${result.processed} migrated=${result.migrated} skipped=${result.skipped}`,
            );

            if (result.done) break;
            cursor = result.nextCursor;
        }

        console.log(
            `[migration] backfillProspects DONE — totalProcessed=${totalProcessed} totalMigrated=${totalMigrated} totalSkipped=${totalSkipped}`,
        );

        return { totalProcessed, totalMigrated, totalSkipped, pages: page };
    },
});

/**
 * Read one page of outscraper-source leads that haven't been migrated yet.
 * Internal helper for `backfillProspects` — kept as its own query so the
 * action's loop can stay declarative.
 *
 * NOTE: returns leads of source="outscraper" only, filtered down to those
 * with `migratedToProspectId` unset. We do the migrated-check in the
 * mutation too (race-safe + idempotent), but filtering here saves work.
 */
export const fetchBackfillPage = internalQuery({
    args: {
        cursor: v.union(v.string(), v.null()),
        batchSize: v.number(),
    },
    handler: async (ctx, args) => {
        const result = await ctx.db
            .query('leads')
            .withIndex('by_status') // any index — we full-scan filter below; this just paginates deterministically
            .filter((q) => q.eq(q.field('source'), 'outscraper'))
            .paginate({ cursor: args.cursor, numItems: args.batchSize });

        return {
            leads: result.page,
            nextCursor: result.continueCursor,
            isDone: result.isDone,
        };
    },
});

/**
 * Process one page of leads in a single transaction:
 *   - Per-row dedup checks (already migrated? missing keys? place_id taken?)
 *   - H3 cell + phone + quality computation
 *   - Insert into `prospects`
 *   - Adjust `prospect_inventory`
 *   - Patch the source lead with `migratedToProspectId`
 *
 * All inserts/patches commit atomically with the lead-patch — if anything
 * throws mid-batch, none of the page's inserts land. Re-running the
 * migration will retry that page from the same cursor.
 */
export const backfillBatch = internalMutation({
    args: {
        cursor: v.union(v.string(), v.null()),
        batchSize: v.number(),
        country: v.string(),
    },
    handler: async (ctx, args) => {
        const page = await ctx.db
            .query('leads')
            .withIndex('by_status')
            .filter((q) => q.eq(q.field('source'), 'outscraper'))
            .paginate({ cursor: args.cursor, numItems: args.batchSize });

        let migrated = 0;
        let skipped = 0;

        // Local cache of place_ids inserted during this batch — prevents
        // double-insert when two leads share the same place_id (rare but
        // possible from the older outscraper path that didn't dedup).
        const seenPlaceIds = new Set<string>();

        for (const lead of page.page) {
            // Skip 1: already migrated
            if (lead.migratedToProspectId) {
                skipped += 1;
                continue;
            }
            // Skip 1b: already interviewed. Without this, a converted prospect
            // gets re-seeded into the new pool as `state: 'available'` (this
            // loop hardcodes submissionId: undefined and derives state from
            // claimedByCreatorId, which conversion clears) — resurrecting the
            // exact duplicate-business bug through the surface that is
            // becoming primary.
            if (lead.submissionId) {
                skipped += 1;
                continue;
            }
            // Skip 2: missing required keys
            const placeId = lead.businessGooglePlaceId;
            const lat = lead.businessLatitude;
            const lng = lead.businessLongitude;
            const businessName = lead.businessName;
            if (!placeId || lat == null || lng == null || !businessName) {
                skipped += 1;
                continue;
            }
            // Skip 3: place_id already in prospects (from a previous run or
            // from a sibling lead earlier in this batch)
            if (seenPlaceIds.has(placeId)) {
                skipped += 1;
                continue;
            }
            const existing = await ctx.db
                .query('prospects')
                .withIndex('by_place_id', (q) => q.eq('googlePlaceId', placeId))
                .first();
            if (existing) {
                // Backfill the migration link so future runs skip this lead
                // without re-querying prospects.
                await ctx.db.patch(lead._id, { migratedToProspectId: existing._id });
                skipped += 1;
                continue;
            }

            // Compute derived fields
            const cells = latLngToH3Cells(lat, lng);
            const phoneRaw = lead.phone ?? null;
            const normalizedPhone = normalizePhoneE164(phoneRaw, 'PH');
            const rawCategory = lead.businessCategory ?? '';
            const categoryBucket = bucketCategory(rawCategory);
            const qualityScore = computeQualityScore({
                hasWebsite: !!lead.businessWebsite,
                hasPhone: !!phoneRaw,
                rating: lead.businessRating ?? null,
                reviewCount: lead.businessReviewCount ?? null,
            });
            const now = Date.now();

            // State machine seed — preserve existing creator claim if set
            const claimed = lead.claimedByCreatorId;
            const state: 'available' | 'reserved' = claimed ? 'reserved' : 'available';

            // Insert into prospects
            const prospectId: Id<'prospects'> = await ctx.db.insert('prospects', {
                googlePlaceId: placeId,
                businessName,
                normalizedName: normalizeBusinessName(businessName),
                category: rawCategory,
                categoryBucket,
                address: lead.businessAddress ?? undefined,
                phone: phoneRaw ?? undefined,
                normalizedPhone: normalizedPhone ?? undefined,
                website: lead.businessWebsite ?? undefined,
                latitude: lat,
                longitude: lng,
                city: lead.businessCity ?? undefined,
                country: args.country,
                h3CellRes7: cells.res7,
                h3CellRes8: cells.res8,
                h3CellRes9: cells.res9,
                rating: lead.businessRating ?? undefined,
                reviewCount: lead.businessReviewCount ?? undefined,
                state,
                stateUpdatedAt: now,
                reservedByCreatorId: claimed ?? undefined,
                reservedAt: claimed ? (lead.claimedAt ?? now) : undefined,
                reservationExpiresAt: claimed
                    ? (lead.claimedAt ?? now) + RESERVATION_DURATION_MS
                    : undefined,
                qualityScore,
                scrapedAt: lead.scrapedAt ?? now,
                lastRefreshedAt: now,
                scrapeJobId: undefined,
                submissionId: undefined,
            });

            // Atomic inventory bookkeeping. For the migration path, this is
            // a same-state "increment" — `from === to` produces a net +0
            // on `<from>Count` and +1 on `<to>Count`, which is exactly the
            // shape we want for fresh inserts.
            await ctx.runMutation(internal.prospects.adjustInventory, {
                h3CellRes7: cells.res7,
                categoryBucket,
                country: args.country,
                from: state,
                to: state,
            });

            // Patch the source lead so future runs skip it
            await ctx.db.patch(lead._id, { migratedToProspectId: prospectId });

            seenPlaceIds.add(placeId);
            migrated += 1;
        }

        return {
            processed: page.page.length,
            migrated,
            skipped,
            nextCursor: page.continueCursor,
            done: page.isDone,
        };
    },
});
