"use client";

import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button, Icon, Loading, MoreMenu, SkeletonRows } from "@/components/r1";

/**
 * The page text under a table and, when there is more than one page, the two
 * page buttons (ComponentKit "Table header and rows": "Oldest first · showing
 * 3 of 6 · page 1 of 2").
 */
export function Pager({ text, page, pages, onPage }: { text: string; page: number; pages: number; onPage: (page: number) => void }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <p className="t-meta t-num">{text}</p>
            {pages > 1 && (
                <div className="flex flex-none gap-2">
                    <Button icon aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                        <Icon icon={ChevronLeft} />
                    </Button>
                    <Button icon aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
                        <Icon icon={ChevronRight} />
                    </Button>
                </div>
            )}
        </div>
    );
}

/**
 * A "Role: All ▾" / "Sort: Newest first ▾" button over a menu of choices
 * (board Creators, Queue's sort menu). The chosen one carries the check, and
 * says so to a screen reader. Built on the shared More menu, so Esc, a click
 * outside and the arrow keys behave the same as every other menu.
 */
export function ChoiceMenu<V extends string>({
    text,
    icon,
    options,
    value,
    onChange,
    align = "start",
    className,
}: {
    /** What the button says, which is also the menu's name: "Role: All". */
    text: string;
    icon?: LucideIcon;
    options: ReadonlyArray<{ value: V; label: string }>;
    value: V;
    onChange: (value: V) => void;
    align?: "start" | "end";
    className?: string;
}) {
    return (
        <MoreMenu
            label={text}
            align={align}
            className={className}
            trigger={(props) => (
                <Button {...props}>
                    {icon && <Icon icon={icon} />}
                    {text}
                    <Icon icon={ChevronDown} />
                </Button>
            )}
            items={options.map((o) => {
                const chosen = o.value === value;
                return {
                    label: (
                        <>
                            {o.label}
                            {chosen && <span className="sr-only"> (selected)</span>}
                        </>
                    ),
                    icon: chosen ? <Icon icon={Check} /> : <span className="w-4 flex-none" aria-hidden="true" />,
                    onSelect: () => onChange(o.value),
                };
            })}
        />
    );
}

/** A table still loading: rows of the same shape, after the usual 300ms. */
export function TableLoading({ label }: { label: string }) {
    return (
        <Loading label={label}>
            <SkeletonRows count={5} avatar />
        </Loading>
    );
}

/** One line above a table saying what it is for (the board's meta line). */
export function Lede({ children }: { children: ReactNode }) {
    return <p className="t-meta">{children}</p>;
}
