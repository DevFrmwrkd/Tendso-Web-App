import { v } from 'convex/values';
import { query, mutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';

// ==================== QUERIES ====================

/**
 * Public: count of all creators on the platform.
 * Used by the landing page hero counter.
 */
export const count = query({
    args: {},
    handler: async (ctx) => {
        const creators = await ctx.db.query('creators').collect();
        return creators.length;
    },
});

/**
 * Get current creator by Clerk ID
 */
export const getByClerkId = query({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
            .unique();
    },
});

/**
 * Get creator by ID
 */
export const getById = query({
    args: { id: v.id('creators') },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

/**
 * Internal version of getById (callable from actions)
 */
export const getByIdInternal = internalQuery({
    args: { id: v.id('creators') },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

/**
 * Get creator by email
 */
export const getByEmail = query({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('creators')
            .withIndex('by_email', (q) => q.eq('email', args.email))
            .unique();
    },
});

/**
 * Check whether an email matches a soft-deleted creator account.
 *
 * Mobile-referenced — do NOT remove, do NOT add an auth guard. Called
 * unauthenticated from the mobile signup + forgot-password screens the moment
 * the form mounts, so the caller is by definition not yet signed in. Any
 * `requireAuth` / `requireAdmin` wrapper here produces `Server Error` on the
 * client and totally blocks new-user signup on the Google Play APK.
 *
 * See docs/changes/MOBILE-REGISTER-ERROR.md for the incident that caused
 * signup outage on 2026-04-23 when this query was missing from the web repo.
 *
 * Returns only a boolean — does not expose any account metadata.
 */
export const isDeletedByEmail = query({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        const creator = await ctx.db
            .query('creators')
            .withIndex('by_email', (q) => q.eq('email', args.email))
            .first();
        return creator?.isDeleted === true;
    },
});

/**
 * Get creator by referral code
 */
export const getByReferralCode = query({
    args: { referralCode: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('creators')
            .withIndex('by_referral_code', (q) => q.eq('referralCode', args.referralCode))
            .unique();
    },
});

/**
 * Get all creators (admin only)
 */
export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query('creators').collect();
    },
});

/**
 * Get all creators with submission counts
 */
export const getAllWithStats = query({
    args: {},
    handler: async (ctx) => {
        const creators = await ctx.db.query('creators').collect();

        const creatorsWithStats = await Promise.all(
            creators.map(async (creator) => {
                const submissions = await ctx.db
                    .query('submissions')
                    .withIndex('by_creator_id', (q) => q.eq('creatorId', creator._id))
                    .collect();

                return {
                    ...creator,
                    submissionCount: submissions.length,
                };
            })
        );

        return creatorsWithStats;
    },
});

// ==================== MUTATIONS ====================

/**
 * Create a new creator (called after Clerk signup)
 */
export const create = mutation({
    args: {
        clerkId: v.string(),
        firstName: v.string(),
        middleName: v.optional(v.string()),
        lastName: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        referralCode: v.string(),
        referredBy: v.optional(v.id('creators')),
        referredByCode: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check if creator already exists
        const existing = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
            .unique();

        if (existing) {
            return existing._id;
        }

        const creatorId = await ctx.db.insert('creators', {
            clerkId: args.clerkId,
            firstName: args.firstName,
            middleName: args.middleName,
            lastName: args.lastName,
            email: args.email || '',
            phone: args.phone,
            referralCode: args.referralCode || '',
            referredBy: args.referredBy,
            referredByCode: args.referredByCode,
            balance: 0,
            totalEarnings: 0,
            totalWithdrawn: 0,
            submissionCount: 0,
            status: 'active',
            role: 'creator',
            createdAt: Date.now(),
        });

        // Wire referral: if referredByCode was provided, create a referral record and save referrer name
        if (args.referredByCode) {
            const referrer = await ctx.db
                .query('creators')
                .withIndex('by_referral_code', (q) => q.eq('referralCode', args.referredByCode!))
                .first();

            if (referrer && referrer._id !== creatorId) {
                // Save referrer's name on the new creator
                await ctx.db.patch(creatorId, {
                    referredBy: referrer._id,
                    referredByName: `${referrer.firstName} ${referrer.lastName}`,
                });

                await ctx.scheduler.runAfter(0, internal.referrals.createFromSignup, {
                    referrerId: referrer._id,
                    referredId: creatorId,
                    referralCode: args.referredByCode!,
                });
            }
        }

        return creatorId;
    },
});

/**
 * Update creator profile
 */
export const update = mutation({
    args: {
        id: v.id('creators'),
        firstName: v.optional(v.string()),
        middleName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        profileImage: v.optional(v.string()),
        payoutMethod: v.optional(v.string()),
        payoutDetails: v.optional(v.string()),
        wiseEmail: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;

        // Filter out undefined values
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, value]) => value !== undefined)
        );

        await ctx.db.patch(id, filteredUpdates);
    },
});

/**
 * Update creator status (admin only)
 */
export const updateStatus = mutation({
    args: {
        id: v.id('creators'),
        status: v.union(
            v.literal('pending'),
            v.literal('active'),
            v.literal('suspended'),
            v.literal('deleted')
        ),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { status: args.status });
    },
});

/**
 * Update creator role (admin only)
 */
export const updateRole = mutation({
    args: {
        id: v.id('creators'),
        role: v.union(v.literal('creator'), v.literal('admin')),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { role: args.role });
    },
});

/**
 * Update creator balance
 */
export const updateBalance = mutation({
    args: {
        id: v.id('creators'),
        balance: v.number(),
        totalEarnings: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const updates: { balance: number; totalEarnings?: number } = {
            balance: args.balance,
        };
        if (args.totalEarnings !== undefined) {
            updates.totalEarnings = args.totalEarnings;
        }
        await ctx.db.patch(args.id, updates);
    },
});

/**
 * Certify a creator (sets certifiedAt timestamp, sends notification)
 */
export const certify = mutation({
    args: { id: v.id('creators') },
    handler: async (ctx, args) => {
        const creator = await ctx.db.get(args.id);
        if (!creator) throw new Error('Creator not found');

        await ctx.db.patch(args.id, { certifiedAt: Date.now() });

        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: args.id,
            type: 'certification',
            title: 'Certification Complete',
            body: 'Congratulations! You are now a certified creator and can start submitting businesses.',
            data: { showCertificate: true },
        });
    },
});

/**
 * Apply a referral code post-signup (for OAuth users or those who skipped it during registration)
 */
export const applyReferralCode = mutation({
    args: {
        id: v.id('creators'),
        referredByCode: v.string(),
    },
    handler: async (ctx, args) => {
        const creator = await ctx.db.get(args.id);
        if (!creator) throw new Error('Creator not found');

        // Reject if already has a referral code applied
        if (creator.referredByCode) {
            throw new Error('You have already applied a referral code');
        }

        // Check if a referral record already exists for this creator
        const existingReferral = await ctx.db
            .query('referrals')
            .withIndex('by_referred', (q) => q.eq('referredId', args.id))
            .first();
        if (existingReferral) {
            throw new Error('A referral has already been recorded for your account');
        }

        // Find the referrer by code
        const referrer = await ctx.db
            .query('creators')
            .withIndex('by_referral_code', (q) => q.eq('referralCode', args.referredByCode))
            .first();
        if (!referrer) {
            throw new Error('Invalid referral code');
        }

        // Prevent self-referral
        if (referrer._id === args.id) {
            throw new Error('You cannot use your own referral code');
        }

        // Save the referral code and referrer info on the creator
        await ctx.db.patch(args.id, {
            referredByCode: args.referredByCode,
            referredBy: referrer._id,
            referredByName: `${referrer.firstName} ${referrer.lastName}`,
        });

        // Create referral record
        await ctx.scheduler.runAfter(0, internal.referrals.createFromSignup, {
            referrerId: referrer._id,
            referredId: args.id,
            referralCode: args.referredByCode,
        });
    },
});

/**
 * Update last active timestamp for a creator
 */
export const updateLastActive = mutation({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        const creator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
            .unique();

        if (creator) {
            await ctx.db.patch(creator._id, { lastActiveAt: Date.now() });
        }
    },
});

// ============================================================================
// CREATOR VERIFICATION FLOW (admin-gated)
//
// Flow:
//   1. Creator passes onboarding quiz → markQuizPassed sets quizPassedAt
//   2. Mobile routes the creator to /pending-review (locked screen)
//   3. Admin reviews on web admin panel and clicks "Approve"
//   4. approveCreator sets certifiedAt → mobile gate releases automatically
// ============================================================================

/**
 * Mobile-called when a creator finishes the onboarding quiz.
 * Self-only — the calling Clerk identity must own the creator record.
 * Idempotent: returns silently if already quiz-passed or already certified.
 */
export const markQuizPassed = mutation({
    args: { id: v.id('creators') },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const creator = await ctx.db.get(args.id);
        if (!creator || creator.clerkId !== identity.subject) {
            throw new Error('Forbidden: you can only update your own account');
        }
        if (creator.certifiedAt) return;
        if (creator.quizPassedAt) return;
        await ctx.db.patch(args.id, {
            quizPassedAt: Date.now(),
            lastActiveAt: Date.now(),
        });
    },
});

/**
 * Admin-only: approve a creator that has passed the quiz.
 * Sets certifiedAt and schedules a "certification" notification.
 * Idempotent: returns silently if the creator is already certified.
 */
export const approveCreator = mutation({
    args: { id: v.id('creators') },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const me = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!me || me.role !== 'admin') throw new Error('Forbidden: admin access required');

        const creator = await ctx.db.get(args.id);
        if (!creator) throw new Error('Creator not found');
        if (creator.certifiedAt) return;

        await ctx.db.patch(args.id, {
            certifiedAt: Date.now(),
            lastActiveAt: Date.now(),
        });
        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: args.id,
            type: 'certification' as const,
            title: "You're approved!",
            body: 'Welcome aboard. You can now submit businesses and earn from your interviews.',
            data: { approvedByAdmin: true },
        });
    },
});

/**
 * Admin-only: list creators awaiting approval (quiz passed, not yet certified).
 * Sorted newest-pending-first so admins see the longest-waiting creators on top.
 */
export const listPendingApproval = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const me = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!me || me.role !== 'admin') throw new Error('Forbidden: admin access required');

        const all = await ctx.db.query('creators').collect();
        return all
            // Exclude rejected creators from the pending queue — they live in
            // the separate "Rejected creators" view.
            .filter((c) => c.quizPassedAt && !c.certifiedAt && !c.rejectedAt && !c.isDeleted)
            .map((c) => ({
                _id: c._id,
                clerkId: c.clerkId,
                email: c.email,
                firstName: c.firstName ?? null,
                middleName: c.middleName ?? null,
                lastName: c.lastName ?? null,
                phone: c.phone ?? null,
                profileImage: c.profileImage ?? null,
                quizPassedAt: c.quizPassedAt!,
                createdAt: c.createdAt ?? null,
                referredByCode: c.referredByCode ?? null,
                referredByName: c.referredByName ?? null,
            }))
            // Oldest-pending first — admins should handle the longest-waiting
            // creator at the top of the queue (per DIAGNOSIS-APPROVAL.md).
            .sort((a, b) => a.quizPassedAt - b.quizPassedAt);
    },
});

// ============================================================================
// CREATOR REJECTION FLOW (admin-gated)
//
// Counterpart to approveCreator. Admin can choose Reject (with optional reason)
// when reviewing a pending creator. Mobile detects rejectedAt and routes the
// creator to /verification-rejected, where they can either request a retry
// (clears rejectedAt + quizPassedAt → bounces back to /training) or contact
// support.
//
// Invariant: certifiedAt and rejectedAt are mutually exclusive. The rejection
// mutation throws if the creator is already certified — explicit "unapprove"
// is out of scope.
// ============================================================================

/**
 * Admin-only: reject a creator that has passed the quiz.
 * Sets rejectedAt + optional reason and notifies the creator.
 * Idempotent: returns silently if already rejected.
 * Throws if the creator is already certified.
 */
export const rejectCreator = mutation({
    args: {
        id: v.id('creators'),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const me = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!me || me.role !== 'admin') throw new Error('Forbidden: admin access required');

        const creator = await ctx.db.get(args.id);
        if (!creator) throw new Error('Creator not found');
        if (creator.rejectedAt) return; // idempotent
        if (creator.certifiedAt) {
            throw new Error('Cannot reject a creator who has already been approved');
        }

        const trimmed = args.reason?.trim();
        if (trimmed && trimmed.length > 500) {
            throw new Error('Rejection reason too long (max 500 characters)');
        }

        await ctx.db.patch(args.id, {
            rejectedAt: Date.now(),
            rejectionReason: trimmed && trimmed.length > 0 ? trimmed : undefined,
            rejectedBy: identity.subject,
            lastActiveAt: Date.now(),
        });

        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: args.id,
            type: 'certification' as const,
            title: 'Verification update',
            body: trimmed && trimmed.length > 0
                ? `Your application wasn't approved this time. Reason: ${trimmed}`
                : "Your application wasn't approved this time. You can retake the quiz or contact support.",
            data: { rejectedByAdmin: true },
        });
    },
});

/**
 * Creator-self-only: request a retry after being rejected.
 * Clears rejectedAt + quizPassedAt so the mobile app routes the creator back
 * to /training. Errors if the creator was never rejected (defensive — the
 * mobile UI should only surface this when rejectedAt is set).
 */
export const requestRecertification = mutation({
    args: { id: v.id('creators') },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const creator = await ctx.db.get(args.id);
        if (!creator || creator.clerkId !== identity.subject) {
            throw new Error('Forbidden: you can only update your own account');
        }
        if (!creator.rejectedAt) {
            throw new Error('Only rejected creators can request recertification');
        }
        if (creator.certifiedAt) {
            throw new Error('Already certified');
        }
        await ctx.db.patch(args.id, {
            rejectedAt: undefined,
            rejectionReason: undefined,
            rejectedBy: undefined,
            quizPassedAt: undefined,
            lastActiveAt: Date.now(),
        });
    },
});

/**
 * Admin-only: list creators that were rejected and haven't yet retaken the quiz.
 * Newest-first so admins see the most recent rejections on top.
 */
export const listRejected = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const me = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
            .first();
        if (!me || me.role !== 'admin') throw new Error('Forbidden: admin access required');

        const all = await ctx.db.query('creators').collect();
        return all
            .filter((c) => c.rejectedAt && !c.certifiedAt && !c.isDeleted)
            .map((c) => ({
                _id: c._id,
                clerkId: c.clerkId,
                email: c.email,
                firstName: c.firstName ?? null,
                middleName: c.middleName ?? null,
                lastName: c.lastName ?? null,
                phone: c.phone ?? null,
                profileImage: c.profileImage ?? null,
                quizPassedAt: c.quizPassedAt ?? null,
                rejectedAt: c.rejectedAt!,
                rejectionReason: c.rejectionReason ?? null,
                rejectedBy: c.rejectedBy ?? null,
                createdAt: c.createdAt ?? null,
            }))
            .sort((a, b) => b.rejectedAt - a.rejectedAt);
    },
});

/**
 * Internal — fetch a creator record by clerkId for action-context auth checks.
 * Used by `convex/lib/auth.ts:requireAdmin` when called from an ActionCtx
 * (which can't read ctx.db directly). Never call from user code.
 */
export const getMeForAuthInternal = internalQuery({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
            .first();
    },
});
