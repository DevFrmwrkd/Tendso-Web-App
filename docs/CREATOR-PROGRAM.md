# Creator program: earnings structure

Written 2026-10-21. All amounts in ₱. Code constants live in `packages/shared/pricing.ts`.

> **Decided (Theo, 2026-10-21):**
> - **Override:** 5% of each sale by a recruited field agent, for 12 months, one level.
> - **₱1,000 bonus:** replaced by the override for new recruits; referrals already pending keep it.
> - **No self-referral:** an owner never earns on their own site.
> - **Gateway:** Xendit for GCash, Maya and card.
> - **People cost:** ₱150 stays a placeholder until there is a real number.
>
> The recommendation below is what was approved.

## Words

| Customer-facing name | Who | Role in code today |
|---|---|---|
| **Field agent** | Visits shops, records the interview and photos, sets the price, keeps 50% | `creators.role = "creator"` (or empty) |
| **Creator** | Promotes Tendso online, has a link and a code, never visits shops | `creators.role = "affiliate"`, page `/a/<handle>` |

The code calls field agents "creators". We keep the code roles and change only the labels people see. Otherwise the database would need a risky rename.

## The two ways a creator earns

1. **Sell to shops (now money).** The creator shares their code (default 30% off). The shop pays ₱3,499 instead of ₱4,999, and the creator keeps 50% = **₱1,750 per shop**. The creator can lower the price further, down to ₱999. This is how affiliates already work (`affiliates.ts`, 50% commission).
2. **Recruit field agents (monthly money).** Every field agent who joins through the creator's link earns the creator a cut of **each sale that agent makes**. It runs for 12 months from the day the agent joins. No sale means no payout. Nobody earns on sign-ups.

## What one sale leaves Tendso

Assumptions to check: payment fees about 3% (GCash/Maya/card through a gateway; Wise is cheaper). AI, transcription and hosting about ₱60 (≈ $1). People (review, support, design) about **₱150 per site**, which is a placeholder.

| Sale price | Seller 50% | Fees 3% | AI ₱60 + people ₱150 | **Tendso before override** | − 2.5% override | − 5% override |
|---|---|---|---|---|---|---|
| ₱999 | 500 | 30 | 210 | **259** | 234 | 209 |
| ₱2,999 | 1,500 | 90 | 210 | **1,199** | 1,124 | 1,049 |
| ₱3,499 (30% code) | 1,750 | 105 | 210 | **1,434** | 1,347 | 1,259 |
| ₱4,999 | 2,500 | 150 | 210 | **2,139** | 2,014 | 1,889 |

Even at the ₱999 floor with a 5% override, Tendso stays positive.

## "An army of 100 field agents": monthly income for the creator

Average sale ₱2,999, so 2.5% = ₱75 and 5% = ₱150 per sale.

| Scenario | Active agents of 100 | Sales each / month | Sales / month | At 2.5% | At 5% |
|---|---|---|---|---|---|
| Slow | 25 | 2 | 50 | ₱3,750 | ₱7,500 |
| Steady | 50 | 4 | 200 | ₱15,000 | ₱30,000 |
| Strong | 80 | 8 | 640 | ₱48,000 | ₱96,000 |

Compare: a creator who sells 10 shops a month directly earns ₱17,500.

## Recommendation

- **5% of each sale by a recruited field agent, for 12 months from the day that agent joins.** At 2.5%, a steady army of 100 pays ₱15,000/month. That is less than selling 9 shops yourself, so few creators would bother building one. At 5% it is ₱30,000/month, which is the "steady monthly income" story. Tendso still keeps about ₱1,049 on a ₱2,999 sale. The 12-month cap keeps creators recruiting.
- **One level only.** Nobody earns on their recruit's recruits.
- **Paid on real sales only, when the shop has paid in full.** No joining fee, nothing paid for sign-ups. This keeps it a clear referral program and not a pyramid. (In the Philippines pyramid schemes are illegal, so the Terms must say this. It needs a lawyer's eye; this is not legal advice.)
- **Show it in pesos, not percent**, in the portal: "Sell to a shop: ₱1,750 now. Each sale by your agents: ₱150, for a year."

## Two things that cost money today (please decide)

1. **The ₱1,000 referral bonus** (`REFERRAL_BONUS`, paid on a recruit's first paid sale) loses money when that sale is ₱999. Tendso keeps about ₱259, so it is out ₱741. Recommendation: the 5% override replaces the ₱1,000 bonus for new recruits, and referrals already pending keep their ₱1,000.
2. **Down payments with full commission upfront.** On a ₱2,999 sale with ₱500 down, Tendso pays the agent ₱1,500, so it is about ₱1,200 out of pocket until the shop pays the rest. If roughly half of the down-payment shops never pay, that group breaks even; above that it loses money. Recommendation: keep your rule (agents get everything upfront). Pay the creator's 5% only once the shop has paid in full, and watch the default rate for the first three months.

## Tracking who came from which creator

- **Two links per creator:** `tendso.com/a/<handle>` for shops ("With Mika, you save ₱1,500") and `tendso.com/a/<handle>/earn` for job seekers. Every click is stored, with a cookie on the web.
- **Android:** the Play Store link carries the creator's handle. The app reads it on first open (`expo-application` → `getInstallReferrerAsync`), which is free and reliable.
- **iOS:** Apple passes nothing through the App Store. On first open, we match a recent click from the same network and ask once: "Did Mika send you? Yes / No". The person always confirms, so nothing is attributed by mistake. Paid tools (Branch, AppsFlyer) can come later if this leaks too much.
- **Always a fallback:** a "Who sent you?" code field at sign-up (agents) and at checkout (owners). It is pre-filled when we already know the creator.
- **Owner checkout:** the code is applied automatically when we know it, and shown as "Mika's code: you save ₱1,500".

## Why would a field agent join through a creator?

Saving money does not apply to them. Ideas, none of which cost Tendso money:

- **Join Mika's team.** The creator becomes their coach: a team chat (a Discord channel per creator) and tips from someone they already follow.
- **Priority review.** Verification goes to the front of the queue.
- **The creator's own starter kit.** Their scripts, their best shops, their pitch video.

## New front-facing pages and screens (not in the mock yet)

1. `/creators`: the creator program page, with a "now vs monthly" calculator. The mock's `pages/creators.html` is the **field-agent** page and becomes `/field-agents`.
2. Creator sign-up (web + app).
3. Creator portal: the two income streams side by side, links and codes, recruited agents and their sales, payouts.
4. `/a/<handle>`: the shop explainer with the creator's face and saving. It sends people to the app, with the code applied.
5. `/a/<handle>/earn`: the field-agent explainer ("Join Mika's team"). It sends people to the app, attributed.
6. App: a "Who sent you?" field at agent sign-up, the code at owner checkout, and first-open attribution.

The admin side (approving creators, creating links) already exists and is not redesigned.
