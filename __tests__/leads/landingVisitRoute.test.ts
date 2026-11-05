import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../../app/api/landing-visit/route';
import { fetchAction } from 'convex/nextjs';
import { ConvexError } from 'convex/values';

vi.mock('convex/nextjs', () => ({ fetchAction: vi.fn() }));
const request = (headers: Record<string, string> = {}) => new NextRequest('https://tendso.com/api/landing-visit', {
    method: 'POST', headers,
    body: JSON.stringify({ shopName: 'Shop', area: 'Pasig', mobile: '09171234567', token: 'token', caller: 'forged' }),
});

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('landing visit trusted caller', () => {
    it('advertises only the public-form capability without secrets or caller details', async () => {
        vi.stubEnv('VERCEL', '1');
        vi.stubEnv('LANDING_LEADS_SECRET', 'private-test-secret');
        vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'public-test-site-key');
        const response = await GET(request({ 'x-forwarded-for': '203.0.113.1' }));
        expect(await response.json()).toEqual({ publicFormAvailable: true });
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(fetchAction).not.toHaveBeenCalled();
    });

    it.each(['local-proxy', 'missing-secret', 'missing-site-key', 'untrusted-ip'])('keeps the short form off for %s', async scenario => {
        vi.stubEnv('VERCEL', scenario === 'local-proxy' ? '' : '1');
        vi.stubEnv('LANDING_LEADS_SECRET', scenario === 'missing-secret' ? '' : 'secret');
        vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', scenario === 'missing-site-key' ? '' : 'site-key');
        expect(await (await GET(request({ 'x-forwarded-for': scenario === 'untrusted-ip' ? '203.0.113.1, 203.0.113.2' : '203.0.113.1' }))).json()).toEqual({ publicFormAvailable: false });
        expect(fetchAction).not.toHaveBeenCalled();
    });

    it('fails closed outside the trusted platform even with a spoofed IP header', async () => {
        vi.stubEnv('VERCEL', '');
        vi.stubEnv('LANDING_LEADS_SECRET', 'secret');
        const response = await POST(request({ 'x-forwarded-for': '203.0.113.1' }));
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ message: 'Request a shop visit through your owner account.', requestUrl: '/my-business/visits/new' });
        expect(fetchAction).not.toHaveBeenCalled();
    });

    it.each([undefined, 'fake', '203.0.113.1, 203.0.113.2'])('rejects missing or invalid platform IP: %s', async (ip) => {
        vi.stubEnv('VERCEL', '1');
        vi.stubEnv('LANDING_LEADS_SECRET', 'secret');
        expect((await POST(request(ip ? { 'x-forwarded-for': ip } : {}))).status).toBe(503);
        expect(fetchAction).not.toHaveBeenCalled();
    });

    it('derives caller identity on the server and ignores the submitted identity', async () => {
        vi.stubEnv('VERCEL', '1');
        vi.stubEnv('LANDING_LEADS_SECRET', 'secret');
        vi.mocked(fetchAction).mockResolvedValue({ ok: true, duplicate: false });
        expect((await POST(request({ 'x-forwarded-for': '203.0.113.1' }))).status).toBe(200);
        expect(fetchAction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            caller: createHmac('sha256', 'secret').update('203.0.113.1').digest('hex'), secret: 'secret', token: 'token',
        }));
    });

    it('provides the owner-flow fallback when the public form backend is unconfigured', async () => {
        vi.stubEnv('VERCEL', '1');
        vi.stubEnv('LANDING_LEADS_SECRET', 'secret');
        vi.mocked(fetchAction).mockRejectedValue(new ConvexError('Visit requests are temporarily unavailable.'));
        const response = await POST(request({ 'x-forwarded-for': '203.0.113.1' }));
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ requestUrl: '/my-business/visits/new' });
    });

    it('keeps bot verification and rate-limit errors as failed submissions', async () => {
        vi.stubEnv('VERCEL', '1');
        vi.stubEnv('LANDING_LEADS_SECRET', 'secret');
        for (const data of ['Please complete the bot check and try again.', { field: null, message: 'Please wait a few minutes before requesting another visit.' }]) {
            vi.mocked(fetchAction).mockRejectedValueOnce(new ConvexError(data));
            const response = await POST(request({ 'x-forwarded-for': '203.0.113.1' }));
            expect(response.status).toBe(400);
            expect(await response.json()).toEqual(typeof data === 'string' ? { message: data } : data);
        }
    });
});
