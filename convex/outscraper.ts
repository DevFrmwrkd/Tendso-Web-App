/**
 * Outscraper Google Maps scraping.
 *
 * Backend for the mobile "Pull nearby businesses" button on the Leads page
 * and the web admin "Lead prospects" view. Calls Outscraper's
 * google-maps-search-v3 endpoint to fetch real businesses near a given
 * location, then upserts them as Leads with `source: "outscraper"`.
 *
 * Critical rule (per docs/changes/BUSINESS-SCRAPER.md):
 *   - Don't modify the public signatures — mobile calls these by name.
 *   - Dedupe via `by_place_id` index so re-scraping the same area doesn't
 *     create duplicate leads.
 *
 * Env: OUTSCRAPER_API_KEY (already set on prod by mobile team).
 */
import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import { bucketCategory } from "./lib/quality";
import { latLngToH3Cells } from "./lib/h3";

/**
 * Wrapper around `bucketCategory` that returns `null` instead of "other"
 * for unknown categories. Used by the pool-aware path so we DON'T pool-
 * query the "other" bucket (which is rarely seeded and would force a
 * scrape every time on a miss). Known categories still get pool-checked.
 */
function mapCategoryToBucket(categoryRaw: string): string | null {
    const b = bucketCategory(categoryRaw);
    return b && b !== "other" ? b : null;
}

// ── Async-batch mode constants (per spec §"Async batch mode") ────────
// Same values as convex/scrape.ts — duplicated here because the legacy
// scrapeNearby path used to be sync-mode and is now async-batch too.
const ASYNC_POLL_INTERVAL_MS = 5000;
const ASYNC_POLL_MAX_ATTEMPTS = 60; // 5 min total — Convex action timeout is 10 min, leaves 5 min headroom
const MAX_LIMIT = 400;
const DEFAULT_LIMIT = 400;

// Outscraper response is loosely typed — keep this flexible.
interface OutscraperPlace {
    name?: string;
    place_id?: string;
    google_id?: string;
    full_address?: string;
    address?: string;
    city?: string;
    type?: string;
    category?: string;
    subtypes?: string;
    site?: string;
    website?: string;
    phone?: string;
    rating?: number;
    reviews?: number;
    latitude?: number;
    longitude?: number;
}

// ── Path B: Google Places hyper-local merge (per WEB-PROPECT-POOL.md §Path B) ──
// Outscraper ranks by popularity/relevance, not physical distance. A creator
// 50m from "PARES SA GARAHE" gets back restaurants 1.2-1.7km away because
// Google ranks the bigger places higher. Google Places Nearby Search with
// `rankby=distance` ranks purely by physical distance and surfaces those
// hyper-local hits Outscraper drops. We call BOTH APIs in `scrapeNearby`
// and merge by `place_id`. Path B fires only for short-radius searches
// (≤ PLACES_HYPERLOCAL_RADIUS_KM) — Outscraper still owns wider-area
// coverage because Places caps at 60 results across 3 paginated requests.
const GOOGLE_PLACES_NEARBY_URL =
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const PLACES_HYPERLOCAL_RADIUS_KM = 2;

interface PlacesNearbyResult {
    place_id?: string;
    name?: string;
    vicinity?: string;
    formatted_address?: string;
    types?: string[];
    rating?: number;
    user_ratings_total?: number;
    geometry?: {
        location?: { lat?: number; lng?: number };
    };
}

/**
 * Map a free-text user category to Google Places' `type` parameter.
 * When this returns a string, Places is called with `rankby=distance` +
 * `type=<that>` (distance-sorted, type-filtered). When this returns
 * `undefined`, we fall back to `radius=N` mode (the same approach
 * Outscraper takes, just from Google directly).
 *
 * Table mirrors mobile's helper (see WEB-PROPECT-POOL.md §Path B table).
 */
function mapCategoryToPlacesType(userCategory: string): string | undefined {
    const k = userCategory.trim().toLowerCase();
    if (!k) return undefined;
    if (/\b(barbershop|barber)\b/.test(k)) return "hair_care";
    if (/\b(hair\s*salon|salon)\b/.test(k)) return "beauty_salon";
    if (/\b(nail|manicure)\b/.test(k)) return "beauty_salon";
    if (/\b(spa|massage)\b/.test(k)) return "spa";
    if (/\b(auto|mechanic|vulcanizing|car\s*repair)\b/.test(k)) return "car_repair";
    if (/\b(dental|dentist)\b/.test(k)) return "dentist";
    if (/\b(pharmacy|drugstore)\b/.test(k)) return "pharmacy";
    if (/\b(restaurant|carinderia|eatery|fastfood)\b/.test(k)) return "restaurant";
    if (/\b(cafe|coffee)\b/.test(k)) return "cafe";
    if (/\b(bakery|panaderia)\b/.test(k)) return "bakery";
    if (/\b(sari[-\s]?sari|convenience)\b/.test(k)) return "convenience_store";
    if (/\b(grocery|supermarket)\b/.test(k)) return "supermarket";
    if (/\b(store|shop|mart)\b/.test(k)) return "store";
    return undefined;
}

/**
 * Scrape Google Maps near a location, insert dedup'd leads. Creator-callable
 * (was admin-only, changed per the 2026-05-27 WEB-BUILD-CRM.md update).
 *
 * Args:
 *   - query: free-text category, e.g. "barbershop", "spa", "restaurant"
 *   - location: human-readable area (city/neighbourhood) OR "lat,lng" coord
 *     string — passed straight to Outscraper's query so the API can geocode.
 *   - radiusKm: optional, defaults to 5
 *   - limit: optional, defaults to 20 (Outscraper hard caps near 500 anyway)
 *
 * Returns: { inserted, skipped, total } summary so the caller can show a
 * toast. Long-form per-business data lands in the leads table.
 */
export const scrapeNearby = action({
    args: {
        query: v.string(),
        location: v.string(),
        radiusKm: v.optional(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        // Resolve creator record via internal query — actions can't ctx.db.
        const me = (await ctx.runQuery(internal.creators.getMeForAuthInternal, {
            clerkId: identity.subject,
        })) as { _id: any; clerkId: string } | null;
        if (!me) throw new Error("No creator record found for this account.");

        const apiKey = process.env.OUTSCRAPER_API_KEY;
        if (!apiKey) {
            throw new Error(
                "OUTSCRAPER_API_KEY is not set on this Convex deployment.",
            );
        }

        // ── REVISED 2026-06: pool-aware scrape (on-demand only) ──────
        // Before hitting Outscraper, check whether the prospect pool
        // already has enough rows for this area + category. If yes,
        // return them in the businesses shape — zero API cost, instant.
        //
        // Pool sufficiency = ≥ 10 available prospects in the user's
        // res-7 cell + matching categoryBucket. Below that we fall
        // through to the async-batch scrape path so the pool grows.
        //
        // The pool check + ingest only run when `args.location` is a
        // parseable "lat,lng" coordinate string. Free-text location
        // (city/neighbourhood) still uses the legacy single-shot
        // sync-mode scrape path further down — those should be rare
        // now that mobile always sends GPS coords.
        const __poolCoordMatch = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(
            args.location.trim(),
        );
        const userCategoryRaw = args.query.trim().toLowerCase();
        // Map the free-text query to one of the seeded category buckets.
        // The mapping mirrors lib/quality.ts#bucketCategory exactly so
        // the ingest path (in prospects.ingestScrapeResults) groups new
        // rows into the same bucket the pool check just queried.
        const __categoryBucket = mapCategoryToBucket(userCategoryRaw);
        if (__poolCoordMatch && __categoryBucket) {
            const lat = Number(__poolCoordMatch[1]);
            const lng = Number(__poolCoordMatch[2]);
            const poolRows = (await ctx.runQuery(
                internal.prospects.searchNearbyInternal,
                {
                    lat,
                    lng,
                    radiusKm: Math.max(0.5, args.radiusKm ?? 5),
                    categoryBucket: __categoryBucket,
                    limit: 200,
                },
            )) as any[];
            console.log(
                `[outscraper] pool check: found ${poolRows.length} existing prospects in (${lat},${lng}) bucket="${__categoryBucket}"`,
            );
            if (poolRows.length >= 10) {
                console.log(
                    `[outscraper] pool sufficient — skipping Outscraper, serving from pool`,
                );
                const businessesFromPool = poolRows.map((p) => ({
                    placeId: p.googlePlaceId,
                    businessName: p.businessName,
                    businessAddress: p.address ?? null,
                    businessCity: p.city ?? null,
                    businessCategory: p.category ?? p.categoryBucket ?? null,
                    businessWebsite: p.website ?? null,
                    businessPhone: p.phone ?? null,
                    businessLatitude: p.latitude ?? null,
                    businessLongitude: p.longitude ?? null,
                    businessRating: p.rating ?? null,
                    businessReviewCount: p.reviewCount ?? null,
                }));
                return {
                    inserted: 0,
                    skipped: 0,
                    total: businessesFromPool.length,
                    businesses: businessesFromPool,
                };
            }
            // Pool insufficient → fall through to async-batch scrape.
            // The ingest at the bottom will stock the pool with results.
        }

        // Revised 2026-06: bumped from 20/200 → DEFAULT_LIMIT/MAX_LIMIT
        // so async-batch mode returns up to 400 results per call (vs ~50
        // in the prior sync-mode). 8× pool growth per scrape; same cost
        // per result (~$0.001), so cost-per-future-creator drops ~5×.
        const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
        const radiusKm = Math.max(0.5, args.radiusKm ?? 5);

        // Query-format history (per WEB-BUILD-CRM.md):
        //   v1 (original): query=salon, coordinates=14.29,121.00, radius=3
        //     → Outscraper ignored `radius`, returned 0 results.
        //   v2 (2026-05-28 "fix"): query="salon, 14.29,121.00, 3mi"
        //     → Outscraper treats the comma-soup as a literal place query,
        //       fails to resolve it, returns a sentinel record with
        //       place_id="__NO_PLACE_FOUND__" — looks like 1 result but
        //       contains no usable data.
        //   v3 (2026-05-29 late evening — current): query="salon",
        //     coordinates=14.29,121.00, zoom=13 (no radius)
        //     → Matches Outscraper's documented API.
        //
        // Zoom derivation per the spec's radius→zoom mapping for PH latitudes:
        // Field-test fix #3 (2026-06-04): added zoom 16 case for ≤0.5km.
        // Zoom 16 forces Outscraper to favor block-level results, which
        // surfaces informal businesses ("PARES SA GARAHE" class) ahead
        // of the popular far-away places Google's relevance ranking
        // otherwise pushes to the top.
        const zoom =
            radiusKm <= 0.5 ? 16 :
            radiusKm <= 1 ? 15 :
            radiusKm <= 3 ? 14 :
            radiusKm <= 5 ? 13 :
            radiusKm <= 10 ? 12 :
            11;
        const userCategory = args.query.trim() || "businesses";
        const coordinates = args.location.trim();

        // ── REVISED 2026-06: async-batch mode with inline polling ────
        // The legacy path was a single-shot sync fetch (async=false,
        // ~50 results, 5-30s). The revised path submits an async job
        // and polls every 5s inline for up to 5 min. Trade-off:
        //   - User waits 30-90s on a fresh scrape (was 5-30s)
        //   - But one async call returns up to 400 results (vs ~50)
        //   - Pool grows 8× faster per scrape → 5× cheaper per future creator
        // See spec §"Async batch mode" for the full rationale.
        const submitUrl = new URL("https://api.outscraper.com/maps/search-v3");
        submitUrl.searchParams.set("query", userCategory);
        submitUrl.searchParams.set("coordinates", coordinates);
        submitUrl.searchParams.set("zoom", String(zoom));
        submitUrl.searchParams.set("limit", String(limit));
        submitUrl.searchParams.set("language", "en");
        submitUrl.searchParams.set("region", "PH");
        submitUrl.searchParams.set("async", "true");

        console.log(
            `[outscraper] scrapeNearby (async batch) → query="${userCategory}" coords=${coordinates} zoom=${zoom} (limit=${limit}, radiusKm=${radiusKm})`,
        );

        // Submit the async job.
        let outscraperJobId: string;
        try {
            const submitRes = await fetch(submitUrl.toString(), {
                method: "GET",
                headers: { "X-API-KEY": apiKey, Accept: "application/json" },
            });
            if (!submitRes.ok) {
                const body = await submitRes.text();
                throw new Error(
                    `Outscraper submit HTTP ${submitRes.status}: ${body.slice(0, 300)}`,
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
            console.log(
                `[outscraper] async job submitted → outscraperJobId=${outscraperJobId}`,
            );
        } catch (err: any) {
            throw new Error(`Outscraper submit failed: ${err?.message ?? err}`);
        }

        // Poll inline until the job completes or the budget expires.
        let payload: any = null;
        for (let attempt = 1; attempt <= ASYNC_POLL_MAX_ATTEMPTS; attempt++) {
            await new Promise((resolve) =>
                setTimeout(resolve, ASYNC_POLL_INTERVAL_MS),
            );
            let pollPayload: any;
            try {
                const pollRes = await fetch(
                    `https://api.outscraper.com/requests/${outscraperJobId}`,
                    {
                        headers: {
                            "X-API-KEY": apiKey,
                            Accept: "application/json",
                        },
                    },
                );
                if (!pollRes.ok) {
                    // Transient HTTP failure — keep polling.
                    console.warn(
                        `[outscraper] poll HTTP ${pollRes.status} (attempt ${attempt}/${ASYNC_POLL_MAX_ATTEMPTS}) — retrying`,
                    );
                    continue;
                }
                pollPayload = await pollRes.json();
            } catch (err: any) {
                console.warn(
                    `[outscraper] poll fetch failed (attempt ${attempt}/${ASYNC_POLL_MAX_ATTEMPTS}): ${err?.message ?? err}`,
                );
                continue;
            }
            const status = String(pollPayload?.status ?? "").toLowerCase();
            if (status === "success") {
                console.log(
                    `[outscraper] async job complete after ${attempt} poll(s) (~${attempt * 5}s)`,
                );
                payload = pollPayload;
                break;
            }
            if (status === "failed" || status === "error") {
                const errMsg =
                    pollPayload?.error_message ??
                    pollPayload?.message ??
                    status;
                throw new Error(
                    `Outscraper async job ${outscraperJobId} ${status}: ${errMsg}`,
                );
            }
            // "pending" / "inprogress" / unknown — keep looping.
            if (attempt % 6 === 0) {
                console.log(
                    `[outscraper] async still pending (attempt ${attempt}/${ASYNC_POLL_MAX_ATTEMPTS}, status=${pollPayload?.status ?? "unknown"})`,
                );
            }
        }

        if (!payload) {
            throw new Error(
                `Outscraper async job ${outscraperJobId} timed out after ${ASYNC_POLL_MAX_ATTEMPTS * ASYNC_POLL_INTERVAL_MS / 1000}s`,
            );
        }

        // Outscraper returns: { data: [[ placeA, placeB, ... ]] } for a single
        // query, or { data: [[...], [...]] } for multi-query. We sent one, so
        // flatten the first sublist.
        const raw: OutscraperPlace[] = Array.isArray(payload?.data?.[0])
            ? payload.data[0]
            : Array.isArray(payload?.data)
                ? payload.data
                : [];

        console.log(`[outscraper] received ${raw.length} businesses from Outscraper`);

        // EMPTY-RESULTS diagnostic — when Outscraper returns 0 places, surface
        // the upstream response keys so we can tell billing-empty from
        // genuine-zero in Convex prod logs. Outscraper does NOT throw a
        // billing error: when the account is out of credits, the response is
        // HTTP 200 with `status: "Success"` and `data: [[]]` — indistinguishable
        // from a legitimate zero-match search by shape alone. Logging
        // `status` / `message` / `error_message` + `has_data` lets us read
        // off the cause from the log line. See WEB-BUILD-CRM.md "🛑 Three
        // Outscraper blockers" for the full triage tree.
        if (raw.length === 0) {
            const diag = {
                id: payload?.id ?? null,
                status: payload?.status ?? null,
                message: payload?.message ?? null,
                error_message: payload?.error_message ?? null,
                has_data: Array.isArray(payload?.data),
            };
            console.log(
                `[outscraper] EMPTY RESULTS — full response keys=${JSON.stringify(diag)}. If you see this with status="Success" and your billing balance is $0, the account is out of credits — top up at app.outscraper.cloud/billing.`,
            );
        }

        // Diagnostic: log what fields the first business actually has, so we
        // can spot Outscraper API shape changes (e.g. they rename `place_id`
        // to `google_id`) without redeploying.
        if (raw.length > 0) {
            console.log(
                `[outscraper] first business keys: ${Object.keys(raw[0] as any).join(",")}`,
            );
            const sample = raw[0] as any;
            console.log(
                `[outscraper] first business sample: ${JSON.stringify({
                    name: sample.name,
                    place_id: sample.place_id ?? sample.google_id ?? null,
                    latitude: sample.latitude,
                    longitude: sample.longitude,
                    category: sample.category ?? sample.type ?? sample.subtypes ?? null,
                })}`,
            );
        }

        // Sentinel detection — when Outscraper can't resolve the query to
        // a place to search, it returns a single record with
        // place_id="__NO_PLACE_FOUND__" and nulled-out fields. Bail out
        // cleanly so we don't insert junk rows or render junk pins.
        if (
            raw.length > 0 &&
            (raw[0] as any).place_id === "__NO_PLACE_FOUND__"
        ) {
            console.warn(
                `[outscraper] __NO_PLACE_FOUND__ sentinel detected — Outscraper couldn't resolve the query. Returning empty results.`,
            );
            return { inserted: 0, skipped: 0, total: 0, businesses: [] };
        }

        const scrapedBy = me.clerkId;
        const scrapedAt = Date.now();
        let inserted = 0;
        let skipped = 0;

        // Build the in-memory `businesses` array per the 2026-05-29 evening
        // architecture change. The discover map renders pins from this array
        // directly (via URL data param), so the DB write path is no longer
        // load-bearing for the map UX. Best-effort: a failed insert just
        // doesn't make it into the leads table, but the pin still shows.
        const businesses: Array<{
            placeId: string;
            businessName: string;
            businessAddress: string | null;
            businessCity: string | null;
            businessCategory: string | null;
            businessWebsite: string | null;
            businessPhone: string | null;
            businessLatitude: number | null;
            businessLongitude: number | null;
            businessRating: number | null;
            businessReviewCount: number | null;
        }> = [];

        for (const place of raw as any[]) {
            // Robust placeId fallback chain. Outscraper occasionally returns
            // records missing `place_id`; we try several other id-ish fields
            // before falling back to a synthetic key. No business with coords
            // gets silently dropped from the returned array.
            const placeId: string =
                place.place_id ||
                place.google_id ||
                place.cid ||
                place.feature_id ||
                place.id ||
                `synthetic:${place.name ?? "unknown"}:${place.latitude ?? "0"}:${place.longitude ?? "0"}`;

            if (!place.name) {
                skipped++;
                continue;
            }

            // Push to in-memory `businesses` BEFORE attempting the DB write,
            // so the array reflects what Outscraper actually returned
            // regardless of DB write outcome.
            businesses.push({
                placeId: String(placeId),
                businessName: place.name,
                businessAddress: place.full_address || place.address || null,
                businessCity: place.city || null,
                businessCategory:
                    place.category || place.type || place.subtypes || null,
                businessWebsite: place.site || place.website || null,
                businessPhone: place.phone || null,
                businessLatitude:
                    typeof place.latitude === "number" ? place.latitude : null,
                businessLongitude:
                    typeof place.longitude === "number" ? place.longitude : null,
                businessRating:
                    typeof place.rating === "number" ? place.rating : null,
                businessReviewCount:
                    typeof place.reviews === "number" ? place.reviews : null,
            });

            // Best-effort DB write — wrapped in try/catch so a write failure
            // does not break the map. Failures get logged per-row so we can
            // diagnose later.
            try {
                const result = await ctx.runMutation(
                    internal.outscraper.insertScrapedLead,
                    {
                        creatorId: me._id,
                        scrapedAt,
                        scrapedBy,
                        businessName: place.name,
                        businessAddress: place.full_address || place.address || undefined,
                        businessCity: place.city || undefined,
                        businessCategory:
                            place.category || place.type || place.subtypes || undefined,
                        businessWebsite: place.site || place.website || undefined,
                        businessLatitude: place.latitude ?? undefined,
                        businessLongitude: place.longitude ?? undefined,
                        businessRating: place.rating ?? undefined,
                        businessReviewCount: place.reviews ?? undefined,
                        businessGooglePlaceId: String(placeId),
                        phone: place.phone || undefined,
                    },
                );
                if (result.skipped) skipped++;
                else inserted++;
            } catch (err: any) {
                console.warn(
                    `[outscraper] insertScrapedLead failed for "${place.name}": ${err?.message ?? err}`,
                );
                skipped++;
            }
        }

        console.log(
            `[outscraper] returning to client: ${businesses.length} businesses with coords (inserted=${inserted}, skipped=${skipped})`,
        );

        // ── Path B: Google Places hyper-local merge ──────────────────
        // Only fires for short-radius searches AND when both the env var
        // and a parseable lat/lng coordinate string are present. Failures
        // are non-fatal — Outscraper results still return.
        try {
            const placesKey = process.env.GOOGLE_PLACES_API_KEY;
            const coordMatch = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(
                coordinates,
            );
            if (
                placesKey &&
                coordMatch &&
                radiusKm <= PLACES_HYPERLOCAL_RADIUS_KM
            ) {
                const lat = Number(coordMatch[1]);
                const lng = Number(coordMatch[2]);
                const placesType = mapCategoryToPlacesType(userCategory);

                const placesUrl = new URL(GOOGLE_PLACES_NEARBY_URL);
                placesUrl.searchParams.set("key", placesKey);
                placesUrl.searchParams.set("location", `${lat},${lng}`);
                if (placesType) {
                    // rankby=distance + type=X surfaces the nearest businesses
                    // of that type, sorted by physical distance. radius is
                    // NOT allowed in this mode.
                    placesUrl.searchParams.set("rankby", "distance");
                    placesUrl.searchParams.set("type", placesType);
                } else {
                    // No type mapping — fall back to radius-mode keyword search.
                    placesUrl.searchParams.set(
                        "radius",
                        String(Math.round(radiusKm * 1000)),
                    );
                    placesUrl.searchParams.set("keyword", userCategory);
                }

                console.log(
                    `[outscraper] hyper-local Places call → location=${lat},${lng} type=${placesType ?? "(none)"} (radiusKm=${radiusKm})`,
                );

                const placesRes = await fetch(placesUrl.toString(), {
                    method: "GET",
                    headers: { Accept: "application/json" },
                });
                if (!placesRes.ok) {
                    throw new Error(`Places HTTP ${placesRes.status}`);
                }
                const placesPayload = (await placesRes.json()) as {
                    status?: string;
                    results?: PlacesNearbyResult[];
                    error_message?: string;
                };
                if (
                    placesPayload.status &&
                    placesPayload.status !== "OK" &&
                    placesPayload.status !== "ZERO_RESULTS"
                ) {
                    throw new Error(
                        `Places status=${placesPayload.status}${placesPayload.error_message ? ": " + placesPayload.error_message : ""}`,
                    );
                }

                const placesResults = placesPayload.results ?? [];
                console.log(
                    `[outscraper] Places returned ${placesResults.length} hyper-local businesses`,
                );

                // Build a dedup set from the existing Outscraper results.
                // Anything already in `businesses` (by place_id) is skipped.
                const seenPlaceIds = new Set<string>();
                for (const b of businesses) seenPlaceIds.add(b.placeId);

                let mergedCount = 0;
                for (const r of placesResults) {
                    const placeId = r.place_id;
                    if (!placeId || seenPlaceIds.has(placeId)) continue;
                    const placeLat = r.geometry?.location?.lat;
                    const placeLng = r.geometry?.location?.lng;
                    if (
                        typeof placeLat !== "number" ||
                        typeof placeLng !== "number"
                    )
                        continue;
                    if (!r.name) continue;

                    businesses.push({
                        placeId,
                        businessName: r.name,
                        businessAddress: r.vicinity || r.formatted_address || null,
                        businessCity: null,
                        // Places returns `types: string[]` — first one is usually
                        // the most specific. Stringify for our flat field.
                        businessCategory:
                            Array.isArray(r.types) && r.types.length > 0
                                ? r.types[0]
                                : null,
                        businessWebsite: null,
                        businessPhone: null,
                        businessLatitude: placeLat,
                        businessLongitude: placeLng,
                        businessRating:
                            typeof r.rating === "number" ? r.rating : null,
                        businessReviewCount:
                            typeof r.user_ratings_total === "number"
                                ? r.user_ratings_total
                                : null,
                    });
                    seenPlaceIds.add(placeId);
                    mergedCount += 1;
                }

                console.log(
                    `[outscraper] merged ${mergedCount} new businesses from Places (total now ${businesses.length})`,
                );
            }
        } catch (err: any) {
            // Non-fatal — never let a Places failure break the scrape.
            console.warn(
                `[outscraper] Places hyper-local merge failed (non-fatal): ${err?.message ?? err}`,
            );
        }

        // ── REVISED 2026-06: pool ingest ─────────────────────────────
        // Archive every business (Outscraper + Places merged) into the
        // prospects table. Subsequent requests in this area get served
        // from the pool for free. Non-fatal — a failed ingest just
        // means the next creator will pay for a fresh scrape, the
        // current creator still gets their results back.
        try {
            if (__poolCoordMatch && __categoryBucket && businesses.length > 0) {
                // Record a synthetic scrape_history row so the ingest
                // mutation can look up locale defaults for quality
                // scoring + bump the inventory.lastScrapedAt telemetry.
                const ingestJobId = `legacy-scrapeNearby-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const lat = Number(__poolCoordMatch[1]);
                const lng = Number(__poolCoordMatch[2]);
                const cells = latLngToH3Cells(lat, lng);
                await ctx.runMutation(internal.prospects.recordScrapeStart, {
                    jobId: ingestJobId,
                    h3CellRes7: cells.res7,
                    categoryBucket: __categoryBucket,
                    country: "PH",
                    outscraperQuery: userCategory,
                    outscraperCoordinates: coordinates,
                    outscraperZoom: zoom,
                    outscraperLimit: limit,
                });
                const ingest = (await ctx.runMutation(
                    internal.prospects.ingestScrapeResults,
                    {
                        jobId: ingestJobId,
                        businesses,
                        country: "PH",
                    },
                )) as { inserted: number; updated: number; skipped: number };
                await ctx.runMutation(internal.prospects.recordScrapeComplete, {
                    jobId: ingestJobId,
                    rawResultCount: businesses.length,
                    insertedCount: ingest.inserted,
                    dedupedCount: ingest.updated + ingest.skipped,
                    hitLimitCap: businesses.length >= MAX_LIMIT,
                });
                console.log(
                    `[outscraper] pool ingest: ${ingest.inserted} new prospects added to global pool (updated=${ingest.updated}, skipped=${ingest.skipped})`,
                );
            }
        } catch (err: any) {
            console.warn(
                `[outscraper] pool ingest failed (non-fatal): ${err?.message ?? err}`,
            );
        }

        return { inserted, skipped, total: raw.length, businesses };
    },
});

/**
 * Internal — upsert a scraped place as a Lead, deduping on Google Place ID.
 * Called by scrapeNearby; not exposed publicly.
 */
export const insertScrapedLead = internalMutation({
    args: {
        creatorId: v.id("creators"),
        scrapedAt: v.number(),
        scrapedBy: v.string(),
        businessName: v.string(),
        businessAddress: v.optional(v.string()),
        businessCity: v.optional(v.string()),
        businessCategory: v.optional(v.string()),
        businessWebsite: v.optional(v.string()),
        businessLatitude: v.optional(v.number()),
        businessLongitude: v.optional(v.number()),
        businessRating: v.optional(v.number()),
        businessReviewCount: v.optional(v.number()),
        businessGooglePlaceId: v.string(),
        phone: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Dedup by Google Place ID — silently skip if we've already scraped
        // this business in a prior pull.
        const existing = await ctx.db
            .query("leads")
            .withIndex("by_place_id", (q) =>
                q.eq("businessGooglePlaceId", args.businessGooglePlaceId),
            )
            .first();
        if (existing) return { skipped: true, leadId: existing._id };

        const leadId = await ctx.db.insert("leads", {
            creatorId: args.creatorId,
            source: "outscraper",
            status: "new",
            createdAt: args.scrapedAt,
            phone: args.phone,
            businessName: args.businessName,
            businessAddress: args.businessAddress,
            businessCity: args.businessCity,
            businessCategory: args.businessCategory,
            businessWebsite: args.businessWebsite,
            businessLatitude: args.businessLatitude,
            businessLongitude: args.businessLongitude,
            businessRating: args.businessRating,
            businessReviewCount: args.businessReviewCount,
            businessGooglePlaceId: args.businessGooglePlaceId,
            scrapedAt: args.scrapedAt,
            scrapedBy: args.scrapedBy,
        });
        return { skipped: false, leadId };
    },
});

/**
 * List all Outscraper-scraped leads, newest first. Creator-callable
 * (was admin-only, changed per the 2026-05-27 WEB-BUILD-CRM.md update —
 * creators are the primary callers via the Prospects tab).
 *
 * Signature restored per the 2026-05-29 spec callout — the deployed
 * validator drifted to `{ search?, statusFilter? }` and was rejecting
 * mobile's discover-map calls that send `{ limit }`. The canonical
 * signature is `{ limit?: number }` returning the raw outscraper fields
 * (businessLatitude / businessLongitude / businessCategory / businessRating
 * etc.) so the discover map can plot category-keyed pins. Status + search
 * filtering moved to clients.
 */
export const listScrapedLeads = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await requireAuth(ctx);

        const all = await ctx.db.query("leads").collect();
        let scraped = all.filter((l) => l.source === "outscraper");

        scraped.sort((a, b) => (b.scrapedAt ?? b.createdAt) - (a.scrapedAt ?? a.createdAt));

        if (args.limit != null && args.limit > 0) {
            scraped = scraped.slice(0, args.limit);
        }

        // Enrich each row with the claimer's display name + isMine flag.
        const identity = (await ctx.auth.getUserIdentity());
        const currentCreator = identity
            ? await ctx.db
                  .query('creators')
                  .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
                  .first()
            : null;

        const creatorCache = new Map<string, any>();
        const result: any[] = [];
        for (const l of scraped) {
            let claimedBy: {
                creatorId: string;
                displayName: string;
                profileImage: string | null;
                isMine: boolean;
            } | null = null;
            const claimerId = (l as any).claimedByCreatorId as Id<"creators"> | undefined;
            if (claimerId) {
                let c = creatorCache.get(String(claimerId));
                if (!c) {
                    c = await ctx.db.get(claimerId);
                    if (c) creatorCache.set(String(claimerId), c);
                }
                if (c) {
                    const first = (c.firstName ?? '').trim();
                    const last = (c.lastName ?? '').trim();
                    const displayName =
                        !first && !last
                            ? 'Unknown creator'
                            : !last
                                ? first
                                : `${first} ${last[0]}.`;
                    claimedBy = {
                        creatorId: String(c._id),
                        displayName,
                        profileImage: c.profileImage ?? null,
                        isMine: !!currentCreator && String(c._id) === String(currentCreator._id),
                    };
                }
            }

            result.push({
                _id: l._id,
                _creationTime: l._creationTime,
                status: l.status,
                phone: l.phone ?? null,
                businessName: l.businessName ?? null,
                businessAddress: l.businessAddress ?? null,
                businessCity: l.businessCity ?? null,
                businessCategory: l.businessCategory ?? null,
                businessWebsite: l.businessWebsite ?? null,
                businessLatitude: l.businessLatitude ?? null,
                businessLongitude: l.businessLongitude ?? null,
                businessRating: l.businessRating ?? null,
                businessReviewCount: l.businessReviewCount ?? null,
                businessGooglePlaceId: l.businessGooglePlaceId ?? null,
                scrapedAt: l.scrapedAt ?? null,
                scrapedBy: l.scrapedBy ?? null,
                createdAt: l.createdAt,
                claimedAt: (l as any).claimedAt ?? null,
                claimedBy,
            });
        }
        return result;
    },
});

/**
 * Creator claims a prospect for follow-up. The claim is INFORMATIONAL,
 * not exclusive — another creator can still walk in and interview the
 * business. The "claimed by X" pill is a coordination signal so two
 * creators don't waste a trip to the same place at the same time.
 *
 * If 24h pass without a submission being created for this prospect, the
 * `releaseStaleClaimsInternal` cron auto-clears the claim.
 */
export const claimProspect = mutation({
    args: { leadId: v.id('leads') },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const lead = await ctx.db.get(args.leadId);
        if (!lead) throw new Error('Lead not found');
        if (lead.source !== 'outscraper') {
            throw new Error('Can only claim Outscraper prospects, not customer leads');
        }
        if (lead.submissionId) {
            throw new Error('This prospect has already been interviewed');
        }

        const creator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!creator) throw new Error('Creator profile not found');

        await ctx.db.patch(args.leadId, {
            claimedByCreatorId: creator._id,
            claimedAt: Date.now(),
        });
    },
});

/**
 * Release a claim. Only the creator who placed the claim (or an admin)
 * can release — server-side enforced.
 */
export const releaseProspect = mutation({
    args: { leadId: v.id('leads') },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const lead = await ctx.db.get(args.leadId);
        if (!lead) throw new Error('Lead not found');

        const creator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!creator) throw new Error('Creator profile not found');

        const isAdmin = creator.role === 'admin';
        if (!isAdmin && String((lead as any).claimedByCreatorId) !== String(creator._id)) {
            throw new Error('You can only release your own claims');
        }

        await ctx.db.patch(args.leadId, {
            claimedByCreatorId: undefined,
            claimedAt: undefined,
        });
    },
});

/**
 * Fetch a single prospect with claimer info enriched, plus its notes.
 * Used by the /leads/[leadId] detail view when the lead is a prospect
 * (source === "outscraper" && submissionId == null).
 */
export const getProspect = query({
    args: { leadId: v.id('leads') },
    handler: async (ctx, args) => {
        await requireAuth(ctx);
        const lead = await ctx.db.get(args.leadId);
        if (!lead || lead.source !== 'outscraper') return null;

        const identity = await ctx.auth.getUserIdentity();
        const currentCreator = identity
            ? await ctx.db
                  .query('creators')
                  .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
                  .first()
            : null;

        let claimedBy: {
            creatorId: string;
            displayName: string;
            profileImage: string | null;
            isMine: boolean;
        } | null = null;
        const claimerId = (lead as any).claimedByCreatorId as Id<"creators"> | undefined;
        if (claimerId) {
            const c = await ctx.db.get(claimerId);
            if (c) {
                const first = (c.firstName ?? '').trim();
                const last = (c.lastName ?? '').trim();
                const displayName =
                    !first && !last
                        ? 'Unknown creator'
                        : !last
                            ? first
                            : `${first} ${last[0]}.`;
                claimedBy = {
                    creatorId: String(c._id),
                    displayName,
                    profileImage: c.profileImage ?? null,
                    isMine: !!currentCreator && String(c._id) === String(currentCreator._id),
                };
            }
        }

        const notes = await ctx.db
            .query('leadNotes')
            .withIndex('by_lead', (q) => q.eq('leadId', args.leadId))
            .order('desc')
            .collect();

        return {
            lead: {
                _id: lead._id,
                _creationTime: lead._creationTime,
                status: lead.status,
                phone: lead.phone ?? null,
                businessName: lead.businessName ?? null,
                businessAddress: lead.businessAddress ?? null,
                businessCity: lead.businessCity ?? null,
                businessCategory: lead.businessCategory ?? null,
                businessWebsite: lead.businessWebsite ?? null,
                businessLatitude: lead.businessLatitude ?? null,
                businessLongitude: lead.businessLongitude ?? null,
                businessRating: lead.businessRating ?? null,
                businessReviewCount: lead.businessReviewCount ?? null,
                businessGooglePlaceId: lead.businessGooglePlaceId ?? null,
                scrapedAt: lead.scrapedAt ?? null,
                createdAt: lead.createdAt,
                source: lead.source,
                claimedAt: (lead as any).claimedAt ?? null,
            },
            claimedBy,
            notes: notes.map((n) => ({
                _id: n._id,
                content: n.content,
                createdAt: n.createdAt,
                creatorId: n.creatorId ? String(n.creatorId) : null,
            })),
        };
    },
});

/**
 * Auto-release prospect claims older than 24 hours. Called hourly by the
 * crons.ts schedule so a creator who claims a lead and never interviews
 * doesn't permanently squat on it.
 */
export const releaseStaleClaimsInternal = internalMutation({
    args: {},
    handler: async (ctx) => {
        const threshold = Date.now() - 24 * 60 * 60 * 1000;
        const stale = await ctx.db
            .query('leads')
            .filter((q) =>
                q.and(
                    q.eq(q.field('source'), 'outscraper'),
                    q.eq(q.field('submissionId'), undefined),
                    q.neq(q.field('claimedAt'), undefined),
                    q.lt(q.field('claimedAt'), threshold),
                ),
            )
            .collect();
        for (const lead of stale) {
            await ctx.db.patch(lead._id, {
                claimedByCreatorId: undefined,
                claimedAt: undefined,
            });
        }
        return { released: stale.length };
    },
});

// (scrapeNearbyForCreator removed in 2026-05-28 refactor — the canonical
// scrapeNearby action above is now creator-callable, so the sibling export
// is no longer needed. Web + mobile share the same callable.)
