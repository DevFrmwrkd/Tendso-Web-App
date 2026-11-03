# v2 API: owners, build progress, payments, visits and inbox

The Convex contract for the owner app (`apps/mobile`), the web, and the AI
pipeline. Branch `feat/v2-backend-owners`, 2026-10-21. Everything is additive:
new optional fields, new tables, new functions. Existing flows keep working.

Use `api.*` for functions the app calls and `internal.*` for server-only ones.
Errors meant for the owner are `ConvexError` with a short plain sentence
(show `error.data`). Plain `Error`s are bugs or configuration problems.

---

## 1. Statuses and phases

### `submissions.status` (string)

Existing: `draft, submitted, in_review, approved, rejected, website_generated,
deployed, pending_payment, paid, completed, unpublished`.

New: **`deposit_paid`**: a down payment is in and a balance is still due. It is
**never** "paid in full".

**Paid in full** means the whole owner total is in. The crediting path
(`payments.creditCreatorForPayment`) has always written **`completed`** for this,
not `paid`. A full payment and a settled balance both end at `completed` and
set `paidInFullAt`. Legacy rows marked `paid` by the old admin button also
count. Use `isPaidInFull()` from `convex/lib/ownerApp.ts`, never a status
string compare. Anything that must happen exactly once, when the shop has paid
everything (for example a creator override), belongs in `paidInFullEffects()`
in `convex/payments.ts`. It runs on a full payment (stage `full`) and on the
balance (stage `balance`), never on a down payment.

Treat the money fields as the source of truth. Some `app/api` routes rewrite
`status` on a rebuild or republish (`generate-website` keepStatuses,
`publish-website` sets `deployed`, `save-content`). None of them knows about
`deposit_paid` yet. The fields survive those rewrites:

| field | meaning |
|---|---|
| `amountPaid` | pesos received so far |
| `balanceDue` | pesos still owed (0 when paid in full) |
| `depositAmount`, `depositPaidAt` | the down payment |
| `paidInFullAt` | set once, when everything is in. `paidAt` is also set if empty |

### Owner phase (derived, read-only)

`computeOwnerPhase()` gives one word for the app's home and build screens:

`draft` → `building` → `ready_to_check` → (`changes_requested`) →
`awaiting_payment` → `publishing` → `live` (or `offline`).
A legacy field-agent site that is not published yet shows `in_review`. New
paid field-agent orders use the private-preview phases above. Other values:
`rejected`.

### Saved publication policy (`publishPolicyFor`)

| source | policy | what happens |
|---|---|---|
| new ordinary paid field-agent submission or owner intake | `pay_then_publish` | Save the built website as a private preview. The linked owner signs in, checks the preview, taps "Looks good" and pays. Public publication requires full payment, current owner approval and no open change requests. A down payment alone keeps the preview private. Creator attribution and the agreed price stay with the original submission. |
| `contentSource: 'owner_app'` | `pay_then_publish` | Private preview. The owner taps "Looks good", pays in full, and then `ownerApp.publishIfReady` publishes automatically at `<slug>.sites.tendso.com`. `generatedWebsites.publish` (the admin button) refuses this source until it is paid in full, currently approved, and has no open change requests. |
| existing non-owner-app order without a saved policy; free/giveaway flow | `publish_first` | Existing publication behavior is preserved. An existing live website is not taken down by this change. Free/giveaway websites use their existing grant flow and cannot be billed. |

`submissions.publishPolicy` is optional for backwards compatibility. New paid
orders freeze `pay_then_publish` server-side; clients cannot opt out. The saved
policy takes precedence over the source default. Legacy rows are not bulk
migrated. Administrative publication must check the policy before deploying a
Worker, as well as before committing published database state.

---

## 2. Owner accounts: `convex/owners.ts`

Owners sign in with Clerk using an email code. The Clerk `convex` JWT
template must include `email` (and ideally `email_verified`).

### `api.owners.ensure` (mutation)
Call it after every sign-in. It is idempotent.
- args: `{ name?: string, phone?: string, clerkId?: string }`
- Mobile includes `clerkId` as a session consistency guard. It must match the
  authenticated subject; it never selects an owner or grants access.
- returns: `{ ownerId, email, name: string|null, created: boolean, linkedSubmissionIds: Id<'submissions'>[] }`
- Creates the `businessOwners` row, or reuses it by Clerk id. If the Clerk user
  is new but the email is known, it re-links that row to the new user.
- Links every site that has an `ownerInvites` row for this verified email
  (the email is lower-cased).
- Refuses `emailVerified === false` and affiliate (creator) logins.

### `api.owners.me` (query)
- args: `{ clerkId?: string }`. Mobile keys its query by the signed-in Clerk
  subject; a mismatch returns `null` instead of another session's account data.
- returns `null` (call `ensure`) or
  `{ owner: { _id, email, name, phone }, sites: SiteSummary[] }`
- `SiteSummary` = `{ submissionId, businessName, businessType, contentSource,
  publishPolicy, status, phase, publishedUrl|null, total, amountPaid,
  balanceDue, paidInFull, openChangeRequests, createdAt }`

### `internal.owners.inviteForSubmission({ submissionId })`
- Runs when a field agent submits (`submissions.submit`) and whenever an order
  is paid (full or down payment).
- Upserts `ownerInvites` (email, submission), and links straight away if an
  owner with that email exists.
- Sends the invite email ("Sign in with this email to see your website") once
  per order (`submissions.ownerInviteSentAt`).
- Skips `owner_app` orders and giveaway applications.

Claim tokens are retired. `businessOwners.issueClaimTokenForEmail` returns
`{ token: '' }` and mints nothing. The tables and `claimWebsite` stay so old
links do not break.

---

## 3. Owner self-serve: `convex/ownerApp.ts`

Every function checks that the signed-in owner is linked to the submission.
Uploads go through the existing `api.r2.generateUploadUrl` (the same one the
agent app uses). Pass the returned `publicUrl`. Any other URL is refused.

| function | args | returns / notes |
|---|---|---|
| `api.ownerApp.interviewQuestions` (query) | – | `[{ index, en, tl, extra }]`: 10 questions plus index 10 "Anything else? / May iba pa?" |
| `api.ownerApp.createDraft` | `{ businessType, businessName, address?, city?, province?, barangay?, coordinates?, shotListKey?, clientDraftKey? }` | `Id<'submissions'>`. `businessType` must be one of `BUSINESS_TYPES` (`lib/prospectPrefill.ts`). Status `draft`, `contentSource 'owner_app'`. Uses an active, non-self confirmed owner creator offer when present; otherwise house creator, `amount` ₱4,999, payout 0. At most 3 open drafts per owner. A mobile setup persists a stable `clientDraftKey` (1–100 letters, digits, underscores or hyphens); retries return the same linked owner-made submission before checking the draft limit. Different owners have separate key scopes. |
| `api.ownerApp.updateDraft` | `{ submissionId, businessType?, businessName?, address?, city?, province?, barangay?, coordinates?, shotListKey?, ownerName?, ownerPhone? }` | `{ ok }`. Drafts only. |
| `api.ownerApp.saveAnswer` | `{ submissionId, index 0-10, lang 'en'\|'tl', answerText?, mediaUrl?, mediaType? 'video'\|'audio', durationSec? }` | `{ answered }`. Upserts by index. Send neither text nor media to clear. Stored in `submissions.ownerInterview[]` with the canonical EN and TL question text. |
| `api.ownerApp.saveShot` | `{ submissionId, index, url, label?, extra? }` | `{ photos }`. Guided shots use index 0-9 in shot-list order. Extras use `extra: true`, index 0-9. Stored in `ownerShots[]`. |
| `api.ownerApp.removeShot` | `{ submissionId, index, extra? }` | `{ photos }` |
| `api.ownerApp.chooseDesign` | `{ submissionId, templateId, templateIds? (1-3) }` | `{ ok }`. A template code such as `business:CA`. Mobile offers three approved designs per supported business category, retaining a compatible explicitly saved legacy choice. Allowed until the owner says "Looks good". |
| `api.ownerApp.setStyle` | `{ submissionId, fontChoice?, colorChoice? }` | `{ ok }`. Font and colour come later, any time. Sets `styleUpdatedAt` so the pipeline can rebuild. |
| `api.ownerApp.submit` | `{ submissionId }` | `{ submissionId, status: 'submitted' }`. Needs a name, an address or map pin, all ten regular answers (text or recording, indices 0–9) and at least 3 photos. Index 10 is optional. Sets `photos` (guided, then extras), `interviewQa` and `transcript` (text answers) so existing readers work, and sets all four build steps to `pending`. Adds a lead row and the analytics. Schedules `internal.buildProgress.startPipeline` and the "about 20 minutes" email. Throttled: 3 a day per owner and 50 a day overall (`OWNER_APP_DAILY_LIMIT`). A double tap is a no-op. |
| `api.ownerApp.getSubmission` (query) | `{ submissionId }` | SiteSummary plus address, coordinates, `interview[]`, `shots[]`, design and style choices, `ownerApprovedAt`, `previewReadyAt`. Use it to resume a draft. |
| `api.ownerApp.getBuild` (query) | `{ submissionId }` | `{ phase, steps: [{ key, label, status, startedAt, finishedAt, error }], doneCount, estimateMinutes: 20, buildStartedAt, previewReadyAt, openChangeRequests }`. Subscribe with `useQuery`, so there is no polling. |
| `api.ownerApp.getPreview` (query) | `{ submissionId }` | `{ ready, htmlUrl, inlineHtml, isLive, publishedUrl }`. `htmlUrl` is a Convex storage URL to the built HTML, for a WebView. Only the linked owner gets it. It is not indexed or public. |
| `api.ownerApp.approvePreview` | `{ submissionId }` | `{ next: 'pay' \| 'publish' }`. "Looks good". Needs `previewReadyAt`. |
| `api.ownerApp.requestChange` | `{ submissionId, text ≤1000 }` | `Id<'changeRequests'>`. "Ask for a change". Works for any linked site that is not a draft. Before payment, it clears `ownerApprovedAt`, so the owner checks again. At most 10 open requests. |
| `internal.ownerApp.publishIfReady` | `{ submissionId }` | `{ published, reason, url? }`. Scheduled after a payment and after `building_site` finishes, so whichever comes last publishes. It does the same writes as `/api/publish-website` for a standard site: the slug once, `generatedWebsites` set to `published`, and `submission.websiteUrl`. It keeps the payment status and does **not** set `deployed`. A site that needs a Worker (custom domain) is left for the admin and an audit row is written. Sends the "live" email once. |

Change requests (table `changeRequests`: `submissionId, text, status
'open'|'done'|'dismissed', requestedBy, createdAt, resolvedAt?, resolvedBy?,
adminNote?`) show in the admin submission page (`ChangeRequests` card in the
details panel). Admin functions: `api.changeRequests.listForSubmission({ submissionId })`
and `api.changeRequests.setStatus({ id, status, adminNote? })`.

### Native owner creator codes

- `ownerApp.creatorCode({ submissionId })` returns `{ applied, editable, reason, total }` for the linked owner. `total` is the saved order amount even when no code is applied. `applied` is `null` or `{ name, code, handle, photo, listPrice, total, saving }`; totals use the saved order quote, including its unchanged domain add-on, rather than the creator's current price. Disable invoice creation while a code mutation is pending and until this query's `total` matches the payment-state query's total.
- `ownerApp.applyCreatorCode({ submissionId, code: string | null })` applies an active creator's exact referral-code namespace (trimmed, case insensitive), or removes it with `null`, returning the applied card or `null`. The server calculates the website price and existing website-only commission. Removal restores the configured house creator, list price and zero commission. It never accepts a client-supplied amount or payout.
- Changes are restricted to owner-app drafts or finished, owner-approved unpaid previews with no open changes or active build. Agent-made orders, promo/free sites, any received/deposit/credited payment, and any uncancelled payment token lock pricing. Even expired tokens are conservatively locked because the existing settlement path may still receive them; no invoices are silently invalidated. Cancelled receipt-free tokens stay cancelled.
- Self-referral is rejected by Clerk subject, owner/stored email, and normalized phone. Applying a first typed code creates the owner attribution; changing/removing the order's code never changes that first identity attribution. A new draft uses an existing active, non-self owner attribution when present; other drafts retain their original quote.
- This operation changes no payment receipt, deposit, received-money history, status, approval, or build. Down-payment and final settlement keep the quote and credit its commission once through the existing payment pipeline.

---

## 4. Build progress: `convex/buildProgress.ts` (the pipeline contract)

The four steps the owner watches, in order:

| key | label |
|---|---|
| `reading_interview` | Reading your interview |
| `writing_pages` | Writing your pages |
| `polishing_photos` | Polishing your photos |
| `building_site` | Building your site |

Step status: `pending` → `running` → `done` | `failed`. Stored on
`submissions.buildSteps[key] = { status, startedAt?, finishedAt?, updatedAt, error? }`.
Related fields: `buildStartedAt`, which is set by the first non-pending report,
and `previewReadyAt`.

**What the pipeline agent does:**
1. Replace the body of `internal.buildProgress.startPipeline({ submissionId })`
   (an internalAction that today only logs). `ownerApp.submit` schedules it.
   Read the inputs from the submission: `ownerInterview[]` (text and/or
   `mediaUrl` recordings in EN/TL), `ownerShots[]`, `shotListKey`,
   `businessType`, `templateId`/`templateIds`, `fontChoice`/`colorChoice`,
   address and coordinates.
2. Report each step:
   `ctx.runMutation(internal.buildProgress.setStep, { submissionId, step, status, error? })`.
   - `error` is a short message, stored only when `failed`.
   - Steps may run in any order. Unset steps show as `pending`.
   - It throws on a draft or an unknown submission.
3. Before reporting `building_site: 'done'`, write the site the usual way: a
   `generatedWebsites` row with `htmlStorageId` (or `htmlContent`) and
   `status: 'draft'`. That `done`:
   - sets `previewReadyAt`, so the owner sees "Ready to check";
   - emails the owner the first time ("Your site is ready to check");
   - schedules `publishIfReady`, which publishes if the owner already paid
     (for example, a rebuild after a change).
4. For a rebuild (after a change request or a font/colour change), call
   `internal.buildProgress.restart({ submissionId })`. It sets the steps back
   to `pending` and keeps the last preview, then reports the steps again.

Until a pipeline exists, an admin can stand in:
`api.buildProgress.adminSetStep({ submissionId, step, status })`.

---

## 5. Payments: `convex/ownerPayments.ts`, `MIN_DOWN_PAYMENT`

`MIN_DOWN_PAYMENT = 500` (`packages/shared/pricing.ts`). A payment is either:
- **full**: the whole owner total (`submissions.amount`);
- **deposit**: a down payment, at least ₱500 and less than the total. A
  "deposit" equal to the total becomes `full`;
- **balance**: everything left after a deposit, in one payment.

**Agent cut (Theo's rule):** the selling field agent is credited their whole
`creatorPayout` (50%) when the down payment lands. The balance credits nothing
more. This uses the existing crediting path,
`payments.creditCreatorForPayment(Impl)`, with the new `stage`:

| stage | credit agent | status | referral bonus / domain purchase |
|---|---|---|---|
| `full` (default) | yes | `completed` | yes |
| `deposit` | yes (whole cut) | `deposit_paid` | no (they wait for the balance) |
| `balance` | **no** (`creatorPaidAt` already set) | `completed` | yes |

If `stage` is absent and a deposit is outstanding, the stage is `balance`. An
admin "Mark paid" on a `deposit_paid` order therefore settles the balance and
does not pay the agent twice.

### `api.ownerPayments.getPaymentState` (query)
- args `{ submissionId }`. The linked owner, an admin, or the selling agent may call it.
- returns `{ billable: false, status }` for giveaway or comped orders, or
  `{ billable: true, status, total, amountPaid, balanceDue, paidInFull, depositPaid,
  minDownPayment, canPayFull, canPayDeposit, canPayBalance, needsApproval,
  xenditEnabled, pendingTokens: [{ token, referenceCode, kind, amount, expiresAt, checkoutUrl|null }] }`

### `api.ownerPayments.createPayToken` (mutation)
- args `{ submissionId, kind: 'full'|'deposit'|'balance', amount?, expectedTotal? }` (`amount`
  is in whole pesos and is used for `deposit` only).
- Native checkout sends `expectedTotal`, the whole-order amount currently shown. It must be finite, positive, and exactly match the saved order total before any token is created or reused, including deposit and balance requests. A changed quote asks the owner to check the latest total. Older callers may omit it.
- returns `{ token, referenceCode, kind, amount, expiresAt }`. The reference
  (`ND-XXXX-YYYY`) works for a Wise bank transfer. The token is what
  `xendit.createCheckout` takes.
- An `owner_app` site needs "Looks good" first (admins may skip this).
- A double tap reuses the open token. Tokens last 30 days.

### Expired checkout recovery

- `ownerPayments.getPaymentAttempt({ token, expectedSubmissionId? })` is an
  authenticated query. It verifies access to the token's order and reports its
  current expiry/payment/approval state for the native return screen.
- `ownerPayments.retryExpiredPayment({ token, expectedSubmissionId?, expectedTotal? })`
  verifies the payer and the current order before renewing an expired request.
  It returns `ready` with the fresh or reusable token, current amount, kind and
  submission id, or `paid`, `needs_approval` or `processing` without creating a
  second payment request. An administrative cancellation cannot be renewed.
- A confirmed deposit changes a retry to the remaining balance. Neither an
  expired full-price quote nor a recorded deposit may be charged again.
- Expired references remain available for matching a delayed transfer. Retrying
  does not erase a receipt, cancel already-received money or publish a website.
- Both public payment-page designs show **Pay again**. Signed-out visitors
  verify their email, return to the same payment page and renew as an authorized
  payer. Authentication return paths allow only the owner's workspace or a
  syntactically valid `/pay/<token>` / `/v2/pay/<token>` path.
- Native browser dismissal alone does not mean a checkout expired or that no
  money was sent. Its expired state comes from the authenticated attempt query.
- A development mobile export must set `EXPO_PUBLIC_WEB_ORIGIN` to an HTTPS
  frontend using the same development Convex deployment and Clerk test instance.
  Production checkout cannot read development payment tokens. A temporary local
  HTTPS tunnel works for device testing while its server and tunnel stay running.

### `internal.ownerPayments.applyTokenPayment` (the shared settle function)
- args `{ token, provider: 'wise'|'xendit'|'manual', triggeredBy, externalId?, amountReceived? }`
- returns `{ result: 'applied', submissionId, stage, status }`, or
  `{ result: 'duplicate' }` if the token was already paid (this makes it
  idempotent), or `{ result: 'rejected', reason }` for a cancelled token or a
  short payment.
- **Throws** when the order no longer matches the token: a changed
  price or payout, a whole-order token after a deposit, or a stale balance.
  Nothing is written, the token stays pending, and an admin decides.
- It checks the token, credits (same transaction), marks the token `paid` with
  `provider`, `paidAmount`, `externalPaymentId` (and `wiseTransactionId` for
  Wise), and cancels the other pending tokens for that order so superseded
  requests cannot settle it again.
- Wise: `payments.processDeposit` calls this function only for an exact payment
  reference and a valid PHP amount. Missing or unmatched references go to team
  verification in the admin audit log, even when only one bill has that amount.
  Amount candidates are investigation hints and never auto-credit an order.
  Down-payment and balance references are validated against their own amounts.

### Wise receiving setup and testing

- `/wise-deposit-webhook` verifies `X-Signature-SHA256` over the exact raw
  request body using `WISE_WEBHOOK_PUBLIC_KEY` before parsing or scheduling a
  receipt. Missing configuration disables the receiver; unsigned or invalid
  requests cannot change an order. This receiving check is mandatory and is
  separate from the outgoing-withdrawal webhook's rollout flag.
- Signed `X-Test-Notification: true` subscription checks are acknowledged
  without recording a payment. Recognized payment events must identify the
  configured receiving profile: `WISE_SANDBOX_PROFILE_ID` when `WISE_SANDBOX`
  is `true`, otherwise `WISE_PROFILE_ID`. Sandbox mode never falls back to the
  live profile. Unknown or mismatched receiving profiles cannot settle orders.
- Wise sandbox credentials belong to a separate sandbox account. A regular
  Wise login or live personal token does not establish a sandbox receiving
  integration. Configure the sandbox profile, receiving details, webhook public
  key and subscription before trying provider-generated test events. Keep API
  tokens server-side and out of chat or source control.
- Current receiving parsing covers `balances#credit`, credit
  `balances#update`, completed `account-details-payment#state-change`, and
  `swift-in#credit`. The newer `incoming-transfer#credited` event is not yet
  supported. Verify the subscribed schema against the actual provider payload.
  `balances#credit` contains no order reference and therefore enters team
  verification under the matching policy above.
- Isolated signed webhook fixtures and in-memory payment tests can exercise PHP
  full/deposit/balance receipts, duplicates, expiry and team review without Wise
  credentials or external side effects. They do not prove provider integration.
  Sandbox currency availability differs from production; confirm PHP receiving
  support before claiming an end-to-end PHP sandbox payment passed.

References: [Wise webhook verification](https://docs.wise.com/guides/developer/webhooks/event-handling),
[balance update payload](https://docs.wise.com/api-reference/balance/eventbalancesupdate),
[sandbox environments](https://docs.wise.com/guides/developer/environments),
[sandbox account access](https://docs.wise.com/guides/product/partner/business-account-support).

New `paymentTokens` fields: `kind`, `provider`, `paidAmount`,
`externalPaymentId`, `xenditInvoiceId`, `xenditInvoiceUrl`, `xenditExpiresAt`,
`xenditCheckoutAttempt`, `xenditCheckoutStartedAt`, `xenditCheckoutState`, `createdBy`.

---

## PHP payment practice on mobile and web

The PHP simulator is an isolated practice ledger, not a Wise sandbox or a
payment-confirmation override. It never writes real orders, payment tokens,
earnings, withdrawals or website records. It has no provider, scheduling,
publication, email or domain-purchase calls. A simulated balance cannot be
withdrawn and never becomes the business's real paid status.

### Access and entry points

- Development deployment only: both Convex system URLs must identify
  `diligent-ibex-454`. `PAYMENT_SIMULATOR_ENABLED=true` and
  `PAYMENT_SIMULATOR_ALLOWLIST=poru.fetaruvero@gmail.com` must be explicitly set
  on that deployment. Production remains disabled even if a flag is copied.
- The signed-in identity must have that positively verified email and match its
  owner record. The owner must already own the selected `[TEST] ...` business,
  with valid saved ordinary-sale pricing. The simulator creates no ownership,
  approval, quote or real checkout to gain access.
- Mobile: sign into the owner test account, select a priced `[TEST]` business
  on **Today**, then open its test-payment panel. No real preview approval or
  payment is needed to enter practice.
- Web: open the same business under **My business** and choose **Open payment
  simulator** in the test-only tools. Mobile and web share the same practice
  state for that business. Other accounts and ordinary businesses see no entry.

### Practice scenarios

1. Simulate a full payment, or a whole-peso down payment from the displayed
   minimum followed by the exact remaining balance.
2. Replay the last receipt: its simulated credit stays unchanged.
3. Reset, record a receipt with no matching reference, and confirm it in the
   simulated team-review step. No credit is added before that confirmation.
4. Reset, or start with a deposit, then expire the simulated checkout. **Pay
   again** issues a new `SIM-...` practice reference and preserves the practice
   deposit. It never creates a real payment token or hosted checkout.
5. Reset to clear the simulated amounts and visible history. Real records remain
   unchanged. The revision remains monotonic so older requests cannot apply
   after a reset. Reset remains available when the bounded history is full.

### Contract

- `paymentSimulator.get({ submissionId })` returns an eligible practice snapshot
  or `null`, and writes nothing. Initial state is virtual until an action runs.
- `paymentSimulator.run({ submissionId, action, requestId, expectedRevision,
  expectedTotal, amount? })` returns the updated snapshot and writes only
  `paymentSimulatorSessions`. Actions are `full`, `deposit`, `balance`,
  `unmatched`, `approve_review`, `duplicate`, `expire`, `renew`, and `reset`.
- Request IDs use 8–100 letters, digits, underscores or hyphens. An identical
  request replay is idempotent; reusing its ID for another action is rejected.
  Revision and displayed-total checks reject stale requests across devices.
- A changed real quote requires a practice reset. The snapshot always includes
  `simulationOnly: true`, `withdrawable: false`, PHP amounts, request/payment/
  review states, and the latest practice events. Only `SIM-...` references are
  produced, never a valid real-payment reference.

This tests PHP payment-state handling without contacting Wise. Actual PHP bank
delivery still requires a separately authorized provider test.

---

## 6. Xendit (GCash, Maya, card): `convex/xendit.ts`, `lib/payments/xendit.ts`

It is off unless **both** `XENDIT_SECRET_KEY` and `XENDIT_CALLBACK_TOKEN` are
set on the Convex deployment.

### `api.xendit.createCheckout` (action)
- args `{ token, successRedirectUrl?, failureRedirectUrl? }`. Only `https://`
  or `tendso://` redirects are allowed. The defaults are
  `XENDIT_SUCCESS_REDIRECT_URL` and `XENDIT_FAILURE_REDIRECT_URL`.
- returns `{ enabled: false }` when Xendit is off, or `{ enabled: true, checkoutUrl,
  invoiceId, expiresAt|null, amount, referenceCode }`. Open `checkoutUrl`.
- `POST https://api.xendit.co/v2/invoices`, Basic auth (secret key, empty
  password), body: `external_id` = the token's reference code, `amount`,
  `currency: 'PHP'`, `description`, `payer_email`, `invoice_duration: 86400`,
  the redirect URLs, `metadata { submissionId, kind }`, and `payment_methods`
  only if `XENDIT_PAYMENT_METHODS` is set.
- It reuses an open invoice for the same token. An atomic order-wide claim
  prevents two devices from opening different invoices for the same order.
  Ambiguous provider failures hold the claim for reconciliation. An `EXPIRED`
  callback expires the request and releases the claim while retaining the invoice
  identity for delayed receipts.

### `POST /xendit-webhook` (Convex HTTP route)
- The header `x-callback-token` must equal `XENDIT_CALLBACK_TOKEN`, compared in
  constant time. Otherwise the route returns **401**. It returns **503** when
  Xendit is off.
- On `PAID` or `SETTLED` it finds the token by `external_id` and calls the same
  `applyTokenPayment`. A repeat callback is `duplicate` and changes nothing.
  A short payment, or an order that no longer matches, writes an audit row
  (`payment_unmatched`) and returns 200, so Xendit does not retry.
- Responses: `{ status: 'ok', result }` or `{ status: 'ignored' }`.
- Set the callback URL in the Xendit dashboard (Invoices) to
  `https://<deployment>.convex.site/xendit-webhook`.

**Unconfirmed (check in the Xendit dashboard or sandbox before go-live):**
- The status strings. We treat `PAID` and `SETTLED` as paid and `EXPIRED` as
  expired, from the Invoice callback model. The docs pages we read did not
  list the enum.
- The `payment_methods` codes for GCash, Maya and card. We guess `GCASH`,
  `PAYMAYA` and `CREDIT_CARD`. We send none by default, so the checkout shows
  every method enabled on the account.
- Whether a PH account needs `currency: 'PHP'` enabled on the invoice product.
- The field names come from Xendit's SDK models (`CreateInvoiceRequest`,
  `InvoiceCallback`), not from a live call.

---

## 7. Emails: `lib/email/ownerV2Templates.ts`, `convex/ownerEmails.ts`

These are sent from Convex through Resend's REST API. They are off if
`RESEND_API_KEY` is not set on the **Convex** deployment. The Next app's key is
a separate env. `internal.ownerEmails.send({ submissionId, kind })`:

| kind | when | copy |
|---|---|---|
| `invite` | an agent submits or the order is paid (once) | "Sign in with this email to see your website" |
| `building` | `ownerApp.submit` | "Your site is ready in about 20 minutes" + "See it first. Pay once to publish." |
| `preview_ready` | first `building_site: done` | "Ready to check… Looks good" + price |
| `live` | `publishIfReady` publishes (once) | URL, and the balance left if there is a deposit |

`lib/email/templates.ts` is untouched.

---

## 8. Env (Convex deployment), see `.env.example`

`XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN`, `XENDIT_SUCCESS_REDIRECT_URL`,
`XENDIT_FAILURE_REDIRECT_URL`, `XENDIT_PAYMENT_METHODS`, `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`, `OWNER_APP_URL`, `OWNER_APP_DAILY_LIMIT`.
Reused: `SELF_SERVE_CREATOR_ID`, `R2_PUBLIC_URL`.

## 9. Known gaps / follow-ups

- No reminders yet for a balance that is still due, and no takedown when it
  stays unpaid. The existing cron only watches `pending_payment`.
- The `app/api` routes that rewrite `status` (see section 1) should learn
  about `deposit_paid`. Until then, trust the money fields.
- Owner-app orders are standard tier only. There is no custom-domain choice in
  the app yet, and no creator code or discount.
- The admin queue's "Owner-submitted" badge filters on `owner_intake`. Owner-app
  rows show without it.
- `startPipeline` is a placeholder. Owner-app submissions wait at "building"
  until the pipeline agent wires it, or until an admin uses `adminSetStep`.

---

## 10. Private shop visits: `convex/visitRequests.ts`

Visit requests are structured dispatch records in `ownerVisitRequests`, not
generic leads or public community finds. They store the owner, optional linked
owned submission, shop/contact details, address and private map pin, free-text
`preferredWhen`, assignment, proposed time, status, notes, timestamps and a
monotonic `revision`. A preferred day/time is a preference, not a confirmed
appointment.

The owner can read only their own requests. Admins can read the dispatch queue;
an active, certified field agent can read only requests currently assigned to
their creator account. Owner contact details and coordinates are not exposed
through a public nearby-agent directory. Owners do not receive `adminNote` or
`agentNote`; assigned agents can receive their agent note, while admin notes
remain admin-only.

All public functions accept optional `clerkId` as an identity consistency
guard. It must match the authenticated Clerk subject and cannot grant access.
Read envelopes include `actorClerkId`; clients must reject a cached response
from another actor. `VisitView` is the request plus `actorClerkId` and
`assignedAgent: { id, name, phone: string|null, profileImage: string|null } | null`.

| function | args | returns / authority |
|---|---|---|
| `api.visitRequests.create` | `{ requestKey, submissionId?, shopName, ownerName, phone, email?, address, city, coordinates: { lat, lng }, preferredWhen, clerkId? }` | `VisitView`. Verified owner only; a supplied submission must be owned. The same owner's `requestKey` retries return the existing request. |
| `api.visitRequests.listMine` | `{ clerkId? }` | `null` or `{ actorClerkId, ownerId, requests: VisitView[] }`, latest 100 owned requests. |
| `api.visitRequests.getMine` | `{ id, clerkId? }` | Owned `VisitView` or `null`. |
| `api.visitRequests.listAdmin` | `{ status?, clerkId? }` | `{ actorClerkId, requests: VisitView[] }`, latest 200 matching requests; admin only. |
| `api.visitRequests.listAssignableAgents` | `{ clerkId? }` | `{ actorClerkId, agents: [{ id, name, email, phone, workCity, profileImage }] }`. Admin only; returns active, certified field agents. Nullable agent contact/profile fields remain nullable. |
| `api.visitRequests.assign` | `{ id, agentId, scheduledAt, adminNote?, expectedRevision, clerkId? }` | Updated `VisitView`; admin only, while `requested` or `assigned`. An identical assignment is a no-op. |
| `api.visitRequests.listAssigned` | `{ clerkId? }` | `null` or `{ actorClerkId, agentId, requests: VisitView[] }`, latest 100 assigned requests; eligible agent only. |
| `api.visitRequests.getAssigned` | `{ id, clerkId? }` | Assigned `VisitView` or `null`; eligible agent only. |
| `api.visitRequests.accept` | `{ id, agentNote?, expectedRevision, clerkId? }` | Assigned agent only; changes `assigned` to `confirmed`. The proposed time must still be in the future. |
| `api.visitRequests.decline` | `{ id, reason, expectedRevision, clerkId? }` | Assigned agent only, before acceptance. Returns the request to `requested`, clearing its agent and proposed time so the team can reassign it. |
| `api.visitRequests.complete` | `{ id, agentNote?, expectedRevision, clerkId? }` | Assigned agent only, after confirmation and at or after the scheduled start. Changes only the visit to `completed`. |
| `api.visitRequests.cancel` | `{ id, reason?, expectedRevision, clerkId? }` | Request owner or admin; closes a `requested`, `assigned` or `confirmed` request. Completed/cancelled requests are terminal. |

Creation requires a Philippine map pin and valid Philippine mobile number.
`requestKey` is 8–100 letters, digits, underscores or hyphens; keep it stable
for a retry and use a new key for a different request. Limits are three open
requests and five new requests in a rolling 24 hours per owner. Shop and owner
names are 2–120 characters, address 3–300, city 2–120, preference 1–120, and
contact email at most 254. An omitted contact email uses the owner's email.
Admin/agent notes and cancellation reasons are at most 1,000 characters;
decline reasons are 2–500.

Every state transition checks `expectedRevision` and increments the revision;
stale actions fail instead of overwriting a newer assignment or cancellation.
The workflow is:

`requested` → admin proposes an agent/time → `assigned` → agent accepts →
`confirmed` → agent records the visit → `completed`.

Declining an assignment returns it to `requested`. Owners/admins can cancel
an active request. Admins cannot reassign a confirmed visit through `assign`;
a changed confirmed appointment requires cancellation and a replacement
request. An assignment is **awaiting acceptance**, not a booked appointment.

Admin scheduling uses explicit Philippine wall time (`Asia/Manila`, UTC+8),
converted to a Unix timestamp without relying on the workstation timezone.
The time must be in the future and within 365 days. The server rejects another
assigned/confirmed visit for the same agent less than 30 minutes before or
after that start time; exactly 30 minutes is allowed, and the same request is
excluded when rescheduling. This is start-time separation, not a travel-time
or route planner.

The web admin queue is `/admin/visits`, including `?open=<visitId>` for a
notification. Native admin opens this web queue. Field agents use **Me → Shop
visits**, `/(app)/visits` and `/(app)/visits/[visitId]`, to accept, decline or
complete their assignments. Owners use the **Agents/visits** tab, request form
`/(owner)/agents/book` and owned detail `/(owner)/agents/[visitId]`.

Visit transitions create owner inbox events and the relevant agent/admin
notifications. Completing a visit does **not** create a capture, submit a
website, generate a payment request, mark an order paid or publish a website.
Photos/interviews and the existing capture/submission/payment flow remain
separate. This visit flow adds no appointment-email delivery path.

---

## 11. Owner inbox and device notifications: `convex/ownerInbox.ts`

The owner inbox combines private visit events and website workflow facts
(preview ready, payment recorded, publication/offline, review and change
requests). Website messages use recorded workflow timestamps, not invented
activity or traffic. The supporting tables are `ownerVisitEvents`,
`ownerSiteEvents`, `ownerNotificationReads` and `ownerPushTokens`.

| function | args | returns / notes |
|---|---|---|
| `api.ownerInbox.list` | `{ clerkId? }` | `null` or `{ actorClerkId, ownerId, unreadCount, items }` for the signed-in owner. An item is `{ key, type, title, body, createdAt, submissionId|null, visitRequestId|null, read }`. Reading this query never marks anything read. |
| `api.ownerInbox.markRead` | `{ key, clerkId? }` | `{ read: true }`. The key must exist in this owner's current verified inbox; the read record is idempotent. |
| `api.ownerInbox.markAllRead` | `{ clerkId? }` | `{ read: true }`. Explicit user action for this owner's current unread items. It is not called when opening or leaving the list. |
| `api.ownerInbox.registerPushToken` | `{ token, platform: 'ios' \| 'android', clerkId? }` | `{ registered: true }`. Registers/rebinds a valid Expo token to the current owner and disables a creator push registration for that same device token. |
| `api.ownerInbox.removePushToken` | `{ token, clerkId? }` | Deactivates that token only when it belongs to the current owner. Sign-out attempts this cleanup without preventing offline sign-out. |

Native **Me → Inbox** (`/(owner)/me/inbox`) opens a full-body modal when an
item is tapped and marks only that item read. **Mark all read** is separate.
A push tap carries `ownerId` and `ownerEventKey`; `OwnerNotificationBridge`
queries the current owner's inbox and opens only a matching item. A guessed,
foreign or stale payload does not open another owner's update. Account/session
changes discard old modal state and late read/permission results.

The Inbox's **Enable notifications** action is the permission-prompt entry.
The bridge can silently re-register a device whose permission was already
granted; opening the inbox itself does not request permission. Push needs a
physical device, permission, a configured EAS project/platform credentials and
network access. Delivery uses Expo; an unavailable push service must not undo
the stored inbox update. Device delivery is a separate smoke check from unit
tests, and the inbox remains usable when push is unavailable.

## 12. Native owner Today

`/(owner)/(tabs)/today` uses the canonical owned-site summary, private visit
requests and owner inbox. It shows real counts for businesses, live websites
and businesses needing attention, plus recorded remaining balances for unpaid
`awaiting_payment`/`live` sites. It does not display simulated visitor, sales or
traffic counters.

The next action selects the corresponding owned business before routing to
its current setup, preview or payment step. The list expands to show all owned
businesses. A confirmed visit on the current **Manila** calendar day can take
priority; an assigned visit remains awaiting the agent's acceptance. Recent
updates and the bell use the real unread count. Opening Today or the Inbox
list never marks those updates read automatically.

## 13. Owner web workspace (2026-11-03)

The web workspace shares the native owner records and APIs. Its navigation
keeps **Today**, **Businesses**, **Visits** and the notification bell available
while a section loads or fails.

- `/my-business/today` uses `owners.me`, `visitRequests.listMine` and
  `ownerInbox.list` for portfolio counts, actual remaining balances, the next
  business action, Manila-day confirmed visits and recent updates.
- `/my-business/notifications` opens full messages in a drawer. Opening one
  marks only that item read; **Mark all read** is explicit. Failed read writes
  have a retry action. `?eventKey=` opens only a key in the current owner's inbox.
- `/my-business/visits` lists private visit requests. `/visits/new` requires a
  Philippine map pin, shop address/city and mobile number. A new shop name is
  blank; only an explicit owned `?submissionId=` preselects a business. Details
  at `/my-business/visits/[visitId]` show status, proposed/confirmed Philippine
  time, assigned agent and revision-checked cancellation with confirmation.
- A visit retry retains the exact submitted payload and request key after an
  uncertain response. Account/session changes discard old form/modal state
  and ignore late outcomes; feature reads also verify actor and owner IDs.
- `/my-business/sign-in` uses the refreshed Tendso auth frame and the existing
  Clerk strategies. A fresh sign-in opens Today. Known workspace, visit, inbox
  event and payment return paths survive sign-in; arbitrary redirects do not.
- Admin **View as → Business owner** uses these same presentation components
  with fictional local fixtures for Today, businesses, visits and notifications.
  It performs no owner reads or writes, and disables contact/payment actions.

This adds the web inbox, not browser push delivery. Admin dispatch and native
agent acceptance continue through the existing visit workflow in section 10.

## 14. Shared owner drafts

Authenticated owners create and resume the same `owner_app` submission on
mobile and web. Web entry is **Today → Add a business** at
`/my-business/drafts/new`; **Finish setup** opens
`/my-business/drafts/[submissionId]`. Anonymous campaign/giveaway intake keeps
its existing browser-local flow and is not adopted by a different login.

`getSubmission` includes `actorClerkId`, `ownerId`, `draftRevision` (legacy 0),
`draftUpdatedAt` and `draftProgress`. The latter stores the canonical step
(`details`, `setup`, `interview`, `photos`, `design`, `review`), optional question
and photo cursors, filming choice, audio preference and interview language.
Answers keep their original 0–10 indices and recordings. Photos keep their
`(extra,index)` identities and labels; guided gaps and extras are not reindexed.
The selected template and saved alternate picks remain attached to the draft.

Draft writes accept `actorClerkId` and `expectedRevision`; successful writes
increment and return `draftRevision`. `saveDraftProgress` requires the expected
revision. Once a draft has a revision-aware write, unversioned old-client writes
are refused. A stale revision produces `OWNER_DRAFT_CONFLICT`, leaving all
stored content intact. Submission uses the reviewed revision too. Text-only
answer changes preserve a recording; `clearMedia:true` explicitly removes it.

Both clients serialize writes from acknowledged revisions. Mobile retains local
upload journals and pauses older unfinished files when a newer cloud version
arrives. Pending phone details, setup and design are retained separately for an
explicit keep-saved/apply-phone choice; resolving those fields does not hide
unfinished file recovery. Save and exit checkpoints dirty business details, setup and chosen
design without submitting. Web uses an owner/business-scoped IndexedDB journal
for pending text and file Blobs, plus an exclusive browser-tab Web Lock. A second
tab, unavailable safe storage or a corrupt journal makes that browser view
read-only rather than replacing pending work. Conflicts require an explicit
choice between the saved version and applying the listed pending changes.

Only uploaded, acknowledged media can appear on another device. Pending local
files are retained on their originating device until sync finishes. The web UI
shows pending sync separately from account-saved content. New-business retries
use a stable actor-scoped creation key to avoid duplicate drafts after a lost
response. Built/submitted businesses cannot reopen as editable intake drafts.

## 15. Website changes remain team-managed

Owner self-editing was retired on 2026-11-03 at the user's direction. Owners use
**Ask for a change** to request website updates, including after publication.
`/v2/my-site` returns to the owner workspace; `/api/owner-site`, owner-mode
generation and legacy owner editor write/build/upload mutations refuse edits.
Owned historical editor snapshots remain read-only. Admin/internal generation
continues through its existing authorized paths. Draft intake selection is
separate: choosing a design before sending a business does not edit a website.

## 16. Native owner locations and notification settings

Owner draft location and visit-request forms show an inline map. Tapping or
dragging the pin changes coordinates only; typed address and city stay intact.
Pin updates preserve the current map zoom. GPS permission is requested only
after **Use my current location**, and visit requests still require a valid
Philippine pin before sending.

The notification inbox contains messages and explicit read actions. Push
permission controls live under **Me → Settings**. Settings read OS permission
without prompting, distinguish quiet/blocked permissions, refresh on foreground,
and show enabled/disabled only after the corresponding backend acknowledgement.
The per-owner device preference and cached token survive app restarts. Turning
push off leaves the inbox available.

`ownerInbox.registerPushToken` accepts optional `enabled` (default `true`). An
inactive claim (`enabled:false`) atomically moves this installation token to
the current owner with `active:false`; this prevents failed previous-account
logout cleanup from leaking that account's updates into an opted-out session.
Registration is serialized across owner accounts on the device. Logout removal
remains guarded to the authenticated token owner, so an old logout cannot
disable a newer account's registration.

**Open business** selects the event's current owned submission and uses its
explicit business route. In particular, live businesses open **My site** rather
than the cold-start **Today** route; an outstanding balance still opens payment.
Unknown or removed business links never fall back to a different business.
