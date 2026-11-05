import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
};

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'creator', email: 'creator@example.com', role: 'creator' });
        const submissionId = await ctx.db.insert('submissions', {
            creatorId, businessName: 'Shop', businessType: 'shop', ownerName: 'Owner', ownerPhone: '09171234567', address: '1 Main St', city: 'Manila',
            status: 'completed', amount: 4999, websiteUrl: 'https://old.tendso.com', unpublishedAt: 1,
        });
        const tokenId = await ctx.db.insert('paymentTokens', { submissionId, token: 'receipt-token', referenceCode: 'ND-TEST-TEST', amount: 4999, status: 'paid', createdAt: 1, expiresAt: 2 });
        const websiteId = await ctx.db.insert('generatedWebsites', { submissionId, templateName: 'shop', extractedContent: { private: 'draft content' }, status: 'published', publishedUrl: 'https://new.tendso.com' });
        return { tokenId, submissionId, websiteId };
    });
    return { t, ...ids };
}

describe('token-authorized publication state', () => {
    it('uses a republished generated row even when the submission retains its old takedown timestamp', async () => {
        const { t } = await setup();
        expect(await t.query(api.paymentTokens.getPublicationByToken, { token: 'receipt-token' })).toEqual({ liveUrl: 'https://new.tendso.com' });
    });

    it('does not expose a private preview or a stale URL after a takedown', async () => {
        const { t, websiteId } = await setup();
        await t.run((ctx) => ctx.db.patch(websiteId, { offlineAt: 3 }));
        expect(await t.query(api.paymentTokens.getPublicationByToken, { token: 'receipt-token' })).toEqual({ liveUrl: null });
        await t.run((ctx) => ctx.db.patch(websiteId, { status: 'draft', offlineAt: undefined }));
        expect(await t.query(api.paymentTokens.getPublicationByToken, { token: 'receipt-token' })).toEqual({ liveUrl: null });
    });

    it('requires a real noncancelled token and preserves the legacy external-site fallback', async () => {
        const { t, tokenId, websiteId, submissionId } = await setup();
        expect(await t.query(api.paymentTokens.getPublicationByToken, { token: 'unknown' })).toBeNull();
        await t.run((ctx) => ctx.db.patch(tokenId, { status: 'cancelled' }));
        expect(await t.query(api.paymentTokens.getPublicationByToken, { token: 'receipt-token' })).toBeNull();
        await t.run(async (ctx) => {
            await ctx.db.patch(tokenId, { status: 'paid' });
            await ctx.db.delete(websiteId);
            await ctx.db.patch(submissionId, { unpublishedAt: undefined });
        });
        expect(await t.query(api.paymentTokens.getPublicationByToken, { token: 'receipt-token' })).toEqual({ liveUrl: 'https://old.tendso.com' });
        await t.run((ctx) => ctx.db.patch(submissionId, { status: 'unpublished' }));
        expect(await t.query(api.paymentTokens.getPublicationByToken, { token: 'receipt-token' })).toEqual({ liveUrl: null });
    });
});
