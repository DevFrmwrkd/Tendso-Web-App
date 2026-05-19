"use client";

import { useState } from "react";
import Link from "next/link";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";
import ChatBot from "@/components/landing/ChatBot";

import { KNOWLEDGE_BASE } from "@/components/landing/landingData";
import { Pill } from "@/components/landing/landingPrimitives";

export default function KnowledgePage() {
    const [activeCat, setActiveCat] = useState("All");
    const [open, setOpen] = useState<string | null>(null);
    const cats = ["All", ...Array.from(new Set(KNOWLEDGE_BASE.map((k) => k.category)))];
    const items = activeCat === "All" ? KNOWLEDGE_BASE : KNOWLEDGE_BASE.filter((k) => k.category === activeCat);

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
                            <div className="eyebrow">§ 09 — Knowledge</div>
                            <div>
                                <h2 className="display-2">
                                    The <em>knowledge base</em>.
                                </h2>
                                <p className="lede" style={{ marginTop: 12 }}>
                                    A living collection of guides, interviews, and answers. New entries added weekly by the team and by creators. The chat bot in the corner is trained on the same content.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section style={{ paddingTop: 0, paddingBottom: 80 }}>
                    <div className="container-wide">
                        <div
                            style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "wrap",
                                marginBottom: 24,
                                alignItems: "center",
                            }}
                        >
                            {cats.map((c) => (
                                <Pill
                                    key={c}
                                    active={activeCat === c}
                                    onClick={() => setActiveCat(c)}
                                >
                                    {c}
                                </Pill>
                            ))}
                            <div
                                style={{
                                    marginLeft: "auto",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <span className="label">{KNOWLEDGE_BASE.length} entries</span>
                                <span className="tag tag-live">
                                    <span className="live-dot" style={{ marginRight: 6 }}></span>
                                    Updated weekly
                                </span>
                            </div>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                                gap: 16,
                            }}
                        >
                            {items.map((it) => (
                                <button
                                    key={it.id}
                                    type="button"
                                    onClick={() => setOpen(open === it.id ? null : it.id)}
                                    className="lift card"
                                    style={{
                                        padding: 24,
                                        textAlign: "left",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 12,
                                        background: "var(--neo-paper-3)",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span className="tag" style={{ background: "var(--neo-paper-2)" }}>
                                            {it.category}
                                        </span>
                                        <span className="label">{it.read}</span>
                                    </div>
                                    <div
                                        className="serif"
                                        style={{
                                            fontSize: 22,
                                            lineHeight: 1.2,
                                            letterSpacing: "-.01em",
                                        }}
                                    >
                                        {it.title}
                                    </div>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 14,
                                            color: "var(--neo-ink-2)",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        {open === it.id ? it.excerpt : it.excerpt.slice(0, 100) + "…"}
                                    </p>
                                    <div
                                        style={{
                                            marginTop: "auto",
                                            paddingTop: 4,
                                            color: "var(--neo-ink-3)",
                                            fontSize: 12,
                                            display: "flex",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <span>{open === it.id ? "Show less ↑" : "Read full →"}</span>
                                        <span className="label">Auto-translated</span>
                                    </div>
                                </button>
                            ))}
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
