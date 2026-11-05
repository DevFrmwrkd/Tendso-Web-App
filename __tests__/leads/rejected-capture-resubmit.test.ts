import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './submissions.ts': () => import('../../convex/submissions'),
    './hyperagent.ts': () => import('../../convex/hyperagent'),
    './aiPipeline/orchestrator.ts': () => import('../../convex/aiPipeline/orchestrator'),
    './aiPipeline/persist.ts': () => import('../../convex/aiPipeline/persist'),
    './admin.ts': () => import('../../convex/admin'),
    './buildProgress.ts': () => import('../../convex/buildProgress'),
};
const NOW = Date.UTC(2026, 10, 2, 7);
const original = {
    businessName: 'Corner Barber', businessType: 'Barber/Salon', ownerName: 'Sam Cruz', ownerPhone: '09171234567',
    ownerEmail: 'sam@example.test', address: '1 Main Street', city: 'Marikina',
    photos: ['photos/owner.jpg', 'photos/shop.jpg', 'photos/craft.jpg'],
    videoStorageId: 'videos/original.mp4', audioStorageId: 'audio/original.m4a', transcript: 'The original interview.',
    templateId: 'barbershop:BP', templateIds: ['barbershop:BP'], amount: 2999, creatorPayout: 1500, platformFee: 1499,
    submissionType: 'standard' as const, rejectionReason: 'Replace the blurry shop photo.', reviewedBy: 'reviewer', reviewedAt: NOW - 10_000,
};
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup(overrides: Partial<Doc<'submissions'>> = {}, account: Partial<Doc<'creators'>> = {}) {
    const t = convexTest(schema, modules);
    const { creatorId, otherId, id } = await t.run(async ctx => {
        const creatorId = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active', certifiedAt: NOW - 1000, submissionCount: 7, ...account });
        const otherId = await ctx.db.insert('creators', { clerkId: 'other', email: 'other@example.test', role: 'creator', status: 'active', certifiedAt: NOW - 1000 });
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.test', role: 'admin', status: 'active' });
        const id = await ctx.db.insert('submissions', { ...original, creatorId, status: 'rejected', ...overrides });
        return { creatorId, otherId, id };
    });
    const row = () => t.run(ctx => ctx.db.get(id));
    const effects = () => t.run(async ctx => ({
        submissions: await ctx.db.query('submissions').collect(), leads: await ctx.db.query('leads').collect(),
        creator: await ctx.db.get(creatorId), jobs: await ctx.db.system.query('_scheduled_functions').collect(),
        earnings: await ctx.db.query('earnings').collect(),
    }));
    const agent = t.withIdentity({ subject: 'agent' });
    return { t, agent, id, creatorId, otherId, row, effects };
}

describe('rejected field-agent capture corrections', () => {
    it('saves replacement media, design and price, then submits the same draft exactly once', async () => {
        const { agent, id, row, effects } = await setup({ status: 'draft' });
        await agent.mutation(api.submissions.update, { id, photos: ['new/one.jpg', 'new/two.jpg', 'new/three.jpg'] });
        await agent.mutation(api.submissions.update, { id, audioStorageId: 'new/interview.m4a' });
        await agent.mutation(api.submissions.chooseDesign, { id, templateId: 'business:CA' });
        await agent.mutation(api.submissions.setDomainTier, { id, submissionType: 'standard', sellPrice: 2499 });
        await agent.mutation(api.submissions.submit, { id });
        expect(await row()).toMatchObject({ _id: id, status: 'submitted', photos: ['new/one.jpg', 'new/two.jpg', 'new/three.jpg'],
            audioStorageId: 'new/interview.m4a', templateId: 'business:CA', amount: 2499, creatorPayout: 1250 });
        expect(await row()).not.toHaveProperty('videoStorageId');
        expect(await row()).not.toHaveProperty('transcript');
        const sent = await effects();
        expect(sent.submissions).toHaveLength(1); expect(sent.leads).toHaveLength(1);
        await agent.mutation(api.submissions.submit, { id });
        expect(await effects()).toEqual(sent);
    });

    it.each(['draft', 'rejected'])('drops the old parallel audio when saving a replacement video without one on %s', async status => {
        const { agent, id, row } = await setup({ status });
        await agent.mutation(api.submissions.update, { id, videoStorageId: 'new/video.mp4' });
        expect(await row()).toMatchObject({ videoStorageId: 'new/video.mp4' });
        expect(await row()).not.toHaveProperty('audioStorageId');
        expect(await row()).not.toHaveProperty('transcript');
    });

    it('edits the same rejected record without losing feedback or untouched capture assets', async () => {
        const { agent, id, row, effects } = await setup();
        const before = await row();
        await agent.mutation(api.submissions.update, { id, businessName: 'Corrected shop name' });
        expect(await row()).toEqual({ ...before, businessName: 'Corrected shop name' });
        await agent.mutation(api.submissions.chooseDesign, { id, templateId: 'generic:A' });
        expect(await row()).toMatchObject({ ...original, businessName: 'Corrected shop name', templateId: 'generic:A', templateIds: ['generic:A'], status: 'rejected' });
        expect((await effects()).jobs).toHaveLength(0);
        expect((await effects()).submissions).toHaveLength(1);
    });

    it('resends a bound community capture without a fresh visit, duplicate shop or another submission count', async () => {
        const { t, agent, id, creatorId, otherId, row, effects } = await setup();
        const leadId = await t.run(ctx => ctx.db.insert('leads', { source: 'community', status: 'converted', createdAt: NOW - 100_000,
            businessName: original.businessName, submissionId: id, creatorId, spottedByCreatorId: otherId, communityPhotoUrl: 'https://discovery.example.test/store.jpg',
            claimedByCreatorId: otherId, claimedAt: NOW - 200_000, claimExpiresAt: NOW - 100_000 }));
        await t.run(ctx => ctx.db.patch(id, { prospectLeadId: leadId }));
        await agent.mutation(api.submissions.update, { id, photos: ['photos/owner.jpg', 'photos/replacement.jpg', 'photos/craft.jpg'] });
        await agent.mutation(api.submissions.submit, { id });
        expect(await row()).toMatchObject({ _id: id, prospectLeadId: leadId, status: 'submitted',
            photos: ['photos/owner.jpg', 'photos/replacement.jpg', 'photos/craft.jpg'], airtableSyncStatus: 'pending_push',
            videoStorageId: original.videoStorageId, audioStorageId: original.audioStorageId, transcript: original.transcript,
            templateId: original.templateId, amount: original.amount, creatorPayout: original.creatorPayout,
            address: original.address, city: original.city, ownerEmail: original.ownerEmail });
        for (const key of ['rejectionReason', 'reviewedBy', 'reviewedAt']) expect(await row()).not.toHaveProperty(key);
        const first = await effects();
        expect(first.leads).toHaveLength(1);
        expect(first.leads[0]).toMatchObject({ _id: leadId, submissionId: id, spottedByCreatorId: otherId, communityPhotoUrl: 'https://discovery.example.test/store.jpg' });
        expect(first.creator?.submissionCount).toBe(7);
        expect(first.earnings).toEqual([]);
        expect(first.jobs).toHaveLength(2);
        expect(JSON.stringify(first.jobs)).not.toContain('incrementStat');
        expect(JSON.stringify(first.jobs)).toContain('"resubmitted":true');
        await agent.mutation(api.submissions.submit, { id });
        expect(await effects()).toEqual(first);
    });

    it('reuses the standalone capture shop and preserves genuine customer inquiries', async () => {
        const { t, agent, id, creatorId, row, effects } = await setup();
        const [captureId, inquiryId] = await t.run(async ctx => Promise.all([
            ctx.db.insert('leads', { source: 'direct', submissionId: id, creatorId, isCaptureShop: true, status: 'new', name: original.ownerName, phone: original.ownerPhone, createdAt: NOW - 1 }),
            ctx.db.insert('leads', { source: 'website', submissionId: id, creatorId, status: 'new', name: 'Customer', phone: '09179999999', message: 'Book a haircut', createdAt: NOW - 1 }),
        ]));
        await agent.mutation(api.submissions.update, { id, ownerName: 'Samuel Cruz' });
        await agent.mutation(api.submissions.submit, { id });
        expect((await row())?.status).toBe('submitted');
        const after = await effects();
        expect(after.leads).toHaveLength(2);
        expect(after.leads.find(lead => lead._id === captureId)?.name).toBe('Samuel Cruz');
        expect(after.leads.find(lead => lead._id === inquiryId)?.name).toBe('Customer');
    });

    it.each(['community', 'outscraper'])('refuses to resend a stolen %s binding and rolls back the rejected record', async source => {
        const { t, agent, id, creatorId, otherId, row, effects } = await setup();
        const otherSubmission = await t.run(ctx => ctx.db.insert('submissions', { ...original, creatorId: otherId, status: 'submitted' }));
        const leadId = await t.run(ctx => ctx.db.insert('leads', { source, status: 'converted', creatorId, submissionId: otherSubmission, createdAt: NOW }));
        await t.run(ctx => ctx.db.patch(id, { prospectLeadId: leadId }));
        const before = await row(), beforeEffects = await effects();
        await expect(agent.mutation(api.submissions.submit, { id })).rejects.toThrow();
        expect(await row()).toEqual(before);
        expect(await effects()).toEqual(beforeEffects);
    });

    it('never rebinds a rejected capture while saving corrections', async () => {
        const { t, agent, id, creatorId, row } = await setup();
        const leadId = await t.run(ctx => ctx.db.insert('leads', { source: 'outscraper', creatorId, status: 'new', createdAt: NOW }));
        const before = await row();
        await expect(agent.mutation(api.submissions.update, { id, prospectLeadId: leadId })).rejects.toThrow('original shop');
        expect(await row()).toEqual(before);
    });

    it('keeps the saved custom-domain quote when changing only the corrected capture sale price', async () => {
        const { agent, id, row } = await setup({ submissionType: 'with_custom_domain', requestedDomain: 'corner.example', domainCostPHP: 723, amount: 3722 });
        await agent.mutation(api.submissions.setDomainTier, { id, submissionType: 'with_custom_domain', requestedDomain: 'CORNER.EXAMPLE', sellPrice: 3999 });
        expect(await row()).toMatchObject({ status: 'rejected', requestedDomain: 'corner.example', domainCostPHP: 723, amount: 4722, creatorPayout: 2000, rejectionReason: original.rejectionReason });
        await expect(agent.mutation(api.submissions.update, { id, creatorPayout: 999999 })).rejects.toThrow('capture pricing');
    });

    it.each(['draft', 'rejected'])('clears the old video and transcript for a new voice-only interview on %s', async status => {
        const { agent, id, row, effects } = await setup({ status, videoUrl: 'https://old.example.test/take.mp4', audioUrl: 'https://old.example.test/take.m4a', transcriptionStatus: 'complete', transcriptionError: 'old' });
        await agent.mutation(api.submissions.update, { id, audioStorageId: 'audio/corrected.m4a' });
        expect(await row()).toMatchObject({ status, audioStorageId: 'audio/corrected.m4a', rejectionReason: original.rejectionReason, photos: original.photos });
        for (const key of ['videoStorageId', 'videoUrl', 'audioUrl', 'transcript', 'transcriptionStatus', 'transcriptionError']) expect(await row()).not.toHaveProperty(key);
        expect((await effects()).jobs).toHaveLength(1);
        expect(JSON.stringify((await effects()).jobs)).toContain('audio/corrected.m4a');
    });

    it.each(['draft', 'rejected'])('retains the transcript when retrying the same recording on %s', async status => {
        const { agent, id, row, effects } = await setup({ status });
        await agent.mutation(api.submissions.update, { id, videoStorageId: original.videoStorageId, audioStorageId: original.audioStorageId });
        expect((await row())?.transcript).toBe(original.transcript);
        expect((await effects()).jobs).toEqual([]);
    });

    it.each(['draft', 'rejected'])('clears obsolete public URLs but retains new parallel audio on %s', async status => {
        const { agent, id, row, effects } = await setup({ status, videoUrl: 'https://old.example.test/video.mp4', audioUrl: 'https://old.example.test/audio.m4a' });
        await agent.mutation(api.submissions.update, { id, videoStorageId: 'videos/new.mp4', audioStorageId: 'audio/new.m4a' });
        expect(await row()).toMatchObject({ videoStorageId: 'videos/new.mp4', audioStorageId: 'audio/new.m4a', status });
        for (const key of ['videoUrl', 'audioUrl', 'transcript']) expect(await row()).not.toHaveProperty(key);
        expect(JSON.stringify((await effects()).jobs)).toContain('videos/new.mp4');
    });

    it.each(['draft', 'rejected'])('keeps an explicitly retained video when correcting its parallel audio on %s', async status => {
        const { agent, id, row } = await setup({ status });
        await agent.mutation(api.submissions.update, { id, videoStorageId: original.videoStorageId, audioStorageId: 'audio/new-track.m4a' });
        expect(await row()).toMatchObject({ videoStorageId: original.videoStorageId, audioStorageId: 'audio/new-track.m4a' });
    });

    it.each(['approved', 'paid', 'submitted', 'in_review'])('locks field-agent content and pricing edits after %s', async status => {
        const { agent, id, row, effects } = await setup({ status });
        const before = await row(), beforeEffects = await effects();
        await expect(agent.mutation(api.submissions.update, { id, ownerName: 'Changed' })).rejects.toThrow('draft or rejected');
        await expect(agent.mutation(api.submissions.setDomainTier, { id, submissionType: 'standard', sellPrice: 3999 })).rejects.toThrow('draft or rejected');
        await agent.mutation(api.submissions.submit, { id });
        expect(await row()).toEqual(before);
        expect(await effects()).toEqual(beforeEffects);
    });

    it.each([{}, { amountPaid: 100 }, { paidAt: NOW }])('requires valid interview/payment state when resending %j', async extra => {
        const { agent, id, row } = await setup({ ...extra, ...(!Object.keys(extra).length ? { videoStorageId: undefined, audioStorageId: undefined } : {}) });
        const before = await row();
        await expect(agent.mutation(api.submissions.submit, { id })).rejects.toThrow();
        expect(await row()).toEqual(before);
    });

    it.each([null, 'other', 'admin'])('does not let %s resend somebody else’s rejected capture', async subject => {
        const { t, id, row, effects } = await setup();
        const before = await row(), beforeEffects = await effects();
        await expect((subject ? t.withIdentity({ subject }) : t).mutation(api.submissions.submit, { id })).rejects.toThrow();
        expect(await row()).toEqual(before);
        expect(await effects()).toEqual(beforeEffects);
    });

    it('does not let an uncertified agent resume review work', async () => {
        const { agent, id } = await setup({}, { certifiedAt: undefined });
        await expect(agent.mutation(api.submissions.update, { id, ownerName: 'Changed' })).rejects.toThrow('certified');
        await expect(agent.mutation(api.submissions.submit, { id })).rejects.toThrow('certified');
    });
});

describe('corrected capture build episodes', () => {
    it.each([undefined, { enhanced_hero: { url: 'https://new.example.test/hero.jpg' } }])('replaces rejected enhanced-image slots without retaining removed photos (%j)', async enhancedImages => {
        const { t, id } = await setup({ status: 'submitted' });
        const websiteId = await t.run(ctx => ctx.db.insert('generatedWebsites', { submissionId: id, status: 'draft',
            enhancedImages: { enhanced_hero: { url: 'https://old.example.test/hero.jpg' }, enhanced_gallery_2: { url: 'https://removed.example.test/gallery.jpg' } } }));
        const runId = await t.run(ctx => ctx.db.insert('aiPipelineRuns', { submissionId: id, status: 'running', reason: 'resubmitted', force: true,
            step: 'building_site', attempt: 1, startedAt: NOW, updatedAt: NOW, deadlineAt: NOW + 1000 }));
        expect(await t.mutation(internal.aiPipeline.persist.prepareBuild, { runId, submissionId: id, content: { heroHeadline: 'Corrected copy' },
            ...(enhancedImages ? { enhancedImages } : {}) })).toMatchObject({ ok: true });
        expect((await t.run(ctx => ctx.db.get(websiteId)))?.enhancedImages).toEqual(enhancedImages ?? {});
    });

    it.each(['review action', 'status action'])('cancels old automatic builds atomically when an admin rejects via %s', async action => {
        const { t, id } = await setup({ status: 'submitted' });
        const runId = await t.run(ctx => ctx.db.insert('aiPipelineRuns', { submissionId: id, status: 'running', step: 'building_site', attempt: 1,
            startedAt: NOW - 1000, updatedAt: NOW - 1000, deadlineAt: NOW + 1000 }));
        const admin = t.withIdentity({ subject: 'admin' });
        if (action === 'review action') await admin.mutation(api.admin.rejectSubmission, { submissionId: id, reason: 'Please fix the photo.', adminId: 'admin' });
        else await admin.mutation(api.submissions.updateStatus, { id, status: 'rejected' });
        expect((await t.run(ctx => ctx.db.get(runId)))?.status).toBe('canceled');
        expect(await t.query(internal.aiPipeline.orchestrator.getRunInternal, { runId })).toBeNull();
        expect(await t.mutation(internal.aiPipeline.orchestrator.markStep, { runId, step: 'building_site', status: 'done' })).toBe(false);
        expect(await t.mutation(internal.aiPipeline.persist.prepareBuild, { runId, submissionId: id, content: { stale: true } })).toMatchObject({ ok: false, code: 'stale' });
        expect(await t.run(ctx => ctx.db.query('generatedWebsites').collect())).toEqual([]);
    });

    it('ignores already-running legacy builds and late Studio callbacks while a rejected capture is being edited', async () => {
        const { t, id, row } = await setup();
        const runId = await t.run(ctx => ctx.db.insert('aiPipelineRuns', { submissionId: id, status: 'running', step: 'building_site', attempt: 1,
            startedAt: NOW - 1000, updatedAt: NOW - 1000, deadlineAt: NOW + 1000 }));
        expect(await t.query(internal.aiPipeline.orchestrator.getRunInternal, { runId })).toBeNull();
        await expect(t.mutation(internal.buildProgress.setStep, { submissionId: id, step: 'building_site', status: 'done' })).rejects.toThrow('rejected');
        expect(await t.mutation(internal.aiPipeline.persist.prepareBuild, { runId, submissionId: id, content: { stale: true } })).toMatchObject({ ok: false, code: 'stale' });
        const network = vi.fn();
        vi.stubGlobal('fetch', network);
        await t.action(internal.hyperagent.triggerStudioRender, { submissionId: id });
        expect(network).not.toHaveBeenCalled();
        await t.mutation(internal.hyperagent.saveStudioContent, { submissionId: id, content: { heroHeadline: 'Old words' }, enhancedImages: {} });
        expect(await t.run(ctx => ctx.db.query('generatedWebsites').collect())).toEqual([]);
        expect((await row())?.status).toBe('rejected');
        expect((await row())?.rejectionReason).toBe(original.rejectionReason);
    });

    it.each(['done', 'running'] as const)('starts fresh after a %s build without reusing rejected polished photos', async status => {
        vi.stubEnv('AI_PIPELINE_ENABLED', 'true');
        const { t, id } = await setup({ status: 'submitted' });
        const previous = await t.run(ctx => ctx.db.insert('aiPipelineRuns', { submissionId: id, status, step: 'building_site', attempt: 1,
            startedAt: NOW - 1000, updatedAt: NOW - 1000, deadlineAt: NOW + 1000, photos: { 0: { url: 'https://old.example.test/polished.jpg' } } }));
        const fresh = await t.mutation(internal.aiPipeline.orchestrator.start, { submissionId: id, reason: 'resubmitted', force: true });
        expect(fresh.started).toBe(true);
        expect(fresh.runId).not.toBe(previous);
        const record = await t.run(ctx => ctx.db.get(fresh.runId!));
        expect(record).toMatchObject({ reason: 'resubmitted', force: true, status: 'running' });
        expect(record).not.toHaveProperty('photos');
        if (status === 'running') expect((await t.run(ctx => ctx.db.get(previous)))?.status).toBe('canceled');
        await t.run(ctx => ctx.db.patch(fresh.runId!, { status: 'failed' }));
        expect(await t.mutation(internal.aiPipeline.orchestrator.markStep, { runId: fresh.runId!, step: 'reading_interview', status: 'failed' })).toBe(true);
        expect(await t.mutation(internal.aiPipeline.orchestrator.markStep, { runId: previous, step: 'building_site', status: 'done' })).toBe(false);
    });
});
