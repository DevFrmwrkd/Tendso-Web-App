# Plan: Business Owner Access Control, Pricing Strategy, Creator Earnings Model

**Date:** 2026-06-13
**Source:** Voice memo from stakeholder (transcribed 2026-06-12)
**Status:** PLANNING — not yet implemented

---

## High-level overview

Five workstreams, sequenced so the security fix ships first and each phase unblocks the next:

| Phase | What it delivers | Why | Mobile change? |
|---|---|---|---|
| **0 — AI check** | Security + product-gap audit before building | The memo's opening ask; findings shape the design | No |
| **1 — Owner portal** | Business owners get a passwordless ("Edit my website" magic link) **scoped editor sandbox** to change their own site's content, with an admin support chat as human backup | Closes the impersonation hole — no more applying changes from unverifiable phone/email requests | No |
| **2 — Pricing engine** | Anchor ₱4,999 (marketing), creator-set sale price ₱999–₱4,999, first-5 submissions locked at ₱999; a **price-setting slider on BOTH web and mobile**; an **admin pricing-settings page** to reconfigure anchor/floor/ceiling/intro/commission without a deploy; **per-creator pricing visible on the admin creator pages**; domain charged at real registrar cost; price-discovery analytics | Enables the launch promo, creator-dictated pricing, self-serve reconfiguration, and admin visibility | **Yes — slider is a required co-launch APK deliverable** |
| **3 — Creator earnings** | Flat **50% of the sale price**, credited when the business actually pays; domain excluded | Makes creators earn more by charging more | No (server-shared) |
| **4 — Landing localization** | EN/Tagalog switcher that re-renders the whole landing page; "formerly Negosyo Digital" hero label; **remove the region dropdown** (PH-only for now) | Reach the Filipino audience in their language; finish brand continuity; drop unused international UI | No (web landing only) |
| **Mobile rebrand** | Native app launcher **name → "Tendso"** and **icon → tendso-icon.png** (Google Play APK) | Finishes the Negosyo Digital → Tendso rebrand on the one surface the web rebrand couldn't reach | **Yes — APK rebuild + Play Store listing** |

**One-line summary:** make business owners safe self-serve editors (Phase 1), let creators set the price within bounds via a slider on web + mobile that admins can reconfigure anytime (Phase 2) and earn 50% of every sale (Phase 3), localize the landing page to EN/Tagalog and trim it to PH-only (Phase 4) — and finish the rebrand on the mobile app's name and icon.

---

## What the transcript asks for

1. **AI check** — a security + product-gap review of the platform. Beyond pure security, identify things users will want that don't exist yet. The headline example: a business owner wants to change something on their website. Today they'd have to call/email us — which is both an operational burden **and a social-engineering hole** (we can't verify a caller is really the owner, so an attacker could phone in and inject false content onto a live business website).
2. **Self-serve, authenticated owner changes** — business owners must be able to make changes themselves (app or web) behind a login, so changes never happen "on our end" based on unverifiable requests.
3. **Pricing strategy** — anchor-price marketing: the website is "worth" ₱4,999, businesses get it for ₱999 during the launch campaign (framed as a massive discount / "practically free").
4. **Creator-set pricing + earnings** — each creator's **first 5 submissions** are charged a fixed ₱999. After that, the **creator dictates the price** within a floor of ₱999 and a ceiling of ₱4,999. Creators can use the gap as a discount lever ("50% off!"), they earn more when they charge more (flat 50% of the sale price), and the platform gets organic **price discovery** (which price points actually convert). *(Threshold lowered 10 → 5 and earnings simplified to flat-50% per client Slack, 2026-06-13.)*

---

## Current state (what we're building on)

| Area | Today |
|---|---|
| Business owners | **Not users at all.** Contact info lives on `submissions` (`ownerName/Email/Phone`). They only receive a tokenized payment link (`/pay/[token]`) by email. |
| Auth | Clerk. One user table (`creators`) with `role: "admin"` for admins. Route gating in `middleware.ts` + per-page role checks. |
| Editing | `components/editor/` (ContentEditor, VisualEditor) exists for creators/admins. Edits land in `websiteContent`, then require Astro rebuild + Cloudflare Pages redeploy. |
| Pricing | Hardcoded: ₱1,000 (subdomain) / ₱1,500 (custom domain) in `app/submit/review/page.tsx` and `convex/submissions.ts`. |
| Creator earnings | Flat payouts: ₱500 video / ₱300 audio interview (`app/submit/interview/page.tsx`), stored in `submissions.creatorPayout`, paid to `balance`, withdrawn instantly via Wise. No commission/percentage model. |

---

## Phase 0 — AI check (security + product-gap audit)

Run before building, so findings feed the design:

- `/security-review` over the current branch, plus a targeted review of:
  - `/pay/[token]` flow (token entropy, expiry, replay)
  - Wise webhook handler in `convex/http.ts` (signature verification, amount matching)
  - Convex mutations that mutate `websiteContent` / `submissions` (who can call them — Convex functions are publicly callable unless they check identity)
  - Email templates (owner email is the trust anchor for Phase 1 — confirm it can't be changed post-submission without verification)
- Product-gap sweep: enumerate every action an owner might want (edit text/photos, update hours/contact, see leads, renew domain, request takedown) and confirm each has — or gets — a self-serve authenticated path. Anything without one is a future "phone us" hole.

**Deliverable:** findings doc; anything critical fixed before Phase 1 ships.

---

## Phase 1 — Business Owner Portal (access control)

**Goal:** owners make their own changes behind a login; we never act on phone/email requests.

### 1.1 Identity model
- New Convex table `businessOwners`: `clerkId`, `email`, `name`, `phone`, `createdAt`.
- New table `websiteOwnerships`: `businessOwnerId`, `submissionId`/`generatedWebsiteId`, `role: "owner"`, `claimedAt` — supports one owner with multiple businesses later.
- Keep `creators` untouched; owners are a separate audience with a separate portal.

### 1.2 Claim flow + passwordless sign-in (how we know it's really the owner)

- Trust anchor = the `ownerEmail` captured at submission and already used for the payment link. **Email is the identity anchor, never the instruction channel** — owners prove who they are by possessing the inbox; they never email free-text change requests for staff to apply.
- **Owners have no passwords.** Sign-in is magic-link/email-code only (Clerk's passwordless strategy). Rationale: MSME owners won't manage another password, and it deletes the entire reset-password/credential-stuffing surface for this audience.
- The flow, from the owner's side:
  1. Every transactional email to the owner (approval, payment confirmation, site-live) carries an **"Edit my website"** button.
  2. First click = claim: single-use token (same pattern as `paymentTokens`), 7-day expiry → Clerk passwordless verification of the same email → creates `businessOwners` + `websiteOwnerships` rows → token consumed.
  3. Every later click = a fresh magic link to the email on file → straight into their editor, signed in. Expired link? The page offers "send me a new link" to the on-file email only.
- Backfill: one-off job to send claim emails to all existing paid owners.
- **Policy change (non-code):** support/admins never edit a site on behalf of a caller or an email request. Verified path only: owner uses their magic link, or admin re-sends a fresh link to the email on file. Document this in the admin runbook.

### 1.3 Owner portal (`/my-business` or `/owner`) — a scoped editor sandbox

The mental model: **owners get the same website-builder sandbox admins already have, fenced to their own website(s) and trimmed to content-level controls.**

- New route group, gated by Clerk + `businessOwners` lookup (mirror `useAdminAuth` pattern).
- MVP pages:
  - **Dashboard** — their website(s), live URL, status, leads summary (read from existing `leads`).
  - **Edit website** — the visual sandbox, with a human-support sidebar (see below).
  - **Publish** — owner edits are **staged**, not live; a "Publish changes" button triggers the existing Astro rebuild → Cloudflare Pages deploy.
  - **Account** — email + notification preferences (no password — passwordless per 1.2).

**Two layers, one permission system:**

1. **Visual sandbox** — reuse `components/editor/ContentEditor`/`VisualEditor` against their `websiteContent`. The owner picks a section and edits fields directly.

2. **Admin support chat in the editor sidebar.** A persistent sidebar panel in the builder where the owner can message a real admin when they're stuck — troubled by the editor, or the request is something only staff can do (domain issues, takedowns, billing). This is the verified replacement for the phone call: owners who would rather *tell someone* the change than click through the editor get a direct line — but inside the authenticated session, so the impersonation hole never opens.

- **Owner side:** sidebar chat pinned to their website context. Because the owner is already authenticated via magic link, every message is from a *verified* owner — this is the safe version of "just call us."
- **Admin side:** new `/admin/support` queue in the existing admin dashboard. Each thread shows the website, owner identity, and recent edit history alongside the conversation, so the admin can act (or guide) with full context. Reply → owner sees it in the sidebar + gets an email nudge ("Tendso replied — Edit my website").
- **Data model:** `supportThreads` (ownerId, websiteId, status: open/resolved, createdAt) + `supportMessages` (threadId, senderType: owner/admin, body, createdAt). Admin actions taken from a thread are still normal audited mutations — chat never becomes a side-door write path.
- Admins should prefer *guiding* the owner ("tap the Hours section, then Publish") over silently making the change — keeps owners self-sufficient and the audit story clean.
- **Economics note:** every support thread costs admin minutes, so the portal UX should make the self-serve path the easy one — the sidebar is the backup, not the front door. If thread volume grows with the customer base, an AI assistant as a first-line filter is the known escalation valve (deliberately out of scope for v1).

How the sandbox differs from the admin's editor:

| | Admin | Business owner |
|---|---|---|
| **Which sites** | Any submission | Only sites linked via `websiteOwnerships` — and the check is **server-side in every Convex mutation**, so hitting the API directly with another site's ID is rejected, not just hidden in the UI |
| **Which controls** | Everything | Content only: text, photos, hours, contact, services. No template/style-variant switching, no domain settings, no approval-state or build-pipeline access — an owner changing opening hours is the everyday case; restructuring the site the creator designed is not |
| **Publishing** | Direct rebuild/redeploy | Staged edits + rate-limited publish (e.g., 3/day — each publish is a real Astro build) |

**Editing is an ability, not an obligation.** Creators and admins keep their existing editor access; an owner who doesn't want to self-edit can still ask *their* creator — that's fine, because the creator is an authenticated, accountable user tied to that submission. Many MSME owners will prefer this; the portal exists so the option is there and so verification never depends on a phone call. The only hard rule is the **channel**: every change comes through an authenticated path (1.2 policy).

Optional v1.1: admin review queue for owner edits before publish, if abuse appears.

### 1.4 Audit
- Log all owner mutations to existing `auditLogs` (who, what field, old → new). This is the forensic answer to "wrong information got injected."

---

## Phase 2 — Pricing engine

**Goal:** stop hardcoding prices; support anchor pricing, the ₱999 launch promo, and creator-set pricing.

### 2.0 The three numbers (mental model)

The whole phase is about separating three numbers that are currently one hardcoded value:

| Number | What it is | Value | Who sees it |
|---|---|---|---|
| **Anchor price** (`listPricePHP`) | The marketing "real value" of the website. Never actually charged. | ₱4,999 | Business owner — shown struck through to make the offer feel valuable |
| **Sale price** (`salePricePHP`) | What the business owner actually pays. | ₱999–₱4,999, chosen by the creator | Business owner (pays it), creator (sets it), admin (analytics) |
| **Floor / ceiling** | The bounds the creator must stay within. | floor ₱999, ceiling ₱4,999 | Creator only |

The creator's sales pitch is the **gap between anchor and sale price**: "This website is worth ₱4,999 — I can get it for you at ₱2,499, that's 50% off." The deeper the discount, the easier the sale; the higher the price, the more the creator earns (Phase 3). The platform watches which sale prices actually convert → price discovery.

Today there is only one number: `amount` = ₱1,000 (or ₱1,500 with domain), hardcoded in three places — `app/submit/review/page.tsx:43` (`totalAmount`), and `convex/submissions.ts` at the `create` mutation (line ~242), `setDomainTier` (line ~364), and `submit` (line ~424).

### 2.1 Config-driven pricing

New Convex table so prices can change without a deploy:

```ts
pricingConfig: defineTable({
    anchorPricePHP: v.number(),        // 4999
    floorPricePHP: v.number(),         // 999
    ceilingPricePHP: v.number(),       // 4999
    introSubmissionCount: v.number(),  // 5 — first N paid submissions locked to floor
    maxDomainPricePHP: v.number(),     // 5000 — ceiling for an allowed custom domain (replaces the old flat ₱500 cap; actual charge is the domain's real price, see 2.3)
    commissionRate: v.number(),        // 0.5 — used by Phase 3
    effectiveFrom: v.number(),         // ms timestamp; latest row wins
})
```

- Read via one internal query `pricing.getActiveConfig` (latest `effectiveFrom` ≤ now). Admin UI to insert a new row = a price change with history.
- **Prices are resolved server-side and frozen onto the submission at submit time.** The client UI only displays them; the `submit` mutation re-resolves from config so a tampered client can't set its own price.

### 2.2 First-5 rule + creator-set price (the submit flow, step by step)

New server query `pricing.getCreatorPricing(creatorId)` returns `{ paidSubmissionCount, isIntro, floor, ceiling, anchor }`, where `paidSubmissionCount` = count of this creator's submissions with `status === "paid"`. Intro mode is `paidSubmissionCount < 5`.

In `/submit/review` (replacing the `totalAmount` constant at line 43):

1. Page calls `getCreatorPricing`.
2. **If `paidSubmissionCount < 5` (intro mode):** price is locked. UI shows a non-editable card: *"Launch price ₱999 — applies to your first 5 submissions (you've completed 3 of 5)."* No slider.
3. **If `paidSubmissionCount ≥ 5`:** the price-setting control appears (full spec in 2.2a below).
4. Custom domain stacks **on top** of the chosen price at its **real registrar price** (see 2.3): `totalAmount = salePrice + (wantsCustomDomain ? domainCostPHP : 0)`, where `domainCostPHP` is what `/api/check-domain` returned for that exact domain.
5. On submit, the mutation **re-checks everything server-side**: re-counts paid submissions (the UI count may be stale — race-safe), clamps the requested price to floor/ceiling, forces floor if still intro, and writes the frozen values.

New fields on `submissions`:

```ts
listPricePHP: v.optional(v.number()),   // anchor at time of sale (4999)
salePricePHP: v.optional(v.number()),   // what the creator chose / intro floor
discountPct: v.optional(v.number()),    // derived, stored for analytics
introSale: v.optional(v.boolean()),     // true = one of the first-5
// `amount` stays — it's salePricePHP + domain add-on, and the /pay/[token]
// flow + Wise webhook matching keep working untouched.
```

Why freeze instead of recompute? If config changes next month (floor raised to ₱1,499), in-flight submissions and historical analytics must keep the price the owner actually agreed to.

Backfill: existing submissions get `salePricePHP = amount − domainAddOn`, `introSale = true` (they were all sold at the old flat price).

### 2.2a Price-setting UI — the slider (creator's control after 5 submissions)

> **Decided:** a **drag slider with a live earnings readout** is the primary control. Rationale: it makes both the *discount* and the *creator's own commission* move in real time, which is the exact psychology the client described ("people love discounts") — and it nudges creators away from reflexively slamming the price to the floor, because they watch their own payout shrink as they do.

Lives on `/submit/review`, replacing the hardcoded `totalAmount` (line 43). Only renders when `paidSubmissionCount ≥ 5`; before that, the locked ₱999 intro card shows instead.

```
┌─────────────────────────────────────────┐
│  Set your price for this business        │
│                                          │
│  ₱999 ─────────●──────────── ₱4,999      │  ← drag slider, step ₱100
│              ₱2,500                       │  ← current value, large
│                                          │
│  “Worth ₱4,999”   [ 50% OFF ]            │  ← anchor strike + live discount badge
│                                          │
│  💰 You earn: ₱1,250                     │  ← live, = 0.5 × current value
│     (50% of ₱2,500)                      │
│                                          │
│  [ ⌨ type exact amount ]                 │  ← fallback numeric input
└─────────────────────────────────────────┘
+ custom domain (if typed): alingnena.com  ₱720   (real price, separate — 2.3)
─────────────────────────────────────────
Business pays:  ₱3,220
```

Behavior:
- **Bounds:** slider min = `floorPricePHP` (₱999), max = `ceilingPricePHP` (₱4,999), step ₱100. Default position = ceiling (₱4,999) so the creator consciously *chooses* to discount rather than defaulting low.
- **Live, on every drag tick (no server call):** update three things together — the price number, the discount badge (`round((1 − price/anchor) × 100)%`), and the "You earn" figure (`0.5 × price`). All three moving at once is the whole point.
- **Typed fallback:** tapping the value opens a numeric input; on blur it re-clamps to ₱999–₱4,999 and snaps the slider. For creators who know the exact number they negotiated.
- **Domain line is separate** and below the split line — its real price (2.3) adds to "Business pays" but never to "You earn", reinforcing visually that the domain isn't theirs to profit from.
- **Mobile-first:** large touch target on the thumb, the value and earnings big enough to read at arm's length (this runs on the creator's phone in the field). The mobile APK (Phase 2 release) mirrors this same slider.
- **On submit:** the chosen value is sent to `submissions.submit`, which **re-clamps and re-checks intro status server-side** — the slider is a convenience, never the source of truth.

The "You earn" readout is doing the real work here: it's the in-context version of the creator-education in 3.7. A creator who can see "drop to ₱999 and you earn ₱500, hold at ₱3,000 and you earn ₱1,500" learns the pricing strategy by feel, every time they submit.

**Cross-platform requirement (web + mobile, co-launch):** this slider is **not web-only and not a deferred mobile follow-up** — it ships on both the web `/submit/review` page **and** the native mobile creator app's review screen as part of the same Phase 2 release. Both read the bounds (`floor`/`ceiling`/`anchor`/`introSubmissionCount`) from the shared `pricing.getCreatorPricing` query, so the two implementations stay in lockstep with no duplicated constants. The interaction (drag → live discount + live "You earn", typed fallback, domain shown separately) is identical; only the widget is platform-native (HTML `<input type="range">` on web, the RN slider component on mobile). See the Mobile impact section for the parity rules and the old-APK fallback.

### 2.2b Admin pricing settings — reconfigure the engine without a deploy

> **Requested:** admins (Theo) can change the pricing — anchor, floor, ceiling, intro threshold, commission rate — themselves, when they have a change in mind, without a code deploy.

The `pricingConfig` table (2.1) was built for this; this section adds the **admin UI** that writes to it. New page `/admin/pricing` (gated by the existing admin role check):

```
┌──────────────────────────────────────────────┐
│  Pricing settings                  [ history ] │
│                                                │
│  Anchor (marketing "worth")   ₱ [ 4999 ]       │
│  Floor (minimum price)        ₱ [  999 ]       │
│  Ceiling (maximum price)      ₱ [ 4999 ]       │
│  Intro: first N submissions     [    5 ]       │
│      at the floor price                        │
│  Commission rate (creator %)    [   50 ] %     │
│  Max allowed domain price     ₱ [ 5000 ]       │
│                                                │
│  ⓘ Changes apply to NEW submissions only.      │
│    Existing deals keep their frozen price.     │
│                                                │
│           [ Cancel ]   [ Save new version ]    │
└──────────────────────────────────────────────┘
```

How it works:
- **Save = insert a new `pricingConfig` row** with `effectiveFrom = now` (never an in-place edit). The active config is always "latest row with `effectiveFrom ≤ now`." This gives a full price-change audit trail for free.
- **Validation** (server-side in the mutation, not just the form): `floor ≤ ceiling`, `floor ≤ anchor`, `0 < commissionRate ≤ 1`, `introSubmissionCount ≥ 0`, all amounts positive. Reject incoherent configs (e.g. floor above ceiling) before they can break the slider.
- **Frozen-price guarantee:** because every submission freezes its own `listPricePHP`/`salePricePHP`/`creatorPayout` at submit time (2.2, 3.5), changing settings **never** re-prices an in-flight or paid submission. A business that agreed to ₱2,500 still owes ₱2,500 even if Theo raises the floor an hour later. State this explicitly in the UI so admins aren't afraid to change it.
- **History view:** list past `pricingConfig` rows with their `effectiveFrom`, so it's clear what the rules were on any given date (matters when reading the price-discovery analytics in 2.5).
- **Audit:** log the change to `auditLogs` (who changed what, old → new).
- **Effort note:** small — it's a form + one `insertPricingConfig` admin mutation + a list query. The hard part (config-driven resolution, freezing) is already in 2.1/2.2.

Touch points: `convex/pricing.ts` (`insertPricingConfig` mutation + `listPricingConfigs` query), `app/admin/pricing/page.tsx` (new), admin nav link.

### 2.3 Domain add-on = the domain's REAL price, extracted at submit time

> **Decided with client:** charge the **exact registrar price** of the specific domain the creator typed, added on top of the sale price. No flat ₱500, no markup — matches Theo's "we don't earn from the domain" rule (3.2).

**The key realization: the real price is already being fetched and then thrown away.** Today the review page calls `/api/check-domain` on every keystroke (debounced), which runs `domains.checkDomainAvailability` and returns `{ available, pricePHP, withinBudget, ... }`. The page reads `pricePHP` only to show it and to enforce a ₱500 budget cap — then `setDomainTier` **ignores `pricePHP` entirely** and hardcodes `amount: 1500`. We just need to *keep* the number that's already in hand.

**What changes:**

1. **Drop the ₱500 cap.** `app/submit/review/page.tsx:107` sends `maxBudgetPHP: 500`, and `handleSubmit` (line 150) rejects anything over budget. That cap currently *blocks* all .ph and premium domains. Remove it (or raise it to a sane ceiling like ₱5,000) so any reasonably-priced domain is allowed and simply priced through.
2. **Pass the fetched `pricePHP` into the mutation.** `setDomainTier` takes a new arg `domainPricePHP` (the `domainCheck.pricePHP` the page already has):

   ```ts
   // convex/submissions.ts — setDomainTier
   args: {
     id, submissionType, requestedDomain,
     domainPricePHP: v.optional(v.number()),   // NEW — exact registrar price, from check-domain
   }
   // amount is no longer hardcoded:
   const domainAddOn = isWithDomain ? (args.domainPricePHP ?? 0) : 0
   updates.amount        = salePricePHP + domainAddOn
   updates.domainCostPHP = domainAddOn        // freeze the quoted price (schema already has this field)
   ```

3. **Re-quote server-side to stop tampering & stale prices.** The client price can't be trusted (and FX drifts), so the mutation should **re-call `domains.checkDomainAvailability` for `requestedDomain` itself** and use *that* `pricePHP`, not the client's number. The client value is just for display. This also re-checks availability at the moment of submit.
4. **Freeze the quote.** Store the resolved price on the submission (`domainCostPHP`) so the payment link, the email, and the Wise webhook all match — even if the registrar's price changes the next day. The quote the business sees is the quote they pay.

**FX / price-drift safeguard:** registrar prices move with USD↔PHP and with registrar changes. Because the price is frozen at submit time, there's a window between quote and payment where the real cost could rise. Two cheap protections: (a) re-validate the quote if payment hasn't happened within N days (the domain flow already has a `pending_payment` state), and (b) since the platform earns ₱0 on the domain by policy, a small unrecovered FX delta is a platform cost, not a creator problem — never claw it back from the creator's 50% (which is on `salePricePHP` only).

**Schema:** `submissions.domainCostPHP` already exists (it was the admin's net-earnings field) — reuse it as the frozen domain quote. No new table.

This makes the domain genuinely pass-through: the business pays what the domain costs, the creator earns nothing from it, and the ₱4,999 anchor never absorbs it.

### 2.4 Marketing surfaces

- `/pay/[token]` page and the payment email (`lib/email/templates.ts`): show `~~₱4,999~~ ₱999 (80% off)` using the frozen `listPricePHP`/`salePricePHP`, then the custom domain as its **own line item at its real price** (e.g. "Custom domain alingnena.com — ₱720"), with `amount` as the payable total. The owner sees the website discount and the at-cost domain charge separately.
- `/for-business` and `/for-creators` landing pages need a real rework — see 2.4a (their current hardcoded prices now contradict the model).
- Copy/palette per TENDSO-REBRAND.md.

### 2.4a Landing-page pricing rework (the live pages currently contradict the new model)

The pricing change is **not** just the submit flow — the public landing pages hardcode the old numbers in data files and will actively misprice/mislead until updated:

| Surface | Today (stale) | Problem |
|---|---|---|
| `components/landing/BusinessPricingSection.tsx:15` | Headline *"₱1,000 once. Live forever."* | Old price; no ₱4,999 anchor, no ₱999 launch framing |
| `components/landing/landingData.ts` → `BUSINESS_TIERS` (L94–116) | Two fixed tiers: Standard **₱1,000**, Custom Domain **₱1,500** | Wrong prices, and the **two-tier model itself is gone** — it's now one website at a creator-set price + an at-cost domain, not two pre-priced tiers |
| `components/landing/landingData.ts` → `CREATOR_EARNINGS` + `app/for-creators/page.tsx:110-113` | "Video ₱500 / Audio ₱300" earnings table | Contradicts flat-50% — earnings are now a *range*, not two flat numbers |
| `app/for-creators/page.tsx:23` | "₱500 lands in your wallet… 48 hours of the business approving" | Two errors now: amount is variable (50%), and timing is **on payment, not approval** (3.3) |

**Business page rework:**
- Replace the two-tier grid with a **single anchor-priced offer**: hero shows `~~₱4,999~~` struck through, "launch price from ₱999", one CTA. The custom domain becomes a small "+ your own .com at cost" note, **not** a second ₱1,500 tier.
- Keep "pay only when live / one-time / no monthly" — those are still true and still strong.
- (Optional, properly hedged) a "from ₱999" line acknowledges creators may price higher; avoid implying every business pays ₱999.

**Creator page rework:**
- Replace the flat "₱500 / ₱300" `CREATOR_EARNINGS` table with the **"keep 50% of every sale"** story and an **earnings range**: "₱500 on a ₱999 sale → up to ₱2,500 on a ₱4,999 sale."
- Fix the payout-timing copy: "paid when the business pays," not "when the site is approved."
- Keep the ₱1,000 referral bonus line if that program still stands (confirm — it's separate from the commission change).

**Where the data lives:** both pages read from `components/landing/landingData.ts`. Most of this is editing that one data file plus the `BusinessPricingSection` headline — the layout components can largely stay, except the business grid collapses from two cards to one offer.

### 2.5 Price discovery analytics (the "identify the best pricing range" ask)

Admin dashboard widget over `submissions`:

- **Conversion by price bucket:** group non-intro submissions into buckets (₱999–1,999 / 2,000–2,999 / 3,000–3,999 / 4,000–4,999); for each, show payment-link-sent → paid conversion rate and median days-to-pay.
- **Revenue-maximizing view:** bucket conversion × bucket average price = expected revenue per link sent. The bucket that wins this is the "best pricing range".
- Per-creator average sale price + conversion, so high performers' pricing behavior can be studied and taught in `/training`.

No new tables needed — it's all queries over the frozen fields from 2.2.

### 2.5a Per-creator pricing on the admin creator-management page

> **Requested:** on the admin creator pages, show the prices each creator is charging businesses.

Two surfaces, both reading the frozen `salePricePHP` from 2.2 — no new tables:

**Creators list (`app/admin/creators/page.tsx`):** add columns so admins can compare pricing behavior across creators at a glance:
- **Avg sale price** — mean `salePricePHP` over the creator's paid submissions.
- **Price range** — min–max they've charged (e.g. "₱999–₱3,500").
- **Intro progress** — `paidSubmissionCount` vs. the threshold (e.g. "7 / 5 ✓ unlocked" or "3 / 5").
- Optional: a small sparkline or "tends to discount / tends to hold price" tag derived from avg vs. anchor.

**Creator detail (`app/admin/creators/[id]/page.tsx`):** a per-submission pricing table:

```
Submission        Sale price   Discount   Domain    Creator earned   Status
Bakery ni Nena     ₱2,500       50% off    ₱720      ₱1,250           paid
Aling Rosa Sari    ₱999 (intro) 80% off    —         ₱500             paid
Kape ni Juan       ₱3,999       20% off    —         ₱2,000           pending payment
─────────────────────────────────────────────────────────────────────────
Avg sale ₱2,499 · Lifetime earned ₱3,750 · 3 paid / 5 intro · slider unlocked
```

- Each row shows the frozen `salePricePHP`, derived `discountPct`, the domain's real cost (excluded from earnings, 2.3), the creator's 50% payout, and payment status.
- **Intro vs. flexible** clearly flagged per row, so an admin can see whether a creator is still in the locked-₱999 phase or actively setting prices.
- Powered by a new admin query `admin.getCreatorPricingSummary(creatorId)` over that creator's submissions; the list view uses an aggregate variant. Admin-role gated like the rest of `/admin`.

This is the per-creator complement to the platform-wide price-discovery analytics in 2.5 — 2.5 answers "what price converts best," this answers "how is *this* creator pricing."

---

### Phase 2 worked example

> Maria has 7 paid submissions (past the first 5, slider unlocked). She visits a bakery, records the interview, and at `/submit/review` sets the slider to ₱2,500. The UI shows "50% off ₱4,999" and "You earn ₱1,250". The bakery wants the domain `alingnena.com` — the page's debounced `/api/check-domain` call already returned `pricePHP: 720`, so the UI shows "Custom domain ₱720". On submit, `setDomainTier` re-quotes the domain server-side (gets ₱720, confirms available) and freezes: `listPricePHP: 4999, salePricePHP: 2500, discountPct: 50, introSale: false, domainCostPHP: 720, amount: 3220`. The owner's payment email itemizes *"Website ~~₱4,999~~ ₱2,500 (50% off) + custom domain alingnena.com ₱720 = **₱3,220 total**"*. The Wise webhook later matches ₱3,220 → `paid` → Maria's `balance` += ₱1,250 (50% of ₱2,500 only — **nothing from the ₱720 domain**).

---

## Phase 3 — Creator earnings model

**Goal:** creators earn more when they charge more — kept as simple as possible.

> **Decided with client (Slack, 2026-06-13):** "Let's simplify it." The model is a **flat 50% revenue split** — the creator keeps half of the website sale price, the platform keeps half. No base payout, no floor carve-out, no separate video/audio rates. One sentence a creator can repeat: **"You keep half of every sale."**

### 3.0 Why flat-50% (and why it's safe)

Today the creator earns a **flat** `creatorPayout` (₱500 video / ₱300 audio, defaulted in `convex/submissions.ts:243`), regardless of what the business pays. Under Phase 2 the creator chooses the price, so payout must become a function of that price — otherwise they'd always sell at the floor.

The client chose the simplest function: `creatorPayout = 0.5 × salePricePHP`. The key thing that makes "simplify" safe rather than a pay cut:

> **50% of the ₱999 intro price = ₱500 — exactly today's video base.** So switching to flat-50% does not reduce intro-sale pay for video creators; it matches it. Audio creators effectively get a small raise (₱300 → ₱500 at intro), which the client accepted as part of simplifying.

### 3.1 The model

```
creatorPayout = commissionRate × salePricePHP        (commissionRate = 0.5, in pricingConfig)
platformKeeps = salePricePHP − creatorPayout
// custom-domain add-on is NOT part of salePricePHP — see 3.2
```

| Business pays (sale price) | Discount pitch | **Creator earns (50%)** | **Platform keeps (50%)** |
|---|---|---|---|
| ₱999 (intro / first 5) | "80% off!" | **₱500** | ~₱500 |
| ₱1,999 | "60% off!" | **₱1,000** | ₱999 |
| ₱2,500 | "50% off!" | **₱1,250** | ₱1,250 |
| ₱3,999 | "20% off!" | **₱2,000** | ₱1,999 |
| ₱4,999 (full anchor) | no discount | **₱2,500** | ₱2,499 |

Properties:

- **Same rule for video and audio.** `commissionRate` is one number; format no longer affects pay. (See 3.4 — the video preference moves to policy, not money.)
- **Intro sales pay 50% too** — the client confirmed the first-5 thin margin is an accepted **launch loss-leader** (customer-acquisition cost), not a profit center. At ₱999 split 50/50 the platform's ~₱500 must still cover Convex + Groq transcription + Cloudflare/R2 hosting + the Wise payout fee, so per-site margin on intro sales is near break-even by design.
- **Incentive is aligned and obvious:** every peso the creator adds to the price, they keep half. Pushing ₱999 → ₱4,999 multiplies their pay 5×.

### 3.2 Custom domain is a cost-recovery service — zero commission, never part of the anchor

> **Decided with client (Slack 2026-06-13):** *"The domain is different; no commission from it. The domain is not on us. It's something we can do for them — either we do it for free, or they pay more, but it's not that we earn more."*

Two consequences, both now locked:

1. **The creator earns ₱0 from the domain** — not ₱500, not 50%. The split applies to `salePricePHP` only.
2. **The domain is always a separate add-on on top of the sale price — never folded into the ₱4,999 anchor.** A ₱4,999 sale with a custom domain costing ₱720 bills the business ₱5,719 total; the creator's commission is still 50% of ₱4,999 = ₱2,500. The anchor price never silently "includes" a domain.

```
salePricePHP  = 999–4999                          // creator's choice; the ONLY commission base
domainAddOn   = wantsCustomDomain ? domainCostPHP : 0  // the domain's REAL registrar price (see 2.3)
amount        = salePricePHP + domainAddOn         // what the business pays
creatorPayout = 0.5 × salePricePHP                 // domain never enters this
```

The add-on is the domain's actual registrar cost (`domainCostPHP`, extracted at submit time per 2.3) — a service provided at cost, not margin for the creator *or* the platform. Without this rule a creator would pocket half of your domain cost and the platform would lose money on every domain sale.

### 3.3 When the money moves (the critical timing change)

Today's flow credits `creatorPayout` to `balance` after **approval** (`convex/submissions.ts:527-546`). With variable pricing this is unsafe: approval ≠ payment, and an unpaid ₱4,999 link would have already paid the creator ₱2,500.

New rule: **payout credits on the `paid` transition** — when the Wise webhook (`convex/http.ts`) matches the deposit and flips `submissions.status` to `"paid"`:

```
Creator submits          → creatorPayout (= 0.5 × salePricePHP) computed & frozen on the submission
Admin approves           → payment email sent to owner; nothing credited yet
Owner pays (Wise webhook)→ status = "paid"
                           → balance += creatorPayout
                           → earnings row written
                           → paidSubmissionCount for the first-5 rule ticks here too
Creator withdraws        → existing /wallet + withdrawals.ts flow, untouched
```

Flag in `/training`: *"you get paid when the business pays, not when the site is approved."* This also closes an existing exposure where we could owe payouts on sites that never get paid for.

### 3.4 The video preference is now a policy lever, not a pay lever

Theo wants creators to default to **video** ("great for TikTok"), with audio as fallback. Because flat-50% pays video and audio identically, **money no longer nudges toward video** — so the nudge must come from policy/training instead:

- Default the submission flow to video; make audio an explicit "fallback" choice with a short reason prompt (noisy venue, owner declined camera).
- Surface video-vs-audio mix per creator on the admin dashboard so over-reliance on audio is visible.
- Teach the "video is your TikTok asset" framing in `/training`.

(If a financial nudge is later wanted, the cleanest option is a small per-submission **video bonus** outside the 50% split — left out of v1 to honor "simplify.")

### 3.5 Schema & code changes

`submissions` — one new field, computed in the `submit` mutation alongside Phase 2's price freeze:

```ts
// creatorPayout already exists. It now = 0.5 × salePricePHP (frozen), instead of the
// old ₱500/₱300 by-format constant. No new payout field needed — balance/withdrawal
// code downstream (withdrawals.ts, wallet totals) is untouched because the field
// keeps its name and meaning.
creatorPayoutRate: v.optional(v.number()),  // optional: snapshot the rate used (0.5), for auditability
```

The ₱500/₱300 by-format branching is **deleted** (this is the "simplify" win — less code, fewer fields).

Touch points:

| File | Change |
|---|---|
| `convex/submissions.ts` | `submit`: set `creatorPayout = round(rate × salePricePHP)` from the frozen price. Drop the ₱500/₱300 format branch. Move the balance credit from the approval/payout path to the `paid` transition. |
| `convex/http.ts` (Wise webhook) | On `paid`: credit `balance += creatorPayout`, write the earnings row, increment the creator's paid-submission count. |
| `convex/pricing.ts` (new) | `commissionRate` lives in `pricingConfig` so the split can change without a deploy. |
| `app/wallet/` + `/dashboard` | Show "Bakery ni Aling Nena — ₱1,250 (50% of ₱2,500), **pending payment** / paid". The pending-vs-available distinction matters now that crediting waits for payment. |
| `convex/schema.ts` | Optional `creatorPayoutRate`; no breaking changes. |

Backfill: existing submissions keep their current `creatorPayout` as-is (historical accuracy); only new submissions use the 50% rule.

### 3.6 Edge cases to handle

- **Race on the 5th submission:** two in flight at count = 4 — both may freeze as intro ₱999. Acceptable; count consistently at submit-time.
- **Price changed via `setDomainTier` after submit:** recompute `creatorPayout` whenever `salePricePHP` changes pre-payment; frozen once `paid`.
- **Underpayment/overpayment on Wise:** webhook already matches amounts; mismatches go to the existing manual-review path; payout credits only on a full match.
- **Rounding:** ₱999 × 0.5 = ₱499.50 → define a rounding rule (round to nearest peso → ₱500, which conveniently matches today's base). Apply consistently.
- **Refunds:** out of scope for v1; admin claws back via a negative earnings adjustment (admin-only, audit-logged).

### 3.7 Creator-facing education
- Update `/training` + `/for-creators`: the **first-5 rule**, the discount-selling playbook ("anchor at ₱4,999, close at whatever the business says yes to"), the "you keep half of every sale" earnings table, the "video is your TikTok asset" default, and the "paid when the business pays" timing.

---

### Phase 3 worked example (continuing Maria from Phase 2)

> Maria has 7 paid submissions (past the first 5, so the slider is unlocked). Her bakery submission froze at `salePricePHP: 2500` with a video interview. At submit time the mutation computes `creatorPayout = 0.5 × 2500 = 1250`, frozen on the submission. The bakery also wants the domain `alingnena.com`, re-quoted server-side at its real price `domainCostPHP: 720`, so `amount = 3220` — but the domain is **excluded** from the split, so Maria's payout stays ₱1,250 regardless of the domain price. Admin approves → owner gets the ₱3,220 itemized payment email → nothing credited yet; Maria's wallet shows ₱1,250 **pending**. Three days later the owner pays via Wise → webhook matches ₱3,220 → status `paid` → Maria's `balance` += ₱1,250, earnings row written, wallet shows "Bakery — ₱1,250 (50% of ₱2,500)". She withdraws instantly. The platform kept ₱1,250 on the website; the ₱720 domain is pure cost-recovery (the registrar gets it).

---

## Mobile impact

Context: the creator mobile app (Google Play APK) lives in a **separate repo** but **shares the production Convex deployment** (`energetic-panther-693`) with this web repo. Per `MOBILE-FUNCTION-PARITY.md` / `ADMIN-SCHEMA-CHANGE.md`: web's `convex/` folder must remain a strict **superset** of every function the APK calls, schema changes here are live for mobile immediately, and `npx convex deploy --dry-run` must show an empty "functions to be deleted" list before any deploy.

### ⚠️ AS-BUILT pricing contract for the mobile team (READ THIS — supersedes §2.1/§2.2)

> **The Phase 2 design in §2.1–§2.2 (a `pricingConfig` table, `pricing.getCreatorPricing`, `salePricePHP`, `introSale`) was the *original plan*. The version that actually shipped (branch `feat/centralize-pricing-config`, merged 2026-06-15) is different.** Build the mobile UI against **this** contract, not the names in §2.1/§2.2.

**Where pricing lives:** `lib/pricing.ts` — plain exported constants + pure functions, the single source of truth. **No `pricingConfig` table, no admin pricing page** (not built; prices change by editing this file + deploying). Mobile should mirror these constants OR (preferred) read bounds from the query below so it never hardcodes them:

```
BASE_PRICE       = 999     PRICE_CEILING      = 4999
UNLOCK_THRESHOLD = 5       COMMISSION_RATE    = 0.5
CUSTOM_DOMAIN_ADDON = 500  (flat fallback only)
```

**Shared Convex functions the mobile app calls:**

| Function | Kind | Use |
|---|---|---|
| `submissions.getPricingContext({ creatorId })` | query | Returns `{ approvedCount, priceCeiling, unlocked, threshold, basePrice }`. Drives the slider: show it only when `unlocked` (i.e. `priceCeiling > basePrice`), with range `basePrice … priceCeiling`. |
| `submissions.setDomainTier({ id, submissionType, requestedDomain?, sellPrice?, domainPricePHP? })` | mutation | Freezes pricing on the submission. `sellPrice` = creator's slider value (clamped server-side to `[BASE_PRICE, priceCeiling]`). `domainPricePHP` = the **real registrar price** from the domain check (frozen to `domainCostPHP`); omit for the standard tier. |
| `submissions.submit({ id })` | mutation | Unchanged. |

**Key naming/behavior differences from §2.1–§2.2 (what to change in a stale mobile build):**
- Submit arg is **`sellPrice`**, not `salePricePHP`.
- Bounds come from **`getPricingContext`**, not `getCreatorPricing`.
- Unlock is based on **`approvedCount`** (approved-or-later submissions) and the creator's stored **`priceCeiling`**, not a live count of `paid` submissions. An admin can also unlock early via the creator's `priceUnlockedAt`/`tierChangedBy` fields.
- The submission stores **`amount`** (owner total) + **`creatorPayout`** (= `commissionFor(sellPrice)` = 50%) + **`domainCostPHP`** (frozen real domain price). There is **no** `salePricePHP`/`listPricePHP`/`introSale` field — derive sell price as `amount − domainCostPHP` if needed.

**Owner total math (use `lib/pricing.ts` helpers, don't re-derive):**
```
domainAddOn = domainAddOnFor(tier, domainPricePHP)   // real price if provided, else flat ₱500, 0 for standard
ownerTotal  = sellPrice + domainAddOn                 // what the business pays
creatorPayout = commissionFor(sellPrice)              // 50% of sellPrice ONLY — domain excluded
```

**Custom domain:** charge the **real registrar price** (from the domain-availability check), not a flat ₱500. The flat `CUSTOM_DOMAIN_ADDON` is only a fallback when no real price is available. The domain is a registrar pass-through — **never** part of the 50% commission.

**Earnings timing (Phase 3):** `creatorPayout` is frozen at submit and credited to the creator's balance on the existing **paid** transition (`payments.creditCreatorForPayment`), not at approval — already shared, so mobile gets it automatically with no APK change.


| Phase | Mobile change needed? | Detail |
|---|---|---|
| **Phase 1 — owner portal (incl. magic-link auth, admin support chat)** | **None for v1** | The mobile app is creator-facing; business owners use the web portal, which works fine in a phone browser — magic links open in the browser, and the editor + chat sidebar are responsive web UI. The admin side of support chat lives in the existing **web** admin dashboard, not the APK. New tables (`businessOwners`, `websiteOwnerships`, `supportThreads`, `supportMessages`) are additive schema — invisible to the existing APK. A native owner app can be a later decision. |
| **Phase 2 — pricing (incl. price-setting slider)** | **Yes — the slider is a REQUIRED co-launch deliverable on mobile, not a deferred follow-up** | Build against the **AS-BUILT contract above**, not §2.1/§2.2. The slider ships on the native mobile creator app at the same time as web. Mobile reads bounds from `submissions.getPricingContext({ creatorId })` (show the slider only when `unlocked`; range `basePrice … priceCeiling`) and submits the chosen value as **`sellPrice`** plus the real **`domainPricePHP`** via `submissions.setDomainTier`. The mutation re-clamps `sellPrice` to `[BASE_PRICE, priceCeiling]` server-side, so the slider is convenience only. **Old-APK fallback:** an APK shipped before this release won't send `sellPrice`; `setDomainTier` defaults a missing value to `BASE_PRICE` (₱999), so stale apps degrade safely to the floor instead of breaking. Push the new APK promptly so the gap is short. |
| **Phase 3 — earnings** | **Server change is shared automatically; APK update only for the nicer display** | The flat-50% payout is computed in shared Convex mutations, so mobile creators get correct payouts from day one with **zero APK change** — the existing wallet reads `balance`/`creatorPayout`, which keep their meaning. The timing change (credit on `paid`, not approval) also applies to mobile automatically; the APK's wallet just shows the credit later. A follow-up APK release adds the "50% of ₱X" framing and a "pending until business pays" label. |

Deploy discipline for every phase: additive-only schema, never rename/delete a function mobile calls, loose validators for fields mobile sends as strings (the `audioStorageId` lesson), and the dry-run checklist before `npx convex deploy`.

---

## Phase 4 — Landing page: localization (EN/Tagalog), "formerly" label, remove region dropdown

Three related landing-page changes. None depend on Phases 1–3; this is an independent workstream.

### 4.0 Current state (what's already there)

- **No i18n framework.** Every landing component hardcodes its copy in a local object — e.g. `HeroSection.tsx:52` `const T = { hero_main, hero_lede, ... }`. Same pattern in `BusinessPricingSection`, `EarningsSection`, `Footer`, the door buttons, etc.
- **A language dropdown already exists** in `components/landing/Navbar.tsx:61-69` (EN / Tagalog) wired to an `onLangChange` callback — **but the `lang` value is consumed by nothing.** It's currently decorative: switching it changes a prop that no copy reads. The real work is making `lang` actually drive the strings.
- **A country dropdown exists** in `Navbar.tsx:71-82` (PH / ID / MX / VN) — this is the "region dropdown" to remove.

### 4.1 "Formerly known as Negosyo Digital" label (small)

In the hero, below the italic subtitle line (`HeroSection.tsx:174`, `T.hero_main_em`), add a small muted label: **"formerly Negosyo Digital."**

- Style: `.label`/`.meta` class, `var(--neo-ink-3)`, small, understated — a continuity nod, not a headline.
- It's a translatable string too (see 4.2), though the brand names stay verbatim in both languages.
- Aligns with `TENDSO-REBRAND.md`: surfaces may acknowledge the old name for recognition; the Wise *payee* name is a separate legal matter and unaffected.

### 4.2 Full landing localization — EN + Tagalog

> **Decided:** the switcher genuinely re-renders the whole landing page in the chosen language, not just the hero.

Because the landing is static marketing (no per-request data), a heavy library like `next-intl` is overkill. Use a **lightweight language context**:

1. **`components/landing/translations.ts`** — one file, both languages:
   ```ts
   export const LANDING_COPY = {
     en: { hero_main: [...], hero_lede: "...", door_business: "I own a business", /* ...every landing string... */ },
     tl: { hero_main: [...], hero_lede: "...", door_business: "May negosyo ako",   /* ...Tagalog... */ },
   } as const
   export type Lang = keyof typeof LANDING_COPY
   ```
2. **`LanguageProvider` + `useT()` hook** (React context). `useT()` returns the active language's copy object. Persist the choice in `localStorage` (and read it on mount) so it survives navigation/reload. Default `en`.
3. **Extract every landing component's hardcoded `const T` into `translations.ts`**, then have each component read via `useT()` instead of its local object. This is the bulk of the effort — mechanical but touches every landing component: `HeroSection`, `BusinessPricingSection`, `EarningsSection`, `Footer`, `Navbar`, the door buttons, and the for-business/for-creators page copy.
4. **Wire the existing Navbar dropdown** (`onLangChange`) to set the context language. The dropdown is already there — it just needs to actually do something.
5. **Tagalog copy pass.** Write natural Tagalog (Taglish where natural — that's how the audience actually speaks), not a literal machine translation. Keep brand terms ("Tendso", "Negosyo Digital", "₱", section eyebrows) verbatim. This needs a human/native review before launch — flag for the client.

Scope note: localize the **public landing surface** (`/`, `/for-business`, `/for-creators`, shared landing components). The authenticated app (dashboard, submit flow, wallet, admin) is **out of scope for v1** — those are functional screens used by trained creators and can stay English until there's demand. Say so explicitly so "the language switcher" isn't expected to flip the whole app.

### 4.3 Remove the region dropdown

- Delete the country `<select>` in `Navbar.tsx:71-82` and its `country`/`onCountryChange` props (and any parent state feeding them).
- Keep the **"Live in Philippines · expanding"** label (`Navbar.tsx:53-56`) — it already states the region in copy, which is all that's needed for "PH only for now."
- No geo-blocking, no IP detection — just remove the picker, per the decision. If international expansion returns later, the dropdown can come back.
- Leave currency as ₱ PHP throughout (already the case).

### 4.4 Effort & sequencing
- 4.1 (label) and 4.3 (remove dropdown): trivial, minutes each.
- 4.2 (localization): the real work — one new file + provider, then a mechanical sweep of every landing component, then the Tagalog copywriting + native review. The framework is small; the translation/QA is the long pole.
- Independent of Phases 0–3. Can ship in parallel. Suggested slice: P4a label + remove dropdown (tiny, ship immediately) → P4b localization framework + extraction → P4c Tagalog copy + native review.

---

## Mobile rebrand — app name & icon

The web rebrand (`TENDSO-REBRAND.md`) is complete, but it could only touch web surfaces. The **native creator app** (Google Play APK, separate repo) still ships with the old launcher name and icon. This finishes the Negosyo Digital → Tendso rebrand on the one surface the web work couldn't reach.

**Scope:**

| Item | From | To |
|---|---|---|
| Launcher / display name | "Negosyo Digital" (or "Negosyo") | **"Tendso"** (one word, no "Digital" suffix) |
| App launcher icon | old square mark | **`tendso-icon.png`** — split-O glyph, white on charcoal `#1B1C24` rounded tile, 512×512 |
| Splash / in-app wordmark | old logo | **`tendso-logo.png`** — white "TENDSO" wordmark, transparent bg |
| APK artifact name | `Negosyo-Digital.apk` | `Tendso.apk` |
| HTTP User-Agent (if any) | `NegosyoDigital/1.0` | `Tendso/1.0` |

**Where these live in a typical RN/Expo app** (confirm against the actual mobile repo — paths below are the usual suspects):

- **Display name:** `app.json`/`app.config.js` `expo.name`, plus `android/app/src/main/res/values/strings.xml` `app_name` and `ios` `CFBundleDisplayName` (`Info.plist`). Expo `name` drives both on a managed build.
- **Icon:** `expo.icon` / `expo.android.adaptiveIcon` (foreground = the glyph, background = `#1B1C24`) and `expo.ios.icon`; generate the Android mipmap densities + iOS asset catalog from the 512×512 source. Use `tendso-icon.png` — never stretch the wide wordmark into a square slot.
- **Splash:** `expo.splash` → point at the wordmark/icon assets.

**Hard constraints (do NOT touch — these break production):**

- **Android `applicationId` / package name and iOS bundle ID stay exactly as they are.** Changing the package = a brand-new app on the Play Store (loses existing installs, reviews, ratings, and breaks the update path for current users). This is a *display* rebrand only — name and icon, not identity.
- **Convex deployment slug, project name, and any `com.negosyo*` internal identifiers stay** — same reasoning as the web rebrand (renaming the Convex project breaks the prod DB). The user never sees these.
- **Wise payee name stays "Negosyo Digital"** until the Wise account itself is legally renamed — matches the web rule in `TENDSO-REBRAND.md`.

**Release path:** this is a user-facing binary change, so it requires an **APK rebuild + new Play Store release** (updated store listing name, icon, screenshots) — not just a server deploy. Best bundled with the **Phase 2 APK update** (the price-slider release) so creators get one combined update rather than two. iOS/TestFlight equivalent if an iOS build exists.

**Checklist:**
- [ ] `expo.name` / `app_name` / `CFBundleDisplayName` → "Tendso"
- [ ] Launcher icon (all Android mipmap densities + iOS asset catalog) from `tendso-icon.png`; adaptive-icon background `#1B1C24`
- [ ] Splash + in-app wordmark → `tendso-logo.png`
- [ ] APK output filename → `Tendso.apk`; User-Agent → `Tendso/1.0`
- [ ] `applicationId` / bundle ID / package name **unchanged** — verify before release
- [ ] Play Store listing: name, icon, feature graphic, screenshots updated
- [ ] Grep mobile repo for `Negosyo|negosyo` — only allowed survivors are the package/bundle ID and the Wise payee name

---

## Sequencing & dependencies

```
Phase 0 (audit)            ~ runs first, independent
Phase 1 (owner portal)     ~ independent of 2/3, highest security value → ship first
Phase 2 (pricing engine)   ~ prerequisite for Phase 3
Phase 3 (earnings)         ~ depends on Phase 2's salePricePHP
Phase 4 (localization)     ~ fully independent; can ship in parallel anytime
```

Suggested PR slicing: P0 audit fixes → P1a schema + claim flow + magic-link auth → P1b portal + visual sandbox → P1c admin support chat (sidebar + `/admin/support` queue) → P2a pricing config + `getCreatorPricing` query → P2b web submit flow + slider → P2c **mobile submit flow + slider (co-launch with P2b)** → P2d admin `/admin/pricing` settings page + per-creator pricing view on `/admin/creators` → P2e marketing + landing-page rework → P3 flat-50% payout + wallet.

(P1a+P1b alone already close the security hole; P1c adds the human help channel. P2b and P2c ship together — the slider is required on both platforms at launch. P2d is small and can land any time after P2a since the config table already exists.)

---

## Decisions log (resolved with client)

- **Commission shape** — ✅ **RESOLVED (Slack 2026-06-13):** flat **50% of the website sale price**, no base payout, same for video and audio. "Let's simplify it."
- **Intro threshold** — ✅ **RESOLVED (Slack 2026-06-13):** lowered from 10 → **5** submissions locked at ₱999.
- **Video vs audio earnings** — ✅ **RESOLVED:** identical pay; "make all video, audio as fallback" — the video preference is a **policy/training lever** (3.4), not a pay difference.
- **Intro economics** — ✅ **RESOLVED:** 50% applies even to ₱999 intro sales; the thin first-5 margin is an accepted **launch loss-leader**.
- **Custom domain** — ✅ **RESOLVED (Slack 2026-06-13):** zero commission for the creator, separate add-on never folded into the ₱4,999 anchor, treated as cost-recovery for both parties (Theo: "no commission from it… it's not that we earn more"). See 3.2.

## Open questions for stakeholder

1. **Owner edits: instant publish or admin-reviewed?** Instant is the better product; review queue is safer at launch. Recommend instant with audit log + rate limit, revisit if abused.
2. **"ODR campaign"** — assumed to mean the ₱999 launch promo; confirm what ODR stands for and whether the intro price is time-boxed or per-creator (first 5) only. The plan implements per-creator-first-5.
3. **Existing ₱1,000 price** — transcript says ₱999; confirm we change the live base price to ₱999.
4. **Rounding on intro** — ₱999 × 50% = ₱499.50; plan rounds to ₱500. Confirm that's fine (it matches today's video base).
5. **Who can change pricing settings** — ✅ **RESOLVED:** all admins may change pricing. The `/admin/pricing` page (2.2b) is gated to the existing admin role; no separate super-admin tier. Every change is audit-logged (who + old → new) for accountability.
