# Token & cost budget

The skill is cost-sensitive by design. When you're unsure whether an action is worth it, this is the rule set. The dominant cost is **image generation**, so protect that first.

## The three sinks

### 1. Vision (looking at images)

- Look at **thumbnails only** (`prepare_inputs.py` makes ~320px versions). Never load a full-res photo into your context.
- Hand originals to the Image Generation tool **by URL** — the tool reads them server-side; they don't cost you context tokens.
- **Trust the index→role map.** Verify with a glance; don't classify from scratch. Re-examining every image in detail is the most common waste.

### 2. Thinking (reasoning)

- Roles, slots, recipes, caps = lookup tables. The only real decisions are: *combine the hero or not*, and *which copy fields the transcript supports*.
- Don't reason about layout, color, fonts, or the website. Out of scope — the template owns it.
- Don't re-plan between every render. Decide the slot list once (Step 2), then execute.

### 3. Generation (making images)

| Lever | Rule | Why |
|---|---|---|
| Resolution | **1K** always | 1K ≈ $0.067 vs 2K ≈ $0.10 (+51%) vs 4K ≈ $0.15 (+125%) on Gemini Flash. 1K is right for web/social. |
| Count | **1 image / slot** | No random seeds/variations (the only exception is the optional `_v2` gallery variant below). |
| Ceiling | **6 default, up to 12** | One per role (6); optionally a second `_v2` variant for the strongest gallery slots, up to 12. Over 12 → stop, post to Slack. |
| Combine | hero only, ≤ 2 inputs | Combines are for the one case in `image-roles.md`. |
| Retries | **1 reinforce, then skip** | Two faithfulness failures → skip + flag. Don't re-roll for "nicer". |

## Per-submission target

```
6 images × $0.067 (1K) ≈ $0.40
copy pass (~3–5k tok)  ≈ <$0.02
────────────────────────────────
≈ $0.42 / submission
```

If a submission would cost noticeably more than this (lots of retries, lots of combines), that's a signal something's wrong with the inputs — stop and post a Slack card rather than spending your way through it.

## Output discipline

- Image prompts come from `build_edit_prompt.py`; you add ≤1 line. Never write a long prompt.
- Copy is capped JSON, no prose.
- Your final message to Theo is one line: slots rendered, slots skipped, approximate cost.
