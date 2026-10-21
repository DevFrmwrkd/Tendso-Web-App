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

/** How many lessons this person has finished (0 to 5). Never throws. */
export async function readLessonsDone(userId?: string | null): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(progressKey(userId));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), TRAINING_LESSONS.length) : 0;
  } catch {
    return 0;
  }
}

/** Remember that `count` lessons are finished. Only ever moves forward. */
export async function saveLessonsDone(userId: string | null | undefined, count: number): Promise<void> {
  try {
    const current = await readLessonsDone(userId);
    if (count > current) await AsyncStorage.setItem(progressKey(userId), String(count));
  } catch {
    // Progress is a convenience. Losing it only means the bar starts again.
  }
}
