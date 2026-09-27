import { BASE_PRICE, campaignListPrice, campaignSellPrice, ownerTotal } from '@/lib/pricing';

describe('OTR campaign', () => {
    it('discounts 30% off the ₱4,999 website', () => {
        expect(campaignListPrice('otr')).toBe(4999);
        expect(campaignSellPrice('otr')).toBe(3499);
        expect(campaignSellPrice('OTR30')).toBe(3499);
    });

    it('never discounts the domain add-on', () => {
        expect(ownerTotal(campaignSellPrice('otr'), 'with_custom_domain')).toBe(3999);
    });

    it('leaves the base price alone without a campaign', () => {
        expect(campaignListPrice(null)).toBe(BASE_PRICE);
        expect(campaignSellPrice('nope')).toBe(BASE_PRICE);
    });
});
