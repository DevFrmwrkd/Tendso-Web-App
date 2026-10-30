"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { Chip } from "@/components/v2";

import { CRAFTS, SHOWCASE_SITES, type ShowcaseSite } from "./data";

const A = "/v2/pages-a/showcase";

function Card({ s, priority }: { s: ShowcaseSite; priority?: boolean }) {
    return (
        <a
            className="card"
            href={`/v2/examples/${s.id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${s.name}, ${s.kind}, ${s.city}. Opens in a new tab`}
        >
            <div className={`card-img card-img--${s.shape}`}>
                {s.shape === "m" ? (
                    <Image src={`${A}/${s.id}-m-long.jpg`} alt="" width={780} height={5200} sizes="(max-width: 760px) 60vw, 20vw" priority={priority} />
                ) : (
                    <Image src={`${A}/${s.id}-d.jpg`} alt="" fill sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 33vw" priority={priority} />
                )}
                <span className="card-view">
                    Open <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
                </span>
            </div>
            <div className="card-meta">
                <b>{s.name}</b>
                <span>{s.city}</span>
            </div>
            <span className="card-kind">{s.kind}</span>
        </a>
    );
}

/** Craft filter chips + the masonry of the 22 showcase sites. Each card opens the site in a new tab. */
export function ExamplesGrid() {
    const [craft, setCraft] = useState<string>("All");
    const [swapping, setSwapping] = useState(false);
    const filters = useRef<HTMLDivElement>(null);
    const list = craft === "All" ? SHOWCASE_SITES : SHOWCASE_SITES.filter((s) => s.craft === craft);

    function pick(next: string) {
        if (next === craft) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
            setCraft(next);
            return;
        }
        setSwapping(true);
        setTimeout(() => {
            setCraft(next);
            const top = filters.current?.getBoundingClientRect().top ?? 0;
            if (top < 0 || top > window.innerHeight * 0.5) window.scrollTo({ top: window.scrollY + top - 60, behavior: "smooth" });
            requestAnimationFrame(() => requestAnimationFrame(() => setSwapping(false)));
        }, 210);
    }

    return (
        <>
            <div className="filters" ref={filters}>
                <div className="v2-wrap">
                    <div className="filters-in" role="toolbar" aria-label="Filter by kind of business">
                        <Chip pressed={craft === "All"} count={SHOWCASE_SITES.length} onClick={() => pick("All")}>
                            All
                        </Chip>
                        {CRAFTS.map((c) => (
                            <Chip key={c} pressed={craft === c} count={SHOWCASE_SITES.filter((s) => s.craft === c).length} onClick={() => pick(c)}>
                                {c}
                            </Chip>
                        ))}
                    </div>
                </div>
            </div>
            <section className="v2-wrap">
                <div className={`masonry${swapping ? " is-swapping" : ""}`} aria-live="polite">
                    {list.map((s, i) => (
                        <Card key={s.id} s={s} priority={craft === "All" && i < 3} />
                    ))}
                </div>
            </section>
        </>
    );
}
