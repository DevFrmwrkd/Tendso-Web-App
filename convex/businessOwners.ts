import { v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import {
    generateClaimToken,
    isValidClaimTokenFormat,
    isClaimTokenUsable,
    claimTokenExpiry,
    emailMatchesSubmission,
} from '../lib/ownerClaim';

/**
 * Business Owner Portal — identity, claim flow, and ownership-gated content edits.
 * See docs/changes/OWNER-PORTAL-PRICING-PLAN.md Phase 1.
 *
 * Trust model (the load-bearing rules — pure logic lives in lib/ownerClaim.ts):
 *  - An owner is a businessOwners row, authenticated via Clerk (passwordless).
 *  - They claim a website by clicking an "Edit my website" link whose single-use
 *    token was emailed to the submission's ownerEmail. At claim time the signed-in
 *    email MUST match that ownerEmail (emailMatchesSubmission).
 *  - EVERY content mutation re-checks websiteOwnerships server-side — a leaked link
 *    or a guessed submission id can never edit a site the caller doesn't own.
 */

// ---- identity helpers ----

async function getOwner(ctx: QueryCtx | MutationCtx): Promise<Doc<'businessOwners'> | null> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
        .query('businessOwners')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .first();
}

/** Server-side ownership gate: throws unless the signed-in owner owns this submission. */
async function requireOwnership(
    ctx: QueryCtx | MutationCtx,
    submissionId: Id<'submissions'>,
): Promise<Doc<'businessOwners'>> {
    const owner = await getOwner(ctx);
    if (!owner) throw new Error('Not signed in as a business owner');
    const link = await ctx.db
        .query('websiteOwnerships')
        .withIndex('by_submission', (q) => q.eq('submissionId', submissionId))
        .filter((q) => q.eq(q.field('businessOwnerId'), owner._id))
        .first();
    if (!link) throw new Error('Forbidden: you do not own this website');
    return owner;
}

// ==================== QUERIES ====================

/** The current viewer's owner profile (null if not an owner / not signed in). */
export const me = query({
    args: {},
    handler: async (ctx) => getOwner(ctx),
});

/** Inspect a claim token before redeeming (the claim landing page calls this). */
export const getClaimToken = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        if (!isValidClaimTokenFormat(args.token)) return null;
        const row = await ctx.db
            .query('ownerClaimTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first();
        if (!row) return null;
        const submission = await ctx.db.get(row.submissionId);
        return {
            status: row.status,
            expiresAt: row.expiresAt,
            usable: isClaimTokenUsable(row, Date.now()),
            businessName: submission?.businessName ?? null,
            email: row.email,
        };
    },
});

/** All websites the signed-in owner has claimed, with live URL + status + a leads count. */
export const getMyWebsites = query({
    args: {},
    handler: async (ctx) => {
        const owner = await getOwner(ctx);
        if (!owner) return [];
        const links = await ctx.db
            .query('websiteOwnerships')
            .withIndex('by_owner', (q) => q.eq('businessOwnerId', owner._id))
            .collect();
        const out = [];
        for (const link of links) {
            const submission = await ctx.db.get(link.submissionId);
            if (!submission) continue;
            const website = await ctx.db
                .query('generatedWebsites')
                .withIndex('by_submissionId', (q) => q.eq('submissionId', link.submissionId))
                .first();
            const leadCount = (
                await ctx.db
                    .query('leads')
                    .withIndex('by_submission', (q) => q.eq('submissionId', link.submissionId))
                    .collect()
            ).length;
            out.push({
                submissionId: link.submissionId,
                businessName: submission.businessName,
                status: submission.status,
                publishedUrl: website?.publishedUrl ?? null,
                websiteId: website?._id ?? null,
                leadCount,
                claimedAt: link.claimedAt,
            });
        }
        return out;
    },
});

/** Editable content for a website the owner owns. Ownership-gated. */
export const getMyWebsiteContent = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        await requireOwnership(ctx, args.submissionId);
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();
        if (!website) return null;
        return await ctx.db
            .query('websiteContent')
            .withIndex('by_websiteId', (q) => q.eq('websiteId', website._id))
            .first();
    },
});

// ==================== CLAIM FLOW ====================

/**
 * Admin-gated: mint a claim token so the email layer can build the
 * "Edit my website" link. Called from the admin-only send-email route.
 * Returns the raw token (the route turns it into a /my-business/claim URL).
 */
export const issueClaimTokenForEmail = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args): Promise<{ token: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const me = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!me || me.role !== 'admin') throw new Error('Forbidden: admin access required');
        return await mintClaimToken(ctx, args.submissionId);
    },
});

/** Shared token-minting logic (used by the internal + admin entry points). */
async function mintClaimToken(ctx: MutationCtx, submissionId: Id<'submissions'>): Promise<{ token: string }> {
    const submission = await ctx.db.get(submissionId);
    if (!submission?.ownerEmail) throw new Error('Submission has no owner email');

    // Supersede older pending tokens so only the latest link works.
    const prior = await ctx.db
        .query('ownerClaimTokens')
        .withIndex('by_submission', (q) => q.eq('submissionId', submissionId))
        .filter((q) => q.eq(q.field('status'), 'pending'))
        .collect();
    for (const p of prior) await ctx.db.patch(p._id, { status: 'cancelled' });

    const now = Date.now();
    const token = generateClaimToken();
    await ctx.db.insert('ownerClaimTokens', {
        submissionId,
        token,
        email: submission.ownerEmail,
        status: 'pending',
        createdAt: now,
        expiresAt: claimTokenExpiry(now),
    });
    return { token };
}

/**
 * Internal: mint a claim token for a submission (called when sending the
 * "Edit my website" email from server code). Cancels any prior pending token.
 */
export const issueClaimToken = internalMutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => mintClaimToken(ctx, args.submissionId),
});

/**
 * Redeem a claim token: the signed-in (Clerk) user becomes/links a businessOwner
 * and gains ownership of the submission's website.
 *
 * HARD CHECK: the signed-in verified email must equal the submission's ownerEmail
 * (emailMatchesSubmission). A leaked link is useless without controlling that inbox.
 */
export const claimWebsite = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Sign in to claim your website');
        if (!isValidClaimTokenFormat(args.token)) throw new Error('Invalid claim link');

        const tokenRow = await ctx.db
            .query('ownerClaimTokens')
            .withIndex('by_token', (q) => q.eq('token', args.token))
            .first();
        if (!tokenRow) throw new Error('Claim link not found');
        if (!isClaimTokenUsable(tokenRow, Date.now())) {
            throw new Error('This claim link has expired or already been used');
        }

        const submission = await ctx.db.get(tokenRow.submissionId);
        if (!submission) throw new Error('Website not found');

        // The trust anchor: signed-in email must match the email on file.
        const signedInEmail = (identity.email as string | undefined) ?? undefined;
        if (!emailMatchesSubmission(signedInEmail, submission.ownerEmail)) {
            throw new Error(
                'This link was sent to a different email. Sign in with the email your website was registered to.',
            );
        }

        // Upsert the businessOwner for this Clerk user.
        let owner = await ctx.db
            .query('businessOwners')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!owner) {
            const ownerId = await ctx.db.insert('businessOwners', {
                clerkId: identity.subject,
                email: signedInEmail!,
                name: (identity.name as string | undefined) ?? submission.ownerName,
                phone: submission.ownerPhone,
                createdAt: Date.now(),
            });
            owner = await ctx.db.get(ownerId);
        }
        if (!owner) throw new Error('Failed to create owner profile');

        // Link ownership (idempotent — don't double-link on a re-click).
        const existing = await ctx.db
            .query('websiteOwnerships')
            .withIndex('by_submission', (q) => q.eq('submissionId', tokenRow.submissionId))
            .filter((q) => q.eq(q.field('businessOwnerId'), owner!._id))
            .first();
        if (!existing) {
            await ctx.db.insert('websiteOwnerships', {
                businessOwnerId: owner._id,
                submissionId: tokenRow.submissionId,
                role: 'owner',
                claimedAt: Date.now(),
            });
        }

        // Consume the single-use token.
        await ctx.db.patch(tokenRow._id, { status: 'consumed', consumedAt: Date.now() });

        return { submissionId: tokenRow.submissionId };
    },
});

// ==================== CONTENT EDIT (ownership-gated) ====================

/**
 * Owner edits to their site's content fields. Content-only by design: owners
 * cannot touch templates, domains, status, or the build pipeline (those aren't
 * in this arg set). Every call re-checks ownership server-side.
 */
export const updateMyWebsiteContent = mutation({
    args: {
        submissionId: v.id('submissions'),
        // Content-only fields owners may edit (must exist on websiteContent).
        patch: v.object({
            businessName: v.optional(v.string()),
            tagline: v.optional(v.string()),
            aboutText: v.optional(v.string()),
            heroHeadline: v.optional(v.string()),
            heroSubheadline: v.optional(v.string()),
            aboutHeadline: v.optional(v.string()),
            aboutDescription: v.optional(v.string()),
            servicesHeadline: v.optional(v.string()),
            servicesSubheadline: v.optional(v.string()),
            services: v.optional(
                v.array(
                    v.object({
                        name: v.string(),
                        description: v.string(),
                        icon: v.optional(v.string()),
                    }),
                ),
            ),
            contact: v.optional(
                v.object({
                    email: v.string(),
                    phone: v.string(),
                    address: v.optional(v.string()),
                }),
            ),
        }),
    },
    handler: async (ctx, args) => {
        const owner = await requireOwnership(ctx, args.submissionId);

        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();
        if (!website) throw new Error('Website not found');
        const content = await ctx.db
            .query('websiteContent')
            .withIndex('by_websiteId', (q) => q.eq('websiteId', website._id))
            .first();
        if (!content) throw new Error('Website content not found');

        // Drop undefined keys so a partial patch never clobbers unrelated fields.
        const updates = Object.fromEntries(
            Object.entries(args.patch).filter(([, val]) => val !== undefined),
        );
        await ctx.db.patch(content._id, updates);

        // Audit (the forensic answer to "wrong info got injected").
        await ctx.db.insert('auditLogs', {
            adminId: `owner:${owner._id}`,
            action: 'owner_content_edit',
            targetType: 'submission',
            targetId: args.submissionId,
            metadata: { fields: Object.keys(updates), websiteId: website._id },
            timestamp: Date.now(),
        });

        return { ok: true, fieldsUpdated: Object.keys(updates).length };
    },
});
