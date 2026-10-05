"use client";

import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";

import { Button } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";

/*
 * Overlays are native <dialog> elements opened with showModal(): the platform
 * traps focus, makes the page behind inert, puts the scrim in ::backdrop and
 * hands focus back to whatever opened it. React stays in charge of `open`:
 * Esc and a click on the scrim ask the parent to close (onClose); they never
 * close the element behind its back.
 *
 * Details open in a 480px right drawer, never a new page. A dialog is for a
 * decision. A destructive decision says exactly what it destroys.
 */

function useModal(open: boolean, onClose: () => void) {
    const ref = useRef<HTMLDialogElement>(null);

    // Layout effect: open and close in the same frame the content mounts or
    // unmounts, so a closing drawer never paints empty for a frame.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (open && !el.open) el.showModal();
        else if (!open && el.open) el.close();
    }, [open]);

    // Unmounting while open must not leave the page inert.
    useEffect(() => {
        const el = ref.current;
        return () => {
            if (el?.open) el.close();
        };
    }, []);

    const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
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

    return { ref, onCancel, onClick };
}

/**
 * The 480px details drawer (full width on a phone). `side="left"` is the
 * phone's navigation drawer.
 */
export function Drawer({
    open,
    onClose,
    title,
    meta,
    children,
    footer,
    side = "right",
    closeLabel = "Close details",
    className,
    bodyClassName,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    meta?: ReactNode;
    children: ReactNode;
    /** Drawer foot: Close plus at most one primary action, destructive ones here and never in a header. */
    footer?: ReactNode;
    side?: "right" | "left";
    closeLabel?: string;
    className?: string;
    bodyClassName?: string;
}) {
    const { ref, onCancel, onClick } = useModal(open, onClose);
    const titleId = useId();
    return (
        <dialog
            ref={ref}
            className={cx("r1 t-drawer", side === "left" && "is-left", className)}
            aria-labelledby={titleId}
            onCancel={onCancel}
            onClick={onClick}
        >
            {open && (
                <>
                    <div className="t-drawer-head">
                        <div className="flex min-w-0 flex-col gap-1">
                            <h2 className="t-h2" id={titleId}>
                                {title}
                            </h2>
                            {meta && <p className="t-meta">{meta}</p>}
                        </div>
                        <Button variant="ghost" size="sm" icon aria-label={closeLabel} onClick={onClose}>
                            <Icon icon={X} />
                        </Button>
                    </div>
                    <div className={cx("t-drawer-body", bodyClassName)}>{children}</div>
                    {footer && <div className="t-drawer-foot">{footer}</div>}
                </>
            )}
        </dialog>
    );
}

/** A decision. Title, one paragraph, and the foot: the safe choice, then the action. */
export function Dialog({
    open,
    onClose,
    title,
    children,
    footer,
    role = "dialog",
    className,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    role?: "dialog" | "alertdialog";
    className?: string;
}) {
    const { ref, onCancel, onClick } = useModal(open, onClose);
    const titleId = useId();
    const bodyId = useId();
    return (
        <dialog
            ref={ref}
            role={role === "alertdialog" ? "alertdialog" : undefined}
            className={cx("r1 t-dialog", className)}
            aria-labelledby={titleId}
            aria-describedby={children ? bodyId : undefined}
            onCancel={onCancel}
            onClick={onClick}
        >
            {open && (
                <>
                    <h2 className="t-h2" id={titleId}>
                        {title}
                    </h2>
                    {children && (
                        <div className="t-body flex flex-col gap-3" id={bodyId}>
                            {children}
                        </div>
                    )}
                    {footer && <div className="t-dialog-foot">{footer}</div>}
                </>
            )}
        </dialog>
    );
}

/**
 * Confirm a destructive action. One dialog for every delete in the app: the
 * title names the thing ("Delete Print Service?"), the body says what goes
 * with it and that it cannot be undone, and the button repeats the verb.
 */
export function ConfirmDialog({
    open,
    onCancel,
    onConfirm,
    title,
    children,
    confirmLabel,
    cancelLabel = "Keep it",
    busy = false,
    destructive = true,
    confirmIcon,
}: {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    title: ReactNode;
    children?: ReactNode;
    confirmLabel: ReactNode;
    cancelLabel?: ReactNode;
    busy?: boolean;
    destructive?: boolean;
    confirmIcon?: ReactNode;
}) {
    return (
        <Dialog
            open={open}
            onClose={busy ? () => {} : onCancel}
            title={title}
            role="alertdialog"
            footer={
                <>
                    <Button onClick={onCancel} disabled={busy}>
                        {cancelLabel}
                    </Button>
                    <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} disabled={busy} aria-busy={busy}>
                        {confirmIcon}
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {children}
        </Dialog>
    );
}
