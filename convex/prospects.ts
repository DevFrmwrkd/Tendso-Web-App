/**
 * Prospect Pool — public read surface + internal helpers (P1).
 *
 * P1 scope (per docs/changes/WEB-PROPECT-POOL.md):
 *   - `searchNearby` (public query)   — H3-indexed nearby search, sorted by quality
 *   - `getByPlaceId` (internal query) — dedup lookup helper
 *   - `adjustInventory` (internal mut) — atomic per-cell counter bookkeeping
 *
 * Reservation mutations (reserve/markContacted/etc.) + the
 * releaseExpiredReservations cron land in P2.
 * Background scrape + replenish cron land in P4.
 *
 * Mobile's discover map dual-reads from `searchNearby` AND the legacy
 * `outscraper.listScrapedLeads` and merges. Both are valid during the
 * migration window. Outscraper-side reads stay until Phase M.4 cleanup.
 */
import { query, internalQuery, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { Doc, Id } from './_generated/dataModel';
import { requireAuth } from './lib/auth';
import { latLngToH3Cells, getNeighborCellsRes7 } from './lib/h3';

/**
 * PRIMARY READ — called by mobile + web discover map.
 *
 * Computes the caller's H3 res-7 cell + a k-ring of neighbors, queries
 * each cell's `prospects` index, merges, sorts by `qualityScore` desc,
 * and returns up to `limit` rows. No Outscraper call — pure read from
 * the pool. Empty result is a normal outcome (cell not yet replenished).
 *
 * Ring sizing:
 *   radiusKm ≤ 5 → ringSize 1 (~5km coverage, 7 cells queried)
 *   radiusKm > 5 → ringSize 2 (~10km coverage, 19 cells queried)
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

        // Per-cell pull. Convex has no multi-cell IN clause, so we iterate.
        // Each call is O(log N) via the index. The per-cell cap caps total
        // work at cells.length * limit — bounded for ringSize ≤ 2.
        const all: Doc<'prospects'>[] = [];
        for (const cell of cells) {
            const cellResults = args.categoryBucket
                ? await ctx.db
                    .query('prospects')
                    .withIndex('by_h3_res7_and_category', (q) =>
                        q.eq('h3CellRes7', cell).eq('categoryBucket', args.categoryBucket!),
                    )
                    .filter((q) => q.eq(q.field('state'), 'available'))
                    .take(limit)
                : await ctx.db
                    .query('prospects')
                    .withIndex('by_h3_res7_and_state', (q) =>
                        q.eq('h3CellRes7', cell).eq('state', 'available'),
                    )
                    .take(limit);
            all.push(...cellResults);
        }

        all.sort((a, b) => b.qualityScore - a.qualityScore);
        return all.slice(0, limit);
    },
});

/**
 * Internal lookup — used by the backfill migration and the future scrape
 * ingest path to check dedup layer 2 (place_id) before inserting.
 * Returns null if no row exists.
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
 * Single source of truth for `prospect_inventory` counter updates.
 *
 * Called from:
 *   - backfillBatch (P1) — inserts into "available" or "reserved"
 *   - reservation mutations (P2) — transitions through the state machine
 *   - scrape ingest (P4) — fresh inserts into "available"
 *
 * On first insert for a (cell, category): creates the inventory row,
 * seeded with the locale's `minAvailableThreshold` (falls back to 100).
 * On subsequent calls: atomically -1 from `<from>Count`, +1 to `<to>Count`.
 *
 * Idempotency note: callers should NOT call this twice for the same state
 * transition. The mutation isn't keyed on idempotency tokens; double-call
 * = double-count. The migration's `backfillBatch` guards against this by
 * skipping rows whose `migratedToProspectId` is already set.
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
            // Fresh inventory row — seed counts with 1 in the target state.
            // For new inserts (from === to or from === "available" path of
            // a brand-new row), this is the right shape. Inventory row
            // never exists before the first prospect lands.
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

        // Decrement the `from` bucket (clamped at 0 — don't go negative)
        // and increment the `to` bucket. Same-state transitions are a no-op
        // pair that nets to zero — safe.
        const fromKey = `${args.from}Count` as const;
        const toKey = `${args.to}Count` as const;

        // TS can't narrow Doc<...>[key] for dynamic keys here; the cast is
        // safe because every `<state>Count` field is a v.number().
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
