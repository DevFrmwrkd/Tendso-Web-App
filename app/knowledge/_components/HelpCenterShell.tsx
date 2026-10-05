"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PublicFooter, PublicHeader, PublicPage, type FooterLink } from "@/components/r1";

import { Boundary } from "./Boundary";
import { CommandPalette } from "./CommandPalette";
import { FallbackActions, SignedInActions } from "./HeaderActions";
import { markNavigated } from "./nav";

/*
 * The Help Center's frame: the public header (Help current), the simple
 * footer, and the ⌘K palette. It is the layout of /knowledge and
 * /knowledge/[slug], so it stays mounted while a reader moves between the
 * Help Center and an article: the palette keeps its data and the header
 * does not flash.
 *
 * Nothing here reads the URL's query: the article route is statically
 * generated, and a layout that did would stop it being prerendered.
 */

const FOOT_LINKS: FooterLink[] = [
    { href: "/privacy-policy", label: "Privacy" },
    { href: "/terms-of-service", label: "Terms" },
];

type PaletteApi = { openPalette: (seed?: string) => void };

const PaletteContext = createContext<PaletteApi | null>(null);

/** Open the search palette, optionally with a question already typed. */
export function useHelpPalette(): PaletteApi {
    const ctx = useContext(PaletteContext);
    if (!ctx) throw new Error("useHelpPalette must be used inside the Help Center layout");
    return ctx;
}

function isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function HelpCenterShell({ children }: { children: ReactNode }) {
    const { isLoaded, isSignedIn } = useAuth();
    const pathname = usePathname();
    // `session` counts openings: each one starts the palette fresh, and 0 means
    // it was never opened, so it has not loaded anything yet. `path` closes it
    // when the reader leaves the page it was opened on (browser Back).
    const [palette, setPalette] = useState({ open: false, seed: "", session: 0, path: pathname });
    const open = palette.open && palette.path === pathname;

    const openPalette = useCallback(
        (seed = "") => setPalette((p) => ({ open: true, seed, session: p.session + 1, path: window.location.pathname })),
        [],
    );
    const closePalette = useCallback(() => setPalette((p) => (p.open ? { ...p, open: false } : p)), []);

    // ⌘K / Ctrl+K toggles the palette anywhere in the Help Center; "/" opens it
    // when the reader is not typing somewhere.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPalette((p) =>
                    p.open && p.path === window.location.pathname
                        ? { ...p, open: false }
                        : { open: true, seed: "", session: p.session + 1, path: window.location.pathname },
                );
            } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
                e.preventDefault();
                setPalette((p) => (p.open ? p : { open: true, seed: "", session: p.session + 1, path: window.location.pathname }));
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Remember that the reader has moved around inside the Help Center, so
    // the breadcrumb's Back can walk back instead of going up a level.
    const entryPath = useRef(pathname);
    useEffect(() => {
        if (pathname !== entryPath.current) markNavigated();
    }, [pathname]);
    useEffect(() => {
        window.addEventListener("popstate", markNavigated);
        return () => window.removeEventListener("popstate", markNavigated);
    }, []);

    const api = useMemo(() => ({ openPalette }), [openPalette]);

    // Signed out (or Clerk still loading): the header's own Sign in / Get a
    // website. Signed in: Back to my home and the person, the board's creator
    // variant. A failed profile lookup still leaves a way home.
    const actions =
        isLoaded && isSignedIn ? (
            <Boundary fallback={<FallbackActions />}>
                <SignedInActions />
            </Boundary>
        ) : undefined;

    return (
        <PaletteContext.Provider value={api}>
            <PublicPage
                header={<PublicHeader current="help" actions={actions} />}
                footer={<PublicFooter links={FOOT_LINKS} />}
                mainClassName="mx-auto w-full max-w-[1104px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-12"
            >
                {children}
            </PublicPage>
            <Boundary fallback={null}>
                <CommandPalette open={open} seed={palette.seed} session={palette.session} onClose={closePalette} />
            </Boundary>
        </PaletteContext.Provider>
    );
}
