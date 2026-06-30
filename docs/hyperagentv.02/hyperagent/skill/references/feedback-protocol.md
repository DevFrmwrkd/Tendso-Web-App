# Feedback & iteration protocol

The skill improves in the open. Instead of bloating `SKILL.md` with every edge case, you surface gaps to Slack and fold accepted answers back in as Memory + a living recipe doc. Keep it simple and repeatable.

## When to post a card

Post **one** card (not more) when you hit any of:

- **Unknown business type** - `build_edit_prompt.py` reported no accent for `--type`, so the recipe is generic.
- **Unverifiable role** - a thumbnail clearly doesn't match its index role and you're not sure what it is.
- **Faithfulness failure** - a slot failed twice and you skipped it.
- **Ungroundable required copy** - the transcript didn't support a required field and you had to leave it weak.

Don't post for normal, clean runs. Silence = success.

## The card (fixed format)

```bash
python3 scripts/post_feedback.py \
  --submission <submissionId> \
  --topic "unknown business type: pet grooming" \
  --did "rendered with the generic recipe, 1K, faithful" \
  --ask "what mood accent should 'pet grooming' use?" \
  --proposal "add type 'pet': 'clean, friendly, pet-care mood.'"
```

The card always carries: **submissionId**, **what you did** (so nothing is blocked waiting), **the open question**, and **a concrete proposed change**. A proposal Theo can approve in one word beats an open-ended question.

## Turning an answer into a permanent improvement

When Theo replies:

1. **Save a Memory** - importance **4-5**, category **domain knowledge**, scoped to this agent. Content = the rule, in the form the skill will reuse it (e.g., *"Studio recipe: business type 'pet' -> accent 'clean, friendly, pet-care mood.'"*). `whenToUse` = the trigger (e.g., *"rendering a pet grooming / pet business submission"*).
2. **Append to the "Studio Recipes" Document** - a living doc (global scope) with one section per resolved gap: date, submissionId, the rule. This is the human-readable history; the Memory is the machine-loaded version.
3. **Note it** for the next skill version bump (a line in the SKILL.md changelog and, if it's a recipe, in `edit-recipes.md` / the script).

Next run, importance-4-5 Memories load automatically and the doc is searchable - so the same question never recurs. The skill body stays lean; the knowledge still compounds.

## Why this shape

- **Slack** is where Theo already is - low friction, fast answers.
- **Memory** makes the fix automatic without editing the skill.
- **The doc** keeps an auditable trail and a place to batch real skill edits later.
- **One card, one proposal** keeps the loop from becoming noise.

## Optional: quality rubric

If render quality needs tracking over time, use Hyperagent's **Rubric Building** to define a "Studio render quality" rubric (faithful? well-lit? on-aspect? clutter removed?) and **Evaluation History** to spot weak business types. Not required for v1 - reach for it only if a pattern of complaints appears.
