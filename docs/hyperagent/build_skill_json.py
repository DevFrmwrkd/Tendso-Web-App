#!/usr/bin/env python3
"""
build_skill_json.py — package the skill/ folder into a Hyperagent import file.

Hyperagent skills import as a single JSON envelope:
  { "version": 1, "type": "skill", "exportedAt": "...", "data": { ... } }
where `data.scripts`, `data.tags`, and `data.references` are JSON-ENCODED STRINGS
(stringified JSON inside the JSON), matching the public-skills examples.

Run from this directory:
  python3 build_skill_json.py
Writes: tendso-studio.skill.json
"""
import datetime
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.join(HERE, "skill")

TAGS = [
    "tendso", "negosyo", "image-to-image", "website-content",
    "convex", "cost-optimized", "nano-banana", "hyperagent",
]

# Stringified ARRAY of credential objects. The importer only requires `name`, but
# the /edit page renders `description` and `type` (and calls .toLowerCase() on type),
# so we supply the full shape to keep that page from crashing.
CREDENTIAL_SCHEMA = [
    {
        "name": "CONVEX_CALLBACK_URL",
        "description": "Convex callback URL (https://<deployment>.convex.site/hyperagent-callback)",
        "type": "string",
        "required": True,
        "secret": False,
    },
    {
        "name": "TENDSO_CALLBACK_SECRET",
        "description": "Shared secret; must match Convex TENDSO_CALLBACK_SECRET",
        "type": "string",
        "required": True,
        "secret": True,
    },
    {
        "name": "SLACK_WEBHOOK_URL",
        "description": "Incoming webhook for #tendso-studio (optional)",
        "type": "string",
        "required": False,
        "secret": True,
    },
]


def parse_frontmatter(text):
    """Return (meta dict, body) from a markdown file with --- frontmatter."""
    meta, body = {}, text
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.DOTALL)
    if m:
        fm, body = m.group(1), m.group(2)
        for line in fm.splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip().strip('"')
    return meta, body.lstrip("\n")


def first_docstring_line(src):
    m = re.search(r'"""(.*?)"""', src, re.DOTALL)
    if not m:
        return ""
    for line in m.group(1).strip().splitlines():
        line = line.strip()
        if line:
            return line
    return ""


def main():
    with open(os.path.join(SKILL_DIR, "SKILL.md")) as f:
        skill_text = f.read()
    meta, body = parse_frontmatter(skill_text)

    # References → inline appendix (guaranteed visible on Hyperagent) + structured list
    ref_files = sorted(glob.glob(os.path.join(SKILL_DIR, "references", "*.md")))
    references = []
    appendix = ["\n\n---\n\n# Appendix — reference material (bundled with this skill)\n",
                "These are the `references/…` files referenced above, inlined so they load with the skill.\n"]
    for path in ref_files:
        name = os.path.basename(path)
        with open(path) as f:
            content = f.read()
        references.append({"filename": f"references/{name}", "content": content})
        appendix.append(f"\n\n## reference: references/{name}\n\n{content}")

    documentation = body + "".join(appendix)

    # Scripts → structured array
    script_files = sorted(glob.glob(os.path.join(SKILL_DIR, "scripts", "*.py")))
    scripts = []
    for path in script_files:
        name = os.path.basename(path)
        with open(path) as f:
            src = f.read()
        scripts.append({
            "filename": name,
            "content": src,
            "description": first_docstring_line(src) or name,
        })

    data = {
        "name": meta.get("name", "tendso-studio"),
        "description": meta.get("description", ""),
        "icon": "sparkles",  # string, not null — the viewer page calls .toLowerCase() on it
        "documentation": documentation,
        "tags": json.dumps(TAGS),                 # stringified JSON
        "whenToUse": meta.get("whenToUse", ""),
        "authType": "apiKey",
        "credentialSchema": json.dumps(CREDENTIAL_SCHEMA),  # stringified JSON (importer expects a string)
        "skillMdBody": body,
        "scripts": json.dumps(scripts),           # stringified JSON
        "references": json.dumps(references),     # stringified JSON
    }

    envelope = {
        "version": 1,
        "type": "skill",
        "exportedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "data": data,
    }

    out = os.path.join(HERE, "tendso-studio.skill.json")
    with open(out, "w") as f:
        json.dump(envelope, f, indent=2)

    print(f"wrote {out}")
    print(f"  name: {data['name']}")
    print(f"  scripts: {len(scripts)}  references: {len(references)}")
    print(f"  documentation: {len(documentation)} chars")


if __name__ == "__main__":
    main()
