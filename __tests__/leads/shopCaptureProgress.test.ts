import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './leads.ts': () => import('../../convex/leads'),
};
const sharedPhoto = 'https://images.example.com/discovery.jpg';
const privatePhoto = 'https://images.example.com/private-owner.jpg';
const privateWebsite = 'https://preview.example.com/private-build';
const publishedWebsite = 'https://shop.sites.tendso.com';

async function setup(source = 'community') {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const actors = {} as Record<'capturer' | 'spotter' | 'visitor' | 'admin', Id<'creators'>>;
        for (const subject of ['capturer', 'spotter', 'visitor', 'admin'] as const) {
            actors[subject] = await ctx.db.insert('creators', {
                clerkId: subject, email: `${subject}@example.com`, firstName: subject,
                role: subject === 'admin' ? 'admin' : 'creator', certifiedAt: 1,
            });
        }
        const submissionId = await ctx.db.insert('submissions', {
            creatorId: actors.capturer, businessName: 'Nena Store', businessType: 'Sari-sari',
            ownerName: 'Nena', ownerPhone: '09171234567', address: '12 Rizal Street', city: 'Marikina',
            coordinates: { lat: 14.65, lng: 121.1 }, photos: [privatePhoto],
            videoUrl: 'https://media.example.com/private-interview.mp4', transcript: 'Private transcript',
            businessDescription: 'Private interview-derived draft description',
            websiteUrl: privateWebsite, status: 'submitted',
        });
        const leadId = await ctx.db.insert('leads', {
            creatorId: actors.spotter, spottedByCreatorId: actors.spotter,
            claimedByCreatorId: actors.visitor, claimedAt: Date.now(), claimExpiresAt: Date.now() + 60_000,
            submissionId, source, status: 'converted', createdAt: 1,
            businessName: 'Nena Store', communityPhotoUrl: sharedPhoto, needsWebsite: true,
        });
        return { ...actors, submissionId, leadId };
    });
    const visitor = t.withIdentity({ subject: 'visitor' });
    const detail = () => visitor.query(api.leads.getDetailForMobileCRM, { id: ids.leadId });
    const feed = () => visitor.query(api.leads.listForMobileCRM, {});
    const map = () => visitor.query(api.leads.listForMap, {});
    return { t, ids, visitor, detail, feed, map };
}

describe('automatic shared shop capture progress', () => {
    it('attributes the actual linked capture automatically and retains the discovery cover', async () => {
        const { ids, detail, feed, map } = await setup();
        const expected = {
            hasSubmittedCapture: true, captureStatus: 'submitted', publicWebsiteUrl: null,
            interviewedBy: { creatorId: String(ids.capturer), displayName: 'capturer' },
        };
        expect(await detail()).toMatchObject({
            ...expected, photoUrl: sharedPhoto, canViewCaptureMedia: false, canUpdateStatus: false,
            spottedBy: { creatorId: String(ids.spotter) },
            business: { photos: [], businessDescription: null, websiteUrl: null },
            interviewers: [{ creatorId: String(ids.capturer), creatorName: 'capturer', submissionStatus: 'submitted' }],
        });
        expect((await feed()).leads[0]).toMatchObject({ ...expected, photoUrl: sharedPhoto, interviewerCount: 1 });
        expect((await map())[0]).toMatchObject(expected);
        for (const payload of [await detail(), await feed(), await map()]) {
            const text = JSON.stringify(payload);
            for (const secret of [privatePhoto, privateWebsite, 'private-interview', 'Private transcript', 'Private interview-derived']) {
                expect(text).not.toContain(secret);
            }
        }
    });

    it('does not infer interviews from drafts or other shops sharing an owner phone', async () => {
        const { t, ids, detail, feed } = await setup();
        await t.run(async (ctx) => {
            const submission = await ctx.db.get(ids.submissionId);
            await ctx.db.insert('submissions', {
                creatorId: ids.visitor, businessName: 'Different Shop', businessType: 'Other',
                ownerName: 'Different owner', ownerPhone: submission!.ownerPhone,
                address: 'Other street', city: 'Other city', status: 'submitted',
            });
            await ctx.db.patch(ids.submissionId, { status: 'draft' });
        });
        expect(await detail()).toMatchObject({ hasSubmittedCapture: false, captureStatus: null, interviewedBy: null, interviewers: [] });
        expect((await feed()).leads[0]).toMatchObject({ hasSubmittedCapture: false, interviewerCount: 0 });
        await t.run((ctx) => ctx.db.patch(ids.submissionId, { status: 'rejected' }));
        expect(await detail()).toMatchObject({ hasSubmittedCapture: true, captureStatus: 'rejected', interviewerCount: 1 });
    });

    it.each(['submitted', 'in_review', 'approved', 'rejected', 'website_generated', 'paid'])('derives %s progress from the actual submission', async (status) => {
        const { t, ids, detail } = await setup();
        await t.run((ctx) => ctx.db.patch(ids.submissionId, { status }));
        expect(await detail()).toMatchObject({ hasSubmittedCapture: true, captureStatus: status, needsWebsite: false });
    });

    it.each(['community', 'outscraper'])('denies every agent manual status edits for %s shops, including claimed or spotted shops', async (source) => {
        const { t, ids, detail } = await setup(source);
        for (const subject of ['capturer', 'spotter', 'visitor']) {
            const actor = t.withIdentity({ subject });
            await expect(actor.mutation(api.leads.updateStatus, { id: ids.leadId, status: 'new' })).rejects.toThrow('automatically');
            await expect(actor.mutation(api.leads.update, { id: ids.leadId, status: 'lost', phone: 'replacement' })).rejects.toThrow('automatically');
        }
        expect(await detail()).toMatchObject({ canUpdateStatus: false, canMarkConverted: false, lead: { status: 'converted' } });
        const admin = t.withIdentity({ subject: 'admin' });
        await admin.mutation(api.leads.updateStatus, { id: ids.leadId, status: 'lost' });
        expect(await admin.query(api.leads.getDetailForMobileCRM, { id: ids.leadId })).toMatchObject({ canUpdateStatus: true, lead: { status: 'lost' } });
    });

    it('preserves authorized contact edits without allowing status to piggyback on them', async () => {
        const { t, ids } = await setup();
        await t.run((ctx) => ctx.db.patch(ids.leadId, { submissionId: undefined, claimedByCreatorId: undefined, status: 'new' }));
        const spotter = t.withIdentity({ subject: 'spotter' });
        await spotter.mutation(api.leads.update, { id: ids.leadId, phone: '09170000000' });
        expect(await t.run((ctx) => ctx.db.get(ids.leadId))).toMatchObject({ phone: '09170000000' });
        await expect(spotter.mutation(api.leads.update, { id: ids.leadId, phone: '09179999999', status: 'lost' })).rejects.toThrow('automatically');
        expect(await t.run((ctx) => ctx.db.get(ids.leadId))).toMatchObject({ phone: '09170000000' });
    });

    it('locks legacy direct capture shops while preserving genuine customer-inquiry CRM management', async () => {
        const { t, ids } = await setup('direct');
        await t.run((ctx) => ctx.db.patch(ids.leadId, {
            creatorId: ids.capturer, name: 'Nena', phone: '09171234567',
        }));
        const actor = t.withIdentity({ subject: 'capturer' });
        expect(await actor.query(api.leads.getDetailForMobileCRM, { id: ids.leadId })).toMatchObject({
            isCaptureShop: true, canUpdateStatus: false,
        });
        await expect(actor.mutation(api.leads.updateStatus, { id: ids.leadId, status: 'lost' })).rejects.toThrow('automatically');
        await t.run((ctx) => ctx.db.patch(ids.leadId, {
            name: 'A customer', phone: '09170000000', message: 'I would like to order',
        }));
        expect(await actor.query(api.leads.getDetailForMobileCRM, { id: ids.leadId })).toMatchObject({
            isCaptureShop: false, canUpdateStatus: true,
        });
        await actor.mutation(api.leads.updateStatus, { id: ids.leadId, status: 'contacted' });
        expect(await t.run((ctx) => ctx.db.get(ids.leadId))).toMatchObject({ status: 'contacted' });
        await expect(t.withIdentity({ subject: 'visitor' }).mutation(api.leads.updateStatus, {
            id: ids.leadId, status: 'lost',
        })).rejects.toThrow('Only the assigned creator');
    });

    it('preserves explicit server capture provenance even if owner contact details change later', async () => {
        const { t, ids, detail } = await setup('direct');
        await t.run((ctx) => ctx.db.patch(ids.leadId, {
            creatorId: ids.capturer, isCaptureShop: true, name: 'Owner name before correction',
        }));
        expect(await detail()).toMatchObject({ isCaptureShop: true, canUpdateStatus: false });
        await expect(t.withIdentity({ subject: 'capturer' }).mutation(api.leads.update, {
            id: ids.leadId, status: 'lost',
        })).rejects.toThrow('automatically');
    });

    it('cannot launder a legacy shop into manually managed CRM by first changing its owner-derived lead fields', async () => {
        const { t, ids } = await setup('direct');
        await t.run((ctx) => ctx.db.patch(ids.leadId, {
            creatorId: ids.capturer, name: 'Nena', phone: '09171234567',
        }));
        const actor = t.withIdentity({ subject: 'capturer' });
        await actor.mutation(api.leads.update, {
            id: ids.leadId, name: 'Corrected contact', phone: '09170000000', message: 'Updated contact details',
        });
        expect(await t.run((ctx) => ctx.db.get(ids.leadId))).toMatchObject({ isCaptureShop: true });
        expect(await actor.query(api.leads.getDetailForMobileCRM, { id: ids.leadId })).toMatchObject({ isCaptureShop: true, canUpdateStatus: false });
        await expect(actor.mutation(api.leads.updateStatus, { id: ids.leadId, status: 'lost' })).rejects.toThrow('automatically');
    });
});

describe('shared published website access', () => {
    it('exposes the generated site only after genuine publication, consistently in list/detail/map', async () => {
        const { t, ids, detail, feed, map } = await setup();
        const websiteId = await t.run((ctx) => ctx.db.insert('generatedWebsites', {
            submissionId: ids.submissionId, status: 'draft', publishedUrl: privateWebsite,
        }));
        for (const payload of [await detail(), (await feed()).leads[0], (await map())[0]]) {
            expect(payload).toMatchObject({ publicWebsiteUrl: null, websiteUrl: null, hasLiveWebsite: false });
        }
        await t.run((ctx) => ctx.db.patch(websiteId, { status: 'published', publishedUrl: publishedWebsite }));
        for (const payload of [await detail(), (await feed()).leads[0], (await map())[0]]) {
            expect(payload).toMatchObject({ publicWebsiteUrl: publishedWebsite, websiteUrl: publishedWebsite, hasLiveWebsite: true });
        }
        expect(await detail()).toMatchObject({ business: { websiteUrl: publishedWebsite, photos: [] } });
        await t.run((ctx) => ctx.db.patch(websiteId, { offlineAt: Date.now() }));
        expect(await detail()).toMatchObject({ publicWebsiteUrl: null, websiteUrl: null, hasLiveWebsite: false, hasSubmittedCapture: true });
    });

    it.each([
        { status: 'draft' as const, publishedUrl: publishedWebsite },
        { publishedUrl: publishedWebsite },
        { status: 'published' as const, publishedUrl: 'javascript:alert(1)' },
        { status: 'published' as const, publishedUrl: 'https://user:secret@example.com' },
        { status: 'published' as const },
    ])('does not confuse saved/private/unsafe URLs with a public site: %j', async (website) => {
        const { t, ids, detail } = await setup();
        await t.run((ctx) => ctx.db.insert('generatedWebsites', { submissionId: ids.submissionId, ...website }));
        expect(await detail()).toMatchObject({ publicWebsiteUrl: null, websiteUrl: null, hasLiveWebsite: false });
    });

    it('does not embed an explicitly unpublished site or an external business URL as a generated site', async () => {
        const { t, ids, detail } = await setup();
        await t.run(async (ctx) => {
            await ctx.db.insert('generatedWebsites', { submissionId: ids.submissionId, status: 'published', publishedUrl: publishedWebsite });
            await ctx.db.patch(ids.submissionId, { status: 'unpublished' });
            await ctx.db.patch(ids.leadId, { businessWebsite: 'https://external-business.example.com' });
        });
        expect(await detail()).toMatchObject({ publicWebsiteUrl: null, websiteUrl: 'https://external-business.example.com', hasLiveWebsite: true });
    });

    it('does not revive an older published row when the latest publication is offline', async () => {
        const { t, ids, detail } = await setup();
        await t.run(async (ctx) => {
            await ctx.db.insert('generatedWebsites', { submissionId: ids.submissionId, status: 'published', publishedUrl: publishedWebsite });
            await ctx.db.insert('generatedWebsites', { submissionId: ids.submissionId, status: 'published', publishedUrl: publishedWebsite, offlineAt: Date.now() });
        });
        expect(await detail()).toMatchObject({ publicWebsiteUrl: null, websiteUrl: null, hasLiveWebsite: false });
    });
});
