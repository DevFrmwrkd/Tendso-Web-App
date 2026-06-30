# Tendso Studio - Hyperagent skill

The image + copy engine for Tendso, packaged as a [Hyperagent](https://hyperagent.com) skill.
A creator submits photos + an interview; the agent renders **faithful website images**
(image-to-image, never altering the original) and writes **structured copy**, then writes
the result straight into Convex `generatedWebsites`. It **replaces the Airtable AI step**.
It does **not** build websites - Tendso's templates do that.

Read `ARCHITECTURE.md` for the full design, token strategy, and cost math.

## What's here

```
ARCHITECTURE.md            full design doc (flow, tokens, cost, faithfulness, feedback loop)
skill/
  SKILL.md                 the skill (human-readable source of truth)
  references/*.md          role map, baked edit recipes, copy contract, token budget, feedback protocol
  scripts/*.py             prepare_inputs, build_edit_prompt, build_payload, push_to_convex, post_feedback
build_skill_json.py        packages skill/ -> the importable Hyperagent JSON
tendso-studio.skill.json   <- import THIS into Hyperagent (generated; re-run the packager after edits)
convex/
  hyperagent.ts            trigger + ingest + save (copy into your convex/)
  http.additions.ts        the /hyperagent-callback route (paste into convex/http.ts)
  submit.patch.md          the one-line swap in submissions.ts
  env.example              required Convex env vars
```

## Deploy - Hyperagent side

1. **Create an agent** named "Tendso Studio".
2. **Tools & Integrations:** enable **Image Generation**, **Code Execution (Bash)**, **File Management**, and your **Slack** integration.
3. **Import the skill:** import `tendso-studio.skill.json`. Pin it (so it's always available) or leave it discoverable.
4. **Credentials** (Skills -> tendso-studio -> Credentials): set
   - `CONVEX_CALLBACK_URL` = `https://<your-deployment>.convex.site/hyperagent-callback`
   - `TENDSO_CALLBACK_SECRET` = a long random string (same value you set in Convex)
   - `SLACK_WEBHOOK_URL` = an incoming-webhook for `#tendso-studio` (optional)
5. **Trigger:** add a **Webhook/API** trigger. Copy its **URL** and **token** - they go into Convex next. Confirm the body field your webhook expects for the first turn (`message` / `prompt` / `input`) and, if it isn't `message`, adjust the one line in `convex/hyperagent.ts` noted in a comment.

## Deploy - Convex side

1. Copy `convex/hyperagent.ts` into your `convex/` folder.
2. Paste the route from `convex/http.additions.ts` into `convex/http.ts` (before `export default http;`).
3. Apply the one-line swap in `convex/submissions.ts` (see `convex/submit.patch.md`).
4. Set env vars (`convex/env.example`): `HYPERAGENT_WEBHOOK_URL`, `HYPERAGENT_WEBHOOK_TOKEN`, `TENDSO_CALLBACK_SECRET` (matching the skill).
5. `npx convex deploy` (or your normal deploy).

## Test the loop

1. Submit a test business in the app (>=3 photos + a short interview).
2. Watch the agent thread in Hyperagent: it runs `prepare_inputs` -> renders each slot at 1K -> writes copy -> `push_to_convex`.
3. In Convex, confirm `generatedWebsites` for that submission has copy fields + `enhancedImages`, and `airtableSyncStatus = 'synced'`.
4. First runs may post a Slack card or two as recipes fill in (e.g., a new business type). Answer in Slack; the agent saves it as a Memory + adds it to the "Studio Recipes" doc, and won't ask again.

## Editing the skill

Edit files under `skill/`, then re-run the packager:

```bash
cd tendso/hyperagent
python3 build_skill_json.py        # regenerates tendso-studio.skill.json
```

Re-import the JSON in Hyperagent (or forking/update per their UI). The skill is built so a future switch from the built-in image tool to a Kie.ai/fal.ai script is a localized change to one script + the Step 3 call in `SKILL.md`.

## Cost (typical)

~6 images @ 1K (Gemini Flash) ~ **$0.40** + copy ~ **<$0.02** ~ **~$0.42 / submission**.
Resolution is the big lever: 1K vs 4K is roughly $0.40 vs $0.90 per submission. Keep it at 1K unless a slot truly needs more.
