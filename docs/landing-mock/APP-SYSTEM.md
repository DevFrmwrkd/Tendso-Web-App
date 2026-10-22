# Tendso app design system v2 (redesign brief)

Theo, 2026-10-20: the current app design is good except the colours. Redesign the WHOLE app in the new
brand: keep the structure, layout, typography and component shapes of apps/mobile ("Editorial Paper"),
change the colour system to the new brand. Kit: `css/app-kit.css` (read-only for agents; ask the lead
for changes). Use it for every app screen, on the landing and on the app boards.

## Mapping old → new
| old (apps/mobile/theme/tokens.ts) | new (app-kit.css) |
|---|---|
| paper #F8F5EE screen bg | --a-bg #F5F5F2 (clean neutral, no cream) |
| paper2 #EFEBE0 | --a-bg2 #ECECE7 |
| paper3 #FCFAF5 cards/inputs/tab bar | --a-card #FFFFFF |
| ink #1B1C24 / ink2 / ink3 | --a-ink #0C0A08 / --a-ink2 #45443F / --a-ink3 #8A8982 |
| accent gold #C89548 (italic headline word, links, progress) | italic word → --a-ink2 (in `.a-display em`); links → ink, underlined; progress → ink or accent |
| accentSolid #E4B05E (accent buttons, slider, welcome gold) | --a-accent (#E4F222) as a FILL with ink text. Never yellow text/lines on light backgrounds. Yellow text is OK on the dark ink panels / dark welcome screen. |
| accentBg #F5E4C0 / accentInk (success chips, tints) | --a-accent-soft + ink text (`.a-chip--ok`) |
| business #1F3654 / businessBg | --a-info / --a-info-bg (unchanged hue) |
| warn, danger | --a-warn, --a-danger (record button stays danger red) |
| tab bar centre SUBMIT: ink rounded rect | accent-filled rounded rect, ink icon + label (`.a-tab--main`) |
| welcome screen: #0a0a0a + gold | #0C0A08 + accent (badge fill, last headline line, button fill with ink text) |

Rules: one accent fill per screen region at most (primary action, progress, selected state). Keep the
serif display + italic second line; keep mono uppercase labels; keep Door buttons (solid / accent / ghost).
Primary CTA on a screen = `.door--accent`; secondary = `.door` (solid ink) or `.door--ghost`.

## Icons
Use Lucide (loaded from `https://cdn.jsdelivr.net/npm/lucide@0.453.0/dist/umd/lucide.min.js`):
`<i data-lucide="mic"></i>` then call `lucide.createIcons({ attrs: { 'stroke-width': 1.8 } })` after rendering.
Lucide stands in for the app's Ionicons; the handoff maps names back (mic→mic, camera→camera-outline,
arrow-left→arrow-back, chevron-right→chevron-forward, x→close, check→checkmark, map-pin→location-outline…).

## Copy rules
- App screens may show creator earnings (the app is for creators too). The LANDING PAGE may not.
- Owner-facing screens never mention commission or creator pay.
- Keep real copy from the source files wherever a screen exists; mark new screens `data-proposed="true"`.
- Prices (lib/pricing.ts): base ₱999, ceiling ₱4,999, creator commission 50%, unlock after 5 approved,
  custom domain add-on ₱500 (domain registrar price shown in review), referral bonus ₱1,000.
  Owner-facing marketing price: ₱4,999 once.

## Boards
Each app agent builds a board page: a row of phones per flow, step labels above each phone in mono,
thin arrows between phones, one-line annotation under each, and proposed screens flagged. Boards live in
`app/` and load: Google Fonts (Onest, JetBrains Mono, Instrument Serif), css/tokens.css, css/base.css,
css/phone.css, css/app-kit.css, Lucide, js/core.js, js/data.js, then the agent's own files.

---

## v3 — Round 2 language (Theo, 2026-10-21) — THIS SUPERSEDES THE LOOK ABOVE
Theo: "change the font on the smartphone, I do not like this magazine font, keep the same as the homepage"
and "take our newer design from the new mobile design sheet". The newer sheet = the approved **Round 2**
artboards on the design canvas (copies in `ref/round2/`: R2-O1…O7 owner, R2-F1…F4 field agent). Rebuild the
app in Round 2's layouts and patterns, in the new brand:
- Font: **Onest only** (same as the homepage). No serif, no italics, no mono labels inside the app.
- Headlines bold (700), rounded and friendly: 26–30px, tracking −0.6 to −0.8px. Small grey 12px/600 labels.
- Buttons: full-width pills, centred label (`.door` / `.door--accent` / `.door--ghost` now render as pills).
- Cards: white, borderless, soft shadow, radius 18–24. Screen background #F6F6F3 or white.
- Patterns from Round 2 (kit v3 classes in `css/app-kit.css`): `.a-step` (back · progress · "2 / 4"),
  `.a-bubble` (Tendso asks ONE question — the ink Tendso ring mark `../assets/brand/mark-ink-256.png`
  instead of the mascot), `.a-opt` + `.a-tick` (photo option rows, one selected), `.a-check` (checklist
  rows "Make it better"), `.a-sec` (small centred section label), `.a-pick` + `.a-pick-n` + `.a-pick-cap`
  (Pinterest design cards, numbered picks, caption "Cozy · 2.1k shops"), `.a-pill` (filter chips).
- Colour: Round 2's lilac/gradients become the new brand: neutral + ONE accent #E4F222 as fills with ink text
  (primary pill, selected tick, progress optional, active tab pill). Never yellow text on light. No gradients.
- Drop from Round 2: the mascot, "Rosa's Bakery" (rejected), "Pay monthly / 5 × ₱1,000" (production is pay
  once), "Wix ~₱32,000" (unverified). Keep production facts (48–72 h, pay only when it's live, ₱4,999, as low
  as ₱999 via a creator, free edits for a year, Wise payouts, no unlock rule).
- Interview + photos are core steps Round 2 didn't draw: design them in the same language.

---

## v4 — RULE #1: NEVER OVERWHELM (Theo, 2026-10-21) — overrides everything above
"Simple as hell. An app that everyone can handle, even a grandmother." Round 2 (purple) is the bar for
simplicity. Every app screen must pass `node tools/simple-lint.mjs <page>` (it measures each phone):
- **One thing per screen.** One question OR one task OR one result. One big primary button.
- **≤ 20 words per screen** (camera screens ≤ 12), status bar excluded. Count before you add anything.
- **≤ 3 tappable controls** (back, primary, at most one text link). Answer choices count apart: **≤ 4**.
- **No text under 16px.** Headline 28–32px bold, body 17–18px. No tiny grey labels, captions, eyebrows,
  "1 / 4" step text, chips, tags, counters, hint lines, sub-captions, footnotes, legends, filmstrips.
- **One language at a time** (the user picks Tagalog or English once; never both stacked).
- **Progress = one thin bar at the top.** Nothing else.
- **Lists:** at most 4 rows on a screen. Never show 10 of anything; show the CURRENT one ("Photo 5 of 10"
  becomes just the task + a thin progress bar).
- **Camera screens:** the person or the subject, the question or the task in one big line, and one button.
  Framing help = only the outline turning yellow when it's right. No level lines, hint pills, language pill.
- **Cut, don't shrink.** If it doesn't fit at 16px+, it doesn't belong on this screen.
- Fewer screens too: merge steps a grandmother wouldn't miss.
