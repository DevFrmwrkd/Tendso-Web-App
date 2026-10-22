# v2 API: owners, build progress, down payments, Xendit

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
A field agent's site that is not published yet shows `in_review`. Other
values: `rejected`.

### Publish rule per source (`publishPolicyFor`)

| source | policy | what happens |
|---|---|---|
| field-agent sale, `/start`, legacy (anything not `owner_app`) | `publish_first` | Unchanged. The admin publishes, the owner pays, the site stays live. If they don't pay, the existing cron takes it down (3 days after the payment email, `pending_payment` only). A `deposit_paid` site is not taken down. |
| `contentSource: 'owner_app'` | `pay_then_publish` | Private preview. The owner taps "Looks good", pays in full, and then `ownerApp.publishIfReady` publishes automatically at `<slug>.sites.tendso.com`. `generatedWebsites.publish` (the admin button) refuses this source until it is paid in full, currently approved, and has no open change requests. |

---

## 2. Owner accounts: `convex/owners.ts`

Owners sign in with Clerk using an email code. The Clerk `convex` JWT
template must include `email` (and ideally `email_verified`).

### `api.owners.ensure` (mutation)
Call it after every sign-in. It is idempotent.
- args: `{ name?: string, phone?: string }`
- returns: `{ ownerId, email, name: string|null, created: boolean, linkedSubmissionIds: Id<'submissions'>[] }`
- Creates the `businessOwners` row, or reuses it by Clerk id. If the Clerk user
  is new but the email is known, it re-links that row to the new user.
- Links every site that has an `ownerInvites` row for this verified email
  (the email is lower-cased).
- Refuses `emailVerified === false` and affiliate (creator) logins.

### `api.owners.me` (query)
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
| `api.ownerApp.createDraft` | `{ businessType, businessName, address?, city?, province?, barangay?, coordinates?, shotListKey? }` | `Id<'submissions'>`. `businessType` must be one of `BUSINESS_TYPES` (`lib/prospectPrefill.ts`). Status `draft`, `contentSource 'owner_app'`, house creator, `amount` ₱4,999, payout 0. At most 3 open drafts per owner. |
| `api.ownerApp.updateDraft` | `{ submissionId, businessType?, businessName?, address?, city?, province?, barangay?, coordinates?, shotListKey?, ownerName?, ownerPhone? }` | `{ ok }`. Drafts only. |
| `api.ownerApp.saveAnswer` | `{ submissionId, index 0-10, lang 'en'\|'tl', answerText?, mediaUrl?, mediaType? 'video'\|'audio', durationSec? }` | `{ answered }`. Upserts by index. Send neither text nor media to clear. Stored in `submissions.ownerInterview[]` with the canonical EN and TL question text. |
| `api.ownerApp.saveShot` | `{ submissionId, index, url, label?, extra? }` | `{ photos }`. Guided shots use index 0-9 in shot-list order. Extras use `extra: true`, index 0-9. Stored in `ownerShots[]`. |
| `api.ownerApp.removeShot` | `{ submissionId, index, extra? }` | `{ photos }` |
| `api.ownerApp.chooseDesign` | `{ submissionId, templateId, templateIds? (1-3) }` | `{ ok }`. A template code such as `barbershop:BP`. Allowed until the owner says "Looks good". |
| `api.ownerApp.setStyle` | `{ submissionId, fontChoice?, colorChoice? }` | `{ ok }`. Font and colour come later, any time. Sets `styleUpdatedAt` so the pipeline can rebuild. |
| `api.ownerApp.submit` | `{ submissionId }` | `{ submissionId, status: 'submitted' }`. Needs a name, an address or map pin, at least 1 answer and at least 3 photos. Sets `photos` (guided, then extras), `interviewQa` and `transcript` (text answers) so existing readers work, and sets all four build steps to `pending`. Adds a lead row and the analytics. Schedules `internal.buildProgress.startPipeline` and the "about 20 minutes" email. Throttled: 3 a day per owner and 50 a day overall (`OWNER_APP_DAILY_LIMIT`). A double tap is a no-op. |
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
- args `{ submissionId, kind: 'full'|'deposit'|'balance', amount? }` (`amount`
  is in whole pesos and is used for `deposit` only).
- returns `{ token, referenceCode, kind, amount, expiresAt }`. The reference
  (`ND-XXXX-YYYY`) works for a Wise bank transfer. The token is what
  `xendit.createCheckout` takes.
- An `owner_app` site needs "Looks good" first (admins may skip this).
- A double tap reuses the open token. Tokens last 30 days.

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
  Wise), and cancels the other pending tokens for that order. Cancelling them
  keeps Wise amount-matching unambiguous.
- Wise: `payments.processDeposit` now calls this function. It keeps matching
  by reference, then by amount. Down payment and balance tokens match by their
  own amounts.

New `paymentTokens` fields: `kind`, `provider`, `paidAmount`,
`externalPaymentId`, `xenditInvoiceId`, `xenditInvoiceUrl`, `xenditExpiresAt`,
`createdBy`.

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
- It reuses an open invoice for the same token. An `EXPIRED` callback clears it.

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
