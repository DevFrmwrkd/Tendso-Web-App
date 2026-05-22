# Components

Flat, append-only list of every block as a component with variants.
New agents add to the bottom of each component's variant list — never restructure.

Format:

```
COMPONENT.vN
  scope:    which buckets / "all"
  tag:      required | recommended | optional
  tokens:   CONFIG keys it binds
  notes:    one line, what makes this variant distinct
```

---

## HERO

- **HERO.v1** — *editorial split*
  - scope: lp-01-food, lp-07-services
  - tag: required
  - tokens: `business.name, hero.kicker, hero.headline, hero.lede, hero.primaryCta, hero.secondaryCta, hero.image, hero.imageAlt`
  - notes: large serif headline left, full-bleed photo right, kicker line up top.
- **HERO.v2** — *full-bleed cover + overlaid wordmark*
  - scope: lp-02-beauty, lp-04-automotive
  - tag: required
  - tokens: same as v1
  - notes: photo fills, wordmark and headline overlay with strong type contrast.
- **HERO.v3** — *type-first, photo strip*
  - scope: lp-06-fitness, lp-08-education
  - tag: required
  - tokens: same as v1
  - notes: oversized display headline dominates; thin photo band beneath.
- **HERO.v4** — *clinical card*
  - scope: lp-05-medical
  - tag: required
  - tokens: same as v1
  - notes: calm composition, generous whitespace, single rounded portrait card.
- **HERO.v5** — *blueprint grid*
  - scope: lp-03-retail
  - tag: required
  - tokens: same as v1
  - notes: grid lines, monospace coordinates, photo inset into the grid.
- **HERO.v6** — *service-area hero (no storefront)*
  - scope: lp-09-trades
  - tag: required
  - tokens: same as v1 + `hero.serviceBadge`
  - notes: emergency phone strip, service-area shape behind, photo of work.

## TRUST

- **TRUST.v1** — *credential ribbon*
  - scope: all
  - tag: recommended
  - tokens: `trust.years, trust.licenses[], trust.memberships[], trust.gbpSlot`
  - notes: horizontal strip of established-since, license numbers, association marks; GBP rating slot is commented and empty.

## ABOUT

- **ABOUT.v1** — *two-column story*
  - scope: lp-01, lp-05, lp-07, lp-08
  - tag: recommended
  - tokens: `about.heading, about.paragraphs[], about.signature, about.portrait`
  - notes: 2–3 paragraphs paired with a portrait or workspace photo.
- **ABOUT.v2** — *manifesto block*
  - scope: lp-02, lp-06
  - tag: recommended
  - tokens: same as v1
  - notes: full-width statement, no portrait, type-driven.
- **ABOUT.v3** — *workshop note*
  - scope: lp-03, lp-04, lp-09
  - tag: recommended
  - tokens: same as v1
  - notes: practical, plain-spoken; photo of the space or the tools.

## SERVICES

- **SERVICES.v1** — *menu list*
  - scope: lp-01
  - tag: required
  - tokens: `services[] {name, description}`
  - notes: typographic list, no prices, organised like a printed menu.
- **SERVICES.v2** — *card grid*
  - scope: lp-02, lp-05, lp-07
  - tag: required
  - tokens: same as v1
  - notes: 2- or 3-column cards with name + short description.
- **SERVICES.v3** — *numbered table*
  - scope: lp-03, lp-04, lp-09
  - tag: required
  - tokens: same as v1
  - notes: index numbers + service name + plain-text description; reads like a service ticket.
- **SERVICES.v4** — *programme stack*
  - scope: lp-06, lp-08
  - tag: required
  - tokens: same as v1
  - notes: stacked horizontal rows, each programme/class as a band.

## WHY-US

- **WHY.v1** — *three pillars*
  - scope: lp-05, lp-07, lp-08
  - tag: recommended
  - tokens: `why[] {title, body}`
  - notes: three reasons, each one a short paragraph.
- **WHY.v2** — *evidence list*
  - scope: lp-01, lp-02, lp-04, lp-06, lp-09
  - tag: recommended
  - tokens: same as v1
  - notes: numbered or bulleted, each item a concrete fact (not a slogan).
- **WHY.v3** — *spec sheet*
  - scope: lp-03
  - tag: recommended
  - tokens: same as v1
  - notes: tabular, label/value pairs.

## HOW-IT-WORKS

- **HOW.v1** — *three-to-four step row*
  - scope: all
  - tag: recommended
  - tokens: `how[] {step, title, body}`
  - notes: numbered steps from first contact to outcome.

## TESTIMONIALS

- **TEST.v1** — *quotes column*
  - scope: lp-01, lp-05, lp-07, lp-08, lp-09
  - tag: recommended
  - tokens: `testimonials[] {quote, name, context}`
  - notes: 2–3 quotes stacked, names attached.
- **TEST.v2** — *editorial pull-quote*
  - scope: lp-02, lp-06
  - tag: recommended
  - tokens: same as v1
  - notes: one giant lead quote + two small supporting ones.
- **TEST.v3** — *card row*
  - scope: lp-03, lp-04
  - tag: recommended
  - tokens: same as v1
  - notes: three side-by-side cards.

## GALLERY

- **GALLERY.v1** — *masonry grid*
  - scope: lp-01, lp-02, lp-05
  - tag: recommended
  - tokens: `gallery[] {src, alt}`
  - notes: 6–9 images, mixed aspect.
- **GALLERY.v2** — *contact-sheet*
  - scope: lp-03, lp-04, lp-09
  - tag: recommended
  - tokens: same as v1
  - notes: uniform thumbnails with monospace captions.
- **GALLERY.v3** — *full-bleed strip*
  - scope: lp-06, lp-08
  - tag: recommended
  - tokens: same as v1
  - notes: edge-to-edge horizontal strip, oversized images.
- **GALLERY.v4** — *plate row*
  - scope: lp-07
  - tag: recommended
  - tokens: same as v1
  - notes: refined three-up with captions in small caps.

## FAQ

- **FAQ.v1** — *expandable list*
  - scope: all
  - tag: recommended
  - tokens: `faq[] {q, a}`
  - notes: `<details>`/`<summary>`, 5–8 entries, mirrors the FAQPage JSON-LD.

## SERVICE-AREA

- **AREA.v1** — *named list*
  - scope: lp-01, lp-02, lp-03, lp-05, lp-07, lp-08
  - tag: recommended
  - tokens: `area.heading, area.places[]`
  - notes: typographic list of places served.
- **AREA.v2** — *radius map note*
  - scope: lp-04, lp-06
  - tag: recommended
  - tokens: same as v1
  - notes: list + simple radius indicator.
- **AREA.v3** — *coverage zone (no storefront)*
  - scope: lp-09
  - tag: recommended
  - tokens: same as v1
  - notes: prominent zone showing service-area-only coverage, no shopfront address.

## CREDENTIALS

- **CRED.v1** — *list of marks*
  - scope: all
  - tag: recommended
  - tokens: `credentials[] {label, detail}`
  - notes: licence numbers, certifications, memberships, insurance.

## LOCATION

- **LOC.v1** — *NAP + hours + map*
  - scope: all except lp-09
  - tag: required
  - tokens: `location {name, address, phone, email}, hoursGbpSlot, map.embed`
  - notes: name/address/phone block + GBP hours slot + map placeholder.
- **LOC.v2** — *service-area location (no storefront)*
  - scope: lp-09
  - tag: required
  - tokens: `location {name, phone, email}, hoursGbpSlot`
  - notes: no street address; service-area + phone + dispatch hours.

## CTA-BAND

- **CTA.v1** — *flat colour band*
  - scope: lp-05, lp-07, lp-08
  - tag: recommended
  - tokens: `cta.heading, cta.body, cta.primary, cta.secondary`
  - notes: full-width tinted band with two buttons.
- **CTA.v2** — *editorial band*
  - scope: lp-01, lp-02
  - tag: recommended
  - tokens: same as v1
  - notes: type-led, no button styling tricks, generous space.
- **CTA.v3** — *industrial bar*
  - scope: lp-03, lp-04, lp-06, lp-09
  - tag: recommended
  - tokens: same as v1
  - notes: high-contrast, monospace label + chunky button.

## CLICK-TO-MESSAGE

- **MSG.v1** — *floating button*
  - scope: all
  - tag: recommended
  - tokens: `messaging {whatsapp, messenger}`
  - notes: fixed bottom-right deep-link button.

## FOOTER

- **FOOTER.v1** — *NAP + nav*
  - scope: all
  - tag: required
  - tokens: `business.name, location.*, footer.links[]`
  - notes: name/address/phone repeated; sitemap-style links; copyright.
