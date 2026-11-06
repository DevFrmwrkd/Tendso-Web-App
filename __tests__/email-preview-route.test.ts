jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('convex/nextjs', () => ({ fetchQuery: jest.fn() }));
jest.mock('@/convex/_generated/api', () => ({ api: {
    creators: { getByClerkId: 'account' }, submissions: { getById: 'submission' },
    generatedWebsites: { getBySubmissionId: 'website' }, paymentTokens: { getBySubmissionId: 'paymentToken' },
} }));
jest.mock('@/lib/email/templates', () => ({ getPaymentLinkEmailHtml: jest.fn(() => '<p>Legacy payment request</p>') }));

import { auth } from '@clerk/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/preview-email/route';
import { getPaymentLinkEmailHtml } from '@/lib/email/templates';
import { ownerPreviewReadyEmail } from '@/lib/email/ownerV2Templates';

let policy: 'pay_then_publish' | 'publish_first' = 'pay_then_publish';
const getToken = jest.fn();
const request = () => new NextRequest('https://preview.example.com/api/preview-email?submissionId=sample-business&type=approval');
beforeEach(() => {
    jest.clearAllMocks();
    policy = 'pay_then_publish';
    getToken.mockResolvedValue('admin-jwt');
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'sample-admin', getToken });
    (fetchQuery as jest.Mock).mockImplementation(async (reference: string, _args: unknown, options: { token?: string }) => {
        if (options?.token !== 'admin-jwt') throw new Error('Missing private-read token');
        if (reference === 'account') return { role: 'admin', status: 'active' };
        if (reference === 'submission') return { businessName: 'Luna Corner Store', ownerName: 'Alex Rivera', amount: 3499, publishPolicy: policy };
        if (reference === 'website') return { publishedUrl: 'https://luna.example.com' };
        if (reference === 'paymentToken') return { referenceCode: 'SAMPLE-ONLY' };
        return null;
    });
});

it('previews the actual private-review email, with origin and amount matching the send path', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(ownerPreviewReadyEmail({
        businessName: 'Luna Corner Store', ownerName: 'Alex Rivera',
        appUrl: 'https://preview.example.com/my-business/sample-business', priceText: '₱3,499',
    }).html);
    expect(getPaymentLinkEmailHtml).not.toHaveBeenCalled();
    expect((fetchQuery as jest.Mock).mock.calls.some(([reference]) => reference === 'paymentToken')).toBe(false);
});

it('preserves the legacy approval payment-link renderer and private-read authorization', async () => {
    policy = 'publish_first';
    const response = await GET(request());
    expect(await response.text()).toBe('<p>Legacy payment request</p>');
    expect(getPaymentLinkEmailHtml).toHaveBeenCalledWith(expect.objectContaining({ amount: 3499, referenceCode: 'SAMPLE-ONLY' }));
    expect(fetchQuery).toHaveBeenCalledWith('paymentToken', { submissionId: 'sample-business' }, { token: 'admin-jwt' });
});

it('does not retrieve private records without a usable admin session', async () => {
    getToken.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(fetchQuery).not.toHaveBeenCalled();
    expect(getPaymentLinkEmailHtml).not.toHaveBeenCalled();
});

it('rejects a suspended admin before retrieving the submission', async () => {
    (fetchQuery as jest.Mock).mockResolvedValue({ role: 'admin', status: 'suspended' });
    expect((await GET(request())).status).toBe(403);
    expect(fetchQuery).toHaveBeenCalledTimes(1);
});
