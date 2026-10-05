"use client";

import { useRouter } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";

/*
 * Moving around the Help Center.
 *
 * /knowledge is one page whose view comes from its query (?cat=, ?ws=wiki…).
 * Going from one of those views to another is a history.pushState: Next keeps
 * useSearchParams in step with it, the view changes at once, and the browser's
 * Back button walks the views like pages. Anything else (an article, which has
 * its own crawlable route, or /knowledge from an article) is a normal router
 * navigation.
 */

/** True for a URL that is a view of /knowledge itself. */
export function isSpaHref(href: string): boolean {
    return href === "/knowledge" || href.startsWith("/knowledge?") || href.startsWith("/knowledge#");
}

// The board's Back button walks back through what the reader opened here. On
// a page they landed on (a shared link, a search result) there is nothing to
// walk back to inside the Help Center, so it goes up a level instead.
let navigated = false;

export function markNavigated(): void {
    navigated = true;
}

export function hasNavigated(): boolean {
    return navigated;
}

/** The anchors on the home (#contact, #faq, #creator-faq) listen for this to scroll themselves into view. */
export const HASH_EVENT = "hc:hash";

/** Switch the view of /knowledge without a server round trip. Only call it while on /knowledge. */
export function spaNavigate(href: string): void {
    window.history.pushState(null, "", href);
    markNavigated();
    if (new URL(href, window.location.href).hash) window.dispatchEvent(new Event(HASH_EVENT));
    else window.scrollTo(0, 0);
}

/** Go to any Help Center URL the right way: pushState between views of /knowledge, the router for the rest. */
export function useHelpNav(): (href: string) => void {
    const router = useRouter();
    return useCallback(
        (href: string) => {
            if (isSpaHref(href) && window.location.pathname === "/knowledge") {
                spaNavigate(href);
                return;
            }
            markNavigated();
            router.push(href);
        },
        [router],
    );
}

function subscribeHash(onChange: () => void): () => void {
    window.addEventListener("hashchange", onChange);
    window.addEventListener(HASH_EVENT, onChange);
    return () => {
        window.removeEventListener("hashchange", onChange);
        window.removeEventListener(HASH_EVENT, onChange);
    };
}

/** The URL's #fragment. Empty on the server, so the first client render matches it. */
export function useHash(): string {
    return useSyncExternalStore(
        subscribeHash,
        () => window.location.hash,
        () => "",
    );
}
