# Web-side Lead CRM — Creators platform integration

> **Single source of truth for the web Creators platform's Leads page.** Hand this entire document to the web agent / developer — it is self-contained. There are no cross-doc dependencies; everything the web side needs (Interviewed tab, Prospects tab, Outscraper backend, claim flow, detail page, modal spec, Editorial Paper tokens) lives in this file.
>
> URL: `/creators/leads` (exact slug owned by web team). Mirrors mobile's `app/(app)/leads/*` 1:1 in behavior, and adopts the **Editorial Paper** design system (greens + khaki — **NOT orange/terracotta**, Instrument Serif + Onest + JetBrains Mono) so the web and mobile apps feel like one product.
>
> **Last updated 2026-05-29.** Recent changes folded into this doc:
>
> 🚨 **URGENT — Outscraper currently broken on prod.** Find Local Business returns 0 results every time because the deployed `convex/outscraper.ts` builds an invalid request to Outscraper's API. Full diagnosis + fix in the "🛑 2026-05-28 — Outscraper query-format bug" section below. **Fix this first** — everything downstream of Find Local Business (Prospects tab, discover map, claim flow) is blocked until creators can actually populate prospect rows.
>
> ✅ **2026-05-29 — Mobile discover map is now BUILT.** The previous broken UX (scrape success → useless "X businesses added to your interview list" Alert dialog → nothing visible) has been replaced. Mobile's Find Local Business button now routes directly to the discover map at `app/(app)/leads/discover.tsx` after the scrape resolves. There is no more interview-list-Alert step. The map pins every Outscraper-scraped business with category-keyed pins + a sticky category legend. **Web must mirror this exact flow.** Spec is in "Map B — Find Local Business" below.
>
> 🚨 **2026-05-29 — `outscraper.listScrapedLeads` validator drift.** The deployed function on prod rejects `{ limit: number }` with `ArgumentValidationError: Object contains extra field 'limit' that is not in the validator`. The deployed validator only accepts `{ search?, statusFilter? }` — likely got accidentally rewritten as a `listForMobileCRM`-style wrapper. **The original signature `{ limit?: number }` returning raw outscraper leads (with `businessLatitude`, `businessLongitude`, `businessCategory`, `businessRating`, etc.) must be restored** — mobile's discover map needs those raw fields, and `listForMobileCRM` strips them out (it only surfaces submission-derived business fields). Source of truth: `ndm/convex/outscraper.ts`. Mobile's caller in `discover.tsx` now sends `{}` defensively and filters client-side as a workaround, but the proper fix is restoring the validator + return shape per the mobile copy. See "Convex contract" section for the required signature.
>
> **Mobile-as-source-of-truth alignment** — mobile owns the canonical behavior for both action buttons. Web is currently misaligned and must catch up.
>
> | Button | Mobile (canonical — DO NOT change) | Web (currently broken — fix to match mobile) |
> |---|---|---|
> | **See Live Business** | Routes to `app/(app)/leads/nearby.tsx` — a Google Maps view showing every already-interviewed business that has a **live website**. Each pin uses the same accent-emerald style. Creators study what's already earning on the platform. | Currently shows a blank leaflet / does nothing. Must become a Google Maps view (JS Maps SDK, not Leaflet) showing the same set of leads with the same accent-emerald pins. Read from `listForMobileCRM` filtered to `lead.business.websiteUrl != null`. |
> | **Find Local Business** | After the 3-stage Outscraper scrape modal succeeds, immediately routes (`router.push`) to `app/(app)/leads/discover.tsx` with `?category=...&radiusKm=...` URL params. **No interview-list Alert dialog** — the map IS the result. The discover map reads `outscraper.listScrapedLeads`, filters to rows where `submissionId == null`, plots each as a colored pin keyed off `businessCategory`, shows a sticky category legend in the top-right of the map, and below the map lists the businesses sorted by distance with rating + Directions/Call buttons. | Currently has no map at all. Must mirror mobile: same scrape modal → same post-scrape `router.push` to a discover route → same category-keyed pin styles → same sticky legend → same scrollable distance-sorted list under the map. No "X businesses added" toast or list intermediate. |
>
> Other recent updates:
> - Auth gate on `outscraper.scrapeNearby` + `outscraper.listScrapedLeads` changed from `requireAdmin` → `requireAuth` (creators are the primary callers)
> - "Find Local Business" modal uses a 3-stage loading UI with a pulsing halo + step checklist before routing into the map
> - "See Live Business" + "Find Local Business" are the exact button labels — never paraphrase
> - Detail page must include Directions + View Website + Interviewed-by roster (these were missing from earlier drafts)
> - Prospects tab + claim/release flow (folded in from the old WEB-BUILD-CRM-PAGE.md — deprecated)

---

## Why this needs to exist

Today, mobile creators can:
- See the team-wide social feed of leads at `app/(app)/leads/index.tsx`
- Drill into a single lead at `app/(app)/leads/[leadId].tsx`
- Tap **See Live Business** → opens a Google Maps view of already-interviewed businesses with live websites
- Tap **Find Local Business** → opens a modal that scrapes Google Maps for nearby prospects nobody has interviewed yet, via Outscraper
- See admin-curated social-card content when present
- Filter, search, and "Only mine" the list

Web creators can do **none** of this. The web Creators platform's existing screens (Home, Referrals, Wallet, Profile) have no Leads tab, even though most of the Convex queries are already deployed in prod.

Goal: ship a `/creators/leads` route on the web that's feature-equivalent to mobile's Leads tab, using shared Convex queries, styled in the Editorial Paper system to match mobile's redesign.

---

## Audience reminder — who uses this page

| Audience | What they see |
|---|---|
| **Signed-in creator (NOT admin)** | This page. Their personal CRM. They see the team's interviewed businesses (the social feed) AND newest prospect businesses (Outscraper-discovered) so they can pick the next door to knock on. |
| **Admin** | Separate `/admin/...` routes (out of scope of this doc — admins also see leads, but with different actions like reject/delete/reassign). |
| **Anonymous visitor** | Redirected to `/sign-in` — this page is auth-gated. |

---

## Out of scope (explicit)

- Admin surfaces — those are covered separately (admin uses `getDetailForAdmin` + `updateAdminContent`; creators page uses `listForMobileCRM` + `getDetailForMobileCRM`).
- Submissions, Wallet, Referrals web pages — separate redesign work. This doc is leads-only.
- Native push notifications on web — out of scope for v1.

---

## State invariants (read this first)

| Lead state | `submissionId` | `source` | Where it appears |
|---|---|---|---|
| Interviewed by a creator | set (refs submissions row) | `"website"` / `"qr_code"` / `"direct"` | **Interviewed** tab only |
| Outscraper prospect, never interviewed, unclaimed | `null` | `"outscraper"` | **Prospects** tab — unclaimed pool |
| Outscraper prospect, claimed by a creator | `null` | `"outscraper"` | **Prospects** tab — "Claimed" filter shows who has it |
| Outscraper prospect that got interviewed later | set (linked to new submissions row) | `"outscraper"` | **Interviewed** tab (it graduated — flow handled automatically by mobile + the deep link in Step 9) |

A lead is a prospect if `source === "outscraper"` AND `submissionId == null`. The moment a creator records an interview and submits the business with matching phone (or via the `prospectLeadId` deep link), the prospect lead row gets `submissionId` patched and it graduates to the Interviewed tab.

---

## Convex contract (frozen — do not modify)

All functions below are already deployed to `prod:energetic-panther-693`. The web Creators page must call them with the **exact** argument shapes shown.

### Read: list view (Interviewed tab)

```typescript
api.leads.listForMobileCRM({
  search?: string,
  statusFilter?: "all" | "new" | "contacted" | "qualified" | "converted" | "lost",
  onlyMine?: boolean,
})
```

**Returns** `{ leads: EnrichedLead[], stats: { total, new, contacted, qualified, converted, lost, mine } }`.

Each `EnrichedLead` carries: `_id`, `name`, `phone`, `email`, `source`, `status`, `createdAt`, `businessName`, `businessType`, `businessCity`, `interviewerCount`, `submittedBy: { creatorId, displayName, profileImage }`, `isMine`, `isHot` (interviewerCount ≥ 3), and the admin content fields (`adminDescription`, `previewImageUrl`, `externalPreviewUrl`, `hasEnrichedContent`).

Auth: requires a signed-in Convex identity. Anonymous users get `{ leads: [], stats: { total: 0, ... } }`.

### Read: detail view (Interviewed tab)

```typescript
api.leads.getDetailForMobileCRM({ id: Id<"leads"> })
```

**Returns** `{ lead, submittedBy, isMine, business, adminContent, interviewers, interviewerCount, notes }` or `null` if not found.

### Read: prospects list (Prospects tab + Discover map)

```typescript
api.outscraper.listScrapedLeads({ limit?: number })
```

**Required return shape:** an **array** of lead rows where `source === "outscraper"`, sorted newest-first by `scrapedAt`. Each row MUST carry the standard lead fields PLUS the raw Outscraper-scraped business metadata fields the discover map renders:

```typescript
{
  _id: Id<"leads">,
  source: "outscraper",
  submissionId: Id<"submissions"> | null,
  status: "new" | ...,
  createdAt: number,
  scrapedAt: number,
  // ↓ The discover map REQUIRES these raw fields ↓
  businessName: string,
  businessAddress: string | null,
  businessCity: string | null,
  businessCategory: string | null,        // pin color is keyed off this
  businessWebsite: string | null,
  businessPhone: string | null,
  businessLatitude: number | null,        // pin coords
  businessLongitude: number | null,       // pin coords
  businessRating: number | null,
  businessReviewCount: number | null,
  businessGooglePlaceId: string | null,
  // ...
}
```

> 🚨 **2026-05-29 — Current deployed validator is wrong.** The version on prod accepts only `{ search?, statusFilter? }` (looks like someone wrapped it as a `listForMobileCRM`-style filter). That validator REJECTS `{ limit }` with `ArgumentValidationError`, and the return shape may or may not include the raw business fields above. **Restore the original signature** from `ndm/convex/outscraper.ts` (which uses `{ limit?: number }` and returns a raw array of lead rows with all the fields above intact). Do NOT wrap or enrich the result — the discover map needs raw row access.

Auth: **`requireAuth`** (any signed-in creator). See the 2026-05-27 callout above — this was previously `requireAdmin`.

### Write: trigger a new scrape (Find Local Business modal)

```typescript
api.outscraper.scrapeNearby({
  location: string,   // "lat,lng" coord string, e.g. "14.30,121.00"
  query: string,      // category, e.g. "barbershops" — fall back to "businesses" if user leaves blank
  radiusKm?: number,  // defaults to 5
  limit?: number,     // defaults to 20, max 50
})
```

**Returns** `{ inserted: number; skipped: number; total: number }`.

Auth: **`requireAuth`** (any signed-in creator). The action calls Outscraper's Google Maps Search API, inserts new rows into the `leads` table with `source: "outscraper"`, and dedupes via the `by_place_id` index.

### Write: add a note

```typescript
api.leadNotes.add({ leadId: Id<"leads">, content: string })
```

Web should mirror mobile's behavior — any signed-in creator can post a note on any lead.

### Write: update status (Interviewed leads only)

```typescript
api.leads.updateStatus({ id: Id<"leads">, status: "new" | "contacted" | "qualified" | "converted" | "lost" })
```

Mobile gates this to "only the original submitter or admin can change status" — replicate that gate client-side too (use `isMine` from the detail payload; admin elevation is via Clerk roles).

### Write: claim / release prospects (new — see Step 9)

```typescript
api.outscraper.claimProspect({ leadId: Id<"leads"> })
api.outscraper.releaseProspect({ leadId: Id<"leads"> })
api.outscraper.getProspect({ leadId: Id<"leads"> })
```

These three are NEW and need to be added in the web repo's `convex/outscraper.ts` (full source in Step 9). Mobile will pick them up via codegen after web deploys.

---

## 🛑 2026-05-27 — Critical auth-gate fix

> Both `outscraper.scrapeNearby` and `outscraper.listScrapedLeads` were originally gated on `requireAdmin`. **That was wrong.** Creators (not admins) are the primary callers of the Find Local Business button on mobile.
>
> The mobile copy of `convex/outscraper.ts` now uses `requireAuth` for both functions. If your deployed copy still uses `requireAdmin`, **any creator hitting the button will get `Forbidden: admin access required`** and the feature is dead.
>
> **Action required on web side:** open your `convex/outscraper.ts`, change `requireAdmin(ctx)` to `requireAuth(ctx)` on both functions, then `npx convex deploy --prod`. The mobile source of truth is `ndm/convex/outscraper.ts` if you want to copy it verbatim. After the deploy, the mobile button works immediately — no mobile rebuild needed.

---

## Page architecture (web)

Four routes under the existing authenticated Creators platform shell:

| Route | Purpose | Convex calls |
|---|---|---|
| `/creators/leads` | List view — two action Doors above two tabs (Interviewed default + Prospects) | `listForMobileCRM`, `listScrapedLeads` |
| `/creators/leads/live` | **Map A** — See Live Business destination. Google Maps view of interviewed leads with live websites. Replace the existing broken Leaflet view. | `listForMobileCRM` (filtered to `submissionId != null && business.websiteUrl != null`) |
| `/creators/leads/discover` | **Map B** — Find Local Business destination. Opens AFTER a successful Outscraper scrape. Google Maps view with category-keyed pins. | `listScrapedLeads` (filtered to `submissionId == null` and the scraped radius) |
| `/creators/leads/[leadId]` | Detail view — works for both interviewed AND prospect leads (render conditionally on `lead.submissionId`) | `getDetailForMobileCRM` for interviewed; `outscraper.getProspect` for prospect |

All routes should be **server-rendered shell + client-rendered data** (Next.js App Router pattern) so the page paints fast and Convex hydrates the live data. The two map routes additionally hydrate the Google Maps JS SDK client-side.

---

## Mobile-side work (what mobile owes web parity, what mobile already ships)

The doc is web-centric but the alignment is bidirectional. Here's what mobile already has, what mobile needs to add, and what mobile must NOT change:

| Surface | Mobile status | What mobile owes |
|---|---|---|
| **See Live Business button + map** | ✅ Built. `app/(app)/leads/index.tsx` button → `app/(app)/leads/nearby.tsx` map. **Canonical — do not change.** | Web must mirror this; mobile is reference. |
| **Find Local Business button + scrape modal + 3-stage loading** | ✅ Built. Same `index.tsx` button → `showScrape` modal → `ScrapeProgressPanel`. | None — keep as-is. |
| **Find Local Business post-scrape map** | ✅ Built (2026-05-29). `app/(app)/leads/discover.tsx` lives behind the success path of the scrape modal. The modal calls `router.push('/(app)/leads/discover?category=...&radiusKm=...')` after the scrape resolves — no Alert, no list intermediate. **Canonical — web must mirror this exact shape.** | Web must build `/creators/leads/discover` to match. |
| **Pin colors + category mapping** | ✅ Built. Lives in `CATEGORY_STYLES` at the top of `app/(app)/leads/discover.tsx`. Six categories (barbershop, restaurant, sari-sari, auto, medical, other) each with a hex color + Ionicons name. The `categorize()` function does case-insensitive substring matching on `businessCategory` to bucket each scraped row. | Web must copy the exact same color + icon mapping. Don't invent new categories. |
| **Bottom sheet content on pin tap** | ✅ Built. Tapping a pin focuses that row in the scrollable list below the map; the focused row reveals `[Directions]` + `[Call]` Door buttons inline. There is no separate bottom-sheet modal — the list IS the detail surface, with the active row highlighted by a category-colored left border. | Web mirrors the same pattern OR uses a proper desktop popover near the pin; either is fine, but the available actions and field set must match (rating, distance, address, Directions, Call). |

**Rule of thumb for the web agent:** if a behavior already exists on mobile, mirror it pixel-for-pixel. Read `ndm/app/(app)/leads/discover.tsx` as the source of truth — the pin SVG shape, the category table, the legend layout, the empty state copy, and the active-row pattern are all defined there and have shipped.

URL state: tab choice persists in `?tab=interviewed` vs `?tab=prospects`; filters (`status`, `search`, `onlyMine`) also live in URL search params so creators can share/bookmark filtered views.

---

## Entry points — where creators discover this page

Three places. **All three must exist** so the page is reachable from anywhere in the platform.

### Entry A — Top-level nav (sidebar or top-bar)

Add a new "Leads" item to the existing creator-side nav. Place it between **Submissions** and **Wallet**:

```
Dashboard
Submissions
Leads          ← NEW. Routes to /creators/leads
Wallet
Referrals
Profile
```

Match the existing nav-item styling. Optionally show a small count badge next to "Leads" (e.g. `Leads · 24`) — pulls from `listScrapedLeads.length` or `stats.total`. Skip if it'd require extra subscription plumbing.

### Entry B — Dashboard hero card

On the existing `/creators/dashboard`, add a Team Leads card between the balance/earnings area and the recent-submissions list. Mirrors what mobile has on its home tab.

```
┌────────────────────────────────────────────────────────┐
│  STEP 02 / TEAM LEADS                          ● LIVE  │
│                                                        │
│  12 leads, browse the feed.                            │
│                                                        │
│  See every business the team has interviewed — and     │
│  the prospects waiting to be talked to.                │
│                                                        │
│  ┌──────┬──────┬──────┬──────────┐                    │
│  │  12  │   3  │   2  │     4     │                    │
│  │Total │ Hot  │Yours │ Converted │                    │
│  └──────┴──────┴──────┴──────────┘                    │
│                                                        │
│  [Browse leads →]                                      │
└────────────────────────────────────────────────────────┘
```

The whole card is clickable → routes to `/creators/leads`. Stats come from the same `listForMobileCRM` query the page itself uses (free reactive subscription, Convex caches the result).

- **Total** — `stats.total`
- **Hot** — count of leads with `interviewerCount >= 3` (or use `isHot === true` if exposed)
- **Yours** — `stats.mine`
- **Converted** — `stats.converted`

Mobile reference: `ndm/app/(app)/(tabs)/index.tsx` — `STEP 02 / TEAM LEADS` card around the middle of the file.

### Entry C — Submit success page (optional v1)

After a creator finishes submitting a business, the success screen typically routes them to dashboard or submissions list. Consider also surfacing a "Find your next interview →" CTA there that routes to `/creators/leads?tab=prospects`. Keeps creators moving from one interview to the next without re-navigating.

Optional for v1. Low effort if your submit-success page is easy to edit.

### Naming consistency with mobile

These labels are exact, ship on mobile under these exact terms, and must NOT be shortened, paraphrased, or "improved":

| Mobile button | Caption (mono eyebrow) | Variant | Routes to |
|---|---|---|---|
| `See Live Business` | `ON THE MAP` | `accent` (emerald fill, white text) | Map view of every business the team has **already interviewed and that has a live website**. Pin style: solid emerald droplet (single style across all pins). Mobile destination: `app/(app)/leads/nearby.tsx`. Web equivalent: `/creators/leads/live` (or whatever your slug convention is). |
| `Find Local Business` | `DISCOVER` | `ghost` (paper-3 with ink border) | Opens the category + radius modal → 3-stage loading panel → after success, routes user to a map view showing every newly-scraped Outscraper business plus existing not-yet-interviewed Outscraper leads in the same radius. **Pin style varies by business category** (see "Find Local Business map" below). Mobile destination: NEW route at `app/(app)/leads/discover.tsx` (to be built — see mobile section). Web equivalent: `/creators/leads/discover`. |
| Generic "Leads" tab/nav item | — | — | `/creators/leads` |

**Critical distinction:**

- **See Live Business** → "show me what's already working — businesses we've interviewed and that have a live website." Showcase / inspiration view. Creators study what's earning on the platform.
- **Find Local Business** → "find me a new door to knock on." Discovery view. Creator picks a category, app scrapes Outscraper, results land on a map with pins styled by business category so the creator can plan a route.

Don't merge these into one button. Don't swap their semantics. The labels are exact.

---

## Map views — exact spec (mobile owns, web mirrors)

Both action buttons land on map views. **Mobile is the source of truth for behavior, copy, pin styles, and tap interactions.** The web side currently has neither map wired up correctly — implement both to match mobile exactly.

**Base layer:** Google Maps (mobile uses `react-native-maps`; web must use the **Google JS Maps SDK**, NOT Leaflet). The Maps API key `AIzaSyAt-knwNJgQ-Nx5ZY5aZUC-T8sj8D3QZ7U` is already paid for and lives in `ndm/app.json` — reuse it on web; do not provision a new key.

> ⚠️ **Web is currently broken — fix priority #1.** Today on web, clicking **See Live Business** shows a blank Leaflet canvas with no pins and no header. Clicking **Find Local Business** has no map at all. Both must be replaced with the implementations below.

### Map A — See Live Business (the showcase)

**Mobile reference:** `app/(app)/leads/nearby.tsx`. **Do not change the mobile implementation** — it is canonical.

**Backing query:** the web team has already added a `leads.listForMap` query on prod (visible in Convex logs at `prod:energetic-panther-693`). Mobile does not have this query in its local `convex/leads.ts` copy — it lives in the web repo. Once web deploys it formally, mobile picks it up via codegen. Both clients should call:

```typescript
api.leads.listForMap({})  // returns leads with coords + business.websiteUrl + interviewed flag
```

**What it pins:** every lead where the business has a live website AND was already interviewed. Exact SELECT criteria (apply server-side in `listForMap`):

```typescript
// Server-side filter:
lead.submissionId != null                  // someone has interviewed it
  && lead.business.websiteUrl != null      // and the site is live
  && lead.business.latitude  != null       // and we have coords to plot
  && lead.business.longitude != null
```

**Pin style:** single style across the map — accent-emerald droplet, white inset dot, white outline. No category variation here. The visual consistency reinforces "these are all our success stories."

**Header above the map** (Editorial Paper):

```
STEP 03 / LIVE BUSINESSES                                ● LIVE

Already-interviewed
and live.

{n} businesses the team has interviewed that now have a live website. Tap any pin to study what's working.
```

- Eyebrow: mono `STEP 03 / LIVE BUSINESSES` + LiveDot
- Display: two-line headline; "and live." is italic + `colors.accent`
- Body sub-copy: ink-2, Onest 14px

**Pin tap → bottom sheet (mobile) / popover (web desktop):**
- Business name (serif Display sm)
- Submitter chip (avatar + display name + relative time)
- Address line + `business.websiteUrl` displayed as a chip
- `[Visit website ↗]` `[Directions]` `[View detail →]` Door buttons
- "View detail →" links to `/creators/leads/[leadId]` (interviewed detail page)

**Camera behavior:** center on creator's current `navigator.geolocation` position; fit-bounds to all pins on first render. If no pins exist, show an empty-state card overlaid on the map:

> Nothing live *yet.* — When the first team submission gets a website deployed, it'll appear here.

**Web implementation notes:**
- Use `@vis.gl/react-google-maps` or `@react-google-maps/api`
- Marker SVG: 32×40 droplet, `#10B981` fill, `#FFFFFF` 2px outline, white inset dot at the apex
- The currently-rendered blank Leaflet view must be removed entirely — do NOT layer Google Maps on top of Leaflet
- Mirror mobile's header (eyebrow + Display + Body) above the map container — don't render the map full-bleed without context

### Map B — Find Local Business (the discovery view, NEW)

**Mobile status:** ✅ shipped 2026-05-29 at `app/(app)/leads/discover.tsx`. The scrape modal's success path is `router.push('/(app)/leads/discover?category=${cat}&radiusKm=${radius}')` — no Alert dialog, no list intermediate. The map opens immediately after the saving phase. Read that file as the canonical implementation.

**Web status:** mirror mobile. Web route: `/creators/leads/discover?category=...&radiusKm=...`.

**What it pins:** every Outscraper-sourced lead in the visible radius that is NOT yet interviewed. Exact SELECT criteria:

```typescript
lead.source === "outscraper"
  && lead.submissionId == null               // not interviewed yet
  && lead.businessLatitude  != null
  && lead.businessLongitude != null
  // (optional) within the search radius the user just scraped
  && haversine(userLatLng, [lead.businessLatitude, lead.businessLongitude]) <= radiusKm
```

This includes BOTH the just-scraped results AND any existing Outscraper rows in the radius that other creators previously discovered but nobody has interviewed yet. Showing both is intentional — a creator might claim and interview an older prospect they hadn't seen.

**Pin style — keyed by business category.** This is the key visual: a creator opens the map and can scan for "barbershops near me" or "restaurants near me" at a glance.

The exact category-detection regex used in `discover.tsx` (port verbatim — these include PH-specific terms Outscraper returns for businesses in the Philippines):

| Bucket | Regex (case-insensitive) | Pin color | Icon (Ionicons name) | Legend label |
|---|---|---|---|---|
| `barbershop` | `/barbershop\|salon\|hair\|beauty\|nail/` | `#7C3AED` (violet) | `cut-outline` | `Barbershop · Salon` |
| `restaurant` | `/restaurant\|cafe\|coffee\|food\|eatery\|bakery\|fastfood\|carinderia\|kakanin\|lutong/` | `#C68A12` (warm khaki — NOT orange) | `restaurant-outline` | `Restaurant · Cafe` |
| `sari-sari` | `/sari-?sari\|convenience\|grocery\|mart\|store/` | `#10B981` (emerald) | `storefront-outline` | `Sari-sari · Grocery` |
| `auto` | `/auto\|mechanic\|vulcanizing\|repair\|car ?wash\|tire/` | `#1F3654` (deep ink-blue) | `car-outline` | `Auto · Mechanic` |
| `medical` | `/pharmacy\|drugstore\|clinic\|dental\|medical\|hospital/` | `#B43A1F` (danger red) | `medkit-outline` | `Pharmacy · Clinic` |
| `other` | (fallback when no regex matches) | `#3C3F4A` (ink-2) | `business-outline` | `Other` |

Matching is **first match wins** — evaluate buckets in the order listed (barbershop → restaurant → sari-sari → auto → medical → other). The regex tests run against `businessCategory.toLowerCase()`. Match order matters because some categories share keywords (e.g. a "Beauty salon" hits `barbershop` first, not `sari-sari`'s `store`).

**Pin SVG shape — exact spec from `discover.tsx`:**

The shipped pin is **not** a single droplet — it's a composite of two stacked shapes:

1. **Head:** a 34×34 perfect circle, filled with the category color, 2px white border. Inside the circle, a 16×16 Ionicon rendered in white.
2. **Tail:** an 8px downward-pointing triangle directly below the head, same fill color as the head, 6px half-width. Margin-top: -2 to overlap the circle slightly.

Container: `alignItems: 'center'` so the tail sits centered under the head. Drop shadow: `shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: {0, 2}`, `elevation: 4` for Android.

```jsx
<View style={{ alignItems: 'center' }}>
  <View style={{
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: categoryColor,
    borderWidth: 2, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  }}>
    <Ionicons name={categoryIcon} size={16} color="#FFFFFF" />
  </View>
  <View style={{
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: categoryColor,
    marginTop: -2,
  }} />
</View>
```

Web should reproduce this exact silhouette as an inline SVG marker — circle head + triangle tail in the same colors. Do NOT swap for Google's default red droplet.

**Header above the map — exact copy + sizing:**

```
STEP 03 / NEARBY TO INTERVIEW                            ● LIVE

Fresh finds
around you.

{N} {category} business(es) within {radiusKm} km. Pin colors show categories.
```

- Header container: `paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14`
- Eyebrow row: 36×36 circular back button (paper-3 fill, rule border) on the left, then `<Label tracking={1.8}>03 / NEARBY TO INTERVIEW</Label>` + mono "·" + `<LiveDot size={6}>` + `<Label color={colors.live}>LIVE</Label>`
- Display headline: two `<Display size="md">` text nodes baseline-aligned. First is `Fresh finds ` (plain). Second is `around you.` (italic + `colors.accent`)
- Sub-copy: `<Body size="sm" color={colors.ink2}>` — count, category (interpolated from URL param), radius. Three variants:
  - Loading: `"Loading nearby businesses to interview…"`
  - Empty: `"No nearby businesses yet — try widening the radius or a different category."`
  - Has results: `"{N} {category} business(es) within {radiusKm} km. Pin colors show categories."`
- `<Rule strong />` divider after the header block

**Map container:** 340px tall, `width: '100%'`, paper-2 fallback background. Loading state: centered `<ActivityIndicator color={colors.accent}>`.

**Legend — exact layout from `discover.tsx`:**

Absolute-positioned in the map's top-right corner, only renders when there are pins:

```
position: absolute, top: 12, right: 12
backgroundColor: 'rgba(252, 250, 245, 0.96)'    ← paper-3 at 96% opacity
borderColor: colors.rule, borderWidth: 1
borderRadius: radius.sm                          ← 12px
paddingVertical: 8, paddingHorizontal: 10
maxWidth: 180
```

Inside:
- Mono "CATEGORIES" label: `fonts.monoMed, fontSize: 9, letterSpacing: 1.2, color: colors.ink3, textTransform: 'uppercase', marginBottom: 6`
- One row per active category (omit categories with zero pins). Each row: `flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4`. The row contains:
  - A 14×14 circle with the category color fill, 8×8 white Ionicon centered inside
  - A label text: `fonts.mono, fontSize: 10, color: colors.ink2, letterSpacing: 0.3`, numberOfLines: 1

Legend labels (full strings, do not abbreviate):
- `Barbershop · Salon`
- `Restaurant · Cafe`
- `Sari-sari · Grocery`
- `Auto · Mechanic`
- `Pharmacy · Clinic`
- `Other`

**Pin tap — inline active-card pattern (NOT a bottom sheet):**

Tapping a pin does NOT open a modal or bottom sheet. Instead:

1. The list below the map sets that lead as `activeLeadId`
2. The map animates to the pin: `mapRef.animateToRegion({ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500ms)`
3. The active row in the list re-orders to the top, gets a 3px category-colored left border
4. The active row reveals inline `[Directions]` + `[Call]` Door buttons below its content

This means the list-below-map IS the pin detail surface. There's no overlay UI. Web can either mirror this exact pattern OR use a desktop popover anchored to the pin — both are acceptable as long as the available actions and field set match.

**Card layout for each business in the list below the map:**

Card padding 14, large radius. Left section: row container with `gap: 12`:
- 44×44 colored square (`borderRadius: radius.sm`, category color fill) with the category Ionicon centered, white, size 20
- Flex-1 column:
  - `<Body size="md" weight="bold" color={colors.ink} numberOfLines={1}>` — business name
  - `<Body size="xs" color={colors.ink3} numberOfLines={1} style={{ marginTop: 1 }}>` — `{businessCategory} · {businessCity}` joined with ` · `, fallback to `businessAddress`, final fallback `'—'`
  - If `businessRating != null`: row with `gap: 4, marginTop: 4` containing a `star` Ionicon size 11 in `colors.warn` plus mono text `"{rating.toFixed(1)} · {reviewCount}"`
- Right section: `alignItems: 'flex-end'`
  - Serif distance text: `fonts.serif, fontSize: 18, letterSpacing: -0.2, color: colors.ink` — uses `formatDistance(distanceKm)`: `"{N} m"` < 1km, `"{N.N} km"` < 10km, `"{N} km"` otherwise, `"—"` if null
  - If distance null: mono caption `"DISTANCE OFF"` below

**Active-card treatment:**
- `borderColor: colors.ink` (instead of rule)
- `borderLeftWidth: 3, borderLeftColor: {categoryColor}` (replaces the 1px rule on the left)
- Below the card body, reveal an action row with `flexDirection: 'row', gap: 8, marginTop: 12`:
  - `<Door variant="solid" caption="GO" label="Directions">` + `navigate` icon — opens `https://www.google.com/maps/search/?api=1&query={lat},{lng}` via `Linking.openURL`
  - `<Door variant="ghost" caption="CALL" label="Phone">` + `call-outline` icon — opens `tel:{phone}` via `Linking.openURL`. Only renders if `businessPhone != null`

**Section header above the card list:**

```
NEAREST FIRST                                              {N} pinned
```

- Label tracking 1.8, text reads `NEAREST FIRST` when GPS granted, `ALL NEARBY` when denied
- Right side: mono `"{N} pinned"` count chip when there are results

**Camera behavior:**
- Initial region: user's GPS position with `latitudeDelta: 0.08, longitudeDelta: 0.08`
- If no GPS yet: fall back to Manila (`14.5995, 120.9842`, deltas 0.5)
- On GPS arrival: `mapRef.animateToRegion(...)` 400ms
- On card tap: `animateToRegion` to the pin with deltas 0.02 (closer zoom), 500ms
- `showsUserLocation={true}` when permission granted, `showsMyLocationButton={false}` (we don't render Google's default control)

**Permission denied banner:** below the map, render a ghost Door labelled "Enable location to sort by distance" with a `settings-outline` icon → `Linking.openSettings()`.

**Empty state (no pinned rows after load):**

Centered Card with `padding: 22`:
- 56×56 paper-2 circle with `search-outline` icon, size 26, ink-3
- Two-line Display sm: `"Nothing to interview "` + italic emerald `"yet."`
- `<Body size="sm" color={colors.ink3}>` sub-copy: `"Tap Find Local Business again with a wider radius or a different category to add more pins here."`
- Self-stretched solid Door: `"Back to leads"` with caption `"TRY AGAIN"`, `arrow-back` icon, routes `router.replace('/(app)/leads')`

**No interview-list Alert, no success toast.** The map IS the success state. The previous Alert dialog (`"X businesses found nearby. Added Y new ones to your interview list (Z were already on it)"`) has been removed entirely.

**Loading hand-off from the scrape modal:** the moment `scrapeNearby` resolves, the modal does `setShowScrape(false)` + `router.push('/(app)/leads/discover?category=${encoded}&radiusKm=${radius}')`. No intermediate screen, no toast.

---

## List page UX spec (`/creators/leads`)

Visual reference: mobile's `app/(app)/leads/index.tsx`. The web should be the desktop expansion of that pattern, NOT a separate design language.

### Above-the-fold

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 03 / TEAM LEADS                          ● LIVE             │
│                                                                    │
│  All leads,                                                        │
│  every interview.                ← Display: Instrument Serif       │
│                                                                    │
│  The whole team's hunt — including yours.                         │
│  Last sync: 12s ago · 38 interviewed · 24 prospects                │
│                                                                    │
│  [▤ See Live Business  ↗]      [⌕ Find Local Business  ↗]        │
└──────────────────────────────────────────────────────────────────┘
```

- Eyebrow: mono `STEP 03 / TEAM LEADS`
- Live dot pulses next to "LIVE" if Convex socket connected
- Display headline: Instrument Serif, two-line. The italic word (here: "every") is `colors.accent` emerald
- Sub-copy: Onest 15px, ink-2

### Two action Doors directly under the headline

These are the primary creator actions and must always be visible above the tab row.

| Button label | Caption | Variant | What it does | Mobile reference |
|---|---|---|---|---|
| **See Live Business** | `ON THE MAP` | accent (emerald fill, white text) | Routes to a map view showing already-interviewed businesses with **live websites**. The "what's working — and earning — on the platform" view. | `ndm/app/(app)/leads/index.tsx` button ~line 244; destination `ndm/app/(app)/leads/nearby.tsx`. Web equivalent: either embed Google Maps or open a filtered list with `?live=true` showing only leads where `lead.business.websiteUrl != null`. |
| **Find Local Business** | `DISCOVER` | ghost (paper-3 with ink border) | Opens the Outscraper "discover prospects" modal — category text input + radius pill row (1/3/5/10 km). On submit, calls `outscraper.scrapeNearby`. Newly-inserted prospects show up in the Prospects tab instantly (reactive Convex). | Mobile button ~line 252 + the scrape modal lower in the same file. |

### Find Local Business modal (NEW — multi-stage loading UX)

Mobile reference: `ndm/app/(app)/leads/index.tsx` — the entire scrape modal including the `ScrapeProgressPanel` component near the bottom of the file. Mirror this on web.

**Resting state** (before user taps "Find businesses"):

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  DISCOVER                                        │
│  Find your next interview.                       │ ← serif, "interview." italic + emerald
│                                                  │
│  Pick the kind of business you want to talk to.  │
│  We'll use your GPS and pull up to 20 nearby     │
│  spots that nobody on the team has interviewed   │
│  yet — go knock on a door.                       │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ 🏬  restaurants, barbershops, sari-sari… │  │ ← category input
│  └────────────────────────────────────────────┘  │
│  WHAT KIND OF BUSINESS?                          │
│                                                  │
│  [1 km] [3 km] [5 km] [10 km]                    │ ← radius pills (5 km default)
│  RADIUS                                          │
│                                                  │
│  [FIND BUSINESSES — Show me businesses…]         │ ← solid Door
│                                                  │
│  Cancel                                          │
└──────────────────────────────────────────────────┘
```

**Loading state** (while `scrapeNearby` is in flight) — replaces the input fields with a 3-stage progress panel:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  HANG TIGHT                                      │
│  Looking for restaurants near you.               │ ← business category interpolated
│                                                  │
│  Hold on — we're searching within 5 km. This     │
│  usually takes 5–15 seconds depending on your    │
│  area. Please don't close the app.               │
│                                                  │
│              ╭─────╮                             │
│             ╱       ╲                            │ ← pulsing emerald halo
│            │   🔍    │                           │ ← phase-specific icon
│             ╲       ╱                              ( locate → search → list )
│              ╰─────╯                             │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ ✓  Pinning your spot                      │    │ ← done
│  │    Reading GPS so we search the right…    │    │
│  ├──────────────────────────────────────────┤    │
│  │ ◐  Scanning the map                       │    │ ← active (spinner)
│  │    Checking Google Maps for businesses…  │    │
│  ├──────────────────────────────────────────┤    │
│  │ 3  Adding to your list                    │    │ ← pending
│  │    Saving the ones nobody on the team…   │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  [STEP 2 OF 3 — Looking for nearby businesses…] │ ← Door, disabled, animated
│                                                  │
│  Please don't close the app — this takes a few   │ ← replaces "Cancel"
│  seconds.                                        │
└──────────────────────────────────────────────────┘
```

Three phases, in order. Use a state machine in the modal:

```typescript
type ScrapePhase = 'idle' | 'locating' | 'searching' | 'saving';
```

| Phase | Caption (Door eyebrow) | Door label | Icon | Hint text |
|---|---|---|---|---|
| `locating` | `STEP 1 OF 3` | `Finding where you are…` | `locate` | "Reading GPS so we search the right neighborhood." |
| `searching` | `STEP 2 OF 3` | `Looking for nearby businesses…` | `search` | "Checking Google Maps for businesses around you." |
| `saving` | `STEP 3 OF 3` | `Almost ready — saving results…` | `list` | "Saving the ones nobody on the team has met yet." |

Step list rendering rules:
- **Done steps** — checkmark in an emerald circle, row background `colors.accentBg`, ink-2 text
- **Active step** — small spinner in a ring, row background `colors.paper3`, full ink text, 1.5px emerald border
- **Pending steps** — numbered dot (1/2/3) in a hollow circle, row background `colors.paper2`, ink-3 text

Pulse animation on the halo: `0.4 → 1.0` opacity + `0.95 → 1.05` scale, 900ms each way, ease-in-out, infinite loop.

After `scrapeNearby` resolves, hold the modal on `saving` for ~350ms so the user sees the final stage flip, then show a success toast:

> Found nearby businesses — `{result.total}` businesses found nearby. Added `{result.inserted}` new ones to your interview list (`{result.skipped}` were already on it).

Then auto-close the modal and reset to `idle`.

Error handling — match mobile's branching on the error message:

| Error message contains | User-facing toast |
|---|---|
| `not authenticated` (case-insensitive) | "Please sign in again — your session has expired. Please log out and back in to use this feature." |
| `forbidden` or `admin` (case-insensitive) | "Not available yet — this feature is being rolled out. Your account isn't enabled for it yet. Check back soon." (This shouldn't fire post-fix, but keep it as a safety net.) |
| `OUTSCRAPER_API_KEY` | "Temporarily unavailable — the business-search service is offline right now. Please try again later." |
| anything else | "Search failed — {message}" |

GPS permission: on web use `navigator.geolocation.getCurrentPosition`. If the user denies, show an inline error in the modal ("Please grant location permission so we can search businesses near your current position.") and reset to `idle`.

### Tabs (below the action Doors)

```
┌─────────────────────────────────────────────────────────┐
│  INTERVIEWED (38)                                       │ ← active (ink underline, ink text)
└─────────────────────────────────────────────────────────┘
   PROSPECTS · TO INTERVIEW (24)                            ← inactive (ink3 text)
```

Active tab gets a 2px ink-bottom-border. Counts in parens are real-time (subscribe to both queries simultaneously). URL state: `?tab=interviewed` (default) vs `?tab=prospects`.

---

## Interviewed tab — card grid

### Filters row (sticky on scroll)

| Filter | Token | Notes |
|---|---|---|
| Search input | `EditorialInputFrame` | Search across business name, owner name, phone, lead name, submitter display name. Debounce 300ms. |
| Status pill row | `Pill` × 6 | `All / New / Contacted / Qualified / Converted / Lost`. Stat counts in parens (`New · 12`). |
| "Only mine" toggle | `Pill` (active state) | When active, sets `onlyMine: true`. Counts in pill labels update to filtered counts. |

### Lead cards (grid)

- Desktop: 2–3 column grid (CSS `repeat(auto-fill, minmax(360px, 1fr))`)
- Tablet: 2 cards per row
- Mobile (web responsive): 1 card per row — should match mobile native screen closely

Each card has **two render modes** depending on `hasEnrichedContent`:

**Standard mode** (no admin content):

```
┌────────────────────────────────────────┐
│  ●  BUSINESS NAME              ★ HOT   │  ← header: avatar of submittedBy, mono label, optional hot star
│     City, Type                          │
│  ┌──────────────────────────────────┐  │
│  │ Owner: Maria Cruz                 │  │
│  │ Phone: 0917 234 1234              │  │
│  │ NEW · Submitted by Maria S. · 2d │  │  ← status pill + submitter chip + time
│  └──────────────────────────────────┘  │
│  [View detail →]                       │
└────────────────────────────────────────┘
```

**Social-card mode** (when `hasEnrichedContent === true` — FB-style):

```
┌────────────────────────────────────────┐
│  Maria S. · 2d ago               ⋯     │  ← submitter strip
│                                          │
│  Lorenzo's Sari-Sari Store              │  ← serif headline
│  in italics for accent word              │
│                                          │
│  [hero image — previewImageUrl]         │  ← 16:9 max-h-280 cover
│                                          │
│  Admin description text (max 500 ch)... │  ← Body, ink-2
│                                          │
│  ┌──────────────────────────────────┐  │
│  │ EXTERNAL LINK ↗                   │  │  ← externalPreviewUrl as link card
│  └──────────────────────────────────┘  │
│                                          │
│  NEW · 3 interviewers                  │
└────────────────────────────────────────┘
```

Both card modes are clickable (full card → detail route). Use semantic `<article>` and an inner `<Link>` for keyboard nav.

### Empty + loading + error

- Loading: skeleton cards (paper-2 background, animated shimmer using `colors.rule` → `colors.ruleStrong`)
- Empty (no leads at all): editorial empty state — large serif "Nothing yet." + Onest sub-copy "The team's leads will appear here as soon as someone submits a business." + Door button "Submit a business" linking to `/creators/submit`
- Empty (filters applied): "No leads match these filters." + ghost Door "Clear filters"
- Error: `colors.danger` banner, no retry button (Convex auto-retries)

---

## Prospects tab — card grid (NEW)

Reads `api.outscraper.listScrapedLeads({})` — returns all leads where `source === "outscraper"`, sorted newest-first.

### Card design — creator-facing (NOT admin-facing)

```
┌──────────────────────────────────────────────────────────┐
│  📍                                       ⭐ 4.3 · 127   │  ← Google rating + review count
│                                                          │
│  Negosyo Barbershop                                      │  ← serif headline
│  Barbershop · Quezon City                                │
│                                                          │
│  123 P. Tuazon Blvd, Cubao, Quezon City                  │
│  0917 555 1234 · negosyobarber.ph                        │
│                                                          │
│  Scraped 3h ago             [I'll interview this] [Directions] │
└──────────────────────────────────────────────────────────┘
```

### When a prospect is already claimed by someone else

```
┌──────────────────────────────────────────────────────────┐
│  📍                                       ⭐ 4.3 · 127   │
│                                                          │
│  Negosyo Barbershop                                      │
│  Barbershop · Quezon City                                │
│                                                          │
│  123 P. Tuazon Blvd, Cubao, Quezon City                  │
│  0917 555 1234 · negosyobarber.ph                        │
│                                                          │
│  ●  Claimed by Maria S. · 1h ago                  [Directions] │  ← shows claimer's name + time
└──────────────────────────────────────────────────────────┘
```

The claim is **informational, not exclusive** — another creator can still walk in and interview the business. The "claimed" pill is a coordination signal so two creators don't waste a trip to the same place at the same time. If 24 hours pass without a submission appearing for that prospect, the claim auto-expires (cron, see Step 9).

### When a creator has claimed it themselves

```
┌──────────────────────────────────────────────────────────┐
│  📍                                       ⭐ 4.3 · 127   │
│                                                          │
│  Negosyo Barbershop                                      │
│                                                          │
│  ●  YOU claimed this · 1h ago                  [Release] │  ← release button
│  [Directions] [Start interview →]                              │  ← straight into submit flow
└──────────────────────────────────────────────────────────┘
```

"Start interview →" deep-links the creator straight into the submit flow with the business name + address pre-filled. See Step 10.

### Buttons per card

- **I'll interview this** — claims the prospect for the current creator. Calls `outscraper.claimProspect({ leadId })`. Card updates optimistically to "YOU claimed this" state. Shows release button.
- **Directions** — opens `https://www.google.com/maps/search/?api=1&query={lat},{lng}` in a new tab. Use the label "Directions" and `Ionicons map-outline` (matches the detail-page Directions button). Available regardless of claim state.
- **Release** (when YOU claimed) — calls `outscraper.releaseProspect({ leadId })` to un-claim. Lets another creator take it.
- **Start interview →** (when YOU claimed) — deep links to `/creators/submit?businessName=...&phone=...&address=...&city=...&prospectLeadId=...` (or your web submit-flow equivalent). The prospect lead is linked to the future submission via a query param so the backend can mark it "interviewed" when the submission gets approved.

### Filter bar

- **Category chips** — dynamically built from `businessCategory` values across all prospects. Examples: `All / Barbershop / Restaurant / Salon / Sari-sari / Other`. Shows count per category in parens.
- **Rating filter pill** — `Any / 4+ ★ / 4.5+ ★` (filters `businessRating`)
- **City filter** — text input that filters `businessCity` (case-insensitive contains)
- **Claim filter pills** — `All / Unclaimed / Mine` — defaults to `Unclaimed` (so creators see what's available first)
- **Search input** — full-text across businessName, businessAddress, businessPhone (300ms debounce)

### Sort order

- Default: newest-scraped first (`scrapedAt desc`)
- Dropdown: "Highest rated" (`businessRating desc`) · "Most reviews" (`businessReviewCount desc`) · "Alphabetical" (`businessName asc`)

### Empty / loading / error

- **Loading** — 4 skeleton cards (paper-2 bg, animated shimmer)
- **Empty (no prospects at all)** — Editorial-style empty state:
  > Nothing to interview *yet.*
  >
  > Tap **Find Local Business** above — it'll scan your current location and add prospects here within seconds.
- **Empty (filters applied)** — "No matches. — Clear filters" ghost button
- **Error** — danger banner (`#B43A1F` on `#F3D7CF`), no retry button (Convex auto-retries on its own)

---

## Detail page UX spec — Interviewed leads (`/creators/leads/[leadId]`)

Two-column on desktop, single-column on tablet/mobile.

> **Mobile parity check.** The mobile detail screen (`ndm/app/(app)/leads/[leadId].tsx`) has SEVEN sections + four action buttons. The web detail page must include all of them — earlier versions of this spec missed Directions, View Website, and the Interviewed-by roster. Don't skip them.

### Left column (60% width)

1. **Breadcrumb** — `STEP 03 / TEAM LEADS / Lorenzo's Sari-Sari Store`. Last segment serif italic if admin-curated.
2. **Submitter strip** — Avatar + display name + relative time ("Submitted by Maria S. · 2d ago"). If `isMine`, append a small `MINE` mono pill.
3. **Status row** — current status as a large pill. If `isMine` or admin, click to open status update dropdown. Status changes write via `leads.updateStatus`.
4. **Admin social card** (if `hasEnrichedContent`) — exact same FB-style render as the list card, full-width.
5. **Customer card** — paper-3 Card with `lead.name`, `lead.phone`, `lead.email` (if present). Two primary action buttons inline at the bottom of this card:
   - **Call** — `colors.accentSolid` (emerald) ink-on-fill button, `Ionicons name="call"`. Wires to `tel:{phone}`. Skip render if no phone.
   - **Email** — `colors.business` (ink-blue) ink-on-fill button, `Ionicons name="mail"`. Wires to `mailto:{email}`. Skip render if no email.
6. **Business profile card** — paper-3 Card with `business.businessName` (Display sm), `business.businessType` (Body xs ink3), and a vertically-stacked metadata block with leading Ionicons:
   - `person-outline` + `business.ownerName`
   - `call-outline` + `business.ownerPhone`
   - `mail-outline` + `business.ownerEmail` (if present)
   - `location-outline` + full address line: `{address}, {city}, {province}`
   - Optional: horizontal scrollview of `business.photos` thumbnails (104×104, rounded `radius.sm`, tap to open lightbox)
   - **Two action buttons** below the metadata, side-by-side or stacked depending on width:
     - **Directions** — `colors.paper2` fill + `colors.rule` border, `Ionicons name="map-outline"` + label "Directions". Opens Google Maps with the business address. URL: `https://www.google.com/maps/search/?api=1&query={encodeURIComponent(address + ', ' + city)}`. **Must always be present** when the business has an address (which is always — submissions require address).
     - **View website** — `border: 1px solid colors.accent`, transparent fill, `Ionicons name="globe-outline"` in accent + label "View website" in accent. Wires to `business.websiteUrl`. **Only renders when `business.websiteUrl` is set** (i.e., the submission's generated site has been deployed). **Don't hide the button entirely if `websiteUrl` is null — instead render a disabled/ghost version that says "Website not live yet"** so creators understand the state.
7. **Interviewed by (interviewer roster)** — paper-3 Card with a mono `INTERVIEWED BY` eyebrow and a `{count} {count===1?'creator':'creators'}` pill in the top-right. The body is a list of every creator who has interviewed this business (matched by `business.ownerPhone` normalization, computed server-side in `getDetailForMobileCRM` and returned as `interviewers[]`). Each row:
   - Avatar (image OR initial-on-bg fallback). If `interviewer.isMine === true`, use `colors.accent` bg and 3px left-border on the row container.
   - Display name + small `YOU` mono pill when `isMine`
   - Mono subtitle: `{relative time} · {submission status}` (status text in `colors.danger` when `submissionStatus === "rejected"`, otherwise `colors.ink2`)
   - Row background: `colors.accentBg` when `isMine`, `colors.paper2` otherwise. Opacity 0.6 when rejected AND not isMine.
   - Empty state when `interviewers.length === 0`: render serif italic "No interview history found for this business." (paper-3 background, no row)
   - **This section is what surfaces the "this business has been interviewed 3 times — it's hot" pattern.** Don't omit it.
8. **Notes feed** — paper-3 Card. Mono `NOTES ({count})` eyebrow. List of notes (latest first) rendered as `colors.paper2` rounded bubbles. Below the list, an `EditorialField` textarea + accent send button. POST goes to `leadNotes.add`. Optimistic update; toast on failure.

### Right column (40% width — sticky on desktop)

The right column is the **at-a-glance contact + action shortcut bar**. It mirrors the in-card buttons from the left column but keeps them visible while the creator scrolls through interviewers + notes.

1. **Quick contact card** — phone (click-to-call), email (click-to-mailto), copy-to-clipboard buttons next to each.
2. **Quick actions card** — duplicate Door buttons for Directions + View website (or "Website not live yet" ghost when unavailable). Right column should NEVER show different state than the left — they're synced reflections of the same `lead.business.websiteUrl` and address.
3. **Lead metadata** — created date, source (`lead.source` — `website` / `qr_code` / `direct` / `outscraper`), lead ID (small mono, click-to-copy).
4. **Submission link** — if `lead.submissionId` is set, link to the underlying submission detail page. Renders as ghost Door: `[View submission →]`.

### Mobile (web responsive)

Collapse to single column. Sticky right column becomes a "Quick actions" bottom sheet triggered by a Door button. The Directions + View website + Call buttons should ALSO appear inline within their respective cards on mobile (not just in the sheet) — creators tend to scroll, so the buttons need to be reachable inside the flow too.

---

## Detail page UX spec — Prospect leads (NEW)

Render conditionally when `lead.submissionId == null && lead.source === "outscraper"`.

Two-column on desktop, single-column on mobile.

### Left column (60%) — Business profile + claim state

| Section | Source |
|---|---|
| Mono eyebrow: "STEP 03 / TO INTERVIEW" + LiveDot | static |
| Serif headline: business name | `lead.businessName` |
| Sub-line: `Category · City` | `lead.businessCategory` + `lead.businessCity` |
| Rating display: `⭐ 4.3 (127 reviews)` | `lead.businessRating` + `lead.businessReviewCount` |
| Full address card (paper-3 with map pin icon + clickable "Open in Maps") | `lead.businessAddress` |
| Contact card (phone tap-to-call, website tap-to-open) | `lead.businessPhone`, `lead.businessWebsite` |
| Claim state | `lead.claimedByCreatorId` + `lead.claimedAt` |
| Notes feed (so creators can leave field notes for the team) | `leadNotes` rows for this lead |

### Right column (40%, sticky on desktop) — Quick actions

| Action | When | What it does |
|---|---|---|
| Open in Google Maps | Always | `https://www.google.com/maps/search/?api=1&query={lat},{lng}` |
| I'll interview this | Unclaimed OR claim expired | `outscraper.claimProspect({ leadId })` |
| Start interview → | YOU claimed | Deep-link to `/creators/submit?...` with pre-filled fields |
| Release this | YOU claimed | `outscraper.releaseProspect({ leadId })` |
| Add note | Always | `leadNotes.add({ leadId, content })` |

Notes work the same as on the Interviewed detail page — creators leave field notes ("Owner is busy on Tuesdays" / "Closed for renovation until next month") that the whole team sees.

### What if the prospect is claimed by someone else?

Show their name and claim time prominently in the left column. The "I'll interview this" button stays visible but with a confirmation modal:

> Maria S. claimed this 2 hours ago. You can still go ahead, but you might bump into her at the door. Continue anyway?
>
> [Cancel] [Yes, claim it for me too]

If they confirm, overwrite the claim with the current creator's ID (add a small audit log entry if your stack supports it).

---

## Backend additions on web side (NEW)

Three new Convex functions in `convex/outscraper.ts` + a cron + a schema patch. All additive, safe to deploy.

### `convex/outscraper.ts` — add these to the existing file

```typescript
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// Creator claims a prospect for follow-up (informational, not exclusive)
export const claimProspect = mutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx); // any signed-in creator
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");
    if (lead.source !== "outscraper") {
      throw new Error("Can only claim Outscraper prospects, not customer leads");
    }
    if (lead.submissionId) {
      throw new Error("This prospect has already been interviewed");
    }

    const creator = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!creator) throw new Error("Creator profile not found");

    await ctx.db.patch(args.leadId, {
      claimedByCreatorId: creator._id,
      claimedAt: Date.now(),
    });
  },
});

export const releaseProspect = mutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    const creator = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!creator) throw new Error("Creator profile not found");

    if (lead.claimedByCreatorId !== creator._id) {
      throw new Error("You can only release your own claims");
    }

    await ctx.db.patch(args.leadId, {
      claimedByCreatorId: undefined,
      claimedAt: undefined,
    });
  },
});

// Fetch a single prospect with claimer info enriched (for the detail view)
export const getProspect = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.source !== "outscraper") return null;

    let claimedBy = null;
    if (lead.claimedByCreatorId) {
      const c = await ctx.db.get(lead.claimedByCreatorId);
      if (c) {
        claimedBy = {
          creatorId: String(c._id),
          displayName: [c.firstName, c.lastName?.[0]].filter(Boolean).join(" "),
          profileImage: c.profileImage ?? null,
        };
      }
    }
    return { lead, claimedBy };
  },
});

// Auto-release stale claims (>24h old). Called by the cron below.
export const releaseStaleClaimsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const threshold = Date.now() - 24 * 60 * 60 * 1000;
    const stale = await ctx.db
      .query("leads")
      .filter((q) =>
        q.and(
          q.eq(q.field("source"), "outscraper"),
          q.eq(q.field("submissionId"), undefined),
          q.lt(q.field("claimedAt"), threshold),
        ),
      )
      .collect();
    for (const lead of stale) {
      await ctx.db.patch(lead._id, {
        claimedByCreatorId: undefined,
        claimedAt: undefined,
      });
    }
  },
});
```

### `convex/crons.ts` — add the stale-claim sweeper

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "release stale prospect claims",
  { hours: 1 },
  internal.outscraper.releaseStaleClaimsInternal,
);
export default crons;
```

### `convex/schema.ts` — schema additions

```typescript
leads: defineTable({
  // ... existing fields ...
  // NEW — for prospect claims by creators
  claimedByCreatorId: v.optional(v.id("creators")),
  claimedAt: v.optional(v.number()),
}).index(/* existing indexes unchanged */)
  .index("by_claimed_creator", ["claimedByCreatorId"]); // NEW
```

Additive only — both new fields are `v.optional`. No existing field changed.

---

## Outscraper backend essentials (reference — already deployed)

The `convex/outscraper.ts` file lives on the web side (web is source of truth). Mobile keeps a type-stub mirror so codegen works. The action shape, response handling, env vars, and dedupe logic are all documented in `ndm/convex/outscraper.ts` if you need to copy or compare.

Key facts the web agent needs:

- **API endpoint:** `https://api.outscraper.com/maps/search`
- **Auth header:** `X-API-KEY: {OUTSCRAPER_API_KEY}` (env var, already set on prod by mobile team — don't re-set)
- **Dedupe:** the `insertScrapedLead` internal mutation skips inserts where `businessGooglePlaceId` already exists (via the `by_place_id` index on the `leads` table)
- **Attribution:** scraped leads are attributed to the calling creator's `creators` row (`creatorId` field on the lead). If the caller doesn't have a creator row, falls back to the first creator in the system as a placeholder owner — this is fine for now since the scrape action is creator-gated
- **Rate/cost:** Outscraper charges per result. At ~$0.001/result × 20 results, each tap costs ~$0.02. `limit` defaults to 20, max 50
- **Response shape:** Outscraper returns `data: [[result1, result2, ...]]` (nested array) for single-query calls. The action flattens both nested and flat shapes

The action source is at `ndm/convex/outscraper.ts` — copy it verbatim if your web copy is out of date. **Make sure both `scrapeNearby` and `listScrapedLeads` use `requireAuth(ctx)`, not `requireAdmin(ctx)`** — see the 2026-05-27 callout earlier in this doc.

---

## 🛑 2026-05-28 — Outscraper query-format bug (currently broken on prod)

> **Symptom:** Creator taps Find Local Business → 3-stage loader runs for 20–25 seconds → success alert appears with **"0 businesses found nearby. Added 0 new ones."** Convex log shows `outscraper:scrapeNearby success 24.2s` — no error, just empty results.
>
> **Root cause:** The deployed `convex/outscraper.ts` builds its Outscraper request like this:
>
> ```typescript
> // ❌ BROKEN — Outscraper's /maps/search endpoint ignores these standalone params
> new URLSearchParams({
>   query: args.query,                    // "salon"
>   coordinates: args.location,           // "14.30,121.00"
>   radius: String(radiusMiles),          // "3"
>   limit: String(limit),
>   async: "false",
>   language: "en",
>   region: "PH",
> });
> ```
>
> Outscraper's `/maps/search` endpoint does NOT accept `coordinates` and `radius` as separate query params. It silently drops them and runs `query=salon` as a worldwide search, which exceeds the synchronous-mode result budget and ends up returning an empty `data: [[]]`. The 24-second response time is the API's internal fallback to async mode — it returns an empty payload rather than a proper job ID, so our handler thinks "success, 0 results."
>
> **Fix (already applied in `ndm/convex/outscraper.ts`):** Embed the location and radius INSIDE the query string per Outscraper's documented format:
>
> ```typescript
> // ✅ CORRECT — Outscraper docs: "query=salons, 40.7,-73.9, 3mi"
> const radiusMiles = Math.max(1, Math.round(radiusKm * 0.621371));
> const userCategory = args.query.trim() || "businesses";
> const queryString = `${userCategory}, ${args.location}, ${radiusMiles}mi`;
> // → "salon, 14.30,121.00, 3mi"
>
> const params = new URLSearchParams({
>   query: queryString,
>   limit: String(limit),
>   async: "false",
>   language: "en",
>   region: "PH",
> });
> ```
>
> Also added: a `console.log` of the outbound query string (for Convex log debugging), a `console.log` of the result count, and a guard that throws if Outscraper falls back into async mode (returns `status: "Pending"` with no `data`) instead of silently reporting 0. The async-fallback guard prevents the misleading "0 businesses found" UX from masking a real upstream problem.
>
> **Action required on web side:** copy the entire `handler` body of `scrapeNearby` from `ndm/convex/outscraper.ts` over to your web copy and `npx convex deploy --prod`. The args validator is unchanged so the mobile caller doesn't need any update. After deploy, the next Find Local Business tap should return real results.
>
> **How to verify after deploy:**
> 1. Tap Find Local Business with category `salon`, radius 5km, anywhere with businesses around you
> 2. Check Convex prod logs — should see `[outscraper] scrapeNearby → salon, 14.30,121.00, 3mi (limit=20)` followed by `[outscraper] received N businesses from Outscraper` where N > 0
> 3. Alert should now show `N businesses found nearby. Added N new ones to your interview list (0 were already on it).`

---

## Mobile coordination — deep link from "Start interview"

The web "Start interview →" button (when a creator has claimed a prospect) launches the existing submit flow with the prospect's business data pre-filled. The web submit flow lives on the web side; the deep link is just a URL with query params.

Recommended URL shape:

```
/creators/submit?prospectLeadId=j5...&businessName=Negosyo%20Barbershop&phone=09175551234&address=123%20P.%20Tuazon%20Blvd&city=Quezon%20City&category=Barbershop
```

When the existing submit flow detects `prospectLeadId` in the URL, it should:
1. Pre-fill the business info step with the values from the params
2. On final submit (via the existing mutation that creates a submissions row), include `prospectLeadId` as an optional arg
3. The submissions creation mutation needs a small addition: if `prospectLeadId` is provided, patch the matching lead row to set `submissionId = newSubmissionId` and the lead "graduates" from Prospects to Interviewed automatically

```typescript
export const create = mutation({
  args: {
    // ... existing args ...
    prospectLeadId: v.optional(v.id("leads")), // NEW
  },
  handler: async (ctx, args) => {
    const submissionId = await ctx.db.insert("submissions", { /* ... */ });
    // NEW — link the prospect to this submission
    if (args.prospectLeadId) {
      await ctx.db.patch(args.prospectLeadId, {
        submissionId,
        claimedByCreatorId: undefined, // claim fulfilled
        claimedAt: undefined,
      });
    }
    return submissionId;
  },
});
```

Additive optional args are safe — mobile won't break if it doesn't pass `prospectLeadId`.

---

## Design system — Editorial Paper (web port)

> **Quoted from the mobile theme** (`ndm/theme/tokens.ts`). Use these tokens verbatim — no custom palette extensions, no terracotta/orange anywhere.

### Typography stack

Load all three Google Fonts in the layout:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Onest:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

| Token | Family | Used for |
|---|---|---|
| `--font-serif` | `"Instrument Serif", Georgia, serif` | Display headlines, large numbers |
| `--font-serif-italic` | `"Instrument Serif"` italic | Accent word in headline (set `font-style: italic` + `color: var(--color-accent)`) |
| `--font-sans` | `"Onest", system-ui, sans-serif` | Body, buttons, form labels |
| `--font-mono` | `"JetBrains Mono", Menlo, monospace` | Eyebrows, mono labels, timestamps |

### Color palette (greens + khaki — final, no orange)

```css
:root {
  /* Paper — warm khaki off-whites (page bg, card bg) */
  --color-paper:    #F8F5EE;
  --color-paper-2:  #EFEBE0;
  --color-paper-3:  #FCFAF5;

  /* Ink — near-black, cool (text + primary surfaces) */
  --color-ink:   #1B1C24;
  --color-ink-2: #3C3F4A;
  --color-ink-3: #7A7E8A;

  /* Emerald accent (replaces NEO LAB's terracotta — brand consistency) */
  --color-accent:        #047857;  /* italic display emphasis */
  --color-accent-ink:    #064E3B;
  --color-accent-bg:     #D1FAE5;
  --color-accent-solid:  #10B981;  /* primary "door" fills */

  /* Live (real-time markers) */
  --color-live:      #3FA86A;
  --color-live-soft: #D4EFDE;

  /* Rules / dividers (warm khaki) */
  --color-rule:        #E0D8C9;
  --color-rule-strong: #B7AC95;

  /* Status (CRM lead pipeline) */
  --color-status-new-bg:        #E4E9F0;  --color-status-new-ink:        #1F3654;
  --color-status-contacted-bg:  #FBE9C4;  --color-status-contacted-ink:  #C68A12;
  --color-status-qualified-bg:  #EDE9FE;  --color-status-qualified-ink:  #6D28D9;
  --color-status-converted-bg:  #D1FAE5;  --color-status-converted-ink:  #064E3B;
  --color-status-lost-bg:       #F3D7CF;  --color-status-lost-ink:       #B43A1F;

  /* Critical */
  --color-warn:   #C68A12;
  --color-danger: #B43A1F;
}
```

**The "Hot" badge** (interviewerCount ≥ 3): use `--color-danger-bg` + `--color-danger` text, NOT brand orange. Reads as urgency, not as a brand color.

### Component patterns (mirror mobile primitives)

| Mobile primitive | Web equivalent |
|---|---|
| `<Display size="lg">` | `<h1 className="serif text-6xl tracking-tight">` |
| `<Body size="md">` | `<p className="sans text-base text-ink-2">` |
| `<Label tracking={1.4}>` | `<span className="mono text-[11px] tracking-[0.12em] uppercase text-ink-3">` |
| `<Door variant="solid">` | Black-ink button with mono caption above sans label, right arrow icon |
| `<Door variant="accent">` | Emerald-fill button with white caption + label |
| `<Door variant="ghost">` | Paper-3 fill, ink border, ink caption + label |
| `<Pill active>` | Ink-filled chip with paper text |
| `<Card>` | `bg-paper-3 border border-rule rounded-[18px] p-4` |
| `<LiveDot>` | Pulsing 7px green dot (CSS keyframe animation) |
| `<Avatar name="Maria">` | Round; if no image, render Instrument Serif initial centered on ink-3 bg |
| `<Rule>` | `h-px bg-rule` |
| `<EditorialField>` | Paper-3 input frame, mono label under, focused border ink |

Build these as web React components and reuse across the redesign — same pattern as mobile's `components/ui/primitives.tsx`.

### Spacing scale

```css
--space-xs: 4px;   --space-sm: 8px;   --space-md: 16px;
--space-lg: 24px;  --space-xl: 40px;  --space-2xl: 64px;
```

### Radius scale

```css
--r-xs: 8px;   --r-sm: 12px;   --r-md: 18px;
--r-lg: 24px;  --r-xl: 32px;   --r-pill: 999px;
```

### Shadows (subtle, warm — not material)

```css
--shadow-soft:   0 2px 8px rgba(0,0,0,0.06);
--shadow-lifted: 0 12px 24px rgba(0,0,0,0.12);
```

### Critical "do not" rules

- ❌ No orange. No terracotta. No `#f59e0b`. No `#ea580c`. If you see those, replace with `--color-warn` or `--color-accent` depending on context.
- ❌ No SaaS-y purple gradients on cards.
- ❌ No Inter, no Roboto, no Geist. Onest is the only sans. Instrument Serif is the only display.
- ❌ No `border-radius: 4px` — too sharp. Minimum radius is 8px (`--r-xs`).
- ❌ Don't put emerald on every button. Reserve `--color-accent-solid` for "the win" — Approve a status change, Submit a note successfully. Default primary button is ink-solid.

---

## State management

- **Convex hooks**: `useQuery(api.leads.listForMobileCRM, args)` for Interviewed; `useQuery(api.outscraper.listScrapedLeads, {})` for Prospects; `useQuery(api.leads.getDetailForMobileCRM, { id })` for interviewed detail; `useQuery(api.outscraper.getProspect, { leadId })` for prospect detail. Reactive — no manual refresh.
- **Mutations**: `useMutation(api.leadNotes.add)`, `useMutation(api.leads.updateStatus)`, `useMutation(api.outscraper.claimProspect)`, `useMutation(api.outscraper.releaseProspect)`. Optimistic UI for note posting and claim/release.
- **Actions**: `useAction(api.outscraper.scrapeNearby)` — called from the Find Local Business modal.
- **URL state**: filters (`status`, `search`, `onlyMine`), tab (`?tab=...`), and live-only flag (`?live=true`) live in the URL search params so creators can share/bookmark filtered views.
- **Auth gate**: route protected by the existing Clerk session middleware. Unauthenticated users redirect to `/sign-in?next=/creators/leads`.

---

## Performance budget

| Metric | Budget |
|---|---|
| LCP on `/creators/leads` | ≤ 1.8s on Fast 4G |
| Card grid render with 200 leads | < 16ms paint |
| Search debounce | 300ms |
| Lead detail server response | < 250ms p95 (Convex hosted) |
| Claim round-trip (click → UI update) | < 250ms p95 (optimistic update on the client) |
| Tab switch | Instant (both queries subscribed at page load) |
| Scrape modal end-to-end (locating → saving) | 5–15s typical (network-bound on Outscraper) |

**Pagination:** `listForMobileCRM` and `listScrapedLeads` both load all rows in one shot (mobile expects this for the social feed). If either grows past ~500, add cursor pagination via `paginate()` — propose as a follow-up PR.

---

## Accessibility

- Color contrast: ink on paper = 14.8:1 (AAA). Accent-ink on accent-bg = 7.1:1 (AAA).
- All interactive elements keyboard focusable; visible focus ring (2px ink, 2px offset).
- Lead cards: full card is the link target; nested buttons (status change, copy phone, claim/release) use `event.stopPropagation()` and have their own `aria-label`.
- "Live" badge announces "live data" to screen readers via `aria-live="polite"` on the stats strip.
- Hot badge: don't rely on color alone — include the word "HOT" in the visual + an `aria-label` of "Hot lead — 3 or more interviewers".
- Scrape modal loading panel: each step row should have `aria-current="step"` on the active row; the halo + step list should sit inside an `aria-live="polite"` region so screen reader users hear "Step 2 of 3 — Looking for nearby businesses" when the phase advances.

---

## Implementation order (suggested)

1. **Day 1** — Web design-system primitives (Display, Body, Label, Door, Pill, Card, LiveDot, Avatar, EditorialField, Rule). Drop them in `components/editorial/`. Add Google Fonts to the root layout. Storybook every primitive in light + dark theme (web supports dark via `[data-theme="ink"]` swapping the `--color-*` vars).
2. **Day 2** — Apply the auth-gate fix (`requireAuth` not `requireAdmin`) and deploy `convex/outscraper.ts`. This unblocks the mobile button immediately, no other web work required.
3. **Day 3** — Build the list page route shell. Hook `listForMobileCRM`. Render the filter row + standard-mode Interviewed card. Skip social-card mode, Prospects tab, and detail page for now.
4. **Day 4** — Add the two action Doors at the top (See Live Business + Find Local Business). Build the Find Local Business modal (resting state only — no loading panel yet). Wire it to `scrapeNearby`.
5. **Day 5** — Add the multi-stage loading panel to the Find Local Business modal. Pulse halo + step list. Add the social-card render mode for Interviewed cards. Add empty/loading/error states.
6. **Day 6 (fixes web's broken map UX)** — **Replace the blank Leaflet See Live Business view with the Google Maps implementation per "Map A" spec.** Render the eyebrow + Display + Body header above the map. Plot pins for leads where `submissionId != null && business.websiteUrl != null`. Test bottom-sheet tap interaction. No category variation on this map — single emerald pin style.
7. **Day 7 (the new discover map)** — Build the post-scrape `Map B` at `/creators/leads/discover` per the Find Local Business map spec. Implement category-keyed pin styling (6 categories per the table). Add the sticky legend. Wire the scrape modal's success path to `router.push('/creators/leads/discover?...')` instead of just closing the modal with an Alert. Mirror this work on mobile at `app/(app)/leads/discover.tsx` and link both — mobile is canonical, both should look + behave identically.
8. **Day 8** — Build the Interviewed detail page. Hook `getDetailForMobileCRM`. Render submitter strip, business card, Directions + View website buttons, Interviewers roster, Notes feed. Wire `leadNotes.add` (optimistic) and `leads.updateStatus` (with the `isMine`/admin gate).
9. **Day 9** — Add the Prospects tab. Add `claimProspect` / `releaseProspect` / `getProspect` mutations + the stale-claim cron + schema additions. Deploy. Build the prospect card grid + filters + sort.
10. **Day 10** — Build the Prospect detail page. Add the deep-link integration on the submit flow.
11. **Day 11** — Mobile-responsive pass. Sticky filter bar, single-column collapse, mobile-optimized note input.
12. **Day 12** — Performance pass, a11y audit, ship behind a feature flag for internal review.

---

## End-to-end test (works without admin)

After deploy, sign in as a regular creator (NOT admin) and:

### Interviewed tab
1. Open `/creators/leads` — defaults to Interviewed tab
2. See real cards for businesses the team has interviewed
3. Click a card → detail view loads with business profile + Directions + View website + Interviewer roster + Notes
4. (Status change is admin-only on the creators platform — creators can post notes but typically cannot change status. Hide status dropdown for non-admins.)

### See Live Business map (Map A)
1. Click **See Live Business** at top of `/creators/leads`
2. Lands on `/creators/leads/live` — full-screen Google Maps view, NOT a blank Leaflet canvas
3. Header reads `STEP 03 / LIVE BUSINESSES` + Display "Already-interviewed and live." + sub-copy with the live count
4. Pins are emerald droplets, all same style (no category variation), only over locations of interviewed businesses with live websites
5. Tap a pin → bottom sheet with business name, submitter chip, address, `[Visit website ↗]` `[Directions]` `[View detail →]` buttons
6. **Cross-check parity:** open the same view on mobile (`app/(app)/leads/nearby.tsx`) — pin set, header, and tap interaction should be visually identical

### Find Local Business modal + discover map (Map B)
1. Click **Find Local Business** at top of `/creators/leads`
2. Modal opens with category input + radius pills + Door
3. Type `restaurants`, pick 5km radius, click Door
4. Modal switches to the 3-stage loading panel — see the halo pulse and the step list advance
5. After 5–15s, success toast appears with `inserted/skipped/total` counts
6. **Modal closes and routes to `/creators/leads/discover?category=restaurants&radiusKm=5`**
7. Discover map renders with the warm-khaki "restaurant" pins for the just-scraped results
8. Type a different category in the modal next time (e.g. `barbershops`) → violet `cut-outline` pins appear
9. Sticky legend in top-right shows only the categories present on the map
10. Tap a pin → bottom sheet with rating, address, phone, claim state, `[I'll interview this]` `[Directions]` `[View detail →]` buttons
11. Tap `I'll interview this` → button switches to "YOU claimed this" + Release button appears
12. **Cross-check parity:** the same flow on mobile (`app/(app)/leads/discover.tsx`) should be visually identical

### Prospects tab
1. Switch to Prospects tab
2. See prospect cards with business name, rating, address, phone
3. Filter by category → grid updates
4. Click **I'll interview this** on an unclaimed prospect → button changes to "YOU claimed this" pill
5. Click **Directions** → opens Google Maps in new tab
6. Sign in as a DIFFERENT creator → see the prospect now shows "Claimed by {first creator}"
7. Click into the card → detail view shows business profile + claim state + notes
8. (First creator) Click **Release this** → another creator can now claim

### Graduation flow (prospect → interviewed)
1. Creator clicks **Start interview →** on a claimed prospect → lands on `/creators/submit?prospectLeadId=...&businessName=...&...`
2. Submit flow is pre-filled
3. After submission is created (via `submissions.create` with `prospectLeadId`), the prospect lead gets `submissionId = newSubmissionId` and migrates from Prospects → Interviewed tab on next reactive refresh

### Stale claim expiry
1. Manually patch a lead's `claimedAt` to `Date.now() - 25*60*60*1000` (25 hours ago) via Convex dashboard
2. Wait up to 1 hour for the cron to run (or manually invoke `internal.outscraper.releaseStaleClaimsInternal`)
3. Refresh — the prospect no longer shows as claimed

---

## What you MUST NOT do

- ❌ Do not modify `listForMobileCRM`, `getDetailForMobileCRM`, `updateStatus`, `listScrapedLeads`, `scrapeNearby`, `leadNotes.add` — mobile depends on those exact signatures
- ❌ Do not make claims **exclusive** (i.e., block other creators from also interviewing). Claims are coordination signals, not locks
- ❌ Do not expose prospects to anonymous (signed-out) visitors. Auth-gate the entire `/creators/leads` route
- ❌ Do not show status change controls to non-admin creators on the Interviewed tab unless `isMine === true` (mirrors mobile's gate)
- ❌ Do not use orange anywhere. Editorial Paper palette only. Danger red `#B43A1F` for the "HOT" badge and error states
- ❌ Do not add admin-only actions (assign-to-admin, delete prospect, force-claim) to this page. Those go on the admin panel, separately
- ❌ Do not introduce a second design system. If a primitive is missing, extend `components/editorial/` — don't fall back to the existing zinc/emerald admin styles
- ❌ Do not call admin-only queries (`getDetailForAdmin`, `updateAdminContent`, `generatePreviewImageUploadUrl`, `listPendingApproval`, `approveCreator`) from this page. They are admin-gated and will throw for regular creators

## What's safe to do

- ✅ Add a CSV export of either tab (creator self-service)
- ✅ Show "Days since scraped" badge on stale prospects to nudge creators toward fresh ones
- ✅ Add a "Sort by distance from my last submission location" if you can geocode addresses client-side
- ✅ Add a small "How claims work" tooltip on the Prospects tab explaining the 24h auto-release
- ✅ Add a "Recently claimed by your team" section above the Prospects grid showing the 3 most recently claimed
- ✅ Add a notification ping when a prospect a creator was eyeing gets claimed by someone else

---

## Convex deploy from the web repo

> Mobile and web share the same prod Convex deployment (`prod:energetic-panther-693`). After applying the auth-gate fix + adding the new mutations + schema additions:
>
> 1. `npx convex dev` to validate locally against the shared dev deployment
> 2. `npx convex deploy --prod` from the web repo
> 3. Notify mobile — the new claim/release mutations are creator-callable, so mobile can ALSO add "I'll interview this" buttons on its prospect cards in a future release if you want parity

Schema changes are additive-only. Safe to deploy.

---

## Open questions for the web team

- [ ] **Route slug**: `/creators/leads` or `/dashboard/leads`? Mobile uses `/(app)/leads/` — propose matching the structure.
- [ ] **Dark mode**: mobile is paper-only today. Should the web do paper-only too, or ship `[data-theme="ink"]` from day one? (Mobile follows web's lead here — if web ships dark, mobile will too.)
- [ ] **Feature flag**: which flag system are we using? Should this hide behind a `FF_WEB_LEADS_CRM` or roll out to all signed-in creators at once?
- [ ] **Empty state CTA**: the "Submit a business" Door — does the web Creators platform already have a `/creators/submit` route, or does this need to be a deep-link into the mobile app?

---

## Mobile source references

- `ndm/app/(app)/leads/index.tsx` — list page (Interviewed feed + the two action Doors + Find Local Business modal with the multi-stage loading panel)
- `ndm/app/(app)/leads/[leadId].tsx` — interviewed detail view (7 sections + 4 buttons, mirror exactly)
- `ndm/app/(app)/leads/nearby.tsx` — the on-device map view (See Live Business destination on mobile). Not strictly needed for web v1, but worth referencing if you want to add a map-view toggle as v2
- `ndm/convex/outscraper.ts` — source of truth for the Outscraper backend. **Make sure your deployed copy uses `requireAuth`, not `requireAdmin`** for both `scrapeNearby` and `listScrapedLeads`
- `ndm/convex/leads.ts` — `listForMobileCRM` and `getDetailForMobileCRM` definitions
- `ndm/components/ui/primitives.tsx` — Display / Body / Label / Door / Pill / Card / LiveDot / Avatar / Rule. Mirror these as web React components in `components/editorial/`
- `ndm/theme/tokens.ts` — canonical token source (palette, fonts, radius, spacing)
