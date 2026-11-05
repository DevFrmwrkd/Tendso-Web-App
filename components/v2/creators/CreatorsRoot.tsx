import type { ReactNode } from "react";

import { cx } from "../cx";
import { V2Root } from "../V2Root";

import { Reveal } from "./Reveal";
import "./creators.css";

/**
 * The root every creator page renders: the v2 scope plus `cr` (this folder's CSS scope) and
 * the mock's body classes: `ag cp` always, `cp-solo` on the standalone pages (sign-up,
 * portal, link pages: tinted ground, own top bar), `pt` on the portal.
 */
export function CreatorsRoot({ solo = false, portal = false, children }: { solo?: boolean; portal?: boolean; children: ReactNode }) {
    return (
        <V2Root className={cx("cr", "ag", "cp", solo && "cp-solo", portal && "pt")}>
            {children}
            <Reveal />
        </V2Root>
    );
}
