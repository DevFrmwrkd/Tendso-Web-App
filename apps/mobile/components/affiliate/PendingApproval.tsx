import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Display, Door, Label } from '../ui/primitives';
import { colors } from '../../theme/tokens';

/** Replaces navigation while the reactive account query waits for admin approval. */
export function PendingAffiliateApproval() {
  const { signOut } = useClerk();
  const insets = useSafeAreaInsets();
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
  return <ScrollView style={{ flex: 1, backgroundColor: colors.paper }}
    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24,
      paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 20 }}>
    <Label>Tendso affiliate</Label>
    <Display size="md">Awaiting approval</Display>
    <Body>Your affiliate account has been created. A Tendso admin needs to approve it before you can share your page and earn.</Body>
    <Body size="sm" color={colors.ink2}>This screen updates automatically after approval. You can sign out and come back later.</Body>
    {error ? <Body accessibilityRole="alert" color={colors.danger}>{error}</Body> : null}
    <Door label="Sign out" onPress={() => { void leave(); }} disabled={busy} loading={busy} />
  </ScrollView>;
}
