/** Me: who you are, Help, Inbox, sign out. */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth, useClerk } from '@clerk/clerk-expo';
import { Banner, Card, ListRow, ScreenShell } from '../../../components/v2';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { space } from '../../../theme/v2';
import { useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { unregisterOwnerPush } from '../../../components/v2/owner/OwnerNotificationBridge';
import { OWNER_SAMPLE_DATA } from '../../../lib/v2/ownerFlags';

export default function Me() {
  const { userId, sessionId } = useAuth();
  const { me } = useOwnerSite();
  return <OwnerMe key={`${userId ?? 'sample-owner'}:${sessionId ?? ''}:${me?.owner._id ?? ''}`} me={me} />;
}

function OwnerMe({ me }: { me: ReturnType<typeof useOwnerSite>['me'] }) {
  const router = useGuardedRouter();
  const {userId}=useAuth();
  const removePush=useMutation(api.ownerInbox.removePushToken);
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
            if(!OWNER_SAMPLE_DATA) await unregisterOwnerPush(removePush,userId,current);
            if(!current()) return;
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
      <ListRow title="Settings" subtitle="Notifications on this device" icon="settings-outline" divider onPress={() => {
        if (mounted.current && !busy.current) router.push('/(owner)/me/settings' as never);
      }} />
      <ListRow title="Ask Tendso" subtitle="Help for your business" icon="chatbubble-ellipses-outline" divider onPress={() => {
        if (mounted.current && !busy.current) router.push('/(knowledge)/ask' as never);
      }} />
      <ListRow title="Inbox" icon="mail-outline" divider onPress={() => {
        if (mounted.current && !busy.current) router.push('/(owner)/me/inbox');
      }} />
      <ListRow title={signingOut ? 'Signing out…' : 'Sign out'} icon="log-out-outline" onPress={out} />
    </Card>
    <View style={{ height: space.xl }} />
  </ScreenShell>;
}
