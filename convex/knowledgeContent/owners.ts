import type { KnowledgeGuide } from './types';
import { CREATOR_CODE_DISCOUNT, MIN_DOWN_PAYMENT, formatPHP } from '../../packages/shared/pricing';

const ownerAccess = {
    audiences: ['owner'] as KnowledgeGuide['audiences'],
    visibility: 'authenticated' as const,
    workspace: 'help' as const,
    categorySlug: 'owner-account-guides',
    categoryTitle: 'Your owner account',
};

export const ownerGuides: KnowledgeGuide[] = [
    // Sources: convex/owners.ts (ensure/invite linking); ownerApp.ts (createDraft/getSubmission);
    // apps/mobile/components/v2/owner/{OwnerBusinessSwitcher,OwnerSaveExit}.tsx;
    // apps/mobile/lib/v2/ownerIntake.ts; app/my-business/drafts/_components/OwnerDraft.tsx.
    {
        ...ownerAccess,
        slug: 'owner-switch-businesses-and-resume-drafts',
        title: 'Switch businesses and continue a saved setup',
        summary: 'Each business keeps its own setup, photos, answers, design and payment status. Resume it with the same owner account on mobile or web.',
        keywords: ['owner', 'multiple businesses', 'switch shop', 'save and exit', 'draft', 'resume', 'mobile', 'web', 'sync', 'uploads'],
        paragraphs: [
            'Use the same owner account on mobile and web. If a field agent submitted your business, sign in with the owner email recorded for that submission. A business linked to another email will not appear just because you know its name.',
            'On mobile, open the business selector on Today or My site and choose the business you want. Choose Add business to begin a separate setup. On web, open your businesses and select the matching business or its Continue setup action. Each business has separate draft progress, review, payment and website status.',
            'During mobile setup, choose Save & exit to keep your progress and return to Today. On web, use Save and exit or Save and continue. Your setup remains a draft until you choose Send for review. The account can have up to three open owner-made drafts; this is not a limit of three businesses in total.',
            'Wait for changes and uploads to finish syncing before continuing on another device. Photos and recordings still waiting to upload remain on the phone or browser where you added them. Reopen that device and retry the pending upload if the file has not appeared elsewhere.',
            'If Tendso says the draft changed on another device, compare the pending changes with the latest saved version. On web, Use latest saved version discards the pending changes on that browser; Apply my pending changes applies the listed changes to the latest draft. Do not assume an unfinished upload has replaced a file saved on another device.',
            'After a business has been submitted, its setup is no longer an editable draft. Open that business to follow its progress and use Ask for a change for website updates.',
        ],
    },

    // Sources: apps/mobile/app/(owner)/start/how.tsx; talk/{index,record}.tsx;
    // apps/mobile/lib/v2/{ownerIntake,ownerNavigation}.ts; convex/ownerApp.ts (submit/saveAnswer);
    // app/my-business/drafts/_components/OwnerDraft.tsx (details/interview/review).
    {
        ...ownerAccess,
        slug: 'owner-who-holds-phone-and-interview',
        title: 'Choose who holds the phone and continue the interview',
        summary: 'Choose By myself or With a friend, then save the choice before beginning your interview. Returning to a setup does not require starting a new business.',
        keywords: ['owner', 'who holds the phone', 'by myself', 'with a friend', 'back', 'interview', 'questions', 'English', 'Tagalog', 'recording'],
        paragraphs: [
            'At Who holds the phone? on mobile, choose By myself if you will film yourself, or With a friend if someone will film you. By myself uses the front camera; With a friend uses the back camera. Choose Next to confirm this business’s recording setup.',
            'If you return before confirming a choice, select an option and choose Next. The Back arrow returns to the business details so you can check them. Save & exit returns to Today while retaining the setup. You do not need to create another business to leave this step.',
            'If you would rather have help in person, choose Send someone to my shop to request a field-agent visit. Sending the request does not confirm an appointment; the team must assign an agent and the agent must accept the proposed time.',
            'The interview has ten required questions, available in English or Tagalog, plus an optional Anything else? answer. Mobile supports video or voice recording. On web, you can answer with text and add or review recordings; saved phone recordings stay attached when you edit the text.',
            'Before Send for review, complete the ten regular answers, add at least three shop photos, check the business details and choose a compatible design. The design picker shows sample content; the submitted website uses your own business information and photos. Finish syncing before sending.',
        ],
    },

    // Sources: apps/mobile/app/(owner)/agents/{book,[visitId]}.tsx;
    // app/my-business/visits/_components/{OwnerVisitRequestForm,visitPresentation}.ts(x);
    // convex/visitRequests.ts (createMine/assign/accept/complete/cancel owner events).
    {
        ...ownerAccess,
        slug: 'owner-request-and-track-shop-visit',
        title: 'Request a shop visit and understand its status',
        summary: 'Send the shop details and an exact map pin, then track team assignment and the field agent’s acceptance. A preferred day is not a confirmed booking.',
        keywords: ['owner', 'shop visit', 'request', 'map pin', 'address', 'field agent', 'assignment', 'acceptance', 'booking', 'cancel'],
        paragraphs: [
            'Open the shop-visit area and choose Request a shop visit. Enter the shop name, street or landmark, city or municipality and a valid Philippine mobile number. Place the map pin at the shop’s actual location in the Philippines. Check the pin and contact details before choosing Send request.',
            'A new general request starts without a shop name. If you started the request from a particular owned business, its name can be filled in for you. Check that you are requesting the correct shop; the address and map pin still need your attention.',
            'Choose Today, Tomorrow or This week as your preference. Request received means the team is arranging a field agent and proposed time. Awaiting acceptance means an agent has been assigned but has not yet accepted; the visit is not confirmed at this point.',
            'Visit confirmed means the assigned field agent accepted. Open the request to check the confirmed time, agent details, address and map. A call action is available when the agent has a contact number. Your address and contact details are shared with the Tendso team and the assigned field agent.',
            'An active request can be cancelled from its details. A cancelled request should not be used for travel. Visit completed means the agent marked the visit complete; it does not by itself submit a website, record a payment or publish a site. Track those separately in your business workspace.',
        ],
    },

    // Sources: apps/mobile/app/(owner)/{check,change}.tsx; app/my-business/_components/OwnerPrivateWebsite.tsx;
    // convex/ownerApp.ts (approvePreview/requestChange/publishIfReady); convex/lib/ownerApp.ts;
    // docs/v2-api-owners.md (saved publication policy).
    {
        ...ownerAccess,
        slug: 'owner-review-preview-and-request-changes',
        title: 'Check the private preview and ask the team for a change',
        summary: 'Check the words, photos and contact details, then choose Looks good or Ask for a change. Owners do not edit the finished website directly.',
        keywords: ['owner', 'private preview', 'ready to check', 'looks good', 'approve', 'ask for a change', 'website changes', 'publishing'],
        paragraphs: [
            'Open the correct business when it shows Ready to check, then open its preview. Check the business name, wording, hours, contact details, location and photos. This is the website prepared for your business, rather than the example shown in the design picker.',
            'If something needs updating, choose Ask for a change on mobile or send a change request in the web business workspace. Describe exactly what should change. The Tendso team makes the website update for you; owners cannot directly edit the completed website.',
            'A change request on a pay-before-publication order clears the previous approval. Wait for the requested changes to be resolved, check the latest preview, and choose Looks good again. An open change request prevents the website from being approved for publication.',
            'Choose Looks good when you are ready to approve the current version. Tendso opens payment if money is still owed, or continues towards publication when the order is already fully paid and ready. Approval is not a payment receipt, and payment is not proof that publication has finished.',
            'New ordinary paid orders remain private until the website is ready, the current version is approved, full payment is confirmed and there are no open change requests. A down payment alone does not publish them. Custom-domain publication can need team setup. Use the business’s actual status and public link to confirm when it is live.',
            'Some older, free or sponsored orders have different saved publication rules. An existing live website is not automatically taken down by the newer payment flow. After publication, use Ask for a change for further updates instead of trying to reopen the original setup draft.',
        ],
    },

    // Sources: convex/ownerPayments.ts (getPaymentState/resolveCharge/applyTokenPayment);
    // convex/payments.ts (processDeposit exact-reference verification);
    // apps/mobile/app/(owner)/pay/{index,part,method}.tsx; OwnerPaymentReturn.tsx; app/pay/[token]/_components/PayViews.tsx.
    {
        ...ownerAccess,
        slug: 'owner-payment-reference-and-down-payment',
        title: 'Pay the correct order and check a down payment or balance',
        summary: 'Use the payment request for your business, copy its reference and check confirmed money in Tendso. A down payment leaves a separate balance.',
        keywords: ['owner', 'payment', 'reference code', 'bank transfer', 'Wise', 'GCash', 'Maya', 'down payment', 'partial payment', 'balance', 'paid'],
        paragraphs: [
            'Open the correct business and review its saved quote and payment options. For a pay-before-publication order, approve the current preview first. Choose only a payment method offered for that order: bank transfer is shown through Wise, and GCash, Maya or card appears when hosted checkout is enabled.',
            'For a bank transfer, use the amount and exact reference displayed on that payment request. Copy the reference into the transfer note. The reference identifies the website order; the received amount and currency are also checked. Your bank account name or a matching amount alone is not enough to identify an order automatically.',
            'If the transfer has no matching reference, the team must verify the bank transaction and the correct website order. Contact Tendso with the payment reference and transfer details rather than assuming the order is paid. A screenshot or returning from checkout does not itself confirm receipt.',
            `If Pay part now is offered, enter a whole-peso down payment of at least ${formatPHP(MIN_DOWN_PAYMENT)} and less than the order total. Paying the entire total counts as full payment. After a confirmed down payment, open the same business and choose Pay the rest to pay the remaining balance.`,
            'Check the amount paid, remaining balance and actual payment status in the business workspace. Down payment received means there is still money owed. Full payment does not necessarily mean the website is already public: current approval, a ready website and resolution of change requests are also required for a pay-before-publication order.',
            'If Tendso is still checking a payment, let that status update or ask the team to verify it before sending another transfer. The saved order and confirmed receipts determine what remains due.',
        ],
    },

    // Sources: apps/mobile/components/v2/owner/OwnerPaymentReturn.tsx; apps/mobile/app/(owner)/pay/method.tsx;
    // app/pay/[token]/_components/PayViews.tsx; components/payments/ExpiredPaymentAction.tsx;
    // convex/ownerPayments.ts (retry/paymentAttempt/currentRequest).
    {
        ...ownerAccess,
        slug: 'owner-expired-payment-link-pay-again',
        title: 'Use Pay again when a payment link expires',
        summary: 'An expired checkout does not erase your business or confirmed payments. Pay again checks the latest order before opening the available payment options.',
        keywords: ['owner', 'expired payment', 'expired checkout', 'pay again', 'retry', 'payment processing', 'old reference', 'new checkout'],
        paragraphs: [
            'Payment link expired means that checkout can no longer be used normally. Your business, saved quote and confirmed payments remain recorded. On mobile, choose Pay again from the payment-return screen. On the web payment page, use its Pay again action.',
            'Sign in with the owner account linked to the business if asked. Tendso checks the latest balance before continuing. A confirmed down payment stays credited; retrying does not charge the original full amount again just because the old link showed it.',
            'Check your site first means the current preview still needs approval. Return to the preview and approve it when it is correct. If the order is already paid, follow the business’s updated status instead of making another payment.',
            'Checking your payment can mean an earlier checkout may still be open. Wait for its status to update before trying again. A cancelled link can instead direct you back to the business’s current payment options.',
            'If you already sent a transfer, ask the team to check it before sending money again, even if the link now says expired. Keep the reference you actually used. When a fresh payment request is offered, use the current amount and reference shown there rather than copying the old instructions.',
        ],
    },

    // Sources: apps/mobile/app/(owner)/me/{inbox,settings}.tsx; apps/mobile/services/ownerPushSettings.ts;
    // app/my-business/notifications/_components/OwnerNotifications.tsx; convex/{ownerInbox,escalations}.ts;
    // convex/lib/ownerInbox.ts (owned-event links and reviewed knowledge-answer notices).
    {
        ...ownerAccess,
        slug: 'owner-notifications-inbox-and-device-settings',
        title: 'Read owner notifications and manage alerts on your phone',
        summary: 'The bell opens your inbox; opening a message marks that message read. Manage mobile push permission separately under Me → Settings.',
        keywords: ['owner', 'notifications', 'bell', 'inbox', 'unread', 'open business', 'visit request', 'settings', 'push notifications', 'permission'],
        paragraphs: [
            'Open the bell for visit, payment and website updates. On mobile, Me → Inbox opens the same inbox. Opening the list does not mark everything read. Open an individual notification to read its full details, or explicitly choose Mark all read when you want to clear the whole list.',
            'Open business takes you to the business connected to that notification. View visit request opens the matching request. These actions use the notification’s own business or visit, so check its name if you manage several shops. A general update can have no business action.',
            'On the installed mobile app, open Me → Settings → Push notifications to manage updates on this device. Turning push off does not remove inbox messages. Each device has its own permission and registration, so allowing alerts on one phone does not enable them on every device.',
            'Blocked in phone settings means permission must be changed in the phone’s settings. Use Open phone settings, update Tendso’s notification permission and return to check it again. Delivered quietly means updates can reach Notification Center without banners or sounds. Reconnect and retry if Tendso cannot confirm the setting.',
            'Your web notification inbox remains available independently of the mobile push setting. Push alerts require the installed app on a physical device; this setting does not promise browser push delivery.',
            'For an Ask Tendso question sent to the team, Your question is being reviewed is a general update while the captured reply is checked. Read answer appears only when the answer is published and available to your account. A private review draft is not an article you can open yet.',
        ],
    },

    // Sources: apps/mobile/components/v2/owner/OwnerCreatorCode.tsx; apps/mobile/app/(owner)/pay/index.tsx;
    // convex/ownerApp.ts (creatorCode/applyCreatorCode); convex/lib/ownerCreatorCode.ts;
    // docs/v2-api-owners.md (Native owner creator codes).
    {
        ...ownerAccess,
        slug: 'owner-apply-creator-code-to-order',
        title: 'Apply a creator code to an eligible owner order',
        summary: 'Add a creator code only while the order allows a quote change. Check the saved total before starting payment.',
        keywords: ['owner', 'creator code', 'discount code', 'apply code', 'change code', 'remove code', 'price', 'locked quote', 'payment'],
        paragraphs: [
            'In the mobile app, open an eligible self-serve owner order’s payment page and find Have a creator code? Choose Add code, enter the creator’s code and choose Apply code. If a code is already shown and the order is editable, Change code and Remove code are available.',
            `Creator codes give a fixed ${CREATOR_CODE_DISCOUNT * 100}% discount on the standard website price. Creators choose their unique code, not a custom discount rate. The domain add-on is separate. Check the total actually saved on your order rather than calculating a price from a creator’s current page.`,
            'The code must belong to an active creator, and you cannot use your own creator code. A code can be applied while an owner-made draft is editable, or on an approved, unpaid preview with no active build or open change requests.',
            'Agent-made orders, free or promotional orders and orders with a received payment cannot use this quote-changing action. An issued payment request can also lock the code, even after expiry, because a transfer may still arrive against it. Read the reason shown with the code and ask the team if you need help.',
            'Wait until the code finishes saving and the payment page shows the updated total before opening checkout. Applying or removing a code does not erase a payment receipt, change another business’s existing quote or confirm that a payment has been received.',
        ],
    },
];
