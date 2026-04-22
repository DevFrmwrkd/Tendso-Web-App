import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';

/**
 * Generate an upload URL for file storage
 */
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});

/**
 * Get a URL for a stored file
 */
export const getUrl = query({
    args: { storageId: v.id('_storage') },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});

/**
 * Get a URL for a stored file by string ID
 */
export const getUrlByString = query({
    args: { storageId: v.string() },
    handler: async (ctx, args) => {
        const idString = args.storageId;
        const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

        try {
            // Already a full URL — pass through
            if (idString.startsWith('http://') || idString.startsWith('https://')) {
                return idString;
            }

            // R2 relative paths (images/..., videos/..., audio/...) — prepend R2 public URL
            if (/^(images|videos|audio)\//.test(idString) && r2PublicUrl) {
                return `${r2PublicUrl}/${idString}`;
            }

            // Handle "convex:storageId" prefix
            const storageId = idString.startsWith('convex:')
                ? idString.replace('convex:', '')
                : idString;

            return await ctx.storage.getUrl(storageId as Id<"_storage">);
        } catch {
            return null;
        }
    },
});

/**
 * Get URLs for multiple storage IDs (accepts strings like "convex:xyz")
 */
export const getMultipleUrls = query({
    args: { storageIds: v.array(v.string()) },
    handler: async (ctx, args) => {
        const urls: (string | null)[] = [];
        const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

        for (const idString of args.storageIds) {
            try {
                // Already a full URL - pass through
                if (idString.startsWith('http://') || idString.startsWith('https://')) {
                    urls.push(idString);
                    continue;
                }

                // R2 relative paths (images/..., videos/..., audio/...) - prepend R2 public URL
                if (/^(images|videos|audio)\//.test(idString) && r2PublicUrl) {
                    urls.push(`${r2PublicUrl}/${idString}`);
                    continue;
                }

                // Handle "convex:storageId" format
                const storageId = idString.startsWith('convex:')
                    ? idString.replace('convex:', '')
                    : idString;

                // Try Convex storage resolution
                const url = await ctx.storage.getUrl(storageId as Id<"_storage">);
                urls.push(url);
            } catch {
                // If it fails, return null (not a valid URL or storage ID)
                urls.push(null);
            }
        }

        return urls;
    },
});

/**
 * Delete a file from storage
 */
export const deleteFile = mutation({
    args: { storageId: v.id('_storage') },
    handler: async (ctx, args) => {
        await ctx.storage.delete(args.storageId);
    },
});
