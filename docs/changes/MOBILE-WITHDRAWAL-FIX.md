# Mobile Wise Withdrawal `withdrawals.create` Validator Mismatch — Fix Plan — 2026-04-23

> **Code fix landed 2026-04-23 — pending user-side `npx convex deploy`.** Web's `convex/withdrawals.ts create` mutation now accepts BOTH the legacy web shape `{creatorId, amount, payoutMethod, accountDetails}` AND the mobile Wise-refactored shape `{creatorId, amount, wiseEmail}`. All three shape-related args are `v.optional(...)` at the validator layer; the handler normalizes either into a canonical `wise_email` withdrawal.
>
> **Why dual-shape rather than mobile-only:** the web wallet UI in this repo (`app/wallet/page.tsx`) already calls `createWithdrawal({creatorId, amount, payoutMethod: 'wise_email', accountDetails: <email>})`. Replacing wholesale with the mobile signature would have broken the web flow. The user explicitly asked to "fix mobile without breaking the other pipeline and features," so the chosen pattern was the same dual-shape validator already used elsewhere in this repo (see [`convex/r2.ts generateUploadUrl`](../../convex/r2.ts) for the canonical example).
>
> **Auth note:** The doc's mobile reference includes `requireAuth(ctx)` and a creator-ownership check. The web version doesn't currently have those — adding them risks breaking the web wallet flow which Clerk-authenticates differently. They're not part of this PR; flag for a follow-up security pass.
>
> Schema unchanged. See §5 and §6 for diagnostics.

> Fifth fix plan in the series. Read the preceding plans in order first — they share the same root-cause framing (one Convex deployment shared by web + mobile + admin) and the same scope boundary (no schema edits) that this one extends:
>
> - [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) — index and shared-deployment framing
> - [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md) — R2 upload action
> - [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md) — interview-step mutation
> - [`MOBILE-PARITY-FIX-TRANSCRIBE.md`](./MOBILE-PARITY-FIX-TRANSCRIBE.md) — transcription action
> - [`MOBILE-PARITY-FIX-SIGNUP-ISDELETED.md`](./MOBILE-PARITY-FIX-SIGNUP-ISDELETED.md) — signup query

## For the implementing agent

**You will be working in the web repo's `convex/` folder, not this mobile repo.** This plan file lives in `ndm/docs/plans/` so the human can hand it to you alongside the mobile-repo reference implementation. All paths starting with `convex/` below mean the **web repo's** `convex/` folder unless explicitly prefixed `ndm/`.

Your job: replace the web repo's `convex/withdrawals.ts` `create` mutation with the mobile repo's current (Wise-refactored) version, redeploy to `energetic-panther-693`, and verify mobile withdrawals work again. **Do not touch `convex/schema.ts`** — this is a function-signature divergence, not a schema bug.

---

## 1. The observed failure

Creators on the mobile Google Play APK who tap **Withdraw** in the wallet screen, enter a Wise email, and confirm an amount get this server-side error in the Convex logs:

```
ArgumentValidationError: Object is missing the required field `accountDetails`.
Consider wrapping the field validator in `v.optional(...)` if this is expected.

Object: { amount: 10.0, creatorId: "j575mye26yep6ahq484je4epwd84qgs8", wiseEmail: "stevenmadali17@gmail.com" }

Validator: v.object({
  accountDetails: v.string(),
  amount: v.float64(),
  creatorId: v.id("creators"),
  payoutMethod: v.union(
    v.literal("gcash"),
    v.literal("maya"),
    v.literal("bank_transfer"),
    v.literal("wise_email")
  )
})
```

This is a **Convex argument validator error**, not a runtime throw inside the handler. Convex rejected the call before the handler ran, because the mobile client sent fields the deployed validator does not match.

### What the validator tells us

The deployed `withdrawals.create`:

1. **Requires `accountDetails`** from the caller (`v.string()`, not optional)
2. **Requires `payoutMethod`** from the caller, with a union including `"gcash"` and `"maya"`
3. Has only those four args in its validator; no `wiseEmail` arg

The mobile client sends `{ creatorId, amount, wiseEmail }` — no `accountDetails`, no `payoutMethod`.

### Why those two functions diverged

The Wise refactor (recorded in [`ndm/docs/payments/wise-integration.md:44`](../payments/wise-integration.md#L44)) **intentionally**:

- Removed `gcash` and `maya` from the `payoutMethod` union — Negosyo Digital pays out only via Wise.
- Made the client signature `{ creatorId, amount, wiseEmail }` — `accountDetails` is now constructed server-side as `"Wise: ${wiseEmail}"` from the email, and `payoutMethod` is hardcoded to `"wise_email"` inside the handler.

The deployed validator is an older, pre-refactor version. It was either:

- Never updated on the web/admin repo, or
- Updated and then reverted by an unrelated PR that re-imported a stale `withdrawals.ts`, or
- Replaced when someone on the web side deployed without first pulling in the refactored function from the mobile repo.

In all three cases the fix is the same: align the web's `withdrawals.create` with the mobile-repo source of truth.

---

## 2. Where the divergence lives

### 2.1 Mobile's source of truth (this repo, known-working)

[`ndm/convex/withdrawals.ts:17-82`](../../convex/withdrawals.ts#L17-L82):

```ts
export const create = mutation({
  args: {
    creatorId: v.id("creators"),
    amount: v.number(),
    wiseEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Rate limit: max 3 withdrawal requests per hour per creator
    await checkRateLimit(ctx, {
      key: `withdrawal:${args.creatorId}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });

    if (args.amount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero");
    }

    const creator = await ctx.db.get(args.creatorId);
    if (!creator) throw new Error("Creator not found");

    // Verify the caller owns this creator account
    if (creator.clerkId !== identity.subject) {
      throw new Error("Forbidden: you can only withdraw from your own account");
    }

    const currentBalance = creator.balance ?? 0;
    if (args.amount > currentBalance) {
      throw new Error("Insufficient balance");
    }

    // Deduct balance immediately (optimistic)
    await ctx.db.patch(args.creatorId, {
      balance: currentBalance - args.amount,
    });

    // Sanitize email input
    const wiseEmail = sanitizeEmail(args.wiseEmail);

    const accountHolderName = `${creator.firstName ?? ""} ${creator.lastName ?? ""}`.trim() || "Creator";
    const accountDetails = `Wise: ${wiseEmail}`;

    const withdrawalId = await ctx.db.insert("withdrawals", {
      creatorId: args.creatorId,
      amount: args.amount,
      payoutMethod: "wise_email",
      accountDetails,
      wiseEmail,
      accountHolderName,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule Wise transfer — runs asynchronously after this mutation
    await ctx.scheduler.runAfter(0, internal.wise.initiateTransfer, {
      withdrawalId,
      accountHolderName,
      wiseEmail,
      amountPHP: args.amount,
    });

    return withdrawalId;
  },
});
```

Mobile call site that produces the failing payload: [`ndm/app/(app)/(tabs)/wallet.tsx:197-201`](../../app/(app)/(tabs)/wallet.tsx#L197-L201):

```ts
await createWithdrawal({
  creatorId: creator._id,
  amount,
  wiseEmail: form.wiseEmail.trim(),
});
```

Mobile's schema for the `withdrawals` table (also the source of truth) is at [`ndm/convex/schema.ts:354-381`](../../convex/schema.ts#L354-L381). The relevant excerpt:

```ts
withdrawals: defineTable({
  creatorId: v.id("creators"),
  amount: v.number(),
  payoutMethod: v.union(v.literal("wise_email"), v.literal("bank_transfer")),
  accountDetails: v.string(),
  wiseEmail: v.optional(v.string()),
  accountHolderName: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),
  ...
})
```

**`payoutMethod` is `wise_email | bank_transfer`** — `gcash` and `maya` are not in the schema. Records that the deployed function attempts to insert with `payoutMethod: "gcash"` or `"maya"` would also fail schema validation server-side.

### 2.2 Web's deployed source (per the error)

The argument validator decoded from the error is:

```ts
args: {
  accountDetails: v.string(),
  amount: v.float64(),
  creatorId: v.id("creators"),
  payoutMethod: v.union(
    v.literal("gcash"),
    v.literal("maya"),
    v.literal("bank_transfer"),
    v.literal("wise_email")
  ),
}
```

This is the pre-Wise-refactor signature. There is no `wiseEmail` arg, so when mobile sends one, Convex's validator rejects the entire call **before** the handler runs.

---

## 3. Diagnostic steps — run these first

Same diagnostics-first discipline as the prior plans. Do not change code until §3.2 confirms the deployed function actually has the validator the error claims.

### 3.1 Confirm deployment target

```bash
# In the web repo
npx convex env get CONVEX_DEPLOYMENT
```

Expect `prod:energetic-panther-693`. Stop if different.

### 3.2 Read the deployed function spec

```bash
npx convex function-spec
```

Find `withdrawals:create` in the output. The args block should match the validator decoded from the error in §2.2. Confirm:

- `accountDetails: v.string()` (required, not optional)
- `payoutMethod` union includes `gcash` and `maya`
- No `wiseEmail` arg exists

If the deployed shape **doesn't** match the error (e.g. it already has `wiseEmail`), the production Convex deployment may have drifted between the error capture and your check, or the deployment target is wrong. Re-run §3.1 and re-capture an error from the device before continuing.

### 3.3 Tail prod logs while reproducing

```bash
npx convex logs --prod --tail
```

On a real device or Expo dev build, log in as a creator with at least ₱100 balance, open the wallet, tap Withdraw, enter a Wise email, and confirm. The same `ArgumentValidationError` should appear in the logs with the new request ID. Capture the request ID into §6.

### 3.4 Open the web repo's `convex/withdrawals.ts`

This is the source whose deploy produced the bad bundle. The export named `create` will have the legacy validator. Note any **other** divergences between the web file and the mobile file — different rate-limit windows, missing balance check, missing audit log, etc. — and decide whether to inherit them in §4 or replace wholesale.

### 3.5 Verify the deployed schema's `withdrawals.payoutMethod` union

```bash
npx convex function-spec
# or open the deployed schema in the Convex dashboard
```

Confirm the deployed `withdrawals` table's `payoutMethod` union. Two possibilities:

- **Already aligned** with mobile's `wise_email | bank_transfer` → only the function needs fixing. Proceed to §4.
- **Still includes `gcash` / `maya`** → the deployed schema is also legacy. The function fix in §4 will work (the `wise_email` literal it inserts is a member of both unions), but a follow-up schema cleanup is needed. **Do not bundle the schema cleanup into this PR** — schema changes on the shared deployment require explicit coordination per [`MOBILE-PARITY-FIX-R2.md §5`](./MOBILE-PARITY-FIX-R2.md). Open a separate ticket and reference it in §5 of this doc.

---

## 4. Fix

### 4.1 Replace the web's `withdrawals.create` body

Open the web repo's `convex/withdrawals.ts` and replace the entire `export const create = mutation({...})` block with the body from §2.1 verbatim.

Verify these imports are present at the top of the web file (add what's missing):

```ts
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAuth, requireAdmin } from "./lib/auth";
import { checkRateLimit } from "./lib/rateLimit";
import { sanitizeEmail } from "./lib/sanitize";
```

If `convex/lib/rateLimit.ts` or `convex/lib/sanitize.ts` is missing in the web repo, copy them from the mobile repo at [`ndm/convex/lib/rateLimit.ts`](../../convex/lib/rateLimit.ts) and [`ndm/convex/lib/sanitize.ts`](../../convex/lib/sanitize.ts). They have no other dependencies.

### 4.2 Add a header comment

Above `export const create`, add:

```ts
// Mobile-referenced — do not remove or tighten args. Called from the wallet
// screen; signature is { creatorId, amount, wiseEmail }. The handler derives
// `accountDetails` and `payoutMethod` server-side. DO NOT re-add `gcash` /
// `maya` to the union — those payout methods were intentionally removed in
// the Wise refactor (see ndm/docs/payments/wise-integration.md).
// See docs/plans/MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md for the incident
// that caused the legacy variant to block mobile withdrawals on 2026-04-23.
```

This is the same convention as the four prior fix plans. The goal is to make a future cleanup PR that "simplifies" the args explicitly think before reverting.

### 4.3 Confirm the related exports the mutation depends on

`withdrawals.create` schedules `internal.wise.initiateTransfer` (at the end of the mobile body). Confirm the web repo has:

- An export `initiateTransfer` in `convex/wise.ts` whose validator accepts `{ withdrawalId, accountHolderName, wiseEmail, amountPHP }` (matches the call from §2.1).
- The `Wise` API client in `services/wise.ts` (or wherever the web equivalent lives) that handles `createEmailRecipient → createQuote → createTransfer → fundTransfer`.

If `internal.wise.initiateTransfer` is missing or has a different signature in the web repo, the withdrawal will succeed at the mutation level but the scheduled transfer will fail asynchronously. That is a separate runtime failure mode covered by [`MOBILE-PARITY-FIX-TRANSCRIBE.md`](./MOBILE-PARITY-FIX-TRANSCRIBE.md)'s scheduler-arg-drift section, paragraph for paragraph. If you find it, fix it in the same PR — the inconsistency would surface immediately on the next withdrawal.

The mobile reference for `initiateTransfer` is at [`ndm/convex/wise.ts`](../../convex/wise.ts) and the API client is at [`ndm/services/wise.ts`](../../services/wise.ts).

### 4.4 Do not change the schema

`convex/schema.ts` stays untouched. The mobile schema's `payoutMethod` union (`wise_email | bank_transfer`) is the correct end state, but you cannot unilaterally narrow the deployed schema's union — narrowing a union on a shared deployment that has historical data with the dropped values would orphan those rows. If §3.5 found legacy values in the deployed schema's union, log it in §5 and open a follow-up ticket for a coordinated cleanup migration.

---

## 5. Schema findings — record here before changing anything

> Schema unchanged — the deployed `withdrawals.payoutMethod` is `v.string()` ([`convex/schema.ts:254`](../../convex/schema.ts#L254)), already permissive enough to accept all four legacy values plus the new mobile-canonical `wise_email`. No coordinated cleanup needed; both web and mobile insert values that pass the schema validator.

---

## 6. Captured diagnostics — fill in before implementing

> **Exact ArgumentValidationError observed:**
> Mobile reported `ArgumentValidationError: Object is missing the required field 'accountDetails'` with mobile payload `{ amount: 10.0, creatorId: "j575mye26yep6ahq484je4epwd84qgs8", wiseEmail: "stevenmadali17@gmail.com" }`. Validator rejected the call before the handler ran (same class as MOBILE-AUDIO-SUBMISISONS.md and MOBILE-R2-FIX).
>
> **Web repo's previous `withdrawals.create` args block:**
> ```ts
> args: {
>   creatorId: v.id('creators'),
>   amount: v.number(),
>   payoutMethod: v.union(v.literal('gcash'), v.literal('maya'), v.literal('bank_transfer'), v.literal('wise_email')),
>   accountDetails: v.string(),
> }
> ```
>
> **Whether the deployed schema's `withdrawals.payoutMethod` union still contains `gcash` / `maya`:**
> Schema declares `payoutMethod: v.string()` (no union — string for cross-deploy safety). Both legacy and Wise-only values pass schema validation. No schema cleanup needed.
>
> **Whether `convex/wise.ts` exports `initiateTransfer`:**
> The web repo doesn't have a separate `convex/wise.ts`. The Wise transfer scheduling lives in [`convex/withdrawals.ts processWiseTransfer`](../../convex/withdrawals.ts) which the create mutation already schedules via `internal.withdrawals.processWiseTransfer({ withdrawalId })` (see line 60). The arg shape is `{ withdrawalId }` (one arg, looked up via `getByIdInternal`), not the mobile-doc shape `{ withdrawalId, accountHolderName, wiseEmail, amountPHP }`. The web pattern is functionally equivalent — `processWiseTransfer` reads everything else from the row. No alignment work needed for this PR.

---

## 7. Deploy

1. `npx convex deploy --dry-run` — inspect output. The "functions to be deleted" section **must be empty**. If non-empty, each entry is a function the mobile or admin app calls by name; pull it into the web repo's `convex/` folder before deploying. Same rule as every prior plan in this series.
2. `npx convex deploy`.
3. On a real device or Expo dev build, sign in as a creator with available balance, navigate to the wallet, tap Withdraw, enter a Wise email, and confirm. Watch `npx convex logs --prod --tail` — you should see:
   - `withdrawals:create` succeed (no `ArgumentValidationError`)
   - The withdrawal row appear in the database with `payoutMethod: "wise_email"`, `status: "pending"`
   - `wise.initiateTransfer` scheduled and run, with the Wise API call sequence (`createEmailRecipient` → `createQuote` → `createTransfer` → `fundTransfer`) succeeding
4. Confirm the creator's balance was deducted by exactly the withdrawal amount.
5. Confirm the Wise webhook (or the existing status-check cron, whichever is wired up on the deployment) eventually moves the withdrawal to `status: "completed"`. If this lags, that's a separate concern handled by the existing status-check infrastructure — out of scope for this fix.

---

## 8. Acceptance checklist

- [ ] §6 is filled in with real captured diagnostics.
- [ ] Web repo `convex/withdrawals.ts` `create` mutation accepts exactly `{ creatorId, amount, wiseEmail }`. No `accountDetails` arg. No `payoutMethod` arg. Mobile-referenced header comment in place.
- [ ] Web repo `convex/lib/rateLimit.ts` and `convex/lib/sanitize.ts` exist (copied from mobile if absent).
- [ ] Web repo `convex/wise.ts` exports `internal.wise.initiateTransfer` with the exact arg shape `{ withdrawalId, accountHolderName, wiseEmail, amountPHP }`. If it didn't, it has been aligned in the same PR.
- [ ] `convex/schema.ts` is **unchanged**. If §5 was filled in, a follow-up ticket exists and is linked there.
- [ ] `npx convex deploy --dry-run` shows zero "functions to be deleted" before the actual deploy.
- [ ] An end-to-end withdrawal on a real device produces a `pending` withdrawal row, deducts the creator's balance, and eventually completes via the Wise transfer pipeline.
- [ ] No GCash- or Maya-related code paths were re-introduced. The Wise refactor's intent is preserved.
- [ ] One-liner footnote added to [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) linking here, noting that this was the fifth instance of the shared-deployment drift surfacing as a user-blocking failure.

---

## 9. Why a fifth plan rather than a single bundled fix

Each of the five fix plans in this series describes a distinct user-visible failure with a distinct call site, distinct failure mechanism, and distinct verification. Bundling them produces ambiguous diagnostics ("which one did the deploy actually fix?") and a single huge acceptance checklist that's harder to honor.

The shared root cause — three repos (web, mobile, admin) sharing one Convex deployment — is the only true long-term fix and is documented in [`MOBILE-PARITY.md §Longer-term`](./MOBILE-PARITY.md). The five plans treat symptoms; splitting deployments (or consolidating into a monorepo with one `convex/` directory per [`ndm/docs/changes/ADMIN_SCHEMA_SYNC_PROMPT.md §Long-term fix`](../changes/ADMIN_SCHEMA_SYNC_PROMPT.md#L196)) treats the disease.

The pattern of the failures is now established enough to be worth naming explicitly: **after every cross-repo `npx convex deploy`, run a sanity sweep against the five known divergence points** (R2, submissions.update, transcribeMedia, isDeletedByEmail, withdrawals.create) before considering the deploy done. Each plan in this series gives the implementing agent the exact reference signature and call site to compare against.

---

## 10. References

- Mobile call site (the failing payload): [`ndm/app/(app)/(tabs)/wallet.tsx:197-201`](../../app/(app)/(tabs)/wallet.tsx#L197-L201)
- Mobile reference implementation (known-working, Wise-refactored): [`ndm/convex/withdrawals.ts:17-82`](../../convex/withdrawals.ts#L17-L82)
- Mobile schema (canonical `withdrawals` table shape): [`ndm/convex/schema.ts:354-381`](../../convex/schema.ts#L354-L381)
- Mobile Wise scheduling target: [`ndm/convex/wise.ts`](../../convex/wise.ts)
- Mobile Wise API client (no Convex dependencies): [`ndm/services/wise.ts`](../../services/wise.ts)
- Wise refactor history (records that `gcash` / `maya` were intentionally removed): [`ndm/docs/payments/wise-integration.md:44`](../payments/wise-integration.md#L44)
- Wise payment flow (full sequence diagram + error matrix): [`ndm/docs/payments/WISE_PAYMENT_FLOW.md`](../payments/WISE_PAYMENT_FLOW.md)
- Companion fix plans (read in order): [`MOBILE-PARITY.md`](./MOBILE-PARITY.md), [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md), [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md), [`MOBILE-PARITY-FIX-TRANSCRIBE.md`](./MOBILE-PARITY-FIX-TRANSCRIBE.md), [`MOBILE-PARITY-FIX-SIGNUP-ISDELETED.md`](./MOBILE-PARITY-FIX-SIGNUP-ISDELETED.md)
- Mobile function inventory: [`ndm/docs/01-mobile-app/00-Overview-Mobile.md`](../01-mobile-app/00-Overview-Mobile.md) §Convex Backend
