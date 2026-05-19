"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, ArrowUpRightIcon } from "./landingPrimitives";

export default function StickyCTA({ door = null }: { door?: "business" | "creator" | null }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 640);
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className={`sticky-cta ${visible ? "visible" : ""}`}>
            <div
                className="container-wide"
                style={{
                    padding: "14px 28px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Logo />
                    {door && (
                        <span className="label" style={{ color: "var(--neo-ink-3)" }}>
                            You picked the{" "}
                            <strong
                                style={{
                                    color: door === "creator" ? "var(--neo-creator)" : "var(--neo-business)",
                                }}
                            >
                                {door}
                            </strong>{" "}
                            door.
                        </span>
                    )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link
                        href="/for-business"
                        className="door door-business"
                        style={{
                            padding: "12px 18px",
                            fontSize: 14,
                            textDecoration: "none",
                            display: "inline-flex",
                        }}
                    >
                        I own a business <span className="arrow"><ArrowUpRightIcon /></span>
                    </Link>
                    <Link
                        href="/for-creators"
                        className="door door-creator"
                        style={{
                            padding: "12px 18px",
                            fontSize: 14,
                            textDecoration: "none",
                            display: "inline-flex",
                        }}
                    >
                        I want to earn <span className="arrow"><ArrowUpRightIcon /></span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
