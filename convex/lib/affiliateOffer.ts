import type { QueryCtx } from '../_generated/server';
import { affiliateHandleError } from '../../lib/affiliates';
import { clampSellPrice, WEBSITE_PRICE } from '../../lib/pricing';

/** Public lookup and intake share one active-account and price decision. */
export async function resolveAffiliateOffer(ctx: Pick<QueryCtx, 'db'>, handle: string) {
    if (affiliateHandleError(handle)) return null;
    const affiliate = await ctx.db.query('creators')
        .withIndex('by_affiliate_handle', (q) => q.eq('affiliateHandle', handle)).unique();
    if (!affiliate || affiliate.role !== 'affiliate' || affiliate.status !== 'active' || affiliate.isDeleted) return null;
    return { affiliate, price: clampSellPrice(affiliate.affiliatePrice ?? WEBSITE_PRICE) };
}
