import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import { requireAdmin } from './lib/auth';
import { readGiveaway, validateGiveawayConfig } from './lib/giveaway';
import { internal } from './_generated/api';

// ==================== QUERIES ====================

/**
 * Get a single setting by key
 */
export const get = query({
    args: { key: v.string() },
    handler: async (ctx, args) => {
        const setting = await ctx.db
            .query('settings')
            .withIndex('by_key', (q) => q.eq('key', args.key))
            .first();
        return setting?.value ?? null;
    },
});

/**
 * Get all settings as a key-value map
 */
export const getAll = query({
    args: {},
    handler: async (ctx) => {
        const settings = await ctx.db.query('settings').collect();
        const map: Record<string, any> = {};
        for (const s of settings) {
            map[s.key] = s.value;
        }
        return map;
    },
});

// ==================== MUTATIONS ====================

/**
 * Upsert a setting
 */
export const set = mutation({
    args: {
        key: v.string(),
        value: v.any(),
        description: v.optional(v.string()),
        adminId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let value = args.value;
        let updatedBy = args.adminId;
        // Entitlements and the printed QR's destination are operator controls.
        // Other settings keep their existing API.
        if (args.key === 'giveaway' || args.key === 'poster_redirect_target') {
            const { identity } = await requireAdmin(ctx);
            updatedBy = identity.subject;
        }
        if (args.key === 'giveaway') {
            const config = validateGiveawayConfig(value);
            value = config;
            const previous = await readGiveaway(ctx);
            if (config.endsAt !== undefined && config.endsAt > Date.now()) {
                await ctx.scheduler.runAt(config.endsAt, internal.giveaway.expireGiveaway, { endsAt: config.endsAt });
            }
            // Reducing the cap or enabling a full allocation also closes it.
            if (config.enabled && previous.held >= config.cap &&
                (!previous.config.enabled || previous.held < previous.config.cap)) {
                await ctx.scheduler.runAfter(0, internal.discord.notifyGiveawayMilestone, {
                    milestone: 'all_held', held: previous.held, given: previous.given, cap: config.cap,
                });
            }
        }
        const existing = await ctx.db
            .query('settings')
            .withIndex('by_key', (q) => q.eq('key', args.key))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                value,
                description: args.description ?? existing.description,
                updatedAt: Date.now(),
                updatedBy,
            });
            return existing._id;
        }

        return await ctx.db.insert('settings', {
            key: args.key,
            value,
            description: args.description,
            updatedAt: Date.now(),
            updatedBy,
        });
    },
});

/**
 * Delete a setting
 */
export const remove = mutation({
    args: { key: v.string() },
    handler: async (ctx, args) => {
        if (args.key === 'giveaway' || args.key === 'poster_redirect_target') await requireAdmin(ctx);
        const setting = await ctx.db
            .query('settings')
            .withIndex('by_key', (q) => q.eq('key', args.key))
            .first();
        if (setting) {
            await ctx.db.delete(setting._id);
        }
    },
});
