import { v } from 'convex/values';
import { mutation, query, internalQuery } from './_generated/server';

// Get generated website by submission ID
export const getBySubmissionId = query({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();
    },
});

// Internal version callable from actions
export const getBySubmissionInternal = internalQuery({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();
    },
});

// Create or update generated website
export const upsert = mutation({
    args: {
        submissionId: v.id('submissions'),
        templateName: v.string(),
        extractedContent: v.any(),
        customizations: v.optional(v.any()),
        htmlContent: v.optional(v.string()),
        cssContent: v.optional(v.string()),
        htmlStorageId: v.optional(v.id('_storage')),
        status: v.optional(v.union(v.literal('draft'), v.literal('published'))),
    },
    handler: async (ctx, args) => {
        // Check if website already exists for this submission
        const existing = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (existing) {
            // Update existing
            await ctx.db.patch(existing._id, {
                templateName: args.templateName,
                extractedContent: args.extractedContent,
                customizations: args.customizations,
                htmlContent: args.htmlContent,
                cssContent: args.cssContent,
                htmlStorageId: args.htmlStorageId,
                status: args.status || existing.status,
            });
            return existing._id;
        } else {
            // Create new
            return await ctx.db.insert('generatedWebsites', {
                submissionId: args.submissionId,
                templateName: args.templateName,
                extractedContent: args.extractedContent,
                customizations: args.customizations,
                htmlContent: args.htmlContent,
                cssContent: args.cssContent,
                htmlStorageId: args.htmlStorageId,
                status: args.status || 'draft',
            });
        }
    },
});

// Update website status and publishing info
export const updatePublishingInfo = mutation({
    args: {
        submissionId: v.id('submissions'),
        publishedUrl: v.optional(v.string()),
        netlifySiteId: v.optional(v.string()),
        cfPagesProjectName: v.optional(v.string()),
        status: v.optional(v.union(v.literal('draft'), v.literal('published'))),
    },
    handler: async (ctx, args) => {
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (!website) {
            throw new Error('Generated website not found');
        }

        const updates: any = {};
        if (args.publishedUrl !== undefined) updates.publishedUrl = args.publishedUrl;
        if (args.netlifySiteId !== undefined) updates.netlifySiteId = args.netlifySiteId;
        if (args.cfPagesProjectName !== undefined) updates.cfPagesProjectName = args.cfPagesProjectName;
        if (args.status !== undefined) {
            updates.status = args.status;
            if (args.status === 'published') {
                updates.publishedAt = Date.now();
            }
        }

        await ctx.db.patch(website._id, updates);
        return website._id;
    },
});

// Public: count of all published websites — landing page hero counter.
export const countPublished = query({
    args: {},
    handler: async (ctx) => {
        const sites = await ctx.db
            .query('generatedWebsites')
            .filter((q) => q.eq(q.field('status'), 'published'))
            .collect();
        return sites.filter((s) => !!s.publishedUrl).length;
    },
});

// Public: list all published websites for the landing-page map.
// Returns business name + category + city + coords + live URL.
// Intentionally minimal — no user PII, no payout fields, no draft sites.
export const listPublished = query({
    args: {},
    handler: async (ctx) => {
        const sites = await ctx.db
            .query('generatedWebsites')
            .filter((q) => q.eq(q.field('status'), 'published'))
            .collect();

        const results = [];
        for (const site of sites) {
            if (!site.publishedUrl) continue;
            const submission = await ctx.db.get(site.submissionId);
            if (!submission) continue;
            results.push({
                id: site._id,
                businessName: submission.businessName,
                businessType: submission.businessType,
                city: submission.city,
                address: submission.address,
                coordinates: submission.coordinates,
                publishedUrl: site.publishedUrl,
                publishedAt: site.publishedAt,
            });
        }
        return results;
    },
});

// Publish website (shorthand for updatePublishingInfo with status=published)
export const publish = mutation({
    args: {
        submissionId: v.id('submissions'),
        publishedUrl: v.string(),
        cfPagesProjectName: v.string(),
    },
    handler: async (ctx, args) => {
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (!website) {
            throw new Error('Generated website not found');
        }

        await ctx.db.patch(website._id, {
            status: 'published',
            publishedUrl: args.publishedUrl,
            cfPagesProjectName: args.cfPagesProjectName,
            publishedAt: Date.now(),
        });

        return website._id;
    },
});

// Unpublish website (remove publishing info, keep the website)
export const unpublish = mutation({
    args: {
        submissionId: v.id('submissions'),
    },
    handler: async (ctx, args) => {
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (!website) {
            throw new Error('Generated website not found');
        }

        await ctx.db.patch(website._id, {
            status: 'draft',
            publishedUrl: undefined,
            netlifySiteId: undefined,
            cfPagesProjectName: undefined,
            publishedAt: undefined,
        });

        return website._id;
    },
});

// Delete generated website
export const remove = mutation({
    args: { submissionId: v.id('submissions') },
    handler: async (ctx, args) => {
        const website = await ctx.db
            .query('generatedWebsites')
            .withIndex('by_submissionId', (q) => q.eq('submissionId', args.submissionId))
            .first();

        if (website) {
            await ctx.db.delete(website._id);
        }
    },
});
