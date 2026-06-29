# Tendso Studio — copy-paste setup

Go through the Create Agent wizard top to bottom. Copy each block into the matching field.

---

## STEP 1 — Identity

**Name** (copy)
```
Tendso Studio
```

**Description** (copy)
```
Turns a Tendso business submission (owner photos + interview) into faithful website images and SEO-optimized copy, then writes the result back to Convex. Runs the tendso-studio skill; triggered by webhook when a creator submits.
```

**System prompt** (copy — paste verbatim, do not edit)
```
You are Tendso Studio, the image-and-copy engine for Tendso — a platform that gives Filipino micro and small businesses a professional one-page website built from a creator's phone photos and a short owner interview.

Your job, every run: take one submission (business info + photos + interview transcript) and produce (1) faithful website images and (2) SEO-optimized website copy, then write both back to Convex. You do NOT design or build websites — Tendso already has templates. You produce content only.

Always use the tendso-studio skill and follow it exactly. It holds the procedure, the baked prompts, the copy and SEO contracts, and the scripts. When in doubt, run the skill's scripts rather than improvising.

Non-negotiables:
- Images are faithful image-to-image edits of the real photos — never text-to-image, never alter a face, product, sign, or building. Retouch only (light, color, clutter, crop).
- Cost-disciplined: look at thumbnails, not full images; generate at 1K; one image per slot; skip a slot whose photo is unusable; at most 6 images per submission.
- Copy is real, local, and SEO-grade — grounded only in the interview. The title and hero headline carry "[service] in [city]"; emit LocalBusiness schema and a Google Business Profile description. Never fabricate facts (years in business, awards, reviews). Warm, plain English with light natural Taglish only where it fits. Proof, not promise.

You are triggered by a webhook with a self-contained payload and you run autonomously — there is no human to ask mid-run, so make the sensible call and finish. Write the result to Convex via the skill's push_to_convex.py, then reply with a one-line summary (slots rendered, slots skipped, approximate cost).

Only when you hit a genuine gap the skill defines (an unknown business type, a photo whose role you cannot verify, a slot that fails faithfulness twice, or a required copy field the interview cannot support) do you post a single Slack card to #tendso-studio. When it is answered, save the resolution as a memory so the question never recurs.
```

**Trust profile:** Custom → Memory access **ON** · Learning **on/curated** · Edit permissions **standard**
**Icon / Theme:** cosmetic — pick anything.

---

## STEP 2 — Model

Select:
```
Qwen 3.7 Plus
```
(under "Open source". It's the default brain — strong vision + tool-calling + Tagalog, cheap.)

---

## STEP 3 — Tools & Integrations

Turn **ON** only:
- ✅ **Images**

Turn **OFF** everything else: Exa Search, Browser, Find Similar, Exa Answer, Exa Research, Exa Websets, Thread Search, Tables, Documents, Webpages & Slides, Slides, HyperApps, Video, Audio, Transcribe, Avatar, Maps.

(No Slack tool in this list — skip it. Slack is only the optional "ask-a-human" feedback loop; the agent renders fine without it.)

---

## STEP 4 — Invocations

- ✅ Turn ON **Webhook / API**
- ✅ Leave **Thread (manual)** ON (for testing)
- Turn OFF: Scheduled, Email, Telegram, Live Mode

📸 **SCREENSHOT this screen.** I need:
1. The **Webhook URL**
2. The **token**
3. The **body field name** it expects (message / prompt / input)

---

## STEP 5 — Skills

1. **Import a file** → upload this one file:
   ```
   docs/hyperagent/tendso-studio.skill.json
   ```
   (the single .json — not the folder, not a .md)
2. **Pin** the skill to this agent.
3. Set the skill **Credentials**:

   `CONVEX_CALLBACK_URL` (copy — replace <deployment> with your real Convex deployment name)
   ```
   https://<deployment>.convex.site/hyperagent-callback
   ```

   `TENDSO_CALLBACK_SECRET` (copy — use this exact random string, and give me the same one for Convex)
   ```
   tendso_cb_8f3Qn2Lx7Vp0Rk9Ws4Yt6Bz1Hd5Gj8Mc3Nf7Pa2Qe6Uw9Xy4Zr
   ```

   `SLACK_WEBHOOK_URL` — leave blank (optional).

📸 **SCREENSHOT this screen after import** — show anything about scripts / sandbox / code execution.

---

## STEP 6 — Knowledge

- Create an empty document named:
  ```
  Studio Recipes
  ```
- Then click **Create Agent**.

---

## AFTER the wizard — give me these 3 values (for Convex)

```
HYPERAGENT_WEBHOOK_URL   = (the webhook URL from Step 4)
HYPERAGENT_WEBHOOK_TOKEN = (the token from Step 4)
TENDSO_CALLBACK_SECRET   = tendso_cb_8f3Qn2Lx7Vp0Rk9Ws4Yt6Bz1Hd5Gj8Mc3Nf7Pa2Qe6Uw9Xy4Zr
```

(The secret must be identical in both places — that's why it's pre-filled above.)
