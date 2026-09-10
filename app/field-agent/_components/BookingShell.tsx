"use client";

/**
 * The frame every Field Agent booking screen wears.
 *
 * From the "Booking Page v2" design: a dark header carrying the gold Tendso
 * pill and a step rail, a headline with one word in gold, a right-aligned run
 * of call facts, and a paper sheet that pulls up over the header with a 28px
 * rounded top. Colours are literals rather than app tokens because the design
 * carries its own palette; these pages ARE that design, not a variation on it.
 *
 * ONE COMPONENT SO THEY CANNOT DIVERGE. /field-agent/book and
 * /field-agent/manage are the same flow seen at two moments — making a booking
 * and moving one — and the second was briefly a plainer page of its own. If the
 * header changes, it changes for both.
 *
 * The page-level breakpoints live here too, since they describe this frame:
 * the hero stacking, the meta running as a row, the header wrapping.
 */

import type { ReactNode } from "react";

const INK = "#1B1B22";
const PAPER = "#F3F0EA";
const GOLD = "#D4A146";
const MUTED = "#8F8B83";
const MUTED_ON_INK = "#B9B5AD";
const CHIP_OFF = "#2A2A33";

export default function BookingShell({
    steps,
    activeStep,
    title,
    lede,
    subtitle,
    centered = false,
    children,
}: {
    /** Short labels for the step rail, e.g. ["Time", "Details", "Done"]. */
    steps: string[];
    /** Index of the step currently showing. */
    activeStep: number;
    /** The headline. Pass a fragment to colour a word gold. */
    title: ReactNode;
    /** One short line under the headline, in brighter type than the subtitle.
     *  For the fact that ranks second — the date, when the headline is a time.
     *  Buried mid-sentence in the subtitle it reads as preamble. */
    lede?: ReactNode;
    subtitle: string;
    /** Centre the sheet contents. For terminal screens — a confirmation is one
     *  short statement, and left-aligning it against 880px of paper leaves it
     *  stranded in the corner of a mostly empty page. */
    centered?: boolean;
    children: ReactNode;
}) {
    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: INK }}>
            <header className="fa-header" style={{ background: INK, color: PAPER, padding: "40px 24px 96px" }}>
                <div
                    style={{
                        maxWidth: 880,
                        margin: "0 auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 28,
                    }}
                >
                    <div
                        className="fa-headrow"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 16,
                        }}
                    >
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                background: GOLD,
                                padding: "7px 12px",
                                borderRadius: 999,
                            }}
                        >
                            {/* The design asks for an ink wordmark on the gold pill. The only
                                asset in the repo is the white one, so it is painted black —
                                brightness(0) keeps the lettering's alpha and drops its colour. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/tendso-logo.png"
                                alt="Tendso"
                                style={{ height: 12, width: "auto", display: "block", filter: "brightness(0)" }}
                            />
                        </span>
                        <div style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 600 }}>
                            {steps.map((label, i) => (
                                <span
                                    key={label}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: 999,
                                        background: i === activeStep ? GOLD : CHIP_OFF,
                                        color: i === activeStep ? INK : MUTED,
                                    }}
                                >
                                    {i + 1} · {label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div
                        className="fa-hero"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            gap: 24,
                            alignItems: "end",
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
                            <h1
                                style={{
                                    margin: 0,
                                    fontSize: "clamp(34px, 5vw, 52px)",
                                    lineHeight: 1.05,
                                    fontWeight: 800,
                                    letterSpacing: "-.025em",
                                    textWrap: "pretty",
                                }}
                            >
                                {title}
                            </h1>
                            {lede && (
                                <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: PAPER }}>
                                    {lede}
                                </p>
                            )}
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 16,
                                    lineHeight: 1.5,
                                    color: MUTED_ON_INK,
                                    textWrap: "pretty",
                                }}
                            >
                                {subtitle}
                            </p>
                        </div>
                        <div
                            className="fa-meta"
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                fontSize: 13,
                                color: MUTED_ON_INK,
                                textAlign: "right",
                            }}
                        >
                            <span>10 minutes</span>
                            <span>Philippine time · GMT+8</span>
                            <span>Google Meet</span>
                        </div>
                    </div>
                </div>
            </header>

            <main
                className="fa-main"
                style={{
                    flex: 1,
                    background: PAPER,
                    padding: "0 24px 72px",
                    borderRadius: "28px 28px 0 0",
                    marginTop: -28,
                    // A confirmation is a few lines against a sheet as tall as the
                    // viewport. Sitting it at the top leaves a field of empty paper
                    // underneath, so on those screens it floats in the middle of
                    // the space instead of at the top of it.
                    ...(centered
                        ? { display: "flex", flexDirection: "column" as const, justifyContent: "center" }
                        : null),
                }}
            >
                <div
                    style={{
                        maxWidth: centered ? 560 : 880,
                        margin: "0 auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 28,
                        paddingTop: centered ? 0 : 32,
                        color: INK,
                        ...(centered ? { alignItems: "center", textAlign: "center" as const } : null),
                    }}
                >
                    {children}
                </div>
            </main>

            <style>{`
                @media (max-width: 640px) {
                    .fa-header { padding: 28px 20px 88px !important; }
                    .fa-main { padding: 0 20px 56px !important; }
                    /* Headline over meta, both left-aligned: the meta column pinned
                       right steals width the headline needs at this size. */
                    .fa-hero { grid-template-columns: 1fr !important; gap: 18px !important; align-items: start !important; }
                    .fa-meta { flex-direction: row !important; flex-wrap: wrap; column-gap: 14px; text-align: left !important; }
                    .fa-headrow { flex-wrap: wrap; gap: 12px !important; }
                }
            `}</style>
        </div>
    );
}

/** The palette, for pages composing inside this frame. */
export const SHELL = { INK, PAPER, GOLD, MUTED, MUTED_ON_INK } as const;
