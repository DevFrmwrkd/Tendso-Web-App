"use client";

/**
 * "Ask for a change" requests the owner sent from the owner app
 * (convex/ownerApp.requestChange). Renders nothing when there are none, so
 * every other submission looks exactly as before.
 */
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Card, Status } from "@/components/r1";
import { formatDateTime } from "./review";

export function ChangeRequests({ submissionId }: { submissionId: Id<"submissions"> }) {
    const rows = useQuery(api.changeRequests.listForSubmission, { submissionId });
    const setStatus = useMutation(api.changeRequests.setStatus);
    if (!rows || rows.length === 0) return null;
    const open = rows.filter((r) => r.status === "open").length;

    async function mark(id: Id<"changeRequests">, status: "done" | "dismissed" | "open") {
        try {
            await setStatus({ id, status });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not update the change request");
        }
    }

    return (
        <Card pad className="mb-4 flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h2 className="t-h2">Change requests</h2>
                <p className="t-help">{open > 0 ? `${open} open. The owner asked for these on the preview.` : "All handled."}</p>
            </div>
            {rows.map((r) => (
                <div key={r._id} className="flex min-w-0 flex-col gap-2 border-t border-r1-line pt-3">
                    <p className="t-body whitespace-pre-wrap break-words">{r.text}</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <Status tone={r.status === "open" ? "attn" : "done"} word={r.status === "open" ? "Open" : r.status === "done" ? "Done" : "Dismissed"} />
                        <span className="t-meta">{formatDateTime(r.createdAt)}</span>
                        {r.status === "open" ? (
                            <>
                                <Button size="sm" onClick={() => mark(r._id, "done")}>Mark done</Button>
                                <Button size="sm" variant="ghost" onClick={() => mark(r._id, "dismissed")}>Dismiss</Button>
                            </>
                        ) : (
                            <Button size="sm" variant="ghost" onClick={() => mark(r._id, "open")}>Reopen</Button>
                        )}
                    </div>
                </div>
            ))}
        </Card>
    );
}
