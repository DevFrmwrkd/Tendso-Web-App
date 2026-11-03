import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './owners.ts': () => import('../../convex/owners'),
    './ownerApp.ts': () => import('../../convex/ownerApp'),
    './ownerPayments.ts': () => import('../../convex/ownerPayments'),
};
const R2 = 'https://uploads.example.test';
const NOW = Date.UTC(2026, 10, 3, 9);
type Test = ReturnType<typeof convexTest>;
type Owner = ReturnType<Test['withIdentity']>;

beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    vi.stubEnv('R2_PUBLIC_URL', R2);
    vi.stubEnv('XENDIT_SECRET_KEY', ''); vi.stubEnv('XENDIT_CALLBACK_TOKEN', '');
    vi.stubEnv('OWNER_APP_DAILY_LIMIT', '50');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function setup() {
    const t = convexTest(schema, modules);
    const houseId = await t.run(ctx => ctx.db.insert('creators', {
        clerkId: 'house', email: 'house@example.test', role: 'creator', status: 'active',
    }));
    vi.stubEnv('SELF_SERVE_CREATOR_ID', houseId);
    const owner = t.withIdentity({ subject: 'owner-ben', email: 'ben@example.test', emailVerified: true });
    const other = t.withIdentity({ subject: 'owner-ana', email: 'ana@example.test', emailVerified: true });
    await owner.mutation(api.owners.ensure, { name: 'Ben Reyes', phone: '09171234567' });
    await other.mutation(api.owners.ensure, { name: 'Ana Cruz' });
    return { t, owner, other };
}

async function draft(owner: Owner, businessName: string, businessType = 'Barber/Salon') {
    return owner.mutation(api.ownerApp.createDraft, { businessName, businessType, address: `${businessName} address`, city: 'Marikina' });
}

async function complete(owner: Owner, submissionId: Id<'submissions'>) {
    for (let index = 0; index < 10; index++) {
        await owner.mutation(api.ownerApp.saveAnswer, { submissionId, index, lang: 'en', answerText: `Answer ${index}` });
    }
    for (let index = 0; index < 3; index++) {
        await owner.mutation(api.ownerApp.saveShot, { submissionId, index, url: `${R2}/${submissionId}/photo-${index}.jpg` });
    }
    await owner.mutation(api.ownerApp.chooseDesign, { submissionId, templateId: 'business:CA' });
}

describe('multiple businesses on one owner account', () => {
    it('reuses a lost-acknowledgement setup reference before the draft limit without overwriting saved work', async () => {
        const { t, owner } = await setup();
        const args = { businessName: 'Forge', businessType: 'Barber/Salon', address: '12 Main St', clientDraftKey: 'new-business_123' };
        const id = await owner.mutation(api.ownerApp.createDraft, args);
        await owner.mutation(api.ownerApp.saveAnswer, { submissionId: id, index: 0, lang: 'en', answerText: 'Saved story' });
        await draft(owner, 'Kalan', 'Restaurant'); await draft(owner, 'Clinic', 'Clinic');
        const before = await owner.query(api.ownerApp.getSubmission, { submissionId: id });
        expect(await owner.mutation(api.ownerApp.createDraft, { ...args, businessName: 'Changed locally', clientDraftKey: ' new-business_123 ' })).toBe(id);
        expect(await owner.query(api.ownerApp.getSubmission, { submissionId: id })).toEqual(before);
        expect(await t.run(ctx => ctx.db.query('submissions').collect())).toHaveLength(3);
        expect((await t.run(ctx => ctx.db.get(id)))?.ownerClientDraftKey).toBe('new-business_123');
        await complete(owner, id); await owner.mutation(api.ownerApp.submit, { submissionId: id });
        expect(await owner.mutation(api.ownerApp.createDraft, args)).toBe(id);
        expect((await owner.query(api.ownerApp.getSubmission, { submissionId: id })).status).toBe('submitted');
    });

    it('creates separate businesses for different setup keys and scopes a repeated key to its own owner', async () => {
        const { t, owner, other } = await setup();
        const args = { businessName: 'Forge', businessType: 'Barber/Salon', clientDraftKey: 'same-local-key' };
        const first = await owner.mutation(api.ownerApp.createDraft, args);
        const second = await owner.mutation(api.ownerApp.createDraft, { ...args, businessName: 'Second shop', clientDraftKey: 'different-key' });
        const otherId = await other.mutation(api.ownerApp.createDraft, { ...args, businessName: 'Ana shop' });
        expect(new Set([first, second, otherId]).size).toBe(3);
        expect(await other.mutation(api.ownerApp.createDraft, args)).toBe(otherId);
        expect((await owner.query(api.owners.me, {}))?.sites).toHaveLength(2);
        expect((await other.query(api.owners.me, {}))?.sites).toEqual([expect.objectContaining({ submissionId: otherId, businessName: 'Ana shop' })]);
        expect(await t.run(ctx => ctx.db.query('websiteOwnerships').collect())).toHaveLength(3);
    });

    it.each(['', '  ', 'x'.repeat(101), 'bad/key', 'bad:key', 'bad key', 'bad\nkey'])('rejects an invalid setup key %j without creating a draft', async clientDraftKey => {
        const { t, owner } = await setup();
        await expect(owner.mutation(api.ownerApp.createDraft, { businessName: 'Forge', businessType: 'Barber/Salon', clientDraftKey }))
            .rejects.toThrow('This business setup reference is not valid. Please start again.');
        expect(await t.run(ctx => ctx.db.query('submissions').collect())).toEqual([]);
    });

    it('keeps each business’s answers, photos, design and edits separate when opening either draft', async () => {
        const { owner } = await setup();
        const barber = await draft(owner, 'Forge Barbers');
        const restaurant = await draft(owner, 'Kalan Kitchen', 'Restaurant');
        await owner.mutation(api.ownerApp.saveAnswer, { submissionId: barber, index: 0, lang: 'en', answerText: 'Forge story' });
        await owner.mutation(api.ownerApp.saveAnswer, { submissionId: restaurant, index: 0, lang: 'tl', answerText: 'Kalan story' });
        await owner.mutation(api.ownerApp.saveShot, { submissionId: barber, index: 0, url: `${R2}/forge.jpg`, label: 'Barber chair' });
        await owner.mutation(api.ownerApp.saveShot, { submissionId: restaurant, index: 0, url: `${R2}/kalan.jpg`, label: 'Dining room' });
        await owner.mutation(api.ownerApp.chooseDesign, { submissionId: barber, templateId: 'business:CA' });
        await owner.mutation(api.ownerApp.chooseDesign, { submissionId: restaurant, templateId: 'business:CJ' });
        const before = await owner.query(api.ownerApp.getSubmission, { submissionId: restaurant });

        await owner.mutation(api.ownerApp.updateDraft, { submissionId: barber, businessName: 'Forge Studio' });
        await owner.mutation(api.ownerApp.saveAnswer, { submissionId: barber, index: 0, lang: 'en', answerText: 'Updated Forge story' });
        await owner.mutation(api.ownerApp.saveShot, { submissionId: barber, index: 0, url: `${R2}/forge-new.jpg`, label: 'New chair' });
        const saved = await owner.query(api.ownerApp.getSubmission, { submissionId: barber });
        expect(saved).toMatchObject({ businessName: 'Forge Studio', businessType: 'Barber/Salon', templateId: 'business:CA',
            interview: [expect.objectContaining({ answerText: 'Updated Forge story', lang: 'en' })],
            shots: [expect.objectContaining({ url: `${R2}/forge-new.jpg`, label: 'New chair' })] });
        expect(await owner.query(api.ownerApp.getSubmission, { submissionId: restaurant })).toEqual(before);
        expect(before).toMatchObject({ businessName: 'Kalan Kitchen', businessType: 'Restaurant', templateId: 'business:CJ',
            interview: [expect.objectContaining({ answerText: 'Kalan story', lang: 'tl' })],
            shots: [expect.objectContaining({ url: `${R2}/kalan.jpg`, label: 'Dining room' })] });
        expect((await owner.query(api.owners.me, {}))?.sites).toEqual(expect.arrayContaining([
            expect.objectContaining({ submissionId: barber, businessName: 'Forge Studio', phase: 'draft' }),
            expect.objectContaining({ submissionId: restaurant, businessName: 'Kalan Kitchen', phase: 'draft' }),
        ]));
    });

    it('reads payment and publication status per business without spreading a paid status to another site', async () => {
        const { t, owner } = await setup();
        const paid = await draft(owner, 'Forge Barbers');
        const deposit = await draft(owner, 'Kalan Kitchen', 'Restaurant');
        const unpaid = await draft(owner, 'Ana Clinic', 'Clinic');
        // In-memory fixtures only: no checkout, payment application or financial service is called.
        await t.run(async ctx => {
            await ctx.db.patch(paid, { status: 'completed', amountPaid: 4999, paidInFullAt: NOW, ownerApprovedAt: NOW });
            await ctx.db.insert('generatedWebsites', { submissionId: paid, status: 'published', publishedUrl: 'https://forge.example.test', htmlContent: '<html>Forge</html>' });
            await ctx.db.patch(deposit, { status: 'deposit_paid', amountPaid: 1000, depositPaidAt: NOW, ownerApprovedAt: NOW });
        });
        expect(await owner.query(api.ownerPayments.getPaymentState, { submissionId: paid }))
            .toMatchObject({ paidInFull: true, balanceDue: 0, canPayFull: false, canPayBalance: false });
        expect(await owner.query(api.ownerPayments.getPaymentState, { submissionId: deposit }))
            .toMatchObject({ paidInFull: false, amountPaid: 1000, balanceDue: 3999, canPayBalance: true });
        expect(await owner.query(api.ownerPayments.getPaymentState, { submissionId: unpaid }))
            .toMatchObject({ paidInFull: false, amountPaid: 0, balanceDue: 4999, needsApproval: true });
        const sites = (await owner.query(api.owners.me, {}))!.sites;
        expect(sites).toEqual(expect.arrayContaining([
            expect.objectContaining({ submissionId: paid, phase: 'live', paidInFull: true, publishedUrl: 'https://forge.example.test' }),
            expect.objectContaining({ submissionId: deposit, paidInFull: false, balanceDue: 3999, publishedUrl: null }),
            expect.objectContaining({ submissionId: unpaid, phase: 'draft', amountPaid: 0, publishedUrl: null }),
        ]));
    });

    it('denies another owner reads and edits across every linked business', async () => {
        const { t, owner, other } = await setup();
        const ids = [await draft(owner, 'Forge'), await draft(owner, 'Kalan', 'Restaurant')];
        const before = await t.run(async ctx => Promise.all(ids.map(id => ctx.db.get(id))));
        for (const submissionId of ids) {
            await expect(other.query(api.ownerApp.getSubmission, { submissionId })).rejects.toThrow('We could not find that website.');
            await expect(other.query(api.ownerPayments.getPaymentState, { submissionId })).rejects.toThrow('We could not find that website.');
            await expect(other.mutation(api.ownerApp.updateDraft, { submissionId, businessName: 'Not yours' })).rejects.toThrow('We could not find that website.');
            await expect(other.mutation(api.ownerApp.saveAnswer, { submissionId, index: 0, lang: 'en', answerText: 'Foreign' })).rejects.toThrow('We could not find that website.');
            await expect(other.mutation(api.ownerApp.saveShot, { submissionId, index: 0, url: `${R2}/foreign.jpg` })).rejects.toThrow('We could not find that website.');
            await expect(other.mutation(api.ownerApp.chooseDesign, { submissionId, templateId: 'business:CA' })).rejects.toThrow('We could not find that website.');
        }
        expect((await other.query(api.owners.me, {}))?.sites).toEqual([]);
        expect(await t.run(async ctx => Promise.all(ids.map(id => ctx.db.get(id))))).toEqual(before);
    });

    it('limits each owner to three open drafts and allows another after one draft is submitted', async () => {
        const { t, owner, other } = await setup();
        const ids = [await draft(owner, 'Forge'), await draft(owner, 'Kalan', 'Restaurant'), await draft(owner, 'Clinic', 'Clinic')];
        await expect(draft(owner, 'Fourth')).rejects.toThrow('You have 3 website drafts. Finish one before adding another.');
        expect((await owner.query(api.owners.me, {}))?.sites).toHaveLength(3);
        const otherId = await draft(other, 'Ana Shop');
        expect((await other.query(api.owners.me, {}))?.sites).toEqual([expect.objectContaining({ submissionId: otherId })]);
        await complete(owner, ids[0]);
        await owner.mutation(api.ownerApp.submit, { submissionId: ids[0] });
        const fourth = await draft(owner, 'Fourth');
        expect(new Set([...ids, fourth]).size).toBe(4);
        const sites = (await owner.query(api.owners.me, {}))!.sites;
        expect(sites).toHaveLength(4);
        expect(sites.filter(site => site.status === 'draft')).toHaveLength(3);
        expect(sites.find(site => site.submissionId === ids[0])?.status).toBe('submitted');
        expect(await t.run(ctx => ctx.db.query('websiteOwnerships').collect())).toHaveLength(5);
        await expect(draft(owner, 'Fifth')).rejects.toThrow('You have 3 website drafts. Finish one before adding another.');
    });
});
