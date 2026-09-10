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

    const manageToken = crypto.randomUUID().replace(/-/g, "");
    const id = await ctx.db.insert("native_bookings", {
      startMs,
      endMs: slotEnd(startMs),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      status: "held",
      createdAt: now,
      // Minted here rather than at confirm time, so the token exists before the
      // calendar write and a booking can never end up confirmed without one.
      manageToken,
    });
    return { ok: true as const, id, manageToken };
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

// ==================== SELF-SERVE MANAGE (token-authenticated) ====================
//
// The Reschedule and Cancel links in the confirmation email. The person who
// booked has no account, so the bearer token from their email IS the auth: it
// names exactly one booking and grants exactly two verbs on it. Everything
// below therefore looks the booking up BY TOKEN and never by id from a client.

/** Internal: one booking by id, for the admin resend. */
export const getByIdInternal = internalQuery({
  args: { id: v.id("native_bookings") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

/** Internal: resolve a manage token to its booking. */
export const getByManageToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    return await ctx.db
      .query("native_bookings")
      .withIndex("by_manageToken", (q) => q.eq("manageToken", token))
      .first();
  },
});

/**
 * Public: what the manage page shows. Only the fields that page needs, and
 * only ever for the one booking the token names.
 */
export const getForManage = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const row = await ctx.db
      .query("native_bookings")
      .withIndex("by_manageToken", (q) => q.eq("manageToken", token))
      .first();
    if (!row) return null;
    return {
      name: row.name,
      email: row.email,
      startMs: row.startMs,
      endMs: row.endMs,
      meetUrl: row.meetUrl ?? null,
      status: row.status,
      // A held row is a booking mid-flight; nothing to manage yet.
      manageable: row.status === "confirmed" && row.startMs > Date.now(),
    };
  },
});

/**
 * Move a confirmed booking to a new slot, in ONE transaction.
 *
 * The row moving IS the release of its old time — availability reads startMs,
 * so nothing else has to free it. Done transactionally because the check that
 * the new slot is empty and the write that fills it must not be separable, or
 * two people rescheduling onto the same time both win.
 *
 * The caller patches Google afterwards and calls this again with the old time
 * if that fails. Deliberately not the other way round: a row parked on a slot
 * nobody holds is recoverable, a calendar event nobody has a row for is not.
 */
export const moveBooking = internalMutation({
  args: { id: v.id("native_bookings"), newStartMs: v.number() },
  handler: async (ctx, { id, newStartMs }) => {
    const now = Date.now();
    const row = await ctx.db.get(id);
    if (!row) return { ok: false as const, reason: "not_found" };
    if (row.status !== "confirmed") return { ok: false as const, reason: "not_confirmed" };

    const configRow = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SLOT_CONFIG_KEY))
      .first();
    if (!isValidSlot(newStartMs, normalizeSlotConfig(configRow?.value))) {
      return { ok: false as const, reason: "invalid_slot" };
    }
    if (newStartMs < now) return { ok: false as const, reason: "in_the_past" };

    // Anyone else on the target slot? This booking itself is excluded — moving
    // to the time you already hold should be a no-op, not a clash with yourself.
    const clashes = await ctx.db
      .query("native_bookings")
      .withIndex("by_startMs", (q) => q.eq("startMs", newStartMs))
      .collect();
    if (clashes.some((r) => r._id !== id && holdIsLive(r, now))) {
      return { ok: false as const, reason: "slot_taken" };
    }

    await ctx.db.patch(id, {
      startMs: newStartMs,
      endMs: slotEnd(newStartMs),
      // Only recorded on the first move, so it keeps pointing at the time the
      // booking was originally made for.
      rescheduledFromMs: row.rescheduledFromMs ?? row.startMs,
    });
    return { ok: true as const, previousStartMs: row.startMs };
  },
});

/** Cancel by id, from the manage page. Same effect as the calendar sync. */
export const cancelBooking = internalMutation({
  args: { id: v.id("native_bookings") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.status === "cancelled") return false;
    await ctx.db.patch(id, { status: "cancelled", cancelledAt: Date.now() });
    return true;
  },
});

/**
 * Mint manage tokens for confirmed future bookings that have none.
 *
 * Bookings made before self-serve rescheduling existed carry no token, so the
 * links in their confirmation email are the old "reply CANCEL" wording and
 * there is nothing for /field-agent/manage to resolve. This gives those people
 * the same control as everyone booked since, without touching their booking.
 *
 * Idempotent and forward-only: an existing token is never replaced, and past
 * bookings are skipped because there is nothing left to manage.
 */
export const backfillManageTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("native_bookings")
      .withIndex("by_status", (q) => q.eq("status", "confirmed"))
      .collect();

    let minted = 0;
    for (const row of rows) {
      if (row.manageToken || row.startMs < now) continue;
      await ctx.db.patch(row._id, { manageToken: crypto.randomUUID().replace(/-/g, "") });
      minted++;
    }
    return { checked: rows.length, minted };
  },
});
