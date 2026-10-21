import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './landingLeads.ts': () => import('../../convex/landingLeads'),
};

const allLeads = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query('leads').collect());

describe('landingLeads.requestVisit', () => {
    it('saves a website lead the admin Leads list can show', async () => {
        const t = convexTest(schema, modules);
        const res = await t.mutation(api.landingLeads.requestVisit, { shopName: '  Forge  Barbers ', area: 'Marikina', mobile: '0917 123 4567' });
        expect(res).toEqual({ ok: true, duplicate: false });
        const [lead] = await allLeads(t);
        expect(lead).toMatchObject({
            source: 'website',
            status: 'new',
            name: 'Forge Barbers',
            businessName: 'Forge Barbers',
            businessCity: 'Marikina',
            phone: '0917 123 4567',
        });
    });

    it('rejects missing fields with the field that is wrong', async () => {
        const t = convexTest(schema, modules);
        await expect(t.mutation(api.landingLeads.requestVisit, { shopName: 'F', area: 'Marikina', mobile: '09171234567' })).rejects.toThrow(ConvexError);
        await expect(t.mutation(api.landingLeads.requestVisit, { shopName: 'Forge', area: '', mobile: '09171234567' })).rejects.toThrow(ConvexError);
        await expect(t.mutation(api.landingLeads.requestVisit, { shopName: 'Forge', area: 'Marikina', mobile: '12345' })).rejects.toThrow(ConvexError);
        expect(await allLeads(t)).toHaveLength(0);
    });

    it('treats the same number within a day as one request', async () => {
        const t = convexTest(schema, modules);
        await t.mutation(api.landingLeads.requestVisit, { shopName: 'Forge', area: 'Marikina', mobile: '0917 123 4567' });
        const again = await t.mutation(api.landingLeads.requestVisit, { shopName: 'Forge Barbers', area: 'Marikina', mobile: '+63 917 123 4567' });
        expect(again).toEqual({ ok: true, duplicate: true });
        expect(await allLeads(t)).toHaveLength(1);
    });

    it('stops accepting after the burst limit', async () => {
        const t = convexTest(schema, modules);
        for (let i = 0; i < 20; i++) {
            await t.mutation(api.landingLeads.requestVisit, { shopName: `Shop ${i}`, area: 'Pasig', mobile: `0917${String(1000000 + i)}` });
        }
        await expect(
            t.mutation(api.landingLeads.requestVisit, { shopName: 'One more', area: 'Pasig', mobile: '09189999999' }),
        ).rejects.toThrow(ConvexError);
        expect(await allLeads(t)).toHaveLength(20);
    });
});
