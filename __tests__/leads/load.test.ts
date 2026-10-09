import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { requireAdmin, requireCreatorAccount, requireStaff } from '../../convex/lib/auth';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './leads.ts': () => import('../../convex/leads'),
    './creators.ts': () => import('../../convex/creators'),
};

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const admin = await ctx.db.insert('creators', {
            clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active',
        });
        const creator = await ctx.db.insert('creators', {
            clerkId: 'creator', email: 'creator@example.com', role: 'creator', status: 'active',
            firstName: 'Field', lastName: 'Creator',
        });
        const legacy = await ctx.db.insert('creators', {
            clerkId: 'legacy', email: 'legacy@example.com', status: 'active',
        });
        const staff = await ctx.db.insert('creators', {
            clerkId: 'staff', email: 'staff@example.com', role: 'staff', status: 'active',
        });
        for (const account of [
            { clerkId: 'affiliate', role: 'affiliate', status: 'active' },
            { clerkId: 'deleted-flag', role: 'creator', status: 'active', isDeleted: true },
            { clerkId: 'deleted-status', role: 'creator', status: 'deleted' },
            { clerkId: 'suspended-creator', role: 'creator', status: 'suspended' },
            { clerkId: 'suspended-admin', role: 'admin', status: 'suspended' },
        ]) await ctx.db.insert('creators', { email: `${account.clerkId}@example.com`, ...account });

        const submission = await ctx.db.insert('submissions', {
            creatorId: creator, businessName: 'Linked Walk-in Shop', businessType: 'Barber/Salon',
            ownerName: 'Business Owner', ownerPhone: '09171234567', address: 'Main Street',
            city: 'Manila', status: 'completed',
        });
        const linked = await ctx.db.insert('leads', {
            submissionId: submission, creatorId: creator, source: 'qr_code', name: 'Linked Customer',
            phone: '09170000001', email: 'linked@example.com', message: 'Please call me.',
            status: 'qualified', createdAt: 10,
        });
        const unlinked = await ctx.db.insert('leads', {
            source: 'website', name: 'Unlinked Customer', phone: '09170000002',
            status: 'new', createdAt: 20,
        });
        const deletedCreator = await ctx.db.insert('creators', {
            clerkId: 'removed-reference', email: 'removed@example.com', role: 'creator',
        });
        const deletedSubmission = await ctx.db.insert('submissions', {
            creatorId: deletedCreator, businessName: 'Removed Shop', businessType: 'Other',
            ownerName: 'Former Owner', ownerPhone: '09170000003', address: 'Old Street',
            city: 'Manila', status: 'rejected',
        });
        const dangling = await ctx.db.insert('leads', {
            submissionId: deletedSubmission, creatorId: deletedCreator, source: 'direct',
            name: 'Customer With Removed References', phone: '09170000004', status: 'contacted', createdAt: 30,
        });
        await ctx.db.delete(deletedSubmission);
        await ctx.db.delete(deletedCreator);
        return { admin, creator, legacy, staff, linked, unlinked, dangling };
    });
    return { t, ids };
}

describe('leads.getAll loading', () => {
    it('loads linked, standalone, and dangling-reference customer leads for an authenticated admin', async () => {
        const { t, ids } = await setup();
        const before = await t.run(async (ctx) => ctx.db.query('leads').collect());
        const rows = await t.withIdentity({ subject: 'admin' }).query(api.leads.getAll);

        expect(rows.map(({ _id }) => _id)).toEqual([ids.dangling, ids.unlinked, ids.linked]);
        expect(rows.find(({ _id }) => _id === ids.linked)).toMatchObject({
            _id: ids.linked, businessName: 'Linked Walk-in Shop', creatorName: 'Field Creator',
            name: 'Linked Customer', phone: '09170000001', email: 'linked@example.com',
            message: 'Please call me.', source: 'qr_code', status: 'qualified', createdAt: 10,
        });
        expect(rows.find(({ _id }) => _id === ids.unlinked)).toMatchObject({
            _id: ids.unlinked, businessName: 'Unlinked', creatorName: 'N/A', name: 'Unlinked Customer',
        });
        expect(rows.find(({ _id }) => _id === ids.dangling)).toMatchObject({
            _id: ids.dangling, businessName: 'Unlinked', creatorName: 'N/A', name: 'Customer With Removed References',
        });
        expect(await t.run(async (ctx) => ctx.db.query('leads').collect())).toEqual(before);
    });

    it.each(['creator', 'legacy'])('preserves existing CRM read access for active %s accounts', async (subject) => {
        const { t } = await setup();
        expect(await t.withIdentity({ subject }).query(api.leads.getAll)).toHaveLength(3);
    });

    it.each(['affiliate', 'staff', 'deleted-flag', 'deleted-status', 'suspended-creator', 'suspended-admin', 'missing-account'])
        ('refuses customer lead access for %s', async (subject) => {
            const { t } = await setup();
            await expect(t.withIdentity({ subject }).query(api.leads.getAll)).rejects.toThrow('Forbidden: creator access required');
        });

    it('refuses customer lead access before a Convex identity is authenticated', async () => {
        const { t } = await setup();
        await expect(t.query(api.leads.getAll)).rejects.toThrow('Not authenticated');
    });
});

describe('shared authorization helpers in action contexts', () => {
    // Inline local actions exercise the real helpers and internal creator
    // queries without exporting test-only functions or calling a deployment.
    it('resolves an admin through the internal identity query and denies a creator', async () => {
        const { t, ids } = await setup();
        const result = await t.withIdentity({ subject: 'admin' }).action(async (ctx) => requireAdmin(ctx));
        expect(result.identity.subject).toBe('admin');
        expect(result.me._id).toBe(ids.admin);
        await expect(t.withIdentity({ subject: 'creator' }).action(async (ctx) => requireAdmin(ctx)))
            .rejects.toThrow('Forbidden: admin access required');
    });

    it('resolves staff and admin roles through the internal identity query while rejecting creators', async () => {
        const { t, ids } = await setup();
        const staff = await t.withIdentity({ subject: 'staff' }).action(async (ctx) => requireStaff(ctx));
        expect(staff.me._id).toBe(ids.staff);
        expect(staff.isAdmin).toBe(false);
        const admin = await t.withIdentity({ subject: 'admin' }).action(async (ctx) => requireStaff(ctx));
        expect(admin.me._id).toBe(ids.admin);
        expect(admin.isAdmin).toBe(true);
        await expect(t.withIdentity({ subject: 'creator' }).action(async (ctx) => requireStaff(ctx)))
            .rejects.toThrow('Forbidden: staff access required');
    });

    it('resolves creator identity and target ownership through both internal creator queries', async () => {
        const { t, ids } = await setup();
        const creator = t.withIdentity({ subject: 'creator' });
        const own = await creator.action(async (ctx) => requireCreatorAccount(ctx, ids.creator));
        expect(own.me._id).toBe(ids.creator);
        expect(own.identity.subject).toBe('creator');
        await expect(creator.action(async (ctx) => requireCreatorAccount(ctx, ids.legacy)))
            .rejects.toThrow('Forbidden: you can only access your own creator account');
        const admin = await t.withIdentity({ subject: 'admin' }).action(async (ctx) => requireCreatorAccount(ctx, ids.creator));
        expect(admin.me._id).toBe(ids.admin);
        await expect(t.withIdentity({ subject: 'affiliate' }).action(async (ctx) => requireCreatorAccount(ctx)))
            .rejects.toThrow('Forbidden: creator access required');
    });

    it('requires authentication in every shared action helper', async () => {
        const { t } = await setup();
        await expect(t.action(async (ctx) => requireAdmin(ctx))).rejects.toThrow('Not authenticated');
        await expect(t.action(async (ctx) => requireStaff(ctx))).rejects.toThrow('Not authenticated');
        await expect(t.action(async (ctx) => requireCreatorAccount(ctx))).rejects.toThrow('Not authenticated');
    });
});
