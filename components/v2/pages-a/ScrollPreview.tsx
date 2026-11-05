"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Start each preview at the top when it comes into view; reset it on exit. */
export function ScrollPreview({ children, className, measureTravel = false }: { children: ReactNode; className: string; measureTravel?: boolean }) {
    const view = useRef<HTMLDivElement>(null);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        const el = view.current;
        if (!el || typeof IntersectionObserver === "undefined") return;

        let visible = false;
        const update = () => setRunning(visible && !document.hidden);
        const io = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting && entry.intersectionRatio >= 0.3;
            update();
        }, { threshold: 0.3 });
        io.observe(el);
        document.addEventListener("visibilitychange", update);

        const capture = el.firstElementChild;
        const measure = () => {
            if (capture instanceof HTMLElement) {
                el.style.setProperty("--travel", `${-Math.max(0, capture.offsetHeight - el.clientHeight)}px`);
            }
        };
        const ro = measureTravel && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        if (ro && capture) {
            ro.observe(el);
            ro.observe(capture);
            measure();
        }

        return () => {
            io.disconnect();
            ro?.disconnect();
            document.removeEventListener("visibilitychange", update);
        };
    }, [measureTravel]);

    return <div ref={view} className={`${className} scroll-preview${running ? " is-running" : ""}`}>{children}</div>;
}
