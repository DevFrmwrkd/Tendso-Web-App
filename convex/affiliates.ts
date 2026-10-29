import { ConvexError, v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { mutation, query, type QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { requireAdmin, requireAuth } from './lib/auth';
import {
    AFFILIATE_MESSAGE_MAX_LENGTH, affiliateHandleError, affiliatePhoneError,
    affiliatePhotoError, affiliatePriceError, affiliateSocialLinkError,
} from '../lib/affiliates';
import { clampSellPrice, creatorOverrideEndsAt, earnsCreatorOverride, ownerChargeFor } from '../lib/pricing';
import { CREATOR_OVERRIDE_EARNING } from './lib/creatorRecruits';
import { manilaMonth } from './creatorPortal';
import { resolveAffiliateOffer } from './lib/affiliateOffer';
import { insertAffiliateAccount } from './lib/affiliateSignup';

/** Calendar selection affects displayed income only, never balances or eligibility. */
function selectedManilaMonth(value: string | undefined, now: number) {
    if (value === undefined) return manilaMonth(now);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0, 4)) < 2000) {
        throw new ConvexError('Choose a valid calendar month.');
    }
    const month = manilaMonth(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1));
    if (month.start > manilaMonth(now).start) throw new ConvexError('Choose this month or an earlier month.');
    return month;
}

/** Optional additive field keeps older clients compatible with the portal shape. */
function creditedLifetime(amount: number): { creditedTotalEarned?: number } {
    return { creditedTotalEarned: amount };
}

/** Development presentation only. Commission eligibility never reads this map. */
function devBarPreviewFor(ctx: Pick<QueryCtx, 'db'>, affiliate: Doc<'creators'>): ReadonlyMap<string, number> | null {
    if (process.env.CONVEX_CLOUD_URL !== 'https://diligent-ibex-454.convex.cloud'
        || !affiliate.email.trim().toLowerCase().endsWith('+clerk_test@example.com')) return null;
    const raw = process.env.DEV_AFFILIATE_BAR_PREVIEW;
    if (!raw || raw.length > 8192) return null;
    try {
        const config: unknown = JSON.parse(raw);
        if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
        const value = config as Record<string, unknown>;
        if (Object.keys(value).sort().join(',') !== 'clerkId,creatorId,monthsLeftByRecruit'
            || value.clerkId !== affiliate.clerkId || value.creatorId !== affiliate._id) return null;
        const months = value.monthsLeftByRecruit;
        if (!months || typeof months !== 'object' || Array.isArray(months)) return null;
        const entries = Object.entries(months);
        if (!entries.every(([id, amount]) => id.length > 0 && id.length <= 256
            && ctx.db.normalizeId('creators', id) !== null
            && typeof amount === 'number' && Number.isInteger(amount) && amount >= 0 && amount <= 12)) return null;
        return new Map(entries as [string, number][]);
    } catch {
        return null;
    }
}

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

        return insertAffiliateAccount(ctx, identity, { firstName, lastName, email, phone, handle: args.handle });
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
        if (!affiliate || affiliate.role !== 'affiliate' || affiliate.isDeleted || affiliate.status === 'deleted') throw new ConvexError('An affiliate account is required.');
        if (affiliate.status === 'pending') throw new ConvexError('Your affiliate account is waiting for admin approval.');
        if (affiliate.status === 'suspended') throw new ConvexError('Your affiliate account is suspended.');
        if (affiliate.status !== 'active') throw new ConvexError('Your affiliate account is not active.');
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
    args: { paginationOpts: paginationOptsValidator, month: v.optional(v.string()), status: v.optional(v.literal('paid')) },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const affiliate = await ctx.db.query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
        if (!affiliate || affiliate.role !== 'affiliate' || affiliate.isDeleted || affiliate.status === 'deleted') {
            throw new ConvexError('An affiliate account is required.');
        }
        if (affiliate.status === 'pending') throw new ConvexError('Your affiliate account is waiting for admin approval.');
        if (affiliate.status !== 'active' && affiliate.status !== 'suspended') {
            throw new ConvexError('An affiliate account is required.');
        }
        // Suspension stops new page edits, while earned sales remain readable.
        const month = args.month === undefined ? undefined : selectedManilaMonth(args.month, Date.now());
        const creditedIds = month ? new Set((await ctx.db.query('earnings')
            .withIndex('by_creator', (q) => q.eq('creatorId', affiliate._id)).collect())
            .filter(row => row.type === 'submission_approved' && (row.status === 'available' || row.status === 'withdrawn')
                && row.createdAt >= month.start && row.createdAt < month.end)
            .map(row => row.submissionId)) : new Set<Doc<'submissions'>['_id']>();
        let salesQuery = ctx.db.query('submissions')
            .withIndex('by_creator_id', (q) => q.eq('creatorId', affiliate._id));
        // A sale created earlier can be credited in the selected earnings month.
        // Both sets are filtered inside the owned query before its pagination.
        if (month) salesQuery = salesQuery.filter((q) => q.or(
            q.and(q.gte(q.field('_creationTime'), month.start), q.lt(q.field('_creationTime'), month.end)),
            ...[...creditedIds].map(id => q.eq(q.field('_id'), id)),
        ));
        if (args.status === 'paid') salesQuery = salesQuery.filter((q) => q.or(
            q.eq(q.field('status'), 'paid'), q.eq(q.field('status'), 'completed'),
        ));
        const result = await salesQuery.order('desc').paginate(args.paginationOpts);
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
    args: { month: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const affiliate = await ctx.db.query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
        if (!affiliate || affiliate.role !== 'affiliate' || affiliate.isDeleted || affiliate.status === 'deleted') {
            throw new ConvexError('An affiliate account is required.');
        }
        if (affiliate.status === 'pending') throw new ConvexError('Your affiliate account is waiting for admin approval.');
        if (affiliate.status !== 'active' && affiliate.status !== 'suspended') {
            throw new ConvexError('An affiliate account is required.');
        }

        const [earningRows, withdrawals, referralRows, deployed, pendingPayment, recruitRows] = await Promise.all([
            ctx.db.query('earnings').withIndex('by_creator', (q) => q.eq('creatorId', affiliate._id)).order('desc').collect(),
            ctx.db.query('withdrawals').withIndex('by_creator', (q) => q.eq('creatorId', affiliate._id)).order('desc').collect(),
            ctx.db.query('referrals').withIndex('by_referrer', (q) => q.eq('referrerId', affiliate._id)).order('desc').collect(),
            ctx.db.query('submissions').withIndex('by_creator_status', (q) => q.eq('creatorId', affiliate._id).eq('status', 'deployed')).collect(),
            ctx.db.query('submissions').withIndex('by_creator_status', (q) => q.eq('creatorId', affiliate._id).eq('status', 'pending_payment')).collect(),
            ctx.db.query('creators').withIndex('by_recruited_by', (q) => q.eq('recruitedByCreatorId', affiliate._id)).collect(),
        ]);

        // Both programs remain visible in the existing portal. Old referral
        // rows keep their one-time bonus; new recruits have recurring earnings
        // and must never be projected as another pending ₱1,000 promise.
        const now = Date.now();
        const month = selectedManilaMonth(args.month, now);
        const creditedThisMonth = (row: typeof earningRows[number]) =>
            (row.status === 'available' || row.status === 'withdrawn') && row.createdAt >= month.start && row.createdAt < month.end;
        const directThisMonth = earningRows.filter((row) => row.type === 'submission_approved' && creditedThisMonth(row))
            .reduce((sum, row) => sum + row.amount, 0);
        const overrideRows = earningRows.filter((row) => row.type === CREATOR_OVERRIDE_EARNING);
        const teamThisMonth = overrideRows.filter(creditedThisMonth).reduce((sum, row) => sum + row.amount, 0);
        const overrideSales = await Promise.all(overrideRows.map((row) => ctx.db.get(row.submissionId)));
        const overrideByRecruit = new Map<string, number>();
        const creditedByRecruit = new Map<string, number>();
        const monthByRecruit = new Map<string, number>();
        for (const [index, row] of overrideRows.entries()) {
            const submission = overrideSales[index];
            if (submission) {
                overrideByRecruit.set(submission.creatorId, (overrideByRecruit.get(submission.creatorId) ?? 0) + row.amount);
                if (row.status === 'available' || row.status === 'withdrawn') {
                    creditedByRecruit.set(submission.creatorId, (creditedByRecruit.get(submission.creatorId) ?? 0) + row.amount);
                }
                if (creditedThisMonth(row)) monthByRecruit.set(submission.creatorId, (monthByRecruit.get(submission.creatorId) ?? 0) + row.amount);
            }
        }
        const legacyReferredIds = new Set(referralRows.map((row) => row.referredId));
        const barPreview = devBarPreviewFor(ctx, affiliate);
        const recruits = recruitRows
            .filter((recruit) => !recruit.isDeleted && recruit.status !== 'deleted'
                && recruit.recruitedAt !== undefined && earnsCreatorOverride(recruit.recruitedAt)
                && !legacyReferredIds.has(recruit._id))
            .map((recruit) => {
                const demoMonthsLeft = recruit.role === 'creator'
                    && /^dev_affiliate_[a-z0-9_]+:agent:[a-z0-9-]+$/.test(recruit.clerkId)
                    ? barPreview?.get(recruit._id) : undefined;
                return {
                    _id: recruit._id,
                    referredName: [recruit.firstName, recruit.lastName].filter(Boolean).join(' ') || 'New field agent',
                    createdAt: recruit.recruitedAt!,
                    photo: recruit.profileImage && /^https?:\/\//.test(recruit.profileImage) ? recruit.profileImage : null,
                    endsAt: creatorOverrideEndsAt(recruit.recruitedAt!),
                    earning: now < creatorOverrideEndsAt(recruit.recruitedAt!),
                    monthsLeft: Math.max(0, Math.min(12, Math.ceil((creatorOverrideEndsAt(recruit.recruitedAt!) - now) / (30.4375 * 24 * 60 * 60 * 1000)))),
                    monthEarned: monthByRecruit.get(recruit._id) ?? 0,
                    totalEarned: overrideByRecruit.get(recruit._id) ?? 0,
                    ...creditedLifetime(creditedByRecruit.get(recruit._id) ?? 0),
                    ...(demoMonthsLeft !== undefined ? { demoMonthsLeft } : {}),
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt);
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
            month,
            income: { directThisMonth, teamThisMonth, totalThisMonth: directThisMonth + teamThisMonth },
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
            recruits,
            recruitStats: {
                total: recruits.length,
                earning: recruits.filter((row) => row.earning).length,
                totalEarned: overrideRows.reduce((sum, row) => sum + row.amount, 0),
            },
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
