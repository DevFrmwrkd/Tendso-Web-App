import { convexTest } from 'convex-test';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './submissions.ts': () => import('../../convex/submissions'),
};

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const creator = await ctx.db.insert('creators', { clerkId: 'creator', email: 'creator@example.com', role: 'creator' });
        const affiliate = await ctx.db.insert('creators', { clerkId: 'affiliate', email: 'affiliate@example.com', role: 'affiliate', firstName: 'Alex', affiliateHandle: 'alex-shops', affiliateDisplayName: 'Alex Websites' });
        const legacy = await ctx.db.insert('creators', { clerkId: 'legacy', email: 'legacy@example.com' });
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin' });
        await ctx.db.insert('creators', { clerkId: 'staff', email: 'staff@example.com', role: 'staff' });
        await ctx.db.insert('creators', { clerkId: 'suspended-admin', email: 'suspended@example.com', role: 'admin', status: 'suspended' });
        await ctx.db.insert('creators', { clerkId: 'deleted-admin', email: 'deleted@example.com', role: 'admin', isDeleted: true });
        const submission = await ctx.db.insert('submissions', {
            creatorId: affiliate, affiliateHandle: 'alex-shops', businessName: 'Corner Shop', businessType: 'Salon',
            ownerName: 'Owner', ownerPhone: '09171234567', ownerEmail: 'private@example.com',
            address: 'Main Street', city: 'Manila', status: 'submitted', creatorPayout: 1000,
        });
        return { creator, affiliate, legacy, submission };
    });
    return { t, ids, admin: t.withIdentity({ subject: 'admin' }) };
}

describe('private submission reads', () => {
    it.each([null, 'creator', 'affiliate', 'legacy', 'staff', 'suspended-admin', 'deleted-admin'])
    ('denies the admin list and review reads for %s', async (subject) => {
        const { t, ids } = await setup();
        const caller = subject ? t.withIdentity({ subject }) : t;
        const error = subject ? 'admin access required' : 'Not authenticated';
        await expect(caller.query(api.submissions.getAll)).rejects.toThrow(error);
        await expect(caller.query(api.submissions.getAllWithCreator)).rejects.toThrow(error);
        await expect(caller.query(api.submissions.getByStatus, { status: 'submitted' })).rejects.toThrow(error);
        await expect(caller.query(api.submissions.getByIdWithCreator, { id: ids.submission })).rejects.toThrow(error);
    });

    it('lets admins read submissions with the affiliate identity needed by the queue and review', async () => {
        const { admin, ids } = await setup();
        const expected = { affiliateHandle: 'alex-shops', creatorId: ids.affiliate, creator: { role: 'affiliate', affiliateHandle: 'alex-shops', affiliateDisplayName: 'Alex Websites' } };
        expect(await admin.query(api.submissions.getAllWithCreator)).toMatchObject([expected]);
        expect(await admin.query(api.submissions.getByIdWithCreator, { id: ids.submission })).toMatchObject(expected);
        expect(await admin.query(api.submissions.getAll)).toHaveLength(1);
        expect(await admin.query(api.submissions.getByStatus, { status: 'submitted' })).toHaveLength(1);
    });

    it('preserves own submission reads for creators, affiliates and legacy mobile accounts', async () => {
        const { t, ids, admin } = await setup();
        for (const subject of ['creator', 'affiliate', 'legacy'] as const) {
            const caller = t.withIdentity({ subject });
            const own = await caller.query(api.submissions.getByCreatorId, { creatorId: ids[subject] });
            expect(own).toHaveLength(subject === 'affiliate' ? 1 : 0);
            const otherId = subject === 'affiliate' ? ids.creator : ids.affiliate;
            await expect(caller.query(api.submissions.getByCreatorId, { creatorId: otherId })).rejects.toThrow('your own account');
        }
        expect(await admin.query(api.submissions.getByCreatorId, { creatorId: ids.affiliate })).toHaveLength(1);
        await expect(t.query(api.submissions.getByCreatorId, { creatorId: ids.affiliate })).rejects.toThrow('Not authenticated');
    });

    it('requires ownership for capture edits, deletion and payout requests while keeping admin content edits', async () => {
        const { t, ids, admin } = await setup();
        const ownId = await t.run((ctx) => ctx.db.insert('submissions', {
            creatorId: ids.creator, businessName: 'Own Shop', businessType: 'Salon', ownerName: 'Owner',
            ownerPhone: '09171234567', address: 'Main Street', city: 'Manila', status: 'draft',
        }));
        const foreign = t.withIdentity({ subject: 'legacy' });
        for (const caller of [t, foreign]) {
            await expect(caller.mutation(api.submissions.update, { id: ownId, businessName: 'Forged' })).rejects.toThrow();
            await expect(caller.mutation(api.submissions.setDomainTier, { id: ownId, submissionType: 'standard' })).rejects.toThrow();
            await expect(caller.mutation(api.submissions.remove, { id: ownId })).rejects.toThrow();
            await expect(caller.mutation(api.submissions.requestPayout, { id: ownId })).rejects.toThrow();
        }
        expect((await t.run((ctx) => ctx.db.get(ownId)))?.businessName).toBe('Own Shop');
        const creator = t.withIdentity({ subject: 'creator' });
        await creator.mutation(api.submissions.update, { id: ownId, businessName: 'Updated Shop' });
        await creator.mutation(api.submissions.setDomainTier, { id: ownId, submissionType: 'standard', sellPrice: 1999 });
        await creator.mutation(api.submissions.requestPayout, { id: ownId });
        expect(await t.run((ctx) => ctx.db.get(ownId))).toMatchObject({ businessName: 'Updated Shop', amount: 1999, creatorPayout: 1000 });
        await admin.mutation(api.submissions.update, { id: ids.submission, websiteUrl: 'https://example.com/affiliate' });
        expect((await t.run((ctx) => ctx.db.get(ids.submission)))?.websiteUrl).toBe('https://example.com/affiliate');
        await creator.mutation(api.submissions.remove, { id: ownId });
        expect(await t.run((ctx) => ctx.db.get(ownId))).toBeNull();
    });

    it('does not let a creator create an already approved or paid submission', async () => {
        const { t, ids } = await setup();
        const creator = t.withIdentity({ subject: 'creator' });
        const fields = { creatorId: ids.creator, businessName: 'New Shop', businessType: 'Salon', ownerName: 'Owner', ownerPhone: '09171234567', address: 'Main Street', city: 'Manila' };
        for (const status of ['in_review', 'approved', 'paid', 'completed', 'website_generated'] as const) {
            await expect(creator.mutation(api.submissions.create, { ...fields, status })).rejects.toThrow('admin access required');
        }
        const draftId = await creator.mutation(api.submissions.create, { ...fields, status: 'draft' });
        expect((await t.run((ctx) => ctx.db.get(draftId)))?.status).toBe('draft');
    });

    it('keeps the internal transcription bridge secret-protected and limited to transcript fields', async () => {
        const { t, ids } = await setup();
        vi.stubEnv('INTERNAL_API_SECRET', 'test-transcription-secret');
        try {
            const args = { id: ids.submission, transcriptionStatus: 'complete' as const, transcript: 'An interview transcript.' };
            await expect(t.mutation(api.submissions.recordTranscriptionFromServer, { ...args, internalSecret: '' })).rejects.toThrow('internal access required');
            await expect(t.mutation(api.submissions.recordTranscriptionFromServer, { ...args, internalSecret: 'wrong' })).rejects.toThrow('internal access required');
            await expect(t.mutation(api.submissions.recordTranscriptionFromServer, { ...args, internalSecret: 'test-transcription-secret', amount: 1 } as never)).rejects.toThrow();
            await t.mutation(api.submissions.recordTranscriptionFromServer, { ...args, internalSecret: 'test-transcription-secret' });
            expect(await t.run((ctx) => ctx.db.get(ids.submission))).toMatchObject({ transcript: args.transcript, transcriptionStatus: 'complete', creatorPayout: 1000, status: 'submitted' });
        } finally { vi.unstubAllEnvs(); }
    });
});
