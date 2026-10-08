import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';
import { readGiveaway } from './lib/giveaway';
import { requireAdmin } from './lib/auth';

/** Public availability for /start. Contact details and configuration stay out of the response. */
export const giveawayStatus = query({
    args: {},
    returns: v.object({ open: v.boolean(), slotsLeft: v.number(), given: v.number() }),
    handler: async (ctx): Promise<{ open: boolean; slotsLeft: number; given: number }> => {
        const { open, slotsLeft, given } = await readGiveaway(ctx);
        return { open, slotsLeft, given };
    },
});

/** Review totals include all active reservations, even sites already given away. */
export const giveawayReviewStatus = query({
    args: {},
    returns: v.object({ held: v.number(), given: v.number(), slotsLeft: v.number(), cap: v.number() }),
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const { held, given, slotsLeft, config } = await readGiveaway(ctx);
        return { held, given, slotsLeft, cap: config.cap };
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
