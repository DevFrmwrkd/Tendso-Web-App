# Shot planning - turn whatever arrived into the best set

This is Step 2 of the run. Your job: look at what the field agent actually captured and decide
the **shot list** that makes the best landing page. The photos come as an unlabeled set in no
guaranteed order, so you plan by **content**, not by filename or position.

## A. Inventory by content (a quick glance at the thumbnails)

For each thumbnail, tag what it actually shows:

- **person** - a real person (likely the owner/staff) -> usable for `owner_portrait`.
- **interior** - inside the space.
- **exterior** - storefront / signage / entrance.
- **product / craft / food** - the thing they make or sell.

Don't trust upload order. If there's no person in any photo, there is simply no owner shot - that's
fine (see the missing-person rule below). Note which real photos you have; they're your sources.

## B. Plan the shot list (6 default, up to 12)

Open `shot-library.md`, take the list for this business type, and **adapt it to what you have**:

- **Lead with the hero** - one strong establishing image (`storefront_hero` from the exterior; if
  no exterior, the strongest `interior_life` becomes the hero).
- **Mix scales** - one wide (hero), a couple medium (interior/action), a couple tight (macro/detail),
  plus product/flat-lay where it fits. Variety is the point; six near-identical shots is a fail.
- **Use real people if present** (`owner_portrait`). If not, imply life with `interior_life`,
  `craft_in_action`, `ambient_life` (anonymous, from behind).
- **Default to 6.** Go to 12 only when the business is photogenic and you have the source material
  to ground more shots. Don't pad with weak repeats - add a second variant of a STRONG shot instead.

Write the plan in a few lines (shot -> source -> placement key) before you render. Keep it tight.

## C. Placement keys (where each shot lands on the page)

| Shot role | Placement key |
|---|---|
| The hero | `enhanced_hero` |
| Owner portrait (only if a real person photo exists) | `enhanced_portrait` |
| Everything else, in display order | `enhanced_gallery_1`, `enhanced_gallery_2`, ... |

As you render each shot (Step 3), write its placement key + the public URL into `work/images.json`.

## Aspect ratios (pass to the Image Generation tool)

| Shot | Aspect |
|---|---|
| `storefront_hero`, `ambient_life` | `16:9` |
| `interior_life`, `craft_in_action` | `3:2` |
| `macro_detail`, `flatlay_topdown`, `product_hero` | `4:5` |
| `owner_portrait` | `4:5` |

## The missing-person rule (your example case)

A shop with no headshot, only inside + outside photos: **skip `owner_portrait` entirely - never
invent an owner.** Build the set from the space and craft: `storefront_hero` (exterior),
`interior_life` and `craft_in_action` and `ambient_life` with anonymous Filipino figures from
behind, plus `macro_detail` of the craft. The result still looks alive and professional - because
a real photographer would shoot exactly those when the owner declines to be photographed.

## Always attach the real source

Every render - even a composed new angle - attaches the relevant real photo(s) to the Image
Generation call, so the space, colors, brand, signage, and products stay true. That's the brand
truth in `art-direction.md`.
