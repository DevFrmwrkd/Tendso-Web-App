/**
 * Drive sync helpers — V8 runtime side of the Drive integration.
 *
 * Why split from drive.ts: drive.ts uses `"use node"` because it imports
 * `googleapis` + Node Buffer/stream. Convex requires Node-runtime files
 * to contain ONLY actions, not queries or mutations. The query +
 * mutation pieces of the Drive workflow live here in the V8 runtime
 * and are called by drive.ts via `ctx.runQuery` / `ctx.runMutation`.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Internal — fetch the submission + linked website docs the sync needs.
 *
 * Returns both `generatedWebsites` and `websiteContent` rows: enhanced/
 * optimized images can live on either depending on which pipeline produced
 * them, so the Drive sync collects from both and dedupes.
 */
export const getSubmissionForSync = internalQuery({
    args: { submissionId: v.id("submissions") },
    handler: async (ctx, args) => {
        const submission = await ctx.db.get(args.submissionId);
        if (!submission) return null;
        // The websiteContent / generatedWebsites schema indexes vary across
        // historical migrations; resolve loosely so we don't 500 if the
        // index name has changed.
        const website =
            (await ctx.db
                .query("generatedWebsites")
                .filter((q) => q.eq(q.field("submissionId"), args.submissionId))
                .first()
                .catch(() => null)) ?? null;
        const websiteContent =
            (await ctx.db
                .query("websiteContent")
                .filter((q) => q.eq(q.field("submissionId"), args.submissionId))
                .first()
                .catch(() => null)) ?? null;
        return { submission, website, websiteContent };
    },
});

/**
 * Internal — patch the submission's driveSync* fields.
 */
export const setDriveStatus = internalMutation({
    args: {
        submissionId: v.id("submissions"),
        status: v.union(
            v.literal("pending"),
            v.literal("creating"),
            v.literal("synced"),
            v.literal("failed"),
        ),
        folderId: v.optional(v.string()),
        folderUrl: v.optional(v.string()),
        folderCreatedAt: v.optional(v.number()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const patch: Record<string, unknown> = { driveSyncStatus: args.status };
        if (args.folderId !== undefined) patch.driveFolderId = args.folderId;
        if (args.folderUrl !== undefined) patch.driveFolderUrl = args.folderUrl;
        if (args.folderCreatedAt !== undefined) patch.driveFolderCreatedAt = args.folderCreatedAt;
        if (args.error !== undefined) patch.driveSyncError = args.error;
        else if (args.status === "synced") patch.driveSyncError = undefined;
        await ctx.db.patch(args.submissionId, patch);
    },
});
