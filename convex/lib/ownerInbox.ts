import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { ownsSubmission } from './ownerAuth';
import { canReadKnowledgeArticle, getKnowledgeViewerForSubject } from './knowledgeAccess';

type Ctx = QueryCtx | MutationCtx;
export type OwnerInboxItem = { key: string; type: string; title: string; body: string; createdAt: number;
    submissionId: Id<'submissions'> | null; visitRequestId: Id<'ownerVisitRequests'> | null; articleSlug?: string; read: boolean };

/** A captured team reply stays private until its article passes editorial review and recipient access. */
export async function knowledgeInboxFacts(ctx: Ctx, ownerId: Id<'businessOwners'>): Promise<OwnerInboxItem[]> {
    const owner = await ctx.db.get(ownerId);
    if (!owner) return [];
    const viewer = await getKnowledgeViewerForSubject(ctx, owner.clerkId);
    if (viewer.blocked || viewer.audience !== 'owner') return [];
    const escalations = await ctx.db.query('escalations').withIndex('by_asker', q => q.eq('askerUserId', owner.clerkId)).order('desc').take(100);
    const items: OwnerInboxItem[] = [];
    for (const escalation of escalations) {
        if (!escalation.answer?.trim() || !escalation.answeredAt || !['answered', 'learned', 'delivered'].includes(escalation.status)) continue;
        const article = escalation.learnedArticleId ? await ctx.db.get(escalation.learnedArticleId) : null;
        const ready = !!article && await canReadKnowledgeArticle(ctx, article, viewer);
        const at = ready ? Math.max(article.updatedAt, escalation.answeredAt) : escalation.answeredAt;
        items.push({ key: `kb:${escalation._id}:${ready ? 'ready' : 'review'}:${at}`,
            type: ready ? 'knowledge_answer_ready' : 'knowledge_answer_review',
            title: ready ? 'Your answer is ready' : 'Your question is being reviewed',
            body: ready ? 'An answer to your question is ready in Ask Tendso.' : 'The team replied and is checking the answer before sharing it. You do not need to submit your question again.',
            createdAt: at, submissionId: null, visitRequestId: null, read: false,
            ...(ready ? { articleSlug: article.slug } : {}),
        });
    }
    return items;
}

/** Facts are timestamped by the workflow, never inferred as invented notification history. */
export async function siteInboxFacts(ctx: Ctx, ownerId: Id<'businessOwners'>, submissionId: Id<'submissions'>): Promise<OwnerInboxItem[]> {
    if (!(await ownsSubmission(ctx, ownerId, submissionId))) return [];
    const site = await ctx.db.get(submissionId);
    if (!site) return [];
    const website = await ctx.db.query('generatedWebsites').withIndex('by_submissionId', q => q.eq('submissionId', submissionId)).first();
    const changes = await ctx.db.query('changeRequests').withIndex('by_submission', q => q.eq('submissionId', submissionId)).collect();
    const items: OwnerInboxItem[] = [];
    const add = (type: string, at: number | undefined, title: string, body: string, suffix = '') => {
        if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0) return;
        items.push({ key: `site:${submissionId}:${type}:${at}${suffix}`, type, title, body, createdAt: at, submissionId, visitRequestId: null, read: false });
    };
    add('preview_ready', site.previewReadyAt, 'Your website preview is ready', `Check the photos, details and wording for ${site.businessName}. Open your business to review the latest preview.`);
    add('deposit_received', site.depositPaidAt, 'Down payment recorded', `Your down payment for ${site.businessName} is recorded. Open payment details to check the remaining balance.`);
    add('payment_received', site.paidInFullAt, 'Website payment complete', `The full payment for ${site.businessName} is recorded. Publication is tracked separately in your business workspace.`);
    add('website_live', website?.publishedAt, 'Your website is published', `${site.businessName} was published. Open your business to check its current public address and status.`);
    add('website_offline', website?.offlineAt ?? site.unpublishedAt, 'Your website is offline', `${site.businessName} was taken offline. Contact the team through your workspace for help.`);
    if (site.status === 'rejected') add('needs_attention', site.reviewedAt, 'Your business needs attention', `${site.businessName}: ${site.rejectionReason?.trim() || 'Contact the team to check what needs updating.'}`);
    for (const change of changes) {
        add('change_requested', change.createdAt, 'Your change request was received',
            `Your change request for ${site.businessName} was sent to the team.`, `:${change._id}`);
        if (change.status !== 'open') add('change_updated', change.resolvedAt, 'Your change request was updated',
            `${site.businessName}: open your business to review the latest preview and request status.`, `:${change._id}`);
    }
    return items;
}

export async function ownerInboxItems(ctx: Ctx, ownerId: Id<'businessOwners'>): Promise<OwnerInboxItem[]> {
    const links = await ctx.db.query('websiteOwnerships').withIndex('by_owner', q => q.eq('businessOwnerId', ownerId)).collect();
    const facts = (await Promise.all(links.map(link => siteInboxFacts(ctx, ownerId, link.submissionId)))).flat();
    const persisted = await ctx.db.query('ownerSiteEvents').withIndex('by_owner', q => q.eq('ownerId', ownerId)).collect();
    const owned = new Set(links.map(link => String(link.submissionId)));
    const visits = await ctx.db.query('ownerVisitEvents').withIndex('by_owner', q => q.eq('ownerId', ownerId)).order('desc').take(300);
    const reads = await ctx.db.query('ownerNotificationReads').withIndex('by_owner', q => q.eq('ownerId', ownerId)).collect();
    const read = new Set(reads.map(row => row.eventKey));
    const all = new Map<string, OwnerInboxItem>();
    for (const item of await knowledgeInboxFacts(ctx, ownerId)) all.set(item.key, item);
    for (const item of facts) all.set(item.key, item);
    for (const row of persisted) if (owned.has(String(row.submissionId))) all.set(row.eventKey, { key: row.eventKey, type: row.type, title: row.title,
        body: row.body, createdAt: row.createdAt, submissionId: row.submissionId, visitRequestId: null, read: false });
    for (const row of visits) all.set(`visit:${row._id}`, { key: `visit:${row._id}`, type: row.type, title: row.title, body: row.body,
        createdAt: row.createdAt, submissionId: null, visitRequestId: row.visitRequestId, read: false });
    return [...all.values()].map(item => ({ ...item, read: read.has(item.key) })).sort((a,b) => b.createdAt - a.createdAt || a.key.localeCompare(b.key));
}
