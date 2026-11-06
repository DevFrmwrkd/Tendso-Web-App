"use client";

import { useEffect } from "react";

/**
 * Blur-in reveals (mock T.reveal): anything with data-reveal that starts below
 * the first screen waits at opacity 0 / blur 14px / +18px and settles once 12%
 * of it is visible. Anything already on screen, and everything under reduced
 * motion, is shown at once (no flash).
 */
export function Reveals() {
    useEffect(() => {
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const io = new IntersectionObserver(
            (entries) =>
                entries.forEach((e) => {
                    if (!e.isIntersecting) return;
                    e.target.classList.add("is-in");
                    io.unobserve(e.target);
                }),
            { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
        );
        const revealTarget = (hash: string) => {
            let id: string;
            try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
            if (!id) return;
            const target = document.getElementById(id);
            // Fragment navigation must never land inside an invisible reveal wrapper.
            for (let el = target; el?.closest(".lv2"); el = el.parentElement) {
                if (!el.matches("[data-reveal]")) continue;
                el.classList.add("is-in");
                io.unobserve(el);
            }
        };
        const onHashChange = () => revealTarget(window.location.hash);
        const onClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
            if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
            let url: URL;
            try { url = new URL(link.href, window.location.href); } catch { return; }
            if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) revealTarget(url.hash);
        };
        onHashChange();
        // Re-observe armed elements after an effect remount (including Fast Refresh).
        document.querySelectorAll<HTMLElement>(".lv2 [data-reveal]:not(.is-in)").forEach((el) => {
            if (reduced || el.getBoundingClientRect().top < innerHeight * 0.95) {
                el.classList.add("is-in");
                return;
            }
            el.classList.add("is-armed");
            io.observe(el);
        });
        window.addEventListener("hashchange", onHashChange);
        document.addEventListener("click", onClick, true);
        return () => {
            io.disconnect();
            window.removeEventListener("hashchange", onHashChange);
            document.removeEventListener("click", onClick, true);
        };
    }, []);
    return null;
}
