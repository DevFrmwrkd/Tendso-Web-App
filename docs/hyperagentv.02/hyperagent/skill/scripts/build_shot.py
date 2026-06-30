#!/usr/bin/env python3
"""
build_shot.py - the art-direction prompt engine.

Bakes a high-quality, brand-safe image prompt for one shot. The agent (AI) decides WHICH shots
to make (the shot list, from shot-library.md) and may add one short --hint; this script (the
deterministic part) supplies the proven camera grammar, lighting, photoreal stack, brand-truth
guardrail, localization, and negatives. Don't write these prompts by hand.

Usage:
  build_shot.py --shot storefront_hero --type barber --location "Cebu City, Philippines"
  build_shot.py --shot craft_in_action --type cafe --location "Manila, Philippines" --hint "pulling an espresso shot"
  build_shot.py --shot owner_portrait --type salon --location "Davao, Philippines"
  build_shot.py --shot macro_detail --type bakery --reinforce

Prints the full prompt to stdout. Always attach the relevant REAL photo(s) to the Image
Generation call as the source of truth (see art-direction.md). Unknown --shot still prints a
sensible compose prompt and writes a NOTE to stderr so you post a Slack card.
"""
import argparse
import sys

# --- Camera grammar (condensed from shot-builder M1/M2) ---
def m1(lens, movement):
    return (
        f"Shot on ARRI Alexa 35, Panavision Ultra Vintage anamorphic {lens} at T2.3 with a "
        f"Black Pro-Mist 1/4 filter, {movement}, oval bokeh and soft horizontal streak flares, "
        f"Kodak Vision3 250D film emulation with 800 ASA grain, warm teal-amber grade with cool "
        f"shadows and warm highlights, shallow depth of field."
    )

def m2(lens):
    return (
        f"Shot on ARRI Alexa Mini LF, Cooke S4/i spherical {lens} at T2, locked-off with a slow "
        f"push-in, gentle halation bloom on highlights, fine 400 ASA grain, crisp editorial grade "
        f"with warm-retained blacks, shallow depth of field."
    )

# --- Quality stacks (photoreal-stack v3, adapted, ASCII) ---
STACK_LIFE = (
    "Hyperrealistic photography. Real material texture - wood grain, worn surfaces, fabric weave, "
    "glass reflections; any real person rendered with real skin texture, visible pores, natural "
    "unevenness, and strand-by-strand hair. Kodak Vision3 250D film emulation, fine grain, subtle "
    "warm halation on highlights, gentle vignette, warm mid-tones with slightly cooled shadows. "
    "Lived-in and inviting, photographic not rendered."
)
STACK_FACE = (
    " Extreme face fidelity on the real owner: real pores, fine peach fuzz along the jaw, "
    "subsurface scattering on the nose and cheeks, real moisture and iris detail in the eyes, "
    "individual lash detail - their exact real face, not idealized."
)
STACK_PRODUCT = (
    "Hyperrealistic commercial product photography. Crisp focus on the hero with shallow "
    "depth-of-field falloff, soft diffused softbox key, gentle fill, subtle rim separation, real "
    "surface texture with natural moisture or steam where appropriate, natural appetizing color, "
    "clean styling, 100mm macro character, fine grain, no plastic CGI sheen. Photographic not rendered."
)

BRAND_TRUTH = (
    "BRAND TRUTH (non-negotiable): the attached photo(s) are the exact source for this business - "
    "replicate the real space, signage text, logo, and brand colors exactly. Do NOT redesign or "
    "invent signage, logo, or brand colors. Do NOT change any real person's face or identity."
)

NEGATIVES = (
    "Do not invent or redesign any logo, signage, or brand color. Do not fabricate or alter any "
    "real person's identity. No text overlays, captions, watermarks, or borders. No distorted "
    "hands or extra fingers. No plastic CGI look. Photoreal only."
)

REINFORCE = (
    "STRICT TRUTH MODE: a previous attempt drifted. Keep the real signage, logo, brand colors, "
    "space, and any real face exactly as in the attached source; change only framing, light, and styling."
)

TYPE_ACCENT = {
    "barber": "warm, polished grooming-studio mood.", "salon": "warm, polished salon mood.",
    "beauty": "warm, polished beauty mood.", "spa": "calm, clean, restful mood.",
    "massage": "calm, clean, restful mood.", "clinic": "calm, clean, trustworthy mood.",
    "dental": "calm, clean, trustworthy mood.", "restaurant": "warm, appetizing, hospitable mood.",
    "cafe": "warm, appetizing, hospitable mood.", "coffee": "warm, appetizing, hospitable mood.",
    "bakery": "warm, fresh, appetizing mood.", "auto": "clean, capable, workshop-professional mood.",
    "retail": "bright, tidy, display-forward mood.", "store": "bright, tidy, display-forward mood.",
    "craft": "warm, handmade, characterful mood.",
}

# --- Shot recipes ---
SHOTS = {
    "storefront_hero": dict(
        scene="Cinematic wide establishing shot of this exact storefront, framed slightly off-axis "
              "to show depth, the signage and entrance crisp and welcoming, the street alive around it.",
        light="Golden-hour warm sunlight with long soft shadows and gentle anamorphic streak flares "
              "off bright edges.",
        camera=lambda: m1("35mm", "from a steady, considered camera position"),
        people="ambient_optional", stack="LIFE"),
    "interior_life": dict(
        scene="Warm, lived-in interior of this exact space, composed to feel inviting and in use, "
              "with one anonymous patron or staff member being served, seen from behind.",
        light="Warm interior practical lights mixed with soft daylight from the windows.",
        camera=lambda: m1("35mm", "a steady handheld frame with a little natural breath"),
        people="anonymous", stack="LIFE"),
    "craft_in_action": dict(
        scene="The core service happening in this space - hands and craft in sharp focus (the cut, "
              "the pour, the plating, the repair), shot over the shoulder or from behind so no face "
              "is featured, full of skill and quiet motion.",
        light="Warm directional practical light raking across the hands and the craft.",
        camera=lambda: m1("50mm", "handheld with natural breath"),
        people="anonymous", stack="LIFE"),
    "macro_detail": dict(
        scene="Extreme close-up of the signature craft or product - the texture and finish that "
              "shows quality (fresh-cut lines, latte art, food texture, material weave), filling the frame.",
        light="Soft diffused key with a subtle rim, very shallow depth of field, the detail crisp.",
        camera=lambda: m2("100mm"),
        people="none", stack="PRODUCT"),
    "flatlay_topdown": dict(
        scene="Overhead top-down flat-lay of the product or dish, beautifully arranged with its key "
              "components and ingredients laid around it, clean negative space, styled like a commercial.",
        light="Soft even softbox light from above with gentle shadows and appetizing natural color.",
        camera=lambda: m2("50mm"),
        people="none", stack="PRODUCT"),
    "product_hero": dict(
        scene="A single signature product as the hero, styled cleanly at a slight angle, beautiful "
              "and true to the real product.",
        light="Soft commercial key with subtle rim separation and shallow depth of field.",
        camera=lambda: m2("75mm"),
        people="none", stack="PRODUCT"),
    "owner_portrait": dict(
        scene="Warm environmental portrait of the real owner in their own space, chest-up, relaxed "
              "and proud, the business softly out of focus behind them. Keep their exact face, hair, "
              "skin tone, and clothing.",
        light="Soft flattering warm key, gentle and natural.",
        camera=lambda: m2("75mm"),
        people="real_owner", stack="LIFE_FACE"),
    "ambient_life": dict(
        scene="Atmospheric shot implying a busy, loved business - anonymous people entering or moving "
              "through the space, gently motion-blurred, the place clearly frequented.",
        light="Natural ambient warm light.",
        camera=lambda: m1("35mm", "a steady frame"),
        people="anonymous", stack="LIFE"),
}


def people_block(kind, nationality, city):
    where = f" in {city}" if city else ""
    if kind == "anonymous":
        return (f"Any people are anonymous {nationality} background life only{where} - shown from "
                f"behind, cropped at the shoulders, or motion-blurred; never a recognizable face, "
                f"never posed as the owner or named staff.")
    if kind == "ambient_optional":
        return (f"Optionally one or two anonymous {nationality} passersby for life{where}, seen from "
                f"behind or blurred - never a recognizable face.")
    if kind == "real_owner":
        return "The person shown is the real owner from the attached photo - their exact real face."
    return "No people in frame."


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot", required=True)
    ap.add_argument("--type", default="")
    ap.add_argument("--location", default="")
    ap.add_argument("--hint", default="")
    ap.add_argument("--reinforce", action="store_true")
    args = ap.parse_args()

    loc = args.location.strip()
    city = loc.split(",")[0].strip() if loc else ""
    nationality = "Filipino" if (not loc or "philippines" in loc.lower()) else "local"

    rec = SHOTS.get(args.shot)
    if not rec:
        print(f"NOTE: unknown shot '{args.shot}' - using a generic composed shot. Post a Slack card "
              f"to add it to the shot library.", file=sys.stderr)
        rec = dict(
            scene="A clean, inviting, professional photograph of this business grounded in the "
                  "attached photos.",
            light="Soft natural light.", camera=lambda: m1("35mm", "a steady frame"),
            people="anonymous", stack="LIFE")

    parts = []
    if args.reinforce:
        parts.append(REINFORCE)
    parts.append(rec["scene"])
    parts.append(rec["light"])
    pb = people_block(rec["people"], nationality, city)
    if pb:
        parts.append(pb)
    parts.append(rec["camera"]())
    accent = TYPE_ACCENT.get((args.type or "").strip().lower())
    if accent:
        parts.append("Overall " + accent)
    parts.append(BRAND_TRUTH)
    stack = {"LIFE": STACK_LIFE, "LIFE_FACE": STACK_LIFE + STACK_FACE, "PRODUCT": STACK_PRODUCT}[rec["stack"]]
    parts.append(stack)
    if args.hint.strip():
        parts.append(args.hint.strip())
    parts.append(NEGATIVES)

    print(" ".join(parts))


if __name__ == "__main__":
    main()
