import type { SubmissionId } from '../lib/v2/ownerTypes';

const mockDisk: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: {
    getItem: jest.fn(async (key: string) => mockDisk[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockDisk[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete mockDisk[key]; }),
  },
}));
const runtime = () => require('../lib/v2/ownerIntake').ownerIntake as typeof import('../lib/v2/ownerIntake').ownerIntake;
const a = 'business-a' as SubmissionId, b = 'business-b' as SubmissionId, c = 'business-c' as SubmissionId;
beforeEach(() => { jest.resetModules(); Object.keys(mockDisk).forEach(key => delete mockDisk[key]); });

it('restores each business’s details, photos, setup choice and design after switching and restarting', async () => {
  let store = runtime();
  await store.bindActor('owner-a');
  store.set({ submissionId: a, kind: 'barber', businessName: 'A Barber', address: 'A Street', city: 'Marikina',
    coordinates: { lat: 14, lng: 121 }, detailsDirty: ['address'], how: 'self', howConfirmedFor: a,
    shots: ['file://a.jpg'], design: 'business:CA', lang: 'tl', audioOnly: false,
    uploads: [{ kind: 'answer', submissionId: a, index: 0, uri: 'file://a.m4a', mediaType: 'audio', lang: 'tl', durationSec: 8 }] });
  const old = store.scope();
  store.selectBusiness(b);
  expect(store.isCurrent(old)).toBe(false);
  expect(store.get().businessName).toBeUndefined(); expect(store.get().shots).toBeUndefined();
  expect(store.get().howConfirmedFor).toBeUndefined();
  store.set({ kind: 'food', businessName: 'B Kitchen', address: 'B Street', city: 'Pasig', how: 'friend', howConfirmedFor: b,
    shots: ['file://b.jpg'], design: 'business:CJ', lang: 'en', audioOnly: true,
    uploads: [...store.get().uploads!, { kind: 'photo', submissionId: b, index: 0, extra: false, uri: 'file://b.jpg' }] });
  await store.flush();
  jest.resetModules(); store = runtime(); await store.bindActor('owner-a');
  expect(store.get()).toMatchObject({ submissionId: b, businessName: 'B Kitchen', howConfirmedFor: b, shots: ['file://b.jpg'] });
  store.selectBusiness(a);
  expect(store.get()).toMatchObject({ submissionId: a, kind: 'barber', businessName: 'A Barber', address: 'A Street', city: 'Marikina',
    coordinates: { lat: 14, lng: 121 }, detailsDirty: ['address'], how: 'self', howConfirmedFor: a,
    shots: ['file://a.jpg'], design: 'business:CA', lang: 'tl', audioOnly: false });
  expect(store.get().uploads?.map(upload => upload.submissionId)).toEqual([a, b]);
  store.selectBusiness(b);
  expect(store.get()).toMatchObject({ submissionId: b, businessName: 'B Kitchen', shots: ['file://b.jpg'], lang: 'en', audioOnly: true });
});

it('keeps a separate new-business workspace across restart, cancellation and server attachment', async () => {
  let store = runtime(); await store.bindActor('owner-a');
  store.set({ submissionId: a, kind: 'barber', businessName: 'Original', address: 'A Street', shots: ['file://a.jpg'] });
  store.beginBusiness();
  const key = store.get().newBusinessKey;
  expect(key).toMatch(/^[A-Za-z0-9_-]{1,100}$/);
  expect(store.get()).toMatchObject({ newBusiness: true });
  expect(store.get().submissionId).toBeUndefined(); expect(store.get().businessName).toBeUndefined();
  expect(store.get().shots).toBeUndefined(); expect(store.get().kind).toBeUndefined();
  store.set({ kind: 'repair', businessName: 'New Garage', address: 'New Street', detailsDirty: ['businessName', 'address'] });
  store.beginBusiness(); expect(store.get().newBusinessKey).toBe(key);
  await store.flush(); jest.resetModules(); store = runtime(); await store.bindActor('owner-a');
  expect(store.get()).toMatchObject({ newBusiness: true, newBusinessKey: key, kind: 'repair', businessName: 'New Garage' });
  expect(store.previousBusiness()).toBe(a);
  store.cancelNewBusiness(a);
  expect(store.get()).toMatchObject({ submissionId: a, businessName: 'Original', shots: ['file://a.jpg'] });
  store.beginBusiness();
  expect(store.get()).toMatchObject({ newBusiness: true, newBusinessKey: key, businessName: 'New Garage', address: 'New Street' });
  const beforeAttach = store.scope();
  store.set({ submissionId: c, detailsDirty: undefined });
  expect(store.isCurrent(beforeAttach)).toBe(false);
  expect(store.get()).toMatchObject({ submissionId: c, businessName: 'New Garage', kind: 'repair', address: 'New Street' });
  expect(store.get().newBusiness).not.toBe(true); expect(store.get().newBusinessKey).toBeUndefined();
  store.selectBusiness(a); expect(store.get().businessName).toBe('Original');
  store.selectBusiness(c); expect(store.get().businessName).toBe('New Garage');
  store.beginBusiness(); expect(store.get().newBusinessKey).not.toBe(key);
  expect(store.get().businessName).toBeUndefined();
});

it('keeps saved business workspaces private to the login and clear removes every workspace for that actor', async () => {
  const store = runtime(); await store.bindActor('owner-a');
  store.set({ submissionId: a, businessName: 'Private A' });
  store.selectBusiness(b); store.set({ businessName: 'Private B' }); await store.flush();
  await store.bindActor('owner-b'); store.selectBusiness(a);
  expect(store.get().businessName).toBeUndefined();
  await store.bindActor('owner-a'); store.selectBusiness(a); expect(store.get().businessName).toBe('Private A');
  store.clear(); await store.flush(); store.selectBusiness(b); expect(store.get().businessName).toBeUndefined();
});

it('upgrades an existing flat per-account draft cache without losing the active business', async () => {
  mockDisk['tendso_owner_intake_v2:owner-a'] = JSON.stringify({ submissionId: a, businessName: 'Legacy shop', shots: ['file://legacy.jpg'],
    how: 'friend', howConfirmedFor: a });
  const store = runtime(); await store.bindActor('owner-a');
  store.beginBusiness(); store.set({ businessName: 'New shop' });
  store.cancelNewBusiness(a);
  expect(store.get()).toMatchObject({ submissionId: a, businessName: 'Legacy shop', shots: ['file://legacy.jpg'], howConfirmedFor: a });
  await store.flush();
  expect(JSON.parse(mockDisk['tendso_owner_intake_v2:owner-a']).businessName).toBe('Legacy shop');
});
