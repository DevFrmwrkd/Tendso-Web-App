---
name: tendso-studio
description: "Turn a Tendso business submission (owner photos + interview transcript) into faithful, cost-controlled website images and structured website copy, then write the result back to Convex. Use whenever a Tendso/Negosyo submission payload arrives (a JSON object with submissionId, business, photos, transcript, qa) — via the webhook trigger or when Theo pastes a submission. This skill renders images IMAGE-TO-IMAGE from the real photos (never text-to-image, never altering the subject), writes length-capped copy grounded in the transcript, and is strict about vision/thinking/generation token cost. It does NOT build or style websites — Tendso already has templates; this only produces content + images."
whenToUse: "A Tendso submission needs its website images and copy generated. Triggers on an incoming submission payload (submissionId + photos + transcript), or Theo saying 'render this submission', 'generate the studio content', 'process submission <id>'. Also the recipient of the Convex triggerStudioRender webhook."
version: 1.0.0
---

# Tendso Studio — image + copy engine

You convert one business submission into **faithful website images** and **structured website copy**, then push the result to Convex. You are cost-disciplined: every vision, reasoning, and generation token is budgeted. You never build websites — Tendso has templates for that. You only produce content.

Read this whole file once, then follow §3 in order. Load a `references/` file only when §3 tells you to.

---

## 1. Hard rules (never violate)

1. **Image-to-image only. Never text-to-image.** Every output image is an edit of a real photo from the submission, with that photo attached to the Image Generation tool. If a slot has no source photo, you skip it — you do not invent one.
2. **Faithful retouch, not reinterpretation.** Preserve the subject, face, products, signage text, and architecture exactly. You may only fix lighting, exposure, white balance, background tidiness, clutter, crop/straighten, and gentle color. Never change identity, never add/remove people or products, never alter or invent signage text, never add text overlays or watermarks.
3. **Don't freehand prompts.** Get every image prompt from `build_edit_prompt.py`. You may add at most one short variable hint. Paraphrasing the baked scaffold causes drift — paste what the script returns.
4. **Don't look at full-size images.** Inspect only the thumbnails from `prepare_inputs.py`. Hand originals to the Image Generation tool by URL, never by loading them into your context. (Why: a full-res phone photo is thousands of vision tokens; a thumbnail is a few hundred.)
5. **Trust the role mapping; verify, don't re-derive.** Tendso orders photos: 0 headshot, 1–2 interior, 3 exterior, 4–5 product. Use vision only to catch an obvious mismatch, not to classify from scratch.
6. **1K resolution, one image per slot. Default 6 renders/submission (one per role); up to 12** if you add a second variant (`_v2`) for the strongest gallery slots — never beyond 12. Combine inputs only when a slot genuinely needs it. If you'd exceed the ceiling, stop and post to Slack — don't spend.
   - **Conditional spend — render fewer when the submission warrants fewer (this is the main cost lever).** The ceiling is a *max*, not a target. Skip a slot whose source photo is **unusable** (badly blurred, near-duplicate of another slot, subject not visible, finger over lens) — do **not** spend a render polishing a photo no template slot will show. A 3-good-photo submission should cost 3 renders, not be padded to 6. Image generation is ~95% of cost, so fewer-but-right renders is how you go *below* the ~$0.42 target.
   - **`_v2` variants are opt-in, never default.** Render a `_v2` only when a slot is a hero/gallery anchor **and** its first render came back strong. Most submissions need none; 12 is the rare exception.
7. **Image URLs must be Convex-fetchable.** Every image URL you record (and push) MUST come from `GenerateTempExternalDownloadUrl` — never the Image Generation tool's internal `viewUrl`. A `viewUrl` cannot be downloaded by Convex, so the images silently never save and the site ships photo-less. This is the single most common way a run looks "done" but delivers no images.
8. **Copy is capped JSON, grounded in the transcript.** No prose, no fabricated facts. If the transcript doesn't support a field, omit it.
9. **One submission per run. Stay on rails.** Don't reason about layout, styling, colors, or "the website." That's the template's job.

---

## 2. Setup — tools & credentials (once per agent)

This skill runs on Hyperagent. Enable these built-in tools on the agent: **Image Generation**, **Code Execution (Bash)**, **File Management**, and your **Slack** integration. Set these skill credentials (injected as env vars into the scripts):

| Credential | Used by | What it is |
|---|---|---|
| `CONVEX_CALLBACK_URL` | `push_to_convex.py` | `https://<your-deployment>.convex.site/hyperagent-callback` |
| `TENDSO_CALLBACK_SECRET` | `push_to_convex.py` | shared secret, must match Convex `TENDSO_CALLBACK_SECRET` |
| `SLACK_WEBHOOK_URL` | `post_feedback.py` | incoming-webhook URL for `#tendso-studio` (optional but recommended) |

At the start of a run, fetch the skill scripts to the workspace (Skill Scripts tool) and run everything with `python3`. Scripts use the Python standard library; `prepare_inputs.py` also uses Pillow for thumbnails (auto-installed on first run if missing).

---

## 3. The procedure (strict order)

You receive a JSON payload (the webhook body or pasted by Theo):

```json
{
  "submissionId": "...",
  "business": { "name": "...", "type": "salon", "owner": "...", "city": "...", "hasProducts": true },
  "photos": [ { "role": "headshot", "url": "https://..." }, { "role": "interior_1", "url": "https://..." }, ... ],
  "transcript": "full interview transcript ...",
  "qa": [ { "q": "What makes your shop special?", "a": "..." }, ... ]
}
```

### Step 1 — Prepare inputs (cheap eyes)

```bash
python3 scripts/prepare_inputs.py --payload payload.json --workdir ./work
```

This downloads each photo, writes a ~320px thumbnail, and prints `work/manifest.json` mapping each role to `{ url, thumb }`. **Look only at the thumbnails from here on.**

### Step 2 — Understand (verify, decide)

Look at the thumbnails and make only these decisions — briefly:

- **Verify roles.** Does each photo match its index role? If something is obviously off (e.g., a product where the headshot should be), note the corrected role. Don't over-analyze — a glance.
- **Pick the best per slot.** If both `interior_1` and `interior_2` exist, they map 1:1; no choice needed. The one judgement call: for the **exterior/hero plate**, decide *single* (just the exterior) or *combine* (exterior + interior_1 for a richer hero). Default **single** unless the exterior is weak and an interior would clearly help.
- **Note slots to skip (cost lever).** Skip a slot when: no source photo for the role; `hasProducts=false` (skip product slots); **or the source photo is unusable** (badly blurred, near-duplicate of a slot you're already rendering, subject not visible). Skipping an unusable photo is correct, not lazy — you're not paying to retouch an image no template will show. Decide the final render list here; that count is what the submission costs.
- **Decide `_v2` only if warranted.** A second variant is opt-in: render it only for a hero/gallery anchor slot whose primary render is strong. Default to none.

Keep this step to a few sentences of reasoning. The recipes do the heavy lifting.

### Step 3 — Render each slot (image-to-image, 1K)

Read `references/image-roles.md` and `references/edit-recipes.md` **once** before the first render.

For each slot you're keeping (max 6), in this order — headshot, interior_1, interior_2, exterior, product_1, product_2:

1. Get the baked prompt:
   ```bash
   python3 scripts/build_edit_prompt.py --role <role> --type <businessType> [--hint "one short line"] [--combine-with interior_1]
   ```
2. Call the **Image Generation** tool with:
   - `prompt`: exactly what the script returned (you may have already injected your ≤1-line hint via `--hint`).
   - `images`: the **original URL(s)** for this slot (the source role, plus the combine source if any). Never the thumbnail.
   - `model`: **Gemini Flash** · `resolution`: **1K** · `aspect_ratio`: per `references/image-roles.md` (portrait headshot 4:5, hero/exterior 16:9, interiors/products 4:3).
3. **Get a fetchable URL — REQUIRED, do not skip.** The Image Generation tool returns an internal **`viewUrl`** that Convex **cannot download** (the callback will silently store zero images and the website ships with no photos). For every rendered image you MUST convert it to a machine-accessible URL before recording it:
   - Call **`GenerateTempExternalDownloadUrl`** on the rendered image and use the URL it returns.
   - **Never** record a `viewUrl` (anything that is an internal viewer/preview link). Only the external download URL goes into `work/images.json`.
4. Record that **external download URL** against the slot's `enhancedImages` key (`enhanced_headshot`, `enhanced_interior_1`, …) in `work/images.json`.

If a render comes back unfaithful (face/products/signage changed), re-run **once** with the recipe's reinforcement line. If it fails twice, skip the slot and flag it in Step 6 — don't keep spending.

### Step 4 — Write the copy + SEO (capped JSON)

Read `references/copy-contract.md` and `references/seo-content.md` once. Produce **one JSON object** that includes the marketing copy, an `seo` object, and an `imageAlt` map — all grounded in `transcript` + `qa` + `business`. Obey the caps. Make `heroHeadline` (the H1) naturally carry the primary service + city. Omit anything the interview can't support — **never fabricate** (years, awards, reviews). Output JSON only, no commentary. Save to `work/content.json`.

### Step 5 — Build the SEO block, then validate & assemble

```bash
# Build + validate the title tag, keywords, and LocalBusiness JSON-LD.
# Pass the enhanced exterior/hero image URL if you have one (used as the schema image).
python3 scripts/build_seo.py --content work/content.json --payload payload.json --image-url "<enhanced_exterior url, or omit>" --out work/seo.json

# Validate copy + images + SEO and assemble the callback payload.
python3 scripts/build_payload.py --content work/content.json --images work/images.json --payload payload.json --seo work/seo.json --out work/result.json
```

`work/images.json` is `{ "enhanced_headshot": "https://...", ... }` (the URLs from Step 3). The scripts enforce caps, key names, and char limits and write the exact callback payload. If either reports an error, fix the offending field and re-run — do not hand-edit the JSON.

### Step 6 — Push to Convex

```bash
python3 scripts/push_to_convex.py --result work/result.json
```

A `200` means `generatedWebsites` is updated and `airtableSyncStatus='synced'`. Report a one-line summary: which slots rendered, which were skipped, and the cost (≈ $0.067 × images).

### Step 7 — Feedback (only if needed)

If during the run you hit any of: an **unknown business type** with no recipe, a **role you couldn't verify**, a **slot that failed faithfulness twice**, or a **copy field you couldn't ground** — post one Slack card per §Feedback. Otherwise, say nothing and finish.

---

## 4. Scripts

| Script | Purpose |
|---|---|
| `scripts/prepare_inputs.py` | Download photos, write thumbnails, emit `manifest.json`. |
| `scripts/build_edit_prompt.py` | Return the baked faithful-edit prompt for a role/type (this is where the constant prompt lives — don't reproduce it by hand). |
| `scripts/build_seo.py` | Build + validate the SEO block: title tag, keywords, LocalBusiness JSON-LD, GBP description (this is where the SEO formulas + schema mapping live). |
| `scripts/build_payload.py` | Validate copy + image URLs against the contract; emit the callback payload. |
| `scripts/push_to_convex.py` | POST the payload to the Convex callback (uses injected credentials). |
| `scripts/post_feedback.py` | Post a fixed-format feedback card to Slack. |

When unsure about a name, key, or cap — **run the script, don't guess.** The scripts encode the contract; your memory of it can drift.

---

## 5. Output contract (what Convex expects)

- **Images:** `enhancedImages` keyed `enhanced_headshot`, `enhanced_interior_1`, `enhanced_interior_2`, `enhanced_exterior`, `enhanced_product_1`, `enhanced_product_2` (extra variants → `_v2`). Values are the generated image URLs; Convex downloads and stores them.
- **Copy (core, required):** `heroHeadline`, `heroSubHeadline`, `aboutDescription`, `servicesDescription`, `contactCta`.
- **Copy (extended, optional):** `heroBadgeText`, `heroCtaLabel`, `aboutHeadline`, `aboutTagline`, `aboutTags[]`, `servicesHeadline`, `servicesSubheadline`, `featuredHeadline`, `tagline`, `tone`, `services[]`.
- **SEO:** `seoTitle`, `metaDescription`, `seoKeywords[]`, `structuredData` (LocalBusiness JSON-LD), `gbpDescription`, and `imageAlt` (per-image alt text). Built/validated by `build_seo.py`.

`build_payload.py` is the source of truth for keys and caps. Full detail in `references/copy-contract.md`.

---

## 6. Feedback & iteration loop

Keep the skill lean by sending edge cases to Slack instead of bloating this file. When you post a card, also **save the resolution** so it's permanent:

1. `python3 scripts/post_feedback.py --submission <id> --topic "<short>" --did "<what you did>" --ask "<the open question>" --proposal "<concrete recipe change>"`
2. When Theo answers, **save it as a Memory** (importance 4–5, category *domain knowledge*) and **append the rule to the "Studio Recipes" Document**.
3. Note it in this skill's changelog at the next version bump.

Next run, the Memory loads automatically — so you never ask the same thing twice. Full protocol and the card format: `references/feedback-protocol.md`.

---

## 7. References (load on demand)

| File | Read when |
|---|---|
| `references/image-roles.md` | Before Step 3 — role→slot map, aspect ratios, when to combine. |
| `references/edit-recipes.md` | Before Step 3 — the baked faithful-edit scaffolds (mirrors `build_edit_prompt.py`). |
| `references/copy-contract.md` | Before Step 4 — exact copy keys, caps, grounding rules. |
| `references/seo-content.md` | Before Step 4 — local-SEO method: title/meta formulas, keywords, LocalBusiness schema, GBP description, anti-patterns. |
| `references/token-budget.md` | If you're unsure whether an action is worth the tokens. |
| `references/feedback-protocol.md` | Step 7 — the Slack card format and the iteration loop. |

---

## Changelog

- **1.2.0** (2026-06-30) — images must use `GenerateTempExternalDownloadUrl`, never the internal `viewUrl` (Convex can't fetch a viewUrl → images silently never save). Added as hard rule 7 + an explicit Step 3 conversion + a `build_payload.py` guard that fails loudly on a viewUrl.
- **1.1.0** (2026-06-29) — conditional spend: skip unusable photo slots (don't pad to the ceiling); `_v2` variants made explicitly opt-in. Cost now scales down with submission photo quality rather than flat-rate per role.
- **1.0.0** (2026-06-25) — initial release: faithful i2i rendering on Gemini Flash @1K, capped copy, Convex write-back, Slack iteration loop.
