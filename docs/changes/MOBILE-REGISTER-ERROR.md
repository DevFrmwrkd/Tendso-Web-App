# Mobile Signup `creators:isDeletedByEmail` Server Error — Fix Plan — 2026-04-23

> **Resolved 2026-04-23 via Shape C (§2.3).** Web's `convex/creators.ts` was entirely missing the `isDeletedByEmail` export. The mobile APK's signup screen calls it unauthenticated at mount time; when the function isn't in the deployment bundle the mobile SDK normalized the miss to `Server Error` rather than the usual "Could not find public function" string. Added the unauthenticated query body from §4.1 with the "Mobile-referenced — do not remove, do not add an auth guard" header comment. Deployed to `energetic-panther-693` after `--dry-run` confirmed zero function deletions. Schema untouched (`by_email` index on `creators` is already present, `isDeleted: v.optional(v.boolean())` already on the table). See §5 and §6 below for captured diagnostics.

> Fourth fix plan in the series. Read the preceding plans in order first — they share the same root-cause framing and scope boundaries this one extends:
>
> - [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) — index and shared-deployment framing
> - [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md) — R2 upload action
> - [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md) — interview-step mutation
> - [`MOBILE-PARITY-FIX-TRANSCRIBE.md`](./MOBILE-PARITY-FIX-TRANSCRIBE.md) — transcription action

## For the implementing agent

You are the agent. **You will be working in the web repo's `convex/` folder, not this mobile repo.** This file lives in `ndm/docs/plans/` so the human can hand it to you alongside the mobile-repo reference implementation. Paths starting with `convex/` below mean the **web repo's** `convex/` folder unless explicitly prefixed `ndm/`.

### The observed failure

New users cannot sign up on the mobile Google Play APK via the traditional (email + password) flow. As soon as they land on the Create Your Account screen and the form mounts, the device shows:

```
[CONVEX Q(creators:isDeletedByEmail)] [Request ID: 8db85d005a6613eb] Server Error
Called by client
```

`Q(...)` means **query** — already in the deployment bundle. `Server Error` means the query handler was invoked and threw at runtime. This is the same class of failure as [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md) and [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md): **a runtime throw inside an existing handler, not a missing-function 404.** Last week's signup path worked; a web-side deploy since then produced the divergence.

### Why signup is uniquely sensitive

Total blocker for new account creation. Unlike the prior three failures which affect in-flight submissions, this one prevents any new user from reaching the app at all. Treat as the highest-priority of the four fixes and ship first, independently if needed.

### Scope boundary (same as prior plans, repeated for emphasis)

`convex/schema.ts` is explicitly **not** in scope. The web schema is already a strict superset of the mobile inventory in [`ndm/docs/01-mobile-app/00-Overview-Mobile.md`](../01-mobile-app/00-Overview-Mobile.md). The `creators` table must continue to carry the `by_email` index (the query below depends on it) — confirm the index is present in the deployed schema, but do not add, remove, or retype any field. If production logs reveal a genuine schema gap, record it in §5 and get explicit approval before editing.

---

## 1. Where the error is coming from

The mobile client calls the query from [`ndm/app/(auth)/signup.tsx:130-132`](../../app/(auth)/signup.tsx#L130-L132) the instant the user taps the sign-up button:

```ts
const isDeleted = await convex.query(api.creators.isDeletedByEmail, {
  email: email.trim().toLowerCase(),
});
```

It is also called from the forgot-password screen at [`ndm/app/(auth)/forgot-password.tsx:54`](../../app/(auth)/forgot-password.tsx#L54) — so the same fix unblocks password recovery too.

The mobile repo's implementation is trivial and correct ([`ndm/convex/creators.ts:6-15`](../../convex/creators.ts#L6-L15)):

```ts
export const isDeletedByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return creator?.isDeleted === true;
  },
});
```

No auth guard, no side effects, one indexed lookup, returns a boolean. Nothing in this body can produce a runtime "Server Error" on the deployment under normal conditions. Therefore the currently-deployed version **is not this version** — it is whatever the web team's `convex/creators.ts` last pushed.

[`ndm/docs/changes/ADMIN_SCHEMA_SYNC_PROMPT.md:179`](../changes/ADMIN_SCHEMA_SYNC_PROMPT.md#L179) explicitly catalogs `creators:isDeletedByEmail` as one of the functions prior deploys have dropped or replaced, so this is a known drift point in the project's history rather than a novel regression.

---

## 2. The three plausible deployed-state shapes

Before changing code, confirm which one you're dealing with. The fix path branches:

### 2.1 Shape A — web's version has an admin guard

Most likely. On the admin-web side, `isDeletedByEmail` is intended as an admin-tool function for auditing deletions, so the web implementation wraps it in `requireAdmin(ctx)`:

```ts
// Hypothetical web version
export const isDeletedByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);                                   // ← throws
    ...
  },
});
```

When an unauthenticated mobile signup caller invokes it, `requireAdmin` throws `"Forbidden: admin access required"` (or `"Not authenticated"` if the caller has no Clerk JWT at all). That surfaces at the client as `Server Error`.

**Fix:** replace the web body with the mobile-repo body from [`ndm/convex/creators.ts:6-15`](../../convex/creators.ts#L6-L15). The query reveals nothing sensitive — it returns a single boolean indicating whether an email has an existing soft-deleted account — and is a required part of the signup path. No auth guard belongs on it.

### 2.2 Shape B — web's version queries a different table or index

Second most likely. Possible historical variants: queries a table named `deletedAccounts`, reads a field other than `isDeleted`, looks up via a `by_emailAddress` index, etc. Any index or field name that doesn't exist in the current deployed schema throws at query time.

**Fix:** same as Shape A — replace the web body with the mobile-repo body. Do not "port" the web's divergent implementation; align on the simpler, correct one.

### 2.3 Shape C — web's `creators.ts` lacks the export entirely

Least likely given the error is `Server Error` rather than "Could not find public function", but worth naming. If Convex's error-shaping happens to normalize a missing function to `Server Error` in some mobile SDK versions, this is the branch.

**Fix:** add the mobile-repo version of `isDeletedByEmail` to the web `convex/creators.ts`.

---

## 3. Diagnostic steps — run these first

Same pattern as the prior plans: do not change code until the thrown message is captured from production logs.

### 3.1 Confirm deployment target

```bash
# In the web repo
npx convex env get CONVEX_DEPLOYMENT
```

Expect `prod:energetic-panther-693`. Stop if different.

### 3.2 Tail prod logs while reproducing

```bash
npx convex logs --prod --tail
```

In a second window, have someone (or a test device / Expo dev build) tap through to the signup screen and attempt to register with any new email address. Watch for the query throw. Expected log lines map to shapes:

| Log line (approximate) | Shape | Jump to |
|---|---|---|
| `Forbidden: admin access required` / `Not authenticated` | A | §4.1 |
| `Index not found` / `Field not found` / `Invalid argument` on a field or index name | B | §4.1 |
| `Could not find public function creators:isDeletedByEmail` | C | §4.1 |
| Anything else | — | record in §6 and escalate |

All three shapes resolve to the same code change, so once the log line is captured you can proceed.

### 3.3 Read the web `creators.ts` directly to confirm the shape

While the logs are tailing, open the web repo's `convex/creators.ts` and scan for `isDeletedByEmail`. You should see exactly what's deployed — either one of the three shapes above, or a fourth variant you haven't anticipated. If it's a fourth variant, pause and record it in §6 before deciding.

### 3.4 Verify the `by_email` index still exists on `creators`

In the web repo's `convex/schema.ts`, confirm the `creators` table definition carries `.index("by_email", ["email"])`. If it was removed in a prior schema cleanup, add it back — but only with explicit approval, per the scope boundary at the top of this document. The deployed schema and the web repo's schema should match; if they don't, stop and raise it separately.

---

## 4. Fix

### 4.1 Apply to the web `convex/creators.ts`

Replace the existing `isDeletedByEmail` export (or add it if absent) with exactly this body:

```ts
// Mobile-referenced — do not remove. Called unauthenticated from the signup
// and forgot-password screens to detect whether the entered email matches a
// soft-deleted account. Must NOT have an auth guard — callers are, by
// definition, not yet signed in.
// See docs/plans/MOBILE-PARITY-FIX-SIGNUP-ISDELETED.md for the incident that
// caused the prior auth-gated variant to block mobile signups on 2026-04-23.
export const isDeletedByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return creator?.isDeleted === true;
  },
});
```

Place it near the other public `creators` queries in the file. Verify the imports at the top of the web `convex/creators.ts` already include:

```ts
import { query } from "./_generated/server";
import { v } from "convex/values";
```

(They almost certainly do. Do not remove any other imports that exist.)

### 4.2 If the web file also needs an admin-only variant

If the web team had an admin variant of this functionality under the same name, give it a distinct export — **do not overload**. The public query stays auth-free under the canonical name `isDeletedByEmail`; if the admin side needs a richer read (e.g., returning the full deleted-account metadata rather than just a boolean), expose that as `isDeletedByEmailAdmin` or similar, guarded by `requireAdmin`. Two separate exports, two separate intents, no shared body.

This is the only defensible way both consumers can coexist without one class of caller breaking the other on the next redeploy.

### 4.3 Do not touch the schema

Re-confirmed: no schema changes. The `by_email` index must remain present (§3.4), but no new fields, removed fields, or retyped fields are in scope. If §3.3 or §3.4 uncovered a real schema gap, record it in §5 and escalate before acting.

---

## 5. Schema findings — record here before changing anything

> No schema changes required.
>
> Confirmed present on the deployed schema:
> - `creators.isDeleted: v.optional(v.boolean())` — [`convex/schema.ts:27`](../../convex/schema.ts#L27)
> - `creators.index('by_email', ['email'])` — [`convex/schema.ts:37`](../../convex/schema.ts#L37)

---

## 6. Captured diagnostics — fill in before implementing

> **Exact thrown message observed in `npx convex logs --prod --tail`:**
> Request ID `8db85d005a6613eb`. Client saw `[CONVEX Q(creators:isDeletedByEmail)] [Request ID: 8db85d005a6613eb] Server Error / Called by client`. Handler never ran (Shape C).
>
> **Deployed shape (A / B / C / other — per §2):**
> **C — function not present in web's `convex/creators.ts`.** Grepped `isDeletedByEmail` across all of `convex/` and got zero hits. The only `isDeleted` reference was the field definition in `schema.ts:27`. Mobile SDK version apparently surfaces missing-function as `Server Error` rather than the more typical `Could not find public function` string.
>
> **Web repo's current `isDeletedByEmail` source (paste verbatim, or "not present"):**
> not present. Query was never exported from web's `convex/creators.ts`; web's admin UI has never needed it.
>
> **Whether the `by_email` index is present on `creators` in the deployed schema:**
> present — [`convex/schema.ts:37`](../../convex/schema.ts#L37) declares `.index('by_email', ['email'])`. No schema change needed.

---

## 7. Deploy

1. `npx convex deploy --dry-run` — inspect output. "functions to be deleted" must be empty. If non-empty, pull those functions into the web repo's `convex/` folder first per the rules in [`MOBILE-PARITY.md`](./MOBILE-PARITY.md).
2. `npx convex deploy`.
3. Have a device or dev build attempt the signup flow with a fresh email. The query should now return `false` for the fresh email and the signup should proceed past the `isDeletedByEmail` gate into Clerk's `signUp.create(...)` call.
4. Have a device or dev build attempt signup with the email of a previously soft-deleted account to confirm the `true` path still works (the existing auto-sign-in branch at [`ndm/app/(auth)/signup.tsx:133-148`](../../app/(auth)/signup.tsx#L133-L148) should engage).
5. Repeat on the forgot-password screen at [`ndm/app/(auth)/forgot-password.tsx`](../../app/(auth)/forgot-password.tsx) to confirm password recovery was unblocked by the same fix.

---

## 8. Acceptance checklist

An agent finishing this task must confirm **all** of:

- [ ] §6 is filled in with real captured output, not "TODO".
- [ ] The web repo's `convex/creators.ts` exports `isDeletedByEmail` as an unauthenticated `query` returning `boolean`, body matching §4.1.
- [ ] A `Mobile-referenced — do not remove` header comment is in place citing this document, matching the convention from the prior plans.
- [ ] If a separate admin variant was needed, it exists under a distinct name (`isDeletedByEmailAdmin` or equivalent), guarded by `requireAdmin`, never overloading the public name.
- [ ] `npx convex deploy --dry-run` shows zero "functions to be deleted" before the final deploy.
- [ ] `convex/schema.ts` is **unchanged** unless §5 was updated with explicit approval.
- [ ] The `by_email` index on `creators` is confirmed present in the deployed schema (§3.4).
- [ ] A one-liner footnote is added to [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) linking here, noting that the signup path depends on this query being callable without auth.
- [ ] The fifth row is added to the "functions already present" audit table in [`MOBILE-PARITY-FIX-R2.md §4.2`](./MOBILE-PARITY-FIX-R2.md) so the next agent inherits a correct inventory.

---

## 9. Why this is its own plan rather than a footnote on an earlier one

Each of the four fix plans in this series targets a distinct user-visible failure, a distinct handler, a distinct failure mechanism, and a distinct set of remediation options. Bundling them into a single plan would make the diagnostics ambiguous ("which of the four did we actually fix?") and make the acceptance criteria un-auditable.

The shared root cause — web, mobile, and admin repos sharing one Convex deployment — is documented in [`MOBILE-PARITY.md §Longer-term`](./MOBILE-PARITY.md) and is the only true long-term fix. The four plans in this series treat the symptoms; splitting deployments (or consolidating into a monorepo with one `convex/` directory, as [`ndm/docs/changes/ADMIN_SCHEMA_SYNC_PROMPT.md §Long-term fix`](../changes/ADMIN_SCHEMA_SYNC_PROMPT.md#L196) recommends) treats the disease.

---

## 10. References

- Mobile signup caller: [`ndm/app/(auth)/signup.tsx:130-132`](../../app/(auth)/signup.tsx#L130-L132)
- Mobile forgot-password caller: [`ndm/app/(auth)/forgot-password.tsx:54`](../../app/(auth)/forgot-password.tsx#L54)
- Reference implementation (known-working, auth-free): [`ndm/convex/creators.ts:6-15`](../../convex/creators.ts#L6-L15)
- Known drift catalog (lists `creators:isDeletedByEmail` as historically wiped by cross-repo deploys): [`ndm/docs/changes/ADMIN_SCHEMA_SYNC_PROMPT.md:179`](../changes/ADMIN_SCHEMA_SYNC_PROMPT.md#L179) and [`§Long-term fix`](../changes/ADMIN_SCHEMA_SYNC_PROMPT.md#L196)
- Companion fix plans: [`MOBILE-PARITY.md`](./MOBILE-PARITY.md), [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md), [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md), [`MOBILE-PARITY-FIX-TRANSCRIBE.md`](./MOBILE-PARITY-FIX-TRANSCRIBE.md)
- Mobile function inventory: [`ndm/docs/01-mobile-app/00-Overview-Mobile.md`](../01-mobile-app/00-Overview-Mobile.md) §Convex Backend
