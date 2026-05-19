"use client";

const STEPS = [
    {
        k: "01",
        h: "Creator visits the shop",
        sub: "A trained Negosyo creator walks in with a phone and a checklist. 30 minutes of questions, coffee on you.",
    },
    {
        k: "02",
        h: "Photos get processed",
        sub: "Their shots go through our auto-grading pipeline. Color, crop, exposure — leveled to a national standard.",
    },
    {
        k: "03",
        h: "Copy gets written",
        sub: "Your story, in your voice, shaped by our editors. Translated automatically into every locale you serve.",
    },
    {
        k: "04",
        h: "Your Online Kit ships",
        sub: "Website. Domain. Hosting. SEO. Social-ready assets. Auto-generated menu and price list. Not a homepage — a full kit.",
    },
];

const ICONS: Record<string, React.ReactElement> = {
    "01": (
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <path d="M24 6 C16 6 10 12 10 20 C10 30 24 42 24 42 C24 42 38 30 38 20 C38 12 32 6 24 6 Z" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="24" cy="20" r="4" fill="currentColor" />
        </svg>
    ),
    "02": (
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="14" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 14 L18 10 L30 10 L32 14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="24" cy="26" r="6" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="24" cy="26" r="2" fill="currentColor" />
        </svg>
    ),
    "03": (
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <path d="M10 12 H38" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 20 H32" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 28 H36" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 36 H22" stroke="currentColor" strokeWidth="1.5" />
            <path d="M28 32 L36 40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    "04": (
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="8" width="32" height="32" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 16 H40" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="13" cy="12" r="1" fill="currentColor" />
            <circle cx="17" cy="12" r="1" fill="currentColor" />
            <path d="M14 24 H28" stroke="currentColor" strokeWidth="1.5" />
            <path d="M14 30 H34" stroke="currentColor" strokeWidth="1.5" />
            <path d="M14 36 H24" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
};

export default function ProcessSection() {
    return (
        <section style={{ padding: "96px 0" }}>
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">§ Process</div>
                    <div>
                        <h2 className="display-2">
                            We don&apos;t ship websites. <em style={{ fontStyle: "italic" }}>We ship Online Kits.</em>
                        </h2>
                        <p className="lede" style={{ marginTop: 12 }}>
                            Four moves, one outcome. The business owner answers questions. Everything else happens off-stage.
                        </p>
                    </div>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 16,
                        alignItems: "stretch",
                    }}
                >
                    {STEPS.map((s, i) => {
                        const highlight = i === 3;
                        return (
                            <div
                                key={s.k}
                                className="card"
                                style={{
                                    padding: 24,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 16,
                                    background: highlight ? "var(--neo-ink)" : "var(--neo-paper-3)",
                                    color: highlight ? "var(--neo-paper)" : "var(--neo-ink)",
                                    borderColor: highlight ? "var(--neo-ink)" : "var(--neo-rule)",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span
                                        className="counter-num"
                                        style={{
                                            fontSize: 28,
                                            color: highlight ? "var(--neo-creator)" : "var(--neo-ink-3)",
                                        }}
                                    >
                                        {s.k}
                                    </span>
                                    <span style={{ color: highlight ? "oklch(72% 0.008 85)" : "var(--neo-ink-3)" }}>
                                        {ICONS[s.k]}
                                    </span>
                                </div>
                                <div
                                    className="serif"
                                    style={{ fontSize: 24, lineHeight: 1.15, letterSpacing: "-.015em" }}
                                >
                                    {s.h}
                                </div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: highlight ? "oklch(80% 0.008 85)" : "var(--neo-ink-2)",
                                        lineHeight: 1.55,
                                        marginTop: "auto",
                                    }}
                                >
                                    {s.sub}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div
                    style={{
                        marginTop: 32,
                        padding: "20px 28px",
                        border: "1px dashed var(--neo-rule-strong)",
                        borderRadius: "var(--neo-r-lg)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span className="label">An Online Kit includes</span>
                        {["Website", "Domain", "Hosting", "SEO", "Social assets", "Menu / pricelist", "Open-graph card"].map((t) => (
                            <span key={t} className="tag">{t}</span>
                        ))}
                    </div>
                    <span className="label" style={{ color: "var(--neo-creator)" }}>48 – 72 hours, end to end ↗</span>
                </div>
            </div>
        </section>
    );
}
