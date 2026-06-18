import {
    BASE_PRICE,
    PRICE_CEILING,
    UNLOCK_THRESHOLD,
    COMMISSION_RATE,
    CUSTOM_DOMAIN_ADDON,
    STANDARD_PRICE,
    CUSTOM_DOMAIN_PRICE,
    priceCeilingFor,
    isPriceUnlocked,
    clampSellPrice,
    commissionFor,
    ownerTotal,
    domainAddOnFor,
    formatPHP,
} from '../../lib/pricing';

describe('lib/pricing — constants', () => {
    it('matches the confirmed pricing strategy (2026-06-15 call)', () => {
        expect(BASE_PRICE).toBe(999);
        expect(PRICE_CEILING).toBe(4999);
        expect(UNLOCK_THRESHOLD).toBe(5);
        expect(COMMISSION_RATE).toBe(0.5);
        expect(CUSTOM_DOMAIN_ADDON).toBe(500);
        expect(STANDARD_PRICE).toBe(999);
        expect(CUSTOM_DOMAIN_PRICE).toBe(1499);
    });
});

describe('priceCeilingFor / isPriceUnlocked', () => {
    it('caps at the base price below the unlock threshold', () => {
        expect(priceCeilingFor(0)).toBe(BASE_PRICE);
        expect(priceCeilingFor(4)).toBe(BASE_PRICE);
        expect(isPriceUnlocked(0)).toBe(false);
        expect(isPriceUnlocked(4)).toBe(false);
    });
    it('unlocks the full ceiling at and above the threshold', () => {
        expect(priceCeilingFor(5)).toBe(PRICE_CEILING);
        expect(priceCeilingFor(12)).toBe(PRICE_CEILING);
        expect(isPriceUnlocked(5)).toBe(true);
        expect(isPriceUnlocked(12)).toBe(true);
    });
});

describe('clampSellPrice', () => {
    it('keeps an in-band price for an unlocked creator', () => {
        expect(clampSellPrice(2500, 7)).toBe(2500);
    });
    it('clamps below the base up to the base', () => {
        expect(clampSellPrice(500, 7)).toBe(BASE_PRICE);
    });
    it('clamps above the ceiling down to the unlocked ceiling', () => {
        expect(clampSellPrice(9999, 7)).toBe(PRICE_CEILING);
    });
    it('locks a not-yet-unlocked creator to the base, even if they ask for more', () => {
        expect(clampSellPrice(4999, 0)).toBe(BASE_PRICE);
        expect(clampSellPrice(4999, 4)).toBe(BASE_PRICE);
    });
    it('rounds fractional input', () => {
        expect(clampSellPrice(2500.6, 7)).toBe(2501);
    });
    it('falls back to the base on non-finite input', () => {
        expect(clampSellPrice(NaN, 7)).toBe(BASE_PRICE);
        expect(clampSellPrice(Infinity, 7)).toBe(BASE_PRICE);
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
    });
    it('uses the REAL registrar price when provided', () => {
        expect(domainAddOnFor('with_custom_domain', 720)).toBe(720);
        expect(domainAddOnFor('with_custom_domain', 1280)).toBe(1280);
    });
    it('rounds a fractional real price', () => {
        expect(domainAddOnFor('with_custom_domain', 719.6)).toBe(720);
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
    it('intro creator (3 approved): locked to base, earns ₱500', () => {
        const approved = 3;
        const sell = clampSellPrice(4999, approved); // tries for max, gets base
        expect(sell).toBe(999);
        expect(commissionFor(sell)).toBe(500);
        expect(ownerTotal(sell, 'standard')).toBe(999);
    });
    it('unlocked creator (7 approved) sells at ₱2,500 + real ₱720 domain', () => {
        const approved = 7;
        const sell = clampSellPrice(2500, approved);
        expect(sell).toBe(2500);
        expect(commissionFor(sell)).toBe(1250); // creator earns 50% of sell only
        expect(ownerTotal(sell, 'with_custom_domain', 720)).toBe(3220); // 2500 + real 720
    });
    it('unlocked creator at full ceiling earns ₱2,500', () => {
        const sell = clampSellPrice(4999, 10);
        expect(sell).toBe(4999);
        expect(commissionFor(sell)).toBe(2500);
    });
});
