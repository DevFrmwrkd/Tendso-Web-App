import { internalMutation, mutation, query } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { readGiveaway, validateGiveawayConfig } from './lib/giveaway';
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
    returns: v.object({
        held: v.number(), given: v.number(), slotsLeft: v.number(), cap: v.number(),
        enabled: v.boolean(), open: v.boolean(), endsAt: v.optional(v.number()),
    }),
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const { held, given, slotsLeft, config, open } = await readGiveaway(ctx);
        return { held, given, slotsLeft, cap: config.cap, enabled: config.enabled, open,
            ...(config.endsAt !== undefined ? { endsAt: config.endsAt } : {}),
        };
    },
});

/** Operator availability switch; reservations and the configured allocation stay intact. */
export const setEnabled = mutation({
    args: { enabled: v.boolean() },
    returns: v.null(),
    handler: async (ctx, { enabled }) => {
        const { identity } = await requireAdmin(ctx);
        const { config, held } = await readGiveaway(ctx);
        const setting = await ctx.db.query('settings').withIndex('by_key', (q) => q.eq('key', 'giveaway')).first();
        const existing = setting?.value && typeof setting.value === 'object' && !Array.isArray(setting.value)
            ? setting.value : config;
        const value = { ...existing, enabled };
        // Never repair a malformed cap or discard its deadline while enabling.
        // Disabling remains possible even when an old setting needs repair.
        const nextConfig = enabled ? validateGiveawayConfig(value) : config;
        if (enabled && held >= nextConfig.cap) {
            throw new ConvexError('The giveaway cannot be opened because all available slots are allocated.');
        }
        if (enabled && nextConfig.endsAt !== undefined && Date.now() >= nextConfig.endsAt) {
            throw new ConvexError('The giveaway deadline has passed. Update the deadline before reopening.');
        }

        const audit = { updatedAt: Date.now(), updatedBy: identity.subject };
        if (setting) {
            await ctx.db.patch(setting._id, { value, ...audit });
        } else {
            await ctx.db.insert('settings', { key: 'giveaway', value, ...audit });
        }
        if (enabled && nextConfig.endsAt !== undefined) {
            // Re-enabling must also wake live status subscriptions at the
            // original deadline. Duplicate invalidations are safe.
            await ctx.scheduler.runAt(nextConfig.endsAt, internal.giveaway.expireGiveaway, { endsAt: nextConfig.endsAt });
        }
        return null;
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
