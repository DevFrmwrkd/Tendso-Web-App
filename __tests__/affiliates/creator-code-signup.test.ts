import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './creatorProgram.ts': () => import('../../convex/creatorProgram'),
};
const signup = { firstName: 'Alex', lastName: 'Cruz', email: 'alex@example.test', phone: '09171234567', handle: 'alex-shops' };

async function setup() {
    const t = convexTest(schema, modules);
    const other = await t.run(async ctx => {
        const id = await ctx.db.insert('creators', { clerkId: 'other', email: 'other@example.test', role: 'affiliate', status: 'active', affiliateHandle: 'other', referralCode: 'OTHER30' });
        await ctx.db.insert('creatorCodeAliases', { creatorId: id, code: 'OLDPRINTED30', createdAt: 1 });
        await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active', referralCode: 'AGENT77' });
        return id;
    });
    return { t, other, caller: t.withIdentity({ subject: 'alex', email: signup.email }) };
}

describe('legacy-compatible affiliate signup with an own creator code', () => {
    it('creates a pending creator with its normalized chosen code and a permanent reservation, without incoming referral attribution', async () => {
        const { t, caller } = await setup();
        const id = await caller.mutation(api.affiliates.create, { ...signup, code: ' alex30 ' });
        const row = await t.run(ctx => ctx.db.get(id));
        expect(row).toMatchObject({ role: 'affiliate', status: 'pending', referralCode: 'ALEX30', affiliateHandle: 'alex-shops', balance: 0, totalEarnings: 0 });
        expect(row?.creatorCodeChosenAt).toEqual(expect.any(Number));
        expect(row?.referredBy).toBeUndefined();
        expect(row?.referredByCode).toBeUndefined();
        expect(row?.recruitedByCreatorId).toBeUndefined();
        expect(await t.run(ctx => ctx.db.query('creatorCodeAliases').withIndex('by_code', q => q.eq('code', 'ALEX30')).unique())).toMatchObject({ creatorId: id });
        expect(await t.query(api.creatorProgram.checkAvailability, { code: 'ALEX30' })).toMatchObject({ code: { available: false } });
        expect(await t.run(ctx => ctx.db.query('referrals').collect())).toEqual([]);
        expect(await t.run(ctx => ctx.db.query('earnings').collect())).toEqual([]);
        expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('keeps omitted-code clients compatible and leaves an existing account unchanged on a retry', async () => {
        const { t, caller } = await setup();
        const id = await caller.mutation(api.affiliates.create, signup);
        const before = await t.run(ctx => ctx.db.get(id));
        expect(before?.referralCode).toMatch(/^AFF[A-Z0-9]+$/);
        expect(before?.creatorCodeChosenAt).toBeUndefined();
        const aliases = await t.run(ctx => ctx.db.query('creatorCodeAliases').collect());
        expect(await caller.mutation(api.affiliates.create, { ...signup, code: 'OTHER30', handle: 'different-page' })).toBe(id);
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
        expect(await t.run(ctx => ctx.db.query('creatorCodeAliases').collect())).toEqual(aliases);
    });

    it.each(['OTHER30', 'OLDPRINTED30', 'AGENT77', 'OTR30', '', 'ABC', 'BAD-CODE', 'X'.repeat(17)])('rejects a taken, reserved or invalid supplied code %j before creating an account', async code => {
        const { t, caller } = await setup();
        const before = await t.run(async ctx => ({ accounts: await ctx.db.query('creators').collect(), aliases: await ctx.db.query('creatorCodeAliases').collect() }));
        await expect(caller.mutation(api.affiliates.create, { ...signup, code })).rejects.toThrow();
        expect(await t.run(async ctx => ({ accounts: await ctx.db.query('creators').collect(), aliases: await ctx.db.query('creatorCodeAliases').collect() }))).toEqual(before);
    });

    it('reserves a deleted account’s earlier alias and rejects referral arguments rather than confusing them with the creator’s own code', async () => {
        const { t, other, caller } = await setup();
        await t.run(ctx => ctx.db.patch(other, { status: 'deleted', isDeleted: true }));
        await expect(caller.mutation(api.affiliates.create, { ...signup, code: 'OLDPRINTED30' })).rejects.toThrow('taken');
        await expect(caller.mutation(api.affiliates.create, { ...signup, code: 'ALEX30', referredByCode: 'AGENT77' } as never)).rejects.toThrow();
        expect(await t.run(ctx => ctx.db.query('creators').withIndex('by_clerk_id', q => q.eq('clerkId', 'alex')).collect())).toEqual([]);
    });

    it('atomically shares the namespace with an existing creator completing its first code choice', async () => {
        const { t, caller } = await setup();
        await t.run(ctx => ctx.db.insert('creators', { clerkId: 'chooser', email: 'chooser@example.test', role: 'affiliate', status: 'active', affiliateHandle: 'chooser', referralCode: 'AFFCHOOSER1' }));
        const other = t.withIdentity({ subject: 'chooser' });
        expect(await t.query(api.creatorProgram.checkAvailability, { code: 'RACING30' })).toMatchObject({ code: { available: true } });
        const results = await Promise.allSettled([
            caller.mutation(api.affiliates.create, { ...signup, code: 'RACING30' }),
            other.mutation(api.creatorProgram.updateCode, { code: 'RACING30' }),
        ]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
        expect(await t.run(ctx => ctx.db.query('creators').withIndex('by_referral_code', q => q.eq('referralCode', 'RACING30')).collect())).toHaveLength(1);
        expect(await t.run(ctx => ctx.db.query('creatorCodeAliases').withIndex('by_code', q => q.eq('code', 'RACING30')).collect())).toHaveLength(1);
    });
});
