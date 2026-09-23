"use client";

/**
 * Is this a desk, not a phone? Matches the `lg` breakpoint Tailwind uses, so
 * the JS branch and the CSS branches can never disagree about where the
 * desktop layout starts.
 *
 * WHY A HOOK AND NOT CSS. Nearly all of the desktop layout is `lg:` classes —
 * see ui.tsx. Exactly one difference cannot be: step 2 asks one question per
 * screen on a phone and all eight at once on a desk. Rendering both trees and
 * hiding one with CSS would ship duplicate `id`s and duplicate textareas bound
 * to the same draft keys — invalid markup, and a label that jumps to whichever
 * copy the browser found first. So that one branch is made in JS.
 *
 * STARTS FALSE ON PURPOSE. This is a `"use client"` page that renders "Loading…"
 * until loadDraft() lands in an effect, so the form itself never renders during
 * hydration — by the time there is a draft to draw, this effect has already run
 * and React has batched both updates into the same commit. No mismatch, and no
 * flash of the phone layout on a monitor.
 */

import { useEffect, useState } from "react";

/** 1024px — Tailwind's `lg`. Changing this means changing every `lg:` in
 *  app/start/*, which is the point of it being written down once. */
const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const media = window.matchMedia(DESKTOP_QUERY);
        const sync = () => setIsDesktop(media.matches);
        sync();
        // Kept live rather than read once: a desktop browser window dragged
        // narrow, or a tablet rotated, has to land on a layout whose Continue
        // button still checks the right answers.
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    return isDesktop;
}
