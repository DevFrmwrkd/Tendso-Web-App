"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, type ComponentPropsWithRef, type ReactNode } from "react";

import { cx } from "./cx";
import { Icon } from "./Icon";

/*
 * Rows and lists. Lists on a home or in a card cap at 3–5 rows and "Show all"
 * expands in place; full tables (8–10 rows plus page text) only on list pages.
 * A row that opens something is ONE button or link: the whole row is the target.
 */

export function List({ className, ...rest }: ComponentPropsWithRef<"div">) {
    return <div className={cx("t-list", className)} {...rest} />;
}

/** A static row (no action). */
export function Row({ className, selected, ...rest }: ComponentPropsWithRef<"div"> & { selected?: boolean }) {
    return <div className={cx("t-row", selected && "is-selected", className)} {...rest} />;
}

/** A row that is one button, e.g. it opens the details drawer. */
export function RowButton({ className, selected, type = "button", ...rest }: ComponentPropsWithRef<"button"> & { selected?: boolean }) {
    return <button type={type} className={cx("t-row", selected && "is-selected", className)} {...rest} />;
}

/** A row that is one link. */
export function RowLink({ className, href, ...rest }: Omit<ComponentPropsWithRef<"a">, "href"> & { href: string }) {
    return <Link href={href} className={cx("t-row", className)} {...rest} />;
}

/** The usual left part of a row: a title and a meta line. */
export function RowMain({ title, meta, className }: { title: ReactNode; meta?: ReactNode; className?: string }) {
    return (
        <span className={cx("t-row-main", className)}>
            <span className="t-row-title">{title}</span>
            {meta && <span className="t-meta">{meta}</span>}
        </span>
    );
}

export function RowChevron() {
    return (
        <span className="t-row-chev">
            <Icon icon={ChevronRight} />
        </span>
    );
}

/** Table header row. Give each cell the same width class as the matching row cell. */
export function TableHead({ className, ...rest }: ComponentPropsWithRef<"div">) {
    return <div className={cx("t-th", className)} role="presentation" {...rest} />;
}

/**
 * A capped list inside a card: the first `initial` rows, then a "Show all"
 * button that expands in place. Nothing to expand, no button.
 */
export function ShowAllList<T>({
    items,
    initial = 5,
    renderItem,
    moreLabel,
    lessLabel = "Show less",
    className,
}: {
    items: T[];
    initial?: number;
    renderItem: (item: T, index: number) => ReactNode;
    /** Defaults to "Show all N". */
    moreLabel?: string;
    lessLabel?: string;
    className?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? items : items.slice(0, initial);
    return (
        <div className={cx("t-card overflow-hidden", className)}>
            <div className="t-list">{visible.map(renderItem)}</div>
            {items.length > initial && (
                <button type="button" className="t-showall" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
                    {expanded ? lessLabel : (moreLabel ?? `Show all ${items.length}`)}
                </button>
            )}
        </div>
    );
}

/** Empty state: say what happens next and offer the one action. */
export function EmptyState({
    icon,
    title,
    body,
    action,
    className,
}: {
    icon?: ReactNode;
    title: ReactNode;
    body?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cx("t-empty", className)}>
            {icon && <span className="t-icon-disc">{icon}</span>}
            <h3 className="t-h2">{title}</h3>
            {body && <p className="t-meta max-w-[360px]">{body}</p>}
            {action}
        </div>
    );
}
