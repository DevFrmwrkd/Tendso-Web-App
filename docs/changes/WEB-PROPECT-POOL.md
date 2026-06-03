# Web-side implementation — Inventory-Driven Prospect Pool

> **Single self-contained brief for the web agent.** Hand this entire document to the agent / developer working in the web repo. Mobile has approved the architecture and is implementing the mobile-side consumers in parallel. This doc covers the web side's responsibilities: schema additions, new Convex functions, crons, migration, and the deploy ordering.
>
> **Created 2026-06-01. Approved 2026-06-01.** Mobile and web ship Phase 0 → Phase 4 in lockstep over ~9 working days.
>
> ---
>
> ## ✅ Phase 0 — SHIPPED on prod (2026-06-01 evening, by web agent)
>
> Web agent has completed P0: schema deployed, h3-js verified in Convex V8 runtime, h3_test.ts cleanup done. Mobile codegen has the new schema types.
>
> ## ✅ Phase 1 mobile-side spec is READY for porting (2026-06-01)
>
> Mobile has shipped the P1 spec on branch `feature/prospect-pool-p1` (or local — coordinate with mobile team). **Web agent: do these steps next:**
>
> 1. **Port `ndm/convex/prospects.ts`** verbatim to web repo's `convex/prospects.ts`. Contains:
>    - `searchNearby` (public query) — reads from prospect pool, sorts by qualityScore desc
>    - `getByPlaceId` (internal query) — dedup lookup helper
>    - `adjustInventory` (internal mutation) — atomic inventory counter, called by migration in P1 + state mutations in P2
> 2. **Port `ndm/convex/prospectsMigration.ts`** verbatim to web repo's `convex/prospectsMigration.ts`. Contains:
>    - `backfillProspects` (internal action) — paginates through outscraper-source leads, calls batch mutation per page
>    - `fetchBackfillPage` (internal query) — paginated read of leads needing migration
>    - `backfillBatch` (internal mutation) — atomic inserts + inventory updates + lead patches
>    - ⚠️ **Note the name**: NOT `migration.ts` — mobile renamed to `prospectsMigration.ts` to avoid collision with existing `convex/migrations.ts` (plural, unrelated cleanup migrations). Use the same name on web.
> 3. **`npx convex deploy --prod`** from the web repo
> 4. **Seed `category_locales`** with the 10 PH categories listed in §7 of this doc. Run from Convex dashboard's "Run function" panel — there's no auto-seeding code, it's a one-time dashboard write.
> 5. **Run the backfill manually** from Convex dashboard:
>    - Functions → `prospectsMigration` → `backfillProspects` → Run with args `{}` (or `{ batchSize: 50, countryDefault: "PH" }`)
>    - Watch logs for `[migration] page N: processed=X migrated=Y skipped=Z` lines
>    - Should complete in 30-90 seconds depending on lead count
>    - Final log line: `[migration] backfillProspects DONE — totalProcessed=N totalMigrated=M totalSkipped=K`
> 6. **Verify on mobile after deploy:**
>    - Open Convex Data tab → `prospects` table — should have rows
>    - Open `prospect_inventory` table — should have one row per (cell, category) with `availableCount` summing to total prospects
>    - On mobile, navigate to /leads/discover (without doing a fresh scrape) — the map should show pins from the pool. Debug strip will show `DEBUG · direct=0 · pool=N · legacy=M · with-coords=K` where N reflects the backfilled pool.
>
> **Mobile side coordination:** mobile's `discover.tsx` is already updated to dual-read from `prospects.searchNearby` (via a typed `any` cast since mobile's codegen can't refresh until web deploys). After web's P1 deploy, mobile can:
> 1. Optionally re-run `npx convex codegen` (when dev URL is reachable) to get strongly-typed `api.prospects.searchNearby`
> 2. Replace the `(api as any).prospects?.searchNearby` cast with `api.prospects.searchNearby`
> 3. Rebuild APK and the dual-read renders pool prospects in production
>
> **Files in mobile's P1 spec (already written, ready to port):**
> - `ndm/convex/prospects.ts` — searchNearby query, getByPlaceId helper, adjustInventory mutation
> - `ndm/convex/prospectsMigration.ts` — backfillProspects action + supporting query + batch mutation
> - `ndm/app/(app)/leads/discover.tsx` — already updated with the dual-read merge logic, debug strip shows per-source counts, no further mobile work for P1
>
> **What's intentionally NOT in P1 (saved for P2+):**
> - ❌ Reservation mutations (`reserve`, `markContacted`, etc.) — P2
> - ❌ `releaseExpiredReservations` cron — P2
> - ❌ Background `scrapeAndStore` action — P4
> - ❌ Replenishment cron — P4
> - ❌ Mobile UI changes for the "I'll interview this" → reserve flow — P2 mobile work

---

## 🔒 Hard rule — web is the sole deploy authority

> **Web repo is the only one allowed to run `npx convex deploy --prod`.** This is unchanged from every prior project convention. Mobile team CAN edit `ndm/convex/*.ts` files (for type generation, IDE autocomplete, and as the source spec for ports), but MUST NOT deploy.
>
> Every Convex change in this architecture — new schema, new functions, new crons, migrations — lands on prod ONLY when the web agent copies the change into the web repo and runs `npx convex deploy --prod`. If mobile-side `ndm/convex/*.ts` files drift from what's deployed, mobile codegen will pull stale types but the runtime will use the deployed shape. Web's deployed version is always authoritative.

---

## 1. TL;DR

### What's changing

Replace creator-triggered Outscraper scraping with a shared **global prospect pool**:

- Every business is scraped **once** and stored in a new `prospects` table
- H3 hexagonal cells partition geographic coverage; inventory is tracked per cell+category
- **No scrape happens when a creator taps Find Local Business.** They read from the pool. The pool stays stocked via background replenishment crons.
- **Cost goes from linear-with-creator-count to flat-with-coverage-area.** At 50K creators across PH+ID+VN: ~$1,500/mo vs. $20K+/mo today.

### Why this is on YOUR plate (web agent)

The change is 95% backend (Convex schema + functions + crons + migration). All of that lives in `convex/*.ts` files. Mobile team will implement the mobile-side UI consumers (`prospects.searchNearby` reads, new "reserve" button, etc.), but the deployable Convex code MUST come from the web repo.

### What you'll do

1. Port the schema additions (four new tables) from this doc into the web repo's `convex/schema.ts`
2. Add the new Convex functions (queries, mutations, actions) from this doc into the web repo's `convex/`
3. Add two new cron jobs to `convex/crons.ts`
4. Write the migration action that backfills existing `leads source="outscraper"` rows into `prospects`
5. Deploy in lockstep with mobile's phase rollouts
6. Build/update web UI to consume the new queries when ready (web's discover map should also switch to inventory reads)

---

## 2. Architecture in one paragraph

A new `prospects` table holds every business, globally deduplicated by `googlePlaceId`, with H3 cell IDs at resolutions 7/8/9 for spatial queries. A `prospect_inventory` table tracks `availableCount` per `(h3CellRes7, categoryBucket)`. When a creator taps Find Local Business, the client calls `prospects.searchNearby({ lat, lng, radiusKm })` — the server computes the user's H3 cell + `kRing(2)` neighbors, queries by index, returns up to N available prospects sorted by `qualityScore desc`. **No Outscraper call at request time.** A `replenishLowInventoryCells` cron runs every 30 minutes, finds cells where `availableCount < threshold`, and schedules `scrapeAndStore` actions that call Outscraper in async mode, dedupe by 4 layers (h3 coverage, place_id, normalized phone, name+proximity), and insert into `prospects`. A separate cron auto-releases expired reservations every hour.

For the full design rationale, cost analysis, and risk register, see [PROSPECT-POOL-ARCHITECTURE-2026-06.md](./PROSPECT-POOL-ARCHITECTURE-2026-06.md) — that doc is the architecture spec; this doc is the deploy recipe.

---

## 3. Schema additions — copy verbatim to web's `convex/schema.ts`

All four tables are additive — no changes to existing tables (with one tiny exception flagged at the end).

### 3.1 `prospects` table

```typescript
prospects: defineTable({
  // Identity (dedupe layer 2 — place_id is the primary key)
  googlePlaceId: v.string(),

  // Business metadata
  businessName: v.string(),
  normalizedName: v.string(),                  // lowercase, stripped, for dedup layer 4
  category: v.string(),                        // raw Outscraper category
  categoryBucket: v.string(),                  // normalized bucket (barbershop, restaurant, ...)
  address: v.optional(v.string()),
  phone: v.optional(v.string()),
  normalizedPhone: v.optional(v.string()),     // E.164 form, for dedup layer 3
  website: v.optional(v.string()),
  latitude: v.number(),
  longitude: v.number(),
  city: v.optional(v.string()),
  country: v.string(),                         // ISO 3166-1 alpha-2 ("PH", "ID", "VN")

  // H3 spatial index (dedup layer 1 + query path)
  h3CellRes7: v.string(),                      // ~5km hex, primary search key
  h3CellRes8: v.string(),                      // ~1km hex, finer-grained subdivision
  h3CellRes9: v.string(),                      // ~400m hex, block-level

  // Outscraper-supplied metadata
  rating: v.optional(v.number()),
  reviewCount: v.optional(v.number()),

  // State machine
  state: v.union(
    v.literal("available"),
    v.literal("reserved"),
    v.literal("contacted"),
    v.literal("qualified"),
    v.literal("converted"),
    v.literal("lost"),
  ),
  stateUpdatedAt: v.number(),

  // Reservation tracking
  reservedByCreatorId: v.optional(v.id("creators")),
  reservedAt: v.optional(v.number()),
  reservationExpiresAt: v.optional(v.number()),

  // Quality scoring
  qualityScore: v.number(),                    // 0-100

  // Provenance
  scrapedAt: v.number(),
  lastRefreshedAt: v.number(),
  scrapeJobId: v.optional(v.string()),

  // Conversion linkage
  submissionId: v.optional(v.id("submissions")),
})
  .index("by_place_id", ["googlePlaceId"])
  .index("by_h3_res7", ["h3CellRes7"])
  .index("by_h3_res7_and_category", ["h3CellRes7", "categoryBucket"])
  .index("by_h3_res7_and_state", ["h3CellRes7", "state"])
  .index("by_normalized_phone", ["normalizedPhone"])
  .index("by_state_and_reservation_expires", ["state", "reservationExpiresAt"])
  .index("by_reserved_creator", ["reservedByCreatorId"])
  .index("by_country_and_category", ["country", "categoryBucket"])
```

### 3.2 `prospect_inventory` table

```typescript
prospect_inventory: defineTable({
  h3CellRes7: v.string(),
  categoryBucket: v.string(),
  country: v.string(),

  availableCount: v.number(),
  reservedCount: v.number(),
  contactedCount: v.number(),
  qualifiedCount: v.number(),
  convertedCount: v.number(),
  lostCount: v.number(),

  lastScrapedAt: v.optional(v.number()),
  scrapesAttempted: v.number(),
  lastScrapeJobId: v.optional(v.string()),

  minAvailableThreshold: v.number(),

  updatedAt: v.number(),
})
  .index("by_h3_and_category", ["h3CellRes7", "categoryBucket"])
  .index("by_country_and_category_and_available", ["country", "categoryBucket", "availableCount"])
```

### 3.3 `scrape_history` table

```typescript
scrape_history: defineTable({
  jobId: v.string(),
  h3CellRes7: v.string(),
  h3CellRes8: v.optional(v.string()),
  categoryBucket: v.string(),
  country: v.string(),

  outscraperQuery: v.string(),
  outscraperCoordinates: v.string(),
  outscraperZoom: v.number(),
  outscraperLimit: v.number(),

  outscraperJobId: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
  ),

  rawResultCount: v.optional(v.number()),
  insertedCount: v.optional(v.number()),
  dedupedCount: v.optional(v.number()),
  hitLimitCap: v.optional(v.boolean()),

  estimatedCost: v.optional(v.number()),
  errorMessage: v.optional(v.string()),

  startedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_job_id", ["jobId"])
  .index("by_outscraper_job_id", ["outscraperJobId"])
  .index("by_h3_and_category", ["h3CellRes7", "categoryBucket"])
  .index("by_status_and_started", ["status", "startedAt"])
```

### 3.4 `category_locales` table

```typescript
category_locales: defineTable({
  country: v.string(),
  categoryBucket: v.string(),
  displayName: v.string(),
  outscraperQueries: v.array(v.string()),
  minAvailableThreshold: v.number(),
  scoringWeights: v.object({
    hasWebsite: v.number(),
    hasPhone: v.number(),
    reviewCountMultiplier: v.number(),
    minRating: v.number(),
  }),
  enabled: v.boolean(),
})
  .index("by_country_and_bucket", ["country", "categoryBucket"])
  .index("by_country_and_enabled", ["country", "enabled"])
```

### 3.5 One tiny existing-table addition

`submissions` table — add ONE optional field:

```typescript
// In your existing submissions table definition:
prospectId: v.optional(v.id("prospects")),   // links a captured interview to its source prospect
```

Keep the existing `prospectLeadId: v.optional(v.id("leads"))` field for back-compat during migration. Don't remove it yet.

**No other existing-table changes.** Specifically: **do NOT touch the `leads` table.** Existing customer-inquiry rows (`source: "website" / "qr_code" / "direct"`) stay exactly as they are. Outscraper-source rows in `leads` get migrated to `prospects` via the migration action below, but their original rows are kept until Phase M.4 cleanup.

---

## 4. New Convex functions — full list

### 4.1 Helpers (shared by everything below)

Create `convex/lib/h3.ts`:

```typescript
import * as h3 from "h3-js";

export function latLngToH3Cells(lat: number, lng: number): {
  res7: string;
  res8: string;
  res9: string;
} {
  return {
    res7: h3.latLngToCell(lat, lng, 7),
    res8: h3.latLngToCell(lat, lng, 8),
    res9: h3.latLngToCell(lat, lng, 9),
  };
}

export function getNeighborCellsRes7(centerCell: string, ringSize: number = 2): string[] {
  return h3.gridDisk(centerCell, ringSize);  // includes the center cell
}

export function cellChildrenRes8(parentRes7Cell: string): string[] {
  return h3.cellToChildren(parentRes7Cell, 8);  // 7 child cells
}

export function cellCentroid(cell: string): [lat: number, lng: number] {
  const [lat, lng] = h3.cellToLatLng(cell);
  return [lat, lng];
}
```

Install: `npm install h3-js` in the web repo. **Verify it loads in Convex's V8 runtime BEFORE writing dependent code** — see "Convex feasibility check" at the end.

Create `convex/lib/phone.ts` (mobile already has one — port verbatim from `ndm/convex/lib/phone.ts`):

```typescript
export function normalizePhone(raw: string | null | undefined, defaultCountry: "PH" | "ID" | "VN" = "PH"): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  // PH numbers often come as "09xx..." or "9xx..."; convert to +63
  if (defaultCountry === "PH") {
    if (digits.startsWith("09")) return "+63" + digits.slice(1);
    if (digits.startsWith("9") && digits.length === 10) return "+63" + digits;
  }
  // TODO: similar handlers for ID (+62) and VN (+84) when we expand
  return null;
}
```

Create `convex/lib/quality.ts`:

```typescript
import { Doc } from "../_generated/dataModel";

export function computeQualityScore(input: {
  hasWebsite: boolean;
  hasPhone: boolean;
  rating: number | null;
  reviewCount: number | null;
}, weights?: Doc<"category_locales">["scoringWeights"]): number {
  const w = weights ?? {
    hasWebsite: 25,
    hasPhone: 25,
    reviewCountMultiplier: 0.2,  // 0-30 capped
    minRating: 3.0,
  };
  let score = 0;
  if (input.hasWebsite) score += w.hasWebsite;
  if (input.hasPhone) score += w.hasPhone;
  if (input.reviewCount != null) score += Math.min(input.reviewCount * w.reviewCountMultiplier, 30);
  if (input.rating != null && input.rating > w.minRating) {
    score += Math.min((input.rating - w.minRating) * 10, 20);
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}
```

### 4.2 `convex/prospects.ts` — the public API surface

```typescript
import { query, mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import { latLngToH3Cells, getNeighborCellsRes7 } from "./lib/h3";
import { Id } from "./_generated/dataModel";

/**
 * PRIMARY READ — called by mobile + web discover map.
 * Returns up to `limit` available prospects from the user's H3 cell + neighbors,
 * sorted by quality score desc.
 */
export const searchNearby = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusKm: v.optional(v.number()),     // default 5 — controls how many H3 ring layers to include
    categoryBucket: v.optional(v.string()), // if absent, returns all categories
    limit: v.optional(v.number()),         // default 50
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const limit = Math.min(args.limit ?? 50, 200);

    // 5km ≈ 1 ring of res-7 neighbors; 10km ≈ 2 rings
    const ringSize = args.radiusKm && args.radiusKm > 5 ? 2 : 1;
    const { res7 } = latLngToH3Cells(args.lat, args.lng);
    const cells = getNeighborCellsRes7(res7, ringSize);

    // Query each cell, then merge + sort. Convex doesn't have multi-cell IN
    // queries, so we iterate. Each .withIndex call is O(log N).
    const all: any[] = [];
    for (const cell of cells) {
      const cellResults = args.categoryBucket
        ? await ctx.db
            .query("prospects")
            .withIndex("by_h3_res7_and_category", (q) =>
              q.eq("h3CellRes7", cell).eq("categoryBucket", args.categoryBucket!),
            )
            .filter((q) => q.eq(q.field("state"), "available"))
            .take(limit)
        : await ctx.db
            .query("prospects")
            .withIndex("by_h3_res7_and_state", (q) => q.eq("h3CellRes7", cell).eq("state", "available"))
            .take(limit);
      all.push(...cellResults);
    }

    // Sort by quality desc, take limit
    all.sort((a, b) => b.qualityScore - a.qualityScore);
    return all.slice(0, limit);
  },
});

/**
 * Reserve a prospect for the calling creator. State machine: available → reserved.
 * Decrements inventory.availableCount and increments inventory.reservedCount atomically.
 */
export const reserve = mutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) throw new Error("Prospect not found");
    if (prospect.state !== "available") {
      throw new Error(`Cannot reserve a prospect in state "${prospect.state}"`);
    }

    const creator = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!creator) throw new Error("Creator profile not found");

    const now = Date.now();
    const RESERVATION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h — decision #4 default

    await ctx.db.patch(args.prospectId, {
      state: "reserved",
      stateUpdatedAt: now,
      reservedByCreatorId: creator._id,
      reservedAt: now,
      reservationExpiresAt: now + RESERVATION_DURATION_MS,
    });

    // Inventory bookkeeping
    await ctx.runMutation(internal.prospects.adjustInventory, {
      h3CellRes7: prospect.h3CellRes7,
      categoryBucket: prospect.categoryBucket,
      country: prospect.country,
      from: "available",
      to: "reserved",
    });
  },
});

/**
 * Mark a reserved prospect as contacted (creator made initial outreach).
 * State: reserved → contacted.
 */
export const markContacted = mutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) throw new Error("Prospect not found");
    if (prospect.state !== "reserved") {
      throw new Error(`Cannot mark contacted from state "${prospect.state}"`);
    }
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!creator || prospect.reservedByCreatorId !== creator._id) {
      throw new Error("Only the reserving creator can mark contacted");
    }

    await ctx.db.patch(args.prospectId, {
      state: "contacted",
      stateUpdatedAt: Date.now(),
      reservationExpiresAt: undefined, // contacts don't auto-expire (cron does it on 7-day idle)
    });
    await ctx.runMutation(internal.prospects.adjustInventory, {
      h3CellRes7: prospect.h3CellRes7,
      categoryBucket: prospect.categoryBucket,
      country: prospect.country,
      from: "reserved",
      to: "contacted",
    });
  },
});

// Similar mutations: markQualified, markConverted, markLost, releaseReservation
// (see full spec — implementations follow the same pattern)
```

**Other mutations to implement (same pattern as `markContacted`):**
- `markQualified({ prospectId })` — contacted → qualified
- `markConverted({ prospectId, submissionId })` — qualified → converted, sets `submissionId` linkage
- `markLost({ prospectId, reason })` — any state → lost
- `releaseReservation({ prospectId })` — voluntary release, reserved → available

### 4.3 `convex/prospects.ts` — internal helpers

```typescript
/**
 * Internal helper — single source of truth for inventory count updates.
 * Called from every state-change mutation. Atomic — runs in the calling mutation's tx.
 */
export const adjustInventory = internalMutation({
  args: {
    h3CellRes7: v.string(),
    categoryBucket: v.string(),
    country: v.string(),
    from: v.union(v.literal("available"), v.literal("reserved"), v.literal("contacted"), v.literal("qualified"), v.literal("converted"), v.literal("lost")),
    to: v.union(v.literal("available"), v.literal("reserved"), v.literal("contacted"), v.literal("qualified"), v.literal("converted"), v.literal("lost")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("prospect_inventory")
      .withIndex("by_h3_and_category", (q) =>
        q.eq("h3CellRes7", args.h3CellRes7).eq("categoryBucket", args.categoryBucket),
      )
      .first();

    if (!existing) {
      // Create the inventory row on first insert
      const locale = await ctx.db
        .query("category_locales")
        .withIndex("by_country_and_bucket", (q) =>
          q.eq("country", args.country).eq("categoryBucket", args.categoryBucket),
        )
        .first();
      await ctx.db.insert("prospect_inventory", {
        h3CellRes7: args.h3CellRes7,
        categoryBucket: args.categoryBucket,
        country: args.country,
        availableCount: args.to === "available" ? 1 : 0,
        reservedCount: args.to === "reserved" ? 1 : 0,
        contactedCount: args.to === "contacted" ? 1 : 0,
        qualifiedCount: args.to === "qualified" ? 1 : 0,
        convertedCount: args.to === "converted" ? 1 : 0,
        lostCount: args.to === "lost" ? 1 : 0,
        scrapesAttempted: 0,
        minAvailableThreshold: locale?.minAvailableThreshold ?? 100,
        updatedAt: Date.now(),
      });
      return;
    }

    const countField = (state: typeof args.from): keyof typeof existing => `${state}Count` as any;
    await ctx.db.patch(existing._id, {
      [countField(args.from)]: Math.max(0, (existing[countField(args.from)] as number) - 1),
      [countField(args.to)]: (existing[countField(args.to)] as number) + 1,
      updatedAt: Date.now(),
    });
  },
});
```

### 4.4 `convex/scrape.ts` — the replenishment action

```typescript
import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { cellCentroid, latLngToH3Cells } from "./lib/h3";
import { normalizePhone } from "./lib/phone";
import { computeQualityScore } from "./lib/quality";

/**
 * Replenishment scrape — kicked off by cron, NOT by creator action.
 * Calls Outscraper async mode, polls until complete, inserts new prospects.
 */
export const scrapeAndStore = internalAction({
  args: {
    h3CellRes7: v.string(),
    categoryBucket: v.string(),
    country: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const locale = await ctx.runQuery(internal.prospects.getLocaleConfig, {
      country: args.country,
      categoryBucket: args.categoryBucket,
    });
    if (!locale || !locale.enabled) return;

    const [lat, lng] = cellCentroid(args.h3CellRes7);
    const jobId = `scrape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Log scrape attempt
    await ctx.runMutation(internal.prospects.recordScrapeStart, {
      jobId,
      h3CellRes7: args.h3CellRes7,
      categoryBucket: args.categoryBucket,
      country: args.country,
      outscraperQuery: locale.outscraperQueries.join(", "),
      outscraperCoordinates: `${lat},${lng}`,
      outscraperZoom: 13,
      outscraperLimit: 400,
    });

    // Fire Outscraper ASYNC mode (queues a job, returns immediately)
    const apiKey = process.env.OUTSCRAPER_API_KEY;
    const params = new URLSearchParams({
      query: locale.outscraperQueries.join(","), // batch of category synonyms
      coordinates: `${lat},${lng}`,
      zoom: "13",
      limit: "400",
      async: "true",
      language: "en",
      region: args.country,
    });

    const res = await fetch(`https://api.outscraper.com/maps/search?${params}`, {
      headers: { "X-API-KEY": apiKey!, Accept: "application/json" },
    });
    const submit = await res.json() as { id: string; status: string };
    await ctx.runMutation(internal.prospects.recordScrapeAsyncId, {
      jobId,
      outscraperJobId: submit.id,
    });

    // Poll for completion — schedule self to check in 30s
    await ctx.scheduler.runAfter(30 * 1000, internal.scrape.pollAndIngest, {
      jobId,
      outscraperJobId: submit.id,
      attemptNumber: 1,
    });
  },
});

export const pollAndIngest = internalAction({
  args: {
    jobId: v.string(),
    outscraperJobId: v.string(),
    attemptNumber: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Outscraper async result endpoint
    const apiKey = process.env.OUTSCRAPER_API_KEY;
    const res = await fetch(`https://api.outscraper.com/requests/${args.outscraperJobId}`, {
      headers: { "X-API-KEY": apiKey! },
    });
    const status = await res.json() as { status: string; data?: any[]; };

    if (status.status === "Pending" || status.status === "InProgress") {
      // Reschedule for another poll — max 20 attempts (20 × 30s = 10min)
      if (args.attemptNumber >= 20) {
        await ctx.runMutation(internal.prospects.recordScrapeFailed, {
          jobId: args.jobId,
          errorMessage: "Outscraper async job timed out after 10 min",
        });
        return;
      }
      await ctx.scheduler.runAfter(30 * 1000, internal.scrape.pollAndIngest, {
        jobId: args.jobId,
        outscraperJobId: args.outscraperJobId,
        attemptNumber: args.attemptNumber + 1,
      });
      return;
    }

    if (status.status !== "Success") {
      await ctx.runMutation(internal.prospects.recordScrapeFailed, {
        jobId: args.jobId,
        errorMessage: `Outscraper job failed with status: ${status.status}`,
      });
      return;
    }

    // Ingest results — flatten the nested data: [[{...}, {...}]]
    const businesses = Array.isArray(status.data?.[0]) ? status.data[0] : (status.data ?? []);
    const inserted = await ctx.runMutation(internal.prospects.ingestScrapeResults, {
      jobId: args.jobId,
      businesses,
    });

    await ctx.runMutation(internal.prospects.recordScrapeComplete, {
      jobId: args.jobId,
      rawResultCount: businesses.length,
      insertedCount: inserted,
      hitLimitCap: businesses.length >= 400,
    });

    // If we hit the cap → subdivide (P5)
    if (businesses.length >= 400) {
      await ctx.scheduler.runAfter(0, internal.scrape.subdivideAndScrape, {
        parentJobId: args.jobId,
      });
    }
  },
});

// ingestScrapeResults — internal mutation that handles all 4 dedup layers + quality scoring + inventory updates
// recordScrapeStart, recordScrapeAsyncId, recordScrapeComplete, recordScrapeFailed — write to scrape_history
// subdivideAndScrape — schedules child-cell scrapes when a parent hits the cap
```

### 4.5 `convex/migration.ts`

```typescript
/**
 * One-shot migration — backfills existing leads.source="outscraper" rows
 * into the new prospects table. Idempotent — re-running it skips already-migrated rows.
 *
 * Run this MANUALLY after schema deploy, from Convex dashboard's "Run function" panel.
 * DO NOT schedule on a cron.
 */
export const backfillProspects = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ migrated: number; skipped: number }> => {
    // Page through outscraper-source leads in batches of 100 — see full impl in mobile spec
    // For each:
    //   1. Skip if migratedToProspectId is set
    //   2. Compute H3 cells, normalize phone, compute quality score
    //   3. Insert into prospects (state: "available" or "reserved" depending on claimedByCreatorId)
    //   4. Update prospect_inventory atomically
    //   5. Patch the lead row with migratedToProspectId
    // Return counts.
    // ... full implementation in the mobile spec ...
  },
});
```

**Add one optional field to the existing `leads` table for migration traceability:**

```typescript
migratedToProspectId: v.optional(v.id("prospects")),
```

This is the only existing-table change beyond `submissions.prospectId`. Both are optional and additive.

---

## 5. New cron jobs — `convex/crons.ts`

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Existing crons remain unchanged. Add these two:

crons.interval(
  "replenish low inventory cells",
  { minutes: 30 },
  internal.scrape.replenishLowInventoryCells,
);

crons.interval(
  "release expired reservations",
  { minutes: 60 },
  internal.prospects.releaseExpiredReservations,
);

// Future (Phase 6):
// crons.interval("release stale contacts", { hours: 24 }, internal.prospects.releaseStaleContacts);
// crons.interval("refresh stale prospect data", { hours: 24 * 7 }, internal.prospects.refreshStale);

export default crons;
```

`replenishLowInventoryCells` implementation:

```typescript
export const replenishLowInventoryCells = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const lowCells = await ctx.runQuery(internal.prospects.findLowInventoryCells, {
      maxResults: 5, // throttle: max 5 scrape jobs per cron tick
    });
    for (const cell of lowCells) {
      await ctx.runAction(internal.scrape.scrapeAndStore, {
        h3CellRes7: cell.h3CellRes7,
        categoryBucket: cell.categoryBucket,
        country: cell.country,
      });
    }
  },
});

export const findLowInventoryCells = internalQuery({
  args: { maxResults: v.number() },
  handler: async (ctx, args) => {
    // Query prospect_inventory where availableCount < minAvailableThreshold
    // AND lastScrapedAt was > 2 hours ago (avoid hammering the same cell)
    // Order by (availableCount / minAvailableThreshold) asc — neediest first
    // Return top `maxResults` (default 5)
  },
});
```

---

## 6. Deploy ordering — coordinated with mobile

Mobile and web ship in lockstep across 5 phases. Web deploys at the END of each phase (after mobile pushes its consumer code to a feature branch).

| Phase | Web deploys (after mobile branch is ready) | Mobile feature visible to users |
|---|---|---|
| **P0** | Schema additions only (no functions yet, no behavior change) | Nothing — schema-only deploy |
| **P1** | `prospects.searchNearby`, `prospects.adjustInventory`, helpers (lib/h3, lib/phone, lib/quality), `migration.backfillProspects` (don't run yet) | Mobile's discover map dual-reads from `prospects.searchNearby` AND `outscraper.listScrapedLeads`, merges. Run the backfill from Convex dashboard manually after deploy. |
| **P2** | `prospects.reserve/markContacted/markQualified/markConverted/markLost/releaseReservation` + `releaseExpiredReservations` cron | Mobile UI swaps "I'll interview this" to use `prospects.reserve` |
| **P3** | (No new web work — inventory tracking is automatic from P2's mutations) | Inventory dashboard for admins (optional) |
| **P4** | `scrape.scrapeAndStore` + `pollAndIngest` + `replenishLowInventoryCells` cron + cost guards | First creator scrape after deploy doesn't trigger Outscraper — pool serves it. New scrapes happen automatically in the background. |

Subsequent phases (P5-P8) per the architecture doc — additive, no migration risk.

---

## 7. Operational config

### Convex environment variables (already set, don't change)

- `OUTSCRAPER_API_KEY` — unchanged
- `ADMIN_CLERK_IDS` — unchanged

### Convex environment variables — NEW

- `MAX_SCRAPES_PER_CRON_TICK` — default `5`, hard cap on jobs per cron run
- `MAX_SCRAPES_PER_DAY` — default `50`, daily budget guard
- `MONTHLY_SCRAPE_BUDGET_USD` — default `300` (decision #6 default — owner has flagged TBD; set this conservatively at $300 until real usage data accumulates)

The `scrapeAndStore` action MUST check these guards before firing the Outscraper request. If the day's budget is exhausted, skip and log a warning to `scrape_history` with status `failed` and `errorMessage: "daily budget cap reached"`.

### Seed data — `category_locales`

Pre-populate with 10 categories for PH. Run as a one-shot seed via Convex dashboard:

```typescript
[
  { country: "PH", categoryBucket: "barbershop",   displayName: "Barber Shop",   outscraperQueries: ["barbershop", "barber shop"], minAvailableThreshold: 100 },
  { country: "PH", categoryBucket: "hair_salon",   displayName: "Hair Salon",    outscraperQueries: ["hair salon", "salon"], minAvailableThreshold: 100 },
  { country: "PH", categoryBucket: "nail_salon",   displayName: "Nail Salon",    outscraperQueries: ["nail salon", "manicure"], minAvailableThreshold: 100 },
  { country: "PH", categoryBucket: "spa",          displayName: "Spa",           outscraperQueries: ["spa", "massage spa"], minAvailableThreshold: 50 },
  { country: "PH", categoryBucket: "auto_repair",  displayName: "Auto Repair",   outscraperQueries: ["auto repair", "mechanic", "vulcanizing"], minAvailableThreshold: 100 },
  { country: "PH", categoryBucket: "dental",       displayName: "Dental Clinic", outscraperQueries: ["dental clinic", "dentist"], minAvailableThreshold: 50 },
  { country: "PH", categoryBucket: "restaurant",   displayName: "Restaurant",    outscraperQueries: ["restaurant", "carinderia", "fastfood"], minAvailableThreshold: 200 },
  { country: "PH", categoryBucket: "cafe",         displayName: "Cafe",          outscraperQueries: ["cafe", "coffee shop"], minAvailableThreshold: 100 },
  { country: "PH", categoryBucket: "sari_sari",    displayName: "Sari-sari Store", outscraperQueries: ["sari-sari store", "convenience store"], minAvailableThreshold: 200 },
  { country: "PH", categoryBucket: "pharmacy",     displayName: "Pharmacy",      outscraperQueries: ["pharmacy", "drugstore"], minAvailableThreshold: 50 },
]
```

All with `scoringWeights: { hasWebsite: 25, hasPhone: 25, reviewCountMultiplier: 0.2, minRating: 3.0 }` and `enabled: true`.

---

## 8. Convex feasibility check — DO BEFORE P0 SCHEMA DEPLOY

Two unknowns to resolve in a 1-hour spike before locking the architecture:

### Check 1 — Does `h3-js` load in Convex's V8 runtime?

`h3-js` uses WASM under the hood. Convex actions run in V8 with WASM support, but verify it works:

```typescript
// convex/lib/h3-test.ts (delete after the check)
import * as h3 from "h3-js";
import { internalQuery } from "../_generated/server";

export const test = internalQuery({
  args: {},
  handler: async () => {
    const cell = h3.latLngToCell(14.5995, 120.9842, 7);
    return { cell, valid: h3.isValidCell(cell) };
  },
});
```

Run from Convex dashboard "Run function" panel. If it works, ship the H3 plan as-is. If it throws (WASM init failed), fall back to a pure-JS H3 port like `h3-js-pure` or compute cells on the mobile client before write.

### Check 2 — Does Convex tolerate the 7-index table?

`prospects` has 8 indexes. Convex's documented max is 32 per table. Sanity-check after the schema deploys (P0).

### Check 3 — Verify Outscraper async mode response shape

Trigger one async scrape from a dashboard "Run function" call BEFORE relying on it in `pollAndIngest`. Make sure the response shape matches what `pollAndIngest` expects (`{ status, data }`).

---

## 9. End-to-end verification (run after P4 deploy)

1. Seed `category_locales` with the 10 PH categories above
2. Manually invoke `internal.scrape.scrapeAndStore` for one cell+category from the dashboard (e.g., a Quezon City barbershop cell)
3. Check Convex prod logs — should see a `scrapeAndStore` log line, then a poll log line ~30s later, then completion
4. Open `prospects` table in Data tab — should see ~20-200 new rows with the new schema fields populated
5. Open `prospect_inventory` table — should see the `availableCount` for that cell+category updated
6. Open `scrape_history` table — should see the completed job
7. On mobile, tap Find Local Business from a location near that cell — pins should appear immediately, NO Outscraper call in the logs for the user's action

If all 7 steps pass, the system is working end-to-end. If step 7 still triggers an Outscraper call, mobile hasn't fully switched to `prospects.searchNearby` yet — file a mobile-side bug.

---

## 10. What you MUST NOT do

- ❌ **Do not allow mobile to run `npx convex deploy`.** Even with the new architecture, the rule stands. All deploys come from this web repo.
- ❌ **Do not modify the existing `leads` table schema beyond adding the one optional `migratedToProspectId` field.** Customer-inquiry leads stay as-is. Don't refactor.
- ❌ **Do not remove `outscraper.scrapeNearby` until Phase M.4.** Mobile and web both have fallback paths during the migration window. Removing prematurely will break the live discover map.
- ❌ **Do not skip the feasibility checks in §8.** If `h3-js` doesn't work in Convex, the entire architecture needs adjustment before P0.
- ❌ **Do not run `migration.backfillProspects` from a cron.** It's a one-shot, manually invoked from the dashboard. Running it on a cron will duplicate rows.
- ❌ **Do not exceed the budget guard (`MONTHLY_SCRAPE_BUDGET_USD`).** If the cron is scheduling more jobs than the daily/monthly cap allows, the `scrapeAndStore` action should refuse to fire. The guard is enforced server-side, not in the cron.

---

## 11. Open coordination items (mobile ↔ web)

Most decisions are baked into this doc. Two require ongoing coordination:

1. **Phase deploy cadence.** Mobile commits per-phase changes to a feature branch (`feature/prospect-pool-p0`, `-p1`, etc.). Web deploys each phase after mobile signals "ready." Suggested rhythm: 1 phase per 1-2 working days.
2. **Inventory threshold tuning.** Defaults are seeded at 100 (most categories), 50 (low-density), 200 (high-density). Adjust in `category_locales` based on first-month usage data — do this via a dashboard update, no code change needed.

---

## 12. Reference docs

- `ndm/docs/plans/PROSPECT-POOL-ARCHITECTURE-2026-06.md` — the full architecture rationale, cost analysis, and risk register. This doc is the deploy-time recipe; that doc is the why.
- `ndm/docs/plans/WEB-LEAD-CRM-CREATORS-PAGE.md` — existing web Creators platform brief. The prospect pool replaces the data source for the discover map; the UI pattern stays the same.
- `ndm/docs/plans/WEB-FIX-DRIVE-SYNC-2026-06-01.md` — separate concern (Drive sync), unrelated to this change.
- Mobile source of truth for the function signatures: `ndm/convex/prospects.ts`, `ndm/convex/scrape.ts`, `ndm/convex/lib/h3.ts`, `ndm/convex/migration.ts` (mobile will write these in parallel — web ports them).

---

## 13. Questions for the web agent to ask the project owner before P4

- **#6 from the architecture doc — monthly scrape budget ceiling.** Currently set conservatively at $300/month default. What's the real ceiling? (For comparison: estimated cost for full Metro Manila coverage at steady state is ~$100/month; aggressive 5-city PH coverage is ~$500/month.)

That's the only open product question. Everything else has been answered with proposed defaults.
