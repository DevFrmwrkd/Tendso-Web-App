import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import { WEBSITE_PRICE, domainAddOnFor, isComped } from '../../lib/pricing';
import { isOwnerApp, isPaidInFull } from './ownerApp';
import { creatorName, samePerson } from './creatorRecruits';
import { validatePaymentPricing } from './paymentPricing';

type Ctx = QueryCtx | MutationCtx;
export function ownerCreatorIsSelf(owner: Doc<'businessOwners'>, creator: Doc<'creators'>, submission?: Doc<'submissions'>) {
    const digits = (value: string) => value.replace(/\D/g, '').slice(-10);
    return owner.clerkId === creator.clerkId || samePerson(owner.email, creator.email)
        || samePerson(owner.phone, creator.phone, digits) || samePerson(submission?.ownerEmail, creator.email)
        || samePerson(submission?.ownerPhone, creator.phone, digits);
}

/** Repricing is allowed only before any payment/invoice can settle against the old quote. */
export async function ownerCreatorCodeBlockReason(ctx: Ctx, s: Doc<'submissions'>): Promise<string | null> {
    if (!isOwnerApp(s)) return 'Creator codes are only available for websites you make in the app.';
    if (isComped(s) || s.giveawayApplication) return 'Creator codes cannot change a free or promotional website.';
    if (isPaidInFull(s) || s.paidAt !== undefined || s.paidInFullAt !== undefined || s.creatorPaidAt !== undefined
        || s.depositPaidAt !== undefined || (s.depositAmount ?? 0) !== 0
        || (s.amountPaid !== undefined && (!Number.isFinite(s.amountPaid) || s.amountPaid !== 0))) {
        return 'This website already has a payment. Its price cannot change.';
    }
    try { validatePaymentPricing(s); } catch { return 'This website price needs to be checked by the team.'; }
    if (s.status !== 'draft') {
        if (!['submitted', 'approved', 'website_generated', 'pending_payment'].includes(s.status)
            || !s.previewReadyAt || !s.ownerApprovedAt) return 'Check your finished website before applying a creator code.';
        const open = await ctx.db.query('changeRequests').withIndex('by_submission', q => q.eq('submissionId', s._id))
            .filter(q => q.eq(q.field('status'), 'open')).first();
        if (open) return 'Finish checking your requested changes before changing the price.';
    }
    if (Object.values(s.buildSteps ?? {}).some(step => step.status === 'pending' || step.status === 'running')) {
        return 'Your website is still being built. Check it first.';
    }
    const tokens = await ctx.db.query('paymentTokens').withIndex('by_submissionId', q => q.eq('submissionId', s._id)).collect();
    // Even expired tokens can reach the existing settlement handler. Do not silently
    // invalidate an invoice or bank reference somebody may already be paying.
    if (tokens.some(token => token.status !== 'cancelled' || token.usedAt !== undefined || token.paymentReceivedAt !== undefined
        || token.wiseTransactionId || token.externalPaymentId || (token.paidAmount ?? 0) > 0)) {
        return 'A payment request already exists. Ask the team before changing this price.';
    }
    return null;
}

/** Display the saved quote, never recompute it from a creator's later price edits. */
export async function savedOwnerCreatorCode(ctx: Ctx, s: Doc<'submissions'>) {
    if (!s.affiliateHandle) return null;
    const creator = await ctx.db.get(s.creatorId);
    if (!creator || creator.role !== 'affiliate' || creator.affiliateHandle !== s.affiliateHandle) return null;
    const addon = domainAddOnFor(s.submissionType ?? 'standard', s.domainCostPHP, s.domainChargedPHP);
    const listPrice = (s.websiteListPrice ?? WEBSITE_PRICE) + addon;
    const total = s.amount ?? 0;
    return { name: creatorName(creator), code: creator.referralCode ?? null, handle: s.affiliateHandle,
        photo: creator.affiliatePhoto ?? null, listPrice, total, saving: Math.max(0, listPrice - total) };
}
