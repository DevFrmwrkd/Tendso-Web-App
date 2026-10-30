# Tendso redesign: feature inventory (Phase 0)

**Purpose.** Every feature, screen, route and backend job that exists today, mapped to where it lives in the v2 design (`docs/landing-mock/`), so nothing disappears without Theo's approval (IMPLEMENTATION-HANDOFF §3). Built 2026-10-21 from five read-only inventories: web `app/**`, mobile `apps/mobile/app/**`, Convex + `app/api/**`, the mock, and production copy. Done boxes were updated on 2026-10-22 when the design v2 rollout was merged into one branch (`feat/v2-all`); new web pages live under `/v2` until Theo approves the swap for `/`.

**IDs.** `W-` web route/component · `M-` mobile screen/module · `C-` Convex feature · `A-` Next API route · `BE §n` backend-inventory section that has no ID · `N-` new in the redesign. Rows that exist on web and in the app are merged into one row that cites both IDs, and sit in the area the mock redesigns (usually the app). Open decisions are in the ❓ list for Theo (`questions.md`, 35 questions); rows cite them as Q-numbers.

**How to update.** When a row ships, tick Done (☐ → ☑) in the same PR. If Theo answers a ❓, change Target to the outcome and add "(Theo, date)". Never delete a row: a removed feature stays as `🗑 retired (Theo, date)`. New features found later get the next free ID in their prefix.

### Legend

| Target | Meaning |
|---|---|
| ✅ ported | Carried into the new design with its behaviour: the mock has a page or screen for it, or (backend) it keeps working, unchanged or extended. |
| 🎨 restyled | Kept as is; only moves to the new tokens and Onest. The mock has no screen for it. |
| ➕ new | No current equivalent. |
| ❓ ask Theo | Outcome depends on a decision (Q-number in the row). |
| ❓ 🗑 retire? | Sub-case of ❓: dead, duplicate or legacy, proposed for removal. Stays until Theo says yes. |

**Phase** = the IMPLEMENTATION-HANDOFF §8 phase in which the row is delivered or re-verified: 0 inventory · 1 foundations · 2 website · 3 app owner flow · 4 app agent flow + existing features · 5 AI pipeline · 6 owner editing · 7 knowledge articles + QA. Admin and the web logged-in areas are not in the mock: default "keep as is, restyle", Phase 4.

**Done:** ☐ not done · ◐ partly done (usually: the app or `/v2` part is built, the old web screen is not restyled yet, or a ❓ is still open) · ☑ done.

### Counts (rows, all tables incl. "New")

| Target | Rows |
|---|---|
| ✅ ported | 118 |
| 🎨 restyled | 55 |
| ➕ new | 31 |
| ❓ ask Theo | 26 (of which 🗑 retire? 12) |
| **Total** | 230 |


### v2 rollout — env vars to set

All empty = the feature stays off and today's behaviour is kept. Values never go in the repo (`.env.example` and `apps/mobile/.env.example` list them empty).

**Convex** (`npx convex env set NAME value`)

| Var | What it does | Source |
|---|---|---|
| `ATTRIBUTION_IP_SALT` | Salt for hashing visitor IPs on creator-link clicks (network matching; raw IPs never stored) | v2-api-creators |
| `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN` | GCash / Maya / card checkout; off unless BOTH set. Callback URL in the Xendit dashboard: `https://<deployment>.convex.site/xendit-webhook` | v2-api-owners §6 |
| `XENDIT_SUCCESS_REDIRECT_URL`, `XENDIT_FAILURE_REDIRECT_URL`, `XENDIT_PAYMENT_METHODS` | Optional redirect defaults and method filter | v2-api-owners §6 |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO` | Owner emails sent from Convex (invite, building, ready, live) | v2-api-owners §7 |
| `OWNER_APP_URL` | Where "Open Tendso" in owner emails points | v2-api-owners |
| `OWNER_APP_DAILY_LIMIT` | Owner-app submits per day (default 50; 0 closes it) | v2-api-owners |
| `AI_PIPELINE_ENABLED` | Master switch for the automatic build (submissions and owner-app builds). Off: Tendso Studio as today | v2-ai-pipeline |
| `AI_PIPELINE_STUDIO_FALLBACK`, `AI_PIPELINE_TIMEOUT_MINUTES`, `AI_PIPELINE_MAX_POLISHED_PHOTOS`, `AI_PIPELINE_LLM_ORDER`, `AI_PIPELINE_GEMINI_MODELS`, `AI_PIPELINE_IMAGE_TIMEOUT_MS` | Optional pipeline tuning | v2-ai-pipeline |
| `HIGGSFIELD_API_KEY` (or `HIGGSFIELD_API_KEY_ID` + `HIGGSFIELD_API_KEY_SECRET`), `HIGGSFIELD_IMAGE_ENDPOINT` | Photo polishing; off unless key AND endpoint id are set (endpoint id from console.higgsfield.ai) | v2-ai-pipeline |
| `HIGGSFIELD_IMAGE_PARAMS`, `HIGGSFIELD_API_BASE` | Optional | v2-ai-pipeline |
| `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAME` | Landing "Hire an agent" form (Cloudflare Turnstile) | landing |
| `LANDING_LEADS_SECRET` | Shared secret, **Convex and Vercel, same value** | landing |
| Reused: `SELF_SERVE_CREATOR_ID`, `R2_PUBLIC_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `KEY_ENCRYPTION_SECRET`, `INTERNAL_API_SECRET` (Convex and Vercel), `SITE_URL`, `HYPERAGENT_WEBHOOK_URL/TOKEN` | Already set today | — |

**Vercel** (Next.js)

| Var | What it does |
|---|---|
| `NEXT_PUBLIC_XENDIT_ENABLED` | `true` turns on the GCash / Maya / Card buttons on `/v2/pay/[token]` (else "Coming soon") |
| `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_GOOGLE_PLAY_URL` | Optional store-link overrides on every `/v2` page. Admin "App links" settings (`app_store_url` / `play_store_url`) win when set; otherwise use these env values, then Tendso's existing released App Store / Google Play listings. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Landing hire form widget |
| `LANDING_LEADS_SECRET`, `INTERNAL_API_SECRET` | Same values as on Convex |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Optional (default derived from `NEXT_PUBLIC_CONVEX_URL`) |
| `NEXT_PUBLIC_V2_CREATORS_SAMPLE` | Development only; ignored in production |

**EAS** (mobile app, EAS environment variables / secrets)

| Var | What it does |
|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | Crash reporting; empty = off |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Source maps (EAS secrets, build time) |
| `EXPO_PUBLIC_WEB_ORIGIN` | Web origin for template previews, Help and the pay page (default https://www.tendso.com) |
| `EXPO_PUBLIC_OWNER_SAMPLE_DATA` | Development builds only; ignored in release builds |

---

## 1. Public website

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-001 | Landing page: hero, real sites, how it works, price, FAQ, CTA to `/start`; EN/TL toggle; ISR 300 s | `/` `app/page.tsx` | visitor | `index.html` (hero stage, grid tiles, people, six steps, paths, footer). EN/TL toggle not in mock: keep (Q20); Cost tile figures Q7 | 2 | ✅ | ☑ |
| W-002 | "Real sites" proof grid: admin-curated real client sites as live previews | `RealSitesSection.tsx`, `LiveSitePreview.tsx` | visitor | mock gallery tile shows the 22 showcase sites instead | 2 | ❓ (Q24) | ☐ |
| W-127 | Public header + footer (How it works, Real sites, Price, For creators, Help, Sign in, "Get a website") | `components/r1/Public.tsx` | visitor | mock nav (tightens on scroll) + footer (Help · Contact · Field agents · Privacy · Terms); keep Sign in | 2 | ✅ | ◐ |
| W-004, C-081 | Creator recruitment page: keep 50%, 5 steps, real sites, store buttons, Discord, FAQ, book-a-call CTA, own chatbot | `/for-creators` | visitor (prospective agent) | `pages/creators.html` (route `/field-agents` proposed; keep `/for-creators` working). Money figures Q6, naming Q8 | 2 | ✅ | ☑ |
| W-005 | Affiliate programme pitch (static; not in sitemap) | `/affiliates` | visitor | not in mock: keep, restyle | 2 | 🎨 | ☑ |
| W-006, W-007, M-071, M-072 | Privacy policy + Terms of service (web pages and in-app copies) | `/privacy-policy`, `/terms-of-service`; app `terms-of-service.tsx`, `privacy-policy.tsx` | all | `pages/legal.html` (`#privacy`, `#terms`); app creator-more 19 Terms. Legal wording: Q34, flag, don't silently change | 2 | ✅ | ☑ |
| W-008 | About (today only redirects to `/`) | `/about` | visitor | `pages/about.html` (statement, 3 points, team, cities, careers CTA) replaces the redirect | 2 | ➕ | ☑ |
| W-013 | For businesses (today a 308 to `/`, no page) | `next.config.ts` redirects | visitor | `pages/business.html` (two ways, what you get, price, examples strip, FAQ) | 2 | ➕ | ☑ |
| W-009, W-010, W-011, W-012 | Legacy redirects: `/creators`, `/for-field-agents` → `/for-creators`; `/contact` → `/knowledge#contact`; `/help-faq` → `/knowledge#creator-faq` | route files | visitor | keep; re-point to the new field-agents page, Help contact, Help FAQ | 2 | ✅ | ☐ |
| W-124 | robots.txt (AI crawlers allowed, private paths disallowed) | `app/robots.ts` | crawlers | keep; add new routes, re-check the private list | 2 | ✅ | ☐ |
| W-125 | sitemap.xml (`/`, `/for-creators`, `/knowledge`, help articles, featured sites) | `app/sitemap.ts` | crawlers | keep; add the new pages (business, examples, about, help, legal) | 2 | ✅ | ☐ |

## 2. Auth & account (web + app)

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| M-001 | Welcome screen + first-launch gate (signed-in users skip to tabs) | `apps/mobile/app/index.tsx` | all, signed out | creator-core 1.1 "Welcome choice" (I have a business / I want to earn) + owner 01 | 3 | ✅ | ☑ |
| W-014, M-002 | Sign in: email + password, Google; app also Apple and TikTok SSO (with details modal) | `/login`; `(auth)/login.tsx` | all roles | app: creator-more 1 (Apple + Google drawn; keep TikTok). Web `/login`: keep, restyle | 4 | ✅ | ◐ |
| M-003 | App sign-up: Creator or Affiliate, email code, Google / Apple / TikTok | `(auth)/signup.tsx` | new agent, new affiliate | creator-more 2 (account-type rows). Owner sign-up is new (N-02) | 4 | ✅ | ☑ |
| W-015, W-019 | Web creator sign-up + onboarding profile (creates `creators` row, referral code) | `/signup`, `/onboarding` | prospective agent | not in mock; `/otr` copy says web sign-up is being retired | 2 | ❓ 🗑 retire? (Q30) | ☐ |
| W-016 | Google OAuth callback screen | `/auth/sso-callback` | all | keep, restyle | 2 | 🎨 | ☐ |
| W-017, M-004 | Forgot / reset password (email → 6-digit code → new password; app blocks deleted accounts) | `/forgot-password`; `(auth)/forgot-password.tsx` | all | creator-more 3; web keep, restyle | 4 | ✅ | ◐ |
| W-018, W-024, W-025, W-026 | Redirects `/reset-password`, `/edit-profile`, `/change-password`, `/connect-ai` → profile drawers | route files | all | keep as redirects | 4 | ✅ | ☐ |
| W-020, M-066 | Account / Profile: identity, sign-in facts, payout drawer, certificate, referral code, sign out (web also in owner + admin frames) | `/profile` `AccountView.tsx`; `(tabs)/profile.tsx` | agent, affiliate, owner, staff, admin | creator-more 16 Profile; web keep, restyle | 4 | ✅ | ◐ |
| W-021, M-067 | Edit profile: name, phone, photo to R2 (app crops and re-encodes) | `/profile?edit=profile`; `edit-profile.tsx` | agent, affiliate | creator-more 17 (adds Wise email, locked email) | 4 | ✅ | ◐ |
| W-022, M-069 | Change / set password (app: first password for Apple/Google users) | `/profile?edit=password`; `change-password.tsx` | agent, affiliate | row on creator-more 16; screen not drawn: keep, restyle | 4 | 🎨 | ◐ |
| M-068 | Delete my account (30-day soft delete + Clerk delete; App Store 5.1.1(v)) | `edit-profile.tsx`, `PendingApproval.tsx` | agent, affiliate | creator-more 17 link; owners need it too (N-17) | 4 | ✅ | ☐ |
| C-001 | Creator account CRUD (soft delete, last active, stats) | `convex/creators.ts` | system | backend, unchanged | 4 | ✅ | ☐ |
| C-002 | Role / authz helpers (`adminAccess.me`, requireAdmin / Staff / CreatorAccount / AccountOwner) | `convex/adminAccess.ts`, `convex/lib/auth.ts` | system | backend; extend for an owner role in the app (Q12) | 1 | ✅ | ☑ |

## 3. Owner (web + app)

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-058 | `/start` intake shell: one URL, autosaved draft, Save and exit, campaign / affiliate attribution, one write at the end | `app/start/page.tsx`, `draft.ts` | owner (no account) | `pages/start.html` (11 one-thing screens, 4 stages, draft kept) | 2 | ✅ | ☑ |
| W-059, C-074, A-019 | `/start` basics: business, owner, PH phone, email, address + map pin (geocode), custom-domain request | `BasicsStep.tsx`, `MapPicker.tsx`, `/api/geocode` | owner | start.html name + kind / contact / location screens; map pin and domain request not drawn: keep | 2 | ✅ | ☑ |
| W-060, C-013 | `/start` voice interview: record or type, Taglish, Whisper per answer | `InterviewStep.tsx`, `intakeVoice.transcribeAnswer` | owner | start.html questions with "Say it instead" / "Skip this one"; question count Q25 | 2 | ✅ | ☑ |
| W-061 | `/start` photos (required slots to R2) | `PhotosStep.tsx` | owner | start.html photos (6 slots, "try with sample photos"); count Q25 | 2 | ✅ | ☑ |
| W-063 | `/start` review: server-side quote, submit once | `ReviewStep.tsx`, `quote.ts` | owner | start.html "last look" (+ discount-code field); copy fix F1/F3 | 2 | ✅ | ☑ |
| W-064 | Intake thanks (receipt; giveaway variant) | `/start/thanks` | owner | start.html "done"; copy "48–72 hours" → about 20 minutes | 2 | ✅ | ☑ |
| C-012 | Owner intake backend: straight to `submitted`, 8 Q&A, frozen campaign/affiliate price, giveaway reservation, throttle, receipt email | `convex/ownerIntake.ts` | owner, system | backend; reused by the app owner path and the new pipeline | 5 | ✅ | ☑ |
| W-067 | My website: owner portal home (claimed sites, status, URL, payment state) | `/my-business` | owner | not in mock for web; app equivalent is owner 22 Home (N-14). Keep web, restyle | 4 | 🎨 | ☐ |
| W-068 | My website detail (read-only; edits are "requested") | `/my-business/[submissionId]` | owner | keep, restyle; owner editing replaces "request an edit" (N-16) | 6 | 🎨 | ◐ |
| W-069 | Owner claim link (payment email mints a token nothing consumes; no UI creates `businessOwners` rows) | `/my-business/claim` (redirect) | owner | half-built: finish, or replace with owner sign-in | 1 | ❓ (Q13) | ☑ |
| C-006 | Business-owner accounts (`businessOwners`, `websiteOwnerships`, `ownerClaimTokens`; passwordless Clerk) | `convex/businessOwners.ts` | owner | backend; becomes the owner role in the app (Q12, Q13) | 1 | ✅ | ☑ |
| M-013 (owner branch) | App dead end for owners: "Continue on the web" screen + unreachable owner card in account-setup | `(app)/_layout.tsx`, `account-setup.tsx` | owner | replaced by the owner path (N-01) | 3 | ➕ | ☑ |

## 4. Agent / creator (web)

Web versions of features that also exist in the app are merged into section 5 (both IDs cited). Only web-only items are here.

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-049, C-073 | Book the 10-minute field-agent call: slots, ticket, Google Calendar + Meet, reminders, attendance | `/field-agent/book`; `booking.ts`, `nativeBookings.ts`, `callReminders.ts` | prospective agent, system | not in mock (creators page shows Discord + Download); keep, link from field-agents page, restyle | 2 | 🎨 | ☐ |
| W-050 | Reschedule / cancel the call by emailed token | `/field-agent/manage?t=` | prospective agent | keep, restyle | 2 | 🎨 | ☐ |
| W-030 | `/training-lessons`: unguarded duplicate of `/training` | `app/training-lessons` | agent | duplicate | 4 | ❓ 🗑 retire? (Q32) | ☐ |
| W-039, W-046 | Redirects `/leads/[leadId]`, `/submissions/[id]` → drawers (old email / app links) | route files | agent | keep as redirects | 4 | ✅ | ☐ |

## 5. Agent / creator (app)

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| M-005 | Account setup: creates the Convex row (Creator vs Affiliate, name, mobile, handle or referral code) | `account-setup.tsx` | new agent / affiliate | creator-core 1.2 city, 1.3 how did you hear + referral code, 1.4 profile + Wise email (new fields N-27) | 4 | ✅ | ◐ |
| M-006 | Complete-profile name gate (blank name after social sign-up) | `complete-profile.tsx` | agent | not drawn: keep, restyle | 4 | 🎨 | ☑ |
| M-007 | Legacy onboarding form (orphan; nothing links to it) | `(app)/onboarding.tsx` | nobody | dead duplicate of M-005 + M-006 | 4 | ❓ 🗑 retire? (Q32) | ☐ |
| M-010 | Certification gate on Home (blank name → rejected → pending → training) | `(tabs)/index.tsx` | agent | keep logic | 4 | ✅ | ☑ |
| W-029, M-048, M-049, C-080 | Training: overview + 5 lessons with tips | `/training`; `training.tsx`, `training-lessons.tsx` | uncertified agent | creator-core 2.1 Training, 2.2 One lesson | 4 | ✅ | ◐ |
| W-031, M-050 | Certification quiz (web 5 Q pass 4; app 6 Q pass 4; shareable certificate) | `/certification-quiz`; `certification-quiz.tsx` | uncertified agent | creator-core 2.3 ("Pass with 4 of 5"); result / retake not drawn: keep. Count Q28 | 4 | ✅ | ◐ |
| M-051 | Certificate card: view, share, save to gallery | `CertificateCard.tsx` | certified agent | not drawn: keep, restyle | 4 | 🎨 | ☐ |
| W-032, M-011 | Pending approval gate (live; auto-routes on decision) | `/pending`; `pending-review.tsx` | agent (quiz passed) | creator-core 1.5 | 4 | ✅ | ◐ |
| W-033, M-012 | Verification rejected (reason; app: retake quiz; web: no resubmission) | `/verification-rejected`; `verification-rejected.tsx` | agent (rejected) | creator-core 1.6 (fix fields + resend) | 4 | ✅ | ◐ |
| C-003 | Certification backend: quiz pass → pending queue → approve / reject, notification | `creators.ts`, `approvals.ts` | agent, admin, system | backend, unchanged | 4 | ✅ | ☐ |
| M-015 | Creator tab bar: Home, Learn, big SUBMIT, Wallet, Profile | `(tabs)/_layout.tsx` | agent | creator-core 3.1 tab bar Map · Finds · Submit · Earn · Me; count Q27 | 4 | ❓ (Q27) | ◐ |
| W-028, M-016 | Creator Home: balance, counts, team leads card, recent submissions, activity, push registration (web is also the post-login router) | `/dashboard`; `(tabs)/index.tsx` | agent | creator-core 3.1 Map home (balance → Earn, submissions → Submissions); web keep, restyle | 4 | ✅ | ◐ |
| M-017 | "Unlock higher pricing" bar + "Launch price locked" chip (dead since 2026-10-06) | `UnlockPricingBar.tsx`, `submit/review.tsx` | agent | contradicts the no-unlock pricing | 4 | ❓ 🗑 retire? (Q32) | ☐ |
| W-040, M-025, M-036 | Capture 1, business info: prefill from prospect, draft resume / discard, local cache, offline | `/submit/info`; `submit/info.tsx` | agent | creator-core 4.1 "About the shop"; draft prompts not drawn: keep | 4 | ✅ | ☐ |
| W-041, M-026 | Capture 2, photos: 3–10 (app: library only, no camera) | `/submit/photos`; `submit/photos.tsx` | agent | creator-core 4.2 shot list + 4.3 guided camera (N-05); keep "add from library" | 4 | ✅ | ◐ |
| W-042, M-027 | Capture 3, video interview: 5 scripted questions, pause, flip, playback, re-record, parallel audio track (web also file upload) | `/submit/interview`; `submit/interview.tsx` | agent | creator-core 4.4 question list + 4.5 recording (10 questions); spec Q26 | 4 | ✅ | ◐ |
| M-028 | Capture 3, audio-only interview fallback (noisy venue, owner won't be filmed) | `submit/interview.tsx` | agent | not drawn | 4 | ❓ (Q26) | ☑ |
| W-043, M-029, M-031 | Capture 4, review + sell-price slider ₱999–₱4,999 with 50% readout (server re-clamps) | `/submit/review`; `submit/review.tsx`, `PriceSlider.tsx` | agent | creator-core 4.6 "Check, then send" | 4 | ✅ | ◐ |
| M-030 (+ W-043 domain part) | Custom-domain add-on with live availability and registrar price | `submit/review.tsx`; `/submit/review` | agent | not drawn: keep | 4 | 🎨 | ☐ |
| M-032 | Submit, or queue the whole submission when offline | `submit/review.tsx` | agent | not drawn: keep | 4 | 🎨 | ☐ |
| W-044, M-033 | Submission success: next steps, transcription status; offline variant | `/submit/success`; `submit/success.tsx` | agent | creator-core 4.7 "Sent" (time Q22) | 4 | ✅ | ☐ |
| C-010, C-011 | Submission backend: draft, update, submit (≥3 photos), lead link, schedules Studio render | `convex/submissions.ts` | agent, system | backend; submit must also start the new pipeline | 5 | ✅ | ☑ |
| W-045, M-034 | My submissions list (status chips; web drawer: remind owner, copy pay link, resume draft) | `/submissions`; `submissions/index.tsx` | agent | creator-more 11 | 4 | ✅ | ◐ |
| M-035 | Submission detail: status banners, rejection reason, video/audio player, photos, live site | `submissions/[id].tsx` | agent | creator-more 12 | 4 | ✅ | ☑ |
| W-034, M-037 | Leads feed / CRM list: search, status chips, only mine, call / email / directions | `/leads`; `leads/index.tsx` | agent | creator-core 3.3 Community finds (filters, cards) | 4 | ✅ | ◐ |
| M-038 | Reserved prospects with time left | `leads/index.tsx` | agent | creator-core 3.1 map ("yours" pins, counts) | 4 | ✅ | ☐ |
| W-036, M-039 | Find businesses near me (paid Outscraper search; reserve a prospect) | `/leads?find=1`; `leads/index.tsx` | agent | not drawn; mock adds "Spot a shop" (N-28) | 4 | ❓ (Q29) | ☐ |
| W-037, M-040 | Discover map: prospect pins, reserve "I'll interview this", start capture prefilled | `/leads/discover`; `leads/discover.tsx` | agent | creator-core 3.1 Map home + 3.2 Shop sheet ("I'm visiting", Route) | 4 | ✅ | ◐ |
| W-038, M-041 | Map of live Tendso sites | `/leads/live`; `leads/nearby.tsx` | agent | creator-core 3.1 map layer / 3.3 "Live" cards | 4 | ✅ | ◐ |
| W-035, M-042 | Lead detail + CRM: status, notes, claim / release, call, start interview | `/leads?lead=`; `leads/[leadId].tsx` | agent | creator-core 3.5 One lead (status labels Q28) | 4 | ✅ | ◐ |
| C-070, C-071, C-072 | Leads backend: CRM + notes, Outscraper scrape with 24 h claims, H3 shared prospect pool | `leads.ts`, `leadNotes.ts`, `outscraper.ts`, `prospects.ts` | agent, system | backend, unchanged | 4 | ✅ | ☐ |
| W-048, M-052 | Referrals: own code, share, people who joined, ₱1,000 bonus rule | `/referrals`; `referrals.tsx` | agent, affiliate | creator-more 10 Invite creators (no bonus figure: Q6) | 4 | ✅ | ◐ |
| M-053 | Enter someone's referral code after sign-up | `(tabs)/profile.tsx` | agent | code field on creator-core 1.3; later entry not drawn: keep | 4 | 🎨 | ☐ |
| C-005 | Referral backend: apply code, qualify, bonus on first paid site | `creators.ts`, `referrals.ts` | system | backend, unchanged | 4 | ✅ | ☑ |

## 6. Affiliate

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-051 | Affiliate join (Clerk sign-up, page handle, waits for approval; blocks creators / owners) | `/affiliates/join` | prospective affiliate | app sign-up has the Affiliate option (creator-more 2); web keep, restyle | 4 | 🎨 | ☑ |
| M-014 | Affiliate awaiting approval (replaces navigator; sign out, delete account) | `components/affiliate/PendingApproval.tsx` | affiliate (pending) | not drawn: keep, restyle | 4 | 🎨 | ☐ |
| M-018 | Affiliate tab bar: Home, Agents, Money, Me | `(affiliate-tabs)/_layout.tsx` | affiliate | Sales and My page open from Home or Me; pushed tools retain Back navigation | 4 | ✅ | ☑ |
| W-052, M-019 | Affiliate home: web balance and shortcuts; mobile selected-month credited earnings, tools and sharing | `/affiliates/dashboard`; `affiliate/Home.tsx` | affiliate | `app/affiliate-redesign.html`: one dark earnings card includes link/team income; Sales and My page use full-width navigation rows; one shop-link card contains Copy and Share actions within the scroll area. Home controls fade a subtle press highlight without moving content and respect Reduce Motion. Month options scroll, and stale income stays hidden while the selected month loads. | 4 | ✅ | ☑ |
| W-053, M-020 | My page editor: photo, name, message, social links; read-only fixed 30% offer (₱3,499) | `/v2/creators/portal/my-page` (legacy `/affiliates/dashboard/my-page` redirects); `PageEditor.tsx` | affiliate | Shared creator portal navigation and actual public shop-page preview; no custom-price controls or price writes | 4 | ✅ | ◐ |
| M-021 | Share tools: copy / share link, QR PNG, printable A4 poster | `affiliate/ShareTools.tsx` | affiliate | `app/affiliate-posters.html`: selected Bold offer; saved public details/code plus fixed 30% offer and QR, A4 web print / mobile PNG | 4 | ✅ | ☑ |
| W-054, M-022 | Sales list (price and commission at sale) | `/affiliates/dashboard/sales`; `affiliate/Sales.tsx` | affiliate | not drawn: keep, restyle | 4 | 🎨 | ☑ |
| W-055, M-023, M-046 | Affiliate wallet + profile (re-use the creator screens) | `/affiliates/dashboard/wallet`; `(affiliate-tabs)/wallet.tsx`, `profile.tsx` | affiliate | follows creator Earn (creator-more 4–6) and Profile (16) | 4 | 🎨 | ◐ |
| W-056 | Affiliate referrals (creator code, creators referred) | `/affiliates/dashboard/referrals` | affiliate | follows creator-more 10 | 4 | 🎨 | ☐ |
| W-057 | Affiliate account (status; payouts off while suspended) | `/affiliates/dashboard/account` | affiliate | keep, restyle | 4 | 🎨 | ☐ |
| W-065, C-007 | Public affiliate page `/a/[handle]` (photo, message, fixed 30% code offer ₱3,499, buy → `/start`); 50% commission | `/a/[handle]`; `convex/affiliates.ts`, `lib/affiliateOffer.ts` | owner (visitor), affiliate | creator-more 8–9 public page (drawn for creators: code applied, "Book Mika"); web page restyled to it | 2 | ✅ | ☑ |

## 7. Admin (web + app)

Not redesigned in the mock: default keep as is, restyle.

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-070, W-120 | Admin gate + frame (Clerk + Convex role; staff limited to 3 pages; `x-tendso-admin-path` header) | `app/admin/layout.tsx`, `AdminLayout.tsx`, `lib/admin-access.ts`, `proxy.ts` | admin, staff | keep as is, restyle | 4 | 🎨 | ☐ |
| W-071, M-024 | "View as" (web bar; app Admin / Affiliate / Creator pills with sample data) | `AdminViewBar.tsx`; `AccountViewSwitcher.tsx`, `AccountPreview.tsx` | admin | keep, restyle; add an Owner view once the owner path exists | 4 | 🎨 | ☐ |
| W-072, C-016 | Admin Today (waiting counts, money fold, URL backfill) + dashboard stats and daily → monthly rollup | `/admin` `AdminToday.tsx`; `admin.ts`, `analytics.ts`, `analyticsJobs.ts` | admin, system | keep as is, restyle | 4 | 🎨 | ☐ |
| W-073 | Staff Today (today's calls, attendance to answer) | `StaffDashboard.tsx` | staff | keep as is, restyle | 4 | 🎨 | ☐ |
| W-074 | Submissions queue: status tabs, filters, giveaway toggle, delete | `/admin/submissions` `_queue/Queue.tsx` | admin | keep, restyle; show build progress (N-09) | 4 | 🎨 | ☐ |
| W-075 | Submission review workspace: generate, SandboxEditorV3, approve / reject, publish / unpublish, emails, mark paid, comp, re-transcribe, enhance images, Studio, Drive, delete | `/admin/submissions/[id]` | admin | keep, restyle; where review sits in the new flow: Q16 | 4 | 🎨 | ☐ |
| W-076, W-077 | Custom-domain fold (Hostinger: register, DNS, SSL, buy) + emails-sent fold | `DomainFold.tsx`, `?fold=emails` | admin | keep as is, restyle | 4 | 🎨 | ☐ |
| W-078, W-079, W-081, W-082, W-083, W-084, W-089, W-092, W-097 | Admin redirects (old domain, emails, creator, pending, rejected, withdrawals, call-stats, app-release URLs) | route files | admin | keep as redirects | 4 | ✅ | ☐ |
| W-080 | Creators admin: pending / all / rejected; approve, reject with reason, role, suspend, delete | `/admin/creators` | admin | keep as is, restyle | 4 | 🎨 | ☐ |
| W-085 | Customer leads (site inquiries, QR scans): status, notes, social card, add lead | `/admin/leads` | admin | keep as is, restyle | 4 | 🎨 | ☐ |
| W-086 | Prospects (Google Maps prospects with claim state) | `/admin/leads` Prospects tab | admin | keep as is, restyle | 4 | 🎨 | ☐ |
| W-087 | Affiliates admin: approve, suspend, reactivate | `/admin/affiliates` | admin | keep as is, restyle | 4 | 🎨 | ☐ |
| W-088 | Payouts: Wise withdrawals, Check Wise, notify failure, revenue chart | `/admin/payouts` | admin | keep as is, restyle | 4 | 🎨 | ☐ |
| W-090, W-091 | Calls (field-agent bookings, attendance, bookable hours, calendar sync, out-of-hours cancel) + call stats | `/admin/bookings` | admin, staff | keep as is, restyle | 4 | 🎨 | ☐ |
| W-095 | Featured sites curation (landing "Real sites") | `/admin/featured-sites` | admin | depends on whether the landing keeps real client sites | 2 | ❓ (Q24) | ☐ |
| W-096 | App links (Play / App Store URLs; old APK clean-up) | `/admin/featured-sites?tab=app` | admin | keep; feeds the landing Download / QR and field-agents page | 2 | 🎨 | ☑ |
| W-098, C-017 | Audit log (sentence log, filters, raw drawer) | `/admin/audit`; `auditLogs.ts` | admin, system | keep as is, restyle | 4 | 🎨 | ☐ |
| W-099, W-100 | Creator + affiliate dashboard previews (sample data) | `/admin/preview/*` | admin | keep, re-point to the new screens | 4 | 🎨 | ☐ |
| M-054 | App admin gate + shell ("Open web admin") | `admin/_layout.tsx`, `AdminUI.tsx` | admin | not in mock: keep, restyle | 4 | 🎨 | ☐ |
| M-055 | App admin overview (today's work, counts) | `admin/index.tsx` | admin | keep, restyle | 4 | 🎨 | ☐ |
| M-056, M-057 | App admin reviews: submission queue + creator verification approve / reject | `admin/reviews.tsx` | admin | keep, restyle | 4 | 🎨 | ☐ |
| M-058 | App admin submission detail (facts, poster proof, photos, transcript, approve / reject; can't play media) | `admin/submissions/[id].tsx` | admin | keep, restyle | 4 | 🎨 | ☐ |
| M-059 | App admin accounts (search, approve affiliates, suspend / reactivate) | `admin/accounts.tsx` | admin | keep, restyle | 4 | 🎨 | ☐ |
| M-060 | App admin payouts (Check Wise) | `admin/payouts.tsx` | admin | keep, restyle | 4 | 🎨 | ☐ |
| C-014 | Approve / reject submission (audit, notification, analytics, Drive sync) | `admin.ts`, `lib/submissionReview.ts` | admin, OTR reviewers | backend, unchanged | 4 | ✅ | ☐ |
| C-015 | Manual lifecycle buttons: generated → deployed → email sent (pending payment) → paid / comped | `admin.ts`, `submissions.ts` | admin | order changes if the owner pays before publish | 1 | ❓ (Q1) | ☑ |
| C-018, A-020 | Cascading delete (Convex rows, R2, Cloudflare, Airtable) | `admin.ts`, `/api/delete-submission`, `/api/delete-creator` | admin | backend, unchanged | 4 | ✅ | ☐ |

## 8. Hosted sites, templates & editor

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-101, C-035 | Customer site hosting: stored HTML per slug, SEO / JSON-LD injection, 404, 503 | `app/hosted/[slug]/route.ts`, `lib/site-seo.ts` | shop's customers | backend, unchanged; free address Q5 | 5 | ✅ | ☐ |
| W-102 | Per-site robots.txt + sitemap.xml | same route | crawlers | backend, unchanged | 5 | ✅ | ☐ |
| W-103 | Offline holding page | same route, `lib/holding-page.ts` | visitor | backend, unchanged | 5 | ✅ | ☐ |
| C-036, A-004 | Unpublish + auto-unpublish after 3 unpaid days (hourly cron) | `unpublish.ts`, `/api/unpublish-website` | admin, system | manual unpublish kept; auto-unpublish depends on Q1 | 1 | ❓ (Q1) | ☐ |
| W-104 | Site preview with Desktop / Tablet / Phone (submission's agent, admin) | `/preview/[id]` | agent, admin | basis for the owner "Ready to check" preview (owner 17–18); needs owner access | 3 | ✅ | ☑ |
| W-105 | Raw website render: public, no ownership check, no inbound links | `/website/[id]` | anyone with the id | legacy | 2 | ❓ 🗑 retire? (Q31) | ☐ |
| C-033, A-005 | Preview API (stored or unsaved HTML for the iframe) | `/api/preview/[id]` | admin | backend, unchanged | 3 | ✅ | ☐ |
| C-030 | AI photo enhance + copy via Hyperagent "Tendso Studio" (webhook, enhanced images, hero / about / services copy, SEO layer) | `hyperagent.ts`, `/hyperagent-callback`, `lib/enhancedImages.ts` | system, admin | Phase 5 pipeline: keep or replace | 5 | ❓ (Q10) | ◐ |
| C-031, A-001 | Site generation: Groq copy extraction (fabricated-testimonial gate), template pick (`autoTemplateFor`), Astro build (~30–60 s), stored HTML draft | `/api/generate-website`, `lib/astro-builder.ts`, `lib/templatePicker.ts` | admin | becomes the build step of the automatic pipeline (N-24); today admin-triggered | 5 | ✅ | ☑ |
| C-032, A-002 | Editor save: one rebuild, republish if live | `/api/save-content`, `websiteContent.ts` | admin | backend for owner editing (N-16) | 6 | ✅ | ☑ |
| BE §5.5 | Admin site editor SandboxEditorV3: Design tab (~71 templates / 18 families, 15 colour schemes, 11 font pairings, role colours, block toggles), Content tab, Media tab, undo / redo, draft recovery, preview unsaved | `components/editor/` | admin | admin keeps it (restyle); owner editing builds on it (N-16) | 6 | 🎨 | ◐ |
| BE §5.4, §5.6 | Template system: `templates/`, `templateCatalog.ts`, field contract (`data-field`…), `templates:sync`, `check:templates`, `public/template-previews/` | repo scripts | system, dev | backend, unchanged; feeds the design picker (N-07) and showcase-as-templates (N-23) | 5 | ✅ | ☑ |
| C-034, A-003 | Publish: permanent slug, `<slug>.sites.tendso.com`, submission → deployed; Worker only for custom domains | `/api/publish-website`, `generatedWebsites.ts`, `lib/siteSlug.ts` | admin | kept; trigger moves to "paid" if Q1 = pay to publish | 3 | ✅ | ☑ |
| C-037, A-014, A-015 | Custom domain: availability + price, Hostinger purchase, DNS, SSL, renewal emails | `domains.ts`, `lib/hostinger.ts`, `/api/check-domain`, `/api/admin/*` | owner (request), admin, system | backend, unchanged; owner .com flow in the app is new (N-15) | 3 | ✅ | ◐ |
| C-038 | Website analytics (page views, contact clicks per site per day) | `analytics.ts` | system | backend; feeds owner Home stats (owner 22) | 3 | ✅ | ☐ |

## 9. Payments & payouts

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-066, C-040, A-008 | Owner pay link + `/pay/[token]`: pending / paid / expired, Wise transfer with ND-XXXX-YYYY reference, 30-day expiry, overseas fold | `/pay/[token]`, `paymentTokens.ts`, `/api/send-website-email` | owner | `pages/pay.html` (ready → pay → waiting → paid → expired); app pay screen is new (N-12); provider Q3; payee details Q35 | 2 | ✅ | ☑ |
| C-041 | Automatic payment match: Wise deposit webhook → reference / amount → paid, creator credited, referral bonus, domain purchase | `/wise-deposit-webhook`, `payments.ts` | system | backend; extend for provider and instalments (Q2, Q3) | 1 | ✅ | ☑ |
| C-042, A-006, A-007 | Manual mark paid / comped (free site, creator still paid) + emails | `/api/mark-paid`, `/api/mark-comped`, `admin.ts` | admin | backend, unchanged | 4 | ✅ | ☐ |
| C-043, A-009 | Payment follow-ups (hourly cron, 48–72 h after email) + agent "remind owner" (1 a day, max 3) | `followUp.ts`, `creatorReminders.ts`, `/api/internal/send-creator-reminder` | system, agent | kept; wording and timing follow Q1 | 7 | ✅ | ☐ |
| BE §4 | Pricing rules: field-agent submissions ₱999–₱4,999; creator codes fixed 30% off (₱3,499); 50% commission, ₱500 domain add-on, ₱1,000 referral, OTR 30%, comped | `packages/shared/pricing.ts`, `convex/lib/paymentPricing.ts` | system | Historical orders keep captured prices and commissions; add an instalment plan (N-13) | 1 | ✅ | ☐ |
| W-047, M-043, M-044, M-045, C-052, C-054 | Creator wallet + withdrawals to Wise: balance, ledger, Wise email setup with invite link, request, status, retries, webhook | `/wallet`; `(tabs)/wallet.tsx`; `withdrawals.ts`, `/wise-webhook` | agent (affiliate shares it) | creator-more 4 Earn home, 5 Cash out, 6 Payouts; Wise setup sheet not drawn: keep. Web keep, restyle | 4 | ✅ | ◐ |
| C-050 | Earnings ledger (submission, referral, lead bonus) | `earnings.ts` | system | backend, unchanged | 4 | ✅ | ☐ |
| C-051 | Saved payout methods (gcash / maya / bank / wise_email; only Wise is paid out) | `payoutMethods.ts` | agent | no UI in mock | 4 | ❓ 🗑 retire? (Q33) | ☐ |
| C-053 | Legacy per-submission payout marking | `admin.markPayoutPaid`, `bulkMarkPayoutsPaid`, `submissions.requestPayout` | admin, agent | legacy | 4 | ❓ 🗑 retire? (Q33) | ☐ |
| M-047 | Wise REST client copied into the mobile source (only its test imports it) | `apps/mobile/services/wise.ts` | nobody | dead in the app | 4 | ❓ 🗑 retire? (Q32) | ☐ |

## 10. Campaigns / giveaways

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-106, C-061 | OTR × Tendso landing: 30% off (OTR30), campaign remembered 30 days, "Get my website" + "Earn" buttons, settings-driven | `/otr`; `lib/campaign.ts`, `pricing.ts` | visitor | `pages/otr.html` (₱3,499, copy code, CTA `/start?campaign=otr`); "Earn" button not drawn: keep | 2 | ✅ | ☑ |
| W-107, W-108, C-060 | 100 free websites giveaway: poster PDF, apply, closed / all-given states, cap 100, one per phone / email, milestone alerts | `/100-pages-giveaway`; `giveaway.ts`, `lib/giveaway.ts` | owner (applicant) | `pages/giveaway.html` (mock route `/libre`; open / closed state from settings) | 2 | ✅ | ☑ |
| W-062 | `/start` poster-proof step (giveaway only) | `PosterStep.tsx`, `GiveawayPrize.tsx` | applicant | start.html `?campaign=giveaway` poster step | 2 | ✅ | ☑ |
| W-109 | OTR giveaway review board (approve / reject with reason, emails owner) | `/otr/review` | OTR reviewer | not in mock: keep, restyle | 4 | 🎨 | ☐ |
| W-110 | `/libre` short address (307 → giveaway) | `app/libre/route.ts` | visitor | keep (mock uses `/libre` as the giveaway page itself) | 2 | ✅ | ☐ |
| W-111, C-039 | `/poster` QR redirector (setting `poster_redirect_target`) + poster pages | `app/poster`, `lib/poster.ts` | visitor, admin | keep (no admin UI for the target: known issue) | 2 | ✅ | ☐ |

## 11. Knowledge & AI

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-003 | "Ask Tendso" chatbot widget (RAG on Help Center, sources, EN/TL) on `/` and `/for-creators` | `components/landing/ChatBot.tsx` | visitor | not drawn; §4E puts it on the new landing + Help | 2 | ✅ | ☑ |
| W-112 | Help Center home: categories, FAQs, contact card, search | `/knowledge` `KnowledgeApp.tsx` | visitor, owner, agent | `pages/help.html` (search, quick chips, 5 topics, answers, "Ask a person") | 2 | ✅ | ☑ |
| W-115 | Ask Tendso AI / Cmd-K palette with grounded answer card | `CommandPalette.tsx`, `AnswerCard.tsx` | visitor | help.html search → AI answer (mock search is local keyword; wire to `knowledgeAI.ask`) | 2 | ✅ | ☑ |
| W-116 | Help Center shell (header, footer, palette frame) | `HelpCenterShell.tsx` | visitor | replaced by the new public shell | 2 | ✅ | ☑ |
| W-113 | Crawlable help article pages (JSON-LD, related, feedback, ISR 1 h) | `/knowledge/[slug]` | visitor, crawlers | mock opens answers in a side sheet; keep article URLs for SEO, restyle | 2 | 🎨 | ☐ |
| W-114 | Creator wiki (gated, noindex) | `/knowledge?ws=wiki` | certified agent, admin | app: creator-more 13 "Field wiki"; web keep, restyle | 4 | 🎨 | ◐ |
| M-061, M-062, M-064 | App Learn: Help Center / Field Wiki home, search, category + article with feedback | `(tabs)/knowledge/*` | agent | creator-more 13 Knowledge home, 14 Article | 4 | ✅ | ☑ |
| M-063 | App Ask AI (chat with history, sources) | `knowledge/ask.tsx` | agent | creator-more 15 Ask Tendso; owners get it too (N-18) | 4 | ✅ | ☑ |
| M-065 | Static Help & FAQ (hard-coded Q&A) | `help-faq.tsx` | agent, affiliate | creator-more 18 Help & FAQ (tabs, rewritten to the price rule) | 4 | ✅ | ☑ |
| C-090 | KB content: help + wiki workspaces, articles, FAQs, feedback, seed | `knowledge.ts`, `knowledgeSeed.ts` | all | backend, unchanged; articles rewritten to §6 facts | 7 | ✅ | ☑ |
| C-091 | Grounded Q&A: keyword-first + Gemini embeddings, Flash chain, query log, rate limit | `knowledgeAI.ts`, `kb.ts` | visitor, owner, agent | backend, unchanged; powers landing, Help and app | 2 | ✅ | ☑ |
| W-023, C-092 | Bring-your-own Gemini key pool (encrypted, rotation, cooldowns) | `/profile?edit=ai`; `aiKeys.ts` | agent, admin | not in mock: keep, restyle | 4 | 🎨 | ☐ |
| W-094, C-093 | Admin "Train AI": unanswered questions, bulk Q&A, re-embed, keys, articles | `/admin/knowledge`; `knowledgeTraining.ts` | admin | keep as is, restyle | 4 | 🎨 | ☐ |
| C-094 | Human escalation loop (Discord thread → Q&A → notify asker / Field Coach) | `escalations.ts` | system | backend, unchanged | 7 | ✅ | ☐ |
| C-095 | External KB API `/kb/search`, `/kb/ask` (owner-engine bots) | `convex/http.ts` | external bots | backend, unchanged | 7 | ✅ | ☐ |

## 12. Notifications & email

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-027, M-070, C-110 | In-app notifications inbox (mark read, deep links to submission / article, certificate modal) + backend | `/notifications`; `notifications.tsx`; `notifications.ts` | agent, affiliate | creator-core 5.1 Notifications; owner inbox is new (N-17) | 4 | ✅ | ◐ |
| M-077 | Push notifications (Expo token registered from creator Home only; foreground banner) | `hooks/usePushNotifications.ts` | agent | keep; also register owners (N-10), affiliates, admins; wire tap → screen | 3 | ✅ | ◐ |
| BE §1.11, A-010, A-012, A-013 | Transactional emails via Resend (approval, payment link, follow-up, confirmation, website live, domain, withdrawal, announcement, creator reminder, intake received, giveaway approved / rejected; booking emails via Gmail) + internal email bridge + test / preview | `lib/email/*`, `/api/internal/send-*`, `/api/send-completed-website-email`, `/api/preview-email` | system | backend kept; copy changes (section "Copy that must change") | 7 | ✅ | ☑ |
| W-093, C-062 | Announcements (email + in-app to segments or named creators) | `/admin/announcements`; `announcements.ts` | admin | keep as is, restyle | 4 | 🎨 | ☐ |

## 13. Backend / system (crons, webhooks, storage, Discord)

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| BE §1.13 | Crons: analytics rollup, auto-unpublish (Q1), call reminders, calendar adoption, payment follow-up, Meet durations, Wise status, stale claims, cancelled bookings, KB escalations, Discord approvals, Discord member sync | `convex/crons.ts` | system | backend, unchanged except auto-unpublish | 5 | ✅ | ☐ |
| BE §1.14 | HTTP actions: `/discord/interactions`, `/airtable-webhook`, `/wise-webhook`, `/wise-deposit-webhook`, `/hyperagent-callback`, `/kb/*`, `/health` | `convex/http.ts` | system | backend, unchanged | 5 | ✅ | ☐ |
| BE §1.15, A-017, A-018 | File storage: Convex `_storage` (site HTML, enhanced images) + Cloudflare R2 (uploads); upload-image, download-media | `files.ts`, `storage.ts`, `r2.ts` | system | backend, unchanged | 5 | ✅ | ☐ |
| BE §1.16 | Settings key / value (giveaway, featured sites, store links, OTR, poster target) | `settings.ts` | admin, system | backend, unchanged | 2 | ✅ | ☐ |
| BE §2 | Schema (40 tables) | `convex/schema.ts` | system | additive changes only (N-25) | 1 | ✅ | ☑ |
| C-019, A-016 | Transcription: Groq Whisper, chunking, status (duplicate in `submissions.transcribeMedia`) | `transcription.ts`, `/api/transcribe`, `lib/mediaChunker.ts` | system | backend; must handle EN / TL / Taglish for the pipeline | 5 | ✅ | ☐ |
| C-020 | Google Drive sync on approve | `drive.ts` | system, admin | backend, unchanged | 5 | ✅ | ☐ |
| C-004 | Discord approvals mirror (#pending-approvals reactions approve / reject) | `approvals.ts` | system | backend, unchanged | 4 | ✅ | ☐ |
| C-100 | Discord `/ask` slash command (wiki RAG) | `discord.ts`, `/discord/interactions` | agents | backend, unchanged | 7 | ✅ | ☐ |
| C-101 | Discord operational alerts (giveaway milestones, unfunded payouts, approvals, escalations) | `discord.ts` | system | backend, unchanged | 5 | ✅ | ☐ |
| C-008 | Outreach tracker (Discord members + outreach log; separate repo on the same deployment) | `outreach.ts`, `outreachAuth.ts`, `discordMembers.ts` | admin team | backend, unchanged: don't break it | 1 | ✅ | ☐ |
| BE §4 | `packages/convex-client` (api re-export for mobile) | `packages/convex-client` | dev | unchanged | 1 | ✅ | ☐ |
| C-021 | Airtable push (legacy AI step; still used by the delete flow) | `airtable.ts`, `/airtable-webhook` | system | legacy | 5 | ❓ 🗑 retire? (Q33) | ☐ |
| A-011, A-022 | Supabase-era routes still called: `/api/send-approval-email` (admin creators + submission page), `/api/process-submission`, `/api/extract-content`, `/api/submissions/[id]/mark-paid` (`hooks/useGroqProcessing.ts`, admin submission page) | `app/api/*` | admin | migrate the live calls, then retire | 5 | ❓ 🗑 retire? (Q33) | ☐ |
| A-021 | Mobile APK download | `/api/download-apk` | visitor | store links replace it (W-096) | 2 | ❓ 🗑 retire? (Q33) | ☐ |

## 14. App-wide infrastructure

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| W-117 | Wildcard host rewrite `*.sites.tendso.com` → `/hosted/<slug>` (skips Clerk) | `proxy.ts`, `lib/siteSlug.ts` | visitor | backend, unchanged (domain Q5) | 5 | ✅ | ☐ |
| W-118, W-119 | Public-route allowlist + auth gate (307 to `/login?redirect_url=`) | `proxy.ts` | all | keep; add new public routes, drop retired ones | 2 | ✅ | ☑ |
| W-121 | Web role router (staff, affiliate, rejected, pending, training) | `lib/creatorGate.ts` | all signed in | keep; add owner | 3 | ✅ | ☐ |
| W-122 | Root layout: Clerk + Convex providers, metadata + Organization JSON-LD, Toaster, Vercel Analytics, PWA | `app/layout.tsx` | all | keep; fix "48–72 hours" metadata | 2 | ✅ | ☑ |
| W-123 | No-op service worker (installable PWA, no caching) | `public/sw.js` | all | keep | 2 | ✅ | ☐ |
| W-126 | Error boundary with reference id | `app/error.tsx` | all | keep, restyle | 2 | 🎨 | ☐ |
| W-128 | Role shells: CreatorShell, OwnerShell, AdminLayout | `components/shells/*` | agent, owner, admin | keep, restyle to new tokens | 4 | 🎨 | ☐ |
| W-129 | Legacy site header (no imports anywhere) | `components/layout/header.tsx` | none | dead code | 2 | ❓ 🗑 retire? (Q32) | ☐ |
| M-073 | Root layout, providers, splash (Clerk SecureStore, Convex, network, account; fonts) | `app/_layout.tsx`, `AppProviders.tsx` | all | keep; fonts → Onest only | 1 | ✅ | ◐ |
| M-074 | Role routing: creator / affiliate / admin homes, shared routes, admin preview, offline role cache, heartbeat | `(app)/_layout.tsx`, `accountAccess.ts`, `useMobileAccount.ts` | all | keep; add owner role + home (N-01) | 3 | ✅ | ☑ |
| M-013 | Account-state gates: blocked / deleted, offline non-creator (owner branch: section 3) | `(app)/_layout.tsx`, `useMobileAccount.ts` | all signed in | keep, restyle | 4 | 🎨 | ☐ |
| M-008, M-009 | Dashboard redirect shim (still the target of ~6 `router.replace`) + 404 handler | `dashboard.tsx`, `+not-found.tsx` | internal | keep | 4 | ✅ | ☐ |
| M-075 | Offline mode + cached sign-in + banner | `NetworkProvider.tsx`, `OfflineBanner.tsx` | agent | not drawn: keep, restyle | 4 | 🎨 | ☐ |
| M-076 | Offline upload queue (info, photos, recording, submit; 7-day expiry) | `hooks/useOfflineSync.ts` | agent | keep; must cover guided photos, new recording and owner capture | 4 | ✅ | ☑ |
| M-078 | Permissions: camera, mic, photos, location, storage; Google Maps key | `app.json` | agent | keep; permission prompts not drawn | 3 | ✅ | ☐ |
| M-080 | Deep links: custom scheme `negosyodigital`; no universal links; push taps not wired | `app.json` | all | keep scheme | 3 | ✅ | ☐ |
| M-083 | Global error boundary ("Auth refresh needed") | `providers/AppProviders.tsx` | all | keep, restyle | 4 | 🎨 | ☐ |
| M-084 | Double-tap navigation guards | `useGuardedRouter.ts`, `useGuardedPress.ts`, `GuardedLink.tsx` | all | keep | 4 | ✅ | ☐ |
| M-085 | External-link + directions helpers | `services/links.ts` | all | keep | 4 | ✅ | ☐ |
| M-086 | Jest suites (no screen tests for capture, leads, knowledge) | `__tests__/**` | dev | keep; add tests for new capture and owner flow | 4 | ✅ | ☑ |
| M-081, M-082 | OTA updates and crash reporting: neither exists (privacy text still promises Expo updates) | n/a | dev | add during the rebuild? | 1 | ❓ (Q4) | ☑ |

---

## ➕ New in the redesign (no current equivalent)

| ID | Feature | Where today | Who | Where in new design | Phase | Target | Done |
|---|---|---|---|---|---|---|---|
| N-01 | Owner path in the app: role choice → owner onboarding → owner home (replaces the M-013 dead end) | none (M-013, M-074 have no owner role) | owner | creator-core 1.1, owner 01–05, 22; flow order Q15 | 3 | ➕ | ☑ |
| N-02 | Owner sign-up / sign-in / forgot / sign out (board has sign-up only) | web owners are passwordless Clerk (C-006) | owner | owner 02; method Q12 | 3 | ➕ | ☑ |
| N-03 | "How to do it": myself (~20 min) or send an agent (~30 min, as low as ₱999) | none | owner | owner 05 | 3 | ➕ | ☑ |
| N-04 | Owner records their own interview in the app: 10 short questions EN / TL + "Anything else?", "Got it" recap with transcript, redo an answer | web `/start` voice only (W-060) | owner | owner 06–08, `TD.interview` | 3 | ➕ | ☑ |
| N-05 | Guided in-app photo camera: 10 tasks per business type, level + feedback chip, Skip, quick capture, own extras (owner and agent) | photos from library only (M-026) | owner, agent | owner 09–10, creator-core 4.2–4.3, `TD.shots` | 3 | ➕ | ☑ |
| N-06 | Photo upgrade before / after: "Use upgrades" or "Keep originals" | none (Studio enhances silently, C-030) | owner | owner 11 | 3 | ➕ | ☐ |
| N-07 | Design picker: real templates already filled with the shop's content, swipe, open the full site, "Use this design" | owner never chooses; admin or `autoTemplateFor` picks | owner | owner 12, landing step 2 | 3 | ➕ | ◐ |
| N-08 | "Mixing" two picked designs into one | none | owner | owner 13 | 3 | ❓ (Q18) | ☐ |
| N-09 | Build progress: real steps from the backend (reading interview, writing pages, polishing photos, building) + "About 20 minutes"; no progress field exists today | status fields only (BE §2) | owner, agent, admin | owner 14, 16; agent "Sent"; schema Phase 1, events Phase 5 | 3, 5 | ➕ | ☑ |
| N-10 | Owner push "Your site is ready to see" | push is creator-only (M-077) | owner | owner 15 | 3 | ➕ | ☐ |
| N-11 | "Ready to check": Looks good / Ask for a change, plus change-request form and status (form not drawn) | edits "requested via /contact" (C-006) | owner | owner 17; behaviour Q17 | 3 | ➕ | ☑ |
| N-12 | Site ready + publish (free address, optional .com, price, included list), in-app pay, Live screen (copy / share URL, counter QR) | web `/pay` only (W-066) | owner | owner 18, 20, 21; provider Q3 | 3 | ➕ | ☑ |
| N-13 | Instalments ₱500 × 10: plan, schedule, reminders, missed month, receipts, commission timing (C-044: none today) | single payment only | owner, system | site-ready, business page, pay.html; mechanics Q2 | 1 | ➕ | ◐ |
| N-14 | Owner home: live site card, visits / Messenger taps, "Make it better" checklist, tab bar | web `/my-business` read-only (W-067) | owner | owner 22; tabs Q21 | 3 | ➕ | ☑ |
| N-15 | Owner custom .com flow in the app (search, price, confirm, DNS state; not drawn) | agent / `/start` request only (C-037) | owner | owner 18 / 20 "optional .com" | 3 | ➕ | ◐ |
| N-16 | Owner editing: switch template (same content), font, colours, texts, photos, reorder / hide sections; mobile tap-a-section editor | admin-only editor (BE §5.5) | owner | owner 19 (headline only drawn), §4D | 6 | ➕ | ☑ |
| N-17 | Owner "Me": settings, delete account, owner notifications inbox (not drawn) | none | owner | mock inventory §5 | 3 | ➕ | ◐ |
| N-18 | Help with AI in the app for owners (agents already have Ask Tendso) | agent-only (M-063) | owner | §4E; creator-more 15 pattern | 3 | ➕ | ☑ |
| N-19 | App language English / Tagalog (M-079: no i18n today); language screen (SIMPLE-FLOWS O2) | English only | owner, agent | EN/TL chip on recording; scope Q20 | 3 | ➕ | ◐ |
| N-20 | Agents near you → book a visit → booked (owner side; agent side not drawn) | booking exists only for recruitment calls (C-073) | owner, agent | owner 23–25 | 3 | ❓ (Q19) | ◐ |
| N-21 | Landing "Hire an agent" short form (mock sends nothing) | none | visitor | `index.html` Paths; destination Q14 | 2 | ➕ | ☑ |
| N-22 | Examples page: filter chips, preview modal (desktop / mobile), "Use this design" | none | visitor | `pages/examples.html`; which set Q23 | 2 | ➕ | ☑ |
| N-23 | Showcase example pages `/examples/<id>` (22 static sites; later real templates) | none | visitor | `showcase/*.html`, captures in `assets/sites/showcase/` | 2 | ➕ | ☑ |
| N-24 | Automatic AI build pipeline, about 20 min: transcript → facts → copy → photo polish (keep original on failed check) → template fill → preview, with progress events | admin clicks Generate after approval (C-031) | system | §4C | 5 | ➕ | ☑ |
| N-25 | Data model additions: instalment plan, build steps / status, design choice, editable font / colour, owner role link, creator city + "how did you hear" | none | system | §8 Phase 1 | 1 | ➕ | ☑ |
| N-26 | Design system v2: tokens for web + NativeWind, Onest, accent `#E4F222` fill-only, shared components, web phone frame, simple-lint gate | mixed editorial / legacy NativeWind styles | dev | `css/tokens.css`, `css/app-kit.css`, `tools/simple-lint.mjs` | 1 | ➕ | ☑ |
| N-27 | Creator onboarding questions: where do you work (city), how did you hear | none | agent | creator-core 1.2–1.3 | 4 | ➕ | ☐ |
| N-28 | Community finds + "Spot a shop" (photo, kind, needs a site, pinned location) | none (paid scrape only, M-039) | agent | creator-core 3.3–3.4; overlap Q29 | 4 | ➕ | ☐ |
| N-29 | Public link page + link editor for every creator (code applied, sites built, "Book Mika") | affiliates only (W-065) | agent, owner | creator-more 7–9 | 4 | ❓ (Q9) | ◐ |
| N-30 | Field-agents earnings calculator (price slider + shops per week, "Example" labels) | none | visitor | `pages/creators.html`; figures Q6 | 2 | ➕ | ☑ |
| N-31 | Earn home: monthly chart (6 months) + "you keep / shop saves" slider | wallet has no chart (M-043) | agent | creator-more 4 | 4 | ➕ | ☐ |
| N-32 | Per-site "Ask the shop" chat; Messenger button / bot | none | shop's customers | §4E v1.1, §4F | after 7 | ❓ (Q11) | ☐ |

Also ➕ in the area tables: W-008 About page, W-013 For businesses page, M-013 owner branch (replaced by N-01).

---

## Copy that must change (§6 facts)

From `inv-strings.md`. F1 = ~20 min same day (not 48–72 h / 24 h / days) · F2 = ₱4,999 once or ₱500 × 10 (not "one-time only", "no monthly", ₱999 as the site price) · F3 = "See it first. Pay once to publish." (not "pay once it's live", "already up") · F4 = agents price ₱999–₱4,999, keep 50% (no unlock, no flat ₱500 / ₱300). **83 hits in 30 files.**

| File | Hits | Facts broken | Legal? | Phase |
|---|---|---|---|---|
| `components/landing/strings/landing.ts` | 17 (11 EN + 6 TL) | F1, F2, F3 | No | 2 |
| `convex/knowledgeSeed.ts` | 14 | F1, F2, F4 | No | 7 |
| `lib/email/templates.ts` | 7 | F1, F2, F3 | No | 7 |
| `components/landing/landingData.ts` | 6 (4 EN + 2 TL) | F1, F2, F4 | No | 2 |
| `app/pay/[token]/_components/PayViews.tsx` | 4 | F2, F3 ("Your site is already up") | No | 2 |
| `app/layout.tsx` | 3 | F1, F2 | No | 2 |
| `app/otr/page.tsx` | 3 | F1, F2, F3 | No | 2 |
| `app/start/thanks/page.tsx` | 3 | F1, F2, F3 | No | 2 |
| `app/start/_components/ReviewStep.tsx` | 2 | F1, F3 | No | 2 |
| `components/landing/strings/forCreators.ts` | 2 (1 EN + 1 TL) | F1 | No | 2 |
| `apps/mobile/app/(app)/submit/review.tsx` | 2 | F4 ("Launch price locked") | No | 4 |
| `apps/mobile/components/UnlockPricingBar.tsx` | 2 | F4 (unlock) | No | 4 |
| `components/landing/strings/shared.ts` | 1 | F1, F3 | No | 2 |
| `components/landing-v2/LandingV2.tsx` | 1 (might) | F3 | No | 2 |
| `app/start/layout.tsx` | 1 | F1, F2, F3 | No | 2 |
| `app/start/page.tsx` | 1 | F3 | No | 2 |
| `app/start/_components/StepRail.tsx` | 1 | F2, F3 | No | 2 |
| `app/otr/layout.tsx` | 1 | F2, F3 | No | 2 |
| `app/submit/success/page.tsx` | 1 | F1 | No | 4 |
| `app/knowledge/_components/creatorFaq.ts` | 1 (might) | F1 | No | 7 |
| `app/my-business/_components/OwnerHome.tsx` | 1 | F3 | No | 4 |
| `app/submissions/_components/SubmissionDrawer.tsx` | 1 | F3 | No | 4 |
| `app/submissions/_lib/derive.ts` | 1 (might) | F3 | No | 4 |
| `app/submit/review/page.tsx` | 1 | F3 | No | 4 |
| `app/submit/_components/flow.ts` | 1 | F3 | No | 4 |
| `app/admin/submissions/[id]/_components/DetailsPanel.tsx` | 1 (internal) | F3 | No | 4 |
| `apps/mobile/app/(app)/help-faq.tsx` | 1 (might) | F4 ("₱999 launch price") | No | 4 |
| `apps/mobile/app/(app)/submit/success.tsx` | 1 (might) | F1 ("review within 24 hours") | No | 4 |
| `app/terms-of-service/page.tsx:105` | 1 | F2 ("one-time payment") | **Yes: flag, don't silently change (Q34)** | 2 |
| `apps/mobile/app/(app)/terms-of-service.tsx:72` | 1 | F4 ("₱500 per approved submission, ₱300 audio-only") | **Yes: flag, don't silently change (Q34)** | 4 |

Not changed (consistent or out of scope): `packages/shared/pricing.ts`, the 50% lines, terms line 61 (50%, ₱999–₱4,999), `LandingV2.tsx:116` and `app/v2/page.tsx:20` ("See it live before you pay"), creator review "within 24 hours", payout "48 hours", Wise "1–2 business days". Stale facts in code comments: `lib/email/service.ts:169`, `lib/email/templates.ts:1460`, `lib/creatorReminders.ts:4`, `convex/creatorReminders.ts:12`.

**F3 is a product change, not only copy:** the code publishes before payment (see Known issues). The F3 strings can only be fixed once Q1 is answered.

---

## Known issues found during inventory

1. **Owner claim flow is half-built.** The payment email mints a claim token (`/api/send-website-email`), `/my-business/claim` drops it, and no UI creates `businessOwners` rows, so new owners can't reach `/my-business` (W-069, C-006).
2. **The app has no owner role.** Owner accounts see "Continue on the web" (M-013); the owner card in `account-setup.tsx` is unreachable.
3. **Sites go live before payment.** `pending_payment` sites are public; emails say "live and waiting"; an hourly cron takes unpaid sites offline after 3 days (C-036). Conflicts with "Pay once to publish".
4. **Supabase-era API routes are still called**: `/api/send-approval-email` (W-075, W-080), `/api/process-submission` (stores `websiteUrl=/preview/<id>`), `/api/extract-content`, `/api/submissions/[id]/mark-paid` (via `hooks/useGroqProcessing.ts` and the admin submission page) (A-011, A-022).
5. **Keys and config in the repo:** Android Google Maps API key committed in `apps/mobile/app.json`; Clerk test publishable key + dev Convex URL in `eas.json` preview/dev profiles; Wise referral link hard-coded in `wallet.tsx`.
6. **Push is registered only from the creator Home.** Affiliates and admins never register a token; tapping a push does not open a screen (M-077, M-080).
7. **Schema vs code drift:** `priceCeiling` / `priceUnlockedAt` retired 2026-10-06 but still in schema; `airtableSyncStatus` is reused for the Studio render status; `generatedWebsites.templateName` is legacy `'astro'` while the real template id lives in `customizations.heroStyle` (`family:CODE`); several enum-like fields are `v.string()` for cross-deploy safety; code comments still say 48–72 h and "unpaid site stays live" (`lib/creatorReminders.ts:4`, `convex/creatorReminders.ts:12`).
8. **Dead pricing UI:** `submissions.getPricingContext` hard-codes `unlocked: true, threshold: 0`, so `UnlockPricingBar` and "Launch price locked" can never be right (M-017).
9. **`/website/[id]` is public with no ownership check** and no inbound links (W-105). `/preview/*` is public at middleware level; the page itself checks ownership.
10. **`/login` ignores `redirect_url`** that `proxy.ts` appends (W-014, W-119).
11. **Quiz differs by platform:** web 5 questions (pass 4/5), app 6 questions (pass 4/6) (W-031, M-050).
12. **Duplicate transcription code** (`transcription.ts` and `submissions.transcribeMedia`) (C-019).
13. **No per-step build progress**, no owner template / font / colour choice, no instalments, no owner self-edit (BE §2, C-044).
14. **`/poster` target setting has no admin UI** (W-111). Stale "Unlinked by design" comment on `/field-agent/book`, which `/for-creators` and admin link to (W-049).
15. **Web sign-up is contradictory:** `/otr` says it's being retired, `/for-creators` still sends people to `/signup` (W-015).
16. **Mobile gaps:** no i18n, no OTA updates (privacy text still mentions Expo "updates"), no crash reporting; photos from library only; Discover map passes results as JSON in the URL (code says the DB read "has been unreliable in prod"); admin can't play interview media; legacy NativeWind styling on 6 screens; Profile "Manage your notification settings" opens the inbox (there are no settings) (M-040, M-058, M-066, M-079, M-081, M-082).
17. **Web gaps:** no cookie / consent banner anywhere; root metadata still says "48–72 hours"; `robots.ts` disallows `/connect-ai` (a redirect) but not `/leads`, `/profile`, `/my-business` (some have per-page noindex) (W-122, W-124).
18. **Saved payout methods** gcash / maya / bank exist in the schema, but only Wise is paid out (C-051).
19. **Two storage systems:** Convex `_storage` and R2; old submissions keep legacy storage ids (BE §1.15).
20. **Legacy brand ids:** app scheme / bundle `negosyodigital` / `com.negosyodigital.app`; mock pay page shows payee "VONAS, OPC" and `support@negosyo.digital`.
21. **Mock is ahead of its docs:** boards render 25 / 22 / 19 = 66 screens vs 32 in SIMPLE-FLOWS; `simple-lint` passes 1 of 66 screens (HANDOFF.md says all pass); `hub.html` and mock `HANDOFF.md` list 5 pages, 11 exist.
22. **Outreach tracker** (separate repo) shares this Convex deployment (`outreach*`, `discordMembers`): schema changes must not break it (C-008).
