/**
 * On-demand scrape orchestration (per docs/changes/WEB-PROPECT-POOL.md
 * revised 2026-06 — on-demand only, NO crons).
 *
 * Single entry point: `scrapeOnDemandSync` is called by
 * `outscraper.scrapeNearby` when its pool-sufficiency check finds the
 * area under-stocked. The action submits a 400-result Outscraper async
 * job and polls inline every 5 seconds for up to 5 minutes. When the
 * job completes, results flow into `prospects.ingestScrapeResults`.
 *
 * `subdivideAndScrape` handles the P5 adaptive-subdivision case: when a
 * res-7 scrape hits the 400-result cap (densely populated cell), it
 * spawns 7 child res-8 scrapes to cover the same area at finer
 * granularity. Still on-demand — only fires when the parent action
 * triggers it.
 *
 * `getJob` is a tiny audit helper.
 *
 * What this file deliberately does NOT contain (per the revision):
 *   - ❌ `replenishLowInventoryCells` — was the cron handler. Gone.
 *   - ❌ `countScrapesLast24h` — was the cron's budget guard. Gone.
 *   - ❌ `pollAndIngest` as a separate scheduled action — polling is
 *      INLINE inside `scrapeOnDemandSync`.
 *   - ❌ `scrapeAndStore` (cron-mode) — replaced by `scrapeOnDemandSync`.
 */
import {
    internalAction,
    internalQuery,
} from './_generated/server';
import { v } from 'convex/values';
import { Doc } from './_generated/dataModel';
import { internal } from './_generated/api';
import {
    cellCentroid,
    cellChildrenRes8,
} from './lib/h3';

// ── Constants (per spec §"Async batch mode" lines 207-217) ────────────
const ASYNC_POLL_INTERVAL_MS = 5000;
const ASYNC_POLL_MAX_ATTEMPTS = 60; // 5 minutes total
const ASYNC_SCRAPE_LIMIT = 400;
const ASYNC_SCRAPE_ZOOM = 14;
const OUTSCRAPER_SEARCH_URL = 'https://api.outscraper.com/maps/search';
const OUTSCRAPER_REQUESTS_URL = 'https://api.outscraper.com/requests';

/**
 * On-demand scrape with inline polling.
 *
 * Called from `outscraper.scrapeNearby` when the pool check finds the
 * area's pool insufficient. Submits one Outscraper async job (up to
 * 400 results), polls inline, ingests results into the pool, and
 * triggers adaptive subdivision if the cap is hit.
 *
 * The action's wall-clock budget is ~30-90s typical, capped at 5min by
 * the poll loop. Convex's 10-min action timeout leaves comfortable
 * headroom for ingest + subdivision scheduling.
 *
 * NOTE: name is "scrapeOnDemandSync" for historical continuity with
 * mobile's port. Despite "Sync" in the name, this uses Outscraper's
 * ASYNC batch mode internally (with inline polling) — see the revised
 * spec §"Async batch mode" for the rationale.
 *
 * Returns the count of newly-inserted prospects (per
 * `ingestScrapeResults`'s return shape).
 */
export const scrapeOnDemandSync = internalAction({
    args: {
        h3CellRes7: v.string(),
        h3CellRes8: v.optional(v.string()),
        categoryBucket: v.string(),
        country: v.string(),
    },
    handler: async (ctx, args): Promise<{
        inserted: number;
        updated: number;
        skipped: number;
        rawResultCount: number;
        hitLimitCap: boolean;
    }> => {
        const apiKey = process.env.OUTSCRAPER_API_KEY;
        if (!apiKey) {
            throw new Error('OUTSCRAPER_API_KEY is not set');
        }

        // Resolve locale → outscraper query terms + scoring weights.
        const locale = await ctx.runQuery(internal.prospects.getLocaleConfig, {
            country: args.country,
            categoryBucket: args.categoryBucket,
        });
        if (!locale || !locale.enabled) {
            console.warn(
                `[scrape] no enabled locale for (${args.country}, ${args.categoryBucket}) — skipping`,
            );
            return { inserted: 0, updated: 0, skipped: 0, rawResultCount: 0, hitLimitCap: false };
        }

        // Cell centroid drives the search location. Subdivision passes
        // the res-8 cell; default uses res-7.
        const targetCell = args.h3CellRes8 ?? args.h3CellRes7;
        const [lat, lng] = cellCentroid(targetCell);
        const jobId = `ondemand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        await ctx.runMutation(internal.prospects.recordScrapeStart, {
            jobId,
            h3CellRes7: args.h3CellRes7,
            h3CellRes8: args.h3CellRes8,
            categoryBucket: args.categoryBucket,
            country: args.country,
            outscraperQuery: locale.outscraperQueries.join(', '),
            outscraperCoordinates: `${lat},${lng}`,
            outscraperZoom: ASYNC_SCRAPE_ZOOM,
            outscraperLimit: ASYNC_SCRAPE_LIMIT,
        });

        // Submit async job.
        const submitParams = new URLSearchParams({
            query: locale.outscraperQueries.join(','),
            coordinates: `${lat},${lng}`,
            zoom: String(ASYNC_SCRAPE_ZOOM),
            limit: String(ASYNC_SCRAPE_LIMIT),
            async: 'true',
            language: 'en',
            region: args.country,
        });

        let outscraperJobId: string;
        try {
            const submitRes = await fetch(
                `${OUTSCRAPER_SEARCH_URL}?${submitParams}`,
                {
                    method: 'GET',
                    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
                },
            );
            if (!submitRes.ok) {
                const body = await submitRes.text();
                throw new Error(
                    `Outscraper submit HTTP ${submitRes.status}: ${body.slice(0, 200)}`,
                );
            }
            const submitPayload = (await submitRes.json()) as {
                id?: string;
                status?: string;
            };
            if (!submitPayload.id) {
                throw new Error(
                    `Outscraper submit returned no job id: ${JSON.stringify(submitPayload).slice(0, 200)}`,
                );
            }
            outscraperJobId = submitPayload.id;
        } catch (err: any) {
            await ctx.runMutation(internal.prospects.recordScrapeFailed, {
                jobId,
                errorMessage: `submit failed: ${err?.message ?? err}`,
            });
            throw err;
        }

        await ctx.runMutation(internal.prospects.recordScrapeAsyncId, {
            jobId,
            outscraperJobId,
        });
        console.log(
            `[scrape] async job submitted → outscraperJobId=${outscraperJobId} (jobId=${jobId})`,
        );

        // Inline poll loop. Per spec §"Async batch mode" lines 222-232.
        let businesses: any[] = [];
        let pollSuccess = false;
        for (let attempt = 1; attempt <= ASYNC_POLL_MAX_ATTEMPTS; attempt++) {
            await new Promise((resolve) =>
                setTimeout(resolve, ASYNC_POLL_INTERVAL_MS),
            );
            let pollPayload: any;
            try {
                const pollRes = await fetch(
                    `${OUTSCRAPER_REQUESTS_URL}/${outscraperJobId}`,
                    {
                        headers: {
                            'X-API-KEY': apiKey,
                            Accept: 'application/json',
                        },
                    },
                );
                if (!pollRes.ok) {
                    // HTTP failure is transient — keep polling.
                    console.warn(
                        `[scrape] poll HTTP ${pollRes.status} (attempt ${attempt}/${ASYNC_POLL_MAX_ATTEMPTS}) — retrying`,
                    );
                    continue;
                }
                pollPayload = await pollRes.json();
            } catch (err: any) {
                console.warn(
                    `[scrape] poll fetch failed (attempt ${attempt}/${ASYNC_POLL_MAX_ATTEMPTS}): ${err?.message ?? err}`,
                );
                continue;
            }

            const status = String(pollPayload?.status ?? '').toLowerCase();
            if (status === 'success') {
                // Outscraper async result wraps results in a nested array.
                const data = pollPayload?.data;
                businesses = Array.isArray(data?.[0])
                    ? data[0]
                    : Array.isArray(data)
                        ? data
                        : [];
                console.log(
                    `[scrape] async job complete after ${attempt} poll(s) (~${attempt * 5}s) — ${businesses.length} results`,
                );
                pollSuccess = true;
                break;
            }
            if (status === 'failed' || status === 'error') {
                const errMsg = pollPayload?.error_message ?? pollPayload?.message ?? status;
                await ctx.runMutation(internal.prospects.recordScrapeFailed, {
                    jobId,
                    errorMessage: `Outscraper reported ${status}: ${errMsg}`,
                });
                throw new Error(`Outscraper async job ${outscraperJobId} ${status}: ${errMsg}`);
            }
            // status was "pending"/"inprogress"/empty — keep polling
            if (attempt % 6 === 0) {
                console.log(
                    `[scrape] async still pending (attempt ${attempt}/${ASYNC_POLL_MAX_ATTEMPTS}, status=${pollPayload?.status ?? 'unknown'})`,
                );
            }
        }

        if (!pollSuccess) {
            await ctx.runMutation(internal.prospects.recordScrapeFailed, {
                jobId,
                errorMessage: `Outscraper async job timed out after ${ASYNC_POLL_MAX_ATTEMPTS * ASYNC_POLL_INTERVAL_MS / 1000}s`,
            });
            throw new Error(
                `Outscraper async job ${outscraperJobId} timed out`,
            );
        }

        // Ingest into pool.
        const ingest = (await ctx.runMutation(
            internal.prospects.ingestScrapeResults,
            { jobId, businesses, country: args.country },
        )) as { inserted: number; updated: number; skipped: number };

        const hitLimitCap = businesses.length >= ASYNC_SCRAPE_LIMIT;
        await ctx.runMutation(internal.prospects.recordScrapeComplete, {
            jobId,
            rawResultCount: businesses.length,
            insertedCount: ingest.inserted,
            dedupedCount: ingest.updated + ingest.skipped,
            hitLimitCap,
        });

        // Adaptive subdivision: if we hit the 400-cap on a res-7 scrape,
        // schedule child res-8 scrapes so dense urban cores stay covered.
        // Don't subdivide further if we're already at res-8 (avoids
        // infinite recursion on Makati CBD etc).
        if (hitLimitCap && !args.h3CellRes8) {
            console.log(
                `[scrape] hit cap of ${ASYNC_SCRAPE_LIMIT}, scheduling on-demand subdivision for jobId=${jobId}`,
            );
            await ctx.scheduler.runAfter(0, internal.scrape.subdivideAndScrape, {
                parentJobId: jobId,
                parentCellRes7: args.h3CellRes7,
                categoryBucket: args.categoryBucket,
                country: args.country,
            });
        }

        return {
            inserted: ingest.inserted,
            updated: ingest.updated,
            skipped: ingest.skipped,
            rawResultCount: businesses.length,
            hitLimitCap,
        };
    },
});

/**
 * Adaptive subdivision (P5): when a res-7 scrape hits the 400-result
 * cap, the cell is denser than one scrape can cover. Spawn 7 child
 * res-8 scrapes to fill in the gaps. Each child runs as its own
 * `scrapeOnDemandSync` invocation via the scheduler — they fire
 * sequentially (one after the other) to avoid hammering Outscraper.
 *
 * Cost: worst case 8 × $0.40 = $3.20 for one super-dense area, in
 * exchange for ~3,200 prospects added to the pool. Amortizes well over
 * future creator requests in the area.
 */
export const subdivideAndScrape = internalAction({
    args: {
        parentJobId: v.string(),
        parentCellRes7: v.string(),
        categoryBucket: v.string(),
        country: v.string(),
    },
    handler: async (ctx, args): Promise<void> => {
        const children = cellChildrenRes8(args.parentCellRes7);
        console.log(
            `[scrape] subdividing parentJobId=${args.parentJobId} into ${children.length} res-8 children`,
        );
        // Stagger the children — schedule each 10s after the previous so
        // we don't fire 7 parallel Outscraper async jobs. Each child runs
        // its own poll loop independently.
        for (let i = 0; i < children.length; i++) {
            await ctx.scheduler.runAfter(
                i * 10_000,
                internal.scrape.scrapeOnDemandSync,
                {
                    h3CellRes7: args.parentCellRes7,
                    h3CellRes8: children[i],
                    categoryBucket: args.categoryBucket,
                    country: args.country,
                },
            );
        }
    },
});

/**
 * Tiny audit helper — fetches a scrape_history row by jobId. Used by
 * dashboard ad-hoc queries / debugging.
 */
export const getJob = internalQuery({
    args: { jobId: v.string() },
    handler: async (ctx, args): Promise<Doc<'scrape_history'> | null> => {
        return ctx.db
            .query('scrape_history')
            .withIndex('by_job_id', (q) => q.eq('jobId', args.jobId))
            .first();
    },
});
