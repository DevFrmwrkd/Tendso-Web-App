"use client";

/**
 * /field-agent/book — the native booking page for the 10-minute Field Agent call.
 *
 * THE DESIGN IS THE SPEC. Built from "Booking Page v2", handed over as a design
 * file: dark header over a paper sheet that overlaps it, a three-step chip rail,
 * a day strip rather than a month calendar, and a ticket-shaped confirmation.
 * Every colour, radius and size below is the one the design specifies, which is
 * why they are literals here instead of the app's editorial tokens — the design
 * carries its own palette and this page is that design, not a variation on it.
 *
 * The flow behind it is ported from vonas-hr-pipeline. Both apps write to the
 * ONE tendso.hr Google Calendar, and that shared calendar — not this page — is
 * what stops the two handing out the same ten minutes.
 *
 * WHAT THE DESIGN DOES NOT COVER, and therefore had to be added:
 *   • Loading, empty, error, and calendar-unavailable states. Real states the
 *     design has no frame for, drawn in its own palette.
 *   • The honeypot. Invisible, so it costs the design nothing.
 * WHAT CAME OUT: the design's mobile-number field. Dropped at the owner's call,
 * along with the phone plumbing it had needed in createBooking — the calendar
 * event and the booking row carry a name and an email, nothing else.
 *
 * Unlinked by design: nothing on the site points here yet.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";

import { api } from "@/convex/_generated/api";

type Slot = { startMs: number; label: string; taken: boolean };
type Day = { dateKey: string; label: string; slots: Slot[] };
/** A slot placed in its hour row. `short` is the label without the meridiem,
 *  which the row heading already carries: "10:15", under a "10 AM" row. */
type Cell = Slot & { short: string };

/* The design's palette, named. */
const INK = "#1B1B22";
const PAPER = "#F3F0EA";
const GOLD = "#D4A146";
const MUTED = "#8F8B83";
const MUTED_ON_INK = "#B9B5AD";
const WHITE = "#FFFFFF";
const RULE = "#E6E1D7";
const FIELD_BG = "#FBFAF7";
const RULE_ON_INK = "#3A3A44";
const CHIP_OFF = "#2A2A33";
const DISABLED = "#D8D4CC";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EYEBROW: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: MUTED,
};

const SECTION_HEAD: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
};

/** "2026-09-09" -> parts, without going through Date and picking up a timezone. */
function parseKey(key: string) {
    const [y, m, d] = key.split("-").map(Number);
    return { y, m: m - 1, d };
}

/** Today in Manila, as a dateKey. The action speaks Manila days; so must this. */
function manilaTodayKey(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

export default function BookFieldAgentCallPage() {
    const getAvailability = useAction(api.booking.getAvailability);
    const createBooking = useAction(api.booking.createBooking);

    const [days, setDays] = useState<Day[] | null>(null);
    const [activeDay, setActiveDay] = useState<string | null>(null);
    const [picked, setPicked] = useState<Slot | null>(null);
    const [step, setStep] = useState<"pick" | "details" | "done">("pick");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [website, setWebsite] = useState(""); // honeypot — humans leave it empty

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Set when our own calendar cannot be reached. The page then points people
    // at a booking path that does not depend on it, rather than dead-ending.
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
    const [meetUrl, setMeetUrl] = useState<string | null>(null);

    const loadSlots = useCallback(async () => {
        setError(null);
        try {
            const res = await getAvailability({});
            setFallbackUrl(res.calendarUnavailable ? (res.fallbackUrl ?? null) : null);
            setDays(res.days);
            setActiveDay((cur) =>
                cur && res.days.some((d) => d.dateKey === cur) ? cur : (res.days[0]?.dateKey ?? null),
            );
        } catch {
            setError("Couldn't load available times. Please refresh.");
            setDays([]);
        }
    }, [getAvailability]);

    useEffect(() => {
        void loadSlots();
    }, [loadSlots]);

    const today = useMemo(() => manilaTodayKey(), []);
    const day = days?.find((d) => d.dateKey === activeDay) ?? null;

    /**
     * The slots of the active day, grouped into one row per hour and placed by
     * minute into four fixed columns. Fixed columns are the point: :00 :15 :30
     * :45 line up down the whole grid, so a booked time leaves a gap exactly
     * where it belongs instead of everything after it shuffling left.
     */
    const hourRows = useMemo(() => {
        const rows = new Map<string, Array<Cell | null>>();
        for (const slot of day?.slots ?? []) {
            // Split on any whitespace: ICU puts U+202F before AM/PM, not a plain
            // space, and JS \s covers it.
            const [time, meridiem] = slot.label.split(/\s+/);
            const [hour, minute] = time.split(":");
            const key = `${hour} ${meridiem}`;
            if (!rows.has(key)) rows.set(key, [null, null, null, null]);
            rows.get(key)![Math.floor(Number(minute) / 15)] = { ...slot, short: time };
        }
        // Insertion order is ascending because the action returns slots ascending.
        return [...rows.entries()].map(([hour, cells]) => ({ hour, cells }));
    }, [day]);

    const monthLabel = useMemo(() => {
        const key = day?.dateKey ?? days?.[0]?.dateKey;
        if (!key) return "";
        const p = parseKey(key);
        return new Date(Date.UTC(p.y, p.m, 1)).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
        });
    }, [day, days]);

    const canConfirm = name.trim().length >= 2 && email.includes("@");

    async function confirm() {
        if (!picked || !canConfirm || website.trim()) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await createBooking({
                startMs: picked.startMs,
                name,
                email,
            });
            if (res.ok) {
                setMeetUrl(res.meetUrl);
                setStep("done");
            } else {
                setError(res.error);
                setPicked(null);
                setStep("pick");
                void loadSlots(); // the grid is stale if someone beat us to it
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    function reset() {
        setStep("pick");
        setPicked(null);
        setMeetUrl(null);
        setName("");
        setEmail("");
        setError(null);
        void loadSlots();
    }

    /** Google's own "add to calendar" URL, so the design's button is a real one. */
    const addToCalendarUrl = useMemo(() => {
        if (!picked) return "#";
        const stamp = (ms: number) =>
            new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        const params = new URLSearchParams({
            action: "TEMPLATE",
            text: "10-Minute-Meeting with Tendso",
            dates: `${stamp(picked.startMs)}/${stamp(picked.startMs + 10 * 60_000)}`,
            details: meetUrl ? `Google Meet: ${meetUrl}` : "Your Google Meet link is in your email.",
            ctz: "Asia/Manila",
        });
        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }, [picked, meetUrl]);

    const chip = (on: boolean): React.CSSProperties => ({
        padding: "6px 12px",
        borderRadius: 999,
        background: on ? GOLD : CHIP_OFF,
        color: on ? INK : MUTED,
    });

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
                                style={{
                                    height: 12,
                                    width: "auto",
                                    display: "block",
                                    filter: "brightness(0)",
                                }}
                            />
                        </span>
                        <div style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 600 }}>
                            <span style={chip(step === "pick")}>1 · Time</span>
                            <span style={chip(step === "details")}>2 · Details</span>
                            <span style={chip(step === "done")}>3 · Done</span>
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
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                                maxWidth: 560,
                            }}
                        >
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
                                Book your <span style={{ color: GOLD }}>10-minute</span> call
                            </h1>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 16,
                                    lineHeight: 1.5,
                                    color: MUTED_ON_INK,
                                    textWrap: "pretty",
                                }}
                            >
                                Pick a time that works for you. It&apos;s a short video call to get
                                you started as a field agent.
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
                }}
            >
                <div
                    style={{
                        maxWidth: 880,
                        margin: "0 auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 28,
                        paddingTop: 32,
                    }}
                >
                    {error && step !== "details" && (
                        <p
                            style={{
                                margin: 0,
                                background: WHITE,
                                border: `1px solid ${RULE}`,
                                borderLeft: `3px solid ${GOLD}`,
                                borderRadius: 12,
                                padding: "14px 16px",
                                fontSize: 14,
                                color: INK,
                            }}
                        >
                            {error}
                        </p>
                    )}

                    {step === "pick" && (
                        <>
                            {days === null && (
                                <p style={{ margin: 0, fontSize: 14, color: MUTED }}>
                                    Loading available times…
                                </p>
                            )}

                            {days?.length === 0 && fallbackUrl && (
                                <div
                                    style={{
                                        background: WHITE,
                                        border: `1px solid ${RULE}`,
                                        borderRadius: 20,
                                        padding: 28,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 16,
                                        alignItems: "flex-start",
                                    }}
                                >
                                    <span style={EYEBROW}>Calendar unavailable</span>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 15,
                                            lineHeight: 1.5,
                                            color: INK,
                                        }}
                                    >
                                        We can&apos;t show times here right now. You can still book
                                        the same ten minutes on our backup page.
                                    </p>
                                    <a
                                        href={fallbackUrl}
                                        style={{
                                            padding: "13px 22px",
                                            borderRadius: 999,
                                            background: INK,
                                            color: PAPER,
                                            fontSize: 14,
                                            fontWeight: 700,
                                            textDecoration: "none",
                                        }}
                                    >
                                        Book your 10-minute call
                                    </a>
                                </div>
                            )}

                            {days?.length === 0 && !fallbackUrl && (
                                <p style={{ margin: 0, fontSize: 15, color: MUTED }}>
                                    No times are open right now. Please check back tomorrow.
                                </p>
                            )}

                            {days && days.length > 0 && (
                                <>
                                    <section
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 14,
                                        }}
                                    >
                                        <div style={SECTION_HEAD}>
                                            <span style={EYEBROW}>Choose a day</span>
                                            <span style={{ fontSize: 13, color: MUTED }}>
                                                Next two weeks · {monthLabel}
                                            </span>
                                        </div>
                                        <div
                                            className="fa-days"
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                    "repeat(auto-fill, minmax(72px, 1fr))",
                                                gap: 8,
                                            }}
                                        >
                                            {days.map((d) => {
                                                const sel = d.dateKey === activeDay;
                                                const p = parseKey(d.dateKey);
                                                const dow = DOW[new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay()];
                                                return (
                                                    <button
                                                        key={d.dateKey}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveDay(d.dateKey);
                                                            setPicked(null);
                                                        }}
                                                        style={{
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            alignItems: "center",
                                                            gap: 4,
                                                            padding: "14px 6px 12px",
                                                            borderRadius: 14,
                                                            border: `1px solid ${sel ? INK : RULE}`,
                                                            background: sel ? INK : WHITE,
                                                            color: sel ? PAPER : INK,
                                                            cursor: "pointer",
                                                            font: "inherit",
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                                opacity: 0.7,
                                                            }}
                                                        >
                                                            {dow}
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: 24,
                                                                fontWeight: 800,
                                                                letterSpacing: "-.02em",
                                                                lineHeight: 1,
                                                            }}
                                                        >
                                                            {p.d}
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                fontWeight: 600,
                                                                color: sel ? GOLD : MUTED,
                                                            }}
                                                        >
                                                            {d.dateKey === today
                                                                ? "Today"
                                                                : freeLabel(d)}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    <section
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 14,
                                        }}
                                    >
                                        <div style={SECTION_HEAD}>
                                            <span style={EYEBROW}>Pick a time</span>
                                            <span style={{ fontSize: 13, color: MUTED }}>
                                                {day?.label}
                                            </span>
                                        </div>
                                        <div className="fa-hours">
                                            {hourRows.map((row) => (
                                                <div className="fa-hourrow" key={row.hour}>
                                                    <span className="fa-hourlabel">{row.hour}</span>
                                                    <div className="fa-hourslots">
                                                        {row.cells.map((s, i) =>
                                                            s === null ? (
                                                                <span key={i} />
                                                            ) : s.taken ? (
                                                                <span
                                                                    key={i}
                                                                    className="fa-taken"
                                                                    aria-disabled="true"
                                                                    title="Already booked"
                                                                >
                                                                    {s.short}
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    className="fa-slot"
                                                                    onClick={() => {
                                                                        setPicked(s);
                                                                        setStep("details");
                                                                    }}
                                                                >
                                                                    {s.short}
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </>
                            )}
                        </>
                    )}

                    {step === "details" && picked && (
                        <section
                            className="fa-details"
                            style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 280px)",
                                gap: 20,
                                alignItems: "start",
                            }}
                        >
                            <div
                                style={{
                                    background: WHITE,
                                    border: `1px solid ${RULE}`,
                                    borderRadius: 20,
                                    padding: 28,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 20,
                                }}
                            >
                                <span style={EYEBROW}>Who&apos;s joining</span>

                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                        gap: 14,
                                    }}
                                >
                                    <Field label="Full name">
                                        <input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Juan dela Cruz"
                                            autoComplete="name"
                                            style={INPUT}
                                        />
                                    </Field>
                                    <Field label="Email">
                                        <input
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@email.com"
                                            type="email"
                                            autoComplete="email"
                                            style={INPUT}
                                        />
                                    </Field>
                                    <input
                                        type="text"
                                        tabIndex={-1}
                                        autoComplete="off"
                                        aria-hidden="true"
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                        style={{ display: "none" }}
                                    />
                                </div>

                                {error && (
                                    <p style={{ margin: 0, fontSize: 14, color: INK }}>{error}</p>
                                )}

                                <div
                                    className="fa-actions"
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 16,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    {/* The design draws this as bare muted text. That reads as a
                                        caption rather than a control, and #8F8B83 on white is
                                        3.4:1 — under the 4.5:1 minimum — on the ONLY way back
                                        from this step. Promoted to the secondary outline pill the
                                        design already uses for "Book another", so it stays in the
                                        design's own vocabulary and stays clearly below Confirm. */}
                                    <button
                                        type="button"
                                        onClick={() => setStep("pick")}
                                        style={{
                                            padding: "13px 22px",
                                            borderRadius: 999,
                                            border: `1px solid ${DISABLED}`,
                                            background: "transparent",
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: INK,
                                            cursor: "pointer",
                                            font: "inherit",
                                        }}
                                    >
                                        ‹ Change time
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirm}
                                        disabled={!canConfirm || submitting}
                                        style={{
                                            padding: "14px 24px",
                                            borderRadius: 999,
                                            border: "none",
                                            background: canConfirm && !submitting ? INK : DISABLED,
                                            color: canConfirm && !submitting ? PAPER : MUTED,
                                            fontSize: 15,
                                            fontWeight: 700,
                                            cursor: canConfirm && !submitting ? "pointer" : "default",
                                            font: "inherit",
                                        }}
                                    >
                                        {submitting ? "Booking…" : "Confirm booking"}
                                    </button>
                                </div>
                            </div>

                            <div
                                className="fa-slotcard"
                                style={{
                                    background: INK,
                                    color: PAPER,
                                    borderRadius: 20,
                                    padding: 24,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 18,
                                    position: "relative",
                                    overflow: "hidden",
                                }}
                            >
                                <span
                                    style={{
                                        position: "absolute",
                                        right: -20,
                                        top: -20,
                                        width: 110,
                                        height: 110,
                                        borderRadius: "50%",
                                        background: GOLD,
                                        opacity: 0.18,
                                    }}
                                />
                                <span style={{ ...EYEBROW, fontSize: 12 }}>Your slot</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span
                                        style={{
                                            fontSize: 40,
                                            fontWeight: 800,
                                            letterSpacing: "-.03em",
                                            lineHeight: 1,
                                            color: GOLD,
                                        }}
                                    >
                                        {picked.label}
                                    </span>
                                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                                        {day?.label}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        borderTop: `1px dashed ${RULE_ON_INK}`,
                                        paddingTop: 14,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                        fontSize: 13,
                                        color: MUTED_ON_INK,
                                    }}
                                >
                                    <span>10 minutes · Google Meet</span>
                                    <span>Philippine time (GMT+8)</span>
                                </div>
                            </div>
                        </section>
                    )}

                    {step === "done" && picked && (
                        <section
                            style={{
                                maxWidth: 520,
                                margin: "0 auto",
                                width: "100%",
                                display: "flex",
                                flexDirection: "column",
                                gap: 20,
                            }}
                        >
                            <div
                                style={{
                                    background: INK,
                                    color: PAPER,
                                    borderRadius: 20,
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        padding: "28px 28px 24px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 16,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <span style={{ ...EYEBROW, fontSize: 12 }}>Confirmed</span>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src="/tendso-logo.png"
                                            alt="Tendso"
                                            style={{
                                                height: 12,
                                                width: "auto",
                                                display: "block",
                                                opacity: 0.8,
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{ display: "flex", flexDirection: "column", gap: 6 }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 44,
                                                fontWeight: 800,
                                                letterSpacing: "-.03em",
                                                lineHeight: 1,
                                                color: GOLD,
                                            }}
                                        >
                                            {picked.label}
                                        </span>
                                        <span style={{ fontSize: 17, fontWeight: 600 }}>
                                            {day?.label}
                                        </span>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        borderTop: `1px dashed ${RULE_ON_INK}`,
                                        padding: "20px 28px 26px",
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 14,
                                        fontSize: 13,
                                    }}
                                >
                                    <Cell label="Attendee">{name}</Cell>
                                    <Cell label="Where">
                                        {meetUrl ? (
                                            <a
                                                href={meetUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: GOLD, textDecoration: "none" }}
                                            >
                                                Google Meet
                                            </a>
                                        ) : (
                                            "Google Meet"
                                        )}
                                    </Cell>
                                    <Cell label="Invite sent to" span>
                                        {email}
                                    </Cell>
                                </div>
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    gap: 10,
                                    justifyContent: "center",
                                    flexWrap: "wrap",
                                }}
                            >
                                <a
                                    href={addToCalendarUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        padding: "13px 22px",
                                        borderRadius: 999,
                                        background: INK,
                                        color: PAPER,
                                        fontSize: 14,
                                        fontWeight: 700,
                                        textDecoration: "none",
                                    }}
                                >
                                    Add to calendar
                                </a>
                                <button
                                    type="button"
                                    onClick={reset}
                                    style={{
                                        padding: "13px 22px",
                                        borderRadius: 999,
                                        border: `1px solid ${DISABLED}`,
                                        background: "transparent",
                                        color: INK,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        font: "inherit",
                                    }}
                                >
                                    Book another
                                </button>
                            </div>
                        </section>
                    )}
                </div>
            </main>

            {/* Hover, focus and breakpoints — the three things inline styles cannot say.
                The design is drawn at desktop width; everything here is about carrying it
                down to a phone, which is where a field agent will actually open this. */}
            <style>{`
                /* ── The time grid: one row per hour, four fixed columns ─────────
                   A booked time keeps its place, struck through, instead of
                   vanishing. Dropping it would shuffle every later time left and
                   make a busy hour read as a short one. */
                .fa-hours { display: flex; flex-direction: column; }
                .fa-hourrow {
                    display: grid;
                    grid-template-columns: 56px minmax(0, 1fr);
                    align-items: center;
                    gap: 16px;
                    padding: 10px 0;
                    border-bottom: 1px solid ${RULE};
                }
                .fa-hourrow:first-child { border-top: 1px solid ${RULE}; }
                .fa-hourlabel { font-size: 13px; font-weight: 600; color: ${MUTED}; }
                .fa-hourslots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
                .fa-slot {
                    padding: 12px 8px;
                    border-radius: 10px;
                    border: 1px solid ${RULE};
                    background: ${WHITE};
                    color: ${INK};
                    font: inherit;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 1px 2px rgba(27, 27, 34, .04);
                    transition: background .12s, color .12s, border-color .12s;
                }
                .fa-taken {
                    padding: 12px 8px;
                    text-align: center;
                    font-size: 14px;
                    font-weight: 600;
                    color: ${MUTED};
                    text-decoration: line-through;
                    cursor: default;
                    user-select: none;
                }
                /* Guarded: on a touch screen :hover sticks after the tap, so a
                   slot you already chose stays inverted while you read the form. */
                @media (hover: hover) {
                    .fa-slot:hover { background: ${INK}; color: ${PAPER}; border-color: ${INK}; }
                }
                .fa-field input:focus { outline: none; border-color: ${INK}; }

                @media (max-width: 820px) {
                    /* The two-column step: 220px of slot card against a squeezed
                       form is unreadable long before the columns actually collide. */
                    .fa-details { grid-template-columns: 1fr !important; }
                    /* And the slot card leads on a phone — it is the confirmation
                       of the tap you just made, so it belongs above the form. */
                    .fa-slotcard { order: -1; }
                }

                @media (max-width: 640px) {
                    .fa-header { padding: 28px 20px 88px !important; }
                    .fa-main { padding: 0 20px 56px !important; }
                    /* Headline over meta, both left-aligned: the meta column pinned
                       right steals width the headline needs at this size. */
                    .fa-hero { grid-template-columns: 1fr !important; gap: 18px !important; align-items: start !important; }
                    .fa-meta { flex-direction: row !important; flex-wrap: wrap; column-gap: 14px; text-align: left !important; }
                    .fa-headrow { flex-wrap: wrap; gap: 12px !important; }
                    /* Primary action first once they stack, and both full width:
                       a 22px-padded pill is a small target on a phone. */
                    .fa-actions { flex-direction: column-reverse !important; align-items: stretch !important; gap: 10px !important; }
                    .fa-actions > button { width: 100%; }
                    .fa-doneactions > a, .fa-doneactions > button { flex: 1 1 auto; text-align: center; }
                }

                @media (max-width: 420px) {
                    .fa-days { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)) !important; }
                    /* Four columns stay four columns — that alignment is the whole
                       point of the grid — so the gutter and gaps give the width up. */
                    .fa-hourrow { grid-template-columns: 34px minmax(0, 1fr); gap: 8px; }
                    .fa-hourslots { gap: 6px; }
                    .fa-slot, .fa-taken { padding: 11px 2px; font-size: 13px; }
                    .fa-hourlabel { font-size: 11px; }
                    /* 16px or iOS zooms the whole page in on focus and never zooms back. */
                    .fa-field input { font-size: 16px !important; }
                }
            `}</style>
        </div>
    );
}

/** "Today", "Full", or how many times are actually still open that day. */
function freeLabel(d: Day): string {
    const free = d.slots.filter((s) => !s.taken).length;
    return free === 0 ? "Full" : `${free} slots`;
}

const INPUT: React.CSSProperties = {
    padding: "13px 14px",
    borderRadius: 12,
    border: `1px solid ${RULE}`,
    fontSize: 15,
    background: FIELD_BG,
    color: INK,
    font: "inherit",
    fontWeight: 400,
    width: "100%",
    boxSizing: "border-box",
};

function Field({
    label,
    span,
    children,
}: {
    label: string;
    span?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label
            className="fa-field"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: INK,
                ...(span ? { gridColumn: "1 / -1" } : null),
            }}
        >
            <span>{label}</span>
            {children}
        </label>
    );
}

function Cell({
    label,
    span,
    children,
}: {
    label: string;
    span?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                ...(span ? { gridColumn: "1 / -1" } : null),
            }}
        >
            <span style={{ color: MUTED }}>{label}</span>
            <span style={{ fontWeight: 600 }}>{children}</span>
        </div>
    );
}
