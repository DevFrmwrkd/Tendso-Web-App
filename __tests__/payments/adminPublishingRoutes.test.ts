jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('convex/nextjs', () => ({ fetchQuery: jest.fn(), fetchMutation: jest.fn(), fetchAction: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/security', () => ({
    checkRateLimit: jest.fn(() => ({ allowed: true })),
    RATE_LIMITS: { expensive: { maxRequests: 5, windowMs: 60000 } },
}));
jest.mock('@/lib/astro-builder', () => ({ buildAstroSite: jest.fn() }));
jest.mock('@/lib/services/groq.service', () => ({
    groqService: {}, delimitTranscript: jest.fn(), hasSuppliedTestimonials: jest.fn(), stripFabricatedTestimonials: jest.fn(),
}));
jest.mock('@/lib/website-html', () => ({ resolveWebsiteHtml: jest.fn(() => '<html>Shop</html>') }));
jest.mock('@/lib/holding-page', () => ({ deployHoldingPage: jest.fn(), resolveHoldingTheme: jest.fn() }));
jest.mock('@/lib/publish-target', () => ({
    needsCloudflareWorker: jest.fn(() => false),
    publishAddressFor: jest.fn(() => 'https://shop.sites.tendso.com'),
}));
jest.mock('@/convex/_generated/api', () => ({ api: {
    creators: { getByClerkId: 'actor' },
    submissions: { getById: 'submission', updateStatus: 'status', setUnpublished: 'unpublished', update: 'updateSubmission' },
    generatedWebsites: {
        getBySubmissionId: 'website', listSlugs: 'slugs', publish: 'publish', markOffline: 'offline',
        upsert: 'upsert', updatePublishingInfo: 'publishingInfo', storeHtml: 'storeHtml',
    },
    websiteContent: { getBySubmissionId: 'content', getDirect: 'directContent', upsert: 'upsertContent' },
    files: { getMultipleUrls: 'fileUrls' },
} }));

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchAction, fetchMutation, fetchQuery } from 'convex/nextjs';
import { buildAstroSite } from '@/lib/astro-builder';
import { deployHoldingPage } from '@/lib/holding-page';
import { POST as generateWebsite } from '@/app/api/generate-website/route';
import { POST as publishWebsite } from '@/app/api/publish-website/route';
import { POST as saveContent } from '@/app/api/save-content/route';
import { POST as unpublishWebsite } from '@/app/api/unpublish-website/route';

const authMock = auth as unknown as jest.Mock;
const getToken = jest.fn();
const actor = { clerkId: 'admin-session', role: 'admin', status: 'active' };
const request = () => new NextRequest('https://tendso.com/api/admin-operation', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=verified' },
    body: JSON.stringify({ submissionId: 'submission-1', content: { about: 'Updated content' } }),
});
let network: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    getToken.mockResolvedValue('verified-convex-token');
    authMock.mockResolvedValue({ userId: actor.clerkId, getToken });
    (fetchMutation as jest.Mock).mockResolvedValue(undefined);
    (fetchAction as jest.Mock).mockResolvedValue(undefined);
    (fetchQuery as jest.Mock).mockImplementation(async (query: string) => {
        if (query === 'actor') return actor;
        if (query === 'submission') return {
            businessName: 'Corner Shop', status: 'pending_payment', websiteUrl: 'https://example.com/original',
        };
        if (query === 'website') return {
            status: 'published', publishedUrl: 'https://example.com/original', slug: 'shop', templateName: 'default',
            htmlContent: '<html>Shop</html>',
        };
        if (query === 'slugs') return [];
        return null;
    });
    network = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
        success: true, url: 'https://shop.sites.tendso.com', htmlContent: '<html>Updated shop</html>',
    }), { status: 200 }));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

function expectNoSideEffects() {
    for (const mock of [fetchMutation, fetchAction, buildAstroSite, deployHoldingPage, network]) {
        expect(mock).not.toHaveBeenCalled();
    }
}

function expectAllConvexCallsAuthenticated() {
    expect(getToken).toHaveBeenCalledWith({ template: 'convex' });
    for (const call of [...(fetchQuery as jest.Mock).mock.calls,
        ...(fetchMutation as jest.Mock).mock.calls, ...(fetchAction as jest.Mock).mock.calls]) {
        expect(call[2]).toEqual({ token: 'verified-convex-token' });
    }
}

describe.each([
    ['generate-website', generateWebsite], ['publish-website', publishWebsite],
    ['save-content', saveContent], ['unpublish-website', unpublishWebsite],
] as const)('%s route authorization', (_name, route) => {
    it('refuses a missing Clerk session or Convex token before work', async () => {
        authMock.mockResolvedValueOnce({ userId: null });
        expect((await route(request())).status).toBe(401);
        getToken.mockResolvedValueOnce(null);
        expect((await route(request())).status).toBe(401);
        expect(fetchQuery).not.toHaveBeenCalled();
        expectNoSideEffects();
    });

    it.each([
        { role: 'creator' }, { role: 'affiliate' }, { role: 'staff' },
        { role: 'admin', status: 'suspended' }, { role: 'admin', status: 'deleted' }, { role: 'admin', isDeleted: true },
    ])('refuses the account %j before builds, writes or deployments', async (account) => {
        (fetchQuery as jest.Mock).mockResolvedValueOnce(account);
        expect((await route(request())).status).toBe(403);
        expectNoSideEffects();
    });
});

it('forwards the admin token to generator account and submission reads', async () => {
    (fetchQuery as jest.Mock).mockImplementation(async (query: string) => query === 'actor' ? actor : null);
    expect((await generateWebsite(request())).status).toBe(404);
    expect(fetchQuery).toHaveBeenCalledWith('submission', { id: 'submission-1' }, { token: 'verified-convex-token' });
    expectAllConvexCallsAuthenticated();
    expectNoSideEffects();
});

it('publishes for an authenticated admin and forwards the token to status writes', async () => {
    expect((await publishWebsite(request())).status).toBe(200);
    expect(fetchMutation).toHaveBeenCalledWith('status', { id: 'submission-1', status: 'deployed' }, { token: 'verified-convex-token' });
    expectAllConvexCallsAuthenticated();
    expect(network).not.toHaveBeenCalled();
});

it('unpublishes for an authenticated admin and forwards the token to status writes', async () => {
    expect((await unpublishWebsite(request())).status).toBe(200);
    expect(fetchMutation).toHaveBeenCalledWith('unpublished', { id: 'submission-1' }, { token: 'verified-convex-token' });
    expectAllConvexCallsAuthenticated();
    expect(network).not.toHaveBeenCalled();
});

it('preserves authenticated payment lifecycle writes when saving and republishing', async () => {
    const response = await saveContent(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, wasPublished: true, republished: true });
    expect(fetchMutation).toHaveBeenCalledWith('status', { id: 'submission-1', status: 'pending_payment' }, { token: 'verified-convex-token' });
    expect(fetchMutation).toHaveBeenCalledWith('publishingInfo', {
        submissionId: 'submission-1', publishedUrl: 'https://example.com/original',
    }, { token: 'verified-convex-token' });
    expectAllConvexCallsAuthenticated();
    expect(network).toHaveBeenCalledTimes(2);
    for (const [url, options] of network.mock.calls) {
        expect(url).toMatch(/^https:\/\/tendso\.com\/api\/(generate|publish)-website$/);
        expect(options.headers.Cookie).toBe('session=verified');
    }
});
