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
| `CREATOR_CODE_DEFAULT_DISCOUNT` | `0.3` | A new creator's code starts at 30% off |
| `CREATOR_CODE_DEFAULT_PRICE` | `3499` | ₱4,999 × 0.7 |
| `overrideFor(websitePrice)` | `round(price × 0.05)` | ₱999 → 50, ₱2,999 → 150, ₱3,499 → 175, ₱4,999 → 250 |
| `earnsCreatorOverride(joinedAt)` | boolean | `joinedAt >= CREATOR_OVERRIDE_CUTOVER` |
| `creatorOverrideEndsAt(joinedAt)` | ms | Join date + 12 calendar months |

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
  price: number;         // the creator's price for a shop, e.g. 3499
  saving: number;        // listPrice − price, e.g. 1500  ("you save ₱1,500")
  percentOff: number;    // 30
};
```

Only **active** creators resolve. A pending (not yet approved), suspended or deleted creator gives `null` everywhere.

Public messages and social links come only from the creator's saved page settings. Application social accounts, account email, phone and payout details remain private. An existing Facebook or Messenger page link is used when no newer social-link map has been saved; an explicitly empty map hides every social button.

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
- Returns: `Id<"creators">`. Creates a `role: "affiliate", status: "pending"` row with `affiliatePrice: 3499`, `creatorSocials`, `creatorAudienceSize`, `creatorAppliedAt`.
- Retrying returns the same id unchanged. Throws if this login or email already has a field-agent, admin or business-owner account.
- **Approval** is the existing admin page `/admin/affiliates` (`creators.updateStatus → "active"`). No new admin UI. (That page does not show socials or audience size yet.)

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
- Use it for "Mika's code: you save ₱1,500" at owner checkout and "Join Mika's team" at agent sign-up. To charge the discounted price, owner checkout keeps passing `affiliateHandle: card.handle` to the existing `ownerIntake.submitOwnerIntake`.

### `creatorProgram.getCreatorByHandle` (query, public)

- Args: `{ handle: string }` — a page handle (`mika` / `@mika`, any case).
- Returns: `CreatorCard | null`, with the same active-account and clamped-price rules.
- Use this for `/a/<handle>` and `/a/<handle>/earn`, including existing affiliates whose generated referral code differs from their handle. It never falls back to another account's referral code.

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

For development visual testing only, a recruit may additionally have `demoMonthsLeft?: number` (integer 0–12, including zero). This optional display value never changes `monthsLeft`, `endsAt`, `earning`, income, recruitment dates or commission eligibility. Clients must label it as simulated progress and must not infer real expiry from it. The field is omitted unless the automatic `CONVEX_CLOUD_URL` exactly matches the development deployment `https://diligent-ibex-454.convex.cloud`, the signed-in affiliate matches both configured IDs and has an email ending `+clerk_test@example.com`, and the owned post-cutover recruit has role `creator` and a synthetic `dev_affiliate_…:agent:…` Clerk subject. The server-only `DEV_AFFILIATE_BAR_PREVIEW` setting accepts exactly `{ "clerkId": "<test subject>", "creatorId": "<test creators id>", "monthsLeftByRecruit": { "<synthetic recruit id>": 9, "<another recruit id>": 0 } }`. Invalid configuration, any invalid map value, a different deployment/account or an unset setting omits the metadata; ordinary account and settlement behavior remains unchanged.

### Native affiliate sales — `affiliates.sales`

Authenticated active and suspended affiliates can read their own paginated sales. Pending, deleted and other-role accounts are rejected.

```ts
args: {
  paginationOpts: PaginationOptions;
  month?: string;  // YYYY-MM, Asia/Manila; same validation as affiliates.portal
  status?: "paid"; // includes both paid and completed submissions
};
// Standard Convex pagination metadata plus:
page: Array<{
  _id: Id<"submissions">;
  businessName: string;
  price: number;
  commission: number;
  status: string;
  createdAt: number; // original submission creation time
}>;
```

Without `month`, the query covers the affiliate's full sales history. With `month`, it includes owned orders created in that Manila calendar month **or** owned orders with a direct `submission_approved` earning credited in that month. The credit must have status `available` or `withdrawn`; pending credits and team overrides do not add orders to this set. This allows an earlier order credited in the selected earnings month to appear with its original order date.

The ownership, month and optional Paid filters apply **before pagination**. Results remain ordered by submission creation time descending. `status: "paid"` includes current `paid` and `completed` orders; omitting it returns all statuses. Price and commission come from the order's saved amounts, so changing the creator's current page price affects future orders only. The response exposes no owner contact details, raw capture photos or private asset URLs; clients use a storefront fallback when no permitted public image is available.

### Native confirmation status

The mobile first-open gate uses the HTTP suggestion endpoint and explicitly asks “Did X send you?” on both platforms. The current native implementation uses `source: "confirmed"`; Android Play install-referrer extraction is not wired and no new install-referrer dependency is included.

A signed-out Yes saves consent locally and makes no server claim. After sign-in, only the first authenticated subject can adopt that answer; claiming then requires an explicit agent or owner flow and live matching account/auth state. Acknowledgements and pending retries are scoped to that subject. No clears pending consent and never creates a claim. Existing server attribution wins, and late callbacks from another account or an unmounted gate are ignored. Failed confirmation can be retried; a null, invalid, or failed network suggestion produces no invented creator. The HTTP lookup, including its response body, has a six-second timeout and does not block the underlying app when no question is available.

## 4. Creator portal — `creatorPortal.summary` (query, active or suspended creator)

Throws "Your creator account is waiting for admin approval." while pending, "A creator account is required." for anyone else.

- Args: `{}`
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
      monthsLeft: number;           // 0 when ended
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
    paid: number;                   // what the shop pays (₱0 on a promo site)
    kept: number;                   // the creator's 50%
    status: "paid" | "paying" | "waiting" | "not_paid"; // paying = down payment made
  };
  ```

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
