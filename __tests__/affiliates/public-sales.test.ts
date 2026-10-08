import { convexTest } from 'convex-test';
import type { FunctionArgs } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { INTAKE_QUESTIONS } from '../../lib/narrativeFromQa';
import { BASE_PRICE, CUSTOM_DOMAIN_ADDON, WEBSITE_PRICE, campaignSellPrice, commissionFor } from '../../lib/pricing';
import type { Doc } from '../../convex/_generated/dataModel';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './ownerIntake.ts': () => import('../../convex/ownerIntake'),
    './payments.ts': () => import('../../convex/payments'),
    './earnings.ts': () => import('../../convex/earnings'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
    './submissions.ts': () => import('../../convex/submissions'),
    './auditLogs.ts': () => import('../../convex/auditLogs'),
};
const R2_URL = 'https://uploads.example.com';
const NOW = Date.UTC(2026, 9, 8, 8);
const handle = 'alex-shops';

beforeEach(() => {
    // Keep every render, mail, domain and notification action pending.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv('R2_PUBLIC_URL', R2_URL);
    vi.stubEnv('OWNER_INTAKE_DAILY_LIMIT', '1000');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function setup(fields: Partial<Doc<'creators'>> = {}) {
    const t = convexTest(schema, modules);
    const [houseId, affiliateId] = await t.run(async (ctx) => {
        const houseId = await ctx.db.insert('creators', {
            clerkId: 'house', email: 'self-serve@tendso.com', role: 'admin', balance: 0,
        });
        const affiliateId = await ctx.db.insert('creators', {
            clerkId: 'affiliate', email: 'private@example.com', phone: '09171234567',
            role: 'affiliate', status: 'active', firstName: 'Alex', lastName: 'Santos',
            affiliateHandle: handle, affiliatePrice: 1999, affiliateDisplayName: 'Alex Websites',
            affiliatePhoto: 'https://example.com/photo.jpg', affiliateMessage: 'A website for your shop.',
            affiliateSocialLink: 'https://m.me/alex', referralCode: 'AFFALEX',
            balance: 0, totalEarnings: 0, totalWithdrawn: 0, wiseEmail: 'private-wise@example.com',
            payoutDetails: 'Private payout details', ...fields,
        });
        return [houseId, affiliateId];
    });
    vi.stubEnv('SELF_SERVE_CREATOR_ID', houseId);
    return { t, houseId, affiliateId };
}

function intake(number = 1) {
    return {
        businessName: `Shop ${number}`, businessType: 'Barber/Salon', ownerName: 'Shop Owner',
        ownerPhone: `0917${number.toString().padStart(7, '0')}`, ownerEmail: `owner${number}@example.com`,
        address: '123 Main Street', city: 'Quezon City', hasProducts: false,
        qa: INTAKE_QUESTIONS.map(({ q }) => ({ q,
            a: 'We serve walk-in neighbours with haircuts and styling every day. Our regulars come back for careful service and friendly staff.',
        })),
        photos: ['', `${R2_URL}/interior-one.jpg`, `${R2_URL}/interior-two.jpg`, `${R2_URL}/exterior.jpg`],
    };
}

describe('public affiliate offer lookup', () => {
    it('returns only public fields without requiring a session', async () => {
        const { t } = await setup();
        const offer = await t.query(api.affiliates.publicPage, { handle });
        expect(offer).toEqual({
            handle, photo: 'https://example.com/photo.jpg', displayName: 'Alex Websites',
            message: 'A website for your shop.', socialLink: 'https://m.me/alex', referralCode: 'AFFALEX', price: 1999,
        });
        expect(Object.keys(offer!).sort()).toEqual(['displayName', 'handle', 'message', 'photo', 'price', 'referralCode', 'socialLink']);
    });

    it('returns null for invalid handles and inactive, deleted or nonaffiliate accounts', async () => {
        const { t, affiliateId } = await setup();
        for (const invalid of ['missing-handle', 'Alex-Shops', ' alex-shops ', '', 'admin', '../alex-shops', 'x'.repeat(31)]) {
            expect(await t.query(api.affiliates.publicPage, { handle: invalid })).toBeNull();
        }
        for (const fields of [{ status: 'suspended' }, { status: 'deleted' }, { isDeleted: true }, { role: 'creator' }, { role: 'admin' }]) {
            await t.run((ctx) => ctx.db.patch(affiliateId, { role: 'affiliate', status: 'active', isDeleted: undefined, ...fields }));
            expect(await t.query(api.affiliates.publicPage, { handle })).toBeNull();
        }
    });

    it('uses the same clamped stored price at lookup and checkout and defaults an absent price to the list price', async () => {
        const { t, affiliateId } = await setup();
        const prices = [[undefined, WEBSITE_PRICE], [BASE_PRICE, BASE_PRICE], [998, BASE_PRICE], [7000, WEBSITE_PRICE], [1234.6, 1235], [NaN, BASE_PRICE]];
        for (const [index, [affiliatePrice, expected]] of prices.entries()) {
            await t.run((ctx) => ctx.db.patch(affiliateId, { affiliatePrice }));
            expect((await t.query(api.affiliates.publicPage, { handle }))?.price).toBe(expected);
            const id = await t.mutation(api.ownerIntake.submitOwnerIntake, { ...intake(index + 1), affiliateHandle: handle });
            expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
                creatorId: affiliateId, amount: expected, creatorPayout: commissionFor(expected!), websiteListPrice: WEBSITE_PRICE,
            });
        }
        await t.run((ctx) => ctx.db.patch(affiliateId, { affiliateDisplayName: undefined }));
        expect((await t.query(api.affiliates.publicPage, { handle }))?.displayName).toBe('Alex Santos');
        await t.run((ctx) => ctx.db.patch(affiliateId, { firstName: undefined, lastName: undefined }));
        expect((await t.query(api.affiliates.publicPage, { handle }))?.displayName).toBe(handle);
    });
});

describe('affiliate-attributed owner intake', () => {
    it('freezes the affiliate offer over a simultaneous campaign and preserves intake, lead, throttle and scheduling contracts', async () => {
        const { t, affiliateId, houseId } = await setup();
        const args = { ...intake(), affiliateHandle: handle, campaign: 'otr', source: ' Affiliate_QR! ' };
        const id = await t.mutation(api.ownerIntake.submitOwnerIntake, args);
        const stored = await t.run((ctx) => ctx.db.get(id));
        expect(stored).toMatchObject({
            creatorId: affiliateId, amount: 1999, creatorPayout: 1000, websiteListPrice: WEBSITE_PRICE,
            source: 'affiliate_qr', status: 'submitted', contentSource: 'owner_intake',
            photos: args.photos, interviewQa: args.qa, submissionType: 'standard', domainStatus: 'not_requested', domainChargedPHP: 0,
        });
        expect(stored?.campaign).toBeUndefined();
        expect(stored?.transcript).toBeTruthy();
        expect(await t.run((ctx) => ctx.db.query('leads').collect())).toEqual([
            expect.objectContaining({ submissionId: id, creatorId: affiliateId, source: 'direct', email: args.ownerEmail, phone: args.ownerPhone }),
        ]);
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'analytics:incrementStat').map((job) => job.args[0])).toEqual([
            { creatorId: affiliateId, period: '2026-10-08', periodType: 'daily', field: 'submissionsCount', delta: 1 },
            { creatorId: affiliateId, period: '2026-10', periodType: 'monthly', field: 'submissionsCount', delta: 1 },
        ]);
        expect(jobs.filter((job) => job.name === 'hyperagent:triggerStudioRender').map((job) => job.args[0])).toEqual([{ submissionId: id }]);
        expect(jobs.filter((job) => job.name === 'ownerIntake:sendIntakeReceivedEmailAction').map((job) => job.args[0])).toEqual([{ submissionId: id }]);
        expect(await t.run((ctx) => ctx.db.query('ownerIntakeThrottle').collect())).toHaveLength(3);
        expect((await t.run((ctx) => ctx.db.get(houseId)))?.balance).toBe(0);
    });

    it('falls back to full-price house attribution for every unavailable handle without inheriting OTR', async () => {
        const { t, affiliateId, houseId } = await setup();
        const variants = [
            { handle: 'unknown-affiliate', fields: {} }, { handle: '', fields: {} }, { handle: 'Alex-Shops', fields: {} },
            { handle, fields: { status: 'suspended' } }, { handle, fields: { isDeleted: true } },
            { handle, fields: { role: 'creator' } },
        ];
        for (const [index, variant] of variants.entries()) {
            await t.run((ctx) => ctx.db.patch(affiliateId, { status: 'active', isDeleted: undefined, role: 'affiliate', ...variant.fields }));
            const id = await t.mutation(api.ownerIntake.submitOwnerIntake, { ...intake(index + 1), affiliateHandle: variant.handle, campaign: 'otr' });
            const stored = await t.run((ctx) => ctx.db.get(id));
            expect(stored).toMatchObject({ creatorId: houseId, amount: WEBSITE_PRICE, creatorPayout: 0 });
            expect(stored?.campaign).toBeUndefined();
            expect(stored?.websiteListPrice).toBeUndefined();
        }
    });

    it('keeps ordinary self-serve campaigns unchanged and never attributes an explicit giveaway to an affiliate', async () => {
        const { t, houseId } = await setup();
        const standard = await t.mutation(api.ownerIntake.submitOwnerIntake, intake(1));
        expect(await t.run((ctx) => ctx.db.get(standard))).toMatchObject({ creatorId: houseId, amount: WEBSITE_PRICE, creatorPayout: 0 });
        const campaign = await t.mutation(api.ownerIntake.submitOwnerIntake, { ...intake(2), campaign: 'otr' });
        expect(await t.run((ctx) => ctx.db.get(campaign))).toMatchObject({ creatorId: houseId, amount: campaignSellPrice('otr'), creatorPayout: 0, campaign: 'otr' });
        await t.run((ctx) => ctx.db.insert('settings', { key: 'giveaway', value: { enabled: true, cap: 100 }, updatedAt: NOW }));
        const giveaway = await t.mutation(api.ownerIntake.submitOwnerIntake, {
            ...intake(3), affiliateHandle: handle, campaign: 'otr', giveawayApplication: true, giveawayPosterPhoto: `${R2_URL}/poster.jpg`,
        });
        const row = await t.run((ctx) => ctx.db.get(giveaway));
        expect(row).toMatchObject({ creatorId: houseId, amount: 0, creatorPayout: 0, giveawayApplication: true });
        expect(row?.campaign).toBeUndefined();
        expect(row?.websiteListPrice).toBeUndefined();
    });

    it('matches deposits against the stored order amount and pays the frozen affiliate commission only once', async () => {
        const { t, affiliateId } = await setup({ affiliatePrice: 2199.5 });
        const id = await t.mutation(api.ownerIntake.submitOwnerIntake, {
            ...intake(), affiliateHandle: handle, submissionType: 'with_custom_domain', requestedDomain: 'shopcorner.com',
        });
        const referenceCode = 'ND-7K3M-X9P2';
        const token = await t.action(api.paymentTokens.createPaymentToken, {
            submissionId: id, referenceCode, amount: 1,
        });
        expect(token.amount).toBe(2700);
        await t.run(async (ctx) => {
            // Simulate the published invoice, then change the affiliate's live offer.
            await ctx.db.patch(id, { status: 'pending_payment' });
            await ctx.db.patch(affiliateId, { affiliatePrice: WEBSITE_PRICE, status: 'suspended' });
        });
        const deposit = {
            referenceText: `Payment for ${referenceCode}`, currency: 'PHP', senderName: 'Shop Owner',
        };

        await t.action(internal.payments.processDeposit, {
            ...deposit, amount: 1, transactionId: 'affiliate-partial',
        });
        expect(await t.query(api.paymentTokens.getBySubmissionId, { submissionId: id })).toMatchObject({
            amount: 2700, status: 'pending',
        });
        const unpaid = (await t.run((ctx) => ctx.db.get(id)))!;
        expect(unpaid).toMatchObject({ status: 'pending_payment', amount: 2700, creatorPayout: 1100 });
        expect(unpaid.creatorPaidAt).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.get(affiliateId))).toMatchObject({ balance: 0, totalEarnings: 0 });
        expect(await t.run((ctx) => ctx.db.query('auditLogs').collect())).toEqual([
            expect.objectContaining({
                action: 'payment_partial', targetId: 'affiliate-partial',
                metadata: { refCode: referenceCode, expectedAmount: 2700, receivedAmount: 1, submissionId: id },
            }),
        ]);
        expect((await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect()))
            .filter((job) => job.name === 'earnings:create')).toHaveLength(0);

        const settledDeposit = { ...deposit, amount: token.amount, transactionId: 'affiliate-settled' };
        await t.action(internal.payments.processDeposit, settledDeposit);
        expect(await t.query(api.paymentTokens.getBySubmissionId, { submissionId: id })).toMatchObject({
            amount: 2700, status: 'paid', wiseTransactionId: 'affiliate-settled',
        });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
            status: 'completed', creatorPaidAt: NOW, amount: 2700, creatorPayout: 1100,
            websiteListPrice: WEBSITE_PRICE, domainChargedPHP: CUSTOM_DOMAIN_ADDON,
        });
        expect(await t.run((ctx) => ctx.db.get(affiliateId))).toMatchObject({ balance: 1100, totalEarnings: 1100 });

        await t.action(internal.payments.processDeposit, settledDeposit);
        expect(await t.run((ctx) => ctx.db.get(affiliateId))).toMatchObject({ balance: 1100, totalEarnings: 1100 });
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'earnings:create').map((job) => job.args[0])).toEqual([
            { creatorId: affiliateId, submissionId: id, amount: 1100, type: 'submission_approved' },
        ]);
        expect(jobs.filter((job) => job.name === 'domains:setupForSubmission')).toHaveLength(1);
        expect(await t.run((ctx) => ctx.db.query('auditLogs').collect())).toEqual([
            expect.objectContaining({ action: 'payment_partial', targetId: 'affiliate-partial' }),
            expect.objectContaining({
                action: 'payment_unmatched', targetId: 'affiliate-settled',
                metadata: { refCode: referenceCode, amount: 2700, reason: 'Duplicate — already paid' },
            }),
        ]);
    });

    it('excludes custom-domain add-ons from the frozen commission and credits the affiliate ledger once after payment', async () => {
        const { t, affiliateId, houseId } = await setup({ affiliatePrice: 2199.5 });
        const id = await t.mutation(api.ownerIntake.submitOwnerIntake, {
            ...intake(), affiliateHandle: handle, submissionType: 'with_custom_domain', requestedDomain: 'shopcorner.com',
        });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
            creatorId: affiliateId, amount: 2200 + CUSTOM_DOMAIN_ADDON, creatorPayout: 1100,
            websiteListPrice: WEBSITE_PRICE, requestedDomain: 'shopcorner.com', domainStatus: 'pending_payment', domainChargedPHP: CUSTOM_DOMAIN_ADDON,
        });
        const token = await t.action(api.paymentTokens.createPaymentToken, {
            submissionId: id, referenceCode: 'AFFILIATE-ORDER', amount: 1,
        });
        expect(token).toMatchObject({ submissionId: id, amount: 2700 });
        expect(await t.query(api.paymentTokens.getBySubmissionId, { submissionId: id })).toMatchObject({ amount: 2700 });
        await t.run(async (ctx) => {
            await ctx.db.patch(affiliateId, { affiliatePrice: WEBSITE_PRICE, status: 'suspended' });
            await ctx.db.patch(id, { status: 'paid', paidAt: NOW });
        });
        const args = { submissionId: id, triggeredBy: 'admin:reviewer' };
        await t.mutation(internal.payments.creditCreatorForPayment, args);
        await t.mutation(internal.payments.creditCreatorForPayment, args);
        expect(await t.run((ctx) => ctx.db.get(affiliateId))).toMatchObject({ balance: 1100, totalEarnings: 1100 });
        expect((await t.run((ctx) => ctx.db.get(houseId)))?.balance).toBe(0);
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ amount: 2700, creatorPayout: 1100, status: 'completed', creatorPaidAt: NOW });
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        const earnings = jobs.filter((job) => job.name === 'earnings:create');
        expect(earnings.map((job) => job.args[0])).toEqual([
            { creatorId: affiliateId, submissionId: id, amount: 1100, type: 'submission_approved' },
        ]);
        // Execute the real ledger mutation only; all external actions stay queued.
        await t.mutation(internal.earnings.create, earnings[0].args[0] as FunctionArgs<typeof internal.earnings.create>);
        expect(await t.run((ctx) => ctx.db.query('earnings').collect())).toEqual([
            expect.objectContaining({ creatorId: affiliateId, submissionId: id, amount: 1100, type: 'submission_approved', status: 'available' }),
        ]);
        expect(jobs.filter((job) => job.name === 'referrals:qualifyByCreator')).toEqual([]);
        const sales = await t.withIdentity({ subject: 'affiliate' }).query(api.affiliates.sales, { paginationOpts: { numItems: 10, cursor: null } });
        expect(sales.page[0]).toMatchObject({ price: 2700, commission: 1100 });
    });

    it('rechecks offer changes at submission and rejects forged browser prices or account IDs', async () => {
        const { t, affiliateId } = await setup();
        expect((await t.query(api.affiliates.publicPage, { handle }))?.price).toBe(1999);
        await t.run((ctx) => ctx.db.patch(affiliateId, { affiliatePrice: 2999 }));
        const submitted = await t.mutation(api.ownerIntake.submitOwnerIntake, { ...intake(), affiliateHandle: handle });
        expect(await t.run((ctx) => ctx.db.get(submitted))).toMatchObject({ amount: 2999, creatorPayout: 1500 });
        for (const forged of [{ amount: 1 }, { price: 1 }, { affiliatePrice: 1 }, { creatorPayout: 1 }, { creatorId: affiliateId }]) {
            await expect(t.mutation(api.ownerIntake.submitOwnerIntake, { ...intake(2), affiliateHandle: handle, ...forged })).rejects.toThrow();
        }
        expect(await t.run((ctx) => ctx.db.query('submissions').collect())).toHaveLength(1);
        await t.run((ctx) => ctx.db.patch(affiliateId, { status: 'suspended' }));
        const fallback = await t.mutation(api.ownerIntake.submitOwnerIntake, { ...intake(3), affiliateHandle: handle });
        expect(await t.run((ctx) => ctx.db.get(fallback))).toMatchObject({ amount: WEBSITE_PRICE, creatorPayout: 0 });
    });

    it('ignores generic monetary overrides for owner intake and affiliate orders while allowing nonfinancial updates', async () => {
        const { t, affiliateId } = await setup();
        const affiliateOrder = await t.mutation(api.ownerIntake.submitOwnerIntake, { ...intake(1), affiliateHandle: handle });
        const fallbackOrder = await t.mutation(api.ownerIntake.submitOwnerIntake, { ...intake(2), affiliateHandle: 'missing-affiliate' });
        const campaignOrder = await t.mutation(api.ownerIntake.submitOwnerIntake, { ...intake(3), campaign: 'otr' });
        // Also protect affiliate-owned rows without an owner-intake marker.
        const legacyOrder = await t.run((ctx) => ctx.db.insert('submissions', {
            creatorId: affiliateId, businessName: 'Legacy Affiliate Shop', businessType: 'Barber/Salon',
            ownerName: 'Shop Owner', ownerPhone: '09170000004', address: 'Main Street', city: 'Quezon City',
            status: 'paid', amount: 2499, creatorPayout: 1250, platformFee: 1249, websiteListPrice: WEBSITE_PRICE,
        }));
        for (const id of [affiliateOrder, fallbackOrder, campaignOrder, legacyOrder]) {
            const before = (await t.run((ctx) => ctx.db.get(id)))!;
            await t.mutation(api.submissions.update, {
                id, amount: 1, creatorPayout: 1000000, platformFee: 0,
                websiteUrl: 'https://example.com/published-shop', transcript: 'Updated transcript',
            });
            expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
                amount: before.amount, creatorPayout: before.creatorPayout,
                websiteUrl: 'https://example.com/published-shop', transcript: 'Updated transcript',
            });
            const after = (await t.run((ctx) => ctx.db.get(id)))!;
            expect(after.platformFee).toBe(before.platformFee);
            expect(after.websiteListPrice).toBe(before.websiteListPrice);
            expect(after.domainChargedPHP).toBe(before.domainChargedPHP);
            await expect(t.mutation(api.submissions.setDomainTier, {
                id, submissionType: 'standard', sellPrice: 1,
            })).rejects.toThrow('orders cannot use creator pricing');
            expect(await t.run((ctx) => ctx.db.get(id))).toEqual(after);
        }
        const safeToken = await t.action(api.paymentTokens.createPaymentToken, {
            submissionId: affiliateOrder, referenceCode: 'SAFE-AFFILIATE', amount: 1,
        });
        expect(safeToken.amount).toBe(1999);
    });

    it('retains ordinary mobile creator monetary updates and derives their token amount from the resulting order', async () => {
        const { t } = await setup();
        const id = await t.run(async (ctx) => {
            const creatorId = await ctx.db.insert('creators', { clerkId: 'mobile-creator', email: 'creator@example.com', role: 'creator' });
            return ctx.db.insert('submissions', {
                creatorId, businessName: 'Creator Shop', businessType: 'Barber/Salon', ownerName: 'Shop Owner',
                ownerPhone: '09170000001', address: 'Main Street', city: 'Quezon City', status: 'draft', amount: 999, creatorPayout: 500,
            });
        });
        await t.mutation(api.submissions.update, { id, amount: 2999, creatorPayout: 1500, platformFee: 1499 });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ amount: 2999, creatorPayout: 1500, platformFee: 1499 });
        expect(await t.action(api.paymentTokens.createPaymentToken, { submissionId: id, referenceCode: 'MOBILE-CREATOR', amount: 1 })).toMatchObject({ amount: 2999 });
    });

    it('refuses tokens for missing, comped, giveaway and nonpositive or nonfinite orders', async () => {
        const { t } = await setup();
        const id = await t.mutation(api.ownerIntake.submitOwnerIntake, intake());
        for (const fields of [
            { pricingMode: 'comped', amount: WEBSITE_PRICE },
            { giveawayApplication: true, amount: WEBSITE_PRICE },
            { amount: 0 }, { amount: -1 }, { amount: NaN }, { amount: Infinity }, { amount: undefined },
        ]) {
            await t.run((ctx) => ctx.db.patch(id, { pricingMode: undefined, giveawayApplication: undefined, ...fields }));
            await expect(t.action(api.paymentTokens.createPaymentToken, { submissionId: id, referenceCode: 'NO-TOKEN', amount: 1 })).rejects.toThrow();
        }
        await t.run((ctx) => ctx.db.delete(id));
        await expect(t.action(api.paymentTokens.createPaymentToken, { submissionId: id, referenceCode: 'NO-ORDER', amount: 1 })).rejects.toThrow('Submission not found');
        expect(await t.run((ctx) => ctx.db.query('paymentTokens').collect())).toEqual([]);
    });
});
