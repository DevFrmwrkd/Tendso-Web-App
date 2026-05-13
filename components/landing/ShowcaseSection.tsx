"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Bricolage_Grotesque } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["400", "600", "800"] });

const showcase = [
    {
        slug: "hapag",
        name: "Hapag",
        category: "Restaurant · Filipino Cuisine",
        src: "/Pages/hapag.png",
        url: "https://hapag.pages.dev/",
    },
    {
        slug: "aloja",
        name: "Aloja Carvajal",
        category: "Aesthetic & Beauty Studio",
        src: "/Pages/aloja.png",
        url: "https://aloja-carvajal-aesthetic-and-beauty-studio.pages.dev/",
    },
    {
        slug: "beauty-me",
        name: "Beauty Me",
        category: "Salon · Massage · Spa",
        src: "/Pages/beauty-me.png",
        url: "https://beauty-me-salon-massage-spa.frmwrkd-media.workers.dev/",
    },
    {
        slug: "ben-joe",
        name: "Ben Joe Tire Supply",
        category: "Auto · Tire Supply",
        src: "/Pages/ben-joe.png",
        url: "https://benjoetiresupply.com/",
    },
];

function displayUrl(url: string): string {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const AUTOPLAY_INTERVAL_MS = 5000;

export default function ShowcaseSection() {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);

    const goTo = useCallback((idx: number) => {
        const next = ((idx % showcase.length) + showcase.length) % showcase.length;
        setActive(next);
    }, []);

    const next = useCallback(() => goTo(active + 1), [active, goTo]);
    const prev = useCallback(() => goTo(active - 1), [active, goTo]);

    useEffect(() => {
        if (paused) return;
        const t = setInterval(() => {
            setActive((prev) => (prev + 1) % showcase.length);
        }, AUTOPLAY_INTERVAL_MS);
        return () => clearInterval(t);
    }, [paused]);

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
            className="w-full py-24 md:py-32 px-6 max-w-7xl mx-auto relative z-10 border-t border-neutral-100"
        >
            {/* Ambient backdrop */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-100 filter blur-[180px] opacity-50 pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-12 md:mb-16 relative z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-emerald-200 bg-emerald-50 mb-8"
                >
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span
                        className={`text-emerald-700 text-sm uppercase tracking-widest font-black ${bricolage.className}`}
                    >
                        Real Sites · Live Now
                    </span>
                </motion.div>

                <motion.h2
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className={`text-5xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] text-neutral-900 ${bricolage.className}`}
                >
                    Live work.{" "}
                    <span className="text-emerald-600">
                        No mockups.
                    </span>
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="text-neutral-700 text-lg md:text-2xl mt-6 max-w-2xl mx-auto font-light"
                >
                    Real Filipino MSMEs we&apos;ve already digitized.
                </motion.p>
            </div>

            {/* Carousel */}
            <div
                className="relative max-w-5xl mx-auto"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                aria-roledescription="carousel"
                aria-label="Showcase of websites we've built"
            >
                {/* Browser-chrome frame */}
                <div className="relative rounded-[2rem] md:rounded-[2.5rem] border border-neutral-200 bg-white p-2 md:p-3 shadow-2xl shadow-emerald-500/10 overflow-hidden">
                    {/* Address bar */}
                    <div className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border-b border-neutral-100">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#FF5F57]" />
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#FFBD2E]" />
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#28C840]" />
                        <a
                            href={current.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${current.name} live site (opens in a new tab)`}
                            className="flex-1 mx-2 md:mx-4 px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-neutral-50 text-[10px] md:text-xs text-neutral-600 hover:text-neutral-900 truncate flex items-center gap-2 border border-neutral-200 hover:border-emerald-300 transition-colors"
                        >
                            <span className="text-emerald-500">●</span>
                            <span className="truncate">{displayUrl(current.url)}</span>
                            <ExternalLink className="w-3 h-3 ml-auto opacity-60 shrink-0" />
                        </a>
                    </div>

                    {/* Image area */}
                    <a
                        href={current.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${current.name} live site (opens in a new tab)`}
                        className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden rounded-[1.25rem] md:rounded-[1.75rem] bg-neutral-100 block group/frame cursor-pointer"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={current.slug}
                                initial={{ opacity: 0, scale: 1.04 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute inset-0"
                            >
                                <Image
                                    src={current.src}
                                    alt={`${current.name} — ${current.category}`}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 1024px"
                                    className="object-cover object-top transition-transform duration-700 group-hover/frame:scale-[1.02]"
                                    priority={active === 0}
                                />
                            </motion.div>
                        </AnimatePresence>

                        {/* Hover overlay (desktop) */}
                        <div className="hidden md:flex absolute inset-0 items-center justify-center bg-black/0 group-hover/frame:bg-black/30 transition-colors duration-300 pointer-events-none z-10">
                            <div className="opacity-0 group-hover/frame:opacity-100 translate-y-2 group-hover/frame:translate-y-0 transition-all duration-300 px-6 py-3 rounded-full font-black uppercase tracking-widest text-sm flex items-center gap-2 bg-emerald-500 text-white shadow-lg">
                                Visit Site <ExternalLink className="w-4 h-4" />
                            </div>
                        </div>

                        {/* Caption overlay */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`caption-${current.slug}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className="absolute bottom-0 inset-x-0 p-4 md:p-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent"
                            >
                                <div className="flex items-end justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-[10px] md:text-xs uppercase tracking-widest font-black mb-1 text-emerald-300">
                                            {current.category}
                                        </p>
                                        <h3
                                            className={`text-2xl md:text-5xl font-black uppercase tracking-tighter text-white truncate ${bricolage.className}`}
                                        >
                                            {current.name}
                                        </h3>
                                    </div>
                                    <div className="hidden sm:flex shrink-0 items-center gap-2 px-3 md:px-4 py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border border-emerald-400/60 text-emerald-300 backdrop-blur-md">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        Live
                                        <ExternalLink className="w-3 h-3" />
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </a>
                </div>

                {/* Arrow controls (desktop) */}
                <button
                    onClick={prev}
                    aria-label="Previous showcase"
                    className="hidden md:flex absolute top-1/2 -left-4 lg:-left-8 -translate-y-1/2 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-white border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50 hover:scale-110 shadow-lg transition-all items-center justify-center text-neutral-900 z-20"
                >
                    <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>
                <button
                    onClick={next}
                    aria-label="Next showcase"
                    className="hidden md:flex absolute top-1/2 -right-4 lg:-right-8 -translate-y-1/2 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-white border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50 hover:scale-110 shadow-lg transition-all items-center justify-center text-neutral-900 z-20"
                >
                    <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>

                {/* Mobile arrows + dots row */}
                <div className="flex md:hidden items-center justify-between mt-6">
                    <button
                        onClick={prev}
                        aria-label="Previous showcase"
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
                                className="h-2 rounded-full transition-all"
                                style={{
                                    width: i === active ? 32 : 8,
                                    backgroundColor: i === active ? "#10b981" : "#e5e5e5",
                                }}
                            />
                        ))}
                    </div>
                    <button
                        onClick={next}
                        aria-label="Next showcase"
                        className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-900 shadow-sm"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Desktop dots */}
                <div className="hidden md:flex justify-center gap-3 mt-8">
                    {showcase.map((s, i) => (
                        <button
                            key={s.slug}
                            onClick={() => goTo(i)}
                            aria-label={`Go to ${s.name}`}
                            className="h-2 rounded-full transition-all"
                            style={{
                                width: i === active ? 48 : 12,
                                backgroundColor: i === active ? "#10b981" : "#e5e5e5",
                            }}
                        />
                    ))}
                </div>

                {/* Thumbnail strip */}
                <div className="hidden lg:grid grid-cols-4 gap-4 mt-12">
                    {showcase.map((s, i) => (
                        <button
                            key={s.slug}
                            onClick={() => goTo(i)}
                            aria-label={`Open ${s.name} preview`}
                            className={`group relative aspect-video overflow-hidden rounded-xl border transition-all ${
                                i === active
                                    ? "scale-100 opacity-100 border-emerald-400 shadow-md shadow-emerald-500/20"
                                    : "scale-95 opacity-60 hover:opacity-100 hover:scale-100 border-neutral-200"
                            }`}
                        >
                            <Image
                                src={s.src}
                                alt={s.name}
                                fill
                                sizes="200px"
                                className="object-cover object-top"
                            />
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                                <p
                                    className={`text-xs font-black uppercase tracking-wide truncate ${
                                        i === active ? "text-emerald-300" : "text-white"
                                    } ${bricolage.className}`}
                                >
                                    {s.name}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}
