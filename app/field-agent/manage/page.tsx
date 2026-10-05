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
 * same components (Round 1, board BookCall: "Your call", "New time", "Done").
 * It is the same flow at a later moment, so it should not look like a
 * different product.
 */

import { Calendar } from "lucide-react";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";

import { Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Icon, Loading, Skeleton, Status, bookingStatus } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import BookingShell from "../_components/BookingShell";
import { ActionBar, CallTicket, Notice, PickedTime } from "../_components/CallCard";
import { addToCalendarUrl, formatDay, formatDayShort, formatTime, maskEmail } from "../_components/callTime";
import SlotPicker, { SlotPickerSkeleton, manilaKeyOf, type Day, type Slot } from "../_components/SlotPicker";

const STEPS = ["Your call", "New time", "Done"];

/** A screen that is not a step: a link that does not work, or a call that can no longer change. */
function MessageCard({ children, action }: { children: ReactNode; action?: boolean }) {
    return (
        <div className="mx-auto w-full max-w-[560px]">
            <div className="t-card flex flex-col items-start gap-4 px-5 py-8 sm:px-6">
                {children}
                {action && (
                    <ButtonLink variant="primary" href="/field-agent/book">
                        Book a time
                    </ButtonLink>
                )}
            </div>
        </div>
    );
}

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
    const [loadFailed, setLoadFailed] = useState(false);
    const [activeDay, setActiveDay] = useState<string | null>(null);
    const [picked, setPicked] = useState<Slot | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<"moved" | "cancelled" | null>(null);
    // Where the call was and where it went. The ticket reads the new time from
    // here rather than from the booking query, which can land a beat after the
    // action returns and would flash the old time first.
    const [moved, setMoved] = useState<{ fromMs: number; toMs: number } | null>(null);

    const loadSlots = useCallback(async () => {
        try {
            const res = await getAvailability({});
            setLoadFailed(false);
            setDays(res.days);
            setActiveDay((cur) =>
                cur && res.days.some((d) => d.dateKey === cur) ? cur : (res.days[0]?.dateKey ?? null),
            );
        } catch {
            setLoadFailed(true);
            setDays([]);
        }
    }, [getAvailability]);

    useEffect(() => {
        if (mode === "pick" && days === null) void loadSlots();
    }, [mode, days, loadSlots]);

    // Each screen starts at the top: Reschedule and Move my call sit low on a
    // phone, and the screen after them would otherwise open part-way down.
    // (Opening the cancel dialog is not a new screen, so it does not count.)
    const screen = done ?? (mode === "pick" ? "pick" : "view");
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [screen]);

    async function move() {
        if (!picked || !booking) return;
        const fromMs = booking.startMs;
        const toMs = picked.startMs;
        setBusy(true);
        setError(null);
        try {
            const res = await reschedule({ token, newStartMs: toMs });
            if (res.ok) {
                setMoved({ fromMs, toMs });
                setPicked(null);
                setDone("moved");
            } else {
                setError(res.error);
                setPicked(null);
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

    if (!token) {
        return (
            <BookingShell title="Your 10-minute call">
                <MessageCard>
                    <p className="t-body">This link is missing its code. Open the link from your confirmation email.</p>
                </MessageCard>
            </BookingShell>
        );
    }

    if (booking === undefined) {
        return (
            <BookingShell title="Your 10-minute call">
                <Loading label="Loading your booking" className="mx-auto w-full max-w-[560px]">
                    <div className="t-card flex flex-col gap-4 p-5 sm:p-6" aria-hidden="true">
                        <div className="flex items-center justify-between gap-4">
                            <Skeleton width={150} height={12} />
                            <Skeleton width={64} height={12} />
                        </div>
                        <Skeleton width={140} height={32} />
                        <Skeleton width={200} height={16} />
                        <hr className="t-divider" />
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 4 }, (_, i) => (
                                <div key={i} className="flex flex-col gap-2">
                                    <Skeleton width={60} height={10} />
                                    <Skeleton width="80%" height={12} />
                                </div>
                            ))}
                        </div>
                    </div>
                </Loading>
            </BookingShell>
        );
    }

    if (booking === null) {
        return (
            <BookingShell title="Your 10-minute call">
                <MessageCard action>
                    <p className="t-body">That link is no longer valid. If you still need a call, book a new one.</p>
                </MessageCard>
            </BookingShell>
        );
    }

    const when = `${formatDay(booking.startMs)} · ${formatTime(booking.startMs)}`;

    if (done === "cancelled") {
        return (
            <BookingShell title="Your call is cancelled" steps={STEPS} current={STEPS.length}>
                <div className="mx-auto w-full max-w-[560px]">
                    <article className="t-card flex flex-col items-start gap-4 px-5 py-8 sm:px-6" aria-label="Cancelled booking">
                        <Status {...bookingStatus({ status: "cancelled" })} />
                        <div className="flex flex-col gap-1">
                            <span className="t-h2 t-num line-through decoration-r1-ink-4">{when}</span>
                            <p className="t-body">
                                That time is open again, and we emailed you a confirmation. Your Meet link no longer works.
                            </p>
                        </div>
                        <ButtonLink variant="primary" href="/field-agent/book">
                            Book another time
                        </ButtonLink>
                    </article>
                </div>
            </BookingShell>
        );
    }

    if (done === "moved" && moved) {
        // The new time is the big figure on the ticket: they pressed the
        // button, they know it moved; what they came to find out is when.
        return (
            <BookingShell title="Your call has moved" steps={STEPS} current={STEPS.length}>
                <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
                    <p className="t-meta t-num">
                        Moved from {formatDayShort(moved.fromMs)} · {formatTime(moved.fromMs)}.
                    </p>
                    <CallTicket
                        status={bookingStatus({ status: booking.status, startMs: moved.toMs })}
                        time={formatTime(moved.toMs)}
                        day={formatDay(moved.toMs)}
                        meetUrl={booking.meetUrl}
                        name={booking.name}
                        email={maskEmail(booking.email)}
                    >
                        <p className="t-body">
                            Your Google Meet link is unchanged, so the one you already have still works. We emailed you the new time.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <ButtonLink
                                variant="primary"
                                href={addToCalendarUrl(moved.toMs, booking.meetUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Icon icon={Calendar} />
                                Update your calendar
                            </ButtonLink>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setDone(null);
                                    setMoved(null);
                                    // The grid from before the move still shows the old
                                    // time taken and the new one free; load it fresh.
                                    setDays(null);
                                    setMode("view");
                                }}
                            >
                                Change or cancel again
                            </Button>
                        </div>
                    </CallTicket>
                </div>
            </BookingShell>
        );
    }

    if (!booking.manageable) {
        const wasCancelled = booking.status === "cancelled";
        return (
            <BookingShell title="Your 10-minute call">
                <MessageCard action>
                    {wasCancelled && <Status {...bookingStatus({ status: "cancelled" })} />}
                    <div className="flex flex-col gap-1">
                        <span className={wasCancelled ? "t-h2 t-num line-through decoration-r1-ink-4" : "t-h2 t-num"}>{when}</span>
                        <p className="t-body">
                            {wasCancelled
                                ? "This call was cancelled, and that time is already open again."
                                : "This call has passed. Bookings can only be changed before they start."}
                        </p>
                    </div>
                </MessageCard>
            </BookingShell>
        );
    }

    if (mode === "pick") {
        const pickedDay = picked ? (days?.find((d) => d.slots.some((s) => s.startMs === picked.startMs))?.label ?? null) : null;
        const moveButton = (
            <Button variant="primary" size="lg" className="flex-none lg:w-full" disabled={!picked || busy} aria-busy={busy} onClick={move}>
                {busy ? "Moving…" : "Move my call"}
            </Button>
        );
        return (
            <BookingShell title="Pick a new time" steps={STEPS} current={1} phoneBar={!loadFailed && days?.length !== 0}>
                {error && <Notice>{error}</Notice>}
                {loadFailed ? (
                    <ErrorState
                        what="Available times"
                        onRetry={() => {
                            setLoadFailed(false);
                            setDays(null); // the effect above loads them again
                        }}
                        className="t-card"
                    />
                ) : days?.length === 0 ? (
                    <EmptyState className="t-card" title="No times are open right now." />
                ) : (
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-12">
                        {days === null ? (
                            <SlotPickerSkeleton />
                        ) : (
                            <SlotPicker
                                days={days}
                                activeDay={activeDay}
                                onSelectDay={(key) => {
                                    setActiveDay(key);
                                    setPicked(null);
                                }}
                                selected={picked?.startMs ?? null}
                                onSelect={(slot) => {
                                    setPicked(slot);
                                    setError(null);
                                }}
                                mine={booking.startMs}
                                disabled={busy}
                            />
                        )}

                        <aside className="t-card flex flex-col gap-5 p-5 sm:p-6 lg:sticky lg:top-6" aria-label="Moving your call">
                            <h2 className="t-h2">Moving your call</h2>
                            <div className="flex flex-col gap-1">
                                <span className="t-label">Now</span>
                                <span className="t-body t-num">
                                    {formatDayShort(booking.startMs)} · {formatTime(booking.startMs)}
                                </span>
                            </div>
                            <div className="max-lg:hidden">
                                <PickedTime label="New time" time={picked?.label} day={pickedDay} />
                            </div>
                            <p className="t-meta">Your Google Meet link stays the same, so anything you already saved keeps working.</p>
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-col max-lg:hidden">{moveButton}</div>
                                <Button
                                    variant="ghost"
                                    block
                                    onClick={() => {
                                        setPicked(null);
                                        setError(null);
                                        setMode("view");
                                    }}
                                >
                                    Keep my current time
                                </Button>
                            </div>
                        </aside>

                        <ActionBar>
                            <PickedTime label="New time" time={picked?.label} day={pickedDay} compact />
                            {moveButton}
                        </ActionBar>
                    </div>
                )}
            </BookingShell>
        );
    }

    return (
        <BookingShell title="Your 10-minute call" steps={STEPS} current={0}>
            <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
                {error && mode !== "confirmCancel" && <Notice>{error}</Notice>}
                <CallTicket
                    status={bookingStatus({ status: booking.status, startMs: booking.startMs })}
                    time={formatTime(booking.startMs)}
                    day={formatDay(booking.startMs)}
                    meetUrl={booking.meetUrl}
                    name={booking.name}
                    email={maskEmail(booking.email)}
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="primary"
                            onClick={() => {
                                setError(null);
                                setPicked(null);
                                // Open the calendar on the day the call is on now, when
                                // that day is on offer (loadSlots checks it once loaded).
                                const key = manilaKeyOf(booking.startMs);
                                setActiveDay((cur) => (days === null || days.some((d) => d.dateKey === key) ? key : cur));
                                setMode("pick");
                            }}
                        >
                            Reschedule
                        </Button>
                        <Button
                            variant="danger"
                            onClick={() => {
                                setError(null);
                                setMode("confirmCancel");
                            }}
                        >
                            Cancel this call
                        </Button>
                    </div>
                    <p className="t-meta">Moving the call keeps the same Google Meet link.</p>
                </CallTicket>
            </div>

            <ConfirmDialog
                open={mode === "confirmCancel"}
                onCancel={() => {
                    setError(null);
                    setMode("view");
                }}
                onConfirm={doCancel}
                busy={busy}
                title="Cancel this call?"
                confirmLabel={busy ? "Cancelling…" : "Yes, cancel it"}
            >
                <p className="t-num">
                    {formatDay(booking.startMs)} at {formatTime(booking.startMs)}. The time goes back on offer and your Google Meet link stops working.
                </p>
                {error && (
                    <p className="t-error" role="alert">
                        {error}
                    </p>
                )}
            </ConfirmDialog>
        </BookingShell>
    );
}

export default function ManagePage() {
    return (
        <Suspense fallback={null}>
            <ManageFlow />
        </Suspense>
    );
}
