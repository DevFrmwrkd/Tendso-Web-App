import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Image, Modal, StyleSheet } from 'react-native';
import TrainingScreen from '../app/(app)/training';
import TrainingLessonsScreen from '../app/(app)/training-lessons';
import { TrainingPhoto } from '../components/TrainingPhoto';
import { TRAINING_LESSONS } from '../lib/trainingLessons';

const mockRouter = {
  push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(),
  canGoBack: jest.fn(() => true),
};
let mockParams: { lesson?: string } = {};
let mockCompleted: number[] = [];
const mockReadCompleted = jest.fn();
const mockMarkLessonDone = jest.fn();

// Expo's test asset transformer returns 1 for every JPG. Give these photos
// distinct identities so a wrong lesson image or repeated example fails.
jest.mock('../assets/training/overview.jpg', () => ({ uri: 'training-classroom', width: 1024, height: 688 }));
jest.mock('../assets/training/lesson-1.jpg', () => ({ uri: 'lesson-lighting', width: 896, height: 1120 }));
jest.mock('../assets/training/lesson-2.jpg', () => ({ uri: 'lesson-audio', width: 1120, height: 896 }));
jest.mock('../assets/training/lesson-4.jpg', () => ({ uri: 'lesson-interview', width: 1120, height: 896 }));
jest.mock('../assets/training/forge-owner-portrait-v1.jpg', () => ({ uri: 'forge-portrait', width: 880, height: 1168 }));
jest.mock('../assets/training/forge-shop-front-v1.jpg', () => ({ uri: 'forge-shop-front', width: 880, height: 1168 }));
jest.mock('../assets/training/forge-haircut-v1.jpg', () => ({ uri: 'forge-craft', width: 880, height: 1168 }));

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: 'agent_1' }) }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => {
    require('react').useEffect(effect, [effect]);
  },
  Stack: { Screen: () => null },
}));
jest.mock('../lib/trainingLessons', () => ({
  ...jest.requireActual('../lib/trainingLessons'),
  readCompletedLessons: (...args: unknown[]) => mockReadCompleted(...args),
  markLessonDone: (...args: unknown[]) => mockMarkLessonDone(...args),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockCompleted = [];
  mockReadCompleted.mockReset().mockImplementation(async () => [...mockCompleted]);
  mockMarkLessonDone.mockReset().mockImplementation(async (_userId: string, lessonId: number) => {
    mockCompleted = [...new Set([...mockCompleted, lessonId])];
  });
});

function next(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByRole('button', { name: /Got it|Start the quiz|Finish/ }));
}

describe('Training list', () => {
  it('shows the full classroom photo without cropping the instructor into a short banner', async () => {
    const screen = render(<TrainingScreen />);
    await waitFor(() => expect(mockReadCompleted).toHaveBeenCalledWith('agent_1'));
    const image = screen.getByLabelText('An instructor teaching a group of field agents.');
    const style = StyleSheet.flatten(image.props.style);
    expect(image.props.source).toEqual(expect.objectContaining({ uri: 'training-classroom' }));
    expect(image.props.resizeMode).toBe('contain');
    expect(style.aspectRatio).toBe(1024 / 688);
    expect(style.height).toBeUndefined();
    expect(mockMarkLessonDone).not.toHaveBeenCalled();
  });

  it('opens each lesson directly as a button without recording completion', async () => {
    const screen = render(<TrainingScreen />);
    await waitFor(() => expect(mockReadCompleted).toHaveBeenCalledWith('agent_1'));
    const titles = ['Light the shop', 'Clear audio', 'Photos that sell', 'Get the owner talking', 'The shots we need'];
    for (const [index, title] of titles.entries()) {
      fireEvent.press(screen.getByRole('button', { name: new RegExp(title) }));
      expect(mockRouter.push).toHaveBeenLastCalledWith({
        pathname: '/(app)/training-lessons', params: { lesson: String(index) },
      });
    }
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(mockMarkLessonDone).not.toHaveBeenCalled();
  });

  it('shows only completed lesson IDs as completed and continues with the first missing lesson', async () => {
    mockCompleted = [2, 5];
    const screen = render(<TrainingScreen />);
    await waitFor(() => expect(screen.getByText('2 of 5')).toBeTruthy());
    expect(screen.getByRole('button', { name: /Clear audio, completed,/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /The shots we need, completed,/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Light the shop, completed,/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Photos that sell, completed,/i })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Continue lesson 1' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(app)/training-lessons', params: { lesson: '0' },
    });
    expect(screen.queryByRole('button', { name: 'Take the quiz' })).toBeNull();
  });

  it('continues at a missing lesson in the middle instead of using the completion count as its index', async () => {
    mockCompleted = [1, 3, 4, 5];
    const screen = render(<TrainingScreen />);
    await waitFor(() => expect(screen.getByText('4 of 5')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Continue lesson 2' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(app)/training-lessons', params: { lesson: '1' },
    });
    expect(screen.queryByRole('button', { name: 'Take the quiz' })).toBeNull();
  });

  it('offers the quiz only after every lesson is completed', async () => {
    mockCompleted = [1, 2, 3, 4, 5];
    const screen = render(<TrainingScreen />);
    await waitFor(() => expect(screen.getByText('5 of 5')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Take the quiz' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/certification-quiz');
    expect(mockMarkLessonDone).not.toHaveBeenCalled();
  });
});

describe('Training lessons', () => {
  it.each(TRAINING_LESSONS.map((lesson, index) => [index, lesson] as const))(
    'opens the full instructional image for lesson %s without completing it',
    (index, lesson) => {
      mockParams = { lesson: String(index) };
      const screen = render(<TrainingLessonsScreen />);
      const photos = lesson.examples ?? [{ title: lesson.title, photo: lesson.photo }];
      expect(screen.getAllByRole('button', { name: /^View full image:/ })).toHaveLength(photos.length);
      if (lesson.id === 5) {
        expect(photos.map((photo) => photo.title)).toEqual(['Portrait', 'Shop front', 'Craft']);
        const imageUris = photos.map((photo) => Image.resolveAssetSource(photo.photo)?.uri);
        expect(imageUris).toEqual(['forge-portrait', 'forge-shop-front', 'forge-craft']);
        expect(new Set(imageUris).size).toBe(3);
        for (const photo of photos) expect(screen.getByText(photo.title)).toBeTruthy();
      }

      for (const photo of photos) {
        fireEvent.press(screen.getByRole('button', { name: `View full image: ${photo.title}` }));
        const fullImage = screen.getByLabelText(`Full image: ${photo.title}`);
        expect(fullImage.props.source).toEqual(photo.photo);
        expect(fullImage.props.resizeMode).toBe('contain');
        fireEvent.press(screen.getByRole('button', { name: 'Close full image' }));
        expect(screen.queryByLabelText(`Full image: ${photo.title}`)).toBeNull();
      }
      expect(mockMarkLessonDone).not.toHaveBeenCalled();
    },
  );

  it('keeps the image aligned with its lesson after advancing', async () => {
    mockParams = { lesson: '1' };
    const screen = render(<TrainingLessonsScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'View full image: Clear audio' }));
    const audioSource = screen.getByLabelText('Full image: Clear audio').props.source;
    expect(audioSource).toEqual(expect.objectContaining({ uri: 'lesson-audio' }));
    fireEvent.press(screen.getByRole('button', { name: 'Close full image' }));
    next(screen);
    await waitFor(() => expect(screen.getByText('Photos that sell')).toBeTruthy());
    expect(screen.queryByLabelText('Full image: Clear audio')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'View full image: Photos that sell' }));
    const portraitSource = screen.getByLabelText('Full image: Photos that sell').props.source;
    expect(portraitSource).toEqual(expect.objectContaining({ uri: 'forge-portrait' }));
    expect(portraitSource).not.toEqual(audioSource);
    expect(mockMarkLessonDone).toHaveBeenCalledWith('agent_1', 2);
  });

  it.each([
    ['1', 'Clear audio'],
    ['4', 'The shots we need'],
  ])('returns directly opened lesson %s to Training without completing it', async (lesson, title) => {
    mockParams = { lesson };
    const screen = render(<TrainingLessonsScreen />);
    expect(screen.getByText(title)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/training');
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockMarkLessonDone).not.toHaveBeenCalled();
  });

  it('marks only the current lesson complete, advances, and still returns Back to Training', async () => {
    mockParams = { lesson: '1' };
    const screen = render(<TrainingLessonsScreen />);
    expect(mockMarkLessonDone).not.toHaveBeenCalled();
    next(screen);
    await waitFor(() => expect(screen.getByText('Photos that sell')).toBeTruthy());
    expect(mockMarkLessonDone).toHaveBeenCalledTimes(1);
    expect(mockMarkLessonDone).toHaveBeenCalledWith('agent_1', 2);
    expect(mockCompleted).toEqual([2]);
    expect(screen.queryByText('Light the shop')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/training');
    expect(mockMarkLessonDone).toHaveBeenCalledTimes(1);
  });

  it('waits for completion to save before advancing', async () => {
    let finish!: () => void;
    mockMarkLessonDone.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    mockParams = { lesson: '1' };
    const screen = render(<TrainingLessonsScreen />);
    next(screen);
    expect(screen.getByText('Clear audio')).toBeTruthy();
    expect(screen.queryByText('Photos that sell')).toBeNull();
    await act(async () => { finish(); });
    expect(screen.getByText('Photos that sell')).toBeTruthy();
  });

  it('does not advance after Back while a lesson confirmation is still saving', async () => {
    let finish!: () => void;
    mockMarkLessonDone.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    mockParams = { lesson: '4' };
    mockCompleted = [1, 2, 3, 4, 5];
    const screen = render(<TrainingLessonsScreen />);
    next(screen);
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/training');
    await act(async () => { finish(); });
    expect(mockMarkLessonDone).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('returns to Training when the final lesson is completed out of order', async () => {
    mockParams = { lesson: '4' };
    const screen = render(<TrainingLessonsScreen />);
    next(screen);
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/training'));
    expect(mockMarkLessonDone).toHaveBeenCalledWith('agent_1', 5);
    expect(mockCompleted).toEqual([5]);
    expect(mockRouter.push).not.toHaveBeenCalledWith('/(app)/certification-quiz');
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/(app)/certification-quiz');
  });

  it('opens the quiz after confirming the final lesson when all earlier lessons are complete', async () => {
    mockCompleted = [1, 2, 3, 4];
    mockParams = { lesson: '4' };
    const screen = render(<TrainingLessonsScreen />);
    next(screen);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/certification-quiz'));
    expect(mockMarkLessonDone).toHaveBeenCalledWith('agent_1', 5);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });
});

describe('Training photo framing', () => {
  it.each([
    ['portrait', 600, 800],
    ['landscape', 1000, 600],
  ] as const)('preserves a %s image in its original aspect ratio instead of clipping it to a banner', (_kind, width, height) => {
    const screen = render(<TrainingPhoto source={{ uri: 'training-example', width, height }} label="Example" />);
    const image = screen.UNSAFE_getByType(Image);
    const style = StyleSheet.flatten(image.props.style);
    expect(style.aspectRatio).toBe(width / height);
    expect(style.height).toBeUndefined();
    expect(image.props.resizeMode).toBe('contain');
  });

  it('dismisses the full image on Android Back without leaving or completing the lesson', () => {
    mockParams = { lesson: '2' };
    const screen = render(<TrainingLessonsScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'View full image: Photos that sell' }));
    expect(screen.getByLabelText('Full image: Photos that sell')).toBeTruthy();
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    expect(screen.queryByLabelText('Full image: Photos that sell')).toBeNull();
    expect(screen.getByText('Photos that sell')).toBeTruthy();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockMarkLessonDone).not.toHaveBeenCalled();
  });
});
