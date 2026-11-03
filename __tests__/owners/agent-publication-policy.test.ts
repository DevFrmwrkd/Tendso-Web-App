import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { publishPolicyFor } from '../../convex/lib/ownerApp';
import { INTAKE_QUESTIONS } from '../../lib/narrativeFromQa';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './submissions.ts': () => import('../../convex/submissions'),
    './owners.ts': () => import('../../convex/owners'),
    './ownerApp.ts': () => import('../../convex/ownerApp'),
    './ownerIntake.ts': () => import('../../convex/ownerIntake'),
    './ownerPayments.ts': () => import('../../convex/ownerPayments'),
    './paymentTokens.ts': () => import('../../convex/paymentTokens'),
    './generatedWebsites.ts': () => import('../../convex/generatedWebsites'),
    './changeRequests.ts': () => import('../../convex/changeRequests'),
    './buildProgress.ts': () => import('../../convex/buildProgress'),
    './admin.ts': () => import('../../convex/admin'),
    './ownerEmails.ts': () => import('../../convex/ownerEmails'),
};
const NOW = Date.UTC(2026, 10, 3, 12);
beforeEach(() => {
    // Scheduled email/build/payment side effects stay pending in the test DB.
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    vi.stubEnv('R2_PUBLIC_URL', 'https://uploads.example.test');
    vi.stubEnv('OWNER_INTAKE_DAILY_LIMIT', '1000');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup(fields: Partial<Doc<'submissions'>> = {}) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active', certifiedAt: NOW });
        const houseId = await ctx.db.insert('creators', { clerkId: 'house', email: 'house@example.test', role: 'admin', status: 'active' });
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.test', role: 'admin', status: 'active' });
        const ownerId = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', name: 'Sam', createdAt: NOW });
        const id = await ctx.db.insert('submissions', { creatorId, businessName: 'Corner Barber', businessType: 'Barber/Salon',
            ownerName: 'Sam', ownerPhone: '09171234567', ownerEmail: 'owner@example.test', address: '1 Main St', city: 'Marikina',
            status: 'draft', amount: 4999, creatorPayout: 2500, submissionType: 'standard', photos: ['one.jpg', 'two.jpg', 'three.jpg'],
            videoUrl: 'https://uploads.example.test/interview.mp4', templateId: 'business:CA', ...fields });
        await ctx.db.insert('websiteOwnerships', { businessOwnerId: ownerId, submissionId: id, role: 'owner', claimedAt: NOW });
        return { id, creatorId, houseId, ownerId };
    });
    vi.stubEnv('SELF_SERVE_CREATOR_ID', ids.houseId);
    const owner = t.withIdentity({ subject: 'owner', email: 'owner@example.test', emailVerified: true });
    const agent = t.withIdentity({ subject: 'agent' });
    const admin = t.withIdentity({ subject: 'admin' });
    const row = () => t.run(ctx => ctx.db.get(ids.id));
    const jobs = () => t.run(ctx => ctx.db.system.query('_scheduled_functions').collect());
    const build = () => admin.mutation(api.generatedWebsites.upsert, { submissionId: ids.id, templateName: 'business:CA',
        extractedContent: {}, htmlContent: '<html>Private owner preview</html>', status: 'draft' });
    return { t, ...ids, owner, agent, admin, row, jobs, build };
}

describe('new paid-order publication policy', () => {
    it('keeps absent legacy defaults and honors explicit policy ahead of the content source', () => {
        expect(publishPolicyFor({})).toBe('publish_first');
        expect(publishPolicyFor({ contentSource: 'owner_app' })).toBe('pay_then_publish');
        expect(publishPolicyFor({ contentSource: 'owner_app', publishPolicy: 'publish_first' })).toBe('publish_first');
        expect(publishPolicyFor({ publishPolicy: 'pay_then_publish' })).toBe('pay_then_publish');
        expect(publishPolicyFor({ publishPolicy: 'pay_then_publish', pricingMode: 'comped' })).toBe('publish_first');
    });

    it('stamps a first agent send once, preserving its creator, price, content and design', async () => {
        const { agent, id, row, jobs, creatorId } = await setup();
        await agent.mutation(api.submissions.submit, { id });
        expect(await row()).toMatchObject({ publishPolicy: 'pay_then_publish', status: 'submitted', creatorId,
            amount: 4999, creatorPayout: 2500, templateId: 'business:CA', photos: ['one.jpg', 'two.jpg', 'three.jpg'] });
        expect((await row())?.contentSource).toBeUndefined();
        const before = await jobs();
        await agent.mutation(api.submissions.submit, { id });
        expect(await jobs()).toEqual(before);
    });

    it.each(['published', 'offline', 'explicit-legacy', 'rejected-legacy', 'comped', 'giveaway'])('preserves %s orders without migrating their publication contract', async scenario => {
        const fields: Partial<Doc<'submissions'>> = scenario === 'explicit-legacy' ? { publishPolicy: 'publish_first' }
            : scenario === 'rejected-legacy' ? { status: 'rejected' }
                    : scenario === 'comped' ? { pricingMode: 'comped' }
                        : scenario === 'giveaway' ? { giveawayApplication: true } : {};
        const { t, agent, id, row } = await setup(fields);
        if (scenario === 'published' || scenario === 'offline') await t.run(ctx => ctx.db.insert('generatedWebsites', {
            submissionId: id, status: 'published', publishedUrl: 'https://legacy.example.test', publishedAt: NOW - 1000,
            ...(scenario === 'offline' ? { offlineAt: NOW } : {}),
        }));
        await agent.mutation(api.submissions.submit, { id });
        expect(publishPolicyFor((await row())!)).toBe('publish_first');
    });

    it.each(['draft', 'submitted'] as const)('also stamps a creator’s direct %s insert and refuses nonadmin paid-status creation', async status => {
        const { agent, creatorId, t } = await setup();
        const id = await agent.mutation(api.submissions.create, { creatorId, businessName: 'Second', businessType: 'Other', ownerName: 'Sam',
            ownerPhone: '09171234567', ownerEmail: 'owner@example.test', address: '2 Main St', city: 'Marikina', status });
        expect((await t.run(ctx => ctx.db.get(id)))?.publishPolicy).toBe('pay_then_publish');
        await expect(agent.mutation(api.submissions.create, { creatorId, businessName: 'Fake receipt', businessType: 'Other', ownerName: 'Sam',
            ownerPhone: '09171234567', address: '2 Main St', city: 'Marikina', status: 'completed' })).rejects.toThrow('admin access');
    });

    it('stamps new admin/house captures independently of attribution', async () => {
        const { admin, houseId, t } = await setup();
        const id = await admin.mutation(api.submissions.create, { creatorId: houseId, businessName: 'Admin preview', businessType: 'Other', ownerName: 'Sam',
            ownerPhone: '09171234567', ownerEmail: 'owner@example.test', address: '2 Main St', city: 'Marikina', status: 'submitted' });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ creatorId: houseId, publishPolicy: 'pay_then_publish' });
    });

    it('does not treat a draft’s client-editable website URL or completed label as publication/payment proof', async () => {
        const { agent, admin, id, row } = await setup({ websiteUrl: 'https://client-claimed.example.test' });
        await agent.mutation(api.submissions.submit, { id });
        expect((await row())?.publishPolicy).toBe('pay_then_publish');
        await admin.mutation(api.submissions.updateStatus, { id, status: 'completed' });
        expect(await admin.query(api.generatedWebsites.publicationCheck, { submissionId: id })).toEqual({ allowed: false, reason: 'unpaid' });
    });

    it.each([undefined, 'owner_app'])('preserves a later free grant without payment or owner approval (source %s)', async contentSource => {
        const { t, admin, id } = await setup({ contentSource, status: 'website_generated', publishPolicy: 'pay_then_publish' });
        await t.run(async ctx => {
            await ctx.db.patch(id, { status: 'completed', pricingMode: 'comped', creatorPayout: 0 });
            await ctx.db.insert('generatedWebsites', { submissionId: id, status: 'draft', htmlContent: '<html>Free site</html>' });
            await ctx.db.insert('paymentTokens', { submissionId: id, token: 'before-free-grant', referenceCode: 'OLD', amount: 4999,
                status: 'pending', createdAt: NOW - 1000, expiresAt: NOW + 1000 });
        });
        expect(await admin.query(api.generatedWebsites.publicationCheck, { submissionId: id })).toEqual({ allowed: true, reason: null });
        await admin.mutation(api.generatedWebsites.publish, { submissionId: id, publishedUrl: 'https://free.example.test' });
        expect((await t.run(ctx => ctx.db.query('generatedWebsites').first()))?.status).toBe('published');
        expect((await admin.query(api.ownerPayments.getPaymentState, { submissionId: id })).billable).toBe(false);
        await expect(admin.query(internal.ownerPayments.checkoutContextInternal, { token: 'before-free-grant' })).rejects.toThrow('cannot be paid for');
    });

    it('makes committed agent HTML privately reviewable and prepares owner linking before the preview email', async () => {
        const { t, agent, admin, owner, id, row, build, jobs } = await setup();
        await agent.mutation(api.submissions.submit, { id });
        expect((await owner.query(api.ownerApp.getSubmission, { submissionId: id })).phase).toBe('building');
        await build();
        expect((await row())?.previewReadyAt).toBe(NOW);
        expect(await owner.query(api.ownerApp.getPreview, { submissionId: id })).toMatchObject({ ready: true, isLive: false, inlineHtml: '<html>Private owner preview</html>' });
        expect((await owner.query(api.ownerApp.getBuild, { submissionId: id })).doneCount).toBe(4);
        expect(await t.query(api.generatedWebsites.getPublishedBySubmissionId, { submissionId: id })).toBeNull();
        expect(await admin.query(api.generatedWebsites.publicationCheck, { submissionId: id })).toEqual({ allowed: false, reason: 'unpaid' });
        expect(await t.run(ctx => ctx.db.query('ownerInvites').collect())).toEqual([expect.objectContaining({ submissionId: id, email: 'owner@example.test' })]);
        const count = (await jobs()).filter(job => job.name === 'ownerEmails:send' && (job.args[0] as any).kind === 'preview_ready').length;
        expect(count).toBe(1);
        await t.mutation(internal.buildProgress.setStep, { submissionId: id, step: 'building_site', status: 'done' });
        expect((await jobs()).filter(job => job.name === 'ownerEmails:send' && (job.args[0] as any).kind === 'preview_ready')).toHaveLength(1);
    });

    it('recognizes built agent previews when an older build omitted the owner progress timestamp', async () => {
        const { t, owner, id } = await setup({ status: 'website_generated', publishPolicy: 'pay_then_publish' });
        await t.run(ctx => ctx.db.insert('generatedWebsites', { submissionId: id, status: 'draft', htmlContent: '<html>Built</html>' }));
        expect((await owner.query(api.ownerApp.getSubmission, { submissionId: id })).phase).toBe('ready_to_check');
        expect(await owner.query(api.ownerApp.getPreview, { submissionId: id })).toMatchObject({ ready: true, isLive: false });
        expect(await owner.mutation(api.ownerApp.approvePreview, { submissionId: id })).toEqual({ next: 'pay' });
    });

    it('requires the linked owner’s approval on both token paths and at checkout, including admin calls', async () => {
        const { t, owner, agent, admin, id, build } = await setup({ status: 'submitted', publishPolicy: 'pay_then_publish' });
        await build();
        for (const caller of [owner, agent, admin]) await expect(caller.mutation(api.ownerPayments.createPayToken, { submissionId: id, kind: 'full' })).rejects.toThrow('Looks good');
        await expect(t.action(api.paymentTokens.createPaymentToken, { submissionId: id, referenceCode: 'REF', amount: 1 })).rejects.toThrow('Looks good');
        await t.run(ctx => ctx.db.insert('paymentTokens', { submissionId: id, token: 'old', referenceCode: 'REF', amount: 4999, status: 'pending', createdAt: NOW, expiresAt: NOW + 1000 }));
        await expect(admin.query(internal.ownerPayments.checkoutContextInternal, { token: 'old' })).rejects.toThrow('Looks good');
        await owner.mutation(api.ownerApp.approvePreview, { submissionId: id });
        expect((await owner.query(api.ownerPayments.getPaymentState, { submissionId: id })).needsApproval).toBe(false);
        expect(await owner.mutation(api.ownerPayments.createPayToken, { submissionId: id, kind: 'full' })).toMatchObject({ amount: 4999 });
    });

    it('keeps deposits private, publishes only after the full balance, and retains creator credit exactly once', async () => {
        const { t, owner, admin, id, creatorId, build, row } = await setup({ status: 'submitted', publishPolicy: 'pay_then_publish' });
        await build(); await owner.mutation(api.ownerApp.approvePreview, { submissionId: id });
        const deposit = await owner.mutation(api.ownerPayments.createPayToken, { submissionId: id, kind: 'deposit', amount: 500 });
        await t.mutation(internal.ownerPayments.applyTokenPayment, { token: deposit.token, provider: 'manual', triggeredBy: 'test', amountReceived: 500 });
        expect(await t.mutation(internal.ownerApp.publishIfReady, { submissionId: id })).toEqual({ published: false, reason: 'unpaid' });
        await expect(admin.mutation(api.generatedWebsites.publish, { submissionId: id, publishedUrl: 'https://premature.example.test' })).rejects.toThrow('pay in full');
        const balance = await owner.mutation(api.ownerPayments.createPayToken, { submissionId: id, kind: 'balance' });
        await t.mutation(internal.ownerPayments.applyTokenPayment, { token: balance.token, provider: 'manual', triggeredBy: 'test', amountReceived: 4499 });
        expect((await row())?.creatorId).toBe(creatorId);
        expect((await t.run(ctx => ctx.db.get(creatorId)))?.balance).toBe(2500);
        expect(await admin.query(api.generatedWebsites.publicationCheck, { submissionId: id })).toEqual({ allowed: true, reason: null });
        expect(await t.mutation(internal.ownerApp.publishIfReady, { submissionId: id })).toMatchObject({ published: true });
        expect((await owner.query(api.ownerApp.getSubmission, { submissionId: id })).phase).toBe('live');
    });

    it.each(['publish', 'publishing-info', 'upsert', 'backfill'])('blocks %s from publishing a paid but unapproved policy order', async mode => {
        const { t, admin, id, build } = await setup({ status: 'completed', publishPolicy: 'pay_then_publish', amountPaid: 4999, paidInFullAt: NOW,
            websiteUrl: 'https://would-be-public.example.test' });
        await build();
        if (mode === 'publish') await expect(admin.mutation(api.generatedWebsites.publish, { submissionId: id, publishedUrl: 'https://example.test' })).rejects.toThrow('not approved');
        if (mode === 'publishing-info') await expect(admin.mutation(api.generatedWebsites.updatePublishingInfo, { submissionId: id, publishedUrl: 'https://example.test' })).rejects.toThrow('not approved');
        if (mode === 'upsert') await expect(admin.mutation(api.generatedWebsites.upsert, { submissionId: id, templateName: 'business:CA', extractedContent: {}, status: 'published' })).rejects.toThrow('not approved');
        if (mode === 'backfill') expect((await admin.mutation(api.admin.backfillWebsiteUrls, {})).updatedWebsites).toBe(0);
        expect((await t.run(ctx => ctx.db.query('generatedWebsites').first()))?.status).toBe('draft');
    });

    it('resets a rejected policy capture’s old preview so it cannot be approved until rebuilt', async () => {
        const { t, owner, agent, id, build } = await setup({ status: 'rejected', publishPolicy: 'pay_then_publish', previewReadyAt: NOW - 1000, ownerApprovedAt: NOW - 1000 });
        await t.run(ctx => ctx.db.insert('generatedWebsites', { submissionId: id, status: 'draft', htmlContent: '<html>Rejected old preview</html>' }));
        await agent.mutation(api.submissions.submit, { id });
        expect((await owner.query(api.ownerApp.getSubmission, { submissionId: id })).phase).toBe('building');
        expect(await owner.query(api.ownerApp.getPreview, { submissionId: id })).toMatchObject({ ready: false, htmlUrl: null, inlineHtml: null });
        await expect(owner.mutation(api.ownerApp.approvePreview, { submissionId: id })).rejects.toThrow('still being built');
        await build();
        expect((await owner.query(api.ownerApp.getSubmission, { submissionId: id })).phase).toBe('ready_to_check');
    });

    it('revokes only the old invitation owner when a rejected private capture is corrected to another owner', async () => {
        const { t, owner, agent, admin, id, build } = await setup();
        await agent.mutation(api.submissions.submit, { id });
        const corrected = t.withIdentity({ subject: 'correct-owner', email: 'correct@example.test', emailVerified: true });
        await corrected.mutation(api.owners.ensure, {});
        const managerId = await t.run(async ctx => {
            const managerId = await ctx.db.insert('businessOwners', { clerkId: 'manager', email: 'manager@example.test', createdAt: NOW });
            await ctx.db.insert('websiteOwnerships', { businessOwnerId: managerId, submissionId: id, role: 'manager', claimedAt: NOW });
            return managerId;
        });
        await admin.mutation(api.submissions.updateStatus, { id, status: 'rejected' });
        await agent.mutation(api.submissions.update, { id, ownerEmail: 'correct@example.test' });
        await agent.mutation(api.submissions.submit, { id });
        // This must already be true in the submit transaction, before scheduled invites run.
        await expect(owner.query(api.ownerApp.getSubmission, { submissionId: id })).rejects.toThrow('We could not find');
        await expect(owner.mutation(api.ownerApp.approvePreview, { submissionId: id })).rejects.toThrow('We could not find');
        expect(await corrected.query(api.ownerApp.getSubmission, { submissionId: id })).toMatchObject({ submissionId: id, phase: 'building' });
        expect(await t.run(ctx => ctx.db.query('websiteOwnerships').withIndex('by_owner', q => q.eq('businessOwnerId', managerId)).collect())).toHaveLength(1);
        await build();
        expect(await corrected.mutation(api.ownerApp.approvePreview, { submissionId: id })).toEqual({ next: 'pay' });
    });

    it('records the real receipt and queues publication through the legacy admin mark-paid API', async () => {
        const { admin, id, build, row, jobs } = await setup({ status: 'submitted', publishPolicy: 'pay_then_publish' });
        await build();
        await admin.mutation(api.submissions.markPaid, { id });
        expect(await row()).toMatchObject({ paidInFullAt: NOW, amountPaid: 4999, balanceDue: 0 });
        expect((await jobs()).filter(job => job.name === 'ownerApp:publishIfReady')).toHaveLength(1);
    });

    it('cancels approval and pay links for changes and requires another review after resolution', async () => {
        const { t, owner, admin, id, build } = await setup({ status: 'submitted', publishPolicy: 'pay_then_publish' });
        await build(); await owner.mutation(api.ownerApp.approvePreview, { submissionId: id });
        const token = await owner.mutation(api.ownerPayments.createPayToken, { submissionId: id, kind: 'full' });
        const request = await owner.mutation(api.ownerApp.requestChange, { submissionId: id, text: 'Update our opening hours.' });
        expect((await t.query(internal.paymentTokens.getByTokenInternal, { token: token.token }))?.status).toBe('cancelled');
        expect((await owner.query(api.ownerApp.getSubmission, { submissionId: id })).phase).toBe('changes_requested');
        await admin.mutation(api.changeRequests.setStatus, { id: request, status: 'done' });
        expect((await owner.query(api.ownerApp.getSubmission, { submissionId: id })).phase).toBe('ready_to_check');
        await expect(owner.mutation(api.ownerPayments.createPayToken, { submissionId: id, kind: 'full' })).rejects.toThrow('Looks good');
    });

    it('stamps ordinary /start orders and links verified owners before any payment without sending another invite email', async () => {
        const { t, owner } = await setup();
        const id = await t.mutation(api.ownerIntake.submitOwnerIntake, { businessName: 'Owner Kitchen', businessType: 'Restaurant', ownerName: 'Sam',
            ownerEmail: 'owner@example.test', ownerPhone: '09179999999', address: '2 Main St', city: 'Marikina', hasProducts: false,
            qa: INTAKE_QUESTIONS.map(({ q }) => ({ q, a: 'We serve our local community with friendly service and clear prices every day. Our regulars appreciate the care we take with each order.' })),
            photos: ['', 'https://uploads.example.test/one.jpg', 'https://uploads.example.test/two.jpg', 'https://uploads.example.test/three.jpg'] });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ contentSource: 'owner_intake', publishPolicy: 'pay_then_publish' });
        expect((await owner.query(api.owners.me, {}))?.sites).toEqual(expect.arrayContaining([expect.objectContaining({ submissionId: id })]));
        expect((await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).filter(job => job.name === 'ownerEmails:send')).toHaveLength(0);
    });

    it('sends policy preview emails to the authenticated business page and rejects unsafe configured web origins', async () => {
        const { t, id } = await setup({ status: 'website_generated', publishPolicy: 'pay_then_publish' });
        vi.stubEnv('RESEND_API_KEY', 'mock-key'); vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://user:password@unsafe.example.test');
        vi.stubEnv('SITE_URL', 'https://preview.example.test/path');
        const send = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', send);
        expect(await t.action(internal.ownerEmails.send, { submissionId: id, kind: 'preview_ready' })).toEqual({ sent: true });
        const body = JSON.parse(send.mock.calls[0][1].body);
        expect(body.text).toContain(`https://preview.example.test/my-business/${id}`);
        expect(body.html).not.toContain('unsafe.example.test');
    });
});
