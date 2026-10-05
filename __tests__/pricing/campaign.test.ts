import { BASE_PRICE, WEBSITE_PRICE, campaignListPrice, campaignSellPrice, clampSellPrice, ownerTotal } from '@/lib/pricing';

describe('OTR campaign', () => {
    it('discounts 30% off the ₱4,999 website', () => {
        expect(campaignListPrice('otr')).toBe(4999);
        expect(campaignSellPrice('otr')).toBe(3499);
        expect(campaignSellPrice('OTR30')).toBe(3499);
    });

    it('never discounts the domain add-on', () => {
        expect(ownerTotal(campaignSellPrice('otr'), 'with_custom_domain')).toBe(3999);
    });
});

describe('self-serve price (no campaign)', () => {
    it('is the ₱4,999 website price', () => {
        expect(WEBSITE_PRICE).toBe(4999);
        expect(campaignListPrice(null)).toBe(WEBSITE_PRICE);
        expect(campaignSellPrice(null)).toBe(WEBSITE_PRICE);
    });

    it('treats an unknown campaign as no campaign', () => {
        expect(campaignListPrice('nope')).toBe(WEBSITE_PRICE);
        expect(campaignSellPrice('nope')).toBe(WEBSITE_PRICE);
    });

    it('adds the domain on top, undiscounted', () => {
        expect(ownerTotal(campaignSellPrice(null), 'standard')).toBe(4999);
        expect(ownerTotal(campaignSellPrice(null), 'with_custom_domain')).toBe(5499);
    });

    it('leaves the creator band alone: a new creator still starts at the base price', () => {
        expect(clampSellPrice(WEBSITE_PRICE, 0)).toBe(BASE_PRICE);
    });
});
