"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Modern follower cursor:
 *   - Small green dot tracks the mouse instantly (1:1)
 *   - Larger ring trails behind with lerp easing
 *   - Both grow + change color slightly when hovering interactive elements
 *
 * Disabled automatically on:
 *   - Touch devices (no useful hover/pointer)
 *   - Users with prefers-reduced-motion (respect their setting)
 *   - Viewport widths below md (768px)
 */
export default function CustomCursor() {
    const dotRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);
    const targetX = useRef(0);
    const targetY = useRef(0);
    const ringX = useRef(0);
    const ringY = useRef(0);

    const [enabled, setEnabled] = useState(false);
    const [hoveringInteractive, setHoveringInteractive] = useState(false);

    useEffect(() => {
        // Detect environment — only enable on non-touch, motion-friendly desktops.
        const mq = window.matchMedia(
            "(hover: hover) and (pointer: fine) and (min-width: 768px) and (prefers-reduced-motion: no-preference)"
        );
        const update = () => setEnabled(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        if (!enabled) return;

        // Hide native cursor while custom is active
        document.documentElement.style.cursor = "none";

        const onMove = (e: MouseEvent) => {
            targetX.current = e.clientX;
            targetY.current = e.clientY;

            // Position the inner dot 1:1 — no lag, feels precise
            if (dotRef.current) {
                dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
            }
        };

        // Track hover state on interactive targets so the cursor "grows"
        const onMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            const interactive = target.closest(
                "a, button, [role='button'], input, textarea, select, label, [data-cursor-grow]"
            );
            setHoveringInteractive(Boolean(interactive));
        };

        window.addEventListener("mousemove", onMove, { passive: true });
        window.addEventListener("mouseover", onMouseOver, { passive: true });

        // RAF loop for ring trailing
        let raf = 0;
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const tick = () => {
            ringX.current = lerp(ringX.current, targetX.current, 0.18);
            ringY.current = lerp(ringY.current, targetY.current, 0.18);
            if (ringRef.current) {
                ringRef.current.style.transform = `translate3d(${ringX.current}px, ${ringY.current}px, 0)`;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            document.documentElement.style.cursor = "";
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseover", onMouseOver);
            cancelAnimationFrame(raf);
        };
    }, [enabled]);

    if (!enabled) return null;

    return (
        <>
            {/* Inner dot — small, instant, green */}
            <div
                ref={dotRef}
                aria-hidden="true"
                className="pointer-events-none fixed top-0 left-0 z-[10000] -translate-x-1/2 -translate-y-1/2 will-change-transform"
                style={{ transform: "translate3d(-100px, -100px, 0)" }}
            >
                <div
                    className="rounded-full transition-[width,height,background-color,opacity] duration-200"
                    style={{
                        width: hoveringInteractive ? 14 : 8,
                        height: hoveringInteractive ? 14 : 8,
                        background: "var(--rust)",
                        marginLeft: hoveringInteractive ? -7 : -4,
                        marginTop: hoveringInteractive ? -7 : -4,
                        boxShadow: "0 0 12px rgba(45, 90, 63, 0.45)",
                    }}
                />
            </div>

            {/* Outer ring — trailing */}
            <div
                ref={ringRef}
                aria-hidden="true"
                className="pointer-events-none fixed top-0 left-0 z-[9999] will-change-transform mix-blend-multiply"
                style={{ transform: "translate3d(-100px, -100px, 0)" }}
            >
                <div
                    className="rounded-full border-2 transition-[width,height,border-color,opacity] duration-200"
                    style={{
                        width: hoveringInteractive ? 48 : 32,
                        height: hoveringInteractive ? 48 : 32,
                        marginLeft: hoveringInteractive ? -24 : -16,
                        marginTop: hoveringInteractive ? -24 : -16,
                        borderColor: hoveringInteractive
                            ? "var(--rust)"
                            : "rgba(45, 90, 63, 0.4)",
                        opacity: hoveringInteractive ? 0.9 : 0.65,
                    }}
                />
            </div>
        </>
    );
}
