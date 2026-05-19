"use client";

export default function ReferralBanner({
    refName,
    refCity,
    onDismiss,
}: {
    refName: string;
    refCity: string;
    onDismiss: () => void;
}) {
    return (
        <div
            style={{
                background: "var(--neo-creator-bg)",
                borderBottom: "1px solid var(--neo-rule)",
                padding: "10px 0",
            }}
        >
            <div
                className="container-wide"
                style={{
                    padding: "0 48px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
                    <span className="tag" style={{ background: "var(--neo-paper-3)" }}>
                        Invited
                    </span>
                    <span>
                        You were invited by{" "}
                        <strong
                            style={{
                                fontFamily: "var(--neo-serif)",
                                fontStyle: "italic",
                                fontWeight: 400,
                                fontSize: 18,
                            }}
                        >
                            {refName}
                        </strong>{" "}
                        from <strong>{refCity}</strong>.
                        <span style={{ color: "var(--neo-ink-3)", marginLeft: 8 }}>
                            Their credit is attached for the next 30 days.
                        </span>
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    style={{
                        border: 0,
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 18,
                        color: "var(--neo-ink-3)",
                        padding: 4,
                    }}
                >
                    ×
                </button>
            </div>
        </div>
    );
}
