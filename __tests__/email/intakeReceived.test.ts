jest.mock('@/lib/payment/config', () => ({
    getPaymentConfig: () => ({ wiseEmail: 'team@tendso.com' }),
}));

import { getIntakeReceivedEmailHtml } from '@/lib/email/templates';

const application = {
    businessName: 'Corner Studio',
    businessOwnerName: 'Sam',
    amount: 0,
};

function visibleText(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

describe('owner-intake acknowledgement email', () => {
    it('acknowledges a held giveaway slot pending eligibility review', () => {
        const text = visibleText(getIntakeReceivedEmailHtml({ ...application, giveawayApplication: true }));
        expect(text).toContain('Giveaway application received!');
        expect(text).toContain('Your slot is held while we review your eligibility and poster photo.');
        expect(text).toContain('If your application is eligible, we build your free website');
        expect(text).toContain('Tendso web address');
        expect(text).toContain('Custom domains are not included.');
        expect(text).toContain('If eligible, your website is free — nothing to pay.');
        expect(text).not.toMatch(/payment instructions|payable|GCash|Maya|only pay after|started building your website|Your Website Will Be Ready In/);
        expect(text).not.toContain('₱0');
    });

    it('uses the application flag, even if an earlier amount remains on a giveaway row', () => {
        const text = visibleText(getIntakeReceivedEmailHtml({ ...application, amount: 4999, giveawayApplication: true }));
        expect(text).toContain('Your slot is held');
        expect(text).not.toContain('₱4,999');
        expect(text).not.toContain('payment instructions');
    });

    it.each([undefined, false])('keeps paid acknowledgement wording when the giveaway flag is %s', (giveawayApplication) => {
        const text = visibleText(getIntakeReceivedEmailHtml({ ...application, amount: 4999, giveawayApplication }));
        expect(text).toContain('we have started building your website.');
        expect(text).toContain('payment instructions — ₱4,999');
        expect(text).toContain('Nothing to pay today.');
        expect(text).not.toContain('Your slot is held');
    });

    it('escapes applicant-supplied names in giveaway acknowledgement HTML', () => {
        const html = getIntakeReceivedEmailHtml({
            ...application,
            businessName: '<img src=x onerror=alert(1)>',
            businessOwnerName: '<script>alert(1)</script>',
            giveawayApplication: true,
        });
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).not.toContain('<img src=x');
        expect(html).not.toContain('<script>');
    });
});
