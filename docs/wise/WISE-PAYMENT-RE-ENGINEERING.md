# Wise Payment System — Re-Engineering & Mobile/Web Alignment

**Date:** April 2026
**Version:** 2.0
**Status:** Implementation Phase
**Supersedes:** Manual `markPaid` flow + auto-funding withdrawals

> **What changed in v2.0:**
> 1. **Incoming payments are now AUTOMATED** — when a business owner pays via Wise, the system auto-detects via webhook, matches a reference code, and credits the creator wallet. No admin clicking "Mark as Paid".
> 2. **Outgoing withdrawals require admin approval in Wise dashboard** — the backend creates the transfer in Wise, but the admin must manually fund/approve it. (Already implemented per WISE-PAYMENT-FLOW-MOBILE.md v1.2)
> 3. **Both flows use a unified audit log** with new action types: `payment_auto_matched`, `payment_partial`, `payment_unmatched`.

---

## Table of Contents

1. [Big Picture: Two Independent Flows](#1-big-picture-two-independent-flows)
2. [Money Direction & Responsibility](#2-money-direction--responsibility)
3. [Incoming Payment Flow (NEW - Web Automated)](#3-incoming-payment-flow-new---web-automated)
4. [Outgoing Withdrawal Flow (Mobile + Manual Admin)](#4-outgoing-withdrawal-flow-mobile--manual-admin)
5. [Architecture Alignment Diagram](#5-architecture-alignment-diagram)
6. [Database Schema (Shared)](#6-database-schema-shared)
7. [Webhook Routing (Shared)](#7-webhook-routing-shared)
8. [Audit Log Unification](#8-audit-log-unification)
9. [Mobile App Alignment Requirements](#9-mobile-app-alignment-requirements)
10. [Admin Dashboard Alignment](#10-admin-dashboard-alignment)
11. [Race Condition Handling](#11-race-condition-handling)
12. [Implementation Status](#12-implementation-status)

---

## 1. Big Picture: Two Independent Flows

The Wise payment system handles **two completely independent money flows** with very different automation levels:

| Flow | Direction | Trigger | Automation | Admin Touch |
|------|-----------|---------|-----------|-------------|
| **Incoming** | Business owner → Platform Wise | Wise balance credit webhook | **Fully automatic** | None (audit log only) |
| **Outgoing** | Platform Wise → Creator Wise | Creator taps "Withdraw" in mobile app | Semi-automatic | **Required**: admin must fund transfer in Wise dashboard |

**Why the asymmetry?**
- **Incoming** is safe to automate: money is arriving. We just need to credit the right creator. Worst case: a wrong reference code gets flagged for admin review.
- **Outgoing** is risky: money is leaving the platform. Wise's manual approval step is a fraud/mistake checkpoint.

---

## 2. Money Direction & Responsibility

### Platform Wise PHP Balance (Single Pool)
```
                    ┌──────────────────────┐
                    │  PLATFORM WISE       │
                    │  PHP Balance         │
                    │  (single pool)       │
                    └──────────────────────┘
                            ↑      ↓
                            │      │
            INCOMING        │      │       OUTGOING
            (web auto)      │      │       (mobile + admin)
                            │      │
            ┌───────────────┘      └──────────────┐
            │                                     │
   Business Owner pays                  Admin funds in Wise dashboard
   → reference code in note             → Wise debits PHP balance
   → webhook fires                      → sends to creator's Wise email
   → auto-credit creator                → webhook updates app status
```

### Responsibility Matrix

| Action | Mobile App | Web Backend | Admin (Wise Dashboard) | Wise Platform |
|--------|-----------|-------------|------------------------|---------------|
| Send payment email to business owner | — | ✓ Generates reference code | — | — |
| Business owner sends Wise payment | — | — | — | ✓ Receives money |
| Detect incoming payment | — | ✓ `processDeposit` action | — | ✓ Fires webhook |
| Match reference → submission | — | ✓ `paymentReferences.markMatched` | — | — |
| Credit creator wallet | — | ✓ `creditCreatorForPayment` (auto) | — | — |
| Creator views balance | ✓ Wallet screen | — | — | — |
| Creator initiates withdrawal | ✓ Withdraw form | ✓ `withdrawals.create` | — | — |
| Create Wise recipient/quote/transfer | — | ✓ `wise.initiateTransfer` | — | ✓ Stores in Wise |
| **Approve & fund the transfer** | — | — | ✓ **Manual in Wise dashboard** | — |
| Send payout to creator | — | — | — | ✓ Processes funded transfer |
| Update app status to completed | — | ✓ `/wise-webhook` handler | — | ✓ Fires webhook |

---

## 3. Incoming Payment Flow (NEW - Web Automated)

### Step-by-Step

```
1. ADMIN: Generates website + clicks "Send Approval Email"
   → POST /api/send-website-email
   → Calls internal.paymentReferences.generate(submissionId, expectedAmount)
   → Returns code: ND-7K3M-X9P2
   → Sends email via Nodemailer/Gmail with the code

2. EMAIL: Business owner receives email containing:
   • Their new website URL
   • Amount due (₱X,XXX)
   • Wise email to send to
   • Payment reference code (ND-7K3M-X9P2)
   • Instructions: "Include this code in the Wise payment note"

3. BUSINESS OWNER: Opens Wise app/web → sends ₱X,XXX to platform's
   Wise email → enters "ND-7K3M-X9P2" in the reference/note field

4. WISE: Receives the transfer → fires "balances#credit" webhook
   POST https://<convex-deployment>.convex.site/wise-deposit-webhook
   {
     event_type: "balances#credit",
     data: {
       resource: {
         id: 123456789,
         amount: { value: 5000, currency: "PHP" },
         reference: "ND-7K3M-X9P2",
         sender_name: "Juan Dela Cruz"
       }
     }
   }

5. CONVEX HTTP HANDLER (/wise-deposit-webhook):
   • Parses payload via lib/payments/webhookParser.ts
   • Schedules internal.payments.processDeposit
   • Returns 200 immediately (Wise needs fast response)

6. CONVEX ACTION (payments.processDeposit):
   • Extracts ND-XXXX-YYYY from the reference text
   • Looks up paymentReferences by code
   • Validates: not already matched (duplicate), within tolerance
   • Calls paymentReferences.markMatched (status: matched/partial/overpaid)
   • If matched/overpaid → calls creditCreatorForPayment

7. CONVEX MUTATION (payments.creditCreatorForPayment):
   ✓ Updates submission status → "completed"
   ✓ Credits creator.balance += creatorPayout
   ✓ Updates creator.totalEarnings
   ✓ Creates earnings record
   ✓ Audit log: action="payment_auto_matched", triggeredBy="system:auto-payment"
   ✓ Push notification: "Payment Received! ₱X for [business name]"
   ✓ Analytics increment (daily + monthly)
   ✓ Referral check (₱1,000 bonus if first paid submission)

8. CREATOR (Mobile App):
   • Receives push notification: "Payment Received!"
   • Opens wallet → sees new balance
   • No action required
```

### Edge Case Handling

| Scenario | Detection | Action | Admin Notified? |
|----------|-----------|--------|-----------------|
| **Reference code not found** | `paymentReferences.getByCode` returns null | Log `payment_unmatched` audit | Yes (audit + manual review) |
| **Duplicate payment** | `paymentRef.status === 'matched'` | Log `payment_unmatched` (reason: duplicate) | Yes |
| **Partial payment** (received < expected − ₱1) | `determinePaymentStatus` returns 'partial' | Log `payment_partial`, do NOT credit | Yes (must handle manually) |
| **Overpayment** (received > expected + ₱1) | `determinePaymentStatus` returns 'overpaid' | Credit at expected amount, log overpayment | Yes (refund difference) |
| **No reference code in note** | `extractReferenceFromText` returns null | Log `payment_unmatched` (reason: no code) | Yes |

---

## 4. Outgoing Withdrawal Flow (Mobile + Manual Admin)

This flow is **already implemented** per `WISE-PAYMENT-FLOW-MOBILE.md` v1.2. It's reproduced here only for alignment context.

### Summary
```
1. CREATOR (Mobile): Wallet → Withdraw → Enter ₱500 → Confirm
2. POST /api/withdrawals/create
3. CONVEX (withdrawals.create):
   • Deduct balance immediately (₱1,500 → ₱1,000)
   • Insert withdrawal record (status: pending)
   • Schedule wise.initiateTransfer
4. CONVEX (wise.initiateTransfer):
   • Wise API: create recipient, quote, transfer
   • Save wiseTransferId to withdrawal record
   • Status → "processing"
   • DOES NOT auto-fund (no /payments call)
5. ADMIN (Wise dashboard): Reviews pending transfer → clicks "Fund"
   • Wise debits platform's PHP balance
   • Transfer enters Wise's outgoing pipeline
6. WISE → /wise-webhook (existing endpoint)
   • Maps state to status: outgoing_payment_sent → completed
   • Updates withdrawal record
   • If completed: increments creator.totalWithdrawn, sends push notification
   • If failed: restores creator.balance, sends failure notification
```

**Key insight:** This flow is intentionally semi-manual. The admin's Wise dashboard approval is the final gate before money leaves.

---

## 5. Architecture Alignment Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          PLATFORM WISE PHP BALANCE                       │
└──────────────────────────────────────────────────────────────────────────┘
                  ↑                                            ↓
                  │                                            │
              INCOMING                                     OUTGOING
                  │                                            │
┌─────────────────┴───────────────┐    ┌──────────────────────┴───────────┐
│  Business Owner (External)      │    │  Creator (Mobile App)            │
│  ───────────────────────────    │    │  ──────────────────────          │
│  Receives payment email with    │    │  Wallet screen shows balance     │
│  ND-XXXX-YYYY reference code    │    │  Tap Withdraw → enter amount      │
│  Sends Wise transfer with code  │    │  POST /api/withdrawals/create     │
└─────────────────┬───────────────┘    └──────────────────────┬───────────┘
                  │                                            │
                  ↓                                            ↓
┌─────────────────┴───────────────┐    ┌──────────────────────┴───────────┐
│  Wise fires balance#credit       │    │  convex/withdrawals.ts::create  │
│  webhook                        │    │  • Deduct balance immediately    │
│                                 │    │  • Schedule initiateTransfer     │
└─────────────────┬───────────────┘    └──────────────────────┬───────────┘
                  │                                            │
                  ↓                                            ↓
┌─────────────────┴───────────────┐    ┌──────────────────────┴───────────┐
│  POST /wise-deposit-webhook     │    │  convex/wise.ts::initiateTransfer│
│  (NEW endpoint, NEW flow)       │    │  • POST /v1/accounts             │
│                                 │    │  • POST /v1/quotes               │
│  convex/payments.ts             │    │  • POST /v1/transfers            │
│  ::processDeposit (action)      │    │  • Save wiseTransferId            │
│  • Extract code via regex       │    │  • Status: processing            │
│  • Lookup paymentReferences     │    │  • NO auto-fund call             │
│  • Mark matched                 │    └──────────────────────┬───────────┘
└─────────────────┬───────────────┘                            │
                  │                                            │
                  ↓                                            ↓
┌─────────────────┴───────────────┐    ┌──────────────────────┴───────────┐
│  convex/payments.ts             │    │  ADMIN opens Wise dashboard      │
│  ::creditCreatorForPayment      │    │  • Reviews pending transfer      │
│  ──── SHARED LOGIC ────         │    │  • Clicks "Fund" / "Approve"     │
│  Used by BOTH:                  │    │  • Wise debits PHP balance       │
│  • Auto webhook (this flow)     │    │  • Wise sends to creator's email │
│  • admin.markPaid (legacy)      │    └──────────────────────┬───────────┘
│                                 │                            │
│  ✓ submission status → completed│                            ↓
│  ✓ creator.balance += payout    │    ┌──────────────────────┴───────────┐
│  ✓ create earnings record       │    │  Wise fires transfer state webhk │
│  ✓ audit log                    │    │  POST /wise-webhook (EXISTING)   │
│  ✓ push notification            │    │  • outgoing_payment_sent →       │
│  ✓ analytics                    │    │    status: completed             │
│  ✓ referral check               │    │  • cancelled/refunded → failed   │
└─────────────────┬───────────────┘    └──────────────────────┬───────────┘
                  │                                            │
                  ↓                                            ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                       CREATOR WALLET (MOBILE APP)                        │
│                                                                          │
│  Incoming flow result: balance ↑ (payment received notification)         │
│  Outgoing flow result: withdrawal completed (totalWithdrawn ↑)           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Database Schema (Shared)

Both flows write to the same Convex tables. No conflicts because they touch different fields/records.

### `submissions` table
| Field | Used By | Purpose |
|-------|---------|---------|
| `status` | Both | Lifecycle: draft → submitted → ... → completed |
| `creatorPayout` | Both | Amount creator earns when submission is paid |
| `paymentReference` | **Incoming only** (NEW) | Quick lookup for the assigned reference code |
| `creatorPaidAt` | **Incoming only** | Timestamp when creator was credited |

### `paymentReferences` table (NEW)
Tracks payment reference codes for incoming payments only.
```typescript
{
    submissionId: Id<'submissions'>
    code: string                    // ND-XXXX-YYYY
    expectedAmount: number          // PHP expected
    receivedAmount?: number         // From Wise webhook
    currency?: string               // "PHP"
    status: 'pending' | 'matched' | 'partial' | 'overpaid' | 'expired' | 'cancelled'
    wiseTransactionId?: string      // Wise's internal txn ID
    senderName?: string             // From webhook
    matchedAt?: number
    createdAt: number
    expiresAt?: number              // Optional 24h window
}
```
**Indexes:** `by_code`, `by_submissionId`, `by_status`

### `withdrawals` table (existing, unchanged)
Tracks outgoing payouts to creators only. Used by mobile app.

### `creators` table
| Field | Read | Written By |
|-------|------|------------|
| `balance` | Mobile wallet | Both flows (incoming credits, outgoing deducts) |
| `totalEarnings` | Mobile wallet | Incoming flow only |
| `totalWithdrawn` | Mobile wallet | Outgoing flow only |
| `wiseEmail` | Outgoing flow | Mobile profile setup |

### `auditLogs` table
Both flows log here. New action types added for incoming flow:
```typescript
action: 'payment_auto_matched' | 'payment_partial' | 'payment_unmatched'
       | 'payment_sent' | 'payout_sent' | ... (existing)
targetType: 'payment' (NEW) | 'submission' | 'withdrawal' | 'creator' | 'website'
```

---

## 7. Webhook Routing (Shared)

Both flows use Convex HTTP routes in `convex/http.ts`. **Two completely separate endpoints** because Wise sends different event types:

| Endpoint | Wise Event | Direction | Handler |
|----------|-----------|-----------|---------|
| `POST /wise-webhook` | `transfers#state-change` | Outgoing | Updates withdrawal status by `wiseTransferId` |
| `POST /wise-deposit-webhook` (NEW) | `balances#credit` | Incoming | Schedules `payments.processDeposit` |

**Important:** Both must be registered in the Wise developer dashboard:
1. Go to Wise Business → Settings → Developer Tools → Webhooks
2. Add webhook for **Transfer state changes** → `https://<deployment>.convex.site/wise-webhook`
3. Add webhook for **Balance credit / deposit** → `https://<deployment>.convex.site/wise-deposit-webhook`

---

## 8. Audit Log Unification

All payment-related activity flows through `convex/auditLogs.ts::log()` regardless of which direction. Admins can filter by action type:

| Action | Direction | Trigger |
|--------|-----------|---------|
| `payment_auto_matched` | Incoming | Webhook auto-credited a creator |
| `payment_partial` | Incoming | Partial payment received (manual review needed) |
| `payment_unmatched` | Incoming | Reference code not found / duplicate / no code |
| `payment_sent` | Incoming (legacy) | Admin manually called `markPaid` |
| `payout_sent` | Outgoing | Withdrawal status changed to completed |

---

## 9. Mobile App Alignment Requirements

The mobile app (React Native) needs **minor changes** to align with the new automated incoming payment flow.

### What's already correct (no changes needed)
- ✓ Wallet screen displays `creator.balance` from Convex query (auto-updates when webhook credits)
- ✓ Withdrawal flow already works (creates Wise transfer, awaits admin funding)
- ✓ Push notifications (`payout_sent`, `system`) already display correctly
- ✓ Withdrawal history shows `withdrawals` records

### What needs to be added/updated

#### A. New push notification type: `payment_received`
When a business owner pays via the new automated flow, the creator receives:
- **Title:** "Payment Received! 🎉"
- **Body:** "You received ₱X for [business name]"
- **Data:** `{ submissionId, amount }`

The mobile notification handler should:
1. Display the toast/notification
2. Refresh the wallet balance immediately
3. Refresh the earnings list
4. On tap → navigate to wallet screen

Note: The web backend already sends this notification via `notifications.createAndSend` with `type: 'payout_sent'`. The mobile app may already handle this — verify the notification type mapping.

#### B. Earnings list — show payment source
The earnings list (already exists) should show whether the earning came from:
- **Auto-payment** (preferred badge): "Auto-paid via Wise"
- **Manual mark as paid** (legacy): "Marked paid by admin"

Add a visual indicator on each earnings item. Source: query `paymentReferences` by `submissionId` to detect.

#### C. Submission status display
When viewing a submission, show its payment status from `paymentReferences`:
- **Pending payment** → "Awaiting payment from business owner"
- **Matched** → "✓ Payment received"
- **Partial** → "⚠ Partial payment received — pending admin review"
- **Expired** → "⏱ Payment window expired"

#### D. Withdrawal flow — no changes needed
The mobile withdrawal flow is unchanged. The "Removing Funds" step the user mentioned removing was the auto-funding API call (`fundTransfer()`), not anything the mobile app does. The mobile app still calls `POST /api/withdrawals/create` exactly the same way.

### Mobile app changes summary
| Component | Change | Priority |
|-----------|--------|----------|
| Notification handler | Map `payout_sent` to wallet refresh | Low (already works) |
| Earnings list | Add "auto-paid" badge | Medium |
| Submission detail | Show payment status from paymentReferences | Medium |
| Withdrawal flow | No change | — |
| Wallet balance | No change (auto-refreshes via Convex query) | — |

---

## 10. Admin Dashboard Alignment

Two separate admin pages, both simplified to be read-only / monitoring-only.

### `/admin/payouts` (NEW SIMPLIFIED — for business owner payments)
Shows submissions where the business owner has paid via the auto-detection system.

**Stats (simplified):**
- **Paid This Week** — count of submissions auto-paid in the last 7 days
- **Total Paid Out** — lifetime sum

**Removed:**
- ~~Pending Requests~~ (no longer needed — auto-detection handles this)
- ~~Pending Amount~~
- ~~Manual "Mark as Paid" button~~ (kept as fallback in admin actions menu)

### `/admin/withdrawals` (existing — for creator withdrawals)
Shows withdrawals creators have requested. Read-only view.

**Stats:**
- Total completed
- Total failed
- Total processing (awaiting Wise dashboard approval)

**Action:** Admin clicks "View" on any withdrawal to see full details + Wise transaction ID. Then opens Wise dashboard separately to approve/fund.

### Cross-flow visibility
Admins should be able to see both flows in a unified audit view at `/admin/audit`:
- Filter: `payment_auto_matched`, `payment_partial`, `payment_unmatched`, `payout_sent`
- Sort: by timestamp
- Search: by creator name, amount, or reference code

---

## 11. Race Condition Handling

Both flows can touch `creator.balance` concurrently. Convex's transactional mutations prevent races, but we use additional safeguards:

### Scenario A: Creator withdraws while a payment is being credited
```
T0: balance = ₱1,000
T1: Webhook fires → schedules creditCreatorForPayment(₱500)
T2: Creator taps Withdraw ₱1,000 (sees balance ₱1,000)
T3: withdrawals.create runs FIRST → deducts ₱1,000 → balance = ₱0
T4: creditCreatorForPayment runs → balance = ₱500
```
**Result:** No race. Convex serializes mutations on the same record.

### Scenario B: Duplicate webhook delivery
Wise may retry webhooks. Our handler checks `paymentReferences.status` before crediting:
```typescript
if (paymentRef.status === 'matched' || paymentRef.status === 'overpaid') {
    // Already processed — skip
    log audit(payment_unmatched, reason: 'duplicate')
    return
}
```

### Scenario C: Creator's balance race
`creditCreatorForPayment` reads creator, computes new balance, patches. Convex serializes this. Two simultaneous credits will both apply correctly.

### Scenario D: Submission already completed
Our shared logic checks:
```typescript
if (submission.status === 'completed' || submission.creatorPaidAt) {
    console.log('Already paid, skipping')
    return
}
```
Prevents double-payment if both manual `markPaid` and auto-webhook fire.

---

## 12. Implementation Status

### Complete ✓
- [x] `lib/payments/referenceCode.ts` — pure code generation, validation, extraction
- [x] `lib/payments/webhookParser.ts` — pure Wise webhook payload parser
- [x] `convex/schema.ts` — `paymentReferences` table + audit action types
- [x] `convex/paymentReferences.ts` — generate, getByCode, markMatched, getBySubmission
- [x] `convex/payments.ts` — `processDeposit` action + `creditCreatorForPayment` shared mutation
- [x] `convex/admin.ts` — `markPaid` refactored to use shared logic
- [x] `convex/http.ts` — `/wise-deposit-webhook` route added
- [x] `lib/email/templates.ts` + `lib/email/service.ts` — payment reference param
- [x] `app/admin/payouts/page.tsx` — simplified stats (removed pending)

### In Progress 🚧
- [ ] `app/api/send-website-email/route.ts` — generate reference code before sending email
- [ ] Jest test suite for payment flow (~20 tests)
- [ ] End-to-end test with real Wise sandbox

### Outstanding (after launch)
- [ ] Register `/wise-deposit-webhook` in Wise dashboard for `balances#credit` events
- [ ] Mobile app: add payment status indicator on submission detail screen
- [ ] Mobile app: add "auto-paid" badge in earnings list
- [ ] Webhook signature verification (RSA-SHA256)
- [ ] Admin alert email when `payment_unmatched` audit logged

---

## Migration Notes

### Backward compatibility
- The legacy `markPaid` mutation still works (admin can manually credit a creator). It now delegates to `creditCreatorForPayment`.
- Existing submissions without a `paymentReference` will continue to work via the manual flow.
- The mobile app needs no immediate changes — wallet auto-refreshes work with both flows.

### Rollback plan
If the auto-payment flow has issues:
1. Disable the `/wise-deposit-webhook` route in `convex/http.ts` (comment it out)
2. Admins manually mark payments via the legacy `markPaid` button
3. Mobile app continues working unchanged
4. Webhook re-enabled after fix

### Testing checklist
- [ ] Generate reference code for a submission → verify it's stored in `paymentReferences`
- [ ] Send test deposit webhook → verify auto-credit happens
- [ ] Send duplicate webhook → verify no double-credit
- [ ] Send partial payment webhook → verify it's logged but not credited
- [ ] Manual `markPaid` still works as fallback
- [ ] Mobile wallet shows updated balance after webhook fires (live query)
- [ ] Audit log shows `payment_auto_matched` action
- [ ] Push notification reaches creator's mobile device

---

## File Reference Map

| File | Purpose |
|------|---------|
| `lib/payments/referenceCode.ts` | Pure functions: generate/validate/extract codes (testable) |
| `lib/payments/webhookParser.ts` | Pure function: parse Wise webhook payload (testable) |
| `convex/payments.ts` | `processDeposit` action + `creditCreatorForPayment` shared mutation |
| `convex/paymentReferences.ts` | CRUD for payment reference codes |
| `convex/http.ts` | HTTP routes (`/wise-webhook`, `/wise-deposit-webhook`) |
| `convex/schema.ts` | Database schema |
| `convex/admin.ts` | Admin mutations (markPaid delegates to shared logic) |
| `convex/withdrawals.ts` | Outgoing withdrawal flow (mobile-initiated) |
| `convex/wise.ts` | Wise API orchestration for outgoing transfers |
| `services/wise.ts` | Pure Wise API client (recipient/quote/transfer) |
| `app/admin/payouts/page.tsx` | Admin: simplified payment monitoring |
| `app/admin/withdrawals/page.tsx` | Admin: withdrawal monitoring (read-only) |
| `lib/email/templates.ts` | Email HTML generators |
| `lib/email/service.ts` | Nodemailer/Gmail sender |
| `__tests__/payments/*.test.ts` | Jest tests for payment logic |

---

## Environment Variables

```bash
# Wise API (existing — for outgoing transfers)
WISE_API_TOKEN=<your-token>
WISE_PROFILE_ID=<your-profile-id>
WISE_SANDBOX=false

# Wise webhook signing (existing)
WISE_WEBHOOK_PUBLIC_KEY=<RSA public key from Wise dashboard>

# Wise email for incoming payments (NEW context)
WISE_EMAIL=<platform's Wise email — receives business owner payments>
WISE_ACCOUNT_NAME=Tendso

# Email sending (existing)
GMAIL_USER=<gmail address>
GMAIL_APP_PASSWORD=<gmail app password>

# Admin gating (existing)
ADMIN_CLERK_IDS=user_abc123,user_def456
```
