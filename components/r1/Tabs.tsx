"use client";

import Link from "next/link";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { cx } from "./cx";

/*
 * Tabs switch views, chips filter a list, segmented switches a mode.
 */

export type TabItem<V extends string> = { value: V; label: ReactNode; count?: number | null };

/**
 * Tabs with counts. Renders the tab list AND the one panel for the selected
 * tab (`children`). Arrow keys, Home and End move between tabs.
 */
export function Tabs<V extends string>({
    label,
    tabs,
    value,
    onChange,
    children,
    className,
}: {
    label: string;
    tabs: TabItem<V>[];
    value: V;
    onChange: (value: V) => void;
    children?: ReactNode;
    className?: string;
}) {
    const base = useId();
    const listRef = useRef<HTMLDivElement>(null);
    const tabId = (v: V) => `${base}-tab-${v}`;
    const panelId = `${base}-panel`;

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const i = tabs.findIndex((t) => t.value === value);
        let next = -1;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next < 0) return;
        e.preventDefault();
        onChange(tabs[next].value);
        listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(tabs[next].value))}`)?.focus();
    };

    return (
        <div className={cx("flex flex-col gap-4", className)}>
            <div ref={listRef} className="t-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
                {tabs.map((t) => {
                    const selected = t.value === value;
                    return (
                        <button
                            key={t.value}
                            type="button"
                            role="tab"
                            id={tabId(t.value)}
                            className="t-tab"
                            aria-selected={selected}
                            aria-controls={panelId}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => onChange(t.value)}
                        >
                            {t.label}
                            {t.count != null && <span className="t-count">{t.count}</span>}
                        </button>
                    );
                })}
            </div>
            {children !== undefined && (
                <div role="tabpanel" id={panelId} aria-labelledby={tabId(value)}>
                    {children}
                </div>
            )}
        </div>
    );
}

/** Tabs that are routes (each tab is its own URL). The current one carries aria-current. */
export function LinkTabs({
    label,
    tabs,
    current,
    className,
}: {
    label: string;
    tabs: { href: string; label: ReactNode; count?: number | null }[];
    current: string;
    className?: string;
}) {
    return (
        <nav className={cx("t-tabs", className)} aria-label={label}>
            {tabs.map((t) => (
                <Link key={t.href} href={t.href} className="t-tab" aria-current={t.href === current ? "page" : undefined}>
                    {t.label}
                    {t.count != null && <span className="t-count">{t.count}</span>}
                </Link>
            ))}
        </nav>
    );
}

export type ChipItem<V extends string> = { value: V; label: ReactNode; count?: number | null };

/** Filter chips. One pressed at a time. */
export function Chips<V extends string>({
    label,
    options,
    value,
    onChange,
    className,
}: {
    label: string;
    options: ChipItem<V>[];
    value: V;
    onChange: (value: V) => void;
    className?: string;
}) {
    return (
        <div className={cx("t-chips", className)} role="group" aria-label={label}>
            {options.map((o) => (
                <button key={o.value} type="button" className="t-chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
                    {o.label}
                    {o.count != null && <span className="t-num">{o.count}</span>}
                </button>
            ))}
        </div>
    );
}

/** Segmented control: switches a mode (desktop / phone preview, a map layer, a document). */
export function Segmented<V extends string>({
    label,
    options,
    value,
    onChange,
    className,
}: {
    label: string;
    options: { value: V; label: ReactNode }[];
    value: V;
    onChange: (value: V) => void;
    className?: string;
}) {
    return (
        <div className={cx("t-seg", className)} role="group" aria-label={label}>
            {options.map((o) => (
                <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}
