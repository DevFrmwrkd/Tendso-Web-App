"use client";

import { useEffect } from "react";

/**
 * The mock's blur-in reveals: elements marked `data-reveal` start hidden (pages-a.css)
 * and get `is-in` when they come into view. Elements already on screen reveal at once.
 * Without JS the CSS shows them after three seconds.
 */
export function Reveals() {
    useEffect(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)"));
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced || typeof IntersectionObserver === "undefined") {
            els.forEach((e) => e.classList.add("is-in"));
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                for (const en of entries) {
                    if (en.isIntersecting) {
                        en.target.classList.add("is-in");
                        io.unobserve(en.target);
                    }
                }
            },
            { rootMargin: "0px 0px -5% 0px", threshold: 0.01 },
        );
        for (const el of els) {
            if (el.getBoundingClientRect().top < window.innerHeight * 0.95) el.classList.add("is-in");
            else io.observe(el);
        }
        return () => io.disconnect();
    }, []);
    return null;
}
