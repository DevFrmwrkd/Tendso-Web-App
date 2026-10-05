"use client";

import { X } from "lucide-react";
import {
    Component,
    useEffect,
    useLayoutEffect,
    useRef,
    type MouseEvent,
    type ReactNode,
    type SyntheticEvent,
} from "react";

import { Avatar, Button, ErrorState, Icon, Toaster } from "@/components/r1";

/*
 * The creator drawer's frame: the same 480px right drawer as the shared
 * <Drawer> (a native modal <dialog>, full width on a phone), with the head
 * the Creators board draws: a large avatar, the name, a role line and a
 * status, and a More menu beside Close. The shared Drawer's head holds a
 * title, a meta line and Close only, so this file carries its own head and
 * the few lines of <dialog> handling that go with it (asked for in the
 * report: a `leading` and an `actions` slot on the shared Drawer would let
 * this go). Toasts work as in the shared Drawer: the shared toaster mounted
 * inside the <dialog> (`inOverlay`), see components/r1/Toaster.tsx.
 */

/**
 * The <dialog> itself. React owns `open`; Esc and a click on the scrim ask
 * the parent to close. Both checks look at the event's own target, so an Esc
 * or a scrim click meant for a menu or dialog opened from inside the drawer
 * never closes the drawer as well (React bubbles `cancel` up its own tree).
 */
export function DrawerFrame({
    open,
    onClose,
    labelledBy,
    children,
}: {
    open: boolean;
    onClose: () => void;
    labelledBy: string;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);

    // Layout effect: open and close in the frame the content mounts, so the
    // drawer never paints empty.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (open && !el.open) el.showModal();
        else if (!open && el.open) el.close();
    }, [open]);

    // Leaving the page with the drawer open must not leave the page inert.
    useEffect(() => {
        const el = ref.current;
        return () => {
            if (el?.open) el.close();
        };
    }, []);

    const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
    };

    // A click on ::backdrop lands on the <dialog> itself, outside its box.
    const onClick = (e: MouseEvent<HTMLDialogElement>) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) onClose();
    };

    return (
        <dialog ref={ref} className="r1 t-drawer" aria-labelledby={labelledBy} onCancel={onCancel} onClick={onClick}>
            {open && (
                <>
                    {children}
                    {/* Toasts must paint above the drawer, as in the shared Drawer: see Toaster.tsx. */}
                    <Toaster inOverlay />
                </>
            )}
        </dialog>
    );
}

function CloseButton({ onClose }: { onClose: () => void }) {
    return (
        <Button variant="ghost" size="sm" icon aria-label="Close details" onClick={onClose}>
            <Icon icon={X} />
        </Button>
    );
}

/** The board's drawer head: avatar, name, then the role line and status passed as children. */
export function DrawerHead({
    titleId,
    name,
    avatar,
    actions,
    onClose,
    children,
}: {
    titleId: string;
    name: string;
    /** What the initials come from (null shows "?"). */
    avatar: string | null;
    /** The More menu, when the person has one. */
    actions?: ReactNode;
    onClose: () => void;
    children?: ReactNode;
}) {
    return (
        <div className="t-drawer-head">
            <div className="flex min-w-0 items-center gap-3">
                <Avatar name={avatar} size="lg" />
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h2 className="t-h2 break-words" id={titleId}>
                        {name}
                    </h2>
                    {children}
                </div>
            </div>
            <div className="flex flex-none items-center gap-1">
                {actions}
                <CloseButton onClose={onClose} />
            </div>
        </div>
    );
}

/** A head with a title only, for the loading, not-found and failed states. */
export function SimpleHead({ titleId, title, onClose, children }: { titleId: string; title: ReactNode; onClose: () => void; children?: ReactNode }) {
    return (
        <div className="t-drawer-head">
            <div className="flex min-w-0 flex-col gap-1">
                <h2 className="t-h2" id={titleId}>
                    {title}
                </h2>
                {children}
            </div>
            <CloseButton onClose={onClose} />
        </div>
    );
}

/**
 * Keeps a failure inside the drawer. A Convex query that fails throws while
 * rendering; without this the drawer's queries would take the whole page to
 * the route's error screen. With it, the drawer says what failed, keeps its
 * Close button (a phone has no scrim to tap and no Esc key), and the list
 * behind it keeps working.
 */
export class DrawerBoundary extends Component<{ titleId: string; onClose: () => void; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <>
                <SimpleHead titleId={this.props.titleId} title="Creator" onClose={this.props.onClose} />
                <div className="t-drawer-body">
                    <ErrorState what="This creator" />
                </div>
            </>
        );
    }
}

/** For the extras a drawer can do without (the call, who rejected): a failure shows the fallback, or nothing. */
export class QuietBoundary extends Component<{ fallback?: ReactNode; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
    }
}
