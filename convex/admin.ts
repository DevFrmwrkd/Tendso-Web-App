import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import { internal } from './_generated/api';

// ==================== QUERIES ====================

/**
 * Check if user is admin
 */
export const isAdmin = query({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        const creator = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
            .unique();

        return creator?.role === 'admin';
    },
});

/**
 * Get pending payouts (submissions with payout requests)
 */
export const getPendingPayouts = query({
    args: {},
    handler: async (ctx) => {
        const submissions = await ctx.db
            .query('submissions')
            .filter((q) =>
                q.and(
                    q.neq(q.field('payoutRequestedAt'), undefined),
                    q.eq(q.field('creatorPaidAt'), undefined)
                )
            )
            .order('desc')
            .collect();

        // Enrich with creator info
        const payouts = await Promise.all(
            submissions.map(async (submission) => {
                const creator = await ctx.db.get(submission.creatorId);
                return {
                    ...submission,
                    creator: creator
                        ? {
                            firstName: creator.firstName,
                            lastName: creator.lastName,
                            email: creator.email,
                            phone: creator.phone,
                            payoutMethod: creator.payoutMethod,
                            payoutDetails: creator.payoutDetails,
                        }
                        : null,
                };
            })
        );

        return payouts;
    },
});

/**
 * Get payout statistics
 */
export const getPayoutStats = query({
    args: {},
    handler: async (ctx) => {
        const allSubmissions = await ctx.db.query('submissions').collect();

        // Pending payouts
        const pendingPayouts = allSubmissions.filter(
            (s) => s.payoutRequestedAt && !s.creatorPaidAt
        );
        const totalPending = pendingPayouts.length;
        const totalPendingAmount = pendingPayouts.reduce(
            (sum, s) => sum + (s.creatorPayout ?? 0),
            0
        );

        // Paid this week
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const paidThisWeek = allSubmissions.filter(
            (s) => s.creatorPaidAt && s.creatorPaidAt > oneWeekAgo
        );
        const paidThisWeekCount = paidThisWeek.length;
        const paidThisWeekAmount = paidThisWeek.reduce(
            (sum, s) => sum + (s.creatorPayout ?? 0),
            0
        );

        return {
            totalPending,
            totalPendingAmount,
            paidThisWeek: paidThisWeekCount,
            paidThisWeekAmount,
        };
    },
});

/**
 * Get dashboard stats
 */
export const getDashboardStats = query({
    args: {},
    handler: async (ctx) => {
        const submissions = await ctx.db.query('submissions').collect();
        const creators = await ctx.db.query('creators').collect();

        const totalSubmissions = submissions.length;
        const pendingReview = submissions.filter(
            (s) => s.status === 'submitted' || s.status === 'in_review'
        ).length;
        const websitesGenerated = submissions.filter(
            (s) =>
                s.status === 'website_generated' ||
                s.status === 'pending_payment' ||
                s.status === 'paid' ||
                s.status === 'completed'
        ).length;
        const deployed = submissions.filter((s) => s.status === 'deployed').length;
        const totalCreators = creators.length;
        const activeCreators = creators.filter((c) => c.status === 'active').length;

        return {
            totalSubmissions,
            pendingReview,
            websitesGenerated,
            deployed,
            totalCreators,
            activeCreators,
        };
    },
});

// ==================== WIRED ADMIN MUTATIONS ====================

/**
 * Approve a submission — sets status, tracks reviewer, triggers audit + notification + analytics + referral check
 */
export const approveSubmission = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');

        const previousStatus = submission.status;

        // Update submission status
        await ctx.db.patch(args.submissionId, {
            status: 'approved',
            reviewedBy: args.adminId,
            reviewedAt: Date.now(),
        });

        // Audit log
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'submission_approved',
            targetType: 'submission',
            targetId: args.submissionId,
            metadata: { businessName: submission.businessName, previousStatus },
        });

        // Notification to creator
        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: submission.creatorId,
            type: 'submission_approved',
            title: 'Submission Approved!',
            body: `Your submission for "${submission.businessName}" has been approved.`,
            data: { submissionId: args.submissionId },
        });

        // Analytics
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: today,
            periodType: 'daily',
            field: 'approvedCount',
            delta: 1,
        });
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: month,
            periodType: 'monthly',
            field: 'approvedCount',
            delta: 1,
        });

        return args.submissionId;
    },
});

/**
 * Reject a submission — sets status + reason, triggers audit + notification + analytics
 */
export const rejectSubmission = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');

        const previousStatus = submission.status;

        // Update submission status
        const updates: any = {
            status: 'rejected',
            reviewedBy: args.adminId,
            reviewedAt: Date.now(),
        };
        if (args.reason) {
            updates.rejectionReason = args.reason;
        }
        await ctx.db.patch(args.submissionId, updates);

        // Audit log
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'submission_rejected',
            targetType: 'submission',
            targetId: args.submissionId,
            metadata: { businessName: submission.businessName, reason: args.reason, previousStatus },
        });

        // Notification to creator
        const reasonText = args.reason ? ` Reason: ${args.reason}` : '';
        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: submission.creatorId,
            type: 'submission_rejected',
            title: 'Submission Rejected',
            body: `Your submission for "${submission.businessName}" was rejected.${reasonText}`,
            data: { submissionId: args.submissionId },
        });

        // Analytics
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: today,
            periodType: 'daily',
            field: 'rejectedCount',
            delta: 1,
        });
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: month,
            periodType: 'monthly',
            field: 'rejectedCount',
            delta: 1,
        });

        return args.submissionId;
    },
});

/**
 * Mark a submission as deployed — triggers audit + notification + analytics
 */
/**
 * Mark a submission as having a generated website.
 *
 * Referenced by the mobile app (Google Play binary) — keep exported. See
 * docs/00-Overview-Mobile.md §admin.
 */
export const markWebsiteGenerated = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
        websiteUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');

        const updates: Record<string, unknown> = { status: 'website_generated' };
        if (args.websiteUrl) updates.websiteUrl = args.websiteUrl;
        await ctx.db.patch(args.submissionId, updates);

        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'website_generated',
            targetType: 'submission',
            targetId: args.submissionId,
            metadata: { businessName: submission.businessName, websiteUrl: args.websiteUrl },
        });

        return args.submissionId;
    },
});

/**
 * Alias for submissions.getAllWithCreator — mobile references it as
 * `admin.getAllSubmissionsWithCreators`. Keep exported.
 */
export const getAllSubmissionsWithCreators = query({
    args: {},
    handler: async (ctx) => {
        const submissions = await ctx.db
            .query('submissions')
            .order('desc')
            .collect();

        return Promise.all(
            submissions.map(async (submission) => {
                const creator = await ctx.db.get(submission.creatorId);
                return {
                    ...submission,
                    creator: creator
                        ? {
                              _id: creator._id,
                              firstName: creator.firstName,
                              lastName: creator.lastName,
                              email: creator.email,
                              phone: creator.phone,
                              profileImage: creator.profileImage,
                          }
                        : null,
                };
            })
        );
    },
});

export const markDeployed = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
        websiteUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');

        // Resolve websiteUrl: use provided value, or fall back to generatedWebsites.publishedUrl
        let resolvedUrl = args.websiteUrl;
        if (!resolvedUrl) {
            const website = await ctx.db
                .query('generatedWebsites')
                .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
                .first();
            if (website?.publishedUrl) resolvedUrl = website.publishedUrl;
        }

        // Update submission status
        const updates: any = { status: 'deployed' };
        if (resolvedUrl) updates.websiteUrl = resolvedUrl;
        await ctx.db.patch(args.submissionId, updates);

        // Audit log
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'website_deployed',
            targetType: 'submission',
            targetId: args.submissionId,
            metadata: { businessName: submission.businessName, websiteUrl: resolvedUrl },
        });

        // Notification to creator
        await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
            creatorId: submission.creatorId,
            type: 'website_live',
            title: 'Website is Live!',
            body: `The website for "${submission.businessName}" is now live!`,
            data: { submissionId: args.submissionId, websiteUrl: resolvedUrl },
        });

        // Analytics
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: today,
            periodType: 'daily',
            field: 'websitesLive',
            delta: 1,
        });
        await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
            creatorId: submission.creatorId,
            period: month,
            periodType: 'monthly',
            field: 'websitesLive',
            delta: 1,
        });

        return args.submissionId;
    },
});

/**
 * Mark a submission as paid — creates earning record, updates creator, triggers audit + notification + analytics
 */
export const markPaid = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
    },
    handler: async (ctx, args) => {
        // Delegate to shared credit logic (also used by auto-payment webhook)
        await ctx.scheduler.runAfter(0, internal.payments.creditCreatorForPayment, {
            submissionId: args.submissionId,
            triggeredBy: `admin:${args.adminId}`,
        });

        return args.submissionId;
    },
});

/**
 * Log payment confirmed audit entry — called after marking paid and sending confirmation email.
 */
export const logPaymentConfirmed = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
        emailSent: v.boolean(),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');

        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'payment_confirmed' as const,
            targetType: 'submission',
            targetId: args.submissionId,
            metadata: {
                businessName: submission.businessName,
                ownerEmail: submission.ownerEmail,
                amount: submission.amount,
                emailSent: args.emailSent,
                note: args.emailSent
                    ? 'Payment confirmed and confirmation email sent to business owner'
                    : 'Payment confirmed. No owner email — confirmation email skipped.',
            },
        });
    },
});

/**
 * Mark submission email as sent — sets status to pending_payment and records sentEmailAt.
 * Called by the send-website-email API route after successfully sending the client email.
 */
export const markEmailSent = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');

        await ctx.db.patch(args.submissionId, {
            status: 'pending_payment',
            sentEmailAt: Date.now(),
        });

        // Audit log
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'payment_sent',
            targetType: 'submission',
            targetId: args.submissionId,
            metadata: { businessName: submission.businessName, note: 'Payment email sent to client' },
        });

        return args.submissionId;
    },
});

// ==================== CASCADING DELETION ====================

/**
 * Delete submission and all related Convex records.
 * Called by the /api/delete-submission route AFTER external assets (R2, CF Pages, Airtable) are cleaned up.
 * Deletes: generatedWebsites, websiteContent, Convex storage files, submission record.
 * Creates an audit log entry with deletion metadata.
 */
export const deleteSubmissionRecords = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
        deletedAssets: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');

        const businessName = submission.businessName;
        const creatorId = submission.creatorId;

        // 1. Delete generatedWebsites record
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (website) {
            // Delete Convex storage file for HTML if it exists
            if (website.htmlStorageId) {
                try {
                    await ctx.storage.delete(website.htmlStorageId);
                } catch (e) {
                    // htmlStorageId might be invalid or already deleted
                }
            }
            await ctx.db.delete(website._id);
        }

        // 2. Delete websiteContent records (both via websiteId chain and direct submissionId)
        if (website) {
            const wcByWebsite = await ctx.db
                .query('websiteContent')
                .withIndex('by_websiteId', (q) => q.eq('websiteId', website._id))
                .first();
            if (wcByWebsite) {
                await ctx.db.delete(wcByWebsite._id);
            }
        }

        const wcBySubmission = await ctx.db
            .query('websiteContent')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();
        if (wcBySubmission) {
            await ctx.db.delete(wcBySubmission._id);
        }

        // 3. Delete Convex _storage files (legacy storage IDs for video/audio)
        if (submission.videoStorageId && typeof submission.videoStorageId === 'string' && !submission.videoStorageId.startsWith('http')) {
            try {
                await ctx.storage.delete(submission.videoStorageId as any);
            } catch (e) {
                // Storage ID might be invalid or already deleted
            }
        }
        if (submission.audioStorageId && typeof submission.audioStorageId === 'string' && !submission.audioStorageId.startsWith('http')) {
            try {
                await ctx.storage.delete(submission.audioStorageId as any);
            } catch (e) {
                // Storage ID might be invalid or already deleted
            }
        }

        // 4. Decrement creator's submissionCount
        const creator = await ctx.db.get(creatorId);
        if (creator && (creator.submissionCount || 0) > 0) {
            await ctx.db.patch(creatorId, {
                submissionCount: (creator.submissionCount || 0) - 1,
            });
        }

        // 5. Delete the submission record
        await ctx.db.delete(args.submissionId);

        // 6. Audit log
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'submission_deleted',
            targetType: 'submission',
            targetId: args.submissionId,
            metadata: {
                businessName,
                deletedAssets: args.deletedAssets,
            },
        });

        return { success: true, businessName };
    },
});

// ==================== CREATOR DELETION ====================

/**
 * Delete a creator and all related Convex records.
 * Called by the /api/delete-creator route AFTER external assets and Clerk account are cleaned up.
 * Deletes: all submissions (+ their websites/content), earnings, withdrawals, payoutMethods,
 * leads, leadNotes, notifications, pushTokens, referrals, analytics, and the creator record.
 * Creates an audit log entry.
 */
export const deleteCreatorRecords = mutation({
    args: {
        creatorId: v.id('creators'),
        adminId: v.string(),
        deletedAssets: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const creator = await ctx.db.get(args.creatorId);
        if (!creator) throw new Error('Creator not found');

        const creatorName = `${creator.firstName} ${creator.lastName}`;

        // 1. Delete all submissions and their related records
        const submissions = await ctx.db
            .query('submissions')
            .withIndex('by_creator_id', (q) => q.eq('creatorId', args.creatorId))
            .collect();

        for (const submission of submissions) {
            // Delete generatedWebsites
            const website = await ctx.db
                .query('generatedWebsites')
                .withIndex('by_submissionId', (q) => q.eq('submissionId', submission._id))
                .first();

            if (website) {
                if (website.htmlStorageId) {
                    try { await ctx.storage.delete(website.htmlStorageId); } catch {}
                }
                // Delete websiteContent by websiteId
                const wcByWebsite = await ctx.db
                    .query('websiteContent')
                    .withIndex('by_websiteId', (q) => q.eq('websiteId', website._id))
                    .first();
                if (wcByWebsite) await ctx.db.delete(wcByWebsite._id);

                await ctx.db.delete(website._id);
            }

            // Delete websiteContent by submissionId
            const wcBySubmission = await ctx.db
                .query('websiteContent')
                .withIndex('by_submissionId', (q) => q.eq('submissionId', submission._id))
                .first();
            if (wcBySubmission) await ctx.db.delete(wcBySubmission._id);

            // Delete legacy storage files
            if (submission.videoStorageId && typeof submission.videoStorageId === 'string' && !submission.videoStorageId.startsWith('http')) {
                try { await ctx.storage.delete(submission.videoStorageId as any); } catch {}
            }
            if (submission.audioStorageId && typeof submission.audioStorageId === 'string' && !submission.audioStorageId.startsWith('http')) {
                try { await ctx.storage.delete(submission.audioStorageId as any); } catch {}
            }

            // Delete leads and leadNotes for this submission
            const leads = await ctx.db
                .query('leads')
                .withIndex('by_submission', (q) => q.eq('submissionId', submission._id))
                .collect();
            for (const lead of leads) {
                const notes = await ctx.db
                    .query('leadNotes')
                    .withIndex('by_lead', (q) => q.eq('leadId', lead._id))
                    .collect();
                for (const note of notes) await ctx.db.delete(note._id);
                await ctx.db.delete(lead._id);
            }

            // Delete earnings for this submission
            const earnings = await ctx.db
                .query('earnings')
                .withIndex('by_submission', (q) => q.eq('submissionId', submission._id))
                .collect();
            for (const earning of earnings) await ctx.db.delete(earning._id);

            // Delete websiteAnalytics for this submission
            const webAnalytics = await ctx.db
                .query('websiteAnalytics')
                .withIndex('by_submission_date', (q) => q.eq('submissionId', submission._id))
                .collect();
            for (const wa of webAnalytics) await ctx.db.delete(wa._id);

            // Delete the submission
            await ctx.db.delete(submission._id);
        }

        // 2. Delete creator-level records
        // Withdrawals
        const withdrawals = await ctx.db
            .query('withdrawals')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        for (const w of withdrawals) await ctx.db.delete(w._id);

        // Payout methods
        const payoutMethods = await ctx.db
            .query('payoutMethods')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        for (const pm of payoutMethods) await ctx.db.delete(pm._id);

        // Notifications
        const notifications = await ctx.db
            .query('notifications')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        for (const n of notifications) await ctx.db.delete(n._id);

        // Push tokens
        const pushTokens = await ctx.db
            .query('pushTokens')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        for (const pt of pushTokens) await ctx.db.delete(pt._id);

        // Referrals (as referrer or referred)
        const referralsAsReferrer = await ctx.db
            .query('referrals')
            .withIndex('by_referrer', (q) => q.eq('referrerId', args.creatorId))
            .collect();
        for (const r of referralsAsReferrer) await ctx.db.delete(r._id);

        const referralsAsReferred = await ctx.db
            .query('referrals')
            .withIndex('by_referred', (q) => q.eq('referredId', args.creatorId))
            .collect();
        for (const r of referralsAsReferred) await ctx.db.delete(r._id);

        // Analytics
        const analytics = await ctx.db
            .query('analytics')
            .withIndex('by_creator_period', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        for (const a of analytics) await ctx.db.delete(a._id);

        // Remaining earnings by creator (not already deleted via submissions)
        const remainingEarnings = await ctx.db
            .query('earnings')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        for (const e of remainingEarnings) await ctx.db.delete(e._id);

        // Remaining leads by creator
        const remainingLeads = await ctx.db
            .query('leads')
            .withIndex('by_creator', (q) => q.eq('creatorId', args.creatorId))
            .collect();
        for (const l of remainingLeads) await ctx.db.delete(l._id);

        // 3. Delete the creator record
        await ctx.db.delete(args.creatorId);

        // 4. Audit log
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'creator_updated',
            targetType: 'creator',
            targetId: args.creatorId,
            metadata: {
                creatorName,
                action: 'deleted',
                submissionsDeleted: submissions.length,
                deletedAssets: args.deletedAssets,
            },
        });

        return { success: true, creatorName, submissionsDeleted: submissions.length };
    },
});

// ==================== LEGACY MUTATIONS (kept for backward compat) ====================

/**
 * Mark payout as paid (legacy — use markPaid for audit trail)
 */
export const markPayoutPaid = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) throw new Error('Submission not found');

        await ctx.db.patch(args.submissionId, {
            creatorPaidAt: Date.now(),
            status: 'completed',
        });
    },
});

/**
 * Check if there's any backfill needed for websiteUrl on submissions and publishedUrl on generatedWebsites.
 */
export const checkBackfillNeeded = query({
    args: {},
    handler: async (ctx) => {
        try {
            const targetStatuses = ['deployed', 'pending_payment', 'paid', 'completed'] as const;

            for (const status of targetStatuses) {
                // Use .first() to get one result at a time instead of .collect() to avoid memory issues
                let submission = await ctx.db
                    .query('submissions')
                    .withIndex('by_status', (q) => q.eq('status', status))
                    .first();

                if (submission) {
                    const website = await ctx.db
                        .query('generatedWebsites')
                        .withIndex('by_submissionId', (q) => q.eq('submissionId', submission._id))
                        .first();

                    if (!submission.websiteUrl && website?.publishedUrl) {
                        return true;
                    }

                    if (website && !website.publishedUrl && submission.websiteUrl) {
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Error in checkBackfillNeeded:', error);
            return false;
        }
    },
});

/**
 * Backfill websiteUrl on submissions and publishedUrl on generatedWebsites
 * for all records with status: deployed, pending_payment, paid, or completed.
 * Syncs both directions: submission ← generatedWebsite and generatedWebsite ← submission.
 */
export const backfillWebsiteUrls = mutation({
    args: {},
    handler: async (ctx) => {
        const targetStatuses = ['deployed', 'pending_payment', 'paid', 'completed'] as const;
        let updatedSubmissions = 0;
        let updatedWebsites = 0;

        for (const status of targetStatuses) {
            const submissions = await ctx.db
                .query('submissions')
                .withIndex('by_status', (q) => q.eq('status', status))
                .collect();

            for (const submission of submissions) {
                const website = await ctx.db
                    .query('generatedWebsites')
                    .withIndex('by_submissionId', (q) => q.eq('submissionId', submission._id))
                    .first();

                // Submission missing websiteUrl but generatedWebsite has publishedUrl → copy to submission
                if (!submission.websiteUrl && website?.publishedUrl) {
                    await ctx.db.patch(submission._id, { websiteUrl: website.publishedUrl });
                    updatedSubmissions++;
                }

                // generatedWebsite missing publishedUrl but submission has websiteUrl → copy to website
                if (website && !website.publishedUrl && submission.websiteUrl) {
                    await ctx.db.patch(website._id, {
                        publishedUrl: submission.websiteUrl,
                        status: 'published',
                    });
                    updatedWebsites++;
                }
            }
        }

        return { updatedSubmissions, updatedWebsites };
    },
});

/**
 * Bulk mark payouts as paid
 */
/**
 * Log a transcription regeneration event in audit logs.
 */
export const logTranscriptionRegenerated = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
        businessName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'transcription_regenerated' as const,
            targetType: 'submission' as const,
            targetId: args.submissionId,
            metadata: {
                businessName: args.businessName,
                reason: 'Admin triggered transcription regeneration',
            },
        });
    },
});

/**
 * Log an image enhancement event in audit logs.
 */
export const logImagesEnhanced = mutation({
    args: {
        submissionId: v.id('submissions'),
        adminId: v.string(),
        businessName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
            adminId: args.adminId,
            action: 'images_enhanced' as const,
            targetType: 'submission' as const,
            targetId: args.submissionId,
            metadata: {
                businessName: args.businessName,
                reason: 'Admin triggered Airtable image enhancement',
            },
        });
    },
});

export const bulkMarkPayoutsPaid = mutation({
    args: { submissionIds: v.array(v.id('submissions')) },
    handler: async (ctx, args) => {
        const now = Date.now();

        for (const id of args.submissionIds) {
            await ctx.db.patch(id, {
                creatorPaidAt: now,
                status: 'completed',
            });
        }
    },
});
