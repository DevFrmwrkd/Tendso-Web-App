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
        document.querySelectorAll(".lv2 [data-reveal]:not(.is-armed)").forEach((el) => {
            if (reduced || el.getBoundingClientRect().top < innerHeight * 0.95) return;
            el.classList.add("is-armed");
            io.observe(el);
        });
        return () => io.disconnect();
    }, []);
    return null;
}
