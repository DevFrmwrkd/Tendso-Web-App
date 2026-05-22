"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Pill } from "./landingPrimitives";
import {
    CATEGORIES,
    REGIONS,
    SHOWCASE_SITES,
    type LiveBusiness,
    type Creator,
    type Region,
} from "./landingData";

const LiveMap = dynamic(() => import("./LiveMap"), {
    ssr: false,
    loading: () => (
        <div
            style={{
                width: "100%",
                height: "100%",
                background: "var(--neo-paper-2)",
                borderRadius: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--neo-ink-3)",
            }}
            className="label"
        >
            Loading map…
        </div>
    ),
});

export default function ShowcaseSection({
    onSelectBusiness,
    onBeFirst,
}: {
    /** Reserved for future use — creator pins were removed from the map UI. */
    onSelectCreator?: (c: Creator) => void;
    onSelectBusiness?: (b: LiveBusiness) => void;
    onBeFirst?: (city: string) => void;
} = {}) {
    // Map data is fully hardcoded — sourced from SHOWCASE_SITES in landingData.ts.
    // Add a site there and a pin appears here automatically.
    const [category, setCategory] = useState<string>("All");
    const [search, setSearch] = useState("");
    const [regionId, setRegionId] = useState<string>("all");
    const [listMode, setListMode] = useState(false);

    const region: Region = useMemo(
        () => REGIONS.find((r) => r.id === regionId) ?? REGIONS[0],
        [regionId],
    );

    // Project every SHOWCASE_SITES entry → LiveBusiness shape the map consumes.
    const allBusinesses: LiveBusiness[] = useMemo(
        () =>
            SHOWCASE_SITES.map((s) => ({
                id: s.slug,
                name: s.name,
                category: s.category,
                city: s.city,
                lat: s.lat,
                lng: s.lng,
                liveUrl: s.url ?? "#",
                src: s.src,
            })),
        [],
    );

    const filteredBusinesses = useMemo(() => {
        let list = allBusinesses;
        if (category !== "All") {
            const cat = category.toLowerCase();
            list = list.filter((b) => b.category?.toLowerCase().includes(cat));
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(
                (b) => b.name.toLowerCase().includes(q) || b.city.toLowerCase().includes(q),
            );
        }
        return list;
    }, [allBusinesses, category, search]);

    return (
        <section id="showcase" style={{ background: "var(--neo-paper-2)" }}>
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">§ 02 — Live map</div>
                    <div>
                        <h2 className="display-2">
                            Live businesses, <em style={{ fontStyle: "italic" }}>right now.</em>
                        </h2>
                        <p className="lede" style={{ marginTop: 12 }}>
                            Every pin is a real business with a real website. Pan, zoom, tap. The list view below is the same data — pick whichever you prefer.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4">
                    <div className="flex gap-2 flex-wrap">
                        {CATEGORIES.map((c) => (
                            <Pill key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Pill>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto sm:ml-auto">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search shop or city…"
                            className="flex-1 sm:flex-none w-full sm:w-[220px]"
                            style={{
                                padding: "8px 14px",
                                fontFamily: "var(--neo-sans)",
                                fontSize: 13,
                                border: "1px solid var(--neo-rule)",
                                background: "var(--neo-paper-3)",
                                color: "var(--neo-ink)",
                                borderRadius: "var(--neo-r-pill)",
                                outline: "none",
                            }}
                        />
                        <select
                            value={regionId}
                            onChange={(e) => setRegionId(e.target.value)}
                            style={{
                                appearance: "none",
                                border: "1px solid var(--neo-rule)",
                                background: "var(--neo-paper-3)",
                                color: "var(--neo-ink)",
                                padding: "8px 14px",
                                fontFamily: "var(--neo-mono)",
                                fontSize: 11,
                                letterSpacing: ".08em",
                                textTransform: "uppercase",
                                borderRadius: 999,
                                cursor: "pointer",
                            }}
                        >
                            {REGIONS.map((r) => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                        <Pill active={listMode} onClick={() => setListMode((v) => !v)}>
                            {listMode ? "Map view" : "List view"}
                        </Pill>
                    </div>
                </div>

                {!listMode ? (
                    <div
                        className="mt-6 w-full h-[420px] sm:h-[500px] lg:h-[560px] overflow-hidden"
                        style={{
                            borderRadius: "var(--neo-r-xl)",
                            border: "1px solid var(--neo-rule)",
                        }}
                    >
                        <LiveMap
                            region={region}
                            filter="businesses"
                            creators={[]}
                            businesses={filteredBusinesses}
                            onSelectBusiness={onSelectBusiness}
                        />
                    </div>
                ) : (
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredBusinesses.map((b) => (
                            <a
                                key={b.id}
                                href={b.liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="lift card"
                                style={{
                                    padding: 20,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                    textDecoration: "none",
                                    color: "var(--neo-ink)",
                                }}
                            >
                                <div style={{ fontWeight: 500, fontSize: 15 }}>{b.name}</div>
                                <div className="label">{b.category} · {b.city}</div>
                                <div className="label tag-live" style={{ marginTop: 8 }}>
                                    <span className="live-dot" style={{ marginRight: 6 }} />
                                    Visit live ↗
                                </div>
                            </a>
                        ))}
                        {filteredBusinesses.length === 0 && (
                            <div
                                className="card"
                                style={{
                                    padding: 24,
                                    color: "var(--neo-ink-3)",
                                    fontSize: 14,
                                    gridColumn: "1 / -1",
                                    textAlign: "center",
                                }}
                            >
                                No live sites match those filters yet.{" "}
                                {onBeFirst && (
                                    <button
                                        onClick={() => onBeFirst(search || "your city")}
                                        style={{
                                            color: "var(--neo-creator)",
                                            background: "transparent",
                                            border: 0,
                                            cursor: "pointer",
                                            textDecoration: "underline",
                                            fontFamily: "inherit",
                                            fontSize: "inherit",
                                        }}
                                    >
                                        Be the first.
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div
                    style={{
                        marginTop: 20,
                        display: "flex",
                        gap: 24,
                        alignItems: "center",
                        flexWrap: "wrap",
                        color: "var(--neo-ink-3)",
                        fontSize: 13,
                    }}
                >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span
                            style={{
                                display: "inline-block",
                                width: 12,
                                height: 12,
                                background: "oklch(34% 0.10 245)",
                                transform: "rotate(45deg)",
                            }}
                        />
                        Business with live site
                    </span>
                    <span style={{ marginLeft: "auto" }} className="label tag-live">
                        <span className="live-dot" style={{ marginRight: 6 }} />
                        {allBusinesses.length} pinned
                    </span>
                </div>
            </div>
        </section>
    );
}
