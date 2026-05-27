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
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";

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

/**
 * Admin-only: scrape Google Maps near a location, insert dedup'd leads.
 *
 * Args:
 *   - query: free-text category, e.g. "barbershop", "spa", "restaurant"
 *   - location: human-readable area (city/neighbourhood) — passed straight
 *     to Outscraper's `query` along with `query` so the API can geocode.
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
        const { me } = await requireAdmin(ctx);

        const apiKey = process.env.OUTSCRAPER_API_KEY;
        if (!apiKey) {
            throw new Error(
                "OUTSCRAPER_API_KEY is not set on this Convex deployment.",
            );
        }

        const limit = Math.min(args.limit ?? 20, 200);
        // Outscraper's Google Maps Search V3 — synchronous endpoint that
        // returns up to ~500 results per query when `async=false`.
        // Docs: https://app.outscraper.com/api-docs#tag/Google-Maps-Data
        const url = new URL("https://api.outscraper.com/maps/search-v3");
        url.searchParams.set(
            "query",
            `${args.query.trim()}, ${args.location.trim()}`,
        );
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("language", "en");
        url.searchParams.set("region", "PH");
        url.searchParams.set("async", "false");

        let payload: any;
        try {
            const res = await fetch(url.toString(), {
                method: "GET",
                headers: { "X-API-KEY": apiKey, Accept: "application/json" },
            });
            if (!res.ok) {
                const body = await res.text();
                throw new Error(
                    `Outscraper HTTP ${res.status}: ${body.slice(0, 300)}`,
                );
            }
            payload = await res.json();
        } catch (err: any) {
            throw new Error(`Outscraper request failed: ${err?.message ?? err}`);
        }

        // Outscraper returns: { data: [[ placeA, placeB, ... ]] } for a single
        // query, or { data: [[...], [...]] } for multi-query. We sent one, so
        // flatten the first sublist.
        const raw: OutscraperPlace[] = Array.isArray(payload?.data?.[0])
            ? payload.data[0]
            : Array.isArray(payload?.data)
                ? payload.data
                : [];

        const scrapedBy = me.clerkId;
        const scrapedAt = Date.now();
        let inserted = 0;
        let skipped = 0;

        for (const place of raw) {
            const placeId = place.google_id || place.place_id;
            if (!placeId || !place.name) {
                skipped++;
                continue;
            }
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
                    businessGooglePlaceId: placeId,
                    phone: place.phone || undefined,
                },
            );
            if (result.skipped) skipped++;
            else inserted++;
        }

        return { inserted, skipped, total: raw.length };
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
 * Admin-only: list all Outscraper-scraped leads, newest first.
 * Used by the web admin "Lead prospects" view.
 */
export const listScrapedLeads = query({
    args: {
        statusFilter: v.optional(
            v.union(
                v.literal("all"),
                v.literal("new"),
                v.literal("contacted"),
                v.literal("qualified"),
                v.literal("converted"),
                v.literal("lost"),
            ),
        ),
        search: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const all = await ctx.db.query("leads").collect();
        let scraped = all.filter((l) => l.source === "outscraper");

        const statusFilter = args.statusFilter ?? "all";
        if (statusFilter !== "all") {
            scraped = scraped.filter((l) => l.status === statusFilter);
        }

        const search = args.search?.trim().toLowerCase();
        if (search) {
            scraped = scraped.filter(
                (l) =>
                    l.businessName?.toLowerCase().includes(search) ||
                    l.businessCity?.toLowerCase().includes(search) ||
                    l.businessCategory?.toLowerCase().includes(search) ||
                    l.businessAddress?.toLowerCase().includes(search) ||
                    l.phone?.toLowerCase().includes(search),
            );
        }

        scraped.sort((a, b) => (b.scrapedAt ?? b.createdAt) - (a.scrapedAt ?? a.createdAt));

        return scraped.map((l) => ({
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
        }));
    },
});
