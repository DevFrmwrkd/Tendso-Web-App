import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { isCreatorAccount } from '../../lib/accounts';
import { requireCreatorAccount } from './auth';

export const COMMUNITY_VISIT_DURATION_MS = 24 * 60 * 60 * 1000;

/** A photo or website must be an actual web URL, never a local/device URI. */
export function communityWebUrl(value: string | null | undefined): string | null {
    if (!value || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
            ? value : null;
    } catch {
        return null;
    }
}

/** Spotting and visiting are field-agent work, including legacy creator rows. */
export async function requireCertifiedFieldAgent(ctx: MutationCtx) {
    const actor = await requireCreatorAccount(ctx);
    if (!isCertifiedFieldAgent(actor.me)) {
        throw new Error('A certified field-agent account is required');
    }
    return actor;
}

export function isCertifiedFieldAgent(account: Doc<'creators'>) {
    return isCreatorAccount(account) && !!account.certifiedAt && !account.rejectedAt
        && !account.isDeleted && account.status !== 'deleted' && account.status !== 'suspended';
}

export function activeCommunityClaim(lead: Doc<'leads'>, now: number) {
    const expiresAt = lead.claimExpiresAt ?? (lead.claimedAt === undefined ? 0 : lead.claimedAt + COMMUNITY_VISIT_DURATION_MS);
    return lead.claimedByCreatorId && expiresAt > now
        ? { creatorId: lead.claimedByCreatorId, expiresAt } : null;
}

/** Shared by visits and capture so a claimed shop cannot become a duplicate. */
export function assertCommunityFindAvailable(lead: Doc<'leads'>, actorId: Id<'creators'>, now: number) {
    if (lead.source !== 'community') throw new Error('This is not a community find');
    if (lead.submissionId || lead.status === 'converted') throw new Error('This shop has already been interviewed');
    if (lead.status === 'lost') throw new Error('This shop is no longer available to visit');
    if (communityWebUrl(lead.businessWebsite)) throw new Error('This shop already has a website');
    const claim = activeCommunityClaim(lead, now);
    if (claim && claim.creatorId !== actorId) {
        throw new Error('Another field agent is already visiting this shop');
    }
    return claim;
}

export function canManageCommunityFind(lead: Doc<'leads'>, actor: Doc<'creators'>, now: number) {
    // Existing admin CRM management keeps its separate operational authority.
    if (actor.role === 'admin') return true;
    if (!isCertifiedFieldAgent(actor) || lead.submissionId || lead.status === 'converted') return false;
    const claim = activeCommunityClaim(lead, now);
    if (claim) return claim.creatorId === actor._id;
    return (lead.spottedByCreatorId ?? lead.creatorId) === actor._id;
}

/** Generic legacy CRUD must not bypass community visit or capture boundaries. */
export function assertCommunityFindManagement(
    lead: Doc<'leads'>,
    actor: Doc<'creators'>,
    operation: 'edit' | 'status' | 'remove',
    nextStatus?: string,
) {
    if (lead.source !== 'community' || actor.role === 'admin') return;
    if (!canManageCommunityFind(lead, actor, Date.now())) {
        throw new Error('Only the certified spotter or current visitor can update this community find');
    }
    if (operation === 'remove' && (lead.spottedByCreatorId ?? lead.creatorId) !== actor._id) {
        throw new Error('Only the original spotter can remove this community find');
    }
    if (nextStatus === 'converted') throw new Error('Complete the shop capture to convert this community find');
}
