"use node";

import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { createTendsoCalendarClient, sendAsTendso } from "./lib/tendsoGoogle";
import {
  generateSlots,
  isValidSlot,
  slotEnd,
  manilaDateKey,
  manilaDayLabel,
  manilaTimeLabel,
} from "./lib/availability";
import { requireAdmin, requireStaff } from "./lib/auth";

// Annotated explicitly: the handler reaches back into `internal.*`, which is
// typed from _generated/api.d.ts, which in turn includes this action. Without
// a declared return type that cycle makes TS give up (TS7022/TS7023).
type BookingResult =
  | { ok: true; startMs: number; when: string; meetUrl: string | null }
  | { ok: false; error: string };

type DaySlot = {
  startMs: number;
  label: string;
  /** Already busy on the calendar, or held/booked here. Returned rather than
   *  dropped so the page can show it struck through — an hour grid with the
   *  taken times missing reads as "we don't open then", which is a different
   *  and wrong message. createBooking still refuses these. */
  taken: boolean;
};

type AvailabilityResult = {
  days: Array<{ dateKey: string; label: string; slots: DaySlot[] }>;
  /** True when the calendar could not be reached at all, so the empty grid
   *  means "we don't know", not "nothing is free". */
  calendarUnavailable?: boolean;
  /** Somewhere else the candidate can still book while that is true. */
  fallbackUrl?: string;
};

/** Errors arrive as `unknown`; these read them without reaching for `any`. */
function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : JSON.stringify(err);
}

/** googleapis puts the HTTP status on `code`, or on `response.status`. */
function errStatus(err: unknown): number | undefined {
  const e = err as { code?: unknown; response?: { status?: unknown } } | null;
  if (typeof e?.code === "number") return e.code;
  if (typeof e?.response?.status === "number") return e.response.status;
  return undefined;
}

/** Only the fields of a calendar event this file actually reads. */
type RawCalendarEvent = {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  hangoutLink?: string | null;
  start?: { dateTime?: string | null } | null;
  end?: { dateTime?: string | null } | null;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string | null; uri?: string | null }> | null;
  } | null;
};

/** Booking path that does not depend on our Google OAuth, for when ours breaks. */
const DEFAULT_FALLBACK_BOOKING_URL = "https://tidycal.com/team/tendso/10-minute-meetings-tendso";

/** How far ahead the page lets people book, and how soon is too soon. */
const HORIZON_DAYS = 14;
const MIN_LEAD_MS = 60 * 60 * 1000; // no booking a call starting within the hour

/**
 * Busy instants on the tendso.hr calendar. This is what keeps the native page
 * and the TidyCal backup link from double-booking the same slot: both write to
 * this one calendar, so both show up here.
 */
async function busyRanges(fromMs: number, toMs: number): Promise<Array<[number, number]>> {
  const calendar = await createTendsoCalendarClient();
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: new Date(fromMs).toISOString(),
      timeMax: new Date(toMs).toISOString(),
      items: [{ id: "primary" }],
    },
  });
  // Typed by hand: the calendar client comes from a lazy `import("googleapis")`
  // (see lib/tendsoGoogle.ts), which erases googleapis' own types.
  const busy: Array<{ start?: string | null; end?: string | null }> =
    res.data.calendars?.primary?.busy ?? [];
  return busy
    .filter((b) => b.start && b.end)
    .map((b) => [new Date(b.start!).getTime(), new Date(b.end!).getTime()] as [number, number]);
}

const overlaps = (startMs: number, ranges: Array<[number, number]>) => {
  const end = slotEnd(startMs);
  return ranges.some(([bs, be]) => startMs < be && end > bs);
};

/**
 * Public: the bookable grid for the next two weeks, grouped by Manila day.
 * Slots already busy on the calendar, or held/booked natively, are omitted
 * rather than greyed out, so the page never offers something that will fail.
 */
export const getAvailability = action({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }): Promise<AvailabilityResult> => {
    const now = Date.now();
    const fromMs = now + MIN_LEAD_MS;
    const toMs = now + (days ?? HORIZON_DAYS) * 86_400_000;

    const config = await ctx.runQuery(internal.nativeBookings.getSlotConfigInternal, {});
    const candidates = generateSlots(fromMs, toMs, config);
    if (!candidates.length) return { days: [] };

    // allSettled, not all: with Promise.all a calendar failure abandons the
    // still-running query, and Convex warns that an un-awaited operation may
    // never run at all ("outstanding query call"). Both are cheap reads, so
    // let both finish and decide afterwards.
    const [busyResult, takenResult] = await Promise.allSettled([
      busyRanges(fromMs, toMs),
      ctx.runQuery(internal.nativeBookings.takenSlots, { fromMs, toMs }),
    ]);

    if (busyResult.status === "rejected") {
      // Usually a revoked refresh token. Offering slots without knowing what
      // is already busy would double-book, so offer nothing and hand the
      // candidate a booking path that does not run on our OAuth. A dead token
      // should cost us a nicer booking page, not the booking itself.
      console.error(
        "getAvailability: calendar unreachable:",
        busyResult.reason?.message ?? busyResult.reason,
      );
      // Tendso keeps operational knobs in `settings`, not systemConfig.
      const configured = await ctx.runQuery(api.settings.get, {
        key: "field_agent_booking_fallback_url",
      });
      return {
        days: [],
        calendarUnavailable: true,
        fallbackUrl: configured || DEFAULT_FALLBACK_BOOKING_URL,
      };
    }

    const busy = busyResult.value;
    // Our own held/confirmed rows. If this read is the one that failed, the
    // calendar still answered, and every confirmed booking is an event on it —
    // so the grid stays correct, it just loses the 3-minute holds.
    const taken = takenResult.status === "fulfilled" ? takenResult.value : [];
    const takenSet = new Set<number>(taken);

    // EVERY candidate is returned, flagged. A day whose slots are all taken now
    // appears too, full rather than absent — which is the honest thing to show
    // and stops "no times" meaning two different things.
    const byDay = new Map<string, { dateKey: string; label: string; slots: DaySlot[] }>();
    for (const s of candidates) {
      const key = manilaDateKey(s);
      if (!byDay.has(key)) byDay.set(key, { dateKey: key, label: manilaDayLabel(s), slots: [] });
      byDay.get(key)!.slots.push({
        startMs: s,
        label: manilaTimeLabel(s),
        taken: takenSet.has(s) || overlaps(s, busy),
      });
    }
    return { days: [...byDay.values()] };
  },
});

/**
 * Public: book a slot. Order matters — claim the slot in a transaction first,
 * then re-check the live calendar, then write the event. A failure after the
 * claim releases it, so a crashed attempt never silently burns a slot.
 *
 * The event deliberately carries no `attendees`: adding them makes Google mail
 * the candidate immediately with its own generic invite. The candidate goes in
 * the description using the `Candidate: / Email:` convention that
 * sendCallReminder.ts parses, and we send our own confirmation below.
 */
export const createBooking = action({
  args: {
    startMs: v.number(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { startMs, name, email }): Promise<BookingResult> => {
    const now = Date.now();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) return { ok: false as const, error: "Please enter your name." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { ok: false as const, error: "Please enter a valid email address." };
    }
    const config = await ctx.runQuery(internal.nativeBookings.getSlotConfigInternal, {});
    if (!isValidSlot(startMs, config)) {
      return { ok: false as const, error: "That time isn't a valid slot." };
    }
    if (startMs < now + MIN_LEAD_MS) {
      return { ok: false as const, error: "That slot is too soon. Please pick a later one." };
    }

    const claim = await ctx.runMutation(internal.nativeBookings.claimSlot, {
      startMs,
      name: cleanName,
      email: cleanEmail,
    });
    if (!claim.ok) {
      if (claim.reason === "slot_taken") {
        return { ok: false as const, error: "Someone just took that slot. Please pick another." };
      }
      if (claim.reason === "already_booked") {
        return {
          ok: false as const,
          error: `You already have a call booked for ${manilaDayLabel(claim.startMs!)} at ${manilaTimeLabel(claim.startMs!)} (Manila time). Reply to your confirmation email if you need to move it.`,
        };
      }
      return { ok: false as const, error: "That slot isn't available. Please pick another." };
    }

    try {
      // Re-check against the live calendar now that the slot is ours: a TidyCal
      // booking could have landed between the page loading and this click.
      const busy = await busyRanges(startMs - 60_000, slotEnd(startMs) + 60_000);
      if (overlaps(startMs, busy)) {
        await ctx.runMutation(internal.nativeBookings.releaseHold, { id: claim.id, reason: "calendar_busy" });
        return { ok: false as const, error: "Someone just took that slot. Please pick another." };
      }

      const calendar = await createTendsoCalendarClient();
      const requestId = `nb-${claim.id}`;
      const event = await calendar.events.insert({
        calendarId: "primary",
        conferenceDataVersion: 1,
        sendUpdates: "none",
        requestBody: {
          summary: "10-Minute-Meeting with Tendso",
          description:
            `Candidate: ${cleanName}\nEmail: ${cleanEmail}\n\n` +
            "Booked on tendso.com/field-agent/book.",
          start: { dateTime: new Date(startMs).toISOString(), timeZone: "Asia/Manila" },
          end: { dateTime: new Date(slotEnd(startMs)).toISOString(), timeZone: "Asia/Manila" },
          conferenceData: {
            createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
          },
        },
      });

      const meetUrl =
        event.data.hangoutLink ??
        event.data.conferenceData?.entryPoints?.find(
          (p: { entryPointType?: string | null; uri?: string | null }) =>
            p.entryPointType === "video",
        )?.uri ??
        undefined;

      await ctx.runMutation(internal.nativeBookings.confirmBooking, {
        id: claim.id,
        calendarEventId: event.data.id!,
        meetUrl,
      });

      const when = `${manilaDayLabel(startMs)} at ${manilaTimeLabel(startMs)} (Manila time)`;
      const body = `Hi ${cleanName.split(/\s+/)[0]},

You're booked. Your 10-minute call with Tendso is on ${when}.

${meetUrl ? `Here's your Google Meet link: ${meetUrl}` : "We'll send your Google Meet link shortly."}

We'll also send you a reminder before the call. If you can no longer make it, just reply "CANCEL" to this email so we can free up the slot for someone else.

Talk soon,
Tendso HR Team`;

      try {
        await sendAsTendso({
          to: cleanEmail,
          subject: `Confirmed: your 10-minute call with Tendso, ${manilaDayLabel(startMs)}`,
          text: body,
        });
      } catch (err) {
        // The booking is real even if the receipt bounces — the reminder cron
        // will still reach them. Don't fail the booking over an email.
        console.error(`Booking confirmation email failed for ${cleanEmail}:`, errMessage(err));
      }

      return { ok: true as const, startMs, when, meetUrl: meetUrl ?? null };
    } catch (err) {
      await ctx.runMutation(internal.nativeBookings.releaseHold, {
        id: claim.id,
        reason: errMessage(err),
      });
      console.error("createBooking failed:", errMessage(err));
      return { ok: false as const, error: "Something went wrong booking that slot. Please try again." };
    }
  },
});

/**
 * Reconcile our bookings against the calendar: anything cancelled or deleted
 * there is marked cancelled here, which reopens the slot.
 *
 * WHY THIS EXISTS. Deleting the event in Google Calendar frees the calendar but
 * not the page. Availability blocks a slot if EITHER source says taken, and a
 * confirmed row counts as taken forever regardless of the calendar — so without
 * this, a cancelled call leaves a permanently dead slot, and the person who
 * booked it cannot book again (one live booking per email).
 *
 * ONE-WAY ON PURPOSE. It only ever releases. It never creates a booking from a
 * calendar entry and never deletes a row, so the worst a bad sync can do is
 * offer a time that is still busy — which the freebusy check catches anyway.
 */
async function reconcile(ctx: ActionCtx): Promise<{ checked: number; released: number }> {
  const now = Date.now();
  // A day back as well as forward: a call cancelled an hour after it was due to
  // start should still release, and it costs one query either way.
  const fromMs = now - 24 * 60 * 60 * 1000;
  const toMs = now + 60 * 24 * 60 * 60 * 1000;

  const rows: Array<{ _id: Id<"native_bookings">; calendarEventId?: string }> = await ctx.runQuery(
    internal.nativeBookings.confirmedInWindow,
    { fromMs, toMs },
  );
  if (!rows.length) return { checked: 0, released: 0 };

  const calendar = await createTendsoCalendarClient();
  // One list call for the whole window rather than one per booking. showDeleted
  // is the point: a deleted event comes back with status "cancelled" instead of
  // being silently absent, which is what makes this reliable.
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date(fromMs).toISOString(),
    timeMax: new Date(toMs).toISOString(),
    showDeleted: true,
    singleEvents: true,
    maxResults: 2500,
  });
  const status = new Map<string, string>();
  for (const ev of (res.data.items ?? []) as Array<{ id?: string | null; status?: string | null }>) {
    if (ev.id) status.set(ev.id, ev.status ?? "confirmed");
  }

  let released = 0;
  for (const row of rows) {
    if (!row.calendarEventId) continue; // confirmed without an event id: leave it alone
    const known = status.get(row.calendarEventId);

    if (known === undefined) {
      // Absent from the window is NOT proof of deletion — the event may have
      // been moved outside it. Ask about this one directly before releasing a
      // slot somebody is still expecting to be booked.
      try {
        const one = await calendar.events.get({
          calendarId: "primary",
          eventId: row.calendarEventId,
        });
        if (one.data.status !== "cancelled") continue;
      } catch (err) {
        // 404/410 means really gone. Anything else (rate limit, network) is not
        // evidence, so leave the booking alone and try again next run.
        const code = errStatus(err);
        if (code !== 404 && code !== 410) continue;
      }
    } else if (known !== "cancelled") {
      continue;
    }

    const changed = await ctx.runMutation(internal.nativeBookings.markCancelled, {
      id: row._id,
      reason: "cancelled on the calendar",
    });
    if (changed) released++;
  }

  return { checked: rows.length, released };
}

/** Admin: the /admin/bookings sync button. */
export const syncCancelledBookings = action({
  args: {},
  handler: async (ctx): Promise<{ checked: number; released: number }> => {
    await requireAdmin(ctx);
    return await reconcile(ctx);
  },
});

/** The same reconcile, hourly, so slots come back without anyone pressing anything. */
export const syncCancelledBookingsCron = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    try {
      const { checked, released } = await reconcile(ctx);
      if (released) console.log(`[BOOKING-SYNC] released ${released} of ${checked} bookings`);
    } catch (err) {
      // A dead token must not turn into a failing cron every hour forever.
      console.error("[BOOKING-SYNC] failed:", errMessage(err));
    }
  },
});

/** One Tendso call as it exists on the calendar. */
export type CalendarCall = {
  eventId: string;
  startMs: number;
  endMs: number;
  summary: string;
  meetUrl: string | null;
  /** Parsed out of the description when it follows our `Candidate:/Email:`
   *  convention. A TidyCal booking will not, so these can be null. */
  name: string | null;
  email: string | null;
};

/**
 * The Tendso calls on the tendso.hr calendar, for /admin/bookings.
 *
 * WHY THIS EXISTS ALONGSIDE OUR OWN TABLE. Bookings made through the page are
 * already in `native_bookings`, Meet link and all. Bookings made any other way —
 * the TidyCal fallback, or an event somebody creates by hand — exist ONLY on the
 * calendar. Without this, staff would have to open the tendso.hr mailbox to see
 * them, which is the thing the staff role exists to avoid.
 *
 * ONLY TENDSO CALLS. Events are filtered to those whose title mentions Tendso.
 * The account's primary calendar can hold private entries, and this endpoint is
 * readable by every staff account, so anything unmatched is never returned —
 * not its title, not its guests, not its description.
 */
export const listCalendarCalls = action({
  args: { daysAhead: v.optional(v.number()) },
  handler: async (ctx, { daysAhead }): Promise<CalendarCall[]> => {
    await requireStaff(ctx);

    const now = Date.now();
    const fromMs = now - 24 * 60 * 60 * 1000;
    const toMs = now + (daysAhead ?? 30) * 24 * 60 * 60 * 1000;

    const calendar = await createTendsoCalendarClient();
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date(fromMs).toISOString(),
      timeMax: new Date(toMs).toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
    });

    const items = (res.data.items ?? []) as RawCalendarEvent[];
    const calls: CalendarCall[] = [];

    for (const ev of items) {
      if (!ev.id || ev.status === "cancelled") continue;
      const summary: string = ev.summary ?? "";
      if (!summary.toLowerCase().includes("tendso")) continue;

      // All-day entries have `date` instead of `dateTime` and are never calls.
      const startIso = ev.start?.dateTime;
      const endIso = ev.end?.dateTime;
      if (!startIso || !endIso) continue;

      const description: string = ev.description ?? "";
      const nameMatch = description.match(/Candidate:\s*(.+)/);
      const emailMatch = description.match(/Email:\s*(\S+@\S+)/);

      calls.push({
        eventId: ev.id,
        startMs: new Date(startIso).getTime(),
        endMs: new Date(endIso).getTime(),
        summary,
        meetUrl:
          ev.hangoutLink ??
          ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ??
          null,
        name: nameMatch ? nameMatch[1].trim() : null,
        email: emailMatch ? emailMatch[1].trim().toLowerCase() : null,
      });
    }

    return calls;
  },
});
