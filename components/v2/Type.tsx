import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

/** Tiny uppercase mono label (11px, tracked). The only place the mono face is used. */
export function Label({ children, className, ...rest }: { children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
    return (
        <span className={cx("v2-label", className)} {...rest}>
            {children}
        </span>
    );
}

export type HeadingSize = "hero" | "moment" | "h2" | "h3";

/** Display type: Onest 500, tight tracking. Sizes come from the mock's scale. */
export function Heading({
    as: Tag = "h2",
    size = "h2",
    className,
    children,
    ...rest
}: {
    as?: "h1" | "h2" | "h3" | "p";
    size?: HeadingSize;
    children: ReactNode;
} & HTMLAttributes<HTMLHeadingElement>) {
    return (
        <Tag className={cx(`v2-h--${size}`, className)} {...rest}>
            {children}
        </Tag>
    );
}
