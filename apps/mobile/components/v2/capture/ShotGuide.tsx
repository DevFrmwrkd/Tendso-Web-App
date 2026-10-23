/**
 * ShotGuide — the guided photo camera (mock js/screens.js `shotGuide`, css "CAMERA SCREENS v4").
 *
 * Same layout as the recording screen, NO outlines and NO grid. Top: close · "Shot 3 of 10" ·
 * flash. A level line + one feedback chip ("Step back a little" → "Perfect, hold still", simple
 * sensor heuristics, no ML). The task title + hint low like a subtitle; the strip of the 10 shots
 * (tap one to retake it); last photo · white shutter · Skip. Quick capture: photo, photo, photo.
 */
import React, { useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, fonts } from '../../../theme/v2';
import { KIND_HINT, type ShotTask } from '../../../lib/v2/captureContent';
import { shotFeedback } from './level';
import { initialShots, shotReducer, shotsDone, takenCount } from './machines';
import { useLevel } from './useLevel';
import { GlassButton, GlassPill, HintChip, LevelLine, PillText, TopShade, BottomShade, subtitle, useFlash } from './CamChrome';

export interface ShotGuideProps {
  tasks: readonly ShotTask[];
  /** Photos already taken per task (resume / retake). */
  initial?: (string | null)[];
  /** Fires for every photo, so it can upload while the next one is taken. */
  onShot?: (index: number, uri: string) => void;
  /** All tasks asked (taken or skipped). */
  onDone: (taken: (string | null)[]) => void;
  /** Closed early; what was taken so far. */
  onClose: (taken: (string | null)[]) => void;
}

export function ShotGuide({ tasks, initial, onShot, onDone, onClose }: ShotGuideProps) {
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [state, dispatch] = useReducer(shotReducer, undefined, () => initialShots(tasks.length, initial));
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const capturing = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const shutterFlash = useFlash();
  const level = useLevel(!shotsDone(state));
  const done = shotsDone(state);
  const task = tasks[Math.min(state.cur, tasks.length - 1)];

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) requestPerm();
  }, [perm, requestPerm]);

  useEffect(() => {
    if (done) onDone(state.taken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // the task text slides in for each new shot
  const tAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    tAnim.setValue(0);
    Animated.timing(tAnim, { toValue: 1, duration: 420, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [state.cur, tAnim]);

  const fb = shotFeedback({
    kind: task.kind,
    roll: level.roll,
    pitch: level.pitch,
    shake: level.shake,
    steadyMs: level.steadyMs,
    wasLevel: level.level,
    tip: KIND_HINT[task.kind],
    hasSensor: level.hasSensor,
  });

  const shoot = async () => {
    if (capturing.current || done || !cameraRef.current) return;
    capturing.current = true;
    setBusy(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (pic?.uri) {
        shutterFlash.fire();
        const index = state.cur;
        dispatch({ type: 'TAKE', uri: pic.uri });
        onShot?.(index, pic.uri);
      }
    } catch (e) {
      console.warn('[ShotGuide] takePictureAsync failed', e);
    } finally {
      capturing.current = false;
      setBusy(false);
    }
  };

  if (perm && !perm.granted && !perm.canAskAgain) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={[subtitle.big, { marginHorizontal: 32 }]}>Please allow the camera</Text>
        <Pressable onPress={() => { if (!capturing.current) onClose(state.taken); }} accessibilityRole="button" style={styles.textBtn}>
          <Text style={styles.textBtnLabel}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const shown = Math.min(state.cur + 1, tasks.length);

  return (
    <View style={styles.root} testID="shot-guide">
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        flash={flash}
        onCameraReady={() => setReady(true)}
      />
      <TopShade />
      <BottomShade height={380} />

      <View style={[styles.top, { top: insets.top + 8 }]}>
        <GlassButton icon="close" label="Close" onPress={() => { if (!capturing.current) onClose(state.taken); }} />
        <GlassPill>
          <PillText>{`Shot ${shown} of ${tasks.length}`}</PillText>
        </GlassPill>
        <GlassButton icon={flash === 'on' ? 'flash' : 'flash-off'} label={flash === 'on' ? 'Flash on' : 'Flash off'} onPress={() => setFlash(flash === 'on' ? 'off' : 'on')} />
      </View>

      <LevelLine roll={level.roll} good={fb.good} strong={!fb.good} />
      <HintChip text={fb.text} good={fb.good} icon="move" visible={ready} />

      <Animated.View
        pointerEvents="none"
        style={[styles.task, { bottom: insets.bottom + 196, opacity: tAnim, transform: [{ translateY: tAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
      >
        <Text style={subtitle.big} accessibilityRole="header" accessibilityLiveRegion="polite">{task.t}</Text>
        <Text style={subtitle.small}>{task.h}</Text>
      </Animated.View>

      <View style={[styles.sheet, { bottom: insets.bottom + 20 }]}>
        <View style={styles.strip} accessibilityLabel={`${takenCount(state)} of ${tasks.length} photos taken`}>
          {tasks.map((t, i) => {
            const uri = state.taken[i];
            const cur = i === state.cur;
            return (
              <Pressable
                key={i}
                disabled={busy}
                onPress={() => { if (!capturing.current) dispatch({ type: 'GOTO', index: i }); }}
                accessibilityRole="button"
                accessibilityLabel={`${t.t}${uri ? ', taken' : ''}`}
                style={[styles.slot, cur && styles.slotCur]}
              >
                {uri ? <Image source={{ uri }} style={styles.slotImg} /> : null}
                {uri ? (
                  <View style={styles.slotTick}>
                    <Ionicons name="checkmark" size={10} color={colors.onAccent} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.ctl}>
          <View style={[styles.last, !state.last && styles.lastEmpty]}>
            {state.last ? <Image source={{ uri: state.last }} style={styles.lastImg} /> : null}
          </View>
          <Pressable
            onPress={shoot}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            cssInterop={false}
            style={({ pressed }) => [styles.shutter, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <View style={styles.shutterIn}>{busy ? <ActivityIndicator color={colors.ink} /> : null}</View>
          </Pressable>
          <Pressable disabled={busy} onPress={() => { if (!capturing.current) dispatch({ type: 'SKIP' }); }} accessibilityRole="button" accessibilityLabel="Skip this photo" hitSlop={12} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </View>
      {shutterFlash.node}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 24 },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 6 },
  task: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 6, zIndex: 4 },
  sheet: { position: 'absolute', left: 20, right: 20, gap: 16, zIndex: 6 },
  strip: { flexDirection: 'row', gap: 5 },
  slot: { flex: 1, aspectRatio: 1, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'visible' },
  slotCur: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 2, borderColor: colors.accent },
  slotImg: { width: '100%', height: '100%', borderRadius: 8 },
  slotTick: { position: 'absolute', right: -3, bottom: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  ctl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  last: { width: 54, height: 54, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  lastEmpty: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.6)' },
  lastImg: { width: '100%', height: '100%' },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  skip: { width: 54, alignItems: 'center' },
  skipText: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  textBtn: { minHeight: 56, paddingHorizontal: 24, justifyContent: 'center' },
  textBtnLabel: { fontFamily: fonts.bold, fontSize: 18, color: '#fff' },
});
