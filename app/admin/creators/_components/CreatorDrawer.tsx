"use client";

import { useQuery } from "convex/react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button, EmptyState, Loading, Skeleton, SkeletonText, useDelayed } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import RejectCreatorDialog from "../../components/RejectCreatorDialog";
import { ROLE_LABEL, drawerKindOf } from "../_lib/creators";
import { ApproveDialog, DeleteDialog, RoleDialog, StatusDialog, targetOf, type ActionTarget, type CreatorAction } from "./ActionDialogs";
import { DrawerBoundary, DrawerFrame, SimpleHead } from "./DrawerFrame";
import { PersonBody } from "./PersonBody";
import { RejectedBody } from "./RejectedBody";
import { WaitingBody } from "./WaitingBody";

/**
 * The right drawer on /admin/creators (board Creators). `?open=<id>` names
 * the creator; their state picks the drawer: waiting for approval, rejected,
 * or the person drawer for everyone else (certified creators, staff, admins,
 * suspended and self-deleted accounts).
 *
 * The decisions it opens (approve, reject, role, suspend, delete) are dialogs
 * rendered BESIDE the drawer rather than inside it, so a dialog's Esc and its
 * scrim click stay its own, and a dialog survives the drawer's content
 * changing under it (an approval turns the waiting drawer into the person
 * drawer the moment it lands).
 */
export function CreatorDrawer({
    id,
    meId,
    now,
    onClose,
    onOpenCreator,
    onApproved,
    onRejected,
    onDeleted,
}: {
    id: string | null;
    meId: string | null;
    now: number;
    onClose: () => void;
    onOpenCreator: (id: string) => void;
    onApproved: (target: ActionTarget) => void;
    onRejected: (target: { id: Id<"creators">; displayName: string }) => void;
    onDeleted: (target: ActionTarget) => void;
}) {
    const titleId = useId();
    const [action, setAction] = useState<CreatorAction | null>(null);

    // A different creator (a referrer link, Back, a toast's "Show in…") drops
    // whatever dialog was open for the last one.
    const [actionFor, setActionFor] = useState(id);
    if (actionFor !== id) {
        setActionFor(id);
        setAction(null);
    }

    const done = () => setAction(null);

    return (
        <>
            <DrawerFrame open={id !== null} onClose={onClose} labelledBy={titleId}>
                {id !== null && (
                    <DrawerBoundary key={id} titleId={titleId} onClose={onClose}>
                        <DrawerContent id={id} meId={meId} now={now} titleId={titleId} onClose={onClose} onOpenCreator={onOpenCreator} onAction={setAction} />
                    </DrawerBoundary>
                )}
            </DrawerFrame>

            <ApproveDialog
                target={action?.kind === "approve" ? action.target : null}
                now={now}
                onClose={done}
                onApproved={(target) => {
                    done();
                    onApproved(target);
                }}
            />
            <RejectCreatorDialog
                creator={action?.kind === "reject" ? { _id: action.target.id, firstName: action.target.firstName, lastName: action.target.lastName } : null}
                open={action?.kind === "reject"}
                onClose={done}
                onSuccess={({ _id, displayName }) => onRejected({ id: _id, displayName })}
            />
            <RoleDialog
                target={action?.kind === "role" ? action.target : null}
                role={action?.kind === "role" ? action.role : "creator"}
                onClose={done}
                onChanged={(target, role) => {
                    done();
                    toast.success(`${target.name} is now ${ROLE_LABEL[role]}. Takes effect on their next page load.`);
                }}
            />
            <StatusDialog
                target={action?.kind === "status" ? action.target : null}
                suspend={action?.kind === "status" ? action.suspend : true}
                onClose={done}
                onChanged={(target, suspend) => {
                    done();
                    toast.success(suspend ? `${target.name} is suspended.` : `${target.name} is active again.`);
                }}
            />
            <DeleteDialog
                target={action?.kind === "delete" ? action.target : null}
                submissions={action?.kind === "delete" ? action.submissions : 0}
                onClose={done}
                onDeleted={(target) => {
                    done();
                    onDeleted(target);
                }}
            />
        </>
    );
}

function DrawerContent({
    id,
    meId,
    now,
    titleId,
    onClose,
    onOpenCreator,
    onAction,
}: {
    id: string;
    meId: string | null;
    now: number;
    titleId: string;
    onClose: () => void;
    onOpenCreator: (id: string) => void;
    onAction: (action: CreatorAction) => void;
}) {
    // The id comes from the URL. One that is not a creator id at all makes
    // the query throw, and the drawer's boundary says so.
    const creator = useQuery(api.creators.getById, { id: id as Id<"creators"> });

    if (creator === undefined) return <DrawerLoading titleId={titleId} onClose={onClose} />;

    if (creator === null) {
        return (
            <>
                <SimpleHead titleId={titleId} title="Creator not found" onClose={onClose} />
                <div className="t-drawer-body">
                    <EmptyState title="This creator is not here any more" body="Their account may have been deleted. Close this and pick someone from the list." />
                </div>
                <div className="t-drawer-foot">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </>
        );
    }

    const target = targetOf(creator);
    const kind = drawerKindOf(creator);

    if (kind === "waiting") {
        return (
            <WaitingBody
                creator={creator}
                titleId={titleId}
                now={now}
                onClose={onClose}
                onOpenCreator={onOpenCreator}
                onApprove={() => onAction({ kind: "approve", target })}
                onReject={() => onAction({ kind: "reject", target })}
            />
        );
    }

    if (kind === "rejected") return <RejectedBody creator={creator} titleId={titleId} now={now} onClose={onClose} />;

    return (
        <PersonBody
            creator={creator}
            meId={meId}
            titleId={titleId}
            now={now}
            onClose={onClose}
            onOpenCreator={onOpenCreator}
            onPickRole={(role) => onAction({ kind: "role", target, role })}
            onSuspend={(suspend) => onAction({ kind: "status", target, suspend })}
            onDelete={(submissions) => onAction({ kind: "delete", target, submissions })}
        />
    );
}

/** The drawer's own shape while the creator loads: avatar, name, two lines. */
function DrawerLoading({ titleId, onClose }: { titleId: string; onClose: () => void }) {
    const show = useDelayed();
    return (
        <>
            <SimpleHead titleId={titleId} title={<span className="sr-only">Loading creator</span>} onClose={onClose}>
                {show && (
                    <div className="flex items-center gap-3" aria-hidden="true">
                        <Skeleton width={48} height={48} round />
                        <span className="flex flex-col gap-2">
                            <Skeleton width={160} height={14} />
                            <Skeleton width={96} height={10} />
                        </span>
                    </div>
                )}
            </SimpleHead>
            <div className="t-drawer-body">
                <Loading label="Loading creator" className="flex flex-col gap-6">
                    <Skeleton height={72} className="rounded-r1-card" />
                    <SkeletonText lines={4} />
                    <SkeletonText lines={3} />
                </Loading>
            </div>
        </>
    );
}
