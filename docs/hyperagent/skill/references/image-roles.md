# Image roles → website slots

How the submission's photos map to website image slots, and the generation settings per slot. This is a **lookup table** — don't re-derive it per submission.

## Role mapping (from Tendso's fixed photo order)

| Index | Role | Source meaning | Present when |
|---|---|---|---|
| 0 | `headshot` | Owner / primary person | always |
| 1 | `interior_1` | Interior space | always |
| 2 | `interior_2` | Interior space | usually |
| 3 | `exterior` | Storefront / entrance | usually |
| 4 | `product_1` | Product / service | only if `hasProducts` |
| 5 | `product_2` | Product / service | only if `hasProducts` |

Trust the index → role mapping. Use the thumbnail only to catch an obvious mismatch (e.g., index 0 is clearly a storefront, not a person). If you correct a role, render under the corrected role.

## Slot table (what to generate)

| Slot order | Source role(s) | Mode | Output key | Aspect | Notes |
|---|---|---|---|---|---|
| 1 | `headshot` | single | `enhanced_headshot` | `4:5` | Owner portrait. Identity is sacred — strongest faithfulness. |
| 2 | `interior_1` | single | `enhanced_interior_1` | `4:3` | Clean, well-lit interior. |
| 3 | `interior_2` | single | `enhanced_interior_2` | `4:3` | Skip if absent. |
| 4 | `exterior` | single **or** combine | `enhanced_exterior` | `16:9` | Doubles as the hero plate. See "When to combine". |
| 5 | `product_1` | single | `enhanced_product_1` | `4:3` | Skip if `hasProducts=false`. |
| 6 | `product_2` | single | `enhanced_product_2` | `4:3` | Skip if absent. |

Always generate at **1K** with **Gemini Flash**, one image per slot — 6 by default (one per role), up to 12 with second `_v2` variants for the strongest gallery slots.

## When to combine (the one judgement call)

Default every slot to **single-input** image-to-image. Combine **only** the hero/exterior slot, and only when:

- the `exterior` photo is weak (cramped, obstructed, dim), **and**
- an `interior_1` exists that better conveys the business.

Then call `build_edit_prompt.py --role exterior --combine-with interior_1`. The exterior stays the architectural anchor; the interior contributes ambience only. Never combine more than two inputs. Never combine the headshot with anything (identity drift risk).

If neither photo is strong, render the exterior single and flag it in Slack — don't stack inputs hoping for magic.

## Aspect ratios

`headshot` → `4:5` · `exterior`/hero → `16:9` · interiors & products → `4:3`. These match the Astro template image areas. Don't deviate per submission.
