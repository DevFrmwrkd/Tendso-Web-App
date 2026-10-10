import { ConvexError, v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { mutation, query } from './_generated/server';
import { requireAdmin, requireAuth } from './lib/auth';
import {
    AFFILIATE_MESSAGE_MAX_LENGTH, affiliateHandleError, affiliatePhoneError,
    affiliatePhotoError, affiliatePriceError, affiliateSocialLinkError,
} from '../lib/affiliates';
import { clampSellPrice, ownerChargeFor } from '../lib/pricing';
import { resolveAffiliateOffer } from './lib/affiliateOffer';

/** Anonymous page data only. Private account, contact and payout data stay private. */
export const publicPage = query({
    args: { handle: v.string() },
    handler: async (ctx, args) => {
        const offer = await resolveAffiliateOffer(ctx, args.handle);
        if (!offer) return null;
        const { affiliate, price } = offer;
        return {
            handle: affiliate.affiliateHandle!,
            photo: affiliate.affiliatePhoto,
            displayName: affiliate.affiliateDisplayName?.trim()
                || [affiliate.firstName, affiliate.lastName].filter(Boolean).join(' ') || args.handle,
            message: affiliate.affiliateMessage,
            socialLink: affiliate.affiliateSocialLink,
            referralCode: affiliate.referralCode,
            price,
        };
    },
});

/** Signup has no incoming referral fields: Convex rejects extra arguments. */
export const create = mutation({
    args: {
        firstName: v.string(),
        lastName: v.optional(v.string()),
        email: v.string(),
        phone: v.string(),
        handle: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const firstName = args.firstName.trim();
        const lastName = args.lastName?.trim() || undefined;
        if (!firstName || firstName.length > 100 || (lastName && lastName.length > 100)) {
            throw new ConvexError('Enter your name (up to 100 characters).');
        }
        const email = args.email.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError('A valid account email is required.');
        if (identity.email && identity.email.toLowerCase() !== email) {
            throw new ConvexError('The account email must match your signed-in email.');
        }
        const phone = args.phone.trim();
        const phoneError = affiliatePhoneError(phone);
        if (phoneError) throw new ConvexError(phoneError);
        const handleError = affiliateHandleError(args.handle);
        if (handleError) throw new ConvexError(handleError);

        const existing = await ctx.db.query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
        if (existing && !existing.isDeleted) {
            if (existing.role !== 'affiliate') {
                throw new ConvexError('This login already has another account type. Use a different email for an affiliate account.');
            }
            return existing._id;
        }
        // Existing emails may not have been normalized by older/mobile signup.
        const sameEmail = await ctx.db.query('creators').filter((q) => q.neq(q.field('isDeleted'), true)).collect();
        if (sameEmail.some((account) => account.email.trim().toLowerCase() === email && account.role !== 'affiliate')) {
            throw new ConvexError('This email already has another account type. Use a different email for an affiliate account.');
        }
        const owners = await ctx.db.query('businessOwners').collect();
        if (owners.some((owner) => owner.clerkId === identity.subject || owner.email.trim().toLowerCase() === email)) {
            throw new ConvexError('This login or email already has a business owner account. Use a different email for an affiliate account.');
        }
        // Deleted handles remain reserved so an old shared link cannot be taken over.
        const handleOwner = await ctx.db.query('creators')
            .withIndex('by_affiliate_handle', (q) => q.eq('affiliateHandle', args.handle)).first();
        if (handleOwner) throw new ConvexError('That page handle is already taken. Choose another one.');

        let referralCode: string;
        do {
            referralCode = `AFF${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        } while (await ctx.db.query('creators')
            .withIndex('by_referral_code', (q) => q.eq('referralCode', referralCode)).first());
        if (existing?.isDeleted) {
            await ctx.db.patch(existing._id, { clerkId: `deleted_${existing._id}_${Date.now()}` });
        }
        return ctx.db.insert('creators', {
            clerkId: identity.subject,
            email,
            firstName,
            lastName,
            phone,
            affiliateHandle: args.handle,
            referralCode,
            role: 'affiliate',
            status: 'active',
            balance: 0,
            totalEarnings: 0,
            totalWithdrawn: 0,
            submissionCount: 0,
            createdAt: Date.now(),
        });
    },
});

function optionalText(value: string | undefined, maxLength: number, label: string) {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    if (trimmed.length > maxLength) throw new ConvexError(`${label} must be ${maxLength} characters or fewer.`);
    return trimmed || undefined;
}

function optionalUrl(value: string | undefined, label: string, errorFor: (value: string) => string | null) {
    const trimmed = optionalText(value, 2048, label);
    if (!trimmed) return undefined;
    const error = errorFor(trimmed);
    if (error) throw new ConvexError(error);
    return trimmed;
}

/** Save the affiliate's page settings; the public handle stays fixed. */
export const updatePage = mutation({
    args: {
        photo: v.optional(v.string()),
        displayName: v.optional(v.string()),
        message: v.optional(v.string()),
        socialLink: v.optional(v.string()),
        price: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const affiliate = await ctx.db.query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
        if (!affiliate || affiliate.role !== 'affiliate' || affiliate.isDeleted) throw new ConvexError('An affiliate account is required.');
        if (affiliate.status !== 'active') throw new ConvexError('Your affiliate account is suspended.');
        if (args.price !== undefined) {
            const priceError = affiliatePriceError(args.price);
            if (priceError) throw new ConvexError(priceError);
        }
        const updates: Partial<typeof affiliate> = { updatedAt: Date.now() };
        if (args.photo !== undefined) updates.affiliatePhoto = optionalUrl(args.photo, 'Photo', affiliatePhotoError);
        if (args.displayName !== undefined) updates.affiliateDisplayName = optionalText(args.displayName, 100, 'Display name');
        if (args.message !== undefined) updates.affiliateMessage = optionalText(args.message, AFFILIATE_MESSAGE_MAX_LENGTH, 'Short message');
        if (args.socialLink !== undefined) updates.affiliateSocialLink = optionalUrl(args.socialLink, 'Social link', affiliateSocialLinkError);
        if (args.price !== undefined) updates.affiliatePrice = clampSellPrice(args.price);
        await ctx.db.patch(affiliate._id, updates);
    },
});

/** Only the caller's sales, with frozen amounts and no owner contact details. */
export const sales = query({
    args: { paginationOpts: paginationOptsValidator },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const affiliate = await ctx.db.query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
        if (!affiliate || affiliate.role !== 'affiliate' || affiliate.isDeleted) {
            throw new ConvexError('An affiliate account is required.');
        }
        // Suspension stops new page edits, while earned sales remain readable.
        const result = await ctx.db.query('submissions')
            .withIndex('by_creator_id', (q) => q.eq('creatorId', affiliate._id))
            .order('desc').paginate(args.paginationOpts);
        return {
            ...result,
            page: result.page.map((submission) => ({
                _id: submission._id,
                businessName: submission.businessName,
                price: ownerChargeFor(submission),
                commission: submission.creatorPayout ?? 0,
                status: submission.status,
                createdAt: submission._creationTime,
            })),
        };
    },
});

/** Wallet history belongs to the signed-in affiliate, including while suspended. */
export const portal = query({
    args: {},
    handler: async (ctx) => {
        const identity = await requireAuth(ctx);
        const affiliate = await ctx.db.query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
        if (!affiliate || affiliate.role !== 'affiliate' || affiliate.isDeleted
            || (affiliate.status !== 'active' && affiliate.status !== 'suspended')) {
            throw new ConvexError('An affiliate account is required.');
        }

        const [earningRows, withdrawals, referralRows, deployed, pendingPayment] = await Promise.all([
            ctx.db.query('earnings').withIndex('by_creator', (q) => q.eq('creatorId', affiliate._id)).order('desc').collect(),
            ctx.db.query('withdrawals').withIndex('by_creator', (q) => q.eq('creatorId', affiliate._id)).order('desc').collect(),
            ctx.db.query('referrals').withIndex('by_referrer', (q) => q.eq('referrerId', affiliate._id)).order('desc').collect(),
            ctx.db.query('submissions').withIndex('by_creator_status', (q) => q.eq('creatorId', affiliate._id).eq('status', 'deployed')).collect(),
            ctx.db.query('submissions').withIndex('by_creator_status', (q) => q.eq('creatorId', affiliate._id).eq('status', 'pending_payment')).collect(),
        ]);
        const [earnings, referrals] = await Promise.all([
            Promise.all(earningRows.map(async (earning) => {
                const submission = await ctx.db.get(earning.submissionId);
                return {
                    _id: earning._id,
                    amount: earning.amount,
                    type: earning.type,
                    status: earning.status,
                    createdAt: earning.createdAt,
                    businessName: submission?.businessName ?? 'Unknown',
                };
            })),
            Promise.all(referralRows.map(async (referral) => {
                const referred = await ctx.db.get(referral.referredId);
                return {
                    _id: referral._id,
                    referredName: [referred?.firstName, referred?.lastName].filter(Boolean).join(' ') || 'Unknown',
                    status: referral.status,
                    bonusAmount: referral.bonusAmount ?? 0,
                    createdAt: referral.createdAt,
                };
            })),
        ]);

        return {
            summary: {
                // Ledger statuses are historical; withdrawals reserve balance separately.
                balance: affiliate.balance ?? 0,
                totalEarned: affiliate.totalEarnings ?? earningRows.reduce((sum, row) => sum + row.amount, 0),
                totalWithdrawn: affiliate.totalWithdrawn ?? withdrawals
                    .filter((row) => row.status === 'completed').reduce((sum, row) => sum + row.amount, 0),
                pendingCommission: [...deployed, ...pendingPayment]
                    .filter((row) => row.creatorPaidAt === undefined && (row.creatorPayout ?? 0) > 0)
                    .reduce((sum, row) => sum + row.creatorPayout!, 0),
                inFlight: withdrawals.filter((row) => row.status === 'pending' || row.status === 'processing')
                    .reduce((sum, row) => sum + row.amount, 0),
            },
            earnings,
            withdrawals,
            referrals,
            referralStats: {
                total: referrals.length,
                pending: referrals.filter((row) => row.status === 'pending').length,
                qualified: referrals.filter((row) => row.status === 'qualified').length,
                paid: referrals.filter((row) => row.status === 'paid').length,
                totalEarned: referrals.reduce((sum, row) => sum + row.bonusAmount, 0),
            },
        };
    },
});

/** Affiliate administration stays separate from creator training/approval lists. */
export const list = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        return ctx.db.query('creators').filter((q) => q.and(
            q.eq(q.field('role'), 'affiliate'), q.neq(q.field('isDeleted'), true),
        )).order('desc').collect();
    },
});
