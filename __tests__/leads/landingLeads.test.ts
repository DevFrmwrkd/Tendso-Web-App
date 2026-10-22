import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './landingLeads.ts': () => import('../../convex/landingLeads'),
};

const allLeads = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query('leads').collect());

describe('landingLeads.requestVisit', () => {
    it('saves a website lead the admin Leads list can show', async () => {
        const t = convexTest(schema, modules);
        const res = await t.mutation(internal.landingLeads.saveVisit, { caller: 'caller', shopName: '  Forge  Barbers ', area: 'Marikina', mobile: '0917 123 4567' });
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
        await expect(t.mutation(internal.landingLeads.saveVisit, { caller: 'caller', shopName: 'F', area: 'Marikina', mobile: '09171234567' })).rejects.toThrow(ConvexError);
        await expect(t.mutation(internal.landingLeads.saveVisit, { caller: 'caller', shopName: 'Forge', area: '', mobile: '09171234567' })).rejects.toThrow(ConvexError);
        await expect(t.mutation(internal.landingLeads.saveVisit, { caller: 'caller', shopName: 'Forge', area: 'Marikina', mobile: '12345' })).rejects.toThrow(ConvexError);
        expect(await allLeads(t)).toHaveLength(0);
    });

    it('treats the same number within a day as one request', async () => {
        const t = convexTest(schema, modules);
        await t.mutation(internal.landingLeads.saveVisit, { caller: 'caller', shopName: 'Forge', area: 'Marikina', mobile: '0917 123 4567' });
        const again = await t.mutation(internal.landingLeads.saveVisit, { caller: 'caller', shopName: 'Forge Barbers', area: 'Marikina', mobile: '+63 917 123 4567' });
        expect(again).toEqual({ ok: true, duplicate: true });
        expect(await allLeads(t)).toHaveLength(1);
    });

    it('stops accepting after the burst limit', async () => {
        const t = convexTest(schema, modules);
        for (let i = 0; i < 20; i++) {
            await t.mutation(internal.landingLeads.saveVisit, { caller: `caller-${i}`, shopName: `Shop ${i}`, area: 'Pasig', mobile: `0917${String(1000000 + i)}` });
        }
        await t.run(async (ctx) => {
            for (const lead of await ctx.db.query('leads').collect()) await ctx.db.delete(lead._id);
            for (let i = 0; i < 401; i++) await ctx.db.insert('leads', { source: 'website', name: 'Unrelated', phone: '09189999999', status: 'new', createdAt: Date.now() });
        });
        await expect(
            t.mutation(internal.landingLeads.saveVisit, { caller: 'new-caller', shopName: 'One more', area: 'Pasig', mobile: '09189999999' }),
        ).rejects.toThrow(ConvexError);
        expect(await allLeads(t)).toHaveLength(401);
    });
    it('one caller cannot exhaust the global budget by varying phones', async () => {
        const t = convexTest(schema, modules);
        for (let i = 0; i < 3; i++) {
            await t.mutation(internal.landingLeads.saveVisit, { caller: 'attacker', shopName: 'Shop', area: 'Pasig', mobile: `0917100000${i}` });
        }
        for (let i = 3; i < 20; i++) {
            await expect(t.mutation(internal.landingLeads.saveVisit, { caller: 'attacker', shopName: 'Shop', area: 'Pasig', mobile: `091710000${i}` })).rejects.toThrow('Please wait');
        }
        await expect(t.mutation(internal.landingLeads.saveVisit, { caller: 'visitor', shopName: 'Shop', area: 'Pasig', mobile: '09189999999' })).resolves.toMatchObject({ ok: true });
        expect(await allLeads(t)).toHaveLength(4);
    });

    it('retains deduplication after lead edits and over 400 unrelated inserts', async () => {
        const t = convexTest(schema, modules);
        await t.mutation(internal.landingLeads.saveVisit, { caller: 'first', shopName: 'Shop', area: 'Pasig', mobile: '09171234567' });
        await t.run(async (ctx) => {
            const lead = (await ctx.db.query('leads').collect())[0];
            await ctx.db.delete(lead._id);
            for (let i = 0; i < 401; i++) {
                await ctx.db.insert('leads', { source: 'website', name: 'Unrelated', phone: '09189999999', status: 'new', createdAt: Date.now() });
            }
        });
        await expect(t.mutation(internal.landingLeads.saveVisit, { caller: 'second', shopName: 'Shop', area: 'Pasig', mobile: '+63 917 123 4567' })).resolves.toMatchObject({ duplicate: true });
        expect(await allLeads(t)).toHaveLength(401);
    });

    it('releases caller and phone windows when receipts expire', async () => {
        const t = convexTest(schema, modules);
        await t.run(async (ctx) => {
            for (let i = 0; i < 3; i++) await ctx.db.insert('landingVisitRequests', { caller: 'caller', phone: '639171234567', createdAt: Date.now() - 25 * 60 * 60 * 1000 });
        });
        await expect(t.mutation(internal.landingLeads.saveVisit, { caller: 'caller', shopName: 'Shop', area: 'Pasig', mobile: '09171234567' })).resolves.toMatchObject({ duplicate: false });
    });

    afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

    it('rejects direct public callers before bot verification or writes', async () => {
        const t = convexTest(schema, modules);
        vi.stubEnv('LANDING_LEADS_SECRET', 'server-secret');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(t.action(api.landingLeads.requestVisit, { caller: 'forged', secret: 'wrong', token: 'fake', shopName: 'Shop', area: 'Pasig', mobile: '09171234567' })).rejects.toThrow('Unauthorized');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(await allLeads(t)).toHaveLength(0);
    });

    it.each([
        { success: false, hostname: 'tendso.com', action: 'landing-visit' },
        { success: true, hostname: 'evil.example', action: 'landing-visit' },
        { success: true, hostname: 'tendso.com', action: 'other-form' },
    ])('rejects an invalid bot result: %j', async (result) => {
        const t = convexTest(schema, modules);
        vi.stubEnv('LANDING_LEADS_SECRET', 'server-secret');
        vi.stubEnv('TURNSTILE_SECRET_KEY', 'turnstile-secret');
        vi.stubEnv('TURNSTILE_HOSTNAME', 'tendso.com');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => result }));
        await expect(t.action(api.landingLeads.requestVisit, { caller: 'caller', secret: 'server-secret', token: 'token', shopName: 'Shop', area: 'Pasig', mobile: '09171234567' })).rejects.toThrow('bot check');
        expect(await allLeads(t)).toHaveLength(0);
        expect(await t.run((ctx) => ctx.db.query('landingVisitRequests').collect())).toHaveLength(0);
    });

    it('only saves after a successful server bot check', async () => {
        const t = convexTest(schema, modules);
        vi.stubEnv('LANDING_LEADS_SECRET', 'server-secret');
        vi.stubEnv('TURNSTILE_SECRET_KEY', 'turnstile-secret');
        vi.stubEnv('TURNSTILE_HOSTNAME', 'tendso.com');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, hostname: 'tendso.com', action: 'landing-visit' }) }));
        await expect(t.action(api.landingLeads.requestVisit, { caller: 'caller', secret: 'server-secret', token: 'token', shopName: 'Shop', area: 'Pasig', mobile: '09171234567' })).resolves.toMatchObject({ ok: true });
        expect(await allLeads(t)).toHaveLength(1);
    });

});
