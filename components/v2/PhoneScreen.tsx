"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The screen of a PhoneFrame. Content is authored at 390 x 844 and scaled to the
 * screen's real width; this is the only client part of the frame. The CSS gives the
 * right scale for the fixed sizes before hydration, this keeps it right when the
 * phone is narrower than its nominal width (max-width: 100%).
 */
export function PhoneScreen({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            el.style.setProperty("--s", (entry.contentRect.width / 390).toFixed(5));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return (
        <div ref={ref} className="v2-phone-screen">
            {children}
        </div>
    );
}
