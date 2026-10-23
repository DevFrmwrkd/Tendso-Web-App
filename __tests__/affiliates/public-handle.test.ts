import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './creatorProgram.ts': () => import('../../convex/creatorProgram'),
};

describe('public creator handle lookup', () => {
    it('resolves existing affiliates by handle independently of generated referral codes', async () => {
        const t = convexTest(schema, modules);
        await t.run((ctx) => ctx.db.insert('creators', {
            clerkId: 'maria', email: 'private@example.com', firstName: 'Maria', role: 'affiliate', status: 'active',
            affiliateHandle: 'maria', referralCode: 'AFF123ABC', affiliatePrice: 2999, wiseEmail: 'private-wise@example.com',
        }));
        const card = await t.query(api.creatorProgram.getCreatorByHandle, { handle: 'maria' });
        expect(card).toEqual({ handle: 'maria', name: 'Maria', photo: null, code: 'AFF123ABC', listPrice: 4999, price: 2999, saving: 2000, percentOff: 40 });
        expect(await t.query(api.affiliates.publicPage, { handle: 'maria' })).toMatchObject({ handle: 'maria', price: card!.price });
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'maria' })).toBeNull();
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'aff123abc' })).toEqual(card);
        expect(await t.query(api.creatorProgram.getCreatorByHandle, { handle: ' @MARIA ' })).toEqual(card);
    });

    it('never attributes a handle to another account with a matching referral code', async () => {
        const t = convexTest(schema, modules);
        for (const [handle, code] of [['maria', 'AFF123ABC'], ['other', 'MARIA']]) {
            await t.run((ctx) => ctx.db.insert('creators', {
                clerkId: handle, email: `${handle}@example.com`, role: 'affiliate', status: 'active', affiliateHandle: handle, referralCode: code,
            }));
        }
        expect(await t.query(api.creatorProgram.getCreatorByHandle, { handle: 'maria' })).toMatchObject({ handle: 'maria', code: 'AFF123ABC' });
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'maria' })).toMatchObject({ handle: 'other', code: 'MARIA' });
        expect(await t.query(api.creatorProgram.getCreatorByHandle, { handle: 'aff123abc' })).toBeNull();
    });

    it('keeps pending, suspended, deleted and other-role accounts unavailable on both public surfaces', async () => {
        const t = convexTest(schema, modules);
        const id = await t.run((ctx) => ctx.db.insert('creators', {
            clerkId: 'maria', email: 'maria@example.com', role: 'affiliate', status: 'active', affiliateHandle: 'maria', referralCode: 'AFF123ABC',
        }));
        for (const fields of [{ status: 'pending' }, { status: 'suspended' }, { status: 'deleted' }, { isDeleted: true }, { role: 'creator' }, { role: 'admin' }]) {
            await t.run((ctx) => ctx.db.patch(id, { role: 'affiliate', status: 'active', isDeleted: undefined, ...fields }));
            expect(await t.query(api.creatorProgram.getCreatorByHandle, { handle: 'maria' })).toBeNull();
            expect(await t.query(api.affiliates.publicPage, { handle: 'maria' })).toBeNull();
        }
        for (const handle of ['missing', '../maria', '', 'admin']) expect(await t.query(api.creatorProgram.getCreatorByHandle, { handle })).toBeNull();
    });
});
