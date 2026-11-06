jest.mock('@clerk/nextjs/server', () => ({
    clerkMiddleware: (handler: unknown) => handler,
    createRouteMatcher: () => () => false,
}));
jest.mock('next/navigation', () => ({ notFound: jest.fn(() => { throw new Error('NOT_FOUND'); }) }));
jest.mock('@/app/design-review/emails/EmailDesignGallery', () => ({ EmailDesignGallery: function MockGallery() { return null; } }));
jest.mock('@/app/design-review/emails/proposals/EmailProposalBoard', () => ({ EmailProposalBoard: function MockBoard() { return null; } }));
jest.mock('@/lib/email/previewSamples', () => ({ getEmailPreviewSamples: jest.fn(() => []) }));
jest.mock('@/app/design-review/emails/proposals/brandAssets', () => ({ getProposalBrandAssets: jest.fn(async () => ({ sample: 'data:image/png;base64,AA==' })) }));

import { NextRequest } from 'next/server';
import { notFound } from 'next/navigation';
import page from '@/app/design-review/emails/page';
import proposalsPage from '@/app/design-review/emails/proposals/page';
import proxy from '@/proxy';
import { getEmailPreviewSamples } from '@/lib/email/previewSamples';
import { getProposalBrandAssets } from '@/app/design-review/emails/proposals/brandAssets';

const runProxy = proxy as unknown as (auth: () => Promise<{ userId: string | null }>, request: NextRequest) => Promise<Response | undefined>;
const signedOut = jest.fn(async () => ({ userId: null }));

beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.restoreAllMocks(); });
function environment(value: 'test' | 'development' | 'production') {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: value });
}

it('does not render or load sample messages outside development', async () => {
    environment('production');
    await expect(page()).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(getEmailPreviewSamples).not.toHaveBeenCalled();
    expect(getProposalBrandAssets).not.toHaveBeenCalled();
});

it('renders the actual template fixture collection in development', async () => {
    environment('development');
    const rendered = await page();
    expect(notFound).not.toHaveBeenCalled();
    expect(getEmailPreviewSamples).toHaveBeenCalledTimes(1);
    expect(getProposalBrandAssets).toHaveBeenCalledTimes(1);
    expect(rendered.props.brandAssets).toEqual({ sample: 'data:image/png;base64,AA==' });
});

it.each(['production', 'test'] as const)('does not render the proposal board in %s', async mode => {
    environment(mode);
    await expect(proposalsPage()).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(getProposalBrandAssets).not.toHaveBeenCalled();
});

it('allows only the exact fictional gallery URL without login in development', async () => {
    environment('development');
    expect(await runProxy(signedOut, new NextRequest('https://example.com/design-review/emails'))).toBeUndefined();
    expect(await runProxy(signedOut, new NextRequest('https://example.com/design-review/emails/proposals'))).toBeUndefined();
    expect(signedOut).not.toHaveBeenCalled();
    for (const path of ['/design-review/emails/private', '/design-review/emails/proposals/private', '/design-review/other', '/admin']) {
        const response = await runProxy(signedOut, new NextRequest(`https://example.com${path}`));
        expect(response?.status).toBe(307);
        expect(response?.headers.get('location')).toContain('/login?');
    }
});

it('keeps normal login protection for the same gallery URL in production', async () => {
    environment('production');
    for (const path of ['/design-review/emails', '/design-review/emails/proposals']) {
        const response = await runProxy(signedOut, new NextRequest(`https://example.com${path}`));
        expect(response?.status).toBe(307);
    }
    expect(signedOut).toHaveBeenCalledTimes(2);
});
