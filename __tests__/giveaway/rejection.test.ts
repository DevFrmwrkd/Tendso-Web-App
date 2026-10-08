import { convexTest } from 'convex-test';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './admin.ts': () => import('../../convex/admin'),
    './giveaway.ts': () => import('../../convex/giveaway'),
    './giveawayEmails.ts': () => import('../../convex/giveawayEmails'),
    './ownerIntake.ts': () => import('../../convex/ownerIntake'),
    './submissions.ts': () => import('../../convex/submissions'),
};
const adminId = 'giveaway-review-admin';
const reason = 'The poster is not visible. Please photograph it with your shop sign.';
const now = Date.UTC(2026, 9, 11, 4);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup(giveawayApplication = true) {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert('creators', { clerkId: adminId, email: 'admin@example.com', role: 'admin' });
        await ctx.db.insert('creators', { clerkId: 'ordinary-creator', email: 'creator@example.com', role: 'creator' });
        await ctx.db.insert('settings', { key: 'giveaway', value: { enabled: true, cap: 1 }, updatedAt: now });
        return ctx.db.insert('submissions', {
            creatorId, businessName: 'Corner Shop', businessType: 'Salon', ownerName: 'Sam', ownerPhone: '9171234567',
            ownerEmail: 'owner@example.com', address: '123 Main Street', city: 'Quezon City', status: 'submitted',
            giveawayApplication, amount: giveawayApplication ? 0 : 4999,
        });
    });
    const admin = t.withIdentity({ subject: adminId });
    const row = () => t.run((ctx) => ctx.db.get(id));
    const jobs = () => t.run(async (ctx) => (await ctx.db.system.query('_scheduled_functions').collect())
        .filter((job) => job.name === 'giveawayEmails:sendRejected'));
    return { t, admin, id, row, jobs };
}

describe('giveaway review rejection', () => {
    it('atomically releases the slot and schedules one owner email across repeated/concurrent taps', async () => {
        const { t, admin, id, row, jobs } = await setup();
        expect((await t.query(api.giveaway.giveawayStatus)).open).toBe(false);
        await Promise.all([
            admin.mutation(api.admin.rejectSubmission, { submissionId: id, adminId, reason: `  ${reason}  ` }),
            admin.mutation(api.admin.rejectSubmission, { submissionId: id, adminId, reason }),
        ]);
        expect(await row()).toMatchObject({ status: 'rejected', rejectionReason: reason, reviewedBy: adminId, reviewedAt: now });
        expect(await t.query(api.giveaway.giveawayStatus)).toEqual({ open: true, slotsLeft: 1, given: 0 });
        expect((await jobs()).map((job) => job.args[0])).toEqual([{ submissionId: id, reviewedAt: now, reason }]);
        expect((await row())?.giveawayRejectedEmailSentAt).toBeUndefined();
    });

    it('requires a matching authenticated admin and a reason without touching the reservation', async () => {
        const { t, admin, id, row, jobs } = await setup();
        await expect(t.mutation(api.admin.rejectSubmission, { submissionId: id, adminId, reason })).rejects.toThrow('Not authenticated');
        await expect(t.withIdentity({ subject: 'ordinary-creator' }).mutation(api.admin.rejectSubmission, { submissionId: id, adminId, reason })).rejects.toThrow('admin access');
        await expect(admin.mutation(api.admin.rejectSubmission, { submissionId: id, adminId: 'forged-reviewer', reason })).rejects.toThrow('does not match');
        await expect(admin.mutation(api.admin.rejectSubmission, { submissionId: id, adminId, reason: '  ' })).rejects.toThrow('reason');
        expect((await row())?.status).toBe('submitted');
        expect(await jobs()).toEqual([]);
        expect((await t.query(api.giveaway.giveawayStatus)).slotsLeft).toBe(0);
    });

    it('keeps the ordinary/mobile optional reason contract without mailing a giveaway rejection', async () => {
        const { t, id, row, jobs } = await setup(false);
        await t.mutation(api.admin.rejectSubmission, { submissionId: id, adminId });
        expect((await row())?.status).toBe('rejected');
        expect(await jobs()).toEqual([]);
    });
    it('blocks the generic status mutation from bypassing the giveaway rejection reason and email', async () => {
        const { t, admin, id, row, jobs } = await setup();
        for (const caller of [t, admin]) {
            await expect(caller.mutation(api.submissions.updateStatus, { id, status: 'rejected' })).rejects.toThrow('admin review action');
        }
        expect((await row())?.status).toBe('submitted');
        expect(await jobs()).toEqual([]);
        expect((await t.query(api.giveaway.giveawayStatus)).slotsLeft).toBe(0);
        const ordinary = await setup(false);
        await ordinary.t.mutation(api.submissions.updateStatus, { id: ordinary.id, status: 'rejected' });
        expect((await ordinary.row())?.status).toBe('rejected');
    });

    it('records successful delivery and ignores stale sent callbacks after reactivation', async () => {
        const { t, admin, id, row } = await setup();
        await admin.mutation(api.admin.rejectSubmission, { submissionId: id, adminId, reason });
        vi.stubEnv('INTERNAL_API_SECRET', 'test-secret');
        vi.stubEnv('SITE_URL', 'https://app.example.com');
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, sent: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await t.action(internal.giveawayEmails.sendRejected, { submissionId: id, reviewedAt: now, reason });
        expect(fetchMock).toHaveBeenCalledWith('https://app.example.com/api/internal/send-giveaway-rejected-email', expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': 'test-secret' },
        }));
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ submissionId: id, reviewedAt: now, reason });
        expect((await row())?.giveawayRejectedEmailSentAt).toBe(now);
        await t.run((ctx) => ctx.db.patch(id, { status: 'approved', giveawayRejectedEmailSentAt: undefined }));
        await t.mutation(internal.giveawayEmails.markRejectedSent, { submissionId: id, reviewedAt: now });
        expect((await row())?.giveawayRejectedEmailSentAt).toBeUndefined();
    });

    it('leaves the slot released and records no delivery when transport fails or skips a stale event', async () => {
        const { t, admin, id, row } = await setup();
        await admin.mutation(api.admin.rejectSubmission, { submissionId: id, adminId, reason });
        vi.stubEnv('INTERNAL_API_SECRET', 'test-secret');
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const fetchMock = vi.fn().mockResolvedValueOnce(new Response('Mailer down', { status: 500 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, sent: false }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await t.action(internal.giveawayEmails.sendRejected, { submissionId: id, reviewedAt: now, reason });
        await t.action(internal.giveawayEmails.sendRejected, { submissionId: id, reviewedAt: now, reason });
        expect((await row())?.giveawayRejectedEmailSentAt).toBeUndefined();
        expect((await t.query(api.giveaway.giveawayStatus)).slotsLeft).toBe(1);
    });

    it('stamps acknowledgement only when its internal bridge actually sends', async () => {
        const { t, id, row } = await setup();
        vi.stubEnv('INTERNAL_API_SECRET', 'test-secret');
        const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: true, sent: false }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, sent: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await t.action(internal.ownerIntake.sendIntakeReceivedEmailAction, { submissionId: id });
        expect((await row())?.intakeReceivedEmailSentAt).toBeUndefined();
        await t.action(internal.ownerIntake.sendIntakeReceivedEmailAction, { submissionId: id });
        expect((await row())?.intakeReceivedEmailSentAt).toBe(now);
    });
});
