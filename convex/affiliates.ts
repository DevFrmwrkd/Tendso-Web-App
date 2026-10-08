import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAdmin, requireAuth } from './lib/auth';
import { affiliateHandleError, affiliatePhoneError, affiliatePriceError } from '../lib/affiliates';

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

function optionalHttpsUrl(value: string | undefined, label: string) {
    const trimmed = optionalText(value, 2048, label);
    if (!trimmed) return undefined;
    try {
        const url = new URL(trimmed);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    } catch {
        throw new ConvexError(`${label} must be a valid HTTPS URL.`);
    }
    return trimmed;
}

/** Foundation for the later dashboard editor; the handle stays fixed. */
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
        if (args.photo !== undefined) updates.affiliatePhoto = optionalHttpsUrl(args.photo, 'Photo');
        if (args.displayName !== undefined) updates.affiliateDisplayName = optionalText(args.displayName, 100, 'Display name');
        if (args.message !== undefined) updates.affiliateMessage = optionalText(args.message, 280, 'Short message');
        if (args.socialLink !== undefined) updates.affiliateSocialLink = optionalHttpsUrl(args.socialLink, 'Social link');
        if (args.price !== undefined) updates.affiliatePrice = args.price;
        await ctx.db.patch(affiliate._id, updates);
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
