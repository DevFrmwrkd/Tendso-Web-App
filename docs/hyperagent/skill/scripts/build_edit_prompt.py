#!/usr/bin/env python3
"""
build_edit_prompt.py — assemble the baked, faithful image-to-image edit prompt.

This is where the constant prompt scaffold lives. The agent calls this instead of
writing prompts by hand, so the preservation/faithfulness language is identical
every time and costs no output tokens. The agent contributes at most one short
--hint line.

Usage:
  build_edit_prompt.py --role headshot --type salon
  build_edit_prompt.py --role exterior --type cafe --hint "warm evening light"
  build_edit_prompt.py --role exterior --combine-with interior_1
  build_edit_prompt.py --role product_1 --type restaurant --reinforce

Prints the final prompt to stdout. For an unknown --type it still prints a generic
prompt but writes a NOTE to stderr (exit 0) so the agent posts a Slack card.
"""
import argparse
import sys

ROLE_FRAMING = {
    "headshot": (
        "Frame as a clean, friendly owner portrait, chest-up, soft flattering light, "
        "tidy neutral background; keep their exact face, hair, skin tone, expression, and clothing."
    ),
    "interior_1": (
        "Present the interior as bright, clean, and inviting; keep every fixture, product, "
        "and sign exactly where it is; just improve light and remove clutter."
    ),
    "interior_2": (
        "Present the interior as bright, clean, and inviting; keep every fixture, product, "
        "and sign exactly where it is; just improve light and remove clutter."
    ),
    "exterior": (
        "Present the storefront as a crisp, welcoming hero shot; keep the exact building, "
        "signage text, and surroundings; improve light, sky, and clarity."
    ),
    "product_1": (
        "Present the product/service cleanly and appetizingly with even light and a tidy "
        "backdrop; keep the exact item, its colors, labels, and proportions."
    ),
    "product_2": (
        "Present the product/service cleanly and appetizingly with even light and a tidy "
        "backdrop; keep the exact item, its colors, labels, and proportions."
    ),
}

TYPE_ACCENT = {
    "salon": "warm, polished, grooming-studio mood.",
    "barber": "warm, polished, grooming-studio mood.",
    "restaurant": "warm, appetizing, hospitable mood.",
    "cafe": "warm, appetizing, hospitable mood.",
    "coffee": "warm, appetizing, hospitable mood.",
    "auto": "clean, capable, workshop-professional mood.",
    "autoshop": "clean, capable, workshop-professional mood.",
    "clinic": "calm, clean, trustworthy, hygienic mood.",
    "spa": "calm, clean, trustworthy, hygienic mood.",
    "massage": "calm, clean, trustworthy, hygienic mood.",
    "retail": "bright, tidy, display-forward mood.",
    "store": "bright, tidy, display-forward mood.",
    "craft": "bright, tidy, display-forward mood.",
    "producer": "bright, tidy, display-forward mood.",
}

SOURCE_ANCHOR = (
    "Use the attached photo as the exact source. This is a retouch of a real "
    "photograph, not a new image."
)

COMBINE_LINE = (
    "A second photo is attached for ambience/context only. The FIRST photo is the "
    "architectural anchor and must dominate; borrow only light and mood from the "
    "second. Do not merge signage or people across the two."
)

PRESERVE = (
    "Preserve exactly: the person and their face and body, the products, all signage "
    "and text, and the architecture/layout. Identity and real-world details must not change."
)

ALLOWED = (
    "You may only: correct lighting and exposure, balance color and white balance, tidy "
    "and de-clutter the background, remove small distractions, straighten and crop, and "
    "apply a gentle, natural grade."
)

NEGATIVES = (
    "Do not change the person's identity or face. Do not add, remove, or replace people "
    "or products. Do not alter or invent any signage, label, or text. Do not change the "
    "building or layout. No new objects, no text overlays, no logos, no watermarks, no "
    "borders. Photorealistic only."
)

REINFORCE = (
    "STRICT RETOUCH MODE: the previous attempt altered the subject. Change pixels only "
    "for light, color, and background tidiness. The face/products/signage/building must be "
    "pixel-faithful to the source. If in doubt, change less."
)


def normalize_role(role):
    role = (role or "").strip().lower()
    if role in ROLE_FRAMING:
        return role
    # tolerate "interior"/"product" without the index
    if role.startswith("interior"):
        return "interior_1"
    if role.startswith("product"):
        return "product_1"
    return role


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--role", required=True)
    ap.add_argument("--type", default="")
    ap.add_argument("--hint", default="")
    ap.add_argument("--combine-with", default="")
    ap.add_argument("--reinforce", action="store_true")
    args = ap.parse_args()

    role = normalize_role(args.role)
    framing = ROLE_FRAMING.get(role)
    if not framing:
        log = f"NOTE: unknown role '{args.role}' — no framing line. Post a Slack card."
        print(log, file=sys.stderr)
        framing = (
            "Present the subject cleanly with even light and a tidy background; keep the "
            "exact subject, colors, and any text."
        )

    btype = (args.type or "").strip().lower()
    accent = TYPE_ACCENT.get(btype)
    if btype and accent is None:
        print(
            f"NOTE: unknown business type '{args.type}' — using generic mood. "
            f"Post a Slack card proposing an accent.",
            file=sys.stderr,
        )

    parts = []
    if args.reinforce:
        parts.append(REINFORCE)
    parts.append(SOURCE_ANCHOR)
    if args.combine_with:
        parts.append(COMBINE_LINE)
    parts.append(PRESERVE)
    parts.append(ALLOWED)
    line = framing
    if accent:
        line = f"{framing} Overall {accent}"
    parts.append(line)
    if args.hint.strip():
        parts.append(args.hint.strip())
    parts.append(NEGATIVES)

    print(" ".join(parts))


if __name__ == "__main__":
    main()
