import { priceSplit } from '@/app/pay/[token]/_components/payState';
import { getPaymentFollowUpEmailHtml, getPaymentLinkEmailHtml } from '@/lib/email/templates';

/**
 * How a business owner is shown their creator's discount: the ₱4,999 list price
 * struck through, the creator's price, then the percentage off. Nothing more:
 * no peso amount off. On the pay page and in the two emails that ask for the
 * money. The list price is the one frozen on the sale
 * (submissions.websiteListPrice); without one nothing is struck.
 */

const STRUCK_4999 = 'text-decoration:line-through;color:#9ca3af;';

describe('pay page priceSplit', () => {
    it('finds the discount on a standard sale', () => {
        const split = priceSplit(3999, { websiteListPrice: 4999 });
        expect(split.domain).toBeNull();
        expect(split.websiteLine).toBe(3999);
        expect(split.discount).toEqual({ listPrice: 4999, price: 3999, percentOff: 20 });
    });

    it('takes the domain off before comparing with the list price', () => {
        const split = priceSplit(4719, { requestedDomain: 'shop.com', domainCostPHP: 720, websiteListPrice: 4999 });
        expect(split.addOn).toBe(720);
        expect(split.websiteLine).toBe(3999);
        expect(split.discount).toEqual({ listPrice: 4999, price: 3999, percentOff: 20 });
    });

    it('keeps an affiliate website price intact when the registrar later costs more than the owner charge', () => {
        expect(priceSplit(2499, { requestedDomain: 'shop.com', domainCostPHP: 720, domainChargedPHP: 500, websiteListPrice: 4999 })).toMatchObject({
            addOn: 500, websiteLine: 1999, discount: { listPrice: 4999, price: 1999, percentOff: 60 },
        });
    });

    it('keeps the website price intact when a standard intake later receives a domain at no additional charge', () => {
        expect(priceSplit(1999, { requestedDomain: 'shop.com', domainCostPHP: 720, domainChargedPHP: 0, websiteListPrice: 4999 })).toMatchObject({
            addOn: 0, websiteLine: 1999, discount: { price: 1999, percentOff: 60 },
        });
    });

    it('shows no discount on a sale with no frozen list price', () => {
        expect(priceSplit(999, {}).discount).toBeNull();
        expect(priceSplit(999, null).discount).toBeNull();
    });

    it('shows no discount at the full list price', () => {
        expect(priceSplit(4999, { websiteListPrice: 4999 }).discount).toBeNull();
    });
});

const base = { businessName: 'Aling Nena Store', businessOwnerName: 'Nena', referenceCode: 'ND-ABCD-EFGH' };

describe('payment link email', () => {
    it('uses the charged domain amount instead of later registrar cost in the website discount', () => {
        const html = getPaymentLinkEmailHtml({ ...base, amount: 2499, customDomain: 'shop.com', domainCostPHP: 720, domainChargedPHP: 500, websiteListPrice: 4999 });
        expect(html).toContain('margin-right:8px;">₱4,999</span>₱1,999');
        expect(html).toContain('>60% off</span>');
        expect(html).not.toContain('₱1,779');
    });

    it('strikes ₱4,999 above the total and puts the percentage under it', () => {
        const html = getPaymentLinkEmailHtml({ ...base, amount: 3999, websiteListPrice: 4999 });
        expect(html).toContain(`${STRUCK_4999}">₱4,999</span>`);
        expect(html).toContain('>20% off</span>');
        expect(html.indexOf('₱4,999')).toBeLessThan(html.indexOf('₱3,999'));
        expect(html.indexOf('₱3,999')).toBeLessThan(html.indexOf('20% off'));
    });

    it('carries no peso amount off and no sentence about it', () => {
        const html = getPaymentLinkEmailHtml({ ...base, amount: 3999, websiteListPrice: 4999 });
        expect(html).not.toContain('₱1,000');
        expect(html).not.toContain('Tendso creator');
    });

    it('strikes the website line, not the total, when a domain rides along', () => {
        const html = getPaymentLinkEmailHtml({ ...base, amount: 4719, customDomain: 'shop.com', domainCostPHP: 720, websiteListPrice: 4999 });
        expect(html).toContain('margin-right:8px;">₱4,999</span>₱3,999');
        expect(html).toContain('Website Package<br>');
        expect(html).toContain('>20% off</span>');
        expect(html).not.toContain('<p style="margin:0;font-size:20px;font-weight:700;">');
    });

    it('is unchanged for a sale with no frozen list price', () => {
        const html = getPaymentLinkEmailHtml({ ...base, amount: 999 });
        expect(html).not.toContain('line-through');
        expect(html).not.toContain('% off');
    });
});

describe('payment follow-up email', () => {
    it('preserves the affiliate website price for a later uncharged domain upgrade', () => {
        const html = getPaymentFollowUpEmailHtml({ ...base, amount: 1999, customDomain: 'shop.com', domainCostPHP: 720, domainChargedPHP: 0, websiteListPrice: 4999 });
        expect(html).toContain(`Website <span style="${STRUCK_4999}margin-right:6px;">₱4,999</span>₱1,999 · `);
        expect(html).toContain('>60% off</span>');
        expect(html).not.toContain('₱1,279');
    });

    it('strikes ₱4,999 above the amount due and puts the percentage under it', () => {
        const html = getPaymentFollowUpEmailHtml({ ...base, amount: 2499, websiteListPrice: 4999 });
        expect(html).toContain(`${STRUCK_4999}">₱4,999</span>`);
        expect(html).toContain('>50% off</span>');
        expect(html).not.toContain('₱2,500');
    });

    it('puts the website line under the total when a domain rides along', () => {
        const html = getPaymentFollowUpEmailHtml({ ...base, amount: 4719, customDomain: 'shop.com', domainCostPHP: 720, websiteListPrice: 4999 });
        expect(html).toContain(`Website <span style="${STRUCK_4999}margin-right:6px;">₱4,999</span>₱3,999 · `);
        expect(html).toContain('>20% off</span>');
    });

    it('is unchanged without a frozen list price', () => {
        const html = getPaymentFollowUpEmailHtml({ ...base, amount: 999 });
        expect(html).not.toContain('line-through');
        expect(html).not.toContain('% off');
    });
});
