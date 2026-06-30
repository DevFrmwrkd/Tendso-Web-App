#!/usr/bin/env python3
"""
prepare_inputs.py - download submission photos and make cheap thumbnails.

Why: the agent should look at SMALL thumbnails (cheap vision tokens), never
full-resolution phone photos. Originals are handed to the Image Generation tool
by URL; only thumbnails enter the agent's context.

Input:  --payload payload.json   (the submission webhook body)
        --workdir ./work          (where to put originals + thumbs + manifest)
Output: work/manifest.json  ->  { businessType, hasProducts, roles: { <role>: {url, original, thumb} } }
        plus a short human summary on stdout.

Uses the standard library; uses Pillow for thumbnails if available
(auto-installs it once if missing). If Pillow can't be used, it falls back to
recording the original as the "thumb" and warns - the pipeline still runs.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
from urllib.parse import urlparse

THUMB_MAX = 320  # longest side, px - one low Gemini image tile
HTTP_TIMEOUT = 30


def log(msg):
    print(msg, file=sys.stderr)


def ensure_pillow():
    """Return the PIL.Image module, installing Pillow once if needed; else None."""
    try:
        from PIL import Image
        return Image
    except Exception:
        pass
    try:
        log("Pillow not found - installing once...")
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet", "Pillow"],
            check=True,
        )
        from PIL import Image
        return Image
    except Exception as e:
        log(f"Could not install Pillow ({e}); thumbnails will fall back to originals.")
        return None


def ext_from(url, content_type):
    ct = (content_type or "").lower()
    if "jpeg" in ct or "jpg" in ct:
        return ".jpg"
    if "png" in ct:
        return ".png"
    if "webp" in ct:
        return ".webp"
    path = urlparse(url).path
    _, dot, tail = path.rpartition(".")
    if dot and 1 <= len(tail) <= 5:
        return "." + tail.lower()
    return ".jpg"


def download(url, dest_noext):
    req = urllib.request.Request(url, headers={"User-Agent": "tendso-studio/1.0"})
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as r:
        data = r.read()
        ct = r.headers.get("Content-Type", "")
    dest = dest_noext + ext_from(url, ct)
    with open(dest, "wb") as f:
        f.write(data)
    return dest


def make_thumb(Image, src, dest):
    if Image is None:
        return None
    try:
        im = Image.open(src)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.thumbnail((THUMB_MAX, THUMB_MAX))
        im.save(dest, "JPEG", quality=80)
        return dest
    except Exception as e:
        log(f"thumb failed for {src}: {e}")
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True)
    ap.add_argument("--workdir", default="./work")
    args = ap.parse_args()

    with open(args.payload) as f:
        payload = json.load(f)

    business = payload.get("business", {}) or {}
    photos = payload.get("photos", []) or []

    originals = os.path.join(args.workdir, "originals")
    thumbs = os.path.join(args.workdir, "thumbs")
    os.makedirs(originals, exist_ok=True)
    os.makedirs(thumbs, exist_ok=True)

    Image = ensure_pillow()

    roles = {}
    for p in photos:
        role = p.get("role")
        url = p.get("url")
        if not role or not url:
            continue
        try:
            orig = download(url, os.path.join(originals, role))
        except Exception as e:
            log(f"download failed for {role} ({url}): {e}")
            continue
        thumb = make_thumb(Image, orig, os.path.join(thumbs, role + ".jpg")) or orig
        roles[role] = {"url": url, "original": orig, "thumb": thumb}

    manifest = {
        "businessType": business.get("type"),
        "hasProducts": bool(business.get("hasProducts")),
        "roles": roles,
    }
    manifest_path = os.path.join(args.workdir, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    # Compact human summary
    print(f"manifest: {manifest_path}")
    print(f"businessType: {manifest['businessType']}  hasProducts: {manifest['hasProducts']}")
    for role, v in roles.items():
        print(f"  {role}: thumb={os.path.relpath(v['thumb'], args.workdir)}")
    if not roles:
        print("WARNING: no photos downloaded - check the payload URLs.")


if __name__ == "__main__":
    main()
