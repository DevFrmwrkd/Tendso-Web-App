import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './creators.ts': () => import('../../convex/creators'),
};

async function setup() {
    const t = convexTest(schema, modules);
    const accounts = await t.run(async (ctx) => {
        const result: Record<string, Doc<'creators'>['_id']> = {};
        for (const [clerkId, role] of [
            ['affiliate', 'affiliate'], ['other-affiliate', 'affiliate'], ['creator', 'creator'],
            ['legacy-creator', undefined], ['admin', 'admin'], ['staff', 'staff'],
        ]) {
            result[clerkId!] = await ctx.db.insert('creators', {
                clerkId: clerkId!, email: `${clerkId}@example.com`, role, status: 'active',
                firstName: 'Original', phone: '09170000000', wiseEmail: 'original-wise@example.com', balance: 1500,
            });
        }
        return result;
    });
    return { t, accounts };
}

describe('profile and payout destination ownership', () => {
    it('rejects anonymous and other-account updates without changing profile or payout details', async () => {
        const { t, accounts } = await setup();
        const id = accounts.affiliate;
        const before = await t.run((ctx) => ctx.db.get(id));
        const updates = {
            id, firstName: 'Forged', email: 'forged@example.com', wiseEmail: 'attacker-wise@example.com',
            payoutMethod: 'wise_email', payoutDetails: 'attacker-wise@example.com',
        };
        await expect(t.mutation(api.creators.update, updates)).rejects.toThrow('Not authenticated');
        for (const subject of ['other-affiliate', 'creator', 'staff', 'no-account']) {
            await expect(t.withIdentity({ subject }).mutation(api.creators.update, updates)).rejects.toThrow('Forbidden');
            expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);
        }
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it.each(['affiliate', 'creator', 'legacy-creator'])('preserves authenticated %s self-profile and Wise setup updates', async (subject) => {
        const { t, accounts } = await setup();
        const id = accounts[subject];
        await t.withIdentity({ subject }).mutation(api.creators.update, {
            id, firstName: 'Updated', phone: '09171234567', wiseEmail: 'updated-wise@example.com',
            payoutMethod: 'wise_email', payoutDetails: 'updated-wise@example.com',
        });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
            firstName: 'Updated', phone: '09171234567', wiseEmail: 'updated-wise@example.com',
            payoutMethod: 'wise_email', payoutDetails: 'updated-wise@example.com', balance: 1500,
        });
    });

    it.each([
        { status: 'suspended' }, { status: 'deleted' }, { isDeleted: true },
    ])('rejects disabled owner profile updates (%j)', async (fields) => {
        const { t, accounts } = await setup();
        const id = accounts.affiliate;
        await t.run((ctx) => ctx.db.patch(id, fields));
        const before = await t.run((ctx) => ctx.db.get(id));
        await expect(t.withIdentity({ subject: 'affiliate' }).mutation(api.creators.update, {
            id, wiseEmail: 'changed-wise@example.com',
        })).rejects.toThrow('Forbidden');
        expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);
    });

    it('preserves the active admin override but rejects a suspended admin', async () => {
        const { t, accounts } = await setup();
        const admin = t.withIdentity({ subject: 'admin' });
        await admin.mutation(api.creators.update, { id: accounts.affiliate, wiseEmail: 'admin-corrected@example.com' });
        expect((await t.run((ctx) => ctx.db.get(accounts.affiliate)))?.wiseEmail).toBe('admin-corrected@example.com');
        await t.run((ctx) => ctx.db.patch(accounts.admin, { status: 'suspended' }));
        const before = await t.run((ctx) => ctx.db.get(accounts.affiliate));
        await expect(admin.mutation(api.creators.update, { id: accounts.affiliate, wiseEmail: 'blocked@example.com' })).rejects.toThrow('Forbidden');
        expect(await t.run((ctx) => ctx.db.get(accounts.affiliate))).toEqual(before);
    });
});
