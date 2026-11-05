import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './owners.ts': () => import('../../convex/owners'),
    './ownerApp.ts': () => import('../../convex/ownerApp'),
};
const R2 = 'https://draft-uploads.example.test';
const NOW = Date.UTC(2026, 10, 3, 10);
type Test = ReturnType<typeof convexTest>;
type Actor = ReturnType<Test['withIdentity']>;
type Guard = { expectedRevision?: number; actorClerkId?: string };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); vi.stubEnv('R2_PUBLIC_URL', R2); vi.stubEnv('OWNER_APP_DAILY_LIMIT', '50'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function setup() {
    const t = convexTest(schema, modules);
    const houseId = await t.run(ctx => ctx.db.insert('creators', { clerkId: 'house', email: 'house@example.test', role: 'creator', status: 'active' }));
    vi.stubEnv('SELF_SERVE_CREATOR_ID', houseId);
    const identity = { subject: 'owner-one', email: 'owner@example.test', emailVerified: true };
    const phone = t.withIdentity(identity), web = t.withIdentity(identity);
    const other = t.withIdentity({ subject: 'owner-two', email: 'other@example.test', emailVerified: true });
    const { ownerId } = await phone.mutation(api.owners.ensure, { name: 'Alex Santos', phone: '09171234567' });
    await other.mutation(api.owners.ensure, { name: 'Other owner' });
    const id = await phone.mutation(api.ownerApp.createDraft, { actorClerkId: identity.subject, businessName: 'Alex Kitchen', businessType: 'Restaurant', address: '12 Main St', city: 'Marikina', clientDraftKey: 'shared-test' });
    return { t, phone, web, other, id, ownerId };
}

function operations(actor: Actor, submissionId: Id<'submissions'>, guard: Guard) {
    return [
        () => actor.mutation(api.ownerApp.updateDraft, { submissionId, businessName: 'Unconfirmed edit', ...guard }),
        () => actor.mutation(api.ownerApp.saveAnswer, { submissionId, index: 0, lang: 'en', answerText: 'Unconfirmed story', ...guard }),
        () => actor.mutation(api.ownerApp.saveShot, { submissionId, index: 0, url: `${R2}/unconfirmed.jpg`, ...guard }),
        () => actor.mutation(api.ownerApp.removeShot, { submissionId, index: 0, ...guard }),
        () => actor.mutation(api.ownerApp.chooseDesign, { submissionId, templateId: 'restaurant:CA', ...guard }),
        () => actor.mutation(api.ownerApp.setStyle, { submissionId, fontChoice: 'modern', colorChoice: 'forest', ...guard }),
        () => actor.mutation(api.ownerApp.submit, { submissionId, ...guard }),
    ];
}

async function complete(t: Test, id: Id<'submissions'>) {
    await t.run(ctx => ctx.db.patch(id, {
        ownerInterview: Array.from({ length: 10 }, (_, index) => ({ index, questionEn: `Question ${index}`, questionTl: `Tanong ${index}`, lang: 'en', answerText: `Answer ${index}`, updatedAt: NOW })),
        ownerShots: Array.from({ length: 3 }, (_, index) => ({ index, extra: false, url: `${R2}/${index}.jpg`, updatedAt: NOW })),
        templateId: 'restaurant:CA', templateIds: ['restaurant:CA'],
    }));
}

describe('authenticated drafts shared by phone and web', () => {
    it('restores canonical setup, text, recordings, photo slots and design across clients without changing them', async () => {
        const { phone, web, id, ownerId } = await setup();
        await phone.mutation(api.ownerApp.saveAnswer, { submissionId: id, index: 0, lang: 'tl', answerText: 'Our family kitchen', mediaUrl: `${R2}/story.m4a`, mediaType: 'audio', durationSec: 31 });
        await phone.mutation(api.ownerApp.saveShot, { submissionId: id, index: 0, url: `${R2}/front.jpg`, label: 'Shop front' });
        await phone.mutation(api.ownerApp.saveShot, { submissionId: id, index: 0, extra: true, url: `${R2}/menu.jpg`, label: 'Menu' });
        await phone.mutation(api.ownerApp.chooseDesign, { submissionId: id, templateId: 'restaurant:CA', templateIds: ['restaurant:CA', 'restaurant:CB'] });
        await phone.mutation(api.ownerApp.setStyle, { submissionId: id, fontChoice: 'classic', colorChoice: 'forest' });
        const before = await phone.query(api.ownerApp.getSubmission, { submissionId: id });
        vi.setSystemTime(NOW + 1000);
        const saved = await phone.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, actorClerkId: 'owner-one', expectedRevision: before.draftRevision,
            progress: { step: 'interview', questionIndex: 1, photoIndex: 2, how: 'friend', audioOnly: true, lang: 'tl' } });
        expect(saved.draftRevision).toBe(before.draftRevision + 1);
        const restored = await web.query(api.ownerApp.getSubmission, { submissionId: id, actorClerkId: 'owner-one' });
        expect(restored).toMatchObject({ actorClerkId: 'owner-one', ownerId, ownerName: 'Alex Santos', ownerPhone: '09171234567', draftRevision: saved.draftRevision, draftUpdatedAt: NOW + 1000,
            draftProgress: { step: 'interview', questionIndex: 1, photoIndex: 2, how: 'friend', audioOnly: true, lang: 'tl' },
            templateId: 'restaurant:CA', templateIds: ['restaurant:CA', 'restaurant:CB'], fontChoice: 'classic', colorChoice: 'forest' });
        expect(restored.interview).toEqual(before.interview); expect(restored.shots).toEqual(before.shots);
        await web.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, expectedRevision: saved.draftRevision, progress: { step: 'photos', photoIndex: 3 } });
        expect((await phone.query(api.ownerApp.getSubmission, { submissionId: id })).draftProgress).toMatchObject({ step: 'photos', photoIndex: 3, how: 'friend', audioOnly: true, lang: 'tl' });
    });

    it('keeps legacy drafts readable and writable until a revision-aware client enrolls them', async () => {
        const { t, phone, web, id } = await setup();
        await t.run(ctx => ctx.db.patch(id, { ownerDraftRevision: undefined, ownerDraftUpdatedAt: undefined }));
        expect(await web.query(api.ownerApp.getSubmission, { submissionId: id })).toMatchObject({ draftRevision: 0, draftUpdatedAt: null, draftProgress: null });
        expect(await phone.mutation(api.ownerApp.updateDraft, { submissionId: id, address: '34 New St' })).toMatchObject({ draftRevision: 1 });
        await web.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, expectedRevision: 1, progress: { step: 'setup' } });
        const before = await t.run(ctx => ctx.db.get(id));
        for (const operation of operations(phone, id, {})) await expect(operation()).rejects.toThrow('OWNER_DRAFT_REFRESH_REQUIRED');
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
    });

    it('rejects stale edits, uploads, design, progress and submit atomically instead of overwriting another device', async () => {
        const { t, phone, web, id } = await setup();
        await complete(t, id);
        const loaded = await phone.query(api.ownerApp.getSubmission, { submissionId: id });
        await web.mutation(api.ownerApp.updateDraft, { submissionId: id, expectedRevision: loaded.draftRevision, businessName: 'Saved on web' });
        const before = await t.run(ctx => ctx.db.get(id));
        for (const operation of operations(phone, id, { expectedRevision: loaded.draftRevision, actorClerkId: 'owner-one' })) {
            await expect(operation()).rejects.toThrow('OWNER_DRAFT_CONFLICT');
        }
        await expect(phone.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, expectedRevision: loaded.draftRevision, progress: { step: 'review' } })).rejects.toThrow('OWNER_DRAFT_CONFLICT');
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
        expect(await t.run(ctx => ctx.db.query('leads').collect())).toEqual([]);
        expect(await t.run(ctx => ctx.db.query('ownerIntakeThrottle').collect())).toEqual([]);
        expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('retains recorded media when web edits text, retains text when phone replaces media, and removes only explicit content', async () => {
        const { phone, web, id } = await setup();
        const first = await phone.mutation(api.ownerApp.saveAnswer, { submissionId: id, expectedRevision: 0, index: 0, lang: 'en', answerText: 'Original story', mediaUrl: `${R2}/first.mp4`, mediaType: 'video', durationSec: 12 });
        const edited = await web.mutation(api.ownerApp.saveAnswer, { submissionId: id, expectedRevision: first.draftRevision, index: 0, lang: 'en', answerText: 'Corrected story' });
        expect((await phone.query(api.ownerApp.getSubmission, { submissionId: id })).interview[0]).toMatchObject({ answerText: 'Corrected story', mediaUrl: `${R2}/first.mp4`, mediaType: 'video', durationSec: 12 });
        const replaced = await phone.mutation(api.ownerApp.saveAnswer, { submissionId: id, expectedRevision: edited.draftRevision, index: 0, lang: 'en', mediaUrl: `${R2}/second.m4a`, mediaType: 'audio', durationSec: 19 });
        expect((await web.query(api.ownerApp.getSubmission, { submissionId: id })).interview[0]).toMatchObject({ answerText: 'Corrected story', mediaUrl: `${R2}/second.m4a`, mediaType: 'audio', durationSec: 19 });
        const cleared = await web.mutation(api.ownerApp.saveAnswer, { submissionId: id, expectedRevision: replaced.draftRevision, index: 0, lang: 'en', clearMedia: true });
        const textOnly = (await phone.query(api.ownerApp.getSubmission, { submissionId: id })).interview[0];
        expect(textOnly.answerText).toBe('Corrected story'); expect(textOnly.mediaUrl).toBeUndefined(); expect(textOnly.mediaType).toBeUndefined(); expect(textOnly.durationSec).toBeUndefined();
        await web.mutation(api.ownerApp.saveAnswer, { submissionId: id, expectedRevision: cleared.draftRevision, index: 0, lang: 'en', answerText: '', clearMedia: true });
        expect((await phone.query(api.ownerApp.getSubmission, { submissionId: id })).interview).toEqual([]);
    });

    it('distinguishes guided and extra photo slots when replacing and deleting', async () => {
        const { phone, web, id } = await setup();
        await phone.mutation(api.ownerApp.saveShot, { submissionId: id, index: 0, url: `${R2}/guided.jpg` });
        const extra = await phone.mutation(api.ownerApp.saveShot, { submissionId: id, index: 0, extra: true, url: `${R2}/extra.jpg` });
        const replacement = await web.mutation(api.ownerApp.saveShot, { submissionId: id, expectedRevision: extra.draftRevision, index: 0, extra: true, url: `${R2}/extra-new.jpg` });
        await web.mutation(api.ownerApp.removeShot, { submissionId: id, expectedRevision: replacement.draftRevision, index: 0, extra: true });
        expect((await phone.query(api.ownerApp.getSubmission, { submissionId: id })).shots).toEqual([expect.objectContaining({ index: 0, extra: false, url: `${R2}/guided.jpg` })]);
    });

    it('denies stale actors and foreign owners without exposing or changing another account’s work', async () => {
        const { t, phone, other, id } = await setup();
        const before = await t.run(ctx => ctx.db.get(id));
        await expect(phone.query(api.ownerApp.getSubmission, { submissionId: id, actorClerkId: 'owner-two' })).rejects.toThrow('account changed');
        await expect(other.query(api.ownerApp.getSubmission, { submissionId: id })).rejects.toThrow('find that website');
        for (const operation of operations(phone, id, { expectedRevision: 0, actorClerkId: 'owner-two' })) await expect(operation()).rejects.toThrow('account changed');
        for (const operation of operations(other, id, { expectedRevision: 0, actorClerkId: 'owner-two' })) await expect(operation()).rejects.toThrow('find that website');
        await expect(phone.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, actorClerkId: 'owner-two', expectedRevision: 0, progress: { step: 'setup' } })).rejects.toThrow('account changed');
        await expect(other.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, expectedRevision: 0, progress: { step: 'setup' } })).rejects.toThrow('find that website');
        await expect(phone.mutation(api.ownerApp.createDraft, { actorClerkId: 'owner-two', businessName: 'Foreign', businessType: 'Restaurant' })).rejects.toThrow('account changed');
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
        expect(await t.run(ctx => ctx.db.query('submissions').collect())).toHaveLength(1);
    });

    it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid revision %j without changing work', async expectedRevision => {
        const { t, phone, id } = await setup(); const before = await t.run(ctx => ctx.db.get(id));
        await expect(phone.mutation(api.ownerApp.updateDraft, { submissionId: id, expectedRevision, city: 'Pasig' })).rejects.toThrow('revision is not valid');
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
    });

    it.each([{ questionIndex: -1 }, { questionIndex: 11 }, { questionIndex: 1.5 }, { photoIndex: -1 }, { photoIndex: 10 }, { photoIndex: 0.5 }])('rejects out-of-range resume positions %j without enrolling or writing', async position => {
        const { t, phone, id } = await setup(); const before = await t.run(ctx => ctx.db.get(id));
        await expect(phone.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, expectedRevision: 0, progress: { step: 'interview', ...position } })).rejects.toThrow('Unknown');
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
    });

    it('submits the exact reviewed revision once, preserving capture and design while blocking all later setup edits', async () => {
        const { t, phone, web, id } = await setup(); await complete(t, id);
        const saved = await web.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, expectedRevision: 0, progress: { step: 'review', how: 'friend', lang: 'en' } });
        const result = await web.mutation(api.ownerApp.submit, { submissionId: id, expectedRevision: saved.draftRevision, actorClerkId: 'owner-one' });
        expect(result).toMatchObject({ status: 'submitted', draftRevision: saved.draftRevision + 1 });
        const before = await t.run(ctx => ctx.db.get(id));
        expect(before).toMatchObject({ status: 'submitted', templateId: 'restaurant:CA', ownerDraftProgress: { step: 'review' }, photos: [`${R2}/0.jpg`, `${R2}/1.jpg`, `${R2}/2.jpg`] });
        const repeat = await phone.mutation(api.ownerApp.submit, { submissionId: id, expectedRevision: saved.draftRevision });
        expect(repeat).toEqual(result);
        for (const operation of operations(phone, id, { expectedRevision: result.draftRevision }).slice(0, -1)) await expect(operation()).rejects.toThrow('already sent');
        await expect(phone.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, expectedRevision: result.draftRevision, progress: { step: 'details' } })).rejects.toThrow('already sent');
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
        expect(await t.run(ctx => ctx.db.query('leads').collect())).toHaveLength(1);
        expect((await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).map(job => job.name).filter(name => name === 'buildProgress:startPipeline')).toHaveLength(1);
    });

    it('does not reset an enrolled draft when a client retries its creation key', async () => {
        const { t, phone, web, id } = await setup();
        await web.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, expectedRevision: 0, progress: { step: 'photos' } });
        const before = await t.run(ctx => ctx.db.get(id));
        expect(await phone.mutation(api.ownerApp.createDraft, { actorClerkId: 'owner-one', businessName: 'Old form name', businessType: 'Restaurant', clientDraftKey: 'shared-test' })).toBe(id);
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
    });

    it('retains alternate picks when a resumed mobile client confirms the unchanged primary design', async () => {
        const { phone, web, id } = await setup();
        const picks = ['restaurant:CA', 'restaurant:CB', 'restaurant:CC'];
        const saved = await web.mutation(api.ownerApp.chooseDesign, { submissionId: id, expectedRevision: 0, templateId: picks[0], templateIds: picks });
        const confirmed = await phone.mutation(api.ownerApp.chooseDesign, { submissionId: id, expectedRevision: saved.draftRevision, templateId: picks[0] });
        expect((await web.query(api.ownerApp.getSubmission, { submissionId: id })).templateIds).toEqual(picks);
        const replaced = await web.mutation(api.ownerApp.chooseDesign, { submissionId: id, expectedRevision: confirmed.draftRevision, templateId: picks[0], templateIds: [picks[0]] });
        expect((await phone.query(api.ownerApp.getSubmission, { submissionId: id })).templateIds).toEqual([picks[0]]);
        await phone.mutation(api.ownerApp.chooseDesign, { submissionId: id, expectedRevision: replaced.draftRevision, templateId: picks[1] });
        expect((await web.query(api.ownerApp.getSubmission, { submissionId: id })).templateIds).toEqual([picks[1]]);
    });

    it('cannot enroll or mutate a field-agent submission using owner setup endpoints', async () => {
        const { t, phone, id } = await setup();
        await t.run(ctx => ctx.db.patch(id, { contentSource: 'agent_app' } as Partial<Doc<'submissions'>>));
        const before = await t.run(ctx => ctx.db.get(id));
        for (const operation of operations(phone, id, { expectedRevision: 0 }).slice(0, -1)) await expect(operation()).rejects.toThrow('field agent');
        await expect(phone.mutation(api.ownerApp.saveDraftProgress, { submissionId: id, expectedRevision: 0, progress: { step: 'details' } })).rejects.toThrow('field agent');
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
    });
});
