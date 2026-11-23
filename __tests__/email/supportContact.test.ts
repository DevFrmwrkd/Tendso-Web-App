jest.mock('@/lib/payment/config', () => ({
    getPaymentConfig: () => ({ wiseEmail: 'payments@example.com' }),
}));

import {
    getApprovalEmailHtml,
    getGiveawayApprovedEmailHtml,
    getGiveawayRejectedEmailHtml,
    getIntakeReceivedEmailHtml,
    getPaymentConfirmationEmailHtml,
    getPaymentFollowUpEmailHtml,
    getPaymentLinkEmailHtml,
    getPromoWebsiteLiveEmailHtml,
    getWithdrawalRequestedEmailHtml,
} from '@/lib/email/templates';

const owner = { businessName: 'Corner Shop', businessOwnerName: 'Sam' };
const websiteUrl = 'https://corner.sites.tendso.com';
const bank = { accountName: 'Sample Payee', accountNumber: '0000000000', bankName: 'Example Bank', wiseEmail: 'custom-payments@example.com' };
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('support and payment contacts in customer emails', () => {
    it('keeps bank and Wise recipient instructions separate from the support inbox', () => {
        const payment = getPaymentLinkEmailHtml({
            ...owner, websiteUrl, amount: 4999, referenceCode: 'ND-TEST-CODE',
            platformEmail: 'legacy-payments@example.com', paymentDetails: bank,
        });
        expect(visibleText(payment)).toContain('Sample Payee');
        expect(visibleText(payment)).toContain('0000000000');
        expect(visibleText(payment)).toContain('Example Bank');
        expect(payment).toContain('href="mailto:support@tendso.com"');
        expect(payment).not.toContain('href="mailto:custom-payments@example.com"');

        const approval = getApprovalEmailHtml({ ...owner, websiteUrl, amount: 4999, submissionId: 'submission-1' });
        expect(visibleText(approval)).toContain('VONAS, OPC');
        expect(visibleText(approval)).toContain('2006436346');
        expect(visibleText(approval)).toContain('Wise Pilipinas Inc. (via InstaPay)');
        expect(approval).not.toContain('payments@example.com');
        expect(approval).not.toContain('frmwrkd.media@gmail.com');
        expect(approval).toContain('href="mailto:support@tendso.com"');
        const overridden = getApprovalEmailHtml({ ...owner, websiteUrl, amount: 4999, submissionId: 'submission-1', paymentReference: 'ND-TEST-CODE', paymentDetails: bank });
        for (const value of [bank.accountName, bank.accountNumber, bank.bankName, 'ND-TEST-CODE', '₱4,999']) {
            expect(visibleText(overridden)).toContain(value);
        }
        expect(overridden).not.toContain(bank.wiseEmail);
        expect(visibleText(overridden)).not.toContain('Email / ID');
        expect(overridden).toContain('href="mailto:support@tendso.com"');
    });

    it('preserves the current payment-proof reply instructions and bank details in reminders', () => {
        const html = getPaymentFollowUpEmailHtml({ ...owner, websiteUrl, amount: 4999, isManual: true, paymentDetails: bank });
        expect(visibleText(html)).toContain('Already paid? Keep your confirmation and reply so we can check your transfer.');
        expect(visibleText(html)).toContain('0000000000');
        expect(html).toContain('href="mailto:support@tendso.com"');
        expect(html).not.toContain('href="mailto:custom-payments@example.com"');
    });

    it('keeps receipt, acknowledgement and giveaway help links independent of payment contact overrides', () => {
        const override = { ...owner, platformEmail: 'legacy-payments@example.com' };
        const emails = [
            getPaymentConfirmationEmailHtml({ ...owner, websiteUrl, amount: 4999, wiseEmail: 'legacy-payments@example.com' }),
            getIntakeReceivedEmailHtml({ ...override, amount: 4999 }),
            getIntakeReceivedEmailHtml({ ...override, amount: 0, giveawayApplication: true }),
            getPromoWebsiteLiveEmailHtml({ ...override, websiteUrl }),
            getPromoWebsiteLiveEmailHtml({ ...override, websiteUrl, giveawayApplication: true }),
            getGiveawayApprovedEmailHtml(override),
            getGiveawayRejectedEmailHtml({ ...override, reason: 'Please show your shop sign.', applyUrl: 'https://tendso.com/100-pages-giveaway' }),
        ];
        for (const html of emails) {
            expect(html).toContain('href="mailto:support@tendso.com"');
            expect(html).not.toContain('href="mailto:legacy-payments@example.com"');
            expect(html).not.toContain('href="mailto:payments@example.com"');
        }
    });

    it('keeps the agent payout destination intact while payout questions go to Support', () => {
        const html = getWithdrawalRequestedEmailHtml({ creatorName: 'Sam', amount: 2500,
            wiseEmail: 'agent@example.com', platformEmail: 'legacy-payments@example.com', requestedAt: 1000 });
        expect(visibleText(html)).toContain('To your Wise account at agent@example.com');
        expect(html).toContain('href="mailto:support@tendso.com"');
        expect(html).not.toContain('href="mailto:legacy-payments@example.com"');
    });
});
