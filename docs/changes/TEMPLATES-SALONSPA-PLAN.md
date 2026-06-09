# SalonSpa Landing Pages — implementation plan

> Sibling document to `TEMPLATES-FAMILY-PLAYBOOK.md` and the existing Generic / Barbershop batch docs. Same playbook (lock spec → port → wire editor → ship) applied to the SalonSpa family. This doc also covers a cross-family Leaflet map fix that landed alongside the SalonSpa ports.

---

## What's in the folder

`templates/SalonSpa/` contains 5 source HTMLs, one variant each:

| Source file | Letter | Codename | Identity |
|---|---|---|---|
| `01-Atelier.html`  | K | **Atelier**  | Pearl + brass · refined salon, Cormorant Garamond + Jost |
| `02-Botanica.html` | L | **Botanica** | Sage + cream · botanical spa, Spectral + Mulish |
| `03-Clinic.html`   | M | **Clinic**   | Mist + teal · clinical aesthetic, Tenor Sans + Karla |
| `04-Vogue.html`    | N | **Vogue**    | Mauve pink · editorial beauty, DM Serif Display + DM Sans |
| `05-Bloom.html`    | O | **Bloom**    | Mauve + cream · romantic, Marcellus + Nunito Sans |

### Letter range

K–O claims the next 5 letters after Barbershop (F–J). Future families: P–T, U–Y, Z–AD (or rolling).

### Shared section spine (per playbook)

All variants render the same 13-section spine:

```
HEADER → HERO → TRUST → ABOUT → SERVICES → WHY → HOW
  → TESTIMONIALS → GALLERY → FAQ → AREA → CREDENTIALS
  → LOCATION (Leaflet) → CTA-BAND → FOOTER
```

Compared to Barbershop's 16-section spine, SalonSpa skips Marquee (not present in any source) and merges the CTA-band + Footer into one closing region (still rendered by separate components).

### What's unique per variant

- **Palette tokens** (`--accent`, `--paper`, `--ink`, `--accent-rgb`)
- **Serif + sans font pairing** (each variant uses a distinct combo — see table above)
- **Hero structure** — each variant has a per-letter Hero (HeroK/L/M/N/O) because the source HTMLs have visibly different hero treatments (split-grid, vertical strip, two-column with rating, full-bleed editorial, asymmetric photo stack)
- **Leaflet marker color** (matches `--accent`)

### What's shared

- Section order + IDs (`#about`, `#services`, `#reviews`, `#gallery`, `#visit`)
- All 13 K-letter section components except Hero (HeaderK, TrustK, AboutK, ServicesK, WhyK, HowK, TestimonialsK, GalleryK, FaqK, AreaK, CredentialsK, LocationK, CtaBandK, FooterK) — letters L–O reuse them
- The `data-field` / `data-image-field` / `data-href-field` editor bridge hooks
- `SalonspaSpine.astro` — one base CSS file consumed by all 5 wrappers
- The `genericThemeOverrides` theme override layer (with `lockVariant: true`)
- WCAG luminance-based contrast tokens for buttons (`--on-accent`, `--on-ink`, `--on-paper`)
- Per-page Leaflet boot via `window.__salonspaInitMap(lat, lng, label)`

---

## Architecture

### File layout

```
astro-site-template/src/components/salonspa/
├── SalonspaSpine.astro            ← shared base CSS, injected once per page
├── PageK.astro                    ← Atelier
├── PageL.astro                    ← Botanica
├── PageM.astro                    ← Clinic
├── PageN.astro                    ← Vogue
├── PageO.astro                    ← Bloom
├── header/HeaderK.astro
├── hero/
│   ├── HeroK.astro                ← Atelier split-grid (copy + photo)
│   ├── HeroL.astro                ← Botanica centered + photo strip
│   ├── HeroM.astro                ← Clinic two-column with rating row
│   ├── HeroN.astro                ← Vogue full-bleed editorial
│   └── HeroO.astro                ← Bloom asymmetric photo stack
├── trust/TrustK.astro
├── about/AboutK.astro
├── services/ServicesK.astro
├── why/WhyK.astro
├── how/HowK.astro
├── testimonials/TestimonialsK.astro
├── gallery/GalleryK.astro
├── faq/FaqK.astro
├── area/AreaK.astro
├── credentials/CredentialsK.astro
├── location/LocationK.astro       ← includes client-side Nominatim fallback
├── ctaBand/CtaBandK.astro
└── footer/FooterK.astro
```

### Render selector

`astro-site-template/src/pages/index.astro` now routes:

```
salonspa:K → PageK (Atelier)
salonspa:L → PageL (Botanica)
salonspa:M → PageM (Clinic)
salonspa:N → PageN (Vogue)
salonspa:O → PageO (Bloom)
```

Adds 5 new conditional renders alongside the existing 10 (generic A–E + barbershop F–J).

---

## The Leaflet map fix (cross-family)

### The bug

The Barbershop `LocationF.astro` component only rendered the Leaflet map when `lat != null && lng != null` were present in `site-data.json`. The build pipeline (`lib/astro-builder.ts:230-244`) tries to geocode the address at build-time via OSM Nominatim, but if that fails (vague addresses, network hiccups, rate limit), it silently swallows the error and leaves `lat`/`lng` unset. Result: the map div on the published site shows a static "Address-based map will appear here after geocoding" placeholder — never actually geocodes anywhere. Verified to reproduce on both local dev and Vercel deploys.

### The fix

Both `LocationK.astro` (SalonSpa) and `LocationF.astro` (Barbershop — retrofitted) now have a **client-side Nominatim fallback**:

1. **Render path A** — if build-time produced `lat`/`lng`, call the page wrapper's `__<family>InitMap(lat, lng, label)` global directly (unchanged).
2. **Render path B** — if no coords but an address string exists, fire `fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=…')` from the browser. On success, parse the lat/lng and call the init global. On failure, replace the loading chip with "Map preview unavailable — use the directions button."
3. **Render path C** — if neither coords nor address, render "No address on file yet." (graceful empty card).

Page wrappers' `__<family>InitMap` globals now clear `el.innerHTML` before mounting Leaflet so the fallback chip is removed cleanly on either render path.

### Performance + rate limit notes

- Nominatim is OSM's free geocoder. Rate limit is ~1 req/sec per IP, more than enough for a per-page-load lookup.
- The fetch runs once per page load (only if needed) and is non-blocking — the rest of the page renders normally while the geocode resolves.
- No new dependencies, no API key, no env var.

### Files touched by this fix

- `astro-site-template/src/components/salonspa/location/LocationK.astro` (new — built with the fix)
- `astro-site-template/src/components/barbershop/location/LocationF.astro` (retrofitted)
- `astro-site-template/src/components/barbershop/PageF.astro` through `PageJ.astro` — `__barbershopInitMap` now clears `el.innerHTML` before `L.map()` mounts

---

## Editor integration

### Three accordions in the Template tab

`components/editor/SandboxEditor.tsx` now has:

1. **Modern Designs** — 5 Generic variants (A–E)
2. **Barbershop** — 5 Forge variants (F–J)
3. **Salon & Spa** — 5 SalonSpa variants (K–O) ← new

Each accordion auto-opens if the active variant belongs to that family OR if no variant is active. The content tab regex was extended to `(generic:[A-E]|barbershop:[F-J]|salonspa:[K-O])`.

### Content portability across variants

Section components within the SalonSpa family **read the same content shape**. All 5 Hero variants (HeroK–O) read `content.hero` fields:

- `headlineLines[]` / `headline`
- `kicker` / `locality`
- `sub`
- `cta1.text/href`, `cta2.text/href`
- `image` (+ `image2` for Bloom's photo stack)
- `tag` (used by Atelier's corner tag overlay)
- `rating.big/label` (used by Clinic)

Swapping Atelier → Vogue keeps the admin's headline, description, CTAs, rating intact — only the layout reskins.

---

## Build pipeline (unchanged)

Build time: ~2.5 seconds per regen. No pipeline changes needed — the existing `transformToAstroData` + `astro build` pipeline reads `customizations.heroStyle` and Astro's index.astro does the routing.

---

## Theming

### Token aliases added to `genericThemeOverrides.ts`

The override layer now emits `--accent` + `--accent-rgb` alongside the existing `--brass` family aliases. This means when an admin picks an explicit color scheme (blue, black, etc.), it lands on both Barbershop (`var(--brass)`) AND SalonSpa (`var(--accent)`) without code changes per template.

### `lockVariant: true` on all PageK–PageO

Same pattern as Barbershop: each variant's hand-tuned palette wins on auto, but explicit admin picks override. The `salon` and `spa` business types auto-map to the `pink` scheme via `AUTO_SCHEME_BY_BUSINESS_TYPE` (now seeded in both `lib/astro-builder.ts` and `genericThemeOverrides.ts`).

---

## Scripts

All 3 family-scripts extended in one place per `convex/scripts/`:

- `scripts/build-template-previews.mjs` — added 5 entries for letters k–o pointing at `templates/SalonSpa/`. Emits `public/template-previews/{k,l,m,n,o}.html`.
- `scripts/wire-theme-overrides.mjs` — added a third family entry `{ dir: 'salonspa', letters: ['K','L','M','N','O'], footerImportFor: () => /FooterK/ }`. Idempotent — re-running on the existing wrappers reports "unchanged" (the K–O wrappers were written with the hookup inline).
- `scripts/strip-section-defaults-v3.mjs` — added `salonspa/` to `TARGET_DIRS`; bumped the `Page[A-J]` skip regex to `Page[A-O]`.

---

## Common gotchas (specific to SalonSpa)

- **`--accent` not `--brass`**: SalonSpa wrappers use the `--accent` token name (matches the source HTMLs). The override layer's new `--accent` alias takes care of cross-token compatibility, but if you copy CSS from Barbershop components verbatim you'll need to rename `var(--brass)` → `var(--accent)`.
- **Per-variant heroes**: unlike Barbershop where Hero is variant-distinct but other sections share Letter F, the 5 SalonSpa heroes (HeroK/L/M/N/O) are all distinct files. Don't try to consolidate them — each variant's source HTML has a genuinely different hero structure.
- **13 sections, not 16**: SalonSpa sources don't have Marquee or a separate Footer-only structure. The closing section combines CTA-band + Footer rendering via two separate components (CtaBandK + FooterK) but they form one visual unit.
- **Map fix is shared infrastructure**: if you add another family, copy LocationK's render-path-B Nominatim block into the new family's Location component. Don't try to centralize it into a shared helper yet — Astro doesn't make it trivial to share `<script is:inline>` blocks across components.

---

## Verification checklist (all passed for this PR)

- [x] `npx tsc --noEmit` passes
- [x] `npx astro build` succeeds for each `salonspa:K` through `salonspa:O` (verified — each emits its own `html[data-page="X"]` attribute)
- [x] `npx next build` passes (`✓ Compiled successfully in 9.4s`)
- [x] All 15 preview thumbnails rebuild (`public/template-previews/a–o.html`)
- [x] Each letter's compiled HTML carries the correct `<html data-page>` attribute — no sister-wrapper palette leak
- [x] LocationK + LocationF both render the Leaflet map even when build-time geocoding produced no `lat`/`lng` (via client-side Nominatim fallback)

---

## Open patterns / future improvements

- **Per-variant section components beyond Hero** — the 5 source HTMLs do have structural differences in About (Atelier's pull-quote vs Vogue's plain prose), Services (Atelier's price-aligned cards vs Botanica's stacked list), etc. Port these per-letter where visual distinctness matters. Same scoping rules apply: scoped to `html[data-page="<L>"]`.
- **Variant-aware default content** — currently the AI generates one flavor of copy for `salon`/`spa` business types regardless of letter. Could tune prompts per variant (Atelier = refined editorial, Clinic = clinical/wellness, Vogue = high-fashion).
- **Geocoding cache** — Nominatim is rate-limited. For high-traffic sites, consider caching the client-side geocode result in localStorage keyed by address-hash so repeat visits skip the network call.
- **Marquee section for SalonSpa** — if you want a moving-text band like Barbershop has, build `MarqueeK.astro` and add it to PageK–O optionally via a visibility flag.
