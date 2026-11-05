jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('convex/nextjs', () => ({ fetchQuery: jest.fn(), fetchMutation: jest.fn() }));
jest.mock('@/convex/_generated/api', () => ({ api: {
    creators: { getByClerkId: 'account' },
    submissions: { getById: 'submission', markFollowUpSent: 'followedUp' },
    generatedWebsites: { getBySubmissionId: 'website' },
} }));
jest.mock('@/lib/email/service', () => ({
    sendPaymentFollowUpEmail: jest.fn(), sendPaymentConfirmationEmail: jest.fn(),
    sendDomainLiveEmail: jest.fn(), sendDomainSetupInProgressEmail: jest.fn(), sendDomainRenewalReminderEmail: jest.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { NextRequest } from 'next/server';
import { sendPaymentFollowUpEmail, sendPaymentConfirmationEmail } from '@/lib/email/service';
import { POST as followUp } from '@/app/api/send-payment-followup-email/route';
import { POST as completed } from '@/app/api/send-completed-website-email/route';

const getToken = jest.fn();
const authMock = auth as unknown as jest.Mock;
const savedSecret = process.env.INTERNAL_API_SECRET;
const secret = 'test-private-email-capability';
const request = (providedSecret?: string) => new NextRequest('https://tendso.com/api/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(providedSecret ? { 'x-internal-secret': providedSecret } : {}) },
    body: JSON.stringify({ submissionId: 'submission-1' }),
});
beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_API_SECRET = secret;
    getToken.mockResolvedValue('admin-jwt');
    authMock.mockResolvedValue({ userId: 'admin-subject', getToken });
    (fetchQuery as jest.Mock).mockImplementation(async (reference: string, args: Record<string, unknown>, options: {token?: string} = {}) => {
        if (reference === 'account') return { role: 'admin', status: 'active' };
        if (args.internalSecret !== secret && options.token !== 'admin-jwt') throw new Error('Private read was not authorized');
        if (reference === 'submission') return { _id: 'submission-1', businessName: 'Nena Store', ownerName: 'Nena', ownerEmail: 'owner@example.com', status: 'pending_payment', amount: 2999, _creationTime: 1 };
        if (reference === 'website') return { publishedUrl: 'https://nena.sites.tendso.com' };
        return null;
    });
});
afterAll(() => {
    if (savedSecret === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = savedSecret;
});

describe.each([
    ['payment follow-up', followUp, sendPaymentFollowUpEmail],
    ['completed website', completed, sendPaymentConfirmationEmail],
] as const)('%s private-read bridge', (_, route, sendEmail) => {
    it('forwards a verified admin Convex token to both private reads', async () => {
        expect((await route(request())).status).toBe(200);
        expect(getToken).toHaveBeenCalledWith({ template: 'convex' });
        expect(fetchQuery).toHaveBeenCalledWith('account', { clerkId: 'admin-subject' }, { token: 'admin-jwt' });
        expect(fetchQuery).toHaveBeenCalledWith('submission', { id: 'submission-1' }, { token: 'admin-jwt' });
        expect(fetchQuery).toHaveBeenCalledWith('website', { submissionId: 'submission-1' }, { token: 'admin-jwt' });
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it('forwards the exact verified internal capability without requiring Clerk', async () => {
        const response = await route(request(secret));
        expect(response.status).toBe(200);
        expect(auth).not.toHaveBeenCalled();
        expect(fetchQuery).toHaveBeenCalledWith('submission', { id: 'submission-1', internalSecret: secret }, { token: undefined });
        expect(fetchQuery).toHaveBeenCalledWith('website', { submissionId: 'submission-1', internalSecret: secret }, { token: undefined });
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(await response.json())).not.toContain(secret);
    });

    it('rejects an admin session without a usable Convex token before private reads', async () => {
        getToken.mockResolvedValue(null);
        expect((await route(request())).status).toBe(401);
        expect(fetchQuery).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('rejects a wrong internal capability when no admin session exists', async () => {
        authMock.mockResolvedValue({ userId: null });
        expect((await route(request('truthy-but-wrong'))).status).toBe(401);
        expect(fetchQuery).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('rejects a suspended administrator before retrieving capture data', async () => {
        (fetchQuery as jest.Mock).mockResolvedValue({ role: 'admin', status: 'suspended' });
        expect((await route(request())).status).toBe(401);
        expect(fetchQuery).toHaveBeenCalledTimes(1);
        expect(sendEmail).not.toHaveBeenCalled();
    });
});
