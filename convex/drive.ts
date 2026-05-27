"use node";

/**
 * Google Drive folder sync.
 *
 * When an admin approves a submission, this module creates a per-submission
 * folder under the shared "Negosyo Digital" Drive folder, with subfolders for
 * photos / video / audio / transcript / generated-site, and uploads the assets
 * the creator submitted.
 *
 * Status lifecycle (stored on submissions.driveSyncStatus):
 *   pending  → not started
 *   creating → folder being assembled (uploads in flight)
 *   synced   → done, driveFolderUrl populated
 *   failed   → see driveSyncError; admin can retry from the Drive section UI
 *
 * Env vars (already set on prod by the mobile team):
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON   — full SA key JSON, stringified
 *   GOOGLE_DRIVE_PARENT_FOLDER_ID        — the "Negosyo Digital" parent folder ID
 *
 * Critical rule (per docs/changes/BUSINESS-SCRAPER.md):
 *   - Don't modify public signatures — mobile + web admin call these by name.
 *   - Never trigger on any state other than admin approval — don't sync
 *     draft/pending/rejected submissions.
 */
import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { google } from "googleapis";

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

function getDriveClient() {
    const json = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
    if (!json) {
        throw new Error(
            "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not set on this Convex deployment.",
        );
    }
    let credentials: any;
    try {
        credentials = JSON.parse(json);
    } catch (e) {
        throw new Error(
            "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not valid JSON.",
        );
    }
    const jwt = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ["https://www.googleapis.com/auth/drive"],
    });
    return google.drive({ version: "v3", auth: jwt });
}

async function createFolder(
    drive: ReturnType<typeof getDriveClient>,
    name: string,
    parentId: string,
): Promise<{ id: string; url: string }> {
    const res = await drive.files.create({
        requestBody: {
            name,
            mimeType: DRIVE_FOLDER_MIME,
            parents: [parentId],
        },
        // supportsAllDrives lets the SA write into Shared Drives without
        // tripping the "service accounts can't own files" restriction.
        supportsAllDrives: true,
        fields: "id, webViewLink",
    });
    const id = res.data.id;
    if (!id) throw new Error("Drive create returned no folder id");
    return {
        id,
        url: res.data.webViewLink || `https://drive.google.com/drive/folders/${id}`,
    };
}

async function uploadUrlAsFile(
    drive: ReturnType<typeof getDriveClient>,
    sourceUrl: string,
    fileName: string,
    folderId: string,
): Promise<void> {
    // Fetch the remote asset (R2 / Convex storage / Supabase) and stream the
    // bytes up to Drive. We do this from inside the Convex action sandbox so
    // the SA credentials never leave the server.
    let res: Response;
    try {
        res = await fetch(sourceUrl);
    } catch (e: any) {
        throw new Error(`Fetch ${sourceUrl}: ${e?.message ?? e}`);
    }
    if (!res.ok) throw new Error(`Fetch ${sourceUrl} → HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") || "application/octet-stream";

    // Node Readable from Buffer for the multipart upload.
    const { Readable } = await import("stream");
    const body = Readable.from(buf);

    await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [folderId],
        },
        media: { mimeType, body },
        supportsAllDrives: true,
        fields: "id",
    });
}

async function writeTextFile(
    drive: ReturnType<typeof getDriveClient>,
    fileName: string,
    text: string,
    folderId: string,
): Promise<void> {
    const { Readable } = await import("stream");
    const body = Readable.from(Buffer.from(text, "utf-8"));
    await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType: "text/plain", body },
        supportsAllDrives: true,
        fields: "id",
    });
}

// NOTE: getSubmissionForSync (internalQuery) and setDriveStatus (internalMutation)
// live in convex/driveHelpers.ts — Convex requires Node-runtime files (this one)
// to contain ONLY actions. The Drive action below calls them via
// internal.driveHelpers.* through ctx.runQuery / ctx.runMutation.

/**
 * Internal — the actual sync. Creates the folder structure + uploads files.
 * Called via ctx.scheduler.runAfter from approveSubmission, OR manually via
 * the admin "Re-sync" button (which wraps this in syncSubmissionToDriveManual).
 */
export const syncSubmissionToDrive = internalAction({
    args: { submissionId: v.id("submissions") },
    handler: async (ctx, args) => {
        const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
        if (!parentId) {
            await ctx.runMutation(internal.driveHelpers.setDriveStatus, {
                submissionId: args.submissionId,
                status: "failed",
                error: "GOOGLE_DRIVE_PARENT_FOLDER_ID env var is not set.",
            });
            return;
        }

        // Mark creating immediately so the admin UI shows a spinner.
        await ctx.runMutation(internal.driveHelpers.setDriveStatus, {
            submissionId: args.submissionId,
            status: "creating",
            error: undefined,
        });

        try {
            const bundle = await ctx.runQuery(
                internal.driveHelpers.getSubmissionForSync,
                { submissionId: args.submissionId },
            );
            if (!bundle?.submission) {
                throw new Error("Submission not found");
            }
            const { submission, website } = bundle;

            const drive = getDriveClient();

            // Top-level folder name: "<Business> · <YYYY-MM-DD>"
            const dateStr = new Date(submission._creationTime)
                .toISOString()
                .slice(0, 10);
            const rootName = `${submission.businessName} · ${dateStr}`;
            const root = await createFolder(drive, rootName, parentId);

            // Subfolders — fixed layout so admins can find things consistently.
            const photosFolder = await createFolder(drive, "01 · Photos", root.id);
            const videoFolder = await createFolder(drive, "02 · Video", root.id);
            const audioFolder = await createFolder(drive, "03 · Audio", root.id);
            const transcriptFolder = await createFolder(drive, "04 · Transcript", root.id);
            const siteFolder = await createFolder(drive, "05 · Website", root.id);

            // ── Uploads ─────────────────────────────────────────────────
            const failures: string[] = [];
            const safeUpload = async (
                url: string | undefined,
                name: string,
                folderId: string,
            ) => {
                if (!url) return;
                try {
                    await uploadUrlAsFile(drive, url, name, folderId);
                } catch (e: any) {
                    failures.push(`${name}: ${e?.message ?? e}`);
                }
            };

            const photos: string[] = (submission as any).photos ?? [];
            for (let i = 0; i < photos.length; i++) {
                const ext = photos[i].split(".").pop()?.split("?")[0] || "jpg";
                await safeUpload(
                    photos[i],
                    `photo-${String(i + 1).padStart(2, "0")}.${ext}`,
                    photosFolder.id,
                );
            }
            await safeUpload((submission as any).videoUrl, "interview.mp4", videoFolder.id);
            await safeUpload((submission as any).audioUrl, "interview.m4a", audioFolder.id);

            if (submission.transcript) {
                try {
                    await writeTextFile(
                        drive,
                        "transcript.txt",
                        submission.transcript,
                        transcriptFolder.id,
                    );
                } catch (e: any) {
                    failures.push(`transcript.txt: ${e?.message ?? e}`);
                }
            }

            if (website?.htmlContent) {
                try {
                    await writeTextFile(
                        drive,
                        "index.html",
                        website.htmlContent,
                        siteFolder.id,
                    );
                } catch (e: any) {
                    failures.push(`index.html: ${e?.message ?? e}`);
                }
            }
            if ((website as any)?.publishedUrl || submission.websiteUrl) {
                try {
                    await writeTextFile(
                        drive,
                        "published-url.txt",
                        (website as any)?.publishedUrl || submission.websiteUrl || "",
                        siteFolder.id,
                    );
                } catch (_) { /* non-critical */ }
            }

            // ── Done ───────────────────────────────────────────────────
            await ctx.runMutation(internal.driveHelpers.setDriveStatus, {
                submissionId: args.submissionId,
                status: "synced",
                folderId: root.id,
                folderUrl: root.url,
                folderCreatedAt: Date.now(),
                // Partial failures don't block the overall sync from being
                // marked synced — the folder + most files exist. Surface what
                // failed in driveSyncError so admin can review + re-upload.
                error: failures.length > 0 ? `Partial: ${failures.join("; ")}` : undefined,
            });
        } catch (err: any) {
            const message = err?.message || String(err);
            await ctx.runMutation(internal.driveHelpers.setDriveStatus, {
                submissionId: args.submissionId,
                status: "failed",
                error: message.slice(0, 1000),
            });
        }
    },
});

/**
 * Admin-only public wrapper for the internal sync action. Used by the
 * "Sync to Drive" / "Re-sync" / "Retry sync" buttons in the admin UI.
 */
export const syncSubmissionToDriveManual = action({
    args: { submissionId: v.id("submissions") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        await ctx.runAction(internal.drive.syncSubmissionToDrive, {
            submissionId: args.submissionId,
        });
        return { success: true };
    },
});
