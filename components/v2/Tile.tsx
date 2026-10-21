import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { cx } from "./cx";
import { Label } from "./Type";

export type TileTone = "default" | "quiet" | "stage" | "dark";

/**
 * 40px-radius tile (28px under 760px).
 *
 * `hoverText` is the one-line explanation. On hover or keyboard focus the whole tile
 * blurs behind a translucent veil and that one line sits centered. There is no
 * black box over the content. On touch devices (no hover) the line is visually
 * hidden but still in the DOM for screen readers.
 */
export function Tile({
    tone = "default",
    hoverText,
    href,
    className,
    style,
    children,
}: {
    tone?: TileTone;
    hoverText?: string;
    href?: string;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
}) {
    const cls = cx("v2-tile", tone !== "default" && `v2-tile--${tone}`, hoverText && "v2-tile--hover", className);
    const inner = (
        <>
            {children}
            {hoverText && <span className="v2-tile-more">{hoverText}</span>}
        </>
    );
    if (href) {
        return (
            <Link href={href} className={cls} style={style}>
                {inner}
            </Link>
        );
    }
    return (
        <div className={cls} style={style} tabIndex={hoverText ? 0 : undefined}>
            {inner}
        </div>
    );
}

/** Label + title pinned to the top-left of a tile. */
export function TileHead({ label, children }: { label?: string; children: ReactNode }) {
    return (
        <div className="v2-tile-head">
            {label && <Label>{label}</Label>}
            <h3 className="v2-tile-title">{children}</h3>
        </div>
    );
}
