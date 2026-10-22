/** Me: who you are, Help, Inbox, sign out. */
import React from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useClerk } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { Card, ListRow, ScreenShell } from '../../../components/v2';
import { WEB_ORIGIN } from '../../../lib/v2/ownerData';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { uploadQueue } from '../../../lib/v2/uploadQueue';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, space } from '../../../theme/v2';

export default function Me() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { me } = useOwnerSite();

  const out = () =>
    Alert.alert('Sign out?', undefined, [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          ownerIntake.clear();
          uploadQueue.reset();
          await signOut();
          // Owners sign back in with an email code (the intent stays "owner").
          router.replace('/(auth)/owner' as never);
        },
      },
    ]);

  return (
    <ScreenShell title={me?.owner.name || 'Me'} subtitle={me?.owner.email}>
      <Card style={{ paddingVertical: space.xs }}>
        <ListRow
          title="Help"
          icon="help-circle-outline"
          divider
          // The v2 Help page: answers plus Ask Tendso.
          onPress={() => WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/v2/help`, { controlsColor: colors.ink }).catch(() => {})}
        />
        <ListRow title="Inbox" icon="mail-outline" divider onPress={() => router.push('/(owner)/me/inbox' as never)} />
        <ListRow title="Sign out" icon="log-out-outline" onPress={out} />
      </Card>
      <View style={{ height: space.xl }} />
    </ScreenShell>
  );
}
