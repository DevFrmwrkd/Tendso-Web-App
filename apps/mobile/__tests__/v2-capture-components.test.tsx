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
  mockTakePicture.mockReset();
  mockTakePicture.mockResolvedValue({ uri: 'file://shot.jpg' });
  mockRecord.mockReset();
  mockRecord.mockImplementation(() => new Promise<{ uri: string }>(() => {}));
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
    expect(r.getByText('Phone steady')).toBeTruthy();

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

  it('locks task navigation and close until a pending photo is saved in its original slot', async () => {
    let resolve!: (photo: { uri: string }) => void;
    mockTakePicture.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const onShot = jest.fn();
    const onDone = jest.fn();
    const onClose = jest.fn();
    const r = wrap(<ShotGuide tasks={SHOT_LISTS.barber.slice(0, 2)} onShot={onShot} onDone={onDone} onClose={onClose} />);
    await act(flush);
    fireEvent.press(r.getByLabelText('Take photo'));
    fireEvent.press(r.getByLabelText('Skip this photo'));
    fireEvent.press(r.getByLabelText('Profile picture'));
    fireEvent.press(r.getByLabelText('Close'));
    fireEvent.press(r.getByLabelText('Take photo'));
    expect(r.getByText('Shot 1 of 2')).toBeTruthy();
    expect(mockTakePicture).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { resolve({ uri: 'file://pending.jpg' }); await flush(); });
    expect(onShot).toHaveBeenCalledWith(0, 'file://pending.jpg');
    fireEvent.press(r.getByLabelText('Skip this photo'));
    expect(onDone).toHaveBeenCalledWith(['file://pending.jpg', null]);
  });

  it('draws no outline or grid over the camera', () => {
    const r = wrap(<ShotGuide tasks={SHOT_LISTS.salon} onDone={jest.fn()} onClose={jest.fn()} />);
    expect(r.queryByTestId('ghost-outline')).toBeNull();
    expect(r.UNSAFE_queryAllByProps({ strokeDasharray: expect.anything() })).toHaveLength(0);
  });

  it('retakes a selected filled slot at capacity without appending another photo', async () => {
    const onDone = jest.fn();
    const onShot = jest.fn();
    const r = wrap(<ShotGuide tasks={SHOT_LISTS.barber.slice(0, 2)} initial={['file://old-head.jpg', 'file://old-work.jpg']}
      initialIndex={0} maxCaptured={2} singleShot onShot={onShot} onDone={onDone} onClose={jest.fn()} />);
    await act(flush);
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(r.getByLabelText('Take photo')); await flush(); });
    expect(onShot).toHaveBeenCalledWith(0, 'file://shot.jpg');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(['file://shot.jpg', 'file://old-work.jpg']);
  });

  it('returns after the remaining photo capacity is used without requiring every suggestion', async () => {
    const onDone = jest.fn();
    const r = wrap(<ShotGuide tasks={SHOT_LISTS.barber.slice(0, 3)} initialIndex={1} maxCaptured={1}
      onDone={onDone} onClose={jest.fn()} />);
    await act(flush);
    await act(async () => { fireEvent.press(r.getByLabelText('Take photo')); await flush(); });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith([null, 'file://shot.jpg', null]);
  });

  it('does not deliver a late native photo after the camera screen is unmounted', async () => {
    let release!: (photo: { uri: string }) => void;
    mockTakePicture.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const onShot = jest.fn(); const onDone = jest.fn();
    const r = wrap(<ShotGuide tasks={SHOT_LISTS.barber.slice(0, 2)} onShot={onShot} onDone={onDone} onClose={jest.fn()} />);
    await act(flush);
    fireEvent.press(r.getByLabelText('Take photo'));
    r.unmount();
    await act(async () => { release({ uri: 'file://late-photo.jpg' }); await flush(); });
    expect(onShot).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
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

  it('waits for clip teardown before advancing and ignores overlapping Next and pause taps', async () => {
    let resolve!: (clip: { uri: string }) => void;
    mockRecord.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const onClip = jest.fn();
    const r = wrap(<InterviewCam recording="perQuestion" onClip={onClip} onFinish={jest.fn()} onClose={jest.fn()} />);
    await act(flush);
    await act(async () => { jest.advanceTimersByTime(5000); await flush(); });
    await act(async () => { jest.advanceTimersByTime(1300); await flush(); });
    expect(mockRecord).toHaveBeenCalledTimes(1);
    fireEvent.press(r.getByLabelText('Next question'));
    fireEvent.press(r.getByLabelText('Next question'));
    fireEvent.press(r.getByLabelText('Pause'));
    expect(r.getByText('1 / 10')).toBeTruthy();
    expect(mockRecord).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ uri: 'file://answer-0.mp4' }); await flush(); });
    expect(r.getByText('2 / 10')).toBeTruthy();
    expect(mockRecord).toHaveBeenCalledTimes(2);
    expect(onClip).toHaveBeenCalledWith(expect.objectContaining({ index: 0, uri: 'file://answer-0.mp4' }));
  });

  it('runs voice only without a camera', async () => {
    mockCamera.renders = 0;
    const r = wrap(<InterviewCam recording="perQuestion" audioOnly onFinish={jest.fn()} onClose={jest.fn()} />);
    await act(flush);
    expect(mockCamera.renders).toBe(0);
    expect(r.getByText('Hold the phone straight')).toBeTruthy();
  });
});
