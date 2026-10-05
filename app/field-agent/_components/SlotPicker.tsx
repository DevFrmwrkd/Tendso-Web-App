"use client";

/**
 * The day strip and the hour grid — the calendar people actually pick from.
 *
 * ONE COMPONENT, TWO PAGES. /field-agent/book uses it to make a booking and
 * /field-agent/manage uses it to move one. They were separate implementations
 * for about a day, and the second was already a poorer copy of the first, which
 * is exactly how two views of one thing drift apart.
 *
 * WHY THE GRID IS SHAPED LIKE THIS. Times sit one row per hour in four fixed
 * columns, so :00 :15 :30 :45 line up all the way down. Booked slots keep their
 * place, struck through, rather than being dropped — an hour with its taken
 * times missing reads as "we don't open then", which is a different and wrong
 * message, and dropping them would shuffle every later time leftwards.
 *
 * ROUND 1 (board BookCall). A tap now SELECTS a time instead of acting on it:
 * the page's own button (Continue, Move my call) does that, next to a summary
 * of what was picked. The hours are split into the bookable windows ("Morning
 * to afternoon", "Evening"), and a window that is already over today says so
 * instead of silently not being there.
 *
 * THE WINDOWS COME FROM THE SLOTS, not from a second query. The availability
 * action returns every candidate slot in the next two weeks, taken ones
 * flagged rather than dropped, so any full day carries each window whole; the
 * union of their times is the schedule an admin set at /admin/bookings. Only
 * today (times inside the hour are not offered) and the far edge of the
 * fortnight come back partial, and neither can hide a window from the others.
 */

import { useId, useMemo } from "react";

import { Loading, Skeleton, cx } from "@/components/r1";

export type Slot = { startMs: number; label: string; taken: boolean };
export type Day = { dateKey: string; label: string; slots: Slot[] };

/** The availability action's cadence: one slot every 15 minutes, hence four columns. */
const STEP_MIN = 15;
const MANILA_OFFSET_MS = 8 * 60 * 60_000;

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-09-09" -> parts, without going through Date and picking up a tz. */
export function parseKey(key: string) {
    const [y, m, d] = key.split("-").map(Number);
    return { y, m: m - 1, d };
}

/** The Manila day an instant falls on, as a dateKey. The action speaks Manila days; so must this. */
export function manilaKeyOf(ms: number): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(ms));
}

/** Today in Manila, as a dateKey. */
export function manilaTodayKey(): string {
    return manilaKeyOf(Date.now());
}

/** Minutes past Manila midnight. */
function manilaMinute(ms: number): number {
    const d = new Date(ms + MANILA_OFFSET_MS);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function weekdayOf(key: string): number {
    const p = parseKey(key);
    return new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay();
}

/** "10:00 AM" from minutes past midnight. The end of the day reads 11:59 PM, as the kit writes it. */
function clock(min: number): string {
    if (min >= 1440) return "11:59 PM";
    const h = Math.floor(min / 60);
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Weekdays, next two weeks · September – October 2026" */
function spanLabel(days: Day[]): string {
    const first = parseKey(days[0].dateKey);
    const last = parseKey(days[days.length - 1].dateKey);
    const month = (p: { y: number; m: number }) =>
        new Date(Date.UTC(p.y, p.m, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    const months =
        first.y !== last.y
            ? `${month(first)} ${first.y} – ${month(last)} ${last.y}`
            : first.m !== last.m
              ? `${month(first)} – ${month(last)} ${last.y}`
              : `${month(first)} ${first.y}`;
    // Only claimed when it is true of what is on offer: the schedule is
    // editable, and a Saturday window would make "Weekdays" a wrong promise.
    const weekdaysOnly = days.every((d) => {
        const wd = weekdayOf(d.dateKey);
        return wd >= 1 && wd <= 5;
    });
    return `${weekdaysOnly ? "Weekdays, next two weeks" : "Next two weeks"} · ${months}`;
}

type Window = { start: number; end: number; title: string; range: string };

/** The bookable windows: runs of slot times 15 minutes apart, across every day on offer. */
function windowsOf(days: Day[]): Window[] {
    const minutes = [...new Set(days.flatMap((d) => d.slots.map((s) => manilaMinute(s.startMs))))].sort((a, b) => a - b);
    const runs: Array<[number, number]> = [];
    for (const m of minutes) {
        const last = runs[runs.length - 1];
        if (last && m - last[1] <= STEP_MIN) last[1] = m;
        else runs.push([m, m]);
    }
    const part = (m: number) => (m < 12 * 60 ? "Morning" : m < 17 * 60 ? "Afternoon" : "Evening");
    return runs.map(([start, lastStart]) => {
        const end = lastStart + STEP_MIN;
        const a = part(start);
        const b = part(end - 1);
        return {
            start,
            end,
            title: a === b ? a : `${a} to ${b.toLowerCase()}`,
            range: `${clock(start)} – ${clock(end)}`,
        };
    });
}

type Cell = { slot: Slot; short: string } | null;
type Group = Window & { passed: boolean; rows: Array<{ hour: string; cells: Cell[] }> };

/** One day's slots, placed into the windows and then into hour rows of four fixed columns. */
function groupsFor(day: Day, windows: Window[], isToday: boolean): Group[] {
    const firstMinute = day.slots.length ? manilaMinute(day.slots[0].startMs) : 1440;
    const groups: Group[] = [];
    for (const w of windows) {
        const rows = new Map<number, Cell[]>();
        for (const slot of day.slots) {
            const m = manilaMinute(slot.startMs);
            if (m < w.start || m >= w.end) continue;
            const h = Math.floor(m / 60);
            if (!rows.has(h)) rows.set(h, [null, null, null, null]);
            const hour12 = h % 12 === 0 ? 12 : h % 12;
            rows.get(h)![Math.floor((m % 60) / STEP_MIN)] = { slot, short: `${hour12}:${String(m % 60).padStart(2, "0")}` };
        }
        if (rows.size) {
            groups.push({
                ...w,
                passed: false,
                rows: [...rows.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([h, cells]) => ({ hour: `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`, cells })),
            });
        } else if (isToday && w.end <= firstMinute) {
            // Over for today: say so, rather than let the window vanish.
            groups.push({ ...w, passed: true, rows: [] });
        }
        // Anything else empty is the far edge of the fortnight, cut by the
        // horizon rather than closed, so it is simply not shown.
    }
    return groups;
}

export default function SlotPicker({
    days,
    activeDay,
    onSelectDay,
    selected,
    onSelect,
    mine = null,
    disabled = false,
}: {
    days: Day[];
    activeDay: string | null;
    onSelectDay: (dateKey: string) => void;
    /** startMs of the time chosen so far, if any. */
    selected: number | null;
    onSelect: (slot: Slot) => void;
    /** startMs of the call being moved: shown as "yours" instead of struck through. */
    mine?: number | null;
    disabled?: boolean;
}) {
    const ids = useId();
    const todayKey = manilaTodayKey();
    const day = days.find((d) => d.dateKey === activeDay) ?? null;
    const windows = useMemo(() => windowsOf(days), [days]);
    const groups = day ? groupsFor(day, windows, day.dateKey === todayKey) : [];

    return (
        <div className="flex min-w-0 flex-col gap-8">
            <section className="flex flex-col gap-3" aria-labelledby={`${ids}-day`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="t-h2" id={`${ids}-day`}>
                        Choose a day
                    </h2>
                    <span className="t-meta">{spanLabel(days)}</span>
                </div>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(60px,1fr))]">
                    {days.map((d) => {
                        const pressed = d.dateKey === activeDay;
                        const free = d.slots.filter((s) => !s.taken).length;
                        return (
                            <button
                                key={d.dateKey}
                                type="button"
                                aria-pressed={pressed}
                                aria-label={`${d.label}, ${free === 0 ? "full" : `${free} ${free === 1 ? "time" : "times"} open`}`}
                                onClick={() => onSelectDay(d.dateKey)}
                                className={cx(
                                    "flex h-[76px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-r1 border px-1",
                                    pressed ? "border-r1-ink bg-r1-ink text-r1-paper" : "border-r1-line bg-r1-paper text-r1-ink hover:bg-r1-fill",
                                )}
                            >
                                <span className={cx("text-xs leading-4", pressed ? "text-r1-line-2" : "text-r1-ink-3")}>
                                    {d.dateKey === todayKey ? "Today" : DOW[weekdayOf(d.dateKey)]}
                                </span>
                                <span className="text-xl font-semibold leading-6 tabular-nums">{parseKey(d.dateKey).d}</span>
                                <span className={cx("text-xs leading-4 tabular-nums", pressed ? "text-r1-line-2" : "text-r1-ink-3")}>
                                    {free === 0 ? "Full" : `${free} open`}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby={`${ids}-time`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="t-h2" id={`${ids}-time`}>
                        Pick a time
                    </h2>
                    {day && <span className="t-meta">{day.label}</span>}
                </div>
                <div className="flex flex-col gap-6">
                    {groups.map((g) => (
                        <div key={g.start} className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                                <h3 className="text-sm font-medium leading-5 text-r1-ink">{g.title}</h3>
                                <span className="t-meta t-num">{g.range}</span>
                            </div>
                            {g.passed ? (
                                <div className="flex min-h-12 items-center rounded-r1 bg-r1-fill-2 px-4 py-3">
                                    <p className="t-meta">These times have passed for today. Pick a later time, or another day.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col border-t border-r1-line">
                                    {g.rows.map((row) => (
                                        <div
                                            key={row.hour}
                                            className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2 border-b border-r1-line-3 py-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-4"
                                        >
                                            <span className="text-[11px] leading-4 text-r1-ink-3 tabular-nums sm:text-[13px] sm:leading-[18px]">
                                                {row.hour}
                                            </span>
                                            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                                                {row.cells.map((c, i) => {
                                                    if (c === null) return <span key={i} aria-hidden="true" />;
                                                    const { slot, short } = c;
                                                    if (mine != null && slot.startMs === mine) {
                                                        return (
                                                            <span
                                                                key={i}
                                                                className="flex h-10 flex-col items-center justify-center rounded-r1 border border-dashed border-r1-ink-4 text-xs leading-[14px] text-r1-ink-2 tabular-nums sm:flex-row sm:gap-1.5 sm:text-[13px]"
                                                            >
                                                                <span>{short}</span>
                                                                <span>
                                                                    <span className="max-sm:hidden">· </span>yours
                                                                </span>
                                                            </span>
                                                        );
                                                    }
                                                    if (slot.taken) {
                                                        return (
                                                            <span
                                                                key={i}
                                                                className="flex h-10 items-center justify-center text-[13px] text-r1-ink-3 line-through tabular-nums sm:text-sm"
                                                            >
                                                                {short}
                                                                <span className="sr-only">, already booked</span>
                                                            </span>
                                                        );
                                                    }
                                                    const pressed = slot.startMs === selected;
                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            aria-pressed={pressed}
                                                            aria-label={slot.label}
                                                            disabled={disabled}
                                                            onClick={() => onSelect(slot)}
                                                            className={cx(
                                                                "h-10 min-w-0 rounded-r1 border text-[13px] font-medium tabular-nums disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm",
                                                                pressed
                                                                    ? "border-r1-ink bg-r1-ink text-r1-paper"
                                                                    : "border-r1-line-2 bg-r1-paper text-r1-ink hover:border-[var(--r1-line-hover)] hover:bg-r1-fill",
                                                            )}
                                                        >
                                                            {short}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <p className="t-meta">All times are Philippine time (GMT+8). Book up to two weeks ahead, and at least an hour before the call.</p>
            </section>
        </div>
    );
}

/** The picker's shape while the times load: the day strip, then hour rows. */
export function SlotPickerSkeleton() {
    return (
        <Loading label="Loading available times">
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                    <Skeleton width={120} height={16} />
                    <div className="grid grid-cols-5 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(60px,1fr))]">
                        {Array.from({ length: 10 }, (_, i) => (
                            <Skeleton key={i} height={76} className="rounded-r1" />
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <Skeleton width={100} height={16} />
                    <Skeleton width={180} height={12} />
                    <div className="flex flex-col border-t border-r1-line">
                        {Array.from({ length: 6 }, (_, i) => (
                            <div key={i} className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2 border-b border-r1-line-3 py-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-4">
                                <Skeleton width={28} height={10} />
                                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                                    {Array.from({ length: 4 }, (_, j) => (
                                        <Skeleton key={j} height={40} className="rounded-r1" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Loading>
    );
}
