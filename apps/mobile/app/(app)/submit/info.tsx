import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { mapCategoryToBusinessType, toLocalPhDigits } from '../../../services/prospectPrefill';
import { removeSubmission } from '../../../services/submissionsExtra';
import { api } from '@tendso/convex-client';
import type { Id } from '@tendso/convex-client';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { useFormDraftCache } from '../../../hooks/useFormDraftCache';
import { Display, Body, Label, Door, Card, Rule } from '../../../components/ui/primitives';
import { colors, fonts, radius, space, shadow } from '../../../theme/tokens';
import { useGuardedPress } from '../../../hooks/useGuardedPress';

const BUSINESS_TYPES = [
  'Barber/Salon',
  'Auto Shop',
  'Spa/Massage',
  'Restaurant',
  'Clinic',
  'Law Office',
  'Craft/Producer',
  'Other',
];

export default function SubmitInfoScreen() {
  const router = useRouter();
  // Set when arriving from Discover's "Start with these details". prospectLeadId
  // is present only for legacy-leads rows — see startInterview in discover.tsx.
  const prefillParams = useLocalSearchParams<{
    prospectLeadId?: string;
    businessName?: string;
    phone?: string;
    address?: string;
    city?: string;
    category?: string;
  }>();
  const { user, isLoaded, isSignedIn } = useUser();

  const goBack = useGuardedPress(() => router.back());

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const existingDraft = useQuery(
    api.submissions.getDraftByCreatorId,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  const insets = useSafeAreaInsets();
  const createSubmission = useMutation(api.submissions.create);
  const updateSubmission = useMutation(api.submissions.update);
  const discardDraft = useMutation(removeSubmission);

  const { isConnected } = useNetwork();
  const { saveDraft, loadDraft, clearDraft } = useFormDraftCache();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [initialized, setInitialized] = useState(false);
  // Carried through to submissions.create/update so the backend attaches this
  // interview to the scraped lead instead of inserting a duplicate.
  const [prospectLeadId, setProspectLeadId] = useState<string | undefined>(
    typeof prefillParams.prospectLeadId === 'string' ? prefillParams.prospectLeadId : undefined,
  );
  // The collision Alert fires from an effect that returns WITHOUT setting
  // `initialized`, so a dependency changing identity (clearDraft is not
  // guaranteed stable) would re-run it and stack a second dialog on the first.
  const collisionPrompted = useRef(false);
  // A business name is what makes this a real prefill — prospectLeadId alone is
  // absent for pool and scrape-modal rows, which still deserve the prefill.
  const hasPrefill = useMemo(
    () => Boolean((prefillParams.businessName ?? '').trim()),
    [prefillParams.businessName],
  );

  /** Apply the scraped details passed in from Discover. */
  const applyPrefill = useCallback(() => {
    setBusinessName(prefillParams.businessName ?? '');
    setOwnerPhone(toLocalPhDigits(prefillParams.phone));
    setAddress(prefillParams.address ?? '');
    setCity(prefillParams.city ?? '');
    // '' when Outscraper's free-text category matches nothing — the required
    // check then makes the creator pick, rather than storing a confident guess.
    setBusinessType(mapCategoryToBusinessType(prefillParams.category));
    // Owner name and email are deliberately NOT prefilled: the scrape knows the
    // business, not the person, and a wrong owner name is worse than a blank one.
  }, [prefillParams.businessName, prefillParams.phone, prefillParams.address, prefillParams.city, prefillParams.category]);

  // Load draft data: priority 1 = Convex draft, priority 2 = local cache
  useEffect(() => {
    if (initialized) return;

    // Arrived from Discover with a business in hand.
    if (hasPrefill) {
      // No server draft in the way — just fill the form in.
      if (existingDraft === null) {
        applyPrefill();
        setInitialized(true);
        return;
      }
      if (existingDraft) {
        // Same business as the draft: nothing to reconcile, resume it.
        const sameBusiness =
          (existingDraft.businessName ?? '').trim().toLowerCase() ===
          (prefillParams.businessName ?? '').trim().toLowerCase();
        if (sameBusiness) {
          // fall through to the normal draft-loading path below
        } else {
          // A different business is already half-entered. Ask rather than
          // silently overwrite: a draft may already be linked to another
          // prospect, and update() sets prospectLeadId once and never
          // re-points it — so reusing it would file THIS interview against
          // THAT business.
          if (collisionPrompted.current) return;
          collisionPrompted.current = true;
          Alert.alert(
            'Finish your other interview?',
            `You have an unfinished interview for ${existingDraft.businessName || 'another business'}. Starting ${prefillParams.businessName || 'this one'} will discard it.`,
            [
              {
                text: `Continue ${existingDraft.businessName || 'it'}`,
                style: 'cancel',
                onPress: () => {
                  setBusinessName(existingDraft.businessName || '');
                  setBusinessType(existingDraft.businessType || '');
                  setOwnerName(existingDraft.ownerName || '');
                  setOwnerPhone(existingDraft.ownerPhone || '');
                  setOwnerEmail(existingDraft.ownerEmail || '');
                  setAddress(existingDraft.address || '');
                  setCity(existingDraft.city || '');
                  AsyncStorage.setItem('current_submission_id', existingDraft._id);
                  // The prospect link belongs to the business we just declined,
                  // so drop it — otherwise this draft would submit against it.
                  setProspectLeadId(undefined);
                  setInitialized(true);
                },
              },
              {
                text: 'Start this one',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await discardDraft({ id: existingDraft._id });
                    await AsyncStorage.removeItem('current_submission_id');
                    await clearDraft();
                  } catch (err) {
                    // Non-fatal: worst case the old draft lingers and gets
                    // picked up next time. Don't block the creator, who is
                    // standing in front of the business.
                    console.warn('Could not discard previous draft:', err);
                  }
                  applyPrefill();
                  setInitialized(true);
                },
              },
            ],
          );
          return;
        }
      }
    }

    // Priority 1: Existing Convex draft
    if (existingDraft) {
      setBusinessName(existingDraft.businessName || '');
      setBusinessType(existingDraft.businessType || '');
      setOwnerName(existingDraft.ownerName || '');
      setOwnerPhone(existingDraft.ownerPhone || '');
      setOwnerEmail(existingDraft.ownerEmail || '');
      setAddress(existingDraft.address || '');
      setCity(existingDraft.city || '');
      AsyncStorage.setItem('current_submission_id', existingDraft._id);
      setInitialized(true);
      return;
    }

    // Priority 2: Local cache (when query resolved to null — no server draft)
    if (existingDraft === null) {
      loadDraft().then((cached) => {
        if (cached) {
          setBusinessName(cached.businessName || '');
          setBusinessType(cached.businessType || '');
          setOwnerName(cached.ownerName || '');
          setOwnerPhone(cached.ownerPhone || '');
          setOwnerEmail(cached.ownerEmail || '');
          setAddress(cached.address || '');
          setCity(cached.city || '');
        }
        setInitialized(true);
      });
    }
  }, [existingDraft, initialized, loadDraft, hasPrefill, applyPrefill, prefillParams.businessName, discardDraft, clearDraft]);

  // Auto-save form fields to local cache (debounced)
  useEffect(() => {
    if (!initialized) return;
    saveDraft({
      businessName,
      businessType,
      ownerName,
      ownerPhone,
      ownerEmail,
      address,
      city,
    });
  }, [businessName, businessType, ownerName, ownerPhone, ownerEmail, address, city, initialized, saveDraft]);

  const handleNext = async () => {
    setError(null);

    if (!creator) {
      setError('You must complete your profile first');
      return;
    }

    if (!businessName.trim() || !businessType || !ownerName.trim() || !ownerPhone.trim() || !address.trim() || !city.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    const formData = {
      businessName: businessName.trim(),
      businessType,
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim() || undefined,
      address: address.trim(),
      city: city.trim(),
    };

    // OFFLINE PATH: Save locally and navigate forward
    if (!isConnected) {
      try {
        await AsyncStorage.setItem('submission_pending_sync', JSON.stringify({
          formData,
          creatorId: creator._id,
          existingDraftId: existingDraft?._id || null,
          savedAt: Date.now(),
        }));
        // Ensure there's a submission ID so downstream screens work
        const existingId = await AsyncStorage.getItem('current_submission_id');
        if (!existingId) {
          await AsyncStorage.setItem('current_submission_id', 'offline_pending');
        }
        await clearDraft();
        router.push('/(app)/submit/photos');
      } catch (err) {
        setError('Failed to save data locally');
      }
      return;
    }

    // ONLINE PATH
    setLoading(true);

    try {
      let submissionId: string;

      // Only sent when we actually have one. Omitting the key entirely matters:
      // a Convex object validator rejects unknown args, so on a deployment that
      // predates prospectLeadId this keeps ordinary submissions working.
      const link = prospectLeadId ? { prospectLeadId: prospectLeadId as Id<'leads'> } : {};

      if (existingDraft) {
        await updateSubmission({
          id: existingDraft._id,
          ...formData,
          ...link,
        });
        submissionId = existingDraft._id;
      } else {
        submissionId = await createSubmission({
          creatorId: creator._id,
          ...formData,
          ...link,
        });
      }

      await AsyncStorage.setItem('current_submission_id', submissionId);
      await clearDraft();
      await AsyncStorage.removeItem('submission_pending_sync');
      router.push('/(app)/submit/photos');
    } catch (err: any) {
      console.error('Error saving business info:', err);
      setError(err.message || 'Failed to save business information');
    } finally {
      setLoading(false);
    }
  };

  // When offline, skip Clerk/Convex loading gates — layout already verified auth
  if (!isConnected && (!isLoaded || creator === undefined)) {
    // Offline: allow form to render without creator data
  } else if (!isLoaded || creator === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ─── Field renderer ──────────────────────────────────────────────────────
  // Editorial input frame: paper3 surface + rule border + icon + mono label.
  const renderField = ({
    icon,
    label,
    placeholder,
    value,
    onChangeText,
    keyboardType,
    autoCapitalize,
    maxLength,
    optional = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    placeholder: string;
    value: string;
    onChangeText: (v: string) => void;
    keyboardType?: any;
    autoCapitalize?: any;
    maxLength?: number;
    optional?: boolean;
  }) => (
    <View style={{ marginBottom: 18 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.paper3,
          borderColor: colors.rule,
          borderWidth: 1,
          borderRadius: radius.sm,
          paddingHorizontal: 16,
          height: 54,
        }}
      >
        <Ionicons name={icon} size={18} color={colors.ink3} />
        <TextInput
          style={{
            flex: 1,
            marginLeft: 12,
            fontFamily: fonts.sans,
            fontSize: 15,
            color: colors.ink,
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.ink3}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          editable={!loading}
        />
      </View>
      <View
        style={{
          marginTop: 6,
          paddingHorizontal: 4,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Label>{label}</Label>
        {optional && <Label color={colors.ink3}>OPTIONAL</Label>}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* Header — back arrow + step counter */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            backgroundColor: colors.paper3,
            borderColor: colors.rule,
            borderWidth: 1,
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <OfflineBanner />

      {/* Progress rule — replaces emerald progress bar */}
      <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
        <View
          style={{
            height: 3,
            backgroundColor: colors.rule,
            borderRadius: radius.pill,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: '25%',
              backgroundColor: colors.accent,
              borderRadius: radius.pill,
            }}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Editorial header — eyebrow + serif headline w/ italic accent */}
          <View style={{ marginBottom: 8 }}>
            <Label tracking={1.8} style={{ marginBottom: 16 }}>NEW BUSINESS</Label>
            <Display size="md">Tell us about</Display>
            <Display size="md" italic color={colors.accent}>the place.</Display>
          </View>

          <Body size="md" color={colors.ink2} style={{ marginTop: 12, marginBottom: 28, maxWidth: 340 }}>
            The basics first — name, owner, address. We&apos;ll handle the rest in the next steps.
          </Body>

          {/* Error banner — matches login pattern */}
          {error && (
            <View
              style={{
                backgroundColor: colors.dangerBg,
                borderColor: colors.danger,
                borderWidth: 1,
                borderRadius: radius.sm,
                padding: 14,
                marginBottom: 20,
              }}
            >
              <Body size="sm" weight="medium" color={colors.danger}>{error}</Body>
            </View>
          )}

          {/* SECTION A — Business */}
          <View style={{ marginBottom: 8 }}>
            <Label tracking={1.6} style={{ marginBottom: 6 }}>BUSINESS</Label>
            <Display size="sm">The shopfront.</Display>
          </View>
          <Rule style={{ marginTop: 14, marginBottom: 20 }} />

          {/* Business Name */}
          {renderField({
            icon: 'storefront-outline',
            label: 'BUSINESS NAME',
            placeholder: "e.g., Juan's Barbershop",
            value: businessName,
            onChangeText: setBusinessName,
          })}

          {/* Business Type — custom picker (keeps existing show/hide logic) */}
          <View style={{ marginBottom: 18 }}>
            <TouchableOpacity
              onPress={() => setShowTypePicker(!showTypePicker)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Select business type"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.paper3,
                borderColor: colors.rule,
                borderWidth: 1,
                borderRadius: radius.sm,
                paddingHorizontal: 16,
                height: 54,
              }}
            >
              <Ionicons name="grid-outline" size={18} color={colors.ink3} />
              <Text
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontFamily: fonts.sans,
                  fontSize: 15,
                  color: businessType ? colors.ink : colors.ink3,
                }}
              >
                {businessType || 'Select business type'}
              </Text>
              <Ionicons
                name={showTypePicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.ink3}
              />
            </TouchableOpacity>

            {showTypePicker && (
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: colors.paper3,
                  borderColor: colors.rule,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  overflow: 'hidden',
                }}
              >
                {BUSINESS_TYPES.map((type, idx) => {
                  const active = businessType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose ${type}`}
                      onPress={() => {
                        setBusinessType(type);
                        setShowTypePicker(false);
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderBottomColor: colors.rule,
                        borderBottomWidth: idx === BUSINESS_TYPES.length - 1 ? 0 : 1,
                        backgroundColor: active ? colors.accentBg : 'transparent',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: active ? fonts.sansMed : fonts.sans,
                          fontSize: 15,
                          color: active ? colors.accentInk : colors.ink2,
                        }}
                      >
                        {type}
                      </Text>
                      {active && (
                        <Ionicons name="checkmark" size={18} color={colors.accentInk} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
              <Label>BUSINESS TYPE</Label>
            </View>
          </View>

          {/* SECTION B — Owner */}
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <Label tracking={1.6} style={{ marginBottom: 6 }}>OWNER</Label>
            <Display size="sm">Who runs it.</Display>
          </View>
          <Rule style={{ marginTop: 14, marginBottom: 20 }} />

          {/* Owner Full Name */}
          {renderField({
            icon: 'person-outline',
            label: 'OWNER FULL NAME',
            placeholder: 'e.g., Juan Dela Cruz',
            value: ownerName,
            onChangeText: setOwnerName,
            autoCapitalize: 'words',
          })}

          {/* Owner Phone — country code chip + number input */}
          <View style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row' }}>
              <View
                style={{
                  backgroundColor: colors.paper3,
                  borderColor: colors.rule,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 14,
                  height: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 13, color: colors.ink2, letterSpacing: 1 }}>
                  +63
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.paper3,
                  borderColor: colors.rule,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 16,
                  height: 54,
                }}
              >
                <Ionicons name="call-outline" size={18} color={colors.ink3} />
                <TextInput
                  style={{
                    flex: 1,
                    marginLeft: 12,
                    fontFamily: fonts.sans,
                    fontSize: 15,
                    color: colors.ink,
                  }}
                  placeholder="912 345 4567"
                  placeholderTextColor={colors.ink3}
                  value={ownerPhone}
                  onChangeText={(v) => setOwnerPhone(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={15}
                  editable={!loading}
                />
              </View>
            </View>
            <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
              <Label>OWNER PHONE NUMBER</Label>
            </View>
          </View>

          {/* Owner Email — optional */}
          {renderField({
            icon: 'mail-outline',
            label: 'OWNER EMAIL',
            placeholder: 'owner@example.com',
            value: ownerEmail,
            onChangeText: setOwnerEmail,
            keyboardType: 'email-address',
            autoCapitalize: 'none',
            optional: true,
          })}

          {/* SECTION C — Location */}
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <Label tracking={1.6} style={{ marginBottom: 6 }}>LOCATION</Label>
            <Display size="sm">Where to find it.</Display>
          </View>
          <Rule style={{ marginTop: 14, marginBottom: 20 }} />

          {/* Address */}
          {renderField({
            icon: 'location-outline',
            label: 'FULL ADDRESS',
            placeholder: '123 Main St, Barangay Example',
            value: address,
            onChangeText: setAddress,
          })}

          {/* City */}
          {renderField({
            icon: 'business-outline',
            label: 'CITY',
            placeholder: 'e.g., Manila',
            value: city,
            onChangeText: setCity,
          })}

          {/* Spacer for sticky footer */}
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer CTA — Door button */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: colors.paper,
          borderTopColor: colors.rule,
          borderTopWidth: 1,
        }}
      >
        <Door
          variant="solid"
          caption="CONTINUE"
          label={loading ? 'Saving…' : isConnected ? 'Continue to photos' : 'Save & continue offline'}
          loading={loading}
          disabled={loading}
          onPress={handleNext}
          accessibilityLabel="Continue to photos step"
          rightIcon={
            loading ? (
              <ActivityIndicator color={colors.paper3} />
            ) : (
              <Ionicons name="arrow-forward" size={18} color={colors.paper3} style={{ marginLeft: 12 }} />
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}
