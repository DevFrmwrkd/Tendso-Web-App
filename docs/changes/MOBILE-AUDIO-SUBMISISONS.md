# Mobile `submissions.update` Server Error (Audio Step) — Fix Plan — 2026-04-23

> **Resolved 2026-04-23.** Root cause was **not** auth/ownership drift (§2.1 primary hypothesis), and **not** scheduler arg drift (§2.2 secondary hypothesis).
>
> Actual cause: **arg-type mismatch in the `update` mutation validator** — same class of bug as the R2 fix (see [`MOBILE-R2-FIX`](./MOBILE-R2-FIX)). Web's `submissions.update` declared `videoStorageId` and `audioStorageId` as `v.id('_storage')`, but mobile stores R2 object keys there (strings like `"audio/1721293-a2b3c4d5.m4a"`). Convex rejected mobile's call at the validator → handler never ran → surfaced on the client as `Server Error`.
>
> This falls under §3.6 (ValidationError) — the §3.5 remediation (creator-row migration) was NOT performed and NOT needed.
>
> Key detail that ruled out the §2.1 auth hypothesis: **web's `update` mutation does not have an auth or ownership check** ([convex/submissions.ts:260-302](../../convex/submissions.ts#L260-L302)). The only reachable throw paths are validator rejection (pre-handler) or `ctx.db.patch` schema rejection. The patch would have succeeded — `schema.ts` already declares `audioStorageId: v.optional(v.string())` — so the throw had to be at the validator layer.
>
> **Fix:** [`convex/submissions.ts`](../../convex/submissions.ts) — loosened `videoStorageId` / `audioStorageId` to `v.optional(v.string())` on both `create` (L202-L203) and `update` (L277-L278). Schema unchanged. No auth changes. No data migration.
>
> Deployed to `energetic-panther-693` via `npx convex deploy -y` after passing `--dry-run` (no function deletions, no schema changes). See [`MOBILE-FUNCTION-PARITY.md §Follow-up`](./MOBILE-FUNCTION-PARITY.md) for the three-classes-of-Server-Error diagnostic table that predicted this failure mode.
>
> The §3 diagnostic flow below remains valid for **future** `M(submissions:update)` errors — if tailing logs shows `Forbidden: you can only update your own submissions`, that IS the auth-drift branch and §3.5 applies. If logs show a `ValidationError` naming a different field than the ones fixed here, follow §3.6.

> Companion to [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) and [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md). Do not skim. The two prior docs fixed different-shaped bugs; this one is a third, distinct failure mode.

## For the implementing agent

You are the agent. A user on the Google Play build hit this on **Step 3 of 4 — Record Interview**, immediately after finishing an audio recording and tapping "Next":

```
[CONVEX M(submissions:update)] [Request ID: e596e395584485ce] Server Error
Called by client
```

Your job: find the throw, fix it, deploy, verify. **Tail the production logs first — do not guess.** The §3 diagnostic steps below are the path.

Scope boundary: **do not change the database schema.** An earlier audit (recorded in [`MOBILE-PARITY-FIX-R2.md §5`](./MOBILE-PARITY-FIX-R2.md)) confirmed the web schema is already a superset of what mobile reads/writes. If production logs indicate a schema validation error on a specific field, update §5 of this document and get explicit approval before touching `schema.ts` — a schema change on the shared deployment impacts the mobile APK too.

---

## 1. Decoding the error

- `M(submissions:update)` — this is a **mutation**. It's already in the deployment bundle (a missing function errors out with "Could not find public function", not "Server Error").
- `Server Error` — the handler ran and threw an unhandled exception.
- `Called by client` — the throw bubbled up directly to the client; no catch wrapper in between.

Different signature from [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md): that one was `A(r2:generateUploadUrl)` (action, no auth, no DB). This one is `M(submissions:update)` (mutation, **has auth**, **writes to the DB**, **schedules an internal action**). So the throw locations are entirely different.

---

## 2. Where the handler can throw

Open [`convex/submissions.ts:125-196`](../../convex/submissions.ts). The `update` mutation, in execution order, can throw at these points:

| # | Line | Call | Throws when |
|---|---|---|---|
| 1 | 142 | `requireAuth(ctx)` | Clerk identity is missing / JWT expired / issuer mismatch. Thrown message: `"Not authenticated"`. |
| 2 | 143-144 | `ctx.db.get(args.id)` + null check | `submissionId` points to a deleted/nonexistent row. Thrown message: `"Submission not found"`. |
| 3 | 145-148 | Creator ownership check | `creator.clerkId !== identity.subject`. Thrown message: `"Forbidden: you can only update your own submissions"`. |
| 4 | 176 | `ctx.db.patch(id, filteredUpdates)` | Convex schema validator rejects a field value (e.g. wrong type, or schema was changed in a way that breaks a pending value). |
| 5 | 189-193 | `ctx.scheduler.runAfter(0, internal.submissions.transcribeMedia, {...})` | Args fail `transcribeMedia`'s validator at schedule time. This mutation throws if the internal action's expected args diverged. |

The client-side call from [`app/(app)/submit/interview.tsx:670-674`](../../app/(app)/submit/interview.tsx#L670-L674) (audio path) is:

```ts
await updateSubmission({
  id: submissionId as Id<'submissions'>,
  audioStorageId: fileKey,        // R2 key, e.g. "audio/1721293-a2b3c4d5.m4a"
  creatorPayout: payout,          // 300 for audio
});
```

All three fields match the arg validator at [`convex/submissions.ts:125-140`](../../convex/submissions.ts#L125-L140). So the client payload is not the failure — the throw is somewhere **inside** the handler's effects.

### 2.1 Primary hypothesis: auth identity does not match creator

The TikTok OAuth login path was added recently (commit `b0ae0e0`). If a user's Clerk identity switched providers (email → TikTok) without the corresponding `creators.clerkId` being updated, the ownership check at line 146-148 throws `"Forbidden: you can only update your own submissions"` **even though the user is the legitimate owner**. This is the most likely cause and the one I'd check first.

### 2.2 Secondary hypothesis: scheduler arg drift

Line 189 schedules `internal.submissions.transcribeMedia`. That action's arg validator is currently ([`convex/submissions.ts:390-395`](../../convex/submissions.ts#L390-L395)):

```ts
args: {
  submissionId: v.id("submissions"),
  storageId: v.string(),
  mediaType: v.string(),
}
```

The call site passes exactly those three — should not fail at schedule time. But if a concurrent change to `transcribeMedia`'s signature lands, this is the kind of silent drift that turns a user action into `"Server Error"`.

### 2.3 Tertiary hypothesis: R2-adjacent env vars (unlikely here)

`submissions.update` itself does not read R2 env vars — those are used inside the scheduled `transcribeMedia` action, which runs **after** the mutation commits. A missing `GROQ_API_KEY` or `R2_*` var would fail transcription asynchronously, update `transcriptionStatus = "failed"`, and never surface to the client as a mutation error. So env var gaps do **not** explain this particular "Server Error". Rule this out last.

---

## 3. Diagnostic steps — run these first, in order

Do not change code until §3.2 reveals the actual thrown error.

### 3.1 Verify you are targeting the right deployment

```bash
npx convex env get CONVEX_DEPLOYMENT
```

Expect `prod:energetic-panther-693`. If it's a different value, stop — diagnosing the wrong deployment will waste time and produce misleading results.

### 3.2 Tail production logs while reproducing

```bash
npx convex logs --prod --tail
```

Keep it running. Ask the reporter (or a test device) to repeat: record audio → tap Next. Watch for the mutation's thrown error. You're looking for one of:

| Expected log message | → jump to |
|---|---|
| `Not authenticated` | §3.3 (auth token problem) |
| `Submission not found` | §3.4 (stale submissionId) |
| `Forbidden: you can only update your own submissions` | §3.5 (clerkId drift — most likely) |
| Any `ValidationError` mentioning a specific field | §3.6 (schema issue — read carefully before acting) |
| Anything else | paste it verbatim into §6 of this doc and escalate |

**Do not proceed past this step until you have a concrete thrown-message string.** Every step below assumes you know which branch you're on.

### 3.3 If the thrown error is `Not authenticated`

The device's Clerk JWT is either missing, expired, or issued by a provider the Convex deployment doesn't trust.

1. Confirm [`convex/auth.config.ts`](../../convex/auth.config.ts) contains the right Clerk frontend API domain. It should currently be:
   ```ts
   export default { providers: [{ domain: "https://clerk.negosyo-digital.com", applicationID: "convex" }] };
   ```
2. Confirm the mobile APK's Clerk publishable key is for the same instance (same frontend API domain). Mobile builds older than the current Clerk instance domain will fail auth. If mobile's build references a different Clerk domain, mobile needs a rebuild — not a web-side fix.
3. If auth config is correct on both sides, have the user sign out and sign back in on the device. A stale JWT can simply not be refresh-able in the installed APK if the Clerk instance's keys rotated.

### 3.4 If the thrown error is `Submission not found`

Rare. The client holds a `submissionId` that no longer exists server-side. Possible causes: dev-data wipe, admin hard-delete, row migration with a new `_id`.

1. Query `submissions` by the rough timestamp the user started the draft:
   ```bash
   npx convex run submissions:getByCreatorId '{"creatorId":"<their creator id>"}'
   ```
2. If the draft is missing, the client side needs to recreate it. The mobile fix is in [`app/(app)/submit`](../../app/(app)/submit) — but this is unlikely a web-repo task. Document the finding and escalate to the mobile team.

### 3.5 If the thrown error is `Forbidden: you can only update your own submissions` — most likely branch

Root cause: the `clerkId` stored on the `creators` row doesn't match the JWT's `subject` at call time. Common triggers:

- User re-signed up with a different Clerk provider (e.g. TikTok OAuth after originally using email), creating a new Clerk user. Old submission row still points to the old `creators` row whose `clerkId` is the old Clerk user ID.
- Clerk instance was recreated, invalidating all old IDs.

Diagnose:

1. Get the JWT `subject` (Clerk user ID) from the reproducing user. One way: temporary log in `requireAuth`:
   ```ts
   // convex/lib/auth.ts — ADD TEMPORARILY, revert after diagnosis
   console.log("[requireAuth] subject:", identity.subject, "email:", identity.email);
   ```
2. Look up the `creators` row for the failing submission:
   ```bash
   npx convex run submissions:getById '{"id":"<submissionId>"}'
   # Then:
   npx convex run creators:getByClerkId '{"clerkId":"<the subject from step 1>"}'
   ```
3. Compare `creators._id` linked from the submission vs. the `creator` record returned for the current JWT subject. If they differ, the user has two creator rows — one from the old auth flow, one from the new.

Remediation (do not do automatically without approval — this touches production data):

- **Option A — merge creator records:** pick the "current" creators row (the one tied to the live JWT subject), re-point all submissions, earnings, withdrawals, referrals, analytics, notifications, pushTokens, and payoutMethods from the old row to the new one. Then mark the old row `isDeleted: true`. This requires a one-off admin script; schema supports it without changes.
- **Option B — patch the old creators row's `clerkId`:** if the old row is the canonical creator and TikTok auth is additive (not a full takeover), just update `clerkId` on the old row to the new subject. Simpler, but only safe if the new Clerk user has no conflicting data of its own.

Either way: **get user confirmation of the desired outcome before running the migration.** Do not silently pick one.

Preventative (in scope for this fix, code-level):

Update [`convex/creators.ts`](../../convex/creators.ts) — the `create` mutation at lines 30-85 — to also reconcile by email when a new Clerk subject shows up. If a `creators` row exists with the same `email` but different `clerkId`, that's a provider switch, not a new user. Either:

- Merge the records (safer; preserves earnings/submissions), or
- Refuse the second signup and surface a useful error.

Pick one. Document the choice in `convex/creators.ts` as a header comment, matching the `Mobile-referenced — do not remove` convention from the R2 fix.

### 3.6 If the thrown error is a Convex `ValidationError`

Read the exact field name and expected vs. actual type from the log. Two sub-cases:

1. **Field name mobile sent is not in the arg validator.** → Add it as `v.optional(...)` to the `update` mutation's args at [`convex/submissions.ts:125-140`](../../convex/submissions.ts#L125-L140). Do not remove or tighten any existing arg.
2. **Field value mobile sent violates `schema.ts`.** → Update §5 of this doc with the field name and value, then escalate. Do **not** modify `schema.ts` without approval (see scope boundary at the top).

---

## 4. Fix, deploy, verify

Once §3 identifies the branch and you've implemented the targeted change (or run the one-off migration from §3.5):

1. Run `npx convex deploy --dry-run` from this repo. Inspect the output:
   - "functions to be deleted" must be **empty**. Non-empty means you're about to drop something mobile calls — import from the mobile repo first.
   - "schema changes" should also be empty unless you had explicit approval to touch `schema.ts`.
2. Deploy: `npx convex deploy`.
3. Ask the reporter (or use a test device) to repeat the audio submission flow end-to-end:
   - Record → Next → upload succeeds (no R2 error)
   - `submissions.update` succeeds (no mutation server error)
   - Transcription status eventually moves `processing` → `complete` (check the submission row)
4. Paste the successful reproduction trace into the PR description so the next person reading this doesn't have to re-derive acceptance criteria.

---

## 5. Schema — do NOT modify (unchanged from prior plan)

Reaffirming the scope boundary from [`MOBILE-PARITY-FIX-R2.md §5`](./MOBILE-PARITY-FIX-R2.md): the web `convex/schema.ts` is a superset of the mobile inventory in [`docs/01-mobile-app/00-Overview-Mobile.md`](../01-mobile-app/00-Overview-Mobile.md). All web-extras are `v.optional(...)`.

Do not add, remove, or retype any schema field as part of this fix. If §3.6 or §3.5 investigation exposes a real schema gap, record it here before acting:

> **Final finding (2026-04-23):** No schema change needed. The web `schema.ts` already declares `videoStorageId` / `audioStorageId` as `v.optional(v.string())`. The bug was on the *mutation validator* side — web's `submissions.update` validator declared these fields as `v.id('_storage')` while the underlying table accepted strings. The validator was tighter than the schema it guarded. Fix: relax the mutation validator to `v.optional(v.string())` to match the table. Schema untouched.

---

## 6. If the log shows something neither this doc nor [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md) covers

Paste it here verbatim with the reproducing timestamp and request ID. Do not start implementing a speculative fix.

> **2026-04-23 incident (resolved):** Client-side error was `[CONVEX M(submissions:update)] [Request ID: e596e395584485ce] Server Error`. The mutation's arg validator rejected mobile's `audioStorageId` value (an R2 object key, string) because the validator required `v.id('_storage')` (a Convex storage ID). Rejection happened pre-handler, so no handler log line appeared in `npx convex logs --prod --tail` — which is the signature of the "validator rejection" class described in [`MOBILE-FUNCTION-PARITY.md §Follow-up`](./MOBILE-FUNCTION-PARITY.md). Fix landed: relaxed `videoStorageId` / `audioStorageId` to `v.optional(v.string())` on both `create` and `update` mutations.

---

## 7. Acceptance checklist

An agent closing this task must confirm **all** of:

- [ ] The exact thrown message was observed in `npx convex logs --prod --tail` and is recorded in the PR description (one of: `Not authenticated` / `Submission not found` / `Forbidden: you can only update your own submissions` / `ValidationError: …` / other).
- [ ] The code change (or one-off data migration) maps 1:1 to the observed message and nothing more. No speculative cleanups.
- [ ] `convex/schema.ts` is **unchanged** (unless §5 was updated with the specific finding and explicitly approved).
- [ ] `convex/submissions.ts` still exports `update`, `submit`, `updateTranscription`, `updateTranscriptionStatus`, `transcribeMedia` (mobile-referenced — verify with `npx convex deploy --dry-run` that nothing is being deleted).
- [ ] Any temporary `console.log` added for diagnosis (e.g. in `requireAuth`) has been **removed** before the final deploy.
- [ ] Audio submission reproduces end-to-end successfully on a real device or an Expo dev build: record → Next → no `Server Error` → review screen loads → submit succeeds → transcription eventually reaches `complete`.
- [ ] If a data migration was run (§3.5 Option A or B), the migration script and its dry-run output are attached to the PR for audit.
- [ ] `MOBILE-PARITY.md` gets a one-liner footnote linking to this doc so the next engineer understands that `Server Error` on a mutation is distinct from the function-parity class of bugs.

---

## 8. References

- Prior incident: [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) — missing-function (404) class
- Prior fix plan: [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md) — R2 env-var / signature class
- Older schema sync: [`docs/changes/ADMIN-SCHEMA-CHANGE.md`](../changes/ADMIN-SCHEMA-CHANGE.md)
- Mobile call site (audio): [`app/(app)/submit/interview.tsx:670-674`](../../app/(app)/submit/interview.tsx#L670-L674)
- Mobile call site (video): [`app/(app)/submit/interview.tsx:663-668`](../../app/(app)/submit/interview.tsx#L663-L668)
- Mobile offline sync (same mutation from a background worker): [`hooks/useOfflineSync.ts:110`](../../hooks/useOfflineSync.ts#L110), [`hooks/useOfflineSync.ts:170`](../../hooks/useOfflineSync.ts#L170), [`hooks/useOfflineSync.ts:228`](../../hooks/useOfflineSync.ts#L228), [`hooks/useOfflineSync.ts:235`](../../hooks/useOfflineSync.ts#L235)
- Mutation under test: [`convex/submissions.ts:125-196`](../../convex/submissions.ts#L125-L196)
- Auth helpers: [`convex/lib/auth.ts`](../../convex/lib/auth.ts)
- Clerk trust config: [`convex/auth.config.ts`](../../convex/auth.config.ts)
- Mobile overview (function inventory): [`docs/01-mobile-app/00-Overview-Mobile.md`](../01-mobile-app/00-Overview-Mobile.md)
