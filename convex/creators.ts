import { v } from 'convex/values';
import { query, mutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';

// ==================== QUERIES ====================

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
