import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  PermissionsAndroid,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Constants from 'expo-constants';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import CertificateCard from '../../../components/CertificateCard';
import { SwipeSheet } from '../../../components/ui/SwipeSheet';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { PreviewProfile } from '../../../components/AccountPreview';
import { colors, radius, shadow, space } from '../../../theme/v2';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  Field,
  ListRow,
  Loading,
  ScreenShell,
  SectionLabel,
  Text,
  TextLink,
  formatPeso,
} from '../../../components/v2';

type MenuItem = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel?: string;
  onPress: () => void;
  trailing?: React.ReactNode;
};

export default function ProfileScreen() {
  const { isPreview, account } = useMobileAccount();
  const { user } = useUser();
  const isAffiliate = account?.role === 'affiliate';
  return isPreview ? <PreviewProfile /> : <PersonalProfile key={`${user?.id ?? 'signed-out'}:${isAffiliate ? 'affiliate' : 'agent'}`} isAffiliate={isAffiliate} />;
}

/** One white card holding a stack of icon rows. */
function MenuCard({ items }: { items: MenuItem[] }) {
  return (
    <Card style={styles.menuCard}>
      {items.map((item, idx) => (
        <ListRow
          key={item.label}
          leading={<View style={styles.menuIcon}><Ionicons name={item.icon} size={21} color={colors.ink} /></View>}
          title={item.label}
          titleNumberOfLines={0}
          subtitle={item.sublabel}
          subtitleNumberOfLines={0}
          trailing={item.trailing}
          onPress={item.onPress}
          accessibilityLabel={item.label}
          divider={idx < items.length - 1}
          style={styles.menuRow}
        />
      ))}
    </Card>
  );
}

function StatTile({ label, value, compact }: { label: string; value: string; compact: boolean }) {
  return (
    <Card style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text variant="heading" weight="extrabold" tabular align="center" style={compact ? styles.compactStatValue : undefined}>
        {value}
      </Text>
      <Text variant="label" tone="muted" align="center">
        {label}
      </Text>
    </Card>
  );
}

function profileMoney(amount: number) {
  return Number.isInteger(amount) ? formatPeso(amount)
    : `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PersonalProfile({ isAffiliate }: { isAffiliate: boolean }) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const router = useGuardedRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [certificateAction, setCertificateAction] = useState<'save' | 'share' | null>(null);
  const certModalRef = useRef<View>(null);
  const mounted = useRef(true);
  const signingOutBusy = useRef(false);
  const signOutPrompt = useRef(false);
  const referralBusy = useRef(false);
  const certificateBusy = useRef(false);
  const actorId = user?.id;
  const liveActor = useRef(actorId);
  liveActor.current = actorId;
  const isCurrent = () => mounted.current && !!actorId && liveActor.current === actorId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const applyReferralCode = useMutation(api.creators.applyReferralCode);

  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;

  const queriedCreator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );
  const creator = queriedCreator?.clerkId && queriedCreator.clerkId !== actorId ? null : queriedCreator;
  const affiliateAccount = creator?.role === 'affiliate' || isAffiliate;
  const liveCreator = useRef(creator);
  liveCreator.current = creator;
  const isCertified = !affiliateAccount && !!creator?.certifiedAt && !creator?.rejectedAt;
  const certificateVisible = useRef(false);
  certificateVisible.current = showCertModal && isCertified;

  // Read the real capture list. Drafts remain available in Your submissions,
  // while the Submitted stat counts only captures that have left draft status.
  const submissions = useQuery(
    api.submissions.getByCreatorId,
    creator?._id && !affiliateAccount ? { creatorId: creator._id } : 'skip',
  );

  const handleShareCert = useCallback(async () => {
    const current = () => isCurrent() && certificateVisible.current;
    if (!current() || certificateBusy.current) return;
    certificateBusy.current = true;
    setCertificateAction('share');
    try {
      const uri = await captureRef(certModalRef, { format: 'png', quality: 1 });
      if (!current()) return;
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your certificate',
      });
    } catch {
      if (current()) Alert.alert('Error', 'Could not share certificate. Please try again.');
    } finally {
      certificateBusy.current = false;
      if (isCurrent()) setCertificateAction(null);
    }
  }, [actorId]);

  const handleDownloadCert = useCallback(async () => {
    const current = () => isCurrent() && certificateVisible.current;
    if (!current() || certificateBusy.current) return;
    certificateBusy.current = true;
    setCertificateAction('save');
    try {
      if (Platform.OS === 'android' && (Platform.Version as number) < 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Save certificate',
            message: 'Allow the app to save your certificate to your gallery.',
            buttonPositive: 'Allow',
          }
        );
        if (!current()) return;
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission needed', 'Please allow access to save the certificate.');
          return;
        }
      }
      if (!current()) return;
      const uri = await captureRef(certModalRef, { format: 'png', quality: 1 });
      if (!current()) return;
      const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      await MediaLibrary.saveToLibraryAsync(fileUri);
      if (current()) Alert.alert('Saved!', 'Certificate has been saved to your gallery.');
    } catch (e: any) {
      if (current()) Alert.alert('Error', e?.message || 'Could not save certificate. Please try again.');
    } finally {
      certificateBusy.current = false;
      if (isCurrent()) setCertificateAction(null);
    }
  }, [actorId]);

  const handleSignOut = () => {
    if (!isCurrent() || signOutPrompt.current || signingOutBusy.current) return;
    signOutPrompt.current = true;
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { signOutPrompt.current = false; } },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            signOutPrompt.current = false;
            if (!isCurrent() || signingOutBusy.current) return;
            signingOutBusy.current = true;
            setSigningOut(true);
            try {
              await signOut();
              if (isCurrent()) router.replace('/(auth)/login');
            } catch {
              if (isCurrent()) Alert.alert('Could not sign out', 'Please try again.');
            } finally {
              signingOutBusy.current = false;
              if (isCurrent()) setSigningOut(false);
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => { signOutPrompt.current = false; } },
    );
  };

  const handleApplyReferral = async () => {
    const creatorId = creator?._id;
    const current = () => isCurrent() && liveCreator.current?._id === creatorId;
    if (!creatorId || !referralCode.trim() || isOffline || !current() || referralBusy.current) return;
    referralBusy.current = true;
    setReferralLoading(true);
    setReferralError('');
    try {
      await applyReferralCode({ id: creatorId, referredByCode: referralCode.trim() });
      if (!current()) return;
      Alert.alert('Code applied!', 'Your code has been applied.');
      setShowReferralInput(false);
      setReferralCode('');
    } catch (err: any) {
      if (current()) setReferralError(err?.message || 'Could not apply that code.');
    } finally {
      referralBusy.current = false;
      if (current()) setReferralLoading(false);
    }
  };

  if (!isOffline && (!isLoaded || creator === undefined)) {
    return <Loading />;
  }

  const firstName = creator?.firstName || '';
  const lastName = creator?.lastName || '';
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') || user?.fullName || (affiliateAccount ? 'Creator' : 'Field agent');
  const profileImage = creator?.profileImage;

  const balance = creator?.balance ?? 0;
  const totalEarnings = creator?.totalEarnings ?? 0;
  const submissionCount = submissions?.filter(submission => submission.status !== 'draft').length;
  const allCapturesCount = submissions?.length;
  const balanceLabel = creator ? profileMoney(balance) : '—';
  const earningsLabel = creator ? profileMoney(totalEarnings) : '—';
  // Keep complete amounts readable rather than squeezing or truncating them.
  const moneyLength = Math.max(balanceLabel.length, earningsLabel.length);
  const moneyNeedsSpace = moneyLength > (affiliateAccount ? 12 : 10);
  const stackStats = width < 360 || fontScale > 1.3 || moneyNeedsSpace;
  const compactStatValues = !stackStats && moneyLength > (affiliateAccount ? 10 : 8);

  // Work tools stay reachable through the Home avatar without crowding Home.
  const workItems: MenuItem[] = [];
  if (affiliateAccount) {
    workItems.push(
      { icon: 'link-outline', label: 'My creator page', onPress: () => router.push('/(app)/(affiliate-tabs)/page' as any) },
      { icon: 'receipt-outline', label: 'Sales', onPress: () => router.push('/(app)/(affiliate-tabs)/sales' as any) },
    );
  } else {
    if (isCertified) {
      workItems.push({
        icon: 'ribbon-outline',
        label: 'Show my certificate',
        sublabel: 'View and share it',
        onPress: () => setShowCertModal(true),
      });
    }
    workItems.push(
      {
        icon: 'stats-chart-outline',
        label: 'Dashboard',
        sublabel: 'Your sites and recent activity',
        onPress: () => router.push('/(app)/(tabs)/dashboard' as any),
      },
      {
        icon: 'storefront-outline',
        label: 'Your submissions',
        onPress: () => router.push('/(app)/submissions' as any),
        trailing: submissions
          ? (
            <View style={styles.trailing}>
              <Text variant="label" weight="bold" tone="muted">{String(allCapturesCount)}</Text>
              <Ionicons name="chevron-forward" size={22} color={colors.ink3} />
            </View>
          )
          : undefined,
      },
      {
        icon: 'people-outline',
        label: 'Invite field agents',
        onPress: () => router.push('/(app)/referrals' as any),
      },
    );
  }

  const settingsItems: MenuItem[] = [
    {
      icon: 'create-outline',
      label: 'Edit profile',
      onPress: () => router.push('/(app)/edit-profile' as any),
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      // It opens the inbox; there are no notification settings.
      sublabel: 'See your latest updates',
      onPress: () => router.push('/(app)/notifications' as any),
    },
    {
      icon: 'lock-closed-outline',
      // Apple / Google users have no password (Clerk's passwordEnabled is false),
      // so "Change" is meaningless — offer "Set a password" instead, which lets
      // them also sign in with email as a backup. The screen adapts to match.
      label: user?.passwordEnabled ? 'Change password' : 'Set a password',
      onPress: () => router.push('/(app)/change-password' as any),
    },
  ];

  if (!affiliateAccount && creator && !creator.referredByCode) {
    settingsItems.push({
      icon: 'gift-outline',
      label: 'Enter referral code',
      sublabel: 'Got a code from a friend?',
      onPress: () => {
        setShowReferralInput(true);
        setReferralCode('');
        setReferralError('');
      },
    });
  }

  const visibleSettings =
    affiliateAccount && creator?.status === 'suspended'
      ? settingsItems.filter((item) => item.label !== 'Edit profile')
      : settingsItems;

  const helpItems: MenuItem[] = affiliateAccount ? [] : [
    {
      icon: 'book-outline',
      label: 'Learn & help',
      sublabel: 'Guides and Ask Tendso',
      onPress: () => router.push('/(app)/(tabs)/knowledge' as any),
    },
    {
      icon: 'help-circle-outline',
      label: 'Help & FAQ',
      onPress: () => router.push('/(app)/help-faq' as any),
    },
  ];

  const legalItems: MenuItem[] = [
    {
      icon: 'document-text-outline',
      label: 'Terms of service',
      onPress: () => router.push('/(app)/terms-of-service' as any),
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Privacy policy',
      onPress: () => router.push('/(app)/privacy-policy' as any),
    },
  ];

  return (
    <>
      <ScreenShell insetBottom={false} contentStyle={styles.content}>
        <OfflineBanner />

        <Card variant="lg" style={styles.identityCard}>
          <View style={styles.header}>
            <Avatar uri={profileImage} name={displayName} size={72} ring />
            <View style={styles.headerText}>
              <Text variant="title" accessibilityRole="header">{displayName}</Text>
              <View style={styles.identityMeta}>
                <Text variant="label" tone="muted">{affiliateAccount ? 'Creator' : 'Field agent'}</Text>
                {isCertified ? <Chip label="Certified" tone="ok" /> : null}
              </View>
            </View>
          </View>
          {creator?.referralCode ? <View style={styles.inviteCode}>
            <Text variant="label" tone="muted">Your code</Text>
            <Text variant="label" weight="bold" selectable>{creator.referralCode}</Text>
          </View> : null}
        </Card>

        <View style={[styles.stats, stackStats && styles.statsStack]} testID="profile-stats">
          {!affiliateAccount ? <StatTile label="Submitted" value={submissionCount == null ? '—' : String(submissionCount)} compact={compactStatValues} /> : null}
          <StatTile label="Balance" value={balanceLabel} compact={compactStatValues} />
          <StatTile label="Earned" value={earningsLabel} compact={compactStatValues} />
        </View>
        {isOffline && (!creator || (!affiliateAccount && submissions === undefined))
          ? <Text variant="label" tone="muted">Reconnect to load your profile and totals.</Text> : null}

        {workItems.length > 0 ? <View style={styles.group}>
          <SectionLabel style={styles.sectionLabel}>Your work</SectionLabel>
          <MenuCard items={workItems} />
        </View> : null}

        <View style={styles.group}>
          <SectionLabel style={styles.sectionLabel}>Settings</SectionLabel>
          <MenuCard items={visibleSettings} />
        </View>

        {helpItems.length > 0 ? <View style={styles.group}>
          <SectionLabel style={styles.sectionLabel}>Help</SectionLabel>
          <MenuCard items={helpItems} />
        </View> : null}

        <View style={styles.group}>
          <SectionLabel style={styles.sectionLabel}>Legal</SectionLabel>
          <MenuCard items={legalItems} />
        </View>

        <Card style={styles.menuCard}>
          <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Sign out"
            accessibilityState={{ disabled: signingOut, busy: signingOut }} disabled={signingOut}
            onPress={handleSignOut} style={({ pressed }) => [styles.signOutRow, pressed && styles.pressedRow]}>
              <View style={styles.signOutIcon}>
                {signingOut ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ionicons name="log-out-outline" size={22} color={colors.danger} />
                )}
              </View>
              <Text variant="bodyLg" weight="semibold" tone="danger">{signingOut ? 'Signing out…' : 'Sign out'}</Text>
          </Pressable>
        </Card>

        <Text variant="label" tone="muted" align="center" style={styles.version}>
          Tendso · v{Constants.expoConfig?.version ?? ''}
        </Text>
      </ScreenShell>

      {/* Referral code sheet */}
      <SwipeSheet
        visible={showReferralInput}
        onClose={() => setShowReferralInput(false)}
        dismissable={!referralLoading}
      >
        <View style={styles.sheetBody}>
          <Text variant="title">Got a code?</Text>
          <Text variant="bodyLg" tone="ink2">
            Type the code a field agent or creator shared with you.
          </Text>

          <Field
            label="Referral code"
            icon="gift-outline"
            placeholder="e.g. JUD8A3BK"
            value={referralCode}
            onChangeText={(t) => setReferralCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!referralLoading}
            accessibilityLabel="Referral code"
          />

          {referralError !== '' ? <Banner tone="danger" body={referralError} /> : null}

          <Button
            title={referralLoading ? 'Applying…' : 'Apply code'}
            loading={referralLoading}
            disabled={referralLoading || isOffline || !referralCode.trim()}
            onPress={handleApplyReferral}
            accessibilityLabel="Apply referral code"
          />
          {isOffline ? <Text variant="label" tone="muted">Reconnect to apply your code.</Text> : null}
          <TextLink
            label="Cancel"
            tone="muted"
            onPress={() => {
              if (!referralLoading) setShowReferralInput(false);
            }}
          />
        </View>
      </SwipeSheet>

      {/* Certificate modal */}
      <Modal
        visible={showCertModal && isCertified}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCertModal(false)}
      >
        <View style={[styles.scrim, { paddingTop: insets.top + space.lg, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <View style={styles.certPanel}>
            <View style={styles.certHeader}>
              <Pressable
                onPress={() => setShowCertModal(false)}
                style={styles.roundButton}
                accessibilityLabel="Close certificate"
                accessibilityRole="button"
                hitSlop={4}
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
              <Text variant="heading" style={styles.certTitle}>Your certificate</Text>
              <View style={styles.certHeaderSpacer} />
            </View>

            <ScrollView
              style={styles.certScrollView}
              contentContainerStyle={styles.certScroll}
              showsVerticalScrollIndicator={false}
            >
              {isCertified ? <CertificateCard
                ref={certModalRef}
                creatorName={
                  creator
                    ? `${(creator.firstName || '').toUpperCase()} ${(creator.lastName || '').toUpperCase()}`.trim()
                    : ''
                }
                certMonth={
                  (creator as any)?.certifiedAt
                    ? new Date((creator as any).certifiedAt).toLocaleString('en-US', { month: 'long' })
                    : new Date().toLocaleString('en-US', { month: 'long' })
                }
                certYear={
                  (creator as any)?.certifiedAt
                    ? new Date((creator as any).certifiedAt).getFullYear()
                    : new Date().getFullYear()
                }
              /> : null}
            </ScrollView>

            <View style={styles.certFooter}>
              <Button
                title="Save to gallery"
                variant="dark"
                size="md"
                icon="download-outline"
                onPress={handleDownloadCert}
                loading={certificateAction === 'save'}
                disabled={certificateAction !== null}
                accessibilityLabel="Save certificate to gallery"
              />
              <Button
                title="Share certificate"
                size="md"
                icon="share-outline"
                onPress={handleShareCert}
                loading={certificateAction === 'share'}
                disabled={certificateAction !== null}
                accessibilityLabel="Share certificate"
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingTop: space.lg, paddingBottom: space.xxl },
  identityCard: { gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, minWidth: 0, gap: space.sm },
  identityMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  inviteCode: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule, paddingTop: space.md },
  stats: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  statsStack: { flexDirection: 'column' },
  stat: { flex: 1, minWidth: 0, minHeight: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm, paddingVertical: space.lg, gap: space.xs },
  compactStatValue: { fontSize: 16, lineHeight: 22 },
  group: { gap: space.sm },
  menuCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
  menuRow: { minHeight: 64, paddingVertical: space.sm + 2, gap: space.md },
  menuIcon: { width: 40, height: 40, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2 },
  sectionLabel: { paddingLeft: space.xs },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  signOutRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm + 2, paddingHorizontal: space.xs, borderRadius: radius.field },
  pressedRow: { backgroundColor: colors.dangerBg },
  signOutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.field,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  version: { marginTop: space.sm },
  sheetBody: { gap: space.lg },
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.lg },
  certPanel: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: colors.bg,
    borderRadius: radius.cardLg,
    overflow: 'hidden',
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  certTitle: { flex: 1, textAlign: 'center' },
  certHeaderSpacer: { width: 48 },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  certScrollView: { flexShrink: 1, minHeight: 0 },
  certScroll: { padding: space.lg, alignItems: 'center' },
  certFooter: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
});
