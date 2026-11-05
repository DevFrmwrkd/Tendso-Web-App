import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { SimulatorAction } from '../../convex/paymentSimulator';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './paymentSimulator.ts': () => import('../../convex/paymentSimulator'),
};
const EMAIL = 'poru.fetaruvero@gmail.com';
const NOW = Date.UTC(2026, 10, 3, 17);
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    vi.stubEnv('PAYMENT_SIMULATOR_ENABLED', 'true'); vi.stubEnv('PAYMENT_SIMULATOR_ALLOWLIST', EMAIL);
    vi.stubEnv('CONVEX_CLOUD_URL', 'https://diligent-ibex-454.convex.cloud');
    vi.stubEnv('CONVEX_SITE_URL', 'https://diligent-ibex-454.convex.site');
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Simulator must not call a provider.'); }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator',
            status: 'active', balance: 123, totalEarnings: 456 });
        const ownerId = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: EMAIL, createdAt: NOW });
        const otherOwner = await ctx.db.insert('businessOwners', { clerkId: 'other', email: 'other@example.test', createdAt: NOW });
        const add = async (name: string, ownedBy = ownerId) => {
            const id = await ctx.db.insert('submissions', { creatorId, businessName: name, businessType: 'Other', ownerName: 'Owner',
                ownerPhone: '09171234567', ownerEmail: EMAIL, address: 'Test', city: 'Marikina', status: 'draft',
                amount: 4999, creatorPayout: 2500, submissionType: 'standard', publishPolicy: 'pay_then_publish' });
            await ctx.db.insert('websiteOwnerships', { businessOwnerId: ownedBy, submissionId: id, role: 'owner', claimedAt: NOW });
            return id;
        };
        const submissionId = await add('[TEST] Payment practice');
        const secondTest = await add('[TEST] Second business');
        const ordinary = await add('Actual business');
        const foreign = await add('[TEST] Foreign business', otherOwner);
        await ctx.db.insert('paymentTokens', { submissionId, token: 'real-token-untouched', referenceCode: 'ND-AAAA-BBBB',
            amount: 4999, kind: 'full', status: 'pending', createdAt: NOW, expiresAt: NOW + 86400000 });
        return { creatorId, ownerId, submissionId, secondTest, ordinary, foreign };
    });
    const owner = t.withIdentity({ subject: 'owner', email: EMAIL, emailVerified: true });
    let count = 0;
    const get = () => owner.query(api.paymentSimulator.get, { submissionId: ids.submissionId });
    const run = async (action: SimulatorAction, amount?: number, overrides = {}) => {
        const state = await get();
        return owner.mutation(api.paymentSimulator.run, { submissionId: ids.submissionId, action, amount,
            requestId: `request-${++count}`, expectedRevision: state?.revision ?? 0, expectedTotal: state?.total ?? 4999, ...overrides });
    };
    const realState = () => t.run(async ctx => ({
        submissions: await ctx.db.query('submissions').collect(), tokens: await ctx.db.query('paymentTokens').collect(),
        creators: await ctx.db.query('creators').collect(), withdrawals: await ctx.db.query('withdrawals').collect(),
        websites: await ctx.db.query('generatedWebsites').collect(), earnings: await ctx.db.query('earnings').collect(),
        owners: await ctx.db.query('businessOwners').collect(), ownerships: await ctx.db.query('websiteOwnerships').collect(),
        audit: await ctx.db.query('auditLogs').collect(), jobs: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
    return { t, owner, ...ids, get, run, realState };
}

describe('isolated development PHP payment practice', () => {
    it('projects a virtual initial state without creating any row', async () => {
        const { t, get, submissionId, ownerId } = await setup();
        expect(await get()).toMatchObject({ simulationOnly: true, withdrawable: false, actorClerkId: 'owner', ownerId, submissionId,
            sessionId: null, currency: 'PHP', total: 4999, amountPaid: 0, balanceDue: 4999, revision: 0,
            requestStatus: 'open', paymentStatus: 'unpaid', reviewStatus: 'none', canReset: true, events: [] });
        expect(await t.run(ctx => ctx.db.query('paymentSimulatorSessions').collect())).toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each(['disabled', 'no-allowlist', 'other-allowlist', 'production', 'wrong-site', 'missing-cloud'])('fails closed for %s deployment configuration even when the caller owns the test business', async scenario => {
        const { t, get, run } = await setup();
        if (scenario === 'disabled') vi.stubEnv('PAYMENT_SIMULATOR_ENABLED', 'false');
        if (scenario === 'no-allowlist') vi.stubEnv('PAYMENT_SIMULATOR_ALLOWLIST', '');
        if (scenario === 'other-allowlist') vi.stubEnv('PAYMENT_SIMULATOR_ALLOWLIST', 'other@example.test');
        if (scenario === 'production') {
            vi.stubEnv('CONVEX_CLOUD_URL', 'https://energetic-panther-693.convex.cloud');
            vi.stubEnv('CONVEX_SITE_URL', 'https://energetic-panther-693.convex.site');
        }
        if (scenario === 'wrong-site') vi.stubEnv('CONVEX_SITE_URL', 'https://energetic-panther-693.convex.site');
        if (scenario === 'missing-cloud') vi.stubEnv('CONVEX_CLOUD_URL', '');
        expect(await get()).toBeNull();
        await expect(run('full')).rejects.toThrow('unavailable');
        expect(await t.run(ctx => ctx.db.query('paymentSimulatorSessions').collect())).toEqual([]);
    });

    it.each(['anonymous', 'unverified', 'wrong-email', 'foreign', 'ordinary'])('denies %s access without writing any practice row', async scenario => {
        const { t, owner, submissionId, foreign, ordinary } = await setup();
        const caller = scenario === 'anonymous' ? t : scenario === 'unverified'
            ? t.withIdentity({ subject: 'owner', email: EMAIL, emailVerified: false }) : scenario === 'wrong-email'
                ? t.withIdentity({ subject: 'owner', email: 'wrong@example.test', emailVerified: true }) : owner;
        const selected = scenario === 'foreign' ? foreign : scenario === 'ordinary' ? ordinary : submissionId;
        expect(await caller.query(api.paymentSimulator.get, { submissionId: selected })).toBeNull();
        await expect(caller.mutation(api.paymentSimulator.run, { submissionId: selected, action: 'full', requestId: 'deny-request',
            expectedRevision: 0, expectedTotal: 4999 })).rejects.toThrow('unavailable');
        expect(await t.run(ctx => ctx.db.query('paymentSimulatorSessions').collect())).toEqual([]);
    });

    it('simulates full payment and explicit duplicate receipt without changing any real ledger, website or queued job', async () => {
        const { t, get, run, realState } = await setup();
        const before = await realState();
        const full = await run('full');
        expect(full).toMatchObject({ total: 4999, amountPaid: 4999, balanceDue: 0, revision: 1, paymentStatus: 'paid', requestStatus: 'paid' });
        expect(full.referenceCode).toMatch(/^SIM-/);
        expect(full.referenceCode).not.toMatch(/^ND-/);
        expect(full.events[0]).toMatchObject({ action: 'full', outcome: 'applied', amount: 4999 });
        const duplicate = await run('duplicate');
        expect(duplicate).toMatchObject({ amountPaid: 4999, balanceDue: 0, lastReceiptId: full.lastReceiptId });
        expect(duplicate.events[0]).toMatchObject({ action: 'duplicate', outcome: 'duplicate' });
        expect(await realState()).toEqual(before);
        expect(await t.run(ctx => ctx.db.query('paymentSimulatorSessions').collect())).toHaveLength(1);
        expect((await get())?.withdrawable).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('keeps deposits and balances separate, then resets only the simulated session', async () => {
        const { get, run, realState } = await setup();
        const before = await realState();
        const deposit = await run('deposit', 500);
        expect(deposit).toMatchObject({ amountPaid: 500, balanceDue: 4499, paymentStatus: 'deposit_paid', requestStatus: 'open' });
        await expect(run('full')).rejects.toThrow('balance instead');
        const balance = await run('balance');
        expect(balance).toMatchObject({ amountPaid: 4999, balanceDue: 0, paymentStatus: 'paid' });
        expect(balance.events[0]).toMatchObject({ amount: 4499, action: 'balance' });
        const reset = await run('reset');
        expect(reset).toMatchObject({ sessionId: deposit.sessionId, amountPaid: 0, balanceDue: 4999,
            paymentStatus: 'unpaid', requestStatus: 'open', lastReceiptId: null, pendingReview: null });
        expect(reset.referenceCode).not.toBe(deposit.referenceCode);
        expect(reset.revision).toBeGreaterThan(balance.revision);
        expect(await realState()).toEqual(before);
        expect((await get())?.simulationOnly).toBe(true);
    });

    it('requires simulated team verification for a missing reference and never silently settles from the amount', async () => {
        const { run, realState } = await setup();
        const before = await realState();
        const pending = await run('unmatched', 4999);
        expect(pending).toMatchObject({ amountPaid: 0, balanceDue: 4999, reviewStatus: 'needs_review',
            pendingReview: { amount: 4999, kind: 'full' } });
        await expect(run('full')).rejects.toThrow('pending simulated receipt');
        await expect(run('expire')).rejects.toThrow('no open practice request');
        const approved = await run('approve_review');
        expect(approved).toMatchObject({ amountPaid: 4999, reviewStatus: 'approved', pendingReview: null, paymentStatus: 'paid' });
        await expect(run('approve_review')).rejects.toThrow('no simulated receipt');
        expect(await realState()).toEqual(before);
    });

    it('can verify an unmatched deposit and later unmatched balance without double-crediting the deposit', async () => {
        const { run } = await setup();
        await run('unmatched', 700);
        expect(await run('approve_review')).toMatchObject({ amountPaid: 700, balanceDue: 4299, paymentStatus: 'deposit_paid' });
        await expect(run('unmatched', 4298)).rejects.toThrow('exact simulated remaining balance');
        expect(await run('unmatched', 4299)).toMatchObject({ amountPaid: 700, pendingReview: { kind: 'balance', amount: 4299 } });
        expect(await run('approve_review')).toMatchObject({ amountPaid: 4999, balanceDue: 0 });
    });

    it('expires and renews a fresh SIM request while preserving the simulated balance', async () => {
        const { run } = await setup();
        const deposit = await run('deposit', 500);
        const expired = await run('expire');
        expect(expired).toMatchObject({ requestStatus: 'expired', amountPaid: 500, balanceDue: 4499 });
        await expect(run('balance')).rejects.toThrow('Renew or reset');
        await expect(run('unmatched', 4499)).rejects.toThrow('Renew or reset');
        const fresh = await run('renew');
        expect(fresh).toMatchObject({ requestStatus: 'open', amountPaid: 500, balanceDue: 4499, attempt: deposit.attempt + 1 });
        expect(fresh.referenceCode).not.toBe(deposit.referenceCode);
        expect(await run('balance')).toMatchObject({ paymentStatus: 'paid' });
    });

    it('replays current-generation request IDs idempotently and rejects stale receipt retries after reset', async () => {
        const { owner, submissionId, run, get } = await setup();
        const args = { submissionId, action: 'deposit' as const, amount: 500, requestId: 'stable-request', expectedRevision: 0, expectedTotal: 4999 };
        const [first, second] = await Promise.all([owner.mutation(api.paymentSimulator.run, args), owner.mutation(api.paymentSimulator.run, args)]);
        expect(first.sessionId).toEqual(second.sessionId);
        expect((await get())?.amountPaid).toBe(500);
        expect((await get())?.events).toHaveLength(1);
        await expect(owner.mutation(api.paymentSimulator.run, { ...args, amount: 600 })).rejects.toThrow('already used');
        const reset = await run('reset');
        await expect(owner.mutation(api.paymentSimulator.run, args)).rejects.toThrow('Practice changed');
        expect((await get())?.amountPaid).toBe(0);
        expect((await get())?.events).toHaveLength(1);
        expect((await get())?.events[0].action).toBe('reset');
        expect(reset.revision).toBeGreaterThan(first.revision);
    });

    it('always permits reset at the bounded operation limit without letting old receipts affect the fresh generation', async () => {
        const { t, owner, submissionId, run } = await setup();
        const first = await run('deposit', 500, { requestId: 'first-generation' });
        await t.run(ctx => ctx.db.patch(first.sessionId!, { requests: Array.from({ length: 500 }, (_, index) => ({
            requestId: `used-request-${index}`, fingerprint: 'used',
        })) }));
        await expect(run('balance')).rejects.toThrow('Reset practice');
        const reset = await run('reset');
        expect(reset).toMatchObject({ canReset: true, amountPaid: 0, balanceDue: 4999, revision: first.revision + 1 });
        expect(reset.events).toHaveLength(1);
        expect((await t.run(ctx => ctx.db.get(first.sessionId!)))?.requests).toHaveLength(1);
        await expect(owner.mutation(api.paymentSimulator.run, { submissionId, action: 'deposit', amount: 500,
            requestId: 'first-generation', expectedRevision: 0, expectedTotal: 4999 })).rejects.toThrow('Practice changed');
        expect(await run('deposit', 700)).toMatchObject({ amountPaid: 700, balanceDue: 4299 });
    });

    it('rejects stale cross-device actions and price changes before first use or during an existing session', async () => {
        const { t, owner, submissionId, run, get } = await setup();
        const stale = { submissionId, action: 'full' as const, requestId: 'stale-request', expectedRevision: 0, expectedTotal: 4999 };
        await t.run(ctx => ctx.db.patch(submissionId, { amount: 3999, creatorPayout: 2000 }));
        await expect(owner.mutation(api.paymentSimulator.run, stale)).rejects.toThrow('price changed');
        await run('deposit', 500);
        await expect(owner.mutation(api.paymentSimulator.run, { ...stale, expectedTotal: 3999 })).rejects.toThrow('Practice changed');
        await t.run(ctx => ctx.db.patch(submissionId, { amount: 2999, creatorPayout: 1500 }));
        expect(await get()).toMatchObject({ priceChanged: true, total: 2999 });
        await expect(run('balance')).rejects.toThrow('Reset practice');
        expect(await run('reset')).toMatchObject({ priceChanged: false, total: 2999, amountPaid: 0, balanceDue: 2999 });
    });

    it('keeps each selected business in a different stable simulator session', async () => {
        const { owner, submissionId, secondTest, run } = await setup();
        const first = await run('deposit', 500);
        const second = await owner.mutation(api.paymentSimulator.run, { submissionId: secondTest, action: 'full', requestId: 'other-business',
            expectedRevision: 0, expectedTotal: 4999 });
        expect(first.sessionId).not.toBe(second.sessionId);
        expect(await owner.query(api.paymentSimulator.get, { submissionId })).toMatchObject({ amountPaid: 500, balanceDue: 4499 });
        expect(await owner.query(api.paymentSimulator.get, { submissionId: secondTest })).toMatchObject({ amountPaid: 4999, balanceDue: 0 });
    });

    it.each([0, -1, 499, 500.5, 4999, 5000, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid simulated deposit %s without creating a ledger row', async amount => {
        const { t, run } = await setup();
        await expect(run('deposit', amount)).rejects.toThrow();
        expect(await t.run(ctx => ctx.db.query('paymentSimulatorSessions').collect())).toEqual([]);
    });

    it('rechecks authorization after a session exists instead of allowing a cached or revoked actor to change it', async () => {
        const { t, ownerId, run, get, submissionId } = await setup();
        const state = await run('deposit', 500);
        await t.run(async ctx => {
            const links = await ctx.db.query('websiteOwnerships').withIndex('by_owner', q => q.eq('businessOwnerId', ownerId)).collect();
            for (const link of links) if (link.submissionId === submissionId) await ctx.db.delete(link._id);
        });
        expect(await get()).toBeNull();
        await expect(run('reset')).rejects.toThrow('unavailable');
        expect((await t.run(ctx => ctx.db.get(state.sessionId!)))?.amountPaid).toBe(500);
    });
});
