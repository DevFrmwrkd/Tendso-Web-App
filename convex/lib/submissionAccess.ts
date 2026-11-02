import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { isCreatorAccount } from '../../lib/accounts';
import { secretMatches } from '../../lib/aiPipeline/internalAuth';
import { getOwner, ownsSubmission } from './ownerAuth';

/** Capture originals and unpublished build content are private account data. */
export async function canReadPrivateSubmission(
    ctx: QueryCtx,
    submission: Doc<'submissions'> | null,
    internalSecret?: string,
): Promise<boolean> {
    if (!submission) return false;
    // Existing email/transcription/build endpoints already verify this
    // server-to-server capability. Never send it in a browser request.
    if (secretMatches(internalSecret)) return true;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const account = await ctx.db.query('creators')
        .withIndex('by_clerk_id', q => q.eq('clerkId', identity.subject)).first();
    const active = account && !account.isDeleted && account.status !== 'deleted' && account.status !== 'suspended';
    if (active && (account.role === 'admin' || (isCreatorAccount(account) && account._id === submission.creatorId))) return true;
    const owner = await getOwner(ctx);
    return !!owner && await ownsSubmission(ctx, owner._id, submission._id);
}
