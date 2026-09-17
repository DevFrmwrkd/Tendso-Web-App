/**
 * Who is owed which call reminder, and when. Pure: it takes the rows and the
 * time, and touches no network, database or clock of its own, so the rules can be
 * tested against scenarios instead of waited for. The sending lives in
 * convex/booking.ts.
 */
import type { Id } from "../_generated/dataModel";
import { manilaDateKey } from "./availability";

export const HOUR_MS = 60 * 60 * 1000;

/** The day-before reminder goes out when the call is this far away. */
export const REMINDER_EARLY = { min: 12 * HOUR_MS, max: 26 * HOUR_MS };
/** The on-the-day reminder, a few hours out. */
export const REMINDER_SOON = { min: 15 * 60 * 1000, max: 8 * HOUR_MS };
/** Someone who booked a moment ago has just read their confirmation. */
const REMINDER_MIN_AGE_MS = 2 * HOUR_MS;
/** Never two reminders closer together than this. */
const REMINDER_MIN_GAP_MS = 4 * HOUR_MS;
/** No reminders go out between these Manila hours; they wait for the morning. */
const QUIET_FROM_HOUR = 23;
const QUIET_UNTIL_HOUR = 7;

export function manilaHour(ms: number): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(ms)),
  );
}

/** "Today", "Tomorrow", or the weekday, in Manila. */
export function relativeDayWord(startMs: number, now: number): string {
  const day = manilaDateKey(startMs);
  if (day === manilaDateKey(now)) return "Today";
  if (day === manilaDateKey(now + 24 * HOUR_MS)) return "Tomorrow";
  return new Date(startMs).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
  });
}

export type ReminderPlan = {
  id: Id<"native_bookings">;
  kind: "early" | "soon";
  email: string;
  firstName: string;
  startMs: number;
  meetUrl: string | null;
  manageToken: string;
};

/**
 * Work out who is owed which reminder right now.
 *
 * Kept separate from the sending so a dry run shows exactly what a real run
 * would do, and so the rules can be read in one place:
 *
 *   early — the call is 12 to 26 hours away
 *   soon  — the call is 15 minutes to 8 hours away
 *
 * and neither goes to someone who booked in the last two hours, nor within four
 * hours of the other reminder, nor during the quiet hours overnight. A 10 AM
 * call's on-the-day reminder therefore goes out at 7 AM rather than at 2.
 */
export function planReminders(
  rows: Array<{
    _id: Id<"native_bookings">;
    startMs: number;
    createdAt: number;
    name: string;
    email: string;
    meetUrl?: string;
    manageToken: string;
    reminderEarlySentAt?: number;
    reminderSoonSentAt?: number;
  }>,
  now: number,
  takeoverMs: number,
): ReminderPlan[] {
  const hour = manilaHour(now);
  if (hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR) return [];

  const plans: ReminderPlan[] = [];
  for (const row of rows) {
    // Before the handover, the HR pipeline is still reminding this call.
    if (row.startMs < takeoverMs) continue;
    if (now - row.createdAt < REMINDER_MIN_AGE_MS) continue;

    const until = row.startMs - now;
    const lastSent = Math.max(row.reminderEarlySentAt ?? 0, row.reminderSoonSentAt ?? 0);
    if (lastSent && now - lastSent < REMINDER_MIN_GAP_MS) continue;

    let kind: "early" | "soon" | null = null;
    if (until > REMINDER_SOON.min && until <= REMINDER_SOON.max && !row.reminderSoonSentAt) {
      kind = "soon";
    } else if (
      until > REMINDER_EARLY.min &&
      until <= REMINDER_EARLY.max &&
      !row.reminderEarlySentAt &&
      // Once the on-the-day reminder has gone, a late day-before one is noise.
      !row.reminderSoonSentAt
    ) {
      kind = "early";
    }
    if (!kind) continue;

    plans.push({
      id: row._id,
      kind,
      email: row.email,
      firstName: row.name.split(/\s+/)[0] || "there",
      startMs: row.startMs,
      meetUrl: row.meetUrl ?? null,
      manageToken: row.manageToken,
    });
  }
  return plans;
}
