import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

export type CardTone = "default" | "quiet" | "dark";

/** 20px-radius card: white with a hairline, a quiet fill, or the one dark surface. */
export function Card({
    tone = "default",
    pad = "md",
    as: Tag = "div",
    className,
    children,
    ...rest
}: {
    tone?: CardTone;
    pad?: "none" | "md" | "lg";
    as?: "div" | "article" | "section" | "li";
    children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
    return (
        <Tag className={cx("v2-card", tone !== "default" && `v2-card--${tone}`, pad !== "none" && `v2-card--pad-${pad}`, className)} {...rest}>
            {children}
        </Tag>
    );
}
