"use client";

import { useMutation } from "convex/react";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, ConfirmDialog, Dialog, Icon } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

import { ROLE_DESC, ROLE_LABEL, firstNameOf, fullName, messageOf, shortDate, type Role } from "../_lib/creators";

/*
 * The decisions a creator drawer can open (board Creators, "Dialogs"), each
 * the kit's Dialog or, for a destructive one, its ConfirmDialog. Every
 * mutation and argument is the one the old pages called:
 *
 *   approve   creators.approveCreator({ id })
 *   role      creators.updateRole({ id, role })
 *   status    creators.updateStatus({ id, status: "suspended" | "active" })
 *   delete    POST /api/delete-creator { creatorId }  (the cascade: R2 media,
 *             Cloudflare Pages, Airtable, the Clerk user, every Convex row,
 *             and the audit-log entry admin.deleteCreatorRecords writes)
 *   reject    creators.rejectCreator, in app/admin/components/RejectCreatorDialog
 *
 * A failure stays in the dialog as one red line, so the admin can try again;
 * the dialog cannot be closed while its request is running.
 *
 * Each dialog takes a snapshot of who it is about (`ActionTarget`), made when
 * it opened, so its title does not change under the admin while the drawer's
 * live data moves (approving someone turns them into a certified creator the
 * moment the mutation lands).
 */

export type ActionTarget = {
    id: Id<"creators">;
    name: string;
    first: string;
    firstName: string | null;
    lastName: string | null;
    quizPassedAt: number | null;
};

export function targetOf(c: Doc<"creators">): ActionTarget {
    return {
        id: c._id,
        name: fullName(c),
        first: firstNameOf(c),
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        quizPassedAt: c.quizPassedAt ?? null,
    };
}

export type CreatorAction =
    | { kind: "approve"; target: ActionTarget }
    | { kind: "reject"; target: ActionTarget }
    | { kind: "role"; target: ActionTarget; role: Role }
    | { kind: "status"; target: ActionTarget; suspend: boolean }
    | { kind: "delete"; target: ActionTarget; submissions: number };

const noop = () => {};

/**
 * busy/error for one dialog, reset each time it opens. Reset during render,
 * on the open → closed → open change, rather than in an effect (React's
 * "adjusting state when a prop changes").
 */
function useRequest(open: boolean) {
    const [wasOpen, setWasOpen] = useState(open);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setBusy(false);
            setError(null);
        }
    }
    return { busy, setBusy, error, setError };
}

function ErrorLine({ error }: { error: string | null }) {
    if (!error) return null;
    return (
        <p className="t-error" role="alert">
            {error}
        </p>
    );
}

/** The kit's "Let Angel S. in?" dialog. */
export function ApproveDialog({
    target,
    now,
    onClose,
    onApproved,
}: {
    target: ActionTarget | null;
    now: number;
    onClose: () => void;
    onApproved: (target: ActionTarget) => void;
}) {
    const approveCreator = useMutation(api.creators.approveCreator);
    const open = target !== null;
    const { busy, setBusy, error, setError } = useRequest(open);

    async function approve() {
        if (!target) return;
        setBusy(true);
        setError(null);
        try {
            await approveCreator({ id: target.id });
            onApproved(target);
        } catch (e) {
            setError(messageOf(e, "Approval failed. Nothing was changed; try again."));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open={open}
            onClose={busy ? noop : onClose}
            title={target ? `Let ${target.name} in?` : ""}
            footer={
                <>
                    <Button onClick={onClose} disabled={busy}>
                        Not yet
                    </Button>
                    <Button variant="primary" onClick={approve} disabled={busy} aria-busy={busy}>
                        <Icon icon={Check} />
                        {busy ? "Approving…" : `Approve ${target?.name ?? ""}`}
                    </Button>
                </>
            }
        >
            {target && (
                <p>
                    {target.first} passed the quiz{target.quizPassedAt ? ` on ${shortDate(target.quizPassedAt, now)}` : ""}. Once approved, they can submit
                    businesses and earn.
                </p>
            )}
            <ErrorLine error={error} />
        </Dialog>
    );
}

/** Role change confirm (board "Role change confirm"). */
export function RoleDialog({
    target,
    role,
    onClose,
    onChanged,
}: {
    target: ActionTarget | null;
    role: Role;
    onClose: () => void;
    onChanged: (target: ActionTarget, role: Role) => void;
}) {
    const updateRole = useMutation(api.creators.updateRole);
    const open = target !== null;
    const { busy, setBusy, error, setError } = useRequest(open);

    async function change() {
        if (!target) return;
        setBusy(true);
        setError(null);
        try {
            await updateRole({ id: target.id, role });
            onChanged(target, role);
        } catch (e) {
            setError(messageOf(e, "Failed to update role"));
        } finally {
            setBusy(false);
        }
    }

    const title = !target ? "" : role === "admin" ? `Make ${target.name} an Admin?` : role === "staff" ? `Make ${target.name} Staff?` : `Make ${target.name} a Creator?`;

    return (
        <Dialog
            open={open}
            onClose={busy ? noop : onClose}
            title={title}
            footer={
                <>
                    <Button onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={change} disabled={busy} aria-busy={busy}>
                        {busy ? "Saving…" : `Change to ${ROLE_LABEL[role]}`}
                    </Button>
                </>
            }
        >
            <p>
                {ROLE_LABEL[role]}: {ROLE_DESC[role]}
            </p>
            {/* The board adds "The change is written to the audit log": creators.updateRole writes none, so that line is left out. */}
            <p className="t-meta">Takes effect the next time they load a page.</p>
            <ErrorLine error={error} />
        </Dialog>
    );
}

/** Suspend / reactivate confirm. */
export function StatusDialog({
    target,
    suspend,
    onClose,
    onChanged,
}: {
    target: ActionTarget | null;
    suspend: boolean;
    onClose: () => void;
    onChanged: (target: ActionTarget, suspend: boolean) => void;
}) {
    const updateStatus = useMutation(api.creators.updateStatus);
    const open = target !== null;
    const { busy, setBusy, error, setError } = useRequest(open);

    async function confirm() {
        if (!target) return;
        setBusy(true);
        setError(null);
        try {
            await updateStatus({ id: target.id, status: suspend ? "suspended" : "active" });
            onChanged(target, suspend);
        } catch (e) {
            setError(messageOf(e, "Failed to update status"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <ConfirmDialog
            open={open}
            onCancel={onClose}
            onConfirm={confirm}
            busy={busy}
            destructive={suspend}
            title={!target ? "" : suspend ? `Suspend ${target.name}?` : `Reactivate ${target.name}?`}
            cancelLabel="Cancel"
            confirmLabel={busy ? (suspend ? "Suspending…" : "Reactivating…") : suspend ? "Suspend" : "Reactivate"}
        >
            <p>
                {suspend
                    ? "They will not be able to sign in or submit until you reactivate them. Nothing is deleted."
                    : "They will regain full access the next time they load a page."}
            </p>
            <ErrorLine error={error} />
        </ConfirmDialog>
    );
}

/** Delete creator: the kit's one confirm-destructive dialog, naming everything that goes with them. */
export function DeleteDialog({
    target,
    submissions,
    onClose,
    onDeleted,
}: {
    target: ActionTarget | null;
    submissions: number;
    onClose: () => void;
    onDeleted: (target: ActionTarget) => void;
}) {
    const open = target !== null;
    const { busy, setBusy, error, setError } = useRequest(open);

    async function remove() {
        if (!target) return;
        setBusy(true);
        setError(null);
        try {
            // The cascade lives in the API route (it needs R2, Cloudflare,
            // Airtable and Clerk credentials); it re-checks that the caller is
            // an admin and refuses admin accounts and self-deletion.
            const response = await fetch("/api/delete-creator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creatorId: target.id }),
            });
            if (!response.ok) {
                const data = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(data?.error || "Failed to delete creator");
            }
            onDeleted(target);
        } catch (e) {
            setError(messageOf(e, "Failed to delete creator"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <ConfirmDialog
            open={open}
            onCancel={onClose}
            onConfirm={remove}
            busy={busy}
            title={target ? `Delete ${target.name}?` : ""}
            cancelLabel="Cancel"
            confirmIcon={<Icon icon={Trash2} />}
            confirmLabel={busy ? "Deleting…" : "Delete permanently"}
        >
            <p>This is permanent and cannot be undone. It removes:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>Their account and sign-in</li>
                <li>
                    All {submissions} submission{submissions === 1 ? "" : "s"} and generated websites
                </li>
                <li>All media files (images, audio, video)</li>
                <li>Cloudflare deployments and Airtable records</li>
                <li>Earnings, withdrawals and referral records</li>
            </ul>
            <p className="t-meta">To stop them without losing anything, suspend them instead.</p>
            <ErrorLine error={error} />
        </ConfirmDialog>
    );
}
