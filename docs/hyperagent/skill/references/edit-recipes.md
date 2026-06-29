# Edit recipes — the baked faithful-edit scaffolds

This documents what `build_edit_prompt.py` produces, so a human can read it. **At runtime, get the prompt from the script — don't retype it here.** The script is the source of truth; this file explains the design so you (and Theo) can reason about and improve it.

## Why prompts are baked

The faithfulness rule lives in the constant scaffold, not in the model's freehand. If the model wrote the whole prompt each time, it would (a) cost output tokens and (b) drift on the preservation language — the exact thing that keeps the original photo intact. So the scaffold is fixed; the model contributes at most one short hint.

## Anatomy of every edit prompt

```
[SOURCE ANCHOR]      Use the attached photo as the exact source. This is a
                     retouch of a real photograph, not a new image.

[PRESERVE]           Preserve exactly: the person and their face and body, the
                     products, all signage and text, and the architecture/layout.
                     Identity and real-world details must not change.

[ALLOWED EDITS]      You may only: correct lighting and exposure, balance color
                     and white balance, tidy and de-clutter the background, remove
                     small distractions, straighten and crop, and apply a gentle,
                     natural grade.

[ROLE FRAMING]       <role-specific line — see below>

[HINT]               <optional ≤1-line variable hint from the agent, or nothing>

[HARD NEGATIVES]     Do not change the person's identity or face. Do not add,
                     remove, or replace people or products. Do not alter or invent
                     any signage, label, or text. Do not change the building or
                     layout. No new objects, no text overlays, no logos, no
                     watermarks, no borders. Photorealistic only.
```

`--combine-with <role>` inserts one extra line after SOURCE ANCHOR:

```
[COMBINE]            A second photo is attached for ambience/context only. The
                     FIRST photo is the architectural anchor and must dominate;
                     borrow only light and mood from the second. Do not merge
                     signage or people across the two.
```

## Role framing lines

| Role | Framing line |
|---|---|
| `headshot` | "Frame as a clean, friendly owner portrait, chest-up, soft flattering light, tidy neutral background; keep their exact face, hair, skin tone, expression, and clothing." |
| `interior_1` / `interior_2` | "Present the interior as bright, clean, and inviting; keep every fixture, product, and sign exactly where it is; just improve light and remove clutter." |
| `exterior` | "Present the storefront as a crisp, welcoming hero shot; keep the exact building, signage text, and surroundings; improve light, sky, and clarity." |
| `product_1` / `product_2` | "Present the product/service cleanly and appetizingly with even light and a tidy backdrop; keep the exact item, its colors, labels, and proportions." |

## Business-type accents (optional, additive)

`--type` adds a light, additive accent — never a new instruction that overrides preservation. These are gentle mood cues, not redesigns. Examples baked into the script:

| Type | Accent |
|---|---|
| `salon` / `barber` | "warm, polished, grooming-studio mood." |
| `restaurant` / `cafe` | "warm, appetizing, hospitable mood." |
| `auto` | "clean, capable, workshop-professional mood." |
| `clinic` / `spa` | "calm, clean, trustworthy, hygienic mood." |
| `retail` / `craft` | "bright, tidy, display-forward mood." |
| *(unknown)* | no accent — and the script exits with a notice so you post a Slack card to add one. |

## Reinforcement (retry once on faithfulness failure)

If a render changed the subject, re-run the same prompt with the script's `--reinforce` flag, which prepends:

```
STRICT RETOUCH MODE: the previous attempt altered the subject. Change pixels only
for light, color, and background tidiness. The face/products/signage/building must
be pixel-faithful to the source. If in doubt, change less.
```

Two failures → skip the slot, flag in Slack. Don't keep paying for re-rolls.
