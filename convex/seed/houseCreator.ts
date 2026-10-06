import { internalMutation } from '../_generated/server';

/**
 * The house `creators` row — Tendso's own attribution for owner-originated
 * (self-serve) submissions.
 *
 * `submissions.creatorId` is a required `v.id('creators')` and a business owner
 * filling in /start has no creator account. Rather than widen the column to
 * optional — which puts ~30 read sites, including an awaited runMutation behind
 * a real card charge, one `db.get(undefined)` away from a dead transaction — every
 * owner submission is attributed to this single seeded row.
 *
 * Run once PER DEPLOYMENT (dev and prod hold different ids):
 *    npx convex run seed/houseCreator:seedHouseCreator
 *    npx convex run seed/houseCreator:seedHouseCreator --prod
 * then store the returned `_id` in the Convex env var the intake resolves it from:
 *    npx convex env set SELF_SERVE_CREATOR_ID <returned _id>
 *    npx convex env set SELF_SERVE_CREATOR_ID <returned _id> --prod
 *
 * Idempotent — it returns the existing row's id rather than inserting a second
 * one, so re-running after a schema change or a fresh checkout is safe.
 *
 * OPERATIONAL CONVENTION — THIS ROW IS INFRASTRUCTURE. Never edit it, never
 * delete it. It shows up in /admin/creators like any other creator; leave it
 * alone. Deleting it orphans every owner-originated submission, and
 * `admin.deleteCreatorRecords` would take the generated websites and their
 * content down with it.
 */

/** No Clerk subject can ever equal this, so nobody can authenticate as the row. */
const HOUSE_CLERK_ID = 'system:self-serve';

export const seedHouseCreator = internalMutation({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db
            .query('creators')
            .withIndex('by_clerk_id', (q) => q.eq('clerkId', HOUSE_CLERK_ID))
            .unique();

        if (existing) {
            return existing._id;
        }

        const now = Date.now();

        // NOT api.creators.create — that hard-codes role:'creator' (convex/creators.ts:244),
        // which would produce a deletable row. See the role comment below.
        return await ctx.db.insert('creators', {
            clerkId: HOUSE_CLERK_ID,
            firstName: 'Tendso',
            lastName: 'Self-Serve',
            email: 'self-serve@tendso.com',
            // LOAD-BEARING. This is the row's deletion immunity: the delete route
            // 403s on any admin row (app/api/delete-creator/route.ts:103) BEFORE it
            // reaches Convex, and both delete UIs hide the button. That route is the
            // only caller of admin.deleteCreatorRecords repo-wide, and that mutation
            // walks by_creator_id deleting every generatedWebsites doc, its HTML blob
            // and every websiteContent row — i.e. every owner site Tendso has shipped.
            role: 'admin',
            status: 'active',
            balance: 0,
            totalEarnings: 0,
            totalWithdrawn: 0,
            submissionCount: 0,
            referralCode: '',
            createdAt: now,
            updatedAt: now,
        });
    },
});
