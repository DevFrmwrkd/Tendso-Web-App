# Plan: Admin "Train the AI" page — feed Q&A into the Knowledge Base RAG

**Date:** 2026-06-19
**Status:** BUILDING — simplified per client: **admin pastes only the questions; the AI writes the answers itself**, then embeds them.
**Goal:** an admin page where staff paste a set of **questions** (no answers). The AI drafts a grounded answer for each from the existing knowledge base, saves each as an embedded Q&A article, and flags any it couldn't confidently answer. Both the `/knowledge` chatbot and Discord `/ask` then know those questions.

> **Refinement (2026-06-19):** the admin does NOT write answers. Paste questions → the AI generates answers (via the existing `runRag` grounding) → saved + embedded. The admin only reviews/edits the ones the AI couldn't ground.

---

## How the AI actually works today (verified against the code)

This is the load-bearing fact that shapes the whole design:

- Both the web (`knowledgeAI.ask`) and Discord (`knowledgeAI.answerQuery`) paths funnel into **one** function, `runRag`.
- `runRag` answers by **vector-searching `knowledgeArticles` only** — `ctx.vectorSearch('knowledgeArticles', 'by_embedding', …)` (`knowledgeAI.ts:257`). It embeds the user's question, finds the closest articles by their 768-dim Gemini embedding, and grounds the answer in those.
- `knowledgeArticles` rows carry an `embedding` field; `generateEmbeddingForArticle` / `backfillEmbeddings` populate it from the article text.
- A `knowledgeFaqs` table exists **but the RAG never searches it** — FAQs are display-only on `/knowledge`, invisible to the AI.
- `knowledgeQueries` already **logs every question asked** (web/discord/chatbot) — a ready-made source of "questions people actually ask."

**Implication — the simplest correct design:** don't build a separate "AI training" store. Make each admin-entered Q&A a **real `knowledgeArticles` row that gets embedded**, so the existing RAG retrieves it with zero changes to `runRag`. "Training the AI" = "adding embedded Q&A articles." That's the industry-standard pattern (RAG knowledge ingestion), and it reuses everything already built.

---

## The design (simple, reuses the pipeline)

### What the admin does
A new page **`/admin/knowledge`** (or `/admin/train-ai`) with one primary action: **add a batch of Q&A pairs.** Each pair is:

```
Question:  "How do I get paid as a creator?"
Answer:    "You keep 50% of every sale, sent to your Wise wallet within 24 hours of the business paying."
Workspace: help (public KB + chatbot)  |  wiki (internal field-agent)
Category:  (pick existing, or "General")
```

The admin can:
- **Add Q&A pairs** one at a time, or paste several at once (a simple repeater / "+ Add another" list).
- **See pending vs. embedded status** — a Q&A is "live to the AI" only once its embedding is generated.
- **Pull from real questions** — a side panel of recent `knowledgeQueries` (what people actually asked the AI), especially the ones that came back **ungrounded** (the AI couldn't answer). One click turns an unanswered question into a draft Q&A to fill in. *This is the highest-value loop:* the AI tells you what it doesn't know, you teach it.

### What happens under the hood (each Q&A → an embedded article)
1. Admin submits a Q&A → a new `knowledgeArticles` row is created:
   - `title` = the question,
   - `body` = a single `kbBlock` paragraph (the answer) — `body` is the typed-block array the schema already uses,
   - `summary` = the answer (the answer-first lead the RAG/AI likes),
   - `workspace`, `categoryId`, `status: 'published'`, `author: 'admin'`,
   - `source: 'qa'` (a NEW optional field to mark these as admin-trained Q&A vs. full articles — purely for filtering/admin display; the RAG doesn't care).
2. **Embed it** — schedule `generateEmbeddingForArticle` for the new row (the action already exists). Once the 768-dim vector is written, the RAG can retrieve it. Both web and Discord immediately benefit — same `knowledgeArticles` index.
3. Done. No change to `runRag`, no new retrieval path, no new vector index.

### Why Q&A-as-article (not the `knowledgeFaqs` table)
`knowledgeFaqs` is display-only and **not embedded / not searched** by the AI. Routing training Q&A there would require teaching `runRag` to also vector-search FAQs — more code, a second index, two retrieval paths to keep in sync. Making them articles means the thing that's *already* the AI's knowledge source grows. (Optional nicety: these Q&A articles can be hidden from the human-facing `/knowledge` article list via the `source: 'qa'` flag if you don't want them cluttering the help center — they still feed the AI.)

---

## What to build

### Backend (`convex/knowledge.ts` + schema)
- **Schema:** add `source: v.optional(v.string())` to `knowledgeArticles` (values: `'article'` default | `'qa'`). Additive, no migration. (Reuses existing `embedding`, `status`, `workspace`, `categoryId`.)
- **`addTrainingQA` mutation** (admin-gated): takes `{ question, answer, workspace, categoryId? }`, creates the published `knowledgeArticles` row (`source: 'qa'`), then schedules `generateEmbeddingForArticle`. Returns the new id + `embedded: false`.
- **`addTrainingQABatch` mutation** (admin-gated): same for an array — one round-trip for "paste several."
- **`listTrainingQA` query** (admin-gated): the Q&A rows (`source === 'qa'`) with their embedded status (embedding present?), for the admin list.
- **`listUnansweredQueries` query** (admin-gated): recent `knowledgeQueries` where `grounded === false` (the AI couldn't answer) — the "teach me this" feed. (Confirm `knowledgeQueries` stores a grounded/answered flag; if not, add one — it's cheap and already logged.)
- **`deleteTrainingQA`** (admin-gated): remove a Q&A article (with its embedding).

### Frontend (`app/admin/knowledge/page.tsx`)
- Admin-gated (mirror the existing `/admin` role check / `AdminLayout`).
- **Add-Q&A form:** question + answer + workspace toggle (help/wiki) + category select; "+ Add another" repeater for batch entry; Save.
- **Trained Q&A list:** question, answer preview, workspace, **embedded ✓ / embedding… ⏳** status, delete.
- **"Questions people asked" panel:** recent `knowledgeQueries` (filterable to ungrounded). Each has a "Turn into Q&A" button that pre-fills the form with the question.
- Add a **"Knowledge / Train AI"** link to the admin nav (`AdminLayout`).

### Nav + glue
- One `AdminLayout` nav entry. No change to `runRag`, the Discord webhook, or the web chatbot — they keep reading the same `knowledgeArticles` index, now with more entries.

---

## The learning loop (why this is more than a form)

```
People ask the AI (web + Discord)
        │  every question logged → knowledgeQueries (grounded: true/false)
        ▼
Admin opens /admin/knowledge → sees what the AI COULDN'T answer (grounded:false)
        │  one click → "Turn into Q&A" → fills the answer
        ▼
addTrainingQA → new knowledgeArticles row → embedded (Gemini 768-dim)
        ▼
runRag now retrieves it → web KB, chatbot, AND Discord /ask can answer it
        ▼
(loop tightens: the gaps the AI reveals become the next batch of training)
```

This is the industry pattern for keeping a RAG assistant current: **mine the unanswered queries, author answers, re-embed.** It's a closed loop, not a one-time data dump.

---

## Decisions / open questions for you

1. **Q&A visibility on the public `/knowledge` page** — should admin-trained Q&A also show as articles in the human-facing help center, or feed the AI *only* (hidden via `source: 'qa'`)? **Recommend: feed the AI only by default**, with an optional "also show publicly" toggle per Q&A — keeps the help center curated while the AI learns broadly.
2. **Embedding cost/timing** — each Q&A embed is one Gemini call (uses the BYOK key pool). Batch of 20 = 20 calls, well within free quota. Embeds run async (scheduled), so the admin isn't blocked. OK?
3. **Auto-FAQ from the answer?** Out of scope here — there's a separate plan to auto-generate `faqs[]` per article. This page is the *manual* "teach the AI" path, which is what you asked for.
4. **Who can train** — gated to the existing admin role (same as the pricing page). Confirm no separate sub-role needed.
5. **Wiki vs help** — a Q&A tagged `wiki` only answers for signed-in field agents (the RAG already gates wiki). Confirm admins choose per Q&A (the form has the toggle).

---

## Effort
- Schema field + 4–5 admin Convex functions: **S–M** (they wrap the existing `upsertArticle` + `generateEmbeddingForArticle`).
- Admin page (form + list + unanswered-queries panel): **M**.
- Zero change to the RAG/Discord/chatbot retrieval — that's the point.

**Recommended slice:** (A) schema `source` field + `addTrainingQA`/`addTrainingQABatch` + `listTrainingQA` + the admin form/list → working "feed the AI" path. (B) the `knowledgeQueries` "unanswered → Q&A" panel → the learning loop. Ship A first; it's the core ask.
