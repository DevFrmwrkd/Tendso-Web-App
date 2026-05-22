"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTickUp, ArrowDownIcon, ArrowUpRightIcon } from "./landingPrimitives";
import { fmt, COUNTERS_GROWTH, HARDCODED_LIVE_SITE_COUNT } from "./landingData";

// Live clock that only renders post-mount to avoid SSR/CSR hydration mismatch.
// The server has no way to know the client's "now" within the same minute, so
// rendering the string on the server is guaranteed to differ from the client.
function LiveClockTime() {
    const [time, setTime] = useState<string | null>(null);
    useEffect(() => {
        const tick = () =>
            setTime(
                new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            );
        tick();
        const id = setInterval(tick, 30_000);
        return () => clearInterval(id);
    }, []);
    // Render a non-breaking space placeholder until mount so the surrounding
    // layout doesn't reflow when the clock pops in.
    return <>{time ?? "——:——"} PHT</>;
}

// Same defer-to-mount treatment for the magazine-style issue line. The page
// can be cached at build time and served weeks later, so server-rendered
// month/year may legitimately disagree with the client.
function IssueDate() {
    const [label, setLabel] = useState<string | null>(null);
    useEffect(() => {
        setLabel(
            new Date().toLocaleString("en-US", {
                month: "long",
                year: "numeric",
            }),
        );
    }, []);
    return <>{label ?? " "}</>;
}

// English-only strings — page-level i18n lives at the next refactor.
const T = {
    hero_main: ["No business", "left ", "offline", "."] as const,
    hero_main_em: "Real shops. Real websites. Real fast.",
    hero_lede:
        "A trained creator visits your shop, shoots world-class photos, writes your story, and ships a fully functional website — hosting, domain, copy, everything — in 48 hours. You don't touch a keyboard once.",
    door_business: "I own a business",
    door_business_sub: "Find a creator near me",
    door_creator: "I want to earn",
    door_creator_sub: "Become a certified creator",
    counter_creators: "creators",
    counter_businesses: "live sites",
    counter_cities: "cities",
    counter_countries: "countries",
};

function CounterRow({ value, label, last }: { value: number; label: string; last?: boolean }) {
    return (
        <div
            style={{
                padding: "18px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderBottom: last ? "none" : "1px solid var(--neo-rule)",
            }}
        >
            <span className="counter-num" style={{ fontSize: 40 }}>{fmt(value)}</span>
            <span className="label">{label}</span>
        </div>
    );
}

function DoorButton({
    kind,
    href,
    title,
    sub,
    note,
}: {
    kind: "business" | "creator";
    href: string;
    title: string;
    sub: string;
    note: string;
}) {
    return (
        <Link
            href={href}
            className={`door door-${kind} p-5 sm:p-7`}
            style={{
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 0,
                textDecoration: "none",
                display: "inline-flex",
            }}
        >
            <span className="meta" style={{ marginBottom: 12 }}>
                {sub} <span className="arrow"><ArrowUpRightIcon /></span>
            </span>
            <span
                className="text-[28px] sm:text-[34px] lg:text-[38px]"
                style={{
                    fontFamily: "var(--neo-serif)",
                    lineHeight: 0.98,
                    letterSpacing: "-.02em",
                }}
            >
                {title}
            </span>
            <span style={{ fontSize: 13, opacity: 0.85, marginTop: 12, lineHeight: 1.5 }}>{note}</span>
        </Link>
    );
}

export default function HeroSection() {
    // Live creator count comes from Convex; site count is hardcoded — derived
    // from the SHOWCASE_SITES list in landingData.ts (single source of truth).
    const liveCreators = useQuery(api.creators.count, {}) as number | undefined;

    const creators = useTickUp(liveCreators ?? COUNTERS_GROWTH.creators);
    const businesses = useTickUp(HARDCODED_LIVE_SITE_COUNT);
    const cities = useTickUp(COUNTERS_GROWTH.cities);
    const countries = useTickUp(COUNTERS_GROWTH.countries);
    const hm = T.hero_main;

    return (
        <section className="pt-12 pb-12 sm:pt-14 sm:pb-12">
            <div className="container-wide">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] gap-10 lg:gap-14 lg:items-end mb-10 lg:mb-12">
                    <div>
                        <div
                            className="eyebrow"
                            style={{
                                marginBottom: 24,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "6px 14px",
                                border: "1px solid var(--neo-rule)",
                                borderRadius: "var(--neo-r-pill)",
                                background: "var(--neo-paper-3)",
                            }}
                        >
                            <span className="live-dot"></span>
                            Issue No. 01 · <IssueDate />
                        </div>
                        <h1 className="display">
                            {hm[0]}
                            <br />
                            {hm[1]}<em>{hm[2]}</em>{hm[3]}
                        </h1>
                        <div
                            className="serif"
                            style={{
                                fontSize: "clamp(20px, 1.8vw, 28px)",
                                fontStyle: "italic",
                                color: "var(--neo-ink-2)",
                                marginTop: 18,
                                letterSpacing: "-.01em",
                            }}
                        >
                            {T.hero_main_em}
                        </div>
                        <p className="lede" style={{ marginTop: 28, fontSize: 18, maxWidth: "58ch" }}>
                            {T.hero_lede}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}>
                            {[
                                "Real photographer",
                                "Written copy",
                                "Hosting + domain",
                                "You don't lift a finger",
                                "Live in 48 hours",
                            ].map((p) => (
                                <span
                                    key={p}
                                    className="tag"
                                    style={{
                                        padding: "6px 14px",
                                        fontSize: 11,
                                        background: "var(--neo-paper-3)",
                                        color: "var(--neo-ink-2)",
                                    }}
                                >
                                    {p}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="surface">
                        <div
                            style={{
                                padding: "14px 18px",
                                borderBottom: "1px solid var(--neo-rule)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span className="label">
                                <span className="live-dot" style={{ marginRight: 6 }}></span>
                                Live · <LiveClockTime />
                            </span>
                            <span className="label" style={{ color: "var(--neo-live)" }}>↑ updating</span>
                        </div>
                        <CounterRow value={creators} label={T.counter_creators} />
                        <CounterRow value={businesses} label={T.counter_businesses} />
                        <CounterRow value={cities} label={T.counter_cities} />
                        <CounterRow value={countries} label={T.counter_countries} last />
                    </div>
                </div>

                <div className="pt-8" style={{ borderTop: "1px solid var(--neo-rule-strong)" }}>
                    <div className="label" style={{ marginBottom: 16 }}>Pick a door</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <DoorButton
                            kind="business"
                            href="/for-business"
                            sub={T.door_business_sub}
                            title={T.door_business}
                            note="See exactly what we deliver — photos, copy, domain, hosting — and find a creator within 10 km of your shop."
                        />
                        <DoorButton
                            kind="creator"
                            href="/for-creators"
                            sub={T.door_creator_sub}
                            title={T.door_creator}
                            note="See how much creators actually earn, how referrals stack up, and how to get certified this week."
                        />
                    </div>
                    <div
                        style={{
                            marginTop: 24,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            color: "var(--neo-ink-3)",
                            fontSize: 13,
                        }}
                    >
                        <ArrowDownIcon />
                        <span>Or scroll — find creators near you on the map below.</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
