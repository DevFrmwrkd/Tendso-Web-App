"use client";

import Link from "next/link";
import { ArrowUpRightIcon } from "./landingPrimitives";
import { useT } from "./i18n";

export default function CtaSection() {
    const { t } = useT();
    return (
        <section
            style={{
                background: "var(--neo-ink)",
                color: "var(--neo-paper)",
                padding: "140px 0 120px",
            }}
        >
            <div className="container-wide">
                <div style={{ textAlign: "center", marginBottom: 64 }}>
                    <div
                        className="eyebrow"
                        style={{ marginBottom: 24, color: "var(--neo-creator)" }}
                    >
                        The vision
                    </div>
                    <h2
                        className="display"
                        style={{
                            fontSize: "clamp(56px, 8.5vw, 140px)",
                            color: "var(--neo-paper)",
                        }}
                    >
                        The Thinking
                        <br />
                        Ends Here.
                        <br />
                        <em style={{ fontStyle: "italic", color: "var(--neo-creator)" }}>So the work doesn&apos;t.</em>
                    </h2>
                    <p
                        className="lede"
                        style={{
                            marginTop: 32,
                            color: "oklch(80% 0.008 85)",
                            maxWidth: "50ch",
                            margin: "32px auto 0",
                            textAlign: "center",
                            fontSize: 18,
                        }}
                    >
                        Pick the door that&apos;s yours. Your hands stay where they are.
                    </p>
                </div>
                <div
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    style={{
                        maxWidth: 1080,
                        margin: "0 auto",
                    }}
                >
                    <Link
                        href="/for-business"
                        className="door door-business"
                        style={{
                            padding: "28px 24px",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 0,
                            textDecoration: "none",
                            display: "inline-flex",
                        }}
                    >
                        <span className="meta" style={{ marginBottom: 24 }}>
                            For business owners <ArrowUpRightIcon />
                        </span>
                        <span
                            className="text-[32px] sm:text-[40px] lg:text-[48px]"
                            style={{
                                fontFamily: "var(--neo-serif)",
                                lineHeight: 0.98,
                                letterSpacing: "-.02em",
                            }}
                        >
                            {t("cta.business")}
                        </span>
                        <span style={{ fontSize: 13, opacity: 0.8, marginTop: 20 }}>
                            A page built around the work. A creator visits, you keep going, the site goes live.
                        </span>
                    </Link>
                    <Link
                        href="/for-creators"
                        className="door door-creator"
                        style={{
                            padding: "28px 24px",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 0,
                            textDecoration: "none",
                            display: "inline-flex",
                        }}
                    >
                        <span className="meta" style={{ marginBottom: 24 }}>
                            For creators <ArrowUpRightIcon />
                        </span>
                        <span
                            className="text-[32px] sm:text-[40px] lg:text-[48px]"
                            style={{
                                fontFamily: "var(--neo-serif)",
                                lineHeight: 0.98,
                                letterSpacing: "-.02em",
                            }}
                        >
                            {t("cta.creator")}
                        </span>
                        <span style={{ fontSize: 13, opacity: 0.8, marginTop: 20 }}>
                            Help owners who can't stop working. Real earnings, real referrals, paid in 48 hours.
                        </span>
                    </Link>
                </div>
            </div>
        </section>
    );
}
