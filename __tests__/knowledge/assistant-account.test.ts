import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { internal } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { accountQuestion, accountQuestionInContext, assistantPolicyFacts, isFinancialQuestion, policyAnswer } from '../../convex/lib/knowledgeAssistant';
import {
    BASE_PRICE, PRICE_CEILING, WEBSITE_PRICE, CREATOR_CODE_PRICE, CREATOR_CODE_DISCOUNT,
    COMMISSION_RATE, CREATOR_OVERRIDE_RATE, CREATOR_OVERRIDE_MONTHS, REFERRAL_BONUS,
    CUSTOM_DOMAIN_ADDON, commissionFor, formatPHP,
} from '../../packages/shared/pricing';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './knowledgeAccount.ts': () => import('../../convex/knowledgeAccount'),
    './ownerApp.ts': () => import('../../convex/ownerApp'),
};

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const agent = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active' });
        const affiliate = await ctx.db.insert('creators', { clerkId: 'affiliate', email: 'affiliate@example.test', role: 'affiliate', status: 'active' });
        const other = await ctx.db.insert('creators', { clerkId: 'other', email: 'other@example.test', role: 'creator', balance: 8888, totalEarnings: 99999 });
        const owner = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', createdAt: 1 });
        const otherOwner = await ctx.db.insert('businessOwners', { clerkId: 'other-owner', email: 'other-owner@example.test', createdAt: 1 });
        return { agent, affiliate, other, owner, otherOwner };
    });
    const self = (subject = 'agent') => t.withIdentity({ subject });
    return { t, ...ids, self };
}

describe('deterministic knowledge assistant policy', () => {
    it.each([
        ['What is my balance?', 'balance'], ['How much can I cash out?', 'balance'],
        ['Show my withdrawals', 'balance'], ['How much have I earned?', 'balance'], ['How much did I earn last month?', 'balance'],
        ['How much is in my account?', 'balance'], ['Did I get paid?', 'balance'], ['What is in my wallet?', 'balance'],
        ['Why was my payout rejected?', 'balance'], ['Is my cash out approved?', 'balance'],
        ['Why was my payment rejected?', 'sites'], ['What is my website balance due?', 'sites'],
        ['Is my account approved?', 'approval'], ['Have I passed the quiz?', 'approval'], ['What are my quiz results?', 'approval'],
        ['Did I pass training?', 'approval'],
        ['Is my website live?', 'sites'], ['What is my business payment status?', 'sites'], ['Are our submissions ready?', 'sites'],
    ])('routes personal question %s to a caller-bound snapshot', (question, kind) => {
        expect(accountQuestion(question)).toBe(kind);
    });

    it.each(['How do I pass the quiz?', 'How much can I earn per site?', 'How do creator codes work?', 'How do I invite a field agent?'])(
        'keeps general guidance separate from account records: %s', question => expect(accountQuestion(question)).toBeNull(),
    );

    it('resolves personal follow-ups from user intent only and stops at a new topic', () => {
        const history = [
            { role: 'user' as const, text: 'What is my balance?' },
            { role: 'assistant' as const, text: 'Old account data: ₱999,999.' },
            { role: 'user' as const, text: 'Why?' },
            { role: 'assistant' as const, text: 'An earlier unverified explanation.' },
        ];
        expect(accountQuestionInContext('Why is it still pending?', history)).toBe('balance');
        expect(accountQuestionInContext('How much now?', history)).toBe('balance');
        expect(accountQuestionInContext('Is this photo good?', history)).toBeNull();
        expect(accountQuestionInContext('Why is it pending?', [...history,
            { role: 'user', text: 'How do I take a shop photo?' }, { role: 'assistant', text: 'Your balance is 9999.' },
        ])).toBeNull();
        expect(accountQuestionInContext('Why is it pending?', [{ role: 'assistant', text: 'Your payout is pending.' }])).toBeNull();
    });

    it('recognizes financial claims without treating ordinary photo instructions as money', () => {
        for (const query of ['Expedited setup fees', 'How does a refund work?', 'Old price PHP999', 'You keep 50%', 'What do I keep after a sale?']) expect(isFinancialQuestion(query)).toBe(true);
        for (const query of ['Keep your phone level', 'Take a clear photo', 'Record a short interview']) expect(isFinancialQuestion(query)).toBe(false);
    });

    it('uses checkout and ledger constants for shared policy instead of a second price table', () => {
        const facts = assistantPolicyFacts('everyone');
        expect(facts).toContain(formatPHP(WEBSITE_PRICE));
        expect(facts).toContain(`${CREATOR_CODE_DISCOUNT * 100}%`);
        expect(facts).toContain(formatPHP(CREATOR_CODE_PRICE));
        expect(facts).toContain(formatPHP(CUSTOM_DOMAIN_ADDON));
        expect(facts).toContain('owners do not edit');
        expect(facts).toContain('transfers without a matching reference require team verification');
        expect(facts).not.toContain('referral bonus');
        expect(facts).not.toContain('calendar months');
        const answer = policyAnswer('How much is a website?', 'owner');
        expect(answer).toContain(formatPHP(WEBSITE_PRICE));
        expect(answer).toContain(formatPHP(CREATOR_CODE_PRICE));
        expect(answer).toContain('saved quote');
    });

    it('distinguishes agent quotes and friend bonuses from affiliate direct and recruited sales', () => {
        const agent = assistantPolicyFacts('field_agent');
        expect(agent).toContain(formatPHP(BASE_PRICE));
        expect(agent).toContain(formatPHP(PRICE_CEILING));
        expect(agent).toContain(`${COMMISSION_RATE * 100}%`);
        expect(agent).toContain(formatPHP(REFERRAL_BONUS));
        expect(agent).not.toContain('calendar months');
        const affiliate = assistantPolicyFacts('affiliate');
        expect(affiliate).toContain(formatPHP(commissionFor(CREATOR_CODE_PRICE)));
        expect(affiliate).toContain(`${CREATOR_OVERRIDE_RATE * 100}%`);
        expect(affiliate).toContain(`${CREATOR_OVERRIDE_MONTHS} calendar months`);
        expect(affiliate).toContain('one level');
        expect(affiliate).toContain('only after the shop pays in full');
        expect(affiliate).toContain('cannot change it afterward');
        expect(affiliate).not.toContain('may quote captured websites');
        const admin = assistantPolicyFacts('admin');
        expect(admin).toContain('calendar months');
        expect(admin).toContain('may quote captured websites');
    });

    it('answers the native earnings suggestion with commission rather than the website price', () => {
        const agent = policyAnswer('How much do I keep per site?', 'field_agent');
        expect(agent).toContain(`You keep ${COMMISSION_RATE * 100}%`);
        expect(agent).toContain(formatPHP(BASE_PRICE));
        expect(agent).toContain('excluding custom-domain charges');
        const affiliate = policyAnswer('How much do I earn per site?', 'affiliate');
        expect(affiliate).toContain(formatPHP(commissionFor(CREATOR_CODE_PRICE)));
        expect(policyAnswer('How much do I keep per site?', 'owner')).toBeNull();
        expect(policyAnswer('How much do I keep per site?', 'everyone')).toBeNull();
        expect(policyAnswer('What do I keep after a sale?', 'field_agent')).toContain(`You keep ${COMMISSION_RATE * 100}%`);
        expect(policyAnswer('What percentage do I get per sale?', 'affiliate')).toContain(formatPHP(commissionFor(CREATOR_CODE_PRICE)));
        expect(policyAnswer('What is the starting fee?', 'owner')).toContain(formatPHP(WEBSITE_PRICE));
        expect(policyAnswer('How much is a custom domain?', 'owner')).toContain(formatPHP(CUSTOM_DOMAIN_ADDON));
    });

    it('keeps invitation rewards role-specific and contingent on full owner payment', () => {
        const agent = policyAnswer('How much do I earn when I invite a friend?', 'field_agent');
        expect(agent).toContain(formatPHP(REFERRAL_BONUS));
        expect(agent).toContain('first website is fully paid');
        expect(agent).toContain('Joining, passing training, or submitting a shop alone does not earn');
        const affiliate = policyAnswer('How much commission do my agents earn for me?', 'affiliate');
        expect(affiliate).toContain(`${CREATOR_OVERRIDE_RATE * 100}%`);
        expect(affiliate).toContain(`${CREATOR_OVERRIDE_MONTHS} calendar months`);
        expect(affiliate).toContain('direct recruits only');
        expect(affiliate).not.toContain(formatPHP(REFERRAL_BONUS));
    });
});

describe('knowledge assistant authorized account snapshots', () => {
    it('discloses no account records to anonymous or unrecognized signed-in roles', async () => {
        const { t } = await setup();
        await t.run(ctx => ctx.db.insert('creators', { clerkId: 'staff', role: 'staff', email: 'staff@example.test', balance: 4444 }));
        for (const kind of ['balance', 'approval', 'sites'] as const) {
            expect(await t.query(internal.knowledgeAccount.answer, { kind })).toContain('Sign in');
            const staff = await t.withIdentity({ subject: 'staff' }).query(internal.knowledgeAccount.answer, { kind });
            expect(staff).toContain('cannot look up another person');
            expect(staff).not.toContain(formatPHP(4444));
        }
        await expect(t.query(internal.knowledgeAccount.answer, { kind: 'balance', clerkId: 'other' } as unknown as { kind: 'balance' })).rejects.toThrow();
    });

    it.each(['creator', 'affiliate', 'admin'] as const)('does not disclose private data for suspended/deleted %s accounts, even with an owner row', async role => {
        for (const state of [{ status: 'suspended' }, { status: 'deleted' }, { isDeleted: true }]) {
            const { t } = await setup();
            await t.run(async ctx => {
                await ctx.db.insert('creators', { clerkId: 'blocked', email: 'blocked@example.test', role, ...state,
                    balance: 5555, totalEarnings: 6666, rejectionReason: 'Private review note' });
                await ctx.db.insert('businessOwners', { clerkId: 'blocked', email: 'blocked@example.test', createdAt: 1 });
            });
            for (const kind of ['balance', 'approval', 'sites'] as const) {
                const answer = await t.withIdentity({ subject: 'blocked' }).query(internal.knowledgeAccount.answer, { kind });
                expect(answer).toContain('unavailable for private account lookups');
                expect(answer).not.toContain(formatPHP(5555));
                expect(answer).not.toContain('Private review note');
            }
        }
    });

    it('distinguishes a recorded zero from missing balance and earnings values', async () => {
        const { t, agent, self } = await setup();
        const missing = await self().query(internal.knowledgeAccount.answer, { kind: 'balance' });
        expect(missing).toContain('cash-out balance is not recorded');
        expect(missing).toContain('Total recorded earnings: not recorded');
        expect(missing).not.toContain(`${formatPHP(0)} is available`);
        await t.run(ctx => ctx.db.patch(agent, { balance: 0, totalEarnings: 0 }));
        const zero = await self().query(internal.knowledgeAccount.answer, { kind: 'balance' });
        expect(zero).toContain(`${formatPHP(0)} is available to cash out`);
        expect(zero).toContain(`Total recorded earnings: ${formatPHP(0)}`);
        expect(zero).toContain('no cash outs yet');
        expect(zero).not.toContain('not recorded');
    });

    it('reports only the current actor’s balance, earnings and cash outs', async () => {
        const { t, agent, other, self } = await setup();
        await t.run(async ctx => {
            await ctx.db.patch(agent, { balance: 1200, totalEarnings: 3500 });
            await ctx.db.insert('withdrawals', { creatorId: agent, amount: 2300, status: 'processing', payoutMethod: 'wise_email', accountDetails: 'owner@example.test', createdAt: 1 });
            await ctx.db.insert('withdrawals', { creatorId: other, amount: 8765, status: 'completed', payoutMethod: 'wise_email', accountDetails: 'private@example.test', createdAt: 1 });
        });
        const answer = await self().query(internal.knowledgeAccount.answer, { kind: 'balance' });
        expect(answer).toContain(`${formatPHP(1200)} is available`);
        expect(answer).toContain(`Total recorded earnings: ${formatPHP(3500)}`);
        expect(answer).toContain(`${formatPHP(2300)}: processing`);
        for (const privateValue of [formatPHP(8888), formatPHP(99999), formatPHP(8765), 'private@example.test']) expect(answer).not.toContain(privateValue);
    });

    it('uses recorded certification, rejection and saved quiz state without restarting training', async () => {
        const { t, agent, self } = await setup();
        expect(await self().query(internal.knowledgeAccount.answer, { kind: 'approval' })).toContain('does not yet have a recorded quiz pass');
        await t.run(ctx => ctx.db.patch(agent, { quizPassedAt: 1 }));
        expect(await self().query(internal.knowledgeAccount.answer, { kind: 'approval' })).toContain('waiting for team approval');
        await t.run(ctx => ctx.db.patch(agent, { rejectedAt: 2, rejectionReason: 'Correct your name' }));
        const rejected = await self().query(internal.knowledgeAccount.answer, { kind: 'approval' });
        expect(rejected).toContain('Correct your name');
        expect(rejected).toContain('saved quiz pass is kept');
        await t.run(ctx => ctx.db.patch(agent, { rejectedAt: undefined, rejectionReason: undefined, certifiedAt: 3 }));
        expect(await self().query(internal.knowledgeAccount.answer, { kind: 'approval' })).toContain('approved and certified');
        expect(await self('affiliate').query(internal.knowledgeAccount.answer, { kind: 'approval' })).toContain('creator account status is active');
        expect(await self('affiliate').query(internal.knowledgeAccount.answer, { kind: 'sites' })).toContain('cannot infer individual sales statuses');
    });

    it('keeps admin chat out of arbitrary user account lookups', async () => {
        const { t } = await setup();
        await t.run(ctx => ctx.db.insert('creators', { clerkId: 'admin', role: 'admin', email: 'admin@example.test', balance: 9876 }));
        const answer = await t.withIdentity({ subject: 'admin' }).query(internal.knowledgeAccount.answer, { kind: 'balance' });
        expect(answer).toContain('authorized admin pages');
        expect(answer).not.toContain(formatPHP(9876));
        expect(answer).not.toContain(formatPHP(8888));
    });

    it('lists only linked owner businesses, including real website/change/payment state', async () => {
        const { t, owner, otherOwner, agent, self } = await setup();
        await t.run(async ctx => {
            const create = (businessName: string, fields: Partial<Doc<'submissions'>> = {}) => ctx.db.insert('submissions', {
                creatorId: agent, businessName, businessType: 'Other', ownerName: 'Owner', ownerPhone: '09170000000',
                ownerEmail: 'owner@example.test', address: 'Main St', city: 'Marikina', status: 'website_generated',
                amount: 4999, contentSource: 'owner_app', publishPolicy: 'pay_then_publish', previewReadyAt: 1, ...fields,
            });
            const link = (submissionId: Doc<'submissions'>['_id']) => ctx.db.insert('websiteOwnerships', { businessOwnerId: owner, submissionId, role: 'owner', claimedAt: 1 });
            const preview = await create('My preview'); await link(preview);
            const payment = await create('My payment', { ownerApprovedAt: 1, amountPaid: 1000, depositPaidAt: 1 }); await link(payment);
            const live = await create('My live shop', { paidInFullAt: 1, ownerApprovedAt: 1 }); await link(live);
            await ctx.db.insert('generatedWebsites', { submissionId: live, status: 'published', publishedUrl: 'https://example.test' });
            const changes = await create('My requested changes'); await link(changes);
            await ctx.db.insert('changeRequests', { submissionId: changes, text: 'Change the hours', status: 'open', requestedBy: `owner:${owner}`, createdAt: 1 });
            // Matching email alone is not an ownership link.
            await create('Unlinked matching email');
            const foreign = await create('Another owner private shop');
            await ctx.db.insert('websiteOwnerships', { businessOwnerId: otherOwner, submissionId: foreign, role: 'owner', claimedAt: 1 });
        });
        const answer = await self('owner').query(internal.knowledgeAccount.answer, { kind: 'sites' });
        expect(answer).toContain('My preview: ready to check');
        expect(answer).toContain(`My payment: awaiting payment. ${formatPHP(3999)} balance due`);
        expect(answer).toContain('My live shop: live. Paid in full');
        expect(answer).toContain('My requested changes: changes requested');
        expect(answer).not.toContain('Unlinked matching email');
        expect(answer).not.toContain('Another owner private shop');
    });

    it('does not create owner rows or confuse owner accounts with creator wallets', async () => {
        const { t, self } = await setup();
        expect(await self('owner').query(internal.knowledgeAccount.answer, { kind: 'sites' })).toContain('no linked businesses');
        expect(await self('owner').query(internal.knowledgeAccount.answer, { kind: 'balance' })).toContain('no creator cash-out balance');
        expect(await self('owner').query(internal.knowledgeAccount.answer, { kind: 'approval' })).toContain('no creator cash-out balance');
        const before = await t.run(ctx => ctx.db.query('businessOwners').collect());
        expect(await self('unknown').query(internal.knowledgeAccount.answer, { kind: 'sites' })).toContain('cannot look up another person');
        expect(await t.run(ctx => ctx.db.query('businessOwners').collect())).toEqual(before);
    });

    it('does not imply drafts or an unrecorded quote have a zero/free balance due', async () => {
        const { t, agent, owner, self } = await setup();
        await t.run(async ctx => {
            for (const [businessName, status, amount] of [['Unquoted draft', 'draft', undefined], ['Quoted draft', 'draft', 4999], ['Unquoted build', 'website_generated', undefined]] as const) {
                const submissionId = await ctx.db.insert('submissions', { creatorId: agent, businessName, status, amount,
                    businessType: 'Other', ownerName: 'Owner', ownerPhone: '', address: '', city: '', contentSource: 'owner_app' });
                await ctx.db.insert('websiteOwnerships', { businessOwnerId: owner, submissionId, role: 'owner', claimedAt: 1 });
            }
        });
        const answer = await self('owner').query(internal.knowledgeAccount.answer, { kind: 'sites' });
        expect(answer).toContain('Unquoted draft: draft. Continue your draft to confirm the quote and payment details.');
        expect(answer).toContain('Quoted draft: draft. Continue your draft to confirm the quote and payment details.');
        expect(answer).toContain('Unquoted build: building. The payment amount is not recorded yet.');
        expect(answer).not.toContain(`${formatPHP(0)} balance due`);
        expect(answer).not.toContain('Paid in full');
    });
});
