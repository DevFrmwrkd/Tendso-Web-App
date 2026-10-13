const mockSend = jest.fn();
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }));
jest.mock('@/lib/payment/config', () => ({ getPaymentConfig: () => ({ wiseEmail: 'team@tendso.com' }) }));
import { sendGiveawayRejectedEmail, sendIntakeReceivedEmail, sendPromoWebsiteLiveEmail } from '@/lib/email/service';

describe('giveaway email transport', () => {
    const oldKey = process.env.RESEND_API_KEY;
    beforeAll(() => { process.env.RESEND_API_KEY = 'test-resend-key'; });
    afterAll(() => { if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey; });
    beforeEach(() => { mockSend.mockReset().mockResolvedValue({ data: { id: 'message-1' }, error: null }); });

    it('uses a review event idempotency key so retried delivery does not send a second rejection', async () => {
        await sendGiveawayRejectedEmail({ businessName: 'Corner Shop', businessOwnerName: 'Sam', businessOwnerEmail: 'owner@example.com',
            reason: 'Please show the poster in your shop.', applyUrl: 'https://tendso.com/100-pages-giveaway', idempotencyKey: 'giveaway-rejected:submission-1:1234' });
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.com', subject: 'Your Off the Record application for Corner Shop' }),
            { idempotencyKey: 'giveaway-rejected:submission-1:1234' });
    });
    it('uses one submission key for acknowledgement retries', async () => {
        await sendIntakeReceivedEmail({ businessName: 'Corner Shop', businessOwnerName: 'Sam', businessOwnerEmail: 'owner@example.com',
            amount: 0, giveawayApplication: true, idempotencyKey: 'intake-received:submission-1' });
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ subject: "Off the Record received Corner Shop's free website application" }), { idempotencyKey: 'intake-received:submission-1' });
    });
    it('uses campaign-specific delivery copy only for giveaway websites', async () => {
        const data = { businessName: 'Corner Shop', businessOwnerName: 'Sam', businessOwnerEmail: 'owner@example.com', websiteUrl: 'https://corner.sites.tendso.com' };
        await sendPromoWebsiteLiveEmail({ ...data, giveawayApplication: true });
        expect(mockSend).toHaveBeenLastCalledWith(expect.objectContaining({ subject: 'Your free Tendso website from Off the Record is live — Corner Shop' }), undefined);
        await sendPromoWebsiteLiveEmail(data);
        expect(mockSend).toHaveBeenLastCalledWith(expect.objectContaining({ subject: 'Corner Shop is Now Live — Free, Nothing to Pay' }), undefined);
    });
});
