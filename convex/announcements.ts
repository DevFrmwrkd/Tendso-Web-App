import { v } from 'convex/values';
import { query, action, internalMutation, internalAction, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { requireAdminActor } from './lib/auth';
import { selectTargets, isSendable, type AudienceKey, type AudienceRow } from '../lib/announcements/audience';
import { notificationPreview } from '../lib/notifications/preview';
import { greetingName } from '../lib/email/greeting';

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  ADMIN BROADCASTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The one admin action with no undo. Everything here is shaped around that:
 *
 *   * Every entry point verifies the authenticated admin and checks that the
 *     supplied audit actor matches that session.
 *
 *   * previewAudience and send share ONE selection rule
 *     (lib/announcements/audience.ts). If they could drift, the recipient count
 *     on the confirm dialog would be a guess.
 *
 *   * Emails are staggered, not looped. Resend's default limit is ~2 requests
 *     a second; 140 sends in a tight loop earns 429s and a partial broadcast
 *     with no record of where it stopped.
 */

const EMAIL_STAGGER_MS = 700; // ~1.4/sec, comfortably under Resend's ~2/sec

/**
 * Who would receive this, and how many. Read by the admin page on every
 * audience change so the number on the button is the number that gets mailed.
 */
export const previewAudience = query({
    args: {
        adminId: v.string(),
        audience: v.string(),
        // Present = send to exactly these people. Overrides audience, but never
        // the deleted / no-email exclusions inside selectTargets.
        creatorIds: v.optional(v.array(v.id('creators'))),
    },
    handler: async (ctx, args) => {
        await requireAdminActor(ctx, args.adminId);

        const all = await ctx.db.query('creators').collect();
        const selected = selectTargets(all as unknown as (AudienceRow & { _id?: unknown })[], {
            audience: args.audience as AudienceKey,
            creatorIds: args.creatorIds,
        }) as any[];

        return {
            count: selected.length,
            // A handful of real names so an admin can sanity-check the filter
            // before sending, rather than trusting a bare number.
            sample: selected.slice(0, 5).map((c) => ({
                name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
                email: c.email,
            })),
        };
    },
});

/**
 * Find one creator to send to, by name or email.
 *
 * Admin-gated and deliberately narrow: it returns only what the picker needs to
 * show and select a person, never the whole creator row. Only sendable accounts
 * appear, so an admin cannot pick someone the send would then silently drop.
 */
export const searchRecipients = query({
    args: { adminId: v.string(), q: v.string() },
    handler: async (ctx, args) => {
        await requireAdminActor(ctx, args.adminId);

        const needle = args.q.trim().toLowerCase();
        if (needle.length < 2) return [];

        const all = await ctx.db.query('creators').collect();
        return all
            .filter((c) => isSendable(c as AudienceRow))
            .map((c) => ({
                _id: c._id,
                name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
                email: c.email,
            }))
            .filter((c) => c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle))
            .slice(0, 8);
    },
});

/** Past broadcasts, newest first. The audit trail. */
export const list = query({
    args: { adminId: v.string() },
    handler: async (ctx, args) => {
        await requireAdminActor(ctx, args.adminId);
        return await ctx.db.query('announcements').order('desc').take(30);
    },
});

// ==================== INTERNAL ====================

export const createRecord = internalMutation({
    args: {
        title: v.string(),
        body: v.string(),
        audience: v.string(),
        recipientCount: v.number(),
        sentBy: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert('announcements', {
            ...args,
            status: 'sending',
            createdAt: Date.now(),
        });
    },
});

export const recordResult = internalMutation({
    args: {
        announcementId: v.id('announcements'),
        emailsSent: v.number(),
        emailsFailed: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.announcementId, {
            status: args.emailsFailed > 0 && args.emailsSent === 0 ? 'failed' : 'sent',
            emailsSent: args.emailsSent,
            emailsFailed: args.emailsFailed,
            completedAt: Date.now(),
        });
    },
});

/**
 * Write the in-app notification rows.
 *
 * Inserted directly rather than through notifications.createAndSend because
 * that helper also schedules a push per creator — 140 scheduled pushes for an
 * announcement most creators have no token for. Push stays best-effort and out
 * of the critical path here.
 *
 * The row stores a PREVIEW, not the message. Mobile renders notifications.body
 * as a clipped list row with no detail view, so writing the full announcement
 * there produced a sentence cut mid-word and no way to read the rest. The full
 * text goes by email; this row says what arrived and where to find it.
 */
export const insertNotifications = internalMutation({
    args: {
        creatorIds: v.array(v.id('creators')),
        title: v.string(),
        body: v.string(),
        announcementId: v.id('announcements'),
    },
    handler: async (ctx, args) => {
        for (const creatorId of args.creatorIds) {
            await ctx.db.insert('notifications', {
                creatorId,
                type: 'system',
                title: args.title,
                body: notificationPreview(args.body),
                data: { announcementId: args.announcementId },
                read: false,
                sentAt: Date.now(),
            });
        }
        return args.creatorIds.length;
    },
});

export const resolveRecipients = internalQuery({
    args: { audience: v.string(), creatorIds: v.optional(v.array(v.id('creators'))) },
    handler: async (ctx, args) => {
        const all = await ctx.db.query('creators').collect();
        return (selectTargets(all as unknown as (AudienceRow & { _id?: unknown })[], {
            audience: args.audience as AudienceKey,
            creatorIds: args.creatorIds,
        }) as any[])
            .map((c) => ({
                _id: c._id,
                email: c.email,
                name: greetingName(c),
            }));
    },
});

/**
 * One email. Scheduled once per recipient with a stagger.
 *
 * Failures are logged, never thrown: one bad address must not abort a
 * broadcast, and a thrown scheduled action would retry and double-send.
 */
export const sendOneEmail = internalAction({
    args: {
        to: v.string(),
        name: v.string(),
        title: v.string(),
        body: v.string(),
    },
    handler: async (ctx, args) => {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'https://www.tendso.com';
        const internalSecret = process.env.INTERNAL_API_SECRET || '';
        try {
            const response = await fetch(`${baseUrl}/api/internal/send-announcement-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
                body: JSON.stringify(args),
            });
            if (!response.ok) {
                const text = await response.text();
                console.error(`[ANNOUNCEMENT] send failed for ${args.to}: ${response.status} ${text}`);
                return { ok: false };
            }
            return { ok: true };
        } catch (error) {
            console.error(`[ANNOUNCEMENT] send error for ${args.to}:`, error);
            return { ok: false };
        }
    },
});

// ==================== SEND ====================

/**
 * Send a broadcast. Admin-gated, and the only public write in this file.
 *
 * `testOnly` sends exactly one email, to the admin who pressed the button, and
 * writes no notification rows and no announcement record. It exists so that
 * seeing the real thing in a real inbox is a cheaper step than mailing 140
 * people to find out.
 */
export const send = action({
    args: {
        adminId: v.string(),
        title: v.string(),
        body: v.string(),
        audience: v.string(),
        creatorIds: v.optional(v.array(v.id('creators'))),
        testOnly: v.optional(v.boolean()),
    },
    handler: async (ctx, args): Promise<{
        sent: number;
        announcementId?: string;
        test?: boolean;
    }> => {
        const { me: actor } = await requireAdminActor(ctx, args.adminId);

        const title = args.title.trim();
        const body = args.body.trim();
        if (!title || !body) throw new Error('An announcement needs both a title and a message.');
        if (title.length > 120) throw new Error('Title is too long (max 120 characters).');
        if (body.length > 4000) throw new Error('Message is too long (max 4000 characters).');

        // Test send: one email, to the admin, nothing recorded.
        if (args.testOnly) {
            if (!actor.email) throw new Error('Your admin account has no email address to test with.');
            await ctx.runAction(internal.announcements.sendOneEmail, {
                to: actor.email,
                name: greetingName(actor),
                title,
                body,
            });
            return { sent: 1, test: true };
        }

        const recipients: Array<{ _id: any; email: string; name: string }> =
            await ctx.runQuery(internal.announcements.resolveRecipients, {
                audience: args.audience,
                creatorIds: args.creatorIds,
            });

        if (recipients.length === 0) {
            throw new Error(
                args.creatorIds
                    ? 'None of the people you picked can be emailed — those accounts are deleted or have no email address.'
                    : 'That audience matches nobody — nothing was sent.'
            );
        }

        const announcementId = await ctx.runMutation(internal.announcements.createRecord, {
            title,
            body,
            // Recorded as what it was, so the history row does not claim a
            // broadcast went to an audience when it went to named people.
            audience: args.creatorIds ? `${recipients.length} picked` : args.audience,
            recipientCount: recipients.length,
            sentBy: args.adminId,
        });

        // In-app rows first: they are a single transaction and cannot half-fail
        // the way a sequence of outbound emails can.
        await ctx.runMutation(internal.announcements.insertNotifications, {
            creatorIds: recipients.map((r) => r._id),
            title,
            body,
            announcementId,
        });

        // Staggered so Resend does not rate-limit us into a partial send.
        recipients.forEach((r, i) => {
            void ctx.scheduler.runAfter(i * EMAIL_STAGGER_MS, internal.announcements.sendOneEmail, {
                to: r.email,
                name: r.name,
                title,
                body,
            });
        });

        // Recorded as fully scheduled rather than fully delivered: the sends
        // outlive this action, and per-send failures are visible in the logs.
        await ctx.runMutation(internal.announcements.recordResult, {
            announcementId,
            emailsSent: recipients.length,
            emailsFailed: 0,
        });

        return { sent: recipients.length, announcementId };
    },
});
