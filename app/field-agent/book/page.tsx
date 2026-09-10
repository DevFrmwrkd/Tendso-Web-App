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
import BookingShell from "../_components/BookingShell";
import SlotPicker, { type Day, type Slot } from "../_components/SlotPicker";

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
const DISABLED = "#D8D4CC";

const EYEBROW: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: MUTED,
};

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

    // The chosen day, for the summary and confirmation cards. The picker owns
    // the grid itself; this is only the label those two steps read back.
    const day = days?.find((d) => d.dateKey === activeDay) ?? null;


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


    return (
        <BookingShell
            steps={["Time", "Details", "Done"]}
            activeStep={step === "pick" ? 0 : step === "details" ? 1 : 2}
            title={
                <>
                    Book your <span style={{ color: GOLD }}>10-minute</span> call
                </>
            }
            subtitle="Pick a time that works for you. It's a short video call to get you started as a field agent."
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
                                    <SlotPicker
                                        days={days}
                                        activeDay={activeDay}
                                        onSelectDay={(key) => {
                                            setActiveDay(key)
                                            setPicked(null)
                                        }}
                                        onPickSlot={(slot) => {
                                            setPicked(slot)
                                            setStep("details")
                                        }}
                                    />
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
        </BookingShell>
    );
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
