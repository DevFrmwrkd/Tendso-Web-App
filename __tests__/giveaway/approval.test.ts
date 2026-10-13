import { convexTest } from 'convex-test';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './admin.ts': () => import('../../convex/admin'),
    './giveaway.ts': () => import('../../convex/giveaway'),
    './giveawayEmails.ts': () => import('../../convex/giveawayEmails'),
    './submissions.ts': () => import('../../convex/submissions'),
};
const adminId = 'giveaway-approval-admin';
const reviewer = 'user_otr_approval_reviewer';
const now = Date.UTC(2026, 9, 13, 4);

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv('OTR_GIVEAWAY_REVIEWER_IDS', reviewer);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup(status = 'submitted', giveawayApplication = true) {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert('creators', { clerkId: adminId, email: 'admin@example.com', role: 'admin' });
        await ctx.db.insert('settings', { key: 'giveaway', value: { enabled: true, cap: 3 }, updatedAt: now });
        return ctx.db.insert('submissions', {
            creatorId, businessName: 'Corner Shop', businessType: 'Salon', ownerName: 'Sam', ownerPhone: '9171234567',
            ownerEmail: 'owner@example.com', address: '123 Main Street', city: 'Quezon City', status,
            giveawayApplication, amount: giveawayApplication ? 0 : 4999,
            giveawayPosterPhoto: 'https://uploads.example.com/poster.jpg',
        });
    });
    const row = () => t.run((ctx) => ctx.db.get(id));
    const jobs = () => t.run(async (ctx) => (await ctx.db.system.query('_scheduled_functions').collect())
        .filter((job) => job.name === 'giveawayEmails:sendApproved'));
    return { t, id, row, jobs, otr: t.withIdentity({ subject: reviewer }), admin: t.withIdentity({ subject: adminId }) };
}

describe('giveaway approval email', () => {
    it('schedules one owner email when OTR approves, even across repeated taps', async () => {
        const { otr, id, row, jobs } = await setup();
        await otr.mutation(api.giveaway.approveApplication, { submissionId: id });
        await otr.mutation(api.giveaway.approveApplication, { submissionId: id });
        expect(await row()).toMatchObject({ status: 'approved', reviewedAt: now });
        expect((await jobs()).map((job) => job.args[0])).toEqual([{ submissionId: id, reviewedAt: now }]);
        expect((await row())?.giveawayApprovedEmailSentAt).toBeUndefined();
    });

    it('also tells the owner when an admin approves from the queue', async () => {
        const { admin, id, jobs } = await setup('in_review');
        await admin.mutation(api.admin.approveSubmission, { submissionId: id, adminId });
        expect(await jobs()).toHaveLength(1);
    });

    it('sends nothing for an ordinary paid submission or a row already past review', async () => {
        const ordinary = await setup('submitted', false);
        await ordinary.admin.mutation(api.admin.approveSubmission, { submissionId: ordinary.id, adminId });
        expect(await ordinary.jobs()).toEqual([]);
        const delivered = await setup('completed');
        await delivered.admin.mutation(api.admin.approveSubmission, { submissionId: delivered.id, adminId });
        expect(await delivered.jobs()).toEqual([]);
    });

    it('records delivery for the current approval only', async () => {
        const { t, otr, id, row } = await setup();
        await otr.mutation(api.giveaway.approveApplication, { submissionId: id });
        vi.stubEnv('INTERNAL_API_SECRET', 'test-secret');
        vi.stubEnv('SITE_URL', 'https://app.example.com');
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, sent: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await t.action(internal.giveawayEmails.sendApproved, { submissionId: id, reviewedAt: now });
        expect(fetchMock).toHaveBeenCalledWith('https://app.example.com/api/internal/send-giveaway-approved-email', expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': 'test-secret' },
        }));
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ submissionId: id, reviewedAt: now });
        expect((await row())?.giveawayApprovedEmailSentAt).toBe(now);

        // A stale callback for an older review, or after a rejection, records nothing.
        await t.run((ctx) => ctx.db.patch(id, { giveawayApprovedEmailSentAt: undefined }));
        await t.mutation(internal.giveawayEmails.markApprovedSent, { submissionId: id, reviewedAt: now - 1 });
        expect((await row())?.giveawayApprovedEmailSentAt).toBeUndefined();
        await t.run((ctx) => ctx.db.patch(id, { status: 'rejected' }));
        await t.mutation(internal.giveawayEmails.markApprovedSent, { submissionId: id, reviewedAt: now });
        expect((await row())?.giveawayApprovedEmailSentAt).toBeUndefined();
    });

    it('leaves the approval in place and records no delivery when transport fails', async () => {
        const { t, otr, id, row } = await setup();
        await otr.mutation(api.giveaway.approveApplication, { submissionId: id });
        vi.stubEnv('INTERNAL_API_SECRET', 'test-secret');
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Mailer down', { status: 500 })));
        await t.action(internal.giveawayEmails.sendApproved, { submissionId: id, reviewedAt: now });
        expect(await row()).toMatchObject({ status: 'approved' });
        expect((await row())?.giveawayApprovedEmailSentAt).toBeUndefined();
    });
});
