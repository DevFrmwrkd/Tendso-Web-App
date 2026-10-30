import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './leads.ts': () => import('../../convex/leads'),
    './submissions.ts': () => import('../../convex/submissions'),
};
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000;
const find = {
    businessName: '  Mang Oca’s   Panaderya  ', kind: 'food' as const,
    photoUrl: 'https://images.example.com/shop.jpg', needsWebsite: true,
    latitude: 14.6507, longitude: 121.1029, address: '  Main Street  ', city: ' Marikina ',
    clientRequestId: 'find-request-001',
};
const capture = {
    businessName: 'Mang Oca’s Panaderya', businessType: 'Food', ownerName: 'Oca', ownerPhone: '09171234567', ownerEmail: 'oca@example.com',
    address: 'Main Street', city: 'Marikina', photos: ['https://images.example.com/1.jpg', 'https://images.example.com/2.jpg', 'https://images.example.com/3.jpg'],
};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function setup(overrides: Partial<Doc<'creators'>> = {}) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const agent = await ctx.db.insert('creators', {
            clerkId: 'agent', email: 'agent@example.com', role: 'creator', status: 'active',
            firstName: 'Jun', lastName: 'Santos', certifiedAt: 10, balance: 0, totalEarnings: 0, ...overrides,
        });
        const other = await ctx.db.insert('creators', {
            clerkId: 'other', email: 'other@example.com', role: 'creator', firstName: 'Joy', lastName: 'Reyes', certifiedAt: 20,
        });
        return { agent, other };
    });
    const agent = t.withIdentity({ subject: 'agent' });
    const other = t.withIdentity({ subject: 'other' });
    const createFind = () => agent.mutation(api.leads.createCommunityFind, find);
    const row = (id: Id<'leads'>) => t.run((ctx) => ctx.db.get(id));
    const all = () => t.run((ctx) => ctx.db.query('leads').collect());
    return { t, ids, agent, other, createFind, row, all };
}

describe('field-agent community finds', () => {
    it('saves a genuine attributed find without creating interviews or earnings', async () => {
        const { t, ids, createFind, row } = await setup();
        const id = await createFind();
        expect(await row(id)).toMatchObject({
            source: 'community', status: 'new', creatorId: ids.agent, spottedByCreatorId: ids.agent,
            spottedAt: NOW, createdAt: NOW, businessName: 'Mang Oca’s Panaderya', businessCategory: 'Food',
            businessAddress: 'Main Street', businessCity: 'Marikina', businessLatitude: 14.6507, businessLongitude: 121.1029,
            communityPhotoUrl: find.photoUrl, communityKind: 'food', needsWebsite: true, requestId: find.clientRequestId,
        });
        expect(await t.run((ctx) => ctx.db.query('submissions').collect())).toEqual([]);
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
        expect(await t.run((ctx) => ctx.db.get(ids.agent))).toMatchObject({ balance: 0, totalEarnings: 0 });
    });

    it('deduplicates a retried request per spotter without overwriting the original find', async () => {
        const { agent, other, all, createFind } = await setup();
        const id = await createFind();
        expect(await agent.mutation(api.leads.createCommunityFind, { ...find, businessName: 'Changed retry' })).toBe(id);
        expect(await other.mutation(api.leads.createCommunityFind, find)).not.toBe(id);
        expect((await all()).map((lead) => lead.businessName)).toEqual(['Mang Oca’s Panaderya', 'Mang Oca’s Panaderya']);
    });

    it('accepts certified legacy field-agent accounts', async () => {
        const { createFind, row } = await setup({ role: undefined });
        expect(await row(await createFind())).toMatchObject({ source: 'community' });
    });

    it.each([
        { certifiedAt: undefined }, { rejectedAt: 30 }, { role: 'affiliate' }, { role: 'owner' },
        { role: 'staff' }, { role: 'admin' }, { isDeleted: true }, { status: 'deleted' }, { status: 'suspended' },
    ])('rejects ineligible accounts for finding and visiting: %j', async (overrides) => {
        const { agent, other, all } = await setup(overrides);
        const leadId = await other.mutation(api.leads.createCommunityFind, find);
        await expect(agent.mutation(api.leads.createCommunityFind, find)).rejects.toThrow();
        await expect(agent.mutation(api.leads.visitCommunityFind, { leadId })).rejects.toThrow();
        expect(await all()).toHaveLength(1);
    });

    it('rejects unauthenticated writes and never trusts client attribution', async () => {
        const { t, ids, agent, createFind, row } = await setup();
        await expect(t.mutation(api.leads.createCommunityFind, find)).rejects.toThrow('Not authenticated');
        const leadId = await createFind();
        await expect(t.mutation(api.leads.visitCommunityFind, { leadId })).rejects.toThrow('Not authenticated');
        await expect(agent.mutation(api.leads.createCommunityFind, { ...find, creatorId: ids.other } as never)).rejects.toThrow();
        expect((await row(leadId))?.spottedByCreatorId).toBe(ids.agent);
    });

    it.each([
        { businessName: '' }, { businessName: 'x' }, { businessName: 'x'.repeat(121) },
        { photoUrl: 'file:///shop.jpg' }, { photoUrl: 'data:image/png;base64,abc' },
        { photoUrl: 'https://user:secret@example.com/shop.jpg' }, { photoUrl: 'https://images.example.com/bad image.jpg' },
        { latitude: 91 }, { longitude: -181 }, { latitude: NaN }, { longitude: Infinity },
        { city: 'x'.repeat(101) }, { address: 'x'.repeat(301) }, { clientRequestId: 'short' }, { clientRequestId: 'bad/request' },
    ])('validates required find content and location: %j', async (invalid) => {
        const { agent, all } = await setup();
        await expect(agent.mutation(api.leads.createCommunityFind, { ...find, ...invalid })).rejects.toThrow();
        expect(await all()).toHaveLength(0);
    });

    it('rejects invented kinds at the API boundary', async () => {
        const { agent } = await setup();
        await expect(agent.mutation(api.leads.createCommunityFind, { ...find, kind: 'invented' } as never)).rejects.toThrow();
    });

    it('returns the actual photo, location, needs-site choice and immutable spotter in feed and detail', async () => {
        const { t, ids, agent, createFind } = await setup();
        const id = await createFind();
        await t.run((ctx) => ctx.db.patch(id, { creatorId: ids.other }));
        const feed = await agent.query(api.leads.listForMobileCRM, { statusFilter: 'all' });
        expect(feed.stats).toMatchObject({ total: 1, new: 1 });
        const expected = {
            photoUrl: find.photoUrl, hasLiveWebsite: false, needsWebsite: true, communityKind: 'food',
            businessLatitude: find.latitude, businessLongitude: find.longitude, websiteUrl: null,
            spottedBy: { creatorId: String(ids.agent), displayName: 'Jun S.', profileImage: null },
            submittedBy: { creatorId: String(ids.agent), displayName: 'Jun S.', profileImage: null },
            spottedAt: NOW, claimedBy: null, claimExpiresAt: null,
        };
        expect(feed.leads[0]).toMatchObject(expected);
        expect(await agent.query(api.leads.getDetailForMobileCRM, { id })).toMatchObject({
            ...expected, lead: { businessName: 'Mang Oca’s Panaderya', businessCity: 'Marikina', source: 'community' },
        });
    });

    it('keeps unknown website status distinct from an explicit false needs-site answer', async () => {
        const { t, agent } = await setup();
        await agent.mutation(api.leads.createCommunityFind, { ...find, needsWebsite: false });
        await t.run((ctx) => ctx.db.insert('leads', { source: 'direct', name: 'A customer', status: 'new', createdAt: NOW }));
        const rows = (await agent.query(api.leads.listForMobileCRM, {})).leads;
        expect(rows.find((lead) => lead.source === 'community')).toMatchObject({ needsWebsite: false, hasLiveWebsite: false });
        expect(rows.find((lead) => lead.source === 'direct')).toMatchObject({ needsWebsite: null, hasLiveWebsite: false, photoUrl: null });
    });

    it('keeps capture photos out of shared covers while preserving published website status', async () => {
        const { t, ids, agent } = await setup();
        const { leadId, websiteId } = await t.run(async (ctx) => {
            const submissionId = await ctx.db.insert('submissions', { ...capture, creatorId: ids.agent, status: 'approved' });
            const websiteId = await ctx.db.insert('generatedWebsites', { submissionId, status: 'published', publishedUrl: 'https://panaderya.sites.tendso.com' });
            const leadId = await ctx.db.insert('leads', { creatorId: ids.agent, submissionId, source: 'direct', status: 'converted', createdAt: NOW });
            return { leadId, websiteId };
        });
        expect(await agent.query(api.leads.getDetailForMobileCRM, { id: leadId })).toMatchObject({
            photoUrl: null, canViewCaptureMedia: true, business: { photos: capture.photos },
            websiteUrl: 'https://panaderya.sites.tendso.com', hasLiveWebsite: true, needsWebsite: false,
        });
        await t.run((ctx) => ctx.db.patch(websiteId, { offlineAt: NOW }));
        expect(await agent.query(api.leads.getDetailForMobileCRM, { id: leadId })).toMatchObject({ hasLiveWebsite: false, needsWebsite: false });
    });

    it('uses the actual external business website and ignores malformed URLs', async () => {
        const { t, agent, createFind } = await setup();
        const id = await createFind();
        await t.run((ctx) => ctx.db.patch(id, { businessWebsite: 'https://shop.example.com' }));
        expect((await agent.query(api.leads.listForMobileCRM, {})).leads[0]).toMatchObject({
            hasLiveWebsite: true, needsWebsite: false, businessWebsite: 'https://shop.example.com', websiteUrl: 'https://shop.example.com',
        });
        await t.run((ctx) => ctx.db.patch(id, { businessWebsite: 'javascript:alert(1)' }));
        expect((await agent.query(api.leads.listForMobileCRM, {})).leads[0]).toMatchObject({ hasLiveWebsite: false, needsWebsite: true, businessWebsite: null });
    });

    it('never promotes native R2 keys or legacy Convex capture photos into shared covers', async () => {
        vi.stubEnv('R2_PUBLIC_URL', 'https://public-images.example.com/');
        const { t, ids, agent } = await setup();
        const { leadId, submissionId, storageId, storageUrl } = await t.run(async (ctx) => {
            const storageId = await ctx.storage.store(new Blob(['photo'], { type: 'image/jpeg' }));
            const submissionId = await ctx.db.insert('submissions', { ...capture, photos: ['images/123-native-shop.jpg'], creatorId: ids.agent, status: 'submitted' });
            const leadId = await ctx.db.insert('leads', { submissionId, source: 'direct', status: 'new', createdAt: NOW });
            return { leadId, submissionId, storageId, storageUrl: await ctx.storage.getUrl(storageId) };
        });
        expect((await agent.query(api.leads.listForMobileCRM, {})).leads[0].photoUrl).toBeNull();
        await t.run((ctx) => ctx.db.patch(submissionId, { photos: [`convex:${storageId}`] }));
        expect(await agent.query(api.leads.getDetailForMobileCRM, { id: leadId })).toMatchObject({
            photoUrl: null, canViewCaptureMedia: true, business: { photos: [`convex:${storageId}`] },
        });
        expect(storageUrl).toBeTruthy();
    });

    it('preserves creator-only read isolation and the unauthenticated empty-read contract', async () => {
        const { t, agent, createFind } = await setup({ role: 'affiliate' });
        const id = await t.withIdentity({ subject: 'other' }).mutation(api.leads.createCommunityFind, find);
        expect((await agent.query(api.leads.listForMobileCRM, {})).leads).toEqual([]);
        expect(await agent.query(api.leads.getDetailForMobileCRM, { id })).toBeNull();
        expect((await t.query(api.leads.listForMobileCRM, {})).leads).toEqual([]);
        expect(await t.query(api.leads.getDetailForMobileCRM, { id })).toBeNull();
        await expect(createFind()).rejects.toThrow();
    });
});

describe('visiting a community find', () => {
    it('reserves for 24 hours, exposes the visitor and keeps same-agent retries idempotent', async () => {
        const { ids, agent, other, createFind, row } = await setup();
        const leadId = await createFind();
        const result = await agent.mutation(api.leads.visitCommunityFind, { leadId });
        expect(result).toEqual({ leadId, claimExpiresAt: NOW + DAY });
        vi.setSystemTime(NOW + 1000);
        expect(await agent.mutation(api.leads.visitCommunityFind, { leadId })).toEqual(result);
        expect(await row(leadId)).toMatchObject({ claimedByCreatorId: ids.agent, claimedAt: NOW, claimExpiresAt: NOW + DAY });
        expect(await agent.query(api.leads.getDetailForMobileCRM, { id: leadId })).toMatchObject({
            claimedBy: { creatorId: String(ids.agent), displayName: 'Jun S.', isMine: true }, claimExpiresAt: NOW + DAY,
        });
        expect((await other.query(api.leads.listForMobileCRM, {})).leads[0].claimedBy?.isMine).toBe(false);
        await expect(other.mutation(api.leads.visitCommunityFind, { leadId })).rejects.toThrow('already visiting');
    });

    it('lets only one agent acquire a shop when visits race', async () => {
        const { agent, other, createFind } = await setup();
        const leadId = await createFind();
        const results = await Promise.allSettled([
            agent.mutation(api.leads.visitCommunityFind, { leadId }), other.mutation(api.leads.visitCommunityFind, { leadId }),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    });

    it('hides an expired claim and allows a different agent to acquire it at expiry', async () => {
        const { ids, agent, other, createFind, row } = await setup();
        const leadId = await createFind();
        await agent.mutation(api.leads.visitCommunityFind, { leadId });
        vi.setSystemTime(NOW + DAY);
        expect(await other.query(api.leads.getDetailForMobileCRM, { id: leadId })).toMatchObject({ claimedBy: null, claimExpiresAt: null });
        expect(await other.mutation(api.leads.visitCommunityFind, { leadId })).toEqual({ leadId, claimExpiresAt: NOW + 2 * DAY });
        expect((await row(leadId))?.claimedByCreatorId).toBe(ids.other);
    });

    it.each([{ status: 'lost' }, { status: 'converted' }, { source: 'website' }, { businessWebsite: 'https://shop.example.com' }])(
        'rejects shops that cannot be visited: %j', async (patch) => {
            const { t, agent, createFind } = await setup();
            const leadId = await createFind();
            await t.run((ctx) => ctx.db.patch(leadId, patch));
            await expect(agent.mutation(api.leads.visitCommunityFind, { leadId })).rejects.toThrow();
        },
    );
});

describe('community finds through legacy CRM mutations', () => {
    it('blocks other and uncertified accounts from changing or removing an unclaimed find', async () => {
        const { t, ids, agent, other, createFind, row } = await setup();
        const id = await createFind();
        const original = await row(id);
        for (const caller of [other, t]) {
            await expect(caller.mutation(api.leads.updateStatus, { id, status: 'lost' })).rejects.toThrow();
            await expect(caller.mutation(api.leads.update, { id, name: 'Takeover', status: 'converted' })).rejects.toThrow();
            await expect(caller.mutation(api.leads.remove, { id })).rejects.toThrow();
        }
        await t.run((ctx) => ctx.db.patch(ids.agent, { certifiedAt: undefined }));
        await expect(agent.mutation(api.leads.updateStatus, { id, status: 'lost' })).rejects.toThrow();
        await expect(agent.mutation(api.leads.update, { id, message: 'Uncertified update' })).rejects.toThrow();
        await expect(agent.mutation(api.leads.remove, { id })).rejects.toThrow();
        expect(await row(id)).toEqual(original);
    });

    it('protects an active visitor from the original spotter and protects spotter ownership from deletion by a visitor', async () => {
        const { agent, other, createFind, row } = await setup();
        const id = await createFind();
        await other.mutation(api.leads.visitCommunityFind, { leadId: id });
        await expect(agent.mutation(api.leads.updateStatus, { id, status: 'lost' })).rejects.toThrow();
        await expect(agent.mutation(api.leads.update, { id, message: 'Interfere' })).rejects.toThrow();
        await expect(agent.mutation(api.leads.remove, { id })).rejects.toThrow();
        await expect(other.mutation(api.leads.remove, { id })).rejects.toThrow('original spotter');
        await other.mutation(api.leads.updateStatus, { id, status: 'contacted' });
        await other.mutation(api.leads.update, { id, message: 'Owner asked me to return tomorrow' });
        expect(await row(id)).toMatchObject({ status: 'contacted', message: 'Owner asked me to return tomorrow' });
        expect(await agent.query(api.leads.getDetailForMobileCRM, { id })).toMatchObject({ canUpdateStatus: false, canMarkConverted: false });
        expect(await other.query(api.leads.getDetailForMobileCRM, { id })).toMatchObject({ canUpdateStatus: true, canMarkConverted: false });
    });

    it('requires actual capture to convert a find and keeps completed finds immutable to agents', async () => {
        const { t, ids, agent, createFind, row } = await setup();
        const id = await createFind();
        await expect(agent.mutation(api.leads.updateStatus, { id, status: 'converted' })).rejects.toThrow('Complete the shop capture');
        await expect(agent.mutation(api.leads.update, { id, status: 'converted' })).rejects.toThrow('Complete the shop capture');
        const draftId = await agent.mutation(api.submissions.create, { ...capture, creatorId: ids.agent, prospectLeadId: id });
        await agent.mutation(api.submissions.submit, { id: draftId });
        const converted = await row(id);
        await expect(agent.mutation(api.leads.updateStatus, { id, status: 'new' })).rejects.toThrow();
        await expect(agent.mutation(api.leads.update, { id, name: 'Replace owner' })).rejects.toThrow();
        await expect(agent.mutation(api.leads.remove, { id })).rejects.toThrow();
        expect(await row(id)).toEqual(converted);
        expect(await agent.query(api.leads.getDetailForMobileCRM, { id })).toMatchObject({ canUpdateStatus: false });
        expect((await t.run((ctx) => ctx.db.get(draftId)))?.status).toBe('submitted');
    });

    it('allows the certified spotter to edit or remove an unclaimed find and retains operational admin access', async () => {
        const { t, agent, createFind, row } = await setup();
        const id = await createFind();
        await agent.mutation(api.leads.update, { id, message: 'Closes at 7' });
        await agent.mutation(api.leads.updateStatus, { id, status: 'contacted' });
        expect(await row(id)).toMatchObject({ message: 'Closes at 7', status: 'contacted' });
        await agent.mutation(api.leads.remove, { id });
        expect(await row(id)).toBeNull();
        await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active' }));
        const second = await agent.mutation(api.leads.createCommunityFind, { ...find, clientRequestId: 'find-request-002' });
        const admin = t.withIdentity({ subject: 'admin' });
        await admin.mutation(api.leads.updateStatus, { id: second, status: 'lost' });
        await admin.mutation(api.leads.update, { id: second, message: 'Removed from review' });
        await admin.mutation(api.leads.remove, { id: second });
        expect(await row(second)).toBeNull();
    });
});

describe('capturing a community find', () => {
    it('requires community captures to start as drafts so submission conversion cannot be bypassed', async () => {
        const { t, ids, agent, createFind, row } = await setup();
        const leadId = await createFind();
        await expect(agent.mutation(api.submissions.create, {
            ...capture, creatorId: ids.agent, prospectLeadId: leadId, status: 'submitted',
        })).rejects.toThrow('as a draft');
        expect(await t.run((ctx) => ctx.db.query('submissions').collect())).toEqual([]);
        expect(await row(leadId)).toMatchObject({ status: 'new', spottedByCreatorId: ids.agent });
    });
    it('converts the existing lead, preserves the spotter, releases the visit and creates no duplicate', async () => {
        const { t, ids, other, createFind, row, all } = await setup();
        const leadId = await createFind();
        await other.mutation(api.leads.visitCommunityFind, { leadId });
        const id = await other.mutation(api.submissions.create, { ...capture, creatorId: ids.other, prospectLeadId: leadId });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ prospectLeadId: leadId, status: 'draft' });
        await other.mutation(api.submissions.submit, { id });
        await other.mutation(api.submissions.submit, { id });
        expect(await all()).toHaveLength(1);
        expect(await row(leadId)).toMatchObject({
            source: 'community', status: 'converted', submissionId: id, creatorId: ids.other,
            spottedByCreatorId: ids.agent, spottedAt: NOW, communityPhotoUrl: find.photoUrl,
        });
        expect((await row(leadId))?.claimedByCreatorId).toBeUndefined();
        expect((await row(leadId))?.claimExpiresAt).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.get(ids.other))).not.toHaveProperty('totalEarnings');
    });

    it('blocks a conflicting draft link instead of silently inserting an unlinked interview', async () => {
        const { t, ids, agent, other, createFind } = await setup();
        const leadId = await createFind();
        await other.mutation(api.leads.visitCommunityFind, { leadId });
        await expect(agent.mutation(api.submissions.create, { ...capture, creatorId: ids.agent, prospectLeadId: leadId })).rejects.toThrow('already visiting');
        expect(await t.run((ctx) => ctx.db.query('submissions').collect())).toHaveLength(0);
    });

    it('rechecks reservation ownership on submit and retains the draft on conflict', async () => {
        const { t, ids, agent, other, createFind, all } = await setup();
        const leadId = await createFind();
        await agent.mutation(api.leads.visitCommunityFind, { leadId });
        const id = await agent.mutation(api.submissions.create, { ...capture, creatorId: ids.agent, prospectLeadId: leadId });
        vi.setSystemTime(NOW + DAY + 1);
        await other.mutation(api.leads.visitCommunityFind, { leadId });
        await expect(agent.mutation(api.submissions.submit, { id })).rejects.toThrow('already visiting');
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ status: 'draft' });
        expect(await all()).toHaveLength(1);
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('does not duplicate a find when another interview completes before an old draft submits', async () => {
        const { t, ids, agent, other, createFind, all } = await setup();
        const leadId = await createFind();
        const oldDraft = await agent.mutation(api.submissions.create, { ...capture, creatorId: ids.agent, prospectLeadId: leadId });
        const winningDraft = await other.mutation(api.submissions.create, { ...capture, creatorId: ids.other, prospectLeadId: leadId });
        await other.mutation(api.submissions.submit, { id: winningDraft });
        await expect(agent.mutation(api.submissions.submit, { id: oldDraft })).rejects.toThrow('already been interviewed');
        expect(await all()).toHaveLength(1);
        expect(await t.run((ctx) => ctx.db.get(oldDraft))).toMatchObject({ status: 'draft' });
    });

    it('keeps the legacy Outscraper capture path and normal customer-inquiry isolation', async () => {
        const { t, ids, agent, all } = await setup({ certifiedAt: undefined });
        const { legacy, inquiry } = await t.run(async (ctx) => ({
            legacy: await ctx.db.insert('leads', { source: 'outscraper', businessName: 'Scraped shop', status: 'new', createdAt: NOW }),
            inquiry: await ctx.db.insert('leads', { source: 'website', name: 'A customer', status: 'new', createdAt: NOW }),
        }));
        const id = await agent.mutation(api.submissions.create, { ...capture, creatorId: ids.agent, prospectLeadId: legacy });
        await agent.mutation(api.submissions.submit, { id });
        expect(await all()).toHaveLength(2);
        const unlinked = await agent.mutation(api.submissions.create, { ...capture, creatorId: ids.agent, prospectLeadId: inquiry });
        expect((await t.run((ctx) => ctx.db.get(unlinked)))?.prospectLeadId).toBeUndefined();
    });
});
