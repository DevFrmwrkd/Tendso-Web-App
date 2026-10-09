import { query } from "./_generated/server";

/** The signed-in account only. Caller-supplied Clerk ids cannot choose a role. */
export const me = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const creator = await ctx.db.query("creators")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();
        const owner = creator ? null : await ctx.db.query("businessOwners")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .first();
        return { clerkId: identity.subject, creator, isOwner: !!owner };
    },
});
