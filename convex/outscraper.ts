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

        const limit = Math.min(args.limit ?? 20, 200);
        const radiusKm = Math.max(0.5, args.radiusKm ?? 5);

        // 🛑 2026-05-28 FIX (per WEB-BUILD-CRM.md Outscraper query-format bug):
        // Outscraper's /maps/search-v3 endpoint silently drops `coordinates`
        // and `radius` when passed as separate query params, then runs the
        // category as a worldwide search, exceeds the synchronous budget,
        // and returns `data: [[]]`. The fix is to embed both inside the
        // query string per Outscraper's documented format:
        //   query=salon, 14.30,121.00, 3mi
        const radiusMiles = Math.max(1, Math.round(radiusKm * 0.621371));
        const userCategory = args.query.trim() || "businesses";
        const queryString = `${userCategory}, ${args.location.trim()}, ${radiusMiles}mi`;

        const url = new URL("https://api.outscraper.com/maps/search-v3");
        url.searchParams.set("query", queryString);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("language", "en");
        url.searchParams.set("region", "PH");
        url.searchParams.set("async", "false");

        console.log(
            `[outscraper] scrapeNearby → ${queryString} (limit=${limit})`,
        );

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

        // Guard against async fallback — if Outscraper couldn't satisfy the
        // request synchronously and returned a pending job descriptor, we
        // surface that rather than silently report "0 businesses found"
        // (which used to mask the original query-format bug).
        if (
            payload?.status === "Pending" ||
            (payload?.id && !payload?.data)
        ) {
            throw new Error(
                "Outscraper fell back to async mode for this query — try a smaller radius or a more specific category.",
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
