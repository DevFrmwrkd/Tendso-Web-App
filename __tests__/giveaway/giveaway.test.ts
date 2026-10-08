import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { GIVEAWAY_CLOSED_MESSAGE } from '../../convex/lib/giveaway';
import { INTAKE_QUESTIONS } from '../../lib/narrativeFromQa';
import { WEBSITE_PRICE } from '../../lib/pricing';

// Load the same registered handlers used by a deployment.
const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './giveaway.ts': () => import('../../convex/giveaway'),
    './giveawayEmails.ts': () => import('../../convex/giveawayEmails'),
    './ownerIntake.ts': () => import('../../convex/ownerIntake'),
    './settings.ts': () => import('../../convex/settings'),
    './admin.ts': () => import('../../convex/admin'),
    './submissions.ts': () => import('../../convex/submissions'),
    './discord.ts': () => import('../../convex/discord'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
    './payments.ts': () => import('../../convex/payments'),
};

const NOW = Date.UTC(2026, 9, 8, 8);
const R2_URL = 'https://uploads.example.com';
const ADMIN_ID = 'test-giveaway-admin';
type Backend = ReturnType<typeof convexTest<typeof schema.tables>>;
type Config = { enabled: boolean; cap: number; endsAt?: number };

beforeEach(() => {
    // Render/email actions stay pending: tests never contact those services.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv('R2_PUBLIC_URL', R2_URL);
    vi.stubEnv('OWNER_INTAKE_DAILY_LIMIT', '1000');
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

async function setup(config: Config | null = { enabled: true, cap: 100 }) {
    const t = convexTest(schema, modules);
    const creatorId = await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert('creators', {
            clerkId: 'test-house-creator', email: 'house@example.com', role: 'admin',
        });
        await ctx.db.insert('creators', { clerkId: ADMIN_ID, email: 'admin@example.com', role: 'admin' });
        if (config) await ctx.db.insert('settings', { key: 'giveaway', value: config, updatedAt: NOW });
        return creatorId;
    });
    vi.stubEnv('SELF_SERVE_CREATOR_ID', creatorId);
    return { t, creatorId };
}

function application(number = 1) {
    return {
        businessName: `Walk-in Shop ${number}`, businessType: 'Barber/Salon', ownerName: 'Shop Owner',
        ownerPhone: `0917${number.toString().padStart(7, '0')}`, ownerEmail: `shop${number}@example.com`,
        address: '123 Main Street', city: 'Quezon City',
        qa: INTAKE_QUESTIONS.map(({ q }) => ({ q,
            a: 'We serve walk-in neighbours with haircuts and styling every day. Our regulars come back for careful service and friendly staff.',
        })),
        photos: ['', `${R2_URL}/interior-one.jpg`, `${R2_URL}/interior-two.jpg`, `${R2_URL}/exterior.jpg`],
        hasProducts: false, giveawayApplication: true, giveawayPosterPhoto: `${R2_URL}/poster-${number}.jpg`,
    };
}

async function seedApplication(t: Backend, creatorId: Id<'creators'>, number: number, overrides: Partial<Doc<'submissions'>> = {}) {
    const { businessName, businessType, ownerName, ownerPhone, ownerEmail, address, city } = application(number);
    return t.run(async (ctx) => ctx.db.insert('submissions', {
        creatorId, businessName, businessType, ownerName, ownerPhone, ownerEmail, address, city,
        status: 'submitted', giveawayApplication: true, giveawayPosterPhoto: `${R2_URL}/poster-${number}.jpg`,
        amount: 0, creatorPayout: 0, submissionType: 'standard', domainStatus: 'not_requested', ...overrides,
    }));
}

async function storedSubmission(t: Backend, id: Id<'submissions'>) {
    return t.run(async (ctx) => ctx.db.get(id));
}

async function milestones(t: Backend) {
    return t.run(async (ctx) => (await ctx.db.system.query('_scheduled_functions').collect())
        .filter((job) => job.name === 'discord:notifyGiveawayMilestone').map((job) => job.args[0]));
}

describe('giveawayStatus and slot lifecycle', () => {
    it('counts active applications as held, including given sites, without counting ordinary comped sites', async () => {
        const { t, creatorId } = await setup({ enabled: true, cap: 5 });
        await seedApplication(t, creatorId, 1);
        await seedApplication(t, creatorId, 2, { status: 'approved' });
        await seedApplication(t, creatorId, 3, { status: 'completed', pricingMode: 'comped' });
        await seedApplication(t, creatorId, 4, { status: 'rejected' });
        await seedApplication(t, creatorId, 5, { giveawayApplication: undefined, pricingMode: 'comped' });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 2, given: 1 });
    });

    it('frees slots immediately when an application is rejected or deleted', async () => {
        const { t, creatorId } = await setup({ enabled: true, cap: 2 });
        const first = await seedApplication(t, creatorId, 1);
        const second = await seedApplication(t, creatorId, 2);
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 0, given: 0 });
        await t.withIdentity({ subject: ADMIN_ID }).mutation(api.admin.rejectSubmission, { submissionId: first, adminId: ADMIN_ID, reason: 'The poster is not visible.' });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 1, given: 0 });
        await t.mutation(api.admin.deleteSubmissionRecords, { submissionId: second, adminId: ADMIN_ID });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 2, given: 0 });
    });

    it('closes after a cap reduction and never reports negative slots', async () => {
        const { t, creatorId } = await setup({ enabled: true, cap: 2 });
        await seedApplication(t, creatorId, 1);
        await seedApplication(t, creatorId, 2);
        await t.withIdentity({ subject: ADMIN_ID }).mutation(api.settings.set, { key: 'giveaway', value: { enabled: true, cap: 1 } });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 0, given: 0 });
    });

    it('allows admin settings to launch and close the giveaway and validates configuration', async () => {
        const { t } = await setup(null);
        expect((await t.query(api.giveaway.giveawayStatus)).open).toBe(false);
        const admin = t.withIdentity({ subject: ADMIN_ID });
        await admin.mutation(api.settings.set, { key: 'giveaway', value: { enabled: true, cap: 100 } });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 100, given: 0 });
        await admin.mutation(api.settings.set, { key: 'giveaway', value: { enabled: false, cap: 100 } });
        expect((await t.query(api.giveaway.giveawayStatus)).open).toBe(false);
        await expect(admin.mutation(api.settings.set, { key: 'giveaway', value: { enabled: true, cap: 0 } })).rejects.toThrow('positive integer');
        await expect(t.mutation(api.settings.set, { key: 'giveaway', value: { enabled: true, cap: 100 } })).rejects.toThrow('Not authenticated');
        await expect(t.mutation(api.settings.remove, { key: 'giveaway' })).rejects.toThrow('Not authenticated');
    });

    it('lets admins repoint the poster QR without exposing it to anonymous writes', async () => {
        const { t } = await setup();
        const key = 'poster_redirect_target';
        await expect(t.mutation(api.settings.set, { key, value: '/otr?src=poster' })).rejects.toThrow('Not authenticated');
        const admin = t.withIdentity({ subject: ADMIN_ID });
        await admin.mutation(api.settings.set, { key, value: '/otr?src=poster' });
        expect(await t.query(api.settings.get, { key })).toBe('/otr?src=poster');
        await admin.mutation(api.settings.set, { key, value: '/100-pages-giveaway?src=poster' });
        expect(await t.query(api.settings.get, { key })).toBe('/100-pages-giveaway?src=poster');
        await expect(t.mutation(api.settings.remove, { key })).rejects.toThrow('Not authenticated');
        await admin.mutation(api.settings.remove, { key });
        expect(await t.query(api.settings.get, { key })).toBeNull();
    });

    it('schedules deadline invalidation and closes live availability at the configured deadline', async () => {
        const { t } = await setup();
        const endsAt = NOW + 1000;
        await t.withIdentity({ subject: ADMIN_ID }).mutation(api.settings.set, {
            key: 'giveaway', value: { enabled: true, cap: 100, endsAt },
        });
        const scheduled = await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(scheduled.filter((job) => job.name === 'giveaway:expireGiveaway').map((job) => job.args[0])).toEqual([{ endsAt }]);
        expect((await t.query(api.giveaway.giveawayStatus)).open).toBe(true);
        vi.setSystemTime(endsAt);
        await t.mutation(internal.giveaway.expireGiveaway, { endsAt });
        expect((await t.query(api.giveaway.giveawayStatus)).open).toBe(false);
        expect(await t.run(async (ctx) => ctx.db.query('settings').first())).toMatchObject({ updatedAt: endsAt });
    });

    it('ignores stale deadline jobs after an operator extends the deadline', async () => {
        const { t } = await setup();
        const admin = t.withIdentity({ subject: ADMIN_ID });
        await admin.mutation(api.settings.set, { key: 'giveaway', value: { enabled: true, cap: 100, endsAt: NOW + 1000 } });
        await admin.mutation(api.settings.set, { key: 'giveaway', value: { enabled: true, cap: 100, endsAt: NOW + 10000 } });
        vi.setSystemTime(NOW + 2000);
        await t.mutation(internal.giveaway.expireGiveaway, { endsAt: NOW + 1000 });
        expect((await t.query(api.giveaway.giveawayStatus)).open).toBe(true);
        expect(await t.run(async (ctx) => ctx.db.query('settings').first())).toMatchObject({ updatedAt: NOW });
    });
});

describe('submitOwnerIntake giveaway reservation', () => {
    it('accepts exactly one concurrent applicant for the last slot', async () => {
        const { t, creatorId } = await setup({ enabled: true, cap: 2 });
        await seedApplication(t, creatorId, 1);
        // convex-test serializes mutations. This verifies that availability and
        // reservation are in one mutation; production Convex retries conflicts.
        const results = await Promise.allSettled([
            t.mutation(api.ownerIntake.submitOwnerIntake, application(2)),
            t.mutation(api.ownerIntake.submitOwnerIntake, application(3)),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        const refused = results.find((result) => result.status === 'rejected');
        expect(refused?.status === 'rejected' && refused.reason.message).toContain(GIVEAWAY_CLOSED_MESSAGE);
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 0, given: 0 });
        expect(await t.run(async (ctx) => ctx.db.query('submissions').collect())).toHaveLength(2);
        expect(await milestones(t)).toEqual([{ milestone: 'all_held', held: 2, given: 0, cap: 2 }]);
    });

    it.each([
        ['disabled', { enabled: false, cap: 100 }],
        ['ended', { enabled: true, cap: 100, endsAt: NOW - 1 }],
        ['at the exact end time', { enabled: true, cap: 100, endsAt: NOW }],
        ['not configured', null],
    ] as const)('refuses closed applications when %s without rows or scheduled work', async (_label, config) => {
        const { t } = await setup(config);
        expect((await t.query(api.giveaway.giveawayStatus)).open).toBe(false);
        await expect(t.mutation(api.ownerIntake.submitOwnerIntake, application())).rejects.toThrow(GIVEAWAY_CLOSED_MESSAGE);
        expect(await t.run(async (ctx) => ctx.db.query('submissions').collect())).toEqual([]);
        expect(await t.run(async (ctx) => ctx.db.query('ownerIntakeThrottle').collect())).toEqual([]);
        expect(await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('refuses a full giveaway even when the browser previously saw it open', async () => {
        const { t, creatorId } = await setup({ enabled: true, cap: 1 });
        expect((await t.query(api.giveaway.giveawayStatus)).open).toBe(true);
        await seedApplication(t, creatorId, 1);
        await expect(t.mutation(api.ownerIntake.submitOwnerIntake, application(2))).rejects.toThrow(GIVEAWAY_CLOSED_MESSAGE);
        expect(await t.run(async (ctx) => ctx.db.query('submissions').collect())).toHaveLength(1);
    });

    it('stores the poster separately, preserves site photo roles, and offers zero amount without discounts', async () => {
        const { t } = await setup();
        const args = { ...application(), campaign: 'otr' };
        const id = await t.mutation(api.ownerIntake.submitOwnerIntake, args);
        const stored = await storedSubmission(t, id);
        expect(stored).toMatchObject({ giveawayApplication: true, giveawayPosterPhoto: args.giveawayPosterPhoto,
            photos: args.photos, amount: 0, creatorPayout: 0, submissionType: 'standard', domainStatus: 'not_requested' });
        expect(stored?.photos?.[0]).toBe('');
        expect(stored?.photos).not.toContain(args.giveawayPosterPhoto);
        expect(stored?.campaign).toBeUndefined();
        expect(stored?.requestedDomain).toBeUndefined();
        expect(stored?.pricingMode).toBeUndefined();
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 99, given: 0 });
    });

    it.each([undefined, '', 'https://stranger.example/poster.jpg'])('requires an uploaded poster photo (%s)', async (giveawayPosterPhoto) => {
        const { t } = await setup();
        await expect(t.mutation(api.ownerIntake.submitOwnerIntake, { ...application(), giveawayPosterPhoto })).rejects.toThrow(/poster|Poster/);
        expect(await t.run(async (ctx) => ctx.db.query('submissions').collect())).toEqual([]);
    });

    it.each([
        { submissionType: 'with_custom_domain' as const, requestedDomain: 'shop.com' },
        { submissionType: 'standard' as const, requestedDomain: 'shop.com' },
    ])('refuses custom domains on a free application', async (tier) => {
        const { t } = await setup();
        await expect(t.mutation(api.ownerIntake.submitOwnerIntake, { ...application(), ...tier })).rejects.toThrow(/Tendso|domain/);
    });

    it.each([
        ['phone', { ownerPhone: '+63 917 000 0001' }],
        ['email', { ownerEmail: '  SHOP1@EXAMPLE.COM  ' }],
    ])('refuses duplicate normalized %s even after the earlier site was given', async (_kind, duplicate) => {
        const { t, creatorId } = await setup();
        await seedApplication(t, creatorId, 1, { pricingMode: 'comped' });
        await expect(t.mutation(api.ownerIntake.submitOwnerIntake, { ...application(2), ...duplicate })).rejects.toThrow('already exists');
        expect(await t.run(async (ctx) => ctx.db.query('submissions').collect())).toHaveLength(1);
    });

    it('recognizes Gmail dots and plus aliases as the same applicant', async () => {
        const { t, creatorId } = await setup();
        await seedApplication(t, creatorId, 1, { ownerEmail: 'shop.owner@gmail.com' });
        await expect(t.mutation(api.ownerIntake.submitOwnerIntake, { ...application(2), ownerEmail: 'ShopOwner+poster@googlemail.com' })).rejects.toThrow('already exists');
    });

    it('allows a fresh application after rejection and ignores ordinary paid submissions', async () => {
        const { t, creatorId } = await setup();
        await seedApplication(t, creatorId, 1, { status: 'rejected' });
        await seedApplication(t, creatorId, 2, { giveawayApplication: undefined, ownerPhone: application(1).ownerPhone, ownerEmail: application(1).ownerEmail });
        await expect(t.mutation(api.ownerIntake.submitOwnerIntake, application(1))).resolves.toBeTruthy();
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 99, given: 0 });
    });

    it('charges full price for ordinary intake with stale giveaway memory after closure', async () => {
        const { t } = await setup({ enabled: false, cap: 100 });
        const paid = { ...application(), giveawayApplication: undefined, giveawayPosterPhoto: undefined, campaign: 'giveaway' };
        const id = await t.mutation(api.ownerIntake.submitOwnerIntake, paid);
        const stored = await storedSubmission(t, id);
        expect(stored?.amount).toBe(WEBSITE_PRICE);
        expect(stored?.campaign).toBeUndefined();
        expect(stored?.giveawayApplication).toBeUndefined();
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 100, given: 0 });
    });
});

describe('shared submission mutations', () => {
    it('refuses to restore a rejected application when its slot has been taken', async () => {
        const { t, creatorId } = await setup({ enabled: true, cap: 1 });
        const rejected = await seedApplication(t, creatorId, 1, { status: 'rejected' });
        await seedApplication(t, creatorId, 2);
        await expect(t.mutation(api.submissions.updateStatus, { id: rejected, status: 'submitted' })).rejects.toThrow(GIVEAWAY_CLOSED_MESSAGE);
        await expect(t.mutation(api.admin.approveSubmission, { submissionId: rejected, adminId: ADMIN_ID })).rejects.toThrow(GIVEAWAY_CLOSED_MESSAGE);
        expect((await storedSubmission(t, rejected))?.status).toBe('rejected');
    });

    it('refuses restoration when a replacement uses the same contact', async () => {
        const { t, creatorId } = await setup();
        const rejected = await seedApplication(t, creatorId, 1, { status: 'rejected' });
        await seedApplication(t, creatorId, 2, { ownerEmail: application(1).ownerEmail });
        await expect(t.mutation(api.submissions.updateStatus, { id: rejected, status: 'approved' })).rejects.toThrow('already exists');
        expect((await storedSubmission(t, rejected))?.status).toBe('rejected');
    });

    it('reacquires a slot on restoration and alerts when it fills capacity', async () => {
        const { t, creatorId } = await setup({ enabled: true, cap: 1 });
        const rejected = await seedApplication(t, creatorId, 1, { status: 'rejected' });
        await t.mutation(api.submissions.updateStatus, { id: rejected, status: 'submitted' });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 0, given: 0 });
        expect(await milestones(t)).toEqual([{ milestone: 'all_held', held: 1, given: 0, cap: 1 }]);
    });

    it('prevents domains and repricing through shared mobile/admin mutations', async () => {
        const { t, creatorId } = await setup();
        const id = await seedApplication(t, creatorId, 1);
        await expect(t.mutation(api.submissions.setDomainTier, { id, submissionType: 'with_custom_domain', requestedDomain: 'shop.com' })).rejects.toThrow('Tendso web address');
        await t.mutation(api.submissions.setDomainTier, { id, submissionType: 'standard', sellPrice: 9999, domainPricePHP: 500 });
        await t.mutation(api.submissions.update, { id, amount: 4999, creatorPayout: 2500, platformFee: 100 });
        expect(await storedSubmission(t, id)).toMatchObject({ amount: 0, creatorPayout: 0, platformFee: 0, domainStatus: 'not_requested', submissionType: 'standard' });
        expect((await storedSubmission(t, id))?.requestedDomain).toBeUndefined();
    });

    it('checks duplicate contacts on edits and blocks treating uncomped applications as paid', async () => {
        const { t, creatorId } = await setup();
        await seedApplication(t, creatorId, 1);
        const second = await seedApplication(t, creatorId, 2);
        await expect(t.mutation(api.submissions.update, { id: second, ownerEmail: ' SHOP1@EXAMPLE.COM ' })).rejects.toThrow('already exists');
        await expect(t.mutation(api.submissions.updateStatus, { id: second, status: 'paid' })).rejects.toThrow('given away');
        expect((await storedSubmission(t, second))?.ownerEmail).toBe(application(2).ownerEmail);
    });

    it.each([
        ['phone', { ownerPhone: application(1).ownerPhone }],
        ['email', { ownerEmail: application(1).ownerEmail }],
    ])('keeps the original normalized %s reserved after both contact fields are edited', async (_kind, original) => {
        const { t } = await setup();
        const id = await t.mutation(api.ownerIntake.submitOwnerIntake, application(1));
        await t.mutation(api.submissions.update, { id, ownerPhone: application(2).ownerPhone, ownerEmail: application(2).ownerEmail });
        expect(await storedSubmission(t, id)).toMatchObject({ giveawayPhoneKey: '9170000001', giveawayEmailKey: 'shop1@example.com' });
        await expect(t.mutation(api.ownerIntake.submitOwnerIntake, { ...application(3), ...original })).rejects.toThrow('already exists');
        await t.withIdentity({ subject: ADMIN_ID }).mutation(api.admin.rejectSubmission, { submissionId: id, adminId: ADMIN_ID, reason: 'The poster is not visible.' });
        await expect(t.mutation(api.ownerIntake.submitOwnerIntake, { ...application(3), ...original })).resolves.toBeTruthy();
    });

    it('does not bill or settle an uncomped application through legacy payment entrypoints', async () => {
        const { t, creatorId } = await setup();
        const id = await seedApplication(t, creatorId, 1);
        await expect(t.mutation(internal.paymentTokens.storePaymentToken, {
            submissionId: id, token: 'test-token', referenceCode: 'test-reference', amount: 4999,
            createdAt: NOW, expiresAt: NOW + 1000,
        })).rejects.toThrow('cannot be billed');
        await expect(t.mutation(internal.payments.creditCreatorForPayment, {
            submissionId: id, triggeredBy: 'system:auto-payment', comped: true,
        })).rejects.toThrow('must be comped');
        expect((await storedSubmission(t, id))?.status).toBe('submitted');
        expect(await t.run(async (ctx) => ctx.db.query('paymentTokens').collect())).toEqual([]);
    });

    it('does not let pending comped credit revive an application rejected in the meantime', async () => {
        const { t, creatorId } = await setup();
        const id = await seedApplication(t, creatorId, 1, { pricingMode: 'comped', status: 'rejected' });
        await t.mutation(internal.payments.creditCreatorForPayment, { submissionId: id, triggeredBy: `admin:${ADMIN_ID}`, comped: true });
        expect((await storedSubmission(t, id))?.status).toBe('rejected');
        expect((await storedSubmission(t, id))?.creatorPaidAt).toBeUndefined();
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 100, given: 0 });
    });
});

describe('markComped and Discord milestones', () => {
    it('counts comped applications as given while retaining reservations and alerts the 100th gift once', async () => {
        const { t, creatorId } = await setup();
        for (let n = 1; n <= 99; n++) await seedApplication(t, creatorId, n, { pricingMode: 'comped', status: 'completed' });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 1, given: 99 });
        const id = await t.mutation(api.ownerIntake.submitOwnerIntake, application(100));
        await t.run(async (ctx) => ctx.db.insert('generatedWebsites', { submissionId: id }));
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 0, given: 99 });
        await t.mutation(api.admin.markComped, { submissionId: id, adminId: ADMIN_ID });
        await t.mutation(api.admin.markComped, { submissionId: id, adminId: ADMIN_ID });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 0, given: 100 });
        expect((await storedSubmission(t, id))?.pricingMode).toBe('comped');
        expect(await milestones(t)).toEqual([
            { milestone: 'all_held', held: 100, given: 99, cap: 100 },
            { milestone: 'all_given', held: 100, given: 100, cap: 100 },
        ]);
    });

    it('ordinary comped sites do not use giveaway slots or emit giveaway alerts', async () => {
        const { t, creatorId } = await setup();
        const id = await seedApplication(t, creatorId, 1, { giveawayApplication: undefined, amount: WEBSITE_PRICE });
        await t.run(async (ctx) => ctx.db.insert('generatedWebsites', { submissionId: id }));
        await t.mutation(api.admin.markComped, { submissionId: id, adminId: ADMIN_ID });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 100, given: 0 });
        expect(await milestones(t)).toEqual([]);
    });

    it('alerts when restoring a rejected comped application reaches the 100th given site', async () => {
        const { t, creatorId } = await setup();
        for (let n = 1; n <= 99; n++) await seedApplication(t, creatorId, n, { pricingMode: 'comped', status: 'completed' });
        const restored = await seedApplication(t, creatorId, 100, { pricingMode: 'comped', status: 'rejected' });
        await t.mutation(api.submissions.updateStatus, { id: restored, status: 'website_generated' });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 0, given: 100 });
        expect(await milestones(t)).toEqual([
            { milestone: 'all_held', held: 100, given: 100, cap: 100 },
            { milestone: 'all_given', held: 100, given: 100, cap: 100 },
        ]);
    });

    it('posts milestone messages to Discord with mentions disabled', async () => {
        const { t } = await setup();
        vi.stubEnv('DISCORD_BOT_TOKEN', 'test-bot-token');
        vi.stubEnv('DISCORD_GIVEAWAY_ALERTS_CHANNEL_ID', 'test-giveaway-channel');
        const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await t.action(internal.discord.notifyGiveawayMilestone, { milestone: 'all_held', held: 100, given: 90, cap: 100 });
        await t.action(internal.discord.notifyGiveawayMilestone, { milestone: 'all_given', held: 100, given: 100, cap: 100 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        for (const [url, request] of fetchMock.mock.calls) {
            expect(url).toBe('https://discord.com/api/v10/channels/test-giveaway-channel/messages');
            const body = JSON.parse(request.body);
            expect(body.allowed_mentions).toEqual({ parse: [] });
            expect(body.content).toContain('100');
        }
    });
});
