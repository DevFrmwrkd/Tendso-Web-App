import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './leads.ts': () => import('../../convex/leads'),
};
const originals = ['https://media.example.com/private-owner.jpg', 'images/private-craft.jpg', 'convex:private-location'];
const spotPhoto = 'https://media.example.com/shared-shopfront.jpg';
const approvedCover = 'https://media.example.com/admin-cover.jpg';

async function setup(leadFields: Partial<Doc<'leads'>> = {}) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const creators = {} as Record<'capturer' | 'spotter' | 'teammate' | 'pending' | 'admin', Doc<'creators'>['_id']>;
        for (const subject of ['capturer', 'spotter', 'teammate', 'pending', 'admin'] as const) {
            creators[subject] = await ctx.db.insert('creators', {
                clerkId: subject, email: `${subject}@example.com`, firstName: subject,
                role: subject === 'admin' ? 'admin' : 'creator', status: 'active',
                ...(subject !== 'pending' ? { certifiedAt: 1 } : {}),
            });
        }
        const submissionId = await ctx.db.insert('submissions', {
            creatorId: creators.capturer, businessName: 'Nena Store', businessType: 'Sari-sari',
            ownerName: 'Nena', ownerPhone: '09171234567', address: '12 Rizal Street', city: 'Marikina',
            photos: originals, videoStorageId: 'videos/private-interview.mp4', audioStorageId: 'audio/private-interview.m4a',
            transcript: 'Private interview transcript', status: 'submitted',
        });
        const leadId = await ctx.db.insert('leads', {
            creatorId: creators.spotter, spottedByCreatorId: creators.spotter,
            submissionId, source: 'community', status: 'converted', createdAt: 1,
            businessName: 'Nena Store', businessAddress: '12 Rizal Street', businessCity: 'Marikina',
            ...leadFields,
        });
        return { ...creators, submissionId, leadId };
    });
    return { t, ids };
}

describe('shared shop capture media privacy', () => {
    it.each(['capturer', 'admin'] as const)('allows the %s to read capture photo metadata without promoting it to a shared cover', async (subject) => {
        const { t, ids } = await setup();
        const actor = t.withIdentity({ subject });
        const detail = await actor.query(api.leads.getDetailForMobileCRM, { id: ids.leadId });
        expect(detail).toMatchObject({ photoUrl: null, canViewCaptureMedia: true, business: { photos: originals } });
        const feed = await actor.query(api.leads.listForMobileCRM, {});
        expect(feed.leads[0].photoUrl).toBeNull();
        expect(JSON.stringify(feed)).not.toContain('private-owner.jpg');
        expect(detail?.business).not.toHaveProperty('audioStorageId');
        expect(detail?.business).not.toHaveProperty('videoStorageId');
        expect(detail?.business).not.toHaveProperty('transcript');
    });

    it.each(['spotter', 'teammate', 'pending'] as const)('does not return capture photos or recordings to the %s', async (subject) => {
        const { t, ids } = await setup();
        const actor = t.withIdentity({ subject });
        const detail = await actor.query(api.leads.getDetailForMobileCRM, { id: ids.leadId });
        expect(detail).toMatchObject({ photoUrl: null, canViewCaptureMedia: false, business: { photos: [], ownerName: 'Nena' } });
        const serialized = JSON.stringify(detail);
        for (const secret of [...originals, 'private-interview', 'Private interview transcript']) {
            expect(serialized).not.toContain(secret);
        }
        expect((await actor.query(api.leads.listForMobileCRM, {})).leads[0].photoUrl).toBeNull();
    });

    it.each([
        { communityPhotoUrl: spotPhoto, previewImageUrl: approvedCover, expected: spotPhoto },
        { previewImageUrl: approvedCover, expected: approvedCover },
        { communityPhotoUrl: 'file:///private.jpg', previewImageUrl: approvedCover, expected: approvedCover },
    ])('keeps intentionally shared shop covers available in list and detail (%j)', async ({ expected, ...fields }) => {
        const { t, ids } = await setup(fields);
        const teammate = t.withIdentity({ subject: 'teammate' });
        expect((await teammate.query(api.leads.listForMobileCRM, {})).leads[0].photoUrl).toBe(expected);
        expect(await teammate.query(api.leads.getDetailForMobileCRM, { id: ids.leadId })).toMatchObject({
            photoUrl: expected, canViewCaptureMedia: false, business: { photos: [] },
        });
    });

    it('does not grant capture media access to the original spotter or an active visitor', async () => {
        const { t, ids } = await setup();
        await t.run((ctx) => ctx.db.patch(ids.leadId, {
            claimedByCreatorId: ids.teammate, claimedAt: Date.now(), claimExpiresAt: Date.now() + 60_000,
        }));
        const detail = await t.withIdentity({ subject: 'teammate' }).query(api.leads.getDetailForMobileCRM, { id: ids.leadId });
        expect(detail).toMatchObject({ canViewCaptureMedia: false, business: { photos: [] } });
    });

    it('keeps anonymous CRM reads empty', async () => {
        const { t, ids } = await setup({ communityPhotoUrl: spotPhoto });
        expect((await t.query(api.leads.listForMobileCRM, {})).leads).toEqual([]);
        expect(await t.query(api.leads.getDetailForMobileCRM, { id: ids.leadId })).toBeNull();
    });

    it.each([
        { role: 'affiliate' }, { role: 'owner' }, { role: 'staff' },
        { status: 'suspended' }, { status: 'deleted' }, { isDeleted: true },
    ])('preserves existing read denial for ineligible accounts (%j)', async (changes) => {
        const { t, ids } = await setup();
        await t.run((ctx) => ctx.db.patch(ids.teammate, changes));
        const actor = t.withIdentity({ subject: 'teammate' });
        expect((await actor.query(api.leads.listForMobileCRM, {})).leads).toEqual([]);
        expect(await actor.query(api.leads.getDetailForMobileCRM, { id: ids.leadId })).toBeNull();
    });
});
