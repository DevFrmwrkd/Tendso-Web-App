import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { formatPHP } from '../lib/pricing';
import {
    ownerBuildingEmail,
    ownerInviteEmail,
    ownerPreviewReadyEmail,
    ownerSiteLiveEmail,
    type OwnerEmail,
} from '../lib/email/ownerV2Templates';

/**
 * Owner app v2 emails, sent straight from Convex through Resend's REST API
 * (POST https://api.resend.com/emails). Feature-off when RESEND_API_KEY is not
 * set on the Convex deployment: the send is logged and skipped. Every failure
 * is swallowed — an email never fails the action that triggered it.
 *
 * Env (Convex): RESEND_API_KEY, RESEND_FROM_EMAIL (optional), RESEND_REPLY_TO
 * (optional), OWNER_APP_URL (where "Open Tendso" points; default tendso.com).
 */

const kind = v.union(v.literal('invite'), v.literal('building'), v.literal('preview_ready'), v.literal('live'));
export type OwnerEmailKind = 'invite' | 'building' | 'preview_ready' | 'live';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailContextInternal = internalQuery({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const s = await ctx.db.get(args.submissionId);
        if (!s) return null;
        const website = await ctx.db.query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId)).first();
        return {
            to: s.ownerEmail ?? null,
            ownerName: s.ownerName,
            businessName: s.businessName,
            websiteUrl: website?.publishedUrl ?? s.websiteUrl ?? null,
            total: s.amount ?? 0,
            balanceDue: s.depositPaidAt && !s.paidInFullAt ? (s.balanceDue ?? 0) : 0,
        };
    },
});

export const markEmailSent = internalMutation({
    args: { submissionId: v.id('submissions'), kind },
    handler: async (ctx, args) => {
        const now = Date.now();
        if (args.kind === 'live') await ctx.db.patch(args.submissionId, { ownerLiveEmailSentAt: now });
        if (args.kind === 'invite') {
            const invite = await ctx.db.query('ownerInvites')
                .withIndex('by_submission', (q) => q.eq('submissionId', args.submissionId)).first();
            if (invite) await ctx.db.patch(invite._id, { emailSentAt: now });
        }
    },
});

export const send = internalAction({
    args: { submissionId: v.id('submissions'), kind },
    handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
        try {
            const c = await ctx.runQuery(internal.ownerEmails.emailContextInternal, { submissionId: args.submissionId });
            if (!c || !c.to || !EMAIL_PATTERN.test(c.to)) return { sent: false, reason: 'no owner email' };
            const appUrl = (process.env.OWNER_APP_URL || 'https://tendso.com').replace(/\/$/, '');
            let email: OwnerEmail;
            if (args.kind === 'invite') {
                email = ownerInviteEmail({ ownerName: c.ownerName, businessName: c.businessName, email: c.to, appUrl });
            } else if (args.kind === 'building') {
                email = ownerBuildingEmail({ ownerName: c.ownerName, businessName: c.businessName, appUrl });
            } else if (args.kind === 'preview_ready') {
                email = ownerPreviewReadyEmail({ ownerName: c.ownerName, businessName: c.businessName, appUrl, priceText: formatPHP(c.total) });
            } else {
                if (!c.websiteUrl) return { sent: false, reason: 'no website url' };
                email = ownerSiteLiveEmail({
                    ownerName: c.ownerName,
                    businessName: c.businessName,
                    websiteUrl: c.websiteUrl,
                    balanceText: c.balanceDue > 0 ? formatPHP(c.balanceDue) : null,
                });
            }

            const apiKey = process.env.RESEND_API_KEY;
            if (!apiKey) {
                console.log(`[owner-email] RESEND_API_KEY not set on Convex — skipped ${args.kind} for ${args.submissionId}`);
                return { sent: false, reason: 'email off' };
            }
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': `owner-${args.kind}-${args.submissionId}`,
                },
                body: JSON.stringify({
                    from: process.env.RESEND_FROM_EMAIL || 'Tendso <onboarding@resend.dev>',
                    to: [c.to],
                    subject: email.subject,
                    html: email.html,
                    text: email.text,
                    ...(process.env.RESEND_REPLY_TO ? { reply_to: process.env.RESEND_REPLY_TO } : {}),
                }),
            });
            if (!response.ok) {
                console.error(`[owner-email] ${args.kind} failed for ${args.submissionId}: ${response.status} ${(await response.text()).slice(0, 300)}`);
                return { sent: false, reason: `resend ${response.status}` };
            }
            await ctx.runMutation(internal.ownerEmails.markEmailSent, { submissionId: args.submissionId, kind: args.kind });
            return { sent: true };
        } catch (error) {
            console.error(`[owner-email] ${args.kind} error for ${args.submissionId}:`, error);
            return { sent: false, reason: 'error' };
        }
    },
});
