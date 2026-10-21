import React from 'react';
import { StyleSheet, Text as RNText } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MIN_FONT_SIZE } from '../theme/v2';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const mockTakePicture = jest.fn(async () => ({ uri: 'file://shot.jpg' }));
const mockRecord = jest.fn(() => new Promise<{ uri: string }>(() => {}));
const mockCamera = { renders: 0 };
jest.mock('expo-camera', () => {
  const React = require('react');
  const CameraView = React.forwardRef((props: any, ref: any) => {
    mockCamera.renders += 1;
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: mockTakePicture,
      recordAsync: mockRecord,
      stopRecording: jest.fn(),
      toggleRecordingAsync: jest.fn(),
      getSupportedFeatures: () => ({ toggleRecordingAsyncAvailable: false }),
    }));
    React.useEffect(() => { props.onCameraReady?.(); }, []);
    return null;
  });
  return {
    CameraView,
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn(async () => ({ granted: true }))],
    useMicrophonePermissions: () => [{ granted: true, canAskAgain: true }, jest.fn(async () => ({ granted: true }))],
  };
});

jest.mock('expo-av', () => ({
  Audio: {
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
    setAudioModeAsync: jest.fn(async () => {}),
    Recording: {
      createAsync: jest.fn(async () => ({
        recording: { stopAndUnloadAsync: jest.fn(async () => {}), getURI: () => 'file://a.m4a', pauseAsync: jest.fn(), startAsync: jest.fn() },
      })),
    },
  },
}));

// A phone held perfectly level.
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(async () => true),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((cb: (m: { x: number; y: number; z: number }) => void) => {
      const t = setInterval(() => cb({ x: 0, y: -1, z: 0 }), 100);
      return { remove: () => clearInterval(t) };
    }),
  },
}));

// eslint-disable-next-line import/first
import { InterviewCam, ShotGuide } from '../components/v2/capture';
// eslint-disable-next-line import/first
import { SHOT_LISTS } from '../lib/v2/captureContent';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

function expectNoSmallText(r: ReturnType<typeof render>) {
  r.UNSAFE_getAllByType(RNText).forEach((n: any) => {
    const size = StyleSheet.flatten(n.props.style)?.fontSize;
    if (size !== undefined) expect(size).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockTakePicture.mockClear();
  mockRecord.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('ShotGuide', () => {
  it('shows one task at a time, takes quick photos and skips', async () => {
    const onShot = jest.fn();
    const onDone = jest.fn();
    const tasks = SHOT_LISTS.barber.slice(0, 3);
    const r = wrap(<ShotGuide tasks={tasks} onShot={onShot} onDone={onDone} onClose={jest.fn()} />);
    expect(r.getByText('Shot 1 of 3')).toBeTruthy();
    expect(r.getByText('Owner headshot')).toBeTruthy();
    await act(async () => { await flush(); jest.advanceTimersByTime(1200); await flush(); });
    expect(r.getByText('Perfect, hold still')).toBeTruthy();

    await act(async () => { fireEvent.press(r.getByLabelText('Take photo')); });
    expect(mockTakePicture).toHaveBeenCalled();
    expect(onShot).toHaveBeenCalledWith(0, 'file://shot.jpg');
    expect(r.getByText('Shot 2 of 3')).toBeTruthy();

    fireEvent.press(r.getByLabelText('Skip this photo'));
    expect(r.getByText('Shot 3 of 3')).toBeTruthy();
    await act(async () => { fireEvent.press(r.getByLabelText('Take photo')); });
    expect(onDone).toHaveBeenCalledWith(['file://shot.jpg', null, 'file://shot.jpg']);
    expectNoSmallText(r);
  });

  it('draws no outline or grid over the camera', () => {
    const r = wrap(<ShotGuide tasks={SHOT_LISTS.salon} onDone={jest.fn()} onClose={jest.fn()} />);
    expect(r.queryByTestId('ghost-outline')).toBeNull();
    expect(r.UNSAFE_queryAllByProps({ strokeDasharray: expect.anything() })).toHaveLength(0);
  });
});

describe('InterviewCam', () => {
  it('checks framing once, then asks the questions as subtitles with Next as the big button', async () => {
    const onFinish = jest.fn();
    const r = wrap(<InterviewCam recording="continuous" onFinish={onFinish} onClose={jest.fn()} />);
    await act(flush);
    expect(r.getByText('Hold the phone straight')).toBeTruthy();
    await act(async () => { await flush(); jest.advanceTimersByTime(500); await flush(); jest.advanceTimersByTime(500); await flush(); });
    expect(r.getByText('Good. Start talking')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(1300); await flush(); });
    expect(r.getByText("What's your shop called?")).toBeTruthy();
    expect(r.getByText('1 / 10')).toBeTruthy();
    expect(mockRecord).toHaveBeenCalledTimes(1);

    await act(async () => { fireEvent.press(r.getByLabelText('Next question')); });
    expect(r.getByText('Where are you?')).toBeTruthy();

    // EN / TL chip
    fireEvent.press(r.getByLabelText('Switch to Tagalog'));
    expect(r.getByText('Saan ka matatagpuan?')).toBeTruthy();
    expect(r.getByLabelText('Susunod na tanong')).toBeTruthy();
    fireEvent.press(r.getByLabelText('Switch to English'));

    for (let i = 0; i < 9; i++) await act(async () => { fireEvent.press(r.getByLabelText('Next question')); });
    expect(r.getByText('Anything else?')).toBeTruthy();
    expect(r.getByLabelText('Finish')).toBeTruthy();
    expectNoSmallText(r);
  });

  it('runs voice only without a camera', async () => {
    mockCamera.renders = 0;
    const r = wrap(<InterviewCam recording="perQuestion" audioOnly onFinish={jest.fn()} onClose={jest.fn()} />);
    await act(flush);
    expect(mockCamera.renders).toBe(0);
    expect(r.getByText('Hold the phone straight')).toBeTruthy();
  });
});
