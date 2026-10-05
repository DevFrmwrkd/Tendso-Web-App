/**
 * What /start tells the owner they will pay, in one place.
 *
 * Every figure the funnel shows — the rail, the price card on the last step,
 * the two web-address options, the thanks page — is read off a Quote, and every
 * number in a Quote is one lib/pricing itself produces. Nothing here is typed in
 * by hand, and nothing here decides a price: the mutation resolves the campaign
 * again and works the amount out itself (convex/ownerIntake.ts). This only keeps
 * the screens from quoting the same sale four slightly different ways.
 *
 * QUOTE WHAT IS CHARGED, NOT WHAT A PAGE ELSEWHERE SAYS. An owner with no
 * campaign is charged BASE_PRICE and is shown exactly that, with nothing struck
 * through. A list price is only ever shown struck, and only when lib/pricing
 * gives the campaign one of its own (CAMPAIGN_LIST_PRICES) — the figure the OTR
 * page strikes too.
 */

import {
    CAMPAIGN_CODES,
    campaignDiscountRate,
    campaignListPrice,
    campaignSellPrice,
    domainAddOnFor,
    normalizeCampaign,
    ownerTotal,
    type SubmissionTier,
} from "@/lib/pricing";

export interface Quote {
    tier: SubmissionTier;
    /** The website half before any campaign. */
    listPrice: number;
    /** The website half after the campaign. The domain is never discounted. */
    sellPrice: number;
    /** The custom-domain add-on; 0 on the standard tier. */
    addOn: number;
    /** What the payment email will ask for. */
    total: number;
    /** The figure to strike through beside `total`, or null. Only on the
     *  standard tier, where `total` is the website alone and the campaign's
     *  list price is the list price of exactly that. With a .com the total also
     *  holds the add-on, which no campaign touches, so the strike moves to the
     *  website's own line of the breakdown rather than standing beside a sum it
     *  is not the list price of. */
    struckTotal: number | null;
    discounted: boolean;
    /** The code the discount is shown under ("OTR30"), or null with no discount. */
    code: string | null;
    /** 30 for thirty percent off; 0 with no campaign. */
    percentOff: number;
}

/**
 * The code an owner would type for a campaign: the reverse of CAMPAIGN_CODES.
 * Shown beside the discount because it is what the OTR episode and the poster
 * print, so it is the name the owner already knows the offer by.
 */
export function campaignCode(campaign: string | null | undefined): string | null {
    const key = normalizeCampaign(campaign);
    if (!key) return null;
    const typed = Object.keys(CAMPAIGN_CODES).find((code) => CAMPAIGN_CODES[code] === key);
    return typed ?? key.toUpperCase();
}

export function quoteFor(campaign: string | null | undefined, wantsCustomDomain: boolean): Quote {
    const tier: SubmissionTier = wantsCustomDomain ? "with_custom_domain" : "standard";
    const listPrice = campaignListPrice(campaign);
    const sellPrice = campaignSellPrice(campaign);
    const discounted = sellPrice !== listPrice;
    return {
        tier,
        listPrice,
        sellPrice,
        addOn: domainAddOnFor(tier),
        total: ownerTotal(sellPrice, tier),
        struckTotal: discounted && tier === "standard" ? listPrice : null,
        discounted,
        code: discounted ? campaignCode(campaign) : null,
        percentOff: Math.round(campaignDiscountRate(campaign) * 100),
    };
}
