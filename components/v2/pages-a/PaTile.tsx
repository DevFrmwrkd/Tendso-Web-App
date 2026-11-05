import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/components/v2/cx";

/**
 * The v2 tile surface (same classes as components/v2/Tile) for tiles that need
 * extra attributes such as `data-reveal`, which the shared Tile does not pass through.
 */
export function PaTile({
    tone = "default",
    as: Tag = "div",
    className,
    children,
    ...rest
}: { tone?: "default" | "quiet" | "stage" | "dark"; as?: "div" | "article" | "section"; children?: ReactNode } & HTMLAttributes<HTMLElement>) {
    return (
        <Tag className={cx("v2-tile", tone !== "default" && `v2-tile--${tone}`, className)} {...rest}>
            {children}
        </Tag>
    );
}
