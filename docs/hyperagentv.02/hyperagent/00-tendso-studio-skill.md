---
created: 2026-06-26
modified: 2026-06-26
uid: 20260626160000
type: how-to-guide
aliases: ["Tendso Studio Skill", "Hyperagent Studio", "Tendso Studio Agent"]
summary: Hyperagent skill that turns a Tendso submission (owner photos + interview) into faithful website images + SEO-grade copy, written back to Convex. Replaces the Airtable AI step.
bucket: frmwrkd
status: ready
public: false
tools:
  - "[[Convex]]"
  - "[[Hyperagent]]"
related:
  - "[[00-project-overview]]"
  - "[[04-Interview-Recording]]"
  - "[[09-brand-guidelines]]"
tags: [tendso, hyperagent, skill, seo, image-generation, convex, agent]
---

# Tendso Studio — Hyperagent skill

> The image + copy engine for Tendso. A creator submits photos + a short owner interview;
> the agent renders **faithful website images** (image-to-image, never altering the original)
> and writes **SEO-grade copy**, then writes the result into Convex `generatedWebsites`.
> It does **not** build websites — Tendso's Astro templates do that. It produces content only.

**Code + full docs live in the repo** (not duplicated here): `New Coding Projects/Tendso-App/tendso/hyperagent/`.
This note is the knowledge hub + decision log.

---

## What it does (one run)

1. Convex `submissions.submit()` fires a webhook to the Hyperagent agent with a self-contained payload (business info + photo URLs + transcript).
2. The agent runs the `tendso-studio` skill:
   - `prepare_inputs.py` → downloads photos, makes ~320px thumbnails (cheap vision).
   - Understands the thumbnails (verifies roles, picks slots, decides when to combine).
   - For each slot: `build_edit_prompt.py` → baked faithful-edit prompt → **Image Generation** tool (Gemini Flash, 1K, image-to-image).
   - Writes copy + SEO in one pass; `build_seo.py` bakes the title/meta/JSON-LD; `build_payload.py` validates + assembles.
   - `push_to_convex.py` → POSTs the result to `/hyperagent-callback`.
3. Convex downloads the images into storage and writes `generatedWebsites` (copy + SEO + `enhancedImages`), status `synced`.

---

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Platform | **Hyperagent** (hyperagent.com) | Agent + skills + memory + webhook triggers + native Slack + built-in image gen. |
| Image model | **Built-in Image Generation tool** → Gemini Flash (Nano Banana) **@ 1K**, image-to-image | No API key; 1K ≈ $0.067/img vs ~$0.10 (2K) / ~$0.15 (4K) — resolution is the cost lever. |
| Orchestration model | **Qwen 3.7 Plus** (A/B vs DeepSeek V4 Pro) | Best vision + tool-use + Tagalog + cheap; orchestration cost ~$0.006–0.014/submission. |
| Pipeline | **Replaces the Airtable AI step** | Fewer moving parts; writes the same `generatedWebsites` fields `saveEnhancedContent` filled. |
| Faithfulness | Baked "preserve / retouch-only" scaffold + hard negatives | Never alter face, products, signage, building. Mirrors the shot-builder LIKENESS anchor. |
| Cost discipline | Thumbnails for vision · 1K · 1 image/slot · ≤6/submission · capped JSON | ~$0.42 / submission total. |

---

## SEO layer (borrowed from the `claude-seo` skill)

Each generated business site gets real **local SEO**, not just marketing copy:

- **Title tag** `[service] in [city] | [name]` (≤60 chars) and a keyword-aware **H1**.
- **Meta description** (120–155 chars), **local keywords** (`[service] [city]`, `near me`).
- **LocalBusiness JSON-LD** with the correct schema.org `@type` per business (barber→HairSalon, cafe→CafeOrCoffeeShop, auto→AutoRepair, clinic→MedicalClinic, …), NAP, `foundingDate` (from interview Q2), `priceRange`.
- **GBP-ready description** (250–750 chars) to paste into Google Business Profile — the #1 local factor.
- **Image alt text** (SEO + accessibility).
- Hard rules: no keyword stuffing, pass the "swap test", **never fabricate** (years, awards, reviews).

Needs a few additive (optional) fields on `generatedWebsites` (`seoTitle`, `metaDescription`, `seoKeywords`, `structuredData`, `gbpDescription`, `imageAlt`) + a `<head>` partial — both shipped in the repo (`convex/schema.additions.md`, `astro/SeoHead.astro`).

---

## Feedback & iteration loop

The skill improves in the open. On a genuine gap (unknown business type, unverifiable photo, repeated faithfulness failure, ungroundable required copy) the agent posts **one structured card to Slack `#tendso-studio`** with a concrete proposed change. When Theo answers, the agent saves it as a **memory** and appends to the **"Studio Recipes"** doc — so the same question never recurs. Keeps the skill body lean while knowledge compounds.

---

## Interview questions (the raw material)

From [[04-Interview-Recording]] — the 5 owner questions the copy is grounded in:
1. What do you do? → business description + primary service keyword
2. How long operating? → years in business (trust signal + schema `foundingDate`)
3. What makes you special? → USP
4. Services/products? → services list + keywords
5. Your dream? → About / passion

---

## Deploy (summary — full guide in repo `agent/SETUP.md`)

1. **Hyperagent:** create agent "Tendso Studio" → enable Image Generation, Code Execution, File Management, Slack → import `tendso-studio.skill.json` → pin → set credentials → add Webhook trigger.
2. **Convex:** copy `convex/hyperagent.ts`, add `/hyperagent-callback` route, apply the one-line `submit()` swap, add the SEO schema fields, set 3 env vars.
3. **Test** from a cold thread / a real submission; confirm `generatedWebsites` populated + `synced`.

---

## Repo file map

`New Coding Projects/Tendso-App/tendso/hyperagent/`

- `ARCHITECTURE.md` · `README.md` — design + quickstart
- `agent/SETUP.md` — the Hyperagent wizard guide (Identity system prompt, Model, Tools, etc.)
- `skill/SKILL.md` + `references/` (image-roles, edit-recipes, copy-contract, **seo-content**, token-budget, feedback-protocol) + `scripts/` (prepare_inputs, build_edit_prompt, **build_seo**, build_payload, push_to_convex, post_feedback)
- `convex/` — hyperagent.ts (trigger + ingest + save), http.additions.ts, submit.patch.md, **schema.additions.md**, env.example
- `astro/SeoHead.astro` — the SEO `<head>` partial
- `tendso-studio.skill.json` — the importable Hyperagent skill (6 scripts, 6 references)

---

## Hyperagent skill conventions — conformance

Matches the platform's documented skill anatomy: **documentation + scripts + credentials + when-to-use**; a **Process** skill that carries its own **Context**; outputs are **defined in scripts**; specific, example-rich, with anti-patterns; **one job**; importable JSON. Small learned facts go to **memories**, not the skill body.
