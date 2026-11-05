# v2 API: creator program

The Convex contract the web (`/v2/...`) and app agents build against. Written 2026-10-21 on `feat/v2-backend-creators`. Business rules: `docs/CREATOR-PROGRAM.md` (design-mock branch).

**Words.** A *creator* is a `creators` row with `role: "affiliate"`: they promote online with a link and a code. A *field agent* is `role: "creator"` (or no role): they visit shops. The code keeps the role names; only labels change.

**Money.** Every amount is a plain number in ₱ (no centavos, no strings). Every date is a ms timestamp. "This month" means the calendar month in Asia/Manila.

**Errors.** Public functions throw `ConvexError` with a sentence you can show the person (for example "That code is already taken. Choose another one.").

## Constants (`packages/shared/pricing.ts`, also `lib/pricing`)

| Name | Value | Meaning |
|---|---|---|
| `CREATOR_OVERRIDE_RATE` | `0.05` | Creator's share of each sale by a field agent they recruited |
| `CREATOR_OVERRIDE_MONTHS` | `12` | How long, from the agent's join date |
| `CREATOR_OVERRIDE_CUTOVER` | `2026-10-21 00:00 Asia/Manila` (ms) | Creator recruits from here get the override; earlier referrals keep `REFERRAL_BONUS` (₱1,000) |
| `CREATOR_CODE_DISCOUNT` | `0.3` | Every creator/affiliate code has the same fixed 30% offer |
| `CREATOR_CODE_PRICE` | `3499` | Fixed code price: ₱4,999 × 0.7, saving ₱1,500 |
| `CREATOR_CODE_DEFAULT_DISCOUNT` / `CREATOR_CODE_DEFAULT_PRICE` | `0.3` / `3499` | Compatibility aliases for the fixed policy, not editable defaults |
| `overrideFor(websitePrice)` | `round(price × 0.05)` | ₱999 → 50, ₱2,999 → 150, ₱3,499 → 175, ₱4,999 → 250 |
| `earnsCreatorOverride(joinedAt)` | boolean | `joinedAt >= CREATOR_OVERRIDE_CUTOVER` |
| `creatorOverrideEndsAt(joinedAt)` | ms | Join date + 12 calendar months |
| `creatorOverrideMonthsLeft(joinedAt, now)` | integer 0–12 | Shared web/mobile display estimate: remaining time divided by 30.4375 days, rounded up and bounded to the 12-month program |

## Shared shape: `CreatorCard`

Returned wherever a creator is shown to the public. No contact or payout data.

```ts
type CreatorCard = {
  handle: string;        // "mika"  → links /a/mika and /a/mika/earn
  name: string;          // display name, else first + last name
  photo: string | null;  // https URL
  message?: string;     // optional public personal message saved in My page
  socialLinks?: { messenger?: string; facebook?: string; instagram?: string; tiktok?: string; youtube?: string }; // optional, validated public HTTPS links
  code: string | null;   // "MIKA30" — what people type
  listPrice: number;     // 4999
  price: number;         // fixed creator-code price: 3499
  saving: number;        // fixed saving: 1500  ("you save ₱1,500")
  percentOff: number;    // 30
};
```

Only **active** creators resolve. A pending (not yet approved), suspended or deleted creator gives `null` everywhere.

Public messages and social links come only from the creator's saved page settings. Application social accounts, account email, phone and payout details remain private. An existing Facebook or Messenger page link is used when no newer social-link map has been saved; an explicitly empty map hides every social button.

Current creator-code offers always use `CREATOR_CODE_PRICE` and `CREATOR_CODE_DISCOUNT`, including accounts with an older custom `affiliatePrice`. Profile editing, preview, sharing and poster exports use this fixed offer. Field-agent submission pricing remains ₱999–₱4,999, and historical orders keep their captured amounts.

### Existing page editor — `affiliates.updatePage`

The signed-in active affiliate can update `{ photo?, displayName?, message?, socialLink?, socialLinks? }`; this mutation does not change the public handle or creator code. An eligible existing account chooses its permanent code once through `creatorProgram.updateCode` below. New clients omit `price`. The optional legacy `price` argument accepts only `CREATOR_CODE_PRICE` (3499) for compatibility and never writes an account price. Any other value rejects the entire request before profile fields are saved. Pending, suspended, deleted and non-affiliate accounts retain their existing write restrictions.

---

## 1. Creator sign-up — `creatorProgram.*`

### `creatorProgram.checkAvailability` (query, public)

Live check while the person types.

- Args: `{ handle?: string, code?: string }`
- Returns:
  ```ts
  {
    handle: { value: string; available: boolean; error: string | null } | null; // value is lower-cased
    code:   { value: string; available: boolean; error: string | null } | null; // value is upper-cased
  }
  ```
- Handle rules: 3–30 chars, `a-z 0-9` and single hyphens, not reserved (`lib/affiliates.ts`). Code rules: 4–16 letters/numbers, not a campaign code (`OTR30`). Both must be unused (deleted accounts keep theirs).

### `creatorProgram.apply` (mutation, signed in)

- Args:
  ```ts
  {
    firstName: string; lastName?: string;
    phone?: string;                 // PH mobile, e.g. 09171234567 (optional)
    handle: string;                 // page handle
    code?: string;                  // their code; omitted → a random AFF… code
    socials: { platform: "facebook" | "instagram" | "tiktok" | "youtube" | "x" | "other"; handle: string }[]; // 1–6
    audienceSize?: number;          // followers, rounded
  }
  ```
- Email comes from the Clerk session (never an argument).
- Returns: `Id<"creators">`. Creates a `role: "affiliate", status: "pending"` row with `creatorSocials`, `creatorAudienceSize`, `creatorAppliedAt`; the shared fixed offer supplies its price. The chosen/generated code is reserved permanently. An explicit code also sets `creatorCodeChosenAt` and completes one-time setup immediately; an omitted code leaves the generated fallback unchosen.
- Retrying returns the same id unchanged. Throws if this login or email already has a field-agent, admin or business-owner account.
- **Approval** is the existing admin page `/admin/affiliates` (`creators.updateStatus → "active"`). No new admin UI. (That page does not show socials or audience size yet.)

The legacy `affiliates.create` mutation also accepts an optional own `code?: string`, using the same format, uniqueness and permanent-reservation rules. Omission retains random `AFF…` generation for older clients; a supplied empty/invalid code is rejected. This is separate from incoming field-agent referral codes. Current mobile affiliate account setup requires a nonempty code with a matching live availability result before creating the account; older scoped drafts without that field still load and prompt the person to choose one.

### `creatorProgram.myApplication` (query, never throws)

- Args: `{}`
- Returns one of:
  - `{ status: "signed_out" }`
  - `{ status: "none" }` — no account yet
  - `{ status: "other_account" }` — signed in as a field agent, admin or similar
  - `{ status: "pending" | "active" | "suspended", handle: string | null, code: string | null, appliedAt: number | null }`

### `creatorProgram.getCreatorByCode` (query, public)

- Args: `{ code: string }` — a referral code (`MIKA30`, any case). Handles and codes have separate namespaces.
- Returns: `CreatorCard | null`.
- Current codes and permanently reserved previous codes resolve to the same active creator. The returned card displays the creator's current code. An old code never moves to a different account, including after deletion.
- Use it for "Mika's code: you save ₱1,500" at owner checkout and "Join Mika's team" at agent sign-up. To charge the discounted price, owner checkout keeps passing `affiliateHandle: card.handle` to the existing `ownerIntake.submitOwnerIntake`.

### `creatorProgram.getCreatorByHandle` (query, public)

- Args: `{ handle: string }` — a page handle (`mika` / `@mika`, any case).
- Returns: `CreatorCard | null`, with the same active-account and fixed creator-code price rules.
- Use this for `/a/<handle>` and `/a/<handle>/earn`, including existing affiliates whose generated referral code differs from their handle. It never falls back to another account's referral code.

### `creatorProgram.checkCodeAvailability` (query, signed in)

- Args: `{ code: string }`
- Returns: `{ value: string, available: boolean, error: string | null }`; `value` is trimmed and upper-cased.
- Available to the signed-in active or suspended affiliate only. Before setup is complete, other affiliates' codes, field-agent invite codes, deleted-account reservations and campaign codes are unavailable. Once setup is complete, only the current code is available for an idempotent retry; every different code is rejected. Input rules are shared in `lib/creatorCodes.ts`.
- This check does not reserve a code. Clients must match the returned `value` to the current input before enabling Save.

### `creatorProgram.codeSetup` (query, signed in)

- Args: `{}`
- Returns: `{ creatorId: Id<"creators">, code: string | null, canChoose: boolean, chosenAt: number | null }` for the current affiliate only.
- `canChoose` is true only for an active affiliate with unfinished setup. Suspended affiliates may read this state but cannot choose.
- A stored `creatorCodeChosenAt` completes setup. For older rows without a stamp, a readable/custom code is already chosen. Only an untouched generated `AFF` + eight letters/numbers (or a missing code) may choose once, and any prior distinct alias locks it even when the current code looks generated. Inferred historical choices have `chosenAt: null`; this query performs no backfill writes.
- Existing web/mobile editors verify `creatorId` matches the displayed account. They mount code availability and save hooks only when `canChoose` is true; completed setup is read-only.

### `creatorProgram.updateCode` (mutation, signed in)

- Args: `{ code: string }` — no selected account, price or preview bypass.
- Returns: `{ code: string }`, normalized to upper case.
- Active affiliates with unfinished setup only; rechecks eligibility and uniqueness in the same transaction, then stamps `creatorCodeChosenAt`. Both the previous fallback and chosen code are permanently reserved in `creatorCodeAliases`. Concurrent different choices by the same account allow exactly one winner.
- The chosen code is permanent. Repeating the same normalized code succeeds without writes; any different code, including an older alias, throws `Your creator code is already set and cannot be changed.`
- Web and mobile show the exact code and a permanence warning in a confirmation popup before setting it or creating an affiliate account. Opening or cancelling the popup performs no write. Confirmation rechecks the current account, form and availability; stale or duplicate confirmations cannot submit.
- The handle and shared links stay the same. Existing owner quotes, payments, commissions, referral identities and recruitment dates are unchanged. Old printed codes, pending referral jobs and onboarding retries continue resolving to the same creator, subject to the existing account-status rules.

---

## 2. Attribution — `attribution.*` and HTTP

Nothing here attributes on its own. A click only lets us **ask**; the person's answer (`claimAttribution`) is what links them.

### `attribution.recordClick` (mutation, public)

Call once when `/a/<handle>` or `/a/<handle>/earn` loads.

- Args: `{ handle: string, kind: "shop" | "earn", cookieId: string, userAgent?: string }`
  - `cookieId`: a random id the page keeps in a first-party cookie (`[A-Za-z0-9_-]`, ≤ 100 chars).
- Returns: `{ recorded: boolean, creator: CreatorCard | null }`. `recorded: false` when the same cookie hit the same link in the last 30 min, or the creator is not active (`creator: null`).
- No IP here. To also enable the same-network match (needed for iOS), use the HTTP endpoint below **instead** (same body).

### `POST {CONVEX_SITE_URL}/attribution/click` (HTTP, CORS `*`)

- Body: `{ "handle": "mika", "kind": "shop" | "earn", "cookieId"?: "..." }`
- Response: same as `recordClick`. 400 `{ error }` on a bad body.
- Reads the caller's IP (`cf-connecting-ip`, `x-real-ip`, then first `x-forwarded-for`), stores only `SHA-256(ATTRIBUTION_IP_SALT + ":" + ip)`. Call it from the browser (so the IP is the visitor's), not from a server.

### `attribution.suggestAttribution` (query, public)

- Args: `{ cookieId?: string }`
- Returns `null` or:
  ```ts
  { creator: CreatorCard; kind: "shop" | "earn"; clickedAt: number; matchedBy: "cookie" | "network" }
  ```
- Matches a click by this browser's cookie in the last 24 h. Returns `null` when the signed-in person already has a creator, is a creator, or is that creator.

### `POST {CONVEX_SITE_URL}/attribution/suggest` (HTTP, CORS `*`)

For the app's first open (iOS: Apple passes nothing through the App Store).

- Headers: optional `Authorization: Bearer <Clerk Convex JWT>` (to skip people already attributed).
- Body: `{ "cookieId"?: "..." }` (may be `{}`)
- Response: `{ "suggestion": <same as suggestAttribution> | null }` — cookie match first, then a click from the same IP hash in the last 24 h.
- Show "Did Mika send you? Yes / No". On **Yes**, call `claimAttribution` with `source: "confirmed"`. On **No**, do nothing.

### `attribution.claimAttribution` (mutation, signed in)

- Args:
  ```ts
  {
    handle: string;   // handle or code
    source: "install_referrer" | "confirmed" | "code";
    as?: "agent" | "owner"; // inferred from the account when omitted; no account → "agent"
  }
  ```
- Returns:
  ```ts
  {
    status: "claimed" | "unchanged" | "already_attributed"; // first claim wins
    kind: "agent" | "owner";
    linked: boolean;        // agent: recruit link written now; owner: always true
    reason: string | null;  // why an agent was not linked (below)
    creator: CreatorCard | null;
  }
  ```
- Throws: creator not found/not active; "You cannot use your own link or code." (same login or same email); the caller is a creator.
- **Agent** with an account: links the recruit at once. Without an account yet: stored as pending and applied inside `creators.create` (when no referral code is typed there).
- `reason` values: `already_recruited` (another creator was first), `already_referred` (has a field-agent referral), `already_selling` (has a paid sale already, so not a new recruit), `self_referral`, `not_field_agent`, `not_a_creator`.
- **Owner**: stored for checkout. Read it back with `myAttribution` and pre-fill the code.
- Android: read the Play install referrer on first open, take the handle out of it, call this with `source: "install_referrer"` (after sign-in).
- Typed code at agent sign-up: you can either pass `referredByCode: card.code` to the existing `creators.create`, or call this with `source: "code"` after.

### `attribution.myAttribution` (query)

- Args: `{}`
- Returns `null` or `{ kind: "agent" | "owner", source, status: "pending" | "applied" | "not_applied", claimedAt: number, creator: CreatorCard | null }` (`creator` is `null` if that creator is no longer active).

---

## 3. Recruits and the override (server side, no client calls)

- **Recruit link** (`creators` row of the field agent): `recruitedByCreatorId`, `recruitedAt` (join date, starts the 12 months), `recruitedVia` (`"code" | "install_referrer" | "confirmed"`). Also fills `referredBy` / `referredByCode` / `referredByName`.
- Written when an agent signs up with a creator's code (`creators.create` → `referrals.createFromSignup`), applies one later (`creators.applyReferralCode`), or claims (`claimAttribution`). From the cut-over, a creator's code no longer writes a `referrals` row, so no ₱1,000 for those recruits. Field agents inviting field agents are unchanged (₱1,000).
- **One level only.** Only the agent's direct creator earns. Creators (`affiliate`) can't be recruits, and an agent invited by an agent is never tied to that agent's creator.
- **Payout** `internal.creatorOverrides.creditForSubmission({ submissionId })`:
  - Scheduled by `payments.creditCreatorForPayment` (Wise match and admin "Mark as paid") and `submissions.markPaid`.
  - Pays only when `status` is `"paid"` or `"completed"` (**paid in full**). `"deposit_paid"` is skipped: **whoever moves a down-payment sale to paid-in-full must call this again** (it is idempotent).
  - Amount: `overrideFor(websitePrice)`, where the website price is `amount` minus the custom-domain add-on.
  - Only if the sale was paid (`paidAt ?? creatorPaidAt`) within `[recruitedAt, recruitedAt + 12 months)`.
  - Never on comped or giveaway sites, a pre-cut-over recruit, a recruit with a legacy `referrals` row, a pending or deleted creator, or a shop whose owner email or phone is the creator's ("an owner never earns on their own site"). A suspended creator still gets overrides already earned (same as referral bonuses).
  - Writes one `earnings` row `{ type: "creator_override", status: "available", amount, creatorId: <creator>, submissionId }` per submission, adds to `balance` and `totalEarnings`, and sends a notification. Returns `{ credited: true, amount }` or `{ credited: false, reason }`.

---

The existing `/affiliates/dashboard` and mobile affiliate screens also expose
both programs through `affiliates.portal`. Its `referrals` and `referralStats`
fields keep their legacy bonus meaning. Additive `recruits` rows contain
`{ _id, referredName, createdAt, endsAt, earning, totalEarned }`, and
`recruitStats` contains `{ total, earning, totalEarned }` for recurring team
commissions. Recruits never appear as pending ₱1,000 bonuses. Earnings history
includes `creator_override` rows; the normal wallet and withdrawal flow pays
these too. This response contains only the signed-in affiliate's team, without
agents' contact details. Earlier referral bonuses are not migrated or reset.

### Additive native portal month and team fields

`affiliates.portal` accepts `{ month?: string }`, where `month` is `YYYY-MM`. Omitting it selects the current Asia/Manila calendar month. A supplied month must be January 2000 or later and cannot be in the future; invalid values throw a `ConvexError`. It returns the selected `month: { start, end, label }` (`[start, end)`, label `YYYY-MM`), and:

```ts
income: {
  directThisMonth: number; // submission_approved ledger credits
  teamThisMonth: number;   // creator_override ledger credits
  totalThisMonth: number;  // the two streams above
};
```

These new totals use each earning's `createdAt` and count `available` and `withdrawn` credits, excluding `pending`. Direct commission is credited when the owner makes a qualifying down payment or full payment; team commission is credited only after full payment. A later withdrawal, deleted submission, or changed submission status does not erase a credited earning. Other earning types, including earlier referral bonuses, remain separate. Existing `summary`, `recruitStats.totalEarned`, referral totals and full histories retain their previous all-status/history semantics.

Each `recruits` row adds `photo: string | null` (the agent's public profile image only), `monthEarned: number` (this creator's credited team share in that month), and `monthsLeft: number` (a display estimate clamped to 0–12, zero after expiry). Existing `createdAt` and `endsAt` remain the exact join timestamp and end of the 12-calendar-month commission period. No contact details or shop-capture photos are exposed through these additions.

The redesigned detail view additionally reads optional `creditedTotalEarned: number`, the lifetime sum of this agent's `available` and `withdrawn` override earnings. The server returns zero for an agent without credited overrides. Existing `totalEarned` and `recruitStats.totalEarned` retain their legacy all-status semantics; clients must not present those as credited cash when pending rows exist. Month selection never changes this lifetime value.

Selecting a month changes the returned month, `income` totals and each recruit's `monthEarned` only. Available balance, pending commission, in-flight withdrawals, lifetime totals, histories, referral statistics and commission eligibility do not change. `earning`, `monthsLeft` and the exact commission expiry continue to use the actual current time.

Both `affiliates.portal` and `creatorPortal.summary` use `creatorOverrideMonthsLeft(joinedAt, now)` for the displayed months remaining. It is bounded to 0–12, including leap-year periods that would otherwise round up to 13, and is zero at or after the exact expiry. The estimate never changes recruitment dates, commission eligibility, or money. The previous development `demoMonthsLeft` response field has been removed; any stale `DEV_AFFILIATE_BAR_PREVIEW` setting is ignored.

### Native affiliate sales — `affiliates.sales`

Authenticated active and suspended affiliates can read their own paginated sales. Pending, deleted and other-role accounts are rejected.

```ts
args: {
  paginationOpts: PaginationOptions;
  month?: string;  // YYYY-MM, Asia/Manila; same validation as affiliates.portal
  status?: "paid"; // paid in full by payment stamps, with legacy status fallback
};
// Standard Convex pagination metadata plus:
page: Array<{
  _id: Id<"submissions">;
  businessName: string;
  price: number;
  commission: number;
  status: string;
  workflowStatus: string;
  paymentStatus: "paid_in_full" | "partially_paid" | "unpaid";
  commissionCredited: boolean;
  createdAt: number; // original submission creation time
}>;
```

Without `month`, the query covers the affiliate's full sales history. With `month`, it includes owned orders created in that Manila calendar month **or** owned orders with a direct `submission_approved` earning credited in that month. The credit must have status `available` or `withdrawn`; pending credits and team overrides do not add orders to this set. This allows an earlier order credited in the selected earnings month to appear with its original order date.

The ownership, month and optional Paid filters apply **before pagination**. Results remain ordered by submission creation time descending. `status: "paid"` uses the shared full-payment rule: a full-payment stamp wins; a recorded down payment without full settlement is not paid in full; legacy rows without payment stamps fall back to `paid` or `completed`. Omitting the filter returns all workflow states. `commissionCredited` independently checks this affiliate's available or withdrawn direct-commission ledger entry, even if credited outside the selected month. Price and commission come from each order's captured amounts; historical orders are not repriced. Owner contact details, raw capture photos and private asset URLs are excluded.

### Native confirmation status

The mobile first-open gate uses the HTTP suggestion endpoint and explicitly asks “Did X send you?” on both platforms. The current native implementation uses `source: "confirmed"`; Android Play install-referrer extraction is not wired and no new install-referrer dependency is included.

A signed-out Yes saves consent locally and makes no server claim. After sign-in, only the first authenticated subject can adopt that answer; claiming then requires an explicit agent or owner flow and live matching account/auth state. Acknowledgements and pending retries are scoped to that subject. No clears pending consent and never creates a claim. Existing server attribution wins, and late callbacks from another account or an unmounted gate are ignored. Failed confirmation can be retried; a null, invalid, or failed network suggestion produces no invented creator. The HTTP lookup, including its response body, has a six-second timeout and does not block the underlying app when no question is available.

## 4. Creator portal — `creatorPortal.summary` (query, active or suspended creator)

Throws "Your creator account is waiting for admin approval." while pending, "A creator account is required." for anyone else.

- Args: `{ month?: string }`. Uses the same `YYYY-MM`, January 2000 minimum and no-future-month validation as `affiliates.portal`. Omit for the current Manila month. Selection filters the displayed shop payment totals, team credits and agent sales. Wallet balances, all-time funnel/history and remaining commission months stay live; it never changes stored records or payout eligibility.
- Returns:
  ```ts
  {
    creator: CreatorCard & { status: "active" | "suspended"; shopLink: "/a/<handle>"; earnLink: "/a/<handle>/earn" };
    month: { start: number; end: number; label: "2026-11" };      // Manila month, [start, end)
    rates: { overrideRate: 0.05; overrideMonths: 12 };

    // Sell to shops (now money)
    now: {
      thisMonth: number;            // ₱ kept from shops paid in full this month
      shopsThisMonth: number;
      shops: Shop[];                // those shops
    };

    // Recruit field agents (monthly money)
    monthly: {
      thisMonth: number;            // ₱ override credited this month
      activeAgents: number;         // recruits still in their 12 months with ≥ 1 paid sale this month
      agentsInWindow: number;       // recruits still in their 12 months
      nextEndDate: number | null;   // soonest end of a recruit's 12 months
    };

    funnel: {
      shop: { clicks: number; signUps: number; sales: number }; // signUps = owners who claimed the code; sales = shops paid in full
      earn: { clicks: number; signUps: number; sales: number }; // signUps = recruits; sales = recruits' paid sales (all time)
    };

    recruits: {
      creatorId: Id<"creators">;
      name: string;
      area: string | null;          // city of their latest submission
      joinedAt: number;
      salesThisMonth: number;
      overrideThisMonth: number;    // ₱
      overrideTotal: number;        // ₱
      endsAt: number;
      monthsLeft: number;           // shared estimate bounded to 0–12; 0 at or after expiry
      earning: boolean;             // still inside the 12 months
    }[];                            // newest first

    shops: Shop[];                  // every shop that used the code, newest first

    payouts: {
      readyToSend: number;          // balance you can withdraw now
      waitingForShops: number;      // waitingFromShops + waitingFromTeam
      waitingFromShops: number;     // your 50% on shops that have the site but have not paid in full
      waitingFromTeam: number;      // 5% on recruits' sales still being paid (inside the 12 months)
      inFlight: number;             // withdrawals pending or processing
      history: { withdrawalId: Id<"withdrawals">; amount: number; status: "pending" | "processing" | "completed" | "failed"; requestedAt: number; sentAt: number | null }[];
    };
  }

  type Shop = {
    submissionId: Id<"submissions">;
    businessName: string;
    date: number;                   // order created
    paidAt: number | null;          // paid in full
    listPrice: number;              // struck-through price, e.g. 4999
    paid: number;                   // agreed total charge, NOT money received (₱0 on a promo site)
    kept: number;                   // agreed creator commission, NOT proof of credit
    status: "paid" | "paying" | "waiting" | "not_paid"; // paying = down payment made
    workflowStatus: string;         // original submission.status, for a detailed lifecycle label
    paymentStatus: "paid_in_full" | "partially_paid" | "unpaid";
    commissionCredited: boolean;    // matching owned submission_approved ledger with status available/withdrawn
  };
  ```

The three detailed sale fields are additive; the existing coarse `status`, totals and payment logic are unchanged. `paymentStatus` follows the shared payment truth: `paidInFullAt` proves full payment; a recorded down payment without full payment remains partial even if an old workflow says `paid` or `completed`. A legacy `deposit_paid` row is also partial. With no payment fields, legacy `paid`/`completed` rows are treated as paid in full.

`commissionCredited` is independent of workflow and payment labels. It requires the signed-in creator's matching `submission_approved` earning with status `available` or `withdrawn`; pending earnings, team overrides, referral bonuses and another account's earnings do not qualify. The legacy `creatorPaidAt` timestamp alone is not used as evidence of a ledger credit. A stored `kept` amount is the agreed commission and can be shown before any credit exists.

Withdrawals keep using the existing `withdrawals.create` and saved payout methods.

---

## 5. Data added (all additive)

- `creators`: `recruitedByCreatorId`, `recruitedAt`, `recruitedVia`, `creatorSocials`, `creatorAudienceSize`, `creatorAppliedAt`; index `by_recruited_by`.
- `earnings.type`: new value `"creator_override"`.
- New table `attributionClicks` (`creatorId, handle, kind, cookieId?, ipHash?, userAgent?, channel, createdAt`).
- New table `creatorAttributions` (`clerkId, creatorId, handle, kind, source, status, reason?, createdAt, appliedAt?`).

## 6. Environment

- `ATTRIBUTION_IP_SALT` (Convex env): any long random string. Without it the same-network suggestion is off; raw IPs are never stored either way.

## 7. Field-agent capture design — `submissions.chooseDesign`

Additive legacy/mobile capture API, separate from the owner-app design flow and the affiliate creator program.

- Mutation: `api.submissions.chooseDesign({ id: Id<"submissions">, templateId: string })` → `{ ok: true }`.
- Requires a signed-in, certified field agent who owns the draft. Deleted or suspended accounts, accounts without certification or with `rejectedAt`, another agent's draft, sent captures, and `owner_app` / `owner_intake` submissions are rejected. There is no admin override through this endpoint.
- `templateId` must be a canonical catalog code such as `barbershop:BP`; surrounding whitespace is trimmed. Unknown codes and bare letters are rejected by `lib/captureDesign.ts` using `templateByCode` from `components/editor/templateCatalog.ts`.
- Writes only `templateId`, `templateIds: [templateId]`, and the server timestamp `styleUpdatedAt`. It does not submit, approve, build or publish the site. Final Send and the existing admin review flow remain separate; the normal build paths read the saved choice.
- The mobile picker shows read-only public template samples, not this shop's generated website. Choosing a sample does not approve a finished site or initiate a payment.
- Offline selection is retained under the signed-in creator's scoped `submission_design` cache as `{ submissionId, templateId, savedAt }`. Sync remaps the temporary offline ID, saves only a matching owned draft's choice, and retains it on failure. Selection alone never queues a submission.
- Final Send may add `templateId` to `submission_pending_submit`; that confirmed queued choice takes priority during sync. Older queues without a design remain supported. Completing or discarding a capture clears its matching design metadata without carrying it into another account or draft.
