import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { isCreatorAccount } from '../lib/accounts';
import { creatorOverrideEndsAt, earnsCreatorOverride, overrideFor } from '../lib/pricing';
import { CREATOR_OVERRIDE_EARNING, isCreatorOwnSite, isPaidInFull, isPaidSale, samePerson } from './lib/creatorRecruits';
import { validatePaymentPricing } from './lib/paymentPricing';

/**
 * Credit a creator 5% of a sale made by a field agent they recruited.
 *
 * Runs after the shop has PAID IN FULL (status 'paid' or 'completed'). It
 * re-reads the submission, so a `deposit_paid` row (down payment only) is
 * skipped and must call this again once the balance is in. Safe to call any
 * number of times: one creator_override earning per submission, ever.
 *
 * Scheduled by payments.creditCreatorForPayment and submissions.markPaid.
 */
export const creditForSubmission = internalMutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) return { credited: false, reason: 'not_found' } as const;
        if (!isPaidInFull(submission)) return { credited: false, reason: 'not_paid_in_full' } as const;
        // A promo (comped) site or a giveaway brought in no money.
        if (!isPaidSale(submission)) return { credited: false, reason: 'not_a_sale' } as const;

        const seller = await ctx.db.get(submission.creatorId);
        if (!seller || !isCreatorAccount(seller)) return { credited: false, reason: 'not_field_agent' } as const;
        if (!seller.recruitedByCreatorId || seller.recruitedAt === undefined) return { credited: false, reason: 'not_recruited' } as const;
        // Recruits from before the cut-over stay on the ₱1,000 referral bonus.
        if (!earnsCreatorOverride(seller.recruitedAt)) return { credited: false, reason: 'legacy_referral' } as const;
        const legacy = await ctx.db.query('referrals').withIndex('by_referred', (q) => q.eq('referredId', seller._id)).first();
        if (legacy) return { credited: false, reason: 'legacy_referral' } as const;

        const recruiter = await ctx.db.get(seller.recruitedByCreatorId);
        // Like referral bonuses, an override already earned still settles while
        // the creator is suspended. Pending and deleted accounts earn nothing.
        if (!recruiter || recruiter.role !== 'affiliate' || recruiter.isDeleted
            || (recruiter.status !== 'active' && recruiter.status !== 'suspended')) {
            return { credited: false, reason: 'not_a_creator' } as const;
        }
        if (recruiter._id === seller._id || recruiter.clerkId === seller.clerkId || samePerson(recruiter.email, seller.email)) {
            return { credited: false, reason: 'self_referral' } as const;
        }
        // An owner never earns on their own site.
        if (isCreatorOwnSite(submission, recruiter)) {
            return { credited: false, reason: 'own_site' } as const;
        }

        const paidInFullAt = submission.paidAt ?? submission.creatorPaidAt ?? Date.now();
        if (paidInFullAt < seller.recruitedAt || paidInFullAt >= creatorOverrideEndsAt(seller.recruitedAt)) {
            return { credited: false, reason: 'outside_window' } as const;
        }

        const existing = await ctx.db.query('earnings').withIndex('by_submission', (q) => q.eq('submissionId', submission._id)).collect();
        if (existing.some((row) => row.type === CREATOR_OVERRIDE_EARNING)) return { credited: false, reason: 'already_credited' } as const;

        let websitePrice: number;
        try {
            websitePrice = validatePaymentPricing(submission).websitePrice;
        } catch {
            return { credited: false, reason: 'invalid_price' } as const;
        }
        const amount = overrideFor(websitePrice);
        if (amount <= 0) return { credited: false, reason: 'invalid_price' } as const;

        const now = Date.now();
        await ctx.db.insert('earnings', {
            creatorId: recruiter._id,
            submissionId: submission._id,
            amount,
            type: CREATOR_OVERRIDE_EARNING,
            status: 'available',
            createdAt: now,
        });
        await ctx.db.patch(recruiter._id, {
            balance: (recruiter.balance ?? 0) + amount,
            totalEarnings: (recruiter.totalEarnings ?? 0) + amount,
        });
        const sellerName = [seller.firstName, seller.lastName].filter(Boolean).join(' ') || 'Your agent';
        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: recruiter._id,
            type: 'payout_sent',
            title: 'Your team made a sale',
            body: `${sellerName} sold a website. You earned ₱${amount}.`,
            data: { submissionId: submission._id, amount, kind: CREATOR_OVERRIDE_EARNING },
        });
        return { credited: true, amount } as const;
    },
});
