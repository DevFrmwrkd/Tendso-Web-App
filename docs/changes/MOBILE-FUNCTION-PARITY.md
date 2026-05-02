# Mobile Function Parity Restore — 2026-04-23

## Problem

Web and mobile share the production Convex deployment `energetic-panther-693` but live in separate `convex/` directories. `npx convex deploy` replaces the deployment's *entire* function bundle with whatever is in the caller's `convex/` folder. A recent deploy from this web repo silently dropped the mobile-only functions that the Google Play APK is hard-coded to call, and mobile flows started failing in production:

- Photo submission (3+ photo step) — 404 on upload URL action
- Profile photo update (edit profile) — same 404

The mobile binary calls functions by name. Once a function name disappears from the deployment, every already-installed device that calls it fails.

This matches the coordination risk already flagged in `docs/changes/ADMIN-SCHEMA-CHANGE.md` — same root cause, same fix pattern (make web's `convex/` folder a strict **superset** of what mobile references).

## What was restored

All four files below were edited to re-add functions mobile references per `docs/00-Overview-Mobile.md`. Each addition is annotated in-source as "referenced by the mobile app — do not remove" so future cleanups won't re-delete them.

### `convex/r2.ts`

| Export | Kind | Purpose |
|---|---|---|
| `generateR2UploadUrl` | action | **Mobile name for the R2 upload-URL generator.** Shares an implementation with `generateUploadUrl` via a private helper. Fix for the reported photo/profile-photo breakage. |
| `generateUploadUrl` | action | Existing web export, signature loosened (`submissionId` + `mediaType` now optional) so profile-photo uploads work through either name. |

Accepted `mediaType` values expanded to `photo | video | audio | profile | avatar`. Profile/avatar variants store under `avatars/`; others unchanged.

### `convex/submissions.ts`

| Export | Kind | Purpose |
|---|---|---|
| `updateTranscription(submissionId, transcription)` | internalMutation | Persist a completed transcript. |
| `updateTranscriptionStatus(submissionId, status, error?)` | internalMutation | Lifecycle: `processing` → `complete` / `failed`. |
| `transcribeMedia(submissionId, storageId?, mediaType?)` | internalAction | Triggers transcription; delegates to the Next.js `/api/transcribe` endpoint so both platforms share one implementation. |

Imports updated to pull `internalMutation` and `internalAction` from `_generated/server`.

### `convex/admin.ts`

| Export | Kind | Purpose |
|---|---|---|
| `markWebsiteGenerated(submissionId, adminId, websiteUrl?)` | mutation | Mobile admin flow: sets `status = 'website_generated'` + audit log. |
| `getAllSubmissionsWithCreators()` | query | Alias for the existing `submissions.getAllWithCreator` query, under the name mobile expects. |

### `convex/withdrawals.ts`

| Export | Kind | Purpose |
|---|---|---|
| `updateStatus(id, status, transactionRef?, adminId, failureReason?)` | mutation | Admin override matching mobile's signature (docs §withdrawals). Completes / fails a withdrawal with the correct side effects (`totalWithdrawn` increment on complete, balance restore on fail, audit log). |
| `updateByTransactionRef(transactionRef, status)` | internalMutation | Webhook-handler alias. Looks up a withdrawal by `transactionRef` **or** `wiseTransferId` (both naming conventions have been used historically). |

## Schema

Schema was **not** modified. The reported breakage was a function-set divergence, not a schema divergence — adding the missing functions without touching `schema.ts` is the minimally-invasive fix.

## Deploy

Ran `npx convex codegen` which uploaded the restored functions to `energetic-panther-693`. Mobile flows should resolve without a new Play Store build — the APK just starts seeing the functions again.

## Preventing this next time

Before any `npx convex deploy` from this web repo:

```bash
npx convex deploy --dry-run
```

Read the output carefully. The **"functions to be deleted"** section must be empty. If it isn't, each entry is a function mobile's APK is calling — pull it into this repo's `convex/` folder first (copy from mobile's repo or `docs/00-Overview-Mobile.md §Convex Backend — All Functions`), then deploy.

Header comments on each restored function name them explicitly as "mobile-referenced — do not remove" to reduce the chance a future cleanup re-drops them.

## Longer-term

The per-deploy coordination risk goes away entirely if web uses its own Convex deployment rather than sharing `energetic-panther-693` with mobile. One command (`npx convex env set CONVEX_DEPLOYMENT …`) followed by re-pointing `NEXT_PUBLIC_CONVEX_URL`. Worth doing next time both teams are available to verify data routing.

## Reference

- Mobile function inventory: [`docs/00-Overview-Mobile.md`](../00-Overview-Mobile.md) §Convex Backend — All Functions (L1350+)
- Prior schema-sync incident: [`docs/changes/ADMIN-SCHEMA-CHANGE.md`](./ADMIN-SCHEMA-CHANGE.md)

---

## Follow-up — 2026-04-23 (same day)

The fix above restored every missing function name, but mobile photo upload was **still** failing after redeploy. See [`MOBILE-R2-FIX`](./MOBILE-R2-FIX) for the secondary investigation writeup.

**Actual root cause of the lingering error** — *not* the one the follow-up doc predicted:

- The follow-up doc's "prime suspect" was missing R2 env vars on the deployment. Confirmed ruled out: `npx convex env list` on `energetic-panther-693` showed `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` all present with real values.
- The real cause was **argument shape mismatch** on `r2.generateUploadUrl`. The Play Store APK calls it with `{ folder, filename, contentType }` (lowercase, with a `folder` field). This repo's validator declared `{ fileName, fileType, submissionId?, mediaType? }` (camelCase, no `folder`). Convex rejects unknown fields and missing required fields by default, and that rejection surfaces on the mobile client as `[CONVEX A(r2:generateUploadUrl)] Server Error` — indistinguishable at first glance from a genuine handler-threw exception.

**What the fix did** — [`convex/r2.ts`](../../convex/r2.ts):

- Declared every field optional at the validator layer (`fileName` + `filename`, `fileType` + `contentType`, `folder`, `submissionId`, `mediaType`) so both arg shapes pass validation.
- Normalized inside the handler (`name = args.fileName ?? args.filename`, etc.) and raised clear error messages if neither variant is present.
- Return value now includes both `key` (web-style) and `fileKey` (mobile-style) for the same both-shapes reason.
- Applied the same dual-shape signature to the `generateR2UploadUrl` alias.

Deployed via `npx convex deploy -y` to `energetic-panther-693`.

**Lesson — read "Server Error" as a superset of three failure classes, not one:**

| Client-side string | Underlying cause | Diagnostic |
|---|---|---|
| `Could not find public function …` | Function missing from the deployment bundle | Function-parity restore (this doc's main body) |
| `Server Error` + handler ran | Handler threw at runtime | Env vars, external API, schema violation inside handler |
| `Server Error` + handler never ran | Validator rejected the args | Check mobile's actual call shape against the validator |

The third row is what bit us. If future mobile-incident debugging sees `Server Error`, tail `npx convex logs --prod --tail` while reproducing — if the handler's log output doesn't appear, it's a validator rejection and the fix is signature-shape, not function-restore.

---

## Second occurrence of the validator-rejection class — 2026-04-23 (same day)

A few hours after the R2 fix, mobile hit another `Server Error` on audio submission — this time at `[CONVEX M(submissions:update)]`. Same root-cause class (validator rejected the mobile call before the handler ran), different field: `audioStorageId`.

- **Web's `update` validator** declared `audioStorageId: v.optional(v.id('_storage'))` — required a Convex internal storage ID.
- **Mobile sends** `audioStorageId: fileKey` where `fileKey` is an R2 object key string like `"audio/1721293-a2b3c4d5.m4a"`.
- **`schema.ts` already stored it as `v.optional(v.string())`** — so the bug was the *mutation* validator being tighter than the *table* schema.
- **Fix**: loosened `videoStorageId` / `audioStorageId` to `v.optional(v.string())` on both `submissions.create` and `submissions.update`. Schema untouched. See [`MOBILE-AUDIO-SUBMISISONS.md`](./MOBILE-AUDIO-SUBMISISONS.md) for the full writeup.

**Lesson refined — the "mutation validator tighter than the table schema" anti-pattern:**

Every `v.id('_storage')` declared as a *mutation argument* for a field the *table* stores as `v.string()` is a latent validator-rejection bug waiting for a caller that sends a plain string. Audit step for future mobile-function work:

```bash
# Any arg validator using v.id('_storage') where the matching table field is v.string() is suspect.
# Start with these three files: submissions.ts, creators.ts, generatedWebsites.ts.
```

If the table stores a string, the mutation validator should accept a string too — never `v.id('_storage')`. Convex accepts strings for storage IDs at the DB layer (they're just opaque strings internally), so `v.string()` is always the permissive-correct choice for this field type.

---

## Third occurrence — transcription Next.js round-trip 404 — 2026-04-23 (same day)

A few more hours after the audio-submission fix, mobile audio was uploading successfully + getting marked for transcription but the transcript never arrived — `transcriptionStatus` stayed `'processing'`, then flipped to `'failed'` with `Transcription API returned 404: <!DOCTYPE html>…`. Separate root cause from the validator-rejection pattern.

- **`transcribeMedia`** was implemented as a Next.js round-trip — Convex action → HTTP POST to `${SITE_URL}/api/transcribe` → Groq. Two independent problems killed it:
  - Clerk middleware was intercepting `/api/transcribe` (not in the `isPublicRoute` list) and serving Next.js's 404 HTML page before the route handler's internal-secret bypass could run.
  - Convex runs in the cloud, so it can't reach `localhost:3000` during local dev — the round-trip pattern is fundamentally dev-hostile.
- **Fix**: rewrote `transcribeMedia` to call Groq Whisper directly, with chunking support for 500MB+ files via `convex/lib/mediaChunker.ts` (copied from `lib/services/media-chunker.ts`; renamed because Convex module names can't contain hyphens). See [`MOBILE-PARTY-FIX-TRANSCRIBE.md`](./MOBILE-PARTY-FIX-TRANSCRIBE.md) for the writeup.

**Lesson refined again — the "Next.js round-trip from Convex" anti-pattern:**

Any pattern where a Convex action HTTP-POSTs back to the Next.js app it belongs to is a latent outage. Three things have to stay aligned across two env surfaces: the URL, the auth contract (Clerk middleware allow-list + per-route secret check), and the network reachability (cloud ↔ user's laptop). Direct third-party API calls from Convex eliminate all three. Prefer them whenever the logic is self-contained. The existing [`convex/withdrawals.ts sendStatusEmailAction`](../../convex/withdrawals.ts) and [`convex/submissions.ts transcribeMedia`](../../convex/submissions.ts) are both instances of this pattern; of those, `transcribeMedia` is now direct-Groq. `sendStatusEmailAction` still round-trips to `/api/internal/send-withdrawal-status-email` — consider converting it to direct Gmail/nodemailer from Convex on the next touch.

---

## Fourth occurrence — mobile signup blocked by missing `isDeletedByEmail` — 2026-04-23 (same day)

Highest-severity of the four — blocked *all* new account creation on the Google Play APK. Different from the earlier three because it's a plain missing-export, not a signature mismatch or middleware issue.

- The mobile signup screen calls `api.creators.isDeletedByEmail({email})` unauthenticated the instant the Create Your Account form mounts (doc §1 call site). It's also called from forgot-password.
- Web's [`convex/creators.ts`](../../convex/creators.ts) simply didn't export the function. Grepped, zero hits.
- The mobile SDK surfaced the miss as `Server Error` rather than "Could not find public function" — so the failure looked like a handler crash and read identically to the earlier three incidents on the client side.
- **Fix**: added the exported query with a one-line body that does an indexed `by_email` lookup and returns the `isDeleted` flag as a boolean. Unauthenticated by design — the caller hasn't signed in yet. Header comment says `Mobile-referenced — do NOT add an auth guard`. See [`MOBILE-REGISTER-ERROR.md`](./MOBILE-REGISTER-ERROR.md).

**Lesson for the audit list — signup is on the critical path:**

The function-parity audit needs to specifically call out any function the mobile APK calls *before* the user is authenticated. Those can't be guarded with `requireAuth` / `requireAdmin` without breaking signup or forgot-password. Current known unauthenticated callers on the mobile side:

- `creators.isDeletedByEmail` — signup + forgot-password
- `creators.getByClerkId` — gets called post-signup but during initial bootstrap before profile exists

Before ever adding an auth wrapper to any function in `convex/creators.ts`, check whether the mobile signup / forgot-password / onboarding screens call it. If they do, either leave it unauthenticated or split into two exports (one public, one `*Admin` variant).

---

## Fifth occurrence — mobile withdrawal blocked by validator-shape mismatch — 2026-04-23 (same day)

Same class as the second occurrence (mutation arg validator tighter than what mobile sends), this time on `withdrawals.create`. Mobile sends `{creatorId, amount, wiseEmail}` per the Wise refactor; web's deployed validator demanded `{creatorId, amount, payoutMethod, accountDetails}`. Convex rejected mobile's call before the handler ran with `ArgumentValidationError: Object is missing the required field 'accountDetails'`.

- **Critical user constraint:** "fix mobile without breaking the other pipeline and features." Web's wallet UI in this same repo (`app/wallet/page.tsx`) calls the legacy shape. Replacing wholesale with the mobile-only signature would have broken the web wallet too.
- **Fix**: dual-shape validator — `payoutMethod`, `accountDetails`, `wiseEmail` are all `v.optional(...)`. Handler normalizes either shape into a canonical `wise_email` withdrawal: if `wiseEmail` is present (mobile path), derive `payoutMethod = 'wise_email'` and `accountDetails = wiseEmail`; otherwise use the explicit `payoutMethod`/`accountDetails` (web path). This is the same pattern documented in this file's R2 section — proven safe for cross-shape compatibility.
- See [`MOBILE-WITHDRAWAL-FIX.md`](./MOBILE-WITHDRAWAL-FIX.md) for the full writeup.

**Lesson refined again — the dual-shape validator pattern is now the standard play for shared-deployment shape divergence.** Five times in one day a fix has reduced to "make the validator permissive at the boundary, normalize in the handler." Any cross-repo Convex function with a non-trivial signature is a candidate for the same treatment proactively. Audit candidates worth scanning when time allows: `creators.create`, `creators.update`, `notifications.createAndSend`, `referrals.createFromSignup`, `leads.create`. If any of those have signatures tighter than what the mobile inventory in `docs/00-Overview-Mobile.md` describes, give them the same dual-shape treatment before mobile hits them in production.
