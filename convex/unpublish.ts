import { v } from 'convex/values';
import { internalQuery, internalMutation, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { deployHoldingPage, resolveHoldingTheme } from '../lib/holding-page';
import { needsCloudflareWorker } from '../lib/publish-target';

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

/**
 * Internal query: find pending_payment submissions whose sentEmailAt is older than 3 days.
 */
export const getOverdueSubmissions = internalQuery({
    handler: async (ctx) => {
        const deadline = Date.now() - THREE_DAYS;

        const submissions = await ctx.db
            .query('submissions')
            .withIndex('by_status', (q) => q.eq('status', 'pending_payment'))
            .collect();

        return submissions.filter(
            (s) => !s.giveawayApplication && s.sentEmailAt !== undefined && s.sentEmailAt < deadline
        );
    },
});

/**
 * Internal mutation: mark a submission's website as offline.
 *
 * It used to clear publishedUrl and cfPagesProjectName, which threw away the
 * only record of WHICH Worker was serving the site — leaving nothing able to
 * find it again, to take it down, or to put it back. They are kept now: the
 * site comes back with one publish, at the same URL, with its custom domain
 * still attached.
 */
export const markSubmissionUnpublished = internalMutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (submission?.giveawayApplication) return;
        await ctx.db.patch(args.submissionId, {
            status: 'unpublished',
            unpublishedAt: Date.now(),
        });

        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (website) {
            await ctx.db.patch(website._id, { offlineAt: Date.now() });
        }
    },
});

/**
 * Internal action: take a website offline by redeploying its Worker with the
 * holding page.
 *
 * This replaces a DELETE against `/pages/projects/{name}`. Sites are published
 * as Workers (app/api/publish-website/route.ts), so that call 404'd every time,
 * the 404 was logged as "Deleted CF project", and the overdue site kept serving
 * — the three-day payment deadline had no teeth at all.
 *
 * The database is only updated when Cloudflare confirms the deploy. A failure
 * leaves the submission in pending_payment so the next hourly run retries it;
 * marking it unpublished while the site is still up is what this is fixing.
 */
export const takeWebsiteOffline = internalAction({
    args: {
        submissionId: v.id('submissions'),
        projectName: v.string(),
        businessName: v.string(),
        // Passed rather than re-queried: the caller already holds both rows, and
        // they are what the holding page needs to wear the site's own colours.
        businessType: v.optional(v.string()),
        customizations: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;
        const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

        if (!cfApiToken || !cfAccountId) {
            console.error(
                `[unpublish] Missing Cloudflare credentials — ${args.projectName} is STILL LIVE and was not marked unpublished. Will retry next run.`
            );
            return;
        }

        try {
            const theme = resolveHoldingTheme(args.customizations, args.businessType);
            await deployHoldingPage(cfApiToken, cfAccountId, args.projectName, args.businessName, theme);
            console.log(`[unpublish] Holding page deployed to Worker: ${args.projectName}`);
        } catch (err) {
            console.error(
                `[unpublish] Holding-page deploy FAILED for ${args.projectName} — site is still live, leaving status untouched so the next run retries:`,
                err
            );
            return;
        }

        await ctx.runMutation(internal.unpublish.markSubmissionUnpublished, {
            submissionId: args.submissionId,
        });
    },
});

/**
 * Main entry point called by the hourly cron.
 * Finds all overdue pending_payment submissions and unpublishes their websites.
 */
export const checkAndUnpublish = internalAction({
    handler: async (ctx) => {
        const overdue = await ctx.runQuery(internal.unpublish.getOverdueSubmissions);

        if (overdue.length === 0) {
            console.log('[unpublish] No overdue submissions found.');
            return;
        }

        console.log(`[unpublish] Found ${overdue.length} overdue submission(s). Processing...`);

        for (const submission of overdue) {
            // Get the CF Pages project name from the generatedWebsites table
            const website = await ctx.runQuery(internal.unpublish.getWebsiteForSubmission, {
                submissionId: submission._id,
            });

            // THE SAME PREDICATE THE PUBLISH AND UNPUBLISH ROUTES USE, not the
            // bare presence of cfPagesProjectName.
            //
            // That field records that a Worker was once deployed, not that one
            // exists — aurora-villa and neighborhood have been deleted by hand —
            // and deployHoldingPage's PUT is create-or-update. So this cron would
            // have RESURRECTED a deleted Worker, unattended, and served a holding
            // page at an address that was deliberately retired. A site with a
            // hosted address needs no Worker touched: markSubmissionUnpublished
            // sets offlineAt and app/hosted/[slug] serves the holding page from
            // that alone.
            if (needsCloudflareWorker(website, submission) && website?.cfPagesProjectName) {
                await ctx.runAction(internal.unpublish.takeWebsiteOffline, {
                    submissionId: submission._id,
                    projectName: website.cfPagesProjectName,
                    businessName: submission.businessName || '',
                    businessType: submission.businessType || undefined,
                    customizations: website.customizations,
                });
            } else {
                // Either nothing was ever deployed for this submission, or the
                // site is served from its hosted address and its Worker is no
                // longer ours to maintain. Either way, record the state directly.
                await ctx.runMutation(internal.unpublish.markSubmissionUnpublished, {
                    submissionId: submission._id,
                });
            }

            console.log(`[unpublish] Processed submission ${submission._id} (${submission.businessName})`);
        }
    },
});

/**
 * Internal query: get generatedWebsite record for a submission (used by checkAndUnpublish action).
 */
export const getWebsiteForSubmission = internalQuery({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        return ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();
    },
});
