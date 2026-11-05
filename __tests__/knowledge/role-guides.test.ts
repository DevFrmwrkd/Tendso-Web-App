import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { BASE_PRICE, CREATOR_CODE_PRICE, CUSTOM_DOMAIN_ADDON, PRICE_CEILING, WEBSITE_PRICE, formatPHP } from '../../packages/shared/pricing';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './knowledge.ts': () => import('../../convex/knowledge'),
    './knowledgeRoleGuides.ts': () => import('../../convex/knowledgeRoleGuides'),
};
const NOW = Date.UTC(2026, 10, 5);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async ctx => {
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.test', role: 'admin' });
        await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', certifiedAt: 1 });
        await ctx.db.insert('creators', { clerkId: 'affiliate', email: 'affiliate@example.test', role: 'affiliate' });
        await ctx.db.insert('creators', { clerkId: 'suspended-admin', email: 'suspended@example.test', role: 'admin', status: 'suspended' });
        await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', createdAt: 1 });
        const help = await ctx.db.insert('knowledgeCategories', { slug: 'help', title: 'Help', description: '', icon: 'help', hue: 'blue', workspace: 'help' });
        const wiki = await ctx.db.insert('knowledgeCategories', { slug: 'wiki', title: 'Wiki', description: '', icon: 'help', hue: 'blue', workspace: 'wiki' });
        const privateCategory = await ctx.db.insert('knowledgeCategories', { slug: 'private-help', title: 'Private', description: '', icon: 'help', hue: 'blue', workspace: 'help', audiences: ['admin'], visibility: 'internal' });
        const base = { summary: 'Old summary', keywords: ['old'], author: 'Old author', readMin: 1, status: 'published' as const, createdAt: 1, updatedAt: 2 };
        const price = await ctx.db.insert('knowledgeArticles', { ...base, slug: 'how-much-does-a-website-cost', title: 'Old price', workspace: 'help', categoryId: help, body: [{ t: 'p', text: 'A website costs ₱999 for everyone.' }], embedding: [0.2, 0.3], embeddingUpdatedAt: 2 });
        const ceiling = await ctx.db.insert('knowledgeArticles', { ...base, slug: 'your-price-band', title: 'Unlock your price', workspace: 'wiki', categoryId: wiki, body: [{ t: 'p', text: 'Five approved submissions unlock the ceiling.' }] });
        const cashout = await ctx.db.insert('knowledgeArticles', { ...base, slug: 'how-wise-payouts-work', title: 'Old payouts', workspace: 'wiki', categoryId: wiki, body: [{ t: 'p', text: 'Money is automatically sent to Wise on approval.' }] });
        const qa = await ctx.db.insert('knowledgeArticles', { ...base, slug: 'qa-unverified-bulk-discount', title: 'Is there a bulk discount?', workspace: 'help', categoryId: help, source: 'qa', body: [{ t: 'p', text: 'Unreviewed claim: ₱100 off every site.' }] });
        const privateArticle = await ctx.db.insert('knowledgeArticles', { ...base, slug: 'private-admin-note', title: 'Private note', workspace: 'help', categoryId: privateCategory, audiences: ['admin'], visibility: 'internal', body: [{ t: 'p', text: 'Keep this private.' }] });
        // Even a reviewed-guide slug may have deliberately stricter existing access.
        const privateGuide = await ctx.db.insert('knowledgeArticles', { ...base, slug: 'creator-code-setup', title: 'Restricted existing guide', workspace: 'help', categoryId: help, audiences: ['admin'], visibility: 'internal', body: [{ t: 'p', text: 'Reviewed privately.' }] });
        const privateFaq = await ctx.db.insert('knowledgeFaqs', { workspace: 'help', question: 'A private FAQ?', answer: 'Private answer', audiences: ['admin'], visibility: 'internal' });
        const priceFaq = await ctx.db.insert('knowledgeFaqs', { workspace: 'help', question: 'What does it cost?', answer: '₱999 for everyone.', linkArticleSlug: 'how-much-does-a-website-cost' });
        const ceilingFaq = await ctx.db.insert('knowledgeFaqs', { workspace: 'wiki', question: 'How do I raise my price ceiling?', answer: 'Send five approved submissions.', linkArticleSlug: 'your-price-band' });
        const payoutFaq = await ctx.db.insert('knowledgeFaqs', { workspace: 'wiki', question: 'When does Wise pay?', answer: 'Automatically after approval.', linkArticleSlug: 'how-wise-payouts-work' });
        return { help, wiki, privateCategory, price, ceiling, cashout, qa, privateArticle, privateGuide, privateFaq, priceFaq, ceilingFaq, payoutFaq };
    });
    return { t, ...fixture };
}

async function snapshot(t: ReturnType<typeof convexTest<typeof schema.tables>>) {
    return t.run(async ctx => ({
        categories: await ctx.db.query('knowledgeCategories').collect(),
        articles: await ctx.db.query('knowledgeArticles').collect(),
        faqs: await ctx.db.query('knowledgeFaqs').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
}

describe('reviewed knowledge curation', () => {
    it.each([null, 'owner', 'affiliate', 'agent', 'suspended-admin'] as const)('requires an active admin, including for a dry run (%s)', async subject => {
        const { t } = await setup();
        const actor = subject ? t.withIdentity({ subject }) : t;
        await expect(actor.mutation(api.knowledgeRoleGuides.curate, { apply: false })).rejects.toThrow(/authenticated|admin/i);
        await expect(actor.mutation(api.knowledgeRoleGuides.curate, { apply: true })).rejects.toThrow(/authenticated|admin/i);
    });

    it('dry-runs without writes, marker consumption, scheduled AI, emails or pushes', async () => {
        const { t, price } = await setup();
        const before = await snapshot(t);
        const actor = t.withIdentity({ subject: 'admin' });
        expect(await actor.mutation(api.knowledgeRoleGuides.curate, { apply: false })).toMatchObject({ applied: false, reviewedGuides: 10, roleGuides: 6 });
        expect(await snapshot(t)).toEqual(before);
        await actor.mutation(api.knowledgeRoleGuides.curate, { apply: true });
        expect((await t.run(ctx => ctx.db.get(price)))?.title).toBe('How much does a Tendso website cost?');
        expect((await snapshot(t)).jobs).toEqual([]);
    });

    it('replaces confirmed stale facts and their FAQs with shared current policy', async () => {
        const { t, price, ceiling, cashout, priceFaq, ceilingFaq, payoutFaq } = await setup();
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeRoleGuides.curate, { apply: true });
        const savedPrice = await t.run(ctx => ctx.db.get(price));
        expect(savedPrice?.summary).toContain(formatPHP(WEBSITE_PRICE));
        expect(savedPrice?.summary).toContain(formatPHP(CREATOR_CODE_PRICE));
        expect(savedPrice?.summary).toContain(formatPHP(BASE_PRICE));
        expect(JSON.stringify(savedPrice?.body)).toContain(formatPHP(CUSTOM_DOMAIN_ADDON));
        expect(savedPrice?.embedding).toBeUndefined();
        expect(savedPrice?.embeddingUpdatedAt).toBeUndefined();
        const savedCeiling = await t.run(ctx => ctx.db.get(ceiling));
        expect(JSON.stringify(savedCeiling?.body)).toContain('no five-submission unlock');
        expect(JSON.stringify(savedCeiling?.body)).toContain(formatPHP(PRICE_CEILING));
        const savedCashout = await t.run(ctx => ctx.db.get(cashout));
        expect(JSON.stringify(savedCashout?.body)).toContain('not sent automatically');
        expect((await t.run(ctx => ctx.db.get(priceFaq)))?.answer).toBe(savedPrice?.summary);
        expect(await t.run(ctx => ctx.db.get(ceilingFaq))).toMatchObject({ question: 'What price can a field agent quote?', answer: savedCeiling?.summary });
        expect((await t.run(ctx => ctx.db.get(payoutFaq)))?.answer).toBe(savedCashout?.summary);
    });

    it('quarantines captured replies while preserving deliberately private metadata', async () => {
        const { t, qa, privateArticle, privateCategory, privateGuide, privateFaq } = await setup();
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeRoleGuides.curate, { apply: true });
        expect(await t.run(ctx => ctx.db.get(qa))).toMatchObject({ status: 'draft' });
        for (const subject of ['owner', 'affiliate', 'agent']) {
            expect(await t.withIdentity({ subject }).query(api.knowledge.getArticleBySlug, { slug: 'qa-unverified-bulk-discount' })).toBeNull();
        }
        for (const id of [privateArticle, privateGuide]) expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ audiences: ['admin'], visibility: 'internal' });
        expect(await t.run(ctx => ctx.db.get(privateCategory))).toMatchObject({ audiences: ['admin'], visibility: 'internal' });
        expect(await t.run(ctx => ctx.db.get(privateFaq))).toMatchObject({ audiences: ['admin'], visibility: 'internal' });
        expect(await t.query(api.knowledge.getArticleBySlug, { slug: 'creator-code-setup' })).toBeNull();
    });

    it('adds role-specific guides whose visibility follows trusted account types', async () => {
        const { t } = await setup();
        await t.withIdentity({ subject: 'admin' }).mutation(api.knowledgeRoleGuides.curate, { apply: true });
        expect(await t.query(api.knowledge.getArticleBySlug, { slug: 'owner-business-dashboard' })).toBeNull();
        expect(await t.withIdentity({ subject: 'owner' }).query(api.knowledge.getArticleBySlug, { slug: 'owner-business-dashboard' })).not.toBeNull();
        expect(await t.withIdentity({ subject: 'affiliate' }).query(api.knowledge.getArticleBySlug, { slug: 'owner-business-dashboard' })).toBeNull();
        expect(await t.withIdentity({ subject: 'affiliate' }).query(api.knowledge.getArticleBySlug, { slug: 'creator-page-and-sharing' })).not.toBeNull();
        expect(await t.withIdentity({ subject: 'owner' }).query(api.knowledge.getArticleBySlug, { slug: 'creator-page-and-sharing' })).toBeNull();
        expect(await t.withIdentity({ subject: 'agent' }).query(api.knowledge.getArticleBySlug, { slug: 'field-agent-review-and-resend' })).not.toBeNull();
        expect(await t.withIdentity({ subject: 'agent' }).query(api.knowledge.getArticleBySlug, { slug: 'admin-knowledge-review' })).toBeNull();
        expect(await t.withIdentity({ subject: 'admin' }).query(api.knowledge.getArticleBySlug, { slug: 'admin-knowledge-review' })).not.toBeNull();
    });

    it('is a one-time curation: later edits and newly added knowledge survive a rerun', async () => {
        const { t, price, help } = await setup();
        const actor = t.withIdentity({ subject: 'admin' });
        await actor.mutation(api.knowledgeRoleGuides.curate, { apply: true });
        await t.run(async ctx => {
            await ctx.db.patch(price, { title: 'A later reviewed title', summary: 'Later updated policy', body: [{ t: 'p', text: 'Do not overwrite a later reviewed edit.' }], audiences: ['owner'], visibility: 'authenticated', updatedAt: NOW + 1 });
            await ctx.db.insert('knowledgeArticles', { slug: 'qa-later-reviewed', title: 'A later reviewed answer', summary: 'Keep published', categoryId: help, workspace: 'help', body: [{ t: 'p', text: 'Reviewed after migration.' }], keywords: [], author: 'Admin', readMin: 1, source: 'qa', status: 'published', audiences: ['affiliate'], visibility: 'authenticated', createdAt: NOW + 1, updatedAt: NOW + 1 });
        });
        const later = await snapshot(t);
        await actor.mutation(api.knowledgeRoleGuides.curate, { apply: false });
        await actor.mutation(api.knowledgeRoleGuides.curate, { apply: true });
        expect(await snapshot(t)).toEqual(later);
    });
});
