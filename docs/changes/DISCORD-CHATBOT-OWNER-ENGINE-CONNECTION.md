# Agent Prompt — Build the `/kb/search` endpoint in Tendso (Tendso)

Copy everything below the line into the coding agent working in the
**tendso** repo (the Convex app deployed as `energetic-panther-693`,
project "Tendso"). It is self-contained.

---

You are working in the **tendso** Convex app. Build ONE new,
production-grade, read-only HTTP endpoint that lets an external service
semantically search the existing `knowledgeArticles` knowledge base. Two other
bots (a Discord coach and an HR email responder, in a separate `owner-engine`
app) will call it to ground their answers. Do NOT change existing tables,
functions, or behavior — this is purely additive.

## Ground rules (industry standard — follow all)

1. **Discover before you build. Do not guess.** First READ the codebase to learn
   the real patterns, then match them:
   - `convex/schema.ts` — the exact `knowledgeArticles` shape: field names
     (`body`, `categoryId`, `keywords`, `embedding`, `helpfulYes`, `popular`,
     etc.), and how the **vector index** on `embedding` is declared
     (`vectorIndex("by_embedding", { vectorField: "embedding", dimensions: N }`).
     Note the exact `dimensions`.
   - How embeddings are GENERATED (search `knowledgeTrainingJobs`, any
     `embed`/`embedding` action, the model name + provider). **The query MUST be
     embedded with the exact same model and dimensions as the stored vectors, or
     search returns garbage.** This is the single most important detail.
   - The existing HTTP router (`convex/http.ts`) — copy its `httpAction` +
     routing + response conventions.
   - Any existing auth/secret pattern for machine callers. Reuse it; don't
     invent a new one.
   - The `knowledgeCategories` / `knowledgeFaqs` / `knowledgeQueries` tables —
     understand how articles relate to categories so your response can include a
     human-readable category/title.

2. **Least privilege.** Read-only. No mutations. Never expose internal ids,
   embeddings, or PII in the response — return only what a grounding LLM needs
   (title/category, body text, a score).

3. **Secure by default.** Gate the endpoint on a shared secret in an
   `x-kb-secret` header, compared against a NEW Convex env var (e.g.
   `KB_SEARCH_SECRET`). Reject missing/wrong secret with 401. Use a
   constant-time comparison if the codebase already has one; otherwise a plain
   equality check is acceptable for a shared secret. Do NOT log the secret.

4. **Robust + observable.** Validate input (non-empty query, sane `topK`
   bounds 1–10). Handle the embedding call failing (return 200 with empty
   `articles` + a clear `error` field rather than a 500 that breaks callers).
   Add minimal structured logging (query length, topK, hit count, latency) —
   never the raw query body if it may contain PII.

5. **Match the repo's stack + style.** Same language (TS), same lint rules, same
   error-response shape as existing endpoints. If the repo has tests, add one.

## The exact contract to implement

```
POST  /kb/search
Headers:
  Content-Type: application/json
  x-kb-secret: <value of KB_SEARCH_SECRET env>
Request body:
  { "query": string, "topK"?: number }   // topK default 5, clamp 1..10
Response 200:
  {
    "articles": [
      {
        "id": string,           // opaque article id (ok to return _id as string)
        "title": string,        // human title or category name for the article
        "category": string,     // from knowledgeCategories
        "body": string,         // the article text used for grounding
        "score": number         // cosine similarity 0..1 from vector search
      }
    ],
    "maxScore": number,         // score of the top hit (0 if none) — callers
                                // use this for their confidence gate
    "error": string | null      // null on success
  }
Response 401: { "error": "unauthorized" }   // missing/bad x-kb-secret
Response 400: { "error": "query required" } // empty/invalid input
```

## Implementation shape (adapt to the repo's real APIs)

1. `convex/http.ts` — add `http.route({ path: "/kb/search", method: "POST",
   handler: httpAction(...) })`. In the handler: check `x-kb-secret`, parse +
   validate body, then call an internal action that does the search, and return
   the JSON above.
2. New internal action `convex/kb.ts::_semanticSearch({ query, topK })`:
   - Embed `query` using the SAME model/provider/dimensions the stored
     `embedding` vectors use (reuse the existing embed helper if there is one).
   - `const results = await ctx.vectorSearch("knowledgeArticles",
       "<the real vector index name>", { vector: queryEmbedding, limit: topK })`.
   - For each result: load the article, resolve its category
     (`knowledgeCategories`), map to the response shape, carry `result._score`.
   - Return `{ articles, maxScore: articles[0]?.score ?? 0, error: null }`.
   - Wrap the embed call in try/catch → on failure return
     `{ articles: [], maxScore: 0, error: "embed_failed" }`.
3. Set the env var on the deployment:
   `npx convex env set KB_SEARCH_SECRET <same secret owner-engine will use>`.
   (Coordinate the value with whoever owns owner-engine's
   `TENDSO_KB_SECRET`.)

## Guardrails / do-nots
- Do NOT modify `knowledgeArticles` or any existing table/schema.
- Do NOT add write operations.
- Do NOT deploy anything unrelated; this is one endpoint + one internal action +
  one env var.
- Do NOT hardcode the secret in code — env var only.
- Do NOT return the raw `embedding` array or internal PII fields.

## Definition of done
- `POST /kb/search` with the right secret returns real, relevance-ranked
  articles for a Tendso question (e.g. "how do agents get paid?"); wrong/missing
  secret returns 401; empty query returns 400.
- The embedding model used for the query provably matches the stored vectors
  (spot-check: a known article ranks #1 for its own question).
- No existing functionality changed. Lint/typecheck/tests pass.
- Tell the owner-engine side: the deployment URL
  (`https://energetic-panther-693.convex.site/kb/search`) and confirm the secret
  is set — that's all they need to wire the bots.
```
