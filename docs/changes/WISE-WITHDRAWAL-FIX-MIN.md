# Wise Fee Absorption + Withdrawal Minimum Removal — Web Platform Sync Plan — 2026-04-23

> Sixth plan in the MOBILE-PARITY series. **Unlike the prior five, this one is not a regression triage** — it documents a deliberate behavior change that has just been shipped in the **mobile** repo and that the **web** repo must now adopt to keep both repos in lockstep on the shared Convex deployment `energetic-panther-693`.
>
> Read the prior plans for shared root-cause framing if you haven't already:
>
> - [`MOBILE-PARITY.md`](./MOBILE-PARITY.md)
> - [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md)
> - [`MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md`](./MOBILE-PARITY-FIX-SUBMISSIONS-UPDATE.md)
> - [`MOBILE-PARITY-FIX-TRANSCRIBE.md`](./MOBILE-PARITY-FIX-TRANSCRIBE.md)
> - [`MOBILE-PARITY-FIX-SIGNUP-ISDELETED.md`](./MOBILE-PARITY-FIX-SIGNUP-ISDELETED.md)
> - [`MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md`](./MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md) — **dependency**: this plan assumes the validator parity fix in that doc has already landed and `withdrawals.create` is back to the `{ creatorId, amount, wiseEmail }` signature.

## For the implementing agent

**You will be working in the web repo's `services/`, `convex/`, and `__tests__/` folders.** This plan file lives in `ndm/docs/plans/` so the human can hand it to you alongside the mobile-repo reference. All paths starting with `convex/`, `services/`, or `__tests__/` below mean the **web repo's** equivalents unless explicitly prefixed `ndm/`.

Your job is two coordinated changes:

1. **Wise fee absorption** — switch the Wise quote API call from `sourceAmount` to `targetAmount` so withdrawal recipients receive the **full** PHP amount they requested. The platform's PHP balance covers the Wise transfer fee instead of the recipient.
2. **Remove the ₱100 hardcoded minimum withdrawal** — the only floor enforced is `amount > 0`. Update any stale UI hints, tests, settings rows, and docs that reference ₱100 as the minimum.

Both changes are intentional product decisions. Do not "fix" them back to the prior behavior on the assumption that they're regressions.

---

## 1. Background: why these two changes ship together

A creator on the mobile APK requested a ₱100 withdrawal. Wise debited the platform's PHP balance ₱100 and the recipient received **₱83.22** — a ~17% effective fee, dominated by Wise's fixed-fee component at small amounts. This was the result of Wise's `sourceAmount` semantics: "send 100 from source, recipient gets 100 minus fee".

Two product decisions followed:

1. **Switch to `targetAmount`** so the creator receives the full requested amount. The platform absorbs the Wise fee. This makes the withdrawal experience match what the creator sees in the app.
2. **Remove the ₱100 minimum** because the previous floor was set primarily to limit fee burn at tiny withdrawals. With targetAmount in effect, there is no longer a creator-facing fee to gate, and we want creators to be able to cash out any positive amount they have. This is a UX choice — operationally, fee burn is now a platform concern that can be mitigated by other means later (raising minimum, batching, fee rebates) without the creator-facing complexity.

The mobile repo has shipped both changes. The web repo's `services/wise.ts` and `convex/withdrawals.ts` need to match so that whoever deploys next does not silently revert to the old behavior.

---

## 2. What landed in the mobile repo (your reference)

### 2.1 `services/wise.ts` — `createQuote` body now uses `targetAmount`

**Before** ([prior `services/wise.ts`](../../services/wise.ts)):

```ts
const body: Record<string, unknown> = {
  profile: config.profileId,
  source: "PHP",
  target: "PHP",
  sourceAmount: amountPHP,   // ← old: recipient gets amountPHP minus fee
  rateType: "FIXED",
  type: "REGULAR",
};
```

**After** (current mobile [`ndm/services/wise.ts:214-235`](../../services/wise.ts#L214-L235)):

```ts
const body: Record<string, unknown> = {
  profile: config.profileId,
  source: "PHP",
  target: "PHP",
  targetAmount: amountPHP,   // ← new: recipient gets exactly amountPHP, platform pays fee
  rateType: "FIXED",
  type: "REGULAR",
};
```

The rest of the function (the conditional `payOut`/`preferredPayIn`/`sourceBalanceId` block, the `wiseRequest` call) is unchanged.

The JSDoc above the function was also updated to document the new behavior. Copy the current mobile JSDoc verbatim — it explicitly warns the next reader not to revert to `sourceAmount` and explains the fee-absorption intent.

### 2.2 `__tests__/services/wise.test.ts` — assertion now expects `targetAmount`

The Jest test was updated so the request body assertion checks `body.targetAmount === 1000` instead of `body.sourceAmount === 1000`, and also asserts `body.sourceAmount` is `undefined`. The mock quote response was also adjusted so `sourceAmount > targetAmount` reflects realistic fee math.

Reference at [`ndm/__tests__/services/wise.test.ts:196-225`](../../__tests__/services/wise.test.ts#L196-L225).

### 2.3 ₱100 minimum removed across mobile

The mobile production code never enforced ₱100 server-side — the `withdrawals.create` mutation only checks `amount <= 0` ([`ndm/convex/withdrawals.ts:33-35`](../../convex/withdrawals.ts#L33-L35)). The hardcoded ₱100 hints lived in tests and one stale settings doc. They were removed.

The wallet UI's withdraw button is disabled only on `balance <= 0 || isOffline` (no ₱100 check anywhere) — see [`ndm/app/(app)/(tabs)/wallet.tsx:291`](../../app/(app)/(tabs)/wallet.tsx#L291).

---

## 3. Diagnostic steps — run these first

Same diagnostics-first pattern as the prior plans. Before changing code, confirm what the web repo currently has so you understand the delta.

### 3.1 Confirm deployment target

```bash
# In the web repo
npx convex env get CONVEX_DEPLOYMENT
```

Expect `prod:energetic-panther-693`. Stop if different.

### 3.2 Check that the prior parity fix has shipped

The validator-parity fix from [`MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md`](./MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md) **must** be in production already, otherwise mobile withdrawals are still broken at the validator level and the changes in this plan have nothing to test against.

```bash
npx convex function-spec | grep -A 20 "withdrawals:create"
```

Confirm:

- Args are `{ creatorId, amount, wiseEmail }` — no `accountDetails`, no `payoutMethod`
- The handler derives `accountDetails` and `payoutMethod` server-side
- A successful withdrawal can be created from a real device end-to-end

If those assertions fail, **stop and finish the prior plan first**. Do not bundle this work into the parity fix PR.

### 3.3 Read the web's current `services/wise.ts` `createQuote`

Open the web repo's `services/wise.ts` (or wherever the web equivalent of the Wise client lives). Find the `createQuote` function and confirm whether it currently sends `sourceAmount` or `targetAmount`.

- **If `sourceAmount`** → this is the same broken behavior the mobile repo just fixed. Apply §4.1 below.
- **If `targetAmount` already** → someone may have already applied this fix on the web side. Verify the JSDoc and test assertions match the mobile repo's, but no functional code change is needed. Skip §4.1 and only do §4.2 onward.

### 3.4 Inspect the web repo for hardcoded ₱100 references

Run a case-insensitive grep across the web repo:

```bash
rg -i "(minimum.{0,20}withdraw|min.{0,5}₱100|amount.{0,15}<.{0,5}100|\\bMIN_WITHDRAWAL\\b)"
```

Note every hit. Each one needs to either be removed or rewritten to reflect "amount > 0 only". Common locations:

- Wallet / withdrawal UI components — disabled state on the withdraw button, validation hint text
- Form-validation handlers — `if (amount < 100)` guards
- API routes / Convex mutations — server-side `enforceMinimum(...)` helpers
- Tests — mock data and assertions
- Settings table row `min_withdrawal` — if seeded to 100, decide whether to remove the row entirely or leave it at a value that no code reads (see §4.3)
- Internal documentation (READMEs, runbooks, the `WISE_PAYMENT_FLOW.md` equivalent if the web repo has one)

### 3.5 Verify the platform's Wise PHP balance can absorb fees

The platform now pays the fee on every withdrawal. With `sourceAmount`, a ₱500 withdrawal cost the platform exactly ₱500; with `targetAmount`, it costs ~₱500 + fee (e.g. ~₱515). At low volume this is invisible; at scale it materially changes the platform's PHP funding cadence.

Check the current Wise PHP balance against the sum of pending withdrawals:

1. Open https://wise.com → PHP balance
2. In Convex, run a quick query:
   ```bash
   npx convex run withdrawals:getByStatus '{"status":"pending"}'
   ```
3. Sum the `amount` field of the pending withdrawals
4. The PHP balance should exceed `sum × 1.2` to give a 20% buffer for fees. If it doesn't, top up the PHP balance before deploying this change, otherwise the next withdrawal cycle will fail to fund.

Record the numbers in §6 below.

---

## 4. Fix — what to change

### 4.1 `services/wise.ts` — switch to `targetAmount`

Open the web repo's `services/wise.ts`. In the `createQuote` function, change `sourceAmount: amountPHP` to `targetAmount: amountPHP`. Update the JSDoc to match the mobile reference (paste verbatim from [`ndm/services/wise.ts:206-218`](../../services/wise.ts#L206-L218)).

Add a header comment that pins the intent, matching the convention from prior plans:

```ts
// Mobile-referenced — DO NOT switch back to sourceAmount. Wise charges a
// transfer fee on every quote; with targetAmount the recipient receives the
// full amountPHP and the platform's PHP balance is debited amountPHP + fee.
// With sourceAmount the fee is silently deducted from amountPHP and creators
// receive less than they withdrew (e.g. ₱100 → ₱83.22).
// See docs/plans/MOBILE-PARITY-FIX-WISE-FEE-AND-MIN.md for the incident
// that prompted this change on 2026-04-23.
```

If the web repo's `WiseQuote` type is missing the `fee` field, leave it for now — you don't strictly need it for the change to ship. Recording the fee per-withdrawal is the recommended follow-up in §5.2 below but is not in scope for this PR.

### 4.2 Remove every hardcoded ₱100 in the web repo

For each grep hit from §3.4, apply the matching change:

| Location pattern | Change |
|---|---|
| Withdraw button disabled on `balance < 100` | Change to `balance <= 0` |
| UI hint "Minimum withdrawal is ₱100" | Replace with "No balance available to withdraw" (or remove the conditional render entirely if the button's disabled state already conveys this) |
| Form handler `if (amount < 100) throw / setError(...)` | Remove the branch — leave only `if (amount <= 0) ...` and `if (amount > balance) ...` |
| Server-side mutation `if (amount < 100) throw ...` | Remove the branch. Leave only `if (amount <= 0) throw new Error("Withdrawal amount must be greater than zero")` |
| Tests asserting `Minimum withdrawal is ₱100` | Replace with assertions that match the new "amount > 0 only" rule |
| `min_withdrawal` row in `settings` table | If currently present, delete the row OR leave it but stop reading it. **Do not** lower it to a different small number without explicit approval — the agreement is "no fixed minimum". |
| README / runbook mentions of ₱100 | Update to reflect "any positive amount" |

Use the mobile repo's current state as the canonical reference for what the post-change code should look like:

- Wallet UI disable rule: [`ndm/app/(app)/(tabs)/wallet.tsx:291`](../../app/(app)/(tabs)/wallet.tsx#L291)
- Wallet form validation: [`ndm/app/(app)/(tabs)/wallet.tsx:173-193`](../../app/(app)/(tabs)/wallet.tsx#L173-L193)
- Mutation amount check: [`ndm/convex/withdrawals.ts:33-35`](../../convex/withdrawals.ts#L33-L35)
- Test for amount validation: [`ndm/__tests__/convex/withdrawals.test.ts`](../../__tests__/convex/withdrawals.test.ts)

### 4.3 What to do with the `min_withdrawal` settings row

The `settings` table has historically held a `min_withdrawal` key (still documented in [`ndm/convex/schema.ts:519`](../../convex/schema.ts#L519) as an example). The mobile mutation never reads it. The web mutation may or may not — check.

- **If web's `withdrawals.create` reads `settings.min_withdrawal`**: remove that read in the same change as §4.2. Otherwise the deployed setting silently re-enforces the floor and contradicts the UI.
- **If nothing reads it**: the row can stay or be deleted, your choice. Deleting is cleaner. If you delete, document it in §6.

### 4.4 Do not touch the schema

Reaffirming the same scope boundary as every prior plan in this series: **`convex/schema.ts` stays untouched**. None of the changes here require a schema edit. The optional `platformFeePHP` field mentioned in §5.2 below is a future enhancement, not part of this PR.

If §3 surfaced a real schema gap (it shouldn't — neither change requires one), record it in §7 and get explicit approval before editing.

---

## 5. Out of scope for this PR — known follow-ups

The two changes above are the entire scope. Everything below is a **deliberate non-goal** of this work, listed so the implementing agent doesn't accidentally bundle it in:

### 5.1 Raising or re-introducing a higher minimum (e.g. ₱500)

A fee-aware minimum (₱500 or ₱1,000) would meaningfully reduce the platform's per-withdrawal fee burn since the Wise fee is dominated by a fixed component. **This is a product decision, not a code one**, and has not been made yet. If it's made later, it's a one-line settings change plus matching UI hint — trivial follow-up.

For this PR, the agreed behavior is "any positive amount". Don't pre-emptively add a higher floor "just in case".

### 5.2 Recording `platformFeePHP` per withdrawal

After this PR ships, every withdrawal silently costs the platform some fee that nothing in the database tracks. For unit-economics reporting, the recommended follow-up is to:

1. Add `platformFeePHP: v.optional(v.number())` to the `withdrawals` table in the schema
2. After `createQuote(...)` returns, derive the fee as `quote.sourceAmount - quote.targetAmount` (or read `quote.fee` if Wise returns it directly)
3. Patch the withdrawal record with the derived fee via an internal mutation
4. Optionally: surface the aggregate "platform paid in Wise fees this month" on an admin dashboard

This is genuinely useful and should be planned, but it requires a schema change and is therefore separate from this PR per the scope boundary in §4.4.

### 5.3 Wise enterprise fee negotiation

Wise offers Flexible Partner Pricing for partners with significant monthly volume (typically $50k+/month equivalent). At that threshold the per-transfer fees can be negotiated downward. Worth a conversation with Wise's partner team when volume justifies it. Not something this PR can act on.

---

## 6. Captured diagnostics — fill in before implementing

> **Output of `npx convex env get CONVEX_DEPLOYMENT` (§3.1):**
> _(none recorded yet)_
>
> **Confirmation that `withdrawals.create` validator matches mobile (`{creatorId, amount, wiseEmail}`) — paste the relevant slice of `npx convex function-spec` output (§3.2):**
> _(none recorded yet)_
>
> **Web repo's current `services/wise.ts createQuote` request body — `sourceAmount` or `targetAmount`? (§3.3):**
> _(none recorded yet)_
>
> **List of every web-repo file that contains a hardcoded ₱100 minimum reference (§3.4):**
> _(none recorded yet)_
>
> **Current Wise PHP balance and sum of pending withdrawals (§3.5):**
> _(none recorded yet)_
>
> **Did the web mutation read `settings.min_withdrawal`? (§4.3):**
> _(none recorded yet)_

---

## 7. Schema findings — record here before changing anything

> _(If §3 or §4 found a real schema gap that blocks the change, paste the specifics here and get explicit approval before editing `schema.ts`. The deliberate `platformFeePHP` follow-up from §5.2 is out of scope for this PR — do not add it here.)_
>
> - _none recorded_

---

## 8. Deploy

1. `npx convex deploy --dry-run` — inspect output. The "functions to be deleted" section **must be empty**. Same rule as every prior plan.
2. `npx convex deploy`.
3. On a real device or Expo dev build, sign in as a creator with at least ₱50 of available balance. Submit a withdrawal of a small amount (e.g. ₱50). Confirm:
   - The mutation succeeds (no validator error — the prior parity fix has held).
   - The withdrawal row in Convex shows `amount: 50`, `payoutMethod: "wise_email"`, `status: "pending"`.
   - In the Wise dashboard, the corresponding quote / transfer shows `targetAmount: 50` and `sourceAmount: ~65` (50 + Wise fee). The exact fee depends on Wise's current PHP→PHP rate card.
   - When the transfer completes, the recipient receives **₱50.00** (not ₱40-something).
4. Confirm the creator's `balance` in Convex was reduced by exactly the requested amount (₱50), **not** by the larger source-side amount. The platform-paid fee does not show up on the creator's balance.
5. Confirm a withdrawal of an amount below the old ₱100 floor (e.g. ₱25) **succeeds** end-to-end. This is the primary acceptance test for the minimum-removal half of this PR.

---

## 9. Acceptance checklist

- [ ] §6 is filled in with real captured diagnostics.
- [ ] Web repo `services/wise.ts createQuote` posts `targetAmount: amountPHP` and **does not** post `sourceAmount`. JSDoc + Mobile-referenced header comment in place.
- [ ] Every grep hit from §3.4 has been resolved — no `if (amount < 100)`, no "Minimum ₱100" UI text, no test asserting a ₱100 floor.
- [ ] Server-side mutation rejects only `amount <= 0` with the message `"Withdrawal amount must be greater than zero"`. Any prior `enforceMinimum` helper that gated on ₱100 has been updated to gate on `<= 0` only.
- [ ] If the web mutation read `settings.min_withdrawal`, that read has been removed. The settings row itself can be deleted or left alone — record which in §6.
- [ ] `npx convex deploy --dry-run` shows zero "functions to be deleted" before the actual deploy.
- [ ] `convex/schema.ts` is **unchanged**. The `platformFeePHP` follow-up from §5.2 is filed as a separate ticket if applicable, not bundled in.
- [ ] End-to-end test on a real device: a ₱50 withdrawal succeeds, the creator's balance decreases by exactly ₱50, the Wise dashboard shows `targetAmount = 50` and `sourceAmount ≈ 65`, the recipient ultimately receives exactly ₱50.
- [ ] The platform's Wise PHP balance has at least 20% headroom over the sum of pending withdrawals at deploy time.
- [ ] One-liner footnote added to [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) linking here, noting that this was a deliberate behavior change (not a parity-regression triage) so the next reader doesn't conflate the categories.

---

## 10. Why this is its own plan rather than a footnote on `MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md`

The validator-parity fix in [`MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md`](./MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md) and the fee-absorption + minimum-removal change here are different categories of work and should ship as different PRs:

- **Parity fix** — restores broken production behavior to a previously-shipped baseline. Rollback story: revert the PR and you're back to the broken state, which was at least diagnosable.
- **This change** — deliberate product behavior change with a fee-burn cost trade-off. Rollback story: revert and the platform stops paying fees but creators see deductions again.

Bundling them muddles the rollback story. If the fee-absorption change has unintended cost consequences, you want to revert *just* that without re-breaking the validator. Two PRs, two clean rollback paths.

The five prior plans in this series all triaged regressions caused by the shared-deployment drift. This is the first plan in the series that documents an **intentional** change. The convention going forward should be to keep these categories visually distinct in the doc set.

---

## 11. References

- Mobile reference (current `createQuote` with `targetAmount`): [`ndm/services/wise.ts:206-235`](../../services/wise.ts#L206-L235)
- Mobile reference (current test assertions): [`ndm/__tests__/services/wise.test.ts:196-225`](../../__tests__/services/wise.test.ts#L196-L225)
- Mobile reference (server-side amount validation = `> 0` only): [`ndm/convex/withdrawals.ts:33-35`](../../convex/withdrawals.ts#L33-L35)
- Mobile reference (UI disable rule = `balance <= 0`): [`ndm/app/(app)/(tabs)/wallet.tsx:291`](../../app/(app)/(tabs)/wallet.tsx#L291)
- Wise quote API documentation: https://docs.wise.com/api-reference/quote
- Wise quote API guide (sourceAmount vs targetAmount semantics): https://docs.wise.com/guides/product/send-money/quotes
- Prior validator-parity fix (mandatory dependency): [`MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md`](./MOBILE-PARITY-FIX-WITHDRAWAL-CREATE.md)
- Index of all parity plans: [`MOBILE-PARITY.md`](./MOBILE-PARITY.md)
- Wise payment flow doc (full sequence diagram): [`ndm/docs/payments/WISE_PAYMENT_FLOW.md`](../payments/WISE_PAYMENT_FLOW.md)
