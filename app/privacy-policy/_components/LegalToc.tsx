"use client";

import { useEffect, useState } from "react";

import { cx } from "@/components/r1";

/**
 * "On this page": the numbered sections of a legal document. The one being
 * read carries aria-current="location", following the scroll, so the list
 * doubles as a "you are here" for a reader deep in a long page.
 */
export function LegalToc({ items }: { items: { id: string; title: string }[] }) {
    const [active, setActive] = useState<string | null>(null);
    // A string, so a fresh array with the same sections does not re-observe.
    const key = items.map((it) => it.id).join(" ");

    useEffect(() => {
        const ids = key.split(" ");
        const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
        if (!sections.length || typeof IntersectionObserver === "undefined") return;
        const inBand = new Set<string>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) inBand.add(e.target.id);
                    else inBand.delete(e.target.id);
                }
                const first = ids.find((id) => inBand.has(id));
                if (first) setActive(first);
            },
            // The reading band: below the sticky site header, in the top half
            // of the screen. Between two sections the last one stays current.
            { rootMargin: "-96px 0px -55% 0px" },
        );
        sections.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [key]);

    return (
        <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {items.map((it, i) => {
                const current = it.id === active;
                return (
                    <li key={it.id}>
                        <a
                            href={`#${it.id}`}
                            aria-current={current ? "location" : undefined}
                            onClick={() => setActive(it.id)}
                            className={cx(
                                "flex min-h-10 items-start gap-2.5 rounded-r1 p-2.5 text-[13px] leading-5",
                                current ? "bg-r1-fill-nav font-medium text-r1-ink" : "text-r1-ink-2 hover:bg-r1-fill hover:text-r1-ink",
                            )}
                        >
                            <span className={cx("w-[18px] flex-none font-normal tabular-nums", current ? "text-r1-ink" : "text-r1-ink-3")}>
                                {i + 1}
                            </span>
                            <span>{it.title}</span>
                        </a>
                    </li>
                );
            })}
        </ol>
    );
}
