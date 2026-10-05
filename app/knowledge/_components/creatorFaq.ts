import { SUPPORT_EMAIL } from "@/lib/contact";
import { COMMISSION_RATE } from "@/lib/pricing";

/**
 * The questions /help-faq used to answer, for creators. That page is now a
 * redirect to the Help Center (one place to look), and none of this copy is in
 * the knowledge base, so it moved here instead of being dropped. It renders at
 * the bottom of the "Frequently asked" fold (#creator-faq) and the palette
 * searches it.
 *
 * Carried as written, with three answers corrected:
 *  - Earnings and referrals: no peso figure. What the half comes to depends on
 *    the price a creator sells at, so /for-creators stopped quoting per-sale and
 *    referral amounts (commit 7ee12d7) and this follows it. The rate comes from
 *    lib/pricing.
 *  - Payouts: the old answer promised bank transfer or e-wallet, a ₱100 minimum
 *    and 1–3 business days. Payouts go to a Wise account and there is no minimum
 *    (convex/withdrawals.ts), so it says that instead.
 */

export type CreatorFaqItem = { id: string; question: string; answer: string };
export type CreatorFaqGroup = { id: string; title: string; items: CreatorFaqItem[] };

const SHARE = `${Math.round(COMMISSION_RATE * 100)}%`;

export const CREATOR_FAQ: CreatorFaqGroup[] = [
    {
        id: "getting-started",
        title: "Getting started",
        items: [
            {
                id: "what-is-tendso",
                question: "What is Tendso?",
                answer: "Tendso is a platform that helps Filipino creators digitize local businesses. As a creator, you visit small businesses, collect their information through photos and interviews, and submit it through the app. We then generate a professional website for the business.",
            },
            {
                id: "get-certified",
                question: "How do I get certified?",
                answer: "Complete the training lessons and pass the certification quiz with at least 4 out of 5 correct answers. Training covers lighting, audio, portrait photography, interview techniques, and submission requirements.",
            },
        ],
    },
    {
        id: "submissions",
        title: "Submissions",
        items: [
            {
                id: "submit-a-business",
                question: "How do I submit a business?",
                answer: "Follow the 4-step process: 1) Enter business information, 2) Upload at least 3 photos (portrait, location, product), 3) Record a video or audio interview, 4) Review and submit.",
            },
            {
                id: "after-submit",
                question: "What happens after I submit?",
                answer: "Your submission enters review (24–48 hours). If approved, we generate a website for the business. Once the business owner pays, you receive your payout.",
            },
            {
                id: "photo-requirements",
                question: "What are the photo requirements?",
                answer: "You need at least 3 photos: a portrait of the business owner, the business location/exterior, and a product or craft shot. Make sure photos are well-lit and clear.",
            },
            {
                id: "edit-draft",
                question: "Can I edit a draft submission?",
                answer: "Yes, you can continue editing any draft submission from the Submissions page. Drafts are saved automatically.",
            },
        ],
    },
    {
        id: "earnings",
        title: "Earnings and payments",
        items: [
            {
                id: "earn-per-submission",
                question: "How much do I earn per submission?",
                answer: `You keep ${SHARE} of the sale price of every website, once the business owner pays.`,
            },
            {
                id: "referral-bonus",
                question: "How do referral bonuses work?",
                answer: "Share your referral code with other creators. When a referred creator's first submission is approved and paid, you earn a referral bonus.",
            },
            {
                id: "when-paid",
                question: "When do I get paid?",
                answer: "When the business owner pays, your share is added to your Wallet. Withdraw it from the Wallet to your Wise account at any time; there is no minimum.",
            },
        ],
    },
    {
        id: "account",
        title: "Account and support",
        items: [
            {
                id: "reset-password",
                question: "How do I reset my password?",
                answer: "Go to Profile → Change Password, or use the 'Forgot Password' link on the login screen.",
            },
            {
                id: "update-profile",
                question: "How do I update my profile?",
                answer: "Go to Profile → Edit Profile to update your name, phone number, or profile photo.",
            },
            {
                id: "technical-issues",
                question: "I'm having technical issues",
                answer: `Try refreshing the page and clearing your browser cache. If the issue persists, email us at ${SUPPORT_EMAIL}.`,
            },
        ],
    },
];

export const CREATOR_FAQ_ITEMS: CreatorFaqItem[] = CREATOR_FAQ.flatMap((g) => g.items);
