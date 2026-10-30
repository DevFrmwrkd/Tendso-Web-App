import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { Avatar, Button, Card, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useDeleteAccount } from '../../hooks/useDeleteAccount';
import { AffiliateAccess, AffiliateFrame, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { affiliateName } from './model';

type MenuItem = { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; route: string; disabled?: boolean };

function Menu({ items }: { items: MenuItem[] }) {
  const router = useGuardedRouter();
  return <Card style={styles.menu}>{items.map((item, index) => <Pressable key={item.label}
    accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ disabled: !!item.disabled }}
    disabled={item.disabled} onPress={() => router.push(item.route as never)}
    style={[styles.row, index > 0 && styles.divider, item.disabled && styles.disabled]}>
    <Ionicons name={item.icon} size={22} color={colors.ink} />
    <Text variant="body" weight="semibold" style={styles.flex}>{item.label}</Text>
    <Ionicons name="chevron-forward" size={19} color={colors.ink3} />
  </Pressable>)}</Card>;
}

export function AffiliateMeScreen() {
  return <AffiliateAccess>{props => props.isPreview ? <MeContent {...props} /> : <LiveMe {...props} />}</AffiliateAccess>;
}

function LiveMe(props: AffiliateAccessProps) {
  const clerk = useClerk();
  const router = useGuardedRouter();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const actor = useRef(props.account.clerkId);
  actor.current = props.account.clerkId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function signOut() {
    const subject = props.account.clerkId;
    const session = clerk.session?.id;
    const current = () => mounted.current && actor.current === subject && clerk.user?.id === subject && clerk.session?.id === session;
    if (locked.current || !current()) return;
    locked.current = true;
    Alert.alert('Sign out', 'Sign out of your Tendso account?', [
      { text: 'Cancel', style: 'cancel', onPress: () => { locked.current = false; } },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        if (!current()) { locked.current = false; return; }
        submitting.current = true;
        setBusy(true);
        try { await clerk.signOut(session ? { sessionId: session } : undefined); if (mounted.current && actor.current === subject) router.replace('/(auth)/login'); }
        catch { if (current()) Alert.alert('Could not sign out', 'Please try again.'); }
        finally { submitting.current = false; locked.current = false; if (mounted.current) setBusy(false); }
      } },
    ], { cancelable: true, onDismiss: () => { if (!submitting.current) locked.current = false; } });
  }
  return <MeContent {...props} onSignOut={signOut} signingOut={busy} />;
}

export function MeContent({ account, isPreview, isOffline, onSignOut, signingOut = false }: AffiliateAccessProps & { onSignOut?: () => void; signingOut?: boolean }) {
  const name = [account.firstName, account.lastName].filter(Boolean).join(' ') || affiliateName(account);
  return <AffiliateFrame preview={isPreview} offline={isOffline} suspended={account.status !== 'active'}>
    <Text variant="display" accessibilityRole="header" style={styles.title}>Me</Text>
    <View style={styles.identity}>
      <Avatar uri={account.profileImage || account.affiliatePhoto || undefined} name={name} size={64} />
      <View style={styles.flex}><Text variant="title" style={styles.name}>{name}</Text>
        <Text variant="label" tone="muted" selectable>Creator{account.referralCode ? ` · Code ${account.referralCode}` : ''}</Text>
      </View>
    </View>
    <Menu items={[
      { label: 'Edit profile', icon: 'person-outline', route: '/(app)/edit-profile', disabled: isPreview || isOffline || account.status !== 'active' },
      { label: 'My creator page', icon: 'grid-outline', route: '/(app)/affiliate/page' },
      { label: 'Your sales', icon: 'receipt-outline', route: '/(app)/affiliate/sales' },
    ]} />
    <Menu items={[
      { label: 'Payout details', icon: 'wallet-outline', route: '/(app)/affiliate/payout-details' },
      { label: 'Notifications', icon: 'notifications-outline', route: '/(app)/notifications', disabled: isPreview },
      { label: 'Help & account', icon: 'help-circle-outline', route: '/(app)/affiliate/help' },
    ]} />
    <Pressable accessibilityRole="button" accessibilityLabel="Sign out" accessibilityState={{ disabled: isPreview || !onSignOut || signingOut }}
      disabled={isPreview || !onSignOut || signingOut} onPress={onSignOut} style={[styles.signOut, (isPreview || signingOut) && styles.disabled]}>
      <Ionicons name="log-out-outline" size={21} color={colors.ink3Text} /><Text variant="body" weight="semibold" tone="muted">{signingOut ? 'Signing out…' : 'Sign out'}</Text>
    </Pressable>
  </AffiliateFrame>;
}

export function AffiliateHelpScreen() {
  return <AffiliateAccess>{props => props.isPreview ? <HelpContent {...props} /> : <LiveHelp {...props} />}</AffiliateAccess>;
}

function LiveHelp(props: AffiliateAccessProps) {
  const { user } = useUser();
  const deletion = useDeleteAccount();
  return <HelpContent {...props} passwordEnabled={!!user?.passwordEnabled} onDelete={deletion.requestDelete} canDelete={deletion.canDelete} deleting={deletion.busy} />;
}

export function HelpContent({ account, isPreview, isOffline, passwordEnabled, onDelete, canDelete, deleting }: AffiliateAccessProps & { passwordEnabled?: boolean; onDelete?: () => void; canDelete?: boolean; deleting?: boolean }) {
  return <AffiliateToolFrame title="Help & account" preview={isPreview} offline={isOffline} suspended={account.status !== 'active'}>
    <Text variant="display">How can we help?</Text>
    <Menu items={[
      { label: 'Help & FAQ', icon: 'help-circle-outline', route: '/(app)/help-faq', disabled: isPreview },
      { label: passwordEnabled ? 'Change password' : 'Set a password', icon: 'lock-closed-outline', route: '/(app)/change-password', disabled: isPreview || isOffline },
      { label: 'Terms of service', icon: 'document-text-outline', route: '/(app)/terms-of-service', disabled: isPreview },
      { label: 'Privacy policy', icon: 'shield-checkmark-outline', route: '/(app)/privacy-policy', disabled: isPreview },
    ]} />
    <Card style={styles.deleteCard}><View style={styles.deleteHeading}><Ionicons name="trash-outline" size={22} color={colors.danger} /><Text variant="bodyLg" weight="bold">Delete account</Text></View>
      <Text variant="body" tone="muted">Permanently remove your account and personal details.</Text>
      <Button title="Delete my account" variant="danger" onPress={onDelete} disabled={isPreview || isOffline || !canDelete || !onDelete || deleting} loading={deleting} />
    </Card>
  </AffiliateToolFrame>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 30, lineHeight: 36, marginBottom: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  name: { fontSize: 26, lineHeight: 32, marginBottom: 4 },
  menu: { paddingHorizontal: 18, paddingVertical: 0, borderRadius: radius.cardLg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  disabled: { opacity: 0.45 },
  signOut: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 4 },
  deleteCard: { gap: space.md, marginTop: space.lg },
  deleteHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
