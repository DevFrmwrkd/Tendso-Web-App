# Native mobile account roles

The Expo app in `apps/mobile` now supports creators, affiliates and existing
admins through the single root Convex backend and `@tendso/convex-client`.
Web and native releases remain separate.

## Sign-in and setup

- Signup offers Creator or Affiliate. Admin access is assigned separately; there
  is no admin signup option. Existing accounts retain their account type. Using
  both creator and affiliate accounts requires different emails.
- Email, Google and Apple signup save the selected type and profile before
  activating Clerk. The existing hidden TikTok flow follows the same sequence.
  Signup handlers do not create Convex rows before authentication.
- Authenticated users without a backend account finish an explicit
  `account-setup` form. It waits for Convex authentication and verifies that
  `adminAccess.me` returns the current Clerk user before creating anything.
  Existing accounts bypass setup; business owners and unsupported roles use the
  website instead.
- Pending details are scoped to Clerk user, session or email, expire after seven
  days, survive failed activation/creation, and are cleared after successful
  creation or confirmed sign-out. Clerk-bound drafts cannot move to another user.
- Creators retain mobile numbers and optional referral codes. Affiliates provide
  name, mobile and a lowercase page handle; shared validation checks its format
  and reserved words, and the server enforces uniqueness. Affiliates have no
  incoming referral field. Their own codes can refer creators after admin
  approval. New affiliate accounts wait for approval before their dashboard
  opens; existing active affiliates retain access. See
  [Affiliate signup approval](AFFILIATE-APPROVAL.md).

## Affiliate screens

Affiliates have Home, My page, Sales, Wallet and Profile tabs. Home shows available
balance, pending commission, total earned and creator referrals. My page edits
photo, display name, short message, Facebook/Messenger link and website price
within the shared PHP 999–4,999 range. The saved offer includes a public link, QR
PNG and a printable poster PNG with A4 proportions.

Sales paginate the affiliate's own orders and retain each sale's frozen price and
commission. Wallet reuses the existing Wise payout flow and shows earnings and
withdrawal history through the authenticated affiliate portal. Suspended
affiliates can inspect their history; page edits, sharing and withdrawals are
disabled. Affiliates do not enter creator training, interviews or submissions.

## Creator and offline protections

Legacy rows without a role remain creators. Their training, quiz, verification,
submission, wallet and profile flows remain available. Wrong-role deep links
redirect before mounting the target screen; deleted accounts and suspended
creators/admins are blocked.

Cached roles support creator draft navigation offline, never admin permissions.
Affiliates and admins must reconnect. Automatic draft sync runs only for a live,
authenticated creator outside preview, checks the queued creator id and verifies
the stored submission owner before uploading media or submitting. A different
login cannot sync another creator's saved draft.

## Native admin and preview

Existing online admins get overview counts, submission and creator review,
creator/affiliate suspension controls, pending affiliate approval, and payout
history with Wise status reconciliation. Mutations retain server authorization; native confirmations
recheck permission and actor scope, and submission review also scopes its target.
Sign-out is available from the overview.

The Admin/Affiliate/Creator switcher changes the displayed view only. Creator and
affiliate previews use sample data, keep the admin identity unchanged and disable
submission, account editing, sharing and payout actions.

Website generation/publishing, giveaway activation, lead management, settings,
recording review and payout funding remain in secure web admin. Native links open
the corresponding web tools, which may require a separate web sign-in. Native
submission approval does not publish a website or activate a giveaway.

## Validation and release state

Final validation passes: all 16 mobile Jest suites (234 tests), all 21 Convex test
files (386 tests), mobile and root web/backend TypeScript checks, and Expo bundle
exports for Android (2,170 modules) and iOS (2,173 modules). The mobile suite
includes four offline cross-account sync regressions alongside signup/bootstrap,
role routing, affiliate, sharing and admin coverage. Implementation is frozen.

No signed device build, physical-device acceptance test or native release has
been completed for this change. Bundle export alone is not a store-ready build.
Validate authentication, media sharing and Wise interactions on devices before
the next native release.

After merge, deploy Convex from the **web repository root**: creator approval,
rejection and the pending-approval query now use the shared admin guard, including
suspended/deleted-account rejection. Do not deploy a separate mobile backend.
Then verify the merged backend and create a native build through the existing
release process; existing installed binaries do not receive these screens merely
because web or Convex is deployed.
