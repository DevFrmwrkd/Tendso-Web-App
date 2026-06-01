"use node";

/**
 * Google Drive folder sync.
 *
 * When an admin approves a submission, this module creates a per-submission
 * folder under the "Negosyo Digital" parent Drive folder, with subfolders for
 * photos / video / audio / transcript / generated-site, and uploads the assets
 * the creator submitted.
 *
 * Status lifecycle (stored on submissions.driveSyncStatus):
 *   pending  → not started
 *   creating → folder being assembled (uploads in flight)
 *   synced   → done, driveFolderUrl populated
 *   failed   → see driveSyncError; admin can retry from the Drive section UI
 *
 * Auth mode: OAuth user delegation (Path B per docs/changes/WEB-DRIVE-SYNC.md).
 * The sync runs as `frmwrkd.media@gmail.com` via a long-lived refresh token —
 * files land in that user's 15 GB My Drive instead of bouncing off the
 * service-account "no storage quota" policy.
 *
 * Env vars (set on prod):
 *   GOOGLE_DRIVE_OAUTH_CLIENT_ID       — OAuth 2.0 client ID from GCP
 *   GOOGLE_DRIVE_OAUTH_CLIENT_SECRET   — OAuth 2.0 client secret from GCP
 *   GOOGLE_DRIVE_USER_REFRESH_TOKEN    — refresh token for frmwrkd.media@gmail.com
 *   GOOGLE_DRIVE_PARENT_FOLDER_ID      — the "Negosyo Digital" parent folder ID
 *
 * The old GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON env is no longer read. Leave it set
 * for rollback safety; the code path that used it has been deleted.
 *
 * Critical rule (per docs/changes/BUSINESS-SCRAPER.md):
 *   - Don't modify public signatures — mobile + web admin call these by name.
 *   - Never trigger on any state other than admin approval — don't sync
 *     draft/pending/rejected submissions.
 */
import { v } from "convex/values";
import { internalAction, action, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { google } from "googleapis";

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

// In-process token cache. Lives for the lifetime of the Convex action sandbox
// — usually fine for a single sync run; refreshes lazily after expiry.
let _cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Exchange the long-lived refresh token for a short-lived access token.
 *
 * Path B per docs/changes/WEB-DRIVE-SYNC.md: the project owner did a one-time
 * OAuth consent as frmwrkd.media@gmail.com, captured a refresh token, and
 * stored it as GOOGLE_DRIVE_USER_REFRESH_TOKEN. We mint a fresh access token
 * here on demand (~1h validity) and cache it across calls within the same
 * action invocation.
 */
async function getAccessToken(): Promise<string> {
    if (_cachedToken && _cachedToken.expiresAt > Date.now() + 60_000) {
        return _cachedToken.token;
    }

    const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_USER_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            "Drive OAuth env vars not configured. Need GOOGLE_DRIVE_OAUTH_CLIENT_ID, " +
                "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, and GOOGLE_DRIVE_USER_REFRESH_TOKEN. " +
                "See docs/changes/WEB-DRIVE-SYNC.md Step B for the one-time setup.",
        );
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
            `Drive OAuth refresh failed: ${res.status} ${body.slice(0, 300)}. ` +
                "The refresh token may have expired (6+ months dormant) or been revoked. " +
                "Re-run docs/changes/WEB-DRIVE-SYNC.md Step B.2.",
        );
    }

    const data = (await res.json()) as {
        access_token: string;
        expires_in: number;
        token_type: string;
    };

    _cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
}

async function getDriveClient() {
    const accessToken = await getAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.drive({ version: "v3", auth: oauth2Client });
}

type DriveClient = Awaited<ReturnType<typeof getDriveClient>>;

/**
 * Resolve a stored asset reference (photo / video / audio) to a fetchable URL.
 *
 * Web-side submissions store full R2 public URLs (`https://...`) so the
 * passthrough branch handles them. Mobile-APK submissions, per
 * docs/changes/WEB-DRIVE-SYNC.md, write raw Convex storage IDs like
 * `images/1780282669962-av801pum.jpg`. Passing those straight into `fetch()`
 * throws `Failed to parse URL`, which is what caused the prod sync failure
 * we are fixing here.
 *
 * Branches:
 *   1. `http://` / `https://` prefix → already fetchable; return unchanged.
 *   2. Otherwise → treat as a Convex storage ID and resolve via
 *      `ctx.storage.getUrl()` to get a signed Convex URL.
 *
 * Throws a clear error if a non-URL string fails to resolve so future
 * debugging takes seconds, not hours.
 */
async function resolveFetchableUrl(
    ctx: ActionCtx,
    urlOrStorageId: string,
): Promise<string> {
    if (/^https?:\/\//i.test(urlOrStorageId)) {
        return urlOrStorageId;
    }
    const resolved = await ctx.storage.getUrl(
        urlOrStorageId as Id<"_storage">,
    );
    if (!resolved) {
        throw new Error(
            `Could not resolve storage reference "${urlOrStorageId}" to a URL. ` +
                "Either the storage ID is invalid, or this is meant to be a full URL that's missing its scheme.",
        );
    }
    return resolved;
}

async function createFolder(
    drive: DriveClient,
    name: string,
    parentId: string,
): Promise<{ id: string; url: string }> {
    const res = await drive.files.create({
        requestBody: {
            name,
            mimeType: DRIVE_FOLDER_MIME,
            parents: [parentId],
        },
        // supportsAllDrives lets us write into Shared Drives when (if) we ever
        // migrate off Path B. Harmless on a personal My Drive.
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
    drive: DriveClient,
    sourceUrl: string,
    fileName: string,
    folderId: string,
): Promise<void> {
    let res: Response;
    try {
        res = await fetch(sourceUrl);
    } catch (e: any) {
        throw new Error(`Fetch ${sourceUrl}: ${e?.message ?? e}`);
    }
    if (!res.ok) throw new Error(`Fetch ${sourceUrl} → HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") || "application/octet-stream";

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
    drive: DriveClient,
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

            const drive = await getDriveClient();

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
                ref: string | undefined,
                name: string,
                folderId: string,
            ) => {
                if (!ref) return;
                try {
                    const fetchUrl = await resolveFetchableUrl(ctx, ref);
                    await uploadUrlAsFile(drive, fetchUrl, name, folderId);
                } catch (e: any) {
                    failures.push(`${name}: ${e?.message ?? e}`);
                }
            };

            const photos: string[] = (submission as any).photos ?? [];
            for (let i = 0; i < photos.length; i++) {
                const ref = photos[i];
                // Only derive an extension hint from URL-shaped refs; for raw
                // storage IDs we fall back to "jpg" (the resolver will set the
                // real content-type on the upload from the fetched headers).
                const ext = /^https?:\/\//i.test(ref)
                    ? ref.split(".").pop()?.split("?")[0] || "jpg"
                    : "jpg";
                await safeUpload(
                    ref,
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
