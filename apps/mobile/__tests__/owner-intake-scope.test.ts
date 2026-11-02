import type { SubmissionId } from '../lib/v2/ownerTypes';

const mockDisk: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockDisk[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockDisk[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete mockDisk[key]; }),
  },
}));
const runtime = () => ({
  intake: require('../lib/v2/ownerIntake').ownerIntake as typeof import('../lib/v2/ownerIntake').ownerIntake,
  storage: require('@react-native-async-storage/async-storage').default as { getItem: jest.Mock },
});
beforeEach(() => {
  jest.resetModules();
  Object.keys(mockDisk).forEach(key => delete mockDisk[key]);
});

it('separates owner drafts, restores the correct account and transfers only anonymous signup name', async () => {
  const { intake } = runtime();
  intake.set({ ownerName: 'Ben', submissionId: 'anonymous-draft' as SubmissionId, shots: ['file://private.jpg'] });
  await intake.bindActor('owner-a');
  expect(intake.get()).toEqual({ ownerName: 'Ben' });
  intake.set({ submissionId: 'a-draft' as SubmissionId, shots: ['file://a.jpg'] });
  await intake.flush();
  const aScope = intake.scope();
  await intake.bindActor('owner-b');
  expect(intake.isCurrent(aScope)).toBe(false);
  expect(intake.get()).toEqual({});
  intake.set({ submissionId: 'b-draft' as SubmissionId });
  await intake.flush();
  await intake.bindActor(null);
  expect(intake.get()).toEqual({});
  await intake.bindActor('owner-a');
  expect(intake.get()).toMatchObject({ submissionId: 'a-draft', shots: ['file://a.jpg'] });
});

it('a late disk read cannot resurrect a cleared draft or overwrite a different owner', async () => {
  const { intake, storage } = runtime();
  let finish!: (value: string) => void;
  storage.getItem.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const loading = intake.bindActor('owner-a');
  intake.clear();
  finish(JSON.stringify({ submissionId: 'a-draft' }));
  await loading;
  expect(intake.get()).toEqual({});
  storage.getItem.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const stale = intake.bindActor('owner-b');
  await intake.bindActor('owner-c');
  intake.set({ businessName: 'Current shop' });
  finish(JSON.stringify({ submissionId: 'b-draft' }));
  await stale;
  expect(intake.get()).toEqual({ businessName: 'Current shop' });
});

it('migrates the legacy journal only after the server proves the draft belongs to this account', async () => {
  const { intake } = runtime();
  mockDisk.tendso_owner_intake_v1 = JSON.stringify({ submissionId: 'legacy', shots: ['file://legacy.jpg'] });
  await intake.bindActor('owner-b');
  await intake.migrateLegacy(['unrelated' as SubmissionId]);
  expect(intake.get()).toEqual({});
  expect(mockDisk.tendso_owner_intake_v1).toBeDefined();
  await intake.bindActor('owner-a');
  await intake.migrateLegacy(['legacy' as SubmissionId]);
  expect(intake.get()).toMatchObject({ submissionId: 'legacy', shots: ['file://legacy.jpg'] });
  expect(mockDisk.tendso_owner_intake_v1).toBeUndefined();
  jest.resetModules();
  const restarted = runtime().intake;
  await restarted.bindActor('owner-a');
  expect(restarted.get()).toMatchObject({ submissionId: 'legacy' });
});

it('keeps edits made during a load and persists writes to the actor that made them', async () => {
  const { intake, storage } = runtime();
  let finish!: (value: string) => void;
  storage.getItem.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const loading = intake.bindActor('owner-a');
  intake.set({ businessName: 'New name' });
  finish(JSON.stringify({ businessName: 'Old name', submissionId: 'a-draft' }));
  await loading;
  expect(intake.get()).toEqual({ businessName: 'New name', submissionId: 'a-draft' });
  intake.set({ businessName: 'A shop' });
  await intake.bindActor('owner-b');
  intake.set({ businessName: 'B shop' });
  await intake.flush();
  expect(JSON.parse(mockDisk['tendso_owner_intake_v2:owner-a']).businessName).toBe('A shop');
  expect(JSON.parse(mockDisk['tendso_owner_intake_v2:owner-b']).businessName).toBe('B shop');
});

it('switches owned sites without relabeling the previous shop photos or details', async () => {
  const { intake } = runtime();
  await intake.bindActor('owner-a');
  intake.set({ submissionId: 'draft-a' as SubmissionId, businessName: 'A shop', kind: 'barber', design: 'barbershop:F',
    address: 'A street', shots: ['file://a.jpg'], lang: 'tl', how: 'friend', howConfirmedFor: 'draft-a' as SubmissionId,
    uploads: [{ kind: 'photo', submissionId: 'draft-a' as SubmissionId, index: 0, extra: false, uri: 'file://a.jpg' }] });
  const oldScope = intake.scope();
  intake.set({ submissionId: 'draft-b' as SubmissionId });
  expect(intake.isCurrent(oldScope)).toBe(false);
  expect(intake.get()).toMatchObject({ submissionId: 'draft-b', lang: 'tl', uploads: [expect.objectContaining({ submissionId: 'draft-a' })] });
  expect(intake.get().shots).toBeUndefined();
  expect(intake.get().businessName).toBeUndefined();
  expect(intake.get().kind).toBeUndefined();
  expect(intake.get().design).toBeUndefined();
  expect(intake.get().how).toBe('friend');
  expect(intake.get().howConfirmedFor).toBeUndefined();
});

it('restores a flushed phone-holder confirmation after restarting the process for the same owner and draft', async () => {
  const { intake } = runtime();
  await intake.bindActor('owner-a');
  intake.set({ submissionId: 'draft-a' as SubmissionId, how: 'self', howConfirmedFor: 'draft-a' as SubmissionId });
  await intake.flush();
  jest.resetModules();
  const restarted = runtime().intake;
  await restarted.bindActor('owner-a');
  expect(restarted.get()).toMatchObject({ submissionId: 'draft-a', how: 'self', howConfirmedFor: 'draft-a' });
  await restarted.bindActor('owner-b');
  expect(restarted.get().howConfirmedFor).toBeUndefined();
});

it('does not turn a saved camera preference into a confirmed setup on restart', async () => {
  const { intake } = runtime();
  await intake.bindActor('owner-a');
  intake.set({ submissionId: 'draft-a' as SubmissionId, how: 'friend' });
  await intake.flush();
  jest.resetModules();
  const restarted = runtime().intake;
  await restarted.bindActor('owner-a');
  expect(restarted.get().how).toBe('friend');
  expect(restarted.get().howConfirmedFor).toBeUndefined();
});
