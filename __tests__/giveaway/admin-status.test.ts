import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';

import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './giveaway.ts': () => import('../../convex/giveaway'),
};

async function setup(cap?: number) {
    const t = convexTest(schema, modules);
    const creatorId = await t.run(async (ctx) => {
        const id = await ctx.db.insert('creators', { clerkId: 'admin-review', email: 'admin@example.com', role: 'admin' });
        await ctx.db.insert('creators', { clerkId: 'regular-creator', email: 'creator@example.com', role: 'creator' });
        if (cap !== undefined) await ctx.db.insert('settings', { key: 'giveaway', value: { enabled: true, cap }, updatedAt: 1 });
        return id;
    });
    return { t, creatorId, admin: t.withIdentity({ subject: 'admin-review' }) };
}

describe('giveaway review totals', () => {
    it('requires admin authentication and keeps the public query contract unchanged', async () => {
        const { t } = await setup();
        await expect(t.query(api.giveaway.giveawayReviewStatus)).rejects.toThrow('Not authenticated');
        await expect(t.withIdentity({ subject: 'regular-creator' }).query(api.giveaway.giveawayReviewStatus))
            .rejects.toThrow('admin access required');
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 100, given: 0 });
    });

    it('counts all active applications, includes given sites in held, and updates on rejection or deletion', async () => {
        const { t, creatorId, admin } = await setup(5);
        const ids = await t.run(async (ctx) => {
            const base = {
                creatorId, businessName: 'Walk-in shop', businessType: 'Salon',
                ownerName: 'Owner', ownerPhone: '09170000000', address: 'Main Street', city: 'Quezon City',
            };
            const held = await ctx.db.insert('submissions', { ...base, status: 'submitted', giveawayApplication: true });
            const given = await ctx.db.insert('submissions', { ...base, status: 'completed', giveawayApplication: true, pricingMode: 'comped' });
            await ctx.db.insert('submissions', { ...base, status: 'rejected', giveawayApplication: true });
            await ctx.db.insert('submissions', { ...base, status: 'completed', pricingMode: 'comped' });
            return { held, given };
        });
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 2, given: 1, slotsLeft: 3, cap: 5 });
        await t.run(async (ctx) => ctx.db.patch(ids.held, { status: 'rejected' }));
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 1, given: 1, slotsLeft: 4, cap: 5 });
        await t.run(async (ctx) => ctx.db.delete(ids.given));
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 0, given: 0, slotsLeft: 5, cap: 5 });
    });

    it('uses the default cap before launch and never reports negative slots after a cap reduction', async () => {
        const { t, creatorId, admin } = await setup();
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 0, given: 0, slotsLeft: 100, cap: 100 });
        await t.run(async (ctx) => {
            const base = {
                creatorId, businessName: 'Shop', businessType: 'Salon', ownerName: 'Owner',
                ownerPhone: '09170000000', address: 'Main Street', city: 'Quezon City',
                status: 'submitted', giveawayApplication: true,
            };
            await ctx.db.insert('submissions', base);
            await ctx.db.insert('submissions', base);
            await ctx.db.insert('settings', { key: 'giveaway', value: { enabled: false, cap: 1 }, updatedAt: 1 });
        });
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 2, given: 0, slotsLeft: 0, cap: 1 });
    });
});
