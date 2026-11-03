import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Switch, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Button, Card, Loading, ScreenShell, Text } from '../../../components/v2';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { OWNER_SAMPLE_DATA } from '../../../lib/v2/ownerFlags';
import { useNetwork } from '../../../providers/NetworkProvider';
import { disableOwnerPush, syncOwnerPush, type OwnerPushState } from '../../../services/ownerPushSettings';
import { colors, radius, space } from '../../../theme/v2';

const COPY: Record<OwnerPushState, { title: string; body: string }> = {
  enabled: { title: 'On for this device', body: 'This device is registered for visit and website updates.' },
  quiet: { title: 'Delivered quietly', body: 'Updates go to Notification Center. Allow banners and sounds in your phone settings if you want them.' },
  off: { title: 'Off for this account', body: 'Tendso will not send updates to this device for this owner account.' },
  blocked: { title: 'Blocked in phone settings', body: 'Your phone is blocking Tendso notifications. Manage permission in your phone settings, then return here to check this device again.' },
  'not-enabled': { title: 'Not enabled yet', body: 'Turn this on to allow visit and website updates outside the app.' },
  unavailable: { title: 'Use the mobile app on your phone', body: 'Push notifications need the installed Tendso app on a physical device.' },
};

export default function Settings() {
  const { userId, sessionId } = useAuth();
  const { me } = useOwnerSite();
  return <OwnerSettings key={`${userId}:${sessionId}:${me?.owner._id}`} subject={userId} ownerId={me?.owner._id} />;
}

function OwnerSettings({ subject, ownerId }: { subject: string | null | undefined; ownerId: string | undefined }) {
  const router = useGuardedRouter();
  const register = useMutation(api.ownerInbox.registerPushToken);
  const { isConnected } = useNetwork();
  const [state, setState] = useState<OwnerPushState | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), working = useRef(false);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = useCallback(() => mounted.current && !!subject && !!ownerId, [subject, ownerId]);
  const refresh = useCallback(async (prompt = false) => {
    if (!current() || !subject || working.current || isConnected === false) return;
    if (OWNER_SAMPLE_DATA) { setState('unavailable'); return; }
    working.current = true; setBusy(true); setError('');
    try {
      const next = await syncOwnerPush(register, subject, prompt, current);
      if (current() && next) setState(next);
    } catch {
      if (current()) setError('Could not confirm this device’s notification setting. Reconnect and try again. Your inbox is still available.');
    } finally { working.current = false; if (current()) setBusy(false); }
  }, [current, subject, isConnected, register]);
  useEffect(() => {
    void refresh();
    const listener = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    return () => listener.remove();
  }, [refresh]);
  const change = async (enabled: boolean) => {
    if (!current() || !subject || working.current || isConnected === false) return;
    if (enabled) { await refresh(true); return; }
    working.current = true; setBusy(true); setError('');
    try {
      const next = await disableOwnerPush(register, subject, current);
      if (current() && next) setState(next);
    } catch {
      if (current()) setError('Turning notifications off could not be confirmed. Reconnect and retry; updates may still arrive until this finishes.');
    } finally { working.current = false; if (current()) setBusy(false); }
  };
  const phoneSettings = async () => {
    if (!current() || working.current) return;
    try { await Linking.openSettings(); }
    catch { if (current()) setError('Open your phone’s Settings app, choose Tendso, then Notifications.'); }
  };
  const enabled = state === 'enabled' || state === 'quiet';
  const copy = state ? COPY[state] : { title: 'Checking this device…', body: 'We check phone permission and confirm your device registration.' };
  return <ScreenShell title="Settings" subtitle="Make Tendso work for you" onBack={() => router.back()}>
    {!subject || !ownerId ? <Loading /> : <>
      {isConnected === false ? <Banner tone="warn" body="You’re offline. Connect to check or change notifications on this device." /> : null}
      {error ? <Banner tone="warn" body={error} action={<Button title="Retry notification settings" variant="ghost" size="md" disabled={busy || isConnected === false} onPress={() => { void refresh(); }} />} /> : null}
      <Card style={styles.card}>
        <View style={styles.row}><View style={styles.icon}><Ionicons name="notifications-outline" size={26} color={colors.ink} /></View><View style={styles.flex}><Text variant="bodyLg" weight="bold">Push notifications</Text><Text variant="label" tone="muted">Visit and website updates on this phone</Text></View>
          <Switch accessibilityLabel="Push notifications" accessibilityHint="Updates outside Tendso. Your inbox remains available when this is off." value={enabled} disabled={busy || !state || state === 'blocked' || state === 'unavailable' || isConnected === false} onValueChange={value => { void change(value); }} trackColor={{ false: colors.rule, true: colors.accent }} thumbColor={colors.ink} />
        </View>
        <View style={styles.status}><View style={styles.row}>{busy ? <ActivityIndicator color={colors.ink} accessibilityLabel="Checking notification settings" /> : <View style={[styles.dot, enabled ? styles.on : null]} />}<Text weight="semibold">{busy ? 'Saving this device’s setting…' : copy.title}</Text></View><Text tone="muted">{copy.body}</Text></View>
        {state === 'blocked' || state === 'quiet' ? <Button title="Open phone settings" variant="ghost" disabled={busy} onPress={() => { void phoneSettings(); }} /> : null}
      </Card>
      <Card style={styles.inbox}><Ionicons name="mail-open-outline" size={24} color={colors.ink} /><View style={styles.flex}><Text weight="bold">Your inbox always stays on</Text><Text tone="muted">Read every visit and website update from the bell or Me → Inbox, even with push notifications off.</Text></View></Card>
    </>}
  </ScreenShell>;
}
const styles = StyleSheet.create({ card: { gap: space.lg }, row: { flexDirection: 'row', alignItems: 'center', gap: space.md }, flex: { flex: 1, minWidth: 0, gap: 5 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  status: { borderRadius: radius.card, padding: space.md, backgroundColor: colors.bg2, gap: space.sm }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.ink3 }, on: { backgroundColor: colors.ink },
  inbox: { marginTop: space.lg, flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});
