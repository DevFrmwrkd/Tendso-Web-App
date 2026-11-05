import type { ReactNode } from "react";

import { cx } from "./cx";
import { v2Fonts } from "./fonts";

/**
 * The v2 scope. Everything v2 (tokens, Onest, base type, focus ring) applies only
 * inside this element, so existing routes keep their look.
 */
export function V2Root({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cx("v2", v2Fonts, className)}>{children}</div>;
}
