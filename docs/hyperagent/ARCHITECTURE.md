# Tendso Studio — Hyperagent Skill Architecture

> The image + copy engine for Tendso, running as a skill on [Hyperagent](https://hyperagent.com).
> It replaces the Airtable AI step: a creator submits photos + an interview, Convex
> triggers the agent, the agent renders faithful website images and writes structured
> copy, and the result is written straight back into `generatedWebsites`.
>
> **Version:** 1.0.0 · **Date:** 2026-06-25 · **Owner:** Theo

---

## 1. What this does (and does not do)

**Does:**

- Receives a submission (business info + photos + interview transcript + interview Q&A) from Convex via an HTTP webhook.
- **Understands** the received images cheaply (verifies role, picks the best per slot, decides when to combine).
- **Renders** website images **image-to-image** from the originals — faithfully, never text-to-image, never altering the subject.
- **Writes** website copy (headlines, about, services, CTA) from the transcript + Q&A + business context.
- **Writes back** to Convex (`generatedWebsites`) in the exact shape the templates already consume.
- **Surfaces questions / improvement ideas** to Slack and folds accepted answers back into the skill (the iteration loop).

**Does NOT:**

- ❌ Build, lay out, or style websites. Tendso already has a homepage template library (`astro-site-template/`, `lib/template-fields.ts`). The agent produces *content*, not *sites*.
- ❌ Invent imagery. Every output image is an edit of a real photo the creator captured.
- ❌ Burn tokens. Vision, reasoning, and generation are all budgeted (see §6).

**Why a skill, not a website builder:** the only things that genuinely need a strong multimodal model are (a) judging which photo belongs where, (b) faithfully cleaning/recomposing photos, and (c) writing on-brand copy from a messy transcript. Everything else (layout, deploy) is deterministic and already built. So the skill is deliberately narrow.

---

## 2. The end-to-end flow

```
 Mobile app / submit flow
          │  submissions.submit()
          ▼
 ┌─────────────────────────┐
 │ Convex                   │   (1) status=submitted, lead, analytics  (unchanged)
 │  submissions.submit()    │   (2) schedule internal.hyperagent.triggerStudioRender
 └───────────┬─────────────┘
             │  HTTP POST  (submissionId, business, photos[role,url], transcript, qa[])
             ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Hyperagent — agent "Tendso Studio"  (Webhook trigger)        │
 │                                                              │
 │  skill: tendso-studio                                        │
 │   1. prepare_inputs.py   → download + thumbnail (cheap eyes) │
 │   2. UNDERSTAND          → verify roles, pick slots, combine?│
 │   3. for each slot:                                          │
 │        build_edit_prompt.py  → baked faithful-edit prompt    │
 │        Image Generation tool → Gemini Flash, 1K, i2i         │
 │   4. WRITE COPY          → compact JSON (length-capped)      │
 │   5. build_payload.py    → validate + normalize              │
 │   6. push_to_convex.py   → POST result back                  │
 └───────────┬─────────────────────────────────────────────────┘
             │  HTTP POST  (submissionId, secret, content{}, images{role:url})
             ▼
 ┌─────────────────────────┐
 │ Convex                   │   /hyperagent-callback (verify secret)
 │  ingestStudioResult      │   download each image → Convex storage → {url,storageId}
 │  saveStudioContent       │   patch generatedWebsites, airtableSyncStatus=synced
 └─────────────────────────┘
             │
             ▼
   Existing Astro template build consumes generatedWebsites  (unchanged)
```

The agent run is **stateless and self-contained** — Hyperagent webhook runs spawn a fresh thread with no human in the loop, so the payload carries everything the skill needs. The *only* moving parts you add to Tendso are one Convex action, one HTTP route, one mutation, and a one-line swap in `submit()`.

---

## 3. Where it plugs into Tendso (exact points)

| Touch point | File | Change |
|---|---|---|
| Trigger | `convex/submissions.ts` line ~503 | swap `internal.airtable.pushToAirtableInternal` → `internal.hyperagent.triggerStudioRender` |
| Trigger action | `convex/hyperagent.ts` *(new)* | `triggerStudioRender` — resolve photos, gather context, POST to agent webhook |
| Callback route | `convex/http.ts` | add `POST /hyperagent-callback` (mirrors `/airtable-webhook`) |
| Ingest + persist | `convex/hyperagent.ts` *(new)* | `ingestStudioResult` (download→store) + `saveStudioContent` (write) |
| Env | Convex dashboard | `HYPERAGENT_WEBHOOK_URL`, `HYPERAGENT_WEBHOOK_TOKEN`, `TENDSO_CALLBACK_SECRET` |

`saveStudioContent` is a superset-compatible sibling of the existing `saveEnhancedContent`: it writes the same five copy fields + `enhancedImages`, plus the extended fields the templates can use, and sets `airtableSyncStatus='synced'`. Nothing else in Tendso has to change — the Astro builder still reads `generatedWebsites`.

---

## 4. The image contract (faithful, role-mapped, image-to-image)

### 4.1 Input roles (from Tendso's fixed photo order)

Tendso already maps the `photos[]` array by index (`convex/airtable.ts`):

| Index | Role | What it is |
|---|---|---|
| 0 | `headshot` | Owner / primary person |
| 1 | `interior_1` | Interior space |
| 2 | `interior_2` | Interior space |
| 3 | `exterior` | Storefront / entrance |
| 4 | `product_1` | Product / service (only if `hasProducts`) |
| 5 | `product_2` | Product / service (only if `hasProducts`) |

The skill **trusts this mapping by default** and uses its (cheap, thumbnail) vision pass only to *verify* and *repair* obvious mismatches — not to re-derive roles from scratch. This is a deliberate token saving (§6).

### 4.2 Output slots → `enhancedImages` keys

| Output slot | Built from | Single or combine | `enhancedImages` key |
|---|---|---|---|
| Owner portrait | `headshot` | single edit | `enhanced_headshot` |
| Interior A | `interior_1` | single edit | `enhanced_interior_1` |
| Interior B | `interior_2` | single edit | `enhanced_interior_2` |
| Storefront / hero plate | `exterior` (optionally + `interior_1` for a hero composite) | single **or** combine | `enhanced_exterior` |
| Product A | `product_1` | single edit | `enhanced_product_1` |
| Product B | `product_2` | single edit | `enhanced_product_2` |

Keys match the existing convention exactly, so `saveStudioContent` is drop-in. Extra variants append `_v2` (same as the Airtable path).

### 4.3 Faithfulness — the non-negotiable rule

Every generation is an **edit of the real photo**, dispatched to the Image Generation tool with the original image(s) attached. The prompt is **assembled programmatically** by `build_edit_prompt.py` so the model never freehands it. The baked scaffold always carries:

- **Preserve anchor** (borrowed from your shot-builder `LIKENESS REPLICATION` pattern): *"Use the attached photo as the exact source. Preserve the subject, face, products, signage text, and architecture exactly — this is a retouch, not a reinterpretation."*
- **Allowed edits only:** lighting, exposure/white-balance, background tidy-up, distracting-clutter removal, straighten/crop, gentle color grade.
- **Hard negatives:** do not change identity or face; do not add/remove/!replace people or products; do not alter or invent signage text; do not change the building; no new objects; no text overlays; no watermarks.

The model contributes at most a **one-line variable hint** ("warm evening light, tidy the counter"). Everything else is constant. See `skill/references/edit-recipes.md`.

---

## 5. The copy contract (structured, capped, maps to schema)

The agent emits **one compact JSON object** — no prose, no explanation. `build_payload.py` validates it against length caps and required keys before it is allowed to leave the agent.

**Core (required — drop-in compatible with `saveEnhancedContent`):**

| JSON key | → `generatedWebsites` | Cap |
|---|---|---|
| `heroHeadline` | `heroHeadline` | ≤ 8 words |
| `heroSubHeadline` | `heroSubHeadline` | ≤ 16 words |
| `aboutDescription` | `aboutDescription` | ≤ 60 words |
| `servicesDescription` | `servicesDescription` | ≤ 40 words |
| `contactCta` | `contactCta` | ≤ 12 words |

**Extended (optional — written if present, used by richer template variants):**

`heroBadgeText`, `heroCtaLabel`, `aboutHeadline`, `aboutTagline`, `aboutTags[]` (≤5), `servicesHeadline`, `servicesSubheadline`, `featuredHeadline`, `tagline`, `tone`, `services[]` (`{name, description}`, ≤6).

All copy is grounded in the transcript + interview Q&A + business type. The skill is told to **never invent facts** (no fake awards, no fabricated years in business) — if the transcript doesn't support it, the field is omitted. The full schema lives in `skill/references/copy-contract.md`.

---

## 6. Token & cost discipline (the core requirement)

Three token sinks, each capped:

### 6.1 Vision tokens — *don't look at full-size images*

- `prepare_inputs.py` downloads each photo and writes a **~320px thumbnail**. The agent's understanding pass looks **only at thumbnails**. Gemini tokenizes images by 768px tiles (258 tokens/tile); a 320px thumbnail is a single low tile (~70–258 tokens) vs. thousands for a full-res phone photo.
- The **originals never enter the agent's context as tokens** — they are handed to the Image Generation tool **by URL/path**, server-side.
- The role mapping is **trusted from index**, so vision is a quick *verification*, not a from-scratch classification. Fewer images examined = fewer tokens.

### 6.2 Thinking tokens — *don't reason about solved problems*

- Roles, slot map, and edit recipes are **lookup tables**, not decisions. The agent makes only a few binary calls (combine? which interior is stronger?).
- The skill explicitly tells the agent **not** to reason about layout, styling, or "the website" — that's the template's job. Narrow surface = short reasoning.

### 6.3 Generation tokens — *1K, one per slot, combine only when needed*

- **Resolution: 1K.** On Gemini Flash (Nano Banana 2) 1K ≈ $0.067/image vs 2K ≈ $0.10 (+51%) vs 4K ≈ $0.15 (+125%). 1K is correct for web/social; resolution is a hard cost lever.
- **One image per slot**, no variations/seeds.
- **Combine only when a slot needs it** (hero composite). Combines cost the same per output but use more input vision on the tool side — used sparingly.
- **Per-submission ceiling:** `MAX_RENDERS` (default 6 — one per role). The procedure stops at the ceiling and flags overflow to Slack rather than spending.

### 6.4 Output tokens — *baked prompts, capped JSON*

- `build_edit_prompt.py` returns the full image prompt; the model adds ≤1 line. It never writes a 200-word prompt.
- Copy is length-capped JSON only.

**Per-submission cost (typical, 6 images @ 1K + one copy pass):**

```
images:  6 × $0.067   ≈ $0.40
copy:    ~3–5k tokens ≈ <$0.02
─────────────────────────────
total                 ≈ $0.42 / submission
```

Against a creator payout of ₱1,000 and a paid submission, the AI cost is rounding error — but at volume the 1K-vs-4K choice alone is the difference between ~$0.40 and ~$0.90 per submission.

> **Note on model pinning:** the built-in Image Generation tool exposes *"Gemini Flash"* (= Nano Banana). It does not let you pin the exact sub-version (2.5 vs 3.1 Flash Image) — you select the Flash tier and the platform routes it. The skill documents this; if exact pinning ever matters, swap to a Kie.ai/fal.ai script (the skill is structured so that's a localized change to one script).

### 6.5 Orchestration model (the agent's brain)

Separate from the image generator: the model that does the (light) vision, the (light) reasoning, the tool-calling, and the copywriting. What this skill needs, in order: **real vision** (judge 320px thumbnails), **reliable tool-calling** (script-heavy loop), **Tagalog/Taglish → English copy**, then **cheap**.

| Model (June 2026) | Vision | Agentic / thinking | $/M in · out | Verdict for this skill |
|---|---|---|---|---|
| **Qwen 3.7 Plus** | Native, heritage VL strength | Top-15 agentic, 1000+ tool calls | $0.32 · $1.28 | **Default** — best balance |
| DeepSeek V4 Pro | Native, very image-token-efficient (~90 KV/img) | Strong coding (80.6% SWE-bench) | $0.435 · $0.87 | **A/B challenger** — cost floor; check Tagalog copy |
| Kimi K2.6 | Native but new (K2 was text-only) | Elite coding, 300-subagent orchestration | $0.67 · $3.50 | Overkill + priciest on output |
| GLM 5.2 | Unconfirmed / likely text-only | Great design/coding | $1.40 · $4.40 | Skip until vision confirmed |

**Decision:** default the Hyperagent agent to **Qwen 3.7 Plus**; optionally A/B against **DeepSeek V4 Pro** for the absolute cost floor. Because the skill keeps this model on a short leash (thumbnails, lookup tables, capped JSON), orchestration cost is **~$0.006–0.014 / submission** regardless of pick — negligible next to the ~$0.40 of image generation. So choose on **vision + tool reliability**, not price. Set this in the agent's model selector (it does not change the skill).

---

## 7. The Slack feedback & iteration loop

The skill is built to **improve itself in the open**. Hyperagent gives us native Slack, automatic Memory, Documents, and even Evaluation tooling — we use the simple subset.

**When the agent posts to Slack** (`#tendso-studio`): low-confidence role verification, a **business type it has no recipe for**, a faithfulness failure it had to work around, or a copy field it couldn't ground in the transcript. The message is a fixed-format card: `submissionId`, what it did, the open question, and **a concrete proposed recipe change**.

**How an answer becomes a permanent improvement (the loop):**

```
agent notices gap → post_feedback.py posts Slack card
        → Theo replies with the call
        → agent saves it as a Memory (importance 4–5, "domain knowledge")
        → agent appends the rule to the "Studio Recipes" Document
        → version note bumped in the skill changelog
```

Next run, the Memory loads automatically and the recipe doc is searchable — so the same question is never asked twice. This keeps the skill body lean (it doesn't accrete every edge case) while the knowledge still compounds. Full protocol: `skill/references/feedback-protocol.md`.

---

## 8. Deliverables in this folder

```
tendso/hyperagent/
├── ARCHITECTURE.md              ← this file
├── README.md                    ← quickstart + deploy checklist
├── skill/
│   ├── SKILL.md                 ← the skill (authored source of truth)
│   ├── references/
│   │   ├── image-roles.md       ← role→slot map, when to combine
│   │   ├── edit-recipes.md      ← baked faithful-edit prompt scaffolds
│   │   ├── copy-contract.md     ← exact JSON copy schema + caps
│   │   ├── token-budget.md      ← the cost/token rules
│   │   └── feedback-protocol.md ← Slack + iteration loop
│   └── scripts/
│       ├── prepare_inputs.py    ← download + thumbnail (cheap vision)
│       ├── build_edit_prompt.py ← assemble baked faithful-edit prompt
│       ├── build_payload.py     ← validate + normalize the result
│       ├── push_to_convex.py    ← POST result to Convex callback
│       └── post_feedback.py     ← Slack feedback card
├── build_skill_json.py          ← packages the skill into the Hyperagent import JSON
├── tendso-studio.skill.json     ← the importable Hyperagent skill (generated)
└── convex/                      ← ready-to-merge glue (copy into your convex/)
    ├── hyperagent.ts            ← triggerStudioRender + ingestStudioResult + saveStudioContent
    ├── http.additions.ts        ← the /hyperagent-callback route
    ├── submit.patch.md          ← the one-line swap in submissions.ts
    └── env.example              ← required env vars
```

---

## 9. Deploy checklist (summary — full steps in README.md)

1. **Hyperagent:** create agent "Tendso Studio" → enable tools (Image Generation, Code Execution, File Management, Slack) → import `tendso-studio.skill.json` → pin the skill → set the Webhook trigger, copy its URL + token → set skill credentials (`CONVEX_CALLBACK_URL`, `TENDSO_CALLBACK_SECRET`, `SLACK_WEBHOOK_URL`).
2. **Convex:** copy `convex/hyperagent.ts`, add the `/hyperagent-callback` route, apply the one-line `submit()` swap, set the three env vars.
3. **Test:** submit a test business → watch the agent thread → confirm `generatedWebsites` populated and `airtableSyncStatus='synced'`.
4. **Iterate:** first few runs will post a couple of Slack cards as recipes fill in. Answer them; they become permanent.
