import React from 'react';
import { Alert, AppState, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { InterviewCam } from '../components/v2/capture/InterviewCam';

const mockRecord = jest.fn();
const mockStop = jest.fn();
const mockToggle = jest.fn();
const mockCreateAudio = jest.fn();
const mockRequestMic = jest.fn();
const mockRequestCamera = jest.fn();
let mockMicrophoneGranted = true;
let mockCanPause = true;
let mockFinishVideo: (value: { uri: string }) => void;
const mockAudio = {
  stopAndUnloadAsync: jest.fn(async () => {}), getURI: () => 'file://parallel.m4a',
  pauseAsync: jest.fn(async () => {}), startAsync: jest.fn(async () => {}),
};

jest.mock('../components/v2/capture/useLevel', () => ({
  useLevel: () => ({ roll: 0, pitch: 0, shake: 0, hasSensor: true, steadyMs: 1000 }),
}));
jest.mock('expo-camera', () => {
  const ReactModule = require('react');
  return {
    CameraView: ReactModule.forwardRef((props: any, ref: any) => {
      ReactModule.useImperativeHandle(ref, () => ({
        recordAsync: mockRecord, stopRecording: mockStop, toggleRecordingAsync: mockToggle,
        getSupportedFeatures: () => ({ toggleRecordingAsyncAvailable: mockCanPause }),
      }));
      ReactModule.useEffect(() => { props.onCameraReady?.(); }, []);
      return null;
    }),
    useMicrophonePermissions: () => [{ granted: mockMicrophoneGranted }, mockRequestMic],
    useCameraPermissions: () => [{ granted: true }, mockRequestCamera],
  };
});
jest.mock('expo-av', () => ({ Audio: {
  RecordingOptionsPresets: { HIGH_QUALITY: {} }, setAudioModeAsync: jest.fn(async () => {}),
  Recording: { createAsync: (...args: unknown[]) => mockCreateAudio(...args) },
} }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('../components/v2/capture/CamChrome', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View: RNView } = require('react-native');
  return {
    GlassButton: ({ label, onPress }: any) => ReactModule.createElement(Pressable, { accessibilityLabel: label, onPress }),
    GlassPill: ({ children, onPress, label }: any) => ReactModule.createElement(RNView, { accessibilityLabel: label, onPress }, children),
    PillText: ({ children }: any) => ReactModule.createElement(Text, null, children),
    HintChip: () => null, LevelLine: () => null, TopShade: () => null, BottomShade: () => null,
    subtitle: { count: {}, big: {} },
  };
});

const question = [{ en: 'First question?', tl: 'Unang tanong?' }];
const flush = async () => { for (let count = 0; count < 15; count++) await Promise.resolve(); };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockCanPause = true; mockMicrophoneGranted = true;
  mockRecord.mockImplementation(() => new Promise(resolve => { mockFinishVideo = resolve; }));
  mockStop.mockImplementation(() => mockFinishVideo?.({ uri: 'file://interview.mp4' }));
  mockToggle.mockResolvedValue(undefined);
  mockCreateAudio.mockResolvedValue({ recording: mockAudio });
  mockAudio.pauseAsync.mockReset().mockResolvedValue(undefined);
  mockAudio.startAsync.mockReset().mockResolvedValue(undefined);
  mockRequestMic.mockResolvedValue({ granted: true });
  mockRequestCamera.mockResolvedValue({ granted: true });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

async function start(props: Partial<React.ComponentProps<typeof InterviewCam>> = {}) {
  const onFinish = jest.fn();
  const onClose = jest.fn();
  const screen = render(<InterviewCam recording="continuous" questions={question} onFinish={onFinish} onClose={onClose} {...props} />);
  await act(flush);
  await act(async () => { jest.advanceTimersByTime(1300); await flush(); });
  return { screen, onFinish, onClose };
}

it('records one video and one parallel audio across prompts, pause/resume and finish', async () => {
  const { screen, onFinish } = await start();
  expect(screen.getByText('First question?')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(2000); fireEvent.press(screen.getByLabelText('Pause')); await flush(); });
  expect(mockToggle).toHaveBeenCalledTimes(1);
  expect(mockAudio.pauseAsync).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.press(screen.getAllByLabelText('Go on')[0]); await flush(); });
  expect(mockToggle).toHaveBeenCalledTimes(2);
  expect(mockAudio.startAsync).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.press(screen.getByLabelText('Next question')); await flush(); });
  expect(screen.getByText('Anything else?')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText('Finish')); await flush(); });
  expect(mockRecord).toHaveBeenCalledTimes(1);
  expect(mockCreateAudio).toHaveBeenCalledTimes(1);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({
    kind: 'video', uri: 'file://interview.mp4', parallelAudioUri: 'file://parallel.m4a',
    durationSec: 2, answered: 2, marks: [{ index: 0, atSec: 0 }, { index: 1, atSec: 2 }],
  }));
});

it('routes a modal back request through save/discard confirmation and saves a partial take', async () => {
  const { screen, onFinish, onClose } = await start();
  screen.rerender(<InterviewCam recording="continuous" questions={question} onFinish={onFinish} onClose={onClose} closeRequest={1} />);
  expect(Alert.alert).toHaveBeenCalledWith('Stop the interview?', expect.any(String), expect.any(Array), expect.any(Object));
  expect(onClose).not.toHaveBeenCalled();
  expect(mockStop).not.toHaveBeenCalled();
  const save = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!.find(button => button.text === 'Save and close')!;
  await act(async () => { save.onPress!(); await flush(); });
  expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file://interview.mp4', interrupted: true }));
  expect(onClose).not.toHaveBeenCalled();
});

it('does not pretend the video paused when the native pause failed', async () => {
  mockToggle.mockRejectedValueOnce(new Error('Cannot pause'));
  const { screen } = await start();
  await act(async () => { fireEvent.press(screen.getByLabelText('Pause')); await flush(); });
  expect(screen.getByText('Could not pause or resume. Your current recording is still open.')).toBeTruthy();
  expect(screen.getByLabelText('Next question')).toBeTruthy();
  expect(screen.queryAllByLabelText('Go on')).toHaveLength(0);
  expect(mockAudio.pauseAsync).not.toHaveBeenCalled();
});

it('does not offer a fake pause on continuous video when the native camera cannot pause', async () => {
  mockCanPause = false;
  const { screen } = await start();
  expect(screen.queryByLabelText('Pause')).toBeNull();
  expect(screen.getByLabelText('Next question')).toBeTruthy();
});

it('reports an audio-only start failure without advancing prompts or running a REC timer', async () => {
  mockCreateAudio.mockRejectedValueOnce(new Error('Microphone busy'));
  const { screen, onFinish } = await start({ audioOnly: true });
  expect(screen.getByText('Not recording')).toBeTruthy();
  expect(screen.getByLabelText('Next question')).toBeDisabled();
  await act(async () => { jest.advanceTimersByTime(3000); fireEvent.press(screen.getByLabelText('Next question')); await flush(); });
  expect(screen.getByText('First question?')).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
  expect(mockRecord).not.toHaveBeenCalled();
});

it('stops a late audio recorder created after unmount and never starts the camera', async () => {
  let finish!: (value: { recording: typeof mockAudio }) => void;
  mockCreateAudio.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const { screen, onFinish } = await start();
  screen.unmount();
  await act(async () => { finish({ recording: mockAudio }); await flush(); });
  expect(mockAudio.stopAndUnloadAsync).toHaveBeenCalled();
  expect(mockRecord).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();
});

it('saves the take when the native camera stops unexpectedly', async () => {
  const { onFinish } = await start();
  await act(async () => { mockFinishVideo({ uri: 'file://system-ended.mp4' }); await flush(); });
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file://system-ended.mp4', interrupted: true }));
  expect(mockAudio.stopAndUnloadAsync).toHaveBeenCalled();
});

it('ends and saves the current take when the app goes into the background', async () => {
  let appState!: (state: string) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    appState = listener as (state: string) => void;
    return { remove: jest.fn() };
  });
  const { onFinish } = await start();
  await act(async () => { appState('background'); await flush(); });
  expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file://interview.mp4', interrupted: true }));
});

it('preserves owner per-question clip callbacks and its existing Stop-and-close contract', async () => {
  const onClip = jest.fn();
  const { screen, onFinish, onClose } = await start({ recording: 'perQuestion', onClip });
  await act(async () => { fireEvent.press(screen.getByLabelText('Next question')); await flush(); });
  expect(onClip).toHaveBeenCalledWith(expect.objectContaining({ index: 0, kind: 'video', uri: 'file://interview.mp4' }));
  fireEvent.press(screen.getByLabelText('Close'));
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  expect(buttons.some(button => button.text === 'Save and close')).toBe(false);
  await act(async () => { await buttons.find(button => button.text === 'Stop')!.onPress!(); await flush(); });
  expect(onClip).toHaveBeenCalledWith(expect.objectContaining({ index: 1, kind: 'video' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onFinish).not.toHaveBeenCalled();
});

it('does not finish an owner per-question flow just because the app backgrounds', async () => {
  let appState!: (state: string) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appState = listener as (state: string) => void;
    return { remove: jest.fn() };
  });
  const { onFinish } = await start({ recording: 'perQuestion' });
  await act(async () => { appState('background'); await flush(); });
  expect(onFinish).not.toHaveBeenCalled();
  expect(mockStop).not.toHaveBeenCalled();
});

it('keeps earlier owner audio answers if the next native recording fails to start', async () => {
  const onClip = jest.fn();
  const { screen, onFinish, onClose } = await start({ recording: 'perQuestion', audioOnly: true, onClip });
  mockCreateAudio.mockRejectedValueOnce(new Error('Microphone interrupted'));
  await act(async () => { fireEvent.press(screen.getByLabelText('Next question')); await flush(); });
  expect(onClip).toHaveBeenCalledWith(expect.objectContaining({ index: 0, kind: 'audio', uri: 'file://parallel.m4a' }));
  expect(screen.getByText('Could not start the next answer. Close and try again. Your earlier answers are saved.')).toBeTruthy();
  expect(screen.getByLabelText('Next question')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Close'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onFinish).not.toHaveBeenCalled();
});

it.each(['pause', 'resume'])('discards secondary audio after its %s fails while retaining the complete video soundtrack', async failure => {
  const { screen, onFinish } = await start();
  if (failure === 'pause') mockAudio.pauseAsync.mockRejectedValueOnce(new Error('Cannot pause microphone'));
  else mockAudio.startAsync.mockRejectedValueOnce(new Error('Cannot resume microphone'));
  await act(async () => { fireEvent.press(screen.getByLabelText('Pause')); await flush(); });
  await act(async () => { fireEvent.press(screen.getAllByLabelText('Go on')[0]); await flush(); });
  expect(mockAudio.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Separate audio is unavailable. Sound stays in the video.')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText('Next question')); await flush(); });
  await act(async () => { fireEvent.press(screen.getByLabelText('Finish')); await flush(); });
  expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({
    kind: 'video', uri: 'file://interview.mp4', parallelAudioUri: undefined,
  }));
  expect(mockRecord).toHaveBeenCalledTimes(1);
});
