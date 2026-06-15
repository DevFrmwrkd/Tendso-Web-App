import type { Metadata } from "next";
import Link from "next/link";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";
import ConnectAiForm from "./ConnectAiForm";

// NOTE: /connect-ai is intentionally NOT in middleware.ts's public-route
// allowlist, so Clerk's clerkMiddleware redirects logged-out visitors to
// sign-in. The whole page (how-to + key input) is therefore logged-in only.
export const metadata: Metadata = {
    title: "Connect your AI key — Tendso",
    description: "Add your free Google Gemini API key to power Tendso AI for the knowledge base and Discord /ask.",
    robots: { index: false, follow: false },
};

const STEPS = [
    {
        n: "01",
        h: "Open Google AI Studio",
        sub: "Go to aistudio.google.com/apikey and sign in with any Google account. It's free — no billing and no credit card needed.",
    },
    {
        n: "02",
        h: "Create an API key",
        sub: "Click “Create API key”. If it asks, let it create a new project for you. Your key appears right away.",
    },
    {
        n: "03",
        h: "Copy the key",
        sub: "It starts with “AIza…”. Copy the whole thing. You can always generate a fresh one later if you need to.",
    },
    {
        n: "04",
        h: "Paste it below",
        sub: "Drop it in the box and save. That's it — your key now powers Tendso AI and the Discord /ask bot.",
    },
];

export default function ConnectAiPage() {
    return (
        <div className="neo min-h-screen overflow-x-hidden">
            <Navbar />
            <main>
                <section style={{ paddingTop: 56, paddingBottom: 16 }}>
                    <div className="container-text">
                        <Link
                            href="/for-field-agents"
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
                            Field agents
                        </Link>
                        <div className="eyebrow">§ Tendso AI — bring your own key</div>
                        <h1 className="display-2">
                            Power <em>Tendso AI</em> with a free key.
                        </h1>
                        <p className="lede" style={{ marginTop: 12 }}>
                            Tendso AI answers questions in the knowledge base and on Discord (<strong>/ask</strong>). It runs on a free
                            Google Gemini key that you provide — roughly 500 questions a day, at no cost to you. Add yours below and
                            you&apos;ll be powering the assistant for the whole team.
                        </p>
                    </div>
                </section>

                <section style={{ paddingBottom: 16 }}>
                    <div className="container-text">
                        <div className="eyebrow" style={{ marginBottom: 16 }}>
                            How to get your free key
                        </div>
                        <div style={{ display: "grid", gap: 12 }}>
                            {STEPS.map((s) => (
                                <div key={s.n} className="card" style={{ padding: 20, display: "flex", gap: 16, alignItems: "flex-start" }}>
                                    <span
                                        className="serif"
                                        style={{ fontSize: 26, lineHeight: 1, color: "var(--neo-creator)", flexShrink: 0, fontStyle: "italic" }}
                                    >
                                        {s.n}
                                    </span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 16 }}>{s.h}</div>
                                        <p style={{ margin: "4px 0 0", color: "var(--neo-ink-2)", fontSize: 14, lineHeight: 1.55 }}>{s.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <a
                            href="https://aistudio.google.com/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="door door-creator"
                            style={{ marginTop: 16, display: "inline-flex", textDecoration: "none" }}
                        >
                            Open Google AI Studio ↗
                        </a>
                    </div>
                </section>

                <section style={{ paddingBottom: 80, paddingTop: 8 }}>
                    <div className="container-text">
                        <ConnectAiForm />
                    </div>
                </section>
            </main>
            <Footer />
            <ScrollToTop />
        </div>
    );
}
