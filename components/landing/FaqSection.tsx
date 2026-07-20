"use client";

import { useEffect, useState } from "react";
import { FAQ_BUSINESS, FAQ_CREATOR } from "./landingData";
import { Pill } from "./landingPrimitives";

export default function FaqSection() {
    const [tab, setTab] = useState<"creators" | "business">("business");
    const [open, setOpen] = useState(0);
    const list = tab === "creators" ? FAQ_CREATOR : FAQ_BUSINESS;

    useEffect(() => {
        setOpen(0);
    }, [tab]);

    return (
        <section id="faq">
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">Questions</div>
                    <div>
                        <h2 className="display-2">
                            Questions <em>worth asking.</em>
                        </h2>
                        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
                            <Pill active={tab === "business"} onClick={() => setTab("business")}>
                                For business owners
                            </Pill>
                            <Pill active={tab === "creators"} onClick={() => setTab("creators")}>
                                For creators
                            </Pill>
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        maxWidth: 880,
                        margin: "0 auto",
                        borderTop: "1px solid var(--neo-rule-strong)",
                    }}
                >
                    {list.map((qa, i) => (
                        <div key={i} style={{ borderBottom: "1px solid var(--neo-rule)" }}>
                            <button
                                onClick={() => setOpen(open === i ? -1 : i)}
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "24px 0",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "baseline",
                                    gap: 24,
                                    border: 0,
                                    background: "transparent",
                                    color: "var(--neo-ink)",
                                    cursor: "pointer",
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: "var(--neo-serif)",
                                        fontSize: 24,
                                        lineHeight: 1.25,
                                        letterSpacing: "-.01em",
                                    }}
                                >
                                    {qa.q}
                                </span>
                                <span
                                    style={{
                                        fontFamily: "var(--neo-mono)",
                                        fontSize: 16,
                                        transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                                        transition: "transform .2s ease",
                                        color: "var(--neo-ink-3)",
                                    }}
                                >
                                    +
                                </span>
                            </button>
                            {open === i && (
                                <p
                                    style={{
                                        margin: 0,
                                        paddingBottom: 24,
                                        paddingRight: 60,
                                        fontSize: 16,
                                        color: "var(--neo-ink-2)",
                                        lineHeight: 1.6,
                                    }}
                                >
                                    {qa.a}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
