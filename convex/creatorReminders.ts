import { ConvexError, v } from 'convex/values';
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { reminderState } from '../lib/creatorReminders';

/**
 * A creator asks Tendso to email a business owner who has not paid yet a
 * reminder (the drawer's "Email a reminder" on /submissions).
 *
 * The rules live in `claim`, one mutation, so two taps cannot both get
 * through: the caller must be the creator who made the site, the site must be
 * live and waiting on a payment (pending_payment, so the payment email has
 * gone out), the owner must have an email address and a pay link that still
 * works, and lib/creatorReminders.ts must allow another (one a day, three in
 * all). The claim records the send up front; if the email then fails,
 * `release` takes it back so the creator is not charged a reminder for it.
 *
 * The email is sent by /api/internal/send-creator-reminder, where the
 * templates and the mail transport live, the way convex/followUp.ts sends the
 * final-day reminder.
 */

type Claim =
    | { ok: true; at: number; creatorName: string; left: number }
    | { ok: false; message: string };

export const claim = internalMutation({
    args: { submissionId: v.id('submissions'), clerkId: v.string() },
    handler: async (ctx, args): Promise<Claim> => {
        const now = Date.now();
        const creator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
            .first();
        const submission = await ctx.db.get(args.submissionId);
        if (!creator || !submission || submission.creatorId !== creator._id) {
            return { ok: false, message: 'This site is not one of yours.' };
        }
        if (submission.status !== 'pending_payment') {
            return { ok: false, message: 'This site is not waiting on a payment.' };
        }
        if (!submission.ownerEmail) {
            return { ok: false, message: 'Tendso has no email address for the owner. Share the pay link instead.' };
        }
        const tokens = await ctx.db
            .query('paymentTokens')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .collect();
        if (!tokens.some((t) => t.status === 'pending' && t.expiresAt >= now)) {
            return { ok: false, message: 'The pay link has expired. Ask Tendso support for a new one.' };
        }

        const state = reminderState(submission.creatorRemindersAt, now);
        if (!state.canSend) {
            return {
                ok: false,
                message: state.reason === 'used-up'
                    ? 'You have sent all 3 reminders for this site.'
                    : 'You sent a reminder in the last 24 hours. You can send the next one tomorrow.',
            };
        }

        await ctx.db.patch(args.submissionId, {
            creatorRemindersAt: [...(submission.creatorRemindersAt ?? []), now],
        });
        return { ok: true, at: now, creatorName: creator.firstName?.trim() || 'Your Tendso creator', left: state.left - 1 };
    },
});

/** Take back a claimed reminder whose email did not go out. */
export const release = internalMutation({
    args: { submissionId: v.id('submissions'), at: v.number() },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) return;
        await ctx.db.patch(args.submissionId, {
            creatorRemindersAt: (submission.creatorRemindersAt ?? []).filter((t) => t !== args.at),
        });
    },
});

/** Email the owner a reminder on the creator's behalf. Returns how many reminders are left. */
export const sendReminder = action({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args): Promise<{ left: number }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new ConvexError('Sign in again to send a reminder.');

        const claimed: Claim = await ctx.runMutation(internal.creatorReminders.claim, {
            submissionId: args.submissionId,
            clerkId: identity.subject,
        });
        if (!claimed.ok) throw new ConvexError(claimed.message);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'https://tendso.vercel.app';
        const internalSecret = process.env.INTERNAL_API_SECRET || '';
        let sent = false;
        try {
            const response = await fetch(`${baseUrl}/api/internal/send-creator-reminder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
                body: JSON.stringify({ submissionId: args.submissionId, creatorName: claimed.creatorName }),
            });
            sent = response.ok;
            if (!sent) console.error(`[creatorReminders] send failed for ${args.submissionId}: ${response.status} ${await response.text()}`);
        } catch (error) {
            console.error(`[creatorReminders] send failed for ${args.submissionId}:`, error);
        }

        if (!sent) {
            await ctx.runMutation(internal.creatorReminders.release, { submissionId: args.submissionId, at: claimed.at });
            throw new ConvexError('The reminder did not send. Try again in a moment.');
        }
        return { left: claimed.left };
    },
});
