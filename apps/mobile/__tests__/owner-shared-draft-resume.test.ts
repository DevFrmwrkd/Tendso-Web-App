import type { OwnerSubmission, SubmissionId } from '../lib/v2/ownerTypes';

const mockDisk: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockDisk[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockDisk[key] = value; }),
  removeItem: jest.fn(async (key: string) => { delete mockDisk[key]; }),
} }));

const id = 'shared-draft' as SubmissionId;
const draft = (patch: Partial<OwnerSubmission> = {}): OwnerSubmission => ({
  submissionId: id, actorClerkId: 'owner-a', ownerId: 'db-owner-a', draftRevision: 4, draftProgress: { step: 'interview', how: 'friend', audioOnly: true, lang: 'tl' },
  phase: 'draft', status: 'draft', businessName: 'Cloud Barber', businessType: 'Barber/Salon', contentSource: 'owner_app', publishPolicy: 'pay_then_publish',
  publishedUrl: null, total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: 1,
  address: '12 Cloud Street', city: 'Marikina', coordinates: null, province: null, barangay: null, shotListKey: 'barber',
  shots: [{ index: 0, extra: false, url: 'https://cdn.test/cloud-photo.jpg', updatedAt: 1 }],
  interview: [{ index: 0, questionEn: 'Your shop?', questionTl: 'Tindahan?', lang: 'tl', answerText: 'Text saved on web', updatedAt: 1 }],
  templateId: 'barbershop:F', templateIds: ['barbershop:F'], fontChoice: null, colorChoice: null, ownerApprovedAt: null, previewReadyAt: null, ...patch,
});
const runtime = () => ({
  intake: jest.requireActual<typeof import('../lib/v2/ownerIntake')>('../lib/v2/ownerIntake').ownerIntake,
  ...jest.requireActual<typeof import('../lib/v2/ownerDraftWrites')>('../lib/v2/ownerDraftWrites'),
  ...jest.requireActual<typeof import('../lib/v2/ownerMedia')>('../lib/v2/ownerMedia'),
  ...jest.requireActual<typeof import('../lib/v2/ownerFlow')>('../lib/v2/ownerFlow'),
});
beforeEach(() => { jest.resetModules(); Object.keys(mockDisk).forEach(key => delete mockDisk[key]); });
afterEach(async () => { await runtime().intake.flush(); });

it('restores web-saved setup, text answers, photos, design and revision on a fresh phone', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a', 'session-one'); app.intake.selectBusiness(id);
  const cloud = draft(); expect(app.intake.restoreDraft(cloud)).toBe(true);
  expect(app.intake.get()).toMatchObject({ businessName: 'Cloud Barber', address: '12 Cloud Street', design: 'barbershop:F', draftRevision: 4,
    how: 'friend', howConfirmedFor: id, audioOnly: true, lang: 'tl' });
  expect(app.ownerPhotosFor(id, cloud, app.intake.get()).map(photo => photo.uri)).toEqual(['https://cdn.test/cloud-photo.jpg']);
  expect(app.ownerAnswersFor(id, cloud, app.intake.get())[0].answerText).toBe('Text saved on web');
  expect(app.resumeStep('draft', app.ownerDraftSnapshot(id, cloud, app.intake.get()))).toBe('talk');
  await app.intake.flush(); jest.resetModules(); const restarted = runtime(); await restarted.intake.bindActor('owner-a', 'session-two');
  expect(restarted.intake.get()).toMatchObject({ submissionId: id, draftRevision: 4, design: 'barbershop:F' });
});

it('loads newer web edits and pauses unfinished local captures without deleting their files or replaying them', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a'); app.intake.selectBusiness(id); app.intake.restoreDraft(draft());
  app.intake.set({ businessName: 'Old phone edit', detailsDirty: ['businessName'], design: 'barbershop:BP', shots: ['file://old.jpg'],
    uploads: [{ kind: 'photo', submissionId: id, index: 0, extra: false, uri: 'file://old.jpg' },
      { kind: 'answer', submissionId: id, index: 0, mediaType: 'audio', lang: 'en', durationSec: 8, uri: 'file://old.m4a' }] });
  const epoch = app.intake.scope(); const cloud = draft({ draftRevision: 8, businessName: 'Web renamed shop', templateId: 'barbershop:BP2',
    shots: [{ index: 0, extra: false, url: 'https://cdn.test/web-replaced.jpg', updatedAt: 8 }] });
  app.intake.restoreDraft(cloud);
  expect(app.intake.isCurrent(epoch)).toBe(false); expect(app.intake.get().businessName).toBe('Web renamed shop');
  expect(app.intake.get().detailsDirty).toBeUndefined(); expect(app.intake.get().design).toBe('barbershop:BP2');
  expect(app.intake.get().remoteConflictMetadata).toMatchObject({ businessName: 'Old phone edit', design: 'barbershop:BP' });
  expect(app.intake.get().uploads).toEqual(expect.arrayContaining([expect.objectContaining({ uri: 'file://old.jpg', pausedByRemote: true }), expect.objectContaining({ uri: 'file://old.m4a', pausedByRemote: true })]));
  expect(app.ownerPhotosFor(id, cloud, app.intake.get())[0].uri).toBe('https://cdn.test/web-replaced.jpg');
  expect(app.ownerAnswersFor(id, cloud, app.intake.get())[0].answerText).toBe('Text saved on web');
  expect(app.intake.get().syncNotice).toContain('newer version');
  await app.intake.flush(); jest.resetModules(); const reopened = runtime(); await reopened.intake.bindActor('owner-a');
  expect(reopened.intake.get().remoteConflictMetadata).toMatchObject({ businessName: 'Old phone edit', design: 'barbershop:BP' });
  reopened.intake.restoreDraft(cloud);
  reopened.intake.usePhoneMetadata(id);
  expect(reopened.intake.get()).toMatchObject({ businessName: 'Old phone edit', design: 'barbershop:BP', address: '12 Cloud Street', detailsDirty: ['businessName'], draftRevision: 8 });
  const send = jest.fn(async (args: { expectedRevision: number }) => ({ draftRevision: args.expectedRevision + 1 }));
  await reopened.writeOwnerDraft({ actorClerkId: 'owner-a' }, { submissionId: id, businessName: 'Old phone edit' }, send);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 8, actorClerkId: 'owner-a' }));
  expect(reopened.intake.get().remoteConflictMetadata).toBeDefined();
  reopened.intake.finishPhoneMetadata(id, reopened.intake.scope()); expect(reopened.intake.get().remoteConflictMetadata).toBeUndefined();
});

it('keeps unsent phone edits on the same acknowledged revision, including after restart', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a'); app.intake.selectBusiness(id); app.intake.restoreDraft(draft());
  app.intake.set({ businessName: 'Unsent phone name', detailsDirty: ['businessName'], design: 'barbershop:BP' }); await app.intake.flush();
  jest.resetModules(); const reopened = runtime(); await reopened.intake.bindActor('owner-a'); reopened.intake.restoreDraft(draft());
  expect(reopened.intake.get()).toMatchObject({ businessName: 'Unsent phone name', detailsDirty: ['businessName'], design: 'barbershop:BP', draftRevision: 4 });
});

it('does not let an older reactive query roll back an acknowledged cloud save', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a'); app.intake.selectBusiness(id); app.intake.restoreDraft(draft());
  app.intake.acknowledge(id, 5, app.intake.scope()); app.intake.set({ businessName: 'Acknowledged phone name' });
  expect(app.intake.restoreDraft(draft({ draftRevision: 4 }))).toBe(false);
  expect(app.intake.get()).toMatchObject({ draftRevision: 5, businessName: 'Acknowledged phone name' });
});

it('recognizes a committed upload after its response was lost instead of replaying or pausing it', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a'); app.intake.selectBusiness(id); app.intake.restoreDraft(draft());
  app.intake.set({ uploads: [{ kind: 'photo', submissionId: id, index: 0, extra: false, uri: 'file://phone.jpg', uploadedUrl: 'https://cdn.test/committed.jpg' }] });
  const cloud = draft({ draftRevision: 5, shots: [{ index: 0, extra: false, url: 'https://cdn.test/committed.jpg', updatedAt: 5 }] });
  app.intake.restoreDraft(cloud);
  expect(app.intake.get().uploads).toEqual([expect.objectContaining({ saved: true, pausedByRemote: undefined })]);
  expect(app.ownerPhotosFor(id, cloud, app.intake.get())[0].uri).toBe('https://cdn.test/committed.jpg');
});

it('does not cover newer cloud media with completed local upload journals', async () => {
  const app = runtime(); const cloud = draft({ draftRevision: 6, interview: [{ index: 0, questionEn: '', questionTl: '', lang: 'en', mediaUrl: 'https://cdn.test/new.webm', mediaType: 'video', updatedAt: 6 }] });
  const local = { submissionId: id, draftRevision: 6, uploads: [
    { kind: 'photo' as const, submissionId: id, index: 0, extra: false, uri: 'file://old.jpg', saved: true },
    { kind: 'answer' as const, submissionId: id, index: 0, uri: 'file://old.m4a', mediaType: 'audio' as const, lang: 'tl' as const, durationSec: 5, saved: true },
  ] };
  expect(app.ownerPhotosFor(id, cloud, local)[0].uri).toBe('https://cdn.test/cloud-photo.jpg');
  expect(app.ownerAnswersFor(id, cloud, local)[0].mediaUrl).toBe('https://cdn.test/new.webm');
});

it('serializes capture, progress and details saves from the latest acknowledged revision', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a', 's1'); app.intake.selectBusiness(id); app.intake.restoreDraft(draft());
  let finish!: (value: { draftRevision: number }) => void;
  const send = jest.fn(({ expectedRevision }: { expectedRevision: number }) => expectedRevision === 4
    ? new Promise<{ draftRevision: number }>(resolve => { finish = resolve; }) : Promise.resolve({ draftRevision: expectedRevision + 1 }));
  const first = app.writeOwnerDraft({ actorClerkId: 'owner-a', sessionId: 's1' }, { submissionId: id }, send);
  const second = app.writeOwnerDraft({ actorClerkId: 'owner-a', sessionId: 's1' }, { submissionId: id }, send);
  await Promise.resolve(); await Promise.resolve(); expect(send).toHaveBeenCalledTimes(1);
  finish({ draftRevision: 5 }); await Promise.all([first, second]);
  expect(send.mock.calls.map(([args]) => args.expectedRevision)).toEqual([4, 5]); expect(app.intake.revision(id)).toBe(6);
});

it('does not mistake a query delivered before its own mutation acknowledgement for another device edit', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a'); app.intake.selectBusiness(id); app.intake.restoreDraft(draft());
  app.intake.set({ businessName: 'Phone edit', detailsDirty: ['businessName'] });
  const epoch = app.intake.scope(); app.intake.beginWrite(id);
  expect(app.intake.restoreDraft(draft({ draftRevision: 5 }))).toBe(false); expect(app.intake.isCurrent(epoch)).toBe(true);
  app.intake.acknowledge(id, 5, epoch); app.intake.finishWrite(id, epoch);
  app.intake.restoreDraft(draft({ draftRevision: 5 })); expect(app.intake.get().syncNotice).toBeUndefined();
});

it('refuses queued saves after account or session changes and drops stale acknowledgements', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a', 's1'); app.intake.selectBusiness(id); app.intake.restoreDraft(draft());
  let finish!: (value: { draftRevision: number }) => void;
  const send = jest.fn(() => new Promise<{ draftRevision: number }>(resolve => { finish = resolve; }));
  const first = app.writeOwnerDraft({ actorClerkId: 'owner-a', sessionId: 's1' }, { submissionId: id }, send);
  const second = app.writeOwnerDraft({ actorClerkId: 'owner-a', sessionId: 's1' }, { submissionId: id }, send);
  const refused = expect(second).rejects.toThrow('account or business changed'); await Promise.resolve(); await Promise.resolve();
  await app.intake.bindActor('owner-b', 's2'); finish({ draftRevision: 5 }); await first; await refused;
  expect(send).toHaveBeenCalledTimes(1); expect(app.intake.get().draftRevision).toBeUndefined();
});

it('turns structured revision conflicts into a useful error without advancing the phone revision', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a'); app.intake.selectBusiness(id); app.intake.restoreDraft(draft());
  const send = jest.fn(async () => { throw { data: { code: 'OWNER_DRAFT_CONFLICT', message: 'This draft changed. Reload the latest version.', currentRevision: 8 } }; });
  await expect(app.writeOwnerDraft({ actorClerkId: 'owner-a' }, { submissionId: id }, send)).rejects.toThrow('Reload the latest version');
  expect(app.intake.revision(id)).toBe(4);
});

it('does not hydrate a draft belonging to another subject or a submitted website', async () => {
  const app = runtime(); await app.intake.bindActor('owner-a'); app.intake.selectBusiness(id);
  expect(app.intake.restoreDraft(draft({ actorClerkId: 'owner-b' }))).toBe(false);
  expect(app.intake.restoreDraft(draft({ phase: 'in_review' }))).toBe(false);
  expect(app.intake.isHydrated(id)).toBe(false);
});
