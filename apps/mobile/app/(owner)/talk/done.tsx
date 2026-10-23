/** "Got it." — the answers are saving; next: photos (mock owner board "interviewDone"). */
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, ProgressBar, ScreenShell, Text } from '../../../components/v2';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { uploadQueue, useUploadQueue } from '../../../lib/v2/uploadQueue';
import { firstName, useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, space } from '../../../theme/v2';

export default function TalkDone() {
  const router = useRouter();
  const { me } = useOwnerSite();
  const q = useUploadQueue();
  const name = firstName(me);
  const saving = q.pending > 0;

  return (
    <ScreenShell
      scroll={false}
      footer={
        q.failed > 0 && !saving ? (
          <Button title="Try again" variant="dark" onPress={() => uploadQueue.retry()} />
        ) : (
          <Button title="Next: photos" onPress={() => router.replace(STEP_ROUTE['photos-intro'] as never)} />
        )
      }
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={52} color={colors.onAccent} />
        </View>
        <Text variant="display" align="center" accessibilityRole="header">{name ? `Got it, ${name}.` : 'Got it.'}</Text>
        {saving ? (
          <View style={{ alignSelf: 'stretch', gap: space.sm }}>
            <Text tone="ink2" align="center">Saving your answers…</Text>
            <ProgressBar value={q.total ? q.done / q.total : 0} tone="accent" label="Saving answers" />
          </View>
        ) : q.failed > 0 ? (
          <Text tone="danger" align="center">Some answers did not save.</Text>
        ) : (
          <Text variant="bodyLg" tone="ink2" align="center">Now 10 photos.</Text>
        )}
      </View>
    </ScreenShell>
  );
}
