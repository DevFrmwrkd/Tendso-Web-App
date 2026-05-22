"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, X, AlertCircle } from "lucide-react";

const MAX_REASON_LENGTH = 500;

export interface RejectCreatorDialogProps {
    creator: {
        _id: Id<"creators">;
        firstName: string | null;
        lastName: string | null;
    } | null;
    open: boolean;
    onClose: () => void;
    onSuccess?: (creator: { _id: Id<"creators">; displayName: string }) => void;
}

function displayName(c: { firstName: string | null; lastName: string | null }): string {
    const parts = [c.firstName, c.lastName].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(" ") : "this creator";
}

export default function RejectCreatorDialog({ creator, open, onClose, onSuccess }: RejectCreatorDialogProps) {
    const rejectCreator = useMutation(api.creators.rejectCreator);
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (open) {
            setReason("");
            setError(null);
            setSubmitting(false);
            // Move focus into the dialog so Tab order starts inside
            queueMicrotask(() => textareaRef.current?.focus());
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !submitting) onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, submitting, onClose]);

    if (!open || !creator) return null;

    async function handleReject() {
        if (!creator) return;
        setError(null);
        setSubmitting(true);
        try {
            const trimmed = reason.trim();
            await rejectCreator({
                id: creator._id,
                reason: trimmed.length > 0 ? trimmed : undefined,
            });
            onSuccess?.({ _id: creator._id, displayName: displayName(creator) });
            onClose();
        } catch (e: any) {
            setError(e?.message ?? "Failed to reject creator");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-dialog-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(27, 28, 36, 0.55)" }}
            onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) onClose();
            }}
        >
            <div
                className="ed-card-lg w-full max-w-lg relative"
                style={{
                    background: "var(--ed-paper-3)",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
                }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    aria-label="Close dialog"
                    className="absolute top-4 right-4 p-1.5 rounded-full transition-colors hover:bg-[var(--ed-paper-2)] disabled:opacity-50"
                    style={{ color: "var(--ed-ink-3)" }}
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="ed-eyebrow mb-2" style={{ color: "var(--ed-danger)" }}>
                    Step 02 / Not Approved
                </div>
                <h2
                    id="reject-dialog-title"
                    className="ed-display-sm"
                    style={{ color: "var(--ed-ink)" }}
                >
                    Reject{" "}
                    <em style={{ fontStyle: "italic", color: "var(--ed-danger)" }}>
                        {displayName(creator)}
                    </em>
                    ?
                </h2>
                <p className="ed-body-sm mt-3" style={{ color: "var(--ed-ink-2)", maxWidth: "56ch" }}>
                    This locks the creator&apos;s account. They&apos;ll see a rejection screen on
                    the mobile app and can either retake the quiz or contact support.
                </p>

                <div className="mt-5">
                    <label
                        htmlFor="reject-reason"
                        className="ed-label block mb-2"
                    >
                        Reason (optional)
                    </label>
                    <textarea
                        ref={textareaRef}
                        id="reject-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
                        maxLength={MAX_REASON_LENGTH}
                        rows={4}
                        placeholder="What should the creator know about this decision?"
                        disabled={submitting}
                        className="w-full px-3 py-2.5 text-sm focus:outline-none transition-colors resize-y"
                        style={{
                            background: "var(--ed-paper)",
                            border: "1px solid var(--ed-rule)",
                            borderRadius: "var(--ed-radius-sm)",
                            fontFamily: "var(--ed-sans)",
                            color: "var(--ed-ink)",
                            minHeight: 96,
                        }}
                    />
                    <div className="flex items-center justify-between mt-1.5">
                        <span className="ed-label" style={{ color: "var(--ed-ink-3)" }}>
                            Shown to the creator on their rejection screen
                        </span>
                        <span
                            className="ed-label"
                            style={{
                                color: reason.length >= MAX_REASON_LENGTH
                                    ? "var(--ed-danger)"
                                    : "var(--ed-ink-3)",
                            }}
                        >
                            {reason.length} / {MAX_REASON_LENGTH}
                        </span>
                    </div>
                </div>

                {error && (
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
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="text-sm" style={{ fontFamily: "var(--ed-sans)" }}>{error}</p>
                    </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="ed-door ed-door-ghost"
                        style={{ minHeight: 44, padding: "10px 18px", fontSize: 14 }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleReject}
                        disabled={submitting}
                        className="ed-door ed-door-danger inline-flex items-center"
                        style={{ minHeight: 44, padding: "10px 18px", fontSize: 14 }}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span style={{ marginLeft: 8 }}>Rejecting…</span>
                            </>
                        ) : (
                            <span>Reject creator</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
