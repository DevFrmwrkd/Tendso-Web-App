#!/usr/bin/env python3
"""
build_seo.py - assemble + validate the SEO block (title tag, meta description,
keywords, LocalBusiness JSON-LD, GBP description) for one submission.

The model supplies small variable pieces in content.json under "seo"; this script
bakes the deterministic parts (schema.org type mapping, title/meta char limits,
JSON-LD construction from the business NAP). Don't write JSON-LD by hand.

Usage:
  build_seo.py --content work/content.json --payload payload.json \
               [--image-url <exterior_or_hero_url>] --out work/seo.json

Input content.json may contain:
  "seo": {
     "primaryService": "Barbershop",          # required for the title
     "metaDescription": "...",                 # required (120-155 chars ideal)
     "keywords": ["barbershop cebu", ...],     # 5-8 seeds
     "gbpDescription": "...",                  # 250-750 chars
     "schemaType": "HairSalon",                # optional (else mapped from type)
     "priceRange": "₱₱",                       # optional
     "yearsInBusiness": 12,                    # optional (from interview Q2)
     "openingHours": "Mon-Sat 9am-7pm"         # optional, freeform
  }

Output seo.json -> { seoTitle, metaDescription, seoKeywords[], gbpDescription, structuredData{} }
"""
import argparse
import datetime
import json
import re
import sys

TITLE_MAX = 60
META_MAX = 155
META_MIN = 70
GBP_MAX = 750
GBP_MIN = 250

TYPE_MAP = {
    "barber": "HairSalon", "salon": "BeautySalon", "beauty": "BeautySalon",
    "spa": "DaySpa", "massage": "DaySpa",
    "restaurant": "Restaurant", "eatery": "Restaurant", "carinderia": "Restaurant",
    "cafe": "CafeOrCoffeeShop", "coffee": "CafeOrCoffeeShop",
    "bakery": "Bakery",
    "auto": "AutoRepair", "autoshop": "AutoRepair", "automotive": "AutoRepair",
    "clinic": "MedicalClinic", "dental": "Dentist", "dentist": "Dentist",
    "retail": "Store", "store": "Store", "shop": "Store",
    "craft": "Store", "producer": "Store",
    "law": "LegalService", "legal": "LegalService",
}

warnings = []


def warn(m):
    warnings.append(m)
    print("WARN: " + m, file=sys.stderr)


def fail(m):
    print("ERROR: " + m, file=sys.stderr)
    sys.exit(1)


def clip_chars(text, cap):
    text = " ".join(str(text).split())
    if len(text) <= cap:
        return text, False
    cut = text[:cap]
    if " " in cut:
        cut = cut[: cut.rfind(" ")]
    return cut.rstrip(" .,;:"), True


def compose_title(primary, city, name):
    primary = " ".join(str(primary).split())
    base = f"{primary} in {city}" if city else primary
    full = f"{base} | {name}" if name else base
    if len(full) <= TITLE_MAX:
        return full
    if len(base) <= TITLE_MAX:
        return base
    clipped, _ = clip_chars(base, TITLE_MAX)
    return clipped


def map_type(business_type):
    t = (business_type or "").strip().lower()
    if t in TYPE_MAP:
        return TYPE_MAP[t], False
    for key, val in TYPE_MAP.items():
        if key in t:
            return val, False
    return "LocalBusiness", True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--content", required=True)
    ap.add_argument("--payload", required=True)
    ap.add_argument("--image-url", default="")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.content) as f:
        content = json.load(f)
    with open(args.payload) as f:
        payload = json.load(f)

    seo = content.get("seo") or {}
    biz = payload.get("business", {}) or {}
    name = biz.get("name", "")
    city = biz.get("city", "")
    btype = biz.get("type", "")
    phone = biz.get("phone", "")
    address = biz.get("address", "")

    # --- Title ---
    primary = seo.get("primaryService") or (btype.title() if btype else "")
    if not primary:
        fail("seo.primaryService is required (and businessType is empty) - cannot build title.")
    if not city:
        warn("no city in payload - title/keywords will lack a location (weak local SEO).")
    seo_title = compose_title(primary, city, name)

    # --- Meta description ---
    meta = seo.get("metaDescription", "")
    if not str(meta).strip():
        fail("seo.metaDescription is required.")
    meta, trimmed = clip_chars(meta, META_MAX)
    if trimmed:
        warn(f"metaDescription trimmed to {META_MAX} chars.")
    if len(meta) < META_MIN:
        warn(f"metaDescription is short ({len(meta)} chars); aim for {META_MIN}-{META_MAX}.")

    # --- Keywords (normalize + guarantee local variants) ---
    seeds = seo.get("keywords") or []
    kw = []
    seen = set()
    for k in seeds:
        k = " ".join(str(k).lower().split())
        if k and k not in seen:
            seen.add(k)
            kw.append(k)
    if city and primary:
        for variant in (f"{primary.lower()} {city.lower()}", f"{primary.lower()} near me"):
            if variant not in seen:
                seen.add(variant)
                kw.append(variant)
    kw = kw[:10]

    # --- Schema type ---
    schema_type = seo.get("schemaType")
    if not schema_type:
        schema_type, unknown = map_type(btype)
        if unknown:
            print(
                f"NOTE: no schema mapping for business type '{btype}' - used LocalBusiness. "
                f"Post a Slack card to add a mapping.",
                file=sys.stderr,
            )

    # --- LocalBusiness JSON-LD ---
    jsonld = {"@context": "https://schema.org", "@type": schema_type, "name": name}
    addr = {"@type": "PostalAddress", "addressCountry": "PH"}
    if address:
        addr["streetAddress"] = address
    if city:
        addr["addressLocality"] = city
    jsonld["address"] = addr
    if phone:
        jsonld["telephone"] = phone
    if city:
        jsonld["areaServed"] = city
    if args.image_url:
        jsonld["image"] = args.image_url
    if seo.get("priceRange"):
        jsonld["priceRange"] = str(seo["priceRange"])[:100]
    if seo.get("openingHours"):
        jsonld["openingHours"] = str(seo["openingHours"])
    yib = seo.get("yearsInBusiness")
    if isinstance(yib, (int, float)) and 0 < yib < 200:
        founding = datetime.date.today().year - int(yib)
        jsonld["foundingDate"] = str(founding)

    # --- GBP description ---
    gbp = seo.get("gbpDescription", "")
    if gbp:
        gbp, t2 = clip_chars(gbp, GBP_MAX)
        if t2:
            warn(f"gbpDescription trimmed to {GBP_MAX} chars.")
        if len(gbp) < GBP_MIN:
            warn(f"gbpDescription is short ({len(gbp)} chars); aim for {GBP_MIN}-{GBP_MAX}.")

    out = {
        "seoTitle": seo_title,
        "metaDescription": meta,
        "seoKeywords": kw,
        "structuredData": jsonld,
    }
    if gbp:
        out["gbpDescription"] = gbp

    with open(args.out, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print(f"ok: wrote {args.out}")
    print(f"  title ({len(seo_title)} chars): {seo_title}")
    print(f"  schema @type: {schema_type}  keywords: {len(kw)}  warnings: {len(warnings)}")


if __name__ == "__main__":
    main()
