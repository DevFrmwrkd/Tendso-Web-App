import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { getOwner, linkOwnerToSubmission } from './lib/ownerAuth';
import { isOwnerApp, normalizeOwnerEmail } from './lib/ownerApp';
import { siteSummary } from './ownerApp';

/**
 * Owner accounts (owner app v2). Owners sign in with Clerk (email code); the
 * verified email is the identity anchor. Contract: docs/v2-api-owners.md.
 *
 *   owners.ensure — call once after every sign-in. Creates or re-links the
 *     businessOwners row and links every site a field agent made for this email
 *     (ownerInvites). Idempotent.
 *   owners.me     — the owner and their sites.
 *
 * Replaces the claim-token flow (businessOwners.claimWebsite stays for old
 * links; no new claim tokens are minted).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 120;
const MAX_PHONE = 40;

async function linkInvites(ctx: MutationCtx, owner: Doc<'businessOwners'>): Promise<Id<'submissions'>[]> {
    const email = normalizeOwnerEmail(owner.email);
    const invites = await ctx.db.query('ownerInvites').withIndex('by_email', (q) => q.eq('email', email)).collect();
    const linked: Id<'submissions'>[] = [];
    for (const invite of invites) {
        const submission = await ctx.db.get(invite.submissionId);
        // The email on the order may have been corrected since the invite.
        if (!submission || normalizeOwnerEmail(submission.ownerEmail) !== email) continue;
        if (await linkOwnerToSubmission(ctx, owner._id, invite.submissionId)) linked.push(invite.submissionId);
        if (!invite.linkedAt) await ctx.db.patch(invite._id, { linkedAt: Date.now(), businessOwnerId: owner._id });
    }
    return linked;
}

export const ensure = mutation({
    args: {
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new ConvexError('Please sign in again.');
        const email = normalizeOwnerEmail(identity.email as string | undefined);
        if (!email || !EMAIL_PATTERN.test(email)) throw new ConvexError('Your account needs an email address.');
        // Require positive verification: email links every site sold to it.
        if (identity.emailVerified !== true) throw new ConvexError('Please confirm your email first.');
        const account = await ctx.db.query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).first();
        if (account?.role === 'affiliate' && !account.isDeleted) {
            throw new ConvexError('This login is a creator account. Use a different email for your business.');
        }
        const name = args.name?.trim().slice(0, MAX_NAME) || undefined;
        const phone = args.phone?.trim().slice(0, MAX_PHONE) || undefined;

        let created = false;
        let owner = await getOwner(ctx);
        if (!owner) {
            // Same person, new Clerk user (e.g. account re-created): re-link by
            // the verified email rather than making a second owner.
            owner = await ctx.db.query('businessOwners').withIndex('by_email', (q) => q.eq('email', email)).first()
                ?? (identity.email ? await ctx.db.query('businessOwners')
                    .withIndex('by_email', (q) => q.eq('email', identity.email as string)).first() : null);
            if (owner) {
                await ctx.db.patch(owner._id, { clerkId: identity.subject });
            } else {
                const id = await ctx.db.insert('businessOwners', {
                    clerkId: identity.subject,
                    email,
                    name: name ?? ((identity.name as string | undefined) || undefined),
                    phone,
                    createdAt: Date.now(),
                });
                owner = (await ctx.db.get(id))!;
                created = true;
            }
        }
        const patch: Partial<Doc<'businessOwners'>> = {};
        if (name && name !== owner.name) patch.name = name;
        if (phone && phone !== owner.phone) patch.phone = phone;
        if (Object.keys(patch).length > 0) await ctx.db.patch(owner._id, patch);

        const linkedSubmissionIds = await linkInvites(ctx, owner);
        return {
            ownerId: owner._id,
            email: owner.email,
            name: patch.name ?? owner.name ?? null,
            created,
            linkedSubmissionIds,
        };
    },
});

/** The signed-in owner and their sites (null when not an owner yet: call ensure). */
export const me = query({
    args: {},
    handler: async (ctx) => {
        const owner = await getOwner(ctx);
        if (!owner) return null;
        const links = await ctx.db.query('websiteOwnerships')
            .withIndex('by_owner', (q) => q.eq('businessOwnerId', owner._id)).collect();
        const sites: NonNullable<Awaited<ReturnType<typeof siteSummary>>>[] = [];
        for (const link of links) {
            const summary = await siteSummary(ctx, link.submissionId);
            if (summary) sites.push(summary);
        }
        sites.sort((a, b) => b.createdAt - a.createdAt);
        return {
            owner: { _id: owner._id, email: owner.email, name: owner.name ?? null, phone: owner.phone ?? null },
            sites,
        };
    },
});

/**
 * Invite the owner of a field agent's sale to the app, once. Scheduled when the
 * agent submits and when the order is paid. Links straight away when an owner
 * with that email already exists. Skips owner-app orders (already linked).
 */
export const inviteForSubmission = internalMutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission || isOwnerApp(submission) || submission.giveawayApplication) return { invited: false };
        const email = normalizeOwnerEmail(submission.ownerEmail);
        if (!email || !EMAIL_PATTERN.test(email)) return { invited: false };

        let invite = await ctx.db.query('ownerInvites')
            .withIndex('by_submission', (q) => q.eq('submissionId', args.submissionId)).first();
        if (!invite) {
            const id = await ctx.db.insert('ownerInvites', { email, submissionId: args.submissionId, createdAt: Date.now() });
            invite = (await ctx.db.get(id))!;
        } else if (invite.email !== email) {
            await ctx.db.patch(invite._id, { email, linkedAt: undefined, businessOwnerId: undefined });
        }

        const owner = await ctx.db.query('businessOwners').withIndex('by_email', (q) => q.eq('email', email)).first();
        if (owner) {
            await linkOwnerToSubmission(ctx, owner._id, args.submissionId);
            await ctx.db.patch(invite._id, { linkedAt: Date.now(), businessOwnerId: owner._id });
        }

        // One invite email per order: submit and payment can both get here.
        if (submission.ownerInviteSentAt) return { invited: false };
        await ctx.db.patch(args.submissionId, { ownerInviteSentAt: Date.now() });
        await ctx.scheduler.runAfter(0, internal.ownerEmails.send, { submissionId: args.submissionId, kind: 'invite' });
        return { invited: true };
    },
});
