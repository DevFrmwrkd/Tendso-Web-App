import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/landing-visit/route';
import { fetchAction } from 'convex/nextjs';

vi.mock('convex/nextjs', () => ({ fetchAction: vi.fn() }));
const request = (headers: Record<string, string> = {}) => new NextRequest('https://tendso.com/api/landing-visit', {
    method: 'POST', headers,
    body: JSON.stringify({ shopName: 'Shop', area: 'Pasig', mobile: '09171234567', token: 'token', caller: 'forged' }),
});

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('landing visit trusted caller', () => {
    it('fails closed outside the trusted platform even with a spoofed IP header', async () => {
        vi.stubEnv('VERCEL', '');
        vi.stubEnv('LANDING_LEADS_SECRET', 'secret');
        expect((await POST(request({ 'x-forwarded-for': '203.0.113.1' }))).status).toBe(503);
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
});
