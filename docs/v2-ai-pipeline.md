# v2 AI site pipeline

Branch `feat/v2-ai-pipeline`, 2026-10-21. Brief §4C (`docs/IMPLEMENTATION-HANDOFF.md`).
Goal: about **20 minutes** from "Send" to "Ready to check", with no invented facts and
photos that look re-shot by a professional, not filtered.

**Off by default.** With `AI_PIPELINE_ENABLED` unset, production behaves as today:
every submission goes to Tendso Studio (Hyperagent) and an admin builds the site.

---

## 1. What happens

```
submit (agent app / /start / giveaway approval)
  └─ hyperagent.triggerStudioRender          ← the one existing hook
       ├─ AI_PIPELINE_ENABLED off → Tendso Studio, as today
       └─ on → aiPipeline/orchestrator.start  (owner app: buildProgress.startPipeline, see §6)
            1 reading_interview   transcribe (Groq Whisper, reused) → facts (Gemini pool → Groq)
            2 writing_pages       facts → short page copy → template fields
            3 polishing_photos    Higgsfield re-shoot per photo → vision QC → keep or original
            4 building_site       existing /api/generate-website build → draft site saved
       on failure → run marked failed, submission left in the admin queue, Studio triggered
```

Each step is its own scheduled Convex action (`aiPipeline/steps.runStep`). It saves its
output on the run row (`aiPipelineRuns`) and schedules the next step, so:

- **Retryable.** A throwing step is retried with backoff (20 s, 60 s, 120 s): 3 attempts for
  steps 1, 2 and 4, 2 for photos. Decisions come from `lib/aiPipeline/stateMachine.ts`.
- **Idempotent.** A retry reuses what earlier steps saved. Each polished photo is saved the
  moment it is decided, so a retried photo step only does the photos still missing.
  A second trigger for the same submission joins the run in flight; a finished run is not
  repeated unless started with `force` (a rebuild).
- **Bounded.** One overall deadline (default 30 min). A scheduled `checkTimeout` fails a run
  still going at the deadline. Every external call has its own timeout.

The submission's `status` is never changed by the pipeline. The site is saved as a **draft**,
exactly what an admin "Generate" leaves behind, so the admin review queue works as today.
For owner-app orders the `building_site → done` progress report (other branch) sets
"Ready to check" and publishes once the owner has paid.

### Step 1 — reading the interview
- Text answers (owner intake `interviewQa`, owner app `ownerInterview[].answerText`) are used
  as typed. Recorded answers (`ownerInterview[].mediaUrl`) go through the existing Groq Whisper
  code (`transcription.transcribeFrom`). A creator-funnel recording reuses
  `transcription.transcribeMedia`; if it is still `processing` the step waits (30 s at a time,
  inside the deadline) instead of failing.
- One LLM call fills a fixed JSON shape (`lib/aiPipeline/facts.ts`): name, address, landmark,
  phone, services with ₱ prices, hours, year started, story, what customers love, customer
  quotes (never names), payment methods, areas served, owner quotes, language.
- `validateFacts` coerces to that exact shape (missing → `''` / `[]`). `groundFacts` then
  **drops any price, hour, year or phone whose digits the owner never said or typed** (spoken
  numbers like "alas otso" count). Typed form values always win over anything heard.

### Step 2 — writing the pages
- The copy model sees **only the validated facts**, never the transcript, and writes short
  fields with word limits (tagline ≤ 10 words, headline ≤ 8, sub ≤ 25, …).
- `validateCopy` blanks any line carrying a number not in the facts or a stock cliché, trims
  over-long lines, removes emoji and "!", and drops descriptions for services the owner said
  nothing about.
- `buildTemplateContent` (`lib/aiPipeline/fieldMapping.ts`) writes the
  `genericContentSchema` paths (hero, about, services.items with price, location.hours,
  footer.hours, faq, …) **plus** the legacy keys the builder reads. The full set is written
  whatever template is chosen, so a later design switch keeps the content (§4D).
  Conversion blocks with nothing to say (`why`, `how`, `credentials`) are empty arrays, the
  FAQ is built from facts only, and fallbacks reuse facts ("Barbershop in Lipa").
- The template is the owner's pick (`templateId`), else the stored one, else
  `resolveHeroStyle` / `autoTemplateFor` — the same function the builder uses. A coverage
  report (which text fields that template binds are still empty) is stored on the run.

### Step 3 — polishing the photos
- Shot type from the owner-app label or the positional role: portrait, action, interior,
  exterior, detail, sign. **Signs and price lists are never sent** (generated text garbles).
- References: the owner reference = first portrait, the location reference = first interior
  (else the exterior). People shots send `[shot, owner ref, location ref]`; rooms and details
  send `[shot, location ref]`.
- One prompt per shot type (`lib/aiPipeline/photos.ts`), each ending with the same rule:
  *same person, same room, new camera position and light; bright, friendly, commercial,
  realistic; never dark / cinematic / moody / orange; never a filter on the same frame; add or
  remove nothing.*
- At most `AI_PIPELINE_MAX_POLISHED_PHOTOS` (default 6) per site, three at a time.
- **Quality check** (`lib/aiPipeline/qc.ts`): byte checks (real JPEG/PNG/WebP, ≥ 30 KB,
  short side ≥ 720 px, sane aspect, not identical to the input), then a Gemini vision check of
  original vs result (same person, same place, new camera position, bright and natural,
  realistic, no artifacts, score ≥ 7). **Fail-closed:** no verdict keeps the original.
- Passing images are copied into Convex storage (Higgsfield keeps files ~7 days). If at least
  one photo passed, the builder gets placement keys (`enhanced_hero` = shop front,
  `enhanced_portrait`, `enhanced_gallery_N`; failed shots placed as originals). If none passed,
  nothing is written and the builder uses the submission photos exactly as today.
- **Keep originals:** `submissions.keepOriginalPhotos === true` (or polishing off) skips the step.

### Step 4 — building the site (existing path, not a fork)
- `persist.prepareBuild` writes the content and photos onto the submission's
  `generatedWebsites` row (refuses to overwrite a built or published site unless `force`).
- Convex calls `POST /api/internal/ai-pipeline-build` (secret `INTERNAL_API_SECRET`), which runs
  the **existing** `/api/generate-website` handler: same content assembly, testimonial guard,
  template resolution, image placement and Astro build. Two pipeline-only differences in that
  handler: it never asks Groq to fill gaps (no invented facts), and it returns the build instead
  of writing it (its writes are admin-gated).
- `persist.saveBuiltSite` stores the HTML blob and writes the same two rows with the same
  writers the admin path uses (`upsertGeneratedWebsiteRow`, `upsertWebsiteContentRow`).
  Preview: the existing preview routes, or `ownerApp.getPreview` on the owner branch.

---

## 2. Files

| Where | What |
|---|---|
| `lib/aiPipeline/*.ts` | Pure: types, config, facts, copy, field mapping, photos, QC, state machine, step runner, costs, internal auth |
| `convex/aiPipeline/orchestrator.ts` | Run state: start / adminStart / getForSubmission, step bookkeeping, failure → Studio |
| `convex/aiPipeline/steps.ts` | Node actions: `runStep`, `checkTimeout`; real providers wired into the runner |
| `convex/aiPipeline/providers.ts` | Gemini (key pool) / Groq JSON, Gemini vision, Higgsfield client |
| `convex/aiPipeline/persist.ts` | `prepareBuild`, `saveBuiltSite` |
| `convex/aiPipeline/progress.ts` | **The one progress function** (`reportBuildStep`) |
| `app/api/internal/ai-pipeline-build/route.ts` | Secret-gated hop into the generate-website handler |
| `lib/websiteContentFields.ts` | The websiteContent row mapping, moved out of the route so both paths share it |
| `convex/schema.ts` | New table `aiPipelineRuns` (at the end, additive) |

Small hooks in existing files: `hyperagent.triggerStudioRender` (the switch, `viaStudio`
arg), `generate-website/route.ts` (secret path, generator gates, early return),
`generatedWebsites.ts` / `websiteContent.ts` (row writers exported without the admin check),
`transcription.ts` (`transcribeFrom` exported), `next.config.ts` (Astro files traced for the
new route).

Also fixed on the way: `/api/generate-website` called the admin-gated
`websiteContent.upsert` **without** `{ token }` (the token had landed inside a comment in
318a676), so an admin Generate threw "Not authenticated" after storing the HTML.

---

## 3. Env vars

Convex deployment unless noted. Copy from `.env.example`.

| Var | Default | Notes |
|---|---|---|
| `AI_PIPELINE_ENABLED` | off | The switch for automatic triggers |
| `AI_PIPELINE_STUDIO_FALLBACK` | on | `false` = a failed run just stops (admin builds by hand) |
| `AI_PIPELINE_TIMEOUT_MINUTES` | 30 | Overall deadline |
| `AI_PIPELINE_MAX_POLISHED_PHOTOS` | 6 | Cost cap |
| `AI_PIPELINE_LLM_ORDER` | `gemini,groq` | Text LLM preference |
| `AI_PIPELINE_GEMINI_MODELS` | KB chain | Else `GEMINI_GENERATION_MODELS`, else the knowledge-base default chain |
| `AI_PIPELINE_IMAGE_TIMEOUT_MS` | 150000 | Per image |
| `HIGGSFIELD_API_KEY` | — | `KEY_ID:KEY_SECRET` (or `HIGGSFIELD_API_KEY_ID` + `_SECRET`) |
| `HIGGSFIELD_IMAGE_ENDPOINT` | — | **Required for polishing.** See §5 |
| `HIGGSFIELD_IMAGE_PARAMS` | `{}` | JSON merged into each request (e.g. resolution 1K) |
| `HIGGSFIELD_API_BASE` | `https://api.higgsfield.ai` | |
| `AI_PIPELINE_COST_*` | list prices | Only for the cost estimate |

Reused, already set: `GROQ_API_KEY`, `GROQ_TEXT_MODEL`, the Gemini BYOK pool (`aiKeys`,
`KEY_ENCRYPTION_SECRET`) or `GEMINI_API_KEY`, `R2_PUBLIC_URL`, `INTERNAL_API_SECRET`
(**same value on Convex and Vercel**), `NEXT_PUBLIC_APP_URL` / `SITE_URL` on Convex
(where Convex reaches the Next app).

---

## 4. Cost per site (estimate, 2026-10-21 list prices)

| Part | Basis | USD |
|---|---|---|
| Transcription | Groq whisper-large-v3 $0.111 / audio hour × 10 min interview | ≈ 0.02 |
| Text LLM | facts + copy ≈ 20 K in / 3 K out tokens | ≈ 0.01 (free on the BYOK Gemini pool) |
| Vision QC | 6 checks × ≈ 2.5 K in / 0.2 K out | ≈ 0.01 (free on the pool) |
| Photos | Higgsfield ≈ $0.10 per image at 1K (their blog: 2 credits) × 6 | ≈ 0.60 |
| **Total** | | **≈ $0.65 (≈ ₱38) per site**; ≈ $0.04 with polishing off |

Failed or moderated Higgsfield jobs are not charged (their docs). Confirm the image price for
the chosen endpoint with `POST /estimate/{endpoint id}` before turning polishing on. The run
row keeps usage counters and `getForSubmission` returns the estimate.

Time budget (typical): transcription 1–3 min, facts + copy ≈ 1 min, photos 3–7 min,
build 1–2 min → **≈ 7–13 minutes**, inside the 20-minute promise; hard stop at 30.

---

## 5. Turning it on

1. **Higgsfield endpoint.** docs.higgsfield.ai (checked 2026-10-21) documents the platform
   contract we implement — `POST {base}/{endpoint id}` with a flat JSON body
   (`prompt`, `image_urls`), `Authorization: Key id:secret`, poll
   `GET /requests/{id}/status` (`queued | in_progress | completed | failed | nsfw | canceled`),
   result at `images[0].url` — but its public model list has **no Nano Banana entry** (the CLI
   has `nano_banana_2`, `nano_banana_flash`, `nano_banana`). Theo: in console.higgsfield.ai,
   find the Nano Banana 2.1 **image-edit / reference** endpoint id, check it takes
   `image_urls` (up to 3) and which body fields set 1K resolution, then set
   `HIGGSFIELD_IMAGE_ENDPOINT` and `HIGGSFIELD_IMAGE_PARAMS`. Until then polishing is off and
   originals are used — the rest of the pipeline works.
2. Set the env vars (§3) on Convex; `INTERNAL_API_SECRET` must match Vercel.
3. Deploy (Vercel + `npx convex deploy`; the new table is additive).
4. **Try one submission with the switch still off:**
   `npx convex run aiPipeline/orchestrator:start '{"submissionId":"<id>","reason":"admin","force":true}'`
   (admins can also call `api.aiPipeline.orchestrator.adminStart`). Watch the
   `aiPipelineRuns` row in the dashboard (steps, reports, photos, usage), then open the draft
   in `/admin/submissions/<id>`.
5. When happy: `npx convex env set AI_PIPELINE_ENABLED true`. To roll back: unset it.

---

## 6. Integration with feat/v2-backend-owners (`// INTEGRATE:` notes)

- `convex/aiPipeline/progress.ts` — replace the dynamic `buildProgress.setStep` reference with
  the typed call. Until merged, the call is caught and logged; progress is kept on the run row.
- `buildProgress.startPipeline` (owner app) — make its body
  `await ctx.runMutation(internal.aiPipeline.orchestrator.start, { submissionId, reason: 'owner_app' })`.
- Rebuild after a change request or style change: `buildProgress.restart`, then
  `start({ submissionId, reason: 'rebuild', force: true })` (polished photos are reused).
- `steps.ts customizationsFor` passes `fontChoice` / `colorChoice` as the builder's
  `fontPairing` / `colorScheme` ids; confirm the vocabularies match.

---

## 7. Failure modes

| What | What happens |
|---|---|
| Switch off | Nothing changes; Studio as today |
| No interview at all | Step 1 fails permanently → Studio fallback, admin queue |
| Recording still transcribing | Step 1 waits (30 s steps) until the deadline |
| Whisper fails | transcribeMedia marks the submission `failed`; step 1 continues with typed answers, or fails if there are none |
| Gemini pool exhausted / no key | Groq takes the text calls; vision QC unavailable → originals kept |
| LLM returns junk | Validators coerce to the empty shape; empty facts still build a page from the form values |
| Higgsfield key/endpoint missing | Polishing off, originals used |
| Higgsfield busy (400 "concurrent") / 5xx | Resubmitted with backoff; then that photo keeps its original |
| Result fails QC / nsfw / times out | That photo keeps its original |
| Site already built or published | Run stops (`canceled`), no fallback, nothing overwritten (use `force`) |
| Builder 401 (secret mismatch) / 404 / 409 | Permanent → Studio fallback; check `INTERNAL_API_SECRET` and `NEXT_PUBLIC_APP_URL` |
| Builder 5xx / timeout | Retried 3× → Studio fallback |
| Overall deadline | `checkTimeout` fails the run → Studio fallback; a late build result is discarded |
| Submission rejected / deleted mid-run | Builder refuses / step fails → run stops |

In every failure the submission's status is untouched, so it stays in the admin review
queue; the run row says which step failed and why (`getForSubmission`).

Known limits: an admin "Generate" after a pipeline build re-runs the route's own Groq
extraction when the services list is short (existing behaviour); the admin page does not
show pipeline runs yet (no UI was touched — read `getForSubmission` or the dashboard).
