# Token & cost budget

Cost-aware, but the GOAL wins: spend the budget on a varied, beautiful SET - not on 6 identical
edits or 12 padded weak ones. The dominant cost is image generation, so protect that first.

## The three sinks

### 1. Vision (looking at images)

- Plan from the **~320px thumbnails** (`prepare_inputs.py`). Never load full-res photos into your
  context. Hand the originals to the Image Generation tool by URL.
- The thumbnail pass has real value now: you inventory the inputs by content and plan the shot
  list. That judgment is the point - just don't over-analyze each pixel.

### 2. Thinking (the shot list)

- The shot list IS the value (an art director's call). Make it deliberately, once, then execute.
- Don't reason about layout, fonts, or the website - the template owns that.
- Don't re-plan between every render. Decide the set in Step 2, then shoot it.

### 3. Generation (making images) - the main cost

| Lever | Rule | Why |
|---|---|---|
| Resolution | **1K** | 1K ~ $0.067 vs 2K ~ $0.10 (+51%) vs 4K ~ $0.15 (+125%). Right for web/social. |
| Set size | **6 default, up to 12** | A varied set. Go to 12 only when the business is photogenic and you can ground the shots. |
| No padding | distinct shots only | A second `_v2` of a STRONG shot beats a weak filler. No near-duplicates. |
| Ground truth | attach real photo(s) | Every render references the real business - cheaper than re-rolling drift. |
| Retries | **1 reinforce, then skip** | Two brand-truth failures -> skip + flag. Don't re-roll for "a bit nicer". |

### 4. Output discipline

- Image prompts come from `build_shot.py` (the proven scaffolds); you add at most one short
  `--hint`. Never freehand a long prompt.
- Copy + SEO are capped JSON, no prose.
- Your final message to Theo is one line: shots rendered, shots skipped, approx cost.

## Per-submission target

```
6 images x $0.067 (1K)  ~ $0.40   (a 12-shot set ~ $0.80)
copy + SEO pass         ~ <$0.02
-----------------------------------
~ $0.42 - $0.82 / submission
```

Against a paid submission this is rounding error - but stay deliberate: if a run balloons with
retries and re-rolls, something's wrong with the inputs. Stop and post a Slack card rather than
spending your way through it.
