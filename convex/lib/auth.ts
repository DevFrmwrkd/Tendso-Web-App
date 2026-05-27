import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

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
    return typeof (ctx as any).runQuery === "function" && (ctx as any).db === undefined;
}

/**
 * Require a signed-in Clerk identity. Returns the identity object.
 * Throws "Not authenticated" if no Clerk session attached to the call.
 */
export async function requireAuth(ctx: AnyCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity;
}

/**
 * Require a signed-in admin. Returns the creator record so callers can use
 * `me.clerkId` / `me._id` without re-fetching.
 *
 * Action variant uses `internal.creators.getMeForAuthInternal` (an internal
 * query introduced just for this), since actions can't reach `ctx.db` directly.
 */
export async function requireAdmin(ctx: AnyCtx) {
    const identity = await requireAuth(ctx);

    let me: any;
    if (isActionCtx(ctx)) {
        // Lazy import to avoid circular ref at module-eval time.
        const { internal } = await import("../_generated/api");
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
