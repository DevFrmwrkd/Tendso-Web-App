# Questions for Theo: Tendso redesign (Phase 0)

The ❓ rows from `docs/FEATURES.md`, merged with the open decisions in IMPLEMENTATION-HANDOFF §10 and the contradictions found in the mock and the code. Each one has a recommended default where one is obvious; reply "default" to accept it.

**Answer first.** Phase 1 is blocked by Q1, Q2, Q3, Q4, Q12, Q13. Phase 2 is blocked by Q5–Q8, Q14, Q22–Q25, Q30, Q31, Q34, Q35.

## Decisions (Theo, 2026-10-21)

- **Scope:** only the front-facing parts are rebuilt: landing, app, and the creator, field-agent and owner pages. Admin and backend stay as they are, except for the backend needed by new front-facing features.
- **Q1 pay timing (field-agent sales):** the site is published first. The owner says yes, then pays, and the site stays live; without payment it is taken down. No arguing: an owner who isn't happy doesn't pay. *Still open: does the same hold for owners who do it themselves in the app?*
- **Q2 instalments:** a down payment instead of fixed ₱500 × 10. The minimum is ₱500 and the amount depends on the agent's price. The agent gets their whole cut upfront; Tendso collects the rest from the shop. Payouts go to people directly once the owner pays.
- **Q3 payment method:** Wise today. GCash, Maya and card are built into the app (*gateway still to pick, e.g. PayMongo or Xendit*).
- **Q4 updates:** yes, in-app over-the-air updates. *Crash reporting not answered.*
- **Q12 sign-in:** Clerk, email only (a code by email, no SMS because of the cost). Phone sign-in maybe later.
- **Q13 agent-made sites:** use the recommendation: invite the owner to sign in, and retire the claim token.
- **Q8 naming:** "field agent" (visits shops) and "creator" (promotes online) are two different people. In code, field agents are role `creator` and creators are role `affiliate`; only the labels change.
- **Creator override (Theo, 2026-10-21, round 2):** 5% of each sale by a recruited field agent, for 12 months, one level. It replaces the ₱1,000 referral bonus for new recruits; referrals already pending keep their ₱1,000.
- **No self-referral:** an owner never gets a cut on their own site, and nobody can be owner and agent/creator on the same sale.
- **Owners who do it themselves (assumed, not yet confirmed):** private preview in the app → pay → published ("See it first. Pay once to publish.").
- **People cost per site:** no real figure yet; ₱150 stays as a labelled placeholder.
- **Payment gateway:** Xendit (covers GCash, Maya and card). No Xendit code exists yet.
- **Crash reporting:** yes, Sentry (DSN from env; Theo creates the Sentry project).
- **Round 3 (Theo, 2026-10-21):** "all looking good, do it end to end". The recommended defaults are taken for the remaining open questions unless he overrides them. Pablo reviews and merges. Specifically:
  - Keep `<shop>.sites.tendso.com`.
  - The price comparison tile has no numbers until real figures exist.
  - The "Hire an agent" form goes to admin Leads.
  - Examples page: the 22 showcase sites plus a real-clients strip.
  - 10 questions + 10 photos everywhere.
  - Retire `/website/[id]`.
  - Mika Santos stays the sample creator; field-agent examples use other names.
  - The `/creators` page shows a sample portal (labelled "Sample") so creators see what they'd get.
- **New scope:** the creator earning structure, the creator portal and two creator link pages. See `docs/CREATOR-PROGRAM.md`.

## Product & pricing

1. **[blocks Phase 1]** Pay before or after the site goes public? Today the code publishes first ("pending payment", "live and waiting" emails) and takes the site offline after 3 unpaid days; the new line is "See it first. Pay once to publish." (a) private preview, publish after payment · (b) keep live, then pay. Recommended: (a); the 3-day auto-offline then goes away. (§10.2)
2. **[blocks Phase 1]** ₱500 × 10 instalments (nothing exists today): who collects each month, does the site publish after the 1st payment, what happens after a missed month, and does the agent get their 50% up front or per instalment? No safe default; need your call. Also: the business page says both "₱500 a month" and "No monthly fees". OK to drop "No monthly fees"?
3. **[blocks Phase 1]** How do owners pay? App mock: GCash / Maya / Card buttons. Live `/pay`: Wise bank transfer with a reference code, matched automatically. (a) Wise only · (b) add a Philippine payment gateway for GCash / Maya / card · (c) both. Recommended: (c), because monthly instalments are hard with manual transfers.
4. **[blocks Phase 1]** The app has no over-the-air updates and no crash reporting (the privacy text even promises Expo "updates"). Add both during the rebuild? Recommended: yes to OTA updates now; crash reporting too if you're fine with one more vendor.
5. **[blocks Phase 2]** Free site address: the mock shows `forge.tendso.site`; today it is `forge.sites.tendso.com`. Switch (new domain + DNS) or keep? Recommended: keep the current one unless you own `tendso.site`.
6. **[blocks Phase 2]** Money figures on the recruiting pages: §6 allows "Earn ₱30,000+ a month", "keep ₱1,500 each", a calculator and "Get ₱1,000" per referral; older mock docs and your earlier rule say no peso earnings there, and the in-app referral screen shows no figure. Recommended: follow §6, label every number "Example", show the ₱1,000 in the app too.
7. **[blocks Phase 2]** Price comparison on the landing: agency ₱10,000 / month and Wix/Webflow ₱1,500 / month are placeholders (another mock doc says ₱500 / ₱900 / ₱1,500). Give real figures, or show the tile without numbers? (§10.3)
8. **[blocks Phase 2]** One name for agents: "field agent" (landing, field-agents page) or "Tendso creator" (app, production)? And "affiliate" stays a separate account type? Recommended: "field agent" everywhere a customer reads it; keep the affiliate type. (§10.4)
9. **[blocks Phase 4]** The mock gives every creator a public page `tendso.com/a/<name>` with a discount code and "Book Mika"; today only affiliates have one. Give creators the page too, or merge affiliates into creators? Recommended: give creators the page; keep the affiliate role.
10. **[blocks Phase 5]** Photo polishing + page copy: today Hyperagent "Tendso Studio" does it. Replace with the new pipeline (Nano Banana 2.1 via Higgsfield, §4C) or keep Studio? Recommended: new pipeline; keep Studio as a fallback until the new one passes your photo bar.
11. **[not blocking]** Per-site "Ask the shop" chat and the Messenger roadmap (§4E v1.1, §4F): after launch? Recommended: only the "Message us on Messenger" link button now. (§10.7)

## Owner flow

12. **[blocks Phase 1]** Owner sign-in in the app: Clerk like agents, in the same app binary? Method: password (the mock sign-up has one) or a code by SMS / email (today's web owners are passwordless)? Recommended: one app, Clerk, code by SMS / email, no password. (§10.1)
13. **[blocks Phase 1]** Owners whose site an agent made: today the payment email creates a claim link that nothing uses, so they can't reach "My website". Finish the claim link, or invite them to sign in with their phone / email? Recommended: invite to sign in; retire the claim token.
14. **[blocks Phase 2]** The landing "Hire an agent" form (shop, area, mobile) sends nothing in the mock. Where should requests go? Recommended: a lead in admin Leads that the team assigns.
15. **[blocks Phase 3]** Owner flow order differs across the mock (language first / sign-up first / "choose a design" 2nd, before the interview). Recommended: the owner board's order: sign up → what you sell → name + place → how → interview → photos → pick a design → build → check → pay → live (design after photos, so the picker shows the shop's own content).
16. **[blocks Phase 3]** Today an admin approves before any site is built. With an automatic ~20-minute build, when does a person check it? (a) before the owner sees it · (b) after "Looks good", before publish · (c) spot checks only. Recommended: (b).
17. **[blocks Phase 3]** "Ask for a change": what happens behind the button (message to the team, or the AI edits)? And does "one free change" still hold? (§10.6) Recommended: a free-text request into the admin queue; owner self-editing comes in Phase 6.
18. **[blocks Phase 3]** "Mixing" two picked designs into one (owner screen 13): build it or drop it for v1? Recommended: drop; one chosen design, changeable later in editing.
19. **[blocks Phase 3]** "Agents near you → Book a visit" (owner 23–25): the agent's side (accept, decline, calendar) isn't designed, and today's booking only handles recruitment calls. Build both sides now, or start with a request the team assigns? Recommended: a request the team assigns, same as Q14.
20. **[blocks Phase 3]** Language: one English / Tagalog choice for the whole app, or only the EN/TL chip on the recording screen? The app has no translations today; the website has an EN/TL toggle the mock dropped. Recommended: interview questions in both from day one; keep the website toggle; full Tagalog app later.
21. **[blocks Phase 3]** Owner tab bar: 4 tabs (Today · My site · Agents · Me) as on the board, or 5 (Home, Site, Help, Inbox, Account)? Recommended: 4, with Help and Inbox inside Me. (§10.5 / hub)

## Mock contradictions

22. **[blocks Phase 2]** Build time: "about 20 minutes" (§6, building screen, landing) vs "about 30 minutes" (owner screen 14, agent "Sent", SIMPLE-FLOWS). Recommended: 20 minutes for the build everywhere; 30 minutes only for an agent's visit.
23. **[blocks Phase 2]** Examples page: the 22 showcase sites (§4A) or the mock's separate set of 23 designs (some are non-Filipino shops)? Recommended: the 22 showcase sites.
24. **[blocks Phase 2]** Landing proof: today a strip of real client sites you curate in admin ("Featured sites"); the mock shows only the 22 showcase sites. Keep real client sites too? Recommended: yes, a short real-clients strip, so the admin tool stays useful.
25. **[blocks Phase 2]** Interview size: mock web `/start` asks 5 questions + 6 photos, the app asks 10 + 10, today's `/start` stores 8 answers and the agent app asks 5 long questions. Recommended: 10 questions + 10 photos everywhere.
26. **[blocks Phase 3]** Recording screen has 3 specs: (a) §4B: no outline, EN/TL chip, level bar, hint chip, counters (what the mock builds) · (b) APP-SYSTEM v4: no chip / level / hints, an outline that turns yellow · (c) SIMPLE-FLOWS: face outline turns yellow. Recommended: (a). Also keep the audio-only fallback (noisy shop, owner won't be filmed)? Recommended: yes.
27. **[blocks Phase 4]** Agent tab bar: 3 tabs (Map, Add, Earn; SIMPLE-FLOWS) or 5 (Map, Finds, Submit, Earn, Me; the board)? Today: Home, Learn, Submit, Wallet, Profile. Recommended: the board's 5; Learn moves under Me.
28. **[blocks Phase 4]** The certification quiz is 5 questions on the web (pass 4) and 6 in the app (pass 4); the mock says "4 of 5". And lead statuses: mock New → Contacted → Visiting → Live vs today's new / contacted / qualified / converted / lost. Recommended: one 5-question quiz; keep the backend statuses, show the mock's simpler labels.
29. **[blocks Phase 4]** The mock replaces "Find businesses near me" (paid Outscraper search) with community "Spot a shop" (an agent photographs a shop). Keep the paid search too? Recommended: keep both.

## Retire these?

30. **[blocks Phase 2]** Web creator sign-up (`/signup`, `/onboarding`): `/otr` says it's being retired, but `/for-creators` still links to it. Recommended: keep until the app sign-up ships, then point to the app.
31. **[blocks Phase 2]** `/website/[id]` shows any generated site to anyone with the id: no ownership check, nothing links to it. Recommended: retire (previews stay on `/preview/[id]`).
32. **[blocks Phase 4]** Dead or duplicate code: `/training-lessons` (unguarded copy of `/training`), the app's orphan `onboarding.tsx`, the "Unlock higher pricing" bar + "Launch price locked" text, an unused web header, a Wise client inside the app, the unused `h3-js` package. Recommended: retire all.
33. **[blocks Phase 5]** Legacy backend: Supabase-era routes still called by admin (`send-approval-email`, `process-submission`, `extract-content`, `submissions/[id]/mark-paid`), the Airtable push (still used when deleting), per-submission payout marking, saved GCash / Maya / bank payout methods (only Wise pays out), `/api/download-apk`. Recommended: move the live calls to Convex, then retire all.

## Legal / copy

34. **[blocks Phase 2]** Legal text (not changed without you): web Terms say "one-time payment" (instalments?); app Terms say agents get "₱500 per approved submission, ₱300 audio-only" (now 50% of ₱999–₱4,999); app Privacy promises Expo "updates" and names Groq, and the new pipeline adds an image AI. Approve new wording, or send to a lawyer? Recommended: align the app Terms with the web Terms and add an instalment clause.
35. **[blocks Phase 2]** Real details for placeholders: payee "VONAS, OPC" and `support@negosyo.digital` on the mock pay page, team names ("Name TBC") and photos, agent photos, App Store / Google Play links. (§10.5)
