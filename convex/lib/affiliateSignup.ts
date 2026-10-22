import { ConvexError } from 'convex/values';
import type { UserIdentity } from 'convex/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { affiliateHandleError } from '../../lib/affiliates';
import { CAMPAIGN_CODES } from '../../lib/pricing';

export type AffiliateSignup = {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    handle: string;
    /** A code the creator chose. Absent: a random AFF… code, as before. */
    referralCode?: string;
    extra?: Partial<Pick<Doc<'creators'>, 'creatorSocials' | 'creatorAudienceSize' | 'creatorAppliedAt' | 'affiliatePrice'>>;
};

export const CREATOR_CODE_MIN_LENGTH = 4;
export const CREATOR_CODE_MAX_LENGTH = 16;

/** A creator's own code: 4–16 letters or numbers, never a campaign code. */
export function creatorCodeError(code: string): string | null {
    if (code.length < CREATOR_CODE_MIN_LENGTH || code.length > CREATOR_CODE_MAX_LENGTH) {
        return `Use a code between ${CREATOR_CODE_MIN_LENGTH} and ${CREATOR_CODE_MAX_LENGTH} characters.`;
    }
    if (!/^[A-Z0-9]+$/.test(code)) return 'Use letters and numbers only.';
    if (Object.prototype.hasOwnProperty.call(CAMPAIGN_CODES, code)) return 'That code is reserved. Choose another one.';
    return null;
}

/** Deleted handles stay reserved so an old shared link cannot be taken over. */
export async function handleTaken(ctx: Pick<QueryCtx, 'db'>, handle: string): Promise<boolean> {
    return !!(await ctx.db.query('creators').withIndex('by_affiliate_handle', (q) => q.eq('affiliateHandle', handle)).first());
}

/** Field agents' invite codes share this index, so a creator code can never shadow one. */
export async function codeTaken(ctx: Pick<QueryCtx, 'db'>, code: string): Promise<boolean> {
    return !!(await ctx.db.query('creators').withIndex('by_referral_code', (q) => q.eq('referralCode', code)).first());
}

/**
 * Insert a PENDING affiliate (creator) account for the signed-in person. The
 * admin approves it on /admin/affiliates (creators.updateStatus → 'active').
 * Shared by affiliates.create and creatorProgram.apply; both validate their
 * own input first. Retrying returns the existing affiliate unchanged.
 */
export async function insertAffiliateAccount(
    ctx: MutationCtx,
    identity: UserIdentity,
    input: AffiliateSignup,
): Promise<Id<'creators'>> {
    const { email } = input;
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
    const handleError = affiliateHandleError(input.handle);
    if (handleError) throw new ConvexError(handleError);
    if (await handleTaken(ctx, input.handle)) throw new ConvexError('That page handle is already taken. Choose another one.');

    let referralCode = input.referralCode;
    if (referralCode) {
        if (await codeTaken(ctx, referralCode)) throw new ConvexError('That code is already taken. Choose another one.');
    } else {
        do {
            referralCode = `AFF${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        } while (await codeTaken(ctx, referralCode));
    }
    if (existing?.isDeleted) {
        await ctx.db.patch(existing._id, { clerkId: `deleted_${existing._id}_${Date.now()}` });
    }
    return ctx.db.insert('creators', {
        clerkId: identity.subject,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        affiliateHandle: input.handle,
        referralCode,
        role: 'affiliate',
        status: 'pending',
        balance: 0,
        totalEarnings: 0,
        totalWithdrawn: 0,
        submissionCount: 0,
        createdAt: Date.now(),
        ...input.extra,
    });
}
