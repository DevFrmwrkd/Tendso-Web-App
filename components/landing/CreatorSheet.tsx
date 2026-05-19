"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Creator } from "./landingData";
import { Avatar, ArrowUpRightIcon } from "./landingPrimitives";

function Stat({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
    return (
        <div style={{ padding: "16px 18px", borderRight: "1px solid var(--neo-rule)" }}>
            <div className="label" style={{ marginBottom: 8 }}>{label}</div>
            <div
                className="serif"
                style={{
                    fontSize: small ? 16 : 26,
                    lineHeight: 1.0,
                    letterSpacing: "-.01em",
                }}
            >
                {value}
            </div>
        </div>
    );
}

export default function CreatorSheet({
    creator,
    onClose,
}: {
    creator: Creator | null;
    onClose: () => void;
}) {
    useEffect(() => {
        if (!creator) return;
        const k = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", k);
        return () => window.removeEventListener("keydown", k);
    }, [creator, onClose]);

    const open = !!creator;
    const C = creator;

    return (
        <>
            <div
                className={`sheet-backdrop ${open ? "open" : ""}`}
                onClick={onClose}
            ></div>
            <aside className={`sheet sheet-desktop ${open ? "open" : ""}`}>
                <div
                    style={{
                        padding: 32,
                        height: "100%",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 32,
                        }}
                    >
                        <span className="label">Creator profile</span>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            style={{
                                width: 32,
                                height: 32,
                                border: "1px solid var(--neo-rule)",
                                background: "var(--neo-paper-3)",
                                color: "var(--neo-ink)",
                                cursor: "pointer",
                                fontSize: 14,
                                borderRadius: 8,
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {C && (
                        <>
                            <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 32 }}>
                                <Avatar name={C.name} hue={C.hue} size={72} />
                                <div>
                                    <div className="display-3" style={{ marginBottom: 4 }}>
                                        {C.name}<span style={{ color: "var(--neo-ink-3)" }}>, {C.city}</span>
                                    </div>
                                    <div
                                        className="label"
                                        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                                    >
                                        <span className="live-dot"></span>
                                        {C.response}
                                    </div>
                                </div>
                            </div>

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr 1fr",
                                    border: "1px solid var(--neo-rule)",
                                    marginBottom: 32,
                                    borderRadius: "var(--neo-r-md)",
                                    overflow: "hidden",
                                }}
                            >
                                <Stat label="Business submissions" value={C.sites} />
                                <Stat label="Languages" value={C.langs.join(" · ")} small />
                                <Stat label="Distance" value="~ km" small />
                            </div>

                            <div className="label" style={{ marginBottom: 12 }}>Recent work</div>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1,
                                    marginBottom: 32,
                                    background: "var(--neo-rule)",
                                    borderRadius: "var(--neo-r-md)",
                                    overflow: "hidden",
                                }}
                            >
                                {C.samples.map((s, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            background: "var(--neo-paper-3)",
                                            padding: "14px 16px",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{s}</div>
                                            <div className="label" style={{ marginTop: 2 }}>Live · client site</div>
                                        </div>
                                        <div
                                            style={{
                                                fontFamily: "var(--neo-mono)",
                                                fontSize: 11,
                                                color: "var(--neo-ink-3)",
                                            }}
                                        >
                                            →
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div
                                style={{
                                    padding: "16px 0",
                                    borderTop: "1px solid var(--neo-rule)",
                                    borderBottom: "1px solid var(--neo-rule)",
                                    marginBottom: 32,
                                    fontSize: 14,
                                    color: "var(--neo-ink-2)",
                                    lineHeight: 1.6,
                                }}
                            >
                                <strong style={{ color: "var(--neo-ink)" }}>{C.name}</strong> interviews in {C.langs.join(", ")}, shoots on a recent phone, and ships sites that work on a 3G connection.
                            </div>

                            <div style={{ marginTop: "auto", paddingTop: 16 }}>
                                <Link
                                    href="/signup"
                                    className="door door-creator"
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        textDecoration: "none",
                                    }}
                                >
                                    <span>
                                        <span className="meta">Highest-intent path</span>
                                        Get the app to hire {C.name}
                                    </span>
                                    <span className="arrow"><ArrowUpRightIcon /></span>
                                </Link>
                                <p className="label" style={{ marginTop: 12, textAlign: "center" }}>
                                    Booking opens inside the app · {C.name}&apos;s ID is pre-attached
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </aside>
        </>
    );
}
