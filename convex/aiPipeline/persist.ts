/**
 * AI site pipeline — the two writes around the build (docs/v2-ai-pipeline.md).
 *
 * prepareBuild   writes the pipeline's page content (and polished photos) onto
 *                the submission's generatedWebsites row, where the existing
 *                builder (/api/generate-website) reads them.
 * saveBuiltSite  saves what that builder returned, with the SAME row writers the
 *                admin path uses (upsertGeneratedWebsiteRow, upsertWebsiteContentRow),
 *                as a draft — exactly what an admin "Generate" leaves behind.
 *
 * Neither touches `submissions.status`: the human review queue stays as today.
 */

import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { mergeEnhancedImages } from '../lib/enhancedImages';
import { upsertGeneratedWebsiteRow } from '../generatedWebsites';
import { upsertWebsiteContentRow, websiteContentUpsertArgs } from '../websiteContent';

// The row's fields without the websiteId (the mutation resolves that itself).
const websiteContentFieldValidators: Omit<typeof websiteContentUpsertArgs, 'websiteId'> = (() => {
    const fields: Partial<typeof websiteContentUpsertArgs> = { ...websiteContentUpsertArgs };
    delete fields.websiteId;
    return fields as Omit<typeof websiteContentUpsertArgs, 'websiteId'>;
})();

export const prepareBuild = internalMutation({
    args: {
        runId: v.id('aiPipelineRuns'),
        submissionId: v.id('submissions'),
        content: v.any(),
        enhancedImages: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!run || run.status !== 'running') return { ok: false as const, code: 'stale', message: 'run is no longer running' };
        const existing = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        // Never overwrite a site a human already built or published, unless
        // this run was asked to rebuild (force).
        if (existing && !run.force) {
            if (existing.status === 'published') {
                return { ok: false as const, code: 'published', message: 'This site is already published; start a rebuild (force) to replace it.' };
            }
            if (existing.htmlStorageId || existing.htmlContent) {
                return { ok: false as const, code: 'already_built', message: 'A site was already built for this submission; start a rebuild (force) to replace it.' };
            }
        }

        const images = args.enhancedImages && typeof args.enhancedImages === 'object' && Object.keys(args.enhancedImages).length > 0
            ? args.enhancedImages as Record<string, unknown>
            : null;
        if (existing) {
            await ctx.db.patch(existing._id, {
                extractedContent: args.content,
                ...(images ? { enhancedImages: mergeEnhancedImages((existing as { enhancedImages?: unknown }).enhancedImages, images) } : {}),
                updatedAt: Date.now(),
            });
        } else {
            await ctx.db.insert('generatedWebsites', {
                submissionId: args.submissionId,
                templateName: 'astro',
                extractedContent: args.content,
                status: 'draft',
                ...(images ? { enhancedImages: images } : {}),
                updatedAt: Date.now(),
            });
        }
        return { ok: true as const, customizations: (existing?.customizations ?? null) as Record<string, unknown> | null };
    },
});

export const saveBuiltSite = internalMutation({
    args: {
        runId: v.id('aiPipelineRuns'),
        submissionId: v.id('submissions'),
        htmlStorageId: v.id('_storage'),
        templateName: v.string(),
        extractedContent: v.any(),
        customizations: v.optional(v.any()),
        websiteContent: v.object(websiteContentFieldValidators),
    },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!run || run.status !== 'running') {
            // The run timed out or was replaced while building: drop the blob.
            await ctx.scheduler.runAfter(0, internal.generatedWebsites.deleteBlob, { storageId: args.htmlStorageId });
            return { saved: false };
        }
        const websiteId = await upsertGeneratedWebsiteRow(ctx, {
            submissionId: args.submissionId,
            templateName: args.templateName,
            extractedContent: args.extractedContent,
            customizations: args.customizations,
            htmlStorageId: args.htmlStorageId,
        });
        await upsertWebsiteContentRow(ctx, { websiteId, ...args.websiteContent });
        return { saved: true, websiteId };
    },
});
