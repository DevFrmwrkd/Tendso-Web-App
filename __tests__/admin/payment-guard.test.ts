import { convexTest } from 'convex-test';
import type { Doc } from '../../convex/_generated/dataModel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './creators.ts': () => import('../../convex/creators'),
    './submissions.ts': () => import('../../convex/submissions'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
    './payments.ts': () => import('../../convex/payments'),
    './auditLogs.ts': () => import('../../convex/auditLogs'),
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup(fields: Partial<Doc<'submissions'>> = {}, role = 'creator') {
    const t = convexTest(schema, modules);
    const creatorId = await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'seller', email: 'seller@example.com', role, status: 'active', balance: 0, totalEarnings: 0,
    }));
    const submissionId = await t.run((ctx) => ctx.db.insert('submissions', {
        creatorId, businessName: 'Shop', businessType: 'Salon', ownerName: 'Owner', ownerPhone: '09170000000',
        address: 'Main Street', city: 'Manila', status: 'draft', amount: 999, creatorPayout: 500,
        submissionType: 'standard', ...fields,
    }));
    return { t, creatorId, submissionId, creator: t.withIdentity({ subject: 'seller' }) };
}

const invalidPricing: Array<[string, Partial<Doc<'submissions'>>]> = [
    ['tiny stored price', { amount: 1, creatorPayout: 1000000 }],
    ['valid minimum price with forged commission', { amount: 999, creatorPayout: 1000000 }],
    ['price below minimum', { amount: 998, creatorPayout: 0 }],
    ['price above ceiling', { amount: 5000, creatorPayout: 0 }],
    ['nonfinite price', { amount: Infinity, creatorPayout: 0 }],
    ['NaN price', { amount: NaN, creatorPayout: 0 }],
    ['negative commission', { creatorPayout: -1 }],
    ['nonfinite commission', { creatorPayout: Infinity }],
    ['NaN commission', { creatorPayout: NaN }],
    ['commission includes domain add-on', { amount: 1499, creatorPayout: 750, submissionType: 'with_custom_domain' }],
    ['custom-domain website below minimum', { amount: 1498, creatorPayout: 0, submissionType: 'with_custom_domain' }],
];

describe('stored invoice and commission bounds', () => {
    it.each(invalidPricing)('rejects %s at public mint and internal settlement without changes', async (_label, fields) => {
        const { t, creatorId, submissionId } = await setup(fields);
        const original = await t.run((ctx) => ctx.db.get(submissionId));
        await expect(t.action(api.paymentTokens.createPaymentToken, {
            submissionId, referenceCode: 'ND-7K3M-X9P2', amount: 4999,
        })).rejects.toThrow(/order amount|Website price|Creator payout/);
        await expect(t.mutation(internal.payments.creditCreatorForPayment, {
            submissionId, triggeredBy: 'system:auto-payment',
        })).rejects.toThrow(/order amount|Website price|Creator payout/);
        expect(await t.run((ctx) => ctx.db.get(submissionId))).toEqual(original);
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ balance: 0, totalEarnings: 0 });
        expect(await t.run((ctx) => ctx.db.query('paymentTokens').collect())).toEqual([]);
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('blocks the regular creator write → public mint path without changing its accepted input shape', async () => {
        const { t, creator, creatorId } = await setup();
        const submissionId = await creator.mutation(api.submissions.create, {
            creatorId, businessName: 'Forged draft', businessType: 'Salon', ownerName: 'Owner', ownerPhone: '09170000001',
            address: 'Main Street', city: 'Manila', status: 'draft', amount: 1, creatorPayout: 1000000,
        });
        await expect(t.action(api.paymentTokens.createPaymentToken, {
            submissionId, referenceCode: 'ND-7K3M-X9P2', amount: 1,
        })).rejects.toThrow('Website price');
        await creator.mutation(api.submissions.update, { id: submissionId, amount: 999 });
        await expect(t.action(api.paymentTokens.createPaymentToken, {
            submissionId, referenceCode: 'ND-7K3M-X9P2', amount: 999,
        })).rejects.toThrow('Creator payout');
        expect(await t.run((ctx) => ctx.db.query('paymentTokens').collect())).toEqual([]);
    });

    it.each([
        ['minimum', { amount: 999, creatorPayout: 500 }],
        ['ceiling', { amount: 4999, creatorPayout: 2500 }],
        ['legacy smaller commission', { amount: 3999, creatorPayout: 500 }],
        ['house zero commission', { amount: 4999, creatorPayout: 0 }],
        ['legacy absent commission', { amount: 1999, creatorPayout: undefined }],
        ['legacy registrar pass-through', { amount: 1719, creatorPayout: 500, submissionType: 'with_custom_domain', domainCostPHP: 720 }],
        ['frozen add-on after actual registrar bill changes', { amount: 1499, creatorPayout: 500, submissionType: 'with_custom_domain', domainChargedPHP: 500, domainCostPHP: 720 }],
        ['frozen free domain upgrade', { amount: 999, creatorPayout: 500, submissionType: 'with_custom_domain', domainChargedPHP: 0, domainCostPHP: 720 }],
    ] satisfies Array<[string, Partial<Doc<'submissions'>>]>)('preserves %s invoices and stored commissions', async (_label, fields) => {
        const { t, creatorId, submissionId } = await setup(fields);
        const token = await t.action(api.paymentTokens.createPaymentToken, {
            submissionId, referenceCode: 'ND-7K3M-X9P2', amount: 1,
        });
        expect(token.amount).toBe(fields.amount);
        await t.action(internal.payments.processDeposit, {
            referenceText: 'Payment ND-7K3M-X9P2', amount: fields.amount!, currency: 'PHP', transactionId: 'real-deposit',
        });
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({
            balance: fields.creatorPayout ?? 0, totalEarnings: fields.creatorPayout ?? 0,
        });
        const settled = await t.run((ctx) => ctx.db.get(submissionId));
        expect(settled).toMatchObject({ status: 'completed', amount: fields.amount });
        expect(settled?.creatorPayout).toBe(fields.creatorPayout);
        expect(await t.query(api.paymentTokens.getByToken, { token: token.token })).toMatchObject({ status: 'paid' });
    });

    it.each([
        ['payout', { creatorPayout: 1000000 }],
        ['tiny price', { amount: 1 }],
        ['different otherwise-valid invoice', { amount: 4999, creatorPayout: 2500 }],
    ] satisfies Array<[string, Partial<Doc<'submissions'>>]>)('does not consume an invoice or pay after a post-mint %s change', async (_label, fields) => {
        const { t, creator, creatorId, submissionId } = await setup();
        const token = await t.action(api.paymentTokens.createPaymentToken, {
            submissionId, referenceCode: 'ND-7K3M-X9P2', amount: 999,
        });
        await creator.mutation(api.submissions.update, { id: submissionId, ...fields });
        await expect(t.action(internal.payments.processDeposit, {
            referenceText: 'Payment ND-7K3M-X9P2', amount: 999, currency: 'PHP', transactionId: 'real-deposit',
        })).rejects.toThrow(/Website price|Creator payout|no longer matches/);
        await expect(t.mutation(internal.payments.creditCreatorForPayment, {
            submissionId, triggeredBy: 'system:auto-payment', expectedOwnerCharge: 999,
        })).rejects.toThrow(/Website price|Creator payout|no longer matches/);
        expect(await t.query(api.paymentTokens.getByToken, { token: token.token })).toMatchObject({ status: 'pending' });
        expect(await t.run((ctx) => ctx.db.get(submissionId))).toMatchObject({ status: 'draft', ...fields });
        expect((await t.run((ctx) => ctx.db.get(submissionId)))?.creatorPaidAt).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ balance: 0, totalEarnings: 0 });
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('preserves the frozen affiliate commission despite a later page price change and suspension', async () => {
        const { t, creatorId, submissionId } = await setup({ amount: 2200, creatorPayout: 1100, contentSource: 'owner_intake' }, 'affiliate');
        await t.run((ctx) => ctx.db.patch(creatorId, { affiliatePrice: 999, status: 'suspended' }));
        const token = await t.action(api.paymentTokens.createPaymentToken, {
            submissionId, referenceCode: 'ND-7K3M-X9P2', amount: 1,
        });
        await t.action(internal.payments.processDeposit, {
            referenceText: 'Payment ND-7K3M-X9P2', amount: 2200, currency: 'PHP', transactionId: 'frozen-affiliate-deposit',
        });
        expect(await t.query(api.paymentTokens.getByToken, { token: token.token })).toMatchObject({ status: 'paid', amount: 2200 });
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ balance: 1100 });
    });

    it('keeps comped and giveaway billing blocked while preserving their internal funding paths', async () => {
        for (const fields of [
            { pricingMode: 'comped', amount: 4999, creatorPayout: 500 },
            { pricingMode: 'comped', giveawayApplication: true, amount: 0, creatorPayout: 0 },
        ]) {
            const { t, creatorId, submissionId } = await setup(fields);
            await expect(t.action(api.paymentTokens.createPaymentToken, {
                submissionId, referenceCode: 'ND-7K3M-X9P2', amount: 4999,
            })).rejects.toThrow(/cannot be billed/);
            await t.mutation(internal.payments.creditCreatorForPayment, {
                submissionId, triggeredBy: 'admin:real-admin', comped: true,
            });
            expect(await t.run((ctx) => ctx.db.get(submissionId))).toMatchObject({ status: 'completed', amount: fields.amount });
            expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ balance: fields.creatorPayout });
        }
    });
});
