import type { KnowledgeGuide } from './types';

const publicHelp = { audiences: ['everyone'] as KnowledgeGuide['audiences'], visibility: 'public' as const, workspace: 'help' as const };
const adminHelp = { audiences: ['admin'] as KnowledgeGuide['audiences'], visibility: 'internal' as const, workspace: 'help' as const, categorySlug: 'admin-operations', categoryTitle: 'Team operations' };

export const commonGuides: KnowledgeGuide[] = [
    // Sources: apps/mobile/app/index.tsx; lib/accounts.ts; lib/signInDestination.ts;
    // apps/mobile/services/accountAccess.ts; convex/affiliates.ts; convex/owners.ts.
    { ...publicHelp, slug: 'one-app-and-account-types', title: 'Which Tendso account should I use?',
        summary: 'Tendso is one app with different account roles: business owner, creator/affiliate, field agent and authorized team accounts.',
        categorySlug: 'getting-started', categoryTitle: 'Getting Started', keywords: ['one app', 'account type', 'owner', 'creator', 'affiliate', 'field agent', 'admin', 'welcome'],
        paragraphs: [
            'Use the business-owner flow to set up and manage websites for your own businesses. One owner account can contain several businesses, each with separate setup, payment and website progress.',
            'Creators, also called affiliates, share a creator page and code with shop owners and invite field agents through their separate team link. Field agents visit businesses and capture the details, photos and interview needed for a website. These are different earning roles inside the same Tendso app.',
            'Use the email and sign-in method connected to your existing account. Tendso opens the workspace permitted for that account; changing a URL or selecting a different welcome button does not change an existing account role. Contact the team if you appear to have the wrong role.',
            'New earning accounts can have training or approval steps before their full workspace is available. Admin and staff access is assigned by the team, not created by choosing a public signup option.',
        ] },
    // Sources: app/login/LoginForm.tsx; app/auth/continue; lib/signInDestination.ts;
    // apps/mobile/app/(auth)/{owner,login,forgot-password}.tsx.
    { ...publicHelp, slug: 'sign-in-to-the-right-tendso-account', title: 'How do I sign in on mobile or web?',
        summary: 'On the website, use Sign in in the main header. In the app, use the sign-in flow for your existing account and its original email.',
        categorySlug: 'getting-started', categoryTitle: 'Getting Started', keywords: ['sign in', 'log in', 'passwordless', 'email code', 'different sign in method', 'Google', 'Apple', 'account'],
        paragraphs: [
            'The website has one Sign in entry for owners, creators, field agents and team accounts. After your identity is verified, Tendso opens the correct workspace or the training and approval step still needed by your account.',
            'The owner sign-in flow in the mobile app sends a code to your email. An owner account using email codes does not need an invented password. If that account requires another supported method, use the more-sign-in-options action shown by the app.',
            'For other mobile earning accounts, use the password or Apple/Google sign-in method connected to that account. A message about a different sign-in method means you should use the matching method; it does not mean you need to register a second account.',
            'To continue on another device, use the same account. If the wrong workspace opens, sign out and check the email and sign-in method. Never share your password or email verification code with an agent or in Ask Tendso.',
        ] },
    // Sources: convex/knowledgeAI.ts; convex/knowledgeAccount.ts; convex/escalations.ts;
    // components/v2/chat/AskTendso.tsx; apps/mobile/components/knowledge/AskTendsoScreen.tsx.
    { ...publicHelp, slug: 'ask-tendso-help-and-team-review', title: 'What happens when Ask Tendso cannot answer?',
        summary: 'Ask Tendso says when it cannot verify an answer. Unanswered Tendso questions are recorded for team review; captured staff replies need admin approval before becoming published knowledge.',
        categorySlug: 'trust-support', categoryTitle: 'Trust & Support', keywords: ['Ask Tendso', 'chatbot', 'cannot answer', 'unanswered', 'support', 'Discord', 'staff', 'admin review', 'help'],
        paragraphs: [
            'Ask Tendso uses shared help articles selected for your account type and access. Supported questions about your balance, approval or linked businesses use your signed-in account records. It cannot look up someone else’s private account from a name or email typed into chat.',
            'If it cannot verify a help answer, it says so and records the question for review. Relevant Tendso questions can be forwarded to the team’s Discord support queue when that support handoff is enabled. A connection failure or question limit can instead ask you to try again.',
            'A staff reply in Discord is saved as a Needs review draft. An admin checks the facts, chooses the audience and access, and publishes it before Ask Tendso may use it as shared knowledge. A human reply is not immediately inserted into the chat.',
            'A signed-in account can receive a review notification when the team replies. Private account lookups are kept separate from shared article training. Do not put passwords, verification codes or payment credentials in a help question.',
        ] },
    // Sources: convex/ownerApp.ts; apps/mobile/app/(owner)/talk/index.tsx;
    // apps/mobile/app/(app)/submit/interview.tsx; convex/visitRequests.ts.
    { ...publicHelp, slug: 'what-happens-in-the-interview', title: 'What happens in the interview?',
        summary: 'Capture the business’s own details, photos and interview answers, either through the owner setup or with a field agent’s help.',
        categorySlug: 'getting-started', categoryTitle: 'Getting Started', keywords: ['interview', 'questions', 'capture', 'owner', 'field agent', 'photos', 'phone'],
        paragraphs: [
            'The interview gathers what your business does, what makes it useful, and the practical details customers need: location, hours, products or services, prices and contact details. Use the business owner’s own accurate answers.',
            'Owners can follow the guided setup themselves, choose who holds the phone, or request a field-agent visit. A field agent records the interview and takes suitable real photos with the owner’s agreement. The photo suggestions follow the type of business.',
            'Before sending the setup, review the details, uploaded photos, interview and chosen design. Saving a draft or completing the interview does not send it for review automatically.',
            'Once the website preview is ready, review it and ask the team for any changes. The business page shows the next approval, payment or publication step. An interview does not promise a fixed delivery time or instant publication.',
        ] },
    // Sources: convex/lib/ownerApp.ts (computeOwnerPhase); convex/ownerApp.ts
    // (approvePreview/publishIfReady); convex/ownerPayments.ts; convex/buildProgress.ts.
    { ...publicHelp, slug: 'how-fast-can-it-go-live', title: 'When will my website be ready or go live?',
        summary: 'Track your business’s actual build, preview, payment and publication status. A ready preview is different from a publicly live website.',
        categorySlug: 'your-website', categoryTitle: 'Your Website', keywords: ['ready', 'go live', 'how long', 'build', 'preview', 'publish', 'delay', 'status'],
        paragraphs: [
            'Open your business in Tendso to see its current progress. Building, ready to check, changes requested, awaiting payment and live describe different stages. A screen showing a preview does not mean the public website has been published.',
            'Review the preview and send any corrections through Ask for a change. Approving the preview and completing the payment steps allows publication to proceed when the remaining requirements are met.',
            'Build estimates and payment-processing screens are progress information, not a guaranteed deadline. Team review, requested changes, payment verification and publication can each need more time. Do not assume a fixed 48-hour turnaround or that approval publishes the site immediately.',
            'If a stage appears stuck or failed, keep the existing business and contact the team with its name and the status shown. Do not create a duplicate submission to try to restart a paid order.',
        ] },
    // Sources: convex/ownerApp.ts (requestChange/approvePreview); app/my-business;
    // apps/mobile/app/(owner)/{check,change}.tsx; no fixed revision entitlement in these flows.
    { ...publicHelp, slug: 'what-if-i-dont-like-it', title: 'What if I want changes to the website preview?',
        summary: 'Review your preview and use Ask for a change to send the team the corrections you need before approving it.',
        categorySlug: 'your-website', categoryTitle: 'Your Website', keywords: ['preview', 'not happy', 'revision', 'change', 'edit', 'approve', 'photos', 'correction'],
        paragraphs: [
            'Open the correct business and review its website preview. If details, wording, photos or design need attention, choose Ask for a change and describe exactly what should be different.',
            'The team makes the website changes for you. Owners do not edit the finished website directly. Keep your request attached to the existing business so the team sees the correct order and previous work.',
            'Review the updated preview before approving it. Check the business page for payment and publication next steps. A request being sent is not a promise that the change has already been made.',
            'Ask the team to confirm the scope, any extra cost and expected timing for work beyond the agreed order. Do not assume a fixed number of free revisions from older help text.',
        ] },
    // Sources: convex/ownerPayments.ts; convex/payments.ts; convex/lib/ownerApp.ts;
    // app/pay/[token]/page.tsx and PaymentPage; legacy orders retain their saved policy/quote.
    { ...publicHelp, slug: 'how-payment-works', title: 'How does payment for my website work?',
        summary: 'Pay through the checkout connected to your business and use its payment reference. The verified order status determines whether payment has been recorded.',
        categorySlug: 'pricing-payment', categoryTitle: 'Pricing & Payment', keywords: ['payment', 'pay', 'reference', 'Wise', 'checkout', 'preview', 'publish', 'balance', 'expired'],
        paragraphs: [
            'Use the secure payment link for the correct business and check the saved quote. Review and approve the preview when the business asks you to do so. Your business page shows the steps required before publication for that order.',
            'The checkout is tied to an order and payment reference. Include the correct reference when the payment instructions require it. A payer name or matching amount alone is not sufficient to automatically identify an unmatched transfer; the team must verify it.',
            'A payment-provider confirmation or team verification updates the order. Returning to Tendso, closing checkout or showing a payment screenshot does not by itself mark the order paid. Keep the receipt and reference if you need help.',
            'A down payment and a fully paid order have different statuses. If a balance remains, follow the business page to pay the balance. If a checkout expires before payment, use Pay again to open a fresh checkout for that same business. If you already sent money and it is being checked, contact the team rather than paying twice.',
            'Payment and publication are separate stages. The site becomes live after the order’s required payment, approval and publication steps are complete; existing orders retain their saved quote and publishing requirements.',
        ] },
    // Sources: convex/visitRequests.ts; app/admin/visits/_components/VisitRequestsQueue.tsx;
    // apps/mobile/app/(app)/admin/visits.tsx; lib/visitRequests.ts.
    { ...adminHelp, slug: 'admin-assign-and-follow-up-owner-visits', title: 'Assign and follow up an owner’s shop visit',
        summary: 'Use Visit requests to review the owner’s pin and contact details, assign an eligible field agent and proposed time, and follow the agent’s response.',
        keywords: ['admin', 'visit requests', 'assign', 'field agent', 'map pin', 'confirmed', 'declined', 'schedule'],
        paragraphs: [
            'Open Visit requests and select the owner’s request. Review the shop, address, map pin, contact details and preferred visit information before assigning it. The request has not been accepted simply because it exists in the queue.',
            'Choose an active certified field agent and a future visit time. Check for a conflicting appointment and add any useful note. Assignment notifies the owner and the selected agent, but the time is still proposed until the agent confirms.',
            'The assigned agent can accept or decline. Acceptance changes the visit to confirmed. Declining returns it to the requested queue with the reason so another assignment can be arranged. Do not tell the owner a visit is confirmed while it still says assigned.',
            'Use the current request to follow completion, cancellation or reassignment. The owner and assigned agent receive the relevant status updates. Completing a visit does not automatically submit photos, approve a website or record a payment.',
            'If the request changed while you were editing, refresh its details before trying again. This prevents an old assignment or cancellation from overwriting a newer decision.',
        ] },
    // Sources: convex/escalations.ts; convex/knowledgeTraining.ts; convex/knowledge.ts;
    // app/admin/knowledge/_components/{TrainedSection,LibrarySection,AudienceAccessFields}.tsx.
    { ...adminHelp, slug: 'admin-review-discord-answers', title: 'Approve a staff answer captured from Discord',
        summary: 'A Discord staff reply becomes a Needs review draft. An admin must verify its facts and access before publishing it into the shared KB.',
        keywords: ['admin', 'Discord', 'staff answer', 'Needs review', 'publish', 'unanswered', 'approval', 'knowledge'],
        paragraphs: [
            'Unanswered Tendso questions appear in Train AI. When support handoff is enabled, a relevant question can also create a Discord thread. Staff should answer that question in its thread; a reply being captured does not make it published knowledge.',
            'Open the captured draft in Train AI or Knowledge library and read the whole answer. Check it against the implemented flow and current shared pricing rules. Remove personal account details and unsupported promises about earnings, timing, discounts or fees.',
            'Choose the intended audience and access. A public article is readable by anyone; audience tags alone do not make it private. Signed-in and internal content must use the correct audiences, and the category can impose further restrictions.',
            'Confirm the human-review control and publish only when the answer is ready. Leave an uncertain answer as a draft for follow-up. Drafts are excluded from user answers, article links and citations.',
            'The asker may receive a generic review notification while the answer is a draft. A captured answer is not inserted immediately into the original chat. Publishing makes permitted knowledge available for future Ask Tendso questions.',
        ] },
];
