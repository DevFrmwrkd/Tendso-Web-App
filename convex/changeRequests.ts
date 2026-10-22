import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAdmin } from './lib/auth';
import { isOwnerApp } from './lib/ownerApp';
import { resetOwnerApproval } from './lib/ownerAuth';

/**
 * "Ask for a change" requests from the owner app (ownerApp.requestChange),
 * surfaced on the existing admin submission page. status: 'open' | 'done' | 'dismissed'.
 */

export const listForSubmission = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const rows = await ctx.db.query('changeRequests')
            .withIndex('by_submission', (q) => q.eq('submissionId', args.submissionId)).collect();
        return rows.sort((a, b) => b.createdAt - a.createdAt);
    },
});

export const setStatus = mutation({
    args: {
        id: v.id('changeRequests'),
        status: v.union(v.literal('open'), v.literal('done'), v.literal('dismissed')),
        adminNote: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { identity } = await requireAdmin(ctx);
        const row = await ctx.db.get(args.id);
        if (!row) throw new Error('Change request not found');
        if (args.status === 'open' && row.status !== 'open') {
            const submission = await ctx.db.get(row.submissionId);
            if (isOwnerApp(submission)) await resetOwnerApproval(ctx, row.submissionId);
        }
        await ctx.db.patch(args.id, {
            status: args.status,
            resolvedAt: args.status === 'open' ? undefined : Date.now(),
            resolvedBy: args.status === 'open' ? undefined : identity.subject,
            ...(args.adminNote !== undefined ? { adminNote: args.adminNote.trim().slice(0, 1000) || undefined } : {}),
        });
    },
});
