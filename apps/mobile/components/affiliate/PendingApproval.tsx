import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClerk } from '@clerk/clerk-expo';
import { useDeleteAccount } from '../../hooks/useDeleteAccount';
import { Button, ScreenShell, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';

/** Replaces navigation while the reactive account query waits for admin approval. */
export function PendingAffiliateApproval() {
  const { signOut } = useClerk();
  const deletion = useDeleteAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await signOut(); }
    catch { setError('Could not sign out. Please try again.'); }
    finally { setBusy(false); }
  };
  return <ScreenShell
    scroll={false}
    contentStyle={styles.body}
    footer={<>
      {error ? <Text variant="body" tone="danger" align="center" accessibilityRole="alert">{error}</Text> : null}
      <Button title="Sign out" variant="dark" onPress={() => { void leave(); }} disabled={busy || deletion.busy} loading={busy} />
      <Button title="Delete account" variant="ghost" size="md" onPress={deletion.requestDelete} disabled={busy || !deletion.canDelete} loading={deletion.busy} />
    </>}
  >
    <View style={styles.center}>
      <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="hourglass-outline" size={40} color={colors.onAccent} />
      </View>
      <Text variant="display" align="center" accessibilityRole="header">Awaiting approval</Text>
      <Text variant="bodyLg" tone="ink2" align="center" style={styles.sub}>A Tendso admin is checking your creator account. This screen updates by itself.</Text>
    </View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: space.lg },
  icon: { width: 96, height: 96, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sub: { maxWidth: 320 },
});
