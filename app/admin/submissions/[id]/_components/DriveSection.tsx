"use client";

/**
 * DriveSection — Google Drive folder sync status + actions for one submission.
 *
 * Per docs/changes/BUSINESS-SCRAPER.md Surface B. Reads
 * submission.driveSyncStatus + driveFolderUrl + driveSyncError to render the
 * right state (pending / creating / synced / failed) with appropriate CTAs.
 *
 * The Drive sync itself runs server-side in convex/drive.ts; this component
 * just calls api.drive.syncSubmissionToDriveManual when admin clicks Sync
 * / Re-sync / Retry.
 */
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, ExternalLink, RefreshCw, FolderOpen, AlertTriangle } from "lucide-react";

export interface DriveSectionProps {
    submissionId: Id<"submissions">;
    status?: "pending" | "creating" | "synced" | "failed";
    folderUrl?: string;
    folderCreatedAt?: number;
    error?: string;
}

function timeAgo(ts?: number): string {
    if (!ts) return "";
    const diffMs = Date.now() - ts;
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
}

export default function DriveSection({
    submissionId,
    status,
    folderUrl,
    folderCreatedAt,
    error,
}: DriveSectionProps) {
    // useAction lets us call the manual sync wrapper. Lazy-imported via `as any`
    // so the build doesn't fail before `npx convex codegen` regenerates types
    // with the new drive module.
    const syncManual = useAction((api as any).drive?.syncSubmissionToDriveManual);
    const [busy, setBusy] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    async function handleSync() {
        if (!syncManual) {
            setLocalError("Drive module not deployed yet — run npx convex deploy.");
            return;
        }
        setBusy(true);
        setLocalError(null);
        try {
            await syncManual({ submissionId });
        } catch (e: any) {
            setLocalError(e?.message ?? "Sync failed");
        } finally {
            setBusy(false);
        }
    }

    const showError = status === "failed" || !!localError;
    const errorMsg = localError || (status === "failed" ? error : undefined);
    const isCreating = status === "creating" || busy;
    const isSynced = status === "synced" && !!folderUrl;

    return (
        <div
            className="ed-card-lg"
            style={{
                background: "var(--ed-paper-3)",
                border: showError ? "1px solid var(--ed-danger)" : "1px solid var(--ed-rule)",
            }}
        >
            <div className="ed-eyebrow mb-2" style={{ color: showError ? "var(--ed-danger)" : "var(--ed-accent)" }}>
                Step 04 / Drive
            </div>
            <h3
                className="ed-display-sm"
                style={{ color: "var(--ed-ink)", margin: 0 }}
            >
                {!status || status === "pending" ? (
                    <>Not synced <em style={{ color: "var(--ed-ink-3)" }}>yet</em>.</>
                ) : isCreating ? (
                    <>Syncing to <em style={{ color: "var(--ed-accent)" }}>Drive</em>…</>
                ) : isSynced ? (
                    <>Folder <em style={{ color: "var(--ed-accent)" }}>synced</em>.</>
                ) : (
                    <>Sync <em style={{ color: "var(--ed-danger)" }}>failed</em>.</>
                )}
            </h3>

            <p className="ed-body-sm mt-3" style={{ color: "var(--ed-ink-2)", maxWidth: "56ch" }}>
                {!status || status === "pending"
                    ? "Hit Sync to copy this submission's transcript, photos, video, and audio into a structured folder under the shared Negosyo Digital Drive."
                    : isCreating
                        ? "Folder + subfolders are being assembled. This usually takes 20–60 seconds depending on photo/video count."
                        : isSynced
                            ? "All files (transcript, photos, video, audio, generated site) are copied to Google Drive."
                            : "The sync hit an error before finishing. Review the message below and click Retry."}
            </p>

            {showError && errorMsg && (
                <div
                    role="alert"
                    className="mt-4 px-3 py-2.5 flex items-start gap-2"
                    style={{
                        background: "var(--ed-danger-bg)",
                        border: "1px solid var(--ed-danger)",
                        borderRadius: "var(--ed-radius-sm)",
                        color: "var(--ed-danger)",
                    }}
                >
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p className="text-sm" style={{ fontFamily: "var(--ed-sans)" }}>{errorMsg}</p>
                </div>
            )}

            {isSynced && folderCreatedAt && (
                <div className="ed-label mt-4" style={{ color: "var(--ed-ink-3)" }}>
                    Synced {timeAgo(folderCreatedAt)}
                </div>
            )}

            <div className="flex flex-wrap gap-2 mt-5">
                {isSynced && folderUrl && (
                    <a
                        href={folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ed-door ed-door-accent inline-flex items-center gap-2"
                        style={{ minHeight: 40, padding: "8px 16px", fontSize: 13 }}
                    >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open in Drive
                        <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                )}

                <button
                    type="button"
                    onClick={handleSync}
                    disabled={isCreating}
                    className="ed-door ed-door-ghost inline-flex items-center gap-2"
                    style={{ minHeight: 40, padding: "8px 16px", fontSize: 13 }}
                >
                    {isCreating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {isCreating
                        ? "Syncing…"
                        : showError
                            ? "Retry sync"
                            : isSynced
                                ? "Re-sync"
                                : "Sync to Drive"}
                </button>
            </div>
        </div>
    );
}
