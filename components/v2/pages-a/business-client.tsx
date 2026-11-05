"use client";

import { ChevronsLeftRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** The laptop capture glides as you scroll past it (mock: business.js hero). */
export function LaptopView({ src, width, height, alt }: { src: string; width: number; height: number; alt: string }) {
    const view = useRef<HTMLDivElement>(null);
    const img = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (reduced() || !view.current || !img.current) return;
        const v = view.current;
        const el = img.current;
        let travel = 0;
        let cur = 0;
        let raf = 0;
        const measure = () => (travel = Math.max(0, el.offsetHeight - v.offsetHeight));
        measure();
        window.addEventListener("resize", measure);
        const tick = () => {
            const r = v.getBoundingClientRect();
            // progress while the frame travels from 75% of the screen up to -60% of its own height
            const start = window.innerHeight * 0.75;
            const end = -r.height * 0.6;
            const p = clamp((start - r.top) / (start - end), 0, 1);
            const target = -easeInOut(p) * travel * 0.42;
            cur += (target - cur) * 0.12;
            if (Math.abs(target - cur) > 0.1) el.style.transform = `translate3d(0, ${cur.toFixed(1)}px, 0)`;
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", measure);
        };
    }, []);
    return (
        <div className="browser-view" ref={view}>
            <div ref={img} style={{ willChange: "transform" }}>
                <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 760px) 100vw, 1200px" priority style={{ width: "100%", height: "auto" }} />
            </div>
        </div>
    );
}

/** Before / after photo slider: drag, or use the arrow keys. One calm sweep the first time it is seen. */
export function BeforeAfter({ before, after, beforeAlt, afterAlt, width, height }: { before: string; after: string; beforeAlt: string; afterAlt: string; width: number; height: number }) {
    const box = useRef<HTMLDivElement>(null);
    const [x, setX] = useState(50);
    const touched = useRef(false);
    const drag = useRef(false);

    const fromEvent = (e: React.PointerEvent) => {
        const r = box.current!.getBoundingClientRect();
        setX(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100));
    };

    useEffect(() => {
        const el = box.current;
        if (!el || reduced()) return;
        let done = false;
        let raf = 0;
        const io = new IntersectionObserver(
            ([en]) => {
                if (!en.isIntersecting || done) return;
                done = true;
                const t0 = performance.now();
                const D = 2600;
                const step = (now: number) => {
                    if (touched.current) return;
                    const t = Math.min(1, (now - t0) / D);
                    const k = t < 0.5 ? easeInOut(t / 0.5) : 1 - easeInOut((t - 0.5) / 0.5);
                    setX(50 - 32 * k);
                    if (t < 1) raf = requestAnimationFrame(step);
                };
                raf = requestAnimationFrame(step);
            },
            { threshold: 0.6 },
        );
        io.observe(el);
        return () => {
            io.disconnect();
            cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <div
            ref={box}
            className="ba"
            tabIndex={0}
            role="slider"
            aria-label="Before and after photo"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(x)}
            style={{ ["--x" as string]: `${x}%` }}
            onPointerDown={(e) => {
                drag.current = true;
                touched.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                fromEvent(e);
            }}
            onPointerMove={(e) => drag.current && fromEvent(e)}
            onPointerUp={() => (drag.current = false)}
            onPointerCancel={() => (drag.current = false)}
            onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                    touched.current = true;
                    setX((v) => clamp(v - 5, 0, 100));
                    e.preventDefault();
                }
                if (e.key === "ArrowRight") {
                    touched.current = true;
                    setX((v) => clamp(v + 5, 0, 100));
                    e.preventDefault();
                }
            }}
        >
            <Image src={before} alt={beforeAlt} width={width} height={height} sizes="(max-width: 760px) 90vw, 33vw" />
            <Image src={after} alt={afterAlt} width={width} height={height} sizes="(max-width: 760px) 90vw, 33vw" className="ba-after" />
            <span className="ba-tag ba-tag--b">Before</span>
            <span className="ba-tag ba-tag--a">After</span>
            <span className="ba-line" />
            <span className="ba-knob">
                <ChevronsLeftRight size={20} strokeWidth={1.8} aria-hidden="true" />
            </span>
        </div>
    );
}

/** The search query types itself once, the first time it is fully in view. */
export function TypedQuery({ text }: { text: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [shown, setShown] = useState(text);
    useEffect(() => {
        const el = ref.current;
        if (!el || reduced()) return;
        let started = false;
        let t: ReturnType<typeof setTimeout>;
        const io = new IntersectionObserver(
            ([en]) => {
                if (!en.isIntersecting || started) return;
                started = true;
                setShown("");
                let i = 0;
                const tick = () => {
                    setShown(text.slice(0, ++i));
                    if (i < text.length) t = setTimeout(tick, 60 + Math.random() * 70);
                };
                t = setTimeout(tick, 400);
            },
            { threshold: 1 },
        );
        io.observe(el);
        return () => {
            io.disconnect();
            clearTimeout(t);
        };
    }, [text]);
    return (
        <span className="typed" id="serp-typed" ref={ref}>
            {shown}
        </span>
    );
}
