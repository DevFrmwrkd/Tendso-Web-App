import { v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server';

// ==================== INTERNAL MUTATIONS ====================

/**
 * Log an admin action (called via ctx.scheduler.runAfter)
 */
export const log = internalMutation({
    args: {
        adminId: v.string(),
        action: v.union(
            v.literal('submission_approved'),
            v.literal('submission_rejected'),
            v.literal('website_generated'),
            v.literal('website_deployed'),
            v.literal('payment_sent'),
            v.literal('payment_confirmed'),
            v.literal('submission_deleted'),
            v.literal('creator_updated'),
            v.literal('manual_override'),
            v.literal('transcription_regenerated'),
            v.literal('images_enhanced'),
            v.literal('payout_sent'),
            v.literal('payout_admin_override'),
            v.literal('payment_auto_matched'),
            v.literal('payment_partial'),
            v.literal('payment_unmatched'),
            // Promo: website given to the owner for free, creator still paid.
            // Deliberately NOT one of the payment_* actions — no money came in,
            // and the audit log is the only durable record of that difference.
            v.literal('submission_comped')
        ),
        targetType: v.union(
            v.literal('submission'),
            v.literal('creator'),
            v.literal('website'),
            v.literal('payment'),
            v.literal('withdrawal')
        ),
        targetId: v.string(),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert('auditLogs', {
            adminId: args.adminId,
            action: args.action,
            targetType: args.targetType,
            targetId: args.targetId,
            metadata: args.metadata,
            timestamp: Date.now(),
        });
    },
});

// ==================== QUERIES ====================

/**
 * Get audit logs for a specific target
 */
export const getByTarget = query({
    args: {
        targetType: v.union(
            v.literal('submission'),
            v.literal('creator'),
            v.literal('website'),
            v.literal('payment'),
            v.literal('withdrawal')
        ),
        targetId: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('auditLogs')
            .withIndex('by_target', (q) =>
                q.eq('targetType', args.targetType).eq('targetId', args.targetId)
            )
            .order('desc')
            .collect();
    },
});

/**
 * Get recent audit logs (admin activity feed)
 */
export const getRecent = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 50;
        const logs = await ctx.db
            .query('auditLogs')
            .withIndex('by_timestamp')
            .order('desc')
            .take(limit);

        // Resolve admin names from creators table
        const adminCache = new Map<string, { firstName?: string; lastName?: string } | null>();
        const enrichedLogs = await Promise.all(
            logs.map(async (log) => {
                if (!adminCache.has(log.adminId)) {
                    const creator = await ctx.db
                        .query('creators')
                        .withIndex('by_clerk_id', (q) => q.eq('clerkId', log.adminId))
                        .unique();
                    adminCache.set(log.adminId, creator ? { firstName: creator.firstName, lastName: creator.lastName } : null);
                }
                const admin = adminCache.get(log.adminId);
                return {
                    ...log,
                    adminName: admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() : log.adminId,
                };
            })
        );

        return enrichedLogs;
    },
});

/**
 * Get audit logs by admin
 */
export const getByAdmin = query({
    args: {
        adminId: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 50;
        return await ctx.db
            .query('auditLogs')
            .withIndex('by_admin', (q) => q.eq('adminId', args.adminId))
            .order('desc')
            .take(limit);
    },
});

// ==================== BACKFILL ====================

/**
 * Backfill audit logs from existing submissions that were processed before audit logging was wired.
 * Safe to run multiple times — skips submissions that already have audit log entries.
 */
export const backfillFromSubmissions = mutation({
    args: {},
    handler: async (ctx) => {
        const submissions = await ctx.db.query('submissions').collect();
        let created = 0;

        for (const submission of submissions) {
            // Skip drafts and submitted — no admin action taken
            if (submission.status === 'draft' || submission.status === 'submitted') continue;

            // Check if an audit log already exists for this submission
            const existing = await ctx.db
                .query('auditLogs')
                .withIndex('by_target', (q) =>
                    q.eq('targetType', 'submission').eq('targetId', submission._id)
                )
                .first();
            if (existing) continue;

            const adminId = submission.reviewedBy || 'system-backfill';
            const baseTimestamp = submission.reviewedAt || submission._creationTime;

            // Determine which actions to log based on current status
            const statusActions: { status: string; action: 'submission_approved' | 'submission_rejected' | 'website_generated' | 'website_deployed' | 'payment_sent' }[] = [
                { status: 'rejected', action: 'submission_rejected' },
                { status: 'in_review', action: 'submission_approved' }, // was at least reviewed
                { status: 'approved', action: 'submission_approved' },
                { status: 'website_generated', action: 'submission_approved' },
                { status: 'deployed', action: 'website_deployed' },
                { status: 'pending_payment', action: 'website_deployed' },
                { status: 'paid', action: 'payment_sent' },
                { status: 'completed', action: 'payment_sent' },
            ];

            const match = statusActions.find((sa) => sa.status === submission.status);
            if (!match) continue;

            // For deployed/paid statuses, create the earlier audit entries too
            const entriesToCreate: { action: 'submission_approved' | 'submission_rejected' | 'website_generated' | 'website_deployed' | 'payment_sent'; timestamp: number }[] = [];

            if (match.action === 'submission_rejected') {
                entriesToCreate.push({ action: 'submission_rejected', timestamp: baseTimestamp });
            } else {
                // Approval happened first for all non-rejected statuses
                entriesToCreate.push({ action: 'submission_approved', timestamp: baseTimestamp });

                if (['deployed', 'pending_payment', 'paid', 'completed'].includes(submission.status)) {
                    entriesToCreate.push({ action: 'website_deployed', timestamp: baseTimestamp + 1 });
                }

                if (['paid', 'completed'].includes(submission.status)) {
                    const paidTimestamp = submission.creatorPaidAt || submission.paidAt || baseTimestamp + 2;
                    entriesToCreate.push({ action: 'payment_sent', timestamp: paidTimestamp });
                }
            }

            for (const entry of entriesToCreate) {
                await ctx.db.insert('auditLogs', {
                    adminId,
                    action: entry.action,
                    targetType: 'submission',
                    targetId: submission._id,
                    metadata: {
                        businessName: submission.businessName,
                        backfilled: true,
                    },
                    timestamp: entry.timestamp,
                });
                created++;
            }
        }

        return { created };
    },
});
