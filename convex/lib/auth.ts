import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
// Convex queries cannot use import(). This generated module only exports references.
import { internal } from "../_generated/api";
import { isCreatorAccount } from "../../lib/accounts";

/**
 * Shared auth helpers used by mutations, queries, and actions.
 *
 * The mobile-side Outscraper + Drive modules expect `requireAdmin(ctx)` and
 * `requireAuth(ctx)` to work in any Convex context — including actions, which
 * can't read DB directly. For action callers we hop through the Convex API
 * (`ctx.runQuery`) to look up the creator record.
 */

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

function isActionCtx(ctx: AnyCtx): ctx is ActionCtx {
    return 'runQuery' in ctx && !('db' in ctx);
}

/**
 * Require a signed-in Clerk identity. Returns the identity object.
 * Throws "Not authenticated" if no Clerk session attached to the call.
 */
export async function requireAuth(ctx: AnyCtx): Promise<UserIdentity> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity;
}

/** Creator capture/CRM access, with admin access for existing operational tools. */
export async function requireCreatorAccount(ctx: AnyCtx, creatorId?: Id<"creators">): Promise<{ identity: UserIdentity; me: Doc<"creators"> }> {
    const identity = await requireAuth(ctx);
    const me: Doc<"creators"> | null = isActionCtx(ctx)
        ? await ctx.runQuery(internal.creators.getMeForAuthInternal, { clerkId: identity.subject })
        : await ctx.db.query("creators").withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject)).first();
    if (!me || (!isCreatorAccount(me) && me.role !== "admin") || me.isDeleted || me.status === "deleted" || me.status === "suspended") {
        throw new Error("Forbidden: creator access required");
    }
    if (creatorId) {
        const target = isActionCtx(ctx)
            ? await ctx.runQuery(internal.creators.getByIdInternal, { id: creatorId })
            : await ctx.db.get(creatorId);
        if (!target || (!isCreatorAccount(target) && target.role !== "admin") || target.isDeleted || target.status === "deleted" || target.status === "suspended") {
            throw new Error("Forbidden: creator account required");
        }
        if (me.role !== "admin" && me._id !== creatorId) {
            throw new Error("Forbidden: you can only access your own creator account");
        }
    }
    return { identity, me };
}

/**
 * Require a signed-in admin. Returns the creator record so callers can use
 * `me.clerkId` / `me._id` without re-fetching.
 *
 * Action variant uses `internal.creators.getMeForAuthInternal` (an internal
 * query introduced just for this), since actions can't reach `ctx.db` directly.
 */
export async function requireAdmin(ctx: AnyCtx): Promise<{ identity: UserIdentity; me: Doc<"creators"> }> {
    const identity = await requireAuth(ctx);

    let me: Doc<"creators"> | null;
    if (isActionCtx(ctx)) {
        me = await ctx.runQuery(internal.creators.getMeForAuthInternal, {
            clerkId: identity.subject,
        });
    } else {
        me = await (ctx as QueryCtx | MutationCtx).db
            .query("creators")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();
    }

    if (!me || me.role !== "admin") {
        throw new Error("Forbidden: admin access required");
    }
    return { identity, me };
}

/**
 * Roles allowed to READ the Field Agent call bookings: admins, plus the
 * internal 'staff' role.
 *
 * Staff exists so whoever runs the calls can see who is booked, when, and the
 * Meet link, without being given the tendso.hr mailbox or the rest of /admin.
 * It grants nothing else — every other admin check in the app compares against
 * 'admin' exactly, so a staff account fails all of them.
 */
export async function requireStaff(ctx: AnyCtx): Promise<{ identity: UserIdentity; me: Doc<"creators">; isAdmin: boolean }> {
    const identity = await requireAuth(ctx);

    let me: Doc<"creators"> | null;
    if (isActionCtx(ctx)) {
        me = await ctx.runQuery(internal.creators.getMeForAuthInternal, {
            clerkId: identity.subject,
        });
    } else {
        me = await (ctx as QueryCtx | MutationCtx).db
            .query("creators")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();
    }

    if (!me || (me.role !== "admin" && me.role !== "staff")) {
        throw new Error("Forbidden: staff access required");
    }
    return { identity, me, isAdmin: me.role === "admin" };
}
