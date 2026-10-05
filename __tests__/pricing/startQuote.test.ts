import { quoteFor } from '@/app/start/quote';

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
});
