import { v } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import { isCreatorAccount } from '../../lib/accounts';
import { resolveKnowledgeAccess, type KnowledgeAccessRecord, type KnowledgeAudience } from '../../packages/shared/knowledge';

export const knowledgeAudienceValidator = v.union(v.literal('everyone'), v.literal('owner'), v.literal('affiliate'), v.literal('field_agent'), v.literal('admin'));
export const knowledgeVisibilityValidator = v.union(v.literal('public'), v.literal('authenticated'), v.literal('internal'));
export const knowledgeAccessArgs = {
    audiences: v.optional(v.array(knowledgeAudienceValidator)),
    visibility: v.optional(knowledgeVisibilityValidator),
};

export type KnowledgeViewer = {
    clerkId: string | null;
    authenticated: boolean;
    audience: KnowledgeAudience;
    canAccessWiki: boolean;
    isAdmin: boolean;
    blocked: boolean;
};
export const ANONYMOUS_KNOWLEDGE_VIEWER: KnowledgeViewer = {
    clerkId: null, authenticated: false, audience: 'everyone', canAccessWiki: false, isAdmin: false, blocked: false,
};

/** The caller cannot choose an account type. Suspended/deleted accounts gain no private access. */
export async function getKnowledgeViewer(ctx: QueryCtx | MutationCtx): Promise<KnowledgeViewer> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ...ANONYMOUS_KNOWLEDGE_VIEWER };
    return getKnowledgeViewerForSubject(ctx, identity.subject);
}

/** Server-only recipient check for a stored escalation's Clerk subject, never client role input. */
export async function getKnowledgeViewerForSubject(ctx: QueryCtx | MutationCtx, clerkId: string): Promise<KnowledgeViewer> {
    const creator = await ctx.db.query('creators').withIndex('by_clerk_id', q => q.eq('clerkId', clerkId)).first();
    const base = { ...ANONYMOUS_KNOWLEDGE_VIEWER, clerkId, authenticated: true };
    if (creator) {
        if (creator.isDeleted || creator.status === 'deleted' || creator.status === 'suspended') return { ...base, blocked: true };
        if (creator.role === 'admin') return { ...base, audience: 'admin', isAdmin: true, canAccessWiki: true };
        if (creator.role === 'affiliate') return { ...base, audience: 'affiliate' };
        if (isCreatorAccount(creator)) return { ...base, audience: 'field_agent', canAccessWiki: !!creator.certifiedAt };
        // Staff is deliberately not an administrator or certified field agent.
        return base;
    }
    const owner = await ctx.db.query('businessOwners').withIndex('by_clerk_id', q => q.eq('clerkId', clerkId)).first();
    return owner ? { ...base, audience: 'owner' } : base;
}

export function matchesKnowledgeAudience(record: KnowledgeAccessRecord, viewer: KnowledgeViewer): boolean {
    const { audiences } = resolveKnowledgeAccess(record);
    return viewer.isAdmin || audiences.includes('everyone') || (viewer.audience !== 'everyone' && audiences.includes(viewer.audience));
}

export function canReadKnowledgeContent(record: KnowledgeAccessRecord, viewer: KnowledgeViewer): boolean {
    if (record.workspace === 'wiki' && !viewer.canAccessWiki) return false;
    const { visibility } = resolveKnowledgeAccess(record);
    // Public role-focused advice may be shared via a direct public link.
    if (visibility === 'public') return true;
    if (!viewer.authenticated || viewer.blocked) return false;
    if (viewer.isAdmin) return true;
    if (!matchesKnowledgeAudience(record, viewer)) return false;
    return visibility === 'authenticated' || viewer.canAccessWiki;
}

/** Categories constrain their children too, including direct URL and vector hits. */
export async function canReadKnowledgeArticle(
    ctx: QueryCtx | MutationCtx,
    article: Doc<'knowledgeArticles'>,
    viewer: KnowledgeViewer,
    assistant = false,
): Promise<boolean> {
    if (article.status !== 'published' || !canReadKnowledgeContent(article, viewer)) return false;
    if (assistant && !matchesKnowledgeAudience(article, viewer)) return false;
    const category = await ctx.db.get(article.categoryId);
    return !!category && category.workspace === article.workspace && canReadKnowledgeContent(category, viewer)
        && (!assistant || matchesKnowledgeAudience(category, viewer));
}
