import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { Doc } from '../../convex/_generated/dataModel';
import { CREATOR_OVERRIDE_CUTOVER } from '../../lib/pricing';
import { FIELD_AGENT_CITIES, normalizeWorkArea, normalizeWorkCity, workAreaForMap } from '../../lib/fieldAgentOnboarding';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './creators.ts': () => import('../../convex/creators'),
    './fieldAgentOnboarding.ts': () => import('../../convex/fieldAgentOnboarding'),
    './referrals.ts': () => import('../../convex/referrals'),
};
const NOW = CREATOR_OVERRIDE_CUTOVER + 1000;
type T = ReturnType<typeof convexTest>;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

async function insertAgent(t: T, clerkId: string, extra: Partial<Doc<'creators'>> = {}) {
    return t.run((ctx) => ctx.db.insert('creators', {
        clerkId, email: `${clerkId}@example.com`, role: 'creator', status: 'active',
        referralCode: clerkId.toUpperCase(), fieldAgentOnboardingRequired: true,
        ...extra,
    }));
}

async function setup() {
    const t = convexTest(schema, modules);
    const id = await insertAgent(t, 'agent');
    const agent = t.withIdentity({ subject: 'agent' });
    return { t, id, agent };
}

describe('field-agent work-area validation', () => {
    it('normalizes city chips and resolves their centre on the server rather than trusting caller coordinates', async () => {
        const { t, id, agent } = await setup();
        const area = await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, {
            city: '  QUEZON   city  ', latitude: 1, longitude: 2, source: 'city',
        });
        const city = FIELD_AGENT_CITIES.find((item) => item.name === 'Quezon City')!;
        expect(area).toEqual({ city: city.name, latitude: city.latitude, longitude: city.longitude, source: 'city' });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
            workCity: city.name, workLatitude: city.latitude, workLongitude: city.longitude,
            workLocationSource: 'city', fieldAgentOnboardingRequired: true,
        });
        expect((await t.run((ctx) => ctx.db.get(id)))?.fieldAgentOnboardingCompletedAt).toBeUndefined();
    });

    it('persists a custom manual city without requiring GPS and clears stale coordinates', async () => {
        const { t, id, agent } = await setup();
        await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Marikina', source: 'city' });
        await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: '  San   Fernando ', source: 'city' });
        const row = await t.run((ctx) => ctx.db.get(id));
        expect(row).toMatchObject({ workCity: 'San Fernando', workLocationSource: 'city' });
        expect(row?.workLatitude).toBeUndefined();
        expect(row?.workLongitude).toBeUndefined();
        expect(workAreaForMap(row)).toBeNull();
    });

    it('retains an explicitly chosen device position instead of replacing it with the city centre', async () => {
        const { t, id, agent } = await setup();
        await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, {
            city: 'Marikina', latitude: 14.66, longitude: 121.11, source: 'device',
        });
        expect(workAreaForMap(await t.run((ctx) => ctx.db.get(id)))).toEqual({ latitude: 14.66, longitude: 121.11 });
    });

    it.each([
        { city: '', source: 'city' },
        { city: '  ', source: 'city' },
        { city: 'x'.repeat(101), source: 'city' },
        { city: 'Nul\u0000City', source: 'city' },
        { city: 'Pasig', source: 'device' },
        { city: 'Pasig', source: 'city', latitude: 14 },
        { city: 'Pasig', source: 'device', longitude: 121 },
        { city: 'Pasig', source: 'device', latitude: NaN, longitude: 121 },
        { city: 'Pasig', source: 'city', latitude: Infinity, longitude: 121 },
        { city: 'Pasig', source: 'device', latitude: 91, longitude: 121 },
        { city: 'Pasig', source: 'device', latitude: 14, longitude: -181 },
        { city: 'Pasig', source: 'browser' },
    ])('rejects invalid work area %j without saving partial progress', async (args) => {
        const { t, id, agent } = await setup();
        await expect(agent.mutation(api.fieldAgentOnboarding.saveWorkArea, args as never)).rejects.toThrow();
        expect((await t.run((ctx) => ctx.db.get(id)))?.workCity).toBeUndefined();
    });

    it('supplies safe map fallbacks for existing records and invalid or partial coordinates', () => {
        const city = FIELD_AGENT_CITIES.find((item) => item.name === 'Marikina')!;
        expect(workAreaForMap(null)).toBeNull();
        expect(workAreaForMap({ workCity: 'Unknown city', workLatitude: 14 })).toBeNull();
        expect(workAreaForMap({ workCity: '  MARIKINA ', workLatitude: NaN, workLongitude: Infinity }))
            .toEqual({ latitude: city.latitude, longitude: city.longitude });
        expect(normalizeWorkCity('  San   Fernando  ')).toBe('San Fernando');
        expect(() => normalizeWorkArea({ city: 'Marikina', source: 'device' })).toThrow('latitude and longitude');
    });
});

describe('field-agent onboarding access and progress', () => {
    it('requires authentication and infers the account from the caller instead of accepting a target id', async () => {
        const { t, id, agent } = await setup();
        await expect(t.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Marikina', source: 'city' })).rejects.toThrow('Not authenticated');
        await expect(t.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend' })).rejects.toThrow('Not authenticated');
        await expect(t.withIdentity({ subject: 'owner' }).mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend' })).rejects.toThrow('Field-agent account');
        const otherId = await insertAgent(t, 'other');
        await expect(agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Pasig', source: 'city', creatorId: otherId } as never)).rejects.toThrow();
        expect((await t.run((ctx) => ctx.db.get(id)))?.workCity).toBeUndefined();
        expect((await t.run((ctx) => ctx.db.get(otherId)))?.workCity).toBeUndefined();
    });

    it.each([
        { role: 'affiliate', status: 'active' },
        { role: 'admin', status: 'active' },
        { role: 'staff', status: 'active' },
        { role: 'creator', status: 'suspended' },
        { role: 'creator', status: 'deleted' },
        { role: 'creator', status: 'active', isDeleted: true },
    ])('rejects both mutations for %j', async (fields) => {
        const { t, id, agent } = await setup();
        await t.run((ctx) => ctx.db.patch(id, { ...fields, workCity: 'Pasig' }));
        await expect(agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Pasig', source: 'city' })).rejects.toThrow();
        await expect(agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend' })).rejects.toThrow();
        expect((await t.run((ctx) => ctx.db.get(id)))?.discoverySource).toBeUndefined();
    });

    it('requires the saved city, validates discovery values, resumes after restart and completes without certifying or approving', async () => {
        const { t, id, agent } = await setup();
        await expect(agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend' })).rejects.toThrow('Save your work city');
        await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Baguio', source: 'city' });
        const resumed = t.withIdentity({ subject: 'agent' });
        expect(await resumed.query(api.creators.getByClerkId, { clerkId: 'agent' })).toMatchObject({ workCity: 'Baguio', fieldAgentOnboardingRequired: true });
        await expect(resumed.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'unknown' } as never)).rejects.toThrow();
        expect(await resumed.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'tiktok' })).toEqual({ completed: true });
        const row = await t.run((ctx) => ctx.db.get(id));
        expect(row).toMatchObject({ workCity: 'Baguio', discoverySource: 'tiktok', fieldAgentOnboardingRequired: false, fieldAgentOnboardingCompletedAt: NOW, status: 'active' });
        expect(row?.certifiedAt).toBeUndefined();
        expect(row?.quizPassedAt).toBeUndefined();
        expect(row?.balance).toBeUndefined();
        vi.setSystemTime(NOW + 1000);
        await resumed.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'facebook' });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ discoverySource: 'tiktok', fieldAgentOnboardingCompletedAt: NOW });
    });

    it('marks only genuinely new creator rows as requiring onboarding, leaving reused and legacy rows alone', async () => {
        const t = convexTest(schema, modules);
        const fresh = t.withIdentity({ subject: 'fresh' });
        const id = await fresh.mutation(api.creators.create, { clerkId: 'fresh', referralCode: 'FRESH' });
        expect((await t.run((ctx) => ctx.db.get(id)))?.fieldAgentOnboardingRequired).toBe(true);
        const oldId = await insertAgent(t, 'legacy', { role: undefined, fieldAgentOnboardingRequired: undefined, certifiedAt: 123 });
        expect(await t.withIdentity({ subject: 'legacy' }).mutation(api.creators.create, { clerkId: 'legacy', referralCode: 'LEGACY' })).toBe(oldId);
        expect(await t.run((ctx) => ctx.db.get(oldId))).toMatchObject({ certifiedAt: 123 });
        expect((await t.run((ctx) => ctx.db.get(oldId)))?.fieldAgentOnboardingRequired).toBeUndefined();
    });
});

describe('field-agent onboarding referrals', () => {
    it('atomically attaches an active affiliate code once, with the existing override rules and no legacy bonus or money credit', async () => {
        const { t, id, agent } = await setup();
        const affiliateId = await insertAgent(t, 'affiliate', { role: 'affiliate', affiliateHandle: 'mika', referralCode: 'MIKA30', firstName: 'Mika' });
        await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Marikina', source: 'city' });
        await agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend', referredByCode: ' mika30 ' });
        const row = await t.run((ctx) => ctx.db.get(id));
        expect(row).toMatchObject({ referredBy: affiliateId, referredByCode: 'MIKA30', recruitedByCreatorId: affiliateId, recruitedAt: NOW, recruitedVia: 'code', fieldAgentOnboardingCompletedAt: NOW });
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([]);
        expect(await t.run((ctx) => ctx.db.query('earnings').collect())).toEqual([]);
        vi.setSystemTime(NOW + 1000);
        await agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend', referredByCode: 'MIKA30' });
        // A delayed signup delivery sees the same recruit and remains idempotent.
        await t.mutation(internal.referrals.createFromSignup, { referrerId: affiliateId, referredId: id, referralCode: 'MIKA30' });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ recruitedAt: NOW, fieldAgentOnboardingCompletedAt: NOW });
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([]);
    });

    it('creates exactly one pending legacy referral for a field-agent invite and preserves it on repeated completion', async () => {
        const { t, id, agent } = await setup();
        const referrerId = await insertAgent(t, 'referrer', { firstName: 'Joy', lastName: 'Dizon', referralCode: 'JOYD4K2' });
        await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Pasig', source: 'city' });
        await agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend', referredByCode: 'joyd4k2' });
        await agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend', referredByCode: 'JOYD4K2' });
        await t.mutation(internal.referrals.createFromSignup, { referrerId, referredId: id, referralCode: 'JOYD4K2' });
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([
            expect.objectContaining({ referrerId, referredId: id, referralCode: 'JOYD4K2', status: 'pending', createdAt: NOW }),
        ]);
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ referredBy: referrerId, referredByName: 'Joy Dizon' });
        expect((await t.run((ctx) => ctx.db.get(id)))?.recruitedByCreatorId).toBeUndefined();
    });

    it('retains pre-cutover affiliate referrals on the existing bonus track', async () => {
        vi.setSystemTime(CREATOR_OVERRIDE_CUTOVER - 1);
        const { t, id, agent } = await setup();
        const referrerId = await insertAgent(t, 'affiliate', { role: 'affiliate', referralCode: 'OLD' });
        await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Pasig', source: 'city' });
        await agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend', referredByCode: 'OLD' });
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([expect.objectContaining({ referrerId, referredId: id })]);
        expect((await t.run((ctx) => ctx.db.get(id)))?.recruitedByCreatorId).toBeUndefined();
    });

    it('preserves signup or confirmed-link attribution, refuses another code, and never duplicates an already recorded referral', async () => {
        const { t, id, agent } = await setup();
        const referrerId = await insertAgent(t, 'referrer', { referralCode: 'EXISTING' });
        await insertAgent(t, 'other-referrer', { referralCode: 'OTHER' });
        const referralId = await t.run((ctx) => ctx.db.insert('referrals', { referrerId, referredId: id, referralCode: 'EXISTING', status: 'pending', createdAt: NOW - 100 }));
        await t.run((ctx) => ctx.db.patch(id, { referredBy: referrerId, referredByCode: 'EXISTING', referredByName: 'Original name' }));
        await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Pasig', source: 'city' });
        await expect(agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend', referredByCode: 'OTHER' })).rejects.toThrow('already been recorded');
        expect((await t.run((ctx) => ctx.db.get(id)))?.fieldAgentOnboardingCompletedAt).toBeUndefined();
        await agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'facebook' });
        await agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'facebook', referredByCode: 'EXISTING' });
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([expect.objectContaining({ _id: referralId })]);
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ referredByCode: 'EXISTING', referredByName: 'Original name' });
    });

    it.each([
        { code: 'MISSING', fields: null },
        { code: 'AGENT', fields: null },
        { code: 'UNAVAILABLE', fields: { role: 'affiliate', status: 'pending' } },
        { code: 'UNAVAILABLE', fields: { role: 'affiliate', status: 'suspended' } },
        { code: 'UNAVAILABLE', fields: { role: 'creator', status: 'deleted' } },
        { code: 'UNAVAILABLE', fields: { role: 'creator', isDeleted: true } },
        { code: 'UNAVAILABLE', fields: { role: 'admin' } },
    ])('rejects invalid or ineligible code $code / $fields atomically', async ({ code, fields }) => {
        const { t, id, agent } = await setup();
        if (fields) await insertAgent(t, 'unavailable', { ...fields, referralCode: 'UNAVAILABLE' });
        await agent.mutation(api.fieldAgentOnboarding.saveWorkArea, { city: 'Pasig', source: 'city' });
        await expect(agent.mutation(api.fieldAgentOnboarding.complete, { discoverySource: 'friend', referredByCode: code })).rejects.toThrow();
        const row = await t.run((ctx) => ctx.db.get(id));
        expect(row?.workCity).toBe('Pasig');
        expect(row?.fieldAgentOnboardingRequired).toBe(true);
        expect(row?.fieldAgentOnboardingCompletedAt).toBeUndefined();
        expect(row?.referredBy).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([]);
    });
});
