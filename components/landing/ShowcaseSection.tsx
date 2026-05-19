"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

type Showcase = {
    slug: string;
    name: string;
    category: string;
    src: string;
    url: string;
};

const showcase: Showcase[] = [
    {
        slug: "ben-joe",
        name: "Ben Joe Tire Supply",
        category: "Auto · Tire Supply",
        src: "/Pages/ben-joe.png",
        url: "https://benjoetiresupply.com/",
    },
    {
        slug: "aloja",
        name: "Aloja Carvajal",
        category: "Beauty Studio",
        src: "/Pages/aloja2.png",
        url: "https://aloja-carvajal-aesthetic-and-beauty-studio.frmwrkd-media.workers.dev/",
    },
    {
        slug: "hapag",
        name: "Hapag",
        category: "Restaurant",
        src: "/Pages/hapag.png",
        url: "https://hapag.pages.dev/",
    },
    {
        slug: "beauty-me",
        name: "Beauty Me",
        category: "Salon · Massage · Spa",
        src: "/Pages/beauty-me.png",
        url: "https://beauty-me-salon-massage-spa.frmwrkd-media.workers.dev/",
    },
];

function displayUrl(url: string): string {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const AUTOPLAY_INTERVAL_MS = 6000;

export default function ShowcaseSection() {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const reduceMotion = useReducedMotion();

    const goTo = useCallback((idx: number) => {
        const nextIdx = ((idx % showcase.length) + showcase.length) % showcase.length;
        setActive(nextIdx);
    }, []);

    const next = useCallback(() => goTo(active + 1), [active, goTo]);
    const prev = useCallback(() => goTo(active - 1), [active, goTo]);

    useEffect(() => {
        if (paused || reduceMotion) return;
        const t = setInterval(() => {
            setActive((p) => (p + 1) % showcase.length);
        }, AUTOPLAY_INTERVAL_MS);
        return () => clearInterval(t);
    }, [paused, reduceMotion]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") next();
            else if (e.key === "ArrowLeft") prev();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [next, prev]);

    const current = showcase[active];

    return (
        <section
            id="showcase"
            className="w-full py-24 sm:py-32 px-4 sm:px-6 lg:px-10 relative z-10"
            style={{ background: "var(--khaki)" }}
        >
            {/* Header */}
            <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16 relative z-10 px-2">
                <div className="flex items-center gap-3 justify-center mb-8">
                    <span className="h-px w-10 sm:w-16 bg-[var(--rust)]/40" />
                    <p
                        className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-medium text-[var(--rust)]"
                        style={{ fontFamily: "var(--font-mono)" }}
                    >
                        § 03 — REAL WORK
                    </p>
                    <span className="h-px w-10 sm:w-16 bg-[var(--rust)]/40" />
                </div>
                <h2
                    style={{
                        fontFamily: "var(--font-playfair)",
                        fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
                    }}
                    className="font-bold text-[var(--ink)] leading-[0.95] tracking-[-0.01em] mb-6"
                >
                    Live work. <span className="italic" style={{ color: "var(--rust)" }}>No mockups.</span>
                </h2>
                <p
                    className="italic text-[var(--ink)]/60"
                    style={{
                        fontFamily: "var(--font-playfair)",
                        fontSize: "clamp(1.05rem, 1.5vw, 1.3rem)",
                    }}
                >
                    Local shops already running on Negosyo Digital. Tap any preview to visit the live site.
                </p>
            </div>

            <div
                className="relative w-full max-w-[1600px] mx-auto"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                aria-roledescription="carousel"
                aria-label="Live websites we've built for local businesses"
            >
                {/* Browser-chrome frame */}
                <div className="relative rounded-[1.75rem] sm:rounded-[2.25rem] border border-[var(--ink)]/15 bg-[var(--khaki-deep)] p-2 sm:p-3 shadow-2xl shadow-[var(--ink)]/15 overflow-hidden">
                    {/* Address bar */}
                    <div className="flex items-center gap-2 px-2 sm:px-4 py-2 sm:py-2.5 border-b border-[var(--ink)]/10">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" aria-hidden />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" aria-hidden />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" aria-hidden />
                        <a
                            href={current.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${current.name} live site (opens in a new tab)`}
                            className="flex-1 mx-2 sm:mx-4 px-3 py-1 sm:py-1.5 rounded-full bg-[var(--khaki)] text-[11px] sm:text-xs text-[var(--ink)]/70 hover:text-[var(--ink)] truncate flex items-center gap-2 border border-[var(--ink)]/15 hover:border-[var(--rust)]/50 transition-colors min-h-[28px]"
                        >
                            <span className="text-[var(--rust)]" aria-hidden>●</span>
                            <span className="truncate">{displayUrl(current.url)}</span>
                            <ExternalLink className="w-3 h-3 ml-auto opacity-60 shrink-0" aria-hidden />
                        </a>
                    </div>

                    {/* Image area */}
                    <a
                        href={current.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${current.name} live site (opens in a new tab)`}
                        className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden rounded-[1.25rem] sm:rounded-[1.5rem] bg-neutral-100 block group/frame cursor-pointer"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={current.slug}
                                initial={reduceMotion ? {} : { opacity: 0, scale: 1.02 }}
                                animate={reduceMotion ? {} : { opacity: 1, scale: 1 }}
                                exit={reduceMotion ? {} : { opacity: 0, scale: 0.99 }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute inset-0"
                            >
                                <Image
                                    src={current.src}
                                    alt={`${current.name} — ${current.category}`}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 1024px"
                                    className="object-cover object-top"
                                    priority={active === 0}
                                />
                            </motion.div>
                        </AnimatePresence>

                        {/* Hover overlay (desktop only) */}
                        <div className="hidden md:flex absolute inset-0 items-center justify-center bg-black/0 group-hover/frame:bg-black/30 transition-colors duration-300 pointer-events-none z-10">
                            <div className="opacity-0 group-hover/frame:opacity-100 translate-y-2 group-hover/frame:translate-y-0 transition-all duration-300 px-5 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2 bg-[var(--rust)] text-[var(--khaki)] shadow-lg">
                                Visit site <ExternalLink className="w-4 h-4" />
                            </div>
                        </div>

                        {/* Caption overlay */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`caption-${current.slug}`}
                                initial={reduceMotion ? {} : { opacity: 0, y: 16 }}
                                animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                                exit={reduceMotion ? {} : { opacity: 0, y: -8 }}
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className="absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/55 to-transparent"
                            >
                                <div className="flex items-end justify-between gap-3">
                                    <div className="min-w-0">
                                        <p
                                            className="text-[10px] sm:text-xs uppercase tracking-[0.35em] font-medium text-[var(--rust-soft)] mb-1"
                                            style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                            {current.category}
                                        </p>
                                        <h3
                                            style={{ fontFamily: "var(--font-playfair)" }}
                                            className="text-xl sm:text-3xl md:text-4xl font-bold text-white truncate"
                                        >
                                            {current.name}
                                        </h3>
                                    </div>
                                    <div className="hidden sm:flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[var(--rust-soft)]/60 text-[var(--rust-soft)] backdrop-blur-sm">
                                        <span className="w-2 h-2 rounded-full bg-[var(--rust-soft)] animate-pulse" aria-hidden />
                                        Live
                                        <ExternalLink className="w-3 h-3" aria-hidden />
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </a>
                </div>

                {/* Arrow controls (desktop) */}
                <button
                    onClick={prev}
                    aria-label="Previous business"
                    className="hidden md:flex absolute top-1/2 -left-4 lg:-left-8 -translate-y-1/2 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[var(--khaki)] border border-[var(--ink)]/15 hover:border-[var(--rust)] hover:bg-[var(--khaki-deep)] hover:scale-105 shadow-lg transition-all items-center justify-center text-[var(--ink)] z-20"
                >
                    <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>
                <button
                    onClick={next}
                    aria-label="Next business"
                    className="hidden md:flex absolute top-1/2 -right-4 lg:-right-8 -translate-y-1/2 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[var(--khaki)] border border-[var(--ink)]/15 hover:border-[var(--rust)] hover:bg-[var(--khaki-deep)] hover:scale-105 shadow-lg transition-all items-center justify-center text-[var(--ink)] z-20"
                >
                    <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>

                {/* Mobile arrows + dots */}
                <div className="flex md:hidden items-center justify-between mt-5">
                    <button
                        onClick={prev}
                        aria-label="Previous business"
                        className="w-11 h-11 rounded-full bg-[var(--khaki)] border border-[var(--ink)]/15 flex items-center justify-center text-[var(--ink)] shadow-sm"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex gap-2">
                        {showcase.map((s, i) => (
                            <button
                                key={s.slug}
                                onClick={() => goTo(i)}
                                aria-label={`Go to ${s.name}`}
                                aria-current={i === active}
                                className="h-2 rounded-full transition-all"
                                style={{
                                    width: i === active ? 32 : 8,
                                    backgroundColor: i === active ? "var(--rust)" : "rgba(15,14,20,0.2)",
                                }}
                            />
                        ))}
                    </div>
                    <button
                        onClick={next}
                        aria-label="Next business"
                        className="w-11 h-11 rounded-full bg-[var(--khaki)] border border-[var(--ink)]/15 flex items-center justify-center text-[var(--ink)] shadow-sm"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Desktop dots */}
                <div className="hidden md:flex justify-center gap-3 mt-6">
                    {showcase.map((s, i) => (
                        <button
                            key={s.slug}
                            onClick={() => goTo(i)}
                            aria-label={`Go to ${s.name}`}
                            aria-current={i === active}
                            className="h-2 rounded-full transition-all"
                            style={{
                                width: i === active ? 48 : 12,
                                backgroundColor: i === active ? "var(--rust)" : "rgba(15,14,20,0.2)",
                            }}
                        />
                    ))}
                </div>

            </div>
        </section>
    );
}
