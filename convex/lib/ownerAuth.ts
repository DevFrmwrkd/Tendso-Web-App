import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';

/**
 * Owner-app identity helpers. An owner is a `businessOwners` row keyed by the
 * Clerk subject (email-code sign-in); a site is theirs when a
 * `websiteOwnerships` row links them. Every owner function re-checks that link
 * server-side — a guessed submission id is never enough.
 */

type DbCtx = QueryCtx | MutationCtx;

export async function getOwner(ctx: DbCtx): Promise<Doc<'businessOwners'> | null> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
        .query('businessOwners')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .first();
}

export async function requireOwner(ctx: DbCtx): Promise<Doc<'businessOwners'>> {
    const owner = await getOwner(ctx);
    if (!owner) throw new ConvexError('Please sign in again.');
    return owner;
}

export async function ownsSubmission(
    ctx: DbCtx,
    ownerId: Id<'businessOwners'>,
    submissionId: Id<'submissions'>,
): Promise<boolean> {
    const link = await ctx.db
        .query('websiteOwnerships')
        .withIndex('by_submission', (q) => q.eq('submissionId', submissionId))
        .filter((q) => q.eq(q.field('businessOwnerId'), ownerId))
        .first();
    return !!link;
}

/** The signed-in owner and their submission, or a ConvexError. */
export async function requireOwnerOfSubmission(
    ctx: DbCtx,
    submissionId: Id<'submissions'>,
): Promise<{ owner: Doc<'businessOwners'>; submission: Doc<'submissions'> }> {
    const owner = await requireOwner(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || !(await ownsSubmission(ctx, owner._id, submissionId))) {
        throw new ConvexError('We could not find that website.');
    }
    return { owner, submission };
}

/** Link an owner to a submission (idempotent). */
export async function linkOwnerToSubmission(
    ctx: MutationCtx,
    ownerId: Id<'businessOwners'>,
    submissionId: Id<'submissions'>,
): Promise<boolean> {
    if (await ownsSubmission(ctx, ownerId, submissionId)) return false;
    await ctx.db.insert('websiteOwnerships', {
        businessOwnerId: ownerId,
        submissionId,
        role: 'owner',
        claimedAt: Date.now(),
    });
    return true;
}

/**
 * Who may create a pay link for a submission: the linked owner, an admin, or
 * the field agent who sold it. Returns a label for `paymentTokens.createdBy`.
 */
export async function requirePayerAccess(ctx: DbCtx, submission: Doc<'submissions'>): Promise<string> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Please sign in again.');
    const owner = await ctx.db
        .query('businessOwners')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .first();
    if (owner && (await ownsSubmission(ctx, owner._id, submission._id))) return `owner:${owner._id}`;
    const account = await ctx.db
        .query('creators')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .first();
    const active = account && !account.isDeleted && account.status !== 'deleted' && account.status !== 'suspended';
    if (active && account.role === 'admin') return `admin:${identity.subject}`;
    if (active && account._id === submission.creatorId) return `creator:${account._id}`;
    throw new ConvexError('We could not find that website.');
}
