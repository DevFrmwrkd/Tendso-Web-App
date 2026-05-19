"use client";

import Link from "next/link";
import { BUSINESS_TIERS } from "./landingData";
import { ArrowUpRightIcon } from "./landingPrimitives";

export default function BusinessPricingSection() {
    return (
        <section id="for-business" style={{ background: "var(--neo-paper)" }}>
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">§ 04 — The price</div>
                    <div>
                        <h2 className="display-2">
                            ₱1,000 once. <em style={{ fontStyle: "italic", color: "var(--neo-creator)" }}>Live forever.</em>
                        </h2>
                        <p className="lede" style={{ marginTop: 12 }}>
                            One-time payment. No monthly fees. No contracts. You only pay once your website is live and you&apos;ve approved it.
                        </p>
                    </div>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                        maxWidth: 1080,
                        margin: "0 auto",
                    }}
                >
                    {BUSINESS_TIERS.map((tier) => {
                        const featured = tier.featured;
                        return (
                            <div
                                key={tier.slug}
                                className="card"
                                style={{
                                    padding: "40px 36px 36px",
                                    background: featured ? "var(--neo-ink)" : "var(--neo-paper-3)",
                                    color: featured ? "var(--neo-paper)" : "var(--neo-ink)",
                                    border: featured ? "1px solid var(--neo-ink)" : undefined,
                                    display: "flex",
                                    flexDirection: "column",
                                    position: "relative",
                                }}
                            >
                                {featured && (
                                    <span
                                        className="tag"
                                        style={{
                                            position: "absolute",
                                            top: 20,
                                            right: 20,
                                            background: "var(--neo-creator)",
                                            color: "white",
                                            border: "1px solid var(--neo-creator)",
                                        }}
                                    >
                                        Most popular
                                    </span>
                                )}
                                <div
                                    className="label"
                                    style={{
                                        marginBottom: 16,
                                        color: featured ? "oklch(72% 0.008 85)" : "var(--neo-ink-3)",
                                    }}
                                >
                                    {tier.name}
                                </div>
                                <p
                                    className="serif"
                                    style={{
                                        fontSize: 24,
                                        fontStyle: "italic",
                                        marginBottom: 24,
                                        lineHeight: 1.25,
                                        color: featured ? "oklch(85% 0.008 85)" : "var(--neo-ink-2)",
                                    }}
                                >
                                    {tier.tagline}
                                </p>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                                    <span
                                        className="counter-num"
                                        style={{
                                            fontSize: 20,
                                            color: featured ? "oklch(72% 0.008 85)" : "var(--neo-ink-3)",
                                        }}
                                    >
                                        ₱
                                    </span>
                                    <span className="counter-num" style={{ fontSize: 72 }}>
                                        {tier.price.toLocaleString()}
                                    </span>
                                </div>
                                <div
                                    className="label"
                                    style={{
                                        marginBottom: 24,
                                        color: featured ? "oklch(72% 0.008 85)" : "var(--neo-ink-3)",
                                    }}
                                >
                                    One-time · pay only when live
                                </div>

                                <ul
                                    style={{
                                        listStyle: "none",
                                        padding: 0,
                                        margin: 0,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 12,
                                        marginBottom: 32,
                                    }}
                                >
                                    {tier.features.map((f, i) => (
                                        <li
                                            key={i}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "32px 1fr",
                                                alignItems: "baseline",
                                                fontSize: 14,
                                                color: featured ? "oklch(85% 0.008 85)" : "var(--neo-ink-2)",
                                                lineHeight: 1.55,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontFamily: "var(--neo-mono)",
                                                    fontSize: 11,
                                                    color: featured ? "oklch(72% 0.008 85)" : "var(--neo-ink-3)",
                                                }}
                                            >
                                                0{i + 1}
                                            </span>
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href={tier.ctaHref}
                                    className={`door ${featured ? "door-creator" : ""}`}
                                    style={{
                                        marginTop: "auto",
                                        justifyContent: "space-between",
                                        display: "inline-flex",
                                        textDecoration: "none",
                                    }}
                                >
                                    <span>{tier.ctaLabel}</span>
                                    <span className="arrow"><ArrowUpRightIcon /></span>
                                </Link>
                            </div>
                        );
                    })}
                </div>

                <div
                    className="label"
                    style={{
                        marginTop: 32,
                        textAlign: "center",
                        color: "var(--neo-ink-3)",
                    }}
                >
                    No card on file. No fine print. No charges later. ◆ International pricing matches PH until local launch.
                </div>
            </div>
        </section>
    );
}
