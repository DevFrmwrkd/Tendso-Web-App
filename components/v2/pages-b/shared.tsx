"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Footer, Nav, PhoneFrame, PhoneStatusBar, type PhoneSize } from "@/components/v2";

/*
 * Pieces shared by the /v2 help, start, pay, giveaway and otr pages.
 * Everything here lives in components/v2/pages-b so nothing in components/v2
 * itself is touched.
 */

/** Standard page frame: nav, main, footer. */
export function PbPage({
    children,
    nav,
    footer = true,
}: {
    children: ReactNode;
    nav?: { secondary?: ReactNode; primary?: ReactNode };
    footer?: boolean;
}) {
    return (
        <>
            <Nav secondaryAction={nav?.secondary} primaryAction={nav?.primary} />
            <main className="pb-pg" id="top">
                {children}
            </main>
            {footer && <Footer />}
        </>
    );
}

/** The wordmark link used by the funnel bars of /v2/start and /v2/pay. */
export function PbBrand() {
    return (
        <Link className="v2-brand" href="/v2" aria-label="Tendso home">
            <Image src="/v2/brand/mark-ink-256.png" alt="" width={26} height={26} priority />
            tendso
        </Link>
    );
}

/* ---- toast ---------------------------------------------------------------- */

/** A small pill that says what just happened. Returns the element to render and a `show` function. */
export function usePbToast(): { node: ReactNode; show: (message: string) => void } {
    const [message, setMessage] = useState("");
    const [on, setOn] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const show = useCallback((m: string) => {
        setMessage(m);
        setOn(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setOn(false), 2400);
    }, []);
    useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
    const node = (
        <div className={`pb-toast ${on ? "is-on" : ""}`} role="status" aria-live="polite">
            {message}
        </div>
    );
    return { node, show };
}

/** Copies text, then says so (or shows the text itself when the clipboard is blocked). */
export async function copyWithToast(text: string, done: string, show: (m: string) => void) {
    try {
        await navigator.clipboard.writeText(text);
        show(done);
    } catch {
        show(text);
    }
}

/* ---- arrows ---------------------------------------------------------------- */

export function ArrowRightIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
            <path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function PlusIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export function CloseIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
            <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

const LOCK = (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <rect x="2" y="5.2" width="8" height="5.8" rx="1.4" fill="currentColor" />
        <path d="M4 5.2V3.8a2 2 0 0 1 4 0v1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
);

/** Reads the browser's reduced-motion setting. */
function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);
    return reduced;
}

/**
 * A phone showing a captured mobile site, scrolling slowly by itself (the mock's
 * Sub.sitePhone with `auto`). The capture is a long 390-wide screenshot.
 */
export function SitePhone({
    src,
    url,
    alt,
    size = "md",
    className,
}: {
    src: string;
    url?: string;
    alt: string;
    size?: PhoneSize;
    className?: string;
}) {
    const host = useRef<HTMLDivElement>(null);
    const img = useRef<HTMLImageElement>(null);
    const [run, setRun] = useState(false);
    const reduced = usePrefersReducedMotion();

    const measure = useCallback(() => {
        const el = img.current;
        if (el) el.style.setProperty("--travel", `-${Math.max(0, el.offsetHeight - 790 + 60)}px`);
    }, []);

    useEffect(() => {
        const el = host.current;
        if (!el) return;
        const io = new IntersectionObserver(([entry]) => setRun(entry.isIntersecting), { threshold: 0.05 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (img.current?.complete) measure();
    }, [measure]);

    return (
        <div ref={host} className="pb-site-phone">
            <PhoneFrame size={size} className={`pb-is-site ${className ?? ""}`}>
                <PhoneStatusBar />
                <div className="pb-site-scroll">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img ref={img} src={src} alt={alt} draggable={false} onLoad={measure} className={run && !reduced ? "is-run" : undefined} />
                </div>
                {url && (
                    <div className="pb-url-pill">
                        {LOCK}
                        {url}
                    </div>
                )}
            </PhoneFrame>
        </div>
    );
}

/** A desktop browser frame around a long site capture that glides while it is on screen. */
export function SiteBrowser({ src, url, alt, className }: { src: string; url: string; alt: string; className?: string }) {
    const view = useRef<HTMLDivElement>(null);
    const img = useRef<HTMLImageElement>(null);
    const [run, setRun] = useState(false);
    const reduced = usePrefersReducedMotion();

    const measure = useCallback(() => {
        const i = img.current;
        const v = view.current;
        if (i && v) i.style.setProperty("--travel", `-${Math.max(0, i.offsetHeight - v.offsetHeight)}px`);
    }, []);

    useEffect(() => {
        const v = view.current;
        if (!v) return;
        const io = new IntersectionObserver(([entry]) => setRun(entry.isIntersecting), { threshold: 0.05 });
        io.observe(v);
        window.addEventListener("resize", measure);
        if (img.current?.complete) measure();
        return () => {
            io.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [measure]);

    return (
        <div className={`pb-browser ${className ?? ""}`}>
            <div className="pb-browser-bar" aria-hidden="true">
                <div className="pb-browser-dots">
                    <i />
                    <i />
                    <i />
                </div>
                <div className="pb-browser-url">
                    {LOCK}
                    {url}
                </div>
                <div className="pb-browser-dots" style={{ visibility: "hidden" }}>
                    <i />
                    <i />
                    <i />
                </div>
            </div>
            <div ref={view} className="pb-browser-view">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={img} src={src} alt={alt} onLoad={measure} className={run && !reduced ? "is-run" : undefined} />
            </div>
        </div>
    );
}
