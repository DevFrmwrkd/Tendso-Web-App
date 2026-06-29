# Airtable → Hyperagent (Tendso Studio) migration

**Date:** 2026-06-29 · **Owner:** Steven · **Source package:** `docs/hyperagent/` (built by Theo, v1.0.0)

The image + copy engine moves off Airtable onto a Hyperagent agent ("Tendso Studio").
Theo shipped the whole package — skill, scripts, and ready-to-merge Convex glue. This
doc is the cutover plan, the mobile answer, and the cost/performance testing protocol
Theo asked for. It is not a redesign; the design is in `docs/hyperagent/ARCHITECTURE.md`.

---

## TL;DR

- **Where the change happens:** this web repo, in `convex/` only. Same as the Airtable pipeline — Convex is the shared backend.
- **Mobile changes:** **none required.** The contract (`generatedWebsites` shape + `airtableSyncStatus` values) is preserved by design. See §4.
- **Verified against the live repo:** the swap line, the schema fields the payload reads, and R2 are all present. One quality gap (no structured interview Q&A) — see §6. Not a blocker.
- **The real work is cost discipline at 10k scale.** ~$0.42/submission today; the levers are resolution (1K), images-per-submission (6–12), and not fanning out agents. See §7.

---

## 0. Theo's directives → where each is handled

The six things Theo asked for, mapped to the work:

| # | Directive | Where | Status |
|---|---|---|---|
| 1 | **Configure context-awareness so the agent selects images intelligently** | Skill Step 2 (thumbnail vision verifies role per slot, picks the best photo, combines only when needed). Add the *conditional-spend* rule: **drop a slot when its source photo is unusable** instead of polishing garbage. | skill change — §7.5 |
| 2 | **Allow 6–12 images per prompt; adjust by cost/need** | `MAX_RENDERS` ceiling in `skill/SKILL.md` + `_v2` gallery variants. Default 6, gate `_v2` behind a quality bar so 12 is the exception. | skill knob — §7.5, §8.1 |
| 3 | **Fix resolution at 1K** | Already hard-coded in `token-budget.md` (1K always). No change needed; confirm in the A/B that nothing overrides it. | ✅ built-in |
| 4 | **SEO skill + scripts fetch data and images correctly** | `build_seo.py` (title/meta/JSON-LD/GBP), `push_to_convex.py` → `/hyperagent-callback` → `ingestStudioResult` (downloads images to Convex storage). Verify end-to-end in the smoke test. | verify — §5, §6 |
| 5 | **Run tests with screenshots to measure spend** | The screenshot protocol — §7.2 + §7.6. | procedure |
| 6 | **Monitor usage, avoid excessive parallel agents** | Sequential rendering (one thread/submission), `$1` per-query budget cap, no agent fan-out. | guardrails — §7.3 |

---

## 1. What's actually changing

The Airtable path (`convex/airtable.ts`: push record → poll for AI images/copy → ingest)
is replaced by a webhook round-trip to a Hyperagent agent that does the same job better:

| | Airtable (today) | Tendso Studio (Hyperagent) |
|---|---|---|
| Trigger | `pushToAirtableInternal` | `triggerStudioRender` |
| Image gen | Airtable AI fields, fixed prompts per field | Agent picks the right photo per slot, image-to-image edit at 1K |
| Prompts | embedded in Airtable fields (Theo: "a nightmare to update") | baked in the skill, version-controlled, editable in one place |
| Copy | Airtable AI text fields | structured capped JSON + local SEO (title/meta/JSON-LD/GBP) |
| Decisions | none (every image → every prompt) | context-aware: verifies roles, combines only when needed |
| Result write | `saveEnhancedContent` → `generatedWebsites` | `saveStudioContent` → `generatedWebsites` (**same shape**) |

The decoupling that made the Airtable swap safe still holds: submit schedules a background
job; every reader (web + mobile) reads `generatedWebsites`. Swapping the engine is invisible
downstream **as long as the output shape is preserved** — and Theo's `saveStudioContent`
preserves it (same `enhancedImages` keys, same `airtableSyncStatus` values).

---

## 2. Files to change (all in this repo)

From `docs/hyperagent/convex/` into the live `convex/`:

1. **Copy** `hyperagent.ts` → `convex/hyperagent.ts` (trigger + ingest + save). Self-contained; no dependency on `airtable.ts`.
2. **Paste** the `/hyperagent-callback` route from `http.additions.ts` into `convex/http.ts` (before `export default http;`).
3. **Add** the 6 optional SEO fields from `schema.additions.md` to the `generatedWebsites` table in `convex/schema.ts` (all `v.optional` → backward compatible, no index changes).
4. **Swap one line** in `convex/submissions.ts` — the live trigger is at **line 581** (docs say ~503; it drifted, the swap is otherwise identical):

   ```ts
   // before
   await ctx.scheduler.runAfter(0, internal.airtable.pushToAirtableInternal, { submissionId: args.id });
   // after
   await ctx.scheduler.runAfter(0, internal.hyperagent.triggerStudioRender, { submissionId: args.id });
   ```
5. `npx convex deploy`.

`convex/airtable.ts` stays in place during rollout (harmless, no dependency). Delete it only
after the studio path is confirmed in prod — keeping it is the rollback path (see §5).

### Env vars (Convex dashboard → Settings → Environment Variables)

- `HYPERAGENT_WEBHOOK_URL` — the agent's Webhook trigger URL
- `HYPERAGENT_WEBHOOK_TOKEN` — the agent's webhook auth token
- `TENDSO_CALLBACK_SECRET` — long random string, **must match** the skill credential of the same name
- `R2_PUBLIC_URL` — **already set** (verified)

---

## 3. Hyperagent side (one-time)

Per `docs/hyperagent/agent/SETUP.md`:

1. Create agent **Tendso Studio**; paste the system prompt from SETUP.md.
2. **Model:** Qwen 3.7 Plus (orchestration cost is negligible — see §7; choose on vision + tool reliability, not price).
3. **Tools:** Image Generation, Code Execution (Bash), File Management, Slack. Everything else off.
4. **Trigger:** add a Webhook → copy URL + token (→ the two Convex env vars). Keep manual Thread on for testing.
5. **Skill:** import the single file `tendso-studio.skill.json`. Pin it.
6. **Credentials:** `CONVEX_CALLBACK_URL` = `https://<deployment>.convex.site/hyperagent-callback`, `TENDSO_CALLBACK_SECRET` (matches Convex), `SLACK_WEBHOOK_URL`.

⚠️ Confirm the webhook's first-turn body field. Theo's trigger sends `{ message: ... }`.
If your webhook expects `prompt` or `input`, change the one line in `convex/hyperagent.ts`
(noted in a comment at line ~115).

---

## 4. Mobile: nothing to change (and why)

The mobile app **does not talk to Airtable or Hyperagent.** It does two things, both untouched:

1. Calls `submissions.submit()` — same name, same args. Only what it *schedules internally* changes.
2. Reads results from `generatedWebsites` / `getEnhancedContent`.

The studio path reuses the **same `airtableSyncStatus` values** (`pending_push → pushed → synced / error`)
and the **same `enhancedImages` key convention** (`enhanced_headshot`, `enhanced_interior_1`, …, `_v2` variants).
So mobile's status UI and image reads keep working with zero changes.

**The only thing that would force a mobile change** is breaking the output contract — new/renamed
`enhancedImages` keys, dropped copy fields, or different status strings. The new SEO fields are
*additive and optional*, so they don't break existing readers. **Action:** before deleting
`airtable.ts`, confirm no mobile screen depends on Airtable-only field names. (Web is already
verified — it reads `generatedWebsites`.)

> Note: the risk is never mobile-specific. Web and mobile read the *same* table, so a shape break
> would break both at once. The contract is the safety boundary, not the platform.

---

## 4b. Will the website builder use Hyperagent images or Airtable? (verified)

**It uses Hyperagent images — automatically, no builder change.** Traced the live code path:

- The builder (`app/api/generate-website/route.ts` + `lib/astro-builder.ts`) reads `enhancedImages`
  from `generatedWebsites`, keyed by `enhanced_headshot` / `enhanced_interior_1` / … — the **exact keys**
  Theo's `saveStudioContent` writes. It never reads Airtable directly.
- The builder already **rejects Airtable URLs**: it filters `airtableusercontent.com` (lines ~399, 439, 447,
  labelled `AIRTABLE_EXPIRED`) because Airtable URLs expire (410 Gone). It prefers the **Convex `storageId`**
  copy of each image.
- Theo's `ingestStudioResult` downloads every Hyperagent image into Convex storage and stores a `storageId`
  — i.e. it feeds the builder through the *preferred, non-expiring* path it already favors.

So after the swap, the studio writes the same keys to the same table; the builder picks them up unchanged.
**The one thing to watch:** the builder has 4 fallback sources for `enhancedImages` (top-level, `extractedContent`,
`websiteContent` chain, `websiteContent` direct). Studio writes the **top-level** location (Source 1) — same as
the mobile branch — so it's the first one checked. No conflict. The old Airtable rows already in
`generatedWebsites` keep working too (their stored `storageId`s are still valid even after Airtable URLs expire).

---

## 5. Rollout & rollback

**Staged, reversible:**

1. Deploy the code with the swap. Keep `airtable.ts` in the tree.
2. **Smoke test** (no app): paste `docs/hyperagent/agent/sample-payload.json` into a Hyperagent thread with **real R2 image URLs** from a live submission. Watch: download → render each slot → copy+SEO → `push_to_convex`. Confirm `generatedWebsites` row gets copy + `enhancedImages` + `synced`.
3. **End-to-end:** submit one real test business (≥3 photos + interview). Verify the same.
4. **Watch the first ~10 real submissions** in Hyperagent threads + Slack `#tendso-studio`. First runs post recipe-gap cards; answer them (they become permanent memories).
5. **Rollback if needed:** revert the one line in `submissions.ts` back to `pushToAirtableInternal` and redeploy. Airtable is still wired. ~2-minute reversal.

Because submit is fire-and-forget, in-flight submissions during cutover aren't lost — they
just route to whichever engine was deployed when they fired.

---

## 6. Verified gaps & quality notes

Checked Theo's glue against the live repo (not assumed):

| Check | Result |
|---|---|
| `submissions.ts` trigger line | ✅ present at L581 (docs said ~503 — drift only) |
| Payload fields `businessName/Type`, `ownerName/Phone/Email`, `address`, `city`, `transcript`, `photos`, `hasProducts` | ✅ all exist in schema |
| R2 configured (`R2_PUBLIC_URL` etc.) | ✅ set — Theo's "are images on R2?" → **yes** |
| `generatedWebsites.by_submissionId` index (used by `saveStudioContent`) | ✅ exists |
| Structured interview Q&A (`interviewQa`) | ⚠️ **does not exist** — payload sends `[]` |

**The one quality gap:** the skill's copy/SEO is grounded in the raw `transcript` only, not a
structured 5-question Q&A. The SEO doc assumes "foundingDate from Q2" etc. — with no Q&A field,
the agent must extract those from free transcript text, which is less reliable (e.g. years-in-business
may be missed → empty `foundingDate` in JSON-LD). **Not a launch blocker** (copy still generates),
but if SEO `foundingDate`/structured facts matter, add an `interviewQa` field to `submissions`
and populate it from the interview flow — a separate, additive change.

---

## 7. Cost & performance testing (the core requirement)

Theo's directive: be cost-sensitive — *"multiply by 10k and you understand how significant it is."*
The GPT-5.5 screenshot was **$0.107** for one fly-vs-mosquito request; the Opus 4.8 one was **$1.426**
for the *same* request. That 13× spread is exactly the point: **model + resolution + image-count
choices dominate cost, and at 10k submissions they compound.**

### 7.1 The cost model (per submission)

```
images:  N × $/image(resolution)     ← the dominant term
copy:    ~3–5k tokens  ≈ <$0.02
orch:    light vision + tool calls   ≈ $0.006–0.014
```

| Lever | Cheap | Expensive | Impact at 10k |
|---|---|---|---|
| **Resolution** | 1K ≈ $0.067/img | 4K ≈ $0.15/img | 6 imgs: ~$0.40 vs ~$0.90/sub → **$4,000 vs $9,000** |
| **Images/submission** | 6 (one per role) | 12 (with `_v2`) | doubles the image term → ~$4k → ~$8k |
| **Orchestration model** | Qwen 3.7 Plus / DeepSeek V4 Pro | Kimi/Opus-tier | $60–140 vs $1,000s — but still small next to images |
| **Fan-out** | sequential, ≤6 renders | parallel agents per submission | Theo: *"don't run one million agents at the same time"* |

**Conclusion: hold 1K, hold 6 images, and the cost floor is ~$4k per 10k submissions in image
gen.** Everything else is rounding error. The orchestration-model choice barely moves the needle
*because the skill keeps the model on a short leash* (thumbnails, lookup tables, capped JSON) — so
pick Qwen for vision/tool reliability, not to save pennies.

### 7.2 How to actually measure it (do this during the test runs)

Hyperagent shows **per-thread "Total cost"** (the figure in your screenshots) and **"View detailed usage."**
That's the instrument. Protocol:

1. **Baseline single run.** Submit one real business. Screenshot the thread's Total cost + detailed usage. Record: # images rendered, resolution, orchestration tokens in/out, $ image vs $ copy vs $ orch.
2. **Repeat ×5 across business types** (barber, cafe, auto, clinic, retail). Costs vary with photo count and transcript length. Take the **average and the worst case**, not one sample.
3. **Resolution A/B.** Run the same submission at 1K vs 4K. Confirm the ~$0.40 vs ~$0.90 delta on real data. Decide per-slot if any slot justifies >1K (default: none).
4. **Image-count A/B.** 6 vs 12 images. Is the extra gallery depth worth ~2× the image cost? Decide the ceiling (`MAX_RENDERS` in the skill).
5. **Orchestration model A/B.** Qwen 3.7 Plus vs DeepSeek V4 Pro on the *same* submission. Compare cost **and** Tagalog/Taglish→English copy quality + tool-call reliability. Cheapest only wins if quality holds.
6. **Project to scale.** `avg $/submission × expected monthly submissions`. Put the number in front of Theo before flipping all traffic.

### 7.3 Guardrails to set before volume

- **Budget limit per query** (~$1) in the agent's Model tab — hard stop so a runaway thread can't burn credits.
- **`MAX_RENDERS`** ceiling in the skill (default 6). Overflow → Slack card, not spend.
- **Sequential rendering** (the skill already does one image per slot, no seeds/variations). Don't parallelize agents per submission.
- **Watch Slack `#tendso-studio`** for repeated faithfulness retries — a retry is a re-render = double cost. If a business type keeps retrying, fix its recipe (the feedback loop) rather than eating the cost every run.

### 7.4 What "good" looks like

- Per-submission cost ≈ **$0.42** (6 × 1K + copy), orchestration ≈ **$0.01**.
- No thread exceeds the $1 budget cap.
- Faithfulness retries rare (most submissions render each slot once).
- Projected 10k-submission image cost ≈ **$4,000**, not $9,000+.

### 7.5 The smart workaround — conditional spend (the cheaper-than-target move)

The skill already enforces the flat levers (1K, one image per slot, retry cap). Pushing those
harder degrades quality. The real saving is **spending per submission what it warrants** — image
generation is ~95% of cost, so cut image *count*, never image *quality*:

1. **Drop dead slots (biggest lever).** The thumbnail vision pass already runs (Directive #1). Let it
   **skip a slot whose source photo is unusable** (blurry, duplicate, finger-over-lens) instead of
   editing it into an image no template slot shows. A 3-good-photo submission should cost 3 images
   (~$0.20), not be padded to 6. If average usable photos is 4 not 6 → **10k cost $4,000 → ~$2,700, zero quality loss.**
2. **Gate `_v2` variants behind a quality bar.** 6→12 images is ~$4k→~$8k per 10k. A `_v2` renders only
   when the slot is a hero/gallery anchor *and* the first render is strong. Default 6, ~4 typical, 12 rare.
3. **Kill retries at the source.** A faithfulness retry = a double-charged render. The cap is "1 reinforce
   then skip" (right). Cheaper still: when a business type keeps retrying, fix its recipe **once** via the
   Slack loop → permanent memory, so every future submission of that type renders clean first pass.
4. **Never fan out agents** (Directive #6). One submission = one sequential thread, ≤6 renders. Parallel
   agents multiply concurrent spend with no per-submission saving and risk a runaway burn.

**Do NOT** drop below 1K (web images look bad → re-render anyway), swap Qwen for a cheaper brain
(orchestration is ~$0.01/sub — invisible next to ~$0.40 of images), or batch submissions (no real saving).

**Skill change — DONE (v1.1.0).** The conditional-spend rule is implemented: `skill/SKILL.md` rule 6 +
Step 2 now skip unusable photo slots (not just absent ones) and make `_v2` explicitly opt-in.
`tendso-studio.skill.json` was repackaged. **You must re-import that JSON in Hyperagent** for it to take
effect (it's bundled into the importable file). This turns the $0.42 ceiling into a floor that *scales
down* with submission photo quality.

### 7.6 How to run a test with screenshots (Directive #5 — exact procedure)

The instrument is Hyperagent's per-thread cost panel (the dropdown in Theo's reference screenshots
showing `Total cost  $0.107` / `$1.426`). Each test = run a submission, screenshot the numbers, log them.

**Per run, capture these three screenshots:**

1. **The thread mid-render** — open Tendso Studio → the running thread. Shows each "Generating image"
   step + the rendered images inline + the file panel ("N Images"). Proves *how many* images rendered
   and at what point. Screenshot after it finishes.
2. **The cost dropdown** — click the model pill (top of thread) → the panel with **Total cost**. This is
   the headline $/submission. Screenshot it.
3. **"View detailed usage"** — click it from that dropdown. Breaks cost into image gen vs tokens
   (in/out). This is what tells you image vs copy vs orchestration split. Screenshot it.

**Log each run in a table** (paste into this doc or a sheet):

| Run | Business type | # imgs | Resolution | Total cost | Image $ | Copy $ | Orch $ | Retries | Notes |
|-----|---------------|--------|------------|-----------|---------|--------|--------|---------|-------|
| 1   | barber        | 5      | 1K         | $0.36     | $0.34   | $0.01  | $0.01  | 0       | dropped 1 blurry interior |
| …   |               |        |            |           |         |        |        |         |       |

**The runs to do (each is one screenshot set):**

- **Baseline:** 1 real submission, default settings. Record the split.
- **×5 across types** (barber, cafe, auto, clinic, retail) — cost varies with photo count + transcript length. Take the **average and worst case**, not one sample.
- **Resolution A/B:** same submission at 1K vs 4K. Confirm ~$0.40 vs ~$0.90. (Screenshot both cost panels side by side.)
- **Image-count A/B:** 6 vs 12 images on the same submission. Is the gallery depth worth ~2× cost?
- **Model A/B:** Qwen 3.7 Plus vs DeepSeek V4 Pro on the same submission — compare cost **and** copy quality (Tagalog→English) + tool reliability.

**Then project:** `avg $/submission × expected monthly submissions`. Put that number in front of Theo
before flipping all traffic. The screenshots are the evidence; the projected monthly $ is the decision.

> **Smoke test first (no app, no cost surprise):** paste `docs/hyperagent/agent/sample-payload.json` into a
> manual Thread with **real R2 image URLs** before any real submission. It exercises the full flow (download
> → render → copy+SEO → push_to_convex) so your first *measured* run isn't also your first *ever* run.

---

## 8. Open decisions for Steven

1. **Image ceiling:** 6 or up to 12? (Theo: "6 to 12 is good… images are not cheap.") Decide after the 6-vs-12 A/B in §7.2.
2. **Orchestration model:** lock Qwen 3.7 Plus, or A/B DeepSeek V4 Pro first? (Recommend: A/B once, then lock.)
3. **`interviewQa` field:** add structured Q&A now (better SEO grounding) or ship on transcript-only and add later? (Recommend: ship now, add later — not a blocker.)
4. **When to delete `airtable.ts`:** after N clean prod submissions. (Recommend: keep ~1 week as rollback, then remove.)
