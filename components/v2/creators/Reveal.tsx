"use client";

import { useEffect } from "react";

/**
 * Blur-in reveals, as in the mock (js/core.js T.reveal): everything is visible at rest;
 * only things below the first screen wait, then blur in when they scroll into view. Put
 * one <Reveal /> on a page; it finds every [data-reveal] inside the nearest `.cr` root.
 * With reduced motion nothing is armed.
 */
export function Reveal() {
    useEffect(() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const els = Array.from(document.querySelectorAll<HTMLElement>(".cr [data-reveal]:not(.is-armed)"));
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add("is-in");
                        io.unobserve(e.target);
                    }
                }
            },
            { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
        );
        for (const el of els) {
            if (reduced || el.getBoundingClientRect().top < window.innerHeight * 0.95) {
                el.classList.add("is-in");
                continue;
            }
            el.classList.add("is-armed");
            io.observe(el);
        }
        return () => io.disconnect();
    }, []);
    return null;
}
