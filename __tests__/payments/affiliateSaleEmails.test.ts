const mockSend = jest.fn();
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }));
jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('convex/nextjs', () => ({ fetchQuery: jest.fn(), fetchMutation: jest.fn(), fetchAction: jest.fn() }));
jest.mock('@/convex/_generated/api', () => ({ api: {
    creators: { getByClerkId: 'admin' },
    submissions: { getById: 'submission', markFollowUpSent: 'followedUp' },
    paymentTokens: { getBySubmissionId: 'token', createPaymentToken: 'createToken', recordEmailSent: 'sent' },
    generatedWebsites: { getBySubmissionId: 'website' },
    businessOwners: { issueClaimTokenForEmail: 'claim' },
    admin: { markEmailSent: 'markSent' },
} }));
jest.mock('@/lib/payment/config', () => ({ getPaymentConfig: () => ({
    wiseEmail: 'team@tendso.com', getPaymentLink: (token: string) => `https://tendso.com/pay/${token}`,
}) }));

import { auth } from '@clerk/nextjs/server';
import { fetchAction, fetchMutation, fetchQuery } from 'convex/nextjs';
import { NextRequest } from 'next/server';
import { POST as paymentLink } from '@/app/api/send-website-email/route';
import { POST as followUp } from '@/app/api/send-payment-followup-email/route';
import { priceSplit } from '@/app/pay/[token]/_components/payState';
import { CUSTOM_DOMAIN_ADDON, WEBSITE_PRICE, formatPHP } from '@/lib/pricing';

const originalKey = process.env.RESEND_API_KEY;
beforeAll(() => { process.env.RESEND_API_KEY = 'test-key'; });
afterAll(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
});

beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'admin-clerk-id', getToken: jest.fn().mockResolvedValue('admin-convex-token') });
    mockSend.mockResolvedValue({ data: { id: 'test-message' }, error: null });
    (fetchMutation as jest.Mock).mockResolvedValue({ token: 'test-claim' });
    (fetchAction as jest.Mock).mockResolvedValue({ token: 'test-payment', referenceCode: 'ND-ABCD-EFGH' });
});

// These are frozen submission amounts, rather than the affiliate's current price.
// The real route and email transport/template run; only auth, Convex and Resend
// are replaced, so this verifies that the persisted list price reaches the owner.
const saleCases: { price: number; domain: boolean; percentOff: number | null; chargedDomain?: number; registrarCost?: number }[] = [
    { price: 999, domain: false, percentOff: 80 },
    { price: 2499, domain: false, percentOff: 50 },
    { price: 2499, domain: true, percentOff: 50 },
    { price: 2499, domain: true, percentOff: 50, registrarCost: 720 },
    { price: 2499, domain: true, percentOff: 50, chargedDomain: 0, registrarCost: 720 },
    { price: WEBSITE_PRICE, domain: false, percentOff: null },
    { price: WEBSITE_PRICE, domain: true, percentOff: null },
];
describe.each(saleCases)('affiliate sale at $price (domain=$domain, registrarCost=$registrarCost)', ({ price, domain, percentOff, chargedDomain, registrarCost }) => {
    const addOn = domain ? chargedDomain ?? CUSTOM_DOMAIN_ADDON : 0;
    const sale = {
        _id: 'affiliate-sale', creatorId: 'affiliate-account',
        businessName: 'Corner Shop', ownerName: 'Sam', ownerEmail: 'owner@example.com',
        amount: price + addOn, websiteListPrice: WEBSITE_PRICE,
        domainChargedPHP: addOn, domainCostPHP: registrarCost,
        requestedDomain: domain ? 'corner-shop.com' : undefined,
        status: 'pending_payment', paymentReference: 'ND-ABCD-EFGH',
        _creationTime: 1000, sentEmailAt: 1000,
    };

    beforeEach(() => {
        (fetchQuery as jest.Mock).mockImplementation((query: string) => Promise.resolve(
            query === 'admin' ? { role: 'admin' }
                : query === 'submission' ? sale
                    : query === 'website' ? { publishedUrl: 'https://corner-shop.sites.tendso.com' }
                        : null,
        ));
    });

    it.each([
        ['payment email', paymentLink], ['follow-up email', followUp],
    ] as const)('keeps the saved price through the %s and pay-page breakdown', async (_, route) => {
        const response = await route(new NextRequest('https://tendso.com/api/email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionId: sale._id }),
        }));
        expect(response.status).toBe(200);
        expect(mockSend).toHaveBeenCalledTimes(1);
        const mail = mockSend.mock.calls[0][0] as { to: string; html: string };
        expect(mail.to).toBe(sale.ownerEmail);
        expect(mail.html).toContain(formatPHP(sale.amount));
        if (route === paymentLink || !domain || percentOff !== null) {
            expect(mail.html).toContain(formatPHP(price));
        }
        const split = priceSplit(sale.amount, sale);
        expect(split.websiteLine).toBe(price);
        expect(split.addOn).toBe(addOn);
        if (percentOff !== null) {
            expect(mail.html).toContain('text-decoration:line-through');
            expect(mail.html).toContain(`${formatPHP(WEBSITE_PRICE)}</span>`);
            expect(mail.html).toContain(`${percentOff}% off`);
            expect(split.discount).toEqual({ listPrice: WEBSITE_PRICE, price, percentOff });
        } else {
            expect(mail.html).not.toContain('line-through');
            expect(mail.html).not.toContain('% off');
            expect(split.discount).toBeNull();
        }
        if (route === paymentLink) {
            expect(fetchAction).toHaveBeenCalledWith('createToken', expect.objectContaining({
                submissionId: sale._id, amount: sale.amount,
            }), { token: 'admin-convex-token' });
        }
    });
});
