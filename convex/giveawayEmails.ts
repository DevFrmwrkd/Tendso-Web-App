import { v } from 'convex/values';
import { internalAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';

/** The event stamp stops a queued rejection from mailing after reactivation. */
export const sendRejected = internalAction({
    args: { submissionId: v.id('submissions'), reviewedAt: v.number(), reason: v.string() },
    handler: async (ctx, args) => {
        const secret = process.env.INTERNAL_API_SECRET;
        if (!secret) {
            console.error('[giveaway] INTERNAL_API_SECRET not set — skipping rejection email.');
            return;
        }
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'https://tendso.vercel.app';
        try {
            const response = await fetch(`${baseUrl}/api/internal/send-giveaway-rejected-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
                body: JSON.stringify(args),
            });
            if (!response.ok) {
                console.error(`[giveaway] Rejection email failed for ${args.submissionId}: ${response.status} ${await response.text()}`);
                return;
            }
            const result = await response.json();
            if (result.sent === true) {
                await ctx.runMutation(internal.giveawayEmails.markRejectedSent, {
                    submissionId: args.submissionId, reviewedAt: args.reviewedAt,
                });
            }
        } catch (error) {
            console.error(`[giveaway] Error sending rejection email for ${args.submissionId}:`, error);
        }
    },
});

export const markRejectedSent = internalMutation({
    args: { submissionId: v.id('submissions'), reviewedAt: v.number() },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission?.giveawayApplication || submission.status !== 'rejected'
            || submission.reviewedAt !== args.reviewedAt || submission.giveawayRejectedEmailSentAt) return;
        await ctx.db.patch(args.submissionId, { giveawayRejectedEmailSentAt: Date.now() });
    },
});

export const markReceivedSent = internalMutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission || submission.intakeReceivedEmailSentAt) return;
        await ctx.db.patch(args.submissionId, { intakeReceivedEmailSentAt: Date.now() });
    },
});
