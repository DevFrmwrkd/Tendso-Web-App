# Tendso — implementation handoff (design v2 → production)

> Paste this whole file as the first message to the implementing agent. Written 2026-10-21 by the design
> agent for Theo (founder). Design source of truth: `docs/landing-mock/` (published for review at
> https://claude.ai/artifact/PSw2DsJ8FSD43tqz4eq8Eu).

---

## 0. Your role

You are the **orchestrator** for implementing Tendso's new design end to end: the public website (landing + pages)
and the mobile app, plus the AI pieces behind them. **Your main job is to plan, delegate, review and integrate — not
to write most of the code yourself.**

- **Implementation** → sub-agents on **Sonnet** (`model: "sonnet"`). If Theo's setup gives you a GPT coding model
  (he mentioned "GPT sol 6.1"), you may use it for implementation chunks too — only if it is actually available
  in your tooling; never invent a model id.
- **High-level and design-critical work** → **Opus** sub-agents: architecture, the AI site-building pipeline, the
  landing page, the app's main screens (recording, guided photos, design picker, building/review, site ready),
  and every design-fidelity review.
- **Cheap lookups** (find files, list routes, grep strings) → **Haiku** sub-agents. Keep your own context clean:
  ask agents for summaries and paths, not file dumps.
- Run independent pieces in parallel (one sub-agent per independent area, each in its own git worktree under
  `/Volumes/SSD/New Coding Projects/Tendso-App.worktrees/`). Never let two agents edit the same files.
- After every phase: review the diff yourself or with an Opus reviewer, run the checks (§9), screenshot the result,
  and send Theo a short report with images before starting the next phase.

---

## 1. What Tendso is (one paragraph)

Tendso (Philippines) turns a small neighbourhood shop into a finished website **from a phone**: the owner (or a
field agent visiting the shop) answers **10 simple questions on camera** and takes **10 guided photos**; Tendso's AI
writes the pages from the interview, polishes the photos to look professionally shot, and builds the site from a
real template in **about 20 minutes, the same day**. The owner sees it first, can ask for changes, then pays
**₱4,999 once** (or **₱500 a month for 10 months**) to publish. Field agents ("Tendso creators") sign shops up with
the same app, set the price between ₱999 and ₱4,999, and keep 50%.

**These sites are landing pages only.** No bookings, no carts, no accounts for visitors, nothing complex. Buttons
like "Book a chair" are links (call, SMS, Messenger, Maps), not booking systems.

---

## 2. Read first (in this order)

1. `docs/landing-mock/HANDOFF.md` — storyboard, motion spec, components, tokens, production notes.
2. `docs/landing-mock/BRIEF.md`, `APP-SYSTEM.md`, `APP-SCREENS-SPEC.md` — house rules, app colours, real screens + copy.
3. The mock itself — open in a browser and click through:
   - `docs/landing-mock/index.html` (landing), `pages/*.html` (business, examples, creators = field agents, about,
     help, start, pay, legal, giveaway, otr), `showcase/*.html` (example sites).
   - App boards: `docs/landing-mock/app/owner.html`, `app/creator-core.html`, `app/creator-more.html`.
   - Shared app screens live in `docs/landing-mock/js/screens.js` + `css/screens.css` (one function per screen:
     `interviewCam`, `shotGuide`, `designPicker`, `siteBuilding`, `siteReady`, …). These are the spec for the
     React Native screens — port behaviour and layout, not the DOM.
4. Memory of decisions (if you can read it): `~/.claude/projects/-Volumes-SSD-New-Coding-Projects-Tendso-App/memory/`
   — especially `tendso-pricing-model.md`, `tendso-capture-ui-rules.md`, `tendso-rule-never-overwhelm.md`,
   `tendso-design-direction.md`, `tendso-knowledge-base.md`.

The repo: `/Volumes/SSD/New Coding Projects/Tendso-App` (GitHub `DevFrmwrkd/Tendso-Web-App`). Next.js 16 (App Router)
+ Convex + Clerk on the web; **Expo / React Native** app in `apps/mobile` (expo-router, NativeWind); shared code in
`packages/shared` (incl. `pricing.ts`) and `packages/convex-client`. Site templates: `templates/`, previews in
`public/template-previews/`, field/section scripts (`npm run templates:sync`, `npm run check:templates`), the
hosted-site build in `astro-site-template/`. Site editor: `components/editor/` (`SandboxEditorV3.tsx`,
`genericContentSchema.ts`, …). Knowledge base + AI: `convex/knowledge*.ts`, `convex/aiKeys.ts`, `/knowledge`.

There is an **untracked early attempt** at the new landing in `app/v2/` and `components/landing-v2/`. Look at it,
reuse what's good, but the mock is the spec.

---

## 3. PHASE 0 — feature inventory (mandatory, before any redesign code)

The mocks do **not** show every feature. Nothing that exists today may disappear unless Theo approves it.

1. Spawn Haiku/Sonnet agents in parallel to list **every** feature, screen and route in:
   - web `app/**` (public pages, auth, dashboard, submissions, admin, affiliates/referrals, certification-quiz,
     leads, my-business, preview/hosted sites, pay, start, giveaway (100-pages / libre / poster), otr, knowledge,
     connect-ai, notifications, profile/edit/change-password, …),
   - mobile `apps/mobile/app/**` (`(auth)`, `(app)/(tabs)`, `(affiliate-tabs)`, admin, leads, submissions, submit,
     training, training-lessons, certification-quiz, referrals, onboarding, account-setup, complete-profile,
     pending-review, verification-rejected, notifications, help-faq, legal, …),
   - Convex functions (`convex/*.ts`): payments/payouts (Wise), submissions, admin approval, emails, referrals,
     certification, knowledge/AI, Discord, templates, campaigns.
2. Write `docs/FEATURES.md`: a checklist table — feature · where today · who uses it (owner / agent / admin) ·
   where it lives in the new design (or "keep as is, restyle") · status. Every row must end as
   ✅ ported, 🎨 restyled, ➕ new, or ❓ "ask Theo". Keep it updated through every phase.
3. Send Theo the ❓ list before Phase 2.

---

## 4. Scope

### A. Public website (Next.js) — rebuild per the mock
- **Landing** (`/`): hero (phone in the centre, buddy types "I'll build your website", real showcase sites float out
  symmetrically; on scroll the stage **shrinks into the first grid tile and hands over** to a 3-column scrolling
  gallery of 22 real showcase sites that open in a new tab), grid tiles ("10 simple questions" · "10 guided photos" =
  a 3 × 2 grid where each shop photo wipes from the phone shot to the Tendso shot · "Pay once" comparison
  agency / Wix-Webflow / Tendso + instalment · field agents near you), people, **six steps** on one pinned phone
  (Download · Choose a design · Get interviewed · Take the photos · **We build it (~20 min)** · Your website is
  ready), paths (download / hire an agent / join) **last**, footer with Help · Contact · Field agents · Privacy · Terms.
- **Pages:** For businesses, Examples (use the showcase sites), **For field agents** (`pages/creators.html`: hero
  "Earn ₱30,000+ a month" with the example math, visit steps, slider + ± calculator, what you get, trust, FAQ),
  About, **Help** (replaces /knowledge front: search + Tendso AI answer + topics + contact), Start (web sign-up, one
  step per screen), Pay (pay once / instalment), Legal, Giveaway, OTR.
- Hover on tiles = the tile blurs and one line sits in the middle (no black box).
- Port the motion faithfully (HANDOFF.md has timings and easings). Lenis smooth scroll is optional in Next — match feel.
- Showcase example sites (22, four visual families — warm editorial, bold colour, full-bleed photo, minimal/playful):
  `docs/landing-mock/showcase/*.html` + captures in `assets/sites/showcase/` + photos in `assets/photos/showcase/`. Ship them as
  static example pages (e.g. `/examples/<id>`) and use the captures for cards. Longer term they should be real
  templates in the template system (see D).

### B. Mobile app (Expo) — redesign per the app boards, keeping every existing feature
- One app, two roles: **shop owner** and **field agent** (creator). The current app is agent-centric; the owner path
  (download → do it yourself) is new and is the landing page's primary CTA — confirm with Theo how owners
  authenticate (Clerk, same as agents) before building.
- Visual system: Onest everywhere, accent `#E4F222` as a fill only, tinted light backgrounds (Round 2 style), white
  fine outside recording, real app feel (not a wireframe), **rule #1: never overwhelm** (one thing per screen, big
  type, ≤ ~20 words, nothing under 16 px; `docs/landing-mock/tools/simple-lint.mjs` measures the mock screens).
- **Recording screen** (`interviewCam`): full-bleed camera, **no outline of any kind**; top: close · REC timer + mic
  meter · EN/TL chip; 10-step progress bar; framing is *measured once* (level bar + chip "Hold the phone straight" →
  "Good. Start talking"), then only a faint level stays; the question sits low like a subtitle (white, text shadow,
  no box); bottom: small pause + the biggest control "Next question" (→ "Finish ✓" on the last). **No white while
  recording.** 10 super-simple questions + "Anything else?" (`TD.interview` in `js/data.js`, English + Tagalog).
- **Guided photos** (`shotGuide`): same layout, **no outlines, no grid**; "Shot 3 of 10" · flash; level + feedback
  chip ("Step back a little" → "Perfect, hold still"); task title + hint as a subtitle; strip of the 10 shots; last
  photo · white shutter · Skip; quick capture (photo, photo, photo). 10 tasks per business type (`TD.shots` —
  barber, repair, salon, …; AI may suggest per type) + the owner's own extras.
- **Choose your design** (`designPicker`): one big card at a time = a **real template from the database** already
  filled with the shop's content; swipe; tap → the full real site opens and scrolls; "Use this design". No
  colour/font knobs here.
- **We build it** (`siteBuilding`): buddy + "Building your site · About 20 minutes", four steps (reading your
  interview · writing your pages · polishing your photos · building your site) with real progress from the backend,
  then **"Ready to check"**: the finished site + "Ask for a change" / "Looks good". Push notification when ready.
- **Site ready / publish**: the site, free `<shop>.tendso.site` address, optional custom .com, ₱4,999 once or
  ₱500 × 10, "See it first. Pay once to publish."
- **After publish — edit your site** (new, see D).
- Field agent: shops near you (map), capture flow (same recording + photos screens), submissions + status, earnings
  (wallet → Wise), training/certification, referrals, profile — all existing features kept, restyled.
- Help inside the app = the Tendso AI (E).

### C. AI site-building pipeline (Opus designs it, Sonnet builds it)
Target: about **20 minutes** from "Send" to "Ready to check".
1. Transcribe the interview (EN/TL/Taglish) → structured facts (name, address, services + ₱ prices, hours,
   contact, story, what customers love).
2. Write the page copy into the chosen template's fields (owner's own words, short, no invented facts).
3. **Photo polishing** — the bar Theo set (repeatedly): the result must look like a *professional photographer
   re-shot the same person in the same place* — new angle, framing and light, bright, friendly, commercial and
   realistic; **never** a filter on the same frame, never dark/cinematic/orange. What worked in design:
   Nano Banana 2.1 (Higgsfield), 1K, sending **both** the owner reference and the location reference with a
   dedicated prompt per shot ("same person, same room, new camera position and light"). Keep the original if a
   result fails a quality check; the owner can always "keep originals".
4. Fill the template (template field system + checks), render, deploy to `<shop>.tendso.site` preview.
5. Status updates to the app at each step; human review queue in admin stays as today.

### D. Owner editing after the site exists (new)
Once copy + photos exist, the owner can: **switch the whole design** (another template from the database, same
content), **change the font**, **change colours**, **edit specific texts and photos**, reorder/hide sections the
template supports. Build on `components/editor/` + the template field schema; on mobile, a simple editor (tap a
section → edit). **No bookings, carts, logins for visitors or other complex features.**

### E. AI chatbot answering questions
- Reuse the existing engine: `convex/knowledgeAI.ts` (Gemini RAG, BYOK key pool `aiKeys`, graceful fallback) that
  already powers `/knowledge`, the landing `ChatBot` and Discord `/ask`.
- Put it on: the new landing + Help page (visitors' questions about Tendso), the app's help (owners + agents).
- Make sure the knowledge articles carry the **new facts** (§6) — today several production articles still say
  48–72 hours, ₱999, "pay once it's live".
- Optional v1.1 (ask Theo): a small "Ask the shop" chat on each owner site, answering only from that shop's own
  content (hours, prices, location), with a "Message us" fallback.

### F. Roadmap — Messenger (not now; scope note for Theo)
- **Easy, now:** a "Message us on Messenger" button on every site (`m.me/<page>` link) — a template field.
- **Medium, later:** the AI answering the shop's own Facebook Messenger: a Meta app with the Messenger Platform +
  `pages_messaging` permission (Meta **App Review + Business Verification**, typically weeks), the owner connects
  their Facebook Page via Facebook Login, a webhook receives messages, the bot answers from that shop's site content
  (the same data as E), human hand-over when the owner replies, and the 24-hour messaging window rules. Engineering
  is roughly 1–2 weeks; the Meta approval is the long pole. Not simple, but very doable because the content already
  exists.

---

## 5. Theo's hard rules (violations get the work thrown out)

- Never overwhelm; grandmother-simple; but it must feel like a real, premium app.
- Font **Onest** (app + Tendso site); no serif in the app UI. Accent `#E4F222` fill only, never yellow text on white.
- Filipino people first. Examples are crafts (barber, mechanic, salon, florist, carpenter, tailor…); no food as the
  main example unless asked.
- Photos: bright, commercial, friendly, realistic, high-end. Never dark/cinematic/orange; never filtered copies;
  never cut-off people. The barber photo with the white blurred foreground (old `pro2-haircut.jpg`) is **banned**.
- Example sites: no URL bars, nothing cut off, no overlapping text, no placeholder boxes.
- Camera screens: see §4B — no outlines, question/task as subtitle, biggest button = Next.
- Don't generate images/video unless the task needs it and you state the credit cost first.

## 6. Facts (override any production string that disagrees)

- Build time: **about 20 minutes** after interview + photos, same day. (Agent visit ≈ 30 min at the shop; owner's own
  time in the app ≈ 20 min.) Never "48–72 hours".
- Payment: "**See it first. Pay once to publish.**" ₱4,999 once, or ₱500 a month for 10 months. Never "pay only when
  it's live". Exact payment timing still to be confirmed by Theo.
- Agents: price ₱999–₱4,999 per shop, keep 50% (`packages/shared/pricing.ts`). Agent page may say "Earn ₱30,000+ a
  month" with the example (5 shops/week at ₱2,999 → ₱1,500 each); calculator results are labelled "Example".
- Production strings known to contradict this: help-center articles, `/start` "What happens next", `/otr`, `/pay`
  ("site is already up"), a ₱999 price article, terms §4 creator earnings (legal text — flag, don't silently change).

## 7. Engineering rules

- Branches: `feat/…`, `fix/…`, `chore/…`, `reconcile/…` only (no auto-generated names). One worktree per PR under
  `Tendso-App.worktrees/`. Main checkout stays on `main`.
- **No GitHub Actions** — do not create or extend `.github/workflows/`. Run tests locally: `npm run typecheck`,
  `npm run lint`, `npm test`, `npm run check:templates`, `npm run mobile:typecheck`, `npm run mobile:test`.
- Convex schema changes: additive, with migrations; `npx convex dev` needs Node 20+.
- Ship behind a flag or on a parallel route (e.g. `/v2`) until Theo approves; then swap.
- Commit/push only when asked; PRs go to `main`; Steven (Steven Madali) reviews and merges. Don't deploy.
- Never put secrets in code, ClickUp or chat.

## 8. Suggested phases

0. Inventory (§3) → `docs/FEATURES.md` + ❓ list to Theo.
1. Foundations: design tokens (web + NativeWind), Onest, shared components (buttons, pills, cards, phone frame for
   web), data model additions (instalment, build steps/status, design choice, editable font/colour).
2. Website: landing (Opus lead) + pages (Sonnet, parallel per page) + showcase examples + chatbot on landing/Help.
3. App owner flow: onboarding → interview → photos → design picker → building/review → publish/pay (Opus lead for
   the camera screens and the design picker).
4. App agent flow restyle + all existing features (Sonnet, parallel per area).
5. AI pipeline (Opus design, Sonnet build): transcript → copy → photos → template fill → preview, with progress events.
6. Owner editing (switch template, font, colours, texts, photos).
7. Knowledge articles updated to the new facts; QA pass; Theo review.

## 9. Definition of done (per phase)

- Every row in `docs/FEATURES.md` resolved; no existing feature lost.
- Visual parity with the mock: side-by-side screenshots (web 1440 + 390; app on iOS simulator + Android emulator).
- Checks in §7 pass locally; no console errors; no horizontal scroll; app screens pass the simplicity rules.
- Short report to Theo with screenshots, what's done, what's open, and any credit spend.

## 10. Open decisions for Theo (ask, don't assume)

1. Owner sign-in in the app (Clerk like agents?) and whether owners and agents share one app binary.
2. Exact payment timing and the instalment mechanics (provider, what happens if a month is missed).
3. Monthly comparison figures (agency ₱10,000, Wix/Webflow ₱1,500 are placeholders).
4. "Field agent" vs "Tendso creator" naming in the app.
5. App Store / Google Play links; real team and agent photos.
6. Whether the ₱1,000 referral bonus is shown publicly; whether "one free change" still holds.
7. Per-site "Ask the shop" chatbot (E v1.1) and the Messenger roadmap (F).
