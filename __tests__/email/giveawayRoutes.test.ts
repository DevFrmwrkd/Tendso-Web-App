jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('convex/nextjs', () => ({ fetchQuery: jest.fn() }));
jest.mock('@/convex/_generated/api', () => ({ api: {
    creators: { getByClerkId: 'creator' }, submissions: { getById: 'submission', getByIdWithCreator: 'submissionWithCreator' },
    generatedWebsites: { getBySubmissionId: 'website' },
} }));
jest.mock('@/lib/email/service', () => ({ sendGiveawayRejectedEmail: jest.fn(), sendIntakeReceivedEmail: jest.fn() }));
jest.mock('@/lib/payment/config', () => ({ getPaymentConfig: () => ({ wiseEmail: 'team@tendso.com' }) }));

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { sendGiveawayRejectedEmail, sendIntakeReceivedEmail } from '@/lib/email/service';
import { POST as rejected } from '@/app/api/internal/send-giveaway-rejected-email/route';
import { POST as received } from '@/app/api/internal/send-intake-received-email/route';
import { GET as preview } from '@/app/api/preview-email/route';

const fetchMock = fetchQuery as jest.Mock;
const sendRejected = sendGiveawayRejectedEmail as jest.Mock;
const sendReceived = sendIntakeReceivedEmail as jest.Mock;
const authMock = auth as unknown as jest.Mock;
const submission = {
    _id: 'submission-1', businessName: 'Corner Shop', ownerName: 'Sam', ownerEmail: 'owner@example.com',
    giveawayApplication: true, status: 'rejected', rejectionReason: 'The poster is not visible.', reviewedAt: 1234, amount: 0,
};
const event = { submissionId: submission._id, reviewedAt: submission.reviewedAt, reason: submission.rejectionReason };
const post = (body: unknown, secret = 'test-internal-secret') => new NextRequest('https://tendso.com/api/internal/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret }, body: JSON.stringify(body),
});
const originalSecret = process.env.INTERNAL_API_SECRET;
const originalUrl = process.env.NEXT_PUBLIC_APP_URL;

beforeEach(() => {
    jest.resetAllMocks();
    process.env.INTERNAL_API_SECRET = 'test-internal-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://tendso.com';
    fetchMock.mockResolvedValue(submission);
    sendRejected.mockResolvedValue({ success: true });
    sendReceived.mockResolvedValue({ success: true });
});
afterAll(() => {
    if (originalSecret === undefined) delete process.env.INTERNAL_API_SECRET; else process.env.INTERNAL_API_SECRET = originalSecret;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = originalUrl;
});

describe('giveaway rejection internal bridge', () => {
    it('rejects missing/wrong secrets before reading or emailing', async () => {
        expect((await rejected(post(event, 'wrong'))).status).toBe(401);
        delete process.env.INTERNAL_API_SECRET;
        expect((await rejected(post(event))).status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(sendRejected).not.toHaveBeenCalled();
    });
    it('sends the authoritative reason with an event idempotency key and the reapplication landing link', async () => {
        const response = await rejected(post(event));
        expect(await response.json()).toEqual({ success: true, sent: true });
        expect(sendRejected).toHaveBeenCalledWith(expect.objectContaining({
            businessName: submission.businessName, businessOwnerName: submission.ownerName, businessOwnerEmail: submission.ownerEmail,
            reason: submission.rejectionReason, applyUrl: 'https://tendso.com/100-pages-giveaway',
            idempotencyKey: 'giveaway-rejected:submission-1:1234',
        }));
    });
    it.each([
        { giveawayApplication: false }, { status: 'approved' }, { reviewedAt: 5678 },
        { rejectionReason: 'Another reason' }, { giveawayRejectedEmailSentAt: 2000 },
    ])('skips stale or already delivered events (%j)', async (override) => {
        fetchMock.mockResolvedValue({ ...submission, ...override });
        expect(await (await rejected(post(event))).json()).toEqual({ success: true, sent: false });
        expect(sendRejected).not.toHaveBeenCalled();
    });
    it('refuses incomplete event payloads', async () => {
        expect((await rejected(post({ submissionId: 'submission-1' }))).status).toBe(400);
        expect(sendRejected).not.toHaveBeenCalled();
    });
    it('returns a delivery failure without reporting success', async () => {
        sendRejected.mockRejectedValue(new Error('Mailer unavailable'));
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const response = await rejected(post(event));
            expect(response.status).toBe(500);
            expect(await response.json()).toEqual({ error: 'Mailer unavailable' });
        } finally { log.mockRestore(); }
    });
});

describe('acknowledgement bridge', () => {
    it('uses the giveaway variant and marks a real send for receipt tracking', async () => {
        fetchMock.mockResolvedValue({ ...submission, status: 'submitted' });
        expect(await (await received(post({ submissionId: submission._id }))).json()).toEqual({ success: true, sent: true });
        expect(sendReceived).toHaveBeenCalledWith(expect.objectContaining({ amount: 0, giveawayApplication: true, idempotencyKey: 'intake-received:submission-1' }));
    });
    it('does not send an acknowledgement claiming a held slot after rejection', async () => {
        expect(await (await received(post({ submissionId: submission._id }))).json()).toEqual({ success: true, sent: false });
        expect(sendReceived).not.toHaveBeenCalled();
    });
});

describe('admin giveaway email previews', () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ userId: 'admin', getToken: jest.fn().mockResolvedValue('convex-admin-token') });
        fetchMock.mockImplementation((query: string) => Promise.resolve(query === 'creator' ? { role: 'admin' } : query === 'submission' ? submission : null));
    });
    it.each(['giveaway_received', 'giveaway_rejected'])('renders the same %s template without sending mail', async (type) => {
        const response = await preview(new NextRequest(`https://tendso.com/api/preview-email?submissionId=submission-1&type=${type}`));
        expect(response.status).toBe(200);
        const html = await response.text();
        if (type === 'giveaway_received') expect(html).toContain('Your slot is held');
        else expect(html).toContain(submission.rejectionReason);
        expect(html).not.toContain('payment instructions');
        expect(sendReceived).not.toHaveBeenCalled();
        expect(sendRejected).not.toHaveBeenCalled();
    });
    it('requires admin auth for previews', async () => {
        authMock.mockResolvedValue({ userId: null });
        expect((await preview(new NextRequest('https://tendso.com/api/preview-email?submissionId=submission-1&type=giveaway_rejected'))).status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it('refuses payment previews on giveaway applications', async () => {
        const response = await preview(new NextRequest('https://tendso.com/api/preview-email?submissionId=submission-1&type=approval'));
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Giveaway applications do not have payment emails' });
    });
    it('previews a giveaway live email with its stored giver name and preserves an explicit preview override', async () => {
        fetchMock.mockImplementation((query: string) => Promise.resolve(query === 'creator' ? { role: 'admin' }
            : query === 'submission' ? { ...submission, status: 'paid', pricingMode: 'comped', compedReason: 'giveaway · gifted as "Tendso"' }
            : query === 'submissionWithCreator' ? { creator: { email: 'self-serve@tendso.com' } }
            : { publishedUrl: 'https://shop.tendso.com' }));
        const base = 'https://tendso.com/api/preview-email?submissionId=submission-1&type=promo_free';
        expect(await (await preview(new NextRequest(base))).text()).toContain('Tendso</strong> chose');
        expect(await (await preview(new NextRequest(`${base}&giftedBy=Sponsor`))).text()).toContain('Sponsor</strong> chose');
    });
});
