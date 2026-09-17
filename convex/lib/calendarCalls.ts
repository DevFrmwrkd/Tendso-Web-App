/**
 * Reading Tendso's 10-minute calls off the shared tendso.hr calendar.
 *
 * Pure: it turns a raw Google Calendar event into a call and touches no network,
 * database or clock, so it can be tested against real event shapes. Deliberately
 * free of the "use node" Google client, so nothing that imports it drags that in.
 */
import { isValidSlot, type SlotConfig } from "./availability";

/** Only the fields of a calendar event this app actually reads. */
export type RawCalendarEvent = {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  hangoutLink?: string | null;
  /** When the event was created, which is when the call was booked. */
  created?: string | null;
  start?: { dateTime?: string | null } | null;
  end?: { dateTime?: string | null } | null;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string | null; uri?: string | null }> | null;
  } | null;
  /** Where a TidyCal booking keeps the person. Our own events carry nobody —
   *  createBooking deliberately sets no attendees so Google does not send its
   *  own invite — so this is empty for calls made through our page and is the
   *  ONLY identity we have for calls made through the old link. */
  attendees?: Array<{
    email?: string | null;
    displayName?: string | null;
    organizer?: boolean | null;
    self?: boolean | null;
    responseStatus?: string | null;
  }> | null;
};

export type CallOrigin = "page" | "tidycal" | "hr_pipeline" | "calendar";

/** One Tendso call as it exists on the calendar. */
export type CalendarCall = {
  eventId: string;
  startMs: number;
  endMs: number;
  summary: string;
  meetUrl: string | null;
  /** From our own `Candidate:/Email:` description convention, falling back to
   *  the event's attendees, which is where a TidyCal booking keeps them. Still
   *  null when neither carries a person. */
  name: string | null;
  email: string | null;
  /** The start time is not a slot we actually offer. These are the calls the
   *  old booking link sold: nobody is working then, so nobody will be there.
   *  Computed HERE, from the same isValidSlot the booking path uses, so a page
   *  never has to re-derive the hours and reach a different answer. */
  outsideHours: boolean;
  /** Which system sold it. Their event titles are identical, so this comes from
   *  the line each one signs its descriptions with. */
  origin: CallOrigin;
  /** When the booking was made, from the event's own creation time. */
  bookedAtMs: number | null;
  /** The guest said no to the invite. Only possible where there is a guest on
   *  the event at all, which in practice means TidyCal. */
  declined: boolean;
  /** TidyCal's own reschedule-or-cancel page for this booking. A TidyCal call
   *  can only be moved there: sending the person to our booking page would
   *  create a second booking and leave the first one standing. */
  externalManageUrl: string | null;
};

/**
 * Which system sold this call, read off the line each one signs its events with.
 *
 * Three of them write to the one tendso.hr calendar and the titles are
 * identical, so the description is the only thing that tells them apart. Checked
 * against 481 real events: every one matched exactly one of these.
 */
export function callOrigin(description: string): CallOrigin {
  if (description.includes("Created by TidyCal")) return "tidycal";
  if (description.includes("tendso.com/field-agent/book")) return "page";
  // The sibling HR pipeline, whose own page calls itself "the Tendso booking page".
  if (description.includes("Booked on the Tendso booking page")) return "hr_pipeline";
  // Made by hand in the mailbox, or signed in a way we have not seen before.
  return "calendar";
}

/**
 * One calendar event as a call, or null when it is not one of ours.
 *
 * `ownAddress` is the calendar's own mailbox, passed in rather than imported so
 * this file stays clear of the Google client module.
 */
export function extractCall(
  ev: RawCalendarEvent,
  config: SlotConfig,
  ownAddress: string,
): CalendarCall | null {
  if (!ev.id || ev.status === "cancelled") return null;
  const summary: string = ev.summary ?? "";
  if (!summary.toLowerCase().includes("tendso")) return null;

  // All-day entries have `date` instead of `dateTime` and are never calls.
  const startIso = ev.start?.dateTime;
  const endIso = ev.end?.dateTime;
  if (!startIso || !endIso) return null;

  const description: string = ev.description ?? "";
  const nameMatch = description.match(/Candidate:\s*(.+)/);
  const emailMatch = description.match(/Email:\s*(\S+@\S+)/);

  // Everyone on the event who is not us. Google marks the calendar owner with
  // `self`/`organizer`, and tendso.hr can also appear as a plain attendee, so
  // all three are excluded before taking the first human left.
  const guest = (ev.attendees ?? []).find(
    (a) =>
      !a?.organizer &&
      !a?.self &&
      !!a?.email &&
      a.email.toLowerCase() !== ownAddress.toLowerCase(),
  );

  const startMs = new Date(startIso).getTime();
  const origin = callOrigin(description);
  const created = ev.created ? Date.parse(ev.created) : NaN;
  // Only TidyCal's own domain is ever turned into a button. A description is
  // free text, and a link from it lands in an email we send under our name.
  const tidycalLink =
    origin === "tidycal"
      ? description.match(/Reschedule or cancel:\s*(https:\/\/tidycal\.com\/\S+)/i)?.[1] ?? null
      : null;

  return {
    eventId: ev.id,
    startMs,
    endMs: new Date(endIso).getTime(),
    summary,
    meetUrl:
      ev.hangoutLink ??
      ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ??
      null,
    name: nameMatch ? nameMatch[1].trim() : (guest?.displayName?.trim() || null),
    email: emailMatch
      ? emailMatch[1].trim().toLowerCase()
      : (guest?.email?.trim().toLowerCase() || null),
    outsideHours: !isValidSlot(startMs, config),
    origin,
    bookedAtMs: Number.isFinite(created) ? created : null,
    declined: guest?.responseStatus === "declined",
    externalManageUrl: tidycalLink,
  };
}
