"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, ArrowUpRightIcon } from "./landingPrimitives";

/**
 * The persistent "pick a door" CTA that appears once you've scrolled past the hero.
 *
 * Design note: this is a quiet, auto-width pill rather than a full-bleed bar. The
 * two doors carry equal weight — colour identifies each one with a dot instead of
 * filling the whole button, so neither shouts over the page content behind it.
 * When `door` is set, that side reads as the current context via a soft tint.
 */
export default function StickyCTA({ door = null }: { door?: "business" | "creator" | null }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 640);
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className={`sticky-cta ${visible ? "visible" : ""}`}>
            <nav className="sticky-cta-pill" aria-label="Choose your path">
                <span className="sticky-cta-brand">
                    <Logo />
                </span>

                <span className="sticky-cta-div" aria-hidden="true" />

                <Link
                    href="/for-business"
                    className={`sticky-cta-seg is-business${door === "business" ? " is-current" : ""}`}
                    tabIndex={visible ? 0 : -1}
                    aria-current={door === "business" ? "page" : undefined}
                >
                    <span className="sticky-cta-dot" aria-hidden="true" />
                    <span className="sticky-cta-full">I own a business</span>
                    <span className="sticky-cta-short">Business</span>
                    <span className="sticky-cta-arrow" aria-hidden="true">
                        <ArrowUpRightIcon />
                    </span>
                </Link>

                <span className="sticky-cta-div" aria-hidden="true" />

                <Link
                    href="/for-creators"
                    className={`sticky-cta-seg is-creator${door === "creator" ? " is-current" : ""}`}
                    tabIndex={visible ? 0 : -1}
                    aria-current={door === "creator" ? "page" : undefined}
                >
                    <span className="sticky-cta-dot" aria-hidden="true" />
                    <span className="sticky-cta-full">I want to earn</span>
                    <span className="sticky-cta-short">Earn</span>
                    <span className="sticky-cta-arrow" aria-hidden="true">
                        <ArrowUpRightIcon />
                    </span>
                </Link>
            </nav>
        </div>
    );
}
