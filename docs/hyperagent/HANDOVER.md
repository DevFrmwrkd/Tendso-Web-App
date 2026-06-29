# Tendso Studio — Developer Handover

Everything you need is in this folder (`tendso/hyperagent/`). Do the steps in order.

---

## 0. Watch this first (understand Hyperagent)

▶ **https://www.youtube.com/watch?v=A33O4moktJU**

It explains how Hyperagent works: agents, **skills** (documentation + scripts + credentials + when-to-use), how skills load (pinned / available / discoverable), memory, tools, and webhook triggers. The thing you're deploying is exactly this: one agent that runs one skill.

---

## 1. What you're deploying (in one paragraph)

**Tendso Studio** is a Hyperagent agent that **replaces the Airtable AI step**. When a creator submits a business, Convex sends a webhook to the agent. The agent takes the owner's photos + interview transcript and produces (1) **faithful website images** (image-to-image edits of the real photos — never AI-invented) and (2) **SEO-grade website copy**, then writes both back into Convex `generatedWebsites`. It does **not** build websites — the Astro templates already do that. It only produces content.

---

## 2. What the skill does + how it fetches data (read this — it's the backbone)

**Trigger → run → write-back, all script-driven:**

1. **Convex → agent (webhook).** `submissions.submit()` schedules `triggerStudioRender` (in `convex/hyperagent.ts`), which resolves the photo URLs and POSTs a **self-contained JSON payload** (submissionId, business NAP, photos by role, transcript) to the agent's webhook.
2. **The skill runs** (`skill/SKILL.md`, step by step):
   - `prepare_inputs.py` — downloads photos, makes ~320px **thumbnails** (the agent looks at thumbnails, not full images → cheap vision).
   - Understands the thumbnails (verifies the role of each photo, picks slots).
   - Per slot: `build_edit_prompt.py` returns a **baked faithful-edit prompt**; the agent calls the built-in **Image Generation** tool (Gemini Flash / "Nano Banana", **1K**, image-to-image) with the original photo attached.
   - Writes copy + SEO in one pass; `build_seo.py` builds the title tag / meta / local keywords / **LocalBusiness JSON-LD** / GBP description; `build_payload.py` validates everything against the contract and assembles the result.
   - `push_to_convex.py` — **POSTs the result back to Convex** (`CONVEX_CALLBACK_URL` + secret).
3. **Agent → Convex (callback).** `/hyperagent-callback` (in `convex/http.additions.ts`) receives it; `ingestStudioResult` downloads the generated images into Convex **storage**; `saveStudioContent` writes `generatedWebsites` (copy + SEO + `enhancedImages`) and sets `airtableSyncStatus = 'synced'`.

**Data fetch = scripts + credential injection.** The only thing that runs *inside* Convex (not a script) is saving images into Convex storage — only a Convex function can do that, so the tiny callback action handles that one step.

---

## 3. Deploy the agent + load the skill (Hyperagent)

Follow `agent/SETUP.md` for exact field values. Summary:

1. Create an agent named **Tendso Studio**. Paste the **system prompt** from `agent/SETUP.md`.
2. **Model:** Qwen 3.7 Plus.
3. **Tools & Integrations:** enable Image Generation, Code Execution (Bash), File Management, Slack. Everything else off.
4. **Invocations:** add a **Webhook** trigger → copy its **URL + token** (they become Convex env vars). Keep manual **Thread** on for testing.
5. **Skills → import a file:** upload the single file **`tendso-studio.skill.json`**. ⚠️ It's ONE `.json` — all 6 scripts + 6 references + the credential slots are embedded inside it. Don't upload the folder or the `.md`. **Pin** the skill.
6. Set the skill **credentials:** `CONVEX_CALLBACK_URL`, `TENDSO_CALLBACK_SECRET`, `SLACK_WEBHOOK_URL`.
7. **Knowledge (optional):** create an empty "Studio Recipes" doc (the feedback loop appends to it).

---

## 4. Connect to the app — switch Airtable → Hyperagent (Convex)

All files are in `convex/` in this folder. Apply to the real `convex/` in `Tendso-App`:

1. Copy **`hyperagent.ts`** into `convex/`.
2. Add the `/hyperagent-callback` route from **`http.additions.ts`** into `convex/http.ts` (before `export default http;`).
3. Add the SEO fields from **`schema.additions.md`** to the `generatedWebsites` table in `convex/schema.ts` (all optional → backward compatible).
4. Apply the **one-line swap** from **`submit.patch.md`** in `convex/submissions.ts` (~line 503): `pushToAirtableInternal` → `triggerStudioRender`.
5. (Optional, for SEO on the page) add the `<head>` partial from **`../astro/SeoHead.astro`** to `astro-site-template/src/layouts/BaseLayout.astro`.
6. Set Convex env vars (see `convex/env.example`): `HYPERAGENT_WEBHOOK_URL`, `HYPERAGENT_WEBHOOK_TOKEN`, `TENDSO_CALLBACK_SECRET` (the secret must match the skill credential).
7. `npx convex deploy`.

`convex/airtable.ts` can stay (harmless) or be deleted later — `hyperagent.ts` doesn't depend on it.

---

## 5. Review the backbone (do this before trusting it in prod)

This skill IS the product logic — review it:

- `skill/SKILL.md` — the procedure + hard rules.
- `skill/scripts/*.py` — the 6 scripts (stdlib only; `prepare_inputs.py` uses Pillow, auto-installed). Outputs are **defined in the scripts** so the model can't drift.
- `skill/references/` — the contracts: `copy-contract.md` (copy keys + caps), `seo-content.md` (local-SEO method), `image-roles.md` (photo → slot map), `edit-recipes.md` (the faithful-edit scaffold). 
- `convex/hyperagent.ts` — trigger + ingest + save.

---

## 6. TEST — important

**A. Cold smoke test (no app needed).** In Hyperagent, open a **Thread** on the agent and paste the contents of `agent/sample-payload.json` (replace the image URLs with a real submission's R2 URLs for a meaningful faithfulness check; the placeholders just exercise the flow). Watch it: it should download, render each slot, write copy+SEO, and call `push_to_convex.py`.

**B. End-to-end test.** Submit a real test business in the app (≥3 photos + a short interview). Then verify in Convex that `generatedWebsites` for that submission has:
- copy fields (`heroHeadline`, `aboutDescription`, …) — grounded in the interview, no fabrication,
- SEO fields (`seoTitle` with `[service] in [city]`, `metaDescription`, `structuredData` = LocalBusiness JSON-LD, `gbpDescription`, `imageAlt`),
- `enhancedImages` (URLs + storageIds), and `airtableSyncStatus = 'synced'`.

**Check quality:** images are faithful (face/products/signage/building unchanged); the H1 + title carry service + city; run the JSON-LD through Google's Rich Results Test.

---

## 7. Config / cost knobs

- **Models (chosen for cost):** **Qwen 3.7 Plus** for the agent brain (cheap, strong vision + tool-use + Tagalog) and **Gemini Flash / Nano Banana @ 1K** for images (cheap, good enough for web/social). Resolution is the cost lever — keep 1K unless a slot truly needs more.
- **Images per submission:** default **6** (one per role). You can raise to **12** by allowing a second variant (`_v2`) for the strongest gallery slots — `build_payload.py` already accepts `_v2` keys. To change the ceiling, edit the "max 6 / up to 12" line in `skill/SKILL.md` (rule 6) and `skill/references/token-budget.md`, then re-run `python3 build_skill_json.py` and re-import. Cost scales linearly (~$0.067/image @1K).
- **Budget guardrail:** optionally turn on *Budget limit per query* (~$1) in the agent's Model tab.
- **Per-submission cost:** ≈ $0.42 (6 images @1K + copy). Orchestration is ~$0.006–0.014.

---

## 8. Feedback loop

When the agent hits a gap (unknown business type, unverifiable photo, faithfulness failure, ungroundable copy) it posts ONE card to Slack **#tendso-studio** with a proposed fix. Theo answers; the agent saves it as a memory + appends to "Studio Recipes" — so it never asks twice.

---

## 9. Folder map

```
tendso/hyperagent/
├── HANDOVER.md              ← this file
├── ARCHITECTURE.md          full design + cost math + model comparison
├── README.md                quickstart
├── agent/
│   ├── SETUP.md             the Hyperagent wizard, field by field
│   └── sample-payload.json  paste into a thread to smoke-test
├── skill/
│   ├── SKILL.md             the skill (procedure + rules)
│   ├── references/          contracts (copy, SEO, roles, recipes, budget, feedback)
│   └── scripts/             the 6 Python scripts
├── convex/                  the glue to copy into your convex/
│   ├── hyperagent.ts · http.additions.ts · schema.additions.md · submit.patch.md · env.example
├── astro/SeoHead.astro      SEO <head> partial
├── build_skill_json.py      re-packages skill/ → the import JSON
└── tendso-studio.skill.json ← THE FILE YOU UPLOAD to Hyperagent
```

Questions: ping Theo on Slack.
