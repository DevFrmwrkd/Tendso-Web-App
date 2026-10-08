import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import {
    AFFILIATE_MESSAGE_MAX_LENGTH, affiliatePhotoError, affiliateSocialLinkError,
} from '../../lib/affiliates';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './earnings.ts': () => import('../../convex/earnings'),
};
const paginationOpts = { numItems: 2, cursor: null };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 9, 8)); });
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    const [id, otherId] = await t.run(async (ctx) => Promise.all(['affiliate', 'other-affiliate'].map((clerkId) =>
        ctx.db.insert('creators', {
            clerkId, email: `${clerkId}@example.com`, role: 'affiliate', status: 'active',
            affiliateHandle: clerkId, affiliatePrice: 1999,
        }))));
    return { t, id, otherId, affiliate: t.withIdentity({ subject: 'affiliate' }), other: t.withIdentity({ subject: 'other-affiliate' }) };
}

async function sale(t: ReturnType<typeof convexTest>, creatorId: Id<'creators'>, businessName: string,
    fields: Partial<Omit<Doc<'submissions'>, '_id' | '_creationTime'>> = {}) {
    vi.advanceTimersByTime(1);
    return t.run((ctx) => ctx.db.insert('submissions', {
        creatorId, businessName, businessType: 'shop', ownerName: 'Private Owner', ownerPhone: '09171234567',
        ownerEmail: 'private@example.com', address: 'Private Street', city: 'Quezon City',
        photos: ['https://example.com/private-photo.jpg'], transcript: 'Private interview',
        status: 'completed', amount: 1999, creatorPayout: 1000, ...fields,
    }));
}

describe('affiliate dashboard sales', () => {
    it('requires an authenticated affiliate account and accepts no client-selected account', async () => {
        const { t, affiliate, otherId } = await setup();
        await expect(t.query(api.affiliates.sales, { paginationOpts })).rejects.toThrow('Not authenticated');
        for (const role of ['creator', 'admin', 'staff']) {
            await t.run((ctx) => ctx.db.insert('creators', { clerkId: role, email: `${role}@example.com`, role }));
            await expect(t.withIdentity({ subject: role }).query(api.affiliates.sales, { paginationOpts })).rejects.toThrow('affiliate account');
        }
        await expect(t.withIdentity({ subject: 'missing-profile' }).query(api.affiliates.sales, { paginationOpts })).rejects.toThrow('affiliate account');
        const foreignRead = { paginationOpts, creatorId: otherId };
        await expect(affiliate.query(api.affiliates.sales, foreignRead)).rejects.toThrow();
    });

    it('paginates the caller’s own sales newest first and exposes only the dashboard fields', async () => {
        const { t, affiliate, other, id, otherId } = await setup();
        const oldest = await sale(t, id, 'First Shop');
        const middle = await sale(t, id, 'Second Shop');
        await sale(t, otherId, 'Another Affiliate Shop');
        const newest = await sale(t, id, 'Latest Shop', { status: 'pending_payment' });
        const first = await affiliate.query(api.affiliates.sales, { paginationOpts });
        expect(first.page.map((row) => row._id)).toEqual([newest, middle]);
        expect(first.isDone).toBe(false);
        expect(first.continueCursor).toEqual(expect.any(String));
        expect(Object.keys(first.page[0]).sort()).toEqual(['_id', 'businessName', 'commission', 'createdAt', 'price', 'status']);
        expect(first.page[0]).toEqual({
            _id: newest, businessName: 'Latest Shop', commission: 1000, price: 1999,
            status: 'pending_payment', createdAt: (await t.run((ctx) => ctx.db.get(newest)))!._creationTime,
        });
        const next = await affiliate.query(api.affiliates.sales, {
            paginationOpts: { numItems: 2, cursor: first.continueCursor },
        });
        expect(next.page.map((row) => row._id)).toEqual([oldest]);
        expect(next.isDone).toBe(true);
        expect((await other.query(api.affiliates.sales, { paginationOpts })).page.map((row) => row.businessName)).toEqual(['Another Affiliate Shop']);
    });

    it('keeps historical owner charges and frozen commissions when the affiliate changes today’s price', async () => {
        const { t, affiliate, id } = await setup();
        await sale(t, id, 'Custom Domain Shop', { amount: 1499, creatorPayout: 500, submissionType: 'with_custom_domain' });
        await sale(t, id, 'Comped Shop', { amount: 4999, creatorPayout: 2500, pricingMode: 'comped' });
        await sale(t, id, 'Legacy Shop', { amount: undefined, creatorPayout: undefined });
        const before = await affiliate.query(api.affiliates.sales, { paginationOpts: { numItems: 10, cursor: null } });
        await affiliate.mutation(api.affiliates.updatePage, { price: 4999 });
        const after = await affiliate.query(api.affiliates.sales, { paginationOpts: { numItems: 10, cursor: null } });
        expect(after.page).toEqual(before.page);
        expect(after.page.map(({ businessName, price, commission }) => ({ businessName, price, commission }))).toEqual([
            { businessName: 'Legacy Shop', price: 0, commission: 0 },
            { businessName: 'Comped Shop', price: 0, commission: 2500 },
            { businessName: 'Custom Domain Shop', price: 1499, commission: 500 },
        ]);
    });

    it('allows a suspended affiliate to read earned sales and earnings, while blocking edits and deleted accounts', async () => {
        const { t, affiliate, id } = await setup();
        const submissionId = await sale(t, id, 'Earned Shop');
        await t.run(async (ctx) => {
            await ctx.db.insert('earnings', { creatorId: id, submissionId, amount: 1000, type: 'submission_approved', status: 'available', createdAt: Date.now() });
            await ctx.db.patch(id, { status: 'suspended' });
        });
        expect((await affiliate.query(api.affiliates.sales, { paginationOpts })).page.map((row) => row.businessName)).toEqual(['Earned Shop']);
        expect((await affiliate.query(api.earnings.getSummary, { creatorId: id })).available).toBe(1000);
        await expect(affiliate.mutation(api.affiliates.updatePage, { price: 3999 })).rejects.toThrow('suspended');
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliatePrice).toBe(1999);
        await t.run((ctx) => ctx.db.patch(id, { isDeleted: true }));
        await expect(affiliate.query(api.affiliates.sales, { paginationOpts })).rejects.toThrow('affiliate account');
    });
});

describe('affiliate dashboard page settings', () => {
    it('rounds and clamps finite price input on the server and rejects nonfinite input without changing settings', async () => {
        const { t, affiliate, id } = await setup();
        for (const [price, expected] of [[-1000, 999], [998, 999], [999, 999], [999.5, 1000], [2500.4, 2500], [4999, 4999], [9999, 4999]]) {
            await affiliate.mutation(api.affiliates.updatePage, { price });
            expect((await t.run((ctx) => ctx.db.get(id)))?.affiliatePrice).toBe(expected);
        }
        for (const price of [NaN, Infinity, -Infinity]) {
            await expect(affiliate.mutation(api.affiliates.updatePage, { price })).rejects.toThrow('valid price');
        }
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliatePrice).toBe(4999);
    });

    it('saves allowed Facebook/Messenger links and rejects credentials, lookalikes and other platforms', async () => {
        const { t, affiliate, id } = await setup();
        const allowed = [
            'https://facebook.com/alex', 'https://www.facebook.com/alex', 'https://m.facebook.com/alex',
            'https://messenger.com/t/alex', 'https://www.messenger.com/t/alex', 'https://m.me/alex',
        ];
        for (const socialLink of allowed) {
            expect(affiliateSocialLinkError(socialLink)).toBeNull();
            await affiliate.mutation(api.affiliates.updatePage, { socialLink });
            expect((await t.run((ctx) => ctx.db.get(id)))?.affiliateSocialLink).toBe(socialLink);
        }
        const invalid = [
            'http://facebook.com/alex', 'javascript:alert(1)', 'https://facebook.com.evil.test/alex',
            'https://evilfacebook.com/alex', 'https://messenger.com.evil.test/alex', 'https://m.me.evil.test/alex',
            'https://user:secret@facebook.com/alex', 'https://facebook.com@evil.test/alex',
            'https://instagram.com/alex', 'https://example.com/alex', 'https://subdomain.m.me/alex',
            'https://facebook.com:444/alex',
        ];
        for (const socialLink of invalid) {
            expect(affiliateSocialLinkError(socialLink)).not.toBeNull();
            await expect(affiliate.mutation(api.affiliates.updatePage, { socialLink })).rejects.toThrow();
        }
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliateSocialLink).toBe(allowed.at(-1));
        await affiliate.mutation(api.affiliates.updatePage, { socialLink: '' });
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliateSocialLink).toBeUndefined();
    });

    it('enforces the 200-character message and HTTPS photo rules without partially saving invalid input', async () => {
        const { t, affiliate, id } = await setup();
        expect(AFFILIATE_MESSAGE_MAX_LENGTH).toBe(200);
        await affiliate.mutation(api.affiliates.updatePage, {
            displayName: ' Alex ', photo: ' https://example.com/photo.jpg ', message: 'x'.repeat(AFFILIATE_MESSAGE_MAX_LENGTH),
        });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
            affiliateDisplayName: 'Alex', affiliatePhoto: 'https://example.com/photo.jpg', affiliateMessage: 'x'.repeat(200),
        });
        await expect(affiliate.mutation(api.affiliates.updatePage, { price: 4999, message: 'x'.repeat(201) })).rejects.toThrow('200 characters');
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliatePrice).toBe(1999);
        for (const photo of ['http://example.com/photo.jpg', 'javascript:alert(1)', 'https://user:secret@example.com/photo.jpg']) {
            expect(affiliatePhotoError(photo)).not.toBeNull();
            await expect(affiliate.mutation(api.affiliates.updatePage, { photo })).rejects.toThrow('HTTPS');
        }
        await affiliate.mutation(api.affiliates.updatePage, { photo: '', displayName: '', message: '' });
        const row = await t.run((ctx) => ctx.db.get(id));
        expect(row?.affiliatePhoto).toBeUndefined();
        expect(row?.affiliateDisplayName).toBeUndefined();
        expect(row?.affiliateMessage).toBeUndefined();
    });

    it('requires an active affiliate and updates only the account owned by the current identity', async () => {
        const { t, affiliate, id, otherId } = await setup();
        await expect(t.mutation(api.affiliates.updatePage, { price: 3999 })).rejects.toThrow('Not authenticated');
        await expect(t.withIdentity({ subject: 'missing-profile' }).mutation(api.affiliates.updatePage, { price: 3999 })).rejects.toThrow('affiliate account');
        const foreignUpdate = { price: 3999, id: otherId };
        await expect(affiliate.mutation(api.affiliates.updatePage, foreignUpdate)).rejects.toThrow();
        await affiliate.mutation(api.affiliates.updatePage, { price: 3999 });
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliatePrice).toBe(3999);
        expect((await t.run((ctx) => ctx.db.get(otherId)))?.affiliatePrice).toBe(1999);
    });
});
