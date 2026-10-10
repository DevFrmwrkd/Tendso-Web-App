import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';

import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './giveaway.ts': () => import('../../convex/giveaway'),
};
const NOW = Date.UTC(2026, 9, 10, 8);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

async function setup(cap?: number, endsAt?: number, enabled = true) {
    const t = convexTest(schema, modules);
    const creatorId = await t.run(async (ctx) => {
        const id = await ctx.db.insert('creators', { clerkId: 'admin-review', email: 'admin@example.com', role: 'admin' });
        await ctx.db.insert('creators', { clerkId: 'regular-creator', email: 'creator@example.com', role: 'creator' });
        for (const role of ['affiliate', 'staff']) {
            await ctx.db.insert('creators', { clerkId: role, email: `${role}@example.com`, role, status: 'active' });
        }
        await ctx.db.insert('creators', { clerkId: 'suspended-admin', email: 'suspended@example.com', role: 'admin', status: 'suspended' });
        await ctx.db.insert('creators', { clerkId: 'deleted-admin', email: 'deleted@example.com', role: 'admin', status: 'deleted' });
        await ctx.db.insert('creators', { clerkId: 'soft-deleted-admin', email: 'soft-deleted@example.com', role: 'admin', isDeleted: true });
        if (cap !== undefined) await ctx.db.insert('settings', {
            key: 'giveaway', value: { enabled, cap, ...(endsAt !== undefined ? { endsAt } : {}) },
            description: 'Giveaway allocation', updatedAt: 1, updatedBy: 'previous-admin',
        });
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
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 2, given: 1, slotsLeft: 3, cap: 5, enabled: true, open: true });
        await t.run(async (ctx) => ctx.db.patch(ids.held, { status: 'rejected' }));
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 1, given: 1, slotsLeft: 4, cap: 5, enabled: true, open: true });
        await t.run(async (ctx) => ctx.db.delete(ids.given));
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 0, given: 0, slotsLeft: 5, cap: 5, enabled: true, open: true });
    });

    it('uses the default cap before launch and never reports negative slots after a cap reduction', async () => {
        const { t, creatorId, admin } = await setup();
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 0, given: 0, slotsLeft: 100, cap: 100, enabled: false, open: false });
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
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({ held: 2, given: 0, slotsLeft: 0, cap: 1, enabled: false, open: false });
    });
});

type Backend = ReturnType<typeof convexTest<typeof schema.tables>>;
async function snapshot(t: Backend) {
    return t.run(async (ctx) => ({
        settings: await ctx.db.query('settings').collect(),
        applications: await ctx.db.query('submissions').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
}
async function seedApplications(t: Backend, creatorId: Awaited<ReturnType<typeof setup>>['creatorId'], count: number) {
    return t.run(async (ctx) => {
        for (let index = 0; index < count; index++) {
            await ctx.db.insert('submissions', {
                creatorId, businessName: `Shop ${index}`, businessType: 'Salon', ownerName: 'Owner',
                ownerPhone: `0917000000${index}`, address: 'Main Street', city: 'Quezon City',
                status: index === 0 ? 'completed' : 'submitted', giveawayApplication: true,
                ...(index === 0 ? { pricingMode: 'comped' } : {}),
            });
        }
    });
}

describe('admin giveaway availability toggle', () => {
    it.each([null, 'regular-creator', 'affiliate', 'staff', 'suspended-admin', 'deleted-admin', 'soft-deleted-admin'])
    ('denies %s without changing settings, applications or schedules', async (subject) => {
        const { t, creatorId } = await setup(5, NOW + 10000);
        await seedApplications(t, creatorId, 2);
        const caller = subject ? t.withIdentity({ subject }) : t;
        const before = await snapshot(t);
        for (const enabled of [false, true]) {
            await expect(caller.mutation(api.giveaway.setEnabled, { enabled }))
                .rejects.toThrow(subject ? 'admin access required' : 'Not authenticated');
        }
        await expect(caller.query(api.giveaway.giveawayReviewStatus))
            .rejects.toThrow(subject ? 'admin access required' : 'Not authenticated');
        expect(await snapshot(t)).toEqual(before);
    });

    it.each([false, true])('creates default cap 100 with enabled=%s and records the actual admin', async (enabled) => {
        const { t, admin } = await setup();
        expect(await admin.mutation(api.giveaway.setEnabled, { enabled })).toBeNull();
        const state = await snapshot(t);
        expect(state.settings).toEqual([expect.objectContaining({
            key: 'giveaway', value: { enabled, cap: 100 }, updatedAt: NOW, updatedBy: 'admin-review',
        })]);
        expect(state.applications).toEqual([]);
        expect(state.jobs).toEqual([]);
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: enabled, slotsLeft: 100, given: 0 });
    });

    it('closes and reopens without changing the allocation, deadline, applications or other settings', async () => {
        const endsAt = NOW + 10000;
        const { t, creatorId, admin } = await setup(7, endsAt);
        await seedApplications(t, creatorId, 2);
        await t.run((ctx) => ctx.db.insert('settings', { key: 'poster_redirect_target', value: '/start', updatedAt: 1 }));
        const before = await snapshot(t);
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toEqual({
            held: 2, given: 1, slotsLeft: 5, cap: 7, enabled: true, open: true, endsAt,
        });
        await admin.mutation(api.giveaway.setEnabled, { enabled: false });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 5, given: 1 });
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toMatchObject({ enabled: false, open: false, endsAt, cap: 7 });
        expect((await snapshot(t)).jobs).toEqual([]);

        vi.setSystemTime(NOW + 100);
        await admin.mutation(api.giveaway.setEnabled, { enabled: true });
        const after = await snapshot(t);
        expect(after.applications).toEqual(before.applications);
        expect(after.settings.find((setting) => setting.key === 'poster_redirect_target')).toEqual(before.settings[1]);
        expect(after.settings.find((setting) => setting.key === 'giveaway')).toMatchObject({
            value: { enabled: true, cap: 7, endsAt }, description: 'Giveaway allocation',
            updatedAt: NOW + 100, updatedBy: 'admin-review',
        });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 5, given: 1 });
        expect(after.jobs.map((job) => ({ name: job.name, args: job.args, when: job.scheduledTime })))
            .toEqual([{ name: 'giveaway:expireGiveaway', args: [{ endsAt }], when: endsAt }]);
        vi.setSystemTime(endsAt);
        await t.mutation(internal.giveaway.expireGiveaway, { endsAt });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 5, given: 1 });
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toMatchObject({ enabled: true, open: false, endsAt });
        expect((await snapshot(t)).settings.find((setting) => setting.key === 'giveaway')?.updatedAt).toBe(endsAt);
    });

    it.each([2, 3])('refuses to reopen %s allocated slots under cap 2 but always permits disabling', async (count) => {
        const { t, creatorId, admin } = await setup(2);
        await seedApplications(t, creatorId, count);
        await admin.mutation(api.giveaway.setEnabled, { enabled: false });
        const before = await snapshot(t);
        await expect(admin.mutation(api.giveaway.setEnabled, { enabled: true })).rejects.toThrow(ConvexError);
        await expect(admin.mutation(api.giveaway.setEnabled, { enabled: true })).rejects.toThrow('all available slots are allocated');
        expect(await snapshot(t)).toEqual(before);
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 0, given: 1 });
    });

    it.each([NOW - 1, NOW])('refuses to reopen at or after deadline %s but always permits disabling', async (endsAt) => {
        const { t, admin } = await setup(7, endsAt);
        expect(await admin.query(api.giveaway.giveawayReviewStatus)).toMatchObject({ enabled: true, open: false, endsAt });
        await admin.mutation(api.giveaway.setEnabled, { enabled: false });
        const before = await snapshot(t);
        await expect(admin.mutation(api.giveaway.setEnabled, { enabled: true })).rejects.toThrow('deadline has passed');
        expect(await snapshot(t)).toEqual(before);
        expect(before.settings[0].value).toEqual({ enabled: false, cap: 7, endsAt });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: false, slotsLeft: 7, given: 0 });
    });

    it('does not silently discard an invalid stored deadline when enabling', async () => {
        const { t, admin } = await setup();
        await t.run((ctx) => ctx.db.insert('settings', {
            key: 'giveaway', value: { enabled: true, cap: 7, endsAt: -1 }, updatedAt: 1,
        }));
        await admin.mutation(api.giveaway.setEnabled, { enabled: false });
        const before = await snapshot(t);
        await expect(admin.mutation(api.giveaway.setEnabled, { enabled: true })).rejects.toThrow('Giveaway settings need');
        expect(await snapshot(t)).toEqual(before);
        expect(before.settings[0].value).toEqual({ enabled: false, cap: 7, endsAt: -1 });
    });
});
