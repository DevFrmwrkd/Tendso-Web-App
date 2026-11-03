import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { ownerReturnPath } from '../../lib/ownerReturnPath';

const state = vi.hoisted(() => ({
    query: vi.fn(), mutation: vi.fn(), action: vi.fn(), previewEmail: vi.fn(), paymentEmail: vi.fn(),
    network: vi.fn(), html: '<html>Private website</html>',
    reason: null as string | null, atomicFailure: false,
    submission: {} as Record<string, unknown>, website: {} as Record<string, unknown>,
}));
vi.mock('next/server', () => ({ NextResponse: { json: (body: unknown, options?: { status?: number }) => ({ body, status: options?.status ?? 200 }) } }));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'admin', getToken: async () => 'test-session' }) }));
vi.mock('convex/nextjs', () => ({ fetchQuery: state.query, fetchMutation: state.mutation, fetchAction: state.action }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/security', () => ({ checkRateLimit: () => ({ allowed: true }), RATE_LIMITS: { expensive: { maxRequests: 5, windowMs: 60000 } } }));
vi.mock('../../lib/website-html', () => ({ resolveWebsiteHtml: async () => state.html }));
vi.mock('../../lib/email/service', () => ({ sendOwnerPreviewEmail: state.previewEmail, sendPaymentLinkEmail: state.paymentEmail }));

import { POST as publish } from '../../app/api/publish-website/route';
import { POST as sendWebsite } from '../../app/api/send-website-email/route';

function request() {
    return { json: async () => ({ submissionId: 'submission-private' }), nextUrl: new URL('https://tendso.example/api/send-website-email') } as never;
}

beforeEach(() => {
    vi.clearAllMocks();
    state.html = '<html>Private website</html>'; state.reason = null; state.atomicFailure = false;
    state.submission = { _id: 'submission-private', businessName: 'Sample shop', ownerName: 'Pablo',
        ownerEmail: 'owner@example.test', status: 'website_generated', amount: 4999,
        publishPolicy: 'pay_then_publish', requestedDomain: 'sample-shop.example' };
    state.website = { submissionId: 'submission-private', status: 'draft', htmlContent: state.html };
    state.query.mockImplementation(async reference => {
        const name = getFunctionName(reference);
        if (name === 'creators:getByClerkId') return { role: 'admin', status: 'active' };
        if (name === 'submissions:getById') return state.submission;
        if (name === 'generatedWebsites:getBySubmissionId') return state.website;
        if (name === 'generatedWebsites:publicationCheck') return { allowed: !state.reason, reason: state.reason };
        if (name === 'generatedWebsites:listSlugs') return [];
        throw new Error(`Unexpected query: ${name}`);
    });
    state.mutation.mockImplementation(async reference => {
        if (state.atomicFailure && getFunctionName(reference) === 'generatedWebsites:publish') throw new Error('Owner approval changed');
        return null;
    });
    vi.stubGlobal('fetch', state.network);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('private preview before payment on the web', () => {
    it.each(['unpaid', 'not approved', 'open change requests'])('refuses %s before any Worker call or publishing write', async reason => {
        state.reason = reason;
        const response = await publish(request()) as unknown as { status: number; body: { error: string } };
        expect(response.status).toBe(409);
        expect(response.body.error).toBeTruthy();
        expect(state.network).not.toHaveBeenCalled();
        expect(state.mutation).not.toHaveBeenCalled();
        expect(state.query.mock.calls.some(([reference]) => getFunctionName(reference) === 'generatedWebsites:listSlugs')).toBe(false);
    });

    it('does not report success or mark deployed if the atomic publication check rejects a changed order', async () => {
        delete state.submission.requestedDomain;
        state.atomicFailure = true;
        const response = await publish(request()) as unknown as { status: number };
        expect(response.status).toBe(500);
        expect(state.mutation.mock.calls.map(([reference]) => getFunctionName(reference))).toEqual(['generatedWebsites:publish']);
        expect(state.network).not.toHaveBeenCalled();
    });

    it('emails a sign-in-gated preview without creating a pay token, sending a bill or starting an unpaid-site deadline', async () => {
        const response = await sendWebsite(request()) as unknown as { status: number; body: { previewUrl: string } };
        expect(response.status).toBe(200);
        expect(response.body.previewUrl).toBe('https://tendso.example/my-business/submission-private');
        expect(state.previewEmail).toHaveBeenCalledWith(expect.objectContaining({ ownerEmail: 'owner@example.test', amount: 4999,
            previewUrl: 'https://tendso.example/my-business/submission-private' }));
        expect(state.paymentEmail).not.toHaveBeenCalled();
        expect(state.action).not.toHaveBeenCalled();
        expect(state.mutation).not.toHaveBeenCalled();
    });

    it('does not send a private-preview invitation before the HTML exists', async () => {
        state.html = '';
        const response = await sendWebsite(request()) as unknown as { status: number };
        expect(response.status).toBe(409);
        expect(state.previewEmail).not.toHaveBeenCalled();
        expect(state.action).not.toHaveBeenCalled();
    });
});

describe('owner invitation return paths', () => {
    it.each(['/my-business', '/my-business/submission-private'])('keeps owned workspace path %s', path => {
        expect(ownerReturnPath(path)).toBe(path);
    });
    it.each(['https://other.example', '//other.example', '/admin', '/my-business/sign-in', '/my-business/x?redirect=https://other.example', null])
    ('refuses an arbitrary or looping return path (%s)', path => {
        expect(ownerReturnPath(path)).toBe('/my-business');
    });
});
