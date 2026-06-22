# Creator payout display + pricing-unlock copy

**Date:** 2026-06-19
**Audience:** the mobile agent (separate `Tendso` mobile repo).
**Web status:** both items **DONE on web** (PR #225) — referenced here as the implementation to mirror.

Two display fixes. No backend/schema changes — the data already exists on the shared Convex backend; these are display/UX only.

---

## 1. Payout display — use the frozen `creatorPayout` (NOT ₱500/₱300)

### The bug
The old model paid a flat **₱500 video / ₱300 audio**. That's **abolished** — the live model is **50% of the creator's sale price** (the "sell price," ₱999→₱4,999). Any screen still showing ₱500/₱300 by interview type is wrong: audio and video earn the **same** now, and the number scales with the sale price.

### Where the truth lives
Every submission freezes its payout at submit time: `submissions.creatorPayout` = `commissionFor(salePrice)` = `round(0.5 × salePrice)`. It's set server-side in `setDomainTier`/`submit` (shared Convex — mobile calls the same mutations). **The correct value is already on the submission record — just read it.** Never recompute by interview type.

### Web fix (DONE — PR #225, reference implementation)
`app/submit/success/page.tsx`:
```ts
// BEFORE (wrong): const payout = hasVideo ? 500 : (hasAudio ? 300 : null)
// AFTER:
import { commissionFor, BASE_PRICE, formatPHP } from "@/lib/pricing"
const payout = submission?.creatorPayout ?? commissionFor(BASE_PRICE)
// display: {formatPHP(payout)}
```
`commissionFor(BASE_PRICE)` (= ₱500) is only a fallback for legacy rows with no frozen payout.

### Mobile fix (TODO — same bug almost certainly present on the submit-success screen)
The mobile submit-success / confirmation screen almost certainly has the same hardcoded ₱500/₱300. Change it to read the submission's `creatorPayout` from Convex (already returned by `submissions.getById` / the submission query the app uses).
- If the app computes payout client-side by interview type → **delete that logic**, read `creatorPayout`.
- If `creatorPayout` is null on a freshly-created draft (before `setDomainTier` runs), fall back to `round(0.5 × 999) = 500`.
- Audio and video must show the **same** rate. Remove any "video pays more" copy.
- The mobile **wallet / earnings** screens should likewise show `creatorPayout` per submission, not a flat rate.

---

## 2. Pricing-unlock copy — state the creator pricing mechanic

The rule, from `lib/pricing.ts` (single source of truth — mirror these constants on mobile, don't hardcode duplicates):
```
BASE_PRICE       = 999     // every creator starts selling here
PRICE_CEILING    = 4999    // max once unlocked
UNLOCK_THRESHOLD = 5       // approved submissions needed to unlock price-setting
COMMISSION_RATE  = 0.5     // creator keeps 50% of the sell price
```

**The creator-facing message (use everywhere pricing/earnings is explained):**
> Start at **₱999** per site (you keep **₱500**). After your first **5 successful submissions** you unlock price-setting — charge anywhere up to **₱4,999** and still keep **50%** (up to **₱2,500** per site). The more you charge, the more you earn.

### Web (DONE — PR #225)
- `components/landing/CreatorEarningFlow.tsx` — the "You get paid" step states it.
- `components/landing/landingData.ts` — new creator FAQ "How much can I charge — and earn?"
- The **price slider** on `/submit/review` (already built) is where a *post-unlock* creator actually sets the price (₱999–₱4,999), with a live "you earn 50%" readout.

### Mobile (TODO)
- The mobile **submit/review screen** needs the same price slider for unlocked creators (already flagged as a required co-launch deliverable in `OWNER-PORTAL-PRICING-PLAN.md` → read bounds from `submissions.getPricingContext({ creatorId })`: `{ approvedCount, priceCeiling, unlocked, threshold, basePrice }`; submit the chosen value as `sellPrice` to `submissions.setDomainTier`). If not yet built, this is it.
- Any mobile onboarding/earnings copy that still says "₱500 video / ₱300 audio" → replace with the message above.
- Optional: show creators progress to unlock (e.g. "3 of 5 approved — unlock price-setting at 5").

---

## Summary

| Item | Web | Mobile |
|---|---|---|
| Payout = frozen 50% `creatorPayout`, not ₱500/₱300 | ✅ DONE (PR #225) | **TODO** — same fix on success + wallet screens |
| Audio = video rate (drop "video pays more") | ✅ DONE | **TODO** |
| Pricing-unlock copy (₱999 → 5 → ₱4,999) | ✅ DONE (PR #225) | **TODO** — copy + the price slider on review |
| Price slider on submit/review (unlocked creators) | ✅ exists | **TODO** if not built (`getPricingContext` → `sellPrice`) |

**No backend/schema changes** — `creatorPayout` and the pricing constants already exist and are returned by the shared Convex backend. Display/UX only.
