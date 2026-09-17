/**
 * Who is owed which call reminder, and when. Pure: it takes the calls and the
 * time, and touches no network, database or clock of its own, so the rules can be
 * tested against scenarios instead of waited for. The sending lives in
 * convex/booking.ts.
 */
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

/** A call that might be owed a reminder, with what has already been sent for it. */
export type ReminderCandidate = {
  eventId: string;
  startMs: number;
  /** When it was booked. Unknown is treated as long enough ago. */
  bookedAtMs: number | null;
  name: string;
  email: string;
  /** Reminders already sent for THIS start time. One sent before a reschedule
   *  does not count: a moved call is a new appointment. */
  earlySentAt?: number;
  soonSentAt?: number;
};

export type ReminderPlan = {
  eventId: string;
  kind: "early" | "soon";
  email: string;
  firstName: string;
  startMs: number;
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
  calls: ReminderCandidate[],
  now: number,
  takeoverMs: number,
): ReminderPlan[] {
  const hour = manilaHour(now);
  if (hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR) return [];

  const plans: ReminderPlan[] = [];
  for (const call of calls) {
    // Before the handover, the HR pipeline is still reminding this call.
    if (call.startMs < takeoverMs) continue;
    if (call.bookedAtMs !== null && now - call.bookedAtMs < REMINDER_MIN_AGE_MS) continue;

    const until = call.startMs - now;
    const lastSent = Math.max(call.earlySentAt ?? 0, call.soonSentAt ?? 0);
    if (lastSent && now - lastSent < REMINDER_MIN_GAP_MS) continue;

    let kind: "early" | "soon" | null = null;
    if (until > REMINDER_SOON.min && until <= REMINDER_SOON.max && !call.soonSentAt) {
      kind = "soon";
    } else if (
      until > REMINDER_EARLY.min &&
      until <= REMINDER_EARLY.max &&
      !call.earlySentAt &&
      // Once the on-the-day reminder has gone, a late day-before one is noise.
      !call.soonSentAt
    ) {
      kind = "early";
    }
    if (!kind) continue;

    plans.push({
      eventId: call.eventId,
      kind,
      email: call.email,
      firstName: call.name.split(/\s+/)[0] || "there",
      startMs: call.startMs,
    });
  }
  return plans;
}
