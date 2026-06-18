import { internalMutation } from './_generated/server';
import type { Id } from './_generated/dataModel';

/**
 * Tendso knowledge-base seed content.
 *
 * Run once after deploying the schema:
 *    npx convex run knowledgeSeed:seedKnowledge
 * then generate embeddings:
 *    npx convex run knowledgeAI:backfillEmbeddings
 *
 * Idempotent — re-running upserts by slug / (workspace + question), so it's
 * safe to tweak copy here and re-run. Facts (pricing, flow, payouts) are
 * sourced from lib/pricing.ts and the live product as of 2026-06-15.
 */

// ---- block helpers (mirror the design content model) ----
const h = (text: string) => ({ t: 'h2' as const, text });
const p = (text: string) => ({ t: 'p' as const, text });
const ul = (...items: string[]) => ({ t: 'ul' as const, items });
const ol = (...items: string[]) => ({ t: 'ol' as const, items });
const note = (text: string, kind: 'note' | 'warn' = 'note') => ({ t: 'callout' as const, kind, text });
const quote = (text: string, who: string) => ({ t: 'quote' as const, text, who });

type Workspace = 'help' | 'wiki';

type KbBlock =
    | { t: 'p'; text: string }
    | { t: 'h2'; text: string }
    | { t: 'ul'; items: string[] }
    | { t: 'ol'; items: string[] }
    | { t: 'callout'; kind: 'note' | 'warn'; text: string }
    | { t: 'code'; lang: string; text: string }
    | { t: 'quote'; text: string; who: string }
    | { t: 'image'; caption: string };

type SeedCategory = {
    slug: string;
    title: string;
    description: string;
    icon: string;
    hue: string;
    workspace: Workspace;
    order: number;
};

type SeedArticle = {
    slug: string;
    title: string;
    summary: string;
    categorySlug: string;
    workspace: Workspace;
    author: string;
    readMin: number;
    popular?: boolean;
    keywords: string[];
    body: KbBlock[];
};

type SeedFaq = {
    workspace: Workspace;
    question: string;
    answer: string;
    linkArticleSlug?: string;
    order: number;
};

// ============================================================
// CATEGORIES
// ============================================================
const CATEGORIES: SeedCategory[] = [
    // ---- Help Center (public, business owners) ----
    { slug: 'getting-started', title: 'Getting Started', description: 'How Tendso works, from the first visit to a live website.', icon: 'rocket', hue: 'clay', workspace: 'help', order: 1 },
    { slug: 'pricing-payment', title: 'Pricing & Payment', description: 'What a website costs and how you pay — only after you approve.', icon: 'card', hue: 'sage', workspace: 'help', order: 2 },
    { slug: 'your-website', title: 'Your Website', description: 'Reviewing, approving, and updating your live page.', icon: 'book', hue: 'plum', workspace: 'help', order: 3 },
    { slug: 'domains', title: 'Custom Domains', description: 'Use your own .com instead of a free Tendso address.', icon: 'globe', hue: 'indigo', workspace: 'help', order: 4 },
    { slug: 'trust-support', title: 'Trust & Support', description: 'Your data, your guarantees, and how to reach a human.', icon: 'shield', hue: 'slate', workspace: 'help', order: 5 },

    // ---- Internal Wiki (field agents / creators) ----
    { slug: 'onboarding', title: 'Onboarding', description: 'Certification, your first match, and your first week.', icon: 'rocket', hue: 'clay', workspace: 'wiki', order: 1 },
    { slug: 'interview-capture', title: 'Interview & Capture', description: 'Running the interview, photos, audio, and submitting.', icon: 'book', hue: 'plum', workspace: 'wiki', order: 2 },
    { slug: 'payouts-earnings', title: 'Payouts & Earnings', description: 'How you get paid, your price band, and bonuses.', icon: 'card', hue: 'sage', workspace: 'wiki', order: 3 },
    { slug: 'prospecting', title: 'Prospecting & Leads', description: 'Finding businesses, claiming prospects, and the pool.', icon: 'chart', hue: 'amber', workspace: 'wiki', order: 4 },
    { slug: 'field-troubleshooting', title: 'Troubleshooting', description: 'Fixing uploads, transcripts, and common field issues.', icon: 'wrench', hue: 'slate', workspace: 'wiki', order: 5 },
];

// ============================================================
// ARTICLES — HELP CENTER
// ============================================================
const HELP_ARTICLES: SeedArticle[] = [
    {
        slug: 'what-happens-in-the-interview',
        title: 'What happens in the 30-minute interview?',
        summary: 'A creator visits your shop, asks a few questions, and photographs your work. You keep working — the website forms around what they capture.',
        categorySlug: 'getting-started',
        workspace: 'help',
        author: 'Tendso Team',
        readMin: 3,
        popular: true,
        keywords: ['interview', 'visit', 'how it works', 'getting started', 'creator', 'photos', 'shop'],
        body: [
            p('Tendso websites are built from a single short visit. A certified creator comes to your business with a phone and a checklist. You do not need to prepare anything or stop working — the interview is designed to fit around a normal day.'),
            h('What the creator does'),
            ol(
                'Asks a handful of plain questions about what you do, who you serve, and what makes your place worth visiting.',
                'Records the conversation so nothing is lost — the words become your website copy.',
                'Photographs your space, your products, and you or your team at work.',
            ),
            note('You never have to write anything. The thinking ends at the interview — the creator and our system handle the rest.'),
            h('What happens next'),
            p('Within 48 hours your draft website is ready to review. You look it over, ask for any changes, and only pay once you are happy with it.'),
        ],
    },
    {
        slug: 'how-much-does-a-website-cost',
        title: 'How much does a Tendso website cost?',
        summary: 'A complete website is ₱999, one time. A custom domain is an optional ₱500 add-on. No subscriptions, no hidden fees.',
        categorySlug: 'pricing-payment',
        workspace: 'help',
        author: 'Tendso Team',
        readMin: 3,
        popular: true,
        keywords: ['price', 'cost', 'how much', 'fee', 'pricing', '999', 'payment', 'subscription'],
        body: [
            p('A Tendso website is a one-time payment of ₱999. That includes the interview, the photography, the writing, and a fully built, live website hosted for you.'),
            h("What's included"),
            ul(
                'A creator visit and 30-minute interview.',
                'Professional photos of your business.',
                'A written, designed, mobile-ready website.',
                'A free Tendso web address and hosting.',
            ),
            h('Optional add-ons'),
            p('If you want your own domain name (for example yourshop.com instead of a free Tendso address), that is a flat ₱500 add-on, bringing the total to ₱1,499.'),
            note('There is no monthly subscription. You pay once, and the website is yours.'),
            h('When do I pay?'),
            p('Only after you have seen the finished website and approved it. If you do not approve, you do not pay.'),
        ],
    },
    {
        slug: 'how-payment-works',
        title: 'How payment works — you approve before you pay',
        summary: 'You review the finished website first. Payment is requested only after you approve, through a secure link.',
        categorySlug: 'pricing-payment',
        workspace: 'help',
        author: 'Tendso Team',
        readMin: 3,
        keywords: ['payment', 'pay', 'approve', 'secure', 'link', 'invoice', 'gcash', 'bank'],
        body: [
            p('Tendso never asks for payment up front. The order is always: build first, approve, then pay.'),
            h('The steps'),
            ol(
                'The creator finishes your website and sends you the draft to review.',
                'Once you approve it, you receive a secure payment link with a unique reference code.',
                'You pay the amount shown. When the payment is confirmed, your website goes live on its public address.',
            ),
            note('Keep your reference code with your payment — it is how we match your payment to your website automatically.', 'warn'),
            p('If you have any trouble with a payment link, contact support and we will sort it out before anything goes live.'),
        ],
    },
    {
        slug: 'what-if-i-dont-like-it',
        title: "What if you don't like the result?",
        summary: 'You only pay after you approve. If the first draft is not right, the creator revises it once for free.',
        categorySlug: 'your-website',
        workspace: 'help',
        author: 'Tendso Team',
        readMin: 2,
        popular: true,
        keywords: ['revision', 'changes', 'reject', 'not happy', 'redo', 'edit', 'approve', 'guarantee'],
        body: [
            p('There is no risk in trying Tendso. You see the finished website before any money changes hands.'),
            h('If the draft is not right'),
            ul(
                'Tell the creator what you would like changed.',
                'They revise the website once at no extra cost.',
                'If it still is not for you, you simply do not approve it — and you pay nothing.',
            ),
            quote("You don't pay until you approve. Then it's yours, or it's nothing.", 'The Tendso promise'),
        ],
    },
    {
        slug: 'how-fast-can-it-go-live',
        title: 'How fast can my website go live?',
        summary: 'Most websites are ready to review within 48 hours of the interview, and go live the moment you approve and pay.',
        categorySlug: 'getting-started',
        workspace: 'help',
        author: 'Tendso Team',
        readMin: 2,
        popular: true,
        keywords: ['fast', 'how long', 'time', '48 hours', 'speed', 'live', 'turnaround'],
        body: [
            p('Speed is the point. Because the website is built from one focused visit, there is no long back-and-forth.'),
            h('The timeline'),
            ol(
                'Day 0 — the creator visits and runs the interview.',
                'Within 48 hours — your draft website is ready to review.',
                'On approval — your website goes live as soon as payment is confirmed.',
            ),
            note('Need it sooner for an event or a launch? Mention it during the interview and the creator will flag it.'),
        ],
    },
    {
        slug: 'custom-domain',
        title: 'Use your own custom domain',
        summary: 'For a flat ₱500 add-on, your website can live on your own .com instead of a free Tendso address.',
        categorySlug: 'domains',
        workspace: 'help',
        author: 'Tendso Team',
        readMin: 3,
        keywords: ['domain', 'custom', 'dot com', 'url', 'address', 'dns', '500'],
        body: [
            p('Every Tendso website comes with a free web address. If you would like a more memorable, branded address — like yourshop.com — you can add a custom domain.'),
            h('What it costs'),
            p('A custom domain is a flat ₱500 add-on (covering registration for the first year and setup). That brings your total to ₱1,499 for the website plus domain.'),
            h('How it works'),
            ol(
                'Tell your creator the domain you want during or after the interview.',
                'We check it is available and register it for you.',
                'We connect it to your website and set up secure HTTPS automatically.',
            ),
            note('Already own a domain elsewhere? Let support know — we can point an existing domain to your Tendso site.'),
        ],
    },
    {
        slug: 'can-i-edit-my-site',
        title: 'Can I change my website after it goes live?',
        summary: 'Yes. Send your changes to the creator or support, and updates are made for you.',
        categorySlug: 'your-website',
        workspace: 'help',
        author: 'Tendso Team',
        readMin: 2,
        keywords: ['edit', 'change', 'update', 'after live', 'hours', 'photos', 'menu', 'price'],
        body: [
            p('Your website is meant to stay accurate as your business changes — new hours, new products, a new photo.'),
            h('How to request a change'),
            ul(
                'Message the creator who built your site, or contact Tendso support.',
                'Describe what you want updated — text, photos, hours, or contact details.',
                'The change is made for you and goes live, usually within a day.',
            ),
            note('You will never be locked out of your own information. Tendso maintains the site so you can keep running your business.'),
        ],
    },
    {
        slug: 'is-my-information-safe',
        title: 'Is my information safe?',
        summary: 'Your site is served over secure HTTPS, your data is encrypted, and you control what appears publicly.',
        categorySlug: 'trust-support',
        workspace: 'help',
        author: 'Tendso Team',
        readMin: 3,
        keywords: ['safe', 'security', 'privacy', 'data', 'https', 'secure', 'trust'],
        body: [
            p('We treat your business information with care. Only the details you approve appear on your public website.'),
            h('How we protect it'),
            ul(
                'Every Tendso website is served over encrypted HTTPS.',
                'Your photos and details are stored securely and used only for your site.',
                'Payment links are unique and expire — we never store card numbers.',
            ),
            h('You stay in control'),
            p('Nothing goes public until you approve it. If you ever want your website taken down, contact support and we will unpublish it.'),
        ],
    },
];

// ============================================================
// ARTICLES — INTERNAL WIKI (field agents)
// ============================================================
const WIKI_ARTICLES: SeedArticle[] = [
    {
        slug: 'your-first-week',
        title: 'Your first week as a certified creator',
        summary: 'A day-by-day map: certification, your first match, your first interview, and your first payout.',
        categorySlug: 'onboarding',
        workspace: 'wiki',
        author: 'Creator Success',
        readMin: 5,
        popular: true,
        keywords: ['first week', 'onboarding', 'new', 'start', 'certified', 'match', 'getting started'],
        body: [
            p('Welcome to Tendso. Your job is simple to describe and rewarding to do well: visit a local business, capture it honestly, and let the website form around the work. Here is how your first week usually goes.'),
            h('Day 1 — get certified'),
            ul(
                'Finish the certification quiz in the app. A passing score puts you in the review queue.',
                'An admin approves your account — you will get a notification when you are certified and can take jobs.',
            ),
            h('Days 2–3 — your first match'),
            ol(
                'Browse available prospects and claim one near you.',
                'Message or call to set a time. Keep it casual — you only need 30 minutes of their day.',
                'Run the interview and capture photos using the in-app checklist.',
            ),
            h('Days 4–7 — submit and get paid'),
            p('Submit the interview in the app. Once an admin approves it and the business owner pays, your payout is released to your linked Wise account.'),
            note('Stuck or unsure on anything? Ask in the Discord, or type /ask in any channel to query this wiki directly.'),
        ],
    },
    {
        slug: 'certification-quiz',
        title: 'Passing the certification quiz',
        summary: 'What the quiz covers, what a passing score unlocks, and what happens if you do not pass the first time.',
        categorySlug: 'onboarding',
        workspace: 'wiki',
        author: 'Creator Success',
        readMin: 4,
        keywords: ['quiz', 'certification', 'pass', 'exam', 'training', 'approve', 'certified'],
        body: [
            p('Before you can take jobs, you complete a short certification quiz in the app. It confirms you understand how to run a respectful interview, capture usable photos and audio, and represent Tendso well.'),
            h('What it covers'),
            ul(
                'The interview flow and the questions that matter.',
                'The photo checklist and what a usable shot looks like.',
                'Recording clean audio for the transcript.',
                'How pricing, approval, and payouts work.',
            ),
            h('After you pass'),
            p('Passing sets your account to "awaiting approval". An admin reviews and certifies you — only then can you claim prospects. If you do not pass, you can review the material and retake it.'),
            note('Certification is per creator. Do not run interviews for anyone before you are certified — those submissions cannot be approved.', 'warn'),
        ],
    },
    {
        slug: 'running-the-interview',
        title: 'Running the 30-minute interview',
        summary: 'A repeatable structure: arrive, set the owner at ease, ask the questions that build the page, and capture as you go.',
        categorySlug: 'interview-capture',
        workspace: 'wiki',
        author: 'Field Playbook',
        readMin: 6,
        popular: true,
        keywords: ['interview', 'questions', 'run', 'owner', 'record', 'transcript', 'visit'],
        body: [
            p('A good interview feels like a friendly chat, not a survey. Your goal is to leave with the story of the business in their own words, plus the photos to match.'),
            h('Before you arrive'),
            ul(
                'Confirm the time and that the owner or a decision-maker will be there.',
                'Charge your phone and clear storage for photos and audio.',
                'Skim what you already know about the business so your questions are specific.',
            ),
            h('The questions that build the page'),
            ol(
                'What do you do, in one sentence? (becomes the headline)',
                'Who are your customers, and why do they choose you?',
                'What are you proud of — a signature product, a story, years in business?',
                'Practical details: hours, location, contact, what to order or book.',
            ),
            note('Record the whole conversation in the app. The transcript becomes the website copy, so let them talk — do not paraphrase for them.'),
            h('Capture as you go'),
            p('Photograph while you talk, following the 12-shot list. Natural light and steady hands beat any filter. When you have the words and the shots, you are done.'),
        ],
    },
    {
        slug: 'the-12-shot-list',
        title: 'The 12-shot photo list',
        summary: 'Front, sign, hands at work, hero product, close-ups, wides, and portraits — the app prompts you in order.',
        categorySlug: 'interview-capture',
        workspace: 'wiki',
        author: 'Field Playbook',
        readMin: 5,
        popular: true,
        keywords: ['photos', 'shots', 'photography', '12', 'checklist', 'camera', 'images', 'capture'],
        body: [
            p('Strong photos make or break a page. You do not need a camera — a modern phone and good light are enough. Work through the list the app gives you; it is ordered so you move through the space naturally.'),
            h('The list'),
            ul(
                'Storefront / front of the space.',
                'The sign or logo.',
                'A wide shot that shows the whole room or stall.',
                'Hands at work — the craft in motion.',
                'The hero product or signature item.',
                'Two or three product or detail close-ups.',
                'A portrait of the owner or team.',
            ),
            h('What makes a shot usable'),
            ul(
                'In focus and well lit — shoot near a window or door, not under harsh backlight.',
                'Level and steady — brace your elbows or rest on a surface.',
                'Clean background — move clutter out of frame before you shoot.',
            ),
            note('When in doubt, take more. Extra angles cost nothing and give the site builder room to choose.'),
        ],
    },
    {
        slug: 'recording-good-audio',
        title: 'Recording good audio for the transcript',
        summary: 'The transcript becomes the website copy. Clean audio means accurate words and less editing.',
        categorySlug: 'interview-capture',
        workspace: 'wiki',
        author: 'Field Playbook',
        readMin: 3,
        keywords: ['audio', 'recording', 'transcript', 'sound', 'microphone', 'noise', 'voice'],
        body: [
            p('Your phone records the interview, and the audio is transcribed automatically. The cleaner the audio, the more accurate the words on the finished site.'),
            h('Tips for clean audio'),
            ul(
                'Pick the quietest spot available — step away from a noisy street or a loud fan.',
                'Keep the phone close to whoever is speaking, screen-up on the counter between you.',
                'Avoid talking over the owner — let them finish their thought.',
            ),
            note('If the room is unavoidably loud, say so in your submission notes so review knows the transcript may need a closer look.', 'warn'),
        ],
    },
    {
        slug: 'submitting-in-the-app',
        title: 'Submitting an interview in the app',
        summary: 'How to package the interview — details, photos, audio — and what each status means after you submit.',
        categorySlug: 'interview-capture',
        workspace: 'wiki',
        author: 'Field Playbook',
        readMin: 4,
        keywords: ['submit', 'submission', 'app', 'upload', 'status', 'review', 'approved', 'draft'],
        body: [
            p('Submitting is the last field step. The app walks you through it; this is what to expect.'),
            h('Before you tap submit'),
            ul(
                'Confirm the business name, owner contact, and address are correct.',
                'Check that all photos uploaded and the audio finished processing.',
                'Add any notes review should know (noisy audio, special requests).',
            ),
            h('What the statuses mean'),
            ul(
                'Submitted / In review — an admin is checking your interview.',
                'Approved — your work is accepted; the website build proceeds and your earning is locked in.',
                'Rejected — something needs fixing; read the reason and resubmit.',
            ),
            note('Your payout is tied to an approved submission and the owner completing payment — see "How Wise payouts work".'),
        ],
    },
    {
        slug: 'how-wise-payouts-work',
        title: 'How Wise payouts work',
        summary: 'Link Wise once. You earn 50% of the sell price; funds are released after the submission is approved and the owner pays.',
        categorySlug: 'payouts-earnings',
        workspace: 'wiki',
        author: 'Creator Success',
        readMin: 4,
        popular: true,
        keywords: ['payout', 'wise', 'paid', 'money', 'earnings', 'commission', '50', 'withdraw'],
        body: [
            p('You are paid through Wise. Link your Wise account once in the app and payouts go there automatically — no invoices, no paperwork.'),
            h('What you earn'),
            ul(
                'Your commission is 50% of the website sell price.',
                'At the ₱999 base price, that is ₱500 per approved, paid website.',
                'The custom-domain add-on is a pass-through cost and is not part of your commission.',
            ),
            h('When you get paid'),
            ol(
                'Your submission is approved by an admin.',
                'The business owner completes payment.',
                'Your share is released to your linked Wise account, typically within 48 hours.',
            ),
            note('If a payout looks stuck, check that your Wise email in the app matches your Wise account, then ask in Discord.', 'warn'),
        ],
    },
    {
        slug: 'your-price-band',
        title: 'Your price band: ₱999 to ₱4,999',
        summary: 'Everyone starts at ₱999. After five approved submissions your ceiling unlocks to ₱4,999 — and your commission scales with it.',
        categorySlug: 'payouts-earnings',
        workspace: 'wiki',
        author: 'Creator Success',
        readMin: 4,
        keywords: ['price', 'band', 'ceiling', 'unlock', '4999', 'commission', 'set price', 'tier'],
        body: [
            p('You set your own sell price within a band. As you prove yourself, the top of that band rises.'),
            h('How the band works'),
            ul(
                'Every creator starts with a ceiling of ₱999.',
                'After five approved submissions, your ceiling unlocks to ₱4,999.',
                'You can charge anywhere from ₱999 up to your current ceiling.',
            ),
            h('Why it matters for earnings'),
            p('Because commission is 50% of the sell price, a higher price means a higher payout: ₱999 pays you ₱500, while ₱4,999 pays you ₱2,500 on a single website.'),
            note('Price to the value you deliver and what the business can bear — a fair price that closes beats a high price that does not.'),
        ],
    },
    {
        slug: 'referral-bonus',
        title: 'The ₱1,000 referral bonus',
        summary: 'Share your link. When a creator you referred lands their first paid submission, you earn ₱1,000.',
        categorySlug: 'payouts-earnings',
        workspace: 'wiki',
        author: 'Creator Success',
        readMin: 3,
        keywords: ['referral', 'bonus', 'refer', 'friend', 'invite', '1000', 'link'],
        body: [
            p('Know someone who would make a great creator? Refer them and you both win.'),
            h('How it works'),
            ol(
                'Share your referral link from the app.',
                'They sign up using your link and get certified.',
                'When their first submission is approved and paid, you earn a ₱1,000 bonus.',
            ),
            note('The bonus pays out on the referred creator\'s first paid submission — not just on signup. Encourage your referrals to land that first job.'),
        ],
    },
    {
        slug: 'finding-and-claiming-prospects',
        title: 'Finding and claiming prospects',
        summary: 'Browse the shared prospect pool, claim a business near you, and run it before the claim expires.',
        categorySlug: 'prospecting',
        workspace: 'wiki',
        author: 'Field Playbook',
        readMin: 5,
        popular: true,
        keywords: ['prospect', 'claim', 'leads', 'pool', 'find', 'business', 'nearby', 'reserve'],
        body: [
            p('Tendso maintains a shared pool of local businesses to approach. You claim one to signal you are working it, so two creators do not show up at the same shop.'),
            h('Claiming a prospect'),
            ol(
                'Open the prospects view and filter to your area.',
                'Pick a business that fits — open, active, and a good candidate for a simple website.',
                'Claim it. The claim is yours for a limited window so you have time to make contact.',
            ),
            note('Claims are informational, not exclusive forever. Stale claims are released automatically after about 24 hours so the pool stays fresh.', 'warn'),
            h('Good first prospects'),
            ul(
                'Businesses with no website, or a thin social-only presence.',
                'Owner-operated shops where you can reach the decision-maker.',
                'Places you can actually visit in person to run the interview.',
            ),
        ],
    },
    {
        slug: 'fixing-failed-uploads',
        title: 'Fixing failed photo or audio uploads',
        summary: 'What to try when a photo will not upload or a transcript fails — usually connection, storage, or file size.',
        categorySlug: 'field-troubleshooting',
        workspace: 'wiki',
        author: 'Support',
        readMin: 3,
        keywords: ['upload', 'failed', 'error', 'photo', 'audio', 'transcript', 'stuck', 'troubleshoot', 'connection'],
        body: [
            p('Most upload problems are local — a weak connection or a full phone. Work through these before escalating.'),
            h('First checks'),
            ol(
                'Confirm you have a stable connection — switch between Wi-Fi and mobile data and retry.',
                'Make sure your phone has free storage; a full device can stall uploads.',
                'Reopen the app and let any in-progress uploads finish before you submit.',
            ),
            h('If the transcript fails'),
            p('Audio is transcribed automatically after upload. If it errors, re-upload the recording. If it still fails, submit anyway and note it — review can regenerate the transcript on their side.'),
            note('Still stuck after these steps? Post in Discord with the business name and a screenshot of the error, or type /ask for guidance.'),
        ],
    },

    // ----- From the 2026-06-15 Creator Compensation & Pricing Strategy meeting -----
    {
        slug: 'is-this-a-job',
        title: 'Is this a job? The field-agent role explained',
        summary: 'Being a Tendso field agent is part-time and on your own initiative. You earn per result — 50% of every website a business owner pays for — not a fixed salary.',
        categorySlug: 'onboarding',
        workspace: 'wiki',
        author: 'Creator Success',
        readMin: 4,
        popular: true,
        keywords: ['job', 'employment', 'part time', 'freelance', 'salary', 'role', 'paid', 'commission', 'expense'],
        body: [
            p('A Tendso field agent is a part-time, flexible role. You decide when you work, which neighborhoods you cover, and which businesses you approach. There is no fixed schedule and no experience required.'),
            h('How you earn'),
            ul(
                'You keep 50% of every website a business owner pays for — ₱500 at the ₱999 base price.',
                'As your price ceiling unlocks (see "Your price band"), the same 50% scales up to ₱2,500 per website.',
                'You earn a ₱1,000 referral bonus when someone you refer lands their first paid website.',
            ),
            h('What it is not'),
            ul(
                'It is not a salaried position — there is no hourly or per-visit pay.',
                'Pay is tied to results: a website the owner approves and pays for.',
                'Visits that do not lead to a paid website are not separately reimbursed — see "What if a business owner doesn\'t pay?".',
            ),
            note('Because you choose who and when to pitch, you control your own upside. The more businesses you help get online, the more you earn.'),
        ],
    },
    {
        slug: 'if-owner-doesnt-pay',
        title: "What if a business owner doesn't pay?",
        summary: 'You are paid 50% of every website an owner approves and pays for. Interviews that don\'t convert aren\'t separately compensated — the model is built so paying is easy and low-risk for the owner.',
        categorySlug: 'payouts-earnings',
        workspace: 'wiki',
        author: 'Creator Success',
        readMin: 5,
        popular: true,
        keywords: ['not paid', 'no payment', "doesn't pay", 'compensation', 'unpaid', 'effort', 'transport', 'plan b', 'refund'],
        body: [
            p('This is the most common question field agents ask, so let\'s be clear and honest about it.'),
            h('The short answer'),
            p('You earn when a business owner approves and pays for a website — 50% of the sale. If an owner you interviewed decides not to pay, you do not earn for that visit, and there is no separate payment for the time or transport spent. Running interviews is on your own initiative as a part-time field agent.'),
            h('Why the model still works for you'),
            ul(
                'Approve-before-pay removes the owner\'s risk: they only pay once they see a finished site they like, which makes saying yes easy.',
                'You choose who to approach — focus on active, owner-run businesses that clearly need a site.',
                'There is no cost to you to run an interview, and your upside per sale grows from ₱500 to ₱2,500 as your price band unlocks.',
            ),
            h('How to convert more interviews'),
            ol(
                'Build trust first — explain there\'s no upfront cost and they only pay if they love the result.',
                'Follow up: make sure the owner received the draft and the secure payment link, and answer any questions.',
                'Pick businesses where you can reach the actual decision-maker, not just staff.',
            ),
            note('If an owner seems unsure or suspicious, that\'s normal — read "When an owner thinks it\'s a scam" for how to handle it.', 'warn'),
        ],
    },
    {
        slug: 'handling-scam-objection',
        title: "When an owner thinks it's a scam",
        summary: 'Some owners are wary at first. Lead with approve-before-pay, no upfront cost, and a real example — then give them space to decide.',
        categorySlug: 'prospecting',
        workspace: 'wiki',
        author: 'Field Playbook',
        readMin: 4,
        popular: true,
        keywords: ['scam', 'trust', 'suspicious', 'objection', 'skeptical', 'legit', 'safe', 'convince'],
        body: [
            p('Some business owners are busy or skeptical and worry that a free-looking offer is a scam. That reaction is normal — here is how to earn their trust.'),
            h('Lead with the things that lower risk'),
            ul(
                'They pay nothing up front — Tendso builds the site first and they only pay if they approve it.',
                'There is no subscription; it\'s a one-time ₱999.',
                'Payment is a secure link with a unique reference — you never handle their money or card.',
            ),
            h('Show, don\'t just tell'),
            ol(
                'Show a real Tendso site on your phone so they see exactly what they\'d get.',
                'Explain the simple flow: a 30-minute chat, photos, and a live site within 48 hours.',
                'Leave them the link to review on their own time — busy owners often say yes after they\'ve looked.',
            ),
            quote("You don't pay until you approve. If you don't like it, you owe nothing.", 'The line that resets most doubts'),
            note('Never pressure an owner. A calm, no-risk explanation converts far better than a hard sell — and protects Tendso\'s reputation.'),
        ],
    },
    {
        slug: 'your-pitch',
        title: 'Your pitch: introducing Tendso in 30 seconds',
        summary: 'A short, friendly opener that respects the owner\'s time and leads with the no-risk promise.',
        categorySlug: 'prospecting',
        workspace: 'wiki',
        author: 'Field Playbook',
        readMin: 3,
        keywords: ['pitch', 'intro', 'script', 'opener', 'approach', 'introduce', 'sales'],
        body: [
            p('Keep your opener short and warm. You\'re offering something useful with no risk — say that plainly and let them get curious.'),
            h('A simple opener'),
            quote("Hi! I\'m with Tendso. We build a proper website for local businesses from one quick 30-minute visit — and you only pay if you love the result. Mind if I show you an example?", 'Adapt it to your own voice'),
            h('What to cover, in order'),
            ol(
                'Who you are and what Tendso does, in one sentence.',
                'The no-risk promise: you only pay if you approve the finished site.',
                'The ask: a 30-minute chat and some photos, with the site live in 48 hours.',
            ),
            note('Respect their time. If they\'re mid-rush, leave the example and a way to reach you, and follow up later.'),
        ],
    },
];

// ============================================================
// FAQS
// ============================================================
const FAQS: SeedFaq[] = [
    // Help Center
    { workspace: 'help', question: 'How much does a Tendso website cost?', answer: 'A complete website is a one-time ₱999. A custom domain is an optional ₱500 add-on. No subscriptions.', linkArticleSlug: 'how-much-does-a-website-cost', order: 1 },
    { workspace: 'help', question: 'When do I pay?', answer: 'Only after you have reviewed and approved the finished website. If you do not approve, you do not pay.', linkArticleSlug: 'how-payment-works', order: 2 },
    { workspace: 'help', question: 'How fast can it go live?', answer: 'Your draft is usually ready within 48 hours of the interview, and goes live the moment you approve and pay.', linkArticleSlug: 'how-fast-can-it-go-live', order: 3 },
    { workspace: 'help', question: 'What if I want changes?', answer: 'Tell the creator what to change — the first draft is revised once for free, and you can request updates after launch too.', linkArticleSlug: 'what-if-i-dont-like-it', order: 4 },
    { workspace: 'help', question: 'Can I use my own domain?', answer: 'Yes — a custom domain is a flat ₱500 add-on, and we register and connect it for you.', linkArticleSlug: 'custom-domain', order: 5 },

    // Wiki
    { workspace: 'wiki', question: 'How much do I earn per website?', answer: 'You earn 50% of the sell price — ₱500 at the ₱999 base, up to ₱2,500 at the ₱4,999 ceiling.', linkArticleSlug: 'how-wise-payouts-work', order: 1 },
    { workspace: 'wiki', question: 'When does my payout arrive?', answer: 'After your submission is approved and the owner pays, your Wise payout is typically released within 48 hours.', linkArticleSlug: 'how-wise-payouts-work', order: 2 },
    { workspace: 'wiki', question: 'How do I raise my price ceiling?', answer: 'Your ceiling unlocks from ₱999 to ₱4,999 after five approved submissions.', linkArticleSlug: 'your-price-band', order: 3 },
    { workspace: 'wiki', question: 'How long does a prospect claim last?', answer: 'A claim holds for a limited window and is auto-released after about 24 hours so the shared pool stays fresh.', linkArticleSlug: 'finding-and-claiming-prospects', order: 4 },
    { workspace: 'wiki', question: 'My upload failed — what do I do?', answer: 'Check your connection and free storage, then retry. If a transcript fails, re-upload or submit with a note for review.', linkArticleSlug: 'fixing-failed-uploads', order: 5 },
    { workspace: 'wiki', question: "If an owner doesn't pay, do I still get paid?", answer: "No — you earn 50% of each website an owner approves and pays for. Interviews that don't convert aren't separately reimbursed, and the approve-before-pay flow is designed to make paying easy.", linkArticleSlug: 'if-owner-doesnt-pay', order: 6 },
    { workspace: 'wiki', question: 'Is this a job or freelance?', answer: "It's a flexible, part-time field-agent role. You choose when and who to approach and earn per result (50% commission + referral bonus) — not a fixed salary.", linkArticleSlug: 'is-this-a-job', order: 7 },
];

// ============================================================
// SEED MUTATION (idempotent)
// ============================================================
export const seedKnowledge = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();

        // 1) Categories — upsert by slug, build a slug → id map.
        const catIdBySlug = new Map<string, Id<'knowledgeCategories'>>();
        for (const c of CATEGORIES) {
            const existing = await ctx.db
                .query('knowledgeCategories')
                .withIndex('by_slug', (q) => q.eq('slug', c.slug))
                .first();
            if (existing) {
                await ctx.db.patch(existing._id, c);
                catIdBySlug.set(c.slug, existing._id);
            } else {
                const id = await ctx.db.insert('knowledgeCategories', c);
                catIdBySlug.set(c.slug, id);
            }
        }

        // 2) Articles — upsert by slug.
        let articleCount = 0;
        for (const a of [...HELP_ARTICLES, ...WIKI_ARTICLES]) {
            const categoryId = catIdBySlug.get(a.categorySlug);
            if (!categoryId) throw new Error(`Seed error: missing category ${a.categorySlug}`);
            const fields = {
                slug: a.slug,
                title: a.title,
                summary: a.summary,
                categoryId,
                workspace: a.workspace,
                body: a.body,
                keywords: a.keywords,
                author: a.author,
                readMin: a.readMin,
                // Explicit boolean: patch ignores undefined, so this is what
                // lets a re-seed turn a previously-popular article off again.
                popular: a.popular ?? false,
                status: 'published' as const,
                updatedAt: now,
            };
            const existing = await ctx.db
                .query('knowledgeArticles')
                .withIndex('by_slug', (q) => q.eq('slug', a.slug))
                .first();
            if (existing) {
                await ctx.db.patch(existing._id, fields);
            } else {
                await ctx.db.insert('knowledgeArticles', { ...fields, createdAt: now });
            }
            articleCount++;
        }

        // 3) FAQs — upsert by (workspace + question).
        let faqCount = 0;
        for (const f of FAQS) {
            const existing = await ctx.db
                .query('knowledgeFaqs')
                .withIndex('by_workspace', (q) => q.eq('workspace', f.workspace))
                .collect();
            const match = existing.find((x) => x.question === f.question);
            if (match) {
                await ctx.db.patch(match._id, f);
            } else {
                await ctx.db.insert('knowledgeFaqs', f);
            }
            faqCount++;
        }

        return {
            categories: CATEGORIES.length,
            articles: articleCount,
            faqs: faqCount,
            note: 'Run knowledgeAI:backfillEmbeddings next to enable semantic search.',
        };
    },
});
