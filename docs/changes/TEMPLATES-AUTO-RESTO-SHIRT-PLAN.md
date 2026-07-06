# Three new template families — Autoshop, Restaurant, Shirt Store

**Date:** 2026-07-06 · **Owner:** Steven
**Depends on:** `TEMPLATE-FAMILY-PLAYBOOK.md` (canonical), mirrors `TEMPLATES-SALONSPA-PLAN.md` (last family shipped).
**Scope:** 3 families × 5 variants = **15 new templates**, in **one PR**, all consuming **Hyperagent optimized images (no Airtable)**.

> Sign off on this doc before any code lands. Trigger: you say "go".

---

## 1. What already exists (verified on disk)

- **Built families:** `generic` (A–E), `barbershop` (F–J), `salonspa` (K–O). Each = a `<Family>Spine.astro`, 5 `Page<L>.astro` wrappers, per-letter heroes, 13 shared section components, `lockVariant:true`, editor accordion, preview thumbnails.
- **Source HTMLs present** for all 15 new templates:
  - `templates/Autoshop/` — 01-foundry, 02-meridian, 03-volt, 04-redline, 05-maple-street
  - `templates/Restaurant/` — Harvest, Atelier, Press, Ember, Garden
  - `templates/Shirt Store/` — Editorial, Streetwear, Artisan, Modern, Kinetic
- **The pipeline already routes Hyperagent images into templates** — see §3.

## 2. Namespaces + letters

Per the playbook, claim the next consecutive letters:

| Family | Namespace | Letters | Variants (source → letter) |
|---|---|---|---|
| Autoshop | `autoshop` | **P–T** | Foundry=P, Meridian=Q, Volt=R, Redline=S, Maple Street=T |
| Restaurant | `restaurant` | **U–Y** | Harvest=U, Atelier=V, Press=W, Ember=X, Garden=Y |
| Shirt Store | `shirtstore` | **Z, AA, AB, AC, AD** | Editorial=Z, Streetwear=AA, Artisan=AB, Modern=AC, Kinetic=AD |

⚠️ **Decision point (needs your OK):** single letters run out at Z. Shirt Store needs **two-letter codes (Z, AA–AD)**. The render regexes and `data-page` scoping handle multi-char fine (`html[data-page="AA"]`). Alternative: give Shirt Store a word code (`shirtstore:1..5`). **Recommendation: Z + AA–AD** — keeps the letter convention. Flag if you'd rather use numbers.

`heroStyle` codes: `autoshop:P`, `restaurant:U`, `shirtstore:Z`, etc.

## 3. Hyperagent images — how "no more Airtable" is guaranteed

This is the core requirement, and it's **already the mechanism** the built families use:

- Section components read images from `content.<section>.image` (e.g. `hero.image`, `gallery.items[].image`, `about.image`) via `data-image-field`.
- The regen pipeline (`app/api/generate-website/route.ts`) populates those from **`generatedWebsites.enhancedImages`** — which, after the Hyperagent migration (PRs #234/#236/#238), holds the **Hyperagent-optimized images** (`enhanced_hero`, `enhanced_gallery_1..N`, `enhanced_portrait`), keyed and mapped to hero/about/services/featured, with the builder preferring the Convex `storageId` copy. Airtable is out of this path entirely.
- The route already forwards wrapped `hero`/`gallery`/`about`/`services` sections (`isWrappedObject` spread), so the new families' wrapped content shape gets the optimized images cleanly.

**So each new family gets Hyperagent images for free by using the same `data-image-field` + `content.<section>.image` contract as salonspa.** No per-family image wiring, no Airtable references. I will verify this end-to-end in the checklist (an enhanced-image submission renders the optimized photo in a new-family variant, not the original).

## 4. Per-family build (mirrors salonspa exactly)

For each family (`autoshop`, `restaurant`, `shirtstore`):

1. **`components/<family>/<Family>Spine.astro`** — shared base CSS (btn, kicker, h-sect, reveal), referencing `var(--brass)` / `var(--paper)` tokens.
2. **5 `Page<L>.astro` wrappers** — each emits the full doc, scopes its palette+font tokens + variant overrides to `html[data-page="<L>"]`, passes `lockVariant:true` to `resolveTheme`, sets `<html data-page="<L>">`.
3. **Per-letter Hero** (`Hero<L>.astro` ×5) — the source HTMLs have distinct hero treatments (same reason salonspa forked hero per letter).
4. **13 shared section components at the default letter** (`Header<F>`, `Trust<F>`, `About<F>`, `Services<F>`, `Why<F>`, `How<F>`, `Testimonials<F>`, `Gallery<F>`, `Faq<F>`, `Area<F>`, `Credentials<F>`, `Location<F>`, `CtaBand<F>`, `Footer<F>`) — letters 2–5 reuse them; fork a section per-letter **only** where a source HTML is structurally different (I'll fork where it matters, e.g. Restaurant's menu-board Services, Shirt Store's product grid).
5. Every editable text/image/link tagged `data-field` / `data-image-field` / `data-href-field` per the bridge contract. `<image-slot>` replaced with `<img data-image-field>` / background div. `image-slot.js` never copied.
6. Palette + font + contrast tokens (`--on-brass`/`--on-ink`/`--on-paper`) hand-tuned per variant from each source's `:root`.

**Estimated component count:** ~25 `.astro` per family × 3 = **~75 components** (matches salonspa's 25/family).

## 5. Wiring (per playbook §"Adding a new family")

- **`astro-site-template/src/pages/index.astro`** — 3 new regex matches (`autoshop:[P-T]`, `restaurant:[U-Y]`, `shirtstore:(Z|A[A-D])`) + 15 conditional `<PageX>` renders.
- **`genericThemeOverrides.ts`** — extend token aliases only if a family uses a new accent name; add `AUTO_BY_BUSINESS_TYPE` entries (`auto`/`autoshop`→autoshop, `restaurant`/`cafe`→restaurant, `retail`/`store`/`apparel`→shirtstore) in **both** that file and `lib/astro-builder.ts`.
- **Editor** (`components/editor/SandboxEditor.tsx`) — 3 new `_TEMPLATES` arrays + 3 accordions; add all 15 to `ALL_TEMPLATES`; add the 3 families to the `isBranded` reset list; extend the content-tab regex.
- **Three scripts** — extend `build-template-previews.mjs` (15 preview entries → `public/template-previews/{p..y,z,aa..ad}.html`), `wire-theme-overrides.mjs` (3 family entries), `strip-section-defaults-v3.mjs` (3 target dirs). Run all three (idempotent).
- **Schema** — only if a variant needs a new editable field not already in `websiteContent`; add to `convex/schema.ts` + `convex/websiteContent.ts` validator + run `convex codegen`. (Most fields already exist from prior families.)

## 6. Execution order (one PR, checkpointed internally)

1. **Autoshop (P–T)** end-to-end first — proves the path on a fresh family (spine → wrappers → sections → index routing → editor → previews → `astro build`).
2. **Restaurant (U–Y)** — mechanical port.
3. **Shirt Store (Z, AA–AD)** — mechanical port + the multi-letter-code handling.
4. **Wiring + scripts + schema** as each family lands.
5. **Verification checklist** (below) across all 15.
6. **One PR** to devpatch8, industry description, no Claude mention.

## 7. Verification (from the playbook checklist)

- [ ] `npx tsc --noEmit` passes; `npx astro build` succeeds with each of the 15 `heroStyle` codes.
- [ ] Each letter's compiled `dist/index.html` carries the right `<html data-page>` — no sister-wrapper palette leak.
- [ ] Extreme color scheme (black/yellow) renders legible CTAs (contrast tokens).
- [ ] Auto + nothing-picked renders each variant's hand-tuned palette (`lockVariant` holds).
- [ ] **Hyperagent-image check:** a submission with `enhancedImages` renders the optimized photo (Convex storage URL) in hero/gallery of a new-family variant — NOT the original R2 photo, NOT anything Airtable.
- [ ] Click-to-edit on hero headline, CTA, and image works on every variant.
- [ ] Section auto-hide when content empty (testimonials, gallery, trust, credentials).
- [ ] 15 preview thumbnails built.

## 8. Out of scope

- Removing/renaming existing A–O families.
- The `Landing Pages v01` / `NEO LAB` folders.
- New AI copy prompts per variant (families share business-type copy for now).
- Netlify production republish verification (done post-merge per your call).

## 9. Open decisions for you

1. **Shirt Store letter codes:** `Z + AA–AD` (keep letters) vs `shirtstore:1..5` (numbers)? **Rec: Z + AA–AD.**
2. **Per-letter section forking depth:** minimal (Hero only, like salonspa) vs fork Services/Gallery where sources differ (more visual distinction, more work). **Rec: Hero always per-letter; fork Services/Gallery only where a source is clearly structurally different — I'll call it out per template.**
3. **Business-type auto-mapping:** confirm `auto/autoshop → autoshop`, `restaurant/cafe/food → restaurant`, `retail/store/apparel/clothing → shirtstore`.
