import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import { Id } from './_generated/dataModel';

/**
 * Generate an upload URL for Convex file storage (legacy).
 * New uploads should go through R2 via `r2.generateUploadUrl`.
 */
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});

/**
 * Get a file URL.
 *
 * Accepts any of: a full URL, an R2 relative path (images/..., videos/...,
 * audio/...), a `convex:` prefixed ID, or a raw Convex storage ID. Mobile-
 * referenced — do NOT tighten the validator back to v.id('_storage'): the
 * APK calls this with R2 object keys which would be rejected before the
 * handler runs, producing a misleading "Server Error" on the client.
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
 * Get multiple file URLs. Same permissive resolution as getUrl.
 * Mobile-referenced — accepts strings (R2 paths or Convex IDs).
 */
export const getUrls = query({
    args: { storageIds: v.array(v.string()) },
    handler: async (ctx, args) => {
        const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
        return Promise.all(
            args.storageIds.map(async (idString) => {
                try {
                    if (idString.startsWith('http://') || idString.startsWith('https://')) {
                        return { id: idString, url: idString };
                    }
                    if (/^(images|videos|audio)\//.test(idString) && r2PublicUrl) {
                        return { id: idString, url: `${r2PublicUrl}/${idString}` };
                    }
                    const storageId = idString.startsWith('convex:')
                        ? idString.replace('convex:', '')
                        : idString;
                    const url = await ctx.storage.getUrl(storageId as Id<"_storage">);
                    return { id: idString, url };
                } catch {
                    return { id: idString, url: null };
                }
            })
        );
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
            console.warn(`[storage.deleteFile] Called with R2 path "${s}" — skipping Convex storage delete. Use r2.deleteFile for R2 files.`);
            return;
        }
        const id = s.startsWith('convex:') ? s.replace('convex:', '') : s;
        await ctx.storage.delete(id as Id<"_storage">);
    },
});
