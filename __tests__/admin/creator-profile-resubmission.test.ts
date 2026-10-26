import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './creators.ts': () => import('../../convex/creators'),
    './approvals.ts': () => import('../../convex/approvals'),
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

async function setup(extra: Partial<Doc<'creators'>> = {}) {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active' });
        return ctx.db.insert('creators', {
            clerkId: 'agent', email: 'agent@example.com', role: 'creator', status: 'active',
            firstName: 'Old name', lastName: 'Santos', phone: '09171234567',
            profileImage: 'https://images.example.com/original.jpg',
            quizPassedAt: 100, rejectedAt: 200, rejectionReason: 'Please correct your name', rejectedBy: 'admin',
            ...extra,
        });
    });
    const agent = t.withIdentity({ subject: 'agent' });
    const admin = t.withIdentity({ subject: 'admin' });
    const row = () => t.run((ctx) => ctx.db.get(id));
    const jobs = () => t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
    return { t, id, agent, admin, row, jobs };
}

describe('correcting a rejected field-agent profile', () => {
    it('saves corrected details, preserves the quiz pass and re-enters the admin review queue atomically', async () => {
        const { id, agent, admin, row, jobs } = await setup();
        expect(await admin.query(api.creators.listPendingApproval, {})).toEqual([]);
        await agent.mutation(api.creators.resubmitProfileForReview, {
            id, firstName: '  Pablo  ', lastName: '  Reyes ', phone: ' +639181234567 ',
            profileImage: ' https://images.example.com/corrected.jpg ',
        });
        expect(await row()).toMatchObject({
            firstName: 'Pablo', lastName: 'Reyes', phone: '+639181234567',
            profileImage: 'https://images.example.com/corrected.jpg', quizPassedAt: 100, reviewSubmittedAt: 20_000,
        });
        for (const field of ['rejectedAt', 'rejectionReason', 'rejectedBy', 'certifiedAt'] as const) {
            expect((await row())?.[field]).toBeUndefined();
        }
        expect(await admin.query(api.creators.listPendingApproval, {})).toMatchObject([{ _id: id, firstName: 'Pablo', quizPassedAt: 100 }]);
        expect((await jobs()).map((job) => job.name)).toEqual(['approvals:createAndPost']);
    });

    it('a pending retry neither changes the submitted profile nor adds another review job', async () => {
        const { id, agent, row, jobs } = await setup();
        await agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Pablo' });
        const submitted = await row();
        const queued = await jobs();
        vi.setSystemTime(30_000);
        await agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Different name', phone: '' });
        expect(await row()).toEqual(submitted);
        expect(await jobs()).toEqual(queued);
    });

    it('keeps omitted optional details, while explicit empty fields clear optional details', async () => {
        const kept = await setup();
        await kept.agent.mutation(api.creators.resubmitProfileForReview, { id: kept.id, firstName: 'Pablo' });
        expect(await kept.row()).toMatchObject({ lastName: 'Santos', phone: '09171234567', profileImage: 'https://images.example.com/original.jpg' });
        const cleared = await setup();
        await cleared.agent.mutation(api.creators.resubmitProfileForReview, {
            id: cleared.id, firstName: 'Pablo', lastName: ' ', phone: '', profileImage: '',
        });
        expect((await cleared.row())?.lastName).toBeUndefined();
        expect((await cleared.row())?.phone).toBeUndefined();
        expect((await cleared.row())?.profileImage).toBeUndefined();
    });

    it('allows legacy creator rows without an explicit role', async () => {
        const { id, agent, row } = await setup({ role: undefined });
        await agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Pablo' });
        expect(await row()).toMatchObject({ firstName: 'Pablo', quizPassedAt: 100, reviewSubmittedAt: 20_000 });
    });

    it('requires the account owner, including when the caller is an admin', async () => {
        const { t, id, admin, row, jobs } = await setup();
        const original = await row();
        for (const caller of [t, admin, t.withIdentity({ subject: 'another-agent' })]) {
            await expect(caller.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Forged' })).rejects.toThrow();
        }
        expect(await row()).toEqual(original);
        expect(await jobs()).toEqual([]);
    });

    it.each([
        { role: 'affiliate' }, { role: 'admin' }, { role: 'staff' },
        { status: 'suspended' }, { status: 'deleted' }, { isDeleted: true },
        { certifiedAt: 150 }, { quizPassedAt: undefined }, { rejectedAt: undefined },
    ])('refuses ineligible accounts without changing their profile: %j', async (extra) => {
        const { id, agent, row, jobs } = await setup(extra);
        const original = await row();
        await expect(agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Changed' })).rejects.toThrow();
        expect(await row()).toEqual(original);
        expect(await jobs()).toEqual([]);
    });

    it.each([
        { firstName: ' ' }, { firstName: 'a'.repeat(101) }, { lastName: 'a'.repeat(101) },
        { phone: '123' }, { profileImage: 'http://images.example.com/photo.jpg' },
        { profileImage: 'javascript:alert(1)' },
    ])('invalid corrections leave the rejection and quiz pass intact: %j', async (invalid) => {
        const { id, agent, row, jobs } = await setup();
        const original = await row();
        await expect(agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Pablo', ...invalid })).rejects.toThrow();
        expect(await row()).toEqual(original);
        expect(await jobs()).toEqual([]);
    });

    it('gives a later corrected review a distinct episode even within the same clock millisecond', async () => {
        const { t, id, agent, row } = await setup();
        await agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Pablo' });
        await t.run((ctx) => ctx.db.patch(id, { rejectedAt: 20_000, rejectionReason: 'Please check the photo' }));
        await agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Pablo', profileImage: 'https://images.example.com/new.jpg' });
        expect(await row()).toMatchObject({ quizPassedAt: 100, reviewSubmittedAt: 20_001 });
    });

    it('keeps the old explicit retake endpoint available and resets its review episode with the quiz', async () => {
        const { id, agent, row } = await setup({ reviewSubmittedAt: 150 });
        await agent.mutation(api.creators.requestRecertification, { id });
        expect((await row())?.quizPassedAt).toBeUndefined();
        expect((await row())?.reviewSubmittedAt).toBeUndefined();
        expect((await row())?.rejectedAt).toBeUndefined();
    });
});

describe('Discord review episodes with a preserved quiz pass', () => {
    it('deduplicates legacy requests and posts each corrected episode once', async () => {
        const { t, id, agent } = await setup({ rejectedAt: undefined });
        const old = await t.mutation(internal.approvals.claimForPost, { creatorId: id, quizPassedAt: 100 });
        expect(old).toBeTruthy();
        expect(await t.mutation(internal.approvals.claimForPost, { creatorId: id, quizPassedAt: 100 })).toBeNull();
        await t.run(async (ctx) => {
            await ctx.db.patch(old!, { status: 'denied' });
            await ctx.db.patch(id, { rejectedAt: 200 });
        });
        await agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Pablo' });
        // A delayed action trying to claim the previous profile cannot post it.
        expect(await t.mutation(internal.approvals.claimForPost, { creatorId: id, quizPassedAt: 100 })).toBeNull();
        const corrected = await t.mutation(internal.approvals.claimForPost, { creatorId: id, quizPassedAt: 100, reviewSubmittedAt: 20_000 });
        expect(corrected).toBeTruthy();
        expect(corrected).not.toBe(old);
        expect(await t.mutation(internal.approvals.claimForPost, { creatorId: id, quizPassedAt: 100, reviewSubmittedAt: 20_000 })).toBeNull();
        expect(await t.run((ctx) => ctx.db.get(corrected!))).toMatchObject({ quizPassedAt: 100, reviewSubmittedAt: 20_000 });
    });

    it.each(['approve', 'reject'] as const)('an old in-flight %s decision cannot resolve the corrected profile', async (decision) => {
        const { t, id, agent, row } = await setup();
        await agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Pablo' });
        const mutation = decision === 'approve' ? internal.creators.approveCreatorInternal : internal.creators.rejectCreatorInternal;
        expect(await t.mutation(mutation, { id, expectedReviewSubmittedAt: 100 })).toMatchObject({ outcome: 'stale_request' });
        expect(await row()).toMatchObject({ firstName: 'Pablo', quizPassedAt: 100, reviewSubmittedAt: 20_000 });
        expect((await row())?.certifiedAt).toBeUndefined();
        expect((await row())?.rejectedAt).toBeUndefined();
        expect(await t.mutation(mutation, { id, expectedReviewSubmittedAt: 20_000 })).toMatchObject({ outcome: decision === 'approve' ? 'approved' : 'rejected' });
    });

    it('still permits a guarded decision on a legacy first review', async () => {
        const { t, id } = await setup({ rejectedAt: undefined });
        expect(await t.mutation(internal.creators.approveCreatorInternal, { id, expectedReviewSubmittedAt: 100 })).toMatchObject({ outcome: 'approved' });
    });

    it.each(['approve', 'reject'] as const)('a pre-deploy %s caller without an episode token cannot resolve a corrected profile', async (decision) => {
        const { t, id, agent, row } = await setup();
        await agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Pablo' });
        const mutation = decision === 'approve' ? internal.creators.approveCreatorInternal : internal.creators.rejectCreatorInternal;
        expect(await t.mutation(mutation, { id })).toMatchObject({ outcome: 'stale_request' });
        expect((await row())?.certifiedAt).toBeUndefined();
        expect((await row())?.rejectedAt).toBeUndefined();
    });

    it.each(['approve', 'reject'] as const)('retains the legacy %s call shape for a first review without an episode token', async (decision) => {
        const { t, id } = await setup({ rejectedAt: undefined });
        const mutation = decision === 'approve' ? internal.creators.approveCreatorInternal : internal.creators.rejectCreatorInternal;
        expect(await t.mutation(mutation, { id })).toMatchObject({ outcome: decision === 'approve' ? 'approved' : 'rejected' });
    });

    it('rejects stale reactions when a correction lands while Discord reactions are being fetched', async () => {
        vi.stubEnv('DISCORD_APPROVALS_ENABLED', 'true');
        vi.stubEnv('DISCORD_PENDING_APPROVALS_CHANNEL_ID', 'channel');
        vi.stubEnv('DISCORD_BOT_TOKEN', 'test-only-token');
        vi.stubEnv('DISCORD_APPROVALS_ROLE_ID', '');
        vi.stubEnv('DISCORD_GUILD_ID', '');
        const { t, id, agent, row } = await setup({ rejectedAt: undefined });
        const old = await t.mutation(internal.approvals.claimForPost, { creatorId: id, quizPassedAt: 100 });
        await t.run((ctx) => ctx.db.patch(old!, { discordChannelId: 'channel', discordMessageId: 'old-message' }));
        let changed = false;
        vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
            const url = String(input);
            if (init?.method === 'PATCH') return new Response('{}', { status: 200 });
            if (url.includes('/reactions/') && url.includes(encodeURIComponent('✅'))) {
                if (!changed) {
                    changed = true;
                    await t.run((ctx) => ctx.db.patch(id, { rejectedAt: 200 }));
                    await agent.mutation(api.creators.resubmitProfileForReview, { id, firstName: 'Pablo' });
                }
                return new Response(JSON.stringify([{ id: 'reviewer', bot: false }]), { status: 200 });
            }
            if (url.includes('/reactions/')) return new Response('[]', { status: 200 });
            throw new Error(`Unexpected Discord call: ${url}`);
        }));
        await t.action(internal.approvals.pollPending, {});
        expect(changed).toBe(true);
        expect(await row()).toMatchObject({ firstName: 'Pablo', quizPassedAt: 100, reviewSubmittedAt: 20_000 });
        expect((await row())?.certifiedAt).toBeUndefined();
        expect((await row())?.rejectedAt).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.get(old!))).toMatchObject({ status: 'expired', error: 'superseded by another review' });
    });
});
