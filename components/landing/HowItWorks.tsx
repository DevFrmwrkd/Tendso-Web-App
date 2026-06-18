"use client";

function Track({
    label,
    steps,
    kind,
}: {
    label: string;
    steps: string[];
    kind: "business" | "creator";
}) {
    const bg = kind === "creator" ? "var(--neo-creator-bg)" : "var(--neo-business-bg)";
    const ink = kind === "creator" ? "var(--neo-creator-ink)" : "var(--neo-business-ink)";
    return (
        <div className="card" style={{ background: "var(--neo-paper-3)", padding: "40px 32px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
                <span
                    style={{
                        padding: "4px 10px",
                        background: bg,
                        color: ink,
                        fontFamily: "var(--neo-mono)",
                        fontSize: 10,
                        letterSpacing: ".12em",
                        textTransform: "uppercase",
                        borderRadius: 999,
                    }}
                >
                    {label}
                </span>
            </div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                {steps.map((s, i) => (
                    <li
                        key={i}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "44px 1fr",
                            alignItems: "baseline",
                            padding: "20px 0",
                            borderTop: "1px solid var(--neo-rule)",
                        }}
                    >
                        <span
                            style={{
                                fontFamily: "var(--neo-mono)",
                                fontSize: 12,
                                color: ink,
                                letterSpacing: ".05em",
                            }}
                        >
                            0{i + 1}
                        </span>
                        <span
                            style={{
                                fontFamily: "var(--neo-serif)",
                                fontSize: 22,
                                lineHeight: 1.2,
                                letterSpacing: "-.01em",
                            }}
                        >
                            {s}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export default function HowItWorks({ door = null }: { door?: "business" | "creator" | null }) {
    const business = [
        "Sign up — no card required until your site is live.",
        "Pick a creator nearby. Or let one find you.",
        "Sit for a short interview. 30 minutes, your shop.",
        "Approve your site. Pay only once it's live (₱999 or ₱1,499).",
    ];
    const creator = [
        "Download the app and verify your phone.",
        "Get certified — free, fast, in 20 minutes.",
        "Visit local businesses with guided capture.",
        "Keep 50% of every sale — ₱500 to ₱2,500 per site · ₱1,000 referral.",
    ];
    const businessFirst = door !== "creator";

    return (
        <section id="how-it-works" style={{ background: "var(--neo-paper-2)" }}>
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">§ 03 — How It Works</div>
                    <div>
                        <h2 className="display-2">
                            Two flows. <em style={{ color: "var(--neo-creator)", fontStyle: "italic" }}>Side by side.</em>
                        </h2>
                        <p className="lede" style={{ marginTop: 12 }}>
                            Pick yours. The other one is for someone else. That&apos;s the entire point of this page.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Track
                        label={businessFirst ? "For business owners" : "For creators"}
                        steps={businessFirst ? business : creator}
                        kind={businessFirst ? "business" : "creator"}
                    />
                    <Track
                        label={businessFirst ? "For creators" : "For business owners"}
                        steps={businessFirst ? creator : business}
                        kind={businessFirst ? "creator" : "business"}
                    />
                </div>
            </div>
        </section>
    );
}
