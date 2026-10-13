import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './giveaway.ts': () => import('../../convex/giveaway'),
    './admin.ts': () => import('../../convex/admin'),
    './submissions.ts': () => import('../../convex/submissions'),
};
const NOW = Date.UTC(2026, 9, 13, 3);
const OTR = 'user_otr_reviewer';
const ADMIN = 'user_admin';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // Admin precedence must also hold if an operator includes an admin here.
    vi.stubEnv('OTR_GIVEAWAY_REVIEWER_IDS', ` , ${OTR}, ${ADMIN}, `);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function setup() {
    const t = convexTest(schema, modules);
    const creatorId = await t.run(async (ctx) => {
        await ctx.db.insert('creators', { clerkId: ADMIN, email: 'admin@example.com', role: 'admin', status: 'active' });
        await ctx.db.insert('creators', { clerkId: OTR, email: 'otr@example.com', role: 'creator', status: 'active' });
        await ctx.db.insert('settings', { key: 'giveaway', value: { enabled: true, cap: 100 }, updatedAt: NOW });
        return ctx.db.insert('creators', { clerkId: 'creator', email: 'creator@example.com', role: 'creator', status: 'active' });
    });
    const insert = (overrides: Partial<Doc<'submissions'>> = {}) => t.run((ctx) => ctx.db.insert('submissions', {
        creatorId, businessName: 'Corner Shop', businessType: 'Salon', ownerName: 'Sam', ownerPhone: '09171234567',
        address: 'Main Street', city: 'Manila', status: 'submitted', giveawayApplication: true,
        giveawayPosterPhoto: 'https://uploads.example.com/poster.jpg', airtableSyncStatus: 'pending_review',
        amount: 0, creatorPayout: 0, ...overrides,
    }));
    return { t, insert, admin: t.withIdentity({ subject: ADMIN }), otr: t.withIdentity({ subject: OTR }) };
}

describe('server-stamped giveaway decision provenance', () => {
    it.each([
        ['otr', 'approve'], ['otr', 'reject'], ['admin', 'approve'], ['admin', 'reject'],
    ] as const)('records %s for a %s decision made on the OTR review page', async (source, decision) => {
        const context = await setup();
        const id = await context.insert();
        const actor = context[source];
        if (decision === 'approve') await actor.mutation(api.giveaway.approveApplication, { submissionId: id });
        else await actor.mutation(api.giveaway.rejectApplication, { submissionId: id, reason: 'Poster is not visible.' });
        const row = await context.t.run((ctx) => ctx.db.get(id));
        expect(row).toMatchObject({
            giveawayReviewSource: source, reviewedBy: source === 'otr' ? OTR : ADMIN, reviewedAt: NOW,
            status: decision === 'approve' ? 'approved' : 'rejected',
        });
        const jobs = await context.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === (decision === 'approve' ? 'giveawayEmails:sendApproved' : 'giveawayEmails:sendRejected'))).toHaveLength(1);
        // Repeated decisions remain no-ops, including when the other actor repeats them.
        if (decision === 'approve') await context.admin.mutation(api.giveaway.approveApplication, { submissionId: id });
        else await context.admin.mutation(api.giveaway.rejectApplication, { submissionId: id, reason: 'Repeated tap.' });
        expect(await context.t.run((ctx) => ctx.db.get(id))).toEqual(row);
        expect(await context.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual(jobs);
    });

    it.each(['approve', 'reject'] as const)('defaults to admin for the existing admin %s action and leaves ordinary submissions unchanged', async (decision) => {
        const { t, admin, insert } = await setup();
        for (const giveawayApplication of [true, false]) {
            const id = await insert({ giveawayApplication });
            if (decision === 'approve') await admin.mutation(api.admin.approveSubmission, { submissionId: id, adminId: ADMIN });
            else await admin.mutation(api.admin.rejectSubmission, { submissionId: id, adminId: ADMIN, reason: 'Poster is not visible.' });
            expect((await t.run((ctx) => ctx.db.get(id)))?.giveawayReviewSource).toBe(giveawayApplication ? 'admin' : undefined);
        }
    });

    it('rejects browser-supplied provenance, forged administrator IDs and unauthorized reviewers before any writes', async () => {
        const { t, admin, otr, insert } = await setup();
        const id = await insert();
        const before = await t.run((ctx) => ctx.db.get(id));
        await expect(otr.mutation(api.giveaway.approveApplication, { submissionId: id, giveawayReviewSource: 'admin' } as never)).rejects.toThrow();
        await expect(otr.mutation(api.giveaway.rejectApplication, { submissionId: id, reason: 'Wrong poster.', giveawayReviewSource: 'admin' } as never)).rejects.toThrow();
        await expect(admin.mutation(api.admin.approveSubmission, { submissionId: id, adminId: ADMIN, giveawayReviewSource: 'otr' } as never)).rejects.toThrow();
        await expect(admin.mutation(api.admin.rejectSubmission, { submissionId: id, adminId: OTR, reason: 'Wrong poster.' })).rejects.toThrow('does not match');
        await expect(t.withIdentity({ subject: 'creator' }).mutation(api.giveaway.approveApplication, { submissionId: id })).rejects.toThrow('reviewer access');
        await expect(t.mutation(api.giveaway.rejectApplication, { submissionId: id, reason: 'Wrong poster.' })).rejects.toThrow('Not authenticated');
        expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('does not assign a new reviewer to previously approved or rejected legacy applications on repeat decisions', async () => {
        const { t, admin, insert } = await setup();
        const approved = await insert({ status: 'approved', reviewedBy: 'unknown-old-reviewer', reviewedAt: NOW - 1 });
        const rejected = await insert({ status: 'rejected', reviewedBy: 'unknown-old-reviewer', reviewedAt: NOW - 1 });
        await admin.mutation(api.giveaway.approveApplication, { submissionId: approved });
        await admin.mutation(api.giveaway.rejectApplication, { submissionId: rejected, reason: 'Repeated tap.' });
        for (const id of [approved, rejected]) {
            expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ reviewedBy: 'unknown-old-reviewer', reviewedAt: NOW - 1 });
            expect((await t.run((ctx) => ctx.db.get(id)))?.giveawayReviewSource).toBeUndefined();
        }
        expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('preserves the OTR eligibility decision when an admin approves later website work', async () => {
        const { t, admin, otr, insert } = await setup();
        const id = await insert();
        await otr.mutation(api.giveaway.approveApplication, { submissionId: id });
        await t.run((ctx) => ctx.db.patch(id, { status: 'website_generated' }));
        await admin.mutation(api.admin.approveSubmission, { submissionId: id, adminId: ADMIN });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
            status: 'approved', reviewedBy: OTR, reviewedAt: NOW, giveawayReviewSource: 'otr',
        });
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'giveawayEmails:sendApproved')).toHaveLength(1);
        expect(jobs.filter((job) => job.name === 'hyperagent:triggerStudioRender')).toHaveLength(1);
        expect(jobs.filter((job) => job.name === 'auditLogs:log').map((job) => job.args[0])).toEqual([
            expect.objectContaining({ adminId: OTR, action: 'submission_approved' }),
            expect.objectContaining({ adminId: ADMIN, action: 'submission_approved' }),
        ]);
    });

    it('keeps a legacy source unknown on later website approval but replaces provenance after rejection and reopening', async () => {
        const { t, admin, otr, insert } = await setup();
        const legacy = await insert({ status: 'website_generated', reviewedBy: 'unknown-reviewer', reviewedAt: NOW - 10 });
        await admin.mutation(api.admin.approveSubmission, { submissionId: legacy, adminId: ADMIN });
        expect(await t.run((ctx) => ctx.db.get(legacy))).toMatchObject({ reviewedBy: 'unknown-reviewer', reviewedAt: NOW - 10 });
        expect((await t.run((ctx) => ctx.db.get(legacy)))?.giveawayReviewSource).toBeUndefined();
        const reopened = await insert({ ownerPhone: '09171234568' });
        await otr.mutation(api.giveaway.rejectApplication, { submissionId: reopened, reason: 'Poster is not visible.' });
        await admin.mutation(api.submissions.updateStatus, { id: reopened, status: 'in_review' });
        await admin.mutation(api.admin.approveSubmission, { submissionId: reopened, adminId: ADMIN });
        expect(await t.run((ctx) => ctx.db.get(reopened))).toMatchObject({
            status: 'approved', reviewedBy: ADMIN, reviewedAt: NOW + 1, giveawayReviewSource: 'admin',
        });
    });
});

describe('legacy giveaway provenance in admin submission reads', () => {
    it('uses the reviewer admin role first, otherwise the exact OTR server allowlist; never assumes all creators are OTR', async () => {
        const { t, admin, otr, insert } = await setup();
        const cases = [
            { reviewedBy: ADMIN, expected: 'admin' },
            { reviewedBy: OTR, expected: 'otr' },
            { reviewedBy: 'creator', expected: undefined },
            { reviewedBy: `${OTR}_extra`, expected: undefined },
            { reviewedBy: 'deleted-or-unknown-reviewer', expected: undefined },
            { reviewedBy: undefined, expected: undefined },
        ] as const;
        const ids: Id<'submissions'>[] = [];
        for (const { reviewedBy } of cases) ids.push(await insert({ status: 'approved', reviewedBy, reviewedAt: NOW }));
        const rows = await admin.query(api.submissions.getAllWithCreator);
        for (let index = 0; index < cases.length; index++) {
            expect(rows.find((row) => row._id === ids[index])?.giveawayReviewSource).toBe(cases[index].expected);
            const detail = await admin.query(api.submissions.getByIdWithCreator, { id: ids[index] });
            expect(detail?.giveawayReviewSource).toBe(cases[index].expected);
            // Optional account names must leave the UI's OTR/Admin fallback usable.
            expect(rows.find((row) => row._id === ids[index])?.reviewedByName).toBeNull();
            expect(detail?.reviewedByName).toBeNull();
            // Query enrichment does not rewrite historical rows.
            expect((await t.run((ctx) => ctx.db.get(ids[index])))?.giveawayReviewSource).toBeUndefined();
        }
        await expect(otr.query(api.submissions.getAllWithCreator)).rejects.toThrow('admin access');
        await expect(otr.query(api.submissions.getByIdWithCreator, { id: ids[0] })).rejects.toThrow('admin access');
    });

    it('keeps recorded provenance after invitations and roles change and does not enrich ordinary or unreviewed applications', async () => {
        const { admin, insert } = await setup();
        const stored = await insert({ status: 'approved', reviewedBy: ADMIN, reviewedAt: NOW, giveawayReviewSource: 'otr' });
        const ordinary = await insert({ giveawayApplication: false, status: 'approved', reviewedBy: ADMIN, reviewedAt: NOW });
        const unreviewed = await insert();
        vi.stubEnv('OTR_GIVEAWAY_REVIEWER_IDS', '');
        expect((await admin.query(api.submissions.getByIdWithCreator, { id: stored }))?.giveawayReviewSource).toBe('otr');
        for (const id of [ordinary, unreviewed]) {
            expect((await admin.query(api.submissions.getByIdWithCreator, { id }))?.giveawayReviewSource).toBeUndefined();
        }
        const rows = await admin.query(api.submissions.getAllWithCreator);
        expect(rows.find((row) => row._id === stored)?.giveawayReviewSource).toBe('otr');
        expect(rows.filter((row) => row._id !== stored).every((row) => row.giveawayReviewSource === undefined)).toBe(true);
    });
});
