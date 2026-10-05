"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, MouseEvent } from "react";

import { isSpaHref, markNavigated, spaNavigate } from "./nav";

/**
 * A Help Center link. A real <a href> (crawlers follow it, a reader can open
 * it in a new tab), but a plain click on a view of /knowledge while already on
 * /knowledge switches the view in place instead of asking the server again.
 */
export function HcLink({ href, onClick, target, ...rest }: Omit<ComponentPropsWithoutRef<"a">, "href"> & { href: string }) {
    const spa = isSpaHref(href);
    const handle = (e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || target || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (spa && window.location.pathname === "/knowledge") {
            e.preventDefault();
            spaNavigate(href);
            return;
        }
        markNavigated();
    };
    // Views of /knowledge render on demand, so prefetching every topic card
    // would only make the server render pages nobody opened.
    return <Link href={href} prefetch={spa ? false : undefined} target={target} onClick={handle} {...rest} />;
}
