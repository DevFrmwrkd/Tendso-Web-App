import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import * as h3 from 'h3-js';
import { api } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { latLngToH3Cells } from '../../convex/lib/h3';
import {
    pointInProspectViewport, prospectViewportRanges, validateProspectViewport,
    VIEWPORT_MAX_RANGES, VIEWPORT_ROWS_PER_RANGE, type ProspectViewport,
} from '../../convex/lib/prospectViewport';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './prospects.ts': () => import('../../convex/prospects'),
};
type Backend = ReturnType<typeof convexTest<typeof schema.tables>>;
const local = { south: 14.59, north: 14.61, west: 120.99, east: 121.01 };
let sequence = 0;

async function insert(t: Backend, latitude: number, longitude: number, overrides: Partial<Doc<'prospects'>> = {}) {
    const cell = latLngToH3Cells(latitude, longitude);
    return t.run((ctx) => ctx.db.insert('prospects', {
        googlePlaceId: `test-place-${sequence++}`, businessName: 'Real saved shop', normalizedName: 'real saved shop',
        category: 'Food', categoryBucket: 'restaurant', latitude, longitude, country: 'PH',
        h3CellRes7: cell.res7, h3CellRes8: cell.res8, h3CellRes9: cell.res9,
        state: 'available', stateUpdatedAt: 1, qualityScore: 50, scrapedAt: 1, lastRefreshedAt: 1,
        ...overrides,
    }));
}

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const agent = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active' });
        const other = await ctx.db.insert('creators', { clerkId: 'other', email: 'other@example.test', role: 'creator', status: 'active' });
        for (const account of [
            { clerkId: 'affiliate', role: 'affiliate', status: 'active' },
            { clerkId: 'suspended', role: 'creator', status: 'suspended' },
            { clerkId: 'deleted', role: 'creator', status: 'deleted' },
        ]) await ctx.db.insert('creators', { ...account, email: `${account.clerkId}@example.test` });
        return { agent, other };
    });
    return { t, ids, agent: t.withIdentity({ subject: 'agent' }) };
}

describe('bounded existing-prospect viewport reads', () => {
    it('expands beyond the old fixed H3 nearby rings when the viewport grows, and follows a pan', async () => {
        const { t, agent } = await setup();
        const near = await insert(t, 14.6, 121);
        const farther = await insert(t, 14.85, 121.25);
        expect((await agent.query(api.prospects.searchNearby, { lat: 14.6, lng: 121, radiusKm: 20 })).map((row) => row._id))
            .not.toContain(farther);
        expect(await agent.query(api.prospects.searchViewport, local)).toMatchObject({ prospects: [{ _id: near }], truncated: false });
        const expanded = await agent.query(api.prospects.searchViewport, { south: 14.5, north: 14.95, west: 120.9, east: 121.4 });
        expect(new Set(expanded.prospects.map((row) => row._id))).toEqual(new Set([near, farther]));
        expect(expanded.truncated).toBe(false);
        expect(await agent.query(api.prospects.searchViewport, { south: 14.84, north: 14.86, west: 121.24, east: 121.26 }))
            .toMatchObject({ prospects: [{ _id: farther }], truncated: false });
    });

    it('filters exact bounds even when an outside row shares the same H3 cell', async () => {
        const { t, agent } = await setup();
        const [latitude, longitude] = h3.cellToLatLng(h3.latLngToCell(14.6, 121, 7));
        const inside = await insert(t, latitude, longitude);
        await insert(t, latitude + 0.001, longitude);
        expect(h3.latLngToCell(latitude + 0.001, longitude, 7)).toBe(h3.latLngToCell(latitude, longitude, 7));
        expect(await agent.query(api.prospects.searchViewport, {
            south: latitude - 0.0001, north: latitude + 0.0001, west: longitude - 0.0001, east: longitude + 0.0001,
        })).toMatchObject({ prospects: [{ _id: inside }], truncated: false });
    });

    it('includes both sides of the dateline without including the opposite side of the globe', async () => {
        const { t, agent } = await setup();
        const east = await insert(t, 10, 179.95);
        const west = await insert(t, 10, -179.95);
        await insert(t, 10, 0);
        const result = await agent.query(api.prospects.searchViewport, { south: 9.9, north: 10.1, west: 179.8, east: -179.8 });
        expect(new Set(result.prospects.map((row) => row._id))).toEqual(new Set([east, west]));
        expect(result.truncated).toBe(false);
    });

    it.each([
        { west: -180, east: -160, longitude: 180 },
        { west: 160, east: 180, longitude: -180 },
    ])('treats +/-180 as the same inclusive viewport edge %j', async ({ west, east, longitude }) => {
        const { t, agent } = await setup();
        const id = await insert(t, 10, longitude);
        expect(await agent.query(api.prospects.searchViewport, { south: 9.9, north: 10.1, west, east }))
            .toMatchObject({ prospects: [{ _id: id }], truncated: false });
    });

    it.each([
        { latitude: 78.2, longitude: 15.6, bounds: { south: 78.1, north: 78.3, west: 15, east: 16 } },
        { latitude: 89.99, longitude: 60, bounds: { south: 89.98, north: 90, west: 20, east: 100 } },
        { latitude: -89.99, longitude: -60, bounds: { south: -90, north: -89.98, west: -100, east: -20 } },
    ])('covers high latitude and polar view $latitude', async ({ latitude, longitude, bounds }) => {
        const { t, agent } = await setup();
        const id = await insert(t, latitude, longitude);
        await insert(t, 14.6, 121);
        expect(await agent.query(api.prospects.searchViewport, bounds)).toMatchObject({ prospects: [{ _id: id }], truncated: false });
    });

    it('includes shops exactly on all four visible boundaries', async () => {
        const { t, agent } = await setup();
        const points = [[14.59, 121], [14.61, 121], [14.6, 120.99], [14.6, 121.01]];
        const ids = await Promise.all(points.map(([lat, lng]) => insert(t, lat, lng)));
        await insert(t, 14.610001, 121);
        await insert(t, 14.6, 121.010001);
        const result = await agent.query(api.prospects.searchViewport, local);
        expect(new Set(result.prospects.map((row) => row._id))).toEqual(new Set(ids));
        expect(result.truncated).toBe(false);
    });

    it('exposes available and expired reservations only, without mutating any reservation', async () => {
        const { t, ids, agent } = await setup();
        const available = await insert(t, 14.6, 121);
        const expired = await insert(t, 14.6, 121, { state: 'reserved', reservedByCreatorId: ids.other, reservationExpiresAt: Date.now() - 1000 });
        await insert(t, 14.6, 121, { state: 'reserved', reservedByCreatorId: ids.other, reservationExpiresAt: Date.now() + 100000 });
        await insert(t, 14.6, 121, { state: 'reserved', reservedByCreatorId: ids.agent, reservationExpiresAt: Date.now() + 100000 });
        await insert(t, 14.6, 121, { state: 'reserved', reservedByCreatorId: ids.other });
        for (const state of ['contacted', 'qualified', 'converted', 'lost'] as const) await insert(t, 14.6, 121, { state });
        const before = await t.run((ctx) => ctx.db.query('prospects').collect());
        const result = await agent.query(api.prospects.searchViewport, local);
        expect(new Set(result.prospects.map((row) => row._id))).toEqual(new Set([available, expired]));
        expect(result.truncated).toBe(false);
        expect(await t.run((ctx) => ctx.db.query('prospects').collect())).toEqual(before);
    });

    it('returns a truthful truncation flag for a result limit and respects category filters', async () => {
        const { t, agent } = await setup();
        await insert(t, 14.6, 121);
        await insert(t, 14.6, 121);
        const beauty = await insert(t, 14.6, 121, { categoryBucket: 'beauty' });
        expect(await agent.query(api.prospects.searchViewport, { ...local, limit: 2 })).toMatchObject({ truncated: true });
        const filtered = await agent.query(api.prospects.searchViewport, { ...local, categoryBucket: 'beauty' });
        expect(filtered).toMatchObject({ prospects: [{ _id: beauty }], truncated: false });
    });

    it('bounds reads in a dense range and reports incomplete results even when filters hide every scanned row', async () => {
        const { t, agent } = await setup();
        for (let i = 0; i < VIEWPORT_ROWS_PER_RANGE + 10; i++) await insert(t, 14.6, 121, { state: 'converted' });
        const before = await t.run((ctx) => ctx.db.query('prospects').collect());
        expect(await agent.query(api.prospects.searchViewport, { ...local, limit: 400 }))
            .toEqual({ prospects: [], truncated: true });
        expect(await t.run((ctx) => ctx.db.query('prospects').collect())).toEqual(before);
    });

    it.each([null, 'no-account', 'affiliate', 'suspended', 'deleted'])('rejects unsupported or unauthenticated caller %s', async (subject) => {
        const { t } = await setup();
        const caller = subject ? t.withIdentity({ subject }) : t;
        await expect(caller.query(api.prospects.searchViewport, local)).rejects.toThrow(/Not authenticated|Forbidden/);
    });

    it.each([
        { ...local, north: 91 }, { ...local, south: local.north }, { ...local, west: -181 },
        { ...local, west: 121, east: 121 }, { ...local, limit: 0 }, { ...local, limit: 2.5 },
    ])('rejects invalid viewport arguments %j', async (bounds) => {
        const { agent } = await setup();
        await expect(agent.query(api.prospects.searchViewport, bounds)).rejects.toThrow(/valid/);
    });
});

describe('H3 viewport index coverage', () => {
    function expectCovered(bounds: ProspectViewport, latitude: number, longitude: number) {
        const cell = h3.latLngToCell(latitude, longitude, 7);
        const ranges = prospectViewportRanges(bounds);
        expect(ranges.length).toBeLessThanOrEqual(VIEWPORT_MAX_RANGES);
        expect(ranges.some((range) => range.lower <= cell && cell <= range.upper)).toBe(true);
        expect(pointInProspectViewport(bounds, latitude, longitude)).toBe(true);
    }

    it('covers res7 points at coarse parent boundaries instead of assuming parent outlines contain their children', () => {
        const parent = h3.latLngToCell(14.6, 121, 5);
        for (const [latitude, longitude] of h3.cellToBoundary(parent)) {
            const bounds = { south: latitude - 0.001, north: latitude + 0.001, west: longitude - 0.001, east: longitude + 0.001 };
            for (const shift of [-0.00001, 0, 0.00001]) expectCovered(bounds, latitude + shift, longitude + shift);
        }
    });

    it.each([
        { south: 14, north: 15.5, west: 120, east: 122 },
        { south: 77.9, north: 78.5, west: 10, east: 20 },
        { south: 9, north: 11, west: 179, east: -179 },
        { south: -0.000001, north: 0.000001, west: -180, east: 180 },
        { south: -90, north: 90, west: -180, east: 180 },
    ])('keeps a bounded index cover for broad, skinny and dateline bounds %j', (bounds) => {
        const width = bounds.east >= bounds.west ? bounds.east - bounds.west : bounds.east + 360 - bounds.west;
        for (const latStep of [0.01, 0.5, 0.99]) for (const lngStep of [0.01, 0.5, 0.99]) {
            const latitude = bounds.south + latStep * (bounds.north - bounds.south);
            const longitude = ((bounds.west + lngStep * width + 180) % 360 + 360) % 360 - 180;
            expectCovered(bounds, latitude, longitude);
        }
    });

    it('rejects non-finite latitude and longitude before H3 allocation', () => {
        expect(() => validateProspectViewport({ ...local, north: Infinity })).toThrow('valid map bounds');
        expect(() => validateProspectViewport({ ...local, east: NaN })).toThrow('valid map bounds');
    });
});
