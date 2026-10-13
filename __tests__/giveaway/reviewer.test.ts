import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './giveaway.ts': () => import('../../convex/giveaway'),
    './admin.ts': () => import('../../convex/admin'),
    './submissions.ts': () => import('../../convex/submissions'),
    './hyperagent.ts': () => import('../../convex/hyperagent'),
    './airtable.ts': () => import('../../convex/airtable'),
};
const NOW = Date.UTC(2026, 9, 13, 3);
const REVIEWER = 'user_otr_reviewer';
const ADMIN = 'user_tendso_admin';
type Backend = ReturnType<typeof convexTest<typeof schema.tables>>;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv('OTR_GIVEAWAY_REVIEWER_IDS', ` , ${REVIEWER}, user_second_reviewer, `);
});

describe('giveaway enhancement authorization', () => {
    it.each([null, 'creator', REVIEWER])('rejects Studio manual trigger by %s without marker changes or scheduled work', async (subject) => {
        const { t, ids } = await setup();
        const before = await snapshot(t);
        const caller = subject ? t.withIdentity({ subject }) : t;
        for (const submissionId of [ids.pending, ids.ordinary]) {
            await expect(caller.mutation(api.hyperagent.triggerStudioRenderPublic, { submissionId })).rejects.toThrow();
        }
        expect(await snapshot(t)).toEqual(before);
    });

    it('refuses unreviewed giveaway enhancement even for an admin and protects the legacy marker', async () => {
        const { t, admin, ids } = await setup();
        const before = await snapshot(t);
        await expect(admin.mutation(api.hyperagent.triggerStudioRenderPublic, { submissionId: ids.pending })).rejects.toThrow('Approve the giveaway poster');
        await expect(admin.mutation(api.airtable.triggerAirtablePush, { submissionId: ids.pending })).rejects.toThrow('Approve the giveaway poster');
        await expect(t.mutation(api.airtable.triggerAirtablePush, { submissionId: ids.pending })).rejects.toThrow('Not authenticated');
        expect(await snapshot(t)).toEqual(before);
    });

    it('keeps ordinary admin enhancement and the ordinary legacy installed-client contract', async () => {
        const { t, admin, ids } = await setup();
        expect(await admin.mutation(api.hyperagent.triggerStudioRenderPublic, { submissionId: ids.ordinary })).toEqual({ success: true });
        expect(await t.mutation(api.airtable.triggerAirtablePush, { submissionId: ids.ordinary })).toEqual({ success: true });
        expect((await snapshot(t)).jobs.map((job) => job.name)).toEqual(['hyperagent:triggerStudioRender', 'airtable:pushToAirtableInternal']);
    });

    it('skips old Studio and Airtable jobs for pending, rejected or unreviewed giveaway rows before network work', async () => {
        const { t, ids } = await setup();
        const network = vi.fn();
        vi.stubGlobal('fetch', network);
        try {
            await t.run((ctx) => ctx.db.patch(ids.rejected, { reviewedAt: NOW, reviewedBy: REVIEWER }));
            const before = await snapshot(t);
            for (const submissionId of [ids.pending, ids.rejected, ids.approved]) {
                await t.action(internal.hyperagent.triggerStudioRender, { submissionId });
                await t.action(internal.airtable.pushToAirtable, { submissionId });
            }
            expect(network).not.toHaveBeenCalled();
            expect(await snapshot(t)).toEqual(before);
        } finally { vi.unstubAllGlobals(); }
    });

    it('renders approved giveaway business photos, excluding poster proof, using the existing Studio webhook', async () => {
        const { t, reviewer, ids } = await setup();
        await reviewer.mutation(api.giveaway.approveApplication, { submissionId: ids.pending });
        vi.stubEnv('HYPERAGENT_WEBHOOK_URL', 'https://studio.example.com/hook');
        vi.stubEnv('HYPERAGENT_WEBHOOK_TOKEN', 'fixture-token');
        const network = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', network);
        try {
            await t.action(internal.hyperagent.triggerStudioRender, { submissionId: ids.pending });
            expect(network).toHaveBeenCalledTimes(1);
            expect(network.mock.calls[0][0]).toBe('https://studio.example.com/hook');
            const payload = JSON.parse(network.mock.calls[0][1].body);
            expect(payload.photos).toEqual([{ role: 'headshot', url: 'https://uploads.example.com/site-only.jpg' }]);
            expect(JSON.stringify(payload)).not.toContain('poster.jpg');
            expect((await t.run((ctx) => ctx.db.get(ids.pending)))?.airtableSyncStatus).toBe('pushed');
        } finally { vi.unstubAllGlobals(); }
    });

    it('schedules enhancement from the existing admin approval API too', async () => {
        const { t, admin, ids } = await setup();
        await admin.mutation(api.admin.approveSubmission, { submissionId: ids.pending, adminId: ADMIN });
        expect((await t.run((ctx) => ctx.db.get(ids.pending)))?.reviewedBy).toBe(ADMIN);
        expect((await snapshot(t)).jobs.filter((job) => job.name === 'hyperagent:triggerStudioRender')).toHaveLength(1);
    });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert('creators', {
            clerkId: ADMIN, email: 'admin@example.com', role: 'admin', status: 'active',
        });
        for (const role of ['creator', 'affiliate', 'staff']) {
            await ctx.db.insert('creators', { clerkId: role, email: `${role}@example.com`, role, status: 'active' });
        }
        for (const [clerkId, extra] of [
            ['suspended', { status: 'suspended' }], ['deleted', { status: 'deleted' }], ['soft-deleted', { isDeleted: true }],
        ] as const) {
            await ctx.db.insert('creators', { clerkId, email: `${clerkId}@example.com`, role: 'admin', ...extra });
        }
        await ctx.db.insert('settings', { key: 'giveaway', value: { enabled: true, cap: 3 }, updatedAt: NOW });
        const base = {
            creatorId, businessName: 'Corner Shop', businessType: 'Barber/Salon', ownerName: 'Sam',
            ownerPhone: '09171234567', ownerEmail: 'sam@example.com', address: '123 Main Street', city: 'Quezon City',
            status: 'submitted', giveawayApplication: true, giveawayPosterPhoto: 'https://uploads.example.com/poster.jpg',
            amount: 0, creatorPayout: 0, airtableSyncStatus: 'pending_review',
            transcript: 'Private website interview', photos: ['https://uploads.example.com/site-only.jpg'],
        };
        const approved = await ctx.db.insert('submissions', { ...base, businessName: 'Approved', status: 'approved' });
        const pending = await ctx.db.insert('submissions', base);
        const delivered = await ctx.db.insert('submissions', { ...base, businessName: 'Delivered', status: 'completed', pricingMode: 'comped' });
        const rejected = await ctx.db.insert('submissions', { ...base, businessName: 'Rejected', status: 'rejected', rejectionReason: 'Old reason' });
        const ordinary = await ctx.db.insert('submissions', { ...base, businessName: 'Private paid business', giveawayApplication: undefined, amount: 4999, creatorPayout: 2499.5 });
        return { creatorId, pending, approved, delivered, rejected, ordinary };
    });
    return { t, ids, reviewer: t.withIdentity({ subject: REVIEWER }), admin: t.withIdentity({ subject: ADMIN }) };
}

async function snapshot(t: Backend) {
    return t.run(async (ctx) => ({
        applications: await ctx.db.query('submissions').collect(),
        accounts: await ctx.db.query('creators').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
}

describe('OTR giveaway reviewer authorization and scope', () => {
    it.each([null, 'creator', 'affiliate', 'staff', 'suspended', 'deleted', 'soft-deleted', 'user_otr_review', 'user_otr_reviewer_extra'])
    ('denies %s before reading the queue, changing applications, or scheduling work', async (subject) => {
        const { t, ids } = await setup();
        if (subject && ['suspended', 'deleted', 'soft-deleted'].includes(subject)) {
            vi.stubEnv('OTR_GIVEAWAY_REVIEWER_IDS', `${REVIEWER},${subject}`);
        }
        const caller = subject ? t.withIdentity({ subject }) : t;
        const before = await snapshot(t);
        expect(await caller.query(api.giveaway.reviewerSession)).toEqual({ canReview: false, isAdmin: false, clerkId: subject });
        await expect(caller.query(api.giveaway.reviewQueue)).rejects.toThrow(subject ? 'reviewer access' : 'Not authenticated');
        await expect(caller.mutation(api.giveaway.approveApplication, { submissionId: ids.pending })).rejects.toThrow();
        await expect(caller.mutation(api.giveaway.rejectApplication, { submissionId: ids.pending, reason: 'Poster is missing.' })).rejects.toThrow();
        expect(await snapshot(t)).toEqual(before);
    });

    it('permits exact invited Clerk-only users and existing admins without creating or changing accounts', async () => {
        const { t, reviewer, admin } = await setup();
        const before = (await snapshot(t)).accounts;
        expect(await reviewer.query(api.giveaway.reviewerSession)).toEqual({ canReview: true, isAdmin: false, clerkId: REVIEWER });
        expect(await t.withIdentity({ subject: 'user_second_reviewer' }).query(api.giveaway.reviewerSession))
            .toEqual({ canReview: true, isAdmin: false, clerkId: 'user_second_reviewer' });
        vi.stubEnv('OTR_GIVEAWAY_REVIEWER_IDS', '');
        expect(await admin.query(api.giveaway.reviewerSession)).toEqual({ canReview: true, isAdmin: true, clerkId: ADMIN });
        expect((await snapshot(t)).accounts).toEqual(before);
        expect(await reviewer.query(api.giveaway.reviewerSession)).toEqual({ canReview: false, isAdmin: false, clerkId: REVIEWER });
    });

    it('rechecks invitation revocation and account suspension on decisions', async () => {
        const { t, reviewer, ids } = await setup();
        expect((await reviewer.query(api.giveaway.reviewQueue)).applications).toHaveLength(4);
        vi.stubEnv('OTR_GIVEAWAY_REVIEWER_IDS', '');
        await expect(reviewer.mutation(api.giveaway.approveApplication, { submissionId: ids.pending })).rejects.toThrow('reviewer access');
        vi.stubEnv('OTR_GIVEAWAY_REVIEWER_IDS', REVIEWER);
        await t.run((ctx) => ctx.db.insert('creators', { clerkId: REVIEWER, email: 'reviewer@example.com', role: 'creator', status: 'suspended' }));
        await expect(reviewer.mutation(api.giveaway.rejectApplication, { submissionId: ids.pending, reason: 'Wrong poster.' })).rejects.toThrow('reviewer access');
        expect((await t.run((ctx) => ctx.db.get(ids.pending)))?.status).toBe('submitted');
    });

    it('exposes only giveaway review fields with pending rows first, never private website/payment/account details', async () => {
        const { reviewer, ids } = await setup();
        const queue = await reviewer.query(api.giveaway.reviewQueue);
        expect(queue).toMatchObject({ held: 3, given: 1, slotsLeft: 0, cap: 3, enabled: true, open: false });
        expect(queue.applications[0]).toMatchObject({ id: ids.pending, posterPhotoUrl: 'https://uploads.example.com/poster.jpg', canReview: true, givenFree: false });
        expect(queue.applications.find((row) => row.id === ids.delivered)).toMatchObject({ givenFree: true, canReview: false });
        expect(queue.applications.some((row) => row.id === ids.ordinary)).toBe(false);
        for (const row of queue.applications) {
            for (const key of ['creatorId', 'amount', 'creatorPayout', 'photos', 'transcript', 'interviewQa', 'payoutDetails', 'paymentToken']) {
                expect(row).not.toHaveProperty(key);
            }
        }
    });

    it('does not grant invited reviewers admin powers or honor writable settings as invitations', async () => {
        const { t, reviewer, ids } = await setup();
        await expect(reviewer.query(api.admin.getPendingPayouts)).rejects.toThrow('admin access');
        await expect(reviewer.query(api.submissions.getByIdWithCreator, { id: ids.ordinary })).rejects.toThrow('admin access');
        await expect(reviewer.mutation(api.admin.approveSubmission, { submissionId: ids.ordinary, adminId: REVIEWER })).rejects.toThrow('admin access');
        await expect(reviewer.mutation(api.giveaway.setEnabled, { enabled: false })).rejects.toThrow('admin access');
        await t.run((ctx) => ctx.db.insert('settings', { key: 'OTR_GIVEAWAY_REVIEWER_IDS', value: 'creator', updatedAt: NOW }));
        await expect(t.withIdentity({ subject: 'creator' }).query(api.giveaway.reviewQueue)).rejects.toThrow('reviewer access');
    });

    it('rechecks application membership on both decisions, including for admins', async () => {
        const { t, reviewer, admin, ids } = await setup();
        const before = await snapshot(t);
        for (const caller of [reviewer, admin]) {
            await expect(caller.mutation(api.giveaway.approveApplication, { submissionId: ids.ordinary })).rejects.toThrow('not found');
            await expect(caller.mutation(api.giveaway.rejectApplication, { submissionId: ids.ordinary, reason: 'Wrong poster.' })).rejects.toThrow('not found');
        }
        expect(await snapshot(t)).toEqual(before);
    });
});

describe('OTR giveaway review decisions', () => {
    it('approves eligibility once with the session actor, keeps the slot held and starts enhancement once without publishing or charging', async () => {
        const { t, reviewer, ids } = await setup();
        await reviewer.mutation(api.giveaway.approveApplication, { submissionId: ids.pending });
        const after = await snapshot(t);
        expect(after.applications.find((row) => row._id === ids.pending)).toMatchObject({
            status: 'approved', reviewedBy: REVIEWER, reviewedAt: NOW, airtableSyncStatus: 'pending_push', amount: 0, creatorPayout: 0,
        });
        expect(after.jobs.filter((job) => job.name === 'hyperagent:triggerStudioRender')).toHaveLength(1);
        expect(after.jobs.find((job) => job.name === 'auditLogs:log')?.args[0]).toMatchObject({ adminId: REVIEWER, action: 'submission_approved' });
        expect(after.jobs.some((job) => job.name.includes('payments') || job.name.includes('publish'))).toBe(false);
        expect((await reviewer.query(api.giveaway.reviewQueue)).held).toBe(3);
        await reviewer.mutation(api.giveaway.approveApplication, { submissionId: ids.pending });
        expect(await snapshot(t)).toEqual(after);
    });

    it('rejects once, releases the slot, schedules the owner reason email and leaves previous rejected rows alone', async () => {
        const { t, reviewer, ids } = await setup();
        await reviewer.mutation(api.giveaway.rejectApplication, { submissionId: ids.pending, reason: '  Please hang the Off the Record poster where customers can see it.  ' });
        const after = await snapshot(t);
        expect(after.applications.find((row) => row._id === ids.pending)).toMatchObject({
            status: 'rejected', reviewedBy: REVIEWER, reviewedAt: NOW,
            rejectionReason: 'Please hang the Off the Record poster where customers can see it.',
        });
        expect(after.jobs.filter((job) => job.name === 'giveawayEmails:sendRejected').map((job) => job.args[0])).toEqual([{
            submissionId: ids.pending, reviewedAt: NOW, reason: 'Please hang the Off the Record poster where customers can see it.',
        }]);
        expect(after.jobs.some((job) => job.name === 'hyperagent:triggerStudioRender')).toBe(false);
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 1, given: 1 });
        await reviewer.mutation(api.giveaway.rejectApplication, { submissionId: ids.pending, reason: 'Repeated click.' });
        expect(await snapshot(t)).toEqual(after);
    });

    it.each(['', ' ', 'x'.repeat(501)])('refuses an invalid rejection reason without releasing a slot (%s)', async (reason) => {
        const { t, reviewer, ids } = await setup();
        const before = await snapshot(t);
        await expect(reviewer.mutation(api.giveaway.rejectApplication, { submissionId: ids.pending, reason })).rejects.toThrow(/reason/);
        expect(await snapshot(t)).toEqual(before);
    });

    it('requires a poster before approval, while rejection can explain missing evidence', async () => {
        const { t, reviewer, ids } = await setup();
        await t.run((ctx) => ctx.db.patch(ids.pending, { giveawayPosterPhoto: undefined }));
        await expect(reviewer.mutation(api.giveaway.approveApplication, { submissionId: ids.pending })).rejects.toThrow('poster photo');
        await reviewer.mutation(api.giveaway.rejectApplication, { submissionId: ids.pending, reason: 'Please upload the photo of the OTR poster in your shop.' });
        expect((await t.run((ctx) => ctx.db.get(ids.pending)))?.status).toBe('rejected');
    });

    it('cannot reverse a rejection, demote approved work, or alter a delivered website', async () => {
        const { t, reviewer, ids } = await setup();
        const before = await snapshot(t);
        for (const id of [ids.rejected, ids.delivered]) {
            await expect(reviewer.mutation(api.giveaway.approveApplication, { submissionId: id })).rejects.toThrow('already been reviewed');
        }
        for (const id of [ids.approved, ids.delivered]) {
            await expect(reviewer.mutation(api.giveaway.rejectApplication, { submissionId: id, reason: 'Changed my mind.' })).rejects.toThrow('already been reviewed');
        }
        expect(await snapshot(t)).toEqual(before);
    });

    it('does not schedule another enhancement for legacy applications already pushed to Studio', async () => {
        const { t, reviewer, ids } = await setup();
        await t.run((ctx) => ctx.db.patch(ids.pending, { airtableSyncStatus: 'pushed' }));
        await reviewer.mutation(api.giveaway.approveApplication, { submissionId: ids.pending });
        expect((await snapshot(t)).jobs.some((job) => job.name === 'hyperagent:triggerStudioRender')).toBe(false);
    });
});
