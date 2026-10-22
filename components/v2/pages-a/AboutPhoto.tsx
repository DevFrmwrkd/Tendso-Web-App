"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/** The hero photo opens up from a slightly inset frame as it scrolls into place (off under reduced motion). */
export function AboutPhoto({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
    const ref = useRef<HTMLElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const update = () => {
            const r = el.getBoundingClientRect();
            const start = window.innerHeight;
            const end = window.innerHeight * 0.35;
            const p = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
            const e = 1 - Math.pow(1 - p, 3);
            el.style.clipPath = `inset(0 ${((1 - e) * 4).toFixed(2)}% round var(--r-tile))`;
        };
        update();
        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, []);
    return (
        <figure className="ab-photo" ref={ref} data-reveal="hero" style={{ ["--i" as string]: 2 }}>
            <Image src={src} alt={alt} width={width} height={height} sizes="100vw" priority />
        </figure>
    );
}
