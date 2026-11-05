import AsyncStorage from '@react-native-async-storage/async-storage';
import { markLessonDone, readCompletedLessons, readLessonsDone, saveLessonsDone } from '../lib/trainingLessons';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
}));

const completedKey = (user = 'alice') => `tendso.training.completedLessonIds.${user}`;
const legacyKey = (user = 'alice') => `tendso.training.lessonsDone.${user}`;

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
});

it('starts with no lessons completed', async () => {
  expect(await readCompletedLessons('alice')).toEqual([]);
  expect(await readLessonsDone('alice')).toBe(0);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('completes only the selected lesson and retains it when another lesson is completed', async () => {
  await markLessonDone('alice', 5);
  expect(await readCompletedLessons('alice')).toEqual([5]);
  expect(await readLessonsDone('alice')).toBe(1);
  expect(mockStorage.has(legacyKey())).toBe(false);

  await markLessonDone('alice', 2);
  expect(await readCompletedLessons('alice')).toEqual([2, 5]);
  expect(await readLessonsDone('alice')).toBe(2);
});

it('reads legacy counts as the first N completed lessons without rewriting storage', async () => {
  mockStorage.set(legacyKey(), '3');
  expect(await readCompletedLessons('alice')).toEqual([1, 2, 3]);
  expect(await readLessonsDone('alice')).toBe(3);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('carries legacy progress into explicit progress and picks up later legacy completions', async () => {
  mockStorage.set(legacyKey(), '1');
  await markLessonDone('alice', 5);
  expect(mockStorage.get(completedKey())).toBe('[1,5]');
  expect(mockStorage.get(legacyKey())).toBe('1');

  mockStorage.set(legacyKey(), '3');
  expect(await readCompletedLessons('alice')).toEqual([1, 2, 3, 5]);
});

it('keeps progress isolated between users and anonymous storage', async () => {
  await markLessonDone('alice', 3);
  await markLessonDone('bob', 2);
  await markLessonDone(undefined, 5);

  expect(await readCompletedLessons('alice')).toEqual([3]);
  expect(await readCompletedLessons('bob')).toEqual([2]);
  expect(await readCompletedLessons(null)).toEqual([5]);
  expect(await readCompletedLessons('charlie')).toEqual([]);
});

it('ignores duplicate, malformed, fractional, and unknown IDs while preserving valid progress', async () => {
  mockStorage.set(completedKey(), '[5,2,2,0,6,-1,1.5,"3",null,{},true]');
  expect(await readCompletedLessons('alice')).toEqual([2, 5]);

  await markLessonDone('alice', 4);
  expect(mockStorage.get(completedKey())).toBe('[2,4,5]');
});

it.each(['not-json', '{"completed":[4]}', 'null', '5'])('falls back to legacy progress for malformed explicit data: %s', async (raw) => {
  mockStorage.set(completedKey(), raw);
  mockStorage.set(legacyKey(), '2');
  expect(await readCompletedLessons('alice')).toEqual([1, 2]);
});

it.each([['99', [1, 2, 3, 4, 5]], ['-5', []], ['garbage', []], ['3junk', []]])(
  'bounds malformed or out-of-range legacy counts: %s', async (raw, expected) => {
    mockStorage.set(legacyKey(), raw as string);
    expect(await readCompletedLessons('alice')).toEqual(expected);
  },
);

it('does not reset progress when a lesson is repeated or an invalid ID is submitted', async () => {
  await markLessonDone('alice', 3);
  jest.clearAllMocks();
  for (const id of [3, 0, 6, -1, 1.5, NaN, Infinity]) await markLessonDone('alice', id);
  expect(await readCompletedLessons('alice')).toEqual([3]);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('merges simultaneous completions instead of letting the last write erase earlier ones', async () => {
  await Promise.all([2, 5, 4, 1, 3, 2].map((id) => markLessonDone('alice', id)));
  expect(await readCompletedLessons('alice')).toEqual([1, 2, 3, 4, 5]);
});

it('waits for a pending completion before reading progress', async () => {
  const completion = markLessonDone('alice', 4);
  expect(await readCompletedLessons('alice')).toEqual([4]);
  await completion;
});

it('preserves non-prefix progress when an older caller saves a prefix count', async () => {
  await markLessonDone('alice', 5);
  await saveLessonsDone('alice', 2);
  expect(await readCompletedLessons('alice')).toEqual([1, 2, 5]);
  expect(mockStorage.get(legacyKey())).toBe('2');

  await saveLessonsDone('alice', 1);
  expect(await readCompletedLessons('alice')).toEqual([1, 2, 5]);
  expect(mockStorage.get(legacyKey())).toBe('2');
});

it('ignores invalid compatibility counts and caps valid counts at the lesson total', async () => {
  for (const count of [NaN, Infinity, -1, 0]) await saveLessonsDone('alice', count);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await saveLessonsDone('alice', 99);
  expect(await readLessonsDone('alice')).toBe(5);
  expect(mockStorage.get(legacyKey())).toBe('5');
});

it('does not overwrite stored progress when storage cannot be read, and recovers on the next completion', async () => {
  mockStorage.set(completedKey(), '[5]');
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(markLessonDone('alice', 2)).resolves.toBeUndefined();
  expect(mockStorage.get(completedKey())).toBe('[5]');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();

  await markLessonDone('alice', 3);
  expect(await readCompletedLessons('alice')).toEqual([3, 5]);
});

it('keeps storage failures from throwing to the lesson screen', async () => {
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(readCompletedLessons('alice')).resolves.toEqual([]);
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(markLessonDone('alice', 2)).resolves.toBeUndefined();
  await markLessonDone('alice', 3);
  expect(await readCompletedLessons('alice')).toEqual([3]);
});
