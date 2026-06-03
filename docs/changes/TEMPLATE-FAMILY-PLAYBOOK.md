# Template Family Playbook

> Canonical reference for adding a new template family (Generic, Barbershop, Salon, Restaurant, Fitness, ...) to the website builder. Codifies the patterns the existing batches earned through painful iteration — read this before porting a new family.

The two existing batches (Generic → `TEMPLATES-GENERIC-PLAN.md`, Barbershop) are reference implementations. This doc is what stays true regardless of which family you're adding next.

---

## Vocabulary

- **Family** — a set of related templates that share a section spine and visual vocabulary. Generic (5 variants), Barbershop (5 variants), and any future family.
- **Variant** — one template within a family, identified by a single uppercase letter. Generic uses A–E, Barbershop uses F–J. The next family should claim the next letters in alphabetical order (K, L, M, ...).
- **Spine** — the shared base CSS for a family. One file, consumed by every variant's Page wrapper. Defines `.btn`, `.kicker`, `.h-sect`, body typography, reveal animations, etc. — anything that doesn't change per variant.
- **Page wrapper** — the per-variant top-level component (`PageX.astro`). Emits the full document (`<html>`, `<head>`, font + Leaflet links), scopes the variant's palette + font tokens, and composes the section components.
- **Section component** — a single block (Hero, Services, FAQ, Footer, ...). Lives in a per-section folder under the family. Reads `content.<section>` and renders the markup with `data-field` editor hooks.
- **`heroStyle` code** — the string in `customizations.heroStyle` that picks the active variant. Format: `<family>:<letter>`, e.g. `generic:A`, `barbershop:F`. The Astro entry page routes on this.

---

## What every family must provide

Before writing code, lock these decisions:

1. **A namespace** — the family name in lowercase kebab-case (`generic`, `barbershop`, `salon`, etc.). This becomes the directory name and the `heroStyle` prefix.
2. **A letter range** — pick 5 consecutive letters not already used. Generic = A–E, Barbershop = F–J. Next family = K–O.
3. **A shared section spine** — the ordered list of sections (Hero, About, Services, ...). All variants must use the same order and section IDs so click-to-edit hooks and content shape stay portable when admin swaps variants.
4. **A palette + typography table** — for each of the 5 variants, the hand-tuned `--paper`, `--ink`, `--brass` (or family-equivalent), `--brass-bright`, display font, condensed font, body font, serif font.
5. **A hero strategy** — one of:
   - **Shared hero, recolor only** — all 5 variants reuse `Hero<firstLetter>` and only swap tokens. Fastest. Variants feel like recolors.
   - **Per-variant hero** — build `Hero<L>` for each letter. Each variant gets a structurally distinct hero. More work, more visual distinction. Barbershop family went this route.

---

## File layout (for a new family `<family>` with letters `<L1>..<L5>`, first letter `<F>`)

```
astro-site-template/src/components/<family>/
├── <Family>Spine.astro              ← shared base CSS, injected once per page
├── Page<L1>.astro                   ← first variant wrapper (default)
├── Page<L2>.astro                   ← second variant wrapper
├── Page<L3>.astro
├── Page<L4>.astro
├── Page<L5>.astro                   ← last variant wrapper
├── header/Header<F>.astro
├── hero/
│   ├── Hero<L1>.astro               ← (only build per-letter heroes if going that route)
│   ├── Hero<L2>.astro               ← otherwise omit and reuse Hero<F> everywhere
│   ├── Hero<L3>.astro
│   ├── Hero<L4>.astro
│   └── Hero<L5>.astro
├── about/About<F>.astro
├── services/Services<F>.astro
├── why/Why<F>.astro
├── how/How<F>.astro
├── trust/Trust<F>.astro
├── testimonials/Testimonials<F>.astro
├── gallery/Gallery<F>.astro
├── faq/Faq<F>.astro
├── area/Area<F>.astro
├── credentials/Credentials<F>.astro
├── location/Location<F>.astro
├── marquee/Marquee<F>.astro
├── ctaBand/CtaBand<F>.astro
└── footer/Footer<F>.astro
```

Section components default to the first letter (`<F>`) and are reused by every Page wrapper in the family. Only build per-letter section components when a section's structural identity needs to change per variant (Barbershop did this for Hero only).

---

## Per-Page wrapper contract

Every `Page<L>.astro` does these six things in order:

1. Imports all 16 section components (Hero may be per-letter; others typically from `<F>`)
2. Imports `<Family>Spine` (shared base styles)
3. Calls `resolveTheme(layout, businessType, { lockVariant: true })` if you want variant palette to win on auto, or `resolveTheme(layout, businessType)` if you want the auto-by-business-type fallback to win
4. Defines its **palette + font + contrast tokens** scoped to `html[data-page="<L>"]`
5. Defines its **variant overrides** (oversized type, alt hover colors, etc.) also scoped to `html[data-page="<L>"]`
6. Sets `<html lang="en" data-page="<L>">` so the scoped CSS actually matches at runtime

### Required scoped tokens

Every wrapper must declare these inside its scoped `html[data-page="<L>"]` block:

```css
html[data-page="<L>"] {
  /* Background + structure */
  --paper: #...; --paper-2: #...;
  --ink: #...; --ink-2: #...; --ink-3: #...;
  --paper-rgb: r,g,b; --ink-rgb: r,g,b;

  /* Primary accent (family-specific name — e.g. --brass for Forge) */
  --brass: #...; --brass-bright: #...; --brass-rgb: r,g,b;

  /* Lines + muted text (opacity over ink/paper) */
  --line: rgba(<ink-rgb>, .14); --line-light: rgba(<paper-rgb>, .16);
  --muted: rgba(<ink-rgb>, .6); --muted-light: rgba(<paper-rgb>, .66);

  /* Typography */
  --display: "FontName", fallback;
  --cond: "FontName", fallback;
  --serif: "FontName", fallback;
  --body: "FontName", fallback;

  /* Layout */
  --pad: clamp(20px, 5vw, 96px);
  --maxw: 1280px;

  /* Contrast tokens — hand-tune per variant.
     For each background token (brass, ink, paper), the matching
     `--on-X` is the legible text color on that bg. */
  --on-brass: #...;  /* text color on --brass */
  --on-ink: #...;    /* text color on --ink */
  --on-paper: #...;  /* text color on --paper */
}
```

---

## Why everything is scoped to `html[data-page="<L>"]`

**The bug to avoid:** `astro-site-template/src/pages/index.astro` statically imports every Page wrapper in every family. Vite bundles ALL their `<style is:global>` blocks into the final HTML regardless of which variant actually renders. If two wrappers both define unscoped `:root { --brass: ... }`, the last-imported one wins via CSS cascade — so every variant accidentally inherits whichever palette was bundled last.

**The fix:** every wrapper sets `<html data-page="<L>">` and scopes ALL its global rules to `html[data-page="<L>"]`. The `<html>` element only carries one attribute value at a time, so only the matching scope's tokens cascade into `:root`. Sister wrappers' CSS is inert.

This applies to **everything** that lives in a wrapper's `<style is:global>` block — not just `:root`. Variant-specific rules like `Page<G>'s` oversized `.h-sect` must also be scoped: `html[data-page="G"] .h-sect { ... }`. Otherwise they leak too.

**Verification:** the compiled `dist/index.html` will contain multiple `html[data-page=X]{...}` blocks (Vite strips quotes from attribute selectors). Only the one matching the active letter applies at runtime.

---

## The spine (shared base CSS)

Create `<Family>Spine.astro` with one `<style is:global>` block holding everything that doesn't change per variant:

- Box-sizing reset, body typography, link reset, image reset
- `.wrap`, `.pad-y`, `.ink-sect`, `.eyebrow`, `.kicker`, `.h-sect`, `.lead`, `.sect-head`
- All `.btn` variants
- `.reveal` animation + reduced-motion media query

The spine references tokens via `var(--brass)`, `var(--paper)`, etc. Since the active palette block populates those tokens at the `:root` cascade level (via `html[data-page="<L>"]`), the spine just works for every variant.

**Critical: the spine must reference contrast tokens for button text colors, not raw tokens.** See next section.

---

## The contrast guarantee

**The bug to avoid:** if `.btn--brass` hardcodes `color: var(--ink)`, then a color scheme that flips `--brass` to white and `--ink` to white (e.g. monochrome black scheme) produces white-on-white invisible buttons. Admin only sees the button on hover when colors flip.

**The fix:** route button text colors through luminance-paired contrast tokens, with fallback chains for safety:

```css
.btn--brass {
  background: var(--brass);
  color: var(--on-brass, var(--ink));   /* var(--ink) is just the fallback */
}
.btn--brass:hover {
  background: var(--ink);
  color: var(--on-ink, var(--paper));
}
.btn--ghost {
  background: transparent;
  color: var(--on-paper, var(--ink));
  border-color: var(--on-paper, var(--ink));
}
```

Each variant declares its own `--on-brass` / `--on-ink` / `--on-paper` hand-tuned to its palette (see "Required scoped tokens" above). The override CSS layer recomputes them via WCAG luminance for any explicit admin pick, so picking a black scheme produces white text and picking a yellow scheme produces black text.

**Verification:** sweep all variants × all schemes (black, yellow, dark, blue, brown, auto) and measure the contrast ratio between `--brass` and `--on-brass` (and `--ink` ↔ `--on-ink`, `--paper` ↔ `--on-paper`). All combinations should pass WCAG AA (≥4.5:1 for body, ≥3:1 for large/button text).

---

## The theming model

Three forces have to be reconciled:

1. **Variant identity** — each variant has a hand-tuned palette + display font that gives it personality.
2. **Admin theme picker** — admin can pick a Color Scheme (blue, black, brown, gold, etc.) and Font Pairing (modern, bold, elegant, gourmet, etc.) from the Theme tab.
3. **Contrast** — buttons must be readable regardless of which palette is active.

### Resolution behavior with `lockVariant: true`

When a Page wrapper passes `lockVariant: true` to `resolveTheme`:

| Admin selection | What renders |
|---|---|
| Color Scheme = **"auto"**, no Font Pairing | Variant's hand-tuned palette + display font win. No override block emitted. |
| Color Scheme = **explicit** (blue, black, etc.) | Color override fires, recolors variant. Display font stays variant if no font pick. |
| Color Scheme = "auto", Font Pairing = **explicit** | Variant palette wins, but display font swaps to admin's pick. |
| Both explicit | Both override. |

`lockVariant` short-circuits the auto-by-business-type fallback (so picking "barber" doesn't force the brown auto-scheme over the variant's brass) but still respects explicit picks.

### Resolution behavior WITHOUT `lockVariant`

| Admin selection | What renders |
|---|---|
| Color Scheme = "auto", no business_type match | No override; variant wins. |
| Color Scheme = "auto", business_type = "barber" | Brown auto-scheme override fires (variant flattened). |
| Color Scheme = explicit | Override fires. |

**Pick `lockVariant: true`** for families where each variant has hand-tuned palette identity that should win on auto. **Omit it** for families where variants are essentially recolor-ready shells.

### The override CSS layer

`buildOverrideCss(scheme, pairing)` in `astro-site-template/src/lib/genericThemeOverrides.ts` emits an `html:root { ... !important; }` block AFTER all per-page palette blocks. `html:root` matches every `<html>` regardless of `data-page` attribute, so it wins via `!important` whenever it emits. Returns `''` when no override is needed, so variants render unaltered.

The override emits:

- All scheme tokens (`--paper`, `--ink`, `--brass`, `--brass-bright`, `--brass-rgb`, plus generic aliases like `--gold`, `--peach`, `--amber`, `--lime`, `--blue`, `--teal`, `--bg`, `--panel` — so any template family picks up the admin pick regardless of which token name it uses internally)
- All font tokens (`--disp`, `--sans`, `--serif`, `--mono`, plus family aliases like `--display`, `--body`, `--cond`)
- Contrast tokens (`--on-primary`, `--on-ink`, `--on-paper`, `--on-accent`, `--on-brass`) computed via WCAG luminance

When adding a new family that uses a token name not already aliased in `buildOverrideCss`, extend the override to emit that alias too. Otherwise admin's color pick won't reach the new family.

---

## Render selector

`astro-site-template/src/pages/index.astro` routes `customizations.heroStyle`:

```ts
const heroStyle: string = customizations.heroStyle ?? '';
const genericMatch    = /^generic:([A-E])$/.exec(heroStyle);
const barbershopMatch = /^barbershop:([F-J])$/.exec(heroStyle);
// Add a new line per family:
const <family>Match   = /^<family>:([<L1>-<L5>])$/.exec(heroStyle);
```

Each match resolves to the corresponding letter, and a block of conditional renders picks the right wrapper:

```astro
{barbershopLetter === 'F' && <PageF siteData={siteData} />}
{barbershopLetter === 'G' && <PageG siteData={siteData} />}
...
```

Add 5 new conditionals per family.

---

## Build pipeline (unchanged)

```
Next.js API route /api/generate-website
  → transformToAstroData(content, customizations, photos)
  → write site-data.json
  → execSync('node astro-site-template/build-worker.mjs ...')
    → reads site-data.json
    → index.astro routes to PageX based on heroStyle
    → astro build → dist/index.html (~100–180KB self-contained)
  → read dist/index.html
  → store in Convex (generatedWebsites.htmlContent)
  → iframe srcDoc displays it in admin sandbox
  → Republish → push to Netlify
```

Build time: ~2.5 seconds per regen. No pipeline changes needed when adding a family — the pipeline reads `heroStyle` and Astro does the routing.

---

## Editor integration

### SandboxEditor Template tab — accordion per family

Each family gets its own accordion in `components/editor/SandboxEditor.tsx`. The pattern:

```tsx
const <FAMILY>_TEMPLATES = [
  { letter: 'X', code: '<family>:X', label: 'Variant Name', tagline: 'Short tagline', preview: '/template-previews/x.html' },
  // ... 5 entries
] as const;
```

Add to the existing `ALL_TEMPLATES` array so `onPickTemplate` can find the variant by code.

The accordion-open default for each family: open if the active variant belongs to that family OR if no variant is active and this is the first accordion. Otherwise collapsed but expandable.

When admin picks a variant, `setPendingCustomizations` updates `heroStyle` AND all section style codes AND `navbarStyle`. Save changes flushes through `/api/save-content` → `/api/generate-website`.

### Content tab visibility gate

Extend the regex when adding a family:

```ts
/^(generic:[A-E]|barbershop:[F-J]|<family>:[<L1>-<L5>])$/.test(heroStyle)
```

### Click-to-edit

All section components in every family must use the same `data-field` / `data-image-field` / `data-href-field` attributes (matched to the schema paths). The editor bridge (`components/editor/editorBridge.ts`) is family-agnostic — it routes any matching attribute to the sidebar input or image picker. No bridge changes needed per family.

### Content portability across variants

Section components within a family **must read the same content shape**. Within Barbershop, all 5 Hero variants (HeroF–J) read the same `content.hero` fields (`headlineLines[]`, `kicker`, `sub`, `cta1`, `cta2`, `image`, `rating`, `marqueeWords[]`, `ghostWord`). When admin swaps from one variant to another, their headline, description, CTAs, and rating stay intact — only the layout reskins.

When you add a new field needed by one variant (e.g. `hero.ghostWord` for a variant with a ghost-stroke giant word), give every other variant in the family a sensible fallback path so swapping doesn't break.

Across families, the content shape can differ — Generic uses `content.hero.headline` (single string) while Barbershop uses `content.hero.headlineLines[]` (array). The 3-tier content resolution (admin → AI extraction → derived defaults) handles cross-family transitions through `lib/derive-content-defaults.ts`.

---

## Scripts

Three helper scripts handle bulk operations across all families.

### `scripts/build-template-previews.mjs`

Reads source HTMLs from each family's `templates/<family>/` folder; writes sanitized copies to `public/template-previews/<letter>.html`. Sanitization strips authoring-time `image-slot.js`, replaces `<image-slot>` with placeholder divs, removes the floating switcher nav and CTA.

When adding a new family, extend the `TEMPLATES` array with one entry per variant (letter, source dir, source filename, label).

```bash
node scripts/build-template-previews.mjs
```

### `scripts/wire-theme-overrides.mjs`

Idempotently injects the theme override hookup (the `resolveTheme` import + the resolver `const` block + the `<style is:global set:html={...}>` block) into every Page wrapper. Looks for already-injected markers, only patches on first run.

When adding a new family, extend the `FAMILIES` array with one entry: `{ dir, letters, footerImportFor }`. The `footerImportFor` callback returns the regex to anchor the helper import against — typically the family's Footer component import line.

```bash
node scripts/wire-theme-overrides.mjs
```

### `scripts/strip-section-defaults-v3.mjs`

Walks every family's component folder. Strips template-branded fallback array literals — replaces `Array.isArray(x) && x.length ? x : [demo, items, ...]` with `[]`. Prevents demo content from leaking when admin clears a field.

When adding a new family, extend `TARGET_DIRS` with the family's components folder.

```bash
node scripts/strip-section-defaults-v3.mjs
```

---

## Common gotchas (in order of pain experienced)

- **CSS bleed across sister Page wrappers** — every PageX wrapper's `<style is:global>` ships in every build because index.astro static-imports them all. Solved via `html[data-page="<L>"]` scoping. Don't add unscoped `:root` rules to any wrapper. Don't add unscoped global selectors either (`.h-sect`, `.btn`, etc.) — those leak too.
- **Override CSS `!important` defeats variant palettes** — solved via `lockVariant: true`. If your family has hand-tuned per-variant palettes you want to survive auto-scheme, pass `lockVariant`.
- **Contrast on extreme schemes** — buttons must consume `--on-<bg-token>`. If you add a new button class, route its text color through one of the contrast tokens, not raw `--ink` / `--paper`.
- **Vite strips quotes from attribute selectors** — `html[data-page="F"]` in source becomes `html[data-page=F]` in `dist/index.html`. Don't rely on quotes when regex-searching compiled output.
- **`mapStyleToLetter` pass-through** — `lib/astro-builder.ts` has a numeric → letter map for legacy compatibility. Family-prefixed codes like `"barbershop:I"` aren't in the map, so they pass through verbatim. Important for site-data.json round-trip; don't add prefixed codes to the map.
- **Auto color scheme by business_type** — set in both `lib/astro-builder.ts` (AUTO_SCHEME_BY_BUSINESS_TYPE) AND `astro-site-template/src/lib/genericThemeOverrides.ts` (AUTO_BY_BUSINESS_TYPE). Both must agree or the auto pick will differ between Next.js side and Astro side.
- **Section component visibility** — visibility flags accept both legacy array shape (`Array.isArray(content.testimonials)`) AND new object-with-items shape (`Array.isArray(content.testimonials?.items)`). When porting, check both.
- **Image-empty placeholders in gallery/grid** — don't pad arrays with empty placeholders to fill a grid. Filter out items without images and let the section auto-hide if it ends up empty.
- **Convex schema validators** — when adding a new field that admin can edit, update `convex/schema.ts`, the mutation arg validator in `convex/websiteContent.ts`, and any consuming TypeScript. All three must agree.
- **Convex codegen** — after schema changes run `npx convex codegen` then `npx next build` to verify types.

---

## Verification checklist

Before merging a new family:

- [ ] `npx tsc --noEmit` passes
- [ ] `npx astro build` succeeds with `customizations.heroStyle` set to each new variant in turn
- [ ] Each letter's `<html data-page>` attribute matches the active variant — no sister-wrapper palette leak (check `dist/index.html`)
- [ ] Extreme color scheme combination (black, yellow, or whatever flips your `--brass` to a near-bg value) renders legible CTAs — the canonical contrast regression test
- [ ] Explicit Color Scheme + Font Pairing pick reaches the family (override block emits with `!important`)
- [ ] Auto + nothing-picked on each variant renders the variant's hand-tuned palette (no override block emitted if `lockVariant: true`)
- [ ] Click-to-edit on hero headline, CTAs, and image works on every variant
- [ ] Section auto-hide works when content is empty (testimonials, credentials, gallery, trust)
- [ ] All preview thumbnails for the new family rebuilt (`public/template-previews/<letter>.html`)
- [ ] Republish to Netlify shows the swapped variant in production

---

## Adding a new family — step-by-step

1. **Drop source HTMLs** into `templates/<family>/` (one per variant, 5 total).
2. **Lock the spec** — palette table, font table, hero strategy (shared vs per-letter), letter range.
3. **Create `astro-site-template/src/components/<family>/`** and copy the layout from the file-layout section above.
4. **Build `<Family>Spine.astro`** with shared base CSS.
5. **Build the 16 section components** under their respective folders. Start with the default letter (`<F>`) and reuse across all variants. Only fork per-letter where the source HTMLs structurally differ.
6. **Build the 5 Page wrappers** (`Page<L1>.astro` ... `Page<L5>.astro`) using the per-wrapper contract above. Each scoped to `html[data-page="<L>"]`.
7. **Update `astro-site-template/src/pages/index.astro`** — add the family's regex match + 5 conditional renders.
8. **Extend `genericThemeOverrides.ts`** if your family uses a token name not already aliased (e.g. if your primary accent is called `--accent` instead of `--brass`).
9. **Decide on `lockVariant`** — pass it from the Page wrappers if variant palettes should win on auto.
10. **Update `AUTO_SCHEME_BY_BUSINESS_TYPE`** in both `lib/astro-builder.ts` and `astro-site-template/src/lib/genericThemeOverrides.ts` if a business_type maps to your family.
11. **Extend the editor** — add `<FAMILY>_TEMPLATES` array, add accordion in SandboxEditor, extend content tab regex.
12. **Extend the three scripts** — `build-template-previews.mjs`, `wire-theme-overrides.mjs`, `strip-section-defaults-v3.mjs`.
13. **Run all three scripts** — they're idempotent.
14. **Run verification checklist.**
15. **Document the family** in a sibling `TEMPLATES-<FAMILY>-PLAN.md` — what's unique, what was painful, what you'd do differently. Future agents will read this for context.

---

## Open patterns / future improvements

- **Per-variant section components beyond Hero** — Barbershop only forked Hero per letter; sources had structural differences in About / Services / Gallery for some variants. Port these if visual distinctness needs to go deeper. Same scoping rules apply: variant-specific structural overrides live in the Page wrapper scoped to `html[data-page="<L>"]`.
- **Variant-aware default content** — currently the AI generates one flavor of copy per business_type regardless of which letter is active. Could tune prompts per variant (Cinematic = editorial tone, Kinetic = energetic short copy, Minimal = sparse refined copy).
- **Token aliasing audit** — every new family that uses a custom primary accent name adds an entry to `buildOverrideCss`. At some point this should consolidate into a single `--primary` token internally, with backward-compat aliases.
