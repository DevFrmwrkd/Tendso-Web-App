jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn(), clerkClient: jest.fn() }));
jest.mock('convex/nextjs', () => ({ fetchQuery: jest.fn(), fetchMutation: jest.fn(), fetchAction: jest.fn() }));
jest.mock('@aws-sdk/client-s3', () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn(), destroy: jest.fn() })),
    DeleteObjectCommand: jest.fn(),
}));
jest.mock('@/lib/email/service', () => ({
    sendPaymentConfirmationEmail: jest.fn(), sendPromoWebsiteLiveEmail: jest.fn(), sendPaymentLinkEmail: jest.fn(),
}));
jest.mock('@/lib/payment/config', () => ({ getPaymentConfig: () => ({ getPaymentLink: () => 'https://tendso.com/pay/test-token' }) }));
jest.mock('@/convex/_generated/api', () => ({ api: {
    creators: { getByClerkId: 'currentAccount', getById: 'targetAccount' },
    submissions: { getById: 'submission', getByIdWithCreator: 'submission', getByCreatorId: 'creatorSubmissions' },
    generatedWebsites: { getBySubmissionId: 'website' }, websiteContent: { getBySubmissionId: 'content' },
    paymentTokens: { getBySubmissionId: 'existingToken', createPaymentToken: 'createToken', recordEmailSent: 'recordEmail' },
    businessOwners: { issueClaimTokenForEmail: 'claim' },
    admin: { markPaid: 'markPaid', markComped: 'markComped', logPaymentConfirmed: 'logConfirmed',
        markEmailSent: 'markEmail', deleteCreatorRecords: 'deleteCreator', deleteSubmissionRecords: 'deleteSubmission' },
} }));

import { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { fetchAction, fetchMutation, fetchQuery } from 'convex/nextjs';
import { S3Client } from '@aws-sdk/client-s3';
import { sendPaymentConfirmationEmail, sendPromoWebsiteLiveEmail, sendPaymentLinkEmail } from '@/lib/email/service';
import { POST as markPaid } from '@/app/api/mark-paid/route';
import { POST as markComped } from '@/app/api/mark-comped/route';
import { POST as deleteCreator } from '@/app/api/delete-creator/route';
import { POST as deleteSubmission } from '@/app/api/delete-submission/route';
import { POST as sendWebsiteEmail } from '@/app/api/send-website-email/route';

const authMock = auth as unknown as jest.Mock;
const getToken = jest.fn();
const deleteUser = jest.fn();
const actor = { clerkId: 'admin-session', role: 'admin', status: 'active' };
const request = () => new NextRequest('https://tendso.com/api/admin-operation', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId: 'submission-1', creatorId: 'creator-1', websiteUrl: 'https://example.com/shop' }),
});
let network: jest.SpyInstance;
beforeEach(() => {
    jest.clearAllMocks();
    getToken.mockResolvedValue('verified-convex-token');
    authMock.mockResolvedValue({ userId: actor.clerkId, getToken });
    (clerkClient as jest.Mock).mockResolvedValue({ users: { deleteUser } });
    (fetchMutation as jest.Mock).mockResolvedValue({ token: 'claim-token' });
    (fetchAction as jest.Mock).mockResolvedValue({ token: 'payment-token', referenceCode: 'ND-ABCD-EFGH' });
    (fetchQuery as jest.Mock).mockImplementation(async (query: string) => {
        if (query === 'currentAccount') return actor;
        if (query === 'targetAccount') return { clerkId: 'victim-creator', role: 'creator', firstName: 'Shop', lastName: 'Creator' };
        if (query === 'creatorSubmissions') return [];
        if (query === 'submission') return {
            businessName: 'Corner Shop', ownerName: 'Sam', ownerEmail: 'shop@example.com', amount: 1999,
            creator: { firstName: 'Shop', lastName: 'Creator' },
        };
        if (query === 'website') return { publishedUrl: 'https://example.com/shop' };
        return null;
    });
    network = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external request'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

function expectNoSideEffects() {
    for (const mock of [fetchMutation, fetchAction, clerkClient, deleteUser, S3Client,
        sendPaymentConfirmationEmail, sendPromoWebsiteLiveEmail, sendPaymentLinkEmail, network]) {
        expect(mock).not.toHaveBeenCalled();
    }
}

describe.each([
    ['mark-paid', markPaid, 'markPaid'], ['mark-comped', markComped, 'markComped'],
    ['delete-creator', deleteCreator, 'deleteCreator'], ['delete-submission', deleteSubmission, 'deleteSubmission'],
    ['send-website-email', sendWebsiteEmail, 'markEmail'],
] as const)('%s route authorization', (_name, route, mutation) => {
    it('refuses a missing Clerk session or Convex token before any work', async () => {
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
    ])('refuses the account %j before external cleanup, payout or email', async (account) => {
        (fetchQuery as jest.Mock).mockResolvedValueOnce(account);
        expect((await route(request())).status).toBe(403);
        expectNoSideEffects();
    });

    it('forwards the Convex token on every read and admin operation', async () => {
        expect((await route(request())).status).toBe(200);
        expect(getToken).toHaveBeenCalledWith({ template: 'convex' });
        expect(fetchMutation).toHaveBeenCalledWith(mutation, expect.anything(), { token: 'verified-convex-token' });
        for (const call of [...(fetchQuery as jest.Mock).mock.calls,
            ...(fetchMutation as jest.Mock).mock.calls, ...(fetchAction as jest.Mock).mock.calls]) {
            expect(call[2]).toEqual({ token: 'verified-convex-token' });
        }
        expect(network).not.toHaveBeenCalled();
    });
});
