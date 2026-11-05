import { convexTest } from 'convex-test';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './http.ts': () => import('../../convex/http'),
    './payments.ts': () => import('../../convex/payments'),
};
const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;
let privateKey: CryptoKey;
let publicKey: string;
beforeAll(async () => {
    const keys = await crypto.subtle.generateKey({ ...algorithm, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['sign', 'verify']);
    privateKey = keys.privateKey;
    publicKey = Buffer.from(await crypto.subtle.exportKey('spki', keys.publicKey)).toString('base64');
});
beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('WISE_WEBHOOK_PUBLIC_KEY', publicKey);
    vi.stubEnv('WISE_PROFILE_ID', '456');
    vi.stubEnv('WISE_SANDBOX', 'false');
    vi.stubEnv('WISE_SANDBOX_PROFILE_ID', '');
    // Receiving money must be strict even while the separate payout route is
    // still observing signatures during its existing enforcement rollout.
    vi.stubEnv('WISE_WEBHOOK_ENFORCE', 'false');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

const payload = {
    event_type: 'account-details-payment#state-change',
    data: { resource: { id: 123, profile_id: 456, type: 'balance-account' },
        current_state: 'COMPLETED', transfer: { id: 789, amount: 4999, currency: 'PHP' },
        reference: 'Website ND-AAAA-BBBB', sender: { name: 'Sam Sender' } },
};
const body = JSON.stringify(payload);
const sign = async (raw: string) => Buffer.from(await crypto.subtle.sign(algorithm, privateKey, new TextEncoder().encode(raw))).toString('base64');
const jobs = (t: ReturnType<typeof convexTest>) => t.run(ctx => ctx.db.system.query('_scheduled_functions').collect());
async function send(t: ReturnType<typeof convexTest>, raw: string, signature?: string, headers: Record<string, string> = {}) {
    return t.fetch('/wise-deposit-webhook', { method: 'POST', body: raw,
        headers: { 'Content-Type': 'application/json', ...(signature ? { 'X-Signature-SHA256': signature } : {}), ...headers } });
}

describe('registered incoming Wise deposit webhook', () => {
    it('accepts the signed raw body and schedules exactly its parsed receipt', async () => {
        const t = convexTest(schema, modules);
        const response = await send(t, body, await sign(body));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ status: 'ok', transactionId: '789' });
        expect(await jobs(t)).toEqual([expect.objectContaining({ name: 'payments:processDeposit', args: [{
            referenceText: 'Website ND-AAAA-BBBB', amount: 4999, currency: 'PHP', transactionId: '789', senderName: 'Sam Sender',
        }] })]);
    });

    it.each(['missing', 'invalid', 'tampered'])('rejects a %s signature before scheduling a receipt', async kind => {
        const t = convexTest(schema, modules);
        const signature = kind === 'missing' ? undefined : kind === 'invalid' ? 'not-a-valid-signature' : await sign(body);
        const response = await send(t, kind === 'tampered' ? body.replace('4999', '9999') : body, signature);
        expect(response.status).toBe(401);
        expect(await jobs(t)).toEqual([]);
    });

    it('does not parse even malformed JSON when its signature is missing', async () => {
        const t = convexTest(schema, modules);
        expect((await send(t, '{invalid')).status).toBe(401);
        expect(await jobs(t)).toEqual([]);
    });

    it.each(['', '   ', '-----BEGIN PUBLIC KEY-----'])('disables incoming receipts when the configured key is unusable (%j)', async key => {
        const t = convexTest(schema, modules);
        vi.stubEnv('WISE_WEBHOOK_PUBLIC_KEY', key);
        expect((await send(t, body, await sign(body))).status).toBe(503);
        expect(await jobs(t)).toEqual([]);
    });

    it('verifies whitespace and non-ASCII bytes without reserializing the signed body', async () => {
        const t = convexTest(schema, modules);
        const raw = `  \n${JSON.stringify({ ...payload, data: { ...payload.data, sender: { name: 'José ₱' } } }, null, 2)}\n`;
        expect((await send(t, raw, await sign(raw))).status).toBe(200);
        expect((await jobs(t))[0].args).toEqual([expect.objectContaining({ senderName: 'José ₱' })]);
        const changed = convexTest(schema, modules);
        expect((await send(changed, JSON.stringify(JSON.parse(raw)), await sign(raw))).status).toBe(401);
        expect(await jobs(changed)).toEqual([]);
    });

    it('rejects signed malformed JSON without scheduling it', async () => {
        const t = convexTest(schema, modules);
        const raw = '{"event_type":';
        expect((await send(t, raw, await sign(raw))).status).toBe(400);
        expect(await jobs(t)).toEqual([]);
    });

    it('acknowledges signed Wise test notifications without scheduling settlement', async () => {
        const t = convexTest(schema, modules);
        vi.stubEnv('WISE_PROFILE_ID', '');
        const response = await send(t, body, await sign(body), { 'X-Test-Notification': 'true' });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ status: 'ignored' });
        expect(await jobs(t)).toEqual([]);
    });

    it.each([undefined, 999, '999'])('rejects a signed receipt with missing or different receiving profile %j', async profileId => {
        const t = convexTest(schema, modules);
        const raw = JSON.stringify({ ...payload, data: { ...payload.data, resource: { ...payload.data.resource, profile_id: profileId } } });
        expect((await send(t, raw, await sign(raw))).status).toBe(403);
        expect(await jobs(t)).toEqual([]);
    });

    it.each(['', 'not-an-id', '0', '9007199254740992'])('disables receipts with an invalid receiving profile configuration %j', async profileId => {
        const t = convexTest(schema, modules);
        vi.stubEnv('WISE_PROFILE_ID', profileId);
        expect((await send(t, body, await sign(body))).status).toBe(503);
        expect(await jobs(t)).toEqual([]);
    });

    it('uses the sandbox receiving profile without falling back to the live profile', async () => {
        vi.stubEnv('WISE_SANDBOX', 'true');
        const missing = convexTest(schema, modules);
        expect((await send(missing, body, await sign(body))).status).toBe(503);
        expect(await jobs(missing)).toEqual([]);

        vi.stubEnv('WISE_SANDBOX_PROFILE_ID', '999');
        const live = convexTest(schema, modules);
        expect((await send(live, body, await sign(body))).status).toBe(403);
        expect(await jobs(live)).toEqual([]);

        const sandbox = convexTest(schema, modules);
        const raw = JSON.stringify({ ...payload, data: { ...payload.data, resource: { ...payload.data.resource, profile_id: 999 } } });
        expect((await send(sandbox, raw, await sign(raw))).status).toBe(200);
        expect(await jobs(sandbox)).toHaveLength(1);
    });

    it.each(['balances#credit', 'balances#update', 'swift-in#credit'])('checks the existing %s profile field before scheduling', async eventType => {
        const t = convexTest(schema, modules);
        const data = eventType === 'swift-in#credit'
            ? { action: { id: 789, profile_id: 456 }, resource: { id: 'swift-receipt', reference: 'ND-AAAA-BBBB',
                settled_amount: { value: 4999, currency: 'PHP' } } }
            : { resource: { id: 123, profile_id: '456' }, transaction_type: 'credit', amount: 4999, currency: 'PHP',
                step_id: 789, transfer_reference: 'ND-AAAA-BBBB' };
        const raw = JSON.stringify({ event_type: eventType, data });
        expect((await send(t, raw, await sign(raw))).status).toBe(200);
        expect(await jobs(t)).toHaveLength(1);
    });

    it('still requires a signature on a purported test notification', async () => {
        const t = convexTest(schema, modules);
        expect((await send(t, body, undefined, { 'X-Test-Notification': 'true' })).status).toBe(401);
        expect(await jobs(t)).toEqual([]);
    });

    it('returns a retryable failure when a trusted receipt cannot be enqueued', async () => {
        const t = convexTest(schema, modules);
        const { default: http } = await import('../../convex/http');
        const route = http.lookup('/wise-deposit-webhook', 'POST');
        if (!route) throw new Error('Missing registered receiving webhook');
        const handler: unknown = Reflect.get(route[0], '_handler');
        if (typeof handler !== 'function') throw new Error('Missing registered HTTP handler');
        const signature = await sign(body);
        const runAfter = vi.fn().mockRejectedValue(new Error('Scheduler unavailable'));
        const response = await t.action(async ctx => {
            const result: Response = await handler({ ...ctx, scheduler: { ...ctx.scheduler, runAfter } }, new Request(
                'https://example.test/wise-deposit-webhook', { method: 'POST', body,
                    headers: { 'Content-Type': 'application/json', 'X-Signature-SHA256': signature } },
            ));
            return { status: result.status, body: await result.json() };
        });
        expect(response.status).toBe(500);
        expect(runAfter).toHaveBeenCalledOnce();
        expect(await jobs(t)).toEqual([]);
    });

    it('leaves the separate outgoing webhook enforcement rollout unchanged', async () => {
        const t = convexTest(schema, modules);
        vi.stubEnv('WISE_WEBHOOK_PUBLIC_KEY', '');
        const response = await t.fetch('/wise-webhook', { method: 'POST', body: JSON.stringify({ data: {
            resource: { id: 789 }, current_state: 'unknown-state',
        } }) });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ignored: true });
        expect(await jobs(t)).toEqual([]);
    });
});
