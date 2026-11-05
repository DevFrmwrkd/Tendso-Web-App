import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { requireAdmin } from './lib/auth';
import { BASE_PRICE, PRICE_CEILING, WEBSITE_PRICE, CREATOR_CODE_PRICE, CREATOR_CODE_DISCOUNT, CUSTOM_DOMAIN_ADDON, COMMISSION_RATE, CREATOR_OVERRIDE_RATE, CREATOR_OVERRIDE_MONTHS, REFERRAL_BONUS, formatPHP } from '../packages/shared/pricing';
import type { KnowledgeAudience, KnowledgeVisibility } from '../packages/shared/knowledge';

/** Reviewed role guides, not AI-generated training. Run explicitly on the intended deployment. */
export const roleGuideContent = () => ({
    'how-much-does-a-website-cost': {
        title: 'How much does a Tendso website cost?',
        paragraphs: [
            `The standard website price is ${formatPHP(WEBSITE_PRICE)}, paid once. A creator code gives ${CREATOR_CODE_DISCOUNT * 100}% off: ${formatPHP(CREATOR_CODE_PRICE)}. A field agent can quote a captured website between ${formatPHP(BASE_PRICE)} and ${formatPHP(PRICE_CEILING)}. The saved quote on your order is what you pay.`,
            `Your website includes a Tendso web address. A custom domain costs extra, starting from ${formatPHP(CUSTOM_DOMAIN_ADDON)} for first-year registration and setup; the confirmed quote takes precedence. Domain renewal is separate from the one-time website price.`,
            'Review your private preview and ask for changes before approving and paying. Open your business to see its exact quote and verified payment status.',
        ],
    },
    'custom-domain': {
        title: 'Use your own custom domain',
        paragraphs: [
            'A Tendso web address is included. You can request a custom address such as yourshop.com, or ask the team to connect a domain you already own.',
            `Custom domains start from ${formatPHP(CUSTOM_DOMAIN_ADDON)} for first-year registration and setup. Availability and registrar cost vary, so use the amount confirmed on your order. This is an add-on to your website price, and later domain renewals are separate.`,
            'The team checks the requested name. If it is unavailable, they contact you to agree on another address before registering it. A request is not a guaranteed reservation.',
        ],
    },
    'can-i-edit-my-site': {
        title: 'How do I request a website change?',
        paragraphs: [
            'Open the business in Tendso and choose Ask for a change. Describe the text, hours, contact details or photos that need updating, then send the request to the team.',
            'The team updates the website for you. Owners cannot edit the completed website directly. You can continue an unfinished setup draft on mobile or web before submission.',
            'Review the business status for progress, or contact support if you need help. A response time or price for extra work must be confirmed by the team.',
        ],
    },
    'your-price-band': {
        title: `Field-agent pricing: ${formatPHP(BASE_PRICE)} to ${formatPHP(PRICE_CEILING)}`,
        paragraphs: [
            `Every field agent can quote a captured website from ${formatPHP(BASE_PRICE)} to ${formatPHP(PRICE_CEILING)} from their first submission. There is no five-submission unlock.`,
            `You earn ${COMMISSION_RATE * 100}% of the website selling price. Custom-domain charges are excluded. Review the shop's saved quote before sending it.`,
            `This price choice is for captured field-agent submissions. Affiliate creator codes have a separate fixed ${CREATOR_CODE_DISCOUNT * 100}% offer (${formatPHP(CREATOR_CODE_PRICE)}); affiliates cannot adjust it.`,
        ],
    },
    'how-wise-payouts-work': {
        title: 'Cash out your field-agent earnings',
        paragraphs: [
            'Open Earn to see your available balance, earnings ledger and cash-out history. Save the correct Wise email, choose Cash out, check the amount and recipient, and confirm the request.',
            `Your commission is ${COMMISSION_RATE * 100}% of the website price, excluding custom-domain charges. The available balance is the amount already credited and ready to request; submission approval alone does not prove payment or guarantee a cash out.`,
            'A cash out can be pending, processing, completed or failed. Track the actual status in Earn. Transfers are not sent automatically just because a submission was approved; do not promise an unverified arrival time.',
        ],
    },
    'referral-bonus': {
        title: `Invite a field agent: the ${formatPHP(REFERRAL_BONUS)} bonus`,
        paragraphs: [
            'Share Invite field agents from your field-agent account. Your friend joins using your referral link or code and completes training and approval.',
            `You receive a one-time ${formatPHP(REFERRAL_BONUS)} bonus when your friend's first site is fully paid. Joining, passing the quiz, submitting a shop or receiving a down payment alone does not earn the bonus.`,
            'This is the field-agent friend referral rule. Affiliate creators recruiting agents use their separate commission terms. Check the account ledger for an actual credited bonus.',
        ],
    },
    'is-this-a-job': {
        title: 'How field-agent earnings work',
        paragraphs: [
            'Field agents choose businesses to approach, capture their details, photos and interview, and send the submission for team review. It is a flexible role paid by results, rather than a fixed salary or an automatic fee per interview.',
            `The commission is ${COMMISSION_RATE * 100}% of the website price, excluding domain charges. The available price band is ${formatPHP(BASE_PRICE)} to ${formatPHP(PRICE_CEILING)} from the first submission; there is no price unlock.`,
            'A visit, a set of photos or a submitted interview alone does not guarantee earnings. Open Earn for the money actually credited and the cash-out status.',
        ],
    },
    'if-owner-doesnt-pay': {
        title: "What if a business owner doesn't pay?",
        paragraphs: [
            'An interview or a submitted shop alone does not guarantee an earning. Website commission depends on the order and its verified payment; visits that do not convert are not separately reimbursed.',
            'Explain the saved quote and private preview clearly. The owner uses their secure payment link and reference. Never mark an order paid from a screenshot, checkout return screen or matching amount alone.',
            'Use the actual submission and earnings statuses in Tendso. Transfers without a matching reference require team verification. Check Earn for credited funds rather than assuming money is available.',
        ],
    },
    'handling-scam-objection': {
        title: 'When an owner is unsure about Tendso',
        paragraphs: [
            'Show a real website example and explain the process: capture the business, review the website preview, approve the result, then pay through the secure order link.',
            `Show the saved quote. The standard price is ${formatPHP(WEBSITE_PRICE)}; a creator code offers ${CREATOR_CODE_DISCOUNT * 100}% off, and a captured field-agent order can have its own quote. Do not promise a different price, discount or publication date.`,
            'Give the owner time to decide and a way to contact Tendso. You do not need their bank password, payment login or card details.',
        ],
    },
    'your-first-week': {
        title: 'Your first steps as a field agent',
        paragraphs: [
            'Complete the lessons and certification quiz. A quiz pass is saved while the team reviews your profile. If the profile needs a correction, fix it and resend without repeating a passed quiz.',
            'After approval, use Map and Finds to choose a suitable business. Confirm a time with the owner, then follow the capture, photos, interview, design and review steps in the app.',
            'Send the submission for review. If it needs changes, open the rejected submission and edit and resend it; keep the existing photos and answers that are still correct. Open Earn to track credited money and request a cash out.',
        ],
    },
});

const additions: { slug: string; title: string; audience: KnowledgeAudience; visibility: KnowledgeVisibility; paragraphs: string[]; keywords: string[] }[] = [
    { slug: 'owner-business-dashboard', title: 'Manage your businesses and continue a draft', audience: 'owner', visibility: 'authenticated', keywords: ['owner', 'today', 'draft', 'resume', 'notifications', 'visit'], paragraphs: [
        'Today shows the next steps for your businesses and requested visits. Open Businesses to switch shops; each has its own setup draft, review, payment and website status.',
        'Use Continue setup to resume the saved details, photos, interview answers and design on mobile or web. Save and let uploads finish before switching devices. A draft is not submitted for review until you send it.',
        'Use Visits to request a field-agent visit with a map pin and contact details. The team assigns an agent, the agent accepts, and the request status updates in Tendso. Open the bell for notifications; opening the list does not mark everything read.',
        'After the website is built, use Ask for a change. Owners cannot edit the finished website directly.',
    ] },
    { slug: 'creator-code-setup', title: 'Choose your creator code once', audience: 'affiliate', visibility: 'authenticated', keywords: ['affiliate', 'creator', 'code', 'availability', 'setup', 'discount'], paragraphs: [
        'Open your creator portal or My page to set up your code. Enter a readable code such as MIKA30, check availability, and review the confirmation before setting it.',
        'The code must be unique. Once you confirm it, you cannot change it afterward, so check spelling and how it will look on links and printed posters.',
        `Every creator code gives the same ${CREATOR_CODE_DISCOUNT * 100}% discount on the ${formatPHP(WEBSITE_PRICE)} website: ${formatPHP(CREATOR_CODE_PRICE)}. You choose the code, not the offer price. Existing orders keep their saved quote.`,
    ] },
    { slug: 'creator-page-and-sharing', title: 'Edit and share your creator page', audience: 'affiliate', visibility: 'authenticated', keywords: ['affiliate', 'creator', 'page', 'preview', 'social', 'posters', 'share'], paragraphs: [
        'Open My page, then Edit your page. Add your profile photo, display name, personal message and optional social links. Messenger, Facebook, Instagram, TikTok and YouTube links can appear on your public page.',
        'The actual page preview shows what shop owners see. Save your changes to update the public page; unsaved edits are not part of the shared page.',
        'Use the shop-owner link or QR code for owners. Use Invite a field agent for people joining your team. These links serve different purposes. Printable posters use your saved page details and QR code.',
    ] },
    { slug: 'creator-sales-and-agent-earnings', title: 'Creator sales and recruited-agent earnings', audience: 'affiliate', visibility: 'authenticated', keywords: ['affiliate', 'creator', 'earnings', 'sales', 'agents', 'months', 'override', 'wise'], paragraphs: [
        `Direct creator-code sales earn ${COMMISSION_RATE * 100}% of the website price, excluding custom-domain charges. Open Sales for the individual order and payment statuses; an unpaid sale is not an available cash-out balance.`,
        `Eligible field agents recruited through your creator link or code earn you ${CREATOR_OVERRIDE_RATE * 100}% of their website sales for ${CREATOR_OVERRIDE_MONTHS} calendar months from the agent's join date. It is credited only after the shop pays in full. Domain charges and recruits of recruits are excluded. Older referrals may keep their original terms.`,
        'Agents shows each recruit and the remaining eligibility window. Mobile and web use the same join date and end date. Open Payouts for your current available balance, cash-out history and actual transfer status.',
    ] },
    { slug: 'field-agent-review-and-resend', title: 'Finish training and resend a submission', audience: 'field_agent', visibility: 'authenticated', keywords: ['field agent', 'training', 'rejected', 'resend', 'photos', 'submission'], paragraphs: [
        'Complete the lessons and pass the certification quiz, then send your profile for review. A passed quiz is saved if the team asks you to correct your name, mobile number or photo.',
        'When a shop submission is rejected, open its review note and choose Edit and resend. Update only the details, photos, interview or selected design that need fixing. You do not need to begin a new submission.',
        'If you change business type, review the suggested shots and design again. Keep suitable real photos and retake or replace ones that do not match. Labels in Your photos help identify each image; the full-screen viewer supports swiping, Retake and Replace.',
    ] },
    { slug: 'admin-knowledge-review', title: 'Review knowledge audiences and access', audience: 'admin', visibility: 'internal', keywords: ['admin', 'knowledge', 'audience', 'access', 'training', 'review', 'publish'], paragraphs: [
        'Open Train AI and the Knowledge library to review articles, FAQs and categories. Audience controls which account type the advice is for; Access controls who may read it. Public content can be shared with anyone.',
        'Signed-in access requires a matching account audience. Internal content is for permitted certified field agents and admins; admin-only guidance uses the Admin audience. A category also restricts its child articles.',
        'AI-generated drafts and captured team answers require human review before publishing. Read the complete answer, verify the facts, choose its audience and access, then explicitly publish. Editing access metadata preserves handwritten article blocks.',
        'Pricing and commission answers use the current shared pricing configuration. Personal balances and account statuses use authorized live records. Never publish personal account information into a general article.',
    ] },
];

export const curate = mutation({
    args: { apply: v.boolean() },
    handler: async (ctx, { apply }) => {
        await requireAdmin(ctx);
        const categories = await ctx.db.query('knowledgeCategories').collect();
        const articles = await ctx.db.query('knowledgeArticles').collect();
        const faqs = await ctx.db.query('knowledgeFaqs').collect();
        // One-time reviewed migration. Re-running must never overwrite later
        // editorial decisions or turn a newly private article into public help.
        if (articles.some(row => row.slug === 'admin-knowledge-review')) return { applied: false, alreadyApplied: true };
        const content = roleGuideContent();
        const report = { categoriesTagged: categories.length, articlesTagged: articles.length, capturedRepliesForReview: articles.filter(a => a.source === 'qa').length, faqsTagged: faqs.length, reviewedGuides: Object.keys(content).length, roleGuides: additions.length, applied: apply };
        if (!apply) return report;
        for (const row of categories) await ctx.db.patch(row._id, { audiences: row.audiences ?? (row.workspace === 'wiki' ? ['field_agent', 'admin'] : ['everyone']), visibility: row.visibility ?? (row.workspace === 'wiki' ? 'internal' : 'public') });
        for (const row of articles) {
            const guide = content[row.slug as keyof typeof content];
            const qa = row.source === 'qa';
            await ctx.db.patch(row._id, {
                audiences: qa ? ['admin'] : row.audiences ?? (row.workspace === 'wiki' ? ['field_agent', 'admin'] : ['everyone']),
                visibility: qa ? 'internal' : row.visibility ?? (row.workspace === 'wiki' ? 'internal' : 'public'),
                ...(qa ? { status: 'draft' as const } : {}),
                ...(guide ? { title: guide.title, summary: guide.paragraphs[0], body: guide.paragraphs.map(text => ({ t: 'p' as const, text })), embedding: undefined, embeddingUpdatedAt: undefined } : {}),
                updatedAt: Date.now(),
            });
        }
        for (const row of faqs) {
            const linked = row.linkArticleSlug ? content[row.linkArticleSlug as keyof typeof content] : undefined;
            await ctx.db.patch(row._id, {
                audiences: row.audiences ?? (row.workspace === 'wiki' ? ['field_agent', 'admin'] : ['everyone']),
                visibility: row.visibility ?? (row.workspace === 'wiki' ? 'internal' : 'public'),
                ...(linked ? { answer: row.question === 'How much do I earn per website?' ? linked.paragraphs[1] : linked.paragraphs[0] } : {}),
                ...(row.question === 'How do I raise my price ceiling?' ? { question: 'What price can a field agent quote?' } : {}),
            });
        }
        let category = categories.find(row => row.slug === 'account-guides');
        if (!category) {
            const id = await ctx.db.insert('knowledgeCategories', { slug: 'account-guides', title: 'Using your account', description: 'Steps for your Tendso account.', icon: 'help', hue: 'blue', workspace: 'help', audiences: ['everyone'], visibility: 'public' });
            category = (await ctx.db.get(id))!;
        }
        for (const guide of additions) {
            const existing = articles.find(row => row.slug === guide.slug);
            const fields = { title: guide.title, summary: guide.paragraphs[0], categoryId: category._id, workspace: 'help' as const,
                body: guide.paragraphs.map(text => ({ t: 'p' as const, text })), keywords: guide.keywords, author: 'Tendso team', readMin: 2,
                status: 'published' as const, audiences: [guide.audience], visibility: guide.visibility, updatedAt: Date.now(), embedding: undefined, embeddingUpdatedAt: undefined };
            if (existing) await ctx.db.patch(existing._id, { ...fields, audiences: existing.audiences ?? fields.audiences, visibility: existing.visibility ?? fields.visibility });
            else await ctx.db.insert('knowledgeArticles', { ...fields, slug: guide.slug, createdAt: Date.now() });
        }
        return report;
    },
});
