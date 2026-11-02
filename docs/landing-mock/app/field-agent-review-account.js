/* Current native Earn and account views. Device checks are pending, not confirmed defects. */
window.FIELD_AGENT_REVIEW_ACCOUNT = [
  {
    id: 'earn',
    title: 'Earn home',
    area: 'money',
    status: 'device',
    checkRevision: 'earn-details-v3',
    summary:
      'Tap a recent earning or cash-out card to read its full details in a sheet. The previews keep equal heights and shorten long names and emails at the end.',
    implemented: [
      'Available balance, Total earned and Withdrawn use real account values.',
      'Each of the six month bars is tappable: the selected bar and displayed month total update together, excluding pending money.',
      'Recent earnings and Cash outs use equal-height preview cards. Long names and emails end with an ellipsis; amounts and statuses remain visible.',
      'Both preview cards open a details sheet with full names or email, the exact amount, date, status and saved transfer reference when present.',
      'See all opens complete Payouts history, where full names, emails and transfer details remain readable.',
      'Cash out to Wise floats above navigation, with content space reserved below it. The amount stays in the balance card and cash-out sheet.',
    ],
    checks: [
      'Tap an earlier month and the current month: highlight and total must match. Recent activity stays the latest overall.',
      'Compare loading, true zero and pending-only earnings without showing invented growth.',
      'Use Preview long details with standard and larger text: both cards stay the same height, long names/emails end with an ellipsis, and amounts/statuses remain readable.',
      'Open both cards with long details enabled: read the complete text, close the sheet and return to the same Earn position. Check Back, Escape and screen-reader focus.',
      'Check long peso totals and the floating button on a narrow phone with larger text.',
    ],
    sources: [
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 213 },
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 343 },
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 459 },
      { path: 'apps/mobile/components/wallet/WalletActivity.tsx', line: 79 },
      { path: 'apps/mobile/components/wallet/WalletActivity.tsx', line: 208 },
    ],
  },
  {
    id: 'history',
    title: 'Payouts history',
    area: 'money',
    status: 'device',
    summary:
      'Complete earnings and cash-outs share one month-grouped history. Check filtering, long details and return navigation on a phone.',
    implemented: [
      'Earned, Cashed out and Ready totals sit above All, Earned and Cashed out filters.',
      'Activity is sorted and grouped by month rather than limited to the home preview.',
      'Wise status, references and failed-transfer explanations remain available in full history.',
      'Known cached history stays readable offline; missing history asks the user to reconnect.',
    ],
    checks: [
      'Open both See all links and the clock; verify the intended filter and complete record list.',
      'Read a long Wise email, a failed transfer reason and a reference without clipped text.',
      'Use Back to return to Earn; check Android hardware Back only closes the focused history view.',
    ],
    sources: [
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 348 },
      { path: 'apps/mobile/components/wallet/WalletActivity.tsx', line: 177 },
      { path: 'apps/mobile/components/wallet/WalletActivity.tsx', line: 246 },
    ],
  },
  {
    id: 'cashout',
    title: 'Wise cash-out sheet',
    area: 'money',
    status: 'device',
    priority: 'P1',
    summary:
      'The amount and destination flow is implemented. Review its keyboard layout and validation without making a real transfer.',
    implemented: [
      'Accounts without a Wise email first open Set up Wise.',
      'The cash-out sheet starts with the available balance and offers eligible quick picks plus All.',
      'The saved Wise email can be edited; inline errors explain invalid amounts or failed requests.',
      'Offline, paused and busy states block confirmation; sheet content remains scrollable with the keyboard.',
    ],
    checks: [
      'Open the flow with and without a saved Wise email and review the amount and destination.',
      'Edit amount and email with the keyboard open and larger text; keep both actions reachable.',
      'Check zero, above-balance and offline states without sending money.',
      'Review request success, failure and repeated-tap feedback using a non-payment test flow.',
    ],
    sources: [
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 239 },
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 472 },
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 527 },
    ],
  },
  {
    id: 'me',
    title: 'Me',
    area: 'account',
    status: 'in-code',
    summary:
      'The current app separates Your work, Settings, Help and Legal into cards, with Sign out in its own row.',
    implemented: [
      'The identity card shows the actual avatar, name, Field agent label, conditional Certified badge and referral code.',
      'Submitted excludes drafts; Balance and Earned come from the account.',
      'Your work, Settings, Help and Legal have separate menu cards; Sign out is a separate red action.',
      'Certificate, Dashboard, submissions, invitations and account tools remain reachable.',
    ],
    checks: [
      'Check long names, referral codes and peso totals at normal and larger text sizes.',
      'Open each menu destination and return to Me without losing the current account.',
      'Verify certificate access for a certified agent and review share or gallery permission prompts on a device.',
    ],
    sources: [
      { path: 'apps/mobile/app/(app)/(tabs)/profile.tsx', line: 270 },
      { path: 'apps/mobile/app/(app)/(tabs)/profile.tsx', line: 398 },
      { path: 'apps/mobile/app/(app)/(tabs)/profile.tsx', line: 422 },
    ],
  },
  {
    id: 'profile',
    title: 'Edit profile',
    area: 'account',
    status: 'device',
    summary:
      'The centered photo editor, responsive fields and pinned save action are implemented, including the rejected-profile correction mode.',
    implemented: [
      'A centered avatar and camera action open the profile-photo picker.',
      'Names adapt between split and stacked fields; Mobile is editable and Email stays locked.',
      'Save changes stays pinned, while Delete my account is a separate outlined danger action.',
      'Fix your profile retains the warning, focuses the requested field and preserves the passed quiz.',
    ],
    checks: [
      'Focus name and mobile with the keyboard open; verify the field and save button stay reachable.',
      'Cancel photo picking and review a failed save without losing the existing avatar or typed corrections.',
      'Check the review warning, targeted field focus and Resubmit for review layout with larger text.',
    ],
    sources: [
      { path: 'apps/mobile/app/(app)/edit-profile.tsx', line: 117 },
      { path: 'apps/mobile/app/(app)/edit-profile.tsx', line: 320 },
      { path: 'apps/mobile/app/(app)/edit-profile.tsx', line: 430 },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    area: 'account',
    status: 'device',
    summary:
      'Full-message reading and deliberate read actions are implemented. Verify the bell badge and push entry behavior on a device.',
    implemented: [
      'Messages are grouped into Today, This week and Earlier, with unread dots.',
      'Opening a message displays its full body and marks only that recipient-owned notification read.',
      'Mark all read is explicit; opening the inbox alone does not bulk-read messages.',
      'Push and deep-link targets can select only a message already in the signed-in account’s inbox.',
    ],
    checks: [
      'Open the bell and leave without selecting a message; verify unread messages remain unread.',
      'Open one unread message and confirm the badge changes while other messages remain unread.',
      'Read a long message and check the loading or offline hint for an announcement.',
      'Open a push notification with the app closed and verify the correct account and full message.',
    ],
    sources: [
      { path: 'apps/mobile/app/(app)/notifications.tsx', line: 124 },
      { path: 'apps/mobile/app/(app)/notifications.tsx', line: 134 },
      { path: 'apps/mobile/app/(app)/notifications.tsx', line: 183 },
      { path: 'apps/mobile/app/(app)/notifications.tsx', line: 300 },
    ],
  },
  {
    id: 'referrals',
    title: 'Invite field agents',
    area: 'account',
    status: 'device',
    checkRevision: 'referrals-how-v2',
    summary:
      'A field agent earns a one-time ₱1,000 bonus per invited friend when that friend’s first real website is fully paid. Signing up alone does not earn a bonus.',
    implemented: [
      'Earn and Me both open Invite field agents, with a clear ₱1,000 per friend reward card before the saved referral code.',
      'Share and Copy use the signed-in agent’s saved code in the app; the board demonstrates these controls without opening a share sheet or changing the clipboard.',
      'Invited, Qualified and Earned summarize the account’s invitations, including rewarded invitations in Qualified.',
      'How it works uses one card with three numbered instructions, not selectable or completion controls. The one-time bonus is added to Earn after the friend’s first website is fully paid.',
    ],
    checks: [
      'Open the invitation screen from Earn and Me, then return to the originating screen.',
      'Read all three numbered instructions at standard and larger text sizes: badges stay at the top, text wraps naturally, and rows do not look selectable.',
      'On a phone, verify Share and Copy use your own saved referral code, and handle cancelled sharing without losing the list.',
      'Compare Signed up, Qualified and Rewarded invitations: do not imply a sign-up or training completion alone earns ₱1,000.',
    ],
    sources: [
      { path: 'apps/mobile/app/(app)/referrals.tsx', line: 104 },
      { path: 'apps/mobile/app/(app)/referrals.tsx', line: 125 },
      { path: 'apps/mobile/app/(app)/referrals.tsx', line: 131 },
      { path: 'apps/mobile/app/(app)/referrals.tsx', line: 218 },
      { path: 'packages/shared/pricing.ts', line: 75 },
      { path: 'convex/referrals.ts', line: 79 },
    ],
  },
];
