import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

export type PillTone = "quiet" | "outline" | "accent" | "dark";

/** Small static tag. `accent` is a fill with ink text, like every use of the accent. */
export function Pill({ tone = "quiet", className, children, ...rest }: { tone?: PillTone; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
    return (
        <span className={cx("v2-pill", tone !== "quiet" && `v2-pill--${tone}`, className)} {...rest}>
            {children}
        </span>
    );
}

/**
 * Toggle chip (filters, "kind of business"). Controlled: pass `pressed` and an
 * onClick from a client component; the chip itself holds no state.
 */
export function Chip({
    pressed = false,
    count,
    className,
    children,
    type = "button",
    ...rest
}: { pressed?: boolean; count?: number; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
    return (
        <button type={type} aria-pressed={pressed} className={cx("v2-chip", className)} {...rest}>
            {children}
            {count !== undefined && <small>{count}</small>}
        </button>
    );
}
