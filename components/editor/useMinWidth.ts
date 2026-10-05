"use client";

import { useSyncExternalStore } from "react";

/**
 * Is the window at least `px` wide? Pass a Tailwind breakpoint (1024 = `lg`,
 * 1280 = `xl`) so the JS branch and the CSS branches agree on where a layout
 * changes.
 *
 * Only for the few things CSS cannot decide: which tabs exist (the phone gets
 * a Preview tab because the preview cannot sit beside the panels), and whether
 * the details panel docks or opens as a drawer (a modal <dialog> left open
 * across a resize would trap the page).
 *
 * The server and the hydration pass assume a desk, the workspace's main use;
 * a phone then switches on its first client render.
 */
export function useMinWidth(px: number): boolean {
    const query = `(min-width: ${px}px)`;
    return useSyncExternalStore(
        (onChange) => {
            const media = window.matchMedia(query);
            media.addEventListener("change", onChange);
            return () => media.removeEventListener("change", onChange);
        },
        () => window.matchMedia(query).matches,
        () => true,
    );
}
