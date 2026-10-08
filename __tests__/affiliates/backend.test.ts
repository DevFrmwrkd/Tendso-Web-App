import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { affiliateHandleError, affiliatePriceError } from '../../lib/affiliates';
import type { Id } from '../../convex/_generated/dataModel';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './creators.ts': () => import('../../convex/creators'),
    './referrals.ts': () => import('../../convex/referrals'),
    './payments.ts': () => import('../../convex/payments'),
    './earnings.ts': () => import('../../convex/earnings'),
    './businessOwners.ts': () => import('../../convex/businessOwners'),
};

const signup = { firstName: 'Alex Santos', email: 'alex@example.com', phone: '09171234567', handle: 'alex-santos' };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    const adminId = await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active',
    }));
    const affiliate = t.withIdentity({ subject: 'affiliate', email: signup.email });
    const admin = t.withIdentity({ subject: 'admin' });
    return { t, affiliate, admin, adminId };
}

async function paidSubmission(t: ReturnType<typeof convexTest>, creatorId: Id<'creators'>, extra = {}) {
    return t.run((ctx) => ctx.db.insert('submissions', {
        creatorId, businessName: 'Corner Shop', businessType: 'shop', ownerName: 'Sam', ownerPhone: '09171234567',
        address: 'Main Street', city: 'Quezon City', status: 'completed', amount: 999, creatorPayout: 500, ...extra,
    }));
}

describe('affiliate signup and page foundation', () => {
    it('creates an active affiliate with its own unique code and no certification or incoming referral', async () => {
        const { t, affiliate } = await setup();
        const id = await affiliate.mutation(api.affiliates.create, signup);
        const row = await t.run((ctx) => ctx.db.get(id));
        expect(row).toMatchObject({ clerkId: 'affiliate', role: 'affiliate', status: 'active', affiliateHandle: signup.handle, phone: signup.phone });
        expect(row?.referralCode).toMatch(/^AFF[A-Z0-9]+$/);
        expect(row?.certifiedAt).toBeUndefined();
        expect(row?.quizPassedAt).toBeUndefined();
        expect(row?.referredByCode).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([]);
        expect(await affiliate.mutation(api.affiliates.create, signup)).toBe(id);

        const other = t.withIdentity({ subject: 'other-affiliate', email: 'other@example.com' });
        const otherId = await other.mutation(api.affiliates.create, { ...signup, email: 'other@example.com', handle: 'other-affiliate' });
        expect((await t.run((ctx) => ctx.db.get(otherId)))?.referralCode).not.toBe(row?.referralCode);
    });

    it('requires a session and rejects forged email or referral signup arguments', async () => {
        const { t, affiliate } = await setup();
        await expect(t.mutation(api.affiliates.create, signup)).rejects.toThrow('Not authenticated');
        await expect(affiliate.mutation(api.affiliates.create, { ...signup, email: 'someone@example.com' })).rejects.toThrow('signed-in email');
        for (const incoming of [{ referredByCode: 'SOMEONE' }, { referralCode: 'OWNCODE' }]) {
            await expect(affiliate.mutation(api.affiliates.create, { ...signup, ...incoming } as any)).rejects.toThrow();
        }
        expect(await t.query(api.affiliates.list, {}).catch(() => [])).toEqual([]);
    });

    it('reserves handles atomically, including deleted accounts, and enforces server validation', async () => {
        const { t, affiliate } = await setup();
        const id = await affiliate.mutation(api.affiliates.create, signup);
        const other = t.withIdentity({ subject: 'other', email: 'other@example.com' });
        const otherSignup = { ...signup, email: 'other@example.com' };
        await expect(other.mutation(api.affiliates.create, otherSignup)).rejects.toThrow('already taken');
        await t.run((ctx) => ctx.db.patch(id, { isDeleted: true }));
        await expect(other.mutation(api.affiliates.create, otherSignup)).rejects.toThrow('already taken');
        for (const handle of ['Admin', 'admin', 'dashboard', 'ab', '-alex', 'alex-', 'alex--shop', 'alex_shop', 'x'.repeat(31)]) {
            await expect(other.mutation(api.affiliates.create, { ...otherSignup, handle })).rejects.toThrow();
        }
        const contenders = ['first', 'second'].map((subject) => t.withIdentity({ subject, email: `${subject}@example.com` }));
        const results = await Promise.allSettled(contenders.map((caller, i) => caller.mutation(api.affiliates.create, {
            ...signup, email: `${['first', 'second'][i]}@example.com`, handle: 'same-page',
        })));
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    });

    it('prevents account type conversion by login, email, creator signup, and admin role mutation', async () => {
        const { t, affiliate, admin } = await setup();
        await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'creator', email: 'Creator@example.com', role: 'creator' }));
        await expect(t.withIdentity({ subject: 'creator' }).mutation(api.affiliates.create, { ...signup, email: 'creator@example.com' })).rejects.toThrow('another account type');
        await expect(t.withIdentity({ subject: 'new-login' }).mutation(api.affiliates.create, { ...signup, email: 'creator@example.com' })).rejects.toThrow('another account type');
        const id = await affiliate.mutation(api.affiliates.create, signup);
        await expect(affiliate.mutation(api.creators.create, { clerkId: 'affiliate', referralCode: 'TRYCREATOR', referredByCode: 'REFERRER' })).rejects.toThrow('affiliate account');
        await expect(t.withIdentity({ subject: 'new-creator' }).mutation(api.creators.create, { clerkId: 'new-creator', email: signup.email, referralCode: 'TRYCREATOR' })).rejects.toThrow('affiliate account');
        await expect(admin.mutation(api.creators.updateRole, { id, role: 'creator' })).rejects.toThrow('cannot change account type');
        await expect(t.withIdentity({ subject: 'forged' }).mutation(api.creators.create, { clerkId: 'other', referralCode: 'FORGED' })).rejects.toThrow('your own account');
    });

    it('requires an existing business owner to use a separate login and email', async () => {
        const { t } = await setup();
        await t.run((ctx) => ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'Owner@example.com', createdAt: Date.now() }));
        await expect(t.withIdentity({ subject: 'owner' }).mutation(api.affiliates.create, signup)).rejects.toThrow('business owner account');
        await expect(t.withIdentity({ subject: 'new-login' }).mutation(api.affiliates.create, { ...signup, email: 'owner@example.com' })).rejects.toThrow('business owner account');
    });

    it('does not let an affiliate claim a website using the same account', async () => {
        const { t, affiliate } = await setup();
        const id = await affiliate.mutation(api.affiliates.create, signup);
        const submissionId = await paidSubmission(t, id, { ownerEmail: signup.email });
        const token = 'a'.repeat(64);
        const tokenId = await t.run((ctx) => ctx.db.insert('ownerClaimTokens', {
            submissionId, token, email: signup.email, status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 100000,
        }));
        await expect(affiliate.mutation(api.businessOwners.claimWebsite, { token })).rejects.toThrow('affiliate account');
        expect(await t.run((ctx) => ctx.db.query('businessOwners').collect())).toEqual([]);
        expect((await t.run((ctx) => ctx.db.get(tokenId)))?.status).toBe('pending');
    });

    it('saves optional page fields for the signed-in active affiliate and clamps whole-peso price boundaries', async () => {
        const { t, affiliate, admin } = await setup();
        const id = await affiliate.mutation(api.affiliates.create, signup);
        await affiliate.mutation(api.affiliates.updatePage, { photo: 'https://example.com/photo.jpg', displayName: ' Alex ', message: ' Websites for your shop. ', socialLink: 'https://facebook.com/alex', price: 999 });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ affiliateDisplayName: 'Alex', affiliateMessage: 'Websites for your shop.', affiliatePrice: 999 });
        await affiliate.mutation(api.affiliates.updatePage, { price: 4999 });
        for (const [price, expected] of [[998, 999], [5000, 4999], [999.5, 1000]]) {
            await affiliate.mutation(api.affiliates.updatePage, { price });
            expect((await t.run((ctx) => ctx.db.get(id)))?.affiliatePrice).toBe(expected);
        }
        await expect(affiliate.mutation(api.affiliates.updatePage, { socialLink: 'javascript:alert(1)' })).rejects.toThrow('HTTPS');
        await expect(admin.mutation(api.affiliates.updatePage, { price: 999 })).rejects.toThrow('affiliate account');
        await affiliate.mutation(api.affiliates.updatePage, { message: '' });
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliateMessage).toBeUndefined();
        await admin.mutation(api.creators.updateStatus, { id, status: 'suspended' });
        await expect(affiliate.mutation(api.affiliates.updatePage, { price: 999 })).rejects.toThrow('suspended');
        await expect(affiliate.mutation(api.creators.updateStatus, { id, status: 'active' })).rejects.toThrow('admin access');
        await admin.mutation(api.creators.updateStatus, { id, status: 'active' });
        await affiliate.mutation(api.affiliates.updatePage, { price: 1999 });
    });

    it('keeps affiliate rows out of creator counts/lists and in the separate admin list', async () => {
        const { t, affiliate, admin, adminId } = await setup();
        const id = await affiliate.mutation(api.affiliates.create, signup);
        const legacy = await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'legacy', email: 'legacy@example.com' }));
        expect(await t.query(api.creators.count)).toBe(1);
        expect((await admin.query(api.creators.getAll)).map((row) => row._id)).toEqual([adminId, legacy]);
        expect((await admin.query(api.creators.getAllWithStats)).some((row) => row._id === id)).toBe(false);
        expect((await admin.query(api.affiliates.list)).map((row) => row._id)).toEqual([id]);
        await expect(affiliate.query(api.affiliates.list)).rejects.toThrow('admin access');
        await expect(affiliate.query(api.creators.getAll)).rejects.toThrow('admin access');
        await expect(affiliate.query(api.creators.getAllWithStats)).rejects.toThrow('admin access');
        await expect(t.query(api.creators.getAll)).rejects.toThrow('Not authenticated');
    });

    it('rejects affiliate certification across public, self-service and internal paths', async () => {
        const { t, affiliate, admin } = await setup();
        const id = await affiliate.mutation(api.affiliates.create, signup);
        await t.run((ctx) => ctx.db.patch(id, { quizPassedAt: 1, rejectedAt: 2 }));
        for (const mutation of [api.creators.certify, api.creators.approveCreator, api.creators.rejectCreator]) {
            await expect(admin.mutation(mutation, { id })).rejects.toThrow('Only creator accounts');
        }
        for (const mutation of [api.creators.markQuizPassed, api.creators.requestRecertification]) {
            await expect(affiliate.mutation(mutation, { id })).rejects.toThrow('Only creator accounts');
        }
        for (const mutation of [internal.creators.approveCreatorInternal, internal.creators.rejectCreatorInternal]) {
            await expect(t.mutation(mutation, { id })).rejects.toThrow('Only creator accounts');
        }
        expect(await admin.query(api.creators.listPendingApproval)).toEqual([]);
        expect(await admin.query(api.creators.listRejected)).toEqual([]);
        expect((await t.run((ctx) => ctx.db.get(id)))?.certifiedAt).toBeUndefined();
    });
});

describe('affiliate referral direction and bonus ledger', () => {
    it('allows an affiliate code for creator signup and credits exactly one ₱1,000 bonus tied to a paid submission', async () => {
        const { t, affiliate } = await setup();
        const referrerId = await affiliate.mutation(api.affiliates.create, signup);
        const code = (await t.run((ctx) => ctx.db.get(referrerId)))!.referralCode!;
        const creator = t.withIdentity({ subject: 'referred' });
        const referredId = await creator.mutation(api.creators.create, { clerkId: 'referred', email: 'referred@example.com', referralCode: 'REFERRED', referredByCode: code });
        await t.mutation(internal.referrals.createFromSignup, { referrerId, referredId, referralCode: code });
        await paidSubmission(t, referredId, { pricingMode: 'comped' });
        await t.mutation(internal.referrals.qualifyByCreator, { referredId, bonusAmount: 1000 });
        expect((await t.run((ctx) => ctx.db.get(referrerId)))?.balance).toBe(0);
        const submissionId = await paidSubmission(t, referredId);
        await t.mutation(internal.referrals.qualifyByCreator, { referredId, bonusAmount: 1000 });
        await t.mutation(internal.referrals.qualifyByCreator, { referredId, bonusAmount: 1000 });
        expect(await t.run((ctx) => ctx.db.get(referrerId))).toMatchObject({ balance: 1000, totalEarnings: 1000 });
        const ledgerJobs = await t.run(async (ctx) => (await ctx.db.system.query('_scheduled_functions').collect()).filter((job) => job.name === 'earnings:create'));
        expect(ledgerJobs).toHaveLength(1);
        expect(ledgerJobs[0].args[0]).toEqual({ creatorId: referrerId, submissionId, amount: 1000, type: 'referral_bonus' });
        await t.mutation(internal.earnings.create, ledgerJobs[0].args[0] as any);
        expect((await t.query(api.earnings.getSummary, { creatorId: referrerId })).byType.referrals).toBe(1000);
    });

    it('allows applying an affiliate code only to the caller’s creator account', async () => {
        const { t, affiliate } = await setup();
        const affiliateId = await affiliate.mutation(api.affiliates.create, signup);
        const code = (await t.run((ctx) => ctx.db.get(affiliateId)))!.referralCode!;
        const referredId = await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'referred', email: 'referred@example.com', role: 'creator' }));
        await expect(t.mutation(api.creators.applyReferralCode, { id: referredId, referredByCode: code })).rejects.toThrow('Not authenticated');
        await expect(affiliate.mutation(api.creators.applyReferralCode, { id: referredId, referredByCode: code })).rejects.toThrow('your own account');
        await expect(affiliate.mutation(api.creators.applyReferralCode, { id: affiliateId, referredByCode: code })).rejects.toThrow('Affiliates cannot be referred');
        await t.withIdentity({ subject: 'referred' }).mutation(api.creators.applyReferralCode, { id: referredId, referredByCode: code });
        expect(await t.run((ctx) => ctx.db.get(referredId))).toMatchObject({ referredBy: affiliateId, referredByCode: code });
        await expect(t.withIdentity({ subject: 'referred' }).mutation(api.creators.applyReferralCode, { id: referredId, referredByCode: code })).rejects.toThrow('already applied');
    });

    it('rejects internal affiliate recruitment and referral qualification even if a bad row already exists', async () => {
        const { t, affiliate } = await setup();
        const referredId = await affiliate.mutation(api.affiliates.create, signup);
        const referrerId = await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'referrer', email: 'referrer@example.com', role: 'creator', referralCode: 'INVITE' }));
        await expect(t.mutation(internal.referrals.createFromSignup, { referrerId, referredId, referralCode: 'INVITE' })).rejects.toThrow('Affiliates cannot be referred');
        await t.run((ctx) => ctx.db.insert('referrals', { referrerId, referredId, referralCode: 'INVITE', status: 'pending', createdAt: Date.now() }));
        await expect(t.mutation(internal.referrals.qualifyByCreator, { referredId, bonusAmount: 1000 })).rejects.toThrow('Only creator accounts');
    });

    it('settles an affiliate commission without qualifying a legacy incoming referral', async () => {
        const { t, affiliate } = await setup();
        const id = await affiliate.mutation(api.affiliates.create, signup);
        const referrerId = await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'referrer', email: 'referrer@example.com', role: 'creator' }));
        await t.run((ctx) => ctx.db.insert('referrals', { referrerId, referredId: id, referralCode: 'BAD', status: 'pending', createdAt: Date.now() }));
        const submissionId = await paidSubmission(t, id, { status: 'paid', amount: 4999, creatorPayout: 2500 });
        await t.mutation(internal.payments.creditCreatorForPayment, { submissionId, triggeredBy: 'admin:admin' });
        await t.mutation(internal.payments.creditCreatorForPayment, { submissionId, triggeredBy: 'admin:admin' });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ balance: 2500, totalEarnings: 2500 });
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'referrals:qualifyByCreator')).toEqual([]);
        expect(jobs.filter((job) => job.name === 'earnings:create')).toHaveLength(1);
    });
});

describe('shared affiliate input rules', () => {
    it('accepts valid handles and finite price input while rejecting invalid input', () => {
        expect(affiliateHandleError('alex-123')).toBeNull();
        expect(affiliateHandleError('tendso')).toContain('reserved');
        expect(affiliatePriceError(999)).toBeNull();
        expect(affiliatePriceError(4999)).toBeNull();
        for (const price of [-1, 998, 5000, 1000.1]) expect(affiliatePriceError(price)).toBeNull();
        for (const price of [NaN, Infinity, -Infinity]) expect(affiliatePriceError(price)).not.toBeNull();
    });
});
