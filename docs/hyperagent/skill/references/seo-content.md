# SEO content — local-SEO method for one-page MSME sites

This is the SEO half of the copy step. It's distilled from Theo's production `seo` skill
(`AgriciDaniel/claude-seo`, also installed at `/Volumes/SSD/MasterMind/.claude/skills/seo/`),
scoped to what a **single-page local business site** can actually control. The skill doesn't do
off-page SEO (reviews, citations, backlinks) — it produces clean **on-page** signals and
**GBP-ready** assets, which is where these tiny sites win.

Produce the SEO block in the **same copy pass** as the marketing copy — one JSON object, one
model turn. `build_seo.py` bakes the deterministic parts (schema type, title/meta assembly,
char limits, JSON-LD) so you only supply small variable pieces. Don't write JSON-LD by hand.

## What actually moves the needle for a local one-pager

Local pack ranking is dominated by Google Business Profile, reviews, and proximity — none of
which a website controls. What the **site** contributes (and what you produce) is the on-page
layer the `seo` skill ranks highest:

1. **A keyword + location title tag and H1** — `[service] in [city]`.
2. **Correct LocalBusiness schema** with the right primary category (primary category is the
   single biggest local factor; getting the schema `@type` right mirrors it on-page).
3. **NAP in the page copy** (name, address, phone) — consistent with their GBP.
4. **Service-grounded, unique body copy** — never templated/swappable (see the swap test).
5. **Descriptive image alt text** with local terms.
6. Bonus: a **GBP-ready business description** they can paste straight into Google.

## Title tag — `build_seo.py` assembles it

Formula: **`[Primary Service] in [City] | [Business Name]`**, **≤ 60 characters** (Google
truncates ~60). You supply `primaryService` (e.g. "Barbershop", "Hair Salon", "Auto Repair")
and the script composes + enforces the limit (drops the brand, then shortens, if over).

- Primary keyword near the front. City always present.
- Examples: `Barbershop in Cebu City | Tony's Cuts` · `Auto Repair in Davao | RPM Garage`
- Anti-patterns (rejected): "Home", keyword-stuffed ("Barber Barbershop Haircut Cebu Barber").

## Meta description — you write, script validates

Formula: **`[benefit/hook] + [service + city] + [soft CTA]`**, **120–155 characters**.
Grounded in the USP (Q3) and services (Q4). One natural sentence, includes the city and the
primary service once, ends with a light action ("Visit us in Cebu City" / "Call to book").

- Example: `Fresh fades, beard trims and hot-towel shaves at a friendly Cebu City barbershop. Walk in or message Tony's Cuts to book your chair.`
- No clickbait, no ALL CAPS, no keyword stuffing.

## Keyword strategy — local intent only

You supply 5–8 keyword seeds; `build_seo.py` normalizes and guarantees the local variants:

- **Primary:** `[service] [city]` (e.g. "barbershop cebu city").
- **Near-me:** `[service] near me`, `[service] near [neighborhood/landmark]` if mentioned.
- **Service variants:** each real service from Q4 ("beard trim", "hot towel shave").
- **Service + city** for the top 2–3 services.

Place the primary keyword in the **title, H1 (hero headline), and the first sentence of the
About**. Natural density only (~1–3%); semantic variety beats repetition. Never stuff.

## Grounding & trust (E-E-A-T, scaled down)

These businesses don't need author bios — they need to look **real and local**. The trust
signals you DO produce, all grounded in the interview:

- **Years in business** (Q2) → `yearsInBusiness` → schema `foundingDate` + an About line
  ("Serving Cebu City since 2012"). Only if the owner stated it. Never invent a number.
- **Real owner + real photos** are the experience signal — so the copy names the owner/role
  where natural, and the images stay faithful (that's why we never fabricate either).
- **NAP** present and consistent (name, address, phone from the submission).
- **No fabrication, ever** — no made-up awards, certifications, or "voted best". If the Q&A
  doesn't support it, leave it out. Fabricated trust claims are an SEO and a real-world risk.

## LocalBusiness schema — `build_seo.py` builds the JSON-LD

You supply `schemaType` (optional — the script maps from `businessType` if you omit it),
`priceRange` (optional, e.g. "₱₱"), and any `openingHours`. The script emits valid
`application/ld+json` using the business NAP from the payload.

Business type → schema.org `@type` (baked in the script; unknown → `LocalBusiness` + a Slack card):

| businessType | schema.org @type |
|---|---|
| barber | HairSalon |
| salon | BeautySalon |
| spa / massage | DaySpa |
| restaurant | Restaurant |
| cafe / coffee | CafeOrCoffeeShop |
| bakery | Bakery |
| auto / autoshop | AutoRepair |
| clinic | MedicalClinic |
| dental | Dentist |
| retail / store | Store |
| law / legal | LegalService |
| *(unknown)* | LocalBusiness (+ post a Slack card to add a mapping) |

Required JSON-LD: `name`, `address` (PostalAddress, `addressLocality` = city, `addressCountry` = PH),
`telephone`. Recommended when available: `image` (the enhanced exterior/hero URL), `areaServed`
(city), `priceRange`, `openingHoursSpecification`, `foundingDate`.

## Image alt text — SEO + accessibility

One alt string per enhanced image, **≤ 125 characters**, descriptive and locally grounded —
not keyword soup. Pattern: `[what's in frame], [business], a [type] in [city]`.

- Example: `Interior of Tony's Cuts, a barbershop in Cebu City` · `Owner Tony at his Cebu City barbershop`

## GBP-ready business description (bonus, high-leverage)

Because Google Business Profile is the #1 local factor and you already have everything, emit a
`gbpDescription`, **250–750 characters**, primary service + city + what makes them special,
plain and warm. The creator/owner pastes it into Google Business Profile. The cheapest big win
in local SEO.

## Anti-patterns (hard rules)

- **No keyword stuffing** anywhere (title, body, alt, GBP).
- **Pass the swap test:** if you could swap the city/business name and the copy still "works",
  it's a templated doorway page — rewrite with the specifics from THIS interview.
- **No fabricated facts** (years, awards, certifications, reviews).
- **Short sentences** (avg 15–20 words), scannable. Plain English, light natural Taglish only
  where it reads true to the business — never forced.
