import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * The ledger of call reminders sent, so nobody is reminded twice.
 *
 * KEYED ON THE CALENDAR EVENT, NOT A BOOKING ROW. Reminders go to every
 * 10-minute call on the tendso.hr calendar, and most of those were never booked
 * here: TidyCal and the HR pipeline write straight to the calendar and leave no
 * row in this app until the call is over. The event is the one thing every call
 * has.
 *
 * AND ON THE START TIME. A rescheduled call keeps its event id, so without the
 * time a call moved from tomorrow to next week would already count as reminded
 * and never be reminded for the day it actually happens.
 */

const kind = v.union(v.literal("early"), v.literal("soon"));

/** What has already gone out for these events. */
export const sentForEvents = internalQuery({
  args: { eventIds: v.array(v.string()) },
  handler: async (ctx, { eventIds }) => {
    const out: Array<{ calendarEventId: string; kind: "early" | "soon"; startMs: number; sentAt: number }> = [];
    for (const eventId of eventIds) {
      const rows = await ctx.db
        .query("call_reminders")
        .withIndex("by_event", (q) => q.eq("calendarEventId", eventId))
        .collect();
      for (const r of rows) {
        out.push({ calendarEventId: r.calendarEventId, kind: r.kind, startMs: r.startMs, sentAt: r.sentAt });
      }
    }
    return out;
  },
});

/**
 * Claim a reminder before sending it. Returns the claim, or null if it is taken.
 *
 * Mutations are serializable, so this is what stops two overlapping runs from
 * both emailing the same person. The claim is taken BEFORE the email rather than
 * after: a crash between sending and recording would send it again next hour,
 * and a duplicate reminder is worse than a retried one.
 */
export const claim = internalMutation({
  args: { calendarEventId: v.string(), kind, startMs: v.number(), email: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("call_reminders")
      .withIndex("by_event", (q) => q.eq("calendarEventId", args.calendarEventId))
      .collect();
    if (rows.some((r) => r.kind === args.kind && r.startMs === args.startMs)) return null;
    return await ctx.db.insert("call_reminders", { ...args, sentAt: Date.now() });
  },
});

/** Hand a claim back after the send failed, so the next run tries again. */
export const release = internalMutation({
  args: { id: v.id("call_reminders") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

/**
 * Manage tokens for the calls that were booked on our own page.
 *
 * Those are the only calls whose reminder can carry our Reschedule and Cancel
 * buttons: the token is the credential those links use, and it exists only for
 * bookings made here.
 */
export const manageTokensForEvents = internalQuery({
  args: { eventIds: v.array(v.string()) },
  handler: async (ctx, { eventIds }) => {
    const out: Array<{ calendarEventId: string; manageToken: string }> = [];
    for (const eventId of eventIds) {
      const row = await ctx.db
        .query("native_bookings")
        .withIndex("by_calendarEventId", (q) => q.eq("calendarEventId", eventId))
        .first();
      if (row && row.status === "confirmed" && row.manageToken) {
        out.push({ calendarEventId: eventId, manageToken: row.manageToken });
      }
    }
    return out;
  },
});
