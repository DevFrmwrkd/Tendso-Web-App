# TENDSO REBRAND — Implementation Spec

> **Audience:** the mobile-platform agent (and any future agent touching brand surfaces).
> This documents exactly what was done on the web platform (`negosyo-digital` repo,
> branch `feature/tendso-rebrand-and-gold-palette`) so the **same rebrand can be
> replicated 1:1 on the mobile app (`ndm`)**. Follow the mapping tables — they are
> the contract. Where the mobile codebase differs structurally, match the *intent*
> described in each section.

---

## 1. What the rebrand is

| | Old | New |
|---|---|---|
| **Brand name** | Negosyo Digital / "Negosyo" | **Tendso** (one word, no "Digital" suffix anywhere) |
| **Tagline** | "Empowering Filipino businesses" | **"The Thinking Ends Here. So the work doesn't."** |
| **Campaign frame** | — | **"Hands Full"** — hands-as-hero, the page is built around the work |
| **Primary color** | Emerald green family | **Warm gold / burnt amber family** (full palette below) |
| **Logo** | old square `logo.png` mark | **`tendso-logo.png`** — white TENDSO wordmark, 494×89, transparent bg |

The brand voice comes from the Tend "Hands Full" treatment PDF. Core ideas to
preserve in any copy you touch:

- The user's hands are full — of tools, dough, customers, kids. **Never** make them
  look helpless or technically incapable; they have more important things to think about.
- The product removes the forced pause (blank page, template picker, font menu).
  "A photo. A few answers. A guided page, reviewed and ready to go live."
- The enemy is the blank start. The page **comes from the work**; the work never
  stops for the page.
- Endings are relief, not celebration. The page goes live; the hands go back to work.

---

## 2. Color palette — exact mapping table

**FULL-GOLD model.** Green is fully retired — including success states, "Approve"
buttons, "Paid" pills, live-dots, map pins. Everything that was green is now gold.
(An earlier hybrid plan kept success-green; that decision was **superseded** — do
not keep any green on mobile either.)

### 2a. Hex-for-hex replacements (apply case-insensitively)

| Old (green) | New (gold) | Role |
|---|---|---|
| `#10B981` | `#E4B05E` | primary solid / warm gold (Tailwind `emerald-500` equiv) |
| `#059669` | `#C89548` | deep accent / burnt amber (`emerald-600`) |
| `#047857` | `#C89548` | deep accent / burnt amber (`emerald-700`) |
| `#064E3B` | `#5C3A0F` | dark ink on gold surfaces (`emerald-900`) |
| `#065F46` | `#6B4A12` | dark accent (`emerald-800`) |
| `#34D399` | `#E8C078` | light accent (`emerald-400`) |
| `#6EE7B7` | `#F2D8A0` | pale accent text (`emerald-300`) |
| `#D1FAE5` | `#F5E4C0` | pale accent background (`emerald-100`) |
| `#ECFDF5` | `#FBF3E0` | faintest accent wash (`emerald-50`) |
| `#3FA86A` | `#D9A84E` | "live" pulsing-dot green → deep gold |
| `#D4EFDE` | `#F5E8CC` | "live" soft background |
| `#00FF66` | `#E4B05E` | old neon theme-color (manifest/meta) |
| `#06B6D4` | `#A67836` | cyan used inside old green gradients |
| `#052E16` | `#3D2608` | darkest green bg (email badges) |

### 2b. Tailwind class mapping (if mobile uses NativeWind/Tailwind)

- `emerald-N` → `amber-N` for every N (50…900), in every variant
  (`bg-`, `text-`, `border-`, `hover:`, `from-`, `to-`, `shadow-`, `selection:` …).
- `green-N` → `amber-N` likewise.

### 2c. oklch values (web landing used these; map if mobile has equivalents)

| Old | New | Role |
|---|---|---|
| `oklch(45% 0.12 150)` | `oklch(62% 0.115 80)` | creator accent (map pins, accents) |
| `oklch(28% 0.08 150)` | `oklch(38% 0.085 75)` | creator accent ink |
| `oklch(92% 0.04 150)` | `oklch(93% 0.045 85)` | creator accent bg (light) |
| `oklch(28% 0.08 150)` (dark bg) | `oklch(35% 0.07 75)` | creator accent bg (dark theme) |
| `oklch(58% 0.18 145)` | `oklch(68% 0.14 80)` | live dot |
| `oklch(85% 0.10 145)` | `oklch(88% 0.07 85)` | live soft |
| `oklch(95% 0.05 150)` | `oklch(95% 0.04 85)` | pale text on highlight cards |

> **⚠ Alpha-variant gotcha:** greens also hide in ALPHA forms —
> `oklch(58% 0.18 145 / .6)` (pulse keyframe box-shadows, translucent borders,
> `rgba()` equivalents). A regex that requires a closing `)` right after the hue
> will miss them. Sweep with a pattern that tolerates ` / <alpha>)`, e.g.
> `oklch\([0-9.]+% +[0-9.]+ +1[2-7][0-9]( */ *[0-9.]+)?\)`. Web had six of these
> hiding in `.live-dot` pulse keyframes, `.tag-live` borders, and the
> EarningsSection highlight card.

### 2d. Design-token names (web's `--ed-*` system mirrors mobile's editorial palette)

The web app's `app/globals.css` tokens after the rebrand — mobile should mirror
these values wherever its design system defines the same roles:

```css
--ed-accent:        #C89548;   /* burnt amber — links, brand accents, italic display */
--ed-accent-ink:    #5C3A0F;   /* text on gold surfaces */
--ed-accent-bg:     #F5E4C0;   /* pale gold-cream backgrounds */
--ed-accent-solid:  #E4B05E;   /* warm gold — primary buttons, hero color */

/* success tokens exist but RESOLVE TO THE SAME GOLD (green fully retired): */
--ed-success:       #C89548;
--ed-success-ink:   #5C3A0F;
--ed-success-bg:    #F5E4C0;
--ed-success-solid: #E4B05E;

--ed-live:      #D9A84E;       /* pulsing "live" dots */
--ed-live-soft: #F5E8CC;

/* unchanged: paper/ink neutrals, --ed-business (blue), --ed-warn, --ed-danger */
```

Keep `--ed-warn` (#C68A12) and `--ed-danger` (#B43A1F) as-is — they were never green.
The blue `--ed-business` family is also unchanged.

### 2e. Status colors note

Status pills that previously used green for `converted` / `approved` / `paid` now
use the gold family (`#F5E4C0` bg + `#5C3A0F` ink, or `amber-100`/`amber-900`
Tailwind). The semantic distinction from `--ed-warn` (which is also amber-ish,
#C68A12/#FBE9C4) is acceptable per the full-gold decision; if a screen has BOTH a
success pill and a warning pill side by side, differentiate with an icon (✓ vs ⚠),
not color.

---

## 3. Logo

**Two assets** — copy both exact files to the mobile repo's asset folder:

| Asset | Spec | Use for |
|---|---|---|
| `public/tendso-logo.png` | white "TENDSO" wordmark, 298×70 px, **true transparent** background | in-page brand lockups (headers, footers, splash text) |
| `public/tendso-icon.png` | **square 512×512** — the brand's split-O glyph, white on a charcoal `#1B1C24` rounded tile (100px radius) | app launcher icon, favicon, notification icon, any square slot |

> History note: the original wordmark PNG shipped with an OPAQUE BLACK
> background. It was converted to true transparency (alpha = pixel luminance)
> on 2026-06-10 — if you copied an earlier version, re-copy. The square icon
> was generated from the wordmark's final stylized "O" glyph; regenerate the
> same way if a higher-res source arrives.

Usage rules applied on web — replicate:

| Surface | Treatment |
|---|---|
| Dark backgrounds (ink sidebars, dark footers, gold strips) | wordmark as-is (white) |
| Light backgrounds (paper, white cards, auth screens) | apply **invert filter** (white→black). Web uses CSS `filter: invert(1)`; on React Native use `tintColor: '#1B1C24'` |
| Square slots (launcher, favicon, notifications) | use `tendso-icon.png` — **never squeeze the wide wordmark into a square slot** (it stretches/distorts) |
| Wordmark sizing | height 23–36 px depending on context, width auto (≈4.26:1 ratio). Never crop square |
| The "Digital" suffix | **deleted everywhere** — no "Tendso Digital", just the wordmark |

Web surfaces wired (for parity checking): landing navbar + footer, admin sidebar,
app header, login/signup/forgot-password (inverted, replaces old square badge),
onboarding (white on dark), profile/notifications/certification-quiz gold strips
(white wordmark replaces icon+caption lockup). Favicon + apple-touch-icon +
manifest icon all point at the square `tendso-icon.png`.

---

## 4. Brand-name replacement rules

1. `Negosyo Digital` → `Tendso`
2. Standalone `Negosyo` (wordmarks, chat-bot copy, "Ask Negosyo") → `Tendso`
3. `negosyo-digital` / `negosyo_digital` (slugs, package names) → `tendso`
4. `NegosyoDigital/1.0` HTTP User-Agent strings → `Tendso/1.0`
5. APK filename `Negosyo-Digital.apk` → `Tendso.apk`
6. Subdomain copy `yourbusiness.negosyodigital.ph` → `yourbusiness.tendso.ph`
7. Old taglines: "Empowering Filipino businesses (with digital presence)" →
   "The Thinking Ends Here. So the work doesn't." · "Build Your Digital Business" →
   "Hands Full. The Thinking Ends Here."

### ⚠ THE ONE EXCEPTION — Wise payee name

`WISE_ACCOUNT_NAME` env default **stays `'Negosyo Digital'`** (web:
`lib/email/templates.ts`). That is the **legal account name registered on Wise**;
customers wiring money must match the payee name exactly or the transfer is
rejected. If the mobile app shows payment instructions with the Wise recipient
name, it MUST keep showing "Negosyo Digital" until the Wise account itself is
renamed. Flip via env/config only after the Wise rename — never hardcode Tendso
into payee-name strings.

### Do NOT rename

- Convex deployment slug (`diligent-ibex-454` / project negosyo-digital) — breaks prod DB
- Historical change-log docs (frozen records)
- Stored DB records / audit trails (frozen history)
- Internal prop/identifier names like `tone="emerald"` whose *values* already
  render amber (cosmetic refactor, optional, zero visual impact)

---

## 5. Copy rewrites applied to the web landing (port the voice, not the literal JSX)

| Surface | New copy |
|---|---|
| Hero headline | "Some hands don't get to sit still." |
| Hero em-line | "The Thinking Ends Here. So the work doesn't." |
| Hero lede | "Your hands are full of customers, orders, tools, dough, kids. The internet asks you to stop and design. We built around that — a creator visits, asks a few questions, photographs the work, and your page forms around it. Live in 48 hours. No template. No design tab. No blank page." |
| Hero proof tags | "Photo. Answers. Live page." · "No template" · "No blank screen" · "Built around the work" · "Live in 48 hours" |
| Manifesto | "They did not come here to become designers. They came here to keep the business moving." |
| Process (4 steps) | **A photo** → **A few answers** → **A guided page** → **Reviewed and live** (headline: "The page comes from the work.") |
| Final CTA | "The Thinking Ends Here. So the work doesn't." / "Pick the door that's yours. Your hands stay where they are." |
| Creators page hero | "Help owners whose hands are full." |
| Business FAQ lead | "Will I need to learn design?" → "No. You won't choose a template, pick a font, or stare at a blank page. A creator visits, asks a few questions, takes photos, and your site forms from that." |
| Pricing tier tagline | "A page built around the work, not the other way around." |
| App-store/meta description | "A business page built around the work, not the other way around. … For Filipino local businesses whose hands are full." |
| Manifest description | "The Thinking Ends Here. So the work doesn't." |

Copy guardrails (from the treatment PDF): never imply the owner is incapable;
never celebrate design tools; never end on confetti — end on the work continuing.

### 5a. Payout copy — Wise ONLY for creator payouts

Creator-facing payout copy must name **Wise as the one and only payout rail**.
GCash / Maya / PayMaya / "any local bank" were removed from all creator payout
mentions on web (2026-06-10):

| Surface | New copy |
|---|---|
| Creator FAQ "How do I get paid?" | "Straight to your Wise account. The app handles invoices, taxes, and receipts. You don't touch a spreadsheet." |
| Knowledge-base payout entry | title "How Wise payouts work" · "Link your Wise account in the app. Funds land within 48 hours of a site going live. No paperwork." |
| For-creators comparison table | "Payout via Wise" (was "Wise / GCash / Maya / bank") |
| KYC step copy | "Bank-grade KYC" (was "GCash-grade KYC" — don't name competitor wallets) |

**Scope boundary — do NOT remove GCash/Maya from the inbound business-payment
instructions.** Business owners paying Tendso send money via InstaPay and can
legitimately use GCash, Maya, or any bank app to reach the Wise account — those
mentions in payment-instruction emails (`lib/email/templates.ts`) are correct and
stay. The Wise-only rule applies to **creator payouts** (money OUT to creators),
not customer payments (money IN).

---

## 6. Email templates (if mobile sends or previews emails)

All transactional email HTML on web (`lib/email/templates.ts`) now uses the gold
hexes from §2a in headers, gradients, buttons, badges, and footers; brand strings
per §4; gradients like `linear-gradient(135deg,#10b981,#059669)` became
`linear-gradient(135deg,#E4B05E,#C89548)`. If the mobile app renders any of the
same email content or in-app receipts, use the same mapping.

---

## 7. Verification checklist (run the equivalents on mobile)

- [ ] Grep for `Negosyo|negosyo` — only allowed survivor is the Wise payee
      constant + frozen docs/history
- [ ] Grep case-insensitively for every old hex in §2a — zero hits
- [ ] Grep `emerald-|green-[0-9]` (or RN color-name equivalents) — zero hits
- [ ] Grep oklch hues 120–179 **including alpha forms** (` / .5)` etc — zero hits
- [ ] Square slots (launcher icon, favicon, notifications) use `tendso-icon.png`;
      the wide wordmark is never squeezed into a square
- [ ] Wordmark: white-on-dark, inverted/black-on-light; transparent-bg version
- [ ] "Digital" suffix gone from all brand lockups
- [ ] Theme color / splash / status-bar colors use `#E4B05E`
- [ ] Creator payout copy says Wise only (no GCash/Maya/PayMaya); inbound
      business-payment instructions may still list GCash/Maya as InstaPay rails
- [ ] Type-check + build pass

Web verification result (2026-06-10, second pass): `tsc --noEmit` clean,
`next build` compiled successfully, all greps zero-residual including alpha-oklch
forms; square icon generated and wired into favicon + apple-touch-icon + manifest.
