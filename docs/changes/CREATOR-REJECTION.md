# Web-side prompt — Reject Creator Verification (admin)

> **Hand this entire document to the agent / developer working in the web repo.** Self-contained spec for adding a "Reject" action to the Pending Approval admin queue, plus a Rejected creators view. Do NOT run `npx convex deploy --prod` from the web repo until everything below is in place.
>
> **Sister docs:** [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md) (approval flow + schema sync), [WEB-LEAD-CRM-CREATORS-PAGE.md](./WEB-LEAD-CRM-CREATORS-PAGE.md) (leads page). Apply the same Editorial Paper design tokens described in those docs (greens + khaki, NO orange, Instrument Serif + Onest + JetBrains Mono).

---

## Context for the implementing agent

The mobile team just shipped a **Creator Rejection** flow on the mobile side:

- New schema fields on `creators`: `rejectedAt`, `rejectionReason`, `rejectedBy`
- New Convex mutations: `rejectCreator(id, reason?)` and `requestRecertification(id)`
- New Convex query: `listRejected()`
- New mobile screen: `app/(app)/verification-rejected.tsx` — locked screen that shows the rejection reason and offers a "Retake the quiz" action (which calls `requestRecertification`)
- Mobile auth gate now routes rejected creators (rejectedAt set, certifiedAt null) to `/verification-rejected`

**Today's gap:** there is no UI on the web admin panel to actually reject a creator. The mutation `rejectCreator` is deployed and callable, but the admin has no button. Step 8/Step 10 from WEB-SYNC-MOBILE-FEATURES.md only documents the **Approve** button. This doc closes that gap.

**Critical rule:** Additive-only changes. Do NOT modify, rename, or remove any existing schema fields, exports, or admin UI. Do NOT touch the Approve button or the `approveCreator` mutation. Only ADD.

---

## State invariants (must hold)

A creator is in exactly one of these states at any moment:

| State | `quizPassedAt` | `certifiedAt` | `rejectedAt` | Mobile routes to |
|---|---|---|---|---|
| New signup, no quiz | `null` | `null` | `null` | `/training` |
| Quiz passed, awaiting admin | set | `null` | `null` | `/pending-review` |
| Admin approved | set | set | `null` | `/(tabs)/` (home) |
| Admin rejected | set | `null` | set | `/verification-rejected` |
| Creator requested retake after rejection | `null` | `null` | `null` | `/training` |

**Invariant:** `certifiedAt` and `rejectedAt` are mutually exclusive — both cannot be set on the same creator. The `rejectCreator` mutation throws if `certifiedAt` is already set (you cannot reject an approved creator without an explicit "unapprove" first, which is out of scope for this work).

---

## Step 1 — Apply the additive schema accommodations in `convex/schema.ts`

Locate the `creators` table. Add **four** new optional fields — three for the rejection flow plus one accommodation for pre-existing data drift surfaced during mobile's deploy attempt on 2026-05-22:

```typescript
creators: defineTable({
  // ... existing fields ...
  referredByCode: v.optional(v.string()),
  referredByName: v.optional(v.string()),
  referredBy: v.optional(v.id("creators")),          // NEW (drift accommodation) — legacy field on some pre-2026 rows
  // ... other existing fields ...
  certifiedAt: v.optional(v.number()),
  quizPassedAt: v.optional(v.number()),
  rejectedAt: v.optional(v.number()),                // NEW
  rejectionReason: v.optional(v.string()),           // NEW — max 500 chars enforced in mutation
  rejectedBy: v.optional(v.string()),                // NEW — Clerk ID of rejecting admin
  // ... rest unchanged ...
})
```

All four are `v.optional`. No existing field is removed or made stricter. No index changes.

### Why `referredBy` is in this list

When mobile attempted `npx convex deploy --prod` on 2026-05-22, it failed with:

```
Schema validation failed.
Document with ID "j572y5m563s629wgxd3gbbrn6985ddgv" in table "creators"
does not match the schema: Object contains extra field `referredBy`
that is not in the validator.
```

At least one prod creator row (`bc.steven0209@gmail.com`) has a `referredBy` field set to a Convex creator ID, populated by some earlier signup path. The current schema never declared it. Adding it as `v.optional(v.id("creators"))` lets prod data validate without changing any behavior. **Do not attempt to "clean up" by deleting the field from rows — keep the data, declare the field.**

If any of these four fields are already present in the web repo's schema, **skip them** — do not duplicate.

---

## Step 2 — Add the three new Convex functions to `convex/creators.ts`

Append at the end of the file. **Do NOT modify** the existing `approveCreator`, `markQuizPassed`, or `listPendingApproval` exports.

```typescript
// ----------------------------------------------------------------------------
// CREATOR REJECTION FLOW (admin-gated)
//
// Counterpart to approveCreator. Admin can choose Reject (with optional reason)
// when reviewing a pending creator. Mobile detects rejectedAt and routes the
// creator to /verification-rejected, where they can either request a retry
// (which clears rejectedAt + quizPassedAt and bounces back to /training) or
// contact support.
// ----------------------------------------------------------------------------

export const rejectCreator = mutation({
  args: {
    id: v.id("creators"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const creator = await ctx.db.get(args.id);
    if (!creator) throw new Error("Creator not found");
    if (creator.rejectedAt) return; // idempotent
    if (creator.certifiedAt) {
      throw new Error("Cannot reject a creator who has already been approved");
    }
    const trimmed = args.reason?.trim();
    if (trimmed && trimmed.length > 500) {
      throw new Error("Rejection reason too long (max 500 characters)");
    }
    await ctx.db.patch(args.id, {
      rejectedAt: Date.now(),
      rejectionReason: trimmed && trimmed.length > 0 ? trimmed : undefined,
      rejectedBy: identity.subject,
      lastActiveAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: args.id,
      type: "certification",
      title: "Verification update",
      body: trimmed && trimmed.length > 0
        ? `Your application wasn't approved this time. Reason: ${trimmed}`
        : "Your application wasn't approved this time. You can retake the quiz or contact support.",
      data: { rejectedByAdmin: true },
    });
  },
});

export const requestRecertification = mutation({
  args: { id: v.id("creators") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const creator = await ctx.db.get(args.id);
    if (!creator || creator.clerkId !== identity.subject) {
      throw new Error("Forbidden: you can only update your own account");
    }
    if (!creator.rejectedAt) {
      throw new Error("Only rejected creators can request recertification");
    }
    if (creator.certifiedAt) {
      throw new Error("Already certified");
    }
    await ctx.db.patch(args.id, {
      rejectedAt: undefined,
      rejectionReason: undefined,
      rejectedBy: undefined,
      quizPassedAt: undefined,
      lastActiveAt: Date.now(),
    });
  },
});

export const listRejected = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("creators").collect();
    return all
      .filter((c) => c.rejectedAt && !c.certifiedAt && !c.isDeleted)
      .map((c) => ({
        _id: c._id,
        clerkId: c.clerkId,
        email: c.email,
        firstName: c.firstName ?? null,
        middleName: c.middleName ?? null,
        lastName: c.lastName ?? null,
        phone: c.phone ?? null,
        profileImage: c.profileImage ?? null,
        quizPassedAt: c.quizPassedAt ?? null,
        rejectedAt: c.rejectedAt!,
        rejectionReason: c.rejectionReason ?? null,
        rejectedBy: c.rejectedBy ?? null,
        createdAt: c.createdAt ?? null,
      }))
      .sort((a, b) => b.rejectedAt - a.rejectedAt);
  },
});
```

If you already imported `requireAdmin` / `requireAuth` / `internal` for the existing approval flow, you do not need to re-import them. If the web repo's `creators.ts` uses different import paths, match those — only the function bodies must be identical.

---

## Step 3 — Add a "Reject" button to the Pending Approval queue

This is **Surface A** from [WEB-SYNC-MOBILE-FEATURES.md Step 10](./WEB-SYNC-MOBILE-FEATURES.md). It already has an "Approve" button on each row. Add a "Reject" button next to it.

### Per-row layout (suggested)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Avatar] Maria S. Cruz · maria@example.com                              │
│          Quiz passed 2h ago · Referred by Juan D.                       │
│                                          [Approve]   [Reject]           │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Approve button** (existing): emerald accent Door. Single-click. Calls `approveCreator`. Don't change anything about this.
- **Reject button** (new): ghost Door with ink text on paper-3, or `danger`-bordered. Opens a confirmation dialog with an optional reason text input.

### Reject confirmation dialog

When admin clicks "Reject" on a row, open a modal:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 02 / NOT APPROVED                                                  │
│  Reject Maria S. Cruz?                                                   │
│                                                                          │
│  This will lock the creator's account. They'll see a rejection screen on │
│  the mobile app and can either retake the quiz or contact support.       │
│                                                                          │
│  Reason (optional, max 500 chars)                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [textarea]                                                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  Reason text is shown to the creator. Leave blank to give no reason.    │
│                                                                          │
│                                            [Cancel]   [Reject creator]   │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Reason field**: optional, `<textarea>`, `maxLength={500}`. Show a character counter (`<small>123 / 500</small>`).
- **Reject creator button**: red (`--color-danger`) ink-solid Door. On click, call `api.creators.rejectCreator({ id, reason: reason.trim() || undefined })`.
- **Cancel button**: ghost Door.
- On success: optimistically remove the row from the pending list and show a toast: "Maria S. Cruz rejected. They'll see the rejection screen on next app open."
- On error: show the error in a danger banner inside the modal. Don't dismiss.

### Paste-ready React + Convex hook for the dialog

Adapt to your form library. Pattern matches the LeadContentEditor in [WEB-SYNC-MOBILE-FEATURES.md Step 10](./WEB-SYNC-MOBILE-FEATURES.md).

```tsx
import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

export function RejectCreatorDialog({
  creator,
  open,
  onClose,
  onSuccess,
}: {
  creator: { _id: Id<'creators'>; firstName: string | null; lastName: string | null };
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const rejectCreator = useMutation(api.creators.rejectCreator);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = [creator.firstName, creator.lastName].filter(Boolean).join(' ') || 'this creator';

  async function handleReject() {
    setError(null);
    setSubmitting(true);
    try {
      await rejectCreator({
        id: creator._id,
        reason: reason.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to reject creator');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <div className="dialog editorial-card">
        <div className="dialog-eyebrow mono danger">STEP 02 / NOT APPROVED</div>
        <h2 className="serif">Reject {fullName}?</h2>
        <p className="sans">
          This will lock the creator's account. They'll see a rejection screen on the mobile app
          and can either retake the quiz or contact support.
        </p>

        <label className="mono small">REASON (OPTIONAL)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="What should the creator know about this decision?"
          disabled={submitting}
        />
        <small>{reason.length} / 500 — shown to the creator on their rejection screen</small>

        {error && <div className="banner danger">{error}</div>}

        <div className="dialog-actions">
          <button className="door ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="door danger" onClick={handleReject} disabled={submitting}>
            {submitting ? 'Rejecting…' : 'Reject creator'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Style this with the Editorial Paper tokens from [WEB-SYNC-MOBILE-FEATURES.md Step 10.5](./WEB-SYNC-MOBILE-FEATURES.md) — serif headline, mono eyebrow, paper-3 surface, ink/danger palette, NO orange.

---

## Step 4 — Add a "Rejected creators" view

A second view under Creator Management → Rejected (sibling to "Pending Approval"). Mirrors the pending list but reads from `listRejected`.

Per row:
- Creator name, email, profile image, `rejectedAt` (relative time)
- The `rejectionReason` (if set) shown inline, or a "View reason" tooltip
- "View profile" button (existing creator detail view)
- Optionally an "Unreject" button — out of scope for v1, but you could add a future `unrejectCreator` mutation that clears `rejectedAt` and restores `quizPassedAt`. **Do not implement unreject in this PR.** Tag it as a follow-up.

Reasonable filters: search by name/email, sort by most-recently-rejected first.

### Why this view matters

Without it, a rejected creator is invisible to the admin team — they don't appear in Pending Approval and they don't appear in the certified creators list. Operations gets blind to the "who did we reject" question.

If the creator clicks "Retake the quiz" on mobile, `requestRecertification` clears `rejectedAt` and they re-enter the funnel from the top (training → quiz → pending). The Rejected list will drop them automatically (it filters `rejectedAt && !certifiedAt`).

---

## Step 5 — Verify the deployment chain

In the web repo:

```bash
npx convex dev
```

Watch the terminal output. Expected:
- `rejectCreator`, `requestRecertification`, and `listRejected` appear in the dev dashboard's Functions tab.
- No TypeScript errors.
- No schema validation errors (the new fields are optional, so existing rows pass).

If you see:
- **"Function not found: creators:rejectCreator"** → Step 2 wasn't completed in this branch
- **"Forbidden: admin only"** when calling from a test client → confirm `ADMIN_CLERK_IDS` includes your Clerk ID (same env var the approval flow uses)
- **"Cannot reject a creator who has already been approved"** → working as designed; remove the test creator's `certifiedAt` from the dashboard or pick a different test row

Then deploy:

```bash
npx convex deploy --prod
```

After deploy, verify the three functions appear in the prod dashboard at https://dashboard.convex.dev under deployment `prod:energetic-panther-693`.

---

## Step 6 — End-to-end test with the mobile team

Pick a test creator who has passed the quiz but is not yet certified. From the web admin panel, reject them.

Expected mobile behavior:
1. Within ~30 seconds, the mobile app's reactive query updates and the creator is bounced from `/pending-review` (or the home tab) to `/verification-rejected`.
2. The rejection reason (if provided) is rendered in the editorial card under "REVIEWER NOTE".
3. The creator can tap "Retake the certification quiz" → confirmation alert → `requestRecertification` is called → bounce to `/training`.
4. After retaking and passing, the creator lands back on `/pending-review`, ready for another admin review.

Coordinate with the mobile team to watch the device while you click Reject.

---

## What you MUST NOT do

- ❌ Do not run `npx convex deploy --prod` until Steps 1–2 are complete.
- ❌ Do not modify `approveCreator`, `markQuizPassed`, or `listPendingApproval`.
- ❌ Do not remove the existing Approve button. Add Reject next to it.
- ❌ Do not introduce a new notification type. Reuse `"certification"` with a distinct title/body — the mobile app already maps this type to the right icon and tint.
- ❌ Do not auto-clear `quizPassedAt` when rejecting. The mobile rejection screen needs `quizPassedAt` to render the timeline strip ("Quiz passed ✓ · Admin review ✗ · Locked"). It is only cleared when the creator explicitly chooses to retake via `requestRecertification`.
- ❌ Do not use orange / terracotta / amber in the dialog. Use `--color-danger` (`#B43A1F`) on `--color-danger-bg` (`#F3D7CF`) for destructive accents — earthy red, NOT SaaS orange.
- ❌ Do not call `rejectCreator` without explicit admin action. No keyboard shortcut, no bulk action in v1 — one creator, one click, one confirmation.

## What's safe to do

- ✅ Reformat / lint the new code to match the web repo's style.
- ✅ Inline the reason validation (`maxLength 500`) on the textarea AND in the mutation — defense in depth is good here.
- ✅ Show a toast on successful reject.
- ✅ Optimistically remove the rejected creator from the Pending list.
- ✅ Pre-fill the reason textarea with a template if you want (e.g., `"Hi {firstName}, ..."`). Just don't lock the admin into the template.
- ✅ Add an audit log entry if the web admin panel already audits admin actions. (Mobile-side `auditLogs.action` enum does not yet include `"creator_rejected"` — if you want to log, propose adding the literal in a separate PR coordinated with mobile. Don't add it in this PR.)

---

## Deliverables checklist for this PR

### Schema + functions

- [ ] `convex/schema.ts` — four new optional fields on `creators` (`referredBy` drift accommodation + `rejectedAt` + `rejectionReason` + `rejectedBy`)
- [ ] `convex/creators.ts` — three new exports (`rejectCreator`, `requestRecertification`, `listRejected`)
- [ ] `npx convex dev` compiles cleanly, all three functions visible in dev dashboard
- [ ] `npx convex deploy --prod` succeeds, all three functions visible in prod dashboard

### Admin UI

- [ ] Pending Approval queue: each row has Approve (existing) and Reject (new) buttons
- [ ] Clicking Reject opens a confirmation dialog with an optional reason textarea
- [ ] Reason input enforces `maxLength={500}` and shows a character counter
- [ ] Submit calls `api.creators.rejectCreator({ id, reason })` and removes the row on success
- [ ] Error message rendered in-modal on failure (no dismiss until resolved)
- [ ] New "Rejected creators" view, mirroring Pending Approval, reading from `listRejected`

### Design system compliance

- [ ] Dialog uses Editorial Paper tokens (Instrument Serif headline, Onest body, mono eyebrow)
- [ ] Reject button uses `--color-danger` (`#B43A1F`), NOT orange
- [ ] No orange / terracotta / `#f59e0b` / `#ea580c` anywhere in the new UI
- [ ] Mobile-responsive: dialog usable on phone viewports (≤480px)
- [ ] Keyboard accessible: Tab order Cancel → Reject, Esc closes

### Coordination

- [ ] Mobile team notified before prod deploy
- [ ] Mobile team confirms the rejection flow end-to-end with a test creator
- [ ] Mobile team confirms the rejected creator can successfully retake the quiz via `requestRecertification`

---

## Related docs

- [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md) — admin approve flow + schema sync + Editorial Paper tokens
- [WEB-LEAD-CRM-CREATORS-PAGE.md](./WEB-LEAD-CRM-CREATORS-PAGE.md) — public Leads page for the Creators platform
- Mobile source: `ndm/app/(app)/verification-rejected.tsx` — what the creator sees after rejection
- Mobile source: `ndm/app/(app)/(tabs)/index.tsx` — auth gate that routes rejected creators
- Mobile source: `ndm/convex/creators.ts` — reference implementation of the three new functions (mobile already has them — your web repo should be a strict superset)
