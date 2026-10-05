"use client";

/**
 * The pieces /field-agent/book and /field-agent/manage share around the
 * calendar (board BookCall): the call's facts, the "your time" summary beside
 * the picker, the phone's action bar, an inline notice, and the ticket that
 * confirms a booking.
 */

import { Clock, Globe, Monitor } from "lucide-react";
import type { ReactNode } from "react";

import { Dot, Icon, Status, cx, type StatusWord } from "@/components/r1";

/** The three things true of every call. */
export function CallFacts({ className }: { className?: string }) {
    const facts = [
        { icon: Clock, text: "10 minutes" },
        { icon: Monitor, text: "Google Meet, link sent by email" },
        { icon: Globe, text: "Philippine time (GMT+8)" },
    ];
    return (
        <ul className={cx("m-0 flex list-none flex-col gap-2.5 p-0", className)}>
            {facts.map((f) => (
                <li key={f.text} className="flex items-center gap-2.5 text-sm leading-5 text-r1-ink-2">
                    <Icon icon={f.icon} className="flex-none text-r1-ink-3" />
                    {f.text}
                </li>
            ))}
        </ul>
    );
}

/**
 * "Your time" / "New time": the chosen slot in big figures, or how to choose
 * one. `compact` is the phone's action bar, where it shares a line with the button.
 */
export function PickedTime({
    label,
    time,
    day,
    compact = false,
}: {
    label: string;
    time?: string | null;
    day?: string | null;
    compact?: boolean;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <span className="t-label">{label}</span>
            {time ? (
                <>
                    <span
                        className={cx(
                            "font-semibold tracking-[-0.01em] text-r1-ink tabular-nums",
                            compact ? "text-lg leading-6" : "text-2xl leading-8",
                        )}
                    >
                        {time}
                    </span>
                    {day && <span className="t-meta">{day}</span>}
                </>
            ) : (
                <span className="t-meta">Pick a day, then a time.</span>
            )}
        </div>
    );
}

/**
 * On a phone the summary and the one button that acts on it are pinned to the
 * bottom of the screen. The calendar is taller than the screen there, and the
 * time you tap is often a long scroll away from the card that holds Continue.
 * Hidden from lg up, where that card sits beside the calendar.
 */
export function ActionBar({ children }: { children: ReactNode }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-r1-line bg-r1-paper px-4 pb-[calc(12px_+_env(safe-area-inset-bottom))] pt-3 sm:px-6 lg:hidden">
            {children}
        </div>
    );
}

/** Something the person has to read before they go on: a slot that went, an action that failed. */
export function Notice({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div role="alert" className={cx("flex items-start gap-3 rounded-r1-card border border-r1-line bg-r1-fill-2 px-4 py-3", className)}>
            <Dot tone="attn" className="mt-1.5" />
            <p className="t-body text-r1-ink">{children}</p>
        </div>
    );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <dt className="t-label">{term}</dt>
            <dd className="m-0 text-sm leading-5 text-r1-ink wrap-anywhere">{children}</dd>
        </div>
    );
}

/**
 * The booking itself, shaped like a ticket: the time as the big figure, the day
 * under it, a tear line, then the facts. The foot holds whatever this moment
 * offers (add to calendar, reschedule, cancel).
 */
export function CallTicket({
    status,
    time,
    day,
    meetUrl,
    name,
    email,
    children,
}: {
    status: StatusWord;
    time: string;
    day: string;
    meetUrl: string | null;
    name: string;
    email: string;
    children?: ReactNode;
}) {
    return (
        <article className="t-card" aria-label="Your booking">
            <div className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                    <span className="t-label">10-minute call with Tendso</span>
                    <Status {...status} />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="t-figure">{time}</span>
                    <span className="t-h2 font-medium">{day}</span>
                </div>
            </div>
            <div className="mx-5 border-t border-dashed border-r1-line-2 sm:mx-6" aria-hidden="true" />
            <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-5 sm:px-6">
                <Fact term="Length">10 minutes</Fact>
                <Fact term="Time zone">Philippine time (GMT+8)</Fact>
                <Fact term="Where">
                    Google Meet
                    {meetUrl && (
                        <>
                            <br />
                            <a href={meetUrl} target="_blank" rel="noopener noreferrer" className="t-mono t-link text-r1-ink-2">
                                {meetUrl.replace(/^https?:\/\//, "")}
                            </a>
                        </>
                    )}
                </Fact>
                <Fact term="Name">{name}</Fact>
                <Fact term="Invite sent to">{email}</Fact>
            </dl>
            {children && <div className="flex flex-col gap-3 border-t border-r1-line px-5 pb-6 pt-4 sm:px-6">{children}</div>}
        </article>
    );
}
