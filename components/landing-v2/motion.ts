"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/*
 * Motion core for the v2 landing, ported from the mock's js/core.js (window.T).
 * Same curves as the CSS tokens, one shared rAF loop, a timer runner for the app
 * screens, and a reduced-motion flag. No smooth-scroll library: every
 * scroll-linked effect reads window.scrollY inside the shared loop.
 */

function bezier(x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
    const sy = (t: number) => ((ay * t + by) * t + cy) * t;
    const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
    return (x: number) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let t = x;
        for (let i = 0; i < 6; i++) {
            const e = sx(t) - x;
            const d = dx(t);
            if (Math.abs(e) < 1e-5 || !d) break;
            t -= e / d;
        }
        return sy(t);
    };
}

export const ease = {
    out: bezier(0.22, 1, 0.36, 1),
    expo: bezier(0.16, 1, 0.3, 1),
    inout: bezier(0.77, 0, 0.175, 1),
};
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0..1 position of v between a and b. */
export const prog = (v: number, a: number, b: number) => clamp((v - a) / (b - a), 0, 1);

/** Easings as CSS strings, for transitions set from script. */
export const EASE = "cubic-bezier(.22,1,.36,1)";
export const EASE_INOUT = "cubic-bezier(.65,0,.35,1)";

// ---- one shared rAF loop -----------------------------------------------------
type FrameFn = (now: number) => void;
const frameFns = new Set<FrameFn>();
let rafId = 0;
function tick(now: number) {
    frameFns.forEach((fn) => fn(now));
    rafId = frameFns.size ? requestAnimationFrame(tick) : 0;
}
export function onFrame(fn: FrameFn): () => void {
    frameFns.add(fn);
    if (!rafId && typeof window !== "undefined") rafId = requestAnimationFrame(tick);
    return () => {
        frameFns.delete(fn);
    };
}

/** Subscribe `fn` to the shared loop while `active`. The latest fn is always called. */
export function useFrame(fn: FrameFn, active = true) {
    const ref = useRef(fn);
    useEffect(() => {
        ref.current = fn;
    });
    useEffect(() => {
        if (!active) return;
        return onFrame((now) => ref.current(now));
    }, [active]);
}

// ---- reduced motion ------------------------------------------------------------
const RM = "(prefers-reduced-motion: reduce)";
function subscribeRM(cb: () => void) {
    const mq = window.matchMedia(RM);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
}
export function useReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribeRM,
        () => window.matchMedia(RM).matches,
        () => false,
    );
}

// ---- timers for the app screens --------------------------------------------------
export interface Runner {
    after(ms: number, fn: () => void): void;
    clear(): void;
}
export function makeRunner(): Runner {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    return {
        after(ms, fn) {
            const id = setTimeout(() => {
                timers.delete(id);
                fn();
            }, ms);
            timers.add(id);
        },
        clear() {
            timers.forEach(clearTimeout);
            timers.clear();
        },
    };
}

/** Force a style flush so the next class/style change animates from the current one. */
export const reflow = (el: Element | null) => void (el as HTMLElement | null)?.offsetWidth;

/** Fires `fn(isIn)` when the element crosses the threshold. */
export function useInView<T extends Element>(fn: (isIn: boolean) => void, threshold = 0.25) {
    const ref = useRef<T>(null);
    const cb = useRef(fn);
    useEffect(() => {
        cb.current = fn;
    });
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver((entries) => entries.forEach((e) => cb.current(e.isIntersecting)), { threshold });
        io.observe(el);
        return () => io.disconnect();
    }, [threshold]);
    return ref;
}
