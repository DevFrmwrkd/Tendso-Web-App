"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { LiveBusiness } from "./landingData";
import { ArrowUpRightIcon } from "./landingPrimitives";

export default function BusinessSheet({
    business,
    onClose,
}: {
    business: LiveBusiness | null;
    onClose: () => void;
}) {
    useEffect(() => {
        if (!business) return;
        const k = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", k);
        return () => window.removeEventListener("keydown", k);
    }, [business, onClose]);

    const open = !!business;
    const B = business;

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
                        <span className="label">Business · live site</span>
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

                    {B && (
                        <>
                            <div
                                className={B.src ? "ar-16x9" : "stripes ar-16x9"}
                                style={{
                                    border: "1px solid var(--neo-rule)",
                                    marginBottom: 20,
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "flex-end",
                                    borderRadius: "var(--neo-r-md)",
                                    overflow: "hidden",
                                    backgroundImage: B.src ? `url(${B.src})` : undefined,
                                    backgroundSize: "cover",
                                    backgroundPosition: "top center",
                                }}
                            >
                                {/* Live badge — sits on top of the screenshot */}
                                <div
                                    style={{
                                        margin: 12,
                                        padding: "6px 10px",
                                        background: "var(--neo-ink)",
                                        color: "var(--neo-paper)",
                                        fontFamily: "var(--neo-mono)",
                                        fontSize: 10,
                                        letterSpacing: ".08em",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    <span className="live-dot" style={{ marginRight: 6 }}></span>
                                    Live
                                </div>
                            </div>

                            <div className="display-3" style={{ marginBottom: 6 }}>{B.name}</div>
                            <div
                                style={{
                                    color: "var(--neo-ink-3)",
                                    marginBottom: 24,
                                    fontSize: 14,
                                    display: "flex",
                                    gap: 10,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                }}
                            >
                                <span className="tag">{B.category}</span>
                                <span>{B.city}</span>
                            </div>

                            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                                <a
                                    href={B.liveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="door"
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        textDecoration: "none",
                                    }}
                                >
                                    <span>
                                        <span className="meta">Strongest possible proof</span>
                                        Visit live site
                                    </span>
                                    <span className="arrow"><ArrowUpRightIcon /></span>
                                </a>
                                <Link
                                    href="/for-business"
                                    className="door door-business"
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        textDecoration: "none",
                                    }}
                                >
                                    <span>
                                        <span className="meta">Want one of these?</span>
                                        Get the app to find a creator
                                    </span>
                                    <span className="arrow"><ArrowUpRightIcon /></span>
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </aside>
        </>
    );
}
