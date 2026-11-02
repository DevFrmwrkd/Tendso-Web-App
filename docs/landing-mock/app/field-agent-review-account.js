/* Current native Earn and account views. Device checks are pending, not confirmed defects. */
window.FIELD_AGENT_REVIEW_ACCOUNT = [
  {
    id: 'earn',
    title: 'Earn home',
    area: 'money',
    status: 'device',
    checkRevision: 'earn-months-v1',
    summary:
      'Select a month to see its credited earnings above the chart. The shorter Cash out to Wise action keeps the balance in its own card.',
    implemented: [
      'Available balance, Total earned and Withdrawn use real account values.',
      'Each of the six month bars is tappable: the selected bar and displayed month total update together, excluding pending money.',
      'One recent earning and one cash-out preview link to complete Payouts history.',
      'Cash out to Wise floats above navigation, with content space reserved below it. The amount stays in the balance card and cash-out sheet.',
    ],
    checks: [
      'Tap an earlier month and the current month: highlight and total must match. Recent activity stays the latest overall.',
      'Compare loading, true zero and pending-only earnings without showing invented growth.',
      'Check long peso totals and the floating button on a narrow phone with larger text.',
    ],
    sources: [
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 313 },
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 353 },
      { path: 'apps/mobile/components/wallet/WalletActivity.tsx', line: 144 },
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
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 318 },
      { path: 'apps/mobile/components/wallet/WalletActivity.tsx', line: 114 },
      { path: 'apps/mobile/components/wallet/WalletActivity.tsx', line: 177 },
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
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 210 },
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 433 },
      { path: 'apps/mobile/app/(app)/(tabs)/wallet.tsx', line: 487 },
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
];
