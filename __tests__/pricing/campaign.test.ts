import {
    CAMPAIGN_DISCOUNTS,
    WEBSITE_PRICE,
    campaignDiscountRate,
    campaignListPrice,
    campaignSellPrice,
    clampSellPrice,
    normalizeCampaign,
    ownerTotal,
} from '@/lib/pricing';
import { quoteFor } from '@/app/start/quote';

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

    it('caps a creator at the website price: no creator charges more for the website than /start does', () => {
        expect(clampSellPrice(WEBSITE_PRICE)).toBe(WEBSITE_PRICE);
        expect(clampSellPrice(WEBSITE_PRICE + 1000)).toBe(WEBSITE_PRICE);
    });
});

describe('giveaway stays separate from discount campaigns', () => {
    it.each(['giveaway', ' GIVEAWAY '])('quotes full price for the %s hint', (hint) => {
        expect(CAMPAIGN_DISCOUNTS).not.toHaveProperty('giveaway');
        expect(normalizeCampaign(hint)).toBeNull();
        expect(campaignDiscountRate(hint)).toBe(0);
        expect(campaignListPrice(hint)).toBe(WEBSITE_PRICE);
        expect(campaignSellPrice(hint)).toBe(WEBSITE_PRICE);
        expect(quoteFor(hint, false)).toMatchObject({
            total: WEBSITE_PRICE,
            discounted: false,
            code: null,
            struckTotal: null,
            percentOff: 0,
        });
        expect(quoteFor(hint, true).total).toBe(ownerTotal(WEBSITE_PRICE, 'with_custom_domain'));
    });

    it.each(['__proto__', 'constructor', 'toString'])('rejects inherited property %s as a campaign', (hint) => {
        expect(normalizeCampaign(hint)).toBeNull();
        expect(campaignSellPrice(hint)).toBe(WEBSITE_PRICE);
    });
});
