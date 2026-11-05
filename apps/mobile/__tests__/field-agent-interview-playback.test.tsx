import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { InterviewPlayback } from '../components/field-agent/InterviewPlayback';
const mockCreate = jest.fn();
const mockPauseVideo = jest.fn();
let mockFocused = true;
let mockStatus: (status: any) => void;
const mockSound = { unloadAsync: jest.fn(), pauseAsync: jest.fn(), getStatusAsync: jest.fn(), playAsync: jest.fn(), replayAsync: jest.fn() };
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('expo-av', () => ({
  Audio: { setAudioModeAsync: jest.fn(async () => {}), Sound: { createAsync: (...args: any[]) => mockCreate(...args) } },
  Video: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({ pauseAsync: mockPauseVideo }));
    return require('react').createElement(require('react-native').View, { ...props, testID: 'preview-video' });
  }), ResizeMode: { CONTAIN: 'contain' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const draw = (props: Partial<React.ComponentProps<typeof InterviewPlayback>> = {}) => <InterviewPlayback uri="file://audio.m4a" kind="audio" {...props} />;
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true;
  for (const action of Object.values(mockSound)) action.mockReset().mockResolvedValue(undefined);
  mockPauseVideo.mockReset().mockResolvedValue(undefined);
  mockSound.getStatusAsync.mockResolvedValue({ isLoaded: true, isPlaying: false, positionMillis: 0, durationMillis: 100 });
  mockSound.pauseAsync.mockImplementation(async () => mockStatus({ isLoaded: true, isPlaying: false }));
  mockCreate.mockReset().mockImplementation(async (_source, _state, callback) => {
    mockStatus = callback; callback({ isLoaded: true, isPlaying: true }); return { sound: mockSound };
  });
});
it('plays and pauses the saved audio without recording', async () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Listen back' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pause playback' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Pause playback' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Listen back' })).toBeTruthy());
  expect(mockSound.pauseAsync).toHaveBeenCalledTimes(1);
});
it('replays after completion even when didJustFinish is absent from the next status read', async () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Listen back' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pause playback' })).toBeTruthy());
  act(() => mockStatus({ isLoaded: true, isPlaying: false, didJustFinish: true }));
  mockSound.getStatusAsync.mockResolvedValue({ isLoaded: true, isPlaying: false, didJustFinish: false, positionMillis: 100, durationMillis: 100 });
  fireEvent.press(screen.getByRole('button', { name: 'Listen back' }));
  await waitFor(() => expect(mockSound.replayAsync).toHaveBeenCalledTimes(1));
  expect(mockSound.playAsync).not.toHaveBeenCalled();
});
it('unloads audio when the screen blurs and ignores an old status callback', async () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Listen back' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pause playback' })).toBeTruthy());
  mockFocused = false; screen.rerender(draw());
  expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);
  act(() => mockStatus({ isLoaded: true, isPlaying: true }));
  expect(screen.getByRole('button', { name: 'Listen back' })).toBeTruthy();
});
it('unloads a sound created after navigation has already left the screen', async () => {
  let finish!: (value: { sound: typeof mockSound }) => void;
  mockCreate.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const screen = render(draw()); fireEvent.press(screen.getByRole('button', { name: 'Listen back' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  mockFocused = false; screen.rerender(draw());
  await act(async () => { finish({ sound: mockSound }); });
  expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);
});
it('releases the previous source when the saved recording changes', async () => {
  const screen = render(draw()); fireEvent.press(screen.getByRole('button', { name: 'Listen back' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pause playback' })).toBeTruthy());
  screen.rerender(draw({ uri: 'file://replacement.m4a' }));
  expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Listen back' })).toBeTruthy();
});
it('reports failed video playback and offers an explicit retry', () => {
  const onUnavailable = jest.fn();
  const screen = render(draw({ kind: 'video', uri: 'https://media.example.test/video.mp4', onUnavailable }));
  fireEvent(screen.getByTestId('preview-video'), 'error', 'Network unavailable');
  expect(onUnavailable).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert')).toHaveTextContent(/Could not play this recording\./);
  fireEvent.press(screen.getByRole('button', { name: 'Try playback again' }));
  expect(screen.getByTestId('preview-video')).toHaveProp('source', { uri: 'https://media.example.test/video.mp4' });
});
it('pauses native video when navigation leaves its screen', () => {
  const screen = render(draw({ kind: 'video' }));
  mockFocused = false; screen.rerender(draw({ kind: 'video' }));
  expect(mockPauseVideo).toHaveBeenCalledTimes(1);
});
it('shows audio errors without removing the saved recording', async () => {
  mockCreate.mockRejectedValueOnce(new Error('Audio unavailable'));
  const onUnavailable = jest.fn(); const screen = render(draw({ onUnavailable }));
  fireEvent.press(screen.getByRole('button', { name: 'Listen back' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Could not play this recording\./));
  expect(onUnavailable).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Listen back' })).toBeEnabled();
});

it('creates a fresh audio player when retrying a failed native sound', async () => {
  const screen = render(draw()); fireEvent.press(screen.getByRole('button', { name: 'Listen back' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pause playback' })).toBeTruthy());
  act(() => mockStatus({ isLoaded: false, error: 'Decoder stopped' }));
  expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Listen back' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: 'Pause playback' })).toBeTruthy();
  expect(mockSound.getStatusAsync).not.toHaveBeenCalled();
});
