import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  PermissionsAndroid,
  TextInput,
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
import { colors, fonts, radius, space } from '../../../theme/tokens';
import { Display, Body, Label, Door, Card, Rule, Avatar } from '../../../components/ui/primitives';
import { SwipeSheet } from '../../../components/ui/SwipeSheet';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { PreviewProfile } from '../../../components/AccountPreview';

type MenuItem = {
  icon: any;
  label: string;
  sublabel?: string;
  onPress: () => void;
  tintBg?: string;
  tintFg?: string;
  showArrow?: boolean;
  danger?: boolean;
};

type MenuSection = {
  title: string;
  step?: string;
  items: MenuItem[];
};

export default function ProfileScreen() {
  const { isPreview, account } = useMobileAccount();
  return isPreview ? <PreviewProfile /> : <PersonalProfile isAffiliate={account?.role === 'affiliate'} />;
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
  // which isn't maintained and reads 0 even for creators with earnings. Mirrors
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
      Alert.alert('Referral applied!', 'The referral code has been applied successfully.');
      setShowReferralInput(false);
      setReferralCode('');
    } catch (err: any) {
      setReferralError(err?.message || 'Failed to apply referral code.');
    } finally {
      setReferralLoading(false);
    }
  };

  if (!isOffline && (!isLoaded || creator === undefined)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const firstName = creator?.firstName || '';
  const lastName = creator?.lastName || '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || user?.fullName || 'Creator';
  const email = creator?.email || user?.primaryEmailAddress?.emailAddress || '';
  const isCertified = !isAffiliate && !!creator?.certifiedAt;

  const accountItems: MenuItem[] = [
    {
      icon: 'person-outline',
      label: 'Edit profile',
      sublabel: 'Update your name and details',
      onPress: () => router.push('/(app)/edit-profile' as any),
      showArrow: true,
      tintBg: colors.paper2,
      tintFg: colors.ink2,
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      sublabel: 'Manage your notification settings',
      onPress: () => router.push('/(app)/notifications' as any),
      showArrow: true,
      tintBg: colors.paper2,
      tintFg: colors.ink2,
    },
    {
      icon: 'shield-checkmark-outline',
      // Apple / Google users have no password (Clerk's passwordEnabled is false),
      // so "Change" is meaningless — offer "Set a password" instead, which lets
      // them also sign in with email as a backup. The screen adapts to match.
      label: user?.passwordEnabled ? 'Change password' : 'Set a password',
      sublabel: user?.passwordEnabled
        ? 'Update your account password'
        : 'Add email login as a backup',
      onPress: () => router.push('/(app)/change-password' as any),
      showArrow: true,
      tintBg: colors.paper2,
      tintFg: colors.ink2,
    },
  ];

  if (!isAffiliate && !creator?.referredByCode) {
    accountItems.push({
      icon: 'gift-outline',
      label: 'Enter referral code',
      sublabel: 'Apply a code from another creator',
      onPress: () => {
        setShowReferralInput(true);
        setReferralCode('');
        setReferralError('');
      },
      showArrow: true,
      tintBg: colors.businessBg,
      tintFg: colors.business,
    });
  }

  if (isCertified) {
    accountItems.push({
      icon: 'ribbon-outline',
      label: 'Show my certificate',
      sublabel: 'View and share your certification',
      onPress: () => setShowCertModal(true),
      showArrow: true,
      tintBg: colors.accentBg,
      tintFg: colors.accent,
    });
  }

  // The old "My activity" section was dropped as redundant: Submissions is on
  // Home ("View all" + recents), Earnings just switched to the Wallet tab, and
  // Referrals now lives in the Wallet tab (referral bonuses pay into that
  // balance) — Profile already shows Submissions/Balance/Earned as stat tiles.

  const menuSections: MenuSection[] = [
    {
      step: '02',
      title: 'Account',
      items: isAffiliate && creator?.status === 'suspended' ? accountItems.filter(item => item.label !== 'Edit profile') : accountItems,
    },
    {
      step: '04',
      title: 'Support',
      items: [
        // Help & FAQ moved into the Learn tab — help lives in one place now.
        {
          icon: 'document-text-outline',
          label: 'Terms of service',
          onPress: () => router.push('/(app)/terms-of-service' as any),
          showArrow: true,
          tintBg: colors.paper2,
          tintFg: colors.ink2,
        },
        {
          icon: 'lock-closed-outline',
          label: 'Privacy policy',
          onPress: () => router.push('/(app)/privacy-policy' as any),
          showArrow: true,
          tintBg: colors.paper2,
          tintFg: colors.ink2,
        },
      ],
    },
  ];

  const balance = creator?.balance ?? 0;
  const totalEarnings = (creator as any)?.totalEarnings ?? 0;
  const submissionCount = submissions?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <OfflineBanner />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Editorial header */}
        <View style={{
          paddingTop: insets.top + 20,
          paddingBottom: 20,
          paddingHorizontal: 24,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <Label tracking={1.8}>PROFILE</Label>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {(creator as any)?.profileImage ? (
              <Image
                source={{ uri: (creator as any).profileImage }}
                style={{ width: 72, height: 72, borderRadius: 36 }}
                accessibilityLabel="Profile picture"
                accessibilityRole="image"
              />
            ) : (
              <Avatar name={displayName} size={72} bg={colors.ink} fg={colors.paper3} />
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Display size="sm">{firstName || 'You'}</Display>
                {lastName ? (
                  <Display size="sm" italic color={colors.accent}> {lastName}.</Display>
                ) : (
                  <Display size="sm" italic color={colors.accent}>.</Display>
                )}
              </View>
              <Body size="sm" color={colors.ink3} numberOfLines={1}>{email}</Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                {creator?.referralCode && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: colors.paper2,
                    borderRadius: radius.pill,
                    paddingHorizontal: 10, paddingVertical: 3, gap: 5,
                  }}>
                    <Ionicons name="gift-outline" size={10} color={colors.ink2} />
                    <Text style={{
                      fontFamily: fonts.monoMed,
                      fontSize: 10, letterSpacing: 1.0,
                      color: colors.ink2,
                    }}>
                      {creator.referralCode}
                    </Text>
                  </View>
                )}
                {isCertified && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: colors.accentBg,
                    borderRadius: radius.pill,
                    paddingHorizontal: 10, paddingVertical: 3, gap: 5,
                  }}>
                    <Ionicons name="ribbon-outline" size={10} color={colors.accentInk} />
                    <Text style={{
                      fontFamily: fonts.monoMed,
                      fontSize: 10, letterSpacing: 1.0,
                      color: colors.accentInk,
                    }}>
                      CERTIFIED
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        <Rule strong />

        {/* Stats strip */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              ...(!isAffiliate ? [{ label: 'Submissions', value: String(submissionCount) }] : []),
              { label: 'Balance',      value: `₱${balance.toLocaleString('en-PH', { maximumFractionDigits: 0 })}` },
              { label: 'Earned',       value: `₱${totalEarnings.toLocaleString('en-PH', { maximumFractionDigits: 0 })}` },
            ].map((s) => (
              <Card key={s.label} padded={false} style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 6 }}>
                <Text style={{
                  fontFamily: fonts.serif,
                  fontSize: 22,
                  lineHeight: 24,
                  color: colors.ink,
                  letterSpacing: -0.3,
                }}>
                  {s.value}
                </Text>
                <Label tracking={1.4}>{s.label}</Label>
              </Card>
            ))}
          </View>
        </View>

        {/* Menu sections */}
        <View style={{ padding: 20, gap: 22 }}>
          {menuSections.map((section) => (
            <View key={section.title}>
              <View style={{ marginBottom: 10, paddingLeft: 4 }}>
                <Display size="sm">{section.title}</Display>
              </View>
              <Card padded={false} large style={{ overflow: 'hidden' }}>
                {section.items.map((item, idx) => (
                  <View key={item.label}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}
                      onPress={item.onPress}
                      activeOpacity={0.7}
                      accessibilityLabel={item.label}
                      accessibilityRole="button"
                    >
                      <View style={{
                        width: 38, height: 38, borderRadius: radius.sm,
                        backgroundColor: item.tintBg ?? colors.paper2,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name={item.icon} size={18} color={item.tintFg ?? colors.ink2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Body size="md" weight="medium" color={colors.ink}>{item.label}</Body>
                        {item.sublabel && (
                          <Body size="xs" color={colors.ink3} style={{ marginTop: 2 }}>{item.sublabel}</Body>
                        )}
                      </View>
                      {item.showArrow && (
                        <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
                      )}
                    </TouchableOpacity>
                    {idx < section.items.length - 1 && <Rule style={{ marginHorizontal: 14 }} />}
                  </View>
                ))}
              </Card>
            </View>
          ))}

          {/* Sign out */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={signingOut}
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Card padded={false} large style={{
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderColor: colors.dangerBg,
            }}>
              <View style={{
                width: 38, height: 38, borderRadius: radius.sm,
                backgroundColor: colors.dangerBg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {signingOut
                  ? <ActivityIndicator size="small" color={colors.danger} />
                  : <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                }
              </View>
              <Body size="md" weight="bold" color={colors.danger} style={{ flex: 1 }}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Body>
            </Card>
          </TouchableOpacity>

          <Text style={{
            fontFamily: fonts.wordmarkMed,
            fontSize: 10,
            letterSpacing: 2.4,
            color: colors.ink3,
            textAlign: 'center',
            textTransform: 'uppercase',
            opacity: 0.6,
          }}>
            Tendso · v{Constants.expoConfig?.version ?? ''}
          </Text>
        </View>
      </ScrollView>

      {/* Referral code modal */}
      <SwipeSheet
        visible={showReferralInput}
        onClose={() => setShowReferralInput(false)}
        dismissable={!referralLoading}
      >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: colors.businessBg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="gift" size={20} color={colors.business} />
              </View>
              <View style={{ flex: 1 }}>
                <Label tracking={1.6}>REFERRAL</Label>
                <Display size="sm" style={{ marginTop: 2 }}>Got a code?</Display>
              </View>
            </View>

            <Body size="sm" color={colors.ink2} style={{ marginBottom: 16 }}>
              Apply a referral code from a fellow creator.
            </Body>

            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.paper3,
              borderColor: colors.rule, borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: 14, height: 54,
              marginBottom: 12,
            }}>
              <Ionicons name="gift-outline" size={18} color={colors.ink3} />
              <TextInput
                style={{
                  flex: 1, marginLeft: 10,
                  fontFamily: fonts.sansMed,
                  fontSize: 16, color: colors.ink,
                  letterSpacing: 2,
                }}
                placeholder="e.g. JUD8A3BK"
                placeholderTextColor={colors.ink3}
                value={referralCode}
                onChangeText={(t) => setReferralCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!referralLoading}
                accessibilityLabel="Referral code"
              />
            </View>

            {referralError !== '' && (
              <View style={{
                backgroundColor: colors.dangerBg,
                borderColor: colors.danger, borderWidth: 1,
                borderRadius: radius.sm,
                padding: 12, marginBottom: 12,
              }}>
                <Body size="sm" weight="medium" color={colors.danger}>{referralError}</Body>
              </View>
            )}

            <Door
              caption="APPLY"
              label={referralLoading ? 'Applying…' : 'Apply code'}
              variant="solid"
              loading={referralLoading}
              disabled={referralLoading || !referralCode.trim()}
              onPress={handleApplyReferral}
              accessibilityLabel="Apply referral code"
            />
            <TouchableOpacity
              onPress={() => setShowReferralInput(false)}
              disabled={referralLoading}
              style={{ alignItems: 'center', marginTop: 14 }}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
            >
              <Body size="sm" color={colors.ink3}>Cancel</Body>
            </TouchableOpacity>
      </SwipeSheet>

      {/* Certificate modal */}
      <Modal
        visible={showCertModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCertModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
          <View style={{
            backgroundColor: colors.paper,
            borderRadius: radius.xl,
            width: '100%',
            maxHeight: '88%',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: colors.rule,
            }}>
              <TouchableOpacity
                onPress={() => setShowCertModal(false)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: colors.paper2,
                  alignItems: 'center', justifyContent: 'center',
                }}
                accessibilityLabel="Close certificate"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={18} color={colors.ink} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Label tracking={1.6}>CERTIFICATE</Label>
                <Display size="sm">Your award</Display>
              </View>
              <TouchableOpacity
                onPress={handleShareCert}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: colors.paper2,
                  alignItems: 'center', justifyContent: 'center',
                }}
                accessibilityLabel="Share certificate"
                accessibilityRole="button"
              >
                <Ionicons name="share-outline" size={16} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 20, alignItems: 'center' }}
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

            <View style={{
              paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 10,
              borderTopWidth: 1, borderTopColor: colors.rule,
            }}>
              <Door
                caption="SAVE"
                label="Save to gallery"
                variant="solid"
                onPress={handleDownloadCert}
                accessibilityLabel="Save certificate to gallery"
                rightIcon={<Ionicons name="download-outline" size={18} color={colors.paper3} style={{ marginLeft: 12 }} />}
              />
              <Door
                caption="SHARE"
                label="Send to others"
                variant="accent"
                onPress={handleShareCert}
                accessibilityLabel="Share certificate"
                rightIcon={<Ionicons name="share-outline" size={18} color="#fff" style={{ marginLeft: 12 }} />}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
