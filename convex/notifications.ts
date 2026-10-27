import { v } from 'convex/values';
import { query, mutation, internalMutation, internalQuery, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { requireAccountOwner, requireAuth } from './lib/auth';

// ==================== INTERNAL ====================

/**
 * Create a notification and schedule push delivery
 */
export const createAndSend = internalMutation({
    args: {
        creatorId: v.id('creators'),
        type: v.union(
            v.literal('submission_approved'),
            v.literal('submission_rejected'),
            v.literal('submission_created'),
            v.literal('new_lead'),
            v.literal('payout_sent'),
            v.literal('website_live'),
            v.literal('profile_updated'),
            v.literal('password_changed'),
            v.literal('certification'),
            v.literal('system')
        ),
        title: v.string(),
        body: v.string(),
        data: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        // Insert notification into DB
        await ctx.db.insert('notifications', {
            creatorId: args.creatorId,
            type: args.type,
            title: args.title,
            body: args.body,
            data: args.data,
            read: false,
            sentAt: Date.now(),
        });

        // Schedule push notification delivery
        await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotification, {
            creatorId: args.creatorId,
            title: args.title,
            body: args.body,
            data: args.data,
        });
    },
});

/**
 * Get active push tokens for a creator
 */
export const getActiveTokens = internalQuery({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('pushTokens')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .filter((q) => q.eq(q.field('active'), true))
            .collect();
    },
});

/**
 * Deactivate an invalid push token
 */
export const deactivateToken = internalMutation({
    args: { tokenId: v.id('pushTokens') },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.tokenId, { active: false });
    },
});

/**
 * Send push notification via Expo Push API
 */
export const sendPushNotification = internalAction({
    args: {
        creatorId: v.id('creators'),
        title: v.string(),
        body: v.string(),
        data: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        // Get active tokens
        const tokens = await ctx.runQuery(internal.notifications.getActiveTokens, {
            creatorId: args.creatorId,
        });

        if (tokens.length === 0) return;

        // Build Expo push messages
        const messages = tokens.map((t: any) => ({
            to: t.token,
            sound: 'default' as const,
            title: args.title,
            body: args.body,
            data: args.data || {},
        }));

        try {
            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messages),
            });

            const result = await response.json();

            // Auto-deactivate invalid tokens
            if (result.data) {
                for (let i = 0; i < result.data.length; i++) {
                    if (result.data[i].status === 'error' &&
                        result.data[i].details?.error === 'DeviceNotRegistered') {
                        await ctx.runMutation(internal.notifications.deactivateToken, {
                            tokenId: tokens[i]._id,
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Push notification error:', error);
        }
    },
});

// ==================== PUBLIC MUTATIONS ====================

/**
 * Register a push token (called by app on launch)
 */
export const registerPushToken = mutation({
    args: {
        creatorId: v.id('creators'),
        token: v.string(),
        platform: v.union(v.literal('ios'), v.literal('android'), v.literal('web')),
    },
    handler: async (ctx, args) => {
        // Check if token already exists
        const existing = await ctx.db
            .query('pushTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first();

        if (existing) {
            // Reactivate if needed
            if (!existing.active) {
                await ctx.db.patch(existing._id, { active: true });
            }
            return existing._id;
        }

        return await ctx.db.insert('pushTokens', {
            creatorId: args.creatorId,
            token: args.token,
            platform: args.platform,
            active: true,
        });
    },
});

/**
 * Remove a push token (called on logout)
 */
export const removePushToken = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('pushTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, { active: false });
        }
    },
});

// ==================== PUBLIC QUERIES ====================

/**
 * Get all notifications for a creator
 */
export const getByCreator = query({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('notifications')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .order('desc')
            .collect();
    },
});

/** Read one recipient's message, including the original announcement text. */
export const getDetails = query({
    args: { id: v.id('notifications') },
    handler: async (ctx, args) => {
        await requireAuth(ctx);
        const notification = await ctx.db.get(args.id);
        if (!notification) return null;

        const { me } = await requireAccountOwner(ctx, notification.creatorId);
        // This inbox endpoint has no administrator override: the notification
        // itself is the recipient's authorization to read a broadcast.
        if (me._id !== notification.creatorId) {
            throw new Error('Forbidden: you can only read your own notifications');
        }

        const announcementId = notification.data && typeof notification.data === 'object'
            ? notification.data.announcementId : undefined;
        if (typeof announcementId !== 'string') return notification;
        const normalizedId = ctx.db.normalizeId('announcements', announcementId);
        if (!normalizedId) return notification;
        const announcement = await ctx.db.get(normalizedId);
        return announcement ? { ...notification, body: announcement.body } : notification;
    },
});

/**
 * Get unread notification count
 */
export const getUnreadCount = query({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        const unread = await ctx.db
            .query('notifications')
            .withIndex('by_creator_unread', (q) =>
                q.eq('creatorId', args.creatorId).eq('read', false)
            )
            .collect();
        return unread.length;
    },
});

/**
 * Mark a single notification as read
 */
export const markAsRead = mutation({
    args: { id: v.id('notifications') },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { read: true });
    },
});

/**
 * Create a notification from the client (password changes, profile updates, etc.)
 */
export const createForClient = mutation({
    args: {
        creatorId: v.id('creators'),
        type: v.union(
            v.literal('submission_approved'),
            v.literal('submission_rejected'),
            v.literal('submission_created'),
            v.literal('new_lead'),
            v.literal('payout_sent'),
            v.literal('website_live'),
            v.literal('profile_updated'),
            v.literal('password_changed'),
            v.literal('certification'),
            v.literal('system')
        ),
        title: v.string(),
        body: v.string(),
        data: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        // Only the internal announcement writer may grant access to a broadcast.
        // Client-generated profile/password notices cannot forge that linkage.
        if (args.data && typeof args.data === 'object' &&
            Object.prototype.hasOwnProperty.call(args.data, 'announcementId')) {
            throw new Error('Announcement references are reserved for internal notifications');
        }
        await ctx.db.insert('notifications', {
            creatorId: args.creatorId,
            type: args.type,
            title: args.title,
            body: args.body,
            data: args.data,
            read: false,
            sentAt: Date.now(),
        });
    },
});

/**
 * Mark all notifications as read for a creator
 */
export const markAllAsRead = mutation({
    args: { creatorId: v.id('creators') },
    handler: async (ctx, args) => {
        const unread = await ctx.db
            .query('notifications')
            .withIndex('by_creator_unread', (q) =>
                q.eq('creatorId', args.creatorId).eq('read', false)
            )
            .collect();

        for (const notification of unread) {
            await ctx.db.patch(notification._id, { read: true });
        }
    },
});
