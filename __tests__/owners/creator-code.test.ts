import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { commissionFor } from '../../lib/pricing';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './ownerApp.ts': () => import('../../convex/ownerApp'),
    './ownerPayments.ts': () => import('../../convex/ownerPayments'),
    './payments.ts': () => import('../../convex/payments'),
};
const NOW = Date.UTC(2026, 9, 28, 12);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function setup(fields: Partial<Doc<'submissions'>> = {}) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const house = await ctx.db.insert('creators', { clerkId: 'house', email: 'house@example.test', role: 'creator' });
        const mika = await ctx.db.insert('creators', { clerkId: 'mika', email: 'mika@example.test', phone: '09170000001',
            role: 'affiliate', status: 'active', affiliateHandle: 'mika', referralCode: 'MIKA30', firstName: 'Mika',
            affiliatePhoto: 'https://images.example.test/mika.jpg', affiliatePrice: 3499, balance: 0, totalEarnings: 0 });
        const toni = await ctx.db.insert('creators', { clerkId: 'toni', email: 'toni@example.test', role: 'affiliate', status: 'active',
            affiliateHandle: 'toni', referralCode: 'TONI40', firstName: 'Toni', affiliatePrice: 2999 });
        const owner = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'ben@example.test', name: 'Ben',
            phone: '09172222222', createdAt: NOW });
        const submission = await ctx.db.insert('submissions', { creatorId: house, businessName: 'Ben Shop', businessType: 'Other',
            ownerName: 'Ben', ownerEmail: 'ben@example.test', ownerPhone: '09172222222', address: 'Main St', city: 'Marikina',
            contentSource: 'owner_app', status: 'draft', amount: 4999, creatorPayout: 0, submissionType: 'standard', ...fields });
        await ctx.db.insert('websiteOwnerships', { businessOwnerId: owner, submissionId: submission, role: 'owner', claimedAt: NOW });
        return { house, mika, toni, owner, submission };
    });
    vi.stubEnv('SELF_SERVE_CREATOR_ID', ids.house);
    const owner = t.withIdentity({ subject: 'owner', email: 'ben@example.test' });
    const row = () => t.run(ctx => ctx.db.get(ids.submission));
    const apply = (code: string | null = 'MIKA30') => owner.mutation(api.ownerApp.applyCreatorCode, { submissionId: ids.submission, code });
    const snapshot = () => t.run(async ctx => ({
        submission: await ctx.db.get(ids.submission), creators: await ctx.db.query('creators').collect(),
        tokens: await ctx.db.query('paymentTokens').collect(), claims: await ctx.db.query('creatorAttributions').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
    return { t, ids, owner, row, apply, snapshot };
}

describe('owner-app creator-code quote', () => {
    it('keeps a historical discounted quote through reads and payment even when its creator has a different legacy price', async () => {
        const { t, ids, owner, row } = await setup({ status: 'website_generated', previewReadyAt: NOW,
            ownerApprovedAt: NOW, amount: 2499, creatorPayout: 1250, websiteListPrice: 4999, affiliateHandle: 'mika' });
        await t.run(async ctx => {
            await ctx.db.patch(ids.submission, { creatorId: ids.mika });
            await ctx.db.patch(ids.mika, { affiliatePrice: 999 });
        });
        const before = await row();
        expect(await owner.query(api.ownerApp.creatorCode, { submissionId: ids.submission }))
            .toMatchObject({ total: 2499, applied: { total: 2499, saving: 2500 } });
        expect(await row()).toEqual(before);
        const token = await owner.mutation(api.ownerPayments.createPayToken, { submissionId: ids.submission, kind: 'full', expectedTotal: 2499 });
        expect(token.amount).toBe(2499);
        await t.mutation(internal.ownerPayments.applyTokenPayment, { token: token.token, provider: 'manual', triggeredBy: 'test', amountReceived: 2499 });
        expect(await row()).toMatchObject({ amount: 2499, amountPaid: 2499, balanceDue: 0, creatorPayout: 1250, status: 'completed' });
        expect((await t.run(ctx => ctx.db.get(ids.mika)))?.balance).toBe(1250);
    });

    it('computes the active offer, freezes the quote, preserves first attribution on change, and removes back to the house', async () => {
        const { t, ids, owner, apply, row } = await setup();
        expect(await apply('  mika30  ')).toEqual({ name: 'Mika', code: 'MIKA30', handle: 'mika',
            photo: 'https://images.example.test/mika.jpg', listPrice: 4999, total: 3499, saving: 1500 });
        expect(await row()).toMatchObject({ creatorId: ids.mika, amount: 3499, creatorPayout: commissionFor(3499),
            websiteListPrice: 4999, affiliateHandle: 'mika', status: 'draft' });
        const firstClaim = await t.run(ctx => ctx.db.query('creatorAttributions').collect());
        expect(firstClaim).toHaveLength(1); expect(firstClaim[0]).toMatchObject({ creatorId: ids.mika, source: 'code', kind: 'owner', status: 'applied' });
        await t.run(ctx => ctx.db.patch(ids.mika, { affiliatePrice: 4999 }));
        expect((await owner.query(api.ownerApp.creatorCode, { submissionId: ids.submission })).applied?.total).toBe(3499);
        expect((await apply('TONI40'))?.total).toBe(3499);
        expect(await row()).toMatchObject({ creatorId: ids.toni, amount: 3499, creatorPayout: commissionFor(3499), affiliateHandle: 'toni' });
        expect(await t.run(ctx => ctx.db.query('creatorAttributions').collect())).toEqual(firstClaim);
        expect(await apply(null)).toBeNull();
        const removed = await row();
        expect(removed).toMatchObject({ creatorId: ids.house, amount: 4999, creatorPayout: 0 });
        expect(removed?.affiliateHandle).toBeUndefined(); expect(removed?.websiteListPrice).toBeUndefined();
        expect(await owner.query(api.ownerApp.creatorCode, { submissionId: ids.submission }))
            .toEqual({ applied: null, editable: true, reason: null, total: 4999 });
        expect(await t.run(ctx => ctx.db.query('creatorAttributions').collect())).toEqual(firstClaim);
        expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('keeps the exact domain charge outside the commission and discount when the code changes', async () => {
        const { apply, row } = await setup({ submissionType: 'with_custom_domain', domainCostPHP: 450, domainChargedPHP: 450,
            requestedDomain: 'ben.example', amount: 5449, platformFee: 4999, balanceDue: 5449 });
        expect(await apply()).toMatchObject({ listPrice: 5449, total: 3949, saving: 1500 });
        expect(await row()).toMatchObject({ amount: 3949, creatorPayout: commissionFor(3499), platformFee: 3499 - commissionFor(3499),
            domainCostPHP: 450, domainChargedPHP: 450, requestedDomain: 'ben.example', balanceDue: 3949 });
        await apply(null);
        expect(await row()).toMatchObject({ amount: 5449, creatorPayout: 0, domainCostPHP: 450, domainChargedPHP: 450, balanceDue: 5449 });
    });

    it.each(['pending', 'suspended', 'deleted', 'soft-deleted'])('rejects a %s creator without changing the invoice or claims', async status => {
        const { t, ids, apply, snapshot } = await setup();
        await t.run(ctx => ctx.db.patch(ids.mika, status === 'soft-deleted' ? { isDeleted: true } : { status }));
        const before = await snapshot(); await expect(apply()).rejects.toThrow('active creator'); expect(await snapshot()).toEqual(before);
    });

    it.each(['', 'missing', 'mika', 'HOUSE'])('rejects a non-creator code %j rather than guessing a handle', async code => {
        const { apply, snapshot } = await setup(); const before = await snapshot();
        await expect(apply(code)).rejects.toThrow('active creator'); expect(await snapshot()).toEqual(before);
    });

    it.each(['email', 'phone', 'clerk', 'stored-email', 'stored-phone'])('rejects self referral by %s', async match => {
        const { t, ids, apply, snapshot } = await setup();
        await t.run(async ctx => {
            if (match === 'email') await ctx.db.patch(ids.mika, { email: ' BEN@EXAMPLE.TEST ' });
            if (match === 'phone') await ctx.db.patch(ids.mika, { phone: '+63 917 222 2222' });
            if (match === 'clerk') await ctx.db.patch(ids.mika, { clerkId: 'owner' });
            if (match === 'stored-email') await ctx.db.patch(ids.submission, { ownerEmail: 'mika@example.test' });
            if (match === 'stored-phone') await ctx.db.patch(ids.submission, { ownerPhone: '+63 917 000 0001' });
        });
        const before = await snapshot(); await expect(apply()).rejects.toThrow('own creator code'); expect(await snapshot()).toEqual(before);
    });

    it.each([
        { contentSource: undefined }, { contentSource: 'owner_intake' }, { status: 'in_review', previewReadyAt: NOW, ownerApprovedAt: NOW },
        { status: 'submitted' }, { status: 'rejected' }, { status: 'paid' }, { status: 'completed' }, { status: 'deposit_paid' },
        { paidAt: 0 }, { paidInFullAt: NOW }, { creatorPaidAt: NOW }, { amountPaid: 500 }, { depositPaidAt: NOW }, { depositAmount: 500 },
        { pricingMode: 'comped' }, { giveawayApplication: true }, { amount: 0 },
        { status: 'website_generated', previewReadyAt: NOW },
        { status: 'website_generated', previewReadyAt: NOW, ownerApprovedAt: NOW, buildSteps: { building_site: { status: 'running', updatedAt: NOW } } },
    ] as Partial<Doc<'submissions'>>[])('refuses repricing a protected order %j', async fields => {
        const { owner, ids, apply, snapshot } = await setup(fields); const before = await snapshot();
        await expect(apply()).rejects.toThrow(); expect(await snapshot()).toEqual(before);
        expect((await owner.query(api.ownerApp.creatorCode, { submissionId: ids.submission })).editable).toBe(false);
    });

    it('allows the finished, owner-approved unpaid preview but refuses open changes', async () => {
        const { t, ids, owner, apply, snapshot } = await setup({ status: 'submitted', previewReadyAt: NOW, ownerApprovedAt: NOW });
        expect((await owner.query(api.ownerApp.creatorCode, { submissionId: ids.submission })).editable).toBe(true);
        await apply();
        await t.run(ctx => ctx.db.insert('changeRequests', { submissionId: ids.submission, text: 'Fix the heading', status: 'open', requestedBy: 'owner', createdAt: NOW }));
        const before = await snapshot(); await expect(apply(null)).rejects.toThrow('requested changes'); expect(await snapshot()).toEqual(before);
    });

    it.each(['pending', 'expired', 'paid'])('does not change a quote while an existing %s token can settle or records money', async status => {
        const { t, ids, apply, snapshot } = await setup();
        await t.run(ctx => ctx.db.insert('paymentTokens', { submissionId: ids.submission, token: 'old-token', referenceCode: 'OLD-REF',
            amount: 4999, status: status as 'pending' | 'expired' | 'paid', createdAt: NOW - 5000, expiresAt: NOW - 1 }));
        const before = await snapshot(); await expect(apply()).rejects.toThrow('payment request'); expect(await snapshot()).toEqual(before);
    });

    it('permits a cancelled untouched token and keeps it rejected by settlement', async () => {
        const { t, ids, apply } = await setup();
        await t.run(ctx => ctx.db.insert('paymentTokens', { submissionId: ids.submission, token: 'cancelled-token', referenceCode: 'OLD-REF',
            amount: 4999, status: 'cancelled', createdAt: NOW - 1000, expiresAt: NOW + 1000 }));
        await apply();
        expect(await t.mutation(internal.ownerPayments.applyTokenPayment, { token: 'cancelled-token', provider: 'manual', triggeredBy: 'test' }))
            .toMatchObject({ result: 'rejected' });
    });

    it('never gives a foreign owner, an admin, or a signed-out caller the linked order code', async () => {
        const { t, ids, snapshot } = await setup();
        await t.run(ctx => ctx.db.insert('businessOwners', { clerkId: 'other', email: 'other@example.test', createdAt: NOW }));
        const before = await snapshot();
        for (const actor of [t, t.withIdentity({ subject: 'other' }), t.withIdentity({ subject: 'admin' })]) {
            await expect(actor.mutation(api.ownerApp.applyCreatorCode, { submissionId: ids.submission, code: 'MIKA30' })).rejects.toThrow();
            await expect(actor.query(api.ownerApp.creatorCode, { submissionId: ids.submission })).rejects.toThrow();
        }
        expect(await snapshot()).toEqual(before);
    });

    it('keeps the frozen commission through down payment and balance settlement without repricing or double credit', async () => {
        const { t, ids, owner, apply, row } = await setup({ status: 'website_generated', previewReadyAt: NOW, ownerApprovedAt: NOW });
        await apply();
        const token = await owner.mutation(api.ownerPayments.createPayToken, { submissionId: ids.submission, kind: 'deposit', amount: 500 });
        await t.mutation(internal.ownerPayments.applyTokenPayment, { token: token.token, provider: 'manual', triggeredBy: 'test', amountReceived: 500 });
        expect(await row()).toMatchObject({ amount: 3499, amountPaid: 500, balanceDue: 2999, creatorPayout: commissionFor(3499), status: 'deposit_paid' });
        await expect(apply('TONI40')).rejects.toThrow('already has a payment');
        await t.run(ctx => ctx.db.patch(ids.mika, { affiliatePrice: 999 }));
        const balance = await owner.mutation(api.ownerPayments.createPayToken, { submissionId: ids.submission, kind: 'balance' });
        expect(balance.amount).toBe(2999);
        await t.mutation(internal.ownerPayments.applyTokenPayment, { token: balance.token, provider: 'manual', triggeredBy: 'test', amountReceived: 2999 });
        expect(await row()).toMatchObject({ amount: 3499, amountPaid: 3499, balanceDue: 0, status: 'completed', creatorPayout: commissionFor(3499) });
        expect((await t.run(ctx => ctx.db.get(ids.mika)))?.balance).toBe(commissionFor(3499));
    });

    it.each(['valid', 'inactive', 'self', 'agent-attribution'])('creates a draft from only a valid existing owner attribution: %s', async mode => {
        const { t, ids, owner } = await setup();
        await t.run(async ctx => {
            await ctx.db.insert('creatorAttributions', { clerkId: 'owner', creatorId: ids.mika, handle: 'mika',
                kind: mode === 'agent-attribution' ? 'agent' : 'owner', source: 'confirmed', status: 'applied', createdAt: NOW });
            if (mode === 'inactive') await ctx.db.patch(ids.mika, { status: 'suspended' });
            if (mode === 'self') await ctx.db.patch(ids.mika, { email: 'ben@example.test' });
        });
        const id = await owner.mutation(api.ownerApp.createDraft, { businessName: 'New shop', businessType: 'Other' });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject(mode === 'valid'
            ? { creatorId: ids.mika, amount: 3499, creatorPayout: commissionFor(3499), affiliateHandle: 'mika' }
            : { creatorId: ids.house, amount: 4999, creatorPayout: 0 });
    });
});

describe('checkout displayed quote guard', () => {
    it.each(['full', 'deposit', 'balance'] as const)('rejects a changed %s quote before creating or reusing any payment token', async kind => {
        const balance = kind === 'balance';
        const { t, ids, owner, snapshot } = await setup({ status: balance ? 'deposit_paid' : 'website_generated',
            previewReadyAt: NOW, ownerApprovedAt: NOW, amount: 3499,
            ...(balance ? { amountPaid: 500, depositPaidAt: NOW, creatorPaidAt: NOW } : {}) });
        // An existing matching pending token must not bypass the displayed-price check.
        await t.run(ctx => ctx.db.insert('paymentTokens', { submissionId: ids.submission, token: 'pending-current-price', referenceCode: 'REF-CURRENT',
            amount: kind === 'deposit' ? 500 : balance ? 2999 : 3499, kind, status: 'pending', createdAt: NOW, expiresAt: NOW + 1000 }));
        const before = await snapshot();
        await expect(owner.mutation(api.ownerPayments.createPayToken, {
            submissionId: ids.submission, kind, ...(kind === 'deposit' ? { amount: 500 } : {}), expectedTotal: 4999,
        })).rejects.toThrow('price has changed');
        expect(await snapshot()).toEqual(before);
    });

    it.each([NaN, Infinity, -Infinity, 0, -1])('rejects invalid expected total %s without inserting payment instructions', async expectedTotal => {
        const { ids, owner, snapshot } = await setup({ status: 'website_generated', previewReadyAt: NOW, ownerApprovedAt: NOW });
        const before = await snapshot();
        await expect(owner.mutation(api.ownerPayments.createPayToken, { submissionId: ids.submission, kind: 'full', expectedTotal }))
            .rejects.toThrow('Refresh the price');
        expect(await snapshot()).toEqual(before);
    });

    it.each(['full', 'deposit', 'balance'] as const)('keeps %s callers without expectedTotal backward compatible and accepts matching quotes', async kind => {
        const balance = kind === 'balance';
        const { ids, owner } = await setup({ status: balance ? 'deposit_paid' : 'website_generated',
            previewReadyAt: NOW, ownerApprovedAt: NOW, amount: 3499,
            ...(balance ? { amountPaid: 500, depositPaidAt: NOW, creatorPaidAt: NOW } : {}) });
        const args = { submissionId: ids.submission, kind, ...(kind === 'deposit' ? { amount: 500 } : {}) };
        const legacy = await owner.mutation(api.ownerPayments.createPayToken, args);
        expect(legacy.amount).toBe(kind === 'deposit' ? 500 : balance ? 2999 : 3499);
        expect(await owner.mutation(api.ownerPayments.createPayToken, { ...args, expectedTotal: 3499 })).toEqual(legacy);
    });
});
