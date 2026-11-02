import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './submissions.ts': () => import('../../convex/submissions'),
    './generatedWebsites.ts': () => import('../../convex/generatedWebsites'),
    './websiteContent.ts': () => import('../../convex/websiteContent'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
};

afterEach(() => vi.unstubAllEnvs());

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'capturer', email: 'capturer@example.com', status: 'active', role: 'creator' });
        await ctx.db.insert('creators', { clerkId: 'other', email: 'other@example.com', status: 'active', role: 'creator' });
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', status: 'active', role: 'admin' });
        const ownerId = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.com', createdAt: 1 });
        const submissionId = await ctx.db.insert('submissions', {
            creatorId, businessName: 'Nena Store', businessType: 'Shop', ownerName: 'Private owner', ownerPhone: '09171234567',
            ownerEmail: 'owner@example.com', address: 'Main Street', city: 'Manila', status: 'draft', amount: 2999,
            photos: ['https://private.example.com/original.jpg'], videoUrl: 'https://private.example.com/interview.mp4',
            transcript: 'Private interview text',
        });
        await ctx.db.insert('websiteOwnerships', { businessOwnerId: ownerId, submissionId, role: 'owner', claimedAt: 1 });
        const websiteId = await ctx.db.insert('generatedWebsites', { submissionId, status: 'draft', htmlContent: '<html>preview</html>', extractedContent: { interview: 'private' } });
        await ctx.db.insert('websiteContent', { websiteId, submissionId, businessName: 'Nena Store', tagline: 'Draft', aboutText: 'Private draft', updatedAt: 1 });
        await ctx.db.insert('paymentTokens', { submissionId, token: 'receipt-capability', referenceCode: 'ND-TEST', amount: 2999, status: 'pending', createdAt: 1, expiresAt: Date.now() + 86400000 });
        return { creatorId, ownerId, submissionId, websiteId };
    });
    return { t, ids, capturer: t.withIdentity({ subject: 'capturer' }), other: t.withIdentity({ subject: 'other' }), admin: t.withIdentity({ subject: 'admin' }), owner: t.withIdentity({ subject: 'owner' }) };
}

describe('private capture query boundaries', () => {
    it('denies originals and draft build data to anonymous users and other agents through every direct read', async () => {
        const { t, other, ids } = await setup();
        for (const caller of [t, other]) {
            expect(await caller.query(api.submissions.getById, { id: ids.submissionId })).toBeNull();
            expect(await caller.query(api.generatedWebsites.getBySubmissionId, { submissionId: ids.submissionId })).toBeNull();
            expect(await caller.query(api.websiteContent.getByWebsiteId, { websiteId: ids.websiteId })).toBeNull();
            expect(await caller.query(api.websiteContent.getBySubmissionId, { submissionId: ids.submissionId })).toBeNull();
            expect(await caller.query(api.websiteContent.getDirectBySubmissionId, { submissionId: ids.submissionId })).toBeNull();
        }
        expect(await t.query(api.submissions.getDraftByCreatorId, { creatorId: ids.creatorId })).toBeNull();
        await expect(other.query(api.submissions.getDraftByCreatorId, { creatorId: ids.creatorId })).rejects.toThrow('own creator account');
    });

    it('preserves the capture agent, admin and linked business owner read paths', async () => {
        const { capturer, admin, owner, ids } = await setup();
        for (const caller of [capturer, admin, owner]) {
            expect((await caller.query(api.submissions.getById, { id: ids.submissionId }))?.transcript).toBe('Private interview text');
            expect((await caller.query(api.generatedWebsites.getBySubmissionId, { submissionId: ids.submissionId }))?.extractedContent).toEqual({ interview: 'private' });
            expect((await caller.query(api.websiteContent.getByWebsiteId, { websiteId: ids.websiteId }))?.aboutText).toBe('Private draft');
        }
        expect((await capturer.query(api.submissions.getDraftByCreatorId, { creatorId: ids.creatorId }))?._id).toBe(ids.submissionId);
    });

    it('requires the configured server capability for internal pipeline, transcription and email reads', async () => {
        vi.stubEnv('INTERNAL_API_SECRET', 'test-server-only-capability');
        const { t, ids } = await setup();
        for (const internalSecret of ['', 'true', 'wrong-capability']) {
            expect(await t.query(api.submissions.getById, { id: ids.submissionId, internalSecret })).toBeNull();
            expect(await t.query(api.generatedWebsites.getBySubmissionId, { submissionId: ids.submissionId, internalSecret })).toBeNull();
        }
        const internalSecret = 'test-server-only-capability';
        expect((await t.query(api.submissions.getById, { id: ids.submissionId, internalSecret }))?.photos).toHaveLength(1);
        expect((await t.query(api.generatedWebsites.getBySubmissionId, { submissionId: ids.submissionId, internalSecret }))?.htmlContent).toContain('preview');
        expect((await t.query(api.websiteContent.getBySubmissionId, { submissionId: ids.submissionId, internalSecret }))?.aboutText).toBe('Private draft');
        vi.stubEnv('INTERNAL_API_SECRET', '');
        expect(await t.query(api.submissions.getById, { id: ids.submissionId, internalSecret })).toBeNull();
    });

    it('keeps receipt access token-scoped and excludes owner contact and originals', async () => {
        const { t, ids } = await setup();
        expect(await t.query(api.paymentTokens.getSubmissionByToken, { token: 'guessed-id' })).toBeNull();
        const receipt = await t.query(api.paymentTokens.getSubmissionByToken, { token: 'receipt-capability' });
        expect(receipt).toMatchObject({ businessName: 'Nena Store', amount: 2999, status: 'draft' });
        for (const field of ['photos', 'videoUrl', 'audioUrl', 'transcript', 'ownerName', 'ownerEmail', 'ownerPhone', 'creatorId', 'websiteContent']) {
            expect(receipt).not.toHaveProperty(field);
        }
        expect(receipt?.websiteUrl).toBeUndefined();
        const token = await t.run(ctx => ctx.db.query('paymentTokens').first());
        await t.run(ctx => ctx.db.patch(token!._id, { status: 'cancelled' }));
        expect(await t.query(api.paymentTokens.getSubmissionByToken, { token: 'receipt-capability' })).toBeNull();
        expect(await t.query(api.submissions.getById, { id: ids.submissionId })).toBeNull();
    });

    it('public rendering exposes only published HTML and stops serving a site when taken offline', async () => {
        const { t, other, ids } = await setup();
        expect(await t.query(api.generatedWebsites.getPublishedBySubmissionId, { submissionId: ids.submissionId })).toBeNull();
        await t.run(ctx => ctx.db.patch(ids.websiteId, { status: 'published', publishedUrl: 'https://nena.sites.tendso.com', htmlContent: '<html>public page</html>' }));
        const page = await other.query(api.generatedWebsites.getPublishedBySubmissionId, { submissionId: ids.submissionId });
        expect(page).toEqual({ htmlContent: '<html>public page</html>', htmlUrl: null, publishedUrl: 'https://nena.sites.tendso.com' });
        expect(await other.query(api.generatedWebsites.getBySubmissionId, { submissionId: ids.submissionId })).toBeNull();
        await t.run(ctx => ctx.db.patch(ids.websiteId, { offlineAt: 1 }));
        expect(await t.query(api.generatedWebsites.getPublishedBySubmissionId, { submissionId: ids.submissionId })).toBeNull();
        expect((await t.query(api.paymentTokens.getSubmissionByToken, { token: 'receipt-capability' }))?.websiteUrl).toBeUndefined();
    });

    it('revokes raw reads from a suspended capturing account', async () => {
        const { t, capturer, ids } = await setup();
        await t.run(ctx => ctx.db.patch(ids.creatorId, { status: 'suspended' }));
        expect(await capturer.query(api.submissions.getById, { id: ids.submissionId })).toBeNull();
        expect(await capturer.query(api.generatedWebsites.getBySubmissionId, { submissionId: ids.submissionId })).toBeNull();
    });

    it('keeps public intake confirmations accurate without exposing capture or owner data', async () => {
        const { t, ids } = await setup();
        expect(await t.query(api.submissions.getIntakeReceiptSummary, { id: ids.submissionId })).toBeNull();
        await t.run(ctx => ctx.db.patch(ids.submissionId, { contentSource: 'owner_intake', amount: 3499, submissionType: 'standard', websiteListPrice: 4999 }));
        const quote = await t.query(api.submissions.getIntakeReceiptSummary, { id: ids.submissionId });
        expect(quote).toMatchObject({ amount: 3499, websiteListPrice: 4999, submissionType: 'standard' });
        for (const field of ['photos', 'transcript', 'videoUrl', 'ownerName', 'ownerEmail', 'ownerPhone', 'creatorId']) {
            expect(quote).not.toHaveProperty(field);
        }
    });

    it('stamps legacy capture provenance before contact correction while retaining genuine inquiry behavior', async () => {
        const { t, capturer, ids } = await setup();
        const { captureLead, inquiry } = await t.run(async ctx => ({
            captureLead: await ctx.db.insert('leads', { source: 'direct', submissionId: ids.submissionId, creatorId: ids.creatorId, name: 'Private owner', phone: '09171234567', status: 'new', createdAt: 1 }),
            inquiry: await ctx.db.insert('leads', { source: 'direct', submissionId: ids.submissionId, creatorId: ids.creatorId, name: 'Customer', phone: '09179876543', message: 'I need a haircut', status: 'new', createdAt: 1 }),
        }));
        await capturer.mutation(api.submissions.update, { id: ids.submissionId, ownerName: 'Corrected owner', ownerPhone: '09179999999' });
        expect((await t.run(ctx => ctx.db.get(captureLead)))?.isCaptureShop).toBe(true);
        expect((await t.run(ctx => ctx.db.get(inquiry)))?.isCaptureShop).toBeUndefined();
    });
});
