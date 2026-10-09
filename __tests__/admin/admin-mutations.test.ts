import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './admin.ts': () => import('../../convex/admin'),
    './submissions.ts': () => import('../../convex/submissions'),
};
const NOW = Date.UTC(2026, 9, 9, 8);
const ADMIN = 'session-admin';
type Backend = ReturnType<typeof convexTest<typeof schema.tables>>;
type Caller = Pick<Backend, 'query' | 'mutation' | 'run'>;
type Ids = { creatorId: Id<'creators'>; submissionId: Id<'submissions'> };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
        for (const role of ['admin', 'creator', 'affiliate', 'staff']) {
            await ctx.db.insert('creators', { clerkId: `session-${role}`, email: `${role}@example.com`, role, status: 'active' });
        }
        await ctx.db.insert('creators', { clerkId: 'other-admin', email: 'other@example.com', role: 'admin', status: 'active' });
        await ctx.db.insert('creators', { clerkId: 'suspended-admin', email: 'suspended@example.com', role: 'admin', status: 'suspended' });
        await ctx.db.insert('creators', { clerkId: 'deleted-admin', email: 'deleted@example.com', role: 'admin', status: 'deleted' });
        await ctx.db.insert('creators', { clerkId: 'soft-deleted-admin', email: 'soft-deleted@example.com', role: 'admin', isDeleted: true });
        const creatorId = await ctx.db.insert('creators', {
            clerkId: 'submission-owner', email: 'owner-creator@example.com', role: 'creator', status: 'active',
            firstName: 'Shop', lastName: 'Creator', balance: 0, submissionCount: 1,
        });
        const submissionId = await ctx.db.insert('submissions', {
            creatorId, businessName: 'Corner Shop', businessType: 'Salon', ownerName: 'Sam', ownerPhone: '09171234567',
            ownerEmail: 'shop@example.com', address: 'Main Street', city: 'Quezon City',
            status: 'pending_payment', amount: 1999, creatorPayout: 1000, payoutRequestedAt: NOW,
        });
        await ctx.db.insert('generatedWebsites', { submissionId, publishedUrl: 'https://example.com/shop' });
        return { creatorId, submissionId };
    });
    return { t, ids, admin: t.withIdentity({ subject: ADMIN }) };
}

const mutations: readonly (readonly [string, (caller: Caller, ids: Ids, adminId: string) => Promise<unknown>])[] = [
    ['approveSubmission', (t, ids, adminId) => t.mutation(api.admin.approveSubmission, { submissionId: ids.submissionId, adminId })],
    ['rejectSubmission', (t, ids, adminId) => t.mutation(api.admin.rejectSubmission, { submissionId: ids.submissionId, adminId })],
    ['markWebsiteGenerated', (t, ids, adminId) => t.mutation(api.admin.markWebsiteGenerated, { submissionId: ids.submissionId, adminId })],
    ['markDeployed', (t, ids, adminId) => t.mutation(api.admin.markDeployed, { submissionId: ids.submissionId, adminId })],
    ['markPaid', (t, ids, adminId) => t.mutation(api.admin.markPaid, { submissionId: ids.submissionId, adminId })],
    ['markComped', (t, ids, adminId) => t.mutation(api.admin.markComped, { submissionId: ids.submissionId, adminId })],
    ['logPaymentConfirmed', (t, ids, adminId) => t.mutation(api.admin.logPaymentConfirmed, { submissionId: ids.submissionId, adminId, emailSent: true })],
    ['markEmailSent', (t, ids, adminId) => t.mutation(api.admin.markEmailSent, { submissionId: ids.submissionId, adminId })],
    ['deleteSubmissionRecords', (t, ids, adminId) => t.mutation(api.admin.deleteSubmissionRecords, { submissionId: ids.submissionId, adminId })],
    ['deleteCreatorRecords', (t, ids, adminId) => t.mutation(api.admin.deleteCreatorRecords, { creatorId: ids.creatorId, adminId })],
    ['markPayoutPaid', (t, ids) => t.mutation(api.admin.markPayoutPaid, { submissionId: ids.submissionId })],
    ['backfillWebsiteUrls', (t) => t.mutation(api.admin.backfillWebsiteUrls, {})],
    ['logTranscriptionRegenerated', (t, ids, adminId) => t.mutation(api.admin.logTranscriptionRegenerated, { submissionId: ids.submissionId, adminId })],
    ['logImagesEnhanced', (t, ids, adminId) => t.mutation(api.admin.logImagesEnhanced, { submissionId: ids.submissionId, adminId })],
    ['bulkMarkPayoutsPaid', (t, ids) => t.mutation(api.admin.bulkMarkPayoutsPaid, { submissionIds: [ids.submissionId] })],
    ['updateStatus', (t, ids) => t.mutation(api.submissions.updateStatus, { id: ids.submissionId, status: 'approved' })],
    ['setUnpublished', (t, ids) => t.mutation(api.submissions.setUnpublished, { id: ids.submissionId })],
    ['saveWebsite', (t, ids) => t.mutation(api.submissions.saveWebsite, { id: ids.submissionId, websiteUrl: 'https://example.com/new-shop', websiteCode: '<html>Shop</html>' })],
    ['submissionMarkPaid', (t, ids) => t.mutation(api.submissions.markPaid, { id: ids.submissionId, paymentReference: 'verified-payment' })],
    ['markPayoutComplete', (t, ids) => t.mutation(api.submissions.markPayoutComplete, { id: ids.submissionId })],
];
const queries = [
    (t: Caller) => t.query(api.admin.getPendingPayouts, {}),
    (t: Caller) => t.query(api.admin.getPayoutStats, {}),
    (t: Caller) => t.query(api.admin.getDashboardStats, {}),
    (t: Caller) => t.query(api.admin.getAllSubmissionsWithCreators, {}),
    (t: Caller) => t.query(api.admin.getPromoStats, {}),
    (t: Caller) => t.query(api.admin.checkBackfillNeeded, {}),
];
async function snapshot(t: Backend) {
    return t.run(async (ctx) => ({
        creators: await ctx.db.query('creators').collect(),
        submissions: await ctx.db.query('submissions').collect(),
        websites: await ctx.db.query('generatedWebsites').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
}

describe('session-based admin API authorization', () => {
    it.each([null, 'session-creator', 'session-affiliate', 'session-staff', 'suspended-admin', 'deleted-admin', 'soft-deleted-admin'])
    ('denies every admin operation for %s before writes or scheduled work', async (subject) => {
        const { t, ids } = await setup();
        const caller = subject ? t.withIdentity({ subject }) : t;
        const before = await snapshot(t);
        for (const [, mutate] of mutations) {
            await expect(mutate(caller, ids, ADMIN)).rejects.toThrow(subject ? 'admin access required' : 'Not authenticated');
        }
        for (const query of queries) {
            await expect(query(caller)).rejects.toThrow(subject ? 'admin access required' : 'Not authenticated');
        }
        expect(await snapshot(t)).toEqual(before);
    });

    it('rejects spoofed administrator arguments even when both accounts are admins', async () => {
        const { t, ids, admin } = await setup();
        const before = await snapshot(t);
        const legacyWithoutActor = new Set(['markPayoutPaid', 'backfillWebsiteUrls', 'bulkMarkPayoutsPaid', 'updateStatus', 'setUnpublished', 'saveWebsite', 'submissionMarkPaid', 'markPayoutComplete']);
        for (const [name, mutate] of mutations) {
            if (!legacyWithoutActor.has(name)) await expect(mutate(admin, ids, 'other-admin')).rejects.toThrow('identity does not match');
        }
        expect(await snapshot(t)).toEqual(before);
    });

    it.each(mutations)('keeps the authenticated admin %s operation working', async (_name, mutate) => {
        const { t, ids, admin } = await setup();
        const before = await snapshot(t);
        await mutate(admin, ids, ADMIN);
        expect(await snapshot(t)).not.toEqual(before);
    });

    it('permits administrative reads and identifies only the caller’s own active admin account', async () => {
        const { t, admin } = await setup();
        for (const query of queries) await expect(query(admin)).resolves.toBeDefined();
        expect(await admin.query(api.admin.isAdmin, { clerkId: ADMIN })).toBe(true);
        expect(await admin.query(api.admin.isAdmin, { clerkId: 'other-admin' })).toBe(false);
        expect(await t.query(api.admin.isAdmin, { clerkId: ADMIN })).toBe(false);
        for (const subject of ['session-creator', 'session-affiliate', 'session-staff', 'suspended-admin', 'deleted-admin', 'soft-deleted-admin']) {
            const caller = t.withIdentity({ subject });
            expect(await caller.query(api.admin.isAdmin, { clerkId: subject })).toBe(false);
            expect(await caller.query(api.admin.isAdmin, { clerkId: ADMIN })).toBe(false);
        }
    });

    it('records the session actor on approvals and scheduled payment credit', async () => {
        const { t, ids, admin } = await setup();
        await admin.mutation(api.admin.approveSubmission, { submissionId: ids.submissionId, adminId: ADMIN });
        expect(await t.run((ctx) => ctx.db.get(ids.submissionId))).toMatchObject({ status: 'approved', reviewedBy: ADMIN, reviewedAt: NOW });
        await admin.mutation(api.admin.markPaid, { submissionId: ids.submissionId, adminId: ADMIN });
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'auditLogs:log').map((job) => job.args[0])).toEqual([
            expect.objectContaining({ adminId: ADMIN, action: 'submission_approved', targetId: ids.submissionId }),
        ]);
        expect(jobs.filter((job) => job.name === 'payments:creditCreatorForPayment').map((job) => job.args[0])).toEqual([
            { submissionId: ids.submissionId, triggeredBy: `admin:${ADMIN}` },
        ]);
    });
});
