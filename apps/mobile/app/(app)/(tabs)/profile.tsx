import React, { useState, useRef, useCallback } from 'react';
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
  return isPreview ? <PreviewProfile /> : <PersonalProfile isAffiliate={account?.role === 'affiliate'} />;
}

/** One white card holding a stack of icon rows. */
function MenuCard({ items }: { items: MenuItem[] }) {
  return (
    <Card style={styles.menuCard}>
      {items.map((item, idx) => (
        <ListRow
          key={item.label}
          icon={item.icon}
          title={item.label}
          subtitle={item.sublabel}
          trailing={item.trailing}
          onPress={item.onPress}
          accessibilityLabel={item.label}
          divider={idx < items.length - 1}
        />
      ))}
    </Card>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat} accessibilityLabel={`${label} ${value}`}>
      <Text variant="heading" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
      </Text>
      <Text variant="label" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

function PersonalProfile({ isAffiliate }: { isAffiliate: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState('');
  const certModalRef = useRef<View>(null);
  const applyReferralCode = useMutation(api.creators.applyReferralCode);

  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  // Count real submissions rather than the creator.submissionCount counter,
  // which isn't maintained and reads 0 even for field agents with earnings. Mirrors
  // the Home dashboard, which counts this query's length.
  const submissions = useQuery(
    api.submissions.getByCreatorId,
    creator?._id && !isAffiliate ? { creatorId: creator._id } : 'skip',
  );

  const handleShareCert = useCallback(async () => {
    try {
      const uri = await captureRef(certModalRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your certificate',
      });
    } catch {
      Alert.alert('Error', 'Could not share certificate. Please try again.');
    }
  }, []);

  const handleDownloadCert = useCallback(async () => {
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
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission needed', 'Please allow access to save the certificate.');
          return;
        }
      }
      const uri = await captureRef(certModalRef, { format: 'png', quality: 1 });
      const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert('Saved!', 'Certificate has been saved to your gallery.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save certificate. Please try again.');
    }
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleApplyReferral = async () => {
    if (!creator?._id || !referralCode.trim()) return;
    setReferralLoading(true);
    setReferralError('');
    try {
      await applyReferralCode({ id: creator._id, referredByCode: referralCode.trim() });
      Alert.alert('Code applied!', 'Your code has been applied.');
      setShowReferralInput(false);
      setReferralCode('');
    } catch (err: any) {
      setReferralError(err?.message || 'Could not apply that code.');
    } finally {
      setReferralLoading(false);
    }
  };

  if (!isOffline && (!isLoaded || creator === undefined)) {
    return <Loading />;
  }

  const firstName = creator?.firstName || '';
  const lastName = creator?.lastName || '';
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') || user?.fullName || (isAffiliate ? 'Creator' : 'Field agent');
  const isCertified = !isAffiliate && !!creator?.certifiedAt;
  const profileImage = (creator as any)?.profileImage as string | undefined;

  const balance = creator?.balance ?? 0;
  const totalEarnings = (creator as any)?.totalEarnings ?? 0;
  const submissionCount = submissions?.length ?? 0;

  // Field agents: their work, then settings, then the small print. Creators
  // (role `affiliate`) keep the trimmed menu: settings and legal only.
  const workItems: MenuItem[] = [];
  if (!isAffiliate) {
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
              <Text variant="bodyLg" weight="bold" tone="muted">{String(submissionCount)}</Text>
              <Ionicons name="chevron-forward" size={22} color={colors.ink3} />
            </View>
          )
          : undefined,
      },
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

  if (!isAffiliate && !creator?.referredByCode) {
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
    isAffiliate && creator?.status === 'suspended'
      ? settingsItems.filter((item) => item.label !== 'Edit profile')
      : settingsItems;

  const aboutItems: MenuItem[] = [
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

        <View style={styles.header}>
          <Avatar uri={profileImage} name={displayName} size={64} ring />
          <View style={styles.headerText}>
            <Text variant="heading" numberOfLines={2}>
              {displayName}
            </Text>
            <Text variant="label" tone="muted" weight="medium">
              {isAffiliate ? 'Creator' : 'Field agent'}
            </Text>
          </View>
        </View>

        {isCertified || creator?.referralCode ? (
          <View style={styles.chips}>
            {isCertified ? <Chip label="Certified" tone="ok" /> : null}
            {creator?.referralCode ? <Chip label={`Your code ${creator.referralCode}`} tone="muted" /> : null}
          </View>
        ) : null}

        <View style={styles.stats}>
          {!isAffiliate ? <StatTile label="Submitted" value={String(submissionCount)} /> : null}
          <StatTile label="Balance" value={formatPeso(balance)} />
          <StatTile label="Earned" value={formatPeso(totalEarnings)} />
        </View>

        {workItems.length > 0 ? <MenuCard items={workItems} /> : null}

        <SectionLabel style={styles.sectionLabel}>Settings</SectionLabel>
        <MenuCard items={visibleSettings} />

        <SectionLabel style={styles.sectionLabel}>About</SectionLabel>
        <MenuCard items={aboutItems} />

        <Card style={styles.menuCard}>
          <ListRow
            title={signingOut ? 'Signing out…' : 'Sign out'}
            leading={
              <View style={styles.signOutIcon}>
                {signingOut ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ionicons name="log-out-outline" size={22} color={colors.danger} />
                )}
              </View>
            }
            onPress={signingOut ? undefined : handleSignOut}
            accessibilityLabel="Sign out"
          />
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
            disabled={referralLoading || !referralCode.trim()}
            onPress={handleApplyReferral}
            accessibilityLabel="Apply referral code"
          />
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
        visible={showCertModal}
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
              <Pressable
                onPress={handleShareCert}
                style={styles.roundButton}
                accessibilityLabel="Share certificate"
                accessibilityRole="button"
                hitSlop={4}
              >
                <Ionicons name="share-outline" size={22} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.certScroll}
              showsVerticalScrollIndicator={false}
            >
              <CertificateCard
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
              />
            </ScrollView>

            <View style={styles.certFooter}>
              <Button
                title="Save to gallery"
                variant="dark"
                size="md"
                icon="download-outline"
                onPress={handleDownloadCert}
                accessibilityLabel="Save certificate to gallery"
              />
              <Button
                title="Send to others"
                size="md"
                icon="share-outline"
                onPress={handleShareCert}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  headerText: { flex: 1, gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stats: { flexDirection: 'row', gap: space.md },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: space.md, paddingVertical: space.lg, gap: space.xs },
  menuCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
  sectionLabel: { marginTop: space.sm, paddingLeft: space.xs },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  signOutIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
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
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  certScroll: { padding: space.lg, alignItems: 'center' },
  certFooter: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
});
