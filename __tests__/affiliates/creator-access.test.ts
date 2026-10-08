import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './creators.ts': () => import('../../convex/creators'),
    './submissions.ts': () => import('../../convex/submissions'),
    './admin.ts': () => import('../../convex/admin'),
    './approvals.ts': () => import('../../convex/approvals'),
    './knowledge.ts': () => import('../../convex/knowledge'),
    './prospects.ts': () => import('../../convex/prospects'),
    './outscraper.ts': () => import('../../convex/outscraper'),
    './leads.ts': () => import('../../convex/leads'),
    './leadNotes.ts': () => import('../../convex/leadNotes'),
    './aiKeys.ts': () => import('../../convex/aiKeys'),
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const creator = await ctx.db.insert('creators', { clerkId: 'creator', email: 'creator@example.com', role: 'creator', status: 'active', quizPassedAt: 1 });
        const legacy = await ctx.db.insert('creators', { clerkId: 'legacy', email: 'legacy@example.com', status: 'active', quizPassedAt: 1 });
        const affiliate = await ctx.db.insert('creators', { clerkId: 'affiliate', email: 'affiliate@example.com', role: 'affiliate', status: 'active', quizPassedAt: 1, certifiedAt: 2 });
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active', quizPassedAt: 1 });
        await ctx.db.insert('creators', { clerkId: 'staff', email: 'staff@example.com', role: 'staff', status: 'active', quizPassedAt: 1 });
        await ctx.db.insert('creators', { clerkId: 'deleted', email: 'deleted@example.com', role: 'creator', status: 'deleted', isDeleted: true });
        const lead = await ctx.db.insert('leads', { source: 'outscraper', name: 'Shop owner', phone: '09171234567', status: 'new', createdAt: 1 });
        const submission = await ctx.db.insert('submissions', { creatorId: affiliate, businessName: 'Affiliate order', businessType: 'Shop', ownerName: 'Owner', ownerPhone: '09171234567', address: 'Main Street', city: 'Manila', status: 'draft', photos: ['1', '2', '3'] });
        return { creator, legacy, affiliate, lead, submission };
    });
    return { t, ids, affiliate: t.withIdentity({ subject: 'affiliate' }), creator: t.withIdentity({ subject: 'creator' }), admin: t.withIdentity({ subject: 'admin' }) };
}

describe('affiliate separation from field creators', () => {
    it('keeps affiliate, staff, admin and deleted rows out of field-creator totals and Discord approvals', async () => {
        const { t, ids } = await setup();
        const stats = await t.query(api.admin.getDashboardStats);
        expect(stats.totalCreators).toBe(2);
        expect(stats.activeCreators).toBe(2);
        const pending = await t.query(internal.approvals.listPendingCreators);
        expect(pending.map((row) => row._id)).toEqual([ids.creator, ids.legacy]);
        expect(await t.mutation(internal.approvals.claimForPost, { creatorId: ids.affiliate, quizPassedAt: 1 })).toBeNull();
        expect(await t.run(async (ctx) => ctx.db.query('approvalRequests').collect())).toEqual([]);
    });

    it('does not grant affiliate wiki access even when stale certification fields exist', async () => {
        const { affiliate, admin } = await setup();
        expect(await affiliate.query(api.knowledge.canAccessWiki)).toBe(false);
        expect(await admin.query(api.knowledge.canAccessWiki)).toBe(true);
    });

    it('refuses capture and creator pricing for an affiliate, including another creator id', async () => {
        const { affiliate, ids } = await setup();
        const fields = { businessName: 'Shop', businessType: 'Shop', ownerName: 'Owner', ownerPhone: '09171234567', address: 'Main Street', city: 'Manila' };
        for (const creatorId of [ids.affiliate, ids.creator]) {
            await expect(affiliate.mutation(api.submissions.create, { creatorId, ...fields })).rejects.toThrow('creator access required');
            await expect(affiliate.query(api.submissions.getDraftByCreatorId, { creatorId })).rejects.toThrow('creator access required');
            await expect(affiliate.query(api.submissions.getPricingContext, { creatorId })).rejects.toThrow('creator access required');
        }
        await expect(affiliate.mutation(api.submissions.submit, { id: ids.submission })).rejects.toThrow('creator access required');
        await expect(affiliate.mutation(api.submissions.update, { id: ids.submission, photos: ['changed'] })).rejects.toThrow('creator access required');
        await expect(affiliate.mutation(api.submissions.setDomainTier, { id: ids.submission, submissionType: 'standard' })).rejects.toThrow('creator access required');
    });

    it('keeps authenticated creator capture and legacy creator pricing usable', async () => {
        const { t, creator, admin, ids } = await setup();
        const id = await creator.mutation(api.submissions.create, { creatorId: ids.creator, businessName: 'Shop', businessType: 'Shop', ownerName: 'Owner', ownerPhone: '09171234567', address: 'Main Street', city: 'Manila' });
        expect((await creator.query(api.submissions.getDraftByCreatorId, { creatorId: ids.creator }))?._id).toBe(id);
        expect((await t.withIdentity({ subject: 'legacy' }).query(api.submissions.getPricingContext, { creatorId: ids.legacy }))?.basePrice).toBe(999);
        expect(await t.withIdentity({ subject: 'staff' }).query(api.aiKeys.listMyGeminiKeys)).toEqual([]);
        await t.run(async (ctx) => ctx.db.patch(ids.creator, { status: 'suspended' }));
        expect((await admin.query(api.submissions.getCreatorPricingSummary, { creatorId: ids.creator })).rows).toHaveLength(1);
        await expect(admin.query(api.submissions.getCreatorPricingSummary, { creatorId: ids.affiliate })).rejects.toThrow('Affiliate accounts');
    });

    it('tolerates mobile draft and pricing subscriptions before the auth token arrives', async () => {
        const { t, creator, ids } = await setup();
        const draft = await creator.mutation(api.submissions.create, { creatorId: ids.creator, businessName: 'Unfinished interview', businessType: 'Shop', ownerName: 'Owner', ownerPhone: '09171234567', address: 'Main Street', city: 'Manila' });
        expect((await t.query(api.submissions.getDraftByCreatorId, { creatorId: ids.creator }))?._id).toBe(draft);
        expect((await t.query(api.submissions.getPricingContext, { creatorId: ids.creator }))?.basePrice).toBe(999);
        expect(await t.query(api.submissions.getDraftByCreatorId, { creatorId: ids.affiliate })).toBeNull();
        expect(await t.query(api.submissions.getPricingContext, { creatorId: ids.affiliate })).toBeNull();
        expect((await creator.query(api.submissions.getPricingContext, { creatorId: ids.creator }))?.basePrice).toBe(999);
    });

    it('returns empty mobile CRM data and rejects affiliate prospect, notes and BYOK operations', async () => {
        const { affiliate, ids } = await setup();
        expect((await affiliate.query(api.leads.listForMobileCRM, { statusFilter: 'all' })).leads).toEqual([]);
        expect(await affiliate.query(api.leads.listForMap)).toEqual([]);
        expect(await affiliate.query(api.leads.getDetailForMobileCRM, { id: ids.lead })).toBeNull();
        await expect(affiliate.query(api.prospects.searchNearby, { lat: 14.6, lng: 120.98 })).rejects.toThrow('creator access required');
        await expect(affiliate.query(api.prospects.listMyReservations)).rejects.toThrow('creator access required');
        await expect(affiliate.mutation(api.outscraper.claimProspect, { leadId: ids.lead })).rejects.toThrow('creator access required');
        await expect(affiliate.action(api.outscraper.scrapeNearby, { query: 'shops', location: 'Manila' })).rejects.toThrow('creator access required');
        await expect(affiliate.mutation(api.leadNotes.add, { leadId: ids.lead, content: 'I will visit' })).rejects.toThrow('creator access required');
        await expect(affiliate.query(api.aiKeys.listMyGeminiKeys)).rejects.toThrow('creator access required');
        await expect(affiliate.mutation(api.leads.updateStatus, { id: ids.lead, status: 'contacted' })).rejects.toThrow('creator access required');
    });
});
