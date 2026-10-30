"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { CREATOR_PAGE_EDITOR_HREF, CREATOR_PORTAL_HREF, CREATOR_PORTAL_NAV } from "@/lib/v2/creatorPortalNavigation";

import { MiniFoot, SoloBar } from "./Chrome";
import { Face } from "./Face";
import styles from "./PortalFrame.module.css";

export type PortalIdentity = { name: string; photo?: string | null };

/** Presentation only. Each page keeps its existing account gate and data subscriptions. */
export function PortalFrame({ identity, currentPage = "home", sample = false, right, children }: {
    identity?: PortalIdentity;
    currentPage?: "home" | "my-page";
    sample?: boolean;
    right?: ReactNode;
    children: ReactNode;
}) {
    const editorHref = sample ? "#pt-links" : CREATOR_PAGE_EDITOR_HREF;
    const nav = useRef<HTMLElement>(null);
    const hasIdentity = !!identity;
    useEffect(() => {
        const navigation = nav.current;
        const selected = navigation?.querySelector<HTMLElement>('[aria-current="page"]');
        if (!navigation || !selected) return;
        // Reveal the current item on narrow screens without moving the page itself.
        const revealCurrent = () => {
            const visible = navigation.getBoundingClientRect();
            const current = selected.getBoundingClientRect();
            if (current.left < visible.left) navigation.scrollLeft += current.left - visible.left;
            else if (current.right > visible.right) navigation.scrollLeft += current.right - visible.right;
        };
        revealCurrent();
        const observer = new ResizeObserver(revealCurrent);
        observer.observe(navigation);
        observer.observe(selected);
        return () => observer.disconnect();
    }, [currentPage, hasIdentity]);

    return <div className={`pt-shell ${styles.shell}`}>
        <SoloBar right={identity ? (
            <Link className="pt-me" href={editorHref} aria-label="Edit your creator page">
                <Face src={identity.photo} name={identity.name} size={32} />
                <span>{identity.name}</span>
                <span className="pt-me-link">My page</span>
            </Link>
        ) : right}>
            {identity ? <nav ref={nav} className={`pt-nav ${styles.nav}`} aria-label="Creator portal">
                {CREATOR_PORTAL_NAV.map((item) => (
                    <Link
                        key={item.id}
                        href={item.anchor ? `${sample ? "" : CREATOR_PORTAL_HREF}#${item.anchor}` : editorHref}
                        className={item.id === currentPage ? "is-on" : undefined}
                        aria-current={item.id === currentPage ? "page" : undefined}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav> : null}
        </SoloBar>
        <main className="wrap pt-main" id="top">
            {children}
            <MiniFoot
                links={[
                    { label: "Creator rules", href: "/v2/creators#rules" },
                    { label: "Help", href: "/v2/help" },
                    { label: "Privacy", href: "/v2/privacy" },
                ]}
                note="Paid on real sales only. Your 5% is paid once the shop has paid in full."
            />
        </main>
    </div>;
}
