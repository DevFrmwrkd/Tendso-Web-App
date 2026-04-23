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
 * Get a URL for a stored file.
 *
 * Accepts any of: a full URL, an R2 relative path (images/..., videos/...,
 * audio/...), a `convex:` prefixed ID, or a raw Convex storage ID. Mobile APK
 * calls this with R2 object keys, which are not Convex storage IDs — a strict
 * v.id('_storage') validator would reject those before the handler runs.
 * Mobile-referenced — do not tighten the validator back.
 */
export const getUrl = query({
    args: { storageId: v.string() },
    handler: async (ctx, args) => {
        const idString = args.storageId;
        const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
        try {
            if (idString.startsWith('http://') || idString.startsWith('https://')) {
                return idString;
            }
            if (/^(images|videos|audio)\//.test(idString) && r2PublicUrl) {
                return `${r2PublicUrl}/${idString}`;
            }
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
 * Delete a file from Convex storage.
 *
 * Accepts a string for cross-caller compatibility. If the string looks like
 * an R2 relative path or a full URL, Convex storage deletion is skipped
 * (R2 files must be deleted through `r2.deleteFile`). Mobile-referenced —
 * do not tighten the validator.
 */
export const deleteFile = mutation({
    args: { storageId: v.string() },
    handler: async (ctx, args) => {
        const s = args.storageId;
        const looksLikeR2 = s.startsWith('http://') || s.startsWith('https://') || /^(images|videos|audio)\//.test(s);
        if (looksLikeR2) {
            console.warn(`[files.deleteFile] Called with R2 path "${s}" — skipping Convex storage delete. Use r2.deleteFile for R2 files.`);
            return;
        }
        const id = s.startsWith('convex:') ? s.replace('convex:', '') : s;
        await ctx.storage.delete(id as Id<"_storage">);
    },
});
