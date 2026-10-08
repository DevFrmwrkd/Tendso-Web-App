/**
 * ════════════════════════════════════════════════════════════════════════════
 *  PRICING — SINGLE SOURCE OF TRUTH  (all amounts in PHP ₱)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Confirmed 2026-06-15 (creator-compensation & pricing strategy call):
 *
 *    • Base website price ............ ₱999   (a creator's starting sell price)
 *    • Creators set their OWN price within a band. The ceiling unlocked from
 *      ₱999 → ₱4,999 after 5 *approved* submissions (removed 2026-10-06, below).
 *    • Creator commission ............ 50% of the website sell price.
 *    • Custom domain ................. flat ₱500 add-on (registrar pass-through,
 *                                      NOT subject to the 50% commission).
 *    • Referral bonus ................ ₱1,000 on a referred creator's first
 *                                      paid submission.
 *
 *  Updated 2026-10-05 (Round 1 redesign):
 *
 *    • The website price is ₱4,999 (WEBSITE_PRICE). That is what an owner pays
 *      on /start with no campaign, and the price the landing shows. A creator
 *      can discount their own offer down to BASE_PRICE (₱999).
 *
 *  Updated 2026-10-06:
 *
 *    • No unlock. Every creator prices each sale anywhere from BASE_PRICE
 *      (₱999) to PRICE_CEILING (₱4,999), starting with their first site.
 *    • A sale starts at the full list price (WEBSITE_PRICE, 0% off) and the
 *      creator discounts down from there. The owner's bill strikes the list
 *      price through, then shows the creator's price and the percentage off
 *      (creatorDiscount).
 *
 *  Change a number HERE and it propagates to the landing pages, the submit
 *  flow, the payout math, and the transactional emails. Do NOT re-hardcode
 *  any of these values anywhere else — import from this module instead.
 *
 *  Math sanity check (reconciles the meeting):
 *    commissionFor(999)  = 500   (≈ the old flat video rate — continuous)
 *    commissionFor(4999) = 2500  (the "₱2,500" that kept recurring in the call)
 */

/** The lowest price a creator may charge. */
export const BASE_PRICE = 999;

/** The highest price a creator may charge. */
export const PRICE_CEILING = 4999;

/**
 * The website's price: what a business owner pays on /start with no campaign
 * and no creator, and the figure the landing quotes. Campaigns discount it
 * (OTR is 30% off), and a creator may offer less, down to BASE_PRICE.
 */
export const WEBSITE_PRICE = PRICE_CEILING;

/** Creator's share of the website sell price (domain add-on excluded). */
export const COMMISSION_RATE = 0.5;

/** Flat add-on charged to the owner for a custom domain (year 1 + setup). */
export const CUSTOM_DOMAIN_ADDON = 500;

/** One-time bonus when a referred creator lands their first paid submission. */
export const REFERRAL_BONUS = 1000;

/**
 * ── CAMPAIGN DISCOUNTS ──────────────────────────────────────────────────────
 *
 * A campaign takes a percentage off the WEBSITE price and never off the custom
 * domain. The domain is a registrar pass-through we buy at cost, so discounting
 * it would mean paying part of someone's registration fee.
 *
 * The keys are the only values the server accepts. Anything else is no campaign
 * at all, which is what makes it safe for the discount to arrive from a URL.
 * Giveaway applications are handled separately and never belong in this table.
 */
export const CAMPAIGN_DISCOUNTS: Record<string, number> = {
    /** Off The Record: viewers scan a QR in the episode and in stores. */
    otr: 0.3,
};

/**
 * The price a campaign's discount is taken from, when it is not WEBSITE_PRICE.
 *
 * OTR is sold as the full ₱4,999 website at 30% off (₱3,499), not as the ₱999
 * starter at 30% off.
 */
export const CAMPAIGN_LIST_PRICES: Record<string, number> = {
    otr: PRICE_CEILING,
};

/**
 * Codes people can type when the automatic discount did not stick.
 *
 * It usually does stick, so this is a fallback rather than a coupon field:
 * cleared site data, a different phone, or a link copied without its query.
 */
export const CAMPAIGN_CODES: Record<string, string> = {
    OTR30: 'otr',
};

/** A campaign name or typed code, resolved to a campaign we actually run. */
export function normalizeCampaign(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(CAMPAIGN_DISCOUNTS, lower)) return lower;
    const code = trimmed.toUpperCase();
    const fromCode = Object.prototype.hasOwnProperty.call(CAMPAIGN_CODES, code) ? CAMPAIGN_CODES[code] : null;
    return fromCode ?? null;
}

/** 0 when there is no campaign, so every caller can multiply unconditionally. */
export function campaignDiscountRate(campaign?: string | null): number {
    const key = normalizeCampaign(campaign);
    return key ? CAMPAIGN_DISCOUNTS[key] : 0;
}

/**
 * The undiscounted website price for a campaign: WEBSITE_PRICE when it sets
 * none, and with no campaign at all. This is the self-serve price: /start
 * quotes it and convex/ownerIntake.ts charges it.
 */
export function campaignListPrice(campaign?: string | null): number {
    const key = normalizeCampaign(campaign);
    return (key && CAMPAIGN_LIST_PRICES[key]) || WEBSITE_PRICE;
}

/**
 * The website price after a campaign, rounded to the peso.
 *
 * Starts from the campaign's own list price unless a sell price is passed, so a
 * creator's own price would discount correctly too if a campaign is ever pointed
 * at that funnel.
 */
export function campaignSellPrice(
    campaign?: string | null,
    sellPrice: number = campaignListPrice(campaign),
): number {
    const rate = campaignDiscountRate(campaign);
    if (!rate) return sellPrice;
    return Math.round(sellPrice * (1 - rate));
}

export type SubmissionTier = 'standard' | 'with_custom_domain';

/**
 * ── PROMO / COMPED SITES ────────────────────────────────────────────────────
 *
 * A comped submission is a website the business owner received for free. The
 * creator is still paid their full commission — the promo gives away the sale,
 * never the creator's earnings.
 *
 * The rule that matters everywhere: **absent means paid.** Every submission
 * written before the promo existed, and every ordinary sale since, leaves
 * `pricingMode` unset. A reader that treats `undefined` as anything other than
 * a normal paid sale will either hide real revenue or pay out on nothing, so
 * the check lives here once instead of as a bare `=== 'comped'` in each caller.
 */
export type PricingMode = 'paid' | 'comped';

export const PRICING_MODE_COMPED: PricingMode = 'comped';

/** True when the business owner was charged nothing for this website. */
export function isComped(row: { pricingMode?: string | null } | null | undefined): boolean {
    return row?.pricingMode === PRICING_MODE_COMPED;
}

/**
 * What the owner was actually charged — ₱0 for a promo site, otherwise the
 * submission's stored total. Creator-led comped rows keep the list price in
 * `amount` (the creator's commission is derived from it); owner-intake giveaway
 * rows use 0 from submission. Revenue readers must go through this rather than
 * reading `amount` directly.
 */
export function ownerChargeFor(
    row: { pricingMode?: string | null; amount?: number | null } | null | undefined,
): number {
    if (!row || isComped(row)) return 0;
    return row.amount ?? 0;
}

/**
 * Owner total for a creator-led site at the base price (no custom domain): the
 * default amount a creator's submission starts from. Not the self-serve price,
 * which is WEBSITE_PRICE (see campaignListPrice).
 */
export const STANDARD_PRICE = BASE_PRICE; // ₱999

/** Owner total for the base price + a custom domain. */
export const CUSTOM_DOMAIN_PRICE = BASE_PRICE + CUSTOM_DOMAIN_ADDON; // ₱1,499

/**
 * Clamp a creator's chosen sell price into the band every creator has:
 * [BASE_PRICE, PRICE_CEILING], rounded to the peso.
 */
export function clampSellPrice(desired: number): number {
    if (!Number.isFinite(desired)) return BASE_PRICE;
    return Math.min(Math.max(Math.round(desired), BASE_PRICE), PRICE_CEILING);
}

/**
 * A creator's discount on the website, as the owner is shown it: the list price
 * struck through, the creator's price, then the percentage off ("₱4,999 ₱3,999
 * 20% off"). No peso amount off is shown.
 */
export interface CreatorDiscount {
    /** The figure struck through. */
    listPrice: number;
    /** The creator's price for the website (the domain add-on excluded). */
    price: number;
    /** Rounded: ₱3,999 against ₱4,999 is 20. */
    percentOff: number;
}

/**
 * The discount to show the owner beside the creator's price, or null when
 * there is nothing to strike through.
 *
 * `listPrice` is the one frozen on the sale (submissions.websiteListPrice, set
 * when the creator set their price), never today's WEBSITE_PRICE: a self-serve
 * order or a sale priced before 2026-10-06 carries none and shows no strike,
 * and a sale at the full list price shows none either.
 */
export function creatorDiscount(websitePrice: number, listPrice: number | null | undefined): CreatorDiscount | null {
    if (!listPrice || !Number.isFinite(websitePrice) || websitePrice <= 0 || websitePrice >= listPrice) return null;
    return { listPrice, price: websitePrice, percentOff: Math.round(((listPrice - websitePrice) / listPrice) * 100) };
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
