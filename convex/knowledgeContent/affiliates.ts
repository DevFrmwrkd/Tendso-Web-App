import { CREATOR_OVERRIDE_CUTOVER, CREATOR_OVERRIDE_MONTHS } from '../../packages/shared/pricing';
import type { KnowledgeGuide } from './types';

// The cutover is policy in shared pricing, expressed as a Manila date without Intl.
const recruitProgramStart = new Date(CREATOR_OVERRIDE_CUTOVER + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Detailed follow-on help; the existing code/page/earnings introductions remain unchanged. */
export const affiliateGuides: KnowledgeGuide[] = [
    // Sources: packages/shared/affiliateSales.ts; convex/affiliates.ts sales;
    // convex/creatorPortal.ts summary; convex/payments.ts creditCreatorForPaymentImpl;
    // components/v2/creators/PortalView.tsx ShopProgress; apps/mobile/components/affiliate/Sales.tsx.
    {
        slug: 'creator-sale-payment-and-credit-statuses',
        title: 'Understand a sale’s website, payment and commission statuses',
        summary: 'A website being ready, an owner having paid, and your commission being credited are separate facts. Read all three in Sales.',
        paragraphs: [
            'Open Sales in the creator portal or Your sales in the app. Each order shows its website progress, payment state and your saved commission. In review, Building website and Website ready describe the work on the site; they do not confirm an owner payment.',
            'Awaiting payment or No payment received means payment has not been recorded. Down payment received and Balance due mean the owner has paid only part of the order. Paid in full means the full payment has been recorded. A ready or published site alone does not prove it is fully paid.',
            'Credited means an earning for that order has been recorded in your ledger; Not credited yet means it has not. The displayed commission is the saved amount for that order, not an additional payment each time its status changes. Use Payouts for what is currently available to cash out, because a credited earning may already have been withdrawn or reserved for a request.',
            'For a direct sale, the payment flow can credit the seller’s saved commission when a qualifying down payment is confirmed. Paying the remaining balance does not credit the same seller commission again. This is different from recruited-agent earnings, which wait until the shop pays in full. A sale can therefore show Balance due and Credited together.',
            'If a payment or credit looks wrong, give the team the business name and the statuses shown on that order. Do not infer payment from a checkout return screen or count an uncredited commission as available money.',
        ],
        keywords: ['affiliate', 'creator', 'sales', 'status', 'website ready', 'awaiting payment', 'deposit', 'down payment', 'balance due', 'paid in full', 'commission', 'credited', 'not credited'],
        audiences: ['affiliate'], visibility: 'authenticated', workspace: 'help',
        categorySlug: 'creator-portal-guides', categoryTitle: 'Creator portal',
    },
    // Sources: apps/mobile/components/affiliate/Agents.tsx invite dialog;
    // components/v2/creators/PortalView.tsx sharing tools; convex/lib/creatorRecruits.ts attachRecruit/findActiveCreator.
    {
        slug: 'creator-invite-field-agent-attribution',
        title: 'Invite a field agent and check that they joined your team',
        summary: 'Use the field-agent invitation for recruits, then check Agents. An owner’s shop link and an agent invitation have different jobs.',
        paragraphs: [
            'Open Agents and choose Invite a field agent. Copy or share the invite link, or share the invitation code shown in the popup. The invitation link ends in /earn and is for someone becoming a field agent. Your shop-owner page, shop QR and printable shop poster are for owners ordering a website.',
            'Ask the person to join through your invitation or confirm your code during the field-agent joining flow. A link click by itself is not a joined agent or an earning. Check Agents after their account has been linked to you; that is where their recorded join date and commission period appear.',
            'An invitation links a field-agent account to an active creator account. Another affiliate account is not a field-agent recruit, and you cannot recruit yourself. An agent already linked to a recruiter or an earlier referral cannot be moved to you by entering a different code.',
            'An established agent with a recorded fully paid sale cannot be newly attached as your recruit. The first valid recruitment or referral link is kept. If someone is missing, check which invitation and account they used, then ask the team to check the existing attribution rather than repeatedly applying different codes.',
        ],
        keywords: ['affiliate', 'creator', 'invite', 'invitation', 'field agent', 'team', 'agents', 'recruit', 'link', 'earn', 'code', 'missing agent', 'attribution'],
        audiences: ['affiliate'], visibility: 'authenticated', workspace: 'help',
        categorySlug: 'creator-portal-guides', categoryTitle: 'Creator portal',
    },
    // Sources: packages/shared/pricing.ts creatorOverrideEndsAt/creatorOverrideMonthsLeft/earnsCreatorOverride;
    // convex/lib/affiliateCalendar.ts; convex/creatorPortal.ts summary; convex/creatorOverrides.ts creditForSubmission;
    // apps/mobile/components/affiliate/Agents.tsx AgentProgressTrack; components/v2/creators/PortalView.tsx Months.
    {
        slug: 'creator-agent-months-remaining-and-earlier-referrals',
        title: 'Read an agent’s remaining commission period',
        summary: 'The bar shows time remaining, not sales or earnings used. The recorded join date and exact end date determine eligibility.',
        paragraphs: [
            `An eligible recruit’s commission period starts from their recorded join date and lasts ${CREATOR_OVERRIDE_MONTHS} calendar months. It does not start with their first submission or first paid website. Open their entry in Agents to check the actual period and earnings.`,
            'The coloured portion of the bar shows months remaining; the unfilled portion represents elapsed time. It is not a sales target, a count of websites or money already used. The months-left number is a display estimate. The exact recorded end date determines whether the commission period is still active.',
            'Selecting an earlier month changes the earnings being viewed, using Manila calendar months. It does not move the agent’s join date, restart the period or change your live cash-out balance. An ended period does not erase commission already earned.',
            `The recruited-agent commission program applies to joins from ${recruitProgramStart}, using the Manila date. Earlier referrals keep their original one-time first-paid-website bonus and are shown separately. They are not a second monthly commission track for the same person.`,
            'A qualifying recruited-agent sale must be paid in full within the commission period. Free promo or giveaway sites and your own websites do not count. The program covers field agents directly linked to you, not people recruited by those agents. Check the recorded earnings rather than treating every team sale as an automatic credit.',
        ],
        keywords: ['affiliate', 'creator', 'agents', 'months left', 'remaining', 'progress bar', 'calendar months', 'join date', 'end date', 'eligibility', 'earlier referrals', 'legacy bonus', 'month filter'],
        audiences: ['affiliate'], visibility: 'authenticated', workspace: 'help',
        categorySlug: 'creator-portal-guides', categoryTitle: 'Creator portal',
    },
    // Sources: lib/affiliatePoster.ts createAffiliatePoster/POSTER_PAGE;
    // app/affiliates/dashboard/_components/ShareTools.tsx;
    // apps/mobile/components/affiliate/ShareTools.tsx and PageOverview.tsx.
    {
        slug: 'creator-printable-poster-and-qr-export',
        title: 'Print your creator poster or share its QR code',
        summary: 'The Bold offer poster uses your saved public details and opens your shop-owner page. Web prints an A4 sheet; mobile shares a printable PNG.',
        paragraphs: [
            'Save your page details and finish setting your creator code before making printed materials. The Bold offer poster uses your saved display name, optional photo, creator code and shop-page link. Its price and discount come from the fixed creator-code offer; changing a legacy price field does not create a different poster offer.',
            'In the app, open Share QR & poster. Use Share QR PNG for the QR alone or Share printable poster PNG for the full A4 artwork. Save or send the image from the device’s share options, then print that image.',
            'On the web, use the sharing tools on My page. Download QR PNG saves the QR image. Print A4 poster opens the browser’s print menu after preparing the poster’s fonts and images. Select A4 at 100% scale, or choose the print menu’s PDF option.',
            'The QR opens the same shop-owner page as your creator link; it is not the field-agent invitation. Scan a sample before distributing a batch and check that it opens your page with the intended name and code. A printed image does not change when you later save a new photo or page detail, so export a new poster if its printed content needs updating.',
            'If the image export or share options fail, try again after the saved page has loaded. Preview accounts and unavailable or inactive pages cannot perform the live sharing actions. Keep your published link available as an alternative while resolving an export problem.',
        ],
        keywords: ['affiliate', 'creator', 'poster', 'print', 'printable', 'A4', 'Bold offer', 'QR', 'PNG', 'PDF', 'saved photo', 'creator code', 'share'],
        audiences: ['affiliate'], visibility: 'authenticated', workspace: 'help',
        categorySlug: 'creator-portal-guides', categoryTitle: 'Creator portal',
    },
    // Sources: apps/mobile/components/affiliate/Money.tsx review/receipt flow;
    // apps/mobile/components/affiliate/AffiliateActivity.tsx;
    // app/affiliates/dashboard/_components/PortalViews.tsx; convex/withdrawals.ts create/setWiseTransferIds/markFailed/updateByWiseTransferId.
    {
        slug: 'creator-request-and-track-wise-cash-out',
        title: 'Request a cash out and track its Wise status',
        summary: 'Review the amount and Wise email before requesting. A received request reserves money; it does not mean the transfer has finished.',
        paragraphs: [
            'Open Payouts, check the available balance and choose the cash-out action. Use the email linked to your Wise account, enter a positive amount no higher than the available balance, and review the amount and destination before confirming. Expected commission from unpaid shops is separate from the available balance.',
            'After confirmation, Request received or Pending means the request has been recorded. Its amount is reserved and removed from the available balance, so the same money cannot be requested again. Processing means the transfer is being handled; it does not mean the recipient has received the money.',
            'Completed records the transfer as sent. Check your Wise email and payout history for its details. Failed means the request could not be completed and its amount is returned to the Tendso balance. History keeps the failed request and can show its reason or reference.',
            'If the app loses connection while confirming, check payout history before trying again: the request may already exist even if its confirmation did not reach your screen. Give the team the request reference and status if a transfer needs checking; do not submit another request just to refresh its status.',
            'Change the saved Wise email in Payout details for future cash outs. A request uses the destination recorded when you confirmed it; saving a different email does not rewrite an existing transfer. Cash outs and payout changes require an active creator account and an online authenticated session.',
        ],
        keywords: ['affiliate', 'creator', 'payouts', 'cash out', 'withdrawal', 'Wise', 'email', 'review', 'pending', 'processing', 'completed', 'failed', 'funds returned', 'reserved', 'reference'],
        audiences: ['affiliate'], visibility: 'authenticated', workspace: 'help',
        categorySlug: 'creator-portal-guides', categoryTitle: 'Creator portal',
    },
    // Sources: apps/mobile/components/affiliate/Me.tsx; apps/mobile/app/(app)/notifications.tsx;
    // app/affiliates/dashboard/_components/PortalViews.tsx AccountView;
    // components/v2/creators/PortalPage.tsx; convex/lib/creatorRecruits.ts creatorCard; convex/knowledgeAccount.ts.
    {
        slug: 'creator-account-details-notifications-and-privacy',
        title: 'Manage creator account details and read notifications',
        summary: 'Your account profile, public creator page and Wise destination serve different purposes. Notifications belong to the signed-in account.',
        paragraphs: [
            'Use Edit profile for the account details Tendso uses to identify and contact you. Use My page for the public name, photo, personal message and social links shop owners see. Use Payout details for the Wise email used by future cash outs. These controls have different purposes, so check the relevant screen when updating a detail.',
            'Your public creator card shows the saved public page information and creator-code offer; it does not expose your account contact details, cash-out balance or Wise destination. Anything you deliberately place in the public personal message or social links can be read by visitors, so keep private account information out of those fields.',
            'On mobile, open Me, then Notifications, and tap a message to read its full details. Opening a message marks that message read. Simply opening and leaving the inbox does not mark every message read; Mark all as read is a separate action. If a read update fails, reconnect and try again.',
            'A pending creator account is waiting for team review. A suspended account can still view its recorded sales and earnings, while page changes, live sharing and payouts are paused. Check the account notice and ask the team about the next step rather than assuming an empty or disabled action means the recorded earnings have disappeared.',
            'Ask Tendso can use the currently signed-in account for supported personal balance or status questions. Typing another person’s email into chat does not switch the account being checked. Sign out when using a shared device, and sign in to the account whose records you want to view.',
        ],
        keywords: ['affiliate', 'creator', 'account', 'profile', 'public page', 'privacy', 'notifications', 'unread', 'mark read', 'pending approval', 'suspended', 'Wise email', 'sign out', 'Ask Tendso'],
        audiences: ['affiliate'], visibility: 'authenticated', workspace: 'help',
        categorySlug: 'creator-portal-guides', categoryTitle: 'Creator portal',
    },
];
