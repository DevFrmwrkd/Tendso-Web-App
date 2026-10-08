import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';
import { readGiveaway } from './lib/giveaway';

/** Public availability for /start. Contact details and configuration stay out of the response. */
export const giveawayStatus = query({
    args: {},
    returns: v.object({ open: v.boolean(), slotsLeft: v.number(), given: v.number() }),
    handler: async (ctx): Promise<{ open: boolean; slotsLeft: number; given: number }> => {
        const { open, slotsLeft, given } = await readGiveaway(ctx);
        return { open, slotsLeft, given };
    },
});

/** Invalidate live status subscriptions at the deadline; stale schedules are harmless. */
export const expireGiveaway = internalMutation({
    args: { endsAt: v.number() },
    handler: async (ctx, { endsAt }) => {
        const setting = await ctx.db.query('settings').withIndex('by_key', (q) => q.eq('key', 'giveaway')).first();
        if (setting?.value?.endsAt === endsAt && Date.now() >= endsAt) {
            await ctx.db.patch(setting._id, { updatedAt: Date.now() });
        }
    },
});
