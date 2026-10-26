import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The five training lessons, shared by the training overview and the lesson screen.
 * Static copy, no data. Photos are bundled (apps/mobile/assets/training).
 */
export interface LessonPoint {
  title: string;
  text: string;
}

export interface TrainingLesson {
  id: number;
  title: string;
  minutes: number;
  photo: ImageSourcePropType;
  /** One line under the title. */
  line: string;
  dos: LessonPoint[];
  donts: LessonPoint[];
}

export const TRAINING_LESSONS: TrainingLesson[] = [
  {
    id: 1,
    title: 'Light the shop',
    minutes: 3,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    photo: require('../assets/training/lesson-1.jpg'),
    line: 'Turn the owner toward the light so their face is bright.',
    dos: [
      { title: 'Face the light', text: 'Stand so the window or sun lights their face.' },
      { title: 'Golden hour', text: 'Outdoors, early morning or late afternoon looks best.' },
    ],
    donts: [{ title: 'Window behind them', text: 'They turn into a dark shadow.' }],
  },
  {
    id: 2,
    title: 'Clear audio',
    minutes: 2,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    photo: require('../assets/training/lesson-2.jpg'),
    line: 'Bad sound ruins the video. Test it first.',
    dos: [
      { title: 'Test first', text: 'Record a short clip and play it back.' },
      { title: 'Phone close', text: "Hold it within arm's length of the speaker." },
    ],
    donts: [{ title: 'Background noise', text: 'Turn off fans, TVs and radios. Step away from the road.' }],
  },
  {
    id: 3,
    title: 'Photos that sell',
    minutes: 4,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    photo: require('../assets/training/lesson-3.jpg'),
    line: 'Head and shoulders, centered, at eye level.',
    dos: [
      { title: 'Chest up', text: 'Keep the head and shoulders in the frame.' },
      { title: 'Eye level', text: "Hold the phone at the owner's eye level." },
    ],
    donts: [
      { title: 'Shooting up or down', text: 'It changes how they look.' },
      { title: 'Hats or sunglasses', text: 'Ask them to take them off.' },
    ],
  },
  {
    id: 4,
    title: 'Get the owner talking',
    minutes: 3,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    photo: require('../assets/training/lesson-4.jpg'),
    line: 'Their own words become the site. Relax them first.',
    dos: [
      { title: 'Warm up', text: 'Chat for 2 minutes before you press record.' },
      { title: 'Origin story', text: 'Ask how and why they started the business.' },
      { title: 'Slow down', text: 'Remind them to speak slowly and clearly.' },
    ],
    donts: [],
  },
  {
    id: 5,
    title: 'The shots we need',
    minutes: 3,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    photo: require('../assets/training/lesson-5.jpg'),
    line: 'Three photos are needed before you get paid.',
    dos: [
      { title: 'The portrait', text: 'A clear, well-lit headshot of the owner.' },
      { title: 'The location', text: 'A wide shot of the shop front and signage.' },
      { title: 'The craft', text: 'A working shot, like a barber cutting hair.' },
    ],
    donts: [{ title: 'Blurry photos', text: 'Every photo must be sharp and in focus.' }],
  },
];

const progressKey = (userId?: string | null) => `tendso.training.lessonsDone.${userId ?? 'anon'}`;
const completedLessonsKey = (userId?: string | null) => `tendso.training.completedLessonIds.${userId ?? 'anon'}`;
const progressWrites = new Map<string, Promise<void>>();

function validLessonId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && TRAINING_LESSONS.some((lesson) => lesson.id === id);
}

function legacyCount(raw: string | null): number {
  const count = raw ? Number(raw) : 0;
  return Number.isFinite(count) ? Math.min(Math.max(Math.floor(count), 0), TRAINING_LESSONS.length) : 0;
}

function parseCompletedLessons(raw: string | null): number[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(validLessonId) : [];
  } catch {
    return [];
  }
}

async function readStoredProgress(userId?: string | null): Promise<{ completed: number[]; legacy: number }> {
  const [savedIds, savedCount] = await Promise.all([
    AsyncStorage.getItem(completedLessonsKey(userId)),
    AsyncStorage.getItem(progressKey(userId)),
  ]);
  const legacy = legacyCount(savedCount);
  const completed = new Set(parseCompletedLessons(savedIds));
  for (let index = 0; index < legacy; index += 1) completed.add(TRAINING_LESSONS[index].id);
  return { completed: [...completed].sort((a, b) => a - b), legacy };
}

/** Serialize read/merge/write operations so simultaneous completions cannot erase each other. */
async function updateProgress(userId: string | null | undefined, update: () => Promise<void>): Promise<void> {
  const key = completedLessonsKey(userId);
  const previous = progressWrites.get(key) ?? Promise.resolve();
  const write = previous.then(update).catch(() => {
    // Progress is a convenience. Storage failure must not block the lesson screen.
  });
  progressWrites.set(key, write);
  await write;
  if (progressWrites.get(key) === write) progressWrites.delete(key);
}

/** Completed lesson IDs, including the first N lessons saved by older app versions. Never throws. */
export async function readCompletedLessons(userId?: string | null): Promise<number[]> {
  try {
    await progressWrites.get(completedLessonsKey(userId));
    return (await readStoredProgress(userId)).completed;
  } catch {
    return [];
  }
}

/** Finish just this lesson. Opening a later lesson must not complete the lessons before it. */
export async function markLessonDone(userId: string | null | undefined, lessonId: number): Promise<void> {
  if (!validLessonId(lessonId)) return;
  await updateProgress(userId, async () => {
    const { completed } = await readStoredProgress(userId);
    if (completed.includes(lessonId)) return;
    completed.push(lessonId);
    await AsyncStorage.setItem(completedLessonsKey(userId), JSON.stringify(completed.sort((a, b) => a - b)));
  });
}

/** How many individual lessons this person has finished (0 to 5). Never throws. */
export async function readLessonsDone(userId?: string | null): Promise<number> {
  return (await readCompletedLessons(userId)).length;
}

/** Compatibility for older callers: add the first `count` lessons without resetting other progress. */
export async function saveLessonsDone(userId: string | null | undefined, count: number): Promise<void> {
  if (!Number.isFinite(count) || count < 1) return;
  const boundedCount = Math.min(Math.floor(count), TRAINING_LESSONS.length);
  await updateProgress(userId, async () => {
    const { completed, legacy } = await readStoredProgress(userId);
    const merged = new Set(completed);
    for (let index = 0; index < boundedCount; index += 1) merged.add(TRAINING_LESSONS[index].id);
    if (merged.size > completed.length) {
      await AsyncStorage.setItem(completedLessonsKey(userId), JSON.stringify([...merged].sort((a, b) => a - b)));
    }
    if (boundedCount > legacy) await AsyncStorage.setItem(progressKey(userId), String(boundedCount));
  });
}
