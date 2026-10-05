"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * True while the viewport is at least `px` wide. False on the server and
 * during hydration, then the real answer, kept in step as the window resizes.
 */
export function useMinWidth(px: number): boolean {
    const query = `(min-width: ${px}px)`;
    const subscribe = useCallback(
        (onChange: () => void) => {
            const list = window.matchMedia(query);
            list.addEventListener("change", onChange);
            return () => list.removeEventListener("change", onChange);
        },
        [query],
    );
    const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
