import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Audio, Video, ResizeMode } from 'expo-av';
import { Button } from '../v2/Button';
import { Text } from '../v2/Text';
import { colors, radius, space } from '../../theme/v2';

/** Preview only: leaving the screen always releases audio and pauses video. */
export function InterviewPlayback({ uri, kind, onUnavailable }: { uri: string; kind: 'video' | 'audio'; onUnavailable?: () => void }) {
  const sound = useRef<Audio.Sound | null>(null);
  const video = useRef<Video | null>(null);
  const mounted = useRef(true);
  const focused = useRef(true);
  const generation = useRef(0);
  const operation = useRef(0);
  const busy = useRef(false);
  const finished = useRef(false);
  const callbacks = useRef({ onUnavailable });
  callbacks.current = { onUnavailable };
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const release = () => {
    generation.current++; operation.current++; busy.current = false; finished.current = false;
    const previous = sound.current; sound.current = null;
    void previous?.unloadAsync().catch(() => {});
    void video.current?.pauseAsync?.().catch(() => {});
    if (mounted.current) setPlaying(false);
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; release(); }; }, []);
  useEffect(() => { setError(false); return () => { release(); }; }, [uri, kind]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; release(); };
  }, []));
  const unavailable = () => {
    if (!mounted.current || !focused.current) return;
    // A failed AV.Sound may remain loaded enough to return a status while
    // never playing again. Release it so the next tap creates a fresh player.
    release();
    setError(true); setPlaying(false); callbacks.current.onUnavailable?.();
  };
  const toggle = async () => {
    if (busy.current || !focused.current || !mounted.current) return;
    busy.current = true; setError(false);
    const version = generation.current, request = ++operation.current;
    const active = () => mounted.current && focused.current && generation.current === version;
    try {
      if (!sound.current) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        if (!active()) return;
        const { sound: next } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, status => {
          if (!active()) return;
          if (!status.isLoaded) { if (status.error) unavailable(); return; }
          if (status.didJustFinish) finished.current = true;
          setPlaying(status.isPlaying);
        });
        if (!active()) { await next.unloadAsync(); return; }
        sound.current = next;
      } else if (playing) await sound.current.pauseAsync();
      else {
        const status = await sound.current.getStatusAsync();
        if (!active()) return;
        if (status.isLoaded && (finished.current || status.didJustFinish
          || !!status.durationMillis && status.positionMillis >= status.durationMillis)) {
          finished.current = false; await sound.current.replayAsync();
        } else await sound.current.playAsync();
      }
    } catch { if (active()) unavailable(); }
    finally { if (operation.current === request) busy.current = false; }
  };
  if (kind === 'video') return <View style={styles.video}>
    {error ? <View style={styles.videoError}><Text align="center" style={{ color: colors.onDark }} accessibilityRole="alert">Could not play this recording. Reconnect and try again, or record another take.</Text>
      <Button title="Try playback again" variant="ghost" onPress={() => { setError(false); setAttempt(value => value + 1); }} /></View>
      : <Video key={`${uri}:${attempt}`} ref={video} source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.CONTAIN}
        useNativeControls isLooping={false} onError={unavailable} />}
  </View>;
  return <View style={styles.audio}>
    <Button title={playing ? 'Pause playback' : 'Listen back'} icon={playing ? 'pause' : 'play'} onPress={() => { void toggle(); }} />
    {error ? <Text tone="danger" accessibilityRole="alert">Could not play this recording. Try again or record another take.</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  video: { height: 380, borderRadius: radius.cardLg, overflow: 'hidden', backgroundColor: colors.camera },
  videoError: { flex: 1, padding: space.xl, justifyContent: 'center', gap: space.lg },
  audio: { padding: space.xl, backgroundColor: colors.card, borderRadius: radius.cardLg, gap: space.md },
});
