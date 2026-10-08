import {
    BASE_PRICE,
    PRICE_CEILING,
    COMMISSION_RATE,
    CUSTOM_DOMAIN_ADDON,
    STANDARD_PRICE,
    CUSTOM_DOMAIN_PRICE,
    WEBSITE_PRICE,
    clampSellPrice,
    creatorDiscount,
    commissionFor,
    ownerTotal,
    domainAddOnFor,
    formatPHP,
} from '../../lib/pricing';

describe('lib/pricing — constants', () => {
    it('matches the confirmed pricing strategy (2026-06-15 call)', () => {
        expect(BASE_PRICE).toBe(999);
        expect(PRICE_CEILING).toBe(4999);
        expect(COMMISSION_RATE).toBe(0.5);
        expect(CUSTOM_DOMAIN_ADDON).toBe(500);
        expect(STANDARD_PRICE).toBe(999);
        expect(CUSTOM_DOMAIN_PRICE).toBe(1499);
    });
});

describe('clampSellPrice', () => {
    it('keeps an in-band price', () => {
        expect(clampSellPrice(2500)).toBe(2500);
    });
    it('allows both ends of the band, with nothing to unlock first', () => {
        expect(clampSellPrice(BASE_PRICE)).toBe(BASE_PRICE);
        expect(clampSellPrice(PRICE_CEILING)).toBe(PRICE_CEILING);
    });
    it('clamps below the base up to the base', () => {
        expect(clampSellPrice(500)).toBe(BASE_PRICE);
    });
    it('clamps above the ceiling down to the ceiling', () => {
        expect(clampSellPrice(9999)).toBe(PRICE_CEILING);
    });
    it('rounds fractional input', () => {
        expect(clampSellPrice(2500.6)).toBe(2501);
    });
    it('falls back to the base on non-finite input', () => {
        expect(clampSellPrice(NaN)).toBe(BASE_PRICE);
        expect(clampSellPrice(Infinity)).toBe(BASE_PRICE);
    });
});

describe('creatorDiscount', () => {
    it('is the list price struck against the creator price', () => {
        expect(creatorDiscount(3999, WEBSITE_PRICE)).toEqual({ listPrice: 4999, price: 3999, percentOff: 20 });
    });
    it('rounds the percentage on the ₱100 slider steps', () => {
        expect(creatorDiscount(999, WEBSITE_PRICE)?.percentOff).toBe(80);   // 80.016
        expect(creatorDiscount(2499, WEBSITE_PRICE)?.percentOff).toBe(50);  // 50.01
        expect(creatorDiscount(4899, WEBSITE_PRICE)?.percentOff).toBe(2);   // 2.0004
    });
    it('strikes nothing at the full list price', () => {
        expect(creatorDiscount(WEBSITE_PRICE, WEBSITE_PRICE)).toBeNull();
    });
    it('strikes nothing without a frozen list price (self-serve, or priced before the change)', () => {
        expect(creatorDiscount(999, undefined)).toBeNull();
        expect(creatorDiscount(999, null)).toBeNull();
        expect(creatorDiscount(999, 0)).toBeNull();
    });
    it('strikes nothing when the price is above the list price or not a price', () => {
        expect(creatorDiscount(5499, WEBSITE_PRICE)).toBeNull();
        expect(creatorDiscount(0, WEBSITE_PRICE)).toBeNull();
        expect(creatorDiscount(NaN, WEBSITE_PRICE)).toBeNull();
    });
});

describe('commissionFor', () => {
    it('reconciles the meeting math', () => {
        expect(commissionFor(999)).toBe(500);   // ≈ old flat video rate (499.5 → 500)
        expect(commissionFor(4999)).toBe(2500);  // the recurring "₱2,500" (2499.5 → 2500)
    });
    it('is 50% across the band', () => {
        expect(commissionFor(1999)).toBe(1000);  // 999.5 → 1000
        expect(commissionFor(2500)).toBe(1250);
        expect(commissionFor(3999)).toBe(2000);  // 1999.5 → 2000
    });
});

describe('domainAddOnFor', () => {
    it('is 0 for the standard tier regardless of any price', () => {
        expect(domainAddOnFor('standard')).toBe(0);
        expect(domainAddOnFor('standard', 720)).toBe(0);
        expect(domainAddOnFor('standard', 720, 500)).toBe(0);
    });
    it('uses the REAL registrar price when provided', () => {
        expect(domainAddOnFor('with_custom_domain', 720)).toBe(720);
        expect(domainAddOnFor('with_custom_domain', 1280)).toBe(1280);
    });
    it('rounds a fractional real price', () => {
        expect(domainAddOnFor('with_custom_domain', 719.6)).toBe(720);
    });
    it('uses the frozen owner charge ahead of later registrar costs, including a zero charge', () => {
        expect(domainAddOnFor('with_custom_domain', 720, 500)).toBe(500);
        expect(domainAddOnFor('with_custom_domain', 720, 0)).toBe(0);
        expect(domainAddOnFor('with_custom_domain', 720, 499.6)).toBe(500);
    });
    it.each([undefined, null, -1, NaN, Infinity])('preserves the legacy real-cost fallback for an invalid frozen charge %p', (charge) => {
        expect(domainAddOnFor('with_custom_domain', 720, charge)).toBe(720);
    });
    it('falls back to the flat add-on when no real price is known', () => {
        expect(domainAddOnFor('with_custom_domain')).toBe(CUSTOM_DOMAIN_ADDON);
        expect(domainAddOnFor('with_custom_domain', 0)).toBe(CUSTOM_DOMAIN_ADDON);
        expect(domainAddOnFor('with_custom_domain', -5)).toBe(CUSTOM_DOMAIN_ADDON);
        expect(domainAddOnFor('with_custom_domain', NaN)).toBe(CUSTOM_DOMAIN_ADDON);
    });
});

describe('ownerTotal', () => {
    it('is just the sell price for the standard tier', () => {
        expect(ownerTotal(2500, 'standard')).toBe(2500);
        expect(ownerTotal(999, 'standard')).toBe(999);
    });
    it('adds the REAL domain price when provided', () => {
        expect(ownerTotal(2500, 'with_custom_domain', 720)).toBe(3220);
        expect(ownerTotal(4999, 'with_custom_domain', 1280)).toBe(6279);
    });
    it('falls back to the flat add-on when no real price is passed', () => {
        expect(ownerTotal(2500, 'with_custom_domain')).toBe(3000);
        expect(ownerTotal(999, 'with_custom_domain')).toBe(1499);
    });
    it('never lets the domain enter the commission base', () => {
        // Owner pays sell + real domain, but commission is on sell only.
        const sell = 2500;
        expect(ownerTotal(sell, 'with_custom_domain', 720)).toBe(sell + 720);
        expect(commissionFor(sell)).toBe(1250); // unchanged by any domain price
    });
});

describe('formatPHP', () => {
    it('formats with a peso sign and thousands separators', () => {
        expect(formatPHP(999)).toBe('₱999');
        expect(formatPHP(4999)).toBe('₱4,999');
        expect(formatPHP(1250)).toBe('₱1,250');
        expect(formatPHP(1000000)).toBe('₱1,000,000');
    });
    it('rounds before formatting', () => {
        expect(formatPHP(2499.5)).toBe('₱2,500');
    });
});

describe('end-to-end pricing scenarios', () => {
    it('a creator at the base price earns ₱500', () => {
        const sell = clampSellPrice(999);
        expect(sell).toBe(999);
        expect(commissionFor(sell)).toBe(500);
        expect(ownerTotal(sell, 'standard')).toBe(999);
    });
    it('a creator sells at ₱2,500 + real ₱720 domain', () => {
        const sell = clampSellPrice(2500);
        expect(sell).toBe(2500);
        expect(commissionFor(sell)).toBe(1250); // creator earns 50% of sell only
        expect(ownerTotal(sell, 'with_custom_domain', 720)).toBe(3220); // 2500 + real 720
    });
    it('a creator on their first site can sell at the full ₱4,999 and earn ₱2,500', () => {
        const sell = clampSellPrice(4999);
        expect(sell).toBe(4999);
        expect(commissionFor(sell)).toBe(2500);
    });
});
