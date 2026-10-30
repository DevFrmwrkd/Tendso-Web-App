jest.mock('@/lib/payment/config', () => ({
    getPaymentConfig: () => ({ wiseEmail: 'team@tendso.com' }),
}));

import { getGiveawayApprovedEmailHtml, getIntakeReceivedEmailHtml, getPromoWebsiteLiveEmailHtml } from '@/lib/email/templates';

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
        const html = getIntakeReceivedEmailHtml({ ...application, giveawayApplication: true });
        const text = visibleText(html);
        expect(html).toContain('src="https://tendso.com/email/giveaway-received.png"');
        expect(html).toContain('alt="Salamat! Off the Record received your application."');
        expect(text).toContain('Awaiting review');
        expect(text).toContain('Your slot is held while Off the Record reviews your eligibility and poster photo.');
        expect(text).toContain('If your application qualifies, Off the Record approves it and Tendso builds your free website. You get an email at each step.');
        expect(text).toContain('A gift from Off the Record. Websites built by Tendso.');
        expect(text).not.toContain('We will email you when your application has been reviewed.');
        expect(text).not.toContain('48&ndash;72 hours');
        expect(text).toContain('Tendso web address');
        expect(text).toContain('Custom domains are not included.');
        expect(text).toContain('If eligible, your website is free — nothing to pay.');
        expect(text).not.toMatch(/payment instructions|payable|GCash|Maya|only pay after|started building your website|Your Website Will Be Ready/);
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

    it('tells the owner OTR approved them and that the build has started, without a price or payment', () => {
        const html = getGiveawayApprovedEmailHtml({ businessName: 'Corner Studio', businessOwnerName: 'Sam' });
        const text = visibleText(html);
        expect(html).toContain('src="https://tendso.com/email/giveaway-approved.png"');
        expect(text).toContain('Good news, Sam ,');
        expect(text).toContain('Off the Record checked your poster photo and approved Corner Studio for a free website.');
        expect(text).toContain('Tendso is building it now');
        expect(text).toContain('Approved by OTR');
        expect(text).toContain('A gift from Off the Record. Websites built by Tendso.');
        expect(text).toContain('Still free — nothing to pay.');
        expect(text).not.toMatch(/payment instructions|payable|GCash|Maya|₱4,999/);
    });

    it('escapes applicant-supplied names in the approval email', () => {
        const html = getGiveawayApprovedEmailHtml({ businessName: '<img src=x>', businessOwnerName: '<script>x</script>' });
        expect(html).toContain('&lt;img src=x&gt;');
        expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
        expect(html).not.toContain('<img src=x>');
        expect(html).not.toContain('<script>');
    });

    it('identifies the campaign giver and product in the free website delivery email', () => {
        const html = getPromoWebsiteLiveEmailHtml({
            ...application, websiteUrl: 'https://corner.sites.tendso.com', creatorName: 'Tendso', giveawayApplication: true,
        });
        const text = visibleText(html);
        expect(html).toContain('src="https://tendso.com/email/giveaway-live.png"');
        expect(html).toContain('href="https://corner.sites.tendso.com"');
        expect(text).toContain('OFF THE RECORD');
        expect(text).toContain('A gift from Off the Record for Corner Studio. Built by Tendso.');
        expect(text).toContain('a free Tendso website');
        expect(text).toContain('There is nothing for you to pay.');
        expect(text).not.toContain('under our current promo');
    });

    it('keeps ordinary creator gift emails separate from the OTR campaign', () => {
        const text = visibleText(getPromoWebsiteLiveEmailHtml({
            ...application, websiteUrl: 'https://corner.sites.tendso.com', creatorName: 'Sam Creator',
        }));
        expect(text).toContain('Sam Creator');
        expect(text).toContain('under our current promo');
        expect(text).not.toContain('Off the Record');
    });
});
