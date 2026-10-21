/**
 * InterviewCam — the recording screen (mock js/screens.js `interviewCam`, css "CAMERA SCREENS v4").
 *
 * Full-bleed camera (video + audio), NO outline of any kind. Top: close · REC timer + mic
 * meter · EN/TL chip; the 10-step bar. Framing is measured once (level line + "Hold the phone
 * straight" → "Good. Start talking"), then only a faint level stays. The question sits low like a
 * subtitle (white, text shadow, no box). Bottom: a small pause + the biggest control, "Next
 * question" (→ "Finish ✓" on the last). Never white while recording.
 *
 * Audio-only fallback: `audioOnly`, or automatically when the camera is not allowed.
 *
 * Two recording styles:
 *  - 'perQuestion' (owner app): one clip per question, handed out through onClip as soon as it
 *    ends, so it can upload while the owner answers the next one. Pause restarts the current
 *    answer for video (cameras cannot pause everywhere); audio pauses natively.
 *  - 'continuous' (field agents): one file for the whole interview (+ a parallel audio file for
 *    transcription, as before), with the second each question started at.
 */
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import { colors, fonts } from '../../../theme/v2';
import { CAM_LABELS, INTERVIEW_QUESTIONS, questionAt, type Lang, type Question } from '../../../lib/v2/captureContent';
import { FRAMING_GIVE_UP_MS, formatClock, framingPassed, meterBars, meterLevel } from './level';
import { initialInterview, interviewReducer, isLastQuestion, segmentStates } from './machines';
import { useLevel } from './useLevel';
import { GlassButton, GlassPill, HintChip, LevelLine, PillText, TopShade, BottomShade, subtitle } from './CamChrome';

export type CaptureKind = 'video' | 'audio';

export interface InterviewClip {
  /** 0..9 the questions, 10 = "Anything else?" */
  index: number;
  uri: string;
  kind: CaptureKind;
  durationSec: number;
  lang: Lang;
}

export interface InterviewResult {
  kind: CaptureKind;
  /** Continuous mode: the one recording. */
  uri?: string;
  /** Continuous video: the parallel audio file used for transcription. */
  parallelAudioUri?: string;
  durationSec: number;
  /** Continuous mode: when each question started (seconds into the recording). */
  marks: { index: number; atSec: number }[];
  /** Questions that have a clip / were asked. */
  answered: number;
  lang: Lang;
}

export interface InterviewCamProps {
  recording: 'perQuestion' | 'continuous';
  questions?: readonly Question[];
  lang?: Lang;
  /** front = the owner films themselves; back = a friend or an agent holds the phone. */
  facing?: CameraType;
  audioOnly?: boolean;
  /** Start at this question (resume). */
  startAt?: number;
  onClip?: (clip: InterviewClip) => void;
  onFinish: (result: InterviewResult) => void;
  onClose: () => void;
}

const METER_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

export function InterviewCam({
  recording,
  questions = INTERVIEW_QUESTIONS,
  lang: initialLang = 'en',
  facing = 'front',
  audioOnly: wantsAudioOnly = false,
  startAt = 0,
  onClip,
  onFinish,
  onClose,
}: InterviewCamProps) {
  const insets = useSafeAreaInsets();
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [lang, setLang] = useState<Lang>(initialLang);
  const L = CAM_LABELS[lang];
  const total = questions.length;

  const [state, dispatch] = useReducer(interviewReducer, undefined, () => initialInterview(total, startAt));
  const [framingGood, setFramingGood] = useState(false);
  const framingT0 = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [meter, setMeter] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [audioOnly, setAudioOnly] = useState(wantsAudioOnly);
  const [permissionAsked, setPermissionAsked] = useState(false);

  // Framing is measured once: the sensor only runs while checking (afterwards the faint level is static).
  const level = useLevel(state.phase === 'framing');

  const cameraRef = useRef<CameraView>(null);
  const videoPromise = useRef<Promise<{ uri: string } | undefined> | null>(null);
  /** Resolves after the latest video clip has been handed to onClip. */
  const lastClip = useRef<Promise<void> | null>(null);
  const clipStartedAt = useRef<number>(0);
  const clipIndex = useRef<number>(startAt);
  /** Per video clip: set discard to drop it (pause restarts the answer, close of the agent take). */
  const clipFlag = useRef<{ discard: boolean }>({ discard: false });
  const audioRec = useRef<Audio.Recording | null>(null); // the clip (audio-only) or the meter / parallel file (video)
  const marks = useRef<{ index: number; atSec: number }[]>([]);
  const answered = useRef(new Set<number>());
  const finished = useRef(false);
  const elapsedRef = useRef(0);
  const langRef = useRef(lang);
  langRef.current = lang;
  const canToggle = useRef(false);

  // ---------------------------------------------------------------- permissions
  useEffect(() => {
    let alive = true;
    (async () => {
      const mic = micPerm?.granted ? micPerm : await requestMic();
      let cam = camPerm;
      if (!wantsAudioOnly) cam = camPerm?.granted ? camPerm : await requestCam();
      if (!alive) return;
      if (!mic?.granted) {
        Alert.alert('Microphone needed', 'Please allow the microphone to record your answers.', [{ text: 'OK', onPress: onClose }]);
        return;
      }
      if (!wantsAudioOnly && !cam?.granted) setAudioOnly(true);
      setPermissionAsked(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = permissionAsked && (audioOnly || cameraReady);

  // ---------------------------------------------------------------- framing (measured once)
  useEffect(() => {
    if (state.phase !== 'framing' || !ready || framingGood) return;
    if (framingT0.current === null) framingT0.current = Date.now();
    if (framingPassed(level, Date.now() - framingT0.current)) setFramingGood(true);
  }, [level, state.phase, ready, framingGood]);

  useEffect(() => {
    if (state.phase !== 'framing' || !ready) return;
    const t = setTimeout(() => setFramingGood(true), FRAMING_GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [state.phase, ready]);

  useEffect(() => {
    if (state.phase === 'framing' && framingGood && !state.framingGood) dispatch({ type: 'FRAMING_GOOD' });
  }, [framingGood, state.phase, state.framingGood]);

  useEffect(() => {
    if (state.phase !== 'framing' || !state.framingGood) return;
    const t = setTimeout(() => dispatch({ type: 'BEGIN' }), 1200);
    return () => clearTimeout(t);
  }, [state.phase, state.framingGood]);

  // ---------------------------------------------------------------- timer
  useEffect(() => {
    if (state.phase !== 'asking') return;
    const t = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [state.phase]);

  // ---------------------------------------------------------------- recorders
  const startMeter = useCallback(async () => {
    // Audio-only: this IS the recording. Video: meter (+ parallel transcription file in continuous mode).
    if (audioRec.current) return;
    if (!audioOnly && recording === 'perQuestion' && Platform.OS === 'android') return; // keep the mic for the camera
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        METER_OPTIONS,
        (s) => { if (s.isRecording) setMeter(meterLevel(s.metering)); },
        140,
      );
      audioRec.current = rec;
    } catch (e) {
      console.warn('[InterviewCam] audio recorder failed to start', e);
    }
  }, [audioOnly, recording]);

  const stopMeter = useCallback(async (): Promise<string | undefined> => {
    const rec = audioRec.current;
    audioRec.current = null;
    if (!rec) return undefined;
    try {
      await rec.stopAndUnloadAsync();
    } catch { /* already stopped */ }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch { /* ignore */ }
    return rec.getURI() ?? undefined;
  }, []);

  const emitClip = useCallback((index: number, uri: string | undefined, kind: CaptureKind, startedAt = clipStartedAt.current) => {
    if (!uri) return;
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    answered.current.add(index);
    onClip?.({ index, uri, kind, durationSec, lang: langRef.current });
  }, [onClip]);

  const startVideoClip = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const startedAt = Date.now();
    clipStartedAt.current = startedAt;
    const flag = { discard: false };
    clipFlag.current = flag;
    const index = clipIndex.current;
    const p = cam.recordAsync({ maxDuration: recording === 'continuous' ? 1800 : 600 });
    videoPromise.current = p;
    lastClip.current = p
      .then((res) => {
        if (recording === 'perQuestion' && !flag.discard) emitClip(index, res?.uri, 'video', startedAt);
      })
      .catch((e) => console.warn('[InterviewCam] recordAsync failed', e));
  }, [recording, emitClip]);

  const stopVideoClip = useCallback(async () => {
    const p = videoPromise.current;
    videoPromise.current = null;
    if (!p) return undefined;
    try { cameraRef.current?.stopRecording(); } catch { /* ignore */ }
    try { return await p; } catch { return undefined; }
  }, []);

  // BEGIN: start recording.
  const begun = useRef(false);
  useEffect(() => {
    if (state.phase !== 'asking' || begun.current) return;
    begun.current = true;
    clipIndex.current = state.q;
    marks.current.push({ index: state.q, atSec: 0 });
    (async () => {
      if (audioOnly) {
        clipStartedAt.current = Date.now();
        await startMeter();
        return;
      }
      if (recording === 'continuous') await startMeter(); // parallel audio first, like before
      startVideoClip();
      try {
        canToggle.current = !!cameraRef.current?.getSupportedFeatures?.()?.toggleRecordingAsyncAvailable;
      } catch { canToggle.current = false; }
    })();
  }, [state.phase, state.q, audioOnly, recording, startMeter, startVideoClip]);

  // ---------------------------------------------------------------- actions
  const goNext = useCallback(async () => {
    if (state.phase !== 'asking') return;
    const last = isLastQuestion(state);
    const index = state.q;
    dispatch({ type: 'NEXT' });
    if (recording === 'continuous') {
      answered.current.add(index);
      if (!last) marks.current.push({ index: index + 1, atSec: elapsedRef.current });
      return;
    }
    // perQuestion: close this clip, open the next. The last clip is closed by the DONE step.
    if (last) return;
    if (audioOnly) {
      const uri = await stopMeter();
      emitClip(index, uri, 'audio');
      clipIndex.current = index + 1;
      clipStartedAt.current = Date.now();
      await startMeter();
    } else {
      await stopVideoClip();
      clipIndex.current = index + 1;
      startVideoClip();
    }
  }, [state, recording, audioOnly, stopMeter, startMeter, emitClip, stopVideoClip, startVideoClip]);

  const pause = useCallback(async () => {
    if (state.phase === 'asking') {
      dispatch({ type: 'PAUSE' });
      if (audioOnly) {
        try { await audioRec.current?.pauseAsync(); } catch { /* ignore */ }
      } else if (recording === 'continuous') {
        if (canToggle.current) { try { await cameraRef.current?.toggleRecordingAsync(); } catch { /* ignore */ } }
        try { await audioRec.current?.pauseAsync(); } catch { /* ignore */ }
      } else {
        clipFlag.current.discard = true; // this answer starts again on resume
        await stopVideoClip();
      }
    } else if (state.phase === 'paused') {
      dispatch({ type: 'RESUME' });
      if (audioOnly) {
        try { await audioRec.current?.startAsync(); } catch { /* ignore */ }
      } else if (recording === 'continuous') {
        if (canToggle.current) { try { await cameraRef.current?.toggleRecordingAsync(); } catch { /* ignore */ } }
        try { await audioRec.current?.startAsync(); } catch { /* ignore */ }
      } else {
        startVideoClip();
      }
    }
  }, [state.phase, audioOnly, recording, stopVideoClip, startVideoClip]);

  // DONE: wrap up once.
  useEffect(() => {
    if (state.phase !== 'done' || finished.current) return;
    finished.current = true;
    (async () => {
      let uri: string | undefined;
      let parallelAudioUri: string | undefined;
      if (recording === 'continuous') {
        if (audioOnly) uri = await stopMeter();
        else {
          const res = await stopVideoClip();
          uri = res?.uri;
          parallelAudioUri = await stopMeter();
        }
      } else if (audioOnly) {
        const last = await stopMeter();
        emitClip(clipIndex.current, last, 'audio');
      } else {
        await stopVideoClip();
        await lastClip.current;
        await stopMeter();
      }
      onFinish({
        kind: audioOnly ? 'audio' : 'video',
        uri,
        parallelAudioUri,
        durationSec: elapsedRef.current,
        marks: marks.current,
        answered: answered.current.size,
        lang: langRef.current,
      });
    })();
  }, [state.phase, recording, audioOnly, stopMeter, stopVideoClip, emitClip, onFinish]);

  // Unmount safety: never leave the mic or the camera running.
  useEffect(() => () => {
    try { cameraRef.current?.stopRecording(); } catch { /* ignore */ }
    const rec = audioRec.current;
    audioRec.current = null;
    rec?.stopAndUnloadAsync().catch(() => {});
  }, []);

  const close = () => {
    if (state.phase === 'framing') { onClose(); return; }
    Alert.alert('Stop the interview?', recording === 'perQuestion' ? 'Your answers so far are kept.' : 'This recording will be lost.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          finished.current = true;
          clipFlag.current.discard = recording !== 'perQuestion';
          await stopVideoClip();
          await stopMeter();
          onClose();
        },
      },
    ]);
  };

  // ---------------------------------------------------------------- question animation
  const qAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state.phase !== 'asking') return;
    qAnim.setValue(0);
    Animated.timing(qAnim, { toValue: 1, duration: 600, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [state.q, state.phase, qAnim]);

  // ---------------------------------------------------------------- render
  const framingPhase = state.phase === 'framing';
  const paused = state.phase === 'paused';
  const last = isLastQuestion(state);
  const segs = segmentStates(state);
  const bars = meterBars(paused ? 0 : meter);
  const showMeter = audioOnly || recording === 'continuous' || Platform.OS !== 'android';
  const hintText = framingGood ? L.ok : L.hold;
  const pauseAllowed = audioOnly || recording === 'perQuestion' || canToggle.current;

  return (
    <View style={styles.root} testID="interview-cam">
      <StatusBar style="light" />
      {audioOnly ? (
        <AudioStage level={paused ? 0 : meter} />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
          mute={false}
          onCameraReady={() => setCameraReady(true)}
        />
      )}
      <TopShade />
      <BottomShade />

      {/* top row: close · REC + timer + mic meter · language */}
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <GlassButton icon="close" label="Close" onPress={close} />
        <GlassPill style={{ opacity: framingPhase ? 0.6 : 1 }}>
          <View style={[styles.recDot, { opacity: state.phase === 'asking' ? 1 : 0.4 }]} />
          <PillText>{formatClock(elapsed)}</PillText>
          {showMeter ? (
            <View style={styles.meter} accessibilityElementsHidden>
              {bars.map((h, i) => <View key={i} style={[styles.meterBar, { height: 4 + h * 12 }]} />)}
            </View>
          ) : null}
        </GlassPill>
        <GlassPill onPress={() => setLang(lang === 'en' ? 'tl' : 'en')} label={lang === 'en' ? 'Switch to Tagalog' : 'Switch to English'}>
          <Ionicons name="language" size={18} color="#fff" />
          <PillText>{lang.toUpperCase()}</PillText>
        </GlassPill>
      </View>

      {/* 10-step bar */}
      <View style={[styles.segs, { top: insets.top + 64 }]} accessibilityRole="progressbar" accessibilityLabel={`Question ${Math.min(state.q + 1, total)} of ${total}`}>
        {segs.map((s, i) => (
          <View key={i} style={[styles.seg, { backgroundColor: s === 'done' ? '#fff' : s === 'cur' ? colors.accent : 'rgba(255,255,255,0.3)' }]} />
        ))}
      </View>

      {/* level: strong while checking, faint afterwards */}
      {audioOnly ? null : <LevelLine roll={level.roll} good={framingGood} strong={framingPhase} />}
      <HintChip text={paused ? L.paused : hintText} good={!paused && framingGood} visible={(framingPhase && ready) || paused} icon={paused ? 'pause' : 'phone-portrait-outline'} />

      {/* the question, low like a subtitle */}
      {!framingPhase ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.prompt, { bottom: insets.bottom + 140, opacity: qAnim, transform: [{ translateY: qAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
        >
          <Text style={subtitle.count}>{last ? L.last : `${state.q + 1} / ${total}`}</Text>
          <Text style={subtitle.big} accessibilityLiveRegion="polite" accessibilityRole="header">{questionAt(state.q, lang)}</Text>
        </Animated.View>
      ) : null}

      {/* controls: small pause · the biggest button */}
      <View style={[styles.ctl, { bottom: insets.bottom + 24 }]}>
        {pauseAllowed ? (
          <Pressable
            onPress={pause}
            disabled={framingPhase}
            accessibilityRole="button"
            accessibilityLabel={paused ? L.resume : 'Pause'}
            style={({ pressed }) => [styles.pauseRing, { opacity: framingPhase ? 0.5 : pressed ? 0.8 : 1 }]}
          >
            <View style={styles.pauseDot}>
              <Ionicons name={paused ? 'play' : 'pause'} size={24} color="#fff" />
            </View>
          </Pressable>
        ) : null}
        <Pressable
          onPress={paused ? pause : goNext}
          disabled={framingPhase}
          accessibilityRole="button"
          accessibilityLabel={paused ? L.resume : last ? L.finish : L.next}
          style={({ pressed }) => [styles.next, { opacity: framingPhase ? 0.55 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <Text style={styles.nextText} numberOfLines={1}>{paused ? L.resume : last ? L.finish : L.next}</Text>
          <View style={styles.nextIcon}>
            <Ionicons name={paused ? 'play' : last ? 'checkmark' : 'arrow-forward'} size={24} color={colors.accent} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/** Voice-only stage: dark, calm, one breathing circle that follows the voice. No white. */
function AudioStage({ level }: { level: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(scale, { toValue: 1 + level * 0.35, duration: 140, useNativeDriver: true }).start();
  }, [level, scale]);
  return (
    <View style={[StyleSheet.absoluteFill, styles.audioStage]}>
      <Animated.View style={[styles.audioHalo, { transform: [{ scale }] }]} />
      <View style={styles.audioCore}>
        <Ionicons name="mic" size={44} color={colors.onAccent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 6 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.rec },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 },
  meterBar: { width: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  segs: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', gap: 4, zIndex: 6 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  prompt: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 8, zIndex: 4 },
  ctl: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 6 },
  pauseRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  pauseDot: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.rec, alignItems: 'center', justifyContent: 'center' },
  next: {
    flex: 1,
    minWidth: 0,
    height: 68,
    borderRadius: 999,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 26,
    paddingRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 9,
    elevation: 6,
  },
  nextText: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, color: colors.onAccent },
  nextIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  audioStage: { backgroundColor: colors.camera, alignItems: 'center', justifyContent: 'center' },
  audioHalo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(228,242,34,0.16)' },
  audioCore: { width: 128, height: 128, borderRadius: 64, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
