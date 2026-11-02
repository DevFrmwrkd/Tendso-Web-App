/** Me: who you are, Help, Inbox, sign out. */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth, useClerk } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { Banner, Card, ListRow, ScreenShell } from '../../../components/v2';
import { WEB_ORIGIN } from '../../../lib/v2/ownerData';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { colors, space } from '../../../theme/v2';

export default function Me() {
  const { userId, sessionId } = useAuth();
  const { me } = useOwnerSite();
  return <OwnerMe key={`${userId ?? 'sample-owner'}:${sessionId ?? ''}:${me?.owner._id ?? ''}`} me={me} />;
}

function OwnerMe({ me }: { me: ReturnType<typeof useOwnerSite>['me'] }) {
  const router = useGuardedRouter();
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const prompting = useRef(false);
  const busy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const out = () => {
    if (!mounted.current || prompting.current || busy.current) return;
    const scope = ownerIntake.scope();
    const current = () => mounted.current && ownerIntake.isCurrent(scope);
    prompting.current = true;
    Alert.alert('Sign out?', undefined, [
      { text: 'Stay', style: 'cancel', onPress: () => { prompting.current = false; } },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          prompting.current = false;
          if (!current() || busy.current) return;
          busy.current = true;
          setSigningOut(true);
          setError('');
          try {
            await signOut();
            // Keep the saved draft for this owner. Failed logout must not erase
            // local work; successful logout clears only the active memory scope.
            if (!ownerIntake.isCurrent(scope)) return;
            const binding = ownerIntake.bindActor(null);
            const guestScope = ownerIntake.scope();
            await binding;
            if (mounted.current && ownerIntake.isCurrent(guestScope)) router.replace('/(auth)/owner');
          } catch {
            if (current()) setError('Could not sign out. Please try again.');
          } finally {
            busy.current = false;
            if (mounted.current) setSigningOut(false);
          }
        },
      },
    ], { cancelable: true, onDismiss: () => { prompting.current = false; } });
  };

  return <ScreenShell title={me?.owner.name || 'Me'} subtitle={me?.owner.email}>
    {error ? <Banner tone="danger" body={error} /> : null}
    <Card style={{ paddingVertical: space.xs }}>
      <ListRow title="Help" icon="help-circle-outline" divider onPress={() => {
        if (mounted.current && !busy.current) void WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/v2/help`, { controlsColor: colors.ink }).catch(() => {});
      }} />
      <ListRow title="Inbox" icon="mail-outline" divider onPress={() => {
        if (mounted.current && !busy.current) router.push('/(owner)/me/inbox');
      }} />
      <ListRow title={signingOut ? 'Signing out…' : 'Sign out'} icon="log-out-outline" onPress={out} />
    </Card>
    <View style={{ height: space.xl }} />
  </ScreenShell>;
}
