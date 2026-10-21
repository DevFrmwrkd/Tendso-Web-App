import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './owners.ts': () => import('../../convex/owners'),
    './ownerApp.ts': () => import('../../convex/ownerApp'),
    './ownerPayments.ts': () => import('../../convex/ownerPayments'),
    './ownerEmails.ts': () => import('../../convex/ownerEmails'),
    './payments.ts': () => import('../../convex/payments'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
    './buildProgress.ts': () => import('../../convex/buildProgress'),
    './changeRequests.ts': () => import('../../convex/changeRequests'),
    './xendit.ts': () => import('../../convex/xendit'),
    './http.ts': () => import('../../convex/http'),
    './auditLogs.ts': () => import('../../convex/auditLogs'),
    './generatedWebsites.ts': () => import('../../convex/generatedWebsites'),
    './submissions.ts': () => import('../../convex/submissions'),
    './earnings.ts': () => import('../../convex/earnings'),
    './businessOwners.ts': () => import('../../convex/businessOwners'),
};

const R2 = 'https://r2.example.com';
const ENV_KEYS = ['SELF_SERVE_CREATOR_ID', 'R2_PUBLIC_URL', 'XENDIT_SECRET_KEY', 'XENDIT_CALLBACK_TOKEN', 'RESEND_API_KEY'] as const;
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
    vi.useFakeTimers();
    savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    process.env.R2_PUBLIC_URL = R2;
    delete process.env.XENDIT_SECRET_KEY;
    delete process.env.XENDIT_CALLBACK_TOKEN;
    delete process.env.RESEND_API_KEY;
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    for (const k of ENV_KEYS) {
        if (savedEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedEnv[k];
    }
});

type T = ReturnType<typeof convexTest>;

async function setup() {
    const t = convexTest(schema, modules);
    const houseId = await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'house-no-login', email: 'self-serve@tendso.com', role: 'creator', status: 'active', balance: 0, totalEarnings: 0,
    }));
    process.env.SELF_SERVE_CREATOR_ID = houseId;
    const agentId = await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'agent', email: 'agent@example.com', role: 'creator', status: 'active', balance: 0, totalEarnings: 0,
    }));
    await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active' }));
    const owner = t.withIdentity({ subject: 'owner-1', email: 'Ben@Example.com', emailVerified: true, name: 'Ben Reyes' });
    const admin = t.withIdentity({ subject: 'admin' });
    const agent = t.withIdentity({ subject: 'agent' });
    return { t, houseId, agentId, owner, admin, agent };
}

async function agentSale(t: T, creatorId: Id<'creators'>, fields: Partial<Doc<'submissions'>> = {}) {
    return t.run((ctx) => ctx.db.insert('submissions', {
        creatorId, businessName: 'Forge Barbers', businessType: 'Barber/Salon', ownerName: 'Ben Reyes', ownerPhone: '09171234567',
        ownerEmail: 'ben@example.com', address: 'J.P. Rizal St', city: 'Marikina', status: 'pending_payment',
        amount: 4999, creatorPayout: 2500, submissionType: 'standard', ...fields,
    }));
}

async function scheduledNames(t: T): Promise<string[]> {
    return (await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).map((f) => f.name);
}

/** A complete owner-app draft, submitted. */
async function ownerSubmission(t: T, owner: ReturnType<T['withIdentity']>) {
    await owner.mutation(api.owners.ensure, { name: 'Ben Reyes', phone: '09171234567' });
    const id = await owner.mutation(api.ownerApp.createDraft, {
        businessType: 'Barber/Salon', businessName: 'Forge Barbers', address: 'J.P. Rizal St', city: 'Marikina', shotListKey: 'barber',
    });
    await owner.mutation(api.ownerApp.saveAnswer, { submissionId: id, index: 0, lang: 'en', answerText: 'Forge Barbers' });
    await owner.mutation(api.ownerApp.saveAnswer, {
        submissionId: id, index: 3, lang: 'tl', mediaUrl: `${R2}/videos/q3.mp4`, mediaType: 'video', durationSec: 42,
    });
    for (let i = 0; i < 3; i++) {
        await owner.mutation(api.ownerApp.saveShot, { submissionId: id, index: i, url: `${R2}/images/shot-${i}.jpg`, label: `Shot ${i}` });
    }
    await owner.mutation(api.ownerApp.saveShot, { submissionId: id, index: 0, url: `${R2}/images/extra.jpg`, extra: true });
    await owner.mutation(api.ownerApp.chooseDesign, { submissionId: id, templateId: 'barbershop:BP', templateIds: ['barbershop:BP', 'barbershop:BQ'] });
    await owner.mutation(api.ownerApp.submit, { submissionId: id });
    return id;
}

async function buildSite(t: T, submissionId: Id<'submissions'>) {
    await t.run((ctx) => ctx.db.insert('generatedWebsites', { submissionId, status: 'draft', htmlContent: '<html><body>Forge</body></html>' }));
    for (const step of ['reading_interview', 'writing_pages', 'polishing_photos', 'building_site'] as const) {
        await t.mutation(internal.buildProgress.setStep, { submissionId, step, status: 'running' });
        await t.mutation(internal.buildProgress.setStep, { submissionId, step, status: 'done' });
    }
}

describe('owner accounts', () => {
    it('ensure creates the owner once and links invited sites by verified email', async () => {
        const { t, agentId, owner } = await setup();
        const saleId = await agentSale(t, agentId);
        expect(await t.mutation(internal.owners.inviteForSubmission, { submissionId: saleId })).toEqual({ invited: true });
        // A second trigger (submit, then payment) sends no second invite.
        expect(await t.mutation(internal.owners.inviteForSubmission, { submissionId: saleId })).toEqual({ invited: false });
        expect((await scheduledNames(t)).filter((n) => n.includes('ownerEmails'))).toHaveLength(1);

        const first = await owner.mutation(api.owners.ensure, {});
        expect(first).toMatchObject({ email: 'ben@example.com', created: true, linkedSubmissionIds: [saleId] });
        const again = await owner.mutation(api.owners.ensure, {});
        expect(again).toMatchObject({ ownerId: first.ownerId, created: false, linkedSubmissionIds: [] });
        expect(await t.run((ctx) => ctx.db.query('businessOwners').collect())).toHaveLength(1);

        const me = await owner.query(api.owners.me, {});
        expect(me?.sites).toEqual([expect.objectContaining({ submissionId: saleId, publishPolicy: 'publish_first', balanceDue: 4999 })]);

        // Same email, new Clerk user: re-linked, not duplicated.
        const reborn = t.withIdentity({ subject: 'owner-1b', email: 'ben@example.com', emailVerified: true });
        expect((await reborn.mutation(api.owners.ensure, {})).ownerId).toBe(first.ownerId);
        expect(await t.run((ctx) => ctx.db.query('businessOwners').collect())).toHaveLength(1);
    });

    it('links straight away when the owner already exists, and refuses unverified or affiliate logins', async () => {
        const { t, agentId, owner } = await setup();
        const { ownerId } = await owner.mutation(api.owners.ensure, {});
        const saleId = await agentSale(t, agentId);
        await t.mutation(internal.owners.inviteForSubmission, { submissionId: saleId });
        const link = await t.run((ctx) => ctx.db.query('websiteOwnerships').collect());
        expect(link).toEqual([expect.objectContaining({ businessOwnerId: ownerId, submissionId: saleId })]);

        await expect(t.withIdentity({ subject: 'x', email: 'x@example.com', emailVerified: false })
            .mutation(api.owners.ensure, {})).rejects.toThrow('confirm your email');
        await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'aff', email: 'aff@example.com', role: 'affiliate', status: 'active' }));
        await expect(t.withIdentity({ subject: 'aff', email: 'aff@example.com' }).mutation(api.owners.ensure, {}))
            .rejects.toThrow('creator account');
        await expect(t.mutation(api.owners.ensure, {})).rejects.toThrow('sign in');
    });

    it('no longer mints claim tokens', async () => {
        const { t, agentId, admin } = await setup();
        const saleId = await agentSale(t, agentId);
        expect(await admin.mutation(api.businessOwners.issueClaimTokenForEmail, { submissionId: saleId })).toEqual({ token: '' });
        expect(await t.run((ctx) => ctx.db.query('ownerClaimTokens').collect())).toEqual([]);
    });
});

describe('owner self-serve submission', () => {
    it('creates a draft, saves answers, photos and design, and submits like /start', async () => {
        const { t, houseId, owner } = await setup();
        const id = await ownerSubmission(t, owner);
        const s = await t.run((ctx) => ctx.db.get(id));
        expect(s).toMatchObject({
            status: 'submitted', contentSource: 'owner_app', creatorId: houseId, ownerEmail: 'ben@example.com',
            ownerName: 'Ben Reyes', amount: 4999, creatorPayout: 0, templateId: 'barbershop:BP',
            templateIds: ['barbershop:BP', 'barbershop:BQ'], shotListKey: 'barber',
            photos: [`${R2}/images/shot-0.jpg`, `${R2}/images/shot-1.jpg`, `${R2}/images/shot-2.jpg`, `${R2}/images/extra.jpg`],
            interviewQa: [{ q: "What's your shop called?", a: 'Forge Barbers' }],
        });
        expect(s?.ownerInterview?.[1]).toMatchObject({ index: 3, questionTl: 'Ano ang pinakagusto ng mga tao?', mediaType: 'video', durationSec: 42 });
        expect(s?.buildSteps?.reading_interview?.status).toBe('pending');
        expect(await t.run((ctx) => ctx.db.query('leads').collect())).toHaveLength(1);
        const names = await scheduledNames(t);
        expect(names).toEqual(expect.arrayContaining(['buildProgress:startPipeline', 'ownerEmails:send']));

        // Double tap: no second lead, no second kick-off.
        await owner.mutation(api.ownerApp.submit, { submissionId: id });
        expect(await t.run((ctx) => ctx.db.query('leads').collect())).toHaveLength(1);
        // Font and colour can come later.
        await owner.mutation(api.ownerApp.setStyle, { submissionId: id, fontChoice: 'modern', colorChoice: 'forest' });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ fontChoice: 'modern', colorChoice: 'forest' });
    });

    it('rejects foreign uploads, other owners and incomplete drafts', async () => {
        const { t, owner } = await setup();
        await owner.mutation(api.owners.ensure, {});
        const id = await owner.mutation(api.ownerApp.createDraft, { businessType: 'Barber/Salon', businessName: 'Forge', address: 'Main St' });
        await expect(owner.mutation(api.ownerApp.saveShot, { submissionId: id, index: 0, url: 'https://evil.example.com/x.jpg' }))
            .rejects.toThrow('upload through the app');
        await expect(owner.mutation(api.ownerApp.submit, { submissionId: id })).rejects.toThrow('answer the questions');
        await expect(owner.mutation(api.ownerApp.createDraft, { businessType: 'Rocket Science', businessName: 'X' }))
            .rejects.toThrow('from the list');

        const stranger = t.withIdentity({ subject: 'owner-2', email: 'other@example.com' });
        await stranger.mutation(api.owners.ensure, {});
        await expect(stranger.query(api.ownerApp.getSubmission, { submissionId: id })).rejects.toThrow('could not find');
        await expect(stranger.mutation(api.ownerApp.saveAnswer, { submissionId: id, index: 0, lang: 'en', answerText: 'x' }))
            .rejects.toThrow('could not find');
    });
});

describe('build progress', () => {
    it('reports the four steps, then a private preview the owner can check', async () => {
        const { t, owner } = await setup();
        const id = await ownerSubmission(t, owner);
        expect((await owner.query(api.ownerApp.getBuild, { submissionId: id })).phase).toBe('building');

        await t.mutation(internal.buildProgress.setStep, { submissionId: id, step: 'reading_interview', status: 'running' });
        await t.mutation(internal.buildProgress.setStep, { submissionId: id, step: 'reading_interview', status: 'done' });
        let build = await owner.query(api.ownerApp.getBuild, { submissionId: id });
        expect(build.steps.map((s) => s.status)).toEqual(['done', 'pending', 'pending', 'pending']);
        expect(build.steps[0].startedAt).not.toBeNull();
        expect(build.doneCount).toBe(1);
        expect(build.buildStartedAt).not.toBeNull();
        expect(build.estimateMinutes).toBe(20);

        await t.mutation(internal.buildProgress.setStep, { submissionId: id, step: 'polishing_photos', status: 'failed', error: 'timeout' });
        build = await owner.query(api.ownerApp.getBuild, { submissionId: id });
        expect(build.steps[2]).toMatchObject({ status: 'failed', error: 'timeout' });

        await buildSite(t, id);
        build = await owner.query(api.ownerApp.getBuild, { submissionId: id });
        expect(build.phase).toBe('ready_to_check');
        expect(build.previewReadyAt).not.toBeNull();
        const preview = await owner.query(api.ownerApp.getPreview, { submissionId: id });
        expect(preview).toMatchObject({ ready: true, isLive: false, publishedUrl: null, inlineHtml: expect.stringContaining('Forge') });
    });

    it('refuses progress on drafts', async () => {
        const { t, owner } = await setup();
        await owner.mutation(api.owners.ensure, {});
        const id = await owner.mutation(api.ownerApp.createDraft, { businessType: 'Barber/Salon', businessName: 'Forge', address: 'Main St' });
        await expect(t.mutation(internal.buildProgress.setStep, { submissionId: id, step: 'writing_pages', status: 'running' }))
            .rejects.toThrow('draft');
    });
});

describe('down payments', () => {
    it('deposit → deposit_paid (agent gets the whole cut) → balance → completed, credited once', async () => {
        const { t, agentId, agent } = await setup();
        const saleId = await agentSale(t, agentId);
        await expect(agent.mutation(api.ownerPayments.createPayToken, { submissionId: saleId, kind: 'deposit', amount: 499 }))
            .rejects.toThrow('smallest down payment is ₱500');
        await expect(agent.mutation(api.ownerPayments.createPayToken, { submissionId: saleId, kind: 'balance' }))
            .rejects.toThrow('no balance');
        const dep = await agent.mutation(api.ownerPayments.createPayToken, { submissionId: saleId, kind: 'deposit', amount: 500 });
        expect(dep).toMatchObject({ kind: 'deposit', amount: 500 });
        // A double tap reuses the same request.
        expect((await agent.mutation(api.ownerPayments.createPayToken, { submissionId: saleId, kind: 'deposit', amount: 500 })).token).toBe(dep.token);

        // Wise transfer quoting the reference.
        await t.action(internal.payments.processDeposit, {
            referenceText: `Payment ${dep.referenceCode}`, amount: 500, currency: 'PHP', transactionId: 'wise-1',
        });
        let s = await t.run((ctx) => ctx.db.get(saleId));
        expect(s).toMatchObject({ status: 'deposit_paid', amountPaid: 500, depositAmount: 500, balanceDue: 4499 });
        expect(s?.creatorPaidAt).toBeDefined();
        expect(s?.paidInFullAt).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.get(agentId))).toMatchObject({ balance: 2500, totalEarnings: 2500 });
        const state = await agent.query(api.ownerPayments.getPaymentState, { submissionId: saleId });
        expect(state).toMatchObject({ billable: true, balanceDue: 4499, canPayBalance: true, canPayFull: false, canPayDeposit: false });

        // The same deposit webhook again changes nothing.
        await t.action(internal.payments.processDeposit, {
            referenceText: `Payment ${dep.referenceCode}`, amount: 500, currency: 'PHP', transactionId: 'wise-1',
        });
        expect(await t.run((ctx) => ctx.db.get(agentId))).toMatchObject({ balance: 2500 });

        const bal = await agent.mutation(api.ownerPayments.createPayToken, { submissionId: saleId, kind: 'balance' });
        expect(bal).toMatchObject({ kind: 'balance', amount: 4499 });
        const applied = await t.mutation(internal.ownerPayments.applyTokenPayment, {
            token: bal.token, provider: 'manual', triggeredBy: 'admin:admin', amountReceived: 4499,
        });
        expect(applied).toMatchObject({ result: 'applied', stage: 'balance', status: 'completed' });
        s = await t.run((ctx) => ctx.db.get(saleId));
        expect(s).toMatchObject({ status: 'completed', amountPaid: 4999, balanceDue: 0 });
        expect(s?.paidInFullAt).toBeDefined();
        expect(s?.paidAt).toBeDefined();
        // Still exactly one cut.
        expect(await t.run((ctx) => ctx.db.get(agentId))).toMatchObject({ balance: 2500, totalEarnings: 2500 });
        const earningsJobs = (await scheduledNames(t)).filter((n) => n === 'earnings:create');
        expect(earningsJobs).toHaveLength(1);
        await expect(agent.mutation(api.ownerPayments.createPayToken, { submissionId: saleId, kind: 'full' })).rejects.toThrow('already paid');
    });

    it('an admin "Mark paid" after a deposit settles the balance without a second credit', async () => {
        const { t, agentId, agent } = await setup();
        const saleId = await agentSale(t, agentId);
        const dep = await agent.mutation(api.ownerPayments.createPayToken, { submissionId: saleId, kind: 'deposit', amount: 1000 });
        await t.mutation(internal.ownerPayments.applyTokenPayment, { token: dep.token, provider: 'manual', triggeredBy: 'admin:admin' });
        await t.mutation(internal.payments.creditCreatorForPayment, { submissionId: saleId, triggeredBy: 'admin:admin' });
        expect(await t.run((ctx) => ctx.db.get(saleId))).toMatchObject({ status: 'completed', amountPaid: 4999, balanceDue: 0 });
        expect(await t.run((ctx) => ctx.db.get(agentId))).toMatchObject({ balance: 2500 });
    });

    it('a deposit equal to the total is a full payment, and stale whole-order tokens are refused after a deposit', async () => {
        const { t, agentId, agent } = await setup();
        const saleId = await agentSale(t, agentId);
        expect(await agent.mutation(api.ownerPayments.createPayToken, { submissionId: saleId, kind: 'deposit', amount: 4999 }))
            .toMatchObject({ kind: 'full', amount: 4999 });
        const full = (await t.run((ctx) => ctx.db.query('paymentTokens').collect()))[0];
        const dep = await agent.mutation(api.ownerPayments.createPayToken, { submissionId: saleId, kind: 'deposit', amount: 600 });
        await t.mutation(internal.ownerPayments.applyTokenPayment, { token: dep.token, provider: 'manual', triggeredBy: 'admin:admin' });
        // The other open request was cancelled when the deposit landed.
        expect((await t.run((ctx) => ctx.db.get(full._id)))?.status).toBe('cancelled');
        expect(await t.mutation(internal.ownerPayments.applyTokenPayment, { token: full.token, provider: 'manual', triggeredBy: 'admin:admin' }))
            .toMatchObject({ result: 'rejected' });
        expect(await t.run((ctx) => ctx.db.get(agentId))).toMatchObject({ balance: 2500 });
    });
});

describe('Xendit', () => {
    async function paidOwnerSite() {
        const ctx = await setup();
        const id = await ownerSubmission(ctx.t, ctx.owner);
        await buildSite(ctx.t, id);
        await ctx.owner.mutation(api.ownerApp.approvePreview, { submissionId: id });
        const pay = await ctx.owner.mutation(api.ownerPayments.createPayToken, { submissionId: id, kind: 'full' });
        return { ...ctx, id, pay };
    }

    it('is off without keys', async () => {
        const { t, owner, pay } = await paidOwnerSite();
        expect(await owner.action(api.xendit.createCheckout, { token: pay.token })).toEqual({ enabled: false });
        const res = await t.fetch('/xendit-webhook', { method: 'POST', body: '{}', headers: { 'x-callback-token': 'x' } });
        expect(res.status).toBe(503);
    });

    it('creates a checkout with the reference as external_id', async () => {
        const { owner, pay } = await paidOwnerSite();
        process.env.XENDIT_SECRET_KEY = 'xnd_test_secret';
        process.env.XENDIT_CALLBACK_TOKEN = 'cb-token';
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            id: 'inv_1', invoice_url: 'https://checkout.xendit.co/web/inv_1', status: 'PENDING', expiry_date: '2030-01-01T00:00:00.000Z',
        }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const out = await owner.action(api.xendit.createCheckout, { token: pay.token, successRedirectUrl: 'tendso://paid' });
        expect(out).toMatchObject({ enabled: true, checkoutUrl: 'https://checkout.xendit.co/web/inv_1', amount: 4999 });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.xendit.co/v2/invoices');
        expect(init.headers.Authorization).toBe(`Basic ${btoa('xnd_test_secret:')}`);
        expect(JSON.parse(init.body)).toMatchObject({
            external_id: pay.referenceCode, amount: 4999, currency: 'PHP', payer_email: 'ben@example.com', success_redirect_url: 'tendso://paid',
        });
        // Reused while still open.
        await owner.action(api.xendit.createCheckout, { token: pay.token });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('verifies x-callback-token, settles once, and publishes the paid owner site', async () => {
        const { t, owner, id, pay } = await paidOwnerSite();
        process.env.XENDIT_SECRET_KEY = 'xnd_test_secret';
        process.env.XENDIT_CALLBACK_TOKEN = 'cb-token';
        const body = JSON.stringify({ id: 'inv_1', external_id: pay.referenceCode, status: 'PAID', amount: 4999, paid_amount: 4999, payment_method: 'EWALLET', payment_channel: 'GCASH' });

        const bad = await t.fetch('/xendit-webhook', { method: 'POST', body, headers: { 'x-callback-token': 'wrong' } });
        expect(bad.status).toBe(401);
        const none = await t.fetch('/xendit-webhook', { method: 'POST', body });
        expect(none.status).toBe(401);
        expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe('submitted');

        const ok = await t.fetch('/xendit-webhook', { method: 'POST', body, headers: { 'x-callback-token': 'cb-token' } });
        expect(ok.status).toBe(200);
        expect(await ok.json()).toMatchObject({ status: 'ok', result: 'applied' });
        const again = await t.fetch('/xendit-webhook', { method: 'POST', body, headers: { 'x-callback-token': 'cb-token' } });
        expect(await again.json()).toMatchObject({ result: 'duplicate' });

        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ status: 'completed', amountPaid: 4999, balanceDue: 0 });
        const token = await t.run((ctx) => ctx.db.query('paymentTokens').withIndex('by_token', (q) => q.eq('token', pay.token)).first());
        expect(token).toMatchObject({ status: 'paid', provider: 'xendit', externalPaymentId: 'inv_1', paidAmount: 4999 });
        expect(await scheduledNames(t)).toContain('ownerApp:publishIfReady');

        // The scheduled publish (run directly here).
        const published = await t.mutation(internal.ownerApp.publishIfReady, { submissionId: id });
        expect(published).toMatchObject({ published: true, url: 'https://forge-barbers.sites.tendso.com' });
        expect((await owner.query(api.ownerApp.getBuild, { submissionId: id })).phase).toBe('live');
        expect(await t.mutation(internal.ownerApp.publishIfReady, { submissionId: id })).toMatchObject({ published: false, reason: 'already live' });
    });

    it('logs a short payment instead of settling it', async () => {
        const { t, id, pay } = await paidOwnerSite();
        process.env.XENDIT_SECRET_KEY = 'k';
        process.env.XENDIT_CALLBACK_TOKEN = 'cb';
        const body = JSON.stringify({ id: 'inv_2', external_id: pay.referenceCode, status: 'PAID', amount: 4999, paid_amount: 100 });
        const res = await t.fetch('/xendit-webhook', { method: 'POST', body, headers: { 'x-callback-token': 'cb' } });
        expect(await res.json()).toMatchObject({ result: 'rejected' });
        expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe('submitted');
        const logs = await t.run((ctx) => ctx.db.query('auditLogs').collect());
        expect(logs.some((l) => l.action === 'payment_unmatched')).toBe(true);
    });
});

describe('publish rules per source', () => {
    it('owner app: private preview, admin cannot publish before payment, pay needs "Looks good"', async () => {
        const { t, owner, admin } = await setup();
        const id = await ownerSubmission(t, owner);
        await buildSite(t, id);
        await expect(owner.mutation(api.ownerPayments.createPayToken, { submissionId: id, kind: 'full' })).rejects.toThrow('Looks good');
        await expect(admin.mutation(api.generatedWebsites.publish, { submissionId: id, publishedUrl: 'https://x.sites.tendso.com' }))
            .rejects.toThrow('after they pay');
        expect(await t.mutation(internal.ownerApp.publishIfReady, { submissionId: id })).toMatchObject({ published: false, reason: 'unpaid' });

        await owner.mutation(api.ownerApp.approvePreview, { submissionId: id });
        expect((await owner.query(api.ownerApp.getBuild, { submissionId: id })).phase).toBe('awaiting_payment');
        const dep = await owner.mutation(api.ownerPayments.createPayToken, { submissionId: id, kind: 'deposit', amount: 500 });
        await t.mutation(internal.ownerPayments.applyTokenPayment, { token: dep.token, provider: 'manual', triggeredBy: 'admin:admin' });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ status: 'deposit_paid', balanceDue: 4499 });
        // A down payment publishes an owner-app site.
        expect(await t.mutation(internal.ownerApp.publishIfReady, { submissionId: id })).toMatchObject({ published: true });
        const site = await t.run((ctx) => ctx.db.query('generatedWebsites').first());
        expect(site).toMatchObject({ status: 'published', slug: 'forge-barbers' });
        expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe('deposit_paid');
    });

    it('field-agent sale: payment never publishes or unpublishes, and the owner can still ask for changes', async () => {
        const { t, agentId, owner, admin } = await setup();
        const saleId = await agentSale(t, agentId);
        await t.run((ctx) => ctx.db.insert('generatedWebsites', {
            submissionId: saleId, status: 'published', slug: 'forge', publishedUrl: 'https://forge.sites.tendso.com', htmlContent: '<html></html>',
        }));
        // Admin can publish a field-agent site before payment (today's flow).
        await admin.mutation(api.generatedWebsites.publish, { submissionId: saleId, publishedUrl: 'https://forge.sites.tendso.com' });
        await t.mutation(internal.payments.creditCreatorForPayment, { submissionId: saleId, triggeredBy: 'admin:admin' });
        expect(await t.mutation(internal.ownerApp.publishIfReady, { submissionId: saleId }))
            .toMatchObject({ published: false, reason: 'publish_first source' });
        expect(await scheduledNames(t)).toContain('owners:inviteForSubmission');
        expect(await scheduledNames(t)).not.toContain('ownerApp:publishIfReady');

        await t.mutation(internal.owners.inviteForSubmission, { submissionId: saleId });
        await owner.mutation(api.owners.ensure, {});
        expect((await owner.query(api.owners.me, {}))?.sites[0]).toMatchObject({ phase: 'live', paidInFull: true });
        const crId = await owner.mutation(api.ownerApp.requestChange, { submissionId: saleId, text: 'Change the phone number' });
        const rows = await admin.query(api.changeRequests.listForSubmission, { submissionId: saleId });
        expect(rows).toEqual([expect.objectContaining({ _id: crId, status: 'open', text: 'Change the phone number' })]);
        await admin.mutation(api.changeRequests.setStatus, { id: crId, status: 'done' });
        expect((await t.run((ctx) => ctx.db.get(crId)))).toMatchObject({ status: 'done', resolvedBy: 'admin' });
        await expect(owner.query(api.changeRequests.listForSubmission, { submissionId: saleId })).rejects.toThrow('admin');
    });

    it('an owner-app change request before paying sends the owner back to check again', async () => {
        const { t, owner } = await setup();
        const id = await ownerSubmission(t, owner);
        await buildSite(t, id);
        await owner.mutation(api.ownerApp.approvePreview, { submissionId: id });
        await owner.mutation(api.ownerApp.requestChange, { submissionId: id, text: 'Use the blue photo' });
        expect((await owner.query(api.ownerApp.getBuild, { submissionId: id })).phase).toBe('changes_requested');
        expect((await t.run((ctx) => ctx.db.get(id)))?.ownerApprovedAt).toBeUndefined();
    });
});
