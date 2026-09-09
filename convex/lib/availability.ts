/**
 * Native booking availability for the Tendso HR 10-minute call.
 *
 *   Mon–Fri, Asia/Manila, 10:00–14:00 and 20:00–24:00
 *   15-minute cadence, 10-minute calls  ->  32 slots/day
 *
 * The TidyCal "Tendso HR TEAM" schedule was set to the same hours — verified
 * 2026-09-08 against the live booking page (last afternoon slot 1:45 PM, next
 * slot 8:00 PM). NOTHING ENFORCES THIS. TidyCal's availability is configured in
 * its own dashboard, this repo can only read TidyCal (syncTidyCal does a single
 * GET; there is no write path), and no test or check will fail if the two drift.
 * If you change WINDOWS, change TidyCal by hand in the same sitting — and treat
 * this paragraph as a claim to re-verify, not a fact, since the previous version
 * of it went stale without anyone noticing.
 *
 * They can drift safely in one direction only: TidyCal is the break-glass
 * fallback (DEFAULT_FALLBACK_BOOKING_URL in actions/booking.ts, surfaced only
 * when the tendso.hr OAuth token is dead), and both paths write to the one
 * tendso.hr calendar, so the freebusy check in booking.ts stops them
 * double-booking regardless of what hours each offers.
 *
 * Window ends are minutes from Manila midnight and must stay <= 1440. Past that,
 * generateSlots keeps counting into the next day while isValidSlot recomputes
 * minuteOfDay from 0, so the page would offer slots createBooking then rejects.
 *
 * Manila is UTC+8 all year with no DST, so all of this is plain offset
 * arithmetic. Do not swap in a generic tz library without re-checking the
 * slot boundaries against a real booking day.
 */

export const MANILA_OFFSET_MIN = 8 * 60;
export const SLOT_STEP_MIN = 15;
export const SLOT_DURATION_MIN = 10;

/**
 * The bookable schedule. Editable by an admin at /admin/bookings, stored in
 * `settings` under SLOT_CONFIG_KEY, and read by BOTH slot generation and the
 * server-side check in createBooking — they must never disagree, or the page
 * offers times the booking mutation then refuses.
 *
 * Step and duration stay constants: changing them changes the length of the
 * calendar event and the "10-minute call" every page and email promises.
 */
export type SlotConfig = {
  /** 0 = Sunday, matching Date.getUTCDay(). */
  days: number[];
  /** [startMinute, endMinute) windows in Manila local time. */
  windows: Array<[number, number]>;
};

/** Mon–Fri, 10:00–14:00 and 20:00–24:00 — what this shipped with. */
export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  days: [1, 2, 3, 4, 5],
  windows: [
    [10 * 60, 14 * 60],
    [20 * 60, 24 * 60],
  ],
};

/** The `settings` key the config lives under. */
export const SLOT_CONFIG_KEY = 'field_agent_slot_config';

/**
 * Why a window may not be saved. Empty array = fine. The admin mutation runs
 * this; nothing malformed is allowed to reach generateSlots.
 */
export function validateSlotConfig(config: SlotConfig): string[] {
  const errors: string[] = [];
  if (!config.days.length) errors.push('Pick at least one day.');
  if (config.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    errors.push('Days must be 0 (Sunday) through 6 (Saturday).');
  }
  if (!config.windows.length) errors.push('Add at least one time window.');

  for (const [start, end] of config.windows) {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      errors.push('Times must be whole minutes.');
    } else if (start < 0 || end > 1440) {
      // Past 1440 generateSlots keeps counting into the next day while
      // isValidSlot recomputes minuteOfDay from 0, so the page would offer
      // slots createBooking then rejects.
      errors.push('Windows must fall inside one day (00:00–24:00).');
    } else if (end - start < SLOT_DURATION_MIN) {
      errors.push(`A window must be at least ${SLOT_DURATION_MIN} minutes long.`);
    }
  }

  // Overlapping windows would emit the same slot twice.
  const sorted = [...config.windows].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] < sorted[i - 1][1]) errors.push('Time windows overlap.');
  }
  return [...new Set(errors)];
}

/**
 * Whatever is in `settings`, turned into something safe to generate from.
 * Tolerant on purpose: this runs on the READ path, where a malformed value must
 * degrade to the default schedule rather than take the booking page down.
 */
export function normalizeSlotConfig(raw: unknown): SlotConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_SLOT_CONFIG;
  const value = raw as Partial<SlotConfig>;
  const days = Array.isArray(value.days)
    ? [...new Set(value.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  const windows = Array.isArray(value.windows)
    ? value.windows
        .filter(
          (w): w is [number, number] =>
            Array.isArray(w) &&
            w.length === 2 &&
            Number.isInteger(w[0]) &&
            Number.isInteger(w[1]) &&
            w[0] >= 0 &&
            w[1] <= 1440 &&
            w[1] - w[0] >= SLOT_DURATION_MIN,
        )
        .sort((a, b) => a[0] - b[0])
    : [];
  if (!days.length || !windows.length) return DEFAULT_SLOT_CONFIG;

  // Merge any overlap rather than emit a slot twice.
  const merged: Array<[number, number]> = [windows[0]];
  for (const [start, end] of windows.slice(1)) {
    const last = merged[merged.length - 1];
    if (start < last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return { days, windows: merged };
}

const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

/** Wall-clock Manila fields for an instant. */
function manilaParts(ms: number) {
  const shifted = new Date(ms + MANILA_OFFSET_MIN * MS_MIN);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Instant for Manila midnight of the day containing `ms`. */
function manilaMidnight(ms: number): number {
  const p = manilaParts(ms);
  return Date.UTC(p.y, p.m, p.d) - MANILA_OFFSET_MIN * MS_MIN;
}

/** "2026-07-31" in Manila. */
export function manilaDateKey(ms: number): string {
  const p = manilaParts(ms);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** "10:15 AM" in Manila. */
export function manilaTimeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "Friday, July 31" in Manila. */
export function manilaDayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Every slot start in [fromMs, toMs), oldest first. A slot only counts if the
 * whole 10 minutes fits inside its window, which is what makes 13:45 the last
 * morning slot and 14:00 invalid.
 */
export function generateSlots(
  fromMs: number,
  toMs: number,
  config: SlotConfig = DEFAULT_SLOT_CONFIG,
): number[] {
  const days = new Set(config.days);
  const out: number[] = [];
  for (let day = manilaMidnight(fromMs); day < toMs; day += MS_DAY) {
    if (!days.has(manilaParts(day).weekday)) continue;
    for (const [winStart, winEnd] of config.windows) {
      for (let min = winStart; min + SLOT_DURATION_MIN <= winEnd; min += SLOT_STEP_MIN) {
        const start = day + min * MS_MIN;
        if (start >= fromMs && start < toMs) out.push(start);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

/** Is this instant a real bookable slot start? Guards the booking mutation. */
export function isValidSlot(ms: number, config: SlotConfig = DEFAULT_SLOT_CONFIG): boolean {
  if (!Number.isInteger(ms)) return false;
  const p = manilaParts(ms);
  if (!config.days.includes(p.weekday)) return false;
  if (ms % MS_MIN !== 0) return false;
  return config.windows.some(
    ([winStart, winEnd]) =>
      p.minuteOfDay >= winStart &&
      p.minuteOfDay + SLOT_DURATION_MIN <= winEnd &&
      (p.minuteOfDay - winStart) % SLOT_STEP_MIN === 0
  );
}

export const slotEnd = (startMs: number) => startMs + SLOT_DURATION_MIN * MS_MIN;
