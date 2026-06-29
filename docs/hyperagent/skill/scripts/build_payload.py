#!/usr/bin/env python3
"""
build_payload.py — validate the agent's copy + image URLs and assemble the exact
Convex callback payload.

It enforces the copy contract (required keys, word caps, key names) so nothing
malformed reaches Convex. Over-cap strings are trimmed to the cap at a word
boundary (with a warning); missing required fields are a hard error.

Usage:
  build_payload.py --content work/content.json --images work/images.json \
                   --payload payload.json --out work/result.json

  content.json : the copy JSON the agent wrote
  images.json  : { "enhanced_headshot": "https://...", ... }
  payload.json : the original submission (for submissionId)
  result.json  : written output → { submissionId, content, images }
"""
import argparse
import json
import sys

# field -> max words (None = special handling)
REQUIRED = {
    "heroHeadline": 8,
    "heroSubHeadline": 16,
    "aboutDescription": 60,
    "servicesDescription": 40,
    "contactCta": 12,
}
OPTIONAL_STR = {
    "heroBadgeText": 4,
    "heroCtaLabel": 4,
    "aboutHeadline": 8,
    "aboutTagline": 12,
    "servicesHeadline": 8,
    "servicesSubheadline": 16,
    "featuredHeadline": 8,
    "tagline": 10,
}
TONE_VALUES = {"warm", "professional", "playful", "calm"}
IMAGE_KEYS = {
    "enhanced_headshot",
    "enhanced_interior_1",
    "enhanced_interior_2",
    "enhanced_exterior",
    "enhanced_product_1",
    "enhanced_product_2",
}

warnings = []


def warn(msg):
    warnings.append(msg)
    print("WARN: " + msg, file=sys.stderr)


def fail(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def trim_words(text, cap, field):
    words = str(text).strip().split()
    if len(words) > cap:
        warn(f"{field} was {len(words)} words; trimmed to {cap}.")
        return " ".join(words[:cap])
    return " ".join(words)


def is_url(v):
    return isinstance(v, str) and v.startswith("http")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--content", required=True)
    ap.add_argument("--images", required=True)
    ap.add_argument("--payload", required=True)
    ap.add_argument("--seo", default="", help="work/seo.json from build_seo.py (optional)")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.content) as f:
        content_in = json.load(f)
    with open(args.images) as f:
        images_in = json.load(f)
    with open(args.payload) as f:
        submission = json.load(f)

    submission_id = submission.get("submissionId")
    if not submission_id:
        fail("payload is missing submissionId.")

    content = {}

    # Required — must be present AND within cap. Fail (don't trim) so the model
    # rewrites a clean line instead of shipping a truncated fragment.
    for key, cap in REQUIRED.items():
        val = content_in.get(key)
        if val is None or not str(val).strip():
            fail(f"required copy field '{key}' is missing or empty.")
        words = str(val).strip().split()
        if len(words) > cap:
            fail(f"required field '{key}' is {len(words)} words; cap is {cap}. Shorten it and re-run.")
        content[key] = " ".join(words)

    # Optional strings
    for key, cap in OPTIONAL_STR.items():
        if key in content_in and str(content_in[key]).strip():
            content[key] = trim_words(content_in[key], cap, key)

    # tone (enum)
    tone = content_in.get("tone")
    if tone:
        t = str(tone).strip().lower()
        if t in TONE_VALUES:
            content["tone"] = t
        else:
            warn(f"tone '{tone}' not in {sorted(TONE_VALUES)}; dropped.")

    # aboutTags: <=5 items, <=3 words each
    tags = content_in.get("aboutTags")
    if isinstance(tags, list) and tags:
        clean = []
        for t in tags[:5]:
            if str(t).strip():
                clean.append(trim_words(t, 3, "aboutTags item"))
        if len(tags) > 5:
            warn("aboutTags had >5 items; kept 5.")
        if clean:
            content["aboutTags"] = clean
    elif tags is not None:
        warn("aboutTags was not a non-empty list; dropped.")

    # services: <=6 items {name<=4, description<=14}
    services = content_in.get("services")
    if isinstance(services, list) and services:
        clean = []
        for s in services[:6]:
            if not isinstance(s, dict):
                continue
            name = str(s.get("name", "")).strip()
            desc = str(s.get("description", "")).strip()
            if not name:
                continue
            item = {"name": trim_words(name, 4, "service name")}
            if desc:
                item["description"] = trim_words(desc, 14, "service description")
            clean.append(item)
        if len(services) > 6:
            warn("services had >6 items; kept 6.")
        if clean:
            content["services"] = clean
    elif services is not None:
        warn("services was not a non-empty list; dropped.")

    # Images
    images = {}
    for key, url in images_in.items():
        base = key[:-3] if key.endswith("_v2") else key
        if base not in IMAGE_KEYS:
            warn(f"image key '{key}' is not a recognized slot; dropped.")
            continue
        if not is_url(url):
            warn(f"image '{key}' value is not a URL; dropped.")
            continue
        images[key] = url
    if not images:
        warn("no valid image URLs — Convex will store copy only.")

    # Image alt text (SEO + accessibility), <=125 chars per key
    alt_in = content_in.get("imageAlt") or {}
    image_alt = {}
    if isinstance(alt_in, dict):
        for k, v in alt_in.items():
            base = k[:-3] if k.endswith("_v2") else k
            if base in IMAGE_KEYS and str(v).strip():
                image_alt[k] = " ".join(str(v).split())[:125].rstrip(" .,;:")
    if image_alt:
        content["imageAlt"] = image_alt

    # Merge the validated SEO block (from build_seo.py)
    if args.seo:
        with open(args.seo) as f:
            seo = json.load(f)
        for key in ("seoTitle", "metaDescription", "seoKeywords", "structuredData", "gbpDescription"):
            val = seo.get(key)
            if val not in (None, "", [], {}):
                content[key] = val

    result = {"submissionId": submission_id, "content": content, "images": images}
    with open(args.out, "w") as f:
        json.dump(result, f, indent=2)

    print(f"ok: wrote {args.out}")
    print(f"  copy fields: {len(content)}  images: {len(images)}  warnings: {len(warnings)}")


if __name__ == "__main__":
    main()
