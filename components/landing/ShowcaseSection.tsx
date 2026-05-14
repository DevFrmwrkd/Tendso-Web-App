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
            className="w-full py-20 sm:py-24 px-4 sm:px-6 lg:px-10 relative z-10"
        >
            {/* Header */}
            <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-14 relative z-10 px-2">
                <p className="text-xs uppercase tracking-widest font-bold text-emerald-700 mb-3">
                    What creators have shipped
                </p>
                <h2
                    style={{ fontFamily: "var(--font-fraunces)" }}
                    className="text-4xl sm:text-5xl md:text-6xl font-semibold text-neutral-900 leading-[1.05] mb-5"
                >
                    Real sites. <span className="italic text-emerald-700">Real payouts.</span>
                </h2>
                <p className="text-base sm:text-lg text-neutral-700 leading-relaxed">
                    Every site below started with one creator walking into a local shop. Tap any preview to see the live result.
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
                <div className="relative rounded-[1.75rem] sm:rounded-[2.25rem] border border-neutral-200 bg-white p-2 sm:p-3 shadow-2xl shadow-emerald-900/10 overflow-hidden">
                    {/* Address bar */}
                    <div className="flex items-center gap-2 px-2 sm:px-4 py-2 sm:py-2.5 border-b border-neutral-100">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" aria-hidden />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" aria-hidden />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" aria-hidden />
                        <a
                            href={current.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${current.name} live site (opens in a new tab)`}
                            className="flex-1 mx-2 sm:mx-4 px-3 py-1 sm:py-1.5 rounded-full bg-neutral-50 text-[11px] sm:text-xs text-neutral-700 hover:text-neutral-900 truncate flex items-center gap-2 border border-neutral-200 hover:border-emerald-300 transition-colors min-h-[28px]"
                        >
                            <span className="text-emerald-500" aria-hidden>●</span>
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
                            <div className="opacity-0 group-hover/frame:opacity-100 translate-y-2 group-hover/frame:translate-y-0 transition-all duration-300 px-5 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2 bg-emerald-600 text-white shadow-lg">
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
                                        <p className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-emerald-300 mb-1">
                                            {current.category}
                                        </p>
                                        <h3
                                            style={{ fontFamily: "var(--font-fraunces)" }}
                                            className="text-xl sm:text-3xl md:text-4xl font-semibold text-white truncate"
                                        >
                                            {current.name}
                                        </h3>
                                    </div>
                                    <div className="hidden sm:flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-400/60 text-emerald-300 backdrop-blur-sm">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
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
                    className="hidden md:flex absolute top-1/2 -left-4 lg:-left-8 -translate-y-1/2 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-white border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50 hover:scale-105 shadow-lg transition-all items-center justify-center text-neutral-900 z-20"
                >
                    <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>
                <button
                    onClick={next}
                    aria-label="Next business"
                    className="hidden md:flex absolute top-1/2 -right-4 lg:-right-8 -translate-y-1/2 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-white border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50 hover:scale-105 shadow-lg transition-all items-center justify-center text-neutral-900 z-20"
                >
                    <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>

                {/* Mobile arrows + dots */}
                <div className="flex md:hidden items-center justify-between mt-5">
                    <button
                        onClick={prev}
                        aria-label="Previous business"
                        className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-900 shadow-sm"
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
                                    backgroundColor: i === active ? "#10b981" : "#d4d4d4",
                                }}
                            />
                        ))}
                    </div>
                    <button
                        onClick={next}
                        aria-label="Next business"
                        className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-900 shadow-sm"
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
                                backgroundColor: i === active ? "#10b981" : "#d4d4d4",
                            }}
                        />
                    ))}
                </div>

            </div>
        </section>
    );
}
