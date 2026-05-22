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
            <div className="container-wide flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 py-3 sm:py-3.5">
                {/* Logo + door badge — hide logo on phones to save room for the CTA buttons */}
                <div className="hidden sm:flex items-center gap-3">
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
                <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                    <Link
                        href="/for-business"
                        className="door door-business justify-center sm:justify-start"
                        style={{
                            padding: "10px 14px",
                            fontSize: 13,
                            textDecoration: "none",
                            display: "inline-flex",
                            whiteSpace: "nowrap",
                        }}
                    >
                        <span className="hidden md:inline">I own a business</span>
                        <span className="md:hidden">Business</span>
                        <span className="arrow"><ArrowUpRightIcon /></span>
                    </Link>
                    <Link
                        href="/for-creators"
                        className="door door-creator justify-center sm:justify-start"
                        style={{
                            padding: "10px 14px",
                            fontSize: 13,
                            textDecoration: "none",
                            display: "inline-flex",
                            whiteSpace: "nowrap",
                        }}
                    >
                        <span className="hidden md:inline">I want to earn</span>
                        <span className="md:hidden">Earn</span>
                        <span className="arrow"><ArrowUpRightIcon /></span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
