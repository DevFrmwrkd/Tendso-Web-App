# Production copy vs. current facts (read-only audit)

Facts checked against:
- **F1** Build takes about 20 minutes, same day (not 48-72h / 24h / days).
- **F2** Price is ₱4,999 once, or ₱500/month x 10 (not "one-time only", "no monthly", or ₱999 as the site price).
- **F3** "See it first. Pay once to publish." (pay comes before going live; not "pay once it's live", "already up", "live before you pay").
- **F4** Agents set any price from ₱999 to ₱4,999 and keep 50% (no unlock, no launch-price lock, no flat ₱500/₱300).

"(might)" = the copy depends on how the product actually behaves; it may or may not contradict.

| file:line | current text (short quote) | contradicts which fact | is it legal text? (terms/privacy) |
|---|---|---|---|
| components/landing/landingData.ts:111 | "Live in 48 hours, hosted with SSL" | F1 | No |
| components/landing/landingData.ts:129 | "Same 48-hour deployment" | F1 | No |
| components/landing/landingData.ts:375 | "Live in 48–72 hours from the interview." | F1 | No |
| components/landing/landingData.ts:380 | "₱999 for a standard site, ₱1,499 if you want a custom domain... One-time fee" | F2, F4 (₱999 presented as the site price) | No |
| components/landing/landingData.ts:397 | Tagalog: "Live sa loob ng 48–72 oras mula sa interview." | F1 | No |
| components/landing/landingData.ts:402 | Tagalog: "₱999 para sa standard na site... Isang bayad lang" | F2, F4 | No |
| components/landing/strings/landing.ts:17 | "Pay only when it's live." | F3 | No |
| components/landing/strings/landing.ts:19 | "live in 48–72 hours... You pay once, only after it's up and you're happy." | F1, F3 | No |
| components/landing/strings/landing.ts:23 | "Pay only when it's live" (proof chip) | F3 | No |
| components/landing/strings/landing.ts:24 | "Live in 48–72 hours" | F1 | No |
| components/landing/strings/landing.ts:38 | "Live in 48–72 hours from start to finish." | F1 | No |
| components/landing/strings/landing.ts:47 | "48–72 hours" (step 3 meta) | F1 | No |
| components/landing/strings/landing.ts:57 | "One price. Paid once, when it's live." | F2, F3 | No |
| components/landing/strings/landing.ts:59 | "One-time payment. No monthly fees... You only pay once your website is live" | F2, F3 | No |
| components/landing/strings/landing.ts:69 | "One-time · pay only when it's live" | F2, F3 | No |
| components/landing/strings/landing.ts:85 | "Live in 48–72 hours from the interview." | F1 | No |
| components/landing/strings/landing.ts:98 | "Most sites live within 48–72 hours. Pay only when you're happy with it." | F1, F3 (might) | No |
| components/landing/strings/landing.ts:125, 130, 144, 153, 191, 204 | Tagalog mirrors of the above: "live sa loob ng 48–72 oras"; "kapag nakalive na"; "Magbayad lang kapag masaya ka na" | F1, F3 (and F2 where "isang beses") | No |
| components/landing/strings/shared.ts:23 | "live in days, and paid for only once it's live." | F1, F3 | No |
| components/landing/strings/forCreators.ts:71 | "We build the site in 48–72 hours." | F1 | No |
| components/landing/strings/forCreators.ts:194 | Tagalog: "Gagawin namin ang site sa loob ng 48–72 oras." | F1 | No |
| components/landing-v2/LandingV2.tsx:315 | "Your site live before you pay" | F3 (might: reads as live before payment) | No |
| app/layout.tsx:19 | "your page goes live in 48–72 hours... ₱4,999 one-time" | F1; F2 (might: "one-time") | No |
| app/layout.tsx:27 | "Filipino local businesses get online in 48–72 hours. ... one-time." | F1; F2 (might) | No |
| app/layout.tsx:29 | Twitter description: "get online in 48–72 hours." | F1 | No |
| app/start/layout.tsx:18 | "within 48–72 hours. ... one-time, paid only when it's live." | F1, F2 (might), F3 | No |
| app/otr/layout.tsx:8 | "paid once after it is live. No monthly fees." | F3; F2 (might) | No |
| app/otr/page.tsx:112 | "email it to you within 48 to 72 hours." | F1 | No |
| app/otr/page.tsx:269 | "Paid once, after your website is live. No monthly fees." | F3; F2 (might) | No |
| app/otr/page.tsx:374 | "Paid once, after your website is live. Nothing to pay today, and no monthly..." | F3; F2 (might) | No |
| app/start/page.tsx:681 | "Nothing to pay now. You pay [total] after it is live." | F3 | No |
| app/start/_components/StepRail.tsx:57 | "We build the site first and email it to you. You only pay once it's live... one time." | F3; F2 (might) | No |
| app/start/_components/ReviewStep.tsx:269 | "You pay once, only after your site is live. Nothing to pay now." | F3; F2 (might) | No |
| app/start/_components/ReviewStep.tsx:352 | "48–72 hours, with how to pay [total]." | F1 | No |
| app/start/thanks/page.tsx:100 | "within 48–72 hours with your site and [how to pay]." | F1 | No |
| app/start/thanks/page.tsx:128 | "When you pay: Once, only after your site is live" | F3; F2 (might) | No |
| app/start/thanks/page.tsx:135 | "The next 48–72 hours" | F1 | No |
| app/submit/success/page.tsx:147 | "Usually 48–72 hours. Nothing more is needed from [business]." | F1 | No |
| app/knowledge/_components/creatorFaq.ts:55 | "Your submission enters review (24–48 hours)." | F1 (might: a review gate before the build) | No |
| app/pay/[token]/_components/PayViews.tsx:292 | "Your site is already up. Pay once to keep it." | F3 (site is live before pay) | No |
| app/pay/[token]/_components/PayViews.tsx:304 | "One time. No monthly fee." | F2 | No |
| app/pay/[token]/_components/PayViews.tsx:311 | Label: "Website, paid once" | F2 (might) | No |
| app/pay/[token]/_components/PayViews.tsx:494 | Receipt: "[name] website, one-time" | F2 (might) | No |
| app/my-business/_components/OwnerHome.tsx:162 | "You paid once, after your site went live." | F3 | No |
| app/submissions/_components/SubmissionDrawer.tsx:232 | "Once it's live, [owner] gets a pay link." | F3 (order reversed: live, then pay link) | No |
| app/submissions/_lib/derive.ts:236 | "once it's live and paid" (creator status) | F3 (might) | No |
| app/submit/review/page.tsx:519 | "agreed to pay [amount] once the site is live." | F3 | No |
| app/submit/_components/flow.ts:305 | "It is paid after the site is live." | F3 | No |
| app/admin/submissions/[id]/_components/DetailsPanel.tsx:120 | "paid after it's live" (staff UI) | F3 (internal, low) | No |
| app/terms-of-service/page.tsx:105 | "Your one-time payment covers building your website and putting it live." | F2 (might: ₱500 x 10 option) | **Yes** |
| apps/mobile/app/(app)/terms-of-service.tsx:72 | "Video interview submissions: ₱500 per approved submission. Audio-only: ₱300." | F4 (flat payout, not 50% of sale) | **Yes** |
| apps/mobile/app/(app)/submit/review.tsx:1333, 1349 | Title "Launch price locked"; "Your first 5 submissions are locked at the launch price." | F4 | No |
| apps/mobile/components/UnlockPricingBar.tsx:55, 77 (shown at apps/mobile/app/(app)/(tabs)/index.tsx:256) | "Pricing unlocked" / "Unlock higher pricing"; "N more approved submissions to set your own price up to ₱4,999" | F4 (no unlock since 2026-10-06) | No |
| apps/mobile/app/(app)/help-faq.tsx:123 | "At the ₱999 launch price: you earn ₱500." | F4 (might: "launch" implies temporary) | No |
| apps/mobile/app/(app)/submit/success.tsx:212 | "Our admin team will review your submission within 24 hours." | F1 (might) | No |
| convex/knowledgeSeed.ts:111 | "Within 48 hours your draft website is ready to review." | F1 | No |
| convex/knowledgeSeed.ts:117 | "A complete website is ₱999, one time. A custom domain is ... ₱500 add-on." | F2, F4 | No |
| convex/knowledgeSeed.ts:125 | "A Tendso website is a one-time payment of ₱999." | F2, F4 | No |
| convex/knowledgeSeed.ts:135 | "...that is a flat ₱500 add-on, bringing the total to ₱1,499." | F4 (might: ₱1,499 only at the ₱999 floor) | No |
| convex/knowledgeSeed.ts:136 | "There is no monthly subscription. You pay once, and the website is yours." | F2 (might: ₱500 x 10 option) | No |
| convex/knowledgeSeed.ts:186 | Summary: "ready to review within 48 hours of the interview" | F1 | No |
| convex/knowledgeSeed.ts:192 | Keywords: '48 hours', 'turnaround' | F1 | No |
| convex/knowledgeSeed.ts:198 | "Within 48 hours — your draft website is ready to review." | F1 | No |
| convex/knowledgeSeed.ts:216 | "...That brings your total to ₱1,499 for the website plus domain." | F4 (might) | No |
| convex/knowledgeSeed.ts:622 | "There is no subscription; it's a one-time ₱999." | F2, F4 | No |
| convex/knowledgeSeed.ts:629 | "a live site within 48 hours." | F1 | No |
| convex/knowledgeSeed.ts:653 | "with the site live in 48 hours." | F1 | No |
| convex/knowledgeSeed.ts:665 | "A complete website is a one-time ₱999. ... No subscriptions." | F2, F4 | No |
| convex/knowledgeSeed.ts:667 | "Your draft is usually ready within 48 hours of the interview, and goes live the moment you approve and pay." | F1 | No |
| lib/email/templates.ts:874 | "taken offline if payment is not received within 3 days... Complete your payment now to keep it live." | F3 (might: implies live before pay) | No |
| lib/email/templates.ts:1279 | "Your website is live, and it stays live once it is paid" | F3 | No |
| lib/email/templates.ts:1281 | "It's been live and waiting for you. Once we receive payment, your website stays live permanently" | F3 | No |
| lib/email/templates.ts:1343 | "One-time. No monthly fees. Website stays live forever." | F2 (might) | No |
| lib/email/templates.ts:1530–1531 | "Your Website Will Be Ready In: 48–72 hours" | F1 | No |
| lib/email/templates.ts:1555 | "Within 48–72 hours we email you the link to your finished website" | F1 | No |
| lib/email/templates.ts:1573 | "The price is ₱[amount], one time — no monthly fees... you only pay after you have seen your finished website." | F2 (might: "one time") | No |

## Not flagged, and why

- **Consistent with the facts (checked, left out):** `packages/shared/pricing.ts` (BASE 999, CEILING 4999, COMMISSION 0.5, custom domain 500; STANDARD_PRICE and CUSTOM_DOMAIN_PRICE are not used in rendered copy); the 50% commission lines; `app/terms-of-service/page.tsx:61` (50%, ₱999 min, ₱4,999 max); `components/landing-v2/LandingV2.tsx:116` and `app/v2/page.tsx:20` ("See it live before you pay"); `apps/mobile/app/(app)/submit/review.tsx:1321–1322` (goes live once the owner pays).
- **Not build time, so out of scope:** creator account review "Usually within 24 hours" (`app/pending/page.tsx:143`, `app/training/_funnel/rail.ts:34`, `apps/mobile/app/(app)/pending-review.tsx:554`); payout timing "48 hours" (`convex/knowledgeSeed.ts:453, 674`, `components/landing/landingData.ts:366, 409`, Tagalog 388); Wise transfer "1–2 business days" (`lib/email/templates.ts:1116`).
- **Excluded from scan:** root `templates/` and `public/template-previews/` (demo sites for unrelated businesses; their hits are opening hours or generic "monthly" styling); CSS, tests, generated files, binaries.
- **Code comments with stale facts (not user-facing, not in table):** `lib/email/service.ts:169` ("48-72h away"); `lib/email/templates.ts:1460`; `lib/creatorReminders.ts:4` and `convex/creatorReminders.ts:12` ("an unpaid site stays live" for 3 days).

## Product question this raises

The code publishes the site before payment: the `pending_payment` state, the "live and waiting" email at `lib/email/templates.ts:1281`, and the 3-day unpaid-live window (`app/pay/[token]/_components/PayViews.tsx:61`, `lib/creatorReminders.ts:4`). The copy "Pay only when it's live" and "Your site is already up" assumes that. The new "See it first. Pay once to publish." fact implies a preview that is not public until payment. Either the copy or the flow has to change. The copy alone will not fix it.
