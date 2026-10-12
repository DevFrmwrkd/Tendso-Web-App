# Affiliate signup approval

New affiliate applications wait for an administrator before they become active.
This replaces the original instant-activation decision for new signups only.
Existing active affiliates keep their access; there is no backfill or migration.

## Account lifecycle

- Web and mobile signup call the same `affiliates.create` mutation, which now
  creates `role: 'affiliate', status: 'pending'` rows. A page handle and referral
  code are reserved immediately, but cannot generate new sales or referrals yet.
- The web dashboard boundary and native account boundary show an awaiting
  approval screen before mounting sales, wallet, page editing or referral tools.
  The existing reactive account query releases this screen after approval.
- Pending mobile users can still delete their account from the waiting screen.
  The waiting screen and Edit Profile share the existing confirmed deletion
  flow: mark the Convex account deleted, then delete Clerk credentials and sign out.
- Web admin → Affiliates and native admin → Accounts → Affiliates show pending
  applications first. Approve uses the existing admin-only
  `creators.updateStatus({ id, status: 'active' })` mutation. Active affiliates
  retain Suspend; suspended affiliates retain Reactivate.
- This change adds approval only. It does not introduce a rejection lifecycle,
  creator training, a quiz, or an affiliate certification requirement.

## Server enforcement

Pending affiliates cannot edit their page, access the financial portal or sales
feed, request a withdrawal, or have their code accepted for a new creator
referral. Public referral-code lookup follows the same active-affiliate rule as
signup, code application and scheduled referral creation.

The existing public-offer resolver already requires an active affiliate. A
pending handle therefore returns the plain Tendso offer at PHP 4,999; owner
intake credits Self-Serve with zero affiliate commission. Browser-supplied prices
remain ignored.

Previously earned commissions and accepted referrals retain their existing
settlement flow. Suspension and approval do not rewrite frozen sale amounts or
erase wallet history.

## Deliberately unchanged

- The shared schema and generated API: `status` already supports `pending`; no
  required fields, new endpoints or deployment migration are needed.
- Creator signup, training, certification, creator-only admin lists and Discord
  creator approvals: affiliate review stays separate from creator verification.
- Public affiliate pages, owner intake and payment email/pay-page pricing:
  their existing active-account resolver and frozen pricing remain authoritative.
- Existing affiliate profile fields, payout method screens, earnings and Wise
  settlement: application approval does not change those contracts.
- The admin account-view switcher and its sample affiliate/creator dashboards.

Mobile signup and admin home-route helpers also use the canonical route strings
accepted by Expo's generated types. Their destinations stay the same.

## Release

Deploy Convex from the web repository root after merge. Web approval screens ship
through the normal Vercel deployment. Native waiting/approval screens require a
new mobile release; deploying web/Convex does not update an installed binary.
Existing creator accounts and active affiliates retain their account types.

Validation results are recorded in the pull request. No signed native build or
store submission is part of this change.
