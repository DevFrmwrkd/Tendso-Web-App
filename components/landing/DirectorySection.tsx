"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
    COUNTERS_GROWTH,
    FALLBACK_CREATORS,
    HARDCODED_LIVE_SITE_COUNT,
    SHOWCASE_SITES,
    SHOWCASE_TAGS,
    fmt,
    type Creator,
    type LiveBusiness,
} from "./landingData";
import { Avatar, Pill, useTickUp } from "./landingPrimitives";

function BigCounter({ value, label, last }: { value: number; label: string; last?: boolean }) {
    const v = useTickUp(value);
    return (
        <div
            style={{
                padding: "32px 28px",
                borderRight: last ? "none" : "1px solid var(--neo-rule)",
            }}
        >
            <div className="label" style={{ marginBottom: 12 }}>
                <span className="live-dot" style={{ marginRight: 6 }}></span>
                {label}
            </div>
            <div className="counter-num" style={{ fontSize: 64 }}>{fmt(v)}</div>
        </div>
    );
}

function CreatorCard({ c, onClick }: { c: Creator; onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="lift"
            style={{
                width: 240,
                padding: 0,
                border: "1px solid var(--neo-rule)",
                background: "var(--neo-paper-3)",
                cursor: "pointer",
                textAlign: "left",
                borderRadius: "var(--neo-r-lg)",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    padding: 18,
                    borderBottom: "1px solid var(--neo-rule)",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                }}
            >
                <Avatar name={c.name} hue={c.hue} size={48} />
                <div>
                    <div style={{ fontWeight: 500, fontSize: 16 }}>{c.name}</div>
                    <div className="label" style={{ marginTop: 2 }}>{c.city}</div>
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: 14,
                    alignItems: "baseline",
                }}
            >
                <div>
                    <div className="counter-num" style={{ fontSize: 26 }}>{c.sites}</div>
                    <div className="label" style={{ marginTop: 2 }}>business submissions</div>
                </div>
                <span className="tag tag-live" style={{ alignSelf: "center" }}>
                    <span className="live-dot" style={{ marginRight: 6 }}></span>Hire ↗
                </span>
            </div>
        </button>
    );
}

export default function DirectorySection({
    onSelectCreator,
}: {
    onSelectCreator?: (c: Creator) => void;
    /** Reserved for future use — business detail sheets aren't wired in the
     *  grouped-by-category view since cards already deep-link to the live site. */
    onSelectBusiness?: (b: LiveBusiness) => void;
} = {}) {
    const liveCreators = useQuery(api.creators.count, {}) as number | undefined;
    const [filter, setFilter] = useState<string>("All");

    const counterCells = [
        { k: "creators", label: "creators", v: liveCreators ?? COUNTERS_GROWTH.creators },
        { k: "businesses", label: "live sites", v: HARDCODED_LIVE_SITE_COUNT },
        { k: "cities", label: "cities", v: COUNTERS_GROWTH.cities },
        { k: "countries", label: "countries", v: COUNTERS_GROWTH.countries },
    ];

    const filteredSites =
        filter === "All"
            ? SHOWCASE_SITES
            : SHOWCASE_SITES.filter((s) => s.tag === filter);

    return (
        <section id="directory">
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">§ 06 — Directory</div>
                    <div>
                        <h2 className="display-2">
                            Proof, <em style={{ fontStyle: "italic" }}>at scale</em>.
                        </h2>
                        <p className="lede" style={{ marginTop: 12 }}>
                            Every name and every site below is real. The live-sites count is pulled from the database, not from a deck.
                        </p>
                    </div>
                </div>

                <div
                    className="surface grid grid-cols-2 sm:grid-cols-4 mb-12"
                >
                    {counterCells.map((c, i) => (
                        <BigCounter
                            key={c.k}
                            value={c.v}
                            label={c.label}
                            last={i === counterCells.length - 1}
                        />
                    ))}
                </div>

                {COUNTERS_GROWTH.monthEarnings && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 18,
                            padding: "20px 24px",
                            marginBottom: 48,
                            background: "var(--neo-ink)",
                            color: "var(--neo-paper)",
                            borderRadius: "var(--neo-r-lg)",
                            flexWrap: "wrap",
                        }}
                    >
                        <span className="label" style={{ color: "var(--neo-live-soft)" }}>
                            <span className="live-dot" style={{ marginRight: 6 }}></span>
                            This month
                        </span>
                        <span className="counter-num" style={{ fontSize: 32 }}>
                            ₱{fmt(COUNTERS_GROWTH.monthEarnings)}
                        </span>
                        <span style={{ color: "oklch(80% 0.008 85)", fontSize: 14 }}>
                            paid out to creators · payouts continue daily
                        </span>
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginBottom: 16,
                    }}
                >
                    <h3 className="display-3">Creators on the platform</h3>
                    <span className="label" style={{ color: "var(--neo-ink-3)" }}>
                        Hover to pause
                    </span>
                </div>
                {/* Auto-scrolling marquee — the creator list is duplicated so the
                    -50% endpoint of the animation lands on the start of copy #2,
                    making the loop seamless. */}
                <div className="marquee-wrap">
                    <div className="marquee-track">
                        {[...FALLBACK_CREATORS, ...FALLBACK_CREATORS].map((c, i) => (
                            <CreatorCard
                                key={`${c.id}-${i}`}
                                c={c}
                                onClick={() => onSelectCreator?.(c)}
                            />
                        ))}
                    </div>
                </div>

                {/* Businesses we've built — filter pills + single rail.
                    Pills auto-derive from SHOWCASE_SITES.tag in landingData.ts. */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginTop: 48,
                        marginBottom: 16,
                        flexWrap: "wrap",
                        gap: 16,
                    }}
                >
                    <h3 className="display-3">Businesses we&apos;ve built</h3>
                    <span className="label tag-live">
                        <span className="live-dot" style={{ marginRight: 6 }} />
                        {filteredSites.length} of {SHOWCASE_SITES.length} sites
                    </span>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
                    {SHOWCASE_TAGS.map((tag) => (
                        <Pill
                            key={tag}
                            active={filter === tag}
                            onClick={() => setFilter(tag)}
                        >
                            {tag}
                        </Pill>
                    ))}
                </div>

                <div className="rail" style={{ gap: 20 }}>
                    {filteredSites.map((s) => (
                        <a
                            key={s.slug}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="lift"
                            style={{
                                width: 320,
                                padding: 0,
                                border: "1px solid var(--neo-rule)",
                                background: "var(--neo-paper-3)",
                                textDecoration: "none",
                                color: "var(--neo-ink)",
                                borderRadius: "var(--neo-r-lg)",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                className="ar-16x9"
                                style={{
                                    position: "relative",
                                    borderBottom: "1px solid var(--neo-rule)",
                                    backgroundImage: `url(${s.src})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "top center",
                                }}
                            >
                                <span
                                    className="tag tag-live"
                                    style={{
                                        position: "absolute",
                                        top: 12,
                                        right: 12,
                                        background: "var(--neo-paper-3)",
                                    }}
                                >
                                    <span className="live-dot" style={{ marginRight: 6 }} />
                                    Live ↗
                                </span>
                            </div>
                            <div style={{ padding: "16px 18px" }}>
                                <div style={{ fontWeight: 500, fontSize: 16 }}>{s.name}</div>
                                <div
                                    className="label"
                                    style={{
                                        marginTop: 6,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 12,
                                    }}
                                >
                                    <span>{s.category}</span>
                                    <span style={{ color: "var(--neo-creator)" }}>Visit →</span>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
}
