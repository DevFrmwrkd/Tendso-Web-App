"use client";

import Link from "next/link";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";
import ChatBot from "@/components/landing/ChatBot";
import { ArrowUpRightIcon } from "@/components/landing/landingPrimitives";

const SUPPORT_EMAIL = "frmwrkd.media@gmail.com";

export default function ContactPage() {
    return (
        <div className="neo min-h-screen overflow-x-hidden">
            <Navbar />

            <main>
                <section style={{ paddingTop: 56, paddingBottom: 24 }}>
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

                        <div className="sect-h">
                            <div className="eyebrow">§ Contact</div>
                            <div>
                                <h1 className="display">
                                    Let&apos;s <em style={{ fontStyle: "italic", color: "var(--neo-creator)" }}>talk</em>.
                                </h1>
                                <p className="lede" style={{ marginTop: 18 }}>
                                    One inbox, one team, one country to cover. Whether you&apos;re a business owner, a creator, a partner, or just curious — write to us. We answer every email.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Big email card — the primary contact CTA */}
                <section style={{ paddingTop: 0, paddingBottom: 64 }}>
                    <div className="container-wide">
                        <a
                            href={`mailto:${SUPPORT_EMAIL}`}
                            className="card lift"
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 24,
                                padding: "56px 48px",
                                maxWidth: 980,
                                margin: "0 auto",
                                textDecoration: "none",
                                color: "var(--neo-ink)",
                                background: "var(--neo-ink)",
                                borderColor: "var(--neo-ink)",
                            }}
                        >
                            <span
                                className="label"
                                style={{ color: "oklch(72% 0.008 85)" }}
                            >
                                Email · responds within 24 hours
                            </span>
                            <span
                                className="serif"
                                style={{
                                    fontSize: "clamp(36px, 6vw, 72px)",
                                    lineHeight: 1.05,
                                    color: "var(--neo-paper)",
                                    letterSpacing: "-.02em",
                                    wordBreak: "break-word",
                                }}
                            >
                                {SUPPORT_EMAIL}
                            </span>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    color: "var(--neo-creator)",
                                    fontFamily: "var(--neo-mono)",
                                    fontSize: 12,
                                    letterSpacing: ".12em",
                                    textTransform: "uppercase",
                                }}
                            >
                                Compose new message <ArrowUpRightIcon />
                            </div>
                        </a>
                    </div>
                </section>

                {/* What to expect / direct routes */}
                <section style={{ background: "var(--neo-paper-2)" }}>
                    <div className="container-wide">
                        <div className="sect-h">
                            <div className="eyebrow">What to expect</div>
                            <div>
                                <h2 className="display-2">
                                    Pick the <em style={{ fontStyle: "italic" }}>right door</em>.
                                </h2>
                                <p className="lede" style={{ marginTop: 12 }}>
                                    Most questions have answers waiting in the knowledge base or the FAQ. If you still need a person, the email above lands directly in our shared support inbox.
                                </p>
                            </div>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                                gap: 16,
                            }}
                        >
                            {[
                                {
                                    label: "For business owners",
                                    title: "I own a shop. Get me online.",
                                    href: "/for-business",
                                    tone: "business" as const,
                                },
                                {
                                    label: "For creators",
                                    title: "I want to earn building sites.",
                                    href: "/for-creators",
                                    tone: "creator" as const,
                                },
                                {
                                    label: "Knowledge base",
                                    title: "Read every guide we publish.",
                                    href: "/knowledge",
                                    tone: "neutral" as const,
                                },
                                {
                                    label: "FAQ",
                                    title: "Common questions, sorted.",
                                    href: "/help-faq",
                                    tone: "neutral" as const,
                                },
                            ].map((c) => (
                                <Link
                                    key={c.href}
                                    href={c.href}
                                    className="lift card"
                                    style={{
                                        padding: 24,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 14,
                                        textDecoration: "none",
                                        color: "var(--neo-ink)",
                                    }}
                                >
                                    <span
                                        className="label"
                                        style={{
                                            color:
                                                c.tone === "creator"
                                                    ? "var(--neo-creator)"
                                                    : c.tone === "business"
                                                      ? "var(--neo-business)"
                                                      : "var(--neo-ink-3)",
                                        }}
                                    >
                                        {c.label}
                                    </span>
                                    <span
                                        className="serif"
                                        style={{
                                            fontSize: 22,
                                            lineHeight: 1.25,
                                            letterSpacing: "-.01em",
                                        }}
                                    >
                                        {c.title}
                                    </span>
                                    <span
                                        className="label"
                                        style={{
                                            marginTop: "auto",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: "var(--neo-ink-3)",
                                        }}
                                    >
                                        <span>Read more</span>
                                        <span style={{ color: "var(--neo-creator)" }}>→</span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Closing CTA bar */}
                <section style={{ paddingTop: 96, paddingBottom: 96 }}>
                    <div className="container-wide">
                        <div
                            style={{
                                maxWidth: 980,
                                margin: "0 auto",
                                paddingTop: 32,
                                borderTop: "1px solid var(--neo-rule-strong)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 16,
                                flexWrap: "wrap",
                            }}
                        >
                            <div className="display-3" style={{ maxWidth: "30ch" }}>
                                Press, partnerships, press kits — same inbox.
                            </div>
                            <a
                                href={`mailto:${SUPPORT_EMAIL}`}
                                className="door door-creator"
                                style={{ textDecoration: "none", display: "inline-flex" }}
                            >
                                <span>
                                    <span className="meta">Direct line</span>
                                    {SUPPORT_EMAIL}
                                </span>
                                <span className="arrow">
                                    <ArrowUpRightIcon />
                                </span>
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
            <ChatBot />
            <ScrollToTop />
        </div>
    );
}
