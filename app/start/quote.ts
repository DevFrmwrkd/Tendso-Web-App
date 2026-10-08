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
 * campaign is charged WEBSITE_PRICE and is shown exactly that, with nothing
 * struck through. A list price is only ever shown struck, and only when lib/pricing
 * gives the campaign one of its own (CAMPAIGN_LIST_PRICES) — the figure the OTR
 * page strikes too.
 */

import {
    CAMPAIGN_CODES,
    campaignDiscountRate,
    campaignListPrice,
    campaignSellPrice,
    clampSellPrice,
    creatorDiscount,
    domainAddOnFor,
    normalizeCampaign,
    ownerTotal,
    WEBSITE_PRICE,
    type SubmissionTier,
} from "@/lib/pricing";

export interface Quote {
    giveaway: boolean;
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

export function quoteFor(campaign: string | null | undefined, wantsCustomDomain: boolean, giveaway = false, affiliatePrice?: number | null): Quote {
    if (giveaway) {
        return {
            giveaway: true, tier: "standard", listPrice: 0, sellPrice: 0,
            addOn: 0, total: 0, struckTotal: null, discounted: false,
            code: null, percentOff: 0,
        };
    }
    const tier: SubmissionTier = wantsCustomDomain ? "with_custom_domain" : "standard";
    // A selected but unavailable affiliate offer replaces an older campaign
    // with full price. Undefined alone means this is the ordinary campaign path.
    const affiliate = affiliatePrice !== undefined;
    const listPrice = affiliate ? WEBSITE_PRICE : campaignListPrice(campaign);
    const sellPrice = affiliate ? affiliatePrice === null ? WEBSITE_PRICE : clampSellPrice(affiliatePrice) : campaignSellPrice(campaign);
    const affiliateDiscount = affiliate ? creatorDiscount(sellPrice, listPrice) : null;
    const discounted = sellPrice !== listPrice;
    return {
        giveaway: false,
        tier,
        listPrice,
        sellPrice,
        addOn: domainAddOnFor(tier),
        total: ownerTotal(sellPrice, tier),
        struckTotal: discounted && tier === "standard" ? listPrice : null,
        discounted,
        code: discounted && !affiliate ? campaignCode(campaign) : null,
        percentOff: affiliate ? affiliateDiscount?.percentOff ?? 0 : Math.round(campaignDiscountRate(campaign) * 100),
    };
}

/** New receipts retain the frozen order figures, rather than consulting the
 *  affiliate's current offer or today's domain add-on on the thanks page. */
export function quoteForReceipt(receipt: {
    amount: number | null;
    campaign: string | null;
    customDomain: boolean | null;
    giveawayApplication?: boolean;
    websitePrice?: number;
    websiteListPrice?: number;
}): Quote | null {
    if (receipt.giveawayApplication) return quoteFor(null, false, true);
    if (receipt.amount === null || receipt.customDomain === null) return null;
    if (receipt.websitePrice === undefined) {
        const legacy = quoteFor(receipt.campaign, receipt.customDomain);
        return legacy.total === receipt.amount ? legacy : null;
    }
    const sellPrice = receipt.websitePrice;
    const listPrice = receipt.websiteListPrice ?? sellPrice;
    const addOn = receipt.amount - sellPrice;
    if (!Number.isFinite(sellPrice) || sellPrice < 0 || !Number.isFinite(listPrice)
        || listPrice < sellPrice || !Number.isFinite(addOn) || addOn < 0
        || (!receipt.customDomain && addOn !== 0)) return null;
    const tier = receipt.customDomain ? "with_custom_domain" : "standard";
    const discount = creatorDiscount(sellPrice, listPrice);
    return {
        giveaway: false, tier, listPrice, sellPrice, addOn, total: receipt.amount,
        struckTotal: discount && tier === "standard" ? listPrice : null,
        discounted: discount !== null,
        code: discount ? campaignCode(receipt.campaign) : null,
        percentOff: discount?.percentOff ?? 0,
    };
}
