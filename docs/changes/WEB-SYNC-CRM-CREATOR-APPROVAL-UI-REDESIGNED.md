# Web-side sync prompt — Mobile features rollout (CRM social feed + Creator Verification)

> **Hand this entire document to the agent / developer working in the web repo's `convex/` folder. Do not run `npx convex deploy --prod` from the web repo until everything below is in place.**

---

## Context for the implementing agent

You are working in the **web repo**, in its `convex/` folder AND its admin UI. This repo and the mobile app (`ndm/`) share the same Convex production deployment: `prod:energetic-panther-693`. The mobile team is shipping THREE coupled features plus a visual design system upgrade:

1. **CRM Lead Social Feed** (mobile shows all leads with original-creator attribution + admin-curated cards)
2. **Creator Verification Flow** (quiz pass → admin approval → certified). Adds a `quizPassedAt` field plus 3 new mutations
3. **Admin-Curated Lead Content** (admin edits a lead with description/link/image; mobile renders FB-style social card). Adds 6 new lead fields plus 3 new functions including R2 image upload
4. **Editorial Paper design system** (NEO LAB inspired) for the two new admin web surfaces — see Step 10.5 for the complete token reference + paste-ready CSS. Mobile-responsive guidance included so the admin works on tablets/phones too.

Plus **schema-drift accommodations** for prod data that was failing strict validation before the mobile team could deploy:
- `auditLogs.action` now also accepts `"payout_sent"` (in addition to `"payment_sent"`)
- `withdrawals.accountHolderName` is now **optional** (legacy rows pre-2026 don't have it)
- `withdrawals.reference` is now an optional field (legacy synonym for `transactionRef`)

We need the web repo to match so the next web deploy doesn't wipe these out.

**Critical rule for this task:** You are making **additive-only** changes — adding new schema fields (all `v.optional`), adding new function exports, and adding one new literal to an existing union. **Do not modify, rename, or remove any existing exports.** Do not remove any existing schema field. Do not touch any unrelated file. The goal is to make the web's `convex/` folder a strict superset of what's already deployed.

---

## Why this needs to happen

If the web repo deploys without these additions, the next `npx convex deploy --prod` from web will remove the new mobile-side functions and revert the schema accommodations from the shared production deployment, causing:

- Mobile's Leads tab to fail with `Function not found` errors
- Mobile's pending-review screen to never unlock (no admin approval mutation in prod)
- Mobile's admin-curated social cards to render as compact cards (no fields to render)
- Convex push to fail at schema validation against existing prod data (`payout_sent` audit row, legacy withdrawal rows)

All schema changes are **purely additive**:
- 1 new optional field on `creators` (`quizPassedAt`)
- 6 new optional fields on `leads` (admin content + audit fields)
- 1 new union literal on `auditLogs.action` (`payout_sent`)
- 1 field made optional + 1 new optional field on `withdrawals`

The one schema change in this sync is **purely additive**: a new literal `"payout_sent"` is added to the existing `v.union(...)` validator for `auditLogs.action`. No existing literals are removed. No fields are added or removed. No indexes change.

---

## Step 1 — Apply three additive schema accommodations in `convex/schema.ts`

**Why this is needed:** When the mobile team ran `npx convex dev` against the shared dev deployment, three prod-data drifts surfaced. All three are pre-existing — data was written under an earlier (looser) schema version and the current (stricter) schema no longer accepts those rows. To unblock both teams' dev pushes, we need the web repo's schema to match the additive accommodations the mobile team already applied to their copy.

All three changes are **additive only**: no existing fields removed, no existing literals removed, no required field becomes more restrictive.

### Step 1a — Add `payout_sent` to `auditLogs.action` union

**Symptom that triggered this fix:**
```
Document with ID "p171wj9cqpvtmy4zej8sbf6z6d859mn9" in table "auditLogs" does not match the schema:
Path: .action
Value: "payout_sent"
```

**Action:** Open `convex/schema.ts`. Locate the `auditLogs` table. Inside its `action: v.union(...)` block, **add one new line** for `v.literal("payout_sent")` directly after the existing `v.literal("payment_sent")` line.

**Before:**
```typescript
auditLogs: defineTable({
  adminId: v.string(),
  action: v.union(
    v.literal("submission_approved"),
    v.literal("submission_rejected"),
    v.literal("website_generated"),
    v.literal("website_deployed"),
    v.literal("payment_sent"),
    v.literal("submission_deleted"),
    v.literal("creator_updated"),
    v.literal("manual_override"),
    v.literal("payment_confirmed"),
    v.literal("transcription_regenerated"),
    v.literal("images_enhanced"),
  ),
  // ... rest unchanged ...
})
```

**After (one line added):**
```typescript
auditLogs: defineTable({
  adminId: v.string(),
  action: v.union(
    v.literal("submission_approved"),
    v.literal("submission_rejected"),
    v.literal("website_generated"),
    v.literal("website_deployed"),
    v.literal("payment_sent"),
    v.literal("payout_sent"), // TODO: dedupe with "payment_sent" — pick one canonical name (codebase otherwise uses "payout" / "creatorPayout")
    v.literal("submission_deleted"),
    v.literal("creator_updated"),
    v.literal("manual_override"),
    v.literal("payment_confirmed"),
    v.literal("transcription_regenerated"),
    v.literal("images_enhanced"),
  ),
  // ... rest unchanged ...
})
```

### Step 1b — Make `withdrawals.accountHolderName` optional + add legacy `reference` field

**Symptom that triggered this fix:**
```
Document with ID "qd707cw5jyvpj9zxmdaa417f998596a6" in table "withdrawals" does not match the schema:
Object is missing the required field `accountHolderName`.
```

The affected row also contained a `reference: "PAYOUT-j573wkmh-..."` field not declared in the current schema (legacy synonym for `transactionRef`).

**Action:** In `convex/schema.ts`, locate the `withdrawals` table. Make two changes:

1. Change `accountHolderName: v.string()` to `accountHolderName: v.optional(v.string())`
2. Immediately after that line, add `reference: v.optional(v.string())`

**Before (excerpt — only the affected lines shown):**
```typescript
withdrawals: defineTable({
  creatorId: v.id("creators"),
  amount: v.number(),
  payoutMethod: v.union(v.literal("wise_email"), v.literal("bank_transfer")),
  accountDetails: v.string(),
  wiseEmail: v.optional(v.string()),
  accountHolderName: v.string(),  // ← currently required
  status: v.union(/* ... */),
  // ... rest of fields ...
})
```

**After (two lines changed/added):**
```typescript
withdrawals: defineTable({
  creatorId: v.id("creators"),
  amount: v.number(),
  payoutMethod: v.union(v.literal("wise_email"), v.literal("bank_transfer")),
  accountDetails: v.string(),
  wiseEmail: v.optional(v.string()),
  accountHolderName: v.optional(v.string()), // Optional: legacy withdrawal rows (pre-2026) were written without this field
  reference: v.optional(v.string()), // Optional: legacy field name for transactionRef on older withdrawal rows
  status: v.union(/* ... */),
  // ... rest of fields ...
})
```

### Step 1c — Add `quizPassedAt` to `creators` table

**Why:** Creator Verification flow needs this field to mark a creator as "quiz passed, awaiting admin approval". Mobile sets it via the new `markQuizPassed` mutation; admin clears the pending state by setting `certifiedAt` via `approveCreator`.

**Action:** In `convex/schema.ts`, locate the `creators` table. Add one new line for `quizPassedAt` directly after `certifiedAt`.

```typescript
creators: defineTable({
  // ... existing fields ...
  certifiedAt: v.optional(v.number()), // Timestamp when admin APPROVED the creator
  quizPassedAt: v.optional(v.number()), // Timestamp when creator passed onboarding quiz (awaiting admin approval)
  // ... rest unchanged ...
})
```

### Step 1d — Add 6 new optional fields to `leads` table (admin-curated content)

**Why:** The mobile CRM renders any lead that has admin-curated content as a Facebook-style social card. These fields hold the description, image, link, and audit info.

**Action:** In `convex/schema.ts`, locate the `leads` table. Add the 6 new lines at the end of the table definition, just before the `}).index(...)` indexes:

```typescript
leads: defineTable({
  // ... existing fields ...
  status: v.union(/* ... */),
  createdAt: v.number(),
  // Admin-curated social content (Feature B — Facebook-style card on mobile when present)
  adminDescription: v.optional(v.string()),         // marketing copy (max 500 chars enforced in mutation)
  previewImageUrl: v.optional(v.string()),          // R2 public URL of uploaded image
  previewImageStorageKey: v.optional(v.string()),   // R2 storage key (for replace / delete)
  externalPreviewUrl: v.optional(v.string()),       // external link admin wants featured
  adminUpdatedAt: v.optional(v.number()),
  adminUpdatedBy: v.optional(v.string()),           // Clerk ID of admin who edited
}).index("by_submission", ["submissionId"])
  // ... unchanged ...
```

### Important (applies to ALL accommodations in Step 1)

- The `TODO` comments are intentional — they flag inconsistencies for future cleanup without forcing decisions now
- Do NOT remove any existing literal or field
- Do NOT change any other table, index, or field in this file
- If `accountHolderName` is already optional in the web repo's schema, skip the part that makes it optional (the `reference` addition might still be needed)
- If `payout_sent` is already in the union in the web repo's schema, skip Step 1a entirely
- All new fields are `v.optional(...)` — backward compatible with existing data

---

## Step 2 — Add the phone normalization helper

**Action:** Create a new file at `convex/lib/phone.ts` in the web repo with the exact contents below.

**File path:** `convex/lib/phone.ts`

```typescript
/**
 * Normalize a phone number into a canonical digit-string used for lead-business identity matching.
 *
 * Philippine number formats handled:
 * - "0917 234 1234"   → "639172341234"
 * - "+63 917 234 1234"→ "639172341234"
 * - "+639172341234"   → "639172341234"
 * - "9172341234"      → "639172341234"
 *
 * Anything else: returns the digits-only fallback. `null` only if input is empty/undefined.
 */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0") && digits.length === 11) return "63" + digits.slice(1);
  if (digits.startsWith("63") && digits.length === 12) return digits;
  if (digits.startsWith("9") && digits.length === 10) return "63" + digits;

  return digits;
}
```

If `convex/lib/` doesn't exist yet, create it. If the file already exists (it shouldn't, but check), do not overwrite — diff and merge.

---

## Step 3 — Add the import line at the top of `convex/leads.ts`

**Action:** Open `convex/leads.ts`. Locate the existing import block at the top of the file. Add this single import line **after the existing imports** (do not reorder existing imports):

```typescript
import { normalizePhone } from "./lib/phone";
```

The result should look something like (your existing imports may differ — leave them as-is):

```typescript
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getTodayString, getCurrentMonthString } from "./analytics";
import { requireAuth, requireAdmin } from "./lib/auth";
import { sanitizeText, sanitizePhone, sanitizeEmail } from "./lib/sanitize";
import { normalizePhone } from "./lib/phone";  // ← ADD THIS LINE
```

---

## Step 4 — Append the Mobile CRM view queries to the end of `convex/leads.ts`

**Action:** Append the entire block below to the **end** of `convex/leads.ts` (after the last existing `export const ...` block). Do not insert it in the middle. Do not modify any existing export. The block adds:

- A pure-function helper `formatCreatorDisplayName` — exported for testing
- `listForMobileCRM` — returns ALL leads (team-wide social feed) enriched with original-submitter, admin-curated content, and interviewer-count
- `getDetailForMobileCRM` — single-lead detail enriched with submittedBy, interviewers, notes, business, admin content

This is the **final shipping version**. It supersedes any earlier listForMobileCRM you may already have added.

```typescript
// ----------------------------------------------------------------------------
// MOBILE CRM VIEW QUERIES (team-wide social feed)
//
// Per product spec: every signed-in creator sees ALL leads in the database
// (not just their own) and the original submitter is prominently surfaced on
// each card. Admin-curated content (description / image / link) appears when
// present and triggers the social-card render on mobile.
//
// These queries do NOT modify any existing data or behavior. They are
// consumed only by the mobile CRM screens at app/(app)/leads/*.
// ----------------------------------------------------------------------------

/**
 * Pure-function helper for rendering creator display names consistently.
 * Exported so unit tests can exercise it without spinning up Convex.
 * Format: "Firstname L." (e.g., "Maria S."). If only first name, returns it as-is.
 * If both missing, returns "Unknown creator".
 */
export function formatCreatorDisplayName(
  firstName: string | undefined | null,
  lastName: string | undefined | null,
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (!first && !last) return "Unknown creator";
  if (!last) return first;
  return `${first} ${last[0]}.`;
}

export const listForMobileCRM = query({
  args: {
    search: v.optional(v.string()),
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
    onlyMine: v.optional(v.boolean()), // When true, restrict to current creator's leads
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const currentCreator = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!currentCreator) {
      return {
        leads: [],
        stats: { total: 0, new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0, mine: 0 },
      };
    }

    // Per product spec: show ALL leads in the database to all signed-in creators,
    // so the CRM feed surfaces what the team as a whole has gathered. Each card
    // prominently shows which creator originally submitted/interviewed the lead.
    const allLeads = await ctx.db.query("leads").order("desc").collect();

    // Stat rollup over the unfiltered set so badge counts remain accurate
    // regardless of active filters
    const stats = {
      total: allLeads.length,
      new: allLeads.filter((l) => l.status === "new").length,
      contacted: allLeads.filter((l) => l.status === "contacted").length,
      qualified: allLeads.filter((l) => l.status === "qualified").length,
      converted: allLeads.filter((l) => l.status === "converted").length,
      lost: allLeads.filter((l) => l.status === "lost").length,
      mine: allLeads.filter((l) => String(l.creatorId) === String(currentCreator._id)).length,
    };

    let filtered = allLeads;

    // Optional: restrict to current creator's own leads ("Only mine" chip)
    if (args.onlyMine) {
      filtered = filtered.filter(
        (l) => String(l.creatorId) === String(currentCreator._id),
      );
    }

    // Status filter
    const statusFilter = args.statusFilter ?? "all";
    if (statusFilter !== "all") {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    // Text search across customer fields AND business name (the latter requires
    // joining submissions, done in the enrichment loop below)
    const search = args.search?.trim().toLowerCase();

    // Cache submissions/creators to avoid repeated DB hits when the same id
    // appears across many leads (common in production)
    const submissionCache = new Map<string, any>();
    const creatorCache = new Map<string, any>();

    // Pre-load all submissions once for the interviewer-count aggregation
    const allSubmissions = await ctx.db.query("submissions").collect();
    for (const sub of allSubmissions) {
      submissionCache.set(String(sub._id), sub);
    }

    const enriched = await Promise.all(
      filtered.map(async (lead) => {
        const submission = submissionCache.get(String(lead.submissionId)) ?? null;

        // Original submitter (the creator who interviewed this business)
        let creatorRecord = creatorCache.get(String(lead.creatorId));
        if (!creatorRecord) {
          creatorRecord = await ctx.db.get(lead.creatorId);
          if (creatorRecord) creatorCache.set(String(lead.creatorId), creatorRecord);
        }

        // Count distinct creators who interviewed the same business by normalized phone
        let interviewerCount = 0;
        if (submission) {
          const targetPhone = normalizePhone(submission.ownerPhone);
          if (targetPhone) {
            const matches = allSubmissions.filter(
              (s) => normalizePhone(s.ownerPhone) === targetPhone,
            );
            const creatorIds = new Set(matches.map((s) => String(s.creatorId)));
            interviewerCount = creatorIds.size;
          }
        }

        const isMine = String(lead.creatorId) === String(currentCreator._id);

        return {
          _id: lead._id,
          _creationTime: lead._creationTime,
          name: lead.name,
          phone: lead.phone,
          email: lead.email ?? null,
          source: lead.source,
          status: lead.status,
          createdAt: lead.createdAt,
          businessName: submission?.businessName ?? "(business unavailable)",
          businessType: submission?.businessType ?? null,
          businessCity: submission?.city ?? null,
          businessAddress: submission?.address ?? null,
          ownerName: submission?.ownerName ?? null,
          ownerPhone: submission?.ownerPhone ?? null,
          interviewerCount,
          websiteUrl: submission?.websiteUrl ?? null,
          submissionStatus: submission?.status ?? null,
          isHot: interviewerCount >= 3,
          // The original submitting creator (prominent display per product spec)
          submittedBy: creatorRecord
            ? {
                creatorId: String(creatorRecord._id),
                displayName: formatCreatorDisplayName(
                  creatorRecord.firstName,
                  creatorRecord.lastName,
                ),
                profileImage: creatorRecord.profileImage ?? null,
              }
            : null,
          isMine,
          // Admin-curated content (Feature B — social card trigger)
          adminDescription: lead.adminDescription ?? null,
          previewImageUrl: lead.previewImageUrl ?? null,
          externalPreviewUrl: lead.externalPreviewUrl ?? null,
          hasEnrichedContent: !!(
            lead.adminDescription ||
            lead.previewImageUrl ||
            lead.externalPreviewUrl
          ),
        };
      }),
    );

    // Apply text search AFTER enrichment so we can search business name too
    let result = enriched;
    if (search) {
      result = enriched.filter((row) =>
        row.name.toLowerCase().includes(search) ||
        row.phone.toLowerCase().includes(search) ||
        (row.email?.toLowerCase().includes(search) ?? false) ||
        row.businessName.toLowerCase().includes(search) ||
        (row.submittedBy?.displayName.toLowerCase().includes(search) ?? false),
      );
    }

    return { leads: result, stats };
  },
});

export const getDetailForMobileCRM = query({
  args: { id: v.id("leads") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const currentCreator = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!currentCreator) return null;

    const lead = await ctx.db.get(args.id);
    if (!lead) return null;

    // Per product spec: any signed-in creator can view any lead in detail
    // (mirrors the social-feed model of the list view)
    const submitterCreator = await ctx.db.get(lead.creatorId);
    const submission = await ctx.db.get(lead.submissionId);

    // Find all creators who interviewed this business (matched by phone)
    let interviewers: Array<{
      creatorId: string;
      creatorName: string;
      creatorProfileImage: string | null;
      interviewedAt: number;
      submissionId: string;
      submissionStatus: string;
      isMine: boolean;
    }> = [];

    if (submission) {
      const targetPhone = normalizePhone(submission.ownerPhone);
      if (targetPhone) {
        const allSubs = await ctx.db.query("submissions").collect();
        const matches = allSubs.filter(
          (s) => normalizePhone(s.ownerPhone) === targetPhone,
        );
        interviewers = await Promise.all(
          matches.map(async (s) => {
            const interviewerCreator = await ctx.db.get(s.creatorId);
            return {
              creatorId: String(s.creatorId),
              creatorName: formatCreatorDisplayName(
                interviewerCreator?.firstName,
                interviewerCreator?.lastName,
              ),
              creatorProfileImage: interviewerCreator?.profileImage ?? null,
              interviewedAt: s._creationTime,
              submissionId: String(s._id),
              submissionStatus: s.status,
              isMine: String(s.creatorId) === String(currentCreator._id),
            };
          }),
        );
        // Newest interview first
        interviewers.sort((a, b) => b.interviewedAt - a.interviewedAt);
      }
    }

    // Notes for this lead (latest first)
    const notes = await ctx.db
      .query("leadNotes")
      .withIndex("by_lead", (q) => q.eq("leadId", args.id))
      .order("desc")
      .collect();

    return {
      lead: {
        _id: lead._id,
        _creationTime: lead._creationTime,
        name: lead.name,
        phone: lead.phone,
        email: lead.email ?? null,
        source: lead.source,
        status: lead.status,
        createdAt: lead.createdAt,
      },
      submittedBy: submitterCreator
        ? {
            creatorId: String(submitterCreator._id),
            displayName: formatCreatorDisplayName(
              submitterCreator.firstName,
              submitterCreator.lastName,
            ),
            profileImage: submitterCreator.profileImage ?? null,
          }
        : null,
      isMine: String(lead.creatorId) === String(currentCreator._id),
      business: submission
        ? {
            submissionId: String(submission._id),
            businessName: submission.businessName,
            businessType: submission.businessType,
            ownerName: submission.ownerName,
            ownerPhone: submission.ownerPhone,
            ownerEmail: submission.ownerEmail ?? null,
            address: submission.address,
            city: submission.city,
            province: submission.province ?? null,
            barangay: submission.barangay ?? null,
            websiteUrl: submission.websiteUrl ?? null,
            businessDescription: submission.businessDescription ?? null,
            photos: submission.photos ?? [],
            status: submission.status,
          }
        : null,
      // Admin-curated content (Feature B)
      adminContent: {
        description: lead.adminDescription ?? null,
        previewImageUrl: lead.previewImageUrl ?? null,
        externalPreviewUrl: lead.externalPreviewUrl ?? null,
        updatedAt: lead.adminUpdatedAt ?? null,
        hasEnrichedContent: !!(
          lead.adminDescription ||
          lead.previewImageUrl ||
          lead.externalPreviewUrl
        ),
      },
      interviewers,
      interviewerCount: interviewers.length,
      notes: notes.map((n) => ({
        _id: n._id,
        content: n.content,
        createdAt: n.createdAt,
        creatorId: String(n.creatorId),
      })),
    };
  },
});
```

---

## Step 5 — Verify the schema dependencies exist

These queries assume the following fields and indexes are in the deployed schema. If any are missing, **STOP** and ask before proceeding — the queries will fail at runtime.

### `creators` table
- Index `by_clerk_id` keyed on `clerkId`
- Field `firstName: optional(string)`
- Field `lastName: optional(string)`
- Field `profileImage: optional(string)`

### `leads` table
- Index `by_creator` keyed on `creatorId`
- Fields: `name`, `phone`, `email` (optional), `source`, `status`, `createdAt`, `submissionId`, `creatorId`

### `submissions` table
- Fields: `ownerPhone`, `businessName`, `businessType`, `ownerName`, `ownerEmail` (optional), `address`, `city`, `province` (optional), `barangay` (optional), `websiteUrl` (optional), `businessDescription` (optional), `photos` (optional), `creatorId`, `status`

### `leadNotes` table
- Index `by_lead` keyed on `leadId`
- Fields: `content`, `createdAt`, `creatorId`

If you find any of these missing on the web repo's schema, do not "fix" it by modifying the schema — instead, escalate. The schema is shared with mobile and unilateral changes will break the mobile app.

---

## Step 6 — Verify compilation locally before deploying

In the web repo:

```bash
npx convex dev
```

Watch the terminal output. Convex's TypeScript checker should report no errors. The dev push will compile the new functions and you should see them listed in the dashboard under `Functions` with names `leads:listForMobileCRM` and `leads:getDetailForMobileCRM`.

If you see errors:
- **"Cannot find module './lib/phone'"** → Step 2 wasn't completed
- **"normalizePhone is not defined"** → Step 3 import was missed
- **"Property 'X' does not exist on submission/lead/creator"** → schema mismatch; see Step 5
- **"Document with ID X in table 'auditLogs' does not match the schema: Path: .action, Value: 'payout_sent'"** → Step 1a wasn't completed (or was completed incorrectly — verify the `payout_sent` literal was added)
- **"Object is missing the required field `accountHolderName`"** → Step 1b wasn't completed (verify `accountHolderName` is wrapped in `v.optional(...)`)
- **Any other "missing required field" or "value does not match validator" error** → likely another schema-drift case that surfaced *after* these fixes. Capture the exact error and contact the mobile team — additional accommodations may be needed.

---

## Step 7 — Deploy to production

Once `npx convex dev` is clean and the functions appear in the dev dashboard:

```bash
npx convex deploy --prod
```

After deployment, verify in the **prod** dashboard at https://dashboard.convex.dev:
1. Switch to the `prod:energetic-panther-693` deployment
2. Functions tab → confirm `leads:listForMobileCRM` and `leads:getDetailForMobileCRM` are both listed
3. Optionally, run `listForMobileCRM` with empty args from the dashboard (signed in as a test creator) and verify it returns `{ leads: [], stats: { total: 0, ... } }` or real data

---

## What you MUST NOT do

- ❌ Do not run `npx convex deploy --prod` until Steps 1–4 are complete in your local web repo
- ❌ Do not modify any existing function in `convex/leads.ts` (`create`, `updateStatus`, `getBySubmission`, `getByCreator`, `getByStatus`, `getCountBySubmission`, `remove`)
- ❌ Do not modify `convex/schema.ts` beyond the **single additive line** in Step 1. Do not remove any existing literal in `auditLogs.action`. Do not add, remove, retype, or reindex any other field or table.
- ❌ Do not modify `convex/leadNotes.ts`
- ❌ Do not rename `listForMobileCRM` or `getDetailForMobileCRM` — the mobile app calls them by name
- ❌ Do not change the return shapes of the new queries — the mobile app destructures specific fields
- ❌ Do not "clean up" the `payment_sent` literal even though it's now duplicative with `payout_sent` — at least one prod row uses it, removing it would break schema validation again

## What's safe to do

- ✅ Reformat / lint the new code to match the web repo's style
- ✅ Add comments (including expanding the TODO note next to `payout_sent` with web-side context)
- ✅ Move the helper to a different filename if the web repo has a different convention (just update the import path in `leads.ts` to match)
- ✅ Inline the `normalizePhone` function into `leads.ts` if the web repo prefers fewer files (mobile and web don't have to mirror file structure, only function names + signatures)

---

## Post-deploy verification (with the mobile team)

After deploying, ping the mobile team to confirm the queries are callable. They can verify with:

```bash
# In the ndm/ repo
npx convex run leads:listForMobileCRM '{}' --prod
```

(Requires being signed in via Convex CLI as an account with access to the deployment.)

Or from the mobile app: open the Leads tab on a dev build and confirm leads load without "Server Error" or "function not found" errors.

---

## Step 8 — Add Creator Verification mutations to `convex/creators.ts`

**Why:** The mobile app sends every newly quiz-passing creator to a locked Pending Review screen until an admin approves them. The web admin panel will surface the queue and provide an Approve button.

**Action:** In `convex/creators.ts`:

1. Add `requireAdmin` to the imports if it's not already there:
   ```typescript
   import { requireAuth, requireAdmin } from "./lib/auth";
   ```

2. Append the three new exports at the end of the file. DO NOT modify the existing `certify` mutation:

```typescript
// ----------------------------------------------------------------------------
// CREATOR VERIFICATION FLOW (admin-gated)
//
// Flow:
//   1. Creator passes onboarding quiz → markQuizPassed sets quizPassedAt
//   2. Mobile routes the creator to /pending-review (locked screen)
//   3. Admin reviews on web admin panel and clicks "Approve"
//   4. approveCreator sets certifiedAt → mobile gate releases automatically
// ----------------------------------------------------------------------------

export const markQuizPassed = mutation({
  args: { id: v.id("creators") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const creator = await ctx.db.get(args.id);
    if (!creator || creator.clerkId !== identity.subject) {
      throw new Error("Forbidden: you can only update your own account");
    }
    if (creator.certifiedAt) return;
    if (creator.quizPassedAt) return;
    await ctx.db.patch(args.id, {
      quizPassedAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});

export const approveCreator = mutation({
  args: { id: v.id("creators") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const creator = await ctx.db.get(args.id);
    if (!creator) throw new Error("Creator not found");
    if (creator.certifiedAt) return;
    await ctx.db.patch(args.id, {
      certifiedAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: args.id,
      type: "certification",
      title: "You're approved!",
      body: "Welcome aboard. You can now submit businesses and earn from your interviews.",
      data: { approvedByAdmin: true },
    });
  },
});

export const listPendingApproval = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("creators").collect();
    return all
      .filter((c) => c.quizPassedAt && !c.certifiedAt && !c.isDeleted)
      .map((c) => ({
        _id: c._id,
        clerkId: c.clerkId,
        email: c.email,
        firstName: c.firstName ?? null,
        middleName: c.middleName ?? null,
        lastName: c.lastName ?? null,
        phone: c.phone ?? null,
        profileImage: c.profileImage ?? null,
        quizPassedAt: c.quizPassedAt!,
        createdAt: c.createdAt ?? null,
        referredByCode: c.referredByCode ?? null,
        referredByName: c.referredByName ?? null,
      }))
      .sort((a, b) => b.quizPassedAt - a.quizPassedAt);
  },
});
```

---

## Step 9 — Add Admin Lead Content functions to `convex/leads.ts`

**Why:** Admin can curate any lead with a description, link, and R2-hosted image. Mobile then renders the lead as a Facebook-style social card. The image upload uses an R2 presigned URL so the file doesn't pass through Convex.

**Action:** In `convex/leads.ts`:

1. Update the import line you added in Step 3 to include the action type and R2 helpers. Replace:
   ```typescript
   import { mutation, query, internalMutation } from "./_generated/server";
   ```
   with:
   ```typescript
   import { mutation, query, internalMutation, action } from "./_generated/server";
   ```
   And add (if not already present):
   ```typescript
   import { getR2Config, generatePresignedUrl } from "./lib/r2Helpers";
   ```

2. Add the size/mime constants near the top of the file (after the imports):
   ```typescript
   const PREVIEW_IMAGE_MAX_BYTES = 2_000_000; // 2MB cap
   const ALLOWED_PREVIEW_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
   ```

3. Append the new exports at the end of `convex/leads.ts`. Paste the entire block (also includes the pure-function helpers used by the unit tests):

```typescript
// ----------------------------------------------------------------------------
// ADMIN-CURATED LEAD CONTENT (Facebook-style social card data)
// ----------------------------------------------------------------------------

export const updateAdminContent = mutation({
  args: {
    id: v.id("leads"),
    description: v.optional(v.string()),
    externalPreviewUrl: v.optional(v.string()),
    previewImageUrl: v.optional(v.string()),
    previewImageStorageKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const lead = await ctx.db.get(args.id);
    if (!lead) throw new Error("Lead not found");

    const patch: Record<string, unknown> = {
      adminUpdatedAt: Date.now(),
      adminUpdatedBy: identity.subject,
    };

    if (args.description !== undefined) {
      const trimmed = args.description.trim();
      if (trimmed.length > 500) {
        throw new Error("Description too long (max 500 characters)");
      }
      patch.adminDescription = trimmed === "" ? undefined : trimmed;
    }

    if (args.externalPreviewUrl !== undefined) {
      const trimmed = args.externalPreviewUrl.trim();
      if (trimmed && !/^https?:\/\//i.test(trimmed)) {
        throw new Error("External preview URL must start with http:// or https://");
      }
      patch.externalPreviewUrl = trimmed === "" ? undefined : trimmed;
    }

    if (args.previewImageUrl !== undefined) {
      patch.previewImageUrl = args.previewImageUrl === "" ? undefined : args.previewImageUrl;
    }

    if (args.previewImageStorageKey !== undefined) {
      patch.previewImageStorageKey =
        args.previewImageStorageKey === "" ? undefined : args.previewImageStorageKey;
    }

    await ctx.db.patch(args.id, patch);
  },
});

export function validatePreviewImageUploadArgs(args: {
  mimeType: string;
  sizeBytes: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!ALLOWED_PREVIEW_IMAGE_TYPES.includes(args.mimeType)) {
    return { ok: false, reason: `Unsupported image type ${args.mimeType}. Allowed: ${ALLOWED_PREVIEW_IMAGE_TYPES.join(", ")}` };
  }
  if (args.sizeBytes <= 0) return { ok: false, reason: "Image size must be positive" };
  if (args.sizeBytes > PREVIEW_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      reason: `Image too large (${args.sizeBytes} bytes > ${PREVIEW_IMAGE_MAX_BYTES} byte limit)`,
    };
  }
  return { ok: true };
}

export function buildPreviewImageStorageKey(leadId: string, mimeType: string, now: number): string {
  const ext = mimeType.split("/")[1] ?? "bin";
  return `lead-previews/${leadId}/${now}.${ext}`;
}

export const generatePreviewImageUploadUrl = action({
  args: {
    leadId: v.id("leads"),
    mimeType: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args): Promise<{ uploadUrl: string; publicUrl: string; storageKey: string }> => {
    await requireAdmin(ctx);

    const validation = validatePreviewImageUploadArgs({
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
    });
    if (!validation.ok) throw new Error(validation.reason);

    const publicBase = process.env.R2_PUBLIC_URL;
    if (!publicBase) throw new Error("R2_PUBLIC_URL is not configured on this Convex deployment");

    const storageKey = buildPreviewImageStorageKey(args.leadId, args.mimeType, Date.now());
    const r2Config = getR2Config();
    const uploadUrl = await generatePresignedUrl("PUT", storageKey, args.mimeType, r2Config, 3600);
    const publicUrl = `${publicBase.replace(/\/$/, "")}/${storageKey}`;
    return { uploadUrl, publicUrl, storageKey };
  },
});

export const getDetailForAdmin = query({
  args: { id: v.id("leads") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const lead = await ctx.db.get(args.id);
    if (!lead) return null;
    const submission = await ctx.db.get(lead.submissionId);
    const creator = await ctx.db.get(lead.creatorId);
    return {
      lead,
      submission,
      creator: creator
        ? {
            _id: creator._id,
            firstName: creator.firstName ?? null,
            lastName: creator.lastName ?? null,
            email: creator.email,
            profileImage: creator.profileImage ?? null,
          }
        : null,
    };
  },
});
```

---

## Step 10 — Build the web admin UI

Two new admin-side surfaces:

### Surface A — Creator Management → Pending Approval queue

Fetches `listPendingApproval` and renders a table/list of creators awaiting review.

Per-row:
- Creator name, email, profile image, `quizPassedAt` timestamp (relative time)
- "View profile" button (existing creator detail view)
- "Approve" button → calls `api.creators.approveCreator({ id: creator._id })` → row leaves the list optimistically

Reasonable filters: search by name/email, sort by oldest pending first (so the team handles the longest-waiting creators first).

### Surface B — Lead Management → Lead Detail → "Content" section

On the existing lead detail page (or wherever admins click into individual leads), add a new editable "Content" section:

```
┌────────────────────────────────────────┐
│  Content (rendered on mobile CRM)      │
├────────────────────────────────────────┤
│  Description                           │
│  ┌──────────────────────────────────┐ │
│  │ [textarea, optional, max 500 ch] │ │
│  └──────────────────────────────────┘ │
│                                        │
│  External preview link                 │
│  ┌──────────────────────────────────┐ │
│  │ https://...                      │ │
│  └──────────────────────────────────┘ │
│                                        │
│  Preview image (max 2MB, jpg/png/webp) │
│  ┌──────────────────────────────────┐ │
│  │ [thumbnail or "Choose file..."]   │ │
│  └──────────────────────────────────┘ │
│                                        │
│  [Save changes]      [Clear content]   │
└────────────────────────────────────────┘
```

**Image upload flow on the admin web (5 steps):**

1. User selects a file in the browser
2. Frontend client-side validates size ≤ 2MB and type ∈ {jpeg, png, webp}
3. Frontend calls `api.leads.generatePreviewImageUploadUrl({ leadId, mimeType, sizeBytes })` → receives `{ uploadUrl, publicUrl, storageKey }`
4. Frontend does an HTTPS `PUT` to `uploadUrl` with the file bytes and the `Content-Type: <mimeType>` header. The presigned URL already encodes the size limit, but the client check fails faster
5. On `200` from R2, frontend calls `api.leads.updateAdminContent({ id, previewImageUrl: publicUrl, previewImageStorageKey: storageKey, description, externalPreviewUrl })`
6. Mobile reactive query picks up the new content immediately — no app reload

**Clearing content:** call `updateAdminContent` with `description: ""`, `externalPreviewUrl: ""`, `previewImageUrl: ""`, `previewImageStorageKey: ""`. The mutation interprets empty string as "clear this field" (sets it to `undefined`).

**Cleaning up old images in R2:** when admin replaces or clears an image, the previous `previewImageStorageKey` is orphaned in R2. We don't have automated cleanup in v1 — leaving the old object is fine. If you want a quick cleanup, web can implement it inside `updateAdminContent` (read existing lead first, capture old storageKey, after patch issue an R2 DELETE). Out of scope for the strict sync.

### Paste-ready upload code (React + Convex hooks)

The admin page component can use this pattern verbatim. Adapt to your existing form library:

```tsx
import { useState } from 'react';
import { useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

const MAX_UPLOAD_BYTES = 2_000_000;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function LeadContentEditor({ leadId, existing }: {
  leadId: Id<'leads'>;
  existing: {
    adminDescription: string | null;
    externalPreviewUrl: string | null;
    previewImageUrl: string | null;
    previewImageStorageKey: string | null;
  };
}) {
  const generateUploadUrl = useAction(api.leads.generatePreviewImageUploadUrl);
  const updateContent = useMutation(api.leads.updateAdminContent);

  const [description, setDescription] = useState(existing.adminDescription ?? '');
  const [externalUrl, setExternalUrl] = useState(existing.externalPreviewUrl ?? '');
  const [imageUrl, setImageUrl] = useState(existing.previewImageUrl ?? '');
  const [imageStorageKey, setImageStorageKey] = useState(existing.previewImageStorageKey ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImageSelected(file: File) {
    setError(null);

    // Client-side validation (fast-fail)
    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
      setError(`Unsupported image type ${file.type}. Use JPEG, PNG, or WebP.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Image too large (${(file.size / 1_000_000).toFixed(2)}MB). Max 2MB.`);
      return;
    }

    setUploading(true);
    try {
      // 1. Get presigned URL from Convex
      const { uploadUrl, publicUrl, storageKey } = await generateUploadUrl({
        leadId,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      // 2. PUT the bytes directly to R2 (does not pass through Convex)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`R2 upload failed: ${putRes.status} ${putRes.statusText}`);
      }

      // 3. Stage the new URL/key in local state — admin still needs to click Save
      setImageUrl(publicUrl);
      setImageStorageKey(storageKey);
    } catch (e: any) {
      setError(e?.message ?? 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError(null);
    try {
      await updateContent({
        id: leadId,
        description,
        externalPreviewUrl: externalUrl,
        previewImageUrl: imageUrl,
        previewImageStorageKey: imageStorageKey,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    }
  }

  async function handleClear() {
    setDescription('');
    setExternalUrl('');
    setImageUrl('');
    setImageStorageKey('');
    await updateContent({
      id: leadId,
      description: '',
      externalPreviewUrl: '',
      previewImageUrl: '',
      previewImageStorageKey: '',
    });
  }

  return (
    <div>
      <label>
        Description (max 500 characters)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
      </label>

      <label>
        External preview link
        <input
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://..."
        />
      </label>

      <label>
        Preview image (max 2MB; JPEG, PNG, or WebP)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageSelected(file);
          }}
          disabled={uploading}
        />
      </label>

      {imageUrl && (
        <img src={imageUrl} alt="preview" style={{ maxWidth: 200, marginTop: 8 }} />
      )}
      {uploading && <p>Uploading image…</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <button onClick={handleSave} disabled={uploading}>Save changes</button>
      <button onClick={handleClear} disabled={uploading}>Clear content</button>
    </div>
  );
}
```

**Notes for the above:**
- `useAction` (not `useMutation`) is required for `generatePreviewImageUploadUrl` because it's a Convex action (it makes external R2 calls).
- The fetch `PUT` must include the `Content-Type` header — R2's presigned URL validates against it. Mismatched content-type causes a 403 from R2.
- The pattern above stages the image upload separately from the metadata save (admin uploads → image appears in preview → admin clicks Save). If you'd rather auto-save on upload, call `updateContent` inside `handleImageSelected` after the R2 PUT succeeds.
- The "Clear content" button calls `updateContent` with empty strings, which the backend interprets as "set this field to undefined."

### CORS gotcha (read this before testing the upload)

If you get a CORS error when the browser tries to PUT to the R2 presigned URL, you need to configure the R2 bucket's CORS policy. In Cloudflare R2 dashboard → bucket → Settings → CORS Policy, add:

```json
[
  {
    "AllowedOrigins": ["https://your-web-domain.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

(Replace `your-web-domain.com` with your production web origin.) The mobile-side video/audio uploads already work because they go through Convex actions, not directly from a browser. Admin image upload is the first direct-from-browser upload, so this is the first time CORS matters.

---

## Step 10.5 — Editorial Paper design system (mobile-inspired, for the admin surfaces)

> **Why this is in this doc:** The mobile team is migrating the mobile UI to an "Editorial Paper" design system (NEO LAB inspired). The two new admin web surfaces in Step 10 (Pending Approval queue, Lead Content editor) should visually match this language so the platform feels coherent. **Apply the tokens below to ALL new admin UI you build in Step 10. Optionally retrofit the rest of the admin web over time.**
>
> This section is written from the **mobile-side perspective** — i.e., "this is what the mobile app looks like, replicate it on the web admin surfaces." It also includes mobile-responsive guidance because the admin will sometimes use these pages from a phone or tablet.

### Design language anchor

Direct quote from the NEO LAB landing page that inspired the system:

> "Voice: editorial / cinematic / paper-magazine. **Not SaaS.**"
> "Display: Instrument Serif — italic-friendly, magazine-y"
> "Sans: Onest — clean, fresh, not Inter"
> "Mono: JetBrains Mono — used ONLY for live data + labels"

The mobile app uses this verbatim. The web admin should mirror it as closely as the existing component library allows — at minimum, the typography, color tokens, and the "door" button pattern.

### Typography stack

Three Google Fonts. Already loading via `@expo-google-fonts/*` on mobile; on web load via `<link>` in your HTML head or `next/font` if you're on Next.js:

```html
<link
  rel="preconnect"
  href="https://fonts.googleapis.com"
/>
<link
  rel="preconnect"
  href="https://fonts.gstatic.com"
  crossorigin
/>
<link
  href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Onest:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

| Token | Family | Use |
|---|---|---|
| `--font-serif` | `"Instrument Serif", Georgia, serif` | Display headlines, large numbers, hero copy |
| `--font-serif-italic` | `"Instrument Serif"` (italic variant) | Emphasized phrases in headlines ("Welcome / **back.**") |
| `--font-sans` | `"Onest", system-ui, sans-serif` | Body text, button labels, form inputs |
| `--font-mono` | `"JetBrains Mono", Menlo, monospace` | UPPERCASE labels, eyebrows (`STEP 02 / SIGN IN`), timestamps |

**Rule of thumb:** any uppercase letter-spaced text uses mono. Any large headline uses serif (often with one italic word for emphasis). Body and buttons use Onest sans.

### Color palette

Mobile-safe RGB values (no oklch — paste straight into CSS variables or your design tokens):

```css
:root {
  /* Paper (surfaces) */
  --color-paper:  #F8F5EE;  /* warm off-white — default page bg */
  --color-paper-2: #EFEBE0; /* slightly cooler card bg */
  --color-paper-3: #FCFAF5; /* near-pure for inputs/popouts */

  /* Ink (text + primary dark surfaces) */
  --color-ink:   #1B1C24;   /* near-black, cool — headings, primary buttons */
  --color-ink-2: #3C3F4A;   /* body emphasis */
  --color-ink-3: #7A7E8A;   /* muted secondary text */

  /* Emerald accent (replaces NEO LAB's terracotta — brand consistency) */
  --color-accent:        #047857;  /* italic display emphasis, accent links */
  --color-accent-ink:    #064E3B;  /* accessible text on accent-bg */
  --color-accent-bg:     #D1FAE5;  /* soft tints, success banners */
  --color-accent-solid:  #10B981;  /* primary "door" fills */

  /* Business / system accent */
  --color-business:    #1F3654;
  --color-business-bg: #E4E9F0;
  --color-business-ink:#11203A;

  /* Live (real-time markers — distinct from accent so live ≠ brand) */
  --color-live:      #3FA86A;
  --color-live-soft: #D4EFDE;

  /* Rules / dividers */
  --color-rule:        #E0D8C9;
  --color-rule-strong: #B7AC95;

  /* Status */
  --color-warn:      #C68A12;
  --color-warn-bg:   #FBE9C4;
  --color-danger:    #B43A1F;
  --color-danger-bg: #F3D7CF;
}
```

**Critical:** the existing admin uses emerald (`#10b981`) for primary CTAs and white/zinc surfaces. The new palette swaps this to **ink as primary** (almost black) with emerald as a **secondary accent** (the earning/personal moment, italic display, primary CTA when the action is positive). Don't make every button emerald — reserve emerald for "the win" moments (Approve, Save published content).

### Spacing scale

Multiples of 4, more generous than typical SaaS density:

| Token | Value | Use |
|---|---|---|
| `--space-xs` | 4px | Tight icon-text gaps |
| `--space-sm` | 8px | Small padding |
| `--space-md` | 16px | Standard card padding |
| `--space-lg` | 24px | Section gaps |
| `--space-xl` | 40px | Major section breaks |
| `--space-2xl` | 64px | Editorial breathing room |

### Border radius scale

No sharp corners anywhere. Minimum 8px on everything that's not a 1px rule.

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 8px | Inputs, small chips |
| `--radius-sm` | 12px | Form fields |
| `--radius-md` | 18px | Default cards, doors |
| `--radius-lg` | 24px | Large cards |
| `--radius-xl` | 32px | Hero blocks, modals |
| `--radius-pill` | 999px | Pills, FABs, full-rounded |

### Component patterns (mobile counterparts)

These are the named primitives on the mobile side. Build equivalent web components to match.

#### `<Display>` — serif headline

Mobile:
```tsx
<Display size="lg">Welcome</Display>
<Display size="lg" italic color={colors.accent}>back.</Display>
```

Web equivalent CSS:
```css
.display-lg {
  font-family: var(--font-serif);
  font-size: clamp(48px, 5vw, 56px); /* responsive */
  line-height: 56px;
  letter-spacing: -0.8px;
  color: var(--color-ink);
}
.display-lg.italic { font-style: italic; color: var(--color-accent); }
```

Sizes: `sm` (28px) · `md` (40px) · `lg` (56px) · `xl` (72px).
The italic variant is the editorial signature — usually one word per headline ("Welcome / **back.**").

#### `<Body>` — Onest body text

```css
.body-md {
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 22px;
  color: var(--color-ink-2);
}
```

Sizes: `xs` (11px) · `sm` (13px) · `md` (15px) · `lg` (17px). Weights: 400, 500, 700.

#### `<Label>` — mono uppercase eyebrow

```css
.label {
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: 11px;
  line-height: 15px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--color-ink-3);
}
.label.eyebrow { letter-spacing: 1.8px; }
```

Use for: section eyebrows, table column headers, timestamps, status indicators. The "magic ingredient" that makes the rest read as editorial — every screen has at least one.

#### `<Door>` — primary button (NEO LAB "door" pattern)

Big tap-target buttons with optional eyebrow caption + arrow:

```html
<button class="door door-solid">
  <div class="door-caption">APPROVE</div>
  <div class="door-label">Approve creator</div>
  <svg class="door-arrow" /* arrow icon */ />
</button>
```

```css
.door {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-radius: var(--radius-md);
  border: 1px solid currentColor;
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 16px;
  cursor: pointer;
  transition: transform .15s ease;
  min-height: 54px;
}
.door:hover { transform: translateY(-1px); }

.door-solid { background: var(--color-ink); color: var(--color-paper-3); border-color: var(--color-ink); }
.door-accent { background: var(--color-accent-solid); color: white; border-color: var(--color-accent-solid); }
.door-ghost { background: transparent; color: var(--color-ink); border-color: var(--color-ink); }

.door-caption {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 2px;
}
.door-ghost .door-caption { color: var(--color-ink-3); }
.door-arrow { width: 18px; height: 18px; margin-left: 12px; }
```

Three variants:
- `door-solid` (ink) — default primary action
- `door-accent` (emerald) — the win moment ("Approve", "Save and publish")
- `door-ghost` (bordered) — secondary

#### `<Card>` — paper-bordered surface

```css
.card {
  background: var(--color-paper-3);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
  padding: 16px;
}
.card-large { border-radius: var(--radius-lg); }
```

#### `<Pill>` — mono-labeled chip

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--color-rule-strong);
  background: var(--color-paper-3);
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--color-ink-2);
  cursor: pointer;
}
.pill[aria-pressed="true"] {
  background: var(--color-ink);
  color: var(--color-paper-3);
  border-color: var(--color-ink);
}
```

#### `<LiveDot>` — pulsing live-green indicator

```html
<span class="live-dot" aria-hidden="true"></span>
```

```css
.live-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  background: var(--color-live);
  border-radius: 50%;
  box-shadow: 0 0 0 0 var(--color-live);
  animation: live-pulse 2s infinite;
}
@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 rgba(63, 168, 106, 0.6); }
  70% { box-shadow: 0 0 0 8px rgba(63, 168, 106, 0); }
  100% { box-shadow: 0 0 0 0 rgba(63, 168, 106, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .live-dot { animation: none; }
}
```

### Applying the system to the two admin surfaces

#### Surface A — Pending Approval queue (editorial treatment)

Page structure mirroring the mobile editorial pattern:

```
┌──────────────────────────────────────────────────────────┐
│  PENDING APPROVAL · 04 CREATORS                          │  ← mono eyebrow, count
│                                              ● LIVE       │  ← LiveDot + label
│                                                            │
│  Awaiting your                                             │  ← serif display lg
│  approval.                                                 │     ("approval." italic + accent)
│                                                            │
│  These creators passed the onboarding quiz and are         │  ← Onest body lede
│  waiting on the team. Newest first.                       │
│                                                            │
│  ─────────────────────────────────────────────────         │  ← warm rule divider
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ [Avatar] Maria Santos               2D AGO        │    │  ← serif name, mono timestamp
│  │          maria@example.com                        │    │     in eyebrow position
│  │                                                   │    │
│  │          ╔══════════════╗  ╔══════════════╗      │    │
│  │          ║ APPROVE      ║  ║ View profile ║      │    │  ← door-accent + door-ghost
│  │          ╚══════════════╝  ╚══════════════╝      │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ [Avatar] Juan Dela Cruz             5D AGO        │    │
│  │          ...                                       │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

CSS pattern:

```html
<header class="editorial-header">
  <p class="label eyebrow">Pending Approval · 04 Creators</p>
  <div class="live-indicator">
    <span class="live-dot"></span>
    <span class="label" style="color: var(--color-live);">LIVE</span>
  </div>
</header>

<h1 class="display-lg">
  Awaiting your<br>
  <em class="display-lg italic">approval.</em>
</h1>

<p class="body-md" style="color: var(--color-ink-2); max-width: 56ch;">
  These creators passed the onboarding quiz and are waiting on the team. Newest first.
</p>

<hr class="rule" />

<ul class="creator-list">
  {creators.map(creator => (
    <li class="card creator-card">
      <div class="creator-card-header">
        <Avatar name={creator.firstName} />
        <div class="creator-info">
          <h3 class="creator-name">{creator.firstName} {creator.lastName}</h3>
          <p class="body-sm muted">{creator.email}</p>
        </div>
        <span class="label">{relativeTime(creator.quizPassedAt)}</span>
      </div>
      <div class="creator-card-actions">
        <button class="door door-accent" onClick={() => approveCreator({ id: creator._id })}>
          <span class="door-caption">APPROVE</span>
          <span class="door-label">Approve creator</span>
        </button>
        <button class="door door-ghost">View profile</button>
      </div>
    </li>
  ))}
</ul>
```

#### Surface B — Lead Content editor (editorial treatment)

```
┌──────────────────────────────────────────────────────────┐
│  LEAD DETAIL · CONTENT EDITOR                              │  ← mono eyebrow
│                                                            │
│  Curate the                                                │  ← serif display
│  social card.                                              │     ("social card." italic)
│                                                            │
│  Anything you write here renders as a Facebook-style       │  ← Onest body
│  card on mobile. Description, link, and image are          │
│  all optional.                                              │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ DESCRIPTION                                       │    │  ← mono label
│  │ ┌────────────────────────────────────────────┐  │    │
│  │ │ Aling Maria's pandesal has been a Quezon   │  │    │  ← paper3 textarea
│  │ │ City staple since 1987...                   │  │    │
│  │ └────────────────────────────────────────────┘  │    │
│  │ MAX 500 CHARACTERS · 142 USED                    │    │  ← mono caption
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ EXTERNAL LINK                                     │    │
│  │ ┌────────────────────────────────────────────┐  │    │
│  │ │ 🔗  https://maria-bakery.negosyo.digital   │  │    │
│  │ └────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ PREVIEW IMAGE                                     │    │
│  │ ┌────────────────────────────────────────────┐  │    │
│  │ │     [thumb]      Choose file… 2MB max       │  │    │
│  │ └────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ╔══════════════════════╗  ╔══════════════════════╗      │
│  ║ SAVE                 ║  ║ Clear content        ║      │  ← door-accent + door-ghost
│  ╚══════════════════════╝  ╚══════════════════════╝      │
└──────────────────────────────────────────────────────────┘
```

Wrap each form section in a `.card` with paper-3 bg, with the `<Label>` above the field (not above the section header) — that's the editorial signature pattern.

### Mobile-responsive guidance for the admin

Admins may use these pages from a tablet or phone. Apply these breakpoints:

| Breakpoint | Approach |
|---|---|
| **≥1280px** (desktop) | Two-column where it helps (e.g., editor on left, mobile preview on right) |
| **768–1279px** (tablet) | Single column, full-width cards, slightly tighter spacing |
| **<768px** (phone) | Single column, edge-to-edge cards (16px outer gutter), larger tap targets (min 44pt height), display sizes drop one notch (lg → md) |

Concrete responsive overrides:

```css
@media (max-width: 768px) {
  .container { padding: 0 16px; }
  .display-lg { font-size: 40px; line-height: 42px; } /* was 56/56 */
  .display-md { font-size: 32px; line-height: 34px; }
  .creator-card-actions {
    flex-direction: column; /* stack buttons vertically on phone */
    gap: 8px;
  }
  .door { width: 100%; } /* full-width buttons on phone */
  section { padding: 40px 0; } /* tighter section spacing */
}

@media (max-width: 480px) {
  .editorial-header {
    flex-direction: column; /* stack eyebrow + live indicator */
    align-items: flex-start;
    gap: 8px;
  }
}
```

**Tap targets (always):**
- Buttons / clickable elements: min `44pt × 44pt` (`.door` already at 54pt)
- Form inputs: min `44pt` tall
- Icon-only buttons: `40pt × 40pt` minimum with `hitslop: 8`

**Touch-friendly form patterns:**
- File input: pair with a styled `<label>` that's the full clickable area (the native input is hard to tap)
- Long textareas: enable `autosize` so editor doesn't fight to scroll
- Async actions (upload, save): show inline progress + disable the button — don't silently spin

### What NOT to do with this design

- ❌ Don't substitute "Inter" for Onest. The brief explicitly excludes it ("Sans: Onest — clean, fresh, **not Inter**").
- ❌ Don't use heavy drop shadows. The system uses subtle warm shadows (max `0 12px 24px rgba(0,0,0,0.12)`). Material-style elevation looks wrong against paper bg.
- ❌ Don't go monochromatic emerald. Three greens (`accent`, `accent-solid`, `live`) play different roles — flat brand-emerald everywhere kills the editorial feel.
- ❌ Don't make every label uppercase mono. Reserve mono for eyebrows, timestamps, and metadata — body / button labels stay Onest sans.
- ❌ Don't use the existing zinc gray palette. Use ink / ink-2 / ink-3 instead. Cool zinc gray clashes with warm paper bg.

### Optional: applying to the rest of the admin web

Out of scope for this rollout — but if you have time, the pattern naturally extends to:
- All existing admin pages (re-skin headers + cards with the tokens above)
- Login/auth screens (mirror the mobile editorial auth pattern)
- Reports / dashboards (serif numbers + mono labels in stat cards)
- Settings (cards with rule dividers, mono labels per row)

Roll out gradually — start with the two admin surfaces in Step 10, then expand as time permits.

---

## Step 11 — Verify locally, test each function, then deploy

### 11.1 — Local compile check

In the web repo:

```bash
npx convex dev
```

Watch for `Convex functions ready!` with no schema-validation errors and no TypeScript errors.

### 11.2 — Verify the new functions exist in the dev dashboard

Open https://dashboard.convex.dev → switch to your DEV deployment → **Functions** tab. Confirm these 8 functions are present (in addition to the previously-deployed ones):

**Creators module:**
- `creators:markQuizPassed` (mutation)
- `creators:approveCreator` (mutation)
- `creators:listPendingApproval` (query)

**Leads module:**
- `leads:listForMobileCRM` (query, args: `search`, `statusFilter`, `onlyMine`)
- `leads:getDetailForMobileCRM` (query)
- `leads:updateAdminContent` (mutation)
- `leads:generatePreviewImageUploadUrl` (action)
- `leads:getDetailForAdmin` (query)

### 11.3 — Per-function smoke test (dev dashboard "Run function")

The Convex dashboard has a **Run function** button on each function page. Use it to confirm each one works before any deploy.

#### `creators:listPendingApproval`
- **Args:** `{}`
- **Auth:** must be signed in as an admin (Clerk ID listed in `ADMIN_CLERK_IDS` env var)
- **Expected:** array of creators with `quizPassedAt` set but `certifiedAt` null. Empty array `[]` is also valid (means no pending creators exist).
- **If you get "Forbidden: admin access required":** the dashboard runner uses the env-var-configured admin list. Verify `ADMIN_CLERK_IDS` on the deployment includes your Clerk ID.

#### `creators:markQuizPassed`
- **Args:** `{ "id": "<a creator _id you control>" }`
- **Auth:** the creator must match `identity.subject` (i.e., the Clerk session must be the creator themselves). Hard to test from the dashboard — easier to test from the mobile app's quiz pass flow.
- **Expected:** silent success (no return value). Verify by querying the creator and checking `quizPassedAt` is populated.

#### `creators:approveCreator`
- **Args:** `{ "id": "<a creator _id with quizPassedAt set>" }`
- **Auth:** admin
- **Expected:** silent success. Notification appears in the creator's notifications. The creator's `certifiedAt` field is now populated. Mobile (if running) auto-navigates the user past the Pending Review screen.

#### `leads:listForMobileCRM`
- **Args:** `{}`
- **Auth:** any signed-in creator
- **Expected:** `{ leads: [...], stats: {...} }`. The `leads` array contains ALL leads in the DB (not just yours). Each lead has `submittedBy.displayName` populated. The `stats` object includes a `mine` count.
- **If `submittedBy` is null on every lead:** the lead's `creatorId` points at a deleted/missing creator. Check the Data tab.

#### `leads:getDetailForMobileCRM`
- **Args:** `{ "id": "<a lead _id>" }`
- **Auth:** any signed-in creator
- **Expected:** the lead detail with `submittedBy`, `interviewers`, `notes`, `business`, `adminContent`. `interviewers` is an array; `interviewerCount` is the length.

#### `leads:updateAdminContent`
- **Args:** `{ "id": "<a lead _id>", "description": "Test description from dashboard" }`
- **Auth:** admin
- **Expected:** silent success. Lead row now has `adminDescription` set and `adminUpdatedAt` populated. Mobile reactive query updates within seconds.

#### `leads:generatePreviewImageUploadUrl`
- **Args:** `{ "leadId": "<lead _id>", "mimeType": "image/jpeg", "sizeBytes": 102400 }`
- **Auth:** admin
- **Expected:** `{ uploadUrl: "https://...amazonaws.com/...", publicUrl: "https://...", storageKey: "lead-previews/..." }`
- **If you get "R2_PUBLIC_URL is not configured":** that env var is missing on the deployment. Set it via `npx convex env set R2_PUBLIC_URL <value> --prod`.
- **If you get "Image too large":** size exceeded 2,000,000 bytes — the action validates upfront.

#### `leads:getDetailForAdmin`
- **Args:** `{ "id": "<a lead _id>" }`
- **Auth:** admin
- **Expected:** `{ lead, submission, creator }` with full lead row + linked submission + sanitized creator info.

### 11.4 — Deploy to production

Once all 8 functions test green in the dev dashboard:

```bash
npx convex deploy --prod
```

Watch for "Deployed successfully." Then re-do steps 11.2 and 11.3 against the **prod** deployment to confirm everything landed.

---

## Troubleshooting

### Schema validation failures

If `npx convex dev` fails with a schema validation error, it means a row in the deployed DB doesn't match the schema you're trying to push. Common cases for this rollout:

| Error message | Cause | Fix |
|---|---|---|
| `Path: .action, Value: "payout_sent"` | Old `auditLogs` row uses `payout_sent` but schema doesn't allow it | Step 1a not applied — add `v.literal("payout_sent")` |
| `Object is missing the required field "accountHolderName"` | Legacy `withdrawals` row missing the field | Step 1b not applied — wrap `accountHolderName` in `v.optional(...)` |
| `Object is missing the required field "<other>"` | A different schema drift surfaced after these fixes | Capture exact error and ping mobile team. Apply same additive-optional pattern. |
| `Path: <field>, Value: <unexpected>` | Data has a value the schema's `v.union(...)` doesn't accept | Either add the literal to the union (additive) OR patch the row in the dashboard. Prefer adding the literal if it's a real value used by code. |

### Function-related errors

| Error | Cause | Fix |
|---|---|---|
| `"Function not found: leads/listForMobileCRM"` | Step 4 not completed or function wasn't deployed | Re-check Step 4; ensure `npx convex dev` ran cleanly; verify the function appears in the dashboard |
| `"Forbidden: admin access required"` | `requireAdmin` rejected the caller | Verify `ADMIN_CLERK_IDS` env var on the deployment includes the calling user's Clerk ID. Set via `npx convex env set ADMIN_CLERK_IDS "user_abc,user_xyz" --prod` |
| `"Forbidden: you can only update your own account"` | `markQuizPassed` was called by an admin on behalf of a creator | Don't — `markQuizPassed` is creator-self-only. Admin uses `approveCreator` instead. |
| `"R2_PUBLIC_URL is not configured"` | Env var missing | `npx convex env set R2_PUBLIC_URL "https://your-r2-domain" --prod` |
| `"Cannot find module './lib/phone'"` | Step 2 not completed | Create the file per Step 2 |
| `"normalizePhone is not defined"` | Step 3 import line missing | Add the import |
| `"Image too large (max 2MB)"` | Upload payload over the cap | Client must validate first; cap is intentional |
| `"Unsupported image type"` | MIME outside `image/jpeg,png,webp` | Same — enforce in browser file picker `accept=` attribute |
| `403 from R2 PUT request` | Either: (a) Content-Type header mismatch with presigned URL's encoded type, (b) presigned URL expired (1h TTL), or (c) CORS not configured on the bucket | (a) Match `Content-Type` to the `mimeType` you sent in the action call. (b) Re-call `generatePreviewImageUploadUrl` to get a fresh URL. (c) Apply the CORS policy snippet above. |
| `CORS error in browser console on PUT` | R2 bucket missing CORS rules for browser-direct uploads | Apply the JSON CORS policy from the "CORS gotcha" subsection above |
| Notification not sent after `approveCreator` | `internal.notifications.createAndSend` import / module mismatch | Verify the existing notification system handles `type: "certification"` — this rollout reuses it. If the type literal is missing from the notification schema, it'll throw. |

### Index-related warnings during `npx convex dev`

If you see `Deleted table indexes:` mentioning indexes you didn't add, that's the **schema-drift between mobile and web** showing up. Mobile and web's `schema.ts` declare slightly different index names (`by_submission_id` vs `by_submissionId`, etc.). Each side's `dev` push removes the other's indexes. Out of scope for this rollout — flag for a future cleanup but don't fix here.

### Mobile sees stale data after admin saves

Reactive Convex queries refresh within ~1s of a mutation. If mobile doesn't update:
1. Confirm the mutation actually ran (Functions tab → recent invocations)
2. Confirm the mobile app is signed in (a logged-out app obviously won't reactively refresh)
3. Mobile's `useQuery` will refetch on every focus by default — if it's stuck, navigating away and back fixes the immediate view

### Convex `useAction` returns a function that errors with "actions don't return values"

Convex requires you to `await` the action and use the return value directly. If you wrap it weirdly, the await semantics break. The paste-ready code above uses the correct pattern.

---

## Post-deploy verification (with the mobile team)

After deploying, ping the mobile team to confirm everything works. They should:

1. Run a quiz pass on a test creator → confirm they land on `/pending-review`
2. Call `creators.approveCreator` from the Convex dashboard for that creator → confirm the mobile app auto-navigates to the home screen
3. Use the new admin UI to enrich a test lead with description + link + image → confirm the mobile lead card renders as a social card
4. Browse the CRM list as a different creator → confirm all leads are visible with original-creator attribution

---

## Summary checklist

Tick each one off as you go. Don't skip any. The order matters because later steps depend on earlier ones.

### Schema additions to `convex/schema.ts` (Step 1)

- [ ] **1a:** `v.literal("payout_sent")` added to `auditLogs.action` union (additive)
- [ ] **1b:** `accountHolderName` made optional + `reference: v.optional(v.string())` added on `withdrawals`
- [ ] **1c:** `quizPassedAt: v.optional(v.number())` added to `creators` table
- [ ] **1d:** 6 new optional admin-content fields added to `leads` table

### Files created (Step 2)

- [ ] `convex/lib/phone.ts` created with `normalizePhone` export

### `convex/leads.ts` additions (Steps 3 + 4 + 9)

- [ ] **Step 3:** `import { normalizePhone } from "./lib/phone";` added to imports
- [ ] **Step 4:** Three new exports added at end of file:
  - [ ] `formatCreatorDisplayName` (pure helper)
  - [ ] `listForMobileCRM` (query, with `onlyMine` arg, returns ALL leads, includes `submittedBy` + admin content)
  - [ ] `getDetailForMobileCRM` (query, returns `submittedBy`, `interviewers`, `notes`, `business`, `adminContent`)
- [ ] **Step 9:** Imports updated to include `action` + R2 helpers
- [ ] **Step 9:** Constants `PREVIEW_IMAGE_MAX_BYTES = 2_000_000` and `ALLOWED_PREVIEW_IMAGE_TYPES = [...]` added
- [ ] **Step 9:** Five new exports added at end of file:
  - [ ] `updateAdminContent` (mutation, admin-only, validates URL prefix + 500-char description)
  - [ ] `validatePreviewImageUploadArgs` (pure helper, exported for tests)
  - [ ] `buildPreviewImageStorageKey` (pure helper, exported for tests)
  - [ ] `generatePreviewImageUploadUrl` (action, admin-only, returns presigned PUT URL)
  - [ ] `getDetailForAdmin` (query, admin-only, returns full lead + submission + creator)

### `convex/creators.ts` additions (Step 8)

- [ ] `requireAdmin` added to the existing import from `./lib/auth`
- [ ] Three new exports added at end of file (existing `certify` mutation UNTOUCHED):
  - [ ] `markQuizPassed` (mutation, creator-self-only, idempotent)
  - [ ] `approveCreator` (mutation, admin-only, sends notification)
  - [ ] `listPendingApproval` (query, admin-only)

### Verification (Steps 5 + 11)

- [ ] **Step 5:** Schema fields verified to exist on `creators`, `submissions`, `leads`, `leadNotes` tables
- [ ] **Step 11.1:** `npx convex dev` compiles cleanly (no TS errors, no schema validation errors)
- [ ] **Step 11.2:** All 8 new functions appear in the **dev** Convex dashboard's Functions tab
- [ ] **Step 11.3:** Each function smoke-tested via dashboard "Run function" — at minimum `listPendingApproval`, `listForMobileCRM`, `generatePreviewImageUploadUrl`
- [ ] **Step 11.4:** `npx convex deploy --prod` succeeds
- [ ] All 8 functions reappear in the **prod** Convex dashboard's Functions tab

### Env vars (one-time setup on prod, if not already)

- [ ] `ADMIN_CLERK_IDS` set on prod (comma-separated Clerk user IDs of admins). Without this, all admin-gated functions reject all callers.
- [ ] `R2_PUBLIC_URL` set on prod (e.g., `https://pub-xxxxxx.r2.dev` or your custom domain). Without this, `generatePreviewImageUploadUrl` throws.
- [ ] R2 bucket CORS policy includes `PUT` and `Content-Type` for the web origin (see "CORS gotcha" in Step 10)

### Admin UI (web frontend) (Step 10)

- [ ] **Surface A:** Pending Approval queue page wired to `listPendingApproval` + `approveCreator`
- [ ] **Surface B:** Lead Content editor section on the lead detail page wired to `updateAdminContent` + `generatePreviewImageUploadUrl`
- [ ] Image upload validates size (≤2MB) and MIME type (JPEG/PNG/WebP) on the client BEFORE calling the action
- [ ] Clear-content button (calls `updateAdminContent` with empty strings) works

### Editorial Paper design system applied to both surfaces (Step 10.5)

- [ ] Google Fonts loaded (Instrument Serif, Onest, JetBrains Mono) via `<link>` or `next/font`
- [ ] CSS variables / design tokens defined (`--color-paper`, `--color-ink`, `--color-accent`, etc.)
- [ ] Display / Body / Label / Door / Card / Pill / LiveDot components built (or equivalent classes)
- [ ] Pending Approval queue uses serif display headline + mono eyebrow + accent door for Approve
- [ ] Lead Content editor uses serif headline + mono labels per field + accent door for Save
- [ ] **Mobile responsive:** breakpoints at 1280 / 768 / 480px applied; tap targets ≥44pt; doors stack full-width on phone
- [ ] No system-default fonts visible (i.e., font load completed before render)
- [ ] No Inter or zinc grays used (replaced by Onest + ink-2/ink-3)

### Coordination

- [ ] Mobile team notified that prod deploy is complete
- [ ] Mobile team confirmed all mobile flows work end-to-end:
  - [ ] Quiz pass routes to Pending Review screen
  - [ ] Admin approving from web auto-releases the gate
  - [ ] CRM lead list shows ALL leads with `submittedBy` attribution
  - [ ] Admin-curated content renders as a social card on mobile
