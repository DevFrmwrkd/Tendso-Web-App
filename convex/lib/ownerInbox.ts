import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { ownsSubmission } from './ownerAuth';

type Ctx = QueryCtx | MutationCtx;
export type OwnerInboxItem = { key: string; type: string; title: string; body: string; createdAt: number;
    submissionId: Id<'submissions'> | null; visitRequestId: Id<'ownerVisitRequests'> | null; read: boolean };

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
    for (const item of facts) all.set(item.key, item);
    for (const row of persisted) if (owned.has(String(row.submissionId))) all.set(row.eventKey, { key: row.eventKey, type: row.type, title: row.title,
        body: row.body, createdAt: row.createdAt, submissionId: row.submissionId, visitRequestId: null, read: false });
    for (const row of visits) all.set(`visit:${row._id}`, { key: `visit:${row._id}`, type: row.type, title: row.title, body: row.body,
        createdAt: row.createdAt, submissionId: null, visitRequestId: row.visitRequestId, read: false });
    return [...all.values()].map(item => ({ ...item, read: read.has(item.key) })).sort((a,b) => b.createdAt - a.createdAt || a.key.localeCompare(b.key));
}
