/**
 * ════════════════════════════════════════════════════════════════════════════
 *  PRICING — SINGLE SOURCE OF TRUTH  (all amounts in PHP ₱)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Confirmed 2026-06-15 (creator-compensation & pricing strategy call):
 *
 *    • Base website price ............ ₱999   (a creator's starting sell price)
 *    • Creators set their OWN price within a band. The ceiling unlocks from
 *      ₱999 → ₱4,999 after UNLOCK_THRESHOLD *approved* submissions.
 *    • Creator commission ............ 50% of the website sell price.
 *    • Custom domain ................. flat ₱500 add-on (registrar pass-through,
 *                                      NOT subject to the 50% commission).
 *    • Referral bonus ................ ₱1,000 on a referred creator's first
 *                                      paid submission.
 *
 *  Change a number HERE and it propagates to the landing pages, the submit
 *  flow, the payout math, and the transactional emails. Do NOT re-hardcode
 *  any of these values anywhere else — import from this module instead.
 *
 *  Math sanity check (reconciles the meeting):
 *    commissionFor(999)  = 500   (≈ the old flat video rate — continuous)
 *    commissionFor(4999) = 2500  (the "₱2,500" that kept recurring in the call)
 */

/** Default / minimum website sell price. Every creator starts here. */
export const BASE_PRICE = 999;

/** Maximum a creator may charge once their price ceiling is unlocked. */
export const PRICE_CEILING = 4999;

/** Number of *approved* submissions that unlocks the full PRICE_CEILING. */
export const UNLOCK_THRESHOLD = 5;

/** Creator's share of the website sell price (domain add-on excluded). */
export const COMMISSION_RATE = 0.5;

/** Flat add-on charged to the owner for a custom domain (year 1 + setup). */
export const CUSTOM_DOMAIN_ADDON = 500;

/** One-time bonus when a referred creator lands their first paid submission. */
export const REFERRAL_BONUS = 1000;

export type SubmissionTier = 'standard' | 'with_custom_domain';

/** Owner total for the standard tier (no custom domain). */
export const STANDARD_PRICE = BASE_PRICE; // ₱999

/** Owner total for the base price + a custom domain. */
export const CUSTOM_DOMAIN_PRICE = BASE_PRICE + CUSTOM_DOMAIN_ADDON; // ₱1,499

/**
 * A creator's current maximum sell price, given how many *approved*
 * submissions they have. Below the threshold they're capped at the base price.
 */
export function priceCeilingFor(approvedSubmissionCount: number): number {
    return approvedSubmissionCount >= UNLOCK_THRESHOLD ? PRICE_CEILING : BASE_PRICE;
}

/** True once a creator has earned the right to charge above the base price. */
export function isPriceUnlocked(approvedSubmissionCount: number): boolean {
    return approvedSubmissionCount >= UNLOCK_THRESHOLD;
}

/**
 * Clamp a desired sell price into the creator's allowed band:
 * [BASE_PRICE, priceCeilingFor(approvedSubmissionCount)].
 */
export function clampSellPrice(desired: number, approvedSubmissionCount: number): number {
    const ceiling = priceCeilingFor(approvedSubmissionCount);
    if (!Number.isFinite(desired)) return BASE_PRICE;
    return Math.min(Math.max(Math.round(desired), BASE_PRICE), ceiling);
}

/** Creator's payout = 50% of the website sell price (domain add-on excluded). */
export function commissionFor(sellPrice: number): number {
    return Math.round(sellPrice * COMMISSION_RATE);
}

/**
 * Total the business owner pays = sell price + the custom-domain add-on.
 *
 * The add-on is the domain's REAL registrar price when known (passed in as
 * `domainPricePHP` — the value /api/check-domain returns), falling back to the
 * flat CUSTOM_DOMAIN_ADDON only when a real price isn't available. The domain is
 * a registrar pass-through and is NEVER part of the 50% commission (see
 * commissionFor, which takes the sell price only).
 */
export function domainAddOnFor(tier: SubmissionTier, domainPricePHP?: number | null): number {
    if (tier !== 'with_custom_domain') return 0;
    if (typeof domainPricePHP === 'number' && Number.isFinite(domainPricePHP) && domainPricePHP > 0) {
        return Math.round(domainPricePHP);
    }
    return CUSTOM_DOMAIN_ADDON;
}

export function ownerTotal(sellPrice: number, tier: SubmissionTier, domainPricePHP?: number | null): number {
    return sellPrice + domainAddOnFor(tier, domainPricePHP);
}

/**
 * Format a PHP amount for display, e.g. 999 → "₱999", 4999 → "₱4,999".
 * Manual thousands-separator (no Intl) so it's safe in the Convex runtime too.
 */
export function formatPHP(amount: number): string {
    const n = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `₱${n}`;
}
