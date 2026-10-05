"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * A fold: closed by default. History, raw data and technical fields live
 * here, out of the way of the one thing the screen is for. Stack several
 * inside <Folds> to get the closing hairline under the last one.
 */
export function Fold({ title, children, defaultOpen = false, className }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
    const [open, setOpen] = useState(defaultOpen);
    const id = useId();
    return (
        <div className={cx("t-fold", className)}>
            <button type="button" className="t-fold-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
                {title}
                <span className="t-fold-chev">
                    <Icon icon={ChevronDown} />
                </span>
            </button>
            <div className="t-fold-in" id={id} hidden={!open}>
                {children}
            </div>
        </div>
    );
}

export function Folds({ className, children }: { className?: string; children: ReactNode }) {
    return <div className={cx("t-folds", className)}>{children}</div>;
}
