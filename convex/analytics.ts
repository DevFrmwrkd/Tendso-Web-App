import { v } from 'convex/values';
import { query, internalMutation } from './_generated/server';
import { requireAccountOwner, requireAdmin } from './lib/auth';

// ==================== HELPERS ====================

export function getTodayString(): string {
    return new Date().toISOString().split('T')[0];
}

export function getCurrentMonthString(): string {
    return new Date().toISOString().substring(0, 7);
}

// ==================== INTERNAL MUTATIONS ====================

/**
 * Create or update a creator's analytics record for a period
 */
export const upsertCreatorStats = internalMutation({
    args: {
        creatorId: v.id('creators'),
        period: v.string(),
        periodType: v.union(v.literal('daily'), v.literal('monthly')),
        stats: v.object({
            submissionsCount: v.optional(v.number()),
            approvedCount: v.optional(v.number()),
            rejectedCount: v.optional(v.number()),
            leadsGenerated: v.optional(v.number()),
            earningsTotal: v.optional(v.number()),
            websitesLive: v.optional(v.number()),
            referralsCount: v.optional(v.number()),
        }),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('analytics')
            .withIndex('by_creator_period', (q) =>
                q.eq('creatorId', args.creatorId)
                    .eq('periodType', args.periodType)
                    .eq('period', args.period)
            )
            .first();

        if (existing) {
            const updates: any = { updatedAt: Date.now() };
            for (const [key, val] of Object.entries(args.stats)) {
                if (val !== undefined) {
                    updates[key] = val;
                }
            }
            await ctx.db.patch(existing._id, updates);
            return existing._id;
        }

        return await ctx.db.insert('analytics', {
            creatorId: args.creatorId,
            period: args.period,
            periodType: args.periodType,
            submissionsCount: args.stats.submissionsCount ?? 0,
            approvedCount: args.stats.approvedCount ?? 0,
            rejectedCount: args.stats.rejectedCount ?? 0,
            leadsGenerated: args.stats.leadsGenerated ?? 0,
            earningsTotal: args.stats.earningsTotal ?? 0,
            websitesLive: args.stats.websitesLive ?? 0,
            referralsCount: args.stats.referralsCount ?? 0,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Increment a single stat field (for real-time event-driven updates)
 */
export const incrementStat = internalMutation({
    args: {
        creatorId: v.id('creators'),
        period: v.string(),
        periodType: v.union(v.literal('daily'), v.literal('monthly')),
        field: v.string(),
        delta: v.number(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('analytics')
            .withIndex('by_creator_period', (q) =>
                q.eq('creatorId', args.creatorId)
                    .eq('periodType', args.periodType)
                    .eq('period', args.period)
            )
            .first();

        if (existing) {
            const currentVal = (existing as any)[args.field] ?? 0;
            await ctx.db.patch(existing._id, {
                [args.field]: currentVal + args.delta,
                updatedAt: Date.now(),
            });
        } else {
            await ctx.db.insert('analytics', {
                creatorId: args.creatorId,
                period: args.period,
                periodType: args.periodType,
                submissionsCount: 0,
                approvedCount: 0,
                rejectedCount: 0,
                leadsGenerated: 0,
                earningsTotal: 0,
                websitesLive: 0,
                referralsCount: 0,
                [args.field]: args.delta,
                updatedAt: Date.now(),
            });
        }
    },
});

/**
 * Create or update website analytics for a date
 */
export const upsertWebsiteStats = internalMutation({
    args: {
        submissionId: v.id('submissions'),
        date: v.string(),
        stats: v.object({
            pageViews: v.optional(v.number()),
            uniqueVisitors: v.optional(v.number()),
            contactClicks: v.optional(v.number()),
            whatsappClicks: v.optional(v.number()),
            phoneClicks: v.optional(v.number()),
            formSubmissions: v.optional(v.number()),
        }),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('websiteAnalytics')
            .withIndex('by_submission_date', (q) =>
                q.eq('submissionId', args.submissionId).eq('date', args.date)
            )
            .first();

        if (existing) {
            const updates: any = { updatedAt: Date.now() };
            for (const [key, val] of Object.entries(args.stats)) {
                if (val !== undefined) {
                    updates[key] = (existing as any)[key] + val;
                }
            }
            await ctx.db.patch(existing._id, updates);
            return existing._id;
        }

        return await ctx.db.insert('websiteAnalytics', {
            submissionId: args.submissionId,
            date: args.date,
            pageViews: args.stats.pageViews ?? 0,
            uniqueVisitors: args.stats.uniqueVisitors ?? 0,
            contactClicks: args.stats.contactClicks ?? 0,
            whatsappClicks: args.stats.whatsappClicks ?? 0,
            phoneClicks: args.stats.phoneClicks ?? 0,
            formSubmissions: args.stats.formSubmissions ?? 0,
            updatedAt: Date.now(),
        });
    },
});

// ==================== QUERIES ====================

/**
 * Get creator analytics over a date range
 */
export const getCreatorStats = query({
    args: {
        creatorId: v.id('creators'),
        periodType: v.union(v.literal('daily'), v.literal('monthly')),
        fromPeriod: v.optional(v.string()),
        toPeriod: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAccountOwner(ctx, args.creatorId);
        let q = ctx.db
            .query('analytics')
            .withIndex('by_creator_period', (q) =>
                q.eq('creatorId', args.creatorId).eq('periodType', args.periodType)
            );

        const records = await q.collect();

        // Filter by date range if provided
        return records.filter((r) => {
            if (args.fromPeriod && r.period < args.fromPeriod) return false;
            if (args.toPeriod && r.period > args.toPeriod) return false;
            return true;
        });
    },
});

/**
 * Get platform-wide aggregated stats for a period
 */
export const getPlatformStats = query({
    args: {
        periodType: v.union(v.literal('daily'), v.literal('monthly')),
        period: v.string(),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const records = await ctx.db
            .query('analytics')
            .withIndex('by_period', (q) =>
                q.eq('periodType', args.periodType).eq('period', args.period)
            )
            .collect();

        return {
            submissionsCount: records.reduce((s, r) => s + r.submissionsCount, 0),
            approvedCount: records.reduce((s, r) => s + r.approvedCount, 0),
            rejectedCount: records.reduce((s, r) => s + r.rejectedCount, 0),
            leadsGenerated: records.reduce((s, r) => s + r.leadsGenerated, 0),
            earningsTotal: records.reduce((s, r) => s + r.earningsTotal, 0),
            websitesLive: records.reduce((s, r) => s + r.websitesLive, 0),
            referralsCount: records.reduce((s, r) => s + r.referralsCount, 0),
        };
    },
});

/**
 * Get website stats for a submission
 */
export const getWebsiteStats = query({
    args: {
        submissionId: v.id('submissions'),
        fromDate: v.optional(v.string()),
        toDate: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');
        await requireAccountOwner(ctx, submission.creatorId);
        const records = await ctx.db
            .query('websiteAnalytics')
            .withIndex('by_submission_date', (q) =>
                q.eq('submissionId', args.submissionId)
            )
            .collect();

        const filtered = records.filter((r) => {
            if (args.fromDate && r.date < args.fromDate) return false;
            if (args.toDate && r.date > args.toDate) return false;
            return true;
        });

        const totals = {
            pageViews: filtered.reduce((s, r) => s + r.pageViews, 0),
            uniqueVisitors: filtered.reduce((s, r) => s + r.uniqueVisitors, 0),
            contactClicks: filtered.reduce((s, r) => s + r.contactClicks, 0),
            whatsappClicks: filtered.reduce((s, r) => s + r.whatsappClicks, 0),
            phoneClicks: filtered.reduce((s, r) => s + r.phoneClicks, 0),
            formSubmissions: filtered.reduce((s, r) => s + r.formSubmissions, 0),
        };

        return { daily: filtered, totals };
    },
});

/**
 * Get all website stats for a specific date (admin overview)
 */
export const getWebsiteStatsByDate = query({
    args: { date: v.string() },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return await ctx.db
            .query('websiteAnalytics')
            .withIndex('by_date', (q) => q.eq('date', args.date))
            .collect();
    },
});

/**
 * Get all analytics records (admin dashboard overview)
 */
export const getAllAnalytics = query({
    args: {
        periodType: v.optional(v.union(v.literal('daily'), v.literal('monthly'))),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        if (args.periodType) {
            return await ctx.db
                .query('analytics')
                .withIndex('by_period', (q) => q.eq('periodType', args.periodType!))
                .collect();
        }
        return await ctx.db.query('analytics').collect();
    },
});

