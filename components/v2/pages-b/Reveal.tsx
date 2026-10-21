"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * The mock's reveal: below the first screen an element starts at opacity 0, blur 14px and 18px
 * low, and settles when 12% of it is visible. Anything already on screen at load is shown at
 * once, and with reduced motion nothing is hidden. `index` staggers siblings by 70ms.
 */
export function Reveal({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.94) return;
        el.classList.add("is-armed");
        const io = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                el.classList.add("is-in");
                io.disconnect();
            },
            { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <div ref={ref} className={`pb-reveal ${className ?? ""}`} style={{ "--i": index } as CSSProperties}>
            {children}
        </div>
    );
}
