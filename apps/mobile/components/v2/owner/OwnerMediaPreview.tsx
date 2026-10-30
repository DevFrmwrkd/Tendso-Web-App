import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Audio, ResizeMode, Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '..';
import { colors, radius, space } from '../../../theme/v2';

export function OwnerMediaPreview({ uri, kind, label, onClose }: {
  uri: string; kind: 'image' | 'video' | 'audio'; label: string; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg }]}
      accessibilityViewIsModal onAccessibilityEscape={onClose}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close media preview" onPress={onClose} style={styles.close}>
          <Ionicons name="close" size={24} color={colors.ink} /></Pressable>
        <Text variant="heading" style={styles.flex}>{label}</Text>
      </View>
      {failed ? <View style={styles.empty}><Ionicons name="image-outline" size={40} color={colors.ink3Text} />
        <Text align="center" tone="muted">This file could not load. Close the preview and try again.</Text></View>
        : kind === 'image' ? <Image testID="owner-full-photo" source={{ uri }} resizeMode="contain" style={styles.media} onError={() => setFailed(true)} accessibilityLabel={label} />
          : kind === 'video' ? <Video testID="owner-answer-video" source={{ uri }} resizeMode={ResizeMode.CONTAIN} useNativeControls
            shouldPlay={false} style={styles.media} onError={() => setFailed(true)} />
            : <OwnerAudioPlayback uri={uri} />}
    </View>
  </Modal>;
}

function OwnerAudioPlayback({ uri }: { uri: string }) {
  const sound = useRef<Audio.Sound | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void sound.current?.unloadAsync().catch(() => {}); };
  }, []);
  const toggle = async () => {
    if (busy.current || !mounted.current) return;
    busy.current = true; setLoading(true); setError(false);
    try {
      if (!sound.current) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        if (!mounted.current) return;
        const { sound: next } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, status => {
          if (mounted.current) setPlaying(status.isLoaded && status.isPlaying);
        });
        if (!mounted.current) { await next.unloadAsync(); return; }
        sound.current = next;
      } else if (playing) await sound.current.pauseAsync();
      else {
        const status = await sound.current.getStatusAsync();
        if (status.isLoaded && status.didJustFinish) await sound.current.replayAsync();
        else await sound.current.playAsync();
      }
    } catch { if (mounted.current) setError(true); }
    finally { busy.current = false; if (mounted.current) setLoading(false); }
  };
  return <View style={styles.empty}>
    <Ionicons name="musical-notes-outline" size={64} color={colors.ink} />
    <Button title={playing ? 'Pause playback' : 'Listen to this answer'} loading={loading} icon={playing ? 'pause' : 'play'} onPress={() => { void toggle(); }} />
    {error ? <Text tone="danger" align="center">Could not play this answer. Close and try again.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 }, screen: { flex: 1, backgroundColor: colors.card, gap: space.lg },
  header: { paddingHorizontal: space.gutter, flexDirection: 'row', gap: space.md, alignItems: 'center' },
  close: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },
  media: { flex: 1, width: '100%', backgroundColor: colors.camera },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.gutter },
});
