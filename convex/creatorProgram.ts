import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAuth } from './lib/auth';
import { affiliateHandleError, affiliatePhoneError } from '../lib/affiliates';
import { codeTaken, creatorCodeError, handleTaken, insertAffiliateAccount } from './lib/affiliateSignup';
import { creatorCard, findActiveCreator, normalizeCreatorCode } from './lib/creatorRecruits';

/**
 * Creator program: sign-up and the public face of a creator's code.
 * Contract: docs/v2-api-creators.md.
 *
 * A creator is a `creators` row with role 'affiliate'. Applying creates it as
 * 'pending'; an admin approves it on the existing /admin/affiliates page
 * (creators.updateStatus → 'active'). Until then the handle and code resolve
 * to nothing anywhere.
 */

const socialPlatform = v.union(
    v.literal('facebook'), v.literal('instagram'), v.literal('tiktok'),
    v.literal('youtube'), v.literal('x'), v.literal('other'),
);

const MAX_SOCIALS = 6;

/** Is this page handle / code free? Both are optional; pass what the person typed. */
export const checkAvailability = query({
    args: { handle: v.optional(v.string()), code: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const result: {
            handle: { value: string; available: boolean; error: string | null } | null;
            code: { value: string; available: boolean; error: string | null } | null;
        } = { handle: null, code: null };
        if (args.handle !== undefined) {
            const value = args.handle.trim().toLowerCase();
            const error = affiliateHandleError(value) ?? (await handleTaken(ctx, value) ? 'That page handle is already taken. Choose another one.' : null);
            result.handle = { value, available: !error, error };
        }
        if (args.code !== undefined) {
            const value = normalizeCreatorCode(args.code);
            const error = creatorCodeError(value) ?? (await codeTaken(ctx, value) ? 'That code is already taken. Choose another one.' : null);
            result.code = { value, available: !error, error };
        }
        return result;
    },
});

/**
 * Apply to be a creator. The email always comes from the Clerk session.
 * Lands as a pending affiliate account on /admin/affiliates. Retrying returns
 * the existing account unchanged.
 */
export const apply = mutation({
    args: {
        firstName: v.string(),
        lastName: v.optional(v.string()),
        phone: v.optional(v.string()),
        handle: v.string(),
        code: v.optional(v.string()),
        socials: v.array(v.object({ platform: socialPlatform, handle: v.string() })),
        audienceSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await requireAuth(ctx);
        const email = identity.email?.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new ConvexError('Sign in with your email first.');
        }
        const firstName = args.firstName.trim();
        const lastName = args.lastName?.trim() || undefined;
        if (!firstName || firstName.length > 100 || (lastName && lastName.length > 100)) {
            throw new ConvexError('Enter your name (up to 100 characters).');
        }
        const phone = args.phone?.trim() || undefined;
        if (phone) {
            const phoneError = affiliatePhoneError(phone);
            if (phoneError) throw new ConvexError(phoneError);
        }
        const handle = args.handle.trim().toLowerCase();
        const handleError = affiliateHandleError(handle);
        if (handleError) throw new ConvexError(handleError);
        const code = args.code?.trim() ? normalizeCreatorCode(args.code) : undefined;
        if (code) {
            const codeError = creatorCodeError(code);
            if (codeError) throw new ConvexError(codeError);
        }
        const socials = args.socials
            .map((social) => ({ platform: social.platform, handle: social.handle.trim() }))
            .filter((social) => social.handle);
        if (socials.length === 0) throw new ConvexError('Add at least one social account.');
        if (socials.length > MAX_SOCIALS) throw new ConvexError(`Add up to ${MAX_SOCIALS} social accounts.`);
        if (socials.some((social) => social.handle.length > 200)) throw new ConvexError('A social account must be 200 characters or fewer.');
        let audienceSize: number | undefined;
        if (args.audienceSize !== undefined) {
            if (!Number.isFinite(args.audienceSize) || args.audienceSize < 0 || args.audienceSize > 1e9) {
                throw new ConvexError('Enter your audience size as a number.');
            }
            audienceSize = Math.round(args.audienceSize);
        }

        return insertAffiliateAccount(ctx, identity, {
            firstName, lastName, email, phone, handle, referralCode: code,
            extra: {
                creatorSocials: socials,
                creatorAudienceSize: audienceSize,
                creatorAppliedAt: Date.now(),
                // Code pricing comes from the shared fixed policy, never an account override.
            },
        });
    },
});

/** Where the signed-in person stands as a creator. Never throws for signed-out or other roles. */
export const myApplication = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { status: 'signed_out' as const };
        const me = await ctx.db.query('creators').withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
        if (!me || me.isDeleted || me.status === 'deleted') return { status: 'none' as const };
        if (me.role !== 'affiliate') return { status: 'other_account' as const };
        const status = me.status === 'active' ? 'active' as const : me.status === 'suspended' ? 'suspended' as const : 'pending' as const;
        return { status, handle: me.affiliateHandle ?? null, code: me.referralCode ?? null, appliedAt: me.creatorAppliedAt ?? me.createdAt ?? null };
    },
});

/**
 * The public card behind a creator's code, for "Mika's code: you
 * save ₱1,500" at owner checkout and "Join Mika's team" at agent sign-up.
 * Null unless the creator is approved and active.
 */
export const getCreatorByCode = query({
    args: { code: v.string() },
    handler: async (ctx, args) => {
        const found = await findActiveCreator(ctx, args.code, 'code');
        if (!found) return null;
        return creatorCard(found.affiliate, found.price);
    },
});

/** Public /a/<handle> pages resolve only the handle namespace, including legacy accounts. */
export const getCreatorByHandle = query({
    args: { handle: v.string() },
    handler: async (ctx, args) => {
        const found = await findActiveCreator(ctx, args.handle, 'handle');
        return found ? creatorCard(found.affiliate, found.price) : null;
    },
});
