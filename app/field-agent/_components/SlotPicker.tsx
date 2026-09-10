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
 * The styles travel with the markup, including the breakpoints and the
 * `hover: hover` guard that stops a tapped slot staying inverted on a phone.
 */

import type { CSSProperties } from "react";

export type Slot = { startMs: number; label: string; taken: boolean };
export type Day = { dateKey: string; label: string; slots: Slot[] };
/** A slot placed in its hour row. `short` drops the meridiem the row carries. */
type Cell = Slot & { short: string };

const INK = "#1B1B22";
const PAPER = "#F3F0EA";
const GOLD = "#D4A146";
const MUTED = "#8F8B83";
const WHITE = "#FFFFFF";
const RULE = "#E6E1D7";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EYEBROW: CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: MUTED,
};

const SECTION_HEAD: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
};

/** "2026-09-09" -> parts, without going through Date and picking up a tz. */
export function parseKey(key: string) {
    const [y, m, d] = key.split("-").map(Number);
    return { y, m: m - 1, d };
}

/** Today in Manila, as a dateKey. The action speaks Manila days; so must this. */
export function manilaTodayKey(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

/** "Today", "Full", or how many times are actually still open that day. */
function freeLabel(day: Day, todayKey: string): string {
    if (day.dateKey === todayKey) return "Today";
    const free = day.slots.filter((s) => !s.taken).length;
    return free === 0 ? "Full" : `${free} slots`;
}

/** The month the picker is currently showing, for the section heading. */
export function monthLabelFor(days: Day[] | null, activeDay: string | null): string {
    const key = days?.find((d) => d.dateKey === activeDay)?.dateKey ?? days?.[0]?.dateKey;
    if (!key) return "";
    const p = parseKey(key);
    return new Date(Date.UTC(p.y, p.m, 1)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
}

export default function SlotPicker({
    days,
    activeDay,
    onSelectDay,
    onPickSlot,
    disabled = false,
}: {
    days: Day[];
    activeDay: string | null;
    onSelectDay: (dateKey: string) => void;
    onPickSlot: (slot: Slot) => void;
    disabled?: boolean;
}) {
    const todayKey = manilaTodayKey();
    const day = days.find((d) => d.dateKey === activeDay) ?? null;

    // Grouped into one row per hour, each slot placed by minute into one of four
    // fixed columns. Fixed columns are the point: a booked time leaves a gap
    // exactly where it belongs instead of everything after it shifting left.
    const hourRows: Array<{ hour: string; cells: Array<Cell | null> }> = [];
    const rows = new Map<string, Array<Cell | null>>();
    for (const slot of day?.slots ?? []) {
        // Split on any whitespace: ICU puts U+202F before AM/PM, and JS \s covers it.
        const [time, meridiem] = slot.label.split(/\s+/);
        const [hour, minute] = time.split(":");
        const key = `${hour} ${meridiem}`;
        if (!rows.has(key)) rows.set(key, [null, null, null, null]);
        rows.get(key)![Math.floor(Number(minute) / 15)] = { ...slot, short: time };
    }
    for (const [hour, cells] of rows) hourRows.push({ hour, cells });

    return (
        <>
            <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={SECTION_HEAD}>
                    <span style={EYEBROW}>Choose a day</span>
                    <span style={{ fontSize: 13, color: MUTED }}>
                        Next two weeks · {monthLabelFor(days, activeDay)}
                    </span>
                </div>
                <div
                    className="fa-days"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
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
                                onClick={() => onSelectDay(d.dateKey)}
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
                                <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
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
                                    {freeLabel(d, todayKey)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={SECTION_HEAD}>
                    <span style={EYEBROW}>Pick a time</span>
                    <span style={{ fontSize: 13, color: MUTED }}>{day?.label}</span>
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
                                            disabled={disabled}
                                            onClick={() => onPickSlot(s)}
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

            <style>{`
                /* ── The time grid: one row per hour, four fixed columns ───────── */
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
                .fa-slot:disabled { opacity: .5; cursor: default; }
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
                    .fa-slot:hover:not(:disabled) { background: ${INK}; color: ${PAPER}; border-color: ${INK}; }
                }
                @media (max-width: 420px) {
                    .fa-days { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)) !important; }
                    /* Four columns stay four columns — that alignment is the whole
                       point of the grid — so the gutter and gaps give the width up. */
                    .fa-hourrow { grid-template-columns: 34px minmax(0, 1fr); gap: 8px; }
                    .fa-hourslots { gap: 6px; }
                    .fa-slot, .fa-taken { padding: 11px 2px; font-size: 13px; }
                    .fa-hourlabel { font-size: 11px; }
                }
            `}</style>
        </>
    );
}
