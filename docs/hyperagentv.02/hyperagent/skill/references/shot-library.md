# Shot library - the art director's vocabulary

You are not retouching photos. You are a hired photographer building the best possible
landing-page image set for THIS business. A real photographer never delivers one empty-room
wide shot - they shoot the craft up close, the food top-down, the space with life in it.

This file is your **shot vocabulary** and your **per-business shot lists**. You plan a set of
6 (up to 12) shots from here, then `build_shot.py` bakes the exact high-quality prompt for each
one. Don't write the prompts by hand - the script holds the proven language. This file is how
you DECIDE what to shoot.

The non-negotiables live in `art-direction.md` (brand truth, no fake owner, Filipino context).
Read that first.

---

## The eight shots (your toolkit)

Each `--shot` value `build_shot.py` knows, what it's for, and what to attach as the source.
`mode` = how the image tool is used: **enhance** (regrade/relight one real photo, keep it
faithful) or **compose** (a new framing/angle, grounded in the attached real photo for space,
colors, brand, and products).

| `--shot` | What it is | Source to attach | Mode | Has people? |
|---|---|---|---|---|
| `storefront_hero` | The money shot. Cinematic wide of the real storefront, golden-hour, inviting. Doubles as the hero. | exterior | enhance | optional ambient (from behind) |
| `interior_life` | Warm, lived-in interior with an anonymous patron/staff being served (from behind). | interior(s) | compose | yes - anonymous, Filipino |
| `craft_in_action` | The service happening - the fade mid-cut, latte poured, dish plated, mechanic at work. Hands + craft, shot over-shoulder/from behind. | interior + product | compose | yes - anonymous, Filipino |
| `macro_detail` | Extreme close-up of the craft/product: fresh-cut lines, latte art, food texture, stitching. | product / relevant | compose | no |
| `flatlay_topdown` | Overhead hero of the product/food, styled with its components/ingredients laid out. | product(s) | compose | no |
| `product_hero` | Single signature product, beautifully styled, soft commercial light. | product | enhance or compose | no |
| `owner_portrait` | Warm environmental portrait of the REAL owner. Only when a real person photo exists. | headshot | enhance | yes - the real owner |
| `ambient_life` | Footfall/atmosphere - anonymous people entering or inside, motion-blurred, implying popularity. | exterior / interior | compose | yes - anonymous, Filipino |

Quality stacks (baked by the script): **LIFE** stack (filmic warm, Kodak Vision3 grain, real
skin/material texture) for people + space shots; **PRODUCT** stack (crisp commercial macro, soft
softbox) for `macro_detail`, `flatlay_topdown`, `product_hero`.

---

## Output placement keys

Every rendered shot is stored under a **placement key** (where it lands on the page), not its
content type:

- `enhanced_hero` -> the hero (always the `storefront_hero`, or the best establishing shot if no exterior).
- `enhanced_portrait` -> the About portrait (only if `owner_portrait` was made from a real person).
- `enhanced_gallery_1` ... `enhanced_gallery_N` -> the rest of the set, in display order.

`build_payload.py` accepts these. (Legacy keys `enhanced_exterior/headshot/interior_*/product_*`
still work for backward-compat, but prefer the placement keys.)

---

## Per-business shot lists (your starting point - adapt to what you actually have)

Target **6** by default, go to **12** when the business is photogenic and the inputs support it.
Always lead with the hero. Drop any shot you can't ground in a real photo; add a second variant
of a strong shot rather than invent a weak one.

**Barber / Salon**
1. `storefront_hero` (exterior) 2. `craft_in_action` - fade/cut over-shoulder (interior) 3. `macro_detail` - fresh-cut lines / styling detail 4. `interior_life` - client in the chair from behind 5. `product_hero` or `flatlay_topdown` - tools/products 6. `owner_portrait` (if real). +6-12: a second `craft_in_action`, a second `macro_detail`, `ambient_life`.

**Cafe / Restaurant / Bakery**
1. `storefront_hero` 2. `flatlay_topdown` - signature dish with ingredients 3. `macro_detail` - the dish / latte art, steam, texture 4. `craft_in_action` - barista/chef plating from behind 5. `interior_life` - diners from behind, warm 6. `owner_portrait` (if real). +6-12: more `macro_detail` of other items, `product_hero`, `ambient_life`.

**Auto / Repair**
1. `storefront_hero` - bay/shop front 2. `craft_in_action` - mechanic at work over-shoulder 3. `macro_detail` - a clean serviced part / detail 4. `interior_life` - the working bay with a car 5. `product_hero` - tidy tools / a finished car 6. `owner_portrait` (if real). +6-12: second action shot, `ambient_life`.

**Clinic / Spa / Massage**
1. `storefront_hero` - calm, clean exterior 2. `interior_life` - serene treatment room 3. `macro_detail` - clean equipment / hands-on detail 4. `craft_in_action` - practitioner with client from behind 5. `product_hero` - products / calm still life 6. `owner_portrait` (if real). Keep it calm, clean, trustworthy.

**Retail / Craft / Producer**
1. `storefront_hero` 2. `flatlay_topdown` - product range 3. `macro_detail` - craft/material close-up 4. `interior_life` - shelves with a shopper from behind 5. `craft_in_action` - the maker at work 6. `owner_portrait` (if real). +6-12: more product `macro_detail`, `ambient_life`.

**Unknown type**
Build a sensible set from the toolkit: `storefront_hero` + `interior_life` + 2x `macro_detail` +
`craft_in_action` + `ambient_life`. And post a Slack card proposing a recipe for this type.

---

## Art-direction rules

- **Hero first, always.** Every set leads with one strong establishing/hero image.
- **Use real people if you have them; imply life if you don't.** A real owner photo -> `owner_portrait`. No person -> never invent one; use `interior_life` / `craft_in_action` / `ambient_life` with anonymous figures from behind.
- **Variety beats repetition.** A good set mixes scales: one wide (hero), a couple of medium (interior/action), and tight detail (macro). Six near-identical shots is a fail.
- **Don't over-stage great inputs.** If the field agent already captured a beautiful, busy shot, `enhance` it - don't fight it. The tricks (composed life, macro) are for when the inputs are sparse or boring.
- **Ground everything in the real business.** Even composed shots attach the real photos so space, colors, brand, and products are true. See `art-direction.md`.
- **Localized.** Any people are Filipino, in the business's city context (pass `--location`).
