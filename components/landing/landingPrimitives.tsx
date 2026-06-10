"use client";

import { useEffect, useState } from "react";

// Animated count-up — respects prefers-reduced-motion.
export function useTickUp(target: number | null | undefined, duration = 1200): number {
    const [v, setV] = useState(0);
    useEffect(() => {
        if (target == null) return;
        if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setV(target);
            return;
        }
        let raf = 0;
        let t0 = 0;
        const step = (t: number) => {
            if (!t0) t0 = t;
            const p = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setV(Math.floor(target * eased));
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return v;
}

/**
 * Tendso wordmark. The asset (/tendso-logo.png, 494×89) is WHITE on
 * transparent — renders as-is on dark surfaces (`inverted`), and gets a
 * CSS invert (white→black ink) on the default light paper surfaces.
 */
export function Logo({ inverted = false }: { inverted?: boolean }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src="/tendso-logo.png"
            alt="Tendso"
            width={128}
            height={23}
            style={{
                display: "block",
                filter: inverted ? "none" : "invert(1)",
            }}
        />
    );
}

export function Avatar({
    name,
    hue = 35,
    size = 56,
    initial,
}: {
    name?: string;
    hue?: number;
    size?: number;
    initial?: string;
}) {
    const ch = initial || (name?.[0] ?? "?");
    return (
        <div
            className="avatar"
            style={{
                width: size,
                height: size,
                fontSize: size * 0.42,
                background: `oklch(58% 0.14 ${hue})`,
                color: "white",
            }}
        >
            {ch}
        </div>
    );
}

export function Pill({
    active,
    onClick,
    children,
}: {
    active?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            className="pill"
            aria-pressed={active}
            onClick={onClick}
            style={{ padding: "6px 12px", fontSize: 12 }}
        >
            {children}
        </button>
    );
}

export function ArrowDownIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1 V12 M2 8 L7 13 L12 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ArrowUpRightIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 12 L12 4 M5 4 H12 V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
