"use client";

import Link from "next/link";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";

import EarningsSection from "@/components/landing/EarningsSection";
import ProcessSection from "@/components/landing/ProcessSection";
import FaqSection from "@/components/landing/FaqSection";
import CtaSection from "@/components/landing/CtaSection";
import ChatBot from "@/components/landing/ChatBot";

import { ArrowUpRightIcon } from "@/components/landing/landingPrimitives";

const APPLY_STEPS = [
    { n: "01", h: "Tap \"I want to earn\"", sub: "Sign up from this page. The full flow lives in the app.", meta: "30 seconds" },
    { n: "02", h: "Verify your phone & ID", sub: "Bank-grade KYC inside the app. Selfie + a valid ID. We hold your data for payouts only.", meta: "5 minutes" },
    { n: "03", h: "Take the certification", sub: "Twelve short videos. A photo quiz. An interview rehearsal with a fake shop owner. You can retry as many times as you need.", meta: "20 minutes" },
    { n: "04", h: "Pin yourself on the map", sub: "You show up on the landing page, in front of every business owner in your area looking for a creator.", meta: "instant" },
    { n: "05", h: "Accept your first booking", sub: "Either a business taps you, or you pick one from your queue. Bring a phone, bring patience. The app guides every step.", meta: "same day" },
    { n: "06", h: "Deliver. Get paid.", sub: "₱500 lands in your wallet within 48 hours of the business approving the site. Refer a friend, earn another ₱1,000 when their first paid submission lands.", meta: "48 hours" },
];

function CreatorHero() {
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
                                color: "var(--neo-creator)",
                            }}
                        >
                            <span
                                style={{
                                    display: "inline-block",
                                    width: 9,
                                    height: 9,
                                    borderRadius: "50%",
                                    background: "var(--neo-creator)",
                                }}
                            />
                            For creators
                        </div>
                        <h1 className="display" style={{ fontSize: "clamp(56px, 7.5vw, 120px)" }}>
                            Get paid to <em style={{ fontStyle: "italic", color: "var(--neo-creator)" }}>build websites</em> for shops near you.
                        </h1>
                        <p className="lede" style={{ marginTop: 28, fontSize: 19, maxWidth: "56ch" }}>
                            Bring a phone, bring patience, follow the in-app checklist. We do the editing, the writing, the deploying. You collect the cheque.
                        </p>

                        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <Link
                                href="/signup"
                                className="door door-creator"
                                style={{ textDecoration: "none", display: "inline-flex" }}
                            >
                                Start the certification <span className="arrow"><ArrowUpRightIcon /></span>
                            </Link>
                            <Link
                                href="/#for-creators"
                                className="door door-ghost"
                                style={{ textDecoration: "none", display: "inline-flex" }}
                            >
                                See the numbers
                            </Link>
                        </div>
                    </div>

                    <div className="surface" style={{ padding: 24 }}>
                        <div className="label" style={{ marginBottom: 16 }}>What you earn</div>
                        {[
                            ["Per submission (50% of sale)", "₱500"],
                            ["Referral bonus", "₱1,000"],
                            ["Payout via Wise", "—"],
                            ["Time to first payout", "48 hr"],
                        ].map(([label, v], i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "baseline",
                                    padding: "12px 0",
                                    borderTop: "1px solid var(--neo-rule)",
                                    fontSize: 14,
                                }}
                            >
                                <span>{label}</span>
                                <span
                                    className="counter-num"
                                    style={{
                                        fontSize: 22,
                                        color: v.startsWith("₱") ? "var(--neo-creator)" : "var(--neo-ink-3)",
                                    }}
                                >
                                    {v}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function HowToApplySection() {
    return (
        <section style={{ background: "var(--neo-paper-2)" }}>
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">§ How to apply</div>
                    <div>
                        <h2 className="display-2">
                            From this page <em>to your first payout</em>.
                        </h2>
                        <p className="lede" style={{ marginTop: 12 }}>
                            The full apply-and-certify flow lives inside the app. Here&apos;s what it looks like, with the time each step actually takes.
                        </p>
                    </div>
                </div>

                <div className="surface" style={{ padding: 0 }}>
                    {APPLY_STEPS.map((s, i) => (
                        <div
                            key={s.n}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "80px 1fr 1fr 160px",
                                gap: 32,
                                padding: "28px 32px",
                                borderTop: i === 0 ? "none" : "1px solid var(--neo-rule)",
                                alignItems: "baseline",
                            }}
                        >
                            <div className="counter-num" style={{ fontSize: 32, color: "var(--neo-creator)" }}>{s.n}</div>
                            <div
                                className="serif"
                                style={{
                                    fontSize: 24,
                                    lineHeight: 1.15,
                                    letterSpacing: "-.015em",
                                }}
                            >
                                {s.h}
                            </div>
                            <div
                                style={{
                                    fontSize: 14,
                                    color: "var(--neo-ink-2)",
                                    lineHeight: 1.55,
                                    maxWidth: "42ch",
                                }}
                            >
                                {s.sub}
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <span className="tag" style={{ background: "var(--neo-paper-3)" }}>{s.meta}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        marginTop: 32,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span className="tag" style={{ background: "var(--neo-paper-3)" }}>Free to apply</span>
                        <span className="tag" style={{ background: "var(--neo-paper-3)" }}>No experience required</span>
                        <span className="tag" style={{ background: "var(--neo-paper-3)" }}>Keep your day job</span>
                    </div>
                    <Link
                        href="/signup"
                        className="door door-creator"
                        style={{ padding: "16px 24px", textDecoration: "none", display: "inline-flex" }}
                    >
                        <span>Start the certification</span>
                        <span className="arrow"><ArrowUpRightIcon /></span>
                    </Link>
                </div>
            </div>
        </section>
    );
}

export default function ForCreatorsPage() {
    return (
        <div className="neo min-h-screen overflow-x-hidden">
            <Navbar />
            <main>
                <CreatorHero />
                <EarningsSection />
                <HowToApplySection />
                <ProcessSection />
                <FaqSection />
                <CtaSection />
            </main>
            <Footer />
            <ChatBot />
            <ScrollToTop />
        </div>
    );
}
