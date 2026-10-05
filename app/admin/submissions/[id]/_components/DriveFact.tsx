"use client";

/**
 * Google Drive folder sync for one submission: its state and the one action.
 *
 * Per docs/changes/BUSINESS-SCRAPER.md Surface B. Reads
 * submission.driveSyncStatus + driveFolderUrl + driveSyncError to show the
 * right state (pending / creating / synced / failed). The sync itself runs
 * server-side in convex/drive.ts; this only calls
 * api.drive.syncSubmissionToDriveManual when the admin asks for one.
 *
 * Board Review shows it as one fact in the details ("Google Drive: Not synced
 * yet · Sync to Drive"). The action is offered under the same rule as before:
 * once the submission is approved or has had a sync attempt, so a draft or
 * pending row does not grow a Drive button it should not use yet.
 */
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Status } from "@/components/r1";
import { formatDateTime } from "./review";

export function DriveFact({
    submissionId,
    status,
    folderUrl,
    folderCreatedAt,
    error,
    canSync,
}: {
    submissionId: Id<"submissions">;
    status?: "pending" | "creating" | "synced" | "failed";
    folderUrl?: string;
    folderCreatedAt?: number;
    error?: string;
    /** Approved, or already synced once (see the note above). */
    canSync: boolean;
}) {
    const syncManual = useAction(api.drive.syncSubmissionToDriveManual);
    const [busy, setBusy] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    async function handleSync() {
        setBusy(true);
        setLocalError(null);
        try {
            await syncManual({ submissionId });
        } catch (e: unknown) {
            setLocalError(e instanceof Error ? e.message : "Sync failed");
        } finally {
            setBusy(false);
        }
    }

    const showError = status === "failed" || !!localError;
    const errorMsg = localError || (status === "failed" ? error : undefined);
    const isCreating = status === "creating" || busy;
    const isSynced = status === "synced" && !!folderUrl;

    const linkBtn = "inline-flex h-8 items-center self-start border-0 bg-transparent p-0 text-[13px] font-medium text-r1-ink underline decoration-r1-ink-4 underline-offset-[3px] hover:decoration-r1-ink disabled:cursor-not-allowed disabled:opacity-45";

    return (
        <span className="flex min-w-0 flex-col gap-0.5">
            {isCreating ? (
                <>
                    <Status tone="progress" word="Syncing to Drive…" />
                    <span className="t-meta">The folder is being assembled; this usually takes 20–60 seconds.</span>
                </>
            ) : showError ? (
                <>
                    <Status tone="bad" word="Sync failed" />
                    {errorMsg && <span className="t-meta break-words" role="alert">{errorMsg}</span>}
                </>
            ) : isSynced ? (
                <>
                    <Status tone="done" word={folderCreatedAt ? `Synced ${formatDateTime(folderCreatedAt)}` : "Synced"} />
                    <span className="t-meta">Transcript, photos, video, audio and the site are copied.</span>
                    <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="t-link self-start text-[13px] font-medium">
                        Open in Drive
                    </a>
                </>
            ) : (
                <Status tone="off" word="Not synced yet" />
            )}
            {canSync && !isCreating && (
                <button type="button" className={linkBtn} onClick={handleSync}>
                    {showError ? "Retry sync" : isSynced ? "Sync again" : "Sync to Drive"}
                </button>
            )}
        </span>
    );
}
