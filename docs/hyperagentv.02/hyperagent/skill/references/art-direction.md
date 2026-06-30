# Art direction - the rules every shot obeys

This is the discipline behind the shot library. `build_shot.py` bakes all of this into each
prompt; this file explains it so you (and Theo) can reason about and improve it. The goal is
simple: make this business look like a professional photographer spent an afternoon there -
while never lying about the brand.

## The two tiers (this is the whole philosophy)

**Tier 1 - SACRED. Never altered.** These are facts about the real business:

- The **logo** and **signage text** - never redesigned, re-spelled, or invented.
- The **brand colors** - kept true.
- The **real products / craft** - they look like they actually look.
- The **real space / architecture** - the building, the layout, the fittings.
- The **identity of any real person** shown - the owner's real face, never altered. And we
  **never invent an owner** - no fabricated face presented as the business owner. Ever.

The mechanism is the **BRAND TRUTH block** the script attaches whenever there's a source photo
(adapted from your shot-builder "REFERENCE NON-NEGOTIABLE"):

> The attached photo(s) are the exact source for this business. Replicate the real space,
> signage text, logo, and brand colors exactly. Do NOT redesign or invent signage, logo, or
> brand colors. Do NOT change any real person's face or identity.

**Tier 2 - CREATIVE LICENSE. This is your job.** Everything that makes it beautiful:

- **Angle and framing** - a new composition the field agent didn't capture (over-shoulder,
  top-down, macro).
- **Light** - golden hour, soft commercial key, warm practicals, gentle anamorphic streaks.
- **Composition and styling** - flat-lay with components, shallow-DOF hero, tidy staging.
- **Ambient anonymous people** - to show the place is alive and frequented.

## Enhance vs compose

- **Enhance** (one real photo in, same scene out): regrade, relight, de-clutter, straighten,
  upgrade to a filmic look. Used for `storefront_hero`, `product_hero` when the input is good.
  Closest to the old behavior - but now with real photographic polish, not a flat "retouch."
- **Compose** (real photos in, a NEW shot out): a fresh angle/scene grounded in the attached
  photos for space, colors, brand, and products. Used for `interior_life`, `craft_in_action`,
  `macro_detail`, `flatlay_topdown`, `ambient_life`. This is where the set gets its variety and
  life - and where Tier-1 truth still holds (the script attaches the real photos as ground).

## The anonymous-people rule

When a shot adds life and we don't have a real person for it:

> Any added people are anonymous background life only - shown from behind, cropped at the
> shoulders, or motion-blurred. Never a recognizable face. Never posed or framed as the owner
> or named staff. Filipino people, in the local city context.

This is how we get "the shop looks busy and loved" without ever faking an identity. The only
shot that shows a real, recognizable face is `owner_portrait`, and only from a real headshot.

## Localization

The whole set is local. People are **Filipino**; the context (street, signage style, dress,
food) matches the business's city. The script takes `--location "<city>, Philippines"` and bakes
it. If the business is ever outside PH, pass the real location - the principle is "match reality,"
not "always Filipino."

## The quality stacks (baked by the script)

Every prompt closes with one of two stacks so it reads as a real photograph, not an AI render
(your photoreal-stack v3, adapted, ASCII):

- **LIFE stack** (people + spaces): real skin texture with visible pores and natural unevenness
  on any real person, hair strand detail, real material texture (wood grain, worn surfaces,
  fabric weave, glass reflection), Kodak Vision3 250D film emulation with fine grain, subtle warm
  halation on highlights, gentle vignette, warm mid-tones with slightly cooled shadows, soft
  light streaks on bright sources. Lived-in and inviting, photographic not rendered.
- **PRODUCT stack** (macro / flat-lay / product): crisp focus on the hero with shallow depth of
  field, soft diffused key from a large softbox, gentle fill, subtle rim separation, real surface
  texture with moisture or steam where appropriate, natural appetizing color, clean styling,
  100mm macro character, fine grain, no plastic CGI sheen. Photographic not rendered.

## Camera grammar (baked per shot)

From your camera modes: **M1 (narrative, lived-in)** for storefront/interior/action - ARRI +
anamorphic, handheld, Kodak 250D, warm teal-amber, soft streak flares. **M2 (editorial/product)**
for macro/flat-lay/product/portrait - Cooke spherical, locked, soft bloom, crisp. Lens by intent:
35mm wide hero, 50mm medium interior, 75mm portrait, 100mm macro detail.

## Hard negatives (every prompt)

No invented or redesigned logo/signage/brand colors. No fake or altered owner identity. No text
overlays, captions, watermarks, or borders. No distorted hands, no extra fingers. No plastic CGI
look. Photoreal only.

## Reinforce (retry once)

If a render breaks Tier 1 (changed the signage/logo/colors, or altered a real face), re-run once
with `--reinforce`, which prepends a STRICT TRUTH line. Two failures -> drop that shot, keep the
set moving, and flag it in Slack. Never burn credits re-rolling for "a bit nicer."

## Don't go overboard

If the inputs are already strong, `enhance` and move on - we're making the best of what's there,
not forcing tricks. The art direction is to rescue boring/sparse inputs and to round out a set,
not to over-produce a business that already photographs well.
