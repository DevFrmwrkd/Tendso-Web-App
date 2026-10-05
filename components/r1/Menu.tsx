"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";

export type MenuItem =
    | {
          label: ReactNode;
          icon?: ReactNode;
          /** A destructive item: red, and it goes last, after a divider. */
          danger?: boolean;
          disabled?: boolean;
          onSelect?: () => void;
          href?: string;
          /** Open href in a new tab (a live site, a store). */
          external?: boolean;
      }
    | "divider";

/**
 * The More menu: everything that is not the page's one primary action.
 * Esc, a click outside, or picking an item closes it; arrow keys move.
 */
export function MoreMenu({
    label = "More actions",
    items,
    align = "end",
    trigger,
    size = "md",
    className,
}: {
    /** The trigger's aria-label. Name the thing: "More actions for Neighborhood". */
    label?: string;
    items: MenuItem[];
    align?: "start" | "end";
    /** Replace the default "…" icon button. Receives the props to spread on your button. */
    trigger?: (props: { "aria-label": string; "aria-haspopup": "menu"; "aria-expanded": boolean; "aria-controls": string; onClick: () => void }) => ReactNode;
    size?: "sm" | "md";
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
        const onDown = (e: PointerEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
    }, [open]);

    const close = (refocus: boolean) => {
        setOpen(false);
        if (refocus) wrapRef.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            e.preventDefault();
            close(true);
            return;
        }
        if (e.key === "Tab") {
            setOpen(false);
            return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
        if (els.length === 0) return;
        const i = els.indexOf(document.activeElement as HTMLElement);
        const next =
            e.key === "Home" ? 0 : e.key === "End" ? els.length - 1 : e.key === "ArrowDown" ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
        els[next].focus();
    };

    const triggerProps = {
        "aria-label": label,
        "aria-haspopup": "menu" as const,
        "aria-expanded": open,
        "aria-controls": menuId,
        onClick: () => setOpen((o) => !o),
    };

    return (
        <div ref={wrapRef} className={cx("t-menu-wrap", className)} onKeyDown={onKeyDown}>
            {trigger ? (
                trigger(triggerProps)
            ) : (
                <Button icon size={size} {...triggerProps}>
                    <Icon icon={MoreHorizontal} />
                </Button>
            )}
            {open && (
                <div ref={menuRef} id={menuId} role="menu" aria-label={label} className={cx("t-menu", align === "start" && "is-start")}>
                    {items.map((item, i) => {
                        if (item === "divider") return <hr key={`d${i}`} />;
                        const cls = cx(item.danger && "is-danger");
                        if (item.href && !item.disabled) {
                            const external = item.external || !item.href.startsWith("/");
                            return external ? (
                                <a
                                    key={i}
                                    role="menuitem"
                                    href={item.href}
                                    className={cls}
                                    target={item.external ? "_blank" : undefined}
                                    rel={item.external ? "noopener noreferrer" : undefined}
                                    onClick={() => close(false)}
                                >
                                    {item.icon}
                                    {item.label}
                                </a>
                            ) : (
                                <Link key={i} role="menuitem" href={item.href} className={cls} onClick={() => close(false)}>
                                    {item.icon}
                                    {item.label}
                                </Link>
                            );
                        }
                        return (
                            <button
                                key={i}
                                type="button"
                                role="menuitem"
                                className={cls}
                                disabled={item.disabled}
                                onClick={() => {
                                    close(true);
                                    item.onSelect?.();
                                }}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
