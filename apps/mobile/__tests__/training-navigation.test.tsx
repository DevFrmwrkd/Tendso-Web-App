import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import TrainingScreen from '../app/(app)/training';
import TrainingLessonsScreen from '../app/(app)/training-lessons';

const mockRouter = {
  push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(),
  canGoBack: jest.fn(() => true),
};
let mockParams: { lesson?: string } = {};
let mockCompleted: number[] = [];
const mockReadCompleted = jest.fn();
const mockMarkLessonDone = jest.fn();

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
