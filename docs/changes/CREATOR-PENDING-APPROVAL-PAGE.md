# Web — Creator Approval Pending Page

> **Single self-contained brief for the web agent.** Build the web-side equivalent of mobile's `/pending-review` screen so creators who sign up via the web Creators page have the same "we're reviewing your application" experience as mobile creators do.
>
> **Created 2026-06-19.** Source-of-truth fields live in the existing shared Convex backend — no schema changes required.

---

## 0. Why this exists

The mobile app already has a hard gate: after a creator passes the onboarding quiz, they're routed to `/pending-review`. They cannot submit businesses, cannot access the dashboard, can only sign out — until an admin manually approves them (`creator.certifiedAt` is set) or rejects them (`creator.rejectedAt` is set).

The web Creators page allows signup but **today has no equivalent gate**. Result: a web-only creator who just passed the quiz is dropped into the main creator UI with no clear signal that they're awaiting review. The web admin still has to approve them in the dashboard, but the creator doesn't know that.

This brief specs that gate on web. **No backend changes.** Pure UX + route logic.

---

## 1. The state model (already exists in the shared backend)

The `creators` table already has the three fields the gate needs:

```typescript
// convex/schema.ts — creators table (existing, no change needed)
quizPassedAt: v.optional(v.number()),  // creator finished onboarding quiz
certifiedAt:  v.optional(v.number()),  // admin APPROVED → unlock the app
rejectedAt:   v.optional(v.number()),  // admin REJECTED → bounce to /verification-rejected
```

State derivation, in priority order:

| `quizPassedAt` | `certifiedAt` | `rejectedAt` | Creator state | Route |
|---|---|---|---|---|
| unset | unset | unset | onboarding | `/onboarding` (existing) |
| set | unset | unset | **pending review** | **`/creator/pending` (NEW)** |
| set | set | unset | approved | `/creator/dashboard` (existing) |
| set | unset | set | rejected | `/creator/verification-rejected` (existing or follow-up) |
| set | set | set | (impossible — mutually exclusive at any moment) | — |

Routing rule: a creator is "pending" iff `quizPassedAt` is set AND `certifiedAt` is unset AND `rejectedAt` is unset.

---

## 2. What to build

### 2.1 Route guard middleware

Wherever the web app currently gates the `/creator/*` (or equivalent) authenticated area, add the pending check **before** the dashboard renders:

```typescript
// Pseudocode — adapt to your auth gate / middleware shape
const creator = await convex.query(api.creators.getByClerkId, { clerkId: user.id });

if (!creator) return redirect("/creator/onboarding");
if (creator.quizPassedAt && !creator.certifiedAt && !creator.rejectedAt) {
  return redirect("/creator/pending");
}
if (creator.rejectedAt) {
  return redirect("/creator/verification-rejected");
}
// else: certified — let through to dashboard
```

Apply this on EVERY authenticated creator route (dashboard, submit, wallet, etc.), not just the home page. A creator should not be able to URL-hop around the gate.

**Hard rule (mirrored from mobile):** while on `/creator/pending`, the only escape is **sign out**. No back-button navigation, no in-app links to elsewhere. This matches mobile's `BackHandler` + minimal-chrome behavior.

### 2.2 The page itself — `/creator/pending`

Lift the layout from mobile's `ndm/app/(app)/pending-review.tsx` (Editorial Paper voice, gold accent — same brand). Components:

**Header strip**
- Single right-aligned "Sign out" button. Nothing else clickable.

**Hero illustration** — match mobile's layered composition exactly (lift the visual, web can use SVG/CSS for the animations instead of Reanimated):

A `240×180` rounded card (white bg, soft gold shadow `#E4B05E` at 15% opacity, `borderRadius: 28`) containing:

1. A pale gold radial accent in the background (`#F5E4C0` at 50% opacity, 140×140 circle, offset top-right)
2. A nested "document" mock-up — `120×90` white rectangle with a 2px gold border (`#E4B05E`), `borderRadius: 12`. Inside:
   - A small title-bar block (`50×6`, pale gold `#F5E4C0`)
   - 3 stacked checklist rows — each a small `Ionicons "checkmark-circle"` in `#E4B05E` followed by a 4px-tall, 60px-wide progress bar (`#a7f3d0` — green-tinted). **The 3 checks fade-in sequentially** (stagger ~200ms each) as the page loads.
3. A rotating `Ionicons "search"` icon (28px, `#C89548`) overlaid absolutely at `top: 18, right: 24` — slow wobble rotation, 4-6° each way.
4. Three `✨` sparkle emojis at varied positions/sizes (top-right corner area, 14px / 10px / 12px). They fade in/out on a loop.

Below the card, with `marginTop: -22` so they peek up over the card's bottom edge: three `40×40` avatar circles in `#E4B05E`, `#C89548`, `#C89548`, each with a 3px white border + soft gold shadow. Each contains a person icon (`Ionicons "person"`, `"happy"`, `"person"`). They gently bob (subtle Y-translation animation).

Static fallback is fine if Reanimated-style fine motion is too costly on web — the structure of card + document + checks + sparkles + avatars is the hero, the motion is icing.

**Headline**
- `We're reviewing your application` (h1, serif, ink color `#5C3A0F`).
- Personalized sub-line: `Hi {firstName}, our team is carefully going through your quiz results. You're almost ready to start interviewing businesses.` (fall back to `Our team is carefully…` when `firstName` is missing.)

**ETA card**
- `ESTIMATED REVIEW TIME` (eyebrow, mono, `#71717a`)
- `Within 24 hours` (heavy, `#5C3A0F`)
- Clock icon on the left.

**Progress checklist (3 steps)**

| Step | State | Visual |
|---|---|---|
| 1. Quiz passed | done | Green/gold check + `timeAgo(creator.quizPassedAt)` underneath |
| 2. Admin review in progress | in progress | Pulsing amber circle, `Our team is verifying your account` |
| 3. Account activated | pending | Empty grey circle, `Start submitting & earning` (greyed) |

**Reassurance footer**

A gold-tinted card (`backgroundColor: #FBF3E0`, `borderLeftWidth: 3`, `borderLeftColor: #E4B05E`, `borderRadius: 12`, `padding: 14`). Two-column layout:
- Left: `💌` emoji (18px)
- Right: text in `#C89548`, 12px, line-height 18:

  > We'll send you a notification the moment you're approved. You can close the app and we'll let you know when you're in.

**Web translation note:** on web, "close the app" doesn't quite map — the user is on a tab in a browser, not a native app. Consider rewording **only this line** for web:

  > We'll email you the moment you're approved. You can close this tab — we'll let you know when you're in.

The 💌 emoji + the "we'll let you know when you're in" framing stays — that's brand voice.

### 2.3 Auto-route on state change

Critical for parity — when the admin acts in the dashboard, the creator should be moved off this page in real time without needing to refresh. Mobile uses `useQuery` (Convex live query) to subscribe to the creator row. Web should do the same via the Convex React client.

```typescript
"use client";
const creator = useQuery(api.creators.getByClerkId, { clerkId });
const router = useRouter();

useEffect(() => {
  if (!creator) return;
  if (creator.certifiedAt) {
    router.replace("/creator/dashboard");      // approved → home
  } else if (creator.rejectedAt) {
    router.replace("/creator/verification-rejected"); // rejected → reason page
  }
}, [creator, router]);
```

Convex's live-query model means this fires within ~1 second of the admin clicking "Approve" — no polling needed.

### 2.4 Admin-side trigger (already exists, just confirm)

Confirm the existing admin dashboard's "Approve creator" action calls the existing Convex mutation (probably `creators.approveCreator` or similar — find in `convex/creators.ts`) and that mutation sets `certifiedAt = Date.now()`. If the web admin dashboard doesn't currently expose this control, expose it on the creator detail page (`/admin/creators/[id]`).

Reject flow likewise — admin sets `rejectedAt` + an optional `rejectionReason` (already in schema if mobile uses it; check `convex/creators.ts` `rejectCreator` mutation).

---

## 3. Visual spec — Editorial Paper + gold (Tendso rebrand)

Use the same design tokens the rest of the web Creators page already uses. Key colors:

| Token | Hex |
|---|---|
| Background — page | `#FBF3E0` (pale gold-cream) |
| Background — cards | `#fff` |
| Border — cards | `#F5E4C0` |
| Ink — headlines | `#5C3A0F` (deep amber) |
| Ink — body | `#C89548` (burnt amber) — secondary text |
| Ink — muted | `#71717a` |
| Accent fills (icons, progress dot 1) | `#E4B05E` |
| In-progress pulse | `#fbbf24` (warm amber) |

Typography: serif headlines (Instrument Serif), Onest body, monospace eyebrows — same as the rest of the Tendso brand surface. The literal "TENDSO" wordmark anywhere uses **Google Sans Flex** (matches mobile's `fonts.wordmark` token).

---

## 4. Verification checklist

After deploy, walk through every state on staging:

- [ ] New creator signs up via web → completes onboarding quiz → lands on `/creator/pending`
- [ ] Cannot URL-hop to `/creator/dashboard` (route guard redirects back)
- [ ] Cannot URL-hop to `/creator/submit` etc. (same)
- [ ] Sign out works
- [ ] Admin opens dashboard → approves the creator → within ~1s the creator's browser auto-routes to `/creator/dashboard` without a refresh
- [ ] Different creator: admin rejects → that creator auto-routes to `/creator/verification-rejected` with the reason visible
- [ ] Mobile and web behavior is identical for the same creator (test: a creator who signed up via web sees the pending page on both surfaces; an admin approval flips both)

---

## 5. What's intentionally NOT in this brief

- ❌ **New schema fields.** Use what's already there. The mobile gate works against these three fields and so should web.
- ❌ **A new "pending notifications" inbox.** The email-on-approve is implied (the bottom reassurance copy says we'll email). Hooking up that email goes through the existing notification system (`notifications` table + email templates) — separate work.
- ❌ **Resubmission flow from the pending screen.** Resubmission for rejected creators belongs on `/creator/verification-rejected`, not here.
- ❌ **Admin-side bulk approval UI.** Out of scope; admins approve one at a time today, which is fine.
- ❌ **Mobile changes.** Mobile already has this screen built. Nothing to port back.

---

## 6. Reference — files to read on mobile for the design

Mobile's working implementation (read these to lift layout + copy):

- `ndm/app/(app)/pending-review.tsx` — the screen itself (~700 lines, but the layout is straightforward; the bulk is reanimated animations you can simplify or skip on web)
- `ndm/app/(app)/verification-rejected.tsx` — the rejected-state screen for the bounce target
- `ndm/convex/creators.ts` — the `approveCreator` / `rejectCreator` mutations + the `getByClerkId` query
- `ndm/convex/schema.ts` lines 28-32 — the three fields

## 7. Hard rules (still)

- ❌ Mobile must not run `npx convex deploy`. Web repo is the sole deploy authority.
- ❌ Do NOT rename `quizPassedAt`/`certifiedAt`/`rejectedAt` — mobile reads these by exact name.
- ❌ Do NOT remove the route guard once added — it's the gate that makes the whole flow safe.

---

## Quick summary

| Item | Effort |
|---|---|
| Route guard middleware (1 file) | 15 min |
| `/creator/pending` page (static + live query subscription) | 2-3 hours including illustration |
| Admin dashboard approve/reject buttons (if not already wired) | 30-60 min depending on existing UI |
| Total | **~3-4 hours** |

No backend, no schema, no migration. Pure web UX + route logic against fields the backend already exposes.
