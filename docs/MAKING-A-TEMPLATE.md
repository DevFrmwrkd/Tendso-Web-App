# Making a Tendso template

Instructions for building a new website template in `astro-site-template/`.
Written to be handed to an agent as-is. Read all of it before writing a file —
most of the rules below exist because breaking them shipped a bug to a paying
customer, and several of them fail **silently**.

---

## 1. What you are building

A **configurable shell**, not a page.

Every piece of content — every heading, paragraph, price, image, link — must
stay editable by an admin in the website editor after the template ships. You
are building the frame. The owner's words and photos fill it.

If you hard-code a sentence, bake in an image, or bind a field the editor cannot
reach, the template is broken even if it looks perfect. Tendso promises business
owners free edits for a year; content nobody can edit turns every one of those
requests into a developer job.

---

## 2. The editor contract — the rule that matters most

The editor does not have a config file listing what is editable. **It reads your
markup.** `scripts/gen-template-fields.mjs` scans your components for three
attributes and builds the editor's field list from what it finds:

```astro
<h1 data-field="hero.headline">{content.hero?.headline}</h1>
<img data-image-field="about.image" src={content.about?.image} />
<a  data-href-field="ctaBand.href" href={content.ctaBand?.href}>…</a>
```

Two hard rules:

**(a) Every visible piece of content carries one of those attributes.** No
exceptions. Text with no `data-field` is text nobody can ever change.

**(b) The path must start with a declared content root.** The roots are the
`ROOTS` array in `scripts/gen-template-fields.mjs`:

```
hero  about  services  why  how  testimonials  gallery  faq  area
credentials  location  ctaBand  footer  trust  marquee  contact
navbar_links  business_name  tagline  navCtaText  navCtaHref
```

Inventing a root — `data-field="specialOffer.headline"` — is the failure this
contract exists to prevent. The scan **fails open**: it silently skips anything
it does not recognise, so the text renders on the live site and is uneditable
forever. No error, no 404, nothing in a log.

`scripts/check-template-field-roots.mjs` now catches exactly this. Run it.

If you genuinely need a new root, add it to the schema
(`components/editor/genericContentSchema.ts`) **and** to `ROOTS` — do not work
around the guard.

> `nav.*` is the one exception already in the tree: it is layout-backed and the
> editor excludes it deliberately (navigation is edited via `navbar_links`).
> Do not copy that pattern for anything new.

---

## 3. Copy the gold standard

Port from **`hospitality/PageBJ.astro`** and its sections (`CtaBandBJ` in
particular). It is the most rigorous wrapper in the repo and documents its own
rules inline — never-fabricate, no baked hex, button safety.

Do **not** copy the older `trades/AU` or `generic/PageA–E` conventions. They
predate several of the rules below.

---

## 4. Forbidden class names

`buildOverrideCss` pins these with `!important` for reasons most designs do not
share. Using them means the theme engine overrides your design and you will not
understand why:

```
.btn-primary  .btn-ghost  .btn-yellow  .btn-light
.nav-cta  .nav-right  .testi  .cta-band  .trust
```

…and `hero` as a class on a `<section>`.

Use the double-dash primitives instead: **`.btn--fill`**, **`.btn--line`**,
**`.linkc`**.

**A primitive must declare what it is.** Six wrappers set no `background` on
their base `.btn`, so an outline button's fill was decided by whichever leaked
rule landed last. State every visual property you depend on. Do not rely on
nothing else having an opinion.

---

## 5. CSS scoping — the leak that makes other templates look broken

`src/pages/index.astro` imports **every** wrapper, so Astro bundles **every**
`is:global` block into one stylesheet shipped on **every** generated page.

An unscoped rule in your template paints all 70 templates.

This was live on customer sites: 158 unscoped rules across 11 files. The
symptoms look like *a different* template is broken — `em { font-style: italic;
color: var(--peach) }` from one wrapper made emphasis slanted and salmon
everywhere.

**Anchor every global rule to your own page:**

```css
html[data-page="BS"] .card { … }
```

**The specificity trap.** Newer wrappers wrap primitives in `:where()` so
section modifiers can beat base rules — but `:where()` contributes **zero**
specificity. `html[data-page="BS"] :where(.btn--ink:hover)` scores (0,1,1) and
**loses** to a leaked, unscoped `.btn:hover` at (0,2,0). If your control looks
wrong, suspect a leak from another family before you suspect your own CSS.

Never declare a palette on a bare `:root`.

---

## 6. The font sentinel — silent, and it has shipped broken twice

`astro-builder` defaults `layout.fontPairing` to the literal string `'modern'`
for any owner who never opened the font picker — which is most of them.
`lockVariant` does **not** blank it. Without this guard the engine force-swaps
your design's fonts on nearly every real site:

```js
pairing === 'modern' ? '' : pairing
```

Glacier (`barbershop:BP`) shipped without it. Its preview looked right because
the preview seed said `'auto'`, while every real site rendered in Space Grotesk.

**When you seed the fixture to check your render, use `fontPairing: 'modern'`,
not `'auto'`.** `'auto'` hides the bug.

Gate any wrapper-side palette fix on `__themeScheme`, never on `__overrideCss` —
a font pick alone makes the override block non-empty.

---

## 7. Mobile and tablet — not an afterthought

Most Tendso customers reach these sites on a phone, on mobile data. A template
that only works at 1440px is not finished.

The house breakpoints are already settled. Measured across every template:

| breakpoint | uses | what it is for |
|---|---|---|
| `max-width: 760px` | 610 | **Phone.** Stack to one column, hamburger nav, full-width CTAs |
| `max-width: 520px` | 338 | Small-phone refinement — tighten type and padding |
| `max-width: 900px` | 159 | **Tablet / narrow laptop** |

**Use 760, 520 and 900. Do not invent your own.** The scattered 820 / 860 / 880
breakpoints in older wrappers are the mess, not the model — a nav that hides at
760 while its replacement appears at 980 leaves a **dead zone** where there is
no navigation at all. That exact bug shipped in the salonspa family.

Requirements:

- **A hamburger nav in the header.** 44 of 50 header components already have
  one (`.nav-burger` plus an inline toggle). Copy the pattern from your family's
  header, or from `hospitality/HeaderBJ`.
- **No horizontal overflow at 360px.** That is the test width — it is narrower
  than most phones on purpose. Check it, do not assume it.
- **Hide and show at the SAME breakpoint.** If the desktop nav hides at 760, the
  burger appears at 760. Not 761, not 980.
- **Type must never grow as the viewport narrows.** A base
  `font-size: clamp(min, Nvw, max)` restated at a narrower breakpoint can yield
  *more* at that breakpoint than one pixel above it, so the heading jumps up as
  the window shrinks. `scripts/check-type-ladders.mjs` enforces this — it is one
  of the five guards, and it has a baseline of 32 known offenders it will not
  let you add to.
- **Do not force one column where two already fit.** Stat bands and small
  galleries that sit two-up at 360px without overflowing are deliberate; forcing
  them single-column looks worse. Judge it at 360px rather than applying a rule.

Verify at three widths, not one: **360**, **768** and **1440**. The tablet width
is where the dead zones live, and it is the one people skip.

## 8. Files you must touch

Pick your letter from the end of the alphabet series (`BS`, `BT`, …) and check
it is unused. A design's "reserved" letters are a **collision, not a courtesy** —
one handover reserved L–P, all five of which were live templates.

| # | File | What |
|---|---|---|
| 1 | `astro-site-template/src/components/<family>/*XX.astro` | Your section components |
| 2 | `astro-site-template/src/components/<family>/PageXX.astro` | The wrapper |
| 3 | `astro-site-template/src/pages/index.astro` | **Three edits**: the import, the family letter regex, the dispatch line |
| 4 | `components/editor/templateCatalog.ts` | `{ letter, code, label, tagline, preview }` |
| 5 | `components/editor/templateSectionLabels.ts` | What your template calls each section |
| 6 | `public/template-previews/xx.html` | Generated — see below |

Then regenerate:

```bash
npm run templates:sync
```

> `build-template-previews.mjs` rewrites **all** previews. Afterwards run
> `git checkout -- public/template-previews/` and re-add only your new file, or
> the diff carries ~47 no-op files.

---

## 9. Verify — do not skip this

```bash
npm run check:templates     # all five guards
npx tsc --noEmit
npx jest
node astro-site-template/build-worker.mjs "<ABSOLUTE path to astro-site-template>"
```

The astro build **does** run locally (the Next build does not). Pass the path
absolute — a relative one creates a nested cache directory.

**Then look at the render, twice**, by seeding
`astro-site-template/src/data/site-data.json` with your `customizations.heroStyle`:

1. **Full payload** — everything renders, nothing overflows, no leaked styling.
2. **Empty first-build payload** — every section must **hide itself** rather
   than ship an empty shell. A template that renders a heading over nothing is
   how fabricated-looking pages reach customers.

`git checkout --` the fixture when you are done. Note it ships with
`visibility.trustBlock: false` and empty `testimonials.items`, so those two
sections legitimately do not render — augment the fixture before concluding a
section is broken. And overwrite **every** `content.*` key: the tracked fixture
is a real submission, and a partial seed leaks that business's data into your
committed preview.

---

## 10. Definition of done

- [ ] Every visible string and image has a `data-field` / `data-image-field` / `data-href-field`
- [ ] Every path starts with a declared root — `check-template-field-roots` passes
- [ ] No forbidden class names; primitives declare their own background
- [ ] Every `is:global` rule anchored to `html[data-page="XX"]`
- [ ] Font sentinel present; fixture seeded with `'modern'`
- [ ] All five guards pass, `tsc` clean, `jest` green, astro build succeeds
- [ ] Rendered twice — full payload, and empty payload with every section hiding
- [ ] Checked at 360px, 768px and 1440px — no overflow, nav reachable at every width
- [ ] Previews diff contains **only** your new file

---

## 11. What not to do

- **Do not trade the design away.** If a design file was handed over, reproduce
  it — its palette and layout are the spec, not a starting point.
- **Do not invent content.** No placeholder testimonials, no made-up
  certifications, no invented opening hours. A blank section is correct; a
  fabricated one has reached real customers before.
- **Do not hard-code anything an owner might want changed.**
- **Do not edit the `.generated.ts` files by hand.** Change the components and
  regenerate. A hand-edit is wiped by the next `templates:sync`.
