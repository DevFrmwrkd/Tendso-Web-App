"use client";

import { useMutation } from "convex/react";
import { useId, useState } from "react";

import { Button, Dialog, Textarea, cx } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const MAX_REASON_LENGTH = 500;

/**
 * The reasons admins give most, one tap each (board Creators, "Reject
 * creator"). Picking one fills the reason; it can still be edited.
 */
const PRESET_REASONS = [
    "We could not reach you on the phone number you gave",
    "This looks like a second account",
    "We are not taking creators in your area yet",
];

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

/**
 * Reject a creator who passed the quiz (Round 1, the kit's Dialog). The
 * reason is shown to them on their rejection screen and in their
 * notification, so the board makes it required: pick a common one or write
 * your own, 500 characters at most (creators.rejectCreator refuses longer).
 *
 * Same contract as before: `creators.rejectCreator({ id, reason })`, then
 * onSuccess with the name, then onClose. It cannot be closed while the
 * rejection is being saved, and a failure stays in the dialog.
 */
export default function RejectCreatorDialog({ creator, open, onClose, onSuccess }: RejectCreatorDialogProps) {
    const rejectCreator = useMutation(api.creators.rejectCreator);
    const [reason, setReason] = useState("");
    const [tried, setTried] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ids = useId();
    const labelId = `${ids}-label`;
    const fieldId = `${ids}-reason`;
    const helpId = `${ids}-help`;

    // Start clean every time it opens. Done during render on the
    // closed → open change, React's "adjusting state when a prop changes",
    // rather than in an effect.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setReason("");
            setTried(false);
            setSubmitting(false);
            setError(null);
        }
    }

    const name = creator ? displayName(creator) : "this creator";
    const first = creator?.firstName?.trim() || "They";
    const missing = tried && reason.trim().length === 0;

    async function handleReject() {
        if (!creator) return;
        const trimmed = reason.trim();
        if (trimmed.length === 0) {
            setTried(true);
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            await rejectCreator({
                id: creator._id,
                reason: trimmed.length > 0 ? trimmed : undefined,
            });
            onSuccess?.({ _id: creator._id, displayName: displayName(creator) });
            onClose();
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "Failed to reject creator");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog
            open={open && creator !== null}
            onClose={submitting ? () => {} : onClose}
            title={`Reject ${name}?`}
            footer={
                <>
                    <Button onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleReject} disabled={submitting} aria-busy={submitting}>
                        {submitting ? "Rejecting…" : "Reject creator"}
                    </Button>
                </>
            }
        >
            <p>This locks their account. They see your reason on the rejection screen and can retake the quiz or contact support.</p>

            <div className="t-field">
                <span className="t-field-label" id={labelId}>
                    Reason
                    <span className="t-req" aria-hidden="true">
                        *
                    </span>
                </span>
                <div role="group" aria-labelledby={labelId} className="t-chips">
                    {PRESET_REASONS.map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            className="t-chip h-auto min-h-8 whitespace-normal py-1.5 text-left"
                            aria-pressed={reason === preset}
                            disabled={submitting}
                            onClick={() => setReason(preset)}
                        >
                            {preset}
                        </button>
                    ))}
                </div>
                <label htmlFor={fieldId} className="sr-only">
                    Reason, in your own words (required)
                </label>
                <Textarea
                    id={fieldId}
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
                    maxLength={MAX_REASON_LENGTH}
                    rows={4}
                    placeholder="Or write what the creator should know about this decision"
                    disabled={submitting}
                    required
                    aria-describedby={helpId}
                    aria-invalid={missing || undefined}
                />
                <div className="flex justify-between gap-3">
                    {/* An error replaces the help line. */}
                    {missing ? (
                        <p className="t-error" id={helpId} role="alert">
                            Pick a reason or write one. {first} will see it.
                        </p>
                    ) : (
                        <span className="t-help" id={helpId}>
                            Shown to the creator on their rejection screen
                        </span>
                    )}
                    <span className={cx("t-help t-num flex-none", reason.length >= MAX_REASON_LENGTH && "text-r1-red")}>
                        {reason.length} / {MAX_REASON_LENGTH}
                    </span>
                </div>
            </div>

            {error && (
                <p className="t-error" role="alert">
                    {error}
                </p>
            )}
        </Dialog>
    );
}
