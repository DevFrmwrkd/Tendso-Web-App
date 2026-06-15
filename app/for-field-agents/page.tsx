import type { Metadata } from "next";
import Link from "next/link";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";

import EarningsSection from "@/components/landing/EarningsSection";
import FaqSection from "@/components/landing/FaqSection";
import CtaSection from "@/components/landing/CtaSection";
import ChatBot from "@/components/landing/ChatBot";

import { ArrowUpRightIcon } from "@/components/landing/landingPrimitives";
import { BASE_PRICE, PRICE_CEILING, commissionFor, formatPHP } from "@/lib/pricing";

export const metadata: Metadata = {
    title: "Become a Tendso Field Agent — Get Paid to Put Local Shops Online",
    description:
        "We're hiring field agents. Visit local businesses, run a short interview, and earn 50% of every website you sell — ₱500 to start, up to ₱2,500 as you grow. Part-time, free to apply, paid via Wise. A real Philippine company (VONAS, OPC).",
    alternates: { canonical: "/for-field-agents" },
    openGraph: {
        title: "Become a Tendso Field Agent",
        description:
            "Get paid to put local shops online. Earn 50% of every sale — ₱500 to start, up to ₱2,500. Part-time, paid via Wise.",
        url: "/for-field-agents",
    },
};

// The Discord onboarding/coaching server invite. NEXT_PUBLIC_DISCORD_INVITE_URL
// overrides this in any environment; the default is the live field-agent server.
const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/Dxjt9HV5B";

const STARTER_PAYOUT = commissionFor(BASE_PRICE); // ₱500 (50% of ₱999)
const TOP_PAYOUT = commissionFor(PRICE_CEILING); // ₱2,500 (50% of ₱4,999)

const FIELD_STEPS = [
    {
        n: "01",
        h: "Apply & get certified",
        sub: "Sign up free. Verify your phone and ID, then take a short certification — twelve quick videos, a photo quiz, and an interview rehearsal. Retry as many times as you need.",
        meta: "~20 min",
    },
    {
        n: "02",
        h: "Walk into a local shop",
        sub: "A barber, a carinderia, a salon, an auto-repair — anyone already working but not online. The app gives you the script, the questions, and the photo checklist.",
        meta: "your area",
    },
    {
        n: "03",
        h: "Run a 30-minute interview",
        sub: "Record a short video or audio while the owner keeps working, snap 3–5 photos, and submit. Tendso's AI builds a real coded website from it in 48 hours.",
        meta: "30 min",
    },
    {
        n: "04",
        h: "Owner approves & pays",
        sub: "The owner only pays once the site is live and they've approved it — so you're never selling vapor. The price starts at ₱999 and you set it higher as you build a track record.",
        meta: "48 hr",
    },
    {
        n: "05",
        h: "Get paid — 50% of the sale",
        sub: `${formatPHP(STARTER_PAYOUT)} lands in your Wise wallet on your first sales. Close five and you unlock higher pricing — up to ${formatPHP(PRICE_CEILING)} a site, ${formatPHP(TOP_PAYOUT)} to you.`,
        meta: "via Wise",
    },
];

const TRUST_POINTS = [
    {
        h: "A registered Philippine company",
        b: "Tendso is operated by VONAS, OPC. Payouts go straight to your own Wise account — we never ask you for money to start.",
    },
    {
        h: "The owner pays only when it's live",
        b: "No upfront fee, no deposit. The business owner reviews the finished website and pays only after they approve it. Nothing to pay, nothing to lose.",
    },
    {
        h: "You keep what you earn",
        b: `Half of every sale is yours — ${formatPHP(STARTER_PAYOUT)} at the ₱999 starter price, up to ${formatPHP(TOP_PAYOUT)} as you unlock higher pricing. Plus ₱1,000 for every creator you refer.`,
    },
    {
        h: "Part-time, on your schedule",
        b: "Keep your day job. There's no quota and no minimum. Pick the shops you visit and the pace you work at.",
    },
];

function FieldAgentHero() {
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
                            We&apos;re hiring field agents
                        </div>
                        <h1 className="display" style={{ fontSize: "clamp(52px, 7vw, 112px)" }}>
                            Get paid to put <em style={{ fontStyle: "italic", color: "var(--neo-creator)" }}>local shops</em> online.
                        </h1>
                        <p className="lede" style={{ marginTop: 28, fontSize: 19, maxWidth: "58ch" }}>
                            Walk into a business near you, run a short interview, and earn <strong>50% of every website you sell</strong> —
                            {" "}{formatPHP(STARTER_PAYOUT)} to start, up to {formatPHP(TOP_PAYOUT)} as you grow. We handle the building, the
                            hosting, and the payouts. You bring the hustle.
                        </p>

                        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <Link
                                href="/signup"
                                className="door door-creator"
                                style={{ textDecoration: "none", display: "inline-flex" }}
                            >
                                Apply now <span className="arrow"><ArrowUpRightIcon /></span>
                            </Link>
                            <Link
                                href={DISCORD_INVITE_URL}
                                className="door door-ghost"
                                style={{ textDecoration: "none", display: "inline-flex" }}
                            >
                                Join the Discord
                            </Link>
                        </div>
                        <p className="label" style={{ marginTop: 16, color: "var(--neo-ink-3)" }}>
                            Free to apply · No experience needed · Paid via Wise
                        </p>
                    </div>

                    <div className="surface" style={{ padding: 24 }}>
                        <div className="label" style={{ marginBottom: 16 }}>What you earn</div>
                        {[
                            ["Per sale (50% of price)", formatPHP(STARTER_PAYOUT)],
                            ["Once you unlock higher pricing", `up to ${formatPHP(TOP_PAYOUT)}`],
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
                                    gap: 12,
                                }}
                            >
                                <span>{label}</span>
                                <span
                                    className="counter-num"
                                    style={{
                                        fontSize: 20,
                                        textAlign: "right",
                                        color: v.startsWith("₱") || v.startsWith("up to ₱") ? "var(--neo-creator)" : "var(--neo-ink-3)",
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

function TrustSection() {
    return (
        <section style={{ background: "var(--neo-paper-2)" }}>
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">§ Is this legit?</div>
                    <div>
                        <h2 className="display-2">
                            A real job, <em>not a scam</em>.
                        </h2>
                        <p className="lede" style={{ marginTop: 12 }}>
                            Fair question — anyone can promise easy money online. Here&apos;s exactly how Tendso works, so you can
                            decide for yourself before you knock on a single door.
                        </p>
                    </div>
                </div>

                <div
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    style={{ maxWidth: 1080, margin: "0 auto" }}
                >
                    {TRUST_POINTS.map((p) => (
                        <div key={p.h} className="card" style={{ padding: "28px 28px 24px" }}>
                            <h3 className="serif" style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 10 }}>
                                {p.h}
                            </h3>
                            <p style={{ fontSize: 15, color: "var(--neo-ink-2)", lineHeight: 1.6 }}>{p.b}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function FieldStepsSection() {
    return (
        <section>
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">§ How it works</div>
                    <div>
                        <h2 className="display-2">
                            From the street <em>to your wallet</em>.
                        </h2>
                        <p className="lede" style={{ marginTop: 12 }}>
                            Five steps. The app guides every one of them, with the time each actually takes.
                        </p>
                    </div>
                </div>

                <div className="surface" style={{ padding: 0 }}>
                    {FIELD_STEPS.map((s, i) => (
                        <div
                            key={s.n}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "80px 1fr 1fr 140px",
                                gap: 32,
                                padding: "28px 32px",
                                borderTop: i === 0 ? "none" : "1px solid var(--neo-rule)",
                                alignItems: "baseline",
                            }}
                        >
                            <div className="counter-num" style={{ fontSize: 32, color: "var(--neo-creator)" }}>{s.n}</div>
                            <div className="serif" style={{ fontSize: 24, lineHeight: 1.15, letterSpacing: "-.015em" }}>
                                {s.h}
                            </div>
                            <div style={{ fontSize: 14, color: "var(--neo-ink-2)", lineHeight: 1.55, maxWidth: "44ch" }}>
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
                        <span>Apply now</span>
                        <span className="arrow"><ArrowUpRightIcon /></span>
                    </Link>
                </div>
            </div>
        </section>
    );
}

export default function ForFieldAgentsPage() {
    return (
        <div className="neo min-h-screen overflow-x-hidden">
            <Navbar />
            <main>
                <FieldAgentHero />
                <TrustSection />
                <FieldStepsSection />
                <EarningsSection />
                <FaqSection />
                <CtaSection />
            </main>
            <Footer />
            <ChatBot />
            <ScrollToTop />
        </div>
    );
}
