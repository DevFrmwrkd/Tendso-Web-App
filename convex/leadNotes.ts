import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

// ==================== MUTATIONS ====================

/**
 * Add a follow-up note to a lead
 */
export const create = mutation({
    args: {
        leadId: v.id('leads'),
        creatorId: v.id('creators'),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert('leadNotes', {
            leadId: args.leadId,
            creatorId: args.creatorId,
            content: args.content,
            createdAt: Date.now(),
        });
    },
});

/**
 * Creator-friendly alias for `create`. Matches the WEB-BUILD-CRM.md spec
 * contract exactly — `{ leadId, content }`. The calling creator's id is
 * derived from the Clerk identity server-side, so the client doesn't have
 * to pass it. Both web and mobile call this version on the creator path.
 */
export const add = mutation({
    args: {
        leadId: v.id('leads'),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const creator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!creator) throw new Error('Creator profile not found');

        const trimmed = args.content.trim();
        if (!trimmed) throw new Error('Note content cannot be empty');
        if (trimmed.length > 2000) throw new Error('Note too long (max 2000 chars)');

        return await ctx.db.insert('leadNotes', {
            leadId: args.leadId,
            creatorId: creator._id,
            content: trimmed,
            createdAt: Date.now(),
        });
    },
});

/**
 * Delete a note
 */
export const remove = mutation({
    args: { id: v.id('leadNotes') },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// ==================== QUERIES ====================

/**
 * Get all notes for a lead (newest first)
 */
export const getByLead = query({
    args: { leadId: v.id('leads') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('leadNotes')
            .withIndex('by_lead', (q) => q.eq('leadId', args.leadId))
            .order('desc')
            .collect();
    },
});
