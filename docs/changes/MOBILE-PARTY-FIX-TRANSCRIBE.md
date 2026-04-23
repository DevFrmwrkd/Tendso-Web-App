# Mobile Transcription 404 — Web `transcribeMedia` Fix Plan — 2026-04-23

> **Resolved 2026-04-23 via Option A (§2.1).** Web repo's `convex/submissions.ts` `transcribeMedia` action has been rewritten to call Groq Whisper directly with chunking support for 500MB+ files. No more Next.js round-trip. Chunking helper copied from `lib/services/media-chunker.ts` into [`convex/lib/mediaChunker.ts`](../../convex/lib/mediaChunker.ts) so Convex bundles it (Convex module names can't contain hyphens — camelCase). See §6 for captured diagnostics and §7 for acceptance check-off.

> Third companion to [`MOBILE-PARITY.md`](./MOBILE-PARITY.md), [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md), and [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md). Read those first — this builds on the same shared-deployment failure mode.

## For the implementing agent

You are the agent. **You will be working in the web repo's `convex/` folder, not this mobile repo.** This plan file lives in the mobile repo (`ndm/docs/plans/`) so the human can hand it to you alongside the reference implementation; all paths starting with `convex/` below mean the **web repo's** `convex/` folder unless explicitly prefixed `ndm/`.

The bug: after Step 3 (Record Interview) on the mobile APK, transcription kicks off async and immediately fails with this server log:

```
[transcribeMedia] submissionId=jd766fm0k2t5sc0wyg2mrxq86x85dxk2:
  Transcription API returned 404: <!DOCTYPE html><!--nSxO_fbIwv80mxn0NUvF_-->
  <html lang="en"><head><meta charSet="utf-8">…<link rel="stylesheet"
  href="/_next/static/chunks/2473c16c0c2f6b5f.css" data-precedence="next">…
```

That HTML body is the Next.js 404 page. So whatever URL the deployed `transcribeMedia` action is calling, the Next.js web app at that origin doesn't have a route registered there.

---

## 1. Why this is happening

Per the inventory in [`MOBILE-PARITY.md` §`convex/submissions.ts`](./MOBILE-PARITY.md), the **web** team's version of `transcribeMedia` is documented as:

> `transcribeMedia(submissionId, storageId?, mediaType?)` — internalAction — Triggers transcription; **delegates to the Next.js `/api/transcribe` endpoint** so both platforms share one implementation.

That's the version currently running on production deployment `energetic-panther-693` (it has to be — the error string `"Transcription API returned 404"` is not present in the mobile repo's `transcribeMedia`, which calls Groq Whisper directly and would have thrown `"Groq API error 404: …"` instead).

So the deployed action is making an HTTP request to the Next.js web app's `/api/transcribe` route, and getting back the Next.js 404 page. That means **at least one** of the following is true on the web platform:

1. The `/api/transcribe` route handler does not exist in the Next.js app at all (never written, deleted, or the file was removed in a recent refactor).
2. The route exists but is at a different path (`/api/transcriptions`, `/api/transcribe/audio`, `/api/v1/transcribe`, etc.) and `transcribeMedia` is hardcoded to the wrong URL.
3. The route exists in the Next.js source but isn't deployed to the public URL `transcribeMedia` is calling — e.g., it's only in a feature branch, or the latest Vercel/Cloudflare deploy failed, or the URL points at a stale environment (preview vs prod).
4. The route exists and is deployed, but its method is not `POST` (or whatever method `transcribeMedia` uses), so Next.js returns 404 for the unmatched method.

Pick the right one with §3's diagnostics. Don't guess.

### 1.1 Why this can't be patched from the mobile side

Both apps share `energetic-panther-693`. The deployed `transcribeMedia` is whatever was last pushed by `npx convex deploy` — currently the web version. If mobile ran its own `npx convex deploy` from `ndm/`, it would replace `transcribeMedia` with the Groq-direct version and **also** replace every other web-only function in the same bundle (the inverse of [`MOBILE-PARITY.md`](./MOBILE-PARITY.md)'s breakage). That's a regression in the opposite direction. Don't do it.

→ **The fix has to land on the web side.** Two routes are open; pick one based on §3.

---

## 2. The two viable fixes

### 2.1 Option A — Make web's `transcribeMedia` self-contained (recommended)

Replace the web repo's `convex/submissions.ts` `transcribeMedia` action with the same Groq-direct implementation the mobile repo has. The mobile repo has a known-working version at [`ndm/convex/submissions.ts:390-594`](../../convex/submissions.ts#L390-L594) — copy it byte-for-byte (with the helper `callGroqWhisper` at lines 569-594, and the chunking helper imported from [`ndm/convex/lib/mediaChunker.ts`](../../convex/lib/mediaChunker.ts)).

**Why recommended:**

- Removes a network hop and removes a circular dependency (Convex action → Next.js HTTP route → Groq → back), which is fragile across env-var drift and cold-start latency.
- The mobile-side version is already battle-tested.
- One less thing the web Next.js deploy can break.
- Matches `MOBILE-PARITY.md`'s stated goal: "make web's `convex/` folder a strict superset of what mobile references." Having two divergent `transcribeMedia` implementations is itself a parity violation.

**Changes required on the web side:**

1. Replace the body of `transcribeMedia` in `convex/submissions.ts` with the Groq-direct version from the mobile repo's [`convex/submissions.ts:390-567`](../../convex/submissions.ts#L390-L567). Keep the export name and the arg validator shape (`submissionId`, `storageId`, `mediaType` — match whatever the deployed signature is so the existing scheduled-action callers don't break).
2. Add the `callGroqWhisper` private helper from the mobile repo's [`convex/submissions.ts:569-594`](../../convex/submissions.ts#L569-L594).
3. Copy [`ndm/convex/lib/mediaChunker.ts`](../../convex/lib/mediaChunker.ts) into the web repo's `convex/lib/` folder if it isn't already there (the chunked-file path needs it).
4. Set/verify the `GROQ_API_KEY` env var on `energetic-panther-693`:
   ```bash
   npx convex env get GROQ_API_KEY
   # If absent:
   npx convex env set GROQ_API_KEY <value>
   ```
5. **Do not** delete the existing Next.js `/api/transcribe` route file (if any) in the same PR — leave it for a follow-up cleanup. If something else still calls it, deleting it now causes a separate 404.

### 2.2 Option B — Add/fix the missing Next.js `/api/transcribe` route

If the web team has a strong reason to keep the round-trip architecture (e.g., they're doing custom auth, request shaping, or enrichment in the Next.js layer that mobile doesn't have access to), then instead of replacing `transcribeMedia`, fix the Next.js route.

**Changes required on the web side:**

1. Find what URL the deployed `transcribeMedia` is calling. Do this by reading the deployed source for the action. Either:
   - Open the web repo's `convex/submissions.ts` (the source of truth for what's deployed) and find the `fetch(...)` call inside `transcribeMedia`.
   - Or ask Convex to dump the deployed function source: `npx convex function-spec` (lists deployed functions) — note this doesn't show source bodies; the repo is the source of truth.
2. Locate the Next.js route file matching that URL (e.g., `app/api/transcribe/route.ts` for app-router or `pages/api/transcribe.ts` for pages-router).
3. If the file is missing → write it. The endpoint must accept the same body shape `transcribeMedia` sends (likely `{ submissionId, storageId, mediaType }` or similar) and forward to Groq. Use the mobile repo's [`callGroqWhisper`](../../convex/submissions.ts#L569-L594) as the canonical implementation reference.
4. If the file exists but the method is wrong → fix the export. App-router needs `export async function POST(...)` (case-sensitive). Pages-router needs `export default function handler(req, res)` with a `req.method === "POST"` check.
5. If the URL the action is calling points at the wrong host/env (e.g., pointing at a preview URL or `localhost`) → update the env var or constant the action uses, then redeploy Convex.
6. Confirm Groq env vars are present on whatever host serves the Next.js route (Vercel project env, Cloudflare Pages env, etc.). The Next.js route's `GROQ_API_KEY` is *separate* from the Convex deployment's `GROQ_API_KEY`.

**Why this is the second-choice option:**

- Two implementations to maintain.
- Two env-var surfaces to keep aligned.
- Network round-trip adds latency to every transcription.
- Mobile is calling a web-app endpoint just to reach Groq — Convex itself can reach Groq directly, so the indirection adds no value on the mobile path.

---

## 3. Diagnostic steps — run these first, in order

### 3.1 Confirm which deployment you're targeting

```bash
# In the web repo
npx convex env get CONVEX_DEPLOYMENT
```

Expect `prod:energetic-panther-693`. If different, stop — you're about to "fix" the wrong deployment.

### 3.2 Tail prod logs while reproducing

```bash
npx convex logs --prod --tail
```

On a test device or Expo dev build, record an audio interview and tap Next. You should see:

- The `submissions.update` mutation succeed (otherwise you're hitting [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md) instead — fix that first).
- `transcribeMedia` start.
- The 404 error string with the URL it's calling. **Capture the exact URL from the log.** That URL drives every step below — paste it into §6 of this doc before you do anything else.

If the URL ends in `/api/transcribe` exactly → §3.3.
If it ends in something else (`/api/transcriptions`, custom path) → §3.4.
If `GROQ_API_KEY` errors appear before the URL is even hit → §3.5.

### 3.3 Verify the Next.js route file

In the web repo:

- App-router: does `app/api/transcribe/route.ts` exist? Does it `export async function POST`?
- Pages-router: does `pages/api/transcribe.ts` exist? Does it default-export a handler that accepts `POST`?
- If neither file exists → the route was never created or was deleted. Go to **Option A (§2.1)** unless there's a hard reason to add the route.
- If the file exists but the wrong-shape export → fix the export (Option B, §2.2 step 4) and redeploy the Next.js app.

### 3.4 Verify the URL the action is hardcoded to

Open the web repo's `convex/submissions.ts`, find `transcribeMedia`, find the `fetch(...)` call, capture the URL or env-var template. Common gotchas:

- Hardcoded `http://localhost:3000/api/transcribe` — was committed during dev, never replaced. Fix: switch to an env var (`process.env.WEB_BASE_URL` or similar) and set it on the deployment via `npx convex env set`.
- Pointing at a Vercel preview URL that has since been torn down. Fix: same as above.
- Missing protocol or trailing slash mismatch. Fix: normalize.

If the URL is fine but the route still 404s → back to §3.3.

### 3.5 Verify Groq env vars on the Convex deployment

Whether you go Option A or Option B, the path that ultimately calls Groq needs `GROQ_API_KEY`:

```bash
npx convex env get GROQ_API_KEY
```

If absent, set it:

```bash
npx convex env set GROQ_API_KEY <value>
```

Get the value from the mobile team's `.env.local` or the Groq dashboard. Don't commit it.

For Option B, also set `GROQ_API_KEY` on the Next.js host (Vercel/Cloudflare project env), separately from the Convex env.

---

## 4. Implementation walkthrough — Option A (recommended)

Working in the **web repo**:

### 4.1 Copy the reference implementation

Open the mobile repo file [`ndm/convex/submissions.ts`](../../convex/submissions.ts) and copy these spans verbatim:

- Lines 390-567: the `transcribeMedia` `internalAction`.
- Lines 569-594: the `callGroqWhisper` helper at the bottom.

Paste them into the web repo's `convex/submissions.ts`, **replacing** the existing `transcribeMedia` definition (and any private helper it depended on for the Next.js round-trip).

Verify these imports already exist at the top of the web file (add them if missing):

```ts
import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { chunkMediaFile } from "./lib/mediaChunker";
import { getR2Config, generatePresignedUrl } from "./lib/r2Helpers";
```

### 4.2 Copy the chunker helper

If [`convex/lib/mediaChunker.ts`](../../convex/lib/mediaChunker.ts) doesn't already exist in the web repo, copy it from the mobile repo at [`ndm/convex/lib/mediaChunker.ts`](../../convex/lib/mediaChunker.ts). Don't refactor it; just drop it in.

### 4.3 Verify env vars

```bash
# In the web repo
npx convex env get GROQ_API_KEY      # must exist
npx convex env get R2_ACCOUNT_ID     # must exist (used to fetch the file before sending to Groq)
npx convex env get R2_ACCESS_KEY_ID
npx convex env get R2_SECRET_ACCESS_KEY
npx convex env get R2_PUBLIC_URL     # optional fallback
```

If `R2_*` are missing → that's the same gap covered by [`MOBILE-PARITY-FIX-R2.md §3.3`](./MOBILE-PARITY-FIX-R2.md). Fix that first (or in the same PR, your call).

### 4.4 Header-comment the function

Per the convention from [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) and [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md), add a header comment to `transcribeMedia` so a future cleanup doesn't re-introduce the indirection:

```ts
// transcribeMedia — mobile-referenced via scheduler from submissions.update.
// Calls Groq Whisper API directly. DO NOT replace with a Next.js round-trip
// (see docs/plans/MOBILE-PARITY-FIX-TRANSCRIBE.md for the incident that
// caused that pattern to fail in production on 2026-04-23).
```

### 4.5 Pre-deploy diff check

```bash
npx convex deploy --dry-run
```

The "functions to be deleted" section **must be empty**. If it lists any function from the mobile inventory in [`ndm/docs/01-mobile-app/00-Overview-Mobile.md §Convex Backend`](../01-mobile-app/00-Overview-Mobile.md), import it before deploying — same drill as the prior plans.

### 4.6 Deploy and verify

```bash
npx convex deploy
```

On a real device or dev build:

1. Record an audio interview, tap Next.
2. Watch `npx convex logs --prod --tail` — you should see `[Transcription] Starting…` then `[Transcription] Saved to database successfully!`.
3. Open the submission in the admin panel and confirm `transcript` is populated and `transcriptionStatus = "complete"`.

If transcription fails differently (e.g., `Groq API error 401` or `Failed to download file: HTTP 403`), the 404 problem is fixed but you've uncovered a separate env var or R2 permission issue — that's a follow-up, not a regression.

---

## 5. Implementation walkthrough — Option B (round-trip preserved)

Only choose this if there's an explicit reason to keep the Next.js layer in the path. Steps abbreviated since Option A is recommended:

1. Reproduce per §3.2, capture the exact URL the action calls.
2. Find or create the matching Next.js route file (§3.3).
3. The route handler should:
   - Validate the request (recommend a shared secret header verified against `process.env.CONVEX_TRANSCRIBE_SECRET` — without it, this route is an open Groq proxy that costs money on every public POST).
   - Look up the file from the body's `storageId` (R2 fetch via the same helpers Convex uses, or pass the URL pre-resolved from the Convex side).
   - POST the file to Groq using the same body shape as [`callGroqWhisper`](../../convex/submissions.ts#L569-L594) in the mobile repo.
   - Return `{ transcription: string }`.
4. Set `GROQ_API_KEY` on the Next.js host's env. Confirm the deployed Next.js build has the new route.
5. From `convex/submissions.ts`, confirm the action sets the shared-secret header on its `fetch(...)` call.
6. Reproduce per §4.6.

If you take Option B, also write a small integration test that hits the Next.js route directly with a known-good audio sample and asserts a 200 response with a non-empty transcription — so the next "Vercel preview is gone" or "route file got renamed" incident is caught at deploy time, not by an end user.

---

## 6. Captured diagnostics — fill in before implementing

Do not skip this section. Paste log output here so the next person reading the PR can reconstruct what you saw.

> **Exact URL `transcribeMedia` was calling before the fix:**
> `https://negosyo-digital.com/api/transcribe` (from `SITE_URL` env var on `energetic-panther-693`).
>
> **Full first error log line including request ID:**
> `[transcribeMedia] submissionId=jd766fm0k2t5sc0wyg2mrxq86x85dxk2: Transcription API returned 404: <!DOCTYPE html><!--nSxO_fbIwv80mxn0NUvF_--><html lang="en">…` (Next.js not-found HTML page returned because Clerk middleware was intercepting `/api/transcribe` — the route handler never ran).
>
> **Result of `npx convex env get GROQ_API_KEY`:**
> present.
>
> **Chosen option (A or B) and one-line justification:**
> **Option A.** Next.js round-trip had two unfixable-in-dev problems — Clerk middleware was redirecting the server-to-server call (producing the 404 HTML), and even with middleware bypassed Convex-in-the-cloud can't reach `localhost:3000` during local development. Direct-Groq removes both, plus eliminates env-var drift risk across the two surfaces.

---

## 7. Acceptance checklist

An agent finishing this task must confirm **all** of:

- [ ] §6 is filled in with real captured output, not "TODO".
- [ ] Web repo `convex/submissions.ts` `transcribeMedia` action no longer makes an HTTP request to a Next.js route (Option A) — OR the Next.js route exists, is deployed, returns 200 for the action's body shape, and has its env vars configured (Option B).
- [ ] `npx convex env get GROQ_API_KEY` on `energetic-panther-693` returns a value.
- [ ] `npx convex deploy --dry-run` shows zero "functions to be deleted" before the actual deploy.
- [ ] `convex/schema.ts` is **unchanged** (transcription is a function-set bug, not a schema bug — see [`MOBILE-PARITY-FIX-R2.md §5`](./MOBILE-PARITY-FIX-R2.md) for the schema-stays-frozen rationale).
- [ ] An end-to-end audio submission on a real device produces a complete transcript visible in the admin panel.
- [ ] Header comment from §4.4 is in place, citing this doc, so the next refactor doesn't undo the fix.
- [ ] One-liner footnote added to [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) linking here, noting that the Next.js round-trip pattern caused the 2026-04-23 transcription outage.
- [ ] No GROQ or R2 secrets committed to git (search the diff for the literal env-var values).

---

## 8. Why this keeps happening (read once, then apply going forward)

Three plan files now (this one, [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md), [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md)) all trace back to the same root cause: **two repos sharing one Convex deployment, with divergent function implementations and no automated parity check**. Every `npx convex deploy` from one repo silently overwrites the other's bundle.

The three patches above resolve the immediate user-visible failures. The longer-term fix is still the one [`MOBILE-PARITY.md §Longer-term`](./MOBILE-PARITY.md) recommended: split the deployments. Until that happens, treat every web-side `npx convex deploy` as a potential mobile outage and use `--dry-run` first, every time.

---

## 9. References

- Reference implementation (Groq-direct, known-working): [`ndm/convex/submissions.ts:390-594`](../../convex/submissions.ts#L390-L594)
- Reference helper (file chunking for >25MB): [`ndm/convex/lib/mediaChunker.ts`](../../convex/lib/mediaChunker.ts)
- Reference helpers (R2 fetch for source file): [`ndm/convex/lib/r2Helpers.ts`](../../convex/lib/r2Helpers.ts)
- Original incident: [`MOBILE-PARITY.md`](./MOBILE-PARITY.md)
- Companion fixes: [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md), [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md)
- Mobile call site that triggers the scheduled transcription: [`ndm/convex/submissions.ts:178-194`](../../convex/submissions.ts#L178-L194) (the `submissions.update` handler)
- Mobile function inventory: [`ndm/docs/01-mobile-app/00-Overview-Mobile.md`](../01-mobile-app/00-Overview-Mobile.md) §Convex Backend
