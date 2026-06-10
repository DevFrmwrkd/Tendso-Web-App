"use client";

import Link from "next/link";
import { CREATOR_EARNINGS, TESTIMONIALS } from "./landingData";
import { Avatar, ArrowUpRightIcon } from "./landingPrimitives";

export default function EarningsSection() {
    return (
        <section
            id="for-creators"
            style={{
                background: "var(--neo-ink)",
                color: "var(--neo-paper)",
                paddingTop: 120,
                paddingBottom: 120,
            }}
        >
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow" style={{ color: "var(--neo-creator)" }}>§ 05 — For creators</div>
                    <div>
                        <h2 className="display-2" style={{ color: "var(--neo-paper)" }}>
                            Earn while bringing them <em style={{ fontStyle: "italic", color: "var(--neo-creator)" }}>online</em>.
                        </h2>
                        <p
                            className="lede"
                            style={{ marginTop: 12, color: "oklch(80% 0.008 85)", maxWidth: "62ch" }}
                        >
                            The platform pays creators for the work they ship. It also pays them for the creators and businesses they bring along. Plain numbers, no fine print.
                        </p>
                    </div>
                </div>

                {/* Payout rates — current marketing values */}
                <div
                    className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12"
                    style={{}}
                >
                    {CREATOR_EARNINGS.map((rate) => {
                        const featured = rate.featured;
                        return (
                            <div
                                key={rate.slug}
                                style={{
                                    padding: "32px 28px",
                                    background: featured
                                        ? "oklch(62% 0.115 80 / .15)"
                                        : "oklch(20% 0.015 260)",
                                    border: featured
                                        ? "1px solid oklch(62% 0.115 80 / .5)"
                                        : "1px solid oklch(40% 0.015 260)",
                                    borderRadius: "var(--neo-r-lg)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 14,
                                }}
                            >
                                <div className="label" style={{ color: "oklch(72% 0.008 85)" }}>
                                    {rate.title}
                                </div>
                                <div
                                    className="counter-num"
                                    style={{
                                        fontSize: 64,
                                        lineHeight: 1.0,
                                        color: featured ? "var(--neo-creator)" : "var(--neo-paper)",
                                    }}
                                >
                                    ₱{rate.amount.toLocaleString()}
                                </div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: "oklch(80% 0.008 85)",
                                        lineHeight: 1.55,
                                    }}
                                >
                                    {rate.desc}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Earning reality */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
                    {[
                        { label: "Per week, part-time", v: "₱1,500 – ₱3,500", n: "3–7 sites per week" },
                        { label: "Per week, full-time", v: "₱5,000 – ₱12,000", n: "10+ sites + referral bonuses" },
                        { label: "Top decile, month 6+", v: "₱24,000 +", n: "Active referral tree, multi-city", highlight: true },
                    ].map((c) => (
                        <div
                            key={c.label}
                            style={{
                                padding: "32px 28px",
                                background: c.highlight ? "var(--neo-creator)" : "transparent",
                                border: c.highlight
                                    ? "1px solid var(--neo-creator)"
                                    : "1px solid oklch(40% 0.015 260)",
                                color: c.highlight ? "white" : "var(--neo-paper)",
                                borderRadius: "var(--neo-r-lg)",
                            }}
                        >
                            <div
                                className="label"
                                style={{
                                    marginBottom: 12,
                                    color: c.highlight ? "oklch(95% 0.04 85)" : "oklch(72% 0.008 85)",
                                }}
                            >
                                {c.label}
                            </div>
                            <div className="counter-num" style={{ fontSize: 36, marginBottom: 10, lineHeight: 1.0 }}>
                                {c.v}
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: c.highlight ? "oklch(95% 0.04 85)" : "oklch(70% 0.010 85)",
                                }}
                            >
                                {c.n}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Testimonials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                    {TESTIMONIALS.map((t) => (
                        <div
                            key={t.name}
                            style={{
                                padding: 28,
                                background: "oklch(20% 0.015 260)",
                                border: "1px solid oklch(40% 0.015 260)",
                                borderRadius: "var(--neo-r-lg)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 16,
                            }}
                        >
                            <p
                                className="pull-quote"
                                style={{ fontSize: 22, lineHeight: 1.3, color: "var(--neo-paper)" }}
                            >
                                <em style={{ color: "var(--neo-creator)" }}>&ldquo;</em>
                                {t.claim}
                                <em style={{ color: "var(--neo-creator)" }}>&rdquo;</em>
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    marginTop: "auto",
                                    paddingTop: 16,
                                    borderTop: "1px solid oklch(40% 0.015 260)",
                                }}
                            >
                                <Avatar name={t.name} hue={t.hue} size={40} />
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: 14 }}>{t.name}</div>
                                    <div className="label" style={{ marginTop: 2, color: "oklch(72% 0.008 85)" }}>
                                        {t.city} · verified
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div
                    style={{
                        paddingTop: 32,
                        borderTop: "1px solid oklch(40% 0.015 260)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 16,
                    }}
                >
                    <div
                        className="display-3"
                        style={{ color: "var(--neo-paper)", maxWidth: "32ch" }}
                    >
                        Your referral link lives in the app. Apply today, earn this week.
                    </div>
                    <Link
                        href="/for-creators"
                        className="door door-creator"
                        style={{
                            padding: "20px 28px",
                            display: "inline-flex",
                            textDecoration: "none",
                        }}
                    >
                        <span>See full creator breakdown</span>
                        <span className="arrow">
                            <ArrowUpRightIcon />
                        </span>
                    </Link>
                </div>
            </div>
        </section>
    );
}
