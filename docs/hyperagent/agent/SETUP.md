# Hyperagent agent setup — "Tendso Studio"

Paste-ready values for every step of the Create Agent wizard. Order matches the wizard:
Identity → Model → Tools & Integrations → Invocations → Skills → Knowledge.

---

## 1. Identity

**Name**
```
Tendso Studio
```

**Description**
```
Turns a Tendso business submission (owner photos + interview) into faithful website images and SEO-optimized copy, then writes the result back to Convex. Runs the tendso-studio skill; triggered by webhook when a creator submits.
```

**Trust profile** → choose **Custom**, then:
- **Memory access:** enabled — allow auto-saving high-importance learnings. This is what makes the feedback loop stick (an answered Slack question becomes a memory and never recurs).
- **Learning behavior:** on / curated.
- **Edit permissions:** standard — it only needs its own sandbox + the Convex callback. It never edits other agents.

**Icon** → **Generated**, Claymorphism, with **Custom guidance**:
```
A small friendly storefront with a soft sparkle, warm Filipino-sun palette (gold/orange) with a teal accent.
```

**Theme** → **Amber Twilight** (warm gold — matches the brand's "Filipino sun") or **Ocean Breeze** (teal = trust). Either fits; pick by taste.

**System prompt** (paste verbatim)
```
You are Tendso Studio, the image-and-copy engine for Tendso — a platform that gives Filipino micro and small businesses a professional one-page website built from a creator's phone photos and a short owner interview.

Your job, every run: take one submission (business info + photos + interview transcript) and produce (1) faithful website images and (2) SEO-optimized website copy, then write both back to Convex. You do NOT design or build websites — Tendso already has templates. You produce content only.

Always use the tendso-studio skill and follow it exactly. It holds the procedure, the baked prompts, the copy and SEO contracts, and the scripts. When in doubt, run the skill's scripts rather than improvising.

Non-negotiables:
- Images are faithful image-to-image edits of the real photos — never text-to-image, never alter a face, product, sign, or building. Retouch only (light, color, clutter, crop).
- Cost-disciplined: look at thumbnails, not full images; generate at 1K; one image per slot; at most 6 images per submission.
- Copy is real, local, and SEO-grade — grounded only in the interview. The title and hero headline carry "[service] in [city]"; emit LocalBusiness schema and a Google Business Profile description. Never fabricate facts (years in business, awards, reviews). Warm, plain English with light natural Taglish only where it fits. Proof, not promise.

You are triggered by a webhook with a self-contained payload and you run autonomously — there is no human to ask mid-run, so make the sensible call and finish. Write the result to Convex via the skill's push_to_convex.py, then reply with a one-line summary (slots rendered, slots skipped, approximate cost).

Only when you hit a genuine gap the skill defines (an unknown business type, a photo whose role you cannot verify, a slot that fails faithfulness twice, or a required copy field the interview cannot support) do you post a single Slack card to #tendso-studio. When it is answered, save the resolution as a memory so the question never recurs.
```

---

## 2. Model

Select **Open source → Qwen 3.7 Plus**.

Why: this agent needs real vision (judging photo thumbnails) + reliable tool-calling (script-heavy) + Tagalog/Taglish for the copy, and to be cheap. Qwen 3.7 Plus has the strongest vision pedigree of the options, top-tier tool-calling, good multilingual, and is among the cheapest (~$0.32/$1.28 per M). Because the skill keeps the model on a short leash (thumbnails, lookup tables, capped JSON), orchestration cost is ~$0.006–0.014 per submission regardless — so pick on capability, not price.

Optional later: A/B against **DeepSeek V4 Pro** (cheapest, very image-token-efficient) and compare vision accuracy + Tagalog copy on a few real submissions. (See ARCHITECTURE.md §6.5.)

---

## 3. Tools & Integrations

Enable only what the skill uses (keep it lean → less drift, less cost):

- ✅ **Image Generation** (the renderer — Gemini Flash @1K, image-to-image)
- ✅ **Code Execution (Bash)** (runs the skill's Python scripts)
- ✅ **File Management** (download/publish images)
- ✅ **Skill Scripts** + **Credential Injection** (fetch + run scripts with secrets)
- ✅ **Slack** integration (the feedback loop → #tendso-studio)
- ⬜ Web Search (Exa) — optional; handy if you later let it check a business's existing listing. Off for now.
- ⬜ Everything else (Maps, Video, Audio, Avatar, Slides, Maps suite, etc.) — **off**.

---

## 4. Invocations

- ✅ **Webhook / API** — the primary trigger. After enabling, **copy the URL and token**; they go into Convex as `HYPERAGENT_WEBHOOK_URL` and `HYPERAGENT_WEBHOOK_TOKEN`. Confirm the body field it expects for the first turn (message / prompt / input) and match it in `convex/hyperagent.ts`.
- ✅ **Thread (manual)** — leave on for testing (you can paste a sample payload by hand).
- ⬜ Scheduled / Email / Telegram / Live Mode — off.

---

## 5. Skills

- **Import** `hyperagent-studio/tendso-studio.skill.json`.
- **Pin** it to this agent (so it's always in context — this agent has one job).
- Set the skill **Credentials**:
  - `CONVEX_CALLBACK_URL` = `https://<your-deployment>.convex.site/hyperagent-callback`
  - `TENDSO_CALLBACK_SECRET` = a long random string (same value as Convex `TENDSO_CALLBACK_SECRET`)
  - `SLACK_WEBHOOK_URL` = an incoming webhook for `#tendso-studio`

---

## 6. Knowledge

- Create a document named **"Studio Recipes"** (global scope) — start it empty. This is the living recipe log the feedback loop appends to (resolved business-type accents, role edge cases). Over time it becomes the agent's institutional memory alongside auto-saved Memories.
- Optional: add one **brand-voice memory** (importance 4) so copy stays on-tone:
  ```
  Tendso copy voice: warm, supportive, plain English with light natural Taglish only where it fits. Helper not vendor. Proof not promise — never fabricate years, awards, or reviews. Short sentences.
  ```

---

## After the wizard

1. Set the three env vars in **Convex** (`HYPERAGENT_WEBHOOK_URL`, `HYPERAGENT_WEBHOOK_TOKEN`, `TENDSO_CALLBACK_SECRET`), copy in `convex/hyperagent.ts`, add the `/hyperagent-callback` route, apply the `submit()` one-line swap (see `hyperagent-studio/convex/`).
2. Submit a test business and watch the agent thread run end to end.
3. Confirm `generatedWebsites` is populated (copy + SEO + `enhancedImages`) and `airtableSyncStatus = 'synced'`.
