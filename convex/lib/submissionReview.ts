import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { assertGiveawayCanActivate } from './giveaway';

/** Shared review effects. Call only after authenticating and scoping the caller. */
export async function approveReviewedSubmission(ctx: MutationCtx, args: { submissionId: Id<'submissions'>; adminId: string }): Promise<Id<'submissions'>> {
    const adminId = args.adminId;
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error('Submission not found');

    const previousStatus = submission.status;
    // A decision on a waiting (or previously rejected) application is news to
    // the owner; re-approving a row already past review sends nothing.
    const notifyOwner = submission.giveawayApplication === true
        && (previousStatus === 'submitted' || previousStatus === 'in_review' || previousStatus === 'rejected');
    // Distinct per review event, as on rejection, so a stale send is ignored.
    const reviewedAt = submission.giveawayApplication
        ? Math.max(Date.now(), (submission.reviewedAt ?? 0) + 1)
        : Date.now();

    // Update submission status
    await assertGiveawayCanActivate(ctx, submission);
    await ctx.db.patch(args.submissionId, {
        status: 'approved',
        reviewedBy: adminId,
        reviewedAt,
        ...(submission.giveawayApplication && submission.airtableSyncStatus === 'pending_review'
            ? { airtableSyncStatus: 'pending_push' } : {}),
        ...(notifyOwner ? { giveawayApprovedEmailSentAt: undefined } : {}),
    });
    // Scheduled with the approval, delivered after it commits: a mail outage
    // can never roll the decision back.
    if (notifyOwner) {
        await ctx.scheduler.runAfter(0, internal.giveawayEmails.sendApproved, {
            submissionId: args.submissionId, reviewedAt,
        });
    }

    // Verify the poster before the first paid enhancement. Existing applications
    // that already rendered do not acquire another render during approval.
    if (submission.giveawayApplication && submission.airtableSyncStatus === 'pending_review') {
        await ctx.scheduler.runAfter(0, internal.hyperagent.triggerStudioRender, { submissionId: args.submissionId });
    }

    // Audit log
    await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
        adminId: adminId,
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

    // Google Drive folder sync — fires asynchronously so the approval
    // mutation returns immediately while Drive uploads happen in the
    // background. Status flows via submissions.driveSyncStatus and the
    // admin UI's Drive section surfaces progress + retry on failure.
    // Per docs/changes/BUSINESS-SCRAPER.md: only auto-sync on admin
    // approval — never on draft/pending/rejected states.
    await ctx.scheduler.runAfter(0, internal.drive.syncSubmissionToDrive, {
        submissionId: args.submissionId,
    });

    return args.submissionId;
}

export async function rejectReviewedSubmission(ctx: MutationCtx, args: { submissionId: Id<'submissions'>; adminId: string; reason?: string }): Promise<Id<'submissions'>> {
    const adminId = args.adminId;
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error('Submission not found');

    const previousStatus = submission.status;
    let reason = args.reason;
    if (submission.giveawayApplication) {
        reason = args.reason?.trim();
        if (!reason) throw new Error('Give the owner a reason for rejecting their giveaway application.');
        if (reason.length > 2000) throw new Error('Keep the rejection reason under 2,000 characters.');
        // A repeated tap cannot schedule a second owner email or double-count
        // the rejection. Authorization still runs before this no-op.
        if (previousStatus === 'rejected') return args.submissionId;
    }
    // Distinguish review events even when two transitions land in one ms.
    const reviewedAt = submission.giveawayApplication
        ? Math.max(Date.now(), (submission.reviewedAt ?? 0) + 1)
        : Date.now();

    // Update submission status
    const updates: Partial<Doc<'submissions'>> = {
        status: 'rejected',
        reviewedBy: adminId,
        reviewedAt,
    };
    if (reason) {
        updates.rejectionReason = reason;
    }
    if (submission.giveawayApplication) updates.giveawayRejectedEmailSentAt = undefined;
    await ctx.db.patch(args.submissionId, updates);
    // Scheduling and releasing the held slot commit together. Delivery runs
    // later, so a mail outage can never roll the rejection back.
    if (submission.giveawayApplication) {
        await ctx.scheduler.runAfter(0, internal.giveawayEmails.sendRejected, {
            submissionId: args.submissionId, reviewedAt, reason: reason!,
        });
    }

    // Audit log
    await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
        adminId: adminId,
        action: 'submission_rejected',
        targetType: 'submission',
        targetId: args.submissionId,
        metadata: { businessName: submission.businessName, reason, previousStatus },
    });

    // Notification to creator
    const reasonText = reason ? ` Reason: ${reason}` : '';
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
}
