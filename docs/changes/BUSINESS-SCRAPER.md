# Web-side prompt — Outscraper map-scraping + Google Drive folder sync

> **Hand this entire document to the agent / developer working in the web repo.** Self-contained spec for matching the two backend features mobile shipped on 2026-05-22.
>
> **Sister docs:** [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md), [WEB-LEAD-CRM-CREATORS-PAGE.md](./WEB-LEAD-CRM-CREATORS-PAGE.md), [WEB-CREATOR-REJECTION.md](./WEB-CREATOR-REJECTION.md). All apply the same Editorial Paper design tokens (greens + khaki, NO orange).

---

## Current state — web is the source of truth, mobile is waiting on you

**Read this before you touch anything.** Mobile and web share ONE Convex deployment (`prod:energetic-panther-693`). On 2026-05-22, mobile built three features (Outscraper scrape, Drive folder sync, SEO interview questions) but has **NOT** yet deployed any of the backend code or schema changes to prod. Mobile is intentionally waiting for the web team to deploy first, so the web repo becomes the canonical source for shared Convex code going forward.

**Your job is to drive this entire change end-to-end:**
1. Apply schema additions + copy two new files into the web repo
2. Wire up the new functionality in admin UI
3. Deploy from the web repo
4. Notify mobile that they can now rebuild their APK to use the live features

### What's already provisioned (you do NOT need to redo)

| Provisioned by mobile setup | Status |
|---|---|
| Outscraper account + API key | ✓ Live |
| `OUTSCRAPER_API_KEY` Convex env var on prod | ✓ Set |
| Google Cloud project + Drive API enabled | ✓ Live (`negosyo-digital` project) |
| Service account `negosyo-drive-sync@negosyo-digital.iam.gserviceaccount.com` | ✓ Created with JSON key |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` Convex env var on prod | ✓ Set |
| Shared Drive parent folder `Negosyo Digital` (folder ID `1gOYcGQnblLMiqFEBJXc4VWphhXYepj9B`) | ✓ Created and shared with the SA as Editor |
| `GOOGLE_DRIVE_PARENT_FOLDER_ID` Convex env var on prod | ✓ Set to the folder ID above |
| Mobile UI: "Pull nearby businesses" button on Leads page + scrape modal | ✓ Built (will go live when mobile rebuilds APK after your deploy) |
| Mobile UI: SEO-rewritten interview questions in submit/interview.tsx | ✓ Built (same — live after mobile rebuild) |

### Your work (pending — listed in execution order)

| Step | Task | Done? |
|---|---|---|
| 1 | Apply schema additions to `convex/schema.ts` (Drive fields on submissions + Outscraper fields on leads) | ❑ |
| 2 | Copy `convex/outscraper.ts` from mobile repo verbatim | ❑ |
| 3 | Copy `convex/drive.ts` from mobile repo verbatim + widen `convex/lib/auth.ts` to accept `ActionCtx` | ❑ |
| 4 | Wire `syncSubmissionToDrive` into existing `approveSubmission` mutation via `ctx.scheduler.runAfter(0, ...)` | ❑ |
| 5 | Build admin UI: "Lead prospects" view (Surface A) + "Drive" section on submission detail (Surface B) | ❑ |
| 6 | Acknowledge SEO interview question changes — update any web-side docs / emails / marketing copy that references the old prompts | ❑ |
| 7 | Run `npx convex deploy` from the web repo (LAST — only after Steps 1–6 are done) | ❑ |
| 8 | Run end-to-end test with mobile team; then ping mobile so they can rebuild & ship the APK | ❑ |

**Critical rule:** Additive-only. Do NOT modify, rename, or remove any existing schema fields, exports, or admin UI. Only ADD.

**You do NOT need to:**
- Sign up for Outscraper (mobile team did it; API key already on prod)
- Create a Google service account (mobile team did; key + folder ID already on prod)
- Share the `Negosyo Digital` Drive folder with the SA (already shared with Editor)
- Set ANY Convex env vars — all three (Outscraper key, Drive SA JSON, Drive folder ID) are already live on prod

If you need to test locally before deploying, your `npx convex dev` deploys to the SHARED dev deployment (`diligent-ibex-454`), which has its own (empty) env vars. Coordinate with mobile if you need the same env vars set on dev too, OR skip dev testing and verify in prod immediately after deploy.

---

## Step 1 — Apply additive schema accommodations in `convex/schema.ts`

Locate the `submissions` table. Add the Google Drive sync fields right after the existing `payoutRequestedAt` line:

```typescript
submissions: defineTable({
  // ... existing fields ...
  cloudflareZoneId: v.optional(v.string()),
  payoutRequestedAt: v.optional(v.number()),
  // NEW — Google Drive folder structure (created when submission is approved)
  driveFolderId: v.optional(v.string()),
  driveFolderUrl: v.optional(v.string()),
  driveFolderCreatedAt: v.optional(v.number()),
  driveSyncStatus: v.optional(v.union(
    v.literal("pending"),
    v.literal("creating"),
    v.literal("synced"),
    v.literal("failed"),
  )),
  driveSyncError: v.optional(v.string()),
}).index("by_creator_id", ["creatorId"])
  // ... existing indexes unchanged ...
```

Locate the `leads` table. Replace the existing definition with this expanded version — note that `submissionId`, `name`, and `phone` are now **optional** to support Outscraper-scraped leads that don't have a customer/submission association yet:

```typescript
leads: defineTable({
  // submissionId now optional — Outscraper leads are prospect businesses
  // not yet onboarded, so they don't have a submission record.
  submissionId: v.optional(v.id("submissions")),
  creatorId: v.id("creators"),
  source: v.union(
    v.literal("website"),
    v.literal("qr_code"),
    v.literal("direct"),
    v.literal("outscraper"), // NEW
  ),
  // name/phone now optional — outscraper leads use businessName + businessPhone instead.
  // Existing customer leads continue to populate these.
  name: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  status: v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified"), v.literal("converted"), v.literal("lost")),
  createdAt: v.number(),
  // Admin-curated content (existing — unchanged)
  adminDescription: v.optional(v.string()),
  previewImageUrl: v.optional(v.string()),
  previewImageStorageKey: v.optional(v.string()),
  externalPreviewUrl: v.optional(v.string()),
  adminUpdatedAt: v.optional(v.number()),
  adminUpdatedBy: v.optional(v.string()),
  // NEW — Outscraper-scraped fields (populated when source === "outscraper")
  businessName: v.optional(v.string()),
  businessAddress: v.optional(v.string()),
  businessCity: v.optional(v.string()),
  businessCategory: v.optional(v.string()),
  businessWebsite: v.optional(v.string()),
  businessLatitude: v.optional(v.number()),
  businessLongitude: v.optional(v.number()),
  businessRating: v.optional(v.number()),
  businessReviewCount: v.optional(v.number()),
  businessGooglePlaceId: v.optional(v.string()),
  scrapedAt: v.optional(v.number()),
  scrapedBy: v.optional(v.string()),
}).index("by_submission", ["submissionId"])
  .index("by_creator", ["creatorId"])
  .index("by_status", ["status"])
  .index("by_place_id", ["businessGooglePlaceId"]),
```

### Compatibility callouts

- **Don't make `name` / `phone` required again.** Existing customer leads have them populated; new Outscraper leads do not. Both should validate.
- **Don't drop `by_place_id`.** The mobile scrape action dedupes via this index.
- If `submissionId`-based queries break in the web admin (because the field is now optional), narrow with a guard: `if (lead.submissionId) { /* customer-lead-only logic */ }`.

---

## Step 2 — Copy `convex/outscraper.ts` from mobile

The full file is at `ndm/convex/outscraper.ts` in the mobile repo. Copy it verbatim to the web repo's `convex/outscraper.ts`. It exports:

| Export | Type | Who calls it |
|---|---|---|
| `scrapeNearby` | `action` (admin only) | Mobile Leads page "Pull nearby businesses" button |
| `insertScrapedLead` | `internalMutation` | Internal — invoked by `scrapeNearby` |
| `listScrapedLeads` | `query` (admin only) | Web admin page (you'll build it in Step 5) |

The action reads `process.env.OUTSCRAPER_API_KEY` from Convex env vars — the mobile team has already set this on prod. You don't need to set it again.

---

## Step 3 — Copy `convex/drive.ts` from mobile

Same as Step 2 — copy `ndm/convex/drive.ts` verbatim. Key exports:

| Export | Type | Who calls it |
|---|---|---|
| `syncSubmissionToDriveManual` | `action` (admin only) | The "Re-sync to Drive" button you'll add in Step 4 |
| `syncSubmissionToDrive` | `internalAction` | Internal — called by your `approveSubmission` mutation via `ctx.scheduler.runAfter` |
| `getSubmissionForSync` | `internalQuery` | Internal helper |
| `setDriveStatus` | `internalMutation` | Internal helper |

Env vars already set on prod by mobile team:
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_DRIVE_PARENT_FOLDER_ID`

The `convex/lib/auth.ts` file also got a small change — `requireAdmin` and `requireAuth` now accept `ActionCtx` in addition to `QueryCtx | MutationCtx`. Apply the same widening to your `convex/lib/auth.ts`.

---

## Step 4 — Trigger Drive sync from your existing approveSubmission mutation

Find the existing admin mutation that flips a submission's status to `"approved"` (likely in `convex/submissions.ts` or `convex/admin.ts`). At the END of that mutation — AFTER the patch but BEFORE returning — schedule the Drive sync:

```typescript
import { internal } from "./_generated/api";

export const approveSubmission = mutation({
  args: { id: v.id("submissions"), /* ... existing args ... */ },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // ... existing approval logic (patch status, log audit, etc.) ...

    // NEW — kick off the Drive folder structure creation
    await ctx.scheduler.runAfter(0, internal.drive.syncSubmissionToDrive, {
      submissionId: args.id,
    });

    // ... existing return ...
  },
});
```

Why `runAfter(0, ...)` and not awaiting directly? Drive uploads can take 10–60 seconds depending on photo/video count. Mutations have a strict time budget. Scheduling lets the approval mutation return immediately while the Drive sync runs in the background. The submission row gets `driveSyncStatus: "creating"` → `"synced"` (or `"failed"`) as the work progresses, so the admin UI can show progress.

---

## Step 5 — Build two admin UI surfaces

### Surface A — Scraped leads view ("Lead prospects")

Sibling tab to the existing leads view. Reads from `listScrapedLeads` (which filters `source === "outscraper"`).

Per-row:
- Business name (large, serif Display)
- Business category + city
- Rating (e.g. ⭐ 4.3 · 127 reviews)
- Address + phone (click-to-call)
- Status pill (new / contacted / qualified / converted / lost — same as customer leads)
- "Open in Google Maps" link (use `https://www.google.com/maps/search/?api=1&query={lat},{lng}` if coordinates present)
- "Mark as contacted" / status-change dropdown

### Surface B — Submission detail → "Drive" section

On the existing admin submission detail page (wherever admins view a single submission), add a new card/section:

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 04 / DRIVE                                             │
│  Folder synced.                                              │
│                                                              │
│  All files (transcript, photos, video, audio) have been      │
│  copied to Google Drive.                                     │
│                                                              │
│  [Open in Drive ↗]  [Re-sync]                                │
└─────────────────────────────────────────────────────────────┘
```

State-dependent rendering driven by `submission.driveSyncStatus`:
- `undefined` or `"pending"` → "Not synced yet" + manual "Sync to Drive" button (calls `syncSubmissionToDriveManual`)
- `"creating"` → "Syncing to Drive..." + spinner + disable buttons
- `"synced"` → "Folder synced." + "Open in Drive ↗" button (uses `driveFolderUrl`) + "Re-sync" button
- `"failed"` → Danger banner with `driveSyncError` + "Retry sync" button (calls `syncSubmissionToDriveManual`)

Use the Editorial Paper tokens (paper-3 card, mono eyebrow, serif headline, ink Door buttons, NO orange).

---

## Step 6 — SEO-optimized interview questions (mobile-side change, but read this)

Mobile rewrote the 5 questions shown to business owners during the video/audio interview. The new questions are engineered to elicit local-business keywords (business name + city + service + landmarks) in every answer, so the resulting transcript ranks better on Google for local search.

### Why this matters for the web team

The interview questions themselves render only in the mobile app (`ndm/app/(app)/submit/interview.tsx`). The web admin platform never displays them to creators. **You don't need to copy any code for this** — but you SHOULD be aware of the change in case any of the following apply on your side:

- **Admin docs / help center / FAQ** that lists "the 5 interview questions" — update to match
- **Marketing pages** ("How creators interview businesses…") that quote the prompts — update
- **Email templates** to creators that reference the old questions — update
- **Onboarding screens or training videos** that walk through the questions — update

### The new questions (for reference / docs sync)

```
1. What's the full name of your business, what city or area do you serve, and what
   do you do? Try to mention all three in one sentence.
2. What products or services do you offer, and what are your most popular ones?
   Use the words customers would type into Google.
3. Why do customers choose your business over the alternatives nearby? What makes
   you the best in your area?
4. Tell us about a recent customer who loved what you did — what did they buy, and
   where were they from?
5. Where exactly are you located, what are your opening hours, and how can people
   reach you? Mention nearby landmarks if it helps people find you.
```

### And the new tips card (4 bullets)

```
01. Say the business name + city in every answer (helps SEO).
02. Use the words your customers type into Google.
03. Mention specific products, prices, and services by name.
04. Include hours, address, and nearby landmarks.
```

### What downstream content benefits

- Generated websites (via Gemini → published HTML on Cloudflare) get richer schema markup and naturally include local-SEO keywords in body copy
- Transcripts saved to the Drive folder structure (Step 4) are themselves more search-friendly if shared externally
- The `extractedContent` field on `generatedWebsites` will more reliably contain hours, address, services — improving structured-data quality

### What you need to do for this step

If your web platform displays the questions anywhere, **update to match the new list**. If not, just check the box and move on — no code change needed on your side.

---

## Step 7 — Deploy

> **DO NOT run `npx convex deploy` from the web repo until Steps 1–6 above are complete.** Mobile is waiting on you. If you deploy with the schema/code half-applied, mobile's APK will crash with "Function not found" errors when users tap the new buttons.

```bash
cd <web-repo>
npx convex dev   # confirm no schema validation errors against existing prod data
npx convex deploy
```

The deploy is **safe** when all 5 prior steps are done — your schema becomes a strict superset of what mobile pushed, your `outscraper.ts` and `drive.ts` match mobile's verbatim, and your code never references a function mobile doesn't also have. Mobile keeps working.

After deploy, confirm at https://dashboard.convex.dev → `prod:energetic-panther-693` → Functions tab. You should see ALL of these (most were put there by mobile; your deploy just confirms they're still present):
- `outscraper:scrapeNearby`
- `outscraper:insertScrapedLead`
- `outscraper:listScrapedLeads`
- `drive:syncSubmissionToDriveManual`
- `drive:syncSubmissionToDrive`
- `drive:getSubmissionForSync`
- `drive:setDriveStatus`

---

## Step 8 — End-to-end test with mobile team (after your deploy succeeds)

### Scrape flow
1. Mobile admin opens the app → Leads tab → taps "Pull nearby businesses"
2. Picks 5km, type "barbershop" as category, confirms
3. Convex calls Outscraper, gets ~20 listings
4. New leads appear in **both** the mobile team feed AND the web admin "Lead prospects" view
5. Admin works through them on the web side, marking contacted/qualified/etc

### Drive sync flow
1. Web admin approves a submission via existing Approve button
2. `approveSubmission` mutation flips `status: "approved"` AND schedules `syncSubmissionToDrive`
3. Within ~30 seconds, the submission row shows `driveSyncStatus: "synced"` with a valid `driveFolderUrl`
4. Admin clicks "Open in Drive ↗" — opens the folder in Drive with subfolders + files

### Failure flow (test the retry path)
1. Manually patch `driveSyncStatus: "failed"` and `driveSyncError: "test"` on a submission via Convex dashboard
2. Refresh the admin UI → see danger banner + "Retry sync" button
3. Click Retry → status flips through `"creating"` → `"synced"`

---

## What you MUST NOT do

- ❌ Don't deploy from your repo until BOTH schema changes (leads + submissions) are applied. The mobile-side fields will be wiped.
- ❌ Don't modify `scrapeNearby` or `syncSubmissionToDrive` action logic — mobile calls them directly. Add new exports if you need different behavior.
- ❌ Don't auto-trigger Drive sync on any state OTHER than admin approval. Submissions in draft / pending / rejected should NOT sync (we don't want to upload incomplete data).
- ❌ Don't expose `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` to the client. It's a server-side env var only. The action reads it inside the Convex sandbox.
- ❌ Don't add a "Sync to Drive" button visible to non-admin users. The action throws "Forbidden" for non-admins, but UI should hide it entirely.

## What's safe to do

- ✅ Add filtering / sorting to the "Lead prospects" view (e.g., by rating, by recency, by category)
- ✅ Add a "Convert to creator outreach" action that promotes an Outscraper lead into your existing onboarding flow (CRM-style)
- ✅ Add an "Open in Maps" link wherever lat/lng is populated
- ✅ Add a small badge on the Drive section showing "Last synced: 2h ago" using `driveFolderCreatedAt`
- ✅ Add a `Re-sync all failed` admin bulk action (loop over `driveSyncStatus === "failed"` submissions and trigger `syncSubmissionToDriveManual` for each)

---

## Related docs

- [SETUP-OUTSCRAPER-DRIVE-2026.md](./SETUP-OUTSCRAPER-DRIVE-2026.md) — the mobile-side setup guide (Outscraper signup, GCP service account, env vars) — already done by mobile team but useful reference
- [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md) — previous mobile→web sync (admin approval queue + creator content editor)
- [WEB-CREATOR-REJECTION.md](./WEB-CREATOR-REJECTION.md) — most recent web sync (creator rejection flow)
- Mobile source: `ndm/convex/outscraper.ts` — copy verbatim
- Mobile source: `ndm/convex/drive.ts` — copy verbatim
- Mobile source: `ndm/convex/schema.ts` — schema definitions to mirror
