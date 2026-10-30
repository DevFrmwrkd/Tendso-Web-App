import React, { useState } from 'react';
import { Image, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Avatar, Button, ScreenShell, Text } from './v2';
import { useCreatorAttribution, type CreatorAttributionOptions } from '../hooks/useCreatorAttribution';
import { colors, radius, space } from '../theme/v2';

/** Mount once on the visible welcome/agent/owner flow; omit claimAs until the role is chosen. */
export function CreatorAttributionGate(props: CreatorAttributionOptions) {
  const state = useCreatorAttribution(props);
  const { width } = useWindowDimensions();
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  if (!state.candidate) return null;
  const { creator } = state.candidate;
  const photoSize = Math.max(120, Math.min(240, width - 80));
  return <Modal visible presentationStyle="fullScreen" animationType="fade" testID="creator-attribution-confirmation"
    onRequestClose={() => { void state.decline(); }}>
    <ScreenShell contentStyle={styles.content} footer={<View style={styles.actions}>
        <Button title={state.error || state.pending ? 'Retry confirmation' : 'Yes, they sent me'} loading={state.busy}
          onPress={() => { if (state.pending) state.retry(); else void state.confirm(); }} />
        <Button title="No" variant="ghost" disabled={state.busy} onPress={() => { void state.decline(); }} />
      </View>}>
      {creator.photo && failedPhoto !== creator.photo ? <Image key={creator.photo} source={{ uri: creator.photo }} resizeMode="cover"
        style={[styles.photo, { width: photoSize, height: photoSize * 1.15 }]} accessibilityLabel={`${creator.name}'s profile photo`}
        onError={() => setFailedPhoto(creator.photo)} /> : <Avatar name={creator.name} size={photoSize} />}
      <Text variant="title" weight="bold" style={styles.center}>Did {creator.name} send you?</Text>
      <Text tone="muted" style={styles.center}>Only confirm if you came here through their link or invitation.</Text>
      {state.error ? <Text tone="danger" style={styles.center}>{state.error}</Text> : null}
    </ScreenShell>
  </Modal>;
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: space.xl },
  actions: { gap: space.sm },
  center: { textAlign: 'center' },
  photo: { borderRadius: radius.card, backgroundColor: colors.bg2, alignSelf: 'center' },
});
