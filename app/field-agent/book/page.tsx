"use client";

/**
 * /field-agent/book — the native booking page for the 10-minute Field Agent call.
 *
 * THE DESIGN IS THE SPEC: Round 1, board BookCall. Three steps (Time, Details,
 * Done) under a funnel header; the calendar on the left with "Your call" beside
 * it, a two-field form, and a ticket-shaped confirmation. Colours, type and
 * controls are the shared Round 1 ones (app/round1.css, components/r1).
 *
 * The flow behind it is ported from vonas-hr-pipeline. Both apps write to the
 * ONE tendso.hr Google Calendar, and that shared calendar — not this page — is
 * what stops the two handing out the same ten minutes.
 *
 * WHAT THE BOARD DOES NOT COVER, and therefore had to be added:
 *   • The calendar-unavailable state (a backup booking link), no times open,
 *     and the times failing to load. Real states with no frame on the board.
 *   • The honeypot. Invisible, so it costs the design nothing.
 * WHAT CAME OUT: the design's mobile-number field. Dropped at the owner's call,
 * along with the phone plumbing it had needed in createBooking — the calendar
 * event and the booking row carry a name and an email, nothing else.
 *
 * NO RESCHEDULE LINK ON THE CONFIRMATION. The board links to it, but the
 * manage token is minted on the server and only ever leaves in the
 * confirmation email (createBooking does not return it), so the ticket points
 * at the links in that email instead.
 *
 * Unlinked by design: nothing on the site points here yet.
 */

import { ArrowLeft, ArrowRight, Calendar, CalendarX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAction } from "convex/react";

import { Button, ButtonLink, EmptyState, ErrorState, Field, Icon, Input, bookingStatus } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import BookingShell from "../_components/BookingShell";
import { ActionBar, CallFacts, CallTicket, Notice, PickedTime } from "../_components/CallCard";
import { addToCalendarUrl } from "../_components/callTime";
import SlotPicker, { SlotPickerSkeleton, type Day, type Slot } from "../_components/SlotPicker";

const STEPS = ["Time", "Details", "Done"];

/** The same test createBooking applies, so the form never accepts what the server would refuse. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldErrors(name: string, email: string) {
    const cleanEmail = email.trim();
    return {
        name: name.trim().length < 2 ? "Enter your full name." : null,
        email: !cleanEmail
            ? "Enter your email so we can send the Meet link."
            : !EMAIL_RE.test(cleanEmail)
              ? "That email does not look right. Check for a typo."
              : null,
    };
}

export default function BookFieldAgentCallPage() {
    const getAvailability = useAction(api.booking.getAvailability);
    const createBooking = useAction(api.booking.createBooking);

    const [days, setDays] = useState<Day[] | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [activeDay, setActiveDay] = useState<string | null>(null);
    const [picked, setPicked] = useState<Slot | null>(null);
    const [step, setStep] = useState<"pick" | "details" | "done">("pick");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [website, setWebsite] = useState(""); // honeypot — humans leave it empty
    // Errors show from the first Confirm on, then follow the typing.
    const [tried, setTried] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Set when our own calendar cannot be reached. The page then points people
    // at a booking path that does not depend on it, rather than dead-ending.
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
    const [meetUrl, setMeetUrl] = useState<string | null>(null);

    // Reloading the grid leaves `error` alone on purpose: after "Someone just
    // took that slot" the grid reloads at once, and clearing the message in
    // the same breath would hide the only explanation of why they are back here.
    const loadSlots = useCallback(async () => {
        try {
            const res = await getAvailability({});
            setLoadFailed(false);
            setFallbackUrl(res.calendarUnavailable ? (res.fallbackUrl ?? null) : null);
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
        void loadSlots();
    }, [loadSlots]);

    // Each step starts at the top. Continue sits at the foot of a long
    // calendar on a phone, and the form after it is much shorter, so without
    // this the new step opens scrolled past its own fields.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [step]);

    // The day the chosen time is on, for the summary and the ticket.
    const pickedDay = picked ? (days?.find((d) => d.slots.some((s) => s.startMs === picked.startMs))?.label ?? null) : null;
    const errors = fieldErrors(name, email);

    async function confirm(e?: FormEvent) {
        e?.preventDefault();
        if (!picked || submitting || website.trim()) return;
        if (errors.name || errors.email) {
            setTried(true);
            (errors.name ? nameRef : emailRef).current?.focus();
            return;
        }
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
        setTried(false);
        setError(null);
        void loadSlots();
    }

    function retryLoad() {
        setDays(null);
        setLoadFailed(false);
        void loadSlots();
    }

    const title = step === "done" ? "You’re booked" : "Book your 10-minute call";
    const current = step === "pick" ? 0 : step === "details" ? 1 : STEPS.length;
    const showPicker = step === "pick" && !loadFailed && (days === null || days.length > 0);

    const continueButton = (
        <Button
            variant="primary"
            size="lg"
            className="flex-none lg:w-full"
            disabled={!picked}
            aria-describedby={picked ? undefined : "book-need-time"}
            onClick={() => {
                if (!picked) return;
                setTried(false);
                setStep("details");
            }}
        >
            Continue
            {picked && <Icon icon={ArrowRight} />}
        </Button>
    );

    return (
        <BookingShell title={title} steps={STEPS} current={current} phoneBar={showPicker}>
            {error && step === "pick" && <Notice>{error}</Notice>}

            {step === "pick" && loadFailed && <ErrorState what="Available times" onRetry={retryLoad} className="t-card" />}

            {step === "pick" && !loadFailed && days?.length === 0 && fallbackUrl && (
                <div className="t-card t-card-pad flex max-w-[560px] flex-col items-start gap-4">
                    <span className="t-label">Calendar unavailable</span>
                    <p className="t-body">
                        We can&apos;t show times here right now. You can still book the same ten minutes on our backup page.
                    </p>
                    <ButtonLink variant="primary" href={fallbackUrl}>
                        Book your 10-minute call
                    </ButtonLink>
                </div>
            )}

            {step === "pick" && !loadFailed && days?.length === 0 && !fallbackUrl && (
                <EmptyState
                    className="t-card"
                    icon={<Icon icon={CalendarX} size={18} />}
                    title="No times are open right now"
                    body="Please check back tomorrow."
                />
            )}

            {showPicker && (
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
                        />
                    )}

                    <aside className="t-card flex flex-col gap-5 p-5 sm:p-6 lg:sticky lg:top-6" aria-label="Your call">
                        <div className="flex flex-col gap-1">
                            <h2 className="t-h2">Your call</h2>
                            <p className="t-body">A short video call to get you started as a Tendso creator.</p>
                        </div>
                        <CallFacts />
                        <div className="flex flex-col gap-5 max-lg:hidden">
                            <hr className="t-divider" />
                            <PickedTime label="Your time" time={picked?.label} day={pickedDay} />
                            <div className="flex flex-col gap-2">
                                {continueButton}
                                {!picked && (
                                    <p className="t-help" id="book-need-time">
                                        Pick a time to continue.
                                    </p>
                                )}
                            </div>
                        </div>
                    </aside>

                    <ActionBar>
                        <PickedTime label="Your time" time={picked?.label} day={pickedDay} compact />
                        {continueButton}
                    </ActionBar>
                </div>
            )}

            {step === "details" && picked && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-12">
                    <form className="t-card" onSubmit={confirm} noValidate aria-labelledby="book-who">
                        <div className="flex flex-col gap-1 border-b border-r1-line p-5 sm:p-6">
                            <h2 className="t-h2" id="book-who">
                                Who is joining?
                            </h2>
                            <p className="t-meta">We use this to send you the invite. Nothing else.</p>
                        </div>
                        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:gap-x-4 sm:p-6">
                            <Field label="Full name" required error={tried ? errors.name : null}>
                                <Input
                                    ref={nameRef}
                                    type="text"
                                    autoComplete="name"
                                    placeholder="Juan dela Cruz"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </Field>
                            <Field
                                label="Email"
                                required
                                help="We email your Google Meet link here, with links to reschedule or cancel."
                                error={tried ? errors.email : null}
                            >
                                <Input
                                    ref={emailRef}
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </Field>
                            <input
                                type="text"
                                tabIndex={-1}
                                autoComplete="off"
                                aria-hidden="true"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                className="hidden"
                            />
                        </div>
                        {error && (
                            <p className="t-error px-5 pb-5 sm:px-6 sm:pb-6" role="alert">
                                {error}
                            </p>
                        )}
                        <div className="flex flex-col-reverse gap-3 border-t border-r1-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <Button onClick={() => setStep("pick")}>
                                <Icon icon={ArrowLeft} />
                                Change time
                            </Button>
                            <Button type="submit" variant="primary" size="lg" disabled={submitting} aria-busy={submitting}>
                                {submitting ? "Booking…" : "Confirm booking"}
                            </Button>
                        </div>
                    </form>

                    {/* First on a phone: what is being confirmed, then who for. */}
                    <aside className="t-card flex flex-col gap-5 p-5 max-lg:order-first sm:p-6" aria-label="Your call">
                        <h2 className="t-h2">Your call</h2>
                        <PickedTime label="Your time" time={picked.label} day={pickedDay} />
                        <hr className="t-divider" />
                        <CallFacts />
                    </aside>
                </div>
            )}

            {step === "done" && picked && (
                <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
                    <CallTicket
                        status={bookingStatus({ status: "confirmed", startMs: picked.startMs })}
                        time={picked.label}
                        day={pickedDay ?? ""}
                        meetUrl={meetUrl}
                        name={name.trim()}
                        email={email.trim()}
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <ButtonLink
                                variant="primary"
                                href={addToCalendarUrl(picked.startMs, meetUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Icon icon={Calendar} />
                                Add to calendar
                            </ButtonLink>
                            <Button variant="ghost" onClick={reset}>
                                Book another call
                            </Button>
                        </div>
                        <p className="t-meta">Need a different time? Use the Reschedule or Cancel link in your confirmation email.</p>
                    </CallTicket>
                </div>
            )}
        </BookingShell>
    );
}
