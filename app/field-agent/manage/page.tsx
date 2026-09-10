"use client";

/**
 * /field-agent/manage?t=<token> — reschedule or cancel your own call.
 *
 * Reached only from the links in the confirmation email. The person who booked
 * has no account, so the token in that link IS the authentication: it names one
 * booking and grants exactly two verbs on it. Nothing here takes a booking id
 * from the client; the server looks everything up by token.
 *
 * RESCHEDULING KEEPS THE MEET LINK. The calendar event is patched rather than
 * replaced, so the same room stays attached and any copy of the link the person
 * already saved keeps working. That is the whole reason moving is offered
 * instead of cancel-then-rebook.
 *
 * Wears the same frame and the same calendar as /field-agent/book, from the
 * same two components. It is the same flow at a later moment, so it should not
 * look like a different product.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { CalendarPlus, Video } from "lucide-react";

import { api } from "@/convex/_generated/api";
import BookingShell from "../_components/BookingShell";
import SlotPicker, { type Day, type Slot } from "../_components/SlotPicker";

const INK = "#1B1B22";
const PAPER = "#F3F0EA";
const GOLD = "#D4A146";
const MUTED = "#8F8B83";
const WHITE = "#FFFFFF";
const RULE = "#E6E1D7";
const DISABLED = "#D8D4CC";

const STEPS = ["Your call", "New time", "Done"];

function formatDay(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        timeZone: "Asia/Manila",
        weekday: "long",
        month: "long",
        day: "numeric",
    });
}

function formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
    });
}

/**
 * Google's own add-to-calendar URL. Worth offering after a move in particular:
 * if they saved the call to their calendar when they booked, that copy still
 * points at the old time and nothing we do to our calendar fixes theirs.
 */
function addToCalendarUrl(startMs: number, meetUrl: string | null): string {
    const stamp = (ms: number) =>
        new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: "10-Minute-Meeting with Tendso",
        dates: `${stamp(startMs)}/${stamp(startMs + 10 * 60_000)}`,
        details: meetUrl ? `Google Meet: ${meetUrl}` : "Your Google Meet link is in your email.",
        ctz: "Asia/Manila",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const PRIMARY: React.CSSProperties = {
    padding: "13px 22px",
    borderRadius: 999,
    border: "none",
    background: INK,
    color: PAPER,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    font: "inherit",
    textDecoration: "none",
    display: "inline-block",
};

const QUIET: React.CSSProperties = {
    border: "none",
    background: "none",
    padding: 0,
    color: MUTED,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    font: "inherit",
    textDecoration: "underline",
};

const SECONDARY: React.CSSProperties = {
    padding: "13px 22px",
    borderRadius: 999,
    border: `1px solid ${DISABLED}`,
    background: "transparent",
    color: INK,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    font: "inherit",
};

function ManageFlow() {
    const params = useSearchParams();
    const token = params.get("t") ?? "";
    // The Cancel button in the email points straight at the confirmation rather
    // than the menu — one fewer click for the person who already decided, and
    // still a confirmation rather than a link that cancels on being opened
    // (mail scanners follow links).
    const wantsCancel = params.get("action") === "cancel";

    const booking = useQuery(api.nativeBookings.getForManage, token ? { token } : "skip");
    const getAvailability = useAction(api.booking.getAvailability);
    const reschedule = useAction(api.booking.rescheduleByToken);
    const cancel = useAction(api.booking.cancelByToken);

    const [mode, setMode] = useState<"view" | "pick" | "confirmCancel">(
        wantsCancel ? "confirmCancel" : "view",
    );
    const [days, setDays] = useState<Day[] | null>(null);
    const [activeDay, setActiveDay] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<"moved" | "cancelled" | null>(null);

    const loadSlots = useCallback(async () => {
        try {
            const res = await getAvailability({});
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
        if (mode === "pick" && days === null) void loadSlots();
    }, [mode, days, loadSlots]);

    async function pick(slot: Slot) {
        setBusy(true);
        setError(null);
        try {
            const res = await reschedule({ token, newStartMs: slot.startMs });
            if (res.ok) setDone("moved");
            else {
                setError(res.error);
                setDays(null); // the grid is stale if someone beat us to it
                void loadSlots();
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    async function doCancel() {
        setBusy(true);
        setError(null);
        try {
            const res = await cancel({ token });
            if (res.ok) setDone("cancelled");
            else setError(res.error ?? "Something went wrong.");
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    const step = done ? 2 : mode === "pick" ? 1 : 0;

    const frame = (
        title: React.ReactNode,
        subtitle: string,
        body: React.ReactNode,
        centered = false,
        lede?: React.ReactNode,
    ) => (
        <BookingShell
            steps={STEPS}
            activeStep={step}
            title={title}
            lede={lede}
            subtitle={subtitle}
            centered={centered}
        >
            {body}
        </BookingShell>
    );

    const notice = (text: string, cta = true) =>
        frame(
            <>
                Your <span style={{ color: GOLD }}>10-minute</span> call
            </>,
            text,
            cta ? (
                <a href="/field-agent/book" style={PRIMARY}>
                    Book a time
                </a>
            ) : null,
            true,
        );

    if (!token) return notice("This link is missing its code. Open the link from your confirmation email.", false);
    if (booking === undefined) return notice("Loading your booking…", false);
    if (booking === null) return notice("That link is no longer valid. If you still need a call, book a new one.");

    if (done === "cancelled") {
        return frame(
            <>
                Your call is <span style={{ color: GOLD }}>cancelled</span>
            </>,
            "That time is open again, and we've emailed you a confirmation.",
            <a href="/field-agent/book" style={PRIMARY}>
                Book another time
            </a>,
            true,
        );
    }

    if (done === "moved") {
        // The new time IS the headline. "Your call has moved" was the largest
        // thing on this screen and it answers a question nobody asked — they
        // pressed the button, they know it moved. What they came to find out is
        // when, so that goes in the 52px type and the day goes right under it.
        return frame(
            <>
                Moved to <span style={{ color: GOLD }}>{formatTime(booking.startMs)}</span>
            </>,
            "Your Google Meet link is unchanged, so the one you already have still works. We've emailed you the new details.",
            <>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    {booking.meetUrl && (
                        <a
                            href={booking.meetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...PRIMARY, display: "inline-flex", alignItems: "center", gap: 8 }}
                        >
                            <Video className="h-4 w-4" /> Join with Google Meet
                        </a>
                    )}
                    <a
                        href={addToCalendarUrl(booking.startMs, booking.meetUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...SECONDARY, display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                        <CalendarPlus className="h-4 w-4" /> Update your calendar
                    </a>
                </div>

                <p style={{ margin: 0, fontSize: 14, color: MUTED, maxWidth: 420 }}>
                    We&apos;ll send a reminder before the call. If your own calendar still shows the
                    old time, the button above replaces it.
                </p>

                <button
                    type="button"
                    onClick={() => {
                        setDone(null);
                        setMode("view");
                    }}
                    style={QUIET}
                >
                    Change or cancel again
                </button>
            </>,
            true,
            formatDay(booking.startMs),
        );
    }

    if (!booking.manageable) {
        return notice(
            booking.status === "cancelled"
                ? "This call was cancelled, and that time is already open again."
                : "This call has passed. Bookings can only be changed before they start.",
        );
    }

    const errorNote = error && (
        <p
            style={{
                margin: 0,
                background: WHITE,
                border: `1px solid ${RULE}`,
                borderLeft: `3px solid ${GOLD}`,
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 14,
            }}
        >
            {error}
        </p>
    );

    if (mode === "pick") {
        return frame(
            <>
                Pick a <span style={{ color: GOLD }}>new time</span>
            </>,
            "Your Google Meet link stays the same, so anything you've already saved keeps working.",
            <>
                {errorNote}
                {days === null && <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Loading available times…</p>}
                {days?.length === 0 && (
                    <p style={{ margin: 0, fontSize: 15, color: MUTED }}>No times are open right now.</p>
                )}
                {days && days.length > 0 && (
                    <SlotPicker
                        days={days}
                        activeDay={activeDay}
                        onSelectDay={setActiveDay}
                        onPickSlot={pick}
                        disabled={busy}
                    />
                )}
                <button type="button" onClick={() => setMode("view")} style={{ ...SECONDARY, alignSelf: "flex-start" }}>
                    ‹ Keep my current time
                </button>
            </>,
        );
    }

    return frame(
        <>
            Your call is at <span style={{ color: GOLD }}>{formatTime(booking.startMs)}</span>
        </>,
        "Move it to another time, or cancel it and free the slot for someone else.",
        <>
            {errorNote}

            {mode === "confirmCancel" ? (
                <div
                    style={{
                        background: WHITE,
                        border: `1px solid ${RULE}`,
                        borderRadius: 20,
                        padding: 24,
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        maxWidth: 520,
                        textAlign: "center",
                    }}
                >
                    <p style={{ margin: 0, fontSize: 15 }}>
                        Cancel this call? The time goes back on offer, and your Meet link stops
                        working.
                    </p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                        <button type="button" onClick={doCancel} disabled={busy} style={PRIMARY}>
                            {busy ? "Cancelling…" : "Yes, cancel it"}
                        </button>
                        <button type="button" onClick={() => setMode("view")} style={SECONDARY}>
                            Keep it
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                        <button type="button" onClick={() => setMode("pick")} style={PRIMARY}>
                            Reschedule
                        </button>
                        <button type="button" onClick={() => setMode("confirmCancel")} style={SECONDARY}>
                            Cancel this call
                        </button>
                    </div>
                    {booking.meetUrl && (
                        <a
                            href={booking.meetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...QUIET, display: "inline-flex", alignItems: "center", gap: 8 }}
                        >
                            <Video className="h-4 w-4" /> Join with Google Meet
                        </a>
                    )}
                </>
            )}
        </>,
        true,
        formatDay(booking.startMs),
    );
}

export default function ManagePage() {
    return (
        <Suspense fallback={null}>
            <ManageFlow />
        </Suspense>
    );
}
