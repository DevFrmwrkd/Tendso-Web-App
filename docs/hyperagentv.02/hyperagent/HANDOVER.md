# Tendso Studio - Developer Handover

Everything you need is in this folder (`tendso/hyperagent/`). Do the steps in order.

---

## 0. Watch this first (understand Hyperagent)

Watch: **https://www.youtube.com/watch?v=A33O4moktJU**

It explains how Hyperagent works: agents, **skills** (documentation + scripts + credentials +
when-to-use), how skills load (pinned / available / discoverable), memory, tools, and webhook
triggers. The thing you're deploying is exactly this: one agent that runs one skill.

---

## 1. What you're deploying (in one paragraph)

**Tendso Studio** is a Hyperagent agent that **replaces the Airtable AI step**. When a creator
submits a business, Convex sends a webhook to the agent. Acting as an **art director /
photographer**, the agent takes the owner's photos + interview and produces (1) the **best
possible landing-page image SET** - a varied 6-12 shot photoshoot (cinematic hero, craft
close-ups, the space with life in it), grounded in the real photos but never a literal copy of
them - and (2) **SEO-grade website copy**, then writes both back into Convex `generatedWebsites`.
It does **not** build websites - the Astro templates already do that. It **never fabricates an
owner** and **never alters brand truth** (logo, signage, colors, real faces).

---

## 2. What the skill does + how it fetches data (read this - it's the backbone)

**Trigger -> run -> write-back, all script-driven:**

1. **Convex -> agent (webhook).** `submissions.submit()` schedules `triggerStudioRender` (in
   `convex/hyperagent.ts`), which resolves the photo URLs and POSTs a **self-contained JSON
   payload** (submissionId, business NAP, photos, transcript) to the agent's webhook.
2. **The skill runs** (`skill/SKILL.md`, step by step):
   - `prepare_inputs.py` - downloads photos, makes ~320px **thumbnails** (the agent plans from
     thumbnails, not full images -> cheap vision).
   - **Plans a shot list** (6-12) from the shot library based on what the photos actually show.
   - Per shot: `build_shot.py` returns a **baked art-direction prompt** (camera grammar +
     photoreal stack + brand-truth guardrail); the agent calls the built-in **Image Generation**
     tool (Gemini Flash / "Nano Banana", **1K**, image-to-image) with the **real source photo(s)
     attached**, and records each result in `work/images.json`.
   - Writes copy + SEO in one pass; `build_seo.py` builds the title / meta / local keywords /
     **LocalBusiness JSON-LD** / GBP description; `build_payload.py` validates everything and
     assembles the result.
   - `push_to_convex.py` - **POSTs the result back to Convex** (`CONVEX_CALLBACK_URL` + the
     `X-Tendso-Secret` header).
3. **Agent -> Convex (callback).** `/hyperagent-callback` (in `convex/http.additions.ts`) receives
   it; `ingestStudioResult` downloads the generated images into Convex **storage**;
   `saveStudioContent` writes `generatedWebsites` (copy + SEO + `enhancedImages`) and sets
   `airtableSyncStatus = 'synced'`.

**Data fetch = scripts + credential injection.** The only thing that runs *inside* Convex (not a
script) is saving images into Convex storage - only a Convex function can do that, so the tiny
callback action handles that one step.

---

## 3. Deploy the agent + load the skill (Hyperagent)

Follow `agent/SETUP.md` for exact field values. Summary:

1. Create an agent named **Tendso Studio**. Paste the **system prompt** from `agent/SETUP.md`.
2. **Model:** Qwen 3.7 Plus.
3. **Tools & Integrations:** enable Image Generation, Code Execution (Bash), File Management, Slack.
4. **Invocations:** add a **Webhook** trigger -> copy its **URL + token** (they become Convex env
   vars). Keep manual **Thread** on for testing.
5. **Skills -> import a file:** upload the single file **`tendso-studio.skill.json`**. It's ONE
   `.json` - all scripts + references + the credential slots are embedded. Don't upload the folder
   or the `.md`. **Pin** the skill.
6. Set the skill **credentials:** `CONVEX_CALLBACK_URL`, `TENDSO_CALLBACK_SECRET` (sent as the
   `X-Tendso-Secret` header), `SLACK_WEBHOOK_URL`.
7. **Knowledge (optional):** create an empty "Studio Recipes" doc (the feedback loop appends to it).

---

## 4. Connect to the app - switch Airtable -> Hyperagent (Convex)

All files are in `convex/` in this folder. Apply to the real `convex/` in `Tendso-App`:

1. Copy **`hyperagent.ts`** into `convex/`.
2. Add the `/hyperagent-callback` route from **`http.additions.ts`** into `convex/http.ts` (before
   `export default http;`).
3. Add the SEO fields from **`schema.additions.md`** to the `generatedWebsites` table in
   `convex/schema.ts` (all optional -> backward compatible).
4. Apply the **one-line swap** from **`submit.patch.md`** in `convex/submissions.ts` (~line 503):
   `pushToAirtableInternal` -> `triggerStudioRender`.
5. **Template wiring (recommended):** point the page's hero image at `enhanced_hero`, the About
   portrait at `enhanced_portrait`, and the gallery to iterate `enhanced_gallery_*` (legacy
   `enhanced_exterior/headshot/interior_*/product_*` still populate too). Optional SEO `<head>`
   partial: `../astro/SeoHead.astro`.
6. Set Convex env vars (see `convex/env.example`): `HYPERAGENT_WEBHOOK_URL`,
   `HYPERAGENT_WEBHOOK_TOKEN`, `TENDSO_CALLBACK_SECRET` (must match the skill credential).
7. `npx convex deploy`.

`convex/airtable.ts` can stay (harmless) or be deleted later - `hyperagent.ts` doesn't depend on it.

---

## 5. Review the backbone (do this before trusting it in prod)

This skill IS the product logic - review it:

- `skill/SKILL.md` - the procedure + hard rules.
- `skill/scripts/*.py` - the scripts (stdlib only; `prepare_inputs.py` uses Pillow, auto-installed).
  Prompts are **defined in `build_shot.py`** so the model can't drift on quality or brand truth.
- `skill/references/` - the playbook: `shot-planning.md` (inventory -> shot list),
  `shot-library.md` (the shot vocabulary + per-business lists), `art-direction.md` (two-tier brand
  truth + photoreal/camera quality), `copy-contract.md` (copy keys + caps), `seo-content.md`
  (local-SEO method).
- `convex/hyperagent.ts` - trigger + ingest + save.

---

## 6. TEST - important

**A. Cold smoke test (no app needed).** In Hyperagent, open a **Thread** on the agent and paste
the contents of `agent/sample-payload.json` (replace the image URLs with a real submission's R2
URLs for a meaningful result; the placeholders just exercise the flow). Watch it: it should plan a
shot list, render the set, write copy+SEO, and call `push_to_convex.py`.

**B. End-to-end test.** Submit a real test business in the app (>=3 photos + a short interview).
Then verify in Convex that `generatedWebsites` for that submission has:
- copy fields (`heroHeadline`, `aboutDescription`, ...) - grounded in the interview, no fabrication,
- SEO fields (`seoTitle` with `[service] in [city]`, `metaDescription`, `structuredData` =
  LocalBusiness JSON-LD, `gbpDescription`, `imageAlt`),
- `enhancedImages` with `enhanced_hero` + `enhanced_gallery_*` (URLs + storageIds), and
  `airtableSyncStatus = 'synced'`.

**Check quality:** the set is varied and looks pro (a strong hero, craft close-ups, life in the
space - not 6 near-identical frames); **brand truth intact** (logo, signage, colors, any real face
unchanged); **no fabricated owner**; people read as local/Filipino; the H1 + title carry service +
city; run the JSON-LD through Google's Rich Results Test.

---

## 7. Config / cost knobs

- **Models (chosen for cost):** **Qwen 3.7 Plus** for the agent brain (cheap, strong vision +
  tool-use + Tagalog) and **Gemini Flash / Nano Banana @ 1K** for images. Resolution is the cost
  lever - keep 1K.
- **Images per submission:** a varied set of **6** by default, up to **12** (hero + medium + macro
  detail + product + ambient life). The agent decides the set from the shot library; placement keys
  are `enhanced_hero`, `enhanced_portrait` (only if a real owner), `enhanced_gallery_1..N`.
- **Budget guardrail:** optionally turn on *Budget limit per query* (~$1) in the agent's Model tab.
- **Per-submission cost:** ~ $0.42-$0.82 (6-12 images @1K + copy). Orchestration is ~$0.006-0.014.

---

## 8. Feedback loop

When the agent hits a gap (unknown business type, a photo it can't place, a brand-truth failure,
ungroundable copy) it posts ONE card to Slack **#tendso-studio** with a proposed fix. Theo answers;
the agent saves it as a memory + appends to "Studio Recipes" - so it never asks twice.

---

## 9. Folder map

```
tendso/hyperagent/
- HANDOVER.md              <- this file
- ARCHITECTURE.md          full design + cost math + model comparison
- README.md                quickstart
- agent/
  - SETUP.md               the Hyperagent wizard, field by field
  - sample-payload.json    paste into a thread to smoke-test
- skill/
  - SKILL.md               the skill (procedure + rules)
  - references/            shot-planning, shot-library, art-direction, copy, SEO, budget, feedback
  - scripts/               prepare_inputs, build_shot, build_seo, build_payload, push_to_convex, post_feedback
- convex/                  the glue to copy into your convex/
  - hyperagent.ts, http.additions.ts, schema.additions.md, submit.patch.md, env.example
- astro/SeoHead.astro      SEO <head> partial
- build_skill_json.py      re-packages skill/ -> the import JSON
- tendso-studio.skill.json <- THE FILE YOU UPLOAD to Hyperagent
```

Questions: ping Theo on Slack.
