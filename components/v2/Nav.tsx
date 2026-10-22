"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { cx } from "./cx";
import { V2_NAV_LINKS, type V2Link } from "./links";

/**
 * Fixed top nav. 84px tall, tightening to 60px with a blurred canvas once the page
 * has scrolled 30px. Under 900px the links collapse into a full-screen menu and the
 * secondary action is dropped, as in the mock. Pass the real actions in; the nav
 * itself has no opinion about where they go.
 */
export function Nav({
    links = V2_NAV_LINKS,
    secondaryAction,
    primaryAction,
    homeHref = "/",
}: {
    links?: readonly V2Link[];
    /** Outline button, hidden under 900px. */
    secondaryAction?: ReactNode;
    /** The one accent action. */
    primaryAction?: ReactNode;
    homeHref?: string;
}) {
    const [tight, setTight] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setTight(window.scrollY > 30);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <header className={cx("v2-nav", tight && "is-tight", open && "is-open")}>
            <div className="v2-wrap v2-nav-in">
                <Link className="v2-brand" href={homeHref} aria-label="Tendso home">
                    <Image src="/v2/brand/mark-ink-256.png" alt="" width={26} height={26} priority />
                    tendso
                </Link>
                <nav id="v2-nav-links" className="v2-nav-links" aria-label="Main" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
                    {links.map((l) => (
                        <Link key={l.href} href={l.href}>
                            {l.label}
                        </Link>
                    ))}
                </nav>
                <div className="v2-nav-cta">
                    {secondaryAction && <span className="v2-nav-secondary">{secondaryAction}</span>}
                    {primaryAction}
                    <button
                        type="button"
                        className="v2-nav-menu"
                        aria-label={open ? "Close menu" : "Menu"}
                        aria-expanded={open}
                        aria-controls="v2-nav-links"
                        onClick={() => setOpen((o) => !o)}
                    >
                        {open ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
                    </button>
                </div>
            </div>
        </header>
    );
}
