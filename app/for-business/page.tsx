"use client";

import Link from "next/link";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";

import ShowcaseSection from "@/components/landing/ShowcaseSection";
import ProcessSection from "@/components/landing/ProcessSection";
import BusinessPricingSection from "@/components/landing/BusinessPricingSection";
import FaqSection from "@/components/landing/FaqSection";
import CtaSection from "@/components/landing/CtaSection";
import ChatBot from "@/components/landing/ChatBot";

import { ArrowUpRightIcon } from "@/components/landing/landingPrimitives";

function PromiseBeat({
    n,
    big,
    sub,
    highlight,
}: {
    n: string;
    big: string;
    sub: string;
    highlight?: boolean;
}) {
    return (
        <div
            style={{
                padding: 20,
                background: highlight ? "var(--neo-ink)" : "var(--neo-paper-3)",
                color: highlight ? "var(--neo-paper)" : "var(--neo-ink)",
                border: "1px solid " + (highlight ? "var(--neo-ink)" : "var(--neo-rule)"),
                borderRadius: "var(--neo-r-md)",
            }}
        >
            <div
                className="label"
                style={{ marginBottom: 8, color: highlight ? "oklch(72% 0.008 85)" : undefined }}
            >
                {n}
            </div>
            <div className="counter-num" style={{ fontSize: 36, lineHeight: 1.0, marginBottom: 8 }}>
                {big}
            </div>
            <div style={{ fontSize: 12, color: highlight ? "oklch(80% 0.008 85)" : "var(--neo-ink-3)" }}>
                {sub}
            </div>
        </div>
    );
}

function BusinessHero() {
    return (
        <section style={{ paddingTop: 56, paddingBottom: 48 }}>
            <div className="container-wide">
                <Link
                    href="/"
                    className="label"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 24,
                        textDecoration: "none",
                        color: "var(--neo-ink-3)",
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M9 1 L3 7 L9 13" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    Back to landing
                </Link>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1.4fr 1fr",
                        gap: 64,
                        alignItems: "end",
                    }}
                >
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
                                color: "var(--neo-business)",
                            }}
                        >
                            <span
                                style={{
                                    display: "inline-block",
                                    width: 8,
                                    height: 8,
                                    background: "var(--neo-business)",
                                    transform: "rotate(45deg)",
                                }}
                            />
                            For business owners
                        </div>
                        <h1 className="display" style={{ fontSize: "clamp(56px, 7.5vw, 120px)" }}>
                            Your shop. <em style={{ fontStyle: "italic" }}>Online in 48 hours.</em>
                        </h1>
                        <p className="lede" style={{ marginTop: 28, fontSize: 19, maxWidth: "56ch" }}>
                            A trained creator visits your shop with a phone and a checklist. You answer questions about your business. They shoot, write, build, and publish. You approve. You pay. That&apos;s the entire process.
                        </p>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
                                gap: 16,
                                marginTop: 40,
                                maxWidth: 720,
                            }}
                        >
                            <PromiseBeat n="01" big="30 min" sub="Interview, in your shop" />
                            <PromiseBeat n="02" big="48 hr" sub="From visit to live site" />
                            <PromiseBeat n="03" big="0" sub="Times you touch a keyboard" highlight />
                        </div>

                        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <Link
                                href="/signup"
                                className="door door-business"
                                style={{ textDecoration: "none", display: "inline-flex" }}
                            >
                                Get started <span className="arrow"><ArrowUpRightIcon /></span>
                            </Link>
                            <Link
                                href="/#showcase"
                                className="door door-ghost"
                                style={{ textDecoration: "none", display: "inline-flex" }}
                            >
                                Browse the live map
                            </Link>
                        </div>
                    </div>

                    <div className="surface" style={{ padding: 24 }}>
                        <div className="label" style={{ marginBottom: 16 }}>What lands in your hands</div>
                        {[
                            "A live website on your own domain or our subdomain",
                            "World-class photography of your shop",
                            "Written copy — your story, told properly",
                            "Hosting + SSL — first year included",
                            "Small edits free within 7 days of launch",
                            "You own it all. Take it anywhere.",
                        ].map((s, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    gap: 12,
                                    padding: "10px 0",
                                    borderTop: "1px solid var(--neo-rule)",
                                    fontSize: 14,
                                }}
                            >
                                <span
                                    className="mono"
                                    style={{
                                        fontSize: 10,
                                        color: "var(--neo-ink-3)",
                                        flexShrink: 0,
                                    }}
                                >
                                    0{i + 1}
                                </span>
                                <span>{s}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function ForBusinessPage() {
    return (
        <div className="neo min-h-screen overflow-x-hidden">
            <Navbar />
            <main>
                <BusinessHero />
                <ProcessSection />
                <ShowcaseSection />
                <BusinessPricingSection />
                <FaqSection />
                <CtaSection />
            </main>
            <Footer />
            <ChatBot />
            <ScrollToTop />
        </div>
    );
}
