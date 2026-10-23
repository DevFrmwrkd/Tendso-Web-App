import type { OwnerSubmission, SaveAnswerArgs, SaveShotArgs, SubmissionId } from '../lib/v2/ownerTypes';

const mockDisk: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockDisk[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockDisk[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete mockDisk[key]; }),
  },
}));
jest.mock('../lib/v2/ownerData', () => ({}));

const id = 'draft' as SubmissionId;
const draft = () => ({ submissionId: id, shots: [], interview: [] }) as unknown as OwnerSubmission;
const runtime = () => ({
  intake: require('../lib/v2/ownerIntake').ownerIntake as typeof import('../lib/v2/ownerIntake').ownerIntake,
  queue: require('../lib/v2/uploadQueue').uploadQueue as typeof import('../lib/v2/uploadQueue').uploadQueue,
  ...require('../lib/v2/ownerUploads') as typeof import('../lib/v2/ownerUploads'),
});

beforeEach(() => {
  jest.resetModules();
  Object.keys(mockDisk).forEach((key) => delete mockDisk[key]);
});

it('restores guided photos, an extra, video and audio after a fresh module load; saves each slot once', async () => {
  let app = runtime();
  await app.intake.load();
  app.intake.set({ submissionId: id });
  const offline = {
    upload: jest.fn(async () => { throw new Error('Offline'); }),
    saveShot: jest.fn(), saveAnswer: jest.fn(),
  };
  for (let index = 0; index < 3; index++) app.rememberOwnerUpload({ kind: 'photo', submissionId: id, index, extra: false, uri: `file://p${index}.jpg` }, offline);
  app.rememberOwnerUpload({ kind: 'photo', submissionId: id, index: 0, extra: true, uri: 'file://extra.jpg' }, offline);
  app.rememberOwnerUpload({ kind: 'answer', submissionId: id, index: 0, mediaType: 'video', lang: 'en', durationSec: 10, uri: 'file://answer.mp4' }, offline);
  app.rememberOwnerUpload({ kind: 'answer', submissionId: id, index: 1, mediaType: 'audio', lang: 'tl', durationSec: 12, uri: 'file://answer.m4a' }, offline);
  await app.queue.drain();
  await app.intake.flush();
  expect(app.queue.snapshot().failed).toBe(6);

  // A new process retains AsyncStorage, but no queue closures or intake memory.
  jest.resetModules();
  app = runtime();
  expect(app.queue.snapshot().total).toBe(0);
  expect(app.intake.get()).toEqual({});
  const server = draft();
  const online = {
    upload: jest.fn(async (uri: string) => `https://cdn.test/${uri.split('/').pop()}`),
    saveShot: jest.fn(async (a: SaveShotArgs) => {
      server.shots = [...server.shots.filter((s) => !(s.index === a.index && s.extra === a.extra)), { ...a, extra: a.extra === true, updatedAt: 1 }];
    }),
    saveAnswer: jest.fn(async (a: SaveAnswerArgs) => {
      server.interview = [...server.interview.filter((s) => s.index !== a.index), { ...a, questionEn: '', questionTl: '', updatedAt: 1 }];
    }),
  };
  await Promise.all([app.resumeOwnerUploads(id, server, online), app.resumeOwnerUploads(id, server, online)]);
  await app.queue.drain();
  expect(online.upload).toHaveBeenCalledTimes(6);
  expect(server.shots).toHaveLength(4);
  expect(server.shots.filter((s) => s.index === 0)).toHaveLength(2); // guided and extra are different slots
  expect(server.interview.map((a) => a.mediaType)).toEqual(['video', 'audio']);
  expect(app.queue.snapshot()).toMatchObject({ done: 6, failed: 0 });
  expect(app.intake.get().uploads!.every((u) => u.saved)).toBe(true);
  await app.intake.flush();

  jest.resetModules();
  app = runtime();
  await app.resumeOwnerUploads(id, server, online);
  await app.queue.drain();
  expect(online.upload).toHaveBeenCalledTimes(6);
  expect(online.saveShot).toHaveBeenCalledTimes(4);
  expect(online.saveAnswer).toHaveBeenCalledTimes(2);
});

it('reuses the R2 URL after save failures and reconciles a server save whose acknowledgement was lost', async () => {
  let app = runtime();
  await app.intake.load();
  app.intake.set({ submissionId: id });
  const server = draft();
  const io = {
    upload: jest.fn(async () => 'https://cdn.test/photo.jpg'),
    saveShot: jest.fn(async (a: SaveShotArgs) => {
      server.shots = [{ ...a, extra: a.extra === true, updatedAt: 1 }];
      throw new Error('Connection closed after commit');
    }),
    saveAnswer: jest.fn(),
  };
  app.rememberOwnerUpload({ kind: 'photo', submissionId: id, index: 0, extra: true, uri: 'file://photo.jpg' }, io);
  await app.queue.drain();
  expect(io.upload).toHaveBeenCalledTimes(1);
  expect(io.saveShot).toHaveBeenCalledTimes(3);
  expect(server.shots).toHaveLength(1);
  jest.resetModules();
  app = runtime();
  await app.resumeOwnerUploads(id, server, io);
  await app.queue.drain();
  expect(app.intake.get().uploads![0].saved).toBe(true);
  expect(io.upload).toHaveBeenCalledTimes(1);
  expect(io.saveShot).toHaveBeenCalledTimes(3);
});

it('a retake during upload cannot overwrite or clear the new photo', async () => {
  const app = runtime();
  await app.intake.load();
  app.intake.set({ submissionId: id });
  let finishOld!: (url: string) => void;
  const io = {
    upload: jest.fn((uri: string) => uri.endsWith('old.jpg') ? new Promise<string>((resolve) => { finishOld = resolve; }) : Promise.resolve('https://cdn.test/new.jpg')),
    saveShot: jest.fn(async () => {}), saveAnswer: jest.fn(),
  };
  app.rememberOwnerUpload({ kind: 'photo', submissionId: id, index: 0, extra: false, uri: 'file://old.jpg' }, io);
  await app.intake.flush();
  await Promise.resolve();
  app.rememberOwnerUpload({ kind: 'photo', submissionId: id, index: 0, extra: false, uri: 'file://new.jpg' }, io);
  finishOld('https://cdn.test/old.jpg');
  await app.queue.drain();
  expect(io.saveShot).toHaveBeenCalledTimes(1);
  expect(io.saveShot).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://cdn.test/new.jpg', index: 0, extra: false }));
  expect(app.intake.get().uploads).toEqual([expect.objectContaining({ uri: 'file://new.jpg', saved: true })]);
});

it('recovers pre-journal local photos but does not upload slots the server already saved', async () => {
  const app = runtime();
  await app.intake.load();
  app.intake.set({ submissionId: id, shots: ['file://one.jpg', 'file://two.jpg', 'file://three.jpg'] });
  const server = draft();
  server.shots = [{ index: 0, extra: false, url: 'https://cdn.test/one.jpg', updatedAt: 1 }];
  const io = { upload: jest.fn(async (uri: string) => `https://cdn.test/${uri.split('/').pop()}`), saveShot: jest.fn(async () => {}), saveAnswer: jest.fn() };
  await app.resumeOwnerUploads(id, server, io);
  await app.queue.drain();
  expect(io.upload).toHaveBeenCalledTimes(2);
  expect(io.upload).not.toHaveBeenCalledWith('file://one.jpg', expect.anything());
  expect(app.intake.get().uploads).toHaveLength(3);
  await app.resumeOwnerUploads('different-owner-site' as SubmissionId, server, io);
  expect(io.upload).toHaveBeenCalledTimes(2);
});

it('a successful retake removes a failed predecessor instead of blocking submit forever', async () => {
  const app = runtime();
  await app.intake.load();
  app.intake.set({ submissionId: id });
  const io = {
    upload: jest.fn(async (uri: string) => { if (uri.endsWith('broken.jpg')) throw new Error('File missing'); return 'https://cdn.test/retake.jpg'; }),
    saveShot: jest.fn(async () => {}), saveAnswer: jest.fn(),
  };
  app.rememberOwnerUpload({ kind: 'photo', submissionId: id, index: 0, extra: false, uri: 'file://broken.jpg' }, io);
  await app.queue.drain();
  expect(app.queue.snapshot().failed).toBe(1);
  app.rememberOwnerUpload({ kind: 'photo', submissionId: id, index: 0, extra: false, uri: 'file://retake.jpg' }, io);
  await app.queue.drain();
  expect(app.queue.snapshot()).toMatchObject({ failed: 0, done: 1 });
  expect(app.intake.get().uploads).toEqual([expect.objectContaining({ uri: 'file://retake.jpg', saved: true })]);
});
