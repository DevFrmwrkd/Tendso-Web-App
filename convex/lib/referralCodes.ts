import { ConvexError } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { normalizeCreatorCode } from '../../lib/creatorCodes';

type ReadCtx = Pick<QueryCtx, 'db'>;

/** Include permanent reservations even if their account has subsequently been removed. */
async function codeClaims(ctx: ReadCtx, rawCode: string) {
    const code = normalizeCreatorCode(rawCode);
    const [current, aliases] = await Promise.all([
        ctx.db.query('creators').withIndex('by_referral_code', q => q.eq('referralCode', code)).collect(),
        ctx.db.query('creatorCodeAliases').withIndex('by_code', q => q.eq('code', code)).collect(),
    ]);
    return { code, current, aliases };
}

/** The complete code namespace: current agent/affiliate codes plus retired affiliate aliases. */
export async function referralCodeTaken(ctx: ReadCtx, code: string, ownId?: Id<'creators'>) {
    const claims = await codeClaims(ctx, code);
    return claims.current.some(row => row._id !== ownId) || claims.aliases.some(row => row.creatorId !== ownId);
}

/** Callers apply their existing role/status rules; ambiguous legacy codes grant no attribution. */
export async function resolveReferralCode(ctx: ReadCtx, rawCode: string) {
    if (!rawCode.trim() || rawCode.trim().length > 64) return null;
    const { current, aliases } = await codeClaims(ctx, rawCode);
    const owners = new Set([...current.map(row => row._id), ...aliases.map(row => row.creatorId)]);
    if (owners.size !== 1) return null;
    return ctx.db.get([...owners][0]);
}

/** Reservations are permanent: changing or deleting a profile never gives its old code away. */
export async function reserveReferralCode(ctx: MutationCtx, rawCode: string, creatorId: Id<'creators'>) {
    const code = normalizeCreatorCode(rawCode);
    if (!code) return;
    const claims = await codeClaims(ctx, code);
    if (claims.current.some(row => row._id !== creatorId) || claims.aliases.some(row => row.creatorId !== creatorId)) {
        throw new ConvexError('That code is already taken. Choose another one.');
    }
    if (!claims.aliases.some(row => row.creatorId === creatorId)) {
        await ctx.db.insert('creatorCodeAliases', { creatorId, code, createdAt: Date.now() });
    }
}
