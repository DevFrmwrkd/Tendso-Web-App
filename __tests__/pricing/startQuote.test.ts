import { quoteFor, quoteForReceipt } from '@/app/start/quote';

/**
 * What /start shows an owner. It must match what convex/ownerIntake.ts charges,
 * which is ownerTotal(campaignSellPrice(campaign), tier).
 */
describe('/start quote', () => {
    it('quotes the ₱4,999 website with no campaign, nothing struck through', () => {
        const q = quoteFor(null, false);
        expect(q.total).toBe(4999);
        expect(q.struckTotal).toBeNull();
        expect(q.discounted).toBe(false);
    });

    it('adds the ₱500 domain on top with a .com', () => {
        const q = quoteFor(null, true);
        expect(q.sellPrice).toBe(4999);
        expect(q.addOn).toBe(500);
        expect(q.total).toBe(5499);
    });

    it('takes OTR\'s 30% off the website only', () => {
        expect(quoteFor('otr', false)).toMatchObject({ total: 3499, struckTotal: 4999, code: 'OTR30', percentOff: 30 });
        expect(quoteFor('otr', true)).toMatchObject({ sellPrice: 3499, addOn: 500, total: 3999, struckTotal: null });
    });

    it('quotes an explicit giveaway as Free without a domain or discount, even with a stale OTR campaign', () => {
        expect(quoteFor('otr', true, true)).toMatchObject({
            giveaway: true, tier: 'standard', total: 0, addOn: 0,
            struckTotal: null, discounted: false, code: null, percentOff: 0,
        });
    });

    it('never treats a remembered giveaway name as a price discount', () => {
        expect(quoteFor('giveaway', false)).toMatchObject({
            giveaway: false, total: 4999, discounted: false, struckTotal: null,
        });
    });

    it('quotes an affiliate price against the website list price, overriding stale OTR', () => {
        expect(quoteFor('otr', false, false, 999)).toMatchObject({
            total: 999, listPrice: 4999, struckTotal: 4999, discounted: true, code: null, percentOff: 80,
        });
        expect(quoteFor('otr', true, false, 999)).toMatchObject({
            sellPrice: 999, addOn: 500, total: 1499, struckTotal: null, code: null,
        });
        expect(quoteFor('otr', false, false, 4999)).toMatchObject({ total: 4999, discounted: false, code: null });
    });

    it('uses full price for an unavailable selected affiliate and keeps giveaways free', () => {
        expect(quoteFor('otr', false, false, null)).toMatchObject({ total: 4999, discounted: false, code: null });
        expect(quoteFor('otr', true, false, null).total).toBe(5499);
        expect(quoteFor('otr', true, true, 999)).toMatchObject({ total: 0, addOn: 0, discounted: false });
    });

    it('keeps thanks-page discount and domain figures from the frozen sale, including older list prices', () => {
        expect(quoteForReceipt({
            amount: 999, campaign: null, customDomain: false, websitePrice: 999, websiteListPrice: 4999,
        })).toMatchObject({ total: 999, struckTotal: 4999, percentOff: 80, code: null });
        expect(quoteForReceipt({
            amount: 1699, campaign: null, customDomain: true, websitePrice: 999, websiteListPrice: 5999,
        })).toMatchObject({ total: 1699, sellPrice: 999, addOn: 700, listPrice: 5999, struckTotal: null, percentOff: 83, code: null });
    });

    it('keeps compatible legacy receipts and omits an inconsistent or unknown breakdown', () => {
        expect(quoteForReceipt({ amount: 3499, campaign: 'otr', customDomain: false })).toMatchObject({ struckTotal: 4999, code: 'OTR30' });
        expect(quoteForReceipt({ amount: null, campaign: null, customDomain: false })).toBeNull();
        expect(quoteForReceipt({ amount: 999, campaign: null, customDomain: false })).toBeNull();
        expect(quoteForReceipt({ amount: 900, campaign: null, customDomain: false, websitePrice: 999, websiteListPrice: 4999 })).toBeNull();
    });
});
