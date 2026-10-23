import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

/** Page width: max 1440, side padding clamp(16px, 3.3vw, 48px). */
export function Container({ as: Tag = "div", className, children, ...rest }: { as?: "div" | "header" | "main" | "footer"; children: ReactNode } & HTMLAttributes<HTMLElement>) {
    return (
        <Tag className={cx("v2-wrap", className)} {...rest}>
            {children}
        </Tag>
    );
}

export type SectionSize = "flush" | "sm" | "md" | "lg";
export type SectionTone = "canvas" | "stage" | "quiet" | "dark";

/**
 * A page band: vertical rhythm from the spacing tokens, an optional full-bleed
 * tone, and (by default) a Container around the content.
 */
export function Section({
    size = "md",
    tone = "canvas",
    contained = true,
    className,
    children,
    ...rest
}: {
    size?: SectionSize;
    tone?: SectionTone;
    contained?: boolean;
    children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
    return (
        <section className={cx(`v2-sec--${size}`, tone !== "canvas" && `v2-sec--${tone}`, className)} {...rest}>
            {contained ? <Container>{children}</Container> : children}
        </section>
    );
}

/** 12-column grid with the system gap. Collapses to one column under 760px. */
export function Grid({ className, children, ...rest }: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cx("v2-grid", className)} {...rest}>
            {children}
        </div>
    );
}
