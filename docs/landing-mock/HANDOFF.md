# Tendso design v2 — handoff for the build agent

Prepared 2026-10-20/21 for Theo's approval, then production. Everything here is a working HTML/CSS/JS
prototype in `docs/landing-mock/`. It is the visual and motion source of truth; it is NOT production code.
Open `hub.html` for the index of every deliverable. Press **R** (or the "Review mode" switch) on any page
to outline proposed app screens.

**RULE #1 — NEVER OVERWHELM (overrides everything below).** The app must be grandmother-simple: one thing per
screen, one big button, ≤20 words (camera ≤12), ≤3 controls, ≤4 answer options, nothing under 16px, one
language at a time. The exact screens and every word are in `SIMPLE-FLOWS.md`; every phone screen must pass
`node tools/simple-lint.mjs <page>` (all pages pass today). Run the same check locally on the RN app
screens (Storybook or screenshots) before merging; no CI needed.

Read with: `SIMPLE-FLOWS.md` (exact app screens), `BRIEF.md` (house rules), `APP-SYSTEM.md` (v4 rule #1 at the end
overrides earlier sections), `APP-SCREENS-SPEC.md` (old source mapping, for data fields only).

---

## 1. Deliverables

| Deliverable | File | Status |
|---|---|---|
| Landing page (desktop + mobile, motion prototyped) | `index.html` | done |
| For businesses | `pages/business.html` | done |
| Examples gallery (browse designs, no sign-up) | `pages/examples.html` | done |
| For creators & field agents | `pages/creators.html` | done, follows production money policy |
| About / team | `pages/about.html` | done, placeholder people |
| Owner app (DIY + book an agent), 19 screens | `app/owner.html` | done, mostly proposed screens |
| Creator app core flows, 24 screens | `app/creator-core.html` | done, all from real source |
| Creator app account/money/learning, 23 screens | `app/creator-more.html` | done, all from real source |
| Shared app screens (used on landing + boards) | `js/screens.js`, `css/screens.css` | done |
| App design kit v2 | `css/app-kit.css` | done |
| Stage 1 study (ramp.design, Klarna, Agentcard) | https://claude.ai/artifact/CVgk9ZHx7iGxZbJcvZPw59 | done |

---

## 2. Accent token

```css
--accent: #E4F222;          /* sampled from ramp.design's --solar, pixel-verified */
--accent-hover: color-mix(in oklab, var(--accent) 78%, white);
--accent-soft:  color-mix(in oklab, var(--accent) 22%, white);
--on-accent: #0C0A08;
```
One token. Every other accent shade derives from it (landing `css/tokens.css`, app `css/app-kit.css`
reads the same `--accent`). Rules: fills only (buttons, progress, selected state, one marker per view);
always ink text on it (16:1); never yellow text or lines on light backgrounds (1.2:1). Yellow text is fine
on the dark ink surfaces (welcome screen, recording panel).

## 3. Type and other tokens (`css/tokens.css`)
- Landing: **Onest** 400/500/600 (the app's own body face) for everything; **JetBrains Mono** 500 for tiny
  uppercase labels (letter-spacing .08em). Display = Onest 500, tracking −0.045 to −0.065em, line-height .86–.98.
- App (v3, Theo 2026-10-21): **Onest only**, the same font as the homepage. No serif, no italics, no mono
  inside the app. Layouts follow the approved **Round 2** mobile sheet (design canvas artboards R2-O1…O7,
  R2-F1…F4; copies in `ref/round2/`): bold rounded headlines, pill buttons, soft white cards, one question
  per screen, photo option rows, Pinterest design picks, "Make it better" checklist, agent map/feed/earn/link.
  See APP-SYSTEM.md section "v3 — Round 2 language" and kit v3 at the bottom of `css/app-kit.css`.
- Sizes: hero `clamp(44px, 6.4vw, 104px)`; moment `clamp(64px, 12vw, 210px)`; h2 `clamp(36px, 5vw, 72px)`;
  tile title `clamp(22px, 2vw, 28px)`; body 17/16px.
- Neutrals: canvas #FFFFFF, stage #F2F3F1, quiet tile #F7F7F5, line #ECECE8, ink #0C0A08, ink-2 #4A4943,
  muted #8C8B84, dark #121210.
- Radii: tile 40px (28px under 760px), card 20px, pill. Page padding `clamp(16px, 3.3vw, 48px)`, max 1440.

## 4. Motion system
Physical, calm, ends slow. No bounce, no overshoot. Reveals combine opacity + blur + small rise.
| Token | Value | Use |
|---|---|---|
| `--ease-out` | cubic-bezier(.22, 1, .36, 1) | default for almost everything |
| `--ease-expo` | cubic-bezier(.16, 1, .3, 1) | reveals, long settles, sheets |
| `--ease-inout` | cubic-bezier(.77, 0, .175, 1) | moves that start and stop together (before/after sweep, inner site scroll) |
| `--d-ui` | 220 ms (160–280) | hover, press |
| `--d-reveal` | 620 ms (420–620) | opacity/blur of reveals |
| `--d-settle` | 900 ms | transforms of reveals, object moves |
| `--blur-in` | 14 px | starting blur of reveals |

- **Smooth scroll:** Lenis 1.1.x, `lerp: 0.085`, `wheelMultiplier: 0.9`, no touch sync. Every scroll-linked
  effect reads the smoothed value in one shared rAF loop (`js/core.js`).
- **Reveal:** elements with `data-reveal` below the first screen start at opacity 0, blur 14px, y +18px and
  settle when 12% visible (rootMargin −6% bottom). Stagger 70 ms via `--i`. Anything visible at load is
  shown immediately (no flash).
- **Reduced motion:** no smooth scroll, orbit frozen, loops show their end state, people cloud static,
  all CSS transitions 1 ms.

## 5. Landing storyboard + motion spec (`index.html`)

| # | Section | Purpose (one line) | Phones / screens | Motion |
|---|---|---|---|---|
| 0 | Nav | Tiny; one accent action | – | At scrollY > 30: height 84→60 px, background canvas 88% + blur 14 px, 620 ms ease-out |
| 1 | Hero | Live homepages + the app that made them; "The thinking ends here." + Download the app | Centre phone: `interview-rec` (owner copy). Ring: 4 desktop sites in browser cards + 2 phones with mobile sites (`site-browser`) | Orbit (below) |
| 2 | Collapse | The whole stage shrinks into the first grid tile and keeps living there | same | Collapse (below) |
| 3 | Tiles | What goes into a homepage: Words, Images, Cost, Humans | each tile has a phone with the real step | per tile (below) |
| 4 | Moment | "Pay only when it's live." | – | reveal |
| 5 | Steps | Five steps, one phone (Klarna/Agentcard pattern) | pinned phone: welcome → design-picker → interview-rec → photos → site-ready | Steps (below) |
| 6 | Paths | Download (accent, QR + stores) · Hire someone (short form) · Join our team | – | staggered reveal, hover lift 2 px |
| 7 | People | Ramp "Beyond the work": cloud of people at two depths around a big headline; photos open case studies | – | People (below) |
| 8 | Footer | Huge wordmark, Download + Hire | – | reveal |
| – | Work overlay | Case studies: desktop + mobile site, before/after | – | sheet slides up 700 ms expo; Esc closes; page scroll paused |
| – | Tile detail | Click a tile: the step large in a phone + 3 lines + CTAs | large phone with the step's screen | scrim 620 ms; card blur 12→0, y 24→0, scale .98→1 |

**Hero v2 (`js/hero.js`, Theo 2026-10-21: calm, symmetric).** One phone, centred and upright (width 30% of
viewport height, 220–280 px; mobile 46% W), breathing ±6 px (period 7.9 s), pointer parallax ±10 px / ±4°.
One loop = 24 s:
| t (s) | what happens |
|---|---|
| 0–5.2 | phone shows the interview: a real person on camera (`interview-cam`, clip `assets/video/interview-1.mp4`, muted), question card over the video |
| 5.2 | the Tendso buddy (`assets/brand/buddy.png`, accent yellow) pops in at the phone's lower right: opacity 0→1 500 ms, scale .6→1 + y 16→0 800 ms expo; then bobs (2.6 s alternate) |
| 5.6–7.6 | speech bubble types "Got it. I'll build your website." with a caret |
| 7.9–9.9 | loading bar fills inside the bubble (ease in-out) |
| 9.9 | phone screen cross-fades to the finished Kalan site (700 ms) and scrolls slowly (9 s) |
| 10.1–11.6 | four homepages slide out from behind the phone into mirrored slots (inner pair first, outer pair +180 ms): scale .55→slot, blur 12→0, 1.3 s expo. Inner pair: ±(phone/2 + 0.46·card), y −46, scale 1, rotateY ±12°. Outer pair: ±(phone/2 + 1.18·card), y +70, scale .78, blur 2.5 px, rotateY ±18°. Pairs float with the same phase (±7 px, 11.4 s) so the layout stays symmetric |
| 11.4 | bubble reads "Done. Here's your site." |
| 15.5 | bubble and buddy leave |
| 22.5–23.6 | homepages retract behind the phone, phone returns to the interview, loop |
Reduced motion: the end state (site in the phone, four homepages placed), no loop.

**Collapse.** Scroll 0 → 0.9·vh. p = easeOut(progress). Stage rect = lerp(viewport, slot rect, p), radius
0 → 40 px; the world inside keeps its full-screen layout and is scaled to cover the stage box ×
lerp(1, 0.86, p). The headline + CTAs fade in the first 38%: opacity 1→0, blur 0→10 px, y 0→−24 px. At
progress 1 the stage is re-parented into the slot (absolute, inset 0), so it scrolls natively with the
grid; scrolling back reverses. The stage sits above the grid while shrinking (reveals the tiles).
Production note: implement the stage as a single fixed layer whose box is driven by one progress value;
keep the orbit running inside the tile (it is the first tile's "living thing").

**Grid.** 12 columns, gap `clamp(12px, 1.7vw, 24px)`. Row 1: stage 7 + Words 5 (height clamp(520px,
66vh, 640px)). Row 2: Images 5 + Cost 7 (580 px). Row 3: moment 12. Row 4: Humans 12 (600 px). Mobile:
one column; stage 74svh.
Tiles play when 25% visible and pause when out. Hover: the one-line explanation blurs in (ink card,
620 ms), the phone lifts 8–10 px (900 ms expo). Click/Enter: tile detail sheet.
- **Guided capture (Theo 2026-10-21) — the main feature.** Interview = **10 super-simple questions**, one at a
  time, then "Anything else you want to say?" (`TD.interview`, English + Tagalog). Recording screen
  (`interview-cam`, v4): full-bleed camera, **no outline of any kind**. Top: close · REC timer + mic meter ·
  language chip (EN/TL). Under it a 10-step progress bar. The app checks the framing once: a level bar in the
  middle (tilted → straight + accent) and a hint chip ("Hold the phone straight" → "Good. Start talking"), then
  the questions start. The question sits low like a subtitle, white with a text shadow only, no box; "4 / 10"
  above it. Bottom: pause (68 px, small) + "Next question" pill (fills the rest, the biggest control; "Finish ✓"
  on the last one). No white anywhere while recording.
  Photos = **10 guided shots** chosen for the kind of business (`TD.shots.barber|repair|food|salon`) as tasks.
  Photo camera (`shot-guide`) has the same layout: close · "Shot 3 of 10" · flash; level bar + feedback chip
  ("Step back a little" → "Perfect, hold still"); task title + hint low as a subtitle; a strip of the 10 shots
  (done ones show the photo); last photo · white shutter · Skip. No ghost outlines, no grid. Then any
  extra photos the owner thinks matter (`shot-list`, `shot-guide`). The website says so in the steps
  ("10 simple questions", "10 guided shots") and the Words / Images tiles.
- **Interview clips:** `assets/video/interview-1.mp4` (carinderia cook, Marikina), `-2` (barber, Manila),
  `-3` (sari-sari owner); Seedance 2.5, 9:16, 8 s, Tagalog speech; always muted on the website (autoplay
  muted, playsinline, loop), poster `.jpg` beside each.
- **Words** (loop 11 s): 0–5.2 s a 28-bar waveform moves (|sin(t/170 + i·0.7)·sin(t/410 + i·0.31)|);
  0.5–5.2 s the owner's sentence types out (TD.words.transcript) with a caret; 5.8–10.4 s the site card
  with the headline that came from it ("Cooked slow. / Served warm. / Eaten together.") blurs in, lines
  250 ms apart. Phone: `interview-rec` (owner copy) — its timer counts, questions change every 4.5 s.
- **Images** (cycle 9 s): before/after split; hold on phone photo (15%), wipe to the re-shoot (30%,
  in-out), hold (30%), wipe back. Draggable; a drag pauses the auto-sweep for 4 s. Phone: `photos`.
- **Cost:** two lines over 36 months — Tendso ₱4,999 once vs a monthly plan (₱500/₱900/₱1,500 chips,
  ₱900 default = PLACEHOLDER until Theo confirms). Draw 2.6 s ease-out on first view and on chip change;
  crossover dot + "Month 6"; big number "Kept by year three" counts toward 36·fee − 4,999 (lerp 0.12/frame,
  tabular figures). Phone: `site-ready`.
- **Humans:** quiet vector town (no map tiles); agent pins drop in (fade 500 ms, scale .6→1 700 ms expo,
  200 ms + 140 ms stagger), "Your shop" ping 2.2 s, dashed route 2.4 s linear loop; agent photo card;
  phone: `agents-near`.

**Steps (`js/steps.js`).** Track height n·62vh + 100vh (mobile 70vh), sticky 100vh pin. pos = progress·5.
Within each step the next screen enters during local 0.65→1 (ease-out): y 100% → 0. The current screen
scales 1 → 0.9 (origin top) and dims to 55% ink. Active step switches at local > 0.82. Active heading turns
ink (620 ms); its one line opens (grid-rows 0fr→1fr, 900 ms expo, blur 6→0). Rail dot 5 → 26 px. Step
buttons scroll to that step (Lenis 1.4 s expo). The active step's screen restarts its own animation.
Mobile: phone pinned at the top (≈26svh wide), list underneath, no rail.

**People (`js/people.js`).** Section 220vh (mobile 200vh), sticky stage. 16 desktop / 10 mobile photos with
fixed positions (x, y as fractions of the stage), widths, speeds `sp` (front 0.95–1.2, back 0.55–0.75) and
drifts. d = scroll past the middle of the pinned stretch; translate = (x·W + d/vh·dx·W, y·vh − d·sp),
rotate r + d/vh·r·0.35. Layer 0 sharp; layer 1 smaller, blur 3–6 px, opacity .7, behind the headline.
Photos with a `work` id are buttons that open the Work overlay at that business.

## 6. Components

Landing / web (`css/base.css` + section files):
- Nav (fixed, tightens) · Button (`.btn--accent`, `.btn--line`, `.btn--ink`, `--sm`) · Store button (black)
  · Store icon pair · Label (mono) · Tile (`.tile`, `--quiet`, `--dark`, 40 px radius) · Reveal
  (`data-reveal`, `--i`) · Phone frame (`T.phone`, `css/phone.css`; screen authored at 390×844, scaled)
  · Browser card (hero) · Hero stage + orbit · Tile: Words / Images (before/after split) / Cost (chart) /
  Humans (vector map, pins, route) · Moment (big type) · Tile detail sheet · Step slider (pinned phone,
  layered screens, list, rail) · Path tiles (download with QR, hire form with chips + inline validation +
  confirmation, join rows) · People cloud · Work overlay (case study: browser + phone + before/after) ·
  Footer (fitted wordmark) · Review-mode switch (mock only).
- Pages add: FAQ accordion, example card + preview modal (desktop/mobile toggle), filter chips, earnings
  tiles (creators, no peso earnings), team grid, city tags.

App kit (`css/app-kit.css`, classes under `.app`): `.a-label`, `.a-display` (sm/md/lg + `em`),
`.a-body-*`, `.door` (solid / `--accent` / `--ghost`, caption + label + icon), `.a-pill`, `.a-chip`
(ok/info/warn/danger/muted), `.a-card` (`--lg`, `--dark`), `.a-rule`, `.a-back`, `.a-progress`
(`--accent`), `.a-live`, `.a-field`, `.a-ic`, `.a-avatar`, `.a-footer`, `.a-tabbar` + `.a-tab` +
`.a-tab--main` (accent centre tab), `.a-home`.
App screens (`js/screens.js`): welcome · interview-rec (`owner` option) · photos (`owner` option) ·
design-picker* · site-ready* · agents-near* · site-browser (* proposed). API:
`TendsoScreens.mount(el, name, opts) → { play, pause, reset, set, destroy }`.

## 7. Assets (`assets/`)

| Folder | What | Status |
|---|---|---|
| `sites/<id>-d.jpg`, `-d-long.jpg`, `-m.jpg`, `-m-long.jpg` | Tendso's own v4 site templates (Kalan, Héla, Vulca, Domingo, Labaná, Kalasag) rendered with generated photos | sample output; replace with real customer sites when available |
| `sites/examples/` | more real Tendso templates for the Examples page | template renders |
| `photos/` | site photography + before/after pairs (tapsilog at Kalan; mechanic at Vulca) | generated (Higgsfield GPT Image 2.5 / Nano Banana 2.1); "after" = same subject re-shot commercially |
| `people/` | field agents, owners, team (Filipino first; Lisbon + Nairobi as worldwide touch) | generated placeholders — replace with real team/agent photos |
| `brand/mark-ink-256.png`, `app-icon-256.png` | Tendso mark (from apps/mobile/assets) | real |
QR codes are drawn patterns (placeholder). Store links are placeholders (`TD.links`).

## 8. Production alignment (checked against the repo on 2026-10-20)
- Money copy follows `packages/shared/pricing.ts` + `components/landing/strings/*`: website ₱4,999 one-time,
  "Pay only when it's live", "as low as ₱999 when a Tendso creator signs you up", no monthly fees,
  no card on file, free edits for the first year, custom .com optional. Sites are live in **48–72 hours**.
- No unlock threshold (removed 2026-10-06): creator price band ₱999–₱4,999 from the first site, 50% share,
  payouts to Wise. Recruiting pages never quote peso earnings, a per-site amount, a referral figure or a
  calculator. The landing page never shows creator-pay wording.
- Naming: production says "Tendso creator"; Theo's brief says "field agent". The designs use "field agent
  (a Tendso creator)" once per page, then "agent". Decide one term before build.
- App source still carries the old rule — fix in apps/mobile: `help-faq.tsx` item 8 (first 5 locked at
  ₱999), `terms-of-service.tsx` §5 (₱500/₱300 on approval), `PriceSlider.tsx` locked "Launch price" state,
  and the home "Unlock higher pricing" meter.
- Icons: boards use Lucide as a stand-in for the app's Ionicons. Map back: arrow-left→arrow-back,
  arrow-right→arrow-forward, chevron-left/right→chevron-back/forward, x→close, check→checkmark,
  camera→camera-outline, map-pin→location-outline, mic→mic, wallet→wallet-outline, home→home-outline.

## 9. App redesign — how to apply in apps/mobile
0. Fonts: drop Instrument Serif and JetBrains Mono from the app; Onest 500/600/700 everywhere (labels 12/600,
   headlines 700 at 26–30px). Rebuild screens on the Round 2 patterns (kit v3 classes map 1:1 to RN components:
   StepHeader, AskBubble, OptionRow, CheckRow, SectionLabel, DesignPickCard, PillButton).
1. Replace colour values in `apps/mobile/theme/tokens.ts` per the APP-SYSTEM.md mapping (paper→#F5F5F2,
   paper2→#ECECE7, paper3→#FFFFFF, ink→#0C0A08, ink2→#45443F, ink3→#8A8982, rule→#E3E3DD,
   ruleStrong→#C4C3BB, accentSolid→#E4F222 with ink text, accentBg→accent-soft).
2. Gold-as-text (`accent` used for italic headline words, links, labels) → ink2/ink. Never yellow text on light.
3. Primary Door on each screen → accent fill + ink text; centre SUBMIT tab → accent fill.
4. Welcome screen: #0C0A08 + accent badge/line/button.
5. Remove remaining emoji/sparkles; knowledge topic tiles neutral.
6. Owner mode (new): see `app/owner.html` — choose-your-way, owner copy on interview/photos, building
   (48–72 h), live preview, edit, pay once, live, my site, book an agent. All marked proposed.

## 10. Open decisions for Theo
0. **Facts corrected by Theo (2026-10-21):** the site is ready the SAME DAY, about 20 minutes after the interview and
   photos (not 48–72 hours). "Pay only when it's live" is wrong; copy says "See it first. Pay once to publish."
   Still to confirm: whether the owner pays before publishing or after.
1. Monthly price to compare against in the Cost tile (placeholder ₱900/mo, chips ₱500/₱900/₱1,500).
2. App Store / Google Play links; real QR.
3. "Field agent" vs "Tendso creator" as the public name.
4. Real people photos for the people cloud, team grid and creators page.
5. Owner app tab bar: 5 tabs (Home, Site, Help, Inbox, Account) or 4.
6. Agentcard reference URL (only seen as a screenshot).
