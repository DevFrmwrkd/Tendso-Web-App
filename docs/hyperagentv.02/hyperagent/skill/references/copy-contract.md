# Copy contract - exact keys, caps, grounding

The agent emits **one JSON object** of website copy. `build_payload.py` enforces this contract; if it rejects a field, fix that field and re-run. Output JSON only - no prose, no markdown, no explanation.

## Grounding rules (read first)

- **Ground everything in the submission.** Use `transcript`, `qa`, and `business` only. If a claim isn't supported there, don't write it.
- **Never fabricate facts.** No invented awards, years-in-business, certifications, prices, or guarantees. When unsure, omit the field - an omitted field is better than a false one.
- **Write like a real local business**, in clear, warm, plain English. No hype, no cliches ("we are passionate about excellence"), no emoji.
- **Respect the caps.** They keep copy template-safe and cheap. Caps are word counts unless noted.
- **English by default.** If the transcript is in Tagalog/Taglish, write natural English but you may keep a signature phrase verbatim if it's the business's own tagline.

## Core fields (required - drop-in compatible with the existing pipeline)

| Key | Cap | Meaning | Example |
|---|---|---|---|
| `heroHeadline` | <= 8 words | The single biggest promise. | "Sharp cuts, classic barbershop feel" |
| `heroSubHeadline` | <= 16 words | One supporting line. | "Walk-in barbershop in Cebu City for fresh fades, beard trims, and hot-towel shaves." |
| `aboutDescription` | <= 60 words | Who they are, grounded in the interview. | "Run by Mang Tony for over a decade..." |
| `servicesDescription` | <= 40 words | What they offer, in prose. | "Haircuts, fades, beard grooming, and hot-towel shaves for walk-ins and regulars." |
| `contactCta` | <= 12 words | The action. | "Drop by today or message us to book a chair." |

## Extended fields (optional - write only if well-grounded)

| Key | Cap | Meaning |
|---|---|---|
| `heroBadgeText` | <= 4 words | Small badge, e.g. "Since 2012", "Walk-ins welcome". Only if true. |
| `heroCtaLabel` | <= 4 words | Button text, e.g. "Message us". |
| `aboutHeadline` | <= 8 words | Section title for About. |
| `aboutTagline` | <= 12 words | One-line essence. |
| `aboutTags` | <= 5 items, <= 3 words each | Short descriptors, e.g. ["Family-run", "Walk-ins welcome"]. |
| `servicesHeadline` | <= 8 words | Section title for Services. |
| `servicesSubheadline` | <= 16 words | Supporting line. |
| `featuredHeadline` | <= 8 words | Gallery/featured title. |
| `tagline` | <= 10 words | The business's overall tagline. |
| `tone` | 1 word | Copy tone you used: `warm`, `professional`, `playful`, `calm`. |
| `services` | <= 6 items | `[{ "name": <=4 words, "description": <=14 words }]`, grounded in the interview. |

## Shape

```json
{
  "heroHeadline": "...",
  "heroSubHeadline": "...",
  "aboutDescription": "...",
  "servicesDescription": "...",
  "contactCta": "...",
  "heroBadgeText": "...",
  "aboutTags": ["...", "..."],
  "services": [{ "name": "...", "description": "..." }]
}
```

Only `heroHeadline`, `heroSubHeadline`, `aboutDescription`, `servicesDescription`, `contactCta` are required. Everything else is written only when the interview supports it.

## What maps where (for reference)

These keys land in `generatedWebsites` 1:1 (`heroHeadline` -> `heroHeadline`, etc.). `aboutDescription` fills the About body; `servicesDescription` the Services body; `contactCta` the contact call-to-action. The Astro templates read these fields directly - you don't touch layout.

## SEO block + image alt text (also required)

In the SAME JSON object, include an `seo` object and an `imageAlt` map. `build_seo.py`
validates these and builds the title tag, keywords, and LocalBusiness JSON-LD; `build_payload.py`
merges the result. Full method: `references/seo-content.md`.

`seo` (object):

- `primaryService` (required) - the headline service for the title tag, e.g. "Barbershop", "Auto Repair".
- `metaDescription` (required) - 120-155 chars, includes the primary service + city + a soft CTA.
- `keywords` - 5-8 local seeds (the script guarantees the `[service] [city]` and `near me` variants).
- `gbpDescription` - 250-750 chars, Google Business Profile ready.
- `schemaType` (optional) - schema.org type; mapped from `businessType` if omitted.
- `priceRange` (optional, e.g. "$$"), `yearsInBusiness` (optional, from Q2 - never invent it), `openingHours` (optional).

`imageAlt` (object): one entry per generated image key (`enhanced_headshot`, `enhanced_interior_1`, ...),
<= 125 chars, descriptive and locally grounded.

Also: make sure `heroHeadline` (the H1) naturally contains the primary service + city.
