"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { OPERATOR, SUPPORT_EMAIL } from "@/lib/contact";

import type { LegalSection } from "./legal-content";

export type DocKey = "privacy" | "terms";
export interface LegalDocData {
    title: string;
    intro: string;
    updated?: string;
    ask: string;
    sections: LegalSection[];
}

const LABEL: Record<DocKey, string> = { privacy: "Privacy policy", terms: "Terms of service" };
const two = (n: number) => String(n).padStart(2, "0");

/**
 * Privacy policy and Terms of service on one calm reading layout: a switch, a big
 * title, a sticky "On this page" rail and numbered sections. THE WORDS are passed in
 * from legal-content.tsx and are not touched here. `/v2/privacy` and `/v2/terms`
 * start on their own document; `/v2/legal` starts on the one in the hash.
 */
export function LegalDoc({ docs, initial, mode }: { docs: Record<DocKey, LegalDocData>; initial: DocKey; mode: "path" | "hash" }) {
    const [doc, setDoc] = useState<DocKey>(initial);
    const [swap, setSwap] = useState(false);
    const [active, setActive] = useState("");
    const seg = useRef<HTMLDivElement>(null);
    const thumb = useRef<HTMLSpanElement>(null);
    const toc = useRef<HTMLDetailsElement>(null);
    const phone = () => window.matchMedia("(max-width: 900px)").matches;
    const D = docs[doc];

    // /v2/legal#terms (or #terms-<section>) opens that document
    useEffect(() => {
        if (mode !== "hash") return;
        const h = window.location.hash.slice(1);
        if (h.startsWith("terms")) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- the hash only exists in the browser
            setDoc("terms");
            if (h.length > 5) requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView());
        }
    }, [mode]);

    const moveThumb = useCallback(() => {
        const on = seg.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
        const th = thumb.current;
        if (!on || !th) return;
        th.style.width = `${on.offsetWidth}px`;
        th.style.transform = `translateX(${on.offsetLeft - 4}px)`;
    }, []);
    useLayoutEffect(() => {
        moveThumb();
        window.addEventListener("resize", moveThumb);
        document.fonts?.ready.then(moveThumb);
        return () => window.removeEventListener("resize", moveThumb);
    }, [doc, moveThumb]);

    function choose(next: DocKey) {
        if (next === doc) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const go = () => {
            setDoc(next);
            window.scrollTo({ top: 0 });
            try {
                window.history.replaceState(null, "", mode === "path" ? `/v2/${next}` : `#${next}`);
            } catch {}
        };
        if (reduced) return go();
        setSwap(true);
        setTimeout(() => {
            go();
            requestAnimationFrame(() => requestAnimationFrame(() => setSwap(false)));
        }, 240);
    }

    // on a phone the contents fold starts closed, and closes after a jump
    useEffect(() => {
        if (phone() && toc.current) toc.current.open = false;
    }, []);

    // "On this page": the section at the top third of the screen is the current one
    useEffect(() => {
        const secs = Array.from(document.querySelectorAll<HTMLElement>(".lg-sec"));
        const onScroll = () => {
            const line = window.innerHeight * 0.32;
            let cur = "";
            for (const s of secs) if (s.getBoundingClientRect().top <= line) cur = s.id;
            setActive(cur);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [doc]);

    const sid = (s: LegalSection) => `${doc}-${s.id}`;

    return (
        <div className="sp lg">
            <div className="pg">
                <section className="v2-wrap lg-head" aria-labelledby="lg-h">
                    <div className="lg-switch" data-reveal="hero">
                        <div className="seg" ref={seg} role="group" aria-label="Document">
                            <span className="seg-thumb" ref={thumb} aria-hidden="true" />
                            {(Object.keys(LABEL) as DocKey[]).map((k) => (
                                <button key={k} type="button" aria-pressed={doc === k} onClick={() => choose(k)}>
                                    {LABEL[k]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={`lg-title${swap ? " is-swap" : ""}`}>
                        <h1 className="lg-h" id="lg-h">
                            {D.title}.
                        </h1>
                        <div className="lg-side">
                            <p className="lg-intro">{D.intro}</p>
                            {D.updated && <p className="lg-meta">Last updated {D.updated}</p>}
                        </div>
                    </div>
                </section>

                <section className="v2-wrap lg-doc">
                    <aside className="lg-rail" aria-label="On this page">
                        <details className="lg-toc" ref={toc} open>
                            <summary>
                                <span>On this page</span>
                                <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
                            </summary>
                            <ol onClick={(e) => (e.target as HTMLElement).closest("a") && phone() && toc.current && (toc.current.open = false)}>
                                {D.sections.map((s, i) => (
                                    <li key={s.id}>
                                        <a href={`#${sid(s)}`} className={active === sid(s) ? "is-on" : undefined}>
                                            <span>{two(i + 1)}</span>
                                            {s.title}
                                        </a>
                                    </li>
                                ))}
                            </ol>
                        </details>
                        <div className="lg-ask">
                            <p>{D.ask}</p>
                            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                            <Link className="lg-help" href="/knowledge">
                                Short answers in Help
                            </Link>
                        </div>
                    </aside>
                    <div className={`lg-body${swap ? " is-swap" : ""}`}>
                        {D.sections.map((s, i) => (
                            <section className="lg-sec" id={sid(s)} key={sid(s)} aria-labelledby={`${sid(s)}-h`}>
                                <span className="lg-n">{two(i + 1)}</span>
                                <div className="lg-sec-in">
                                    <h2 className="lg-sec-h" id={`${sid(s)}-h`}>
                                        {s.title}
                                    </h2>
                                    <div className="lg-prose">{s.body}</div>
                                </div>
                            </section>
                        ))}
                        <p className="lg-foot">Tendso is operated by {OPERATOR}, Philippines.</p>
                    </div>
                </section>
            </div>
        </div>
    );
}
