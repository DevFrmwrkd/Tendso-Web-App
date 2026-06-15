"use client";

import { useState } from "react";
import Link from "next/link";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";
import ChatBot from "@/components/landing/ChatBot";
import { Pill } from "@/components/landing/landingPrimitives";

type FaqItem = { q: string; a: string };
type FaqGroup = { id: string; title: string; items: FaqItem[] };

// Source content preserved from the original /help-faq.
// Reorganized to read top-to-bottom by audience: getting started → submissions →
// earnings → account. Every answer that referenced support stays
// pointed at frmwrkd.media@gmail.com (consistent with the /contact page).
const GROUPS: FaqGroup[] = [
    {
        id: "getting-started",
        title: "Getting Started",
        items: [
            {
                q: "What is Tendso?",
                a: "Tendso is a platform that helps Filipino creators digitize local businesses. As a creator, you visit small businesses, collect their information through photos and interviews, and submit it through the app. We then generate a professional website for the business.",
            },
            {
                q: "How do I get certified?",
                a: "Complete the training lessons and pass the certification quiz with at least 4 out of 5 correct answers. Training covers lighting, audio, portrait photography, interview techniques, and submission requirements.",
            },
        ],
    },
    {
        id: "submissions",
        title: "Submissions",
        items: [
            {
                q: "How do I submit a business?",
                a: "Follow the 4-step process: 1) Enter business information, 2) Upload at least 3 photos (portrait, location, product), 3) Record a video or audio interview, 4) Review and submit.",
            },
            {
                q: "What happens after I submit?",
                a: "Your submission enters review (24–48 hours). If approved, we generate a website for the business. Once the business owner pays, you receive your payout.",
            },
            {
                q: "What are the photo requirements?",
                a: "You need at least 3 photos: a portrait of the business owner, the business location/exterior, and a product or craft shot. Make sure photos are well-lit and clear.",
            },
            {
                q: "Can I edit a draft submission?",
                a: "Yes, you can continue editing any draft submission from the Submissions page. Drafts are saved automatically.",
            },
        ],
    },
    {
        id: "earnings",
        title: "Earnings & Payments",
        items: [
            {
                q: "How much do I earn per submission?",
                a: "You earn ₱500 per submission (50% of the sale price) once the business owner pays.",
            },
            {
                q: "How do referral bonuses work?",
                a: "Share your referral code with other creators. When a referred creator's first submission is approved and paid, you earn a ₱1,000 bonus.",
            },
            {
                q: "When do I get paid?",
                a: "Payouts are processed via bank transfer or e-wallet. You can withdraw once your available balance reaches ₱100. Processing typically takes 1–3 business days.",
            },
        ],
    },
    {
        id: "account",
        title: "Account & Support",
        items: [
            {
                q: "How do I reset my password?",
                a: "Go to Profile → Change Password, or use the 'Forgot Password' link on the login screen.",
            },
            {
                q: "How do I update my profile?",
                a: "Go to Profile → Edit Profile to update your name, phone number, or profile photo.",
            },
            {
                q: "I'm having technical issues",
                a: "Try refreshing the page and clearing your browser cache. If the issue persists, email us at frmwrkd.media@gmail.com.",
            },
        ],
    },
];

function FaqList({ items }: { items: FaqItem[] }) {
    const [openIdx, setOpenIdx] = useState(0);
    return (
        <div style={{ borderTop: "1px solid var(--neo-rule-strong)" }}>
            {items.map((qa, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--neo-rule)" }}>
                    <button
                        type="button"
                        onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
                        style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "22px 0",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 24,
                            border: 0,
                            background: "transparent",
                            color: "var(--neo-ink)",
                            cursor: "pointer",
                        }}
                    >
                        <span
                            style={{
                                fontFamily: "var(--neo-serif)",
                                fontSize: 22,
                                lineHeight: 1.3,
                                letterSpacing: "-.01em",
                            }}
                        >
                            {qa.q}
                        </span>
                        <span
                            style={{
                                fontFamily: "var(--neo-mono)",
                                fontSize: 16,
                                transform: openIdx === i ? "rotate(45deg)" : "rotate(0deg)",
                                transition: "transform .2s ease",
                                color: "var(--neo-ink-3)",
                                flexShrink: 0,
                            }}
                        >
                            +
                        </span>
                    </button>
                    {openIdx === i && (
                        <p
                            style={{
                                margin: 0,
                                paddingBottom: 22,
                                paddingRight: 48,
                                fontSize: 15,
                                color: "var(--neo-ink-2)",
                                lineHeight: 1.6,
                            }}
                        >
                            {qa.a}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function HelpFaqPage() {
    const [activeId, setActiveId] = useState<string>(GROUPS[0].id);
    const active = GROUPS.find((g) => g.id === activeId) ?? GROUPS[0];

    return (
        <div className="neo min-h-screen overflow-x-hidden">
            <Navbar />

            <main>
                {/* Hero / breadcrumb */}
                <section style={{ paddingTop: 56, paddingBottom: 24 }}>
                    <div className="container-wide">
                        {/* Explicit back-to-landing — replaces the old browser-history back
                            arrow that was sending people to /dashboard (Clerk-gated). */}
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
                            <div className="eyebrow">§ Help</div>
                            <div>
                                <h1 className="display-2">
                                    Questions, <em style={{ fontStyle: "italic" }}>answered.</em>
                                </h1>
                                <p className="lede" style={{ marginTop: 12 }}>
                                    Everything you need to know about creating, submitting, getting paid, and managing your account.
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
                                    {GROUPS.map((g) => (
                                        <Pill
                                            key={g.id}
                                            active={activeId === g.id}
                                            onClick={() => setActiveId(g.id)}
                                        >
                                            {g.title}
                                        </Pill>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Active group */}
                <section style={{ paddingTop: 0, paddingBottom: 64 }}>
                    <div className="container-wide">
                        <div style={{ maxWidth: 880, margin: "0 auto" }}>
                            <FaqList items={active.items} />
                        </div>
                    </div>
                </section>

                {/* Inline contact CTA — answers the "still stuck?" case */}
                <section style={{ paddingTop: 24, paddingBottom: 96 }}>
                    <div className="container-wide">
                        <div
                            className="card"
                            style={{
                                maxWidth: 880,
                                margin: "0 auto",
                                padding: "28px 32px",
                                display: "flex",
                                gap: 24,
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                            }}
                        >
                            <div>
                                <div className="label" style={{ marginBottom: 6 }}>Still stuck?</div>
                                <div
                                    className="serif"
                                    style={{
                                        fontSize: 24,
                                        lineHeight: 1.2,
                                        letterSpacing: "-.01em",
                                    }}
                                >
                                    Talk to a human.
                                </div>
                            </div>
                            <Link
                                href="/contact"
                                className="door"
                                style={{
                                    textDecoration: "none",
                                    display: "inline-flex",
                                }}
                            >
                                Contact us
                            </Link>
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
