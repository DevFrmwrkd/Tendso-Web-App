# Generic Landing Pages — batch 1 implementation plan

> **Read this before any code lands.** The prior attempt blew up because we
> wiped the existing template library first and then tried to rebuild without
> a shared mental model. This time: plan signed off → port → wire editor →
> ship — in that order, with checkpoints.

---

## What's in the folder

`templates/Generic Landing Pages for Local business/` contains:

- **5 self-contained HTML pages**, ~500–550 lines each, with embedded
  `<style>` and inline JS. Each one is a complete landing page:
  - `01 Ironwood Coffee.html` — paper / gold, café
  - `02 Stillwater Studio.html` — neutral, yoga studio
  - `03 Cedar & Stone.html` — warm earth, woodworking
  - `04 Northpoint IT.html` — cool grey, IT services
  - `05 Wash House.html` — soft pastel, laundry
- **`image-slot.js`** — a custom-element image picker used by the templates.
  It works against a sidecar JSON file written by an `omelette` host. **It will
  not work in our preview iframe as-is** — see "image-slot" below.
- **`screenshots/`** — design references; ignore for code, useful as preview
  thumbnails for the Template tab.

### Shared section taxonomy

All 5 templates use the **same 13 sections in the same order**:

```
HEADER (nav) → HERO → MARQUEE → TRUST → ABOUT → SERVICES → WHY
  → HOW → TESTIMONIALS → GALLERY → FAQ → AREA → LOCATION (Leaflet map)
  → CTA-BAND → FOOTER
```

This is a gift — it means we can build the same component contract once and
have 5 variants per section drop in cleanly.

### What's unique per template

- **Color tokens** (`--paper`, `--ink`, `--gold`, etc. — defined on `:root`)
- **Font choices** (Space Mono + system; Manrope; etc.)
- **Section visual layout** (cards vs lists vs bento vs marquee)
- **Microcopy and structure within sections** — e.g. one has a menu-board
  services, another has bento, another has soft cards

### What's shared

- Section order
- Section IDs (`#about`, `#services`, `#why`, `#how`, `#reviews`, `#work`,
  `#faq`, `#area`, `#visit`)
- The `<image-slot>` web-component pattern
- The "reveal on scroll" animation pattern
- A right-side floating "switcher" linking to siblings (we drop this — it's
  authoring-time-only, not for production)
- A bottom marquee / kicker pattern
- Leaflet for the location map

---

## Naming + namespace — confirmed 2026-06-01

This batch is **additive (Option β)** — old A–O components stay where they
are; new components live in a new sibling folder so nothing existing breaks.

**Letters: A–E for the 5 templates**, one letter per template. No numeric
sub-variants — each template is one cohesive design, not a family of
layouts.

| Letter | Template            | Theme                     |
|--------|---------------------|---------------------------|
| A      | Ironwood Coffee     | paper + gold, café        |
| B      | Stillwater Studio   | neutral, yoga/studio      |
| C      | Cedar & Stone       | warm earth, woodworking   |
| D      | Northpoint IT       | cool grey, IT services    |
| E      | Wash House          | soft pastel, laundry      |

**Namespace: sibling `generic/` folder.** Layout:

```
astro-site-template/src/components/
├─ heroes/       ← existing A–O (untouched)
├─ about/        ← existing A–O (untouched)
├─ services/     ← existing A–O (untouched)
├─ ...
└─ generic/      ← NEW, this batch
   ├─ hero/      → HeroA.astro … HeroE.astro
   ├─ trust/     → TrustA.astro … TrustE.astro
   ├─ about/     → AboutA.astro … AboutE.astro
   ├─ services/  → ServicesA.astro … ServicesE.astro
   ├─ why/       → WhyA.astro … WhyE.astro
   ├─ how/       → HowA.astro … HowE.astro
   ├─ testimonials/  → TestimonialsA.astro … TestimonialsE.astro
   ├─ gallery/   → GalleryA.astro … GalleryE.astro
   ├─ faq/       → FaqA.astro … FaqE.astro
   ├─ area/      → AreaA.astro … AreaE.astro
   ├─ location/  → LocationA.astro … LocationE.astro
   ├─ ctaBand/   → CtaBandA.astro … CtaBandE.astro
   └─ footer/    → FooterA.astro … FooterE.astro
```

Customization codes use a **`generic:` prefix** so the page router can tell
old from new without touching legacy submissions:

```
heroStyle: "A"           → existing components/heroes/HeroA.astro
heroStyle: "generic:A"   → new components/generic/hero/HeroA.astro
```

Existing submissions keep working unchanged — none of them have a `generic:`
prefix. New submissions select `generic:A`…`generic:E` from the Template
tab's new "Generic Landing Pages" bucket.

After Phase 6 ships and you've verified the new templates against real
submissions, a **separate later batch** does the rename:
- Move `components/generic/<section>/<Letter>.astro` to
  `components/<section>/<Letter>.astro` (consolidating into the legacy
  folder names)
- Delete the old A–O .astro files
- Strip the `generic:` prefix logic from `lib/astro-builder.ts` + the
  Template tab
- One-shot Convex mutation to rewrite stored `customizations.{heroStyle,…}`
  codes from `generic:X` to bare `X`

That rename is **not** Phase 6 — it's a separate ask after you're sure.

---

## Hard requirements (your message, restated as testable acceptance criteria)

1. **AC-1 Astro-only**. Each section variant lives in
   `astro-site-template/src/components/{hero,about,services,…}/<Section><Letter>.astro`.
   No more raw-HTML string generators.

2. **AC-2 Sections are mobile-responsive**. Every variant ships its own
   `@media` rules. We don't rely on parent-page CSS reset.

3. **AC-3 Sandbox preview renders Astro output**. The Template tab in
   `components/editor/SandboxEditor.tsx` shows a real preview (not a
   schematic SVG) of each variant before selection.

4. **AC-4 Click-to-edit text**. Clicking any text in the website preview
   focuses the matching field in the sidebar Content tab, and typing there
   updates the preview live (no rebuild). This already half-works through
   the existing `editorBridge.ts`; we need to make every editable text in
   the new templates carry `data-field="…"`.

5. **AC-5 Click-to-edit images**. Clicking any image in the preview opens
   a modal with two tabs: **Original** (the photos the creator uploaded)
   and **AI-enhanced** (the ones the Airtable AI pipeline produced).
   Selecting saves the URL to that slot and updates the preview.

6. **AC-6 Click-to-edit links (button + nav + footer)**. Clicking any
   `<a>` opens a small popover with two inputs: **Text** and **Link**.
   Saving updates both. This is the gap in the current bridge.

7. **AC-7 Social links in footer**. Footer social icons each have their
   own editable URL + which-platform dropdown.

8. **AC-8 Plan first, then code**. We sign off on this doc before any
   file changes happen.

---

## The two hard problems

### Problem A — `<image-slot>` doesn't work in our world

The templates use a custom element that drops images into a sidecar JSON
file via `window.omelette.writeFile`. That's a feature of the authoring
host the templates were designed in. Our environment doesn't have it.

**Resolution:** replace every `<image-slot id="…" …></image-slot>` with a
plain `<img data-field="…" src="…">` (or `<div data-field="…" style="background-image:…">`
for backgrounds). The bridge already handles both. **The `image-slot.js`
file gets deleted entirely; we copy nothing from it.**

### Problem B — Link editing was the part that "didn't work out before"

The existing bridge handles text and image. Links — where the admin clicks
an `<a>` and gets to edit BOTH the text shown AND the href — is the gap.
Two ways to do it:

- **Option B1 — dual data-attributes on each link.**
  ```html
  <a data-field="hero.cta1.text" data-href-field="hero.cta1.href" href="…">Visit the café</a>
  ```
  The bridge sees `data-href-field` on click, opens a popover overlaying
  the preview with two inputs. Saving postMessages two updates back to the
  parent.

- **Option B2 — single composite field name.**
  ```html
  <a data-link-field="hero.cta1" href="…">Visit the café</a>
  ```
  The data model is `{ hero: { cta1: { text, href } } }`. Bridge opens the
  popover, parent updates the composite.

I recommend **B1**. It's mechanically the same as text + a sibling href
update — the data model stays flat (`hero_cta1_text`, `hero_cta1_link`),
matching how existing fields like `hero_cta` already work in `lib/template-fields.ts`.

For social links (AC-7) we use the **same B1 mechanism** plus a third attr
`data-platform-field` so the platform-icon swap on save is one extra postMessage.

---

## Execution plan — 6 phases, each independently shippable

Each phase ends with a working, deployable state. We don't break anything
mid-flight.

### Phase 0 — Sign-off (no code)

- You read this doc, push back on anything that doesn't match what you
  want, we converge on the section/letter naming and the link-editing
  approach. **No file changes until you say "go phase 1".**

### Phase 1 — Port one template (Ironwood / `generic:A`) end-to-end

Smallest viable slice that proves the full path. We do ONE template
completely before doing the other four, so any decomposition or bridge
gaps surface immediately.

1. Create the `generic/` folder tree under
   `astro-site-template/src/components/generic/` with subdirs:
   `hero/ trust/ about/ services/ why/ how/ testimonials/ gallery/ faq/
   area/ location/ ctaBand/ footer/` — empty for now except for letter A.

2. Create 13 Astro components for letter `A` (Ironwood):
   `generic/hero/HeroA.astro`, `generic/trust/TrustA.astro`,
   `generic/about/AboutA.astro`, `generic/services/ServicesA.astro`,
   `generic/why/WhyA.astro`, `generic/how/HowA.astro`,
   `generic/testimonials/TestimonialsA.astro`,
   `generic/gallery/GalleryA.astro`, `generic/faq/FaqA.astro`,
   `generic/area/AreaA.astro`, `generic/location/LocationA.astro`,
   `generic/ctaBand/CtaBandA.astro`, `generic/footer/FooterA.astro`.
   Each receives props matching `lib/template-fields.ts`, tags every
   editable text/image/link with the appropriate `data-field` /
   `data-href-field` / `data-image-field` attribute, ships its own scoped
   `<style>` block (Astro component styles are scoped by default — no
   clashes between letters), and is mobile-responsive at
   `@media (max-width: 680px)` minimum.

3. Drop the `<image-slot>` wrapping; replace with plain `<img>` or
   background `<div>` carrying `data-image-field`. The `image-slot.js`
   file in `templates/` is not copied into the runtime build at all.

4. Wire the `generic:` prefix into `astro-site-template/src/pages/index.astro`
   so `customizations.heroStyle === 'generic:A'` (etc.) routes to the new
   components. `lib/astro-builder.ts` passes the prefix through verbatim;
   the routing happens in the Astro page.

5. Verify `astro build` still succeeds; render a known submission with all
   styles set to `generic:A` and eyeball the result against the original
   `01 Ironwood Coffee.html`. Old submissions with bare-letter codes still
   render unchanged.

6. Variant `generic:A` is selectable in the Template tab dropdown as a raw
   code (no UI polish yet — that's Phase 2). We're done with Phase 1.

### Phase 2 — Sandbox preview renders the actual Astro output (AC-3)

Current Template tab shows hand-drawn schematic SVGs. We replace those
with **real iframe-rendered Astro previews**, one per variant per section.

Two ways. The simpler one wins:

1. **Pre-rendered static previews.** At repo build time we run Astro
   against a fixed demo dataset (the original microcopy from each
   template — Ironwood's "Coffee worth the walk down", etc.) and write
   the output HTML for each `(section, letter)` combo into
   `public/template-previews/<section>-<letter>.html`. The Template tab
   renders each as an `<iframe srcDoc>` thumbnail. Cheap, fast, no live
   build per click.

2. **Live build per hover.** Skip — too slow, and we have no use for the
   freshness.

Going with **(1)**. Need a `scripts/build-template-previews.mjs` that the
existing build pipeline runs once before `next build`.

### Phase 3 — Click-to-edit links (AC-6) and social (AC-7)

Bridge gets two new message types:

- `ed:link-click` (iframe → parent) on `<a data-href-field>` click. Parent
  opens a popover-style modal with Text and Link inputs.
- `ed:link-update` (parent → iframe) — bridge updates the anchor's text
  AND `href` in one go.

Same shape for social, with the third `data-platform-field` attr feeding
a small dropdown.

### Phase 4 — Image picker modal (AC-5)

When the iframe emits `ed:click` on an `[data-image-field]`, the parent
opens a modal. The modal lists:

- **Original photos**: from `submission.photos[]`
- **AI-enhanced**: from `generatedWebsites.enhancedImages` keyed by slot
  (we already collect these for Drive sync, so the shape is known)

Selecting either calls the existing `ed:image` postMessage. The selected
URL is also persisted into the content draft so it survives Save.

### Phase 5 — Port the other 4 templates (B, C, D, E)

By Phase 5 the contract is proven. Porting each remaining template is
mechanical: copy the section HTML out of the source `.html`, paste into 13
Astro components under `generic/<section>/<Letter>.astro`, swap
`<image-slot>` for `<img data-image-field>`, add `data-field` /
`data-href-field` to every editable text/anchor, paste the CSS into the
component's scoped `<style>`. Each template takes a fixed amount of effort.

Order:
- B = Stillwater Studio
- C = Cedar & Stone
- D = Northpoint IT
- E = Wash House

### Phase 6 — Cleanup + smoke test

- Add Phase-5 letters to the Template tab UI metadata.
- Run the existing `generatedWebsites` flow end-to-end against each new
  variant.
- Verify `npx tsc --noEmit` and `npx next build` pass.
- Verify the editor click-to-edit cycle works on at least Hero, About,
  CTA button, Footer social, and Gallery image on every letter.

We don't remove the old A–O templates in this batch. They stay until you
decide to deprecate.

---

## Data contract — fields each section reads

(For Phase 1 sign-off — every Astro component receives a typed prop set.
This is what the bridge `data-field` strings map to.)

```ts
// HEADER
nav.brand, nav.phone, nav.links[].text, nav.links[].href, nav.cta.text, nav.cta.href

// HERO
hero.kicker, hero.headline (multi-line), hero.sub, hero.cta1.text, hero.cta1.href,
hero.cta2.text, hero.cta2.href, hero.meta1, hero.meta2, hero.image (background)

// TRUST
trust.cells[i].num, trust.cells[i].label   (4 cells)

// ABOUT
about.tag, about.headline, about.body, about.image, about.signatureName, about.signatureRole

// SERVICES
services.tag, services.headline, services.sub, services.items[].title,
services.items[].body, services.items[].price?, services.cta.text, services.cta.href

// WHY
why.tag, why.headline, why.items[].title, why.items[].body

// HOW
how.tag, how.headline, how.steps[].step, how.steps[].title, how.steps[].body

// TESTIMONIALS
testimonials.tag, testimonials.headline, testimonials.items[].quote,
testimonials.items[].name, testimonials.items[].context, testimonials.items[].avatar

// GALLERY
gallery.tag, gallery.headline, gallery.images[]

// FAQ
faq.tag, faq.headline, faq.items[].q, faq.items[].a

// AREA
area.tag, area.headline, area.places[]

// LOCATION
location.address, location.lat, location.lng, location.hoursLink, location.directionsLink

// CTA-BAND
ctaBand.heading, ctaBand.body, ctaBand.primary.text, ctaBand.primary.href,
ctaBand.secondary.text, ctaBand.secondary.href

// FOOTER
footer.brand, footer.tagline, footer.address, footer.phone, footer.email,
footer.social[].platform, footer.social[].url,
footer.columns[].title, footer.columns[].links[].text, footer.columns[].links[].href,
footer.copyright
```

These map to the existing `extractedContent` Convex schema where they
overlap; new fields (e.g. multi-line CTAs) get added optionally to the
schema in Phase 1.

---

## Out of scope for this batch

- Restoring the Drive sync fixes (you reverted them — separate decision)
- Other folders (`Autoshop`, `Barbershop`, `NEO LAB`, `Restaurant`,
  `SalonSpa`, `Landing Pages v01`)
- Removing the old A–O templates
- New color schemes / font pairings beyond what the 5 generic templates use
- A11y audit, SEO meta tweaks beyond what the source HTML already had

---

## Sign-off — confirmed 2026-06-01

| # | Question | Answer |
|---|----------|--------|
| 1 | Letter naming | **A–E** (one per template; A=Ironwood, B=Stillwater, C=Cedar&Stone, D=Northpoint, E=WashHouse) |
| 2 | 13-section taxonomy | Yes |
| 3 | Link editing | **B1** — `data-field` + `data-href-field` on each `<a>` |
| 4 | Sandbox preview | Pre-rendered iframes built once at deploy time |
| 5 | Old A–O templates | **Stay** during this batch. Option β (additive) in a sibling `generic/` folder. Customization codes prefixed `generic:` to distinguish. Rename pass deferred to a separate batch. |

Trigger: user says "go phase 1".
