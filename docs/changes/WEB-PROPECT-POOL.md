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
>
> ---
>
> ## 🟢 Path B — Google Places hyper-local fix (2026-06-02)
>
> **Why this exists:** Outscraper Maps Search returns results ranked by Google's relevance/popularity algorithm, NOT by physical distance. A creator standing 50m from "PARES SA GARAHE" (a roadside food stall listed on Google Maps) gets back restaurants 1.2-1.7km away because Google ranks the bigger places higher. Even with `category="restaurant"` and `radius=1km`, the hyper-local stall is missing.
>
> **The fix:** Google Places API "Nearby Search" with `rankby=distance` ranks purely by physical distance, surfacing informal local businesses that Outscraper drops. We call BOTH APIs and merge results by `place_id`. Outscraper still owns wider-area coverage (>2km radius) because Places caps at 60 results across 3 paginated requests.
>
> **Cost impact for current scale:** $0 out-of-pocket. Google Cloud Maps Platform includes a $200/month free credit that covers ~6,250 Places Nearby Search calls per month. At present testing volume (~100 scrapes/month), this is well within the free tier.
>
> **Web agent: porting steps for Path B**
>
> 1. **Enable Places API on the existing Google Cloud project** (30 seconds, no new project needed):
>    - https://console.cloud.google.com → select the existing project (the one the Maps API key `AIzaSyAt-knwNJgQ-Nx5ZY5aZUC-T8sj8D3QZ7U` lives in — same project as `negosyo-digital`)
>    - APIs & Services → Library → search "Places API" → click → **Enable**
>    - The existing API key automatically gains Places API access — no new key needed
>    - Optional but recommended: API key → Edit → "Set application restriction" → "API restrictions" → check "Places API" so the same key can be reused
>
> 2. **Set the Convex env var** (the action reads `GOOGLE_PLACES_API_KEY` — graceful fallback if absent):
>    ```bash
>    npx convex env set GOOGLE_PLACES_API_KEY AIzaSyAt-knwNJgQ-Nx5ZY5aZUC-T8sj8D3QZ7U --prod
>    ```
>    (Reuses the existing Maps API key. If you'd rather scope a separate key for server-side Places usage, create a second key restricted to Places API only and use that instead.)
>
> 3. **Port mobile's `scrapeNearby` changes** from `ndm/convex/outscraper.ts` to the web repo's `convex/outscraper.ts`:
>    - Add the new constants: `GOOGLE_PLACES_NEARBY_URL`, `PLACES_HYPERLOCAL_RADIUS_KM`
>    - Add the new helper function: `mapCategoryToPlacesType(userCategory: string): string | undefined`
>    - Add the `PlacesNearbyResult` type
>    - Inject the hyper-local merge block right BEFORE the existing `return { inserted, skipped, total, businesses };` line (search for `[outscraper] returning to client:` log line — the merge sits immediately after that log)
>    - The merge is wrapped in try/catch — Places failures are non-fatal, scrape still returns Outscraper results
>
> 4. **Deploy:** `npx convex deploy --prod` from the web repo
>
> 5. **Verify after deploy:**
>    - Open Convex prod logs
>    - On mobile, tap Find Local Business with category `restaurant` and 1km radius
>    - Watch for new log lines:
>      - `[outscraper] hyper-local Places call → location=14.29,121.00 type=restaurant (radiusKm=1)`
>      - `[outscraper] Places returned N hyper-local businesses`
>      - `[outscraper] merged M new businesses from Places (total now X)`
>    - Discover map should now show businesses < 1km away. PARES SA GARAHE should appear.
>
> **Web creator page UI changes — implement on the web platform's `/creators/leads/discover` page**
>
> The merge happens server-side, so the web creator page's data flow doesn't change. BUT three UI polish items should be implemented to match what creators expect:
>
> 1. **Distance filter on the client** — when the user picks `radius=1km`, show ONLY businesses where `distanceKm <= 1`. The merged response can include businesses slightly beyond the radius (Places returns 20 nearest regardless of radius hint in `rankby=distance` mode). Filter client-side so the header sub-copy "20 businesses within 1km" is honest.
>
>    ```typescript
>    // In your web discover map's React component:
>    const filteredBusinesses = businesses.filter((b) => {
>      if (!userGps || b.businessLatitude == null || b.businessLongitude == null) return true;
>      const km = haversineKm(userGps, { lat: b.businessLatitude, lng: b.businessLongitude });
>      return km <= radiusKm;
>    });
>    ```
>
> 2. **Sub-copy accuracy** — match mobile. Show the filtered count, not the merged-total count:
>
>    ```typescript
>    const headerSubCopy = `${filteredBusinesses.length} ${category} businesses within ${radiusKm} km. Pin colors show categories.`;
>    ```
>
> 3. **"Hyper-local" indicator pin** — businesses that came from Places API (not Outscraper) should have a small badge or different pin style indicating they're hyper-local discovery hits. This signals trust to the creator ("the system found this one specifically because it's close to you"). One way: add a `source: 'outscraper' | 'places'` field to each business in the return shape (server-side change), then render a `[hyper-local]` mono-label badge next to the business name on the prospect card when source === 'places'.
>
>    Mobile has NOT shipped this badge in the current Path B implementation — both sources merge into the same business shape. If you want this visual distinction on web, propose it as a P-B.5 follow-up and we'll add a `discoveredVia` field to the server return.
>
> **What `mapCategoryToPlacesType` covers:**
>
> The category mapping is 1:1 with mobile's helper. Categories that map cleanly to Google Places types:
>
> | User category | Google Places `type` |
> |---|---|
> | barbershop, barber | `hair_care` |
> | hair salon, salon | `beauty_salon` |
> | nail, manicure | `beauty_salon` |
> | spa, massage | `spa` |
> | auto, mechanic | `car_repair` |
> | dental, dentist | `dentist` |
> | pharmacy, drugstore | `pharmacy` |
> | restaurant, carinderia, eatery | `restaurant` |
> | cafe, coffee | `cafe` |
> | bakery | `bakery` |
> | sari-sari, convenience | `convenience_store` |
> | grocery, supermarket | `supermarket` |
> | store, shop, mart | `store` |
> | (anything else) | undefined → falls back to radius-mode |
>
> When `mapCategoryToPlacesType` returns `undefined`, the Places call uses `radius=N` mode (not `rankby=distance`) — same approach Outscraper takes, just from Google directly.
>
> **What does NOT change on the existing Outscraper integration:**
>
> - ✅ `outscraper.scrapeNearby` args unchanged
> - ✅ Outscraper async-mode + query-format fixes from prior callouts still apply
> - ✅ The `__NO_PLACE_FOUND__` sentinel detection still applies
> - ✅ Mobile `discover.tsx` dual-read merge logic unchanged — businesses array is unified
> - ✅ The P4 background `scrapeAndStore` (future) will use the SAME Path B merge pattern so the inventory pool gets the benefit too
>
> **Files in mobile's Path B spec (already written, ready to port):**
> - `ndm/convex/outscraper.ts` — Places API integration in `scrapeNearby`, new `mapCategoryToPlacesType` helper, `PlacesNearbyResult` type, two new constants
>
> **What's NOT in Path B (would be a P-B.2 enhancement):**
> - ❌ Fetching business phone/website via Places Details API (extra cost ~$0.017/call × 20 results = $0.34/scrape — only do if creators report missing phone/website on hyper-local businesses)
> - ❌ Pagination beyond the first 20 Places results (Places caps at 60 total, but each extra page costs and adds latency)
> - ❌ Separate `source: 'outscraper' | 'places'` field on returned businesses (proposed for P-B.5 if web UI wants to badge them differently)
>
> ---
>
> ## ⚡ REVISED 2026-06 — On-demand only, NO crons
>
> **Project owner revised the architecture.** Per the updated spec, the platform must operate on a purely on-demand model — NO scheduled jobs, NO background replenishment, NO time-based refresh. Mobile has reworked the spec to match. **Web agent: deploy this revision instead of the original P4 cron-driven design.**
>
> ### What changed vs the pre-revision spec
>
> | Component | Pre-revision (cron-driven) | Revised (on-demand) |
> |---|---|---|
> | Scrape trigger | `replenishLowInventoryCells` cron every 30 min | Triggered only by creator's tap on Find Local Business, only if pool is insufficient |
> | Reservation expiry | `releaseExpiredReservations` cron every 60 min | Lazy filter in `searchNearby` + reclaim-on-reserve in `reserve` mutation |
> | Outscraper mode | Async (queue + poll, cron-driven) | Async BATCH MODE with inline polling — user waits 30-90s for a 400-result scrape (8× more results per call than sync) |
> | Cost model | Predictable daily budget | Zero scrapes when pool serves the request, scrape only when needed |
> | `crons.ts` entries added | 2 | **0** |
>
> ### Explicit restrictions (per the revised spec, do NOT implement)
>
> - ❌ Cron jobs
> - ❌ Scheduled jobs
> - ❌ Nightly / hourly scraping
> - ❌ Automatic inventory replenishment
> - ❌ Time-based refresh logic
> - ❌ Background scraping without a creator request
>
> ### 🔥 Async batch mode (2026-06, later revision)
>
> Earlier revision used Outscraper's **sync mode** (`async=false`, ~50 results per call, 5-30s response). After review, the project owner requested **async batch mode** (per spec item #4: "Use async batch requests") to minimize total Outscraper API calls.
>
> **The change in one paragraph:** scrapeNearby and scrapeOnDemandSync now submit jobs to Outscraper's async endpoint (`async=true`), then poll the `/requests/{jobId}` endpoint every 5 seconds inside the same action for up to 5 minutes. When the job completes (typically 30-90s), results are parsed and ingested as before. The action stays within Convex's 10-minute budget. The user IS waiting — they see a 30-90s loading state instead of 5-30s — but the trade-off is worth it because **one async call returns up to 400 results (vs ~50 in sync mode)**, so the pool grows 8× faster per scrape.
>
> **Why this is cheaper at steady state:**
>
> Per-result cost from Outscraper is identical between sync and async (~$0.001 per business). But the unit economics are different:
>
> | Mode | Results / call | Cost / call | Pool growth | Future creators served by one scrape |
> |---|---|---|---|---|
> | Sync (prior) | ~50 | ~$0.05 | +50 prospects | ~5-10 |
> | Async batch (current) | ~400 | ~$0.40 | +400 prospects | ~50-100 |
>
> The cost-per-future-creator drops by ~5×. One async-batch scrape stocks the area's pool for 10× longer than a sync scrape would.
>
> **What the code change looks like (porting checklist):**
>
> When porting `ndm/convex/scrape.ts` (Step 3 below) and `ndm/convex/outscraper.ts` (Step 4 below), port these exact additions:
>
> 1. **Constants** — both files declare:
>    ```typescript
>    const ASYNC_POLL_INTERVAL_MS = 5000;
>    const ASYNC_POLL_MAX_ATTEMPTS = 60;  // 5 minutes total
>    // scrape.ts also has:
>    const ASYNC_SCRAPE_LIMIT = 400;       // was SYNC_SCRAPE_LIMIT = 50
>    const ASYNC_SCRAPE_ZOOM = 14;
>    // outscraper.ts has:
>    const MAX_LIMIT = 400;                 // was 50
>    const DEFAULT_LIMIT = 400;             // was 20
>    ```
>
> 2. **Submit params** — `async: "true"` (was `"false"`)
>
> 3. **Poll loop** — added INLINE inside the action, runs after the submit POST:
>    ```typescript
>    for (let attempt = 1; attempt <= ASYNC_POLL_MAX_ATTEMPTS; attempt++) {
>      await new Promise((resolve) => setTimeout(resolve, ASYNC_POLL_INTERVAL_MS));
>      const pollRes = await fetch(`https://api.outscraper.com/requests/${outscraperJobId}`, ...);
>      const pollPayload = await pollRes.json();
>      const status = (pollPayload.status ?? "").toLowerCase();
>      if (status === "success") { /* parse data, break */ }
>      if (status === "failed" || status === "error") { /* throw */ }
>      // else still pending — keep looping
>    }
>    ```
>
> 4. **Error handling** — distinguish HTTP failure (transient, keep retrying) from Outscraper-reported failure (terminal, abort with recordScrapeFailed)
>
> 5. **Convex action timeout headroom** — keep the poll budget at 5 minutes (60 × 5s). Convex actions have a 10-minute hard timeout. Leave 5 minutes of headroom for the ingestScrapeResults mutation + adaptive subdivision scheduling.
>
> **UX implication for mobile:**
>
> The 3-stage scrape loader on `discover.tsx` now shows for 30-90s instead of 5-30s. Mobile DID NOT change loader copy in this revision — the existing copy ("Finding businesses nearby…" etc.) is still accurate. If creators complain about the longer wait, consider adding a "Stocking the local database…" stage. For now, mobile considers it acceptable because:
> - Creators tap once and walk to a business — the wait happens while they're moving
> - Subsequent taps in the same area serve from the pool **instantly** (no Outscraper call)
> - The pool grows enough on first scrape that the wait usually only happens once per area
>
> ### What you'll do (high level)
>
> 1. Port `ndm/convex/prospects.ts` — 6 reservation mutations + 6 internal helpers (no cron handler, no findLowInventoryCells)
> 2. Port `ndm/convex/scrape.ts` — **async-batch-mode** `scrapeOnDemandSync` action with inline polling + adaptive subdivision (no cron, polling is INLINE inside the action)
> 3. Port `ndm/convex/outscraper.ts` — `scrapeNearby` is now POOL-AWARE: pool check first, async batch scrape if insufficient (400-result limit), inserts results to prospects table
> 4. `convex/crons.ts` — add NO new crons. The 2 entries from the pre-revision spec must NOT be added.
> 5. `npx convex deploy --prod`
> 6. Verify end-to-end
>
> ### Step-by-step
>
> **Step 1 — Port reservation mutations to web's `convex/prospects.ts`**
>
> Mobile added these exports to `ndm/convex/prospects.ts`. Copy verbatim:
>
> - `reserve(prospectId)` — available → reserved; **also accepts lazy-expired reservations** (state=reserved, expiry passed) and reclaims them. This replaces the cron-based release.
> - `markContacted(prospectId)` — reserved → contacted
> - `markQualified(prospectId)` — contacted → qualified
> - `markConverted(prospectId, submissionId)` — any → converted, links submission
> - `markLost(prospectId, reason?)` — any non-terminal → lost
> - `releaseReservation(prospectId)` — reserved → available (voluntary)
>
> **Step 2 — Port the read-side helpers to `convex/prospects.ts`**
>
> - `searchNearby` (public query) — same as P1 but now **lazy-filters expired reservations** in the result set so they appear as available without writing state back
> - `searchNearbyInternal` (internal query) — same logic, callable from actions. Used by `outscraper.scrapeNearby` for the pool check.
> - `countAvailableInCell` (internal query) — counts available prospects in a single (cell, category) pair
> - `getLocaleConfig` (internal query) — fetches category_locales row
> - `recordScrapeStart`, `recordScrapeAsyncId`, `recordScrapeComplete`, `recordScrapeFailed` — scrape_history tracking (kept for audit even though scrape is now on-demand)
> - `ingestScrapeResults` — the 4-layer dedup + quality scoring + inventory aggregation mutation (unchanged from pre-revision)
> - `adjustInventory` — atomic inventory counter (unchanged)
>
> **What you will NOT see in mobile's `prospects.ts` (and must NOT port):**
> - ❌ `releaseExpiredReservations` — was the cron handler. Lazy filter replaces it.
> - ❌ `findLowInventoryCells` — was for the cron. The pool-aware `scrapeNearby` doesn't need it.
>
> **Step 3 — Port `convex/scrape.ts`** (NEW FILE — replaces the pre-revision version)
>
> Port verbatim from `ndm/convex/scrape.ts`. Contains:
>
> - `scrapeOnDemandSync` (internal action) — **NOTE: name is legacy. Implementation is now async-batch mode with inline polling.** Submits a 400-result Outscraper async job, polls every 5s for up to 5 min, ingests into prospects. Called only from on-demand flows.
> - `subdivideAndScrape` (internal action) — P5 adaptive subdivision when an async scrape hits the 400-result cap. Still on-demand (parent action triggered it).
> - `getJob` (internal query) — fetches scrape_history rows for traceability
>
> **What was REMOVED from scrape.ts in the revision (must NOT port):**
> - ❌ `replenishLowInventoryCells` — was the cron handler. Gone.
> - ❌ `countScrapesLast24h` — was for the cron's daily budget guard. Gone.
> - ❌ `pollAndIngest` as a separate scheduled action — polling is now INLINE inside `scrapeOnDemandSync` since the user is waiting. Don't port `pollAndIngest` as a free-standing action.
> - ❌ `scrapeAndStore` (cron-mode async version) — replaced by `scrapeOnDemandSync`
>
> **Step 4 — Port `convex/outscraper.ts` `scrapeNearby` (POOL-AWARE + ASYNC BATCH)**
>
> The existing `scrapeNearby` action now has THREE blocks bolted on (one of them new in this revision):
>
> 1. **Pool check at the top.** Before any Outscraper call, it queries `prospects.searchNearbyInternal` for the user's area + category. If pool has ≥ 10 available prospects, it converts them to the businesses array shape and returns immediately — **zero API cost, instant response.**
>
> 2. **🔥 NEW — Async-batch Outscraper submission + inline polling.** When the pool is insufficient, the action:
>    - Submits a 400-result Outscraper job with `async=true`
>    - Polls the `/requests/{jobId}` endpoint every 5s for up to 5 min
>    - When the job reaches "Success" status, parses the data
>    - This replaces the prior sync-mode single-shot fetch
>    - **The function's external return signature is unchanged** — mobile callers see the same businesses array shape, just with up to 400 items instead of ~50, after a 30-90s wait instead of 5-30s
>
> 3. **Pool ingest at the bottom.** After the async results + Places merge produce the final `businesses` array, ALL of those businesses are inserted into the `prospects` table via `ingestScrapeResults`. Subsequent requests to the same area get served from the pool for free.
>
> The function's external signature is unchanged. Mobile callers continue to use it. The behavior shift is internal: pool-first, async-batch-scrape-as-fallback, always-archive.
>
> **Step 5 — `convex/crons.ts` should have NO new entries**
>
> If your `convex/crons.ts` has any of these, DELETE them now:
>
> ```typescript
> // ❌ DELETE — these were from the pre-revision spec
> crons.interval("replenish low inventory cells", { minutes: 30 }, internal.scrape.replenishLowInventoryCells);
> crons.interval("release expired prospect reservations", { minutes: 60 }, internal.prospects.releaseExpiredReservations);
> ```
>
> The only cron in `crons.ts` should be the existing `aggregate monthly stats` daily entry. Nothing else from this architecture.
>
> **Step 6 — Convex env vars**
>
> NO new env vars are required by the revision. Specifically, these from the pre-revision spec are NOT needed:
>
> - ❌ `MAX_SCRAPES_PER_CRON_TICK` — no cron
> - ❌ `MAX_SCRAPES_PER_DAY` — no cron
> - ❌ `MONTHLY_SCRAPE_BUDGET_USD` — no scheduled spend to cap
>
> Existing env vars stay:
> - ✅ `OUTSCRAPER_API_KEY`
> - ✅ `GOOGLE_PLACES_API_KEY` (for Path B hyper-local merge)
> - ✅ `ADMIN_CLERK_IDS`
>
> **Step 7 — Deploy**
>
> ```bash
> npx convex deploy --prod
> ```
>
> **Step 8 — Verify (after deploy)**
>
> | Check | How |
> |---|---|
> | No new crons appear | Convex dashboard → Schedules tab — should show ONLY the pre-existing `aggregate monthly stats` |
> | First Find Local Business tap triggers Outscraper async | Watch Convex logs for `[outscraper] pool check: found 0 existing prospects` followed by `[outscraper] scrapeNearby (async batch) → query=...` then `[outscraper] async job submitted → outscraperJobId=...` |
> | Inline polling progresses | Logs show `[outscraper] async still pending (attempt 6/60, status=Pending)` lines every ~30s while waiting |
> | Async completes within budget | Logs show `[outscraper] async job complete after N poll(s) (~Xs)` typically within 30-90s |
> | Second tap in the same area serves from pool | Tap Find Local Business again with the same location/category → logs show `[outscraper] pool sufficient — skipping Outscraper, serving from pool` (instant response, no async polling) |
> | Prospects accumulate in pool | After each scrape, watch `prospects` table grow — async mode means ~400 new rows per fresh scrape (vs ~50 in the prior sync version) + `[outscraper] pool ingest: N new prospects added to global pool` |
> | Cap-hit triggers subdivision | If a single area returns 400 results (cap hit), logs show `[scrape] hit cap of 400, scheduling on-demand subdivision for jobId=...` followed by 7 child scrapes |
> | Lazy reservation release works | Reserve a prospect, manually patch `reservationExpiresAt` to past in Convex Data tab. Next searchNearby surfaces it; next reserve call from a different creator succeeds. |
>
> **Step 9 — Mobile UI is ready to consume immediately**
>
> Mobile's `discover.tsx` already has the **"I'll interview this"** Door from the P2 work and consumes `prospects.reserve`. No further mobile UI changes for the revision. Just rebuild the APK after web deploys.
>
> **Files in the revised spec (already written, ready to port):**
> - `ndm/convex/prospects.ts` — reservation mutations + lazy-release in searchNearby + countAvailableInCell + ingestScrapeResults + helpers (NO cron handler)
> - `ndm/convex/scrape.ts` — `scrapeOnDemandSync` + `subdivideAndScrape` + `getJob` (NO cron, NO async polling)
> - `ndm/convex/outscraper.ts` — `scrapeNearby` now pool-aware (pool check + pool ingest blocks)
> - `ndm/convex/crons.ts` — pristine, only the pre-existing `aggregate monthly stats` cron
> - `ndm/app/(app)/leads/discover.tsx` — already has the reserve button from P2 work
>
> ### Cost outlook under the revised on-demand + async-batch model
>
> Outscraper cost is bounded by **actual creator demand**, not a scheduled job. Each creator request either:
>
> - Hits the pool → **$0**
> - Pool is empty for that area/category → triggers one Outscraper **async batch** call → ~$0.40 per call (up to 400 results × $0.001)
>
> The pool only grows. The first creator in a new area pays the async-batch cost. Every subsequent creator in that area gets free pool results (the data is permanent — no refresh schedule).
>
> **Why async batch is cheaper at steady state despite higher per-call cost:**
>
> One 400-result async call costs $0.40 and stocks the pool for ~50-100 future creator requests in that area. Compare to the prior sync mode where one 50-result call cost $0.05 and stocked the pool for only ~5-10 future requests.
>
> | Mode | Cost / call | Pool growth / call | Future creators served / scrape | Effective cost / creator served |
> |---|---|---|---|---|
> | Sync (prior) | $0.05 | +50 | 5-10 | ~$0.005-$0.010 |
> | Async batch (current) | $0.40 | +400 | 50-100 | ~$0.004-$0.008 |
>
> Async batch is **20-50% cheaper per creator served** because the larger batch defrays the cost across more pool hits.
>
> At 100 creators each making 5 unique-area scrapes/week:
> - First week: ~500 area-touches; ~80% hit the pool after week 1's bootstrap. Bootstrap ~30 fresh scrapes × $0.40 = $12 → covered by $30 AppSumo → **$0**
> - Week 2+: most requests hit the pool, maybe 10-20 fresh scrapes/week × $0.40 = $4-8/week → **$15-30/month, mostly covered by AppSumo**
>
> At 1,000 creators: similar steady-state cost because creators search overlapping areas already in the pool.
>
> At 10K-50K creators: cost stays roughly flat because the pool saturates after ~30 days of activity. Estimated $30-80/month, mostly covered by AppSumo.
>
> **Adaptive subdivision cost:** if a 400-result scrape hits the cap, the action schedules 7 child scrapes (one per H3 res-8 hex). Worst case: 8 × $0.40 = $3.20 for one super-dense area. The pool gain is correspondingly large (~3,200 prospects), so it still amortizes well. Only triggers on truly dense urban cores (Makati CBD, BGC, etc.).
>
> ### 🛠 Field-test fixes (2026-06-04)
>
> After the first APK rebuild against the revised architecture, three issues surfaced in real use. All three were fixed mobile-side; **the fixes below need to be ported to web for parity.**
>
> **Fix #1 — "(business unavailable)" labels on team feed cards**
>
> The `leads.listForMobileCRM` query was rendering "(business unavailable)" for every lead that didn't have a linked submission. The lead row itself carries `lead.businessName` (populated by Outscraper-source leads and by `markConverted` from a reserved prospect), but the query was only checking `submission?.businessName`.
>
> Port this change to web's `convex/leads.ts` `listForMobileCRM` query, in the enrichment map block:
>
> ```typescript
> // BEFORE — only checked submission
> businessName: submission?.businessName ?? "(business unavailable)",
> businessType: submission?.businessType ?? null,
> businessCity: submission?.city ?? null,
> businessAddress: submission?.address ?? null,
>
> // AFTER — fall back to the lead row's own fields
> businessName:
>   submission?.businessName ??
>   lead.businessName ??
>   "(business unavailable)",
> businessType: submission?.businessType ?? lead.businessCategory ?? null,
> businessCity: submission?.city ?? lead.businessCity ?? null,
> businessAddress: submission?.address ?? lead.businessAddress ?? null,
> ```
>
> Existing leads in production with the bug will display their real business names after the web redeploy. No data migration needed — the data was always there, the query just wasn't reading it.
>
> **Fix #2 — New `listMyReservations` query (powers the "Reserved" filter chip)**
>
> Mobile's leads page now has a `Reserved` filter chip between `All` and `New`. Selecting it shows the creator their active reservations — prospects they've reserved but haven't yet interviewed, with a countdown timer until the 24h expiry.
>
> Port this new public query to web's `convex/prospects.ts`, right after `searchNearbyInternal`:
>
> ```typescript
> export const listMyReservations = query({
>   args: {},
>   handler: async (ctx) => {
>     const identity = await requireAuth(ctx);
>     const creator = await ctx.db
>       .query("creators")
>       .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
>       .first();
>     if (!creator) return [];
>
>     const now = Date.now();
>     const all = await ctx.db
>       .query("prospects")
>       .withIndex("by_reserved_creator", (q) => q.eq("reservedByCreatorId", creator._id))
>       .collect();
>
>     // Filter expired reservations — lazy release means they're claimable
>     // again by anyone, so they shouldn't show in the creator's "yours" view
>     const active = all.filter(
>       (p) =>
>         p.state === "reserved" &&
>         typeof p.reservationExpiresAt === "number" &&
>         p.reservationExpiresAt > now,
>     );
>
>     active.sort((a, b) => (b.reservedAt ?? 0) - (a.reservedAt ?? 0));
>     return active;
>   },
> });
> ```
>
> Uses the existing `by_reserved_creator` index from the prospects table schema — no new index needed. Returns the full prospect rows; mobile renders timer + business name + tap-to-open-in-Maps button.
>
> The web Creators page should also surface this query in its own equivalent UI — recommended: a "Reserved" tab/filter on the web `/creators/leads` page showing the same data. Web's existing lead list already groups by status; just add a new group/filter "Reserved" that calls `prospects.listMyReservations` and renders the prospect data shape instead of the lead data shape.
>
> **Fix #3 — Hyper-local distance tightening**
>
> Creators reported the scrape returning businesses 1-1.5km away even when they asked for a 1km radius. Three changes land:
>
> 1. **Mobile-side hard distance filter** — `discover.tsx` now drops any business where `haversineKm(userGps, business) > radiusKm`. **Web's equivalent discover map should do the same.** The merge response from `outscraper.scrapeNearby` can include businesses slightly beyond the requested radius (Outscraper's relevance ranking + Places returning 20 nearest regardless of distance hint). Filter client-side so the header copy stays honest.
>
> 2. **New 0.5km radius option** — added a "500 m" pill alongside the existing 1/3/5/10 km options. Web's equivalent radius picker should add the same option.
>
> 3. **Outscraper zoom bump for sub-1km radii** — port this change to web's `convex/outscraper.ts` `scrapeNearby`:
>
>    ```typescript
>    // BEFORE
>    let zoom = 13;
>    if (radiusKm <= 1) zoom = 15;
>    else if (radiusKm <= 3) zoom = 14;
>    // ...
>
>    // AFTER — added 0.5km → zoom 16 (block-level)
>    let zoom = 13;
>    if (radiusKm <= 0.5) zoom = 16;
>    else if (radiusKm <= 1) zoom = 15;
>    else if (radiusKm <= 3) zoom = 14;
>    // ...
>    ```
>
> Zoom 16 forces Outscraper to favor block-level results, which is how informal businesses (the "PARES SA GARAHE" class of leads) surface ahead of the popular far-away restaurants Google's relevance ranking otherwise pushes to the top.
>
> Mobile also bumped the default `scrapeRadiusKm` from 5km to **1km** so out-of-the-box behavior is hyper-local. Web should do the same on its discover page default.
>
> **Fix #4 — "Show direction" fallback CTA for phoneless leads**
>
> Many scraped leads (especially informal Filipino businesses) have no phone number on Google Maps. The team feed cards previously rendered an empty mono line where the phone would be, leaving creators with no obvious next action. The fix:
>
> - **Add three new fields to `listForMobileCRM`'s return shape** (web's `convex/leads.ts`):
>
>   ```typescript
>   // Add to the existing return object inside the enrichment .map block:
>   businessLatitude: lead.businessLatitude ?? null,
>   businessLongitude: lead.businessLongitude ?? null,
>   businessGooglePlaceId: lead.businessGooglePlaceId ?? null,
>   ```
>
>   These already exist on the `leads` table schema; the query just wasn't returning them. No schema change required.
>
> - **Web's lead card UI should render a "Show direction" inline button** whenever `lead.phone` and `lead.email` are both empty AND any of (lat+lng, googlePlaceId, businessName) are present. Tapping it opens a Google Maps directions URL:
>
>   ```typescript
>   function buildDirectionsUrl(lead) {
>     if (lead.businessLatitude != null && lead.businessLongitude != null) {
>       const placeQuery = lead.businessGooglePlaceId
>         ? `&query_place_id=${encodeURIComponent(lead.businessGooglePlaceId)}`
>         : '';
>       return `https://www.google.com/maps/search/?api=1&query=${lead.businessLatitude},${lead.businessLongitude}${placeQuery}`;
>     }
>     if (lead.businessName && lead.businessName !== '(business unavailable)') {
>       const q = encodeURIComponent(
>         lead.businessCity ? `${lead.businessName} ${lead.businessCity}` : lead.businessName,
>       );
>       return `https://www.google.com/maps/search/?api=1&query=${q}`;
>     }
>     return null;
>   }
>   ```
>
>   When even the business name is missing (`"(business unavailable)"`), render "no contact on file" italic as a final fallback. Mobile uses the green accent pill style for the Show direction button; web can use its own equivalent.
>
> **Fix #5 — Removed debug strip from discover map empty state**
>
> The discover map's empty state previously rendered `DEBUG · direct=N · pool=M · legacy=K · with-coords=X` as a tiny mono line. The dual-read fallback is stable now, the per-source counts no longer carry diagnostic value, and it was visible to creators. Removed mobile-side; web's equivalent discover empty state should drop any similar debug line if present.
>
> **Files in this revision (already written mobile-side, ready to port):**
> - `ndm/convex/leads.ts` — `listForMobileCRM` enrichment block (Fix #1 + Fix #4 new fields)
> - `ndm/convex/prospects.ts` — new `listMyReservations` query (Fix #2)
> - `ndm/convex/outscraper.ts` — zoom 16 for 0.5km radius (Fix #3)
> - `ndm/app/(app)/leads/index.tsx` — Reserved chip + ReservedCard + 0.5km radius pill + default radius 1km + Show direction fallback in CompactCard (mobile-only, web should mirror Fix #4 CTA on its own card component)
> - `ndm/app/(app)/leads/discover.tsx` — hard distance filter + 500m header label + debug strip removed (Fix #5) (mobile-only, web should mirror)
>
> ### Hard rules — what you MUST NOT do (still)
>
> - ❌ Mobile must not run `npx convex deploy`. Same rule, every deploy.
> - ❌ Do NOT add ANY crons under this architecture. Spec is explicit.
> - ❌ Do NOT remove the existing `outscraper.scrapeNearby`. It's the on-demand entry point now.
> - ❌ Do NOT touch `migratedToProspectId` on leads until P8 cleanup (deferred).
> - ❌ Do NOT seed prospects manually via dashboard — let the on-demand flow populate them through `ingestScrapeResults`.
>
> ---
>
> <details>
> <summary><strong>📦 ARCHIVED — Pre-revision cron-driven architecture (do NOT implement)</strong></summary>
>
> The original P2-P8 spec called for `replenishLowInventoryCells` and `releaseExpiredReservations` crons running every 30 and 60 minutes respectively. The project owner revised the spec on 2026-06 to remove all scheduled scraping. The cron-driven design is preserved below for context but should NOT be deployed.
>
> ### What you'll do (high level)
>
> 1. Port `ndm/convex/prospects.ts` additions (6 new mutations + 1 cron handler + 5 P4 helpers + ingestScrapeResults with dedup layers)
> 2. Port `ndm/convex/scrape.ts` verbatim (NEW FILE — 4 actions + 1 internal query)
> 3. Register 2 new crons in `convex/crons.ts`
> 4. Set 3 new env vars
> 5. `npx convex deploy --prod`
> 6. Verify end-to-end
>
> ### Step-by-step
>
> **Step 1 — Port reservation mutations to web's `convex/prospects.ts`**
>
> Mobile added these exports to `ndm/convex/prospects.ts`. Copy verbatim:
>
> - `reserve(prospectId)` — available → reserved, sets 24h expiry, updates inventory
> - `markContacted(prospectId)` — reserved → contacted, clears expiry
> - `markQualified(prospectId)` — contacted → qualified
> - `markConverted(prospectId, submissionId)` — any → converted, links submission
> - `markLost(prospectId, reason?)` — any non-terminal → lost
> - `releaseReservation(prospectId)` — reserved → available (voluntary)
> - `releaseExpiredReservations` — internal mutation, called by cron
>
> All state-change mutations enforce "only the reserving creator can advance state" (admin bypass not implemented — add if needed via `requireAdmin` check). Inventory deltas use the existing `adjustInventory` internal mutation from P1.
>
> **Step 2 — Port P4 helpers to `convex/prospects.ts`**
>
> Mobile added these supporting functions for the background scrape flow:
>
> - `getLocaleConfig(country, categoryBucket)` — fetches category_locales row
> - `findLowInventoryCells(maxResults)` — returns neediest (cell, category) pairs, throttled to 2h since last scrape
> - `recordScrapeStart(jobId, ...)` — inserts scrape_history row, status="pending"
> - `recordScrapeAsyncId(jobId, outscraperJobId)` — updates to status="running" + saves Outscraper's async job ID
> - `recordScrapeComplete(jobId, rawResultCount, insertedCount, dedupedCount?, hitLimitCap)` — finalizes, computes estimatedCost, updates prospect_inventory.lastScrapedAt
> - `recordScrapeFailed(jobId, errorMessage)` — status="failed", logs reason
> - `ingestScrapeResults(jobId, businesses, country?)` — **THE BIG ONE**: dedup layers 2/3/4, quality scoring, inventory aggregation, atomic batch insert
>
> **Step 3 — Create `convex/scrape.ts`** (NEW FILE)
>
> Port verbatim from `ndm/convex/scrape.ts`. Contains:
>
> - `replenishLowInventoryCells` (cron handler) — reads daily budget from env, calls findLowInventoryCells, schedules scrapeAndStore for each
> - `countScrapesLast24h` (internal query) — used by the budget guard
> - `scrapeAndStore` (internal action) — fires Outscraper async mode, schedules pollAndIngest 30s later
> - `pollAndIngest` (internal action) — polls Outscraper requests endpoint, reschedules every 30s up to 20 attempts (10 min), ingests results, triggers subdivision if cap hit
> - `subdivideAndScrape` (internal action) — P5: when res-7 scrape hits 400-result cap, splits into 7 res-8 children
> - `getJob` (internal query) — fetches scrape_history row by jobId
>
> **Step 4 — Update `convex/crons.ts`** with two new entries:
>
> ```typescript
> crons.interval(
>   "replenish low inventory cells",
>   { minutes: 30 },
>   internal.scrape.replenishLowInventoryCells,
> );
>
> crons.interval(
>   "release expired prospect reservations",
>   { minutes: 60 },
>   internal.prospects.releaseExpiredReservations,
> );
> ```
>
> Don't touch the existing `aggregate monthly stats` cron.
>
> **Step 5 — Set Convex env vars (defaults are conservative — adjust as you observe usage)**
>
> ```bash
> npx convex env set MAX_SCRAPES_PER_CRON_TICK 5 --prod
> npx convex env set MAX_SCRAPES_PER_DAY 50 --prod
> npx convex env set MONTHLY_SCRAPE_BUDGET_USD 300 --prod
> ```
>
> The cron's daily-budget guard reads `MAX_SCRAPES_PER_DAY` and stops scheduling jobs once today's `scrape_history` count (completed + failed) hits the cap. The `MONTHLY_SCRAPE_BUDGET_USD` is informational for now — server-side enforcement comes in a follow-up if needed.
>
> **Step 6 — Deploy**
>
> ```bash
> npx convex deploy --prod
> ```
>
> **Step 7 — Verify (after deploy)**
>
> | Check | How |
> |---|---|
> | Crons scheduled | Convex dashboard → Schedules tab — should see both new crons with next-run time |
> | First replenishment fires | Wait up to 30 min OR manually invoke `internal.scrape.replenishLowInventoryCells` from dashboard "Run function" panel |
> | Scrape job recorded | Open `scrape_history` table — should see new row with status="pending" → "running" → "completed" over ~30-90 seconds |
> | Prospects inserted | `prospects` table grows; check `ingestScrapeResults` log line: `inserted=N dedupedByPlaceId=X dedupedByPhone=Y dedupedByName=Z` |
> | Inventory updates | `prospect_inventory` rows for that cell show updated `availableCount` and `lastScrapedAt` |
> | Subdivision triggers (if applicable) | If a scrape returns 400 results, watch for child scrapes spawned with `h3CellRes8` populated |
> | Reservation cron fires hourly | Reserve a prospect manually, wait until expiry passes (`Date.now() + 24h`), confirm it flips back to available |
>
> **Step 8 — Mobile UI is ready to consume immediately**
>
> Mobile's `discover.tsx` now renders an **"I'll interview this"** accent Door under the Directions/Call buttons when a card is active. Tapping it calls `prospects.reserve` and shows a confirmation alert. The button gracefully handles:
> - Already reserved (someone else just took it)
> - Auth expired
> - URL-data businesses (not yet in pool — shown a hint to retry from main Leads tab)
>
> After your deploy, the button works for any prospect with a Convex `_id` (pool-backed). URL-data businesses (fresh scrape results) still don't have prospect rows — they'll get them once the next replenishment cron sweeps the area.
>
> **Files in mobile's P2-P8 spec (already written, ready to port):**
> - `ndm/convex/prospects.ts` — 6 mutations, 1 cron handler, 7 internal helpers (added below the existing P1 code)
> - `ndm/convex/scrape.ts` — NEW file, ~250 lines, full P4+P5 implementation
> - `ndm/convex/crons.ts` — 2 new cron registrations
> - `ndm/app/(app)/leads/discover.tsx` — reserve button + handler
>
> ### What's intentionally deferred (P-future, not in this batch)
>
> - **P3 admin inventory dashboard** — query exists (`findLowInventoryCells`), UI is web's call. Recommended: add a simple admin route showing inventory health per (cell, category) with a "manually trigger replenishment" button.
> - **P6 stale-contact release cron** — 7-day idle release of contacted prospects. Add to `convex/crons.ts` later: `crons.interval("release stale prospect contacts", { hours: 24 }, internal.prospects.releaseStaleContacts);` Mutation can be modeled on `releaseExpiredReservations`.
> - **P6 weekly refresh cron** — re-pull existing prospects from Outscraper monthly to keep `rating` / `reviewCount` / `website` fresh. Add when launching country #2.
> - **P7 quality badges on prospect cards** — render the `qualityScore` field as a small badge on the discover map and detail pages. Pure web/mobile UI work.
> - **P8 cutover + cleanup** — after 2 weeks of stable operation:
>   1. Delete `leads` rows where `migratedToProspectId` is set
>   2. Remove the deprecated `outscraper.scrapeNearby` action (mobile's discover map no longer needs it once the pool is fully populated)
>   3. Remove the `migratedToProspectId` field from `leads` schema
>   4. Remove the dual-read fallback in mobile's `discover.tsx`
>
> ### Cost outlook with full P2-P8 live
>
> | Coverage | Monthly Outscraper calls (replenishment only) | Monthly cost |
> |---|---|---|
> | Metro Manila (50 cells × 10 categories, ~30-day refresh) | ~500 | ~$100 |
> | All major PH cities (5 cities × 50 cells × 10 categories) | ~2,500 | ~$500 |
> | PH + ID + VN at full coverage | ~7,500 | ~$1,500 |
>
> Compare to current per-tap model at 5K creators: $2K+/month. The pool model is ~75% cheaper at small scale, ~95% cheaper at 50K creators.
>
> ### Hard rules — what you MUST NOT do (still)
>
> - ❌ Mobile must not run `npx convex deploy`. Same rule, every deploy.
> - ❌ Do NOT remove the existing `outscraper.scrapeNearby` until P8 cleanup. The dual-read window keeps the discover map working during migration.
> - ❌ Do NOT touch `migratedToProspectId` on leads until P8.
> - ❌ Do NOT seed prospects manually via dashboard — let the backfill (P1) + replenishment (P4) populate them through the proper code paths.
> - ❌ Do NOT raise `MAX_SCRAPES_PER_DAY` past 100 without checking the Outscraper bill first.
>
> </details>

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
