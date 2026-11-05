import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import { getKnowledgeViewer } from './lib/knowledgeAccess';
import { formatPHP } from '../packages/shared/pricing';
import { siteSummary } from './ownerApp';

/** Read-only, caller-bound answers. No IDs/emails supplied by the chat select an account. */
export const answer = internalQuery({
    args: { kind: v.union(v.literal('balance'), v.literal('approval'), v.literal('sites')) },
    handler: async (ctx, { kind }): Promise<string> => {
        const viewer = await getKnowledgeViewer(ctx);
        if (!viewer.authenticated) return 'Sign in to check your account details. I cannot look up balances or business statuses from an email address in chat.';
        if (viewer.blocked) return 'Your account is unavailable for private account lookups. Please contact Tendso support.';
        if (viewer.audience === 'owner') {
            if (kind !== 'sites') return 'Your owner account has no creator cash-out balance or field-agent certification. Open My businesses to check your website and payment status.';
            const owner = await ctx.db.query('businessOwners').withIndex('by_clerk_id', q => q.eq('clerkId', viewer.clerkId!)).first();
            if (!owner) return 'I could not find your owner account. Please sign in again.';
            const links = await ctx.db.query('websiteOwnerships').withIndex('by_owner', q => q.eq('businessOwnerId', owner._id)).take(21);
            const sites = (await Promise.all(links.slice(0, 20).map(async link => {
                const submission = await ctx.db.get(link.submissionId);
                if (!submission) return null;
                const summary = await siteSummary(ctx, link.submissionId);
                return summary ? { ...summary, quoted: typeof submission.amount === 'number' && Number.isFinite(submission.amount) } : null;
            }))).filter(s => !!s);
            if (!sites.length) return 'There are no linked businesses on your signed-in owner account yet. Open My businesses to start or link your website.';
            return `On your signed-in owner account:\n${sites.map(s => {
                const payment = s.phase === 'draft' ? 'Continue your draft to confirm the quote and payment details.'
                    : s.paidInFull ? 'Paid in full.' : !s.quoted ? 'The payment amount is not recorded yet.'
                        : `${formatPHP(s.balanceDue)} balance due.`;
                return `• ${s.businessName}: ${s.phase.replace(/_/g, ' ')}. ${payment}`;
            }).join('\n')}\nOpen My businesses for the full payment details${links.length > 20 ? ' and your other businesses' : ''}.`;
        }
        if (viewer.audience !== 'affiliate' && viewer.audience !== 'field_agent') return 'This question needs a creator, field-agent, or owner account. I cannot look up another person’s account from chat. Use the authorized admin pages for team account reviews.';
        const me = await ctx.db.query('creators').withIndex('by_clerk_id', q => q.eq('clerkId', viewer.clerkId!)).first();
        if (!me) return 'I could not find your account. Please sign in again.';
        if (kind === 'balance') {
            const withdrawals = await ctx.db.query('withdrawals').withIndex('by_creator', q => q.eq('creatorId', me._id)).order('desc').take(5);
            const balance = typeof me.balance === 'number' && Number.isFinite(me.balance)
                ? `${formatPHP(me.balance)} is available to cash out.` : 'your available cash-out balance is not recorded.';
            const earnings = typeof me.totalEarnings === 'number' && Number.isFinite(me.totalEarnings)
                ? formatPHP(me.totalEarnings) : 'not recorded';
            return `On your signed-in account, ${balance} Total recorded earnings: ${earnings}.${withdrawals.length ? `\nRecent cash outs:\n${withdrawals.map(w => `• ${formatPHP(w.amount)}: ${w.status}.`).join('\n')}` : '\nYou have no cash outs yet.'}\nCheck Earn or Payouts for the full ledger. These are current account records, not an earnings estimate.`;
        }
        if (kind === 'approval') return viewer.audience === 'affiliate'
            ? `Your signed-in creator account status is ${me.status ?? 'not recorded'}. Check your portal for any next steps.`
            : me.certifiedAt ? 'Your field-agent account is approved and certified.'
                : me.rejectedAt ? `Your profile needs changes.${me.rejectionReason ? ` Review note: ${me.rejectionReason}` : ''}${me.quizPassedAt ? ' Your saved quiz pass is kept;' : ''} fix your profile and resend it.`
                    : me.quizPassedAt ? 'You have passed the quiz. Your profile is waiting for team approval.'
                        : 'Your account does not yet have a recorded quiz pass or approval. Open Training to continue.';
        if (viewer.audience === 'affiliate') return 'Open Sales in your creator portal to see each shop’s current status. I cannot infer individual sales statuses from your earnings balance.';
        const submissions = await ctx.db.query('submissions').withIndex('by_creator_id', q => q.eq('creatorId', me._id)).order('desc').take(5);
        return submissions.length
            ? `Your most recent submissions:\n${submissions.map(s => `• ${s.businessName}: ${s.status.replace(/_/g, ' ')}.`).join('\n')}\nOpen Finds for each submission’s review and payment details.`
            : 'Your signed-in field-agent account has no submitted shops yet.';
    },
});
