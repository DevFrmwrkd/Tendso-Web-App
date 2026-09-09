import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireStaff } from "./lib/auth";
import {
  isValidSlot,
  normalizeSlotConfig,
  slotEnd,
  SLOT_CONFIG_KEY,
  validateSlotConfig,
  type SlotConfig,
} from "./lib/availability";

/**
 * The 10-minute Field Agent call, booked natively.
 *
 * Ported from vonas-hr-pipeline. The invite-token path came out: that repo
 * prefills the form from a `field_agent_leads` row and flips `callBooked` on
 * it afterwards, and neither the table nor the funnel that fills it exists
 * here. Everything else is verbatim, deliberately — both apps write to the one
 * tendso.hr calendar, so the two must agree about what a slot is.
 */

/** A "held" row older than this is an abandoned attempt, so the slot reopens. */
const HOLD_TTL_MS = 3 * 60 * 1000;

function holdIsLive(row: { status: string; createdAt: number }, now: number) {
  if (row.status === "confirmed") return true;
  return row.status === "held" && now - row.createdAt < HOLD_TTL_MS;
}

/** Slot starts that our own bookings already occupy, for the availability grid. */
export const takenSlots = internalQuery({
  args: { fromMs: v.number(), toMs: v.number() },
  handler: async (ctx, { fromMs, toMs }) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("native_bookings")
      .withIndex("by_startMs", (q) => q.gte("startMs", fromMs).lt("startMs", toMs))
      .collect();
    return rows.filter((r) => holdIsLive(r, now)).map((r) => r.startMs);
  },
});

/**
 * Win the slot, or don't. Convex mutations are serializable, so two people
 * clicking the same 10:15 slot at the same instant cannot both get a "held"
 * row — the second transaction sees the first and is rejected. The Google
 * Calendar write happens after this, never instead of it.
 */
export const claimSlot = internalMutation({
  args: {
    startMs: v.number(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { startMs, name, email }) => {
    const now = Date.now();
    // Same schedule the grid was generated from. Read here rather than passed
    // in, so a stale page cannot talk this mutation into an out-of-hours slot.
    const configRow = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SLOT_CONFIG_KEY))
      .first();
    if (!isValidSlot(startMs, normalizeSlotConfig(configRow?.value))) {
      return { ok: false as const, reason: "invalid_slot" };
    }
    if (startMs < now) return { ok: false as const, reason: "in_the_past" };

    const clashes = await ctx.db
      .query("native_bookings")
      .withIndex("by_startMs", (q) => q.eq("startMs", startMs))
      .collect();
    if (clashes.some((r) => holdIsLive(r, now))) {
      return { ok: false as const, reason: "slot_taken" };
    }

    // One live booking per person, so a candidate can't fill the calendar.
    const mine = await ctx.db
      .query("native_bookings")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .collect();
    const existing = mine.find((r) => r.status === "confirmed" && r.startMs > now);
    if (existing) {
      return { ok: false as const, reason: "already_booked", startMs: existing.startMs };
    }

    const id = await ctx.db.insert("native_bookings", {
      startMs,
      endMs: slotEnd(startMs),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      status: "held",
      createdAt: now,
    });
    return { ok: true as const, id };
  },
});

export const confirmBooking = internalMutation({
  args: {
    id: v.id("native_bookings"),
    calendarEventId: v.string(),
    meetUrl: v.optional(v.string()),
  },
  handler: async (ctx, { id, calendarEventId, meetUrl }) => {
    await ctx.db.patch(id, {
      status: "confirmed",
      calendarEventId,
      meetUrl,
      confirmedAt: Date.now(),
    });
  },
});

/** Release a hold whose calendar write failed, so the slot reopens immediately. */
export const releaseHold = internalMutation({
  args: { id: v.id("native_bookings"), reason: v.optional(v.string()) },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "failed" });
  },
});

/**
 * Admin: the booking list behind /admin/bookings.
 *
 * Admin-gated, unlike the `listRecent` it replaces. That one came across in the
 * port as a plain public query returning every booker's name and email, which
 * anyone holding the deployment URL could have read.
 */
export const listForAdmin = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    // Staff too: seeing who is booked is the whole reason that role exists.
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("native_bookings")
      .withIndex("by_startMs")
      .order("desc")
      .take(limit ?? 200);
    // Holds are noise — they live three minutes and mean nothing to a human.
    return rows.filter((r) => r.status === "confirmed" || r.status === "cancelled");
  },
});

/** Confirmed bookings in a window, for the calendar sync to reconcile. */
export const confirmedInWindow = internalQuery({
  args: { fromMs: v.number(), toMs: v.number() },
  handler: async (ctx, { fromMs, toMs }) => {
    const rows = await ctx.db
      .query("native_bookings")
      .withIndex("by_startMs", (q) => q.gte("startMs", fromMs).lt("startMs", toMs))
      .collect();
    return rows.filter((r) => r.status === "confirmed");
  },
});

/**
 * Mark a booking cancelled, which is what actually frees the slot: `holdIsLive`
 * counts only 'held' and 'confirmed', so this drops the row out of both the
 * availability grid and the one-live-booking-per-person rule.
 *
 * The row is kept, never deleted — who booked what, and when it was released,
 * is the history this table exists to hold.
 */
export const markCancelled = internalMutation({
  args: { id: v.id("native_bookings"), reason: v.optional(v.string()) },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.status === "cancelled") return false;
    await ctx.db.patch(id, { status: "cancelled" });
    return true;
  },
});

/** The bookable schedule, as an admin last saved it. */
export const getSlotConfig = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SLOT_CONFIG_KEY))
      .first();
    return normalizeSlotConfig(row?.value);
  },
});

/** Same, for the action and mutation paths that cannot reach the db directly. */
export const getSlotConfigInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SLOT_CONFIG_KEY))
      .first();
    return normalizeSlotConfig(row?.value);
  },
});

/**
 * Replace the bookable schedule. Admins and internal staff.
 *
 * Staff can change these because they are the ones who sit the calls — the
 * hours are their own availability. It is the one thing the role can write;
 * everything else it touches is read-only.
 *
 * Deliberately NOT settings.set — that mutation is public and unauthenticated,
 * so saving the booking hours through it would let anyone rewrite them.
 *
 * Changing this does NOT change TidyCal, which is configured in its own
 * dashboard and is the fallback when our OAuth dies. If the two drift, both
 * still write to the one tendso.hr calendar and the freebusy check keeps them
 * from double-booking — but the fallback will offer different hours.
 */
export const saveSlotConfig = mutation({
  args: {
    days: v.array(v.number()),
    windows: v.array(v.array(v.number())),
  },
  handler: async (ctx, { days, windows }) => {
    const { me } = await requireStaff(ctx);

    const config: SlotConfig = {
      days: [...new Set(days)].sort(),
      windows: windows.map((w) => [w[0], w[1]] as [number, number]),
    };
    const errors = validateSlotConfig(config);
    if (errors.length) throw new Error(errors.join(" "));

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SLOT_CONFIG_KEY))
      .first();
    const patch = {
      value: config,
      description: "Bookable hours for the Field Agent call (/field-agent/book)",
      updatedAt: Date.now(),
      updatedBy: String(me._id),
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("settings", { key: SLOT_CONFIG_KEY, ...patch });
    return config;
  },
});
