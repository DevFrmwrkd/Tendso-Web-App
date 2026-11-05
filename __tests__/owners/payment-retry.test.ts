import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './ownerPayments.ts': () => import('../../convex/ownerPayments'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
    './xendit.ts': () => import('../../convex/xendit'),
    './payments.ts': () => import('../../convex/payments'),
};
const NOW = Date.UTC(2026, 10, 3, 15);
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    vi.stubEnv('XENDIT_SECRET_KEY', 'mock-xendit-key'); vi.stubEnv('XENDIT_CALLBACK_TOKEN', 'mock-callback');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
};
const invoice = () => new Response(JSON.stringify({ id: 'invoice-new', invoice_url: 'https://checkout.xendit.co/new',
    status: 'PENDING', expiry_date: new Date(NOW + 86400000).toISOString() }), { status: 200 });

async function setup(submissionFields: Partial<Doc<'submissions'>> = {}, tokenFields: Partial<Doc<'paymentTokens'>> = {}, linked = true) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active', balance: 0, totalEarnings: 0 });
        const ownerId = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', createdAt: NOW });
        const submissionId = await ctx.db.insert('submissions', { creatorId, businessName: 'Retry Shop', businessType: 'Other',
            ownerName: 'Owner', ownerPhone: '09171234567', ownerEmail: 'owner@example.test', address: '1 Main St', city: 'Marikina',
            status: 'website_generated', publishPolicy: 'pay_then_publish', ownerApprovedAt: NOW - 1000, amount: 4999,
            creatorPayout: 2500, submissionType: 'standard', ...submissionFields });
        if (linked) await ctx.db.insert('websiteOwnerships', { businessOwnerId: ownerId, submissionId, role: 'owner', claimedAt: NOW });
        const tokenId = await ctx.db.insert('paymentTokens', { submissionId, token: 'expired-request', referenceCode: 'ND-AAAA-BBBB', amount: 4999,
            kind: 'full', status: 'pending', createdAt: NOW - 86400000, expiresAt: NOW - 1, ...tokenFields });
        return { creatorId, ownerId, submissionId, tokenId };
    });
    const owner = t.withIdentity({ subject: 'owner', email: 'owner@example.test', emailVerified: true });
    const tokens = () => t.run(ctx => ctx.db.query('paymentTokens').collect());
    const retry = (fields = {}) => owner.mutation(api.ownerPayments.retryExpiredPayment, { token: 'expired-request', expectedSubmissionId: ids.submissionId, expectedTotal: 4999, ...fields });
    return { t, owner, ...ids, tokens, retry };
}

describe('authenticated expired-payment retries', () => {
    it('creates a fresh request once and retains the expired reference for a late receipt', async () => {
        const { t, retry, tokenId, tokens } = await setup();
        const [first, second] = await Promise.all([retry(), retry()]);
        expect(first).toMatchObject({ status: 'ready', kind: 'full', amount: 4999, expiresAt: NOW + 30 * 86400000 });
        expect(second).toEqual(first);
        expect(first.status === 'ready' && first.token).not.toBe('expired-request');
        expect(await tokens()).toHaveLength(2);
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ status: 'expired', referenceCode: 'ND-AAAA-BBBB' });
        expect(await t.query(internal.paymentTokens.getByReferenceInternal, { referenceCode: 'ND-AAAA-BBBB' })).toMatchObject({ _id: tokenId });
    });

    it.each(['anonymous', 'foreign', 'unverified', 'email-mismatch'])('does not grant access or renew for %s callers', async scenario => {
        const { t, submissionId, tokens } = await setup({}, {}, false);
        const caller = scenario === 'anonymous' ? t : t.withIdentity({ subject: scenario === 'foreign' ? 'foreign' : 'owner',
            email: scenario === 'email-mismatch' ? 'wrong@example.test' : 'owner@example.test', emailVerified: scenario !== 'unverified' });
        expect(await caller.query(api.ownerPayments.getPaymentAttempt, { token: 'expired-request' })).toBeNull();
        await expect(caller.mutation(api.ownerPayments.retryExpiredPayment, { token: 'expired-request', expectedSubmissionId: submissionId })).rejects.toThrow();
        expect(await tokens()).toHaveLength(1);
        expect(await t.run(ctx => ctx.db.query('websiteOwnerships').collect())).toHaveLength(0);
    });

    it('repairs only the matching verified owner’s missing legacy link without changing roles or identity', async () => {
        const { t, retry, owner, ownerId, submissionId } = await setup({}, {}, false);
        expect(await owner.query(api.ownerPayments.getPaymentAttempt, { token: 'expired-request', expectedSubmissionId: submissionId })).toMatchObject({ status: 'expired' });
        expect((await retry()).status).toBe('ready');
        expect(await t.run(ctx => ctx.db.query('websiteOwnerships').collect())).toEqual([expect.objectContaining({ businessOwnerId: ownerId, submissionId, role: 'owner' })]);
        expect((await t.run(ctx => ctx.db.get(ownerId)))?.clerkId).toBe('owner');
        expect(await t.run(ctx => ctx.db.query('creators').collect())).toHaveLength(1);
    });

    it('rejects stale business and price expectations and returns null for unknown or mismatched attempt routes', async () => {
        const { t, owner, retry, creatorId, tokens } = await setup();
        expect(await owner.query(api.ownerPayments.getPaymentAttempt, { token: 'unknown' })).toBeNull();
        const other = await t.run(ctx => ctx.db.insert('submissions', { creatorId, businessName: 'Other', businessType: 'Other', ownerName: 'Owner', ownerPhone: '', address: '', city: '', status: 'draft' }));
        expect(await owner.query(api.ownerPayments.getPaymentAttempt, { token: 'expired-request', expectedSubmissionId: other })).toBeNull();
        await expect(retry({ expectedSubmissionId: other })).rejects.toThrow('business changed');
        await expect(retry({ expectedTotal: 1000 })).rejects.toThrow('price has changed');
        expect(await tokens()).toHaveLength(1);
    });

    it.each(['cancelled', 'approval', 'paid'])('does not create another charge for %s state', async mode => {
        const fields = mode === 'paid' ? { paidInFullAt: NOW, amountPaid: 4999, status: 'completed' } : mode === 'approval' ? { ownerApprovedAt: undefined } : {};
        const { retry, tokens } = await setup(fields, mode === 'cancelled' ? { status: 'cancelled' } : {});
        if (mode === 'cancelled') await expect(retry()).rejects.toThrow('cancelled');
        else expect(await retry()).toMatchObject({ status: mode === 'paid' ? 'paid' : 'needs_approval' });
        expect(await tokens()).toHaveLength(1);
    });

    it('reuses the latest compatible unexpired provider invoice rather than creating another request', async () => {
        const { t, retry, submissionId, tokens } = await setup();
        await t.run(ctx => ctx.db.insert('paymentTokens', { submissionId, token: 'current', referenceCode: 'ND-CCCC-DDDD', amount: 4999, kind: 'full',
            status: 'pending', createdAt: NOW, expiresAt: NOW + 10000, xenditInvoiceId: 'current-invoice', xenditInvoiceUrl: 'https://checkout.xendit.co/current', xenditExpiresAt: NOW + 5000 }));
        expect(await retry()).toMatchObject({ status: 'ready', token: 'current' });
        expect(await tokens()).toHaveLength(2);
    });

    it.each(['active-incompatible-invoice', 'uncertain-provider-request'])('does not create a duplicate charge during %s', async mode => {
        const { retry, tokens } = await setup({}, mode === 'active-incompatible-invoice'
            ? { xenditInvoiceId: 'old-active', xenditInvoiceUrl: 'https://checkout.xendit.co/old', xenditExpiresAt: NOW + 10000 }
            : { xenditCheckoutAttempt: 'attempt', xenditCheckoutState: 'uncertain', xenditCheckoutStartedAt: NOW - 30000 });
        expect(await retry()).toMatchObject({ status: 'processing' });
        expect(await tokens()).toHaveLength(1);
    });

    it('uses the current remaining balance after a down payment rather than charging the original full price again', async () => {
        const { retry } = await setup({ status: 'deposit_paid', depositPaidAt: NOW - 1000, amountPaid: 500 });
        expect(await retry()).toMatchObject({ status: 'ready', kind: 'balance', amount: 4499 });
    });

    it('treats an already-paid deposit as a receipt and only reuses an explicitly existing balance request', async () => {
        const { t, retry, tokens, submissionId } = await setup({ status: 'deposit_paid', depositPaidAt: NOW - 1000, amountPaid: 500 }, { status: 'paid', kind: 'deposit', amount: 500 });
        expect(await retry()).toMatchObject({ status: 'paid' });
        expect(await tokens()).toHaveLength(1);
        await t.run(ctx => ctx.db.insert('paymentTokens', { submissionId, token: 'balance', referenceCode: 'ND-CCCC-DDDD', amount: 4499, kind: 'balance', status: 'pending', createdAt: NOW, expiresAt: NOW + 1000 }));
        expect(await retry()).toMatchObject({ status: 'ready', token: 'balance', kind: 'balance', amount: 4499 });
    });

    it('revalidates an old deposit instead of silently increasing the amount', async () => {
        const { retry, tokens } = await setup({}, { kind: 'deposit', amount: 100 });
        await expect(retry()).rejects.toThrow('smallest down payment');
        expect(await tokens()).toHaveLength(1);
    });

    it.each(['token', 'invoice'])('cannot open an expired %s directly in Xendit', async expired => {
        const { owner } = await setup({}, expired === 'invoice' ? { expiresAt: NOW + 10000, xenditInvoiceId: 'old', xenditInvoiceUrl: 'https://checkout.xendit.co/expired', xenditExpiresAt: NOW - 1 } : {});
        const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
        await expect(owner.action(api.xendit.createCheckout, { token: 'expired-request' })).rejects.toThrow('expired');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('expires the request on provider EXPIRED while preserving invoice identity and accepting a later paid callback', async () => {
        const { t, tokenId, creatorId } = await setup({}, { expiresAt: NOW + 10000, xenditInvoiceId: 'old', xenditInvoiceUrl: 'https://checkout.xendit.co/old', xenditExpiresAt: NOW + 10000 });
        await t.mutation(internal.xendit.handleInvoiceCallback, { invoiceId: 'old', externalId: 'ND-AAAA-BBBB', status: 'EXPIRED' });
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ status: 'expired', xenditInvoiceId: 'old' });
        expect(await t.mutation(internal.xendit.handleInvoiceCallback, { invoiceId: 'old', externalId: 'ND-AAAA-BBBB', status: 'PAID', paidAmount: 4999 })).toMatchObject({ result: 'applied' });
        expect((await t.run(ctx => ctx.db.get(creatorId)))?.balance).toBe(2500);
    });

    it('resolves a known provider expiration even when the old request was already expired locally', async () => {
        const { t, retry } = await setup({}, { status: 'expired', xenditInvoiceId: 'old', xenditInvoiceUrl: 'https://checkout.xendit.co/old', xenditExpiresAt: NOW + 10000 });
        expect(await retry()).toMatchObject({ status: 'processing' });
        await t.mutation(internal.xendit.handleInvoiceCallback, { invoiceId: 'old', externalId: 'ND-AAAA-BBBB', status: 'EXPIRED' });
        expect(await retry()).toMatchObject({ status: 'ready' });
    });

    it.each(['old-first', 'new-first'])('accounts for late expired receipts without duplicate creator credit (%s)', async order => {
        const { t, retry, creatorId, tokenId } = await setup();
        const current = await retry();
        if (current.status !== 'ready') throw new Error('Expected a retry request');
        if (order === 'new-first') await t.mutation(internal.ownerPayments.applyTokenPayment, { token: current.token, provider: 'manual', triggeredBy: 'test', amountReceived: 4999 });
        expect(await t.mutation(internal.ownerPayments.applyTokenPayment, { token: 'expired-request', provider: 'wise', externalId: 'late-transfer', triggeredBy: 'test', amountReceived: 4999 })).toMatchObject({ result: 'applied' });
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ status: 'paid', wiseTransactionId: 'late-transfer', paidAmount: 4999 });
        expect((await t.run(ctx => ctx.db.get(creatorId)))?.balance).toBe(2500);
        expect(await t.mutation(internal.ownerPayments.applyTokenPayment, { token: 'expired-request', provider: 'wise', externalId: 'late-transfer', triggeredBy: 'test', amountReceived: 4999 })).toMatchObject({ result: 'duplicate' });
    });
});

describe('Xendit checkout request lifecycle', () => {
    it('claims the whole order when full and deposit requests both exist before either provider call', async () => {
        const { owner, submissionId, t } = await setup({}, { expiresAt: NOW + 86400000 });
        const deposit = await owner.mutation(api.ownerPayments.createPayToken, { submissionId, kind: 'deposit', amount: 500 });
        const started = deferred<void>(), response = deferred<Response>();
        const fetch = vi.fn().mockImplementation(() => { started.resolve(); return response.promise; });
        vi.stubGlobal('fetch', fetch);
        const full = owner.action(api.xendit.createCheckout, { token: 'expired-request' });
        await started.promise;
        await expect(owner.action(api.xendit.createCheckout, { token: deposit.token })).rejects.toThrow('earlier checkout');
        expect(fetch).toHaveBeenCalledTimes(1);
        response.resolve(invoice());
        expect(await full).toMatchObject({ enabled: true, amount: 4999 });
        // The same second request stays blocked after the first invoice is open.
        await expect(owner.action(api.xendit.createCheckout, { token: deposit.token })).rejects.toThrow('earlier checkout');
        expect(fetch).toHaveBeenCalledTimes(1);
        const row = await t.run(ctx => ctx.db.query('paymentTokens').withIndex('by_token', q => q.eq('token', deposit.token)).first());
        expect(row?.xenditCheckoutAttempt).toBeUndefined();
    });

    it('claims the request across concurrent calls and keeps retry in processing while the provider is pending', async () => {
        const { owner, retry, t, tokenId } = await setup({}, { expiresAt: NOW + 86400000 });
        const started = deferred<void>(), response = deferred<Response>();
        const fetch = vi.fn().mockImplementation(() => { started.resolve(); return response.promise; });
        vi.stubGlobal('fetch', fetch);
        const first = owner.action(api.xendit.createCheckout, { token: 'expired-request' });
        await started.promise;
        await expect(owner.action(api.xendit.createCheckout, { token: 'expired-request' })).rejects.toThrow('earlier checkout');
        expect(await retry()).toMatchObject({ status: 'processing' });
        response.resolve(invoice());
        expect(await first).toMatchObject({ enabled: true, invoiceId: 'invoice-new' });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
        expect(await t.mutation(internal.ownerPayments.recordXenditInvoice, { token: 'expired-request', attemptId: 'wrong-claim', invoiceId: 'wrong', invoiceUrl: 'https://checkout.xendit.co/wrong' })).toEqual({ recorded: false });
        expect((await t.run(ctx => ctx.db.get(tokenId)))?.xenditInvoiceId).toBe('invoice-new');
    });

    it.each(['network', 'conflict', 'server-error', 'unparseable-success'])('preserves an uncertain provider attempt after %s instead of issuing another invoice', async failure => {
        const { owner, retry, t, tokenId } = await setup({}, { expiresAt: NOW + 86400000 });
        const fetch = failure === 'network' ? vi.fn().mockRejectedValue(new Error('Request timed out'))
            : vi.fn().mockResolvedValue(new Response(failure === 'unparseable-success' ? 'not json' : '{}', {
                status: failure === 'conflict' ? 409 : failure === 'server-error' ? 500 : 200,
            }));
        vi.stubGlobal('fetch', fetch);
        await expect(owner.action(api.xendit.createCheckout, { token: 'expired-request' })).rejects.toThrow('not working');
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ xenditCheckoutState: 'uncertain' });
        expect(await retry()).toMatchObject({ status: 'processing' });
        await expect(owner.action(api.xendit.createCheckout, { token: 'expired-request' })).rejects.toThrow('earlier checkout');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it.each([401, 403])('releases a definitive %s authentication rejection so corrected credentials can retry', async status => {
        const { owner, retry, t, tokenId } = await setup({}, { expiresAt: NOW + 86400000 });
        const fetch = vi.fn().mockResolvedValueOnce(new Response('{"error_code":"AUTHENTICATION_ERROR"}', { status }))
            .mockResolvedValueOnce(invoice());
        vi.stubGlobal('fetch', fetch);
        await expect(owner.action(api.xendit.createCheckout, { token: 'expired-request' })).rejects.toThrow('not working');
        const rejected = await t.run(ctx => ctx.db.get(tokenId));
        expect(rejected?.xenditCheckoutState).toBeUndefined();
        expect(rejected?.xenditInvoiceId).toBeUndefined();
        expect(rejected?.xenditCheckoutAttempt).toEqual(expect.any(String));
        expect(await retry()).toMatchObject({ status: 'ready', token: 'expired-request' });
        vi.stubEnv('XENDIT_SECRET_KEY', 'corrected-mock-key');
        expect(await owner.action(api.xendit.createCheckout, { token: 'expired-request' })).toMatchObject({ enabled: true, invoiceId: 'invoice-new' });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[1][1].headers.Authorization).not.toBe(fetch.mock.calls[0][1].headers.Authorization);
        expect((await t.run(ctx => ctx.db.get(tokenId)))?.xenditCheckoutState).toBeUndefined();
    });

    it('does not let an old auth failure release a newer claim or an uncertain provider attempt', async () => {
        const { t, owner, tokenId } = await setup({}, { expiresAt: NOW + 86400000 });
        await owner.mutation(internal.ownerPayments.beginXenditCheckout, { token: 'expired-request', attemptId: 'newer' });
        await t.mutation(internal.ownerPayments.releaseXenditAuthFailure, { token: 'expired-request', attemptId: 'older' });
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ xenditCheckoutAttempt: 'newer', xenditCheckoutState: 'creating' });
        await t.mutation(internal.ownerPayments.markXenditCheckoutUncertain, { token: 'expired-request', attemptId: 'newer' });
        await t.mutation(internal.ownerPayments.releaseXenditAuthFailure, { token: 'expired-request', attemptId: 'newer' });
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ xenditCheckoutState: 'uncertain' });
    });

    it('reconciles a timed-out creation from its authenticated EXPIRED callback before allowing a fresh checkout', async () => {
        const { t, owner, retry, tokenId } = await setup({}, { expiresAt: NOW + 86400000 });
        const fetch = vi.fn().mockRejectedValueOnce(new Error('Response lost after provider created invoice')).mockResolvedValueOnce(invoice());
        vi.stubGlobal('fetch', fetch);
        await expect(owner.action(api.xendit.createCheckout, { token: 'expired-request' })).rejects.toThrow('not working');
        expect(await retry()).toMatchObject({ status: 'processing' });
        await t.mutation(internal.xendit.handleInvoiceCallback, { invoiceId: 'lost-response-invoice', externalId: 'ND-AAAA-BBBB', status: 'EXPIRED' });
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ status: 'expired', xenditInvoiceId: 'lost-response-invoice', xenditExpiresAt: NOW });
        expect((await t.run(ctx => ctx.db.get(tokenId)))?.xenditCheckoutState).toBeUndefined();
        const renewed = await retry();
        if (renewed.status !== 'ready') throw new Error('Expected reconciled retry');
        expect(renewed.token).not.toBe('expired-request');
        expect(await owner.action(api.xendit.createCheckout, { token: renewed.token })).toMatchObject({ enabled: true });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('cannot reconcile an expiration for a different known invoice ID', async () => {
        const { t, retry, tokenId } = await setup({}, { expiresAt: NOW + 86400000, xenditInvoiceId: 'known',
            xenditInvoiceUrl: 'https://checkout.xendit.co/known', xenditExpiresAt: NOW + 10000, xenditCheckoutState: 'uncertain', xenditCheckoutAttempt: 'known-attempt' });
        await t.mutation(internal.xendit.handleInvoiceCallback, { invoiceId: 'unrelated', externalId: 'ND-AAAA-BBBB', status: 'EXPIRED' });
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ status: 'pending', xenditInvoiceId: 'known', xenditExpiresAt: NOW + 10000, xenditCheckoutState: 'uncertain' });
        expect(await retry()).toMatchObject({ status: 'processing' });
    });

    it('does not resolve an unknown invoice from an ambiguous reference', async () => {
        const { t, tokenId, submissionId } = await setup({}, { xenditCheckoutState: 'uncertain', xenditCheckoutAttempt: 'unknown-invoice' });
        await t.run(ctx => ctx.db.insert('paymentTokens', { submissionId, token: 'duplicate-reference', referenceCode: 'ND-AAAA-BBBB',
            amount: 4999, kind: 'full', status: 'pending', createdAt: NOW, expiresAt: NOW + 10000 }));
        await t.mutation(internal.xendit.handleInvoiceCallback, { invoiceId: 'unknown', externalId: 'ND-AAAA-BBBB', status: 'EXPIRED' });
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ status: 'pending', xenditCheckoutState: 'uncertain' });
        expect((await t.run(ctx => ctx.db.get(tokenId)))?.xenditInvoiceId).toBeUndefined();
    });

    it('does not revive an expired creation when its delayed provider response arrives afterward', async () => {
        const { t, owner, retry, tokenId } = await setup({}, { expiresAt: NOW + 86400000 });
        const started = deferred<void>(), response = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => { started.resolve(); return response.promise; }));
        const action = owner.action(api.xendit.createCheckout, { token: 'expired-request' });
        await started.promise;
        await t.mutation(internal.xendit.handleInvoiceCallback, { invoiceId: 'invoice-new', externalId: 'ND-AAAA-BBBB', status: 'EXPIRED' });
        response.resolve(invoice());
        await expect(action).rejects.toThrow('details changed');
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ status: 'expired', xenditInvoiceId: 'invoice-new', xenditExpiresAt: NOW });
        expect(await retry()).toMatchObject({ status: 'ready' });
    });

    it('does not return a provider URL if the order settles while checkout creation is in flight', async () => {
        const { t, owner, submissionId, tokenId } = await setup({}, { expiresAt: NOW + 86400000 });
        const started = deferred<void>(), response = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => { started.resolve(); return response.promise; }));
        const action = owner.action(api.xendit.createCheckout, { token: 'expired-request' });
        await started.promise;
        await t.run(ctx => ctx.db.patch(submissionId, { status: 'completed', paidInFullAt: NOW, amountPaid: 4999 }));
        response.resolve(invoice());
        await expect(action).rejects.toThrow('details changed');
        expect(await t.run(ctx => ctx.db.get(tokenId))).toMatchObject({ xenditInvoiceId: 'invoice-new' });
    });
});
