import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Id } from '@tendso/convex-client';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { colors, fonts, radius, space, shadow } from '../../../theme/tokens';
import { Display, Body, Label, Door, Card, Rule } from '../../../components/ui/primitives';
import { PriceSlider } from '../../../components/PriceSlider';
import { useGuardedPress } from '../../../hooks/useGuardedPress';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OfflineData {
  formData?: {
    businessName: string;
    businessType: string;
    ownerName: string;
    ownerPhone: string;
    ownerEmail?: string;
    address: string;
    city: string;
  };
  pendingPhotos?: { photoUris: string[]; existingPhotos: string[] };
  pendingInterview?: { type: 'video' | 'audio'; recordingUri: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — small editorial section row primitives (local to this screen)
// ─────────────────────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Label color={colors.ink3} tracking={1.4}>{label}</Label>
      <Body size="md" color={colors.ink} style={{ marginTop: 4 }}>
        {value}
      </Body>
    </View>
  );
}

function SectionHeader({
  eyebrow,
  title,
  onEdit,
  rightAdornment,
}: {
  eyebrow: string;
  title: string;
  onEdit?: () => void;
  rightAdornment?: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <Label tracking={1.8} color={colors.ink3}>{eyebrow}</Label>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} hitSlop={8} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Edit ${eyebrow}`}>
            <Body size="sm" weight="medium" color={colors.accent}>Edit →</Body>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Display size="sm" color={colors.ink}>{title}</Display>
        {rightAdornment}
      </View>
    </View>
  );
}

function StatusChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'accent' | 'warn' | 'neutral' | 'danger';
}) {
  const palettes = {
    accent:  { bg: colors.accentBg,   fg: colors.accentInk },
    warn:    { bg: colors.warnBg,     fg: colors.warn },
    neutral: { bg: colors.paper2,     fg: colors.ink3 },
    danger:  { bg: colors.dangerBg,   fg: colors.danger },
  } as const;
  const pal = palettes[tone];
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: pal.bg,
        borderRadius: radius.pill,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoMed,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: pal.fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function SubmitReviewScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();
  const submitSubmission = useMutation(api.submissions.submit);
  const setDomainTier = useMutation(api.submissions.setDomainTier);
  const checkDomainAvailability = useAction(api.domains.checkDomainAvailability);

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);
  const [domainInput, setDomainInput] = useState('');

  // Live availability check state — matches the Hostinger doc contract
  type DomainCheckResult = {
    valid: boolean;
    available?: boolean;
    domain?: string;
    priceUSD?: number;
    pricePHP?: number;
    withinBudget?: boolean;
    premium?: boolean;
    reason?: string;
    error?: string;
    suggestions?: Array<{
      domain: string;
      priceUSD: number;
      pricePHP: number;
      withinBudget: boolean;
    }>;
  };
  const [domainCheckLoading, setDomainCheckLoading] = useState(false);
  const [domainCheckResult, setDomainCheckResult] = useState<DomainCheckResult | null>(null);

  // Auto-derived: tier from whether the input has content
  const wantsCustomDomain = domainInput.trim().length > 0;
  const submissionTier: 'standard' | 'with_custom_domain' = wantsCustomDomain
    ? 'with_custom_domain'
    : 'standard';

  // ─── Phase 2 pricing engine (OWNER-PORTAL-PRICING-PLAN §2.2a) ──────────────
  // Read this creator's pricing context from the server. While unloaded or
  // while the creator is in intro mode, the slider is locked to the base price.
  const pricingContext = useQuery(
    api.submissions.getPricingContext,
    creator?._id ? { creatorId: creator._id } : 'skip',
  ) as
    | {
        approvedCount: number;
        priceCeiling: number;
        unlocked: boolean;
        threshold: number;
        basePrice: number;
      }
    | undefined;

  const BASE_PRICE = pricingContext?.basePrice ?? 999;
  const PRICE_CEILING = pricingContext?.priceCeiling ?? BASE_PRICE;
  const ANCHOR_PRICE = 4999;     // marketing anchor — never charged
  const COMMISSION_RATE = 0.5;   // flat 50% per §3.1
  const isUnlocked = pricingContext?.unlocked ?? false;
  const approvedCount = pricingContext?.approvedCount ?? 0;
  const unlockThreshold = pricingContext?.threshold ?? 5;

  // Creator's chosen sale price. Defaults to ceiling once unlocked (forces a
  // conscious discount choice rather than reflexively slamming to the floor).
  const [sellPrice, setSellPrice] = useState<number>(BASE_PRICE);
  useEffect(() => {
    if (pricingContext) {
      setSellPrice(isUnlocked ? PRICE_CEILING : BASE_PRICE);
    }
  }, [pricingContext?.unlocked, pricingContext?.priceCeiling, pricingContext?.basePrice]);

  // Real registrar price (from the debounced /api/check-domain call). Falls
  // back to 0 when no domain or no price quote available.
  const domainAddOn =
    wantsCustomDomain && typeof domainCheckResult?.pricePHP === 'number'
      ? domainCheckResult.pricePHP
      : 0;
  const totalAmount = sellPrice + domainAddOn;
  const discountPct = Math.round(((ANCHOR_PRICE - sellPrice) / ANCHOR_PRICE) * 100);
  const creatorEarnings = Math.round(COMMISSION_RATE * sellPrice);

  // Video player state
  const videoRef = useRef<Video>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoStatus, setVideoStatus] = useState<any>(null);
  const [showFullscreenVideo, setShowFullscreenVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const fullscreenVideoRef = useRef<Video>(null);

  const isOfflinePending = submissionId === 'offline_pending';

  const submission = useQuery(
    api.submissions.getById,
    submissionId && !isOfflinePending ? { id: submissionId as Id<'submissions'> } : 'skip'
  );

  const photoUrls = useQuery(
    api.files.getMultipleUrls,
    submission?.photos && submission.photos.length > 0
      ? { storageIds: submission.photos }
      : 'skip'
  );

  // Get video URL if video interview exists
  const videoUrl = useQuery(
    api.files.getUrl,
    submission?.videoStorageId
      ? { storageId: submission.videoStorageId }
      : 'skip'
  );

  // Load submission ID
  useEffect(() => {
    const loadSubmissionId = async () => {
      let id = await AsyncStorage.getItem('current_submission_id');
      if (!id) {
        const pendingSync = await AsyncStorage.getItem('submission_pending_sync');
        if (pendingSync) {
          id = 'offline_pending';
          await AsyncStorage.setItem('current_submission_id', id);
        } else {
          router.replace('/(app)/dashboard');
          return;
        }
      }
      setSubmissionId(id);
    };
    loadSubmissionId();
  }, []);

  // Load offline cached data when in offline mode
  useEffect(() => {
    if (!isOfflinePending && submission) return;

    const loadOfflineData = async () => {
      const data: OfflineData = {};

      const syncRaw = await AsyncStorage.getItem('submission_pending_sync');
      if (syncRaw) {
        const parsed = JSON.parse(syncRaw);
        data.formData = parsed.formData;
      }

      const photosRaw = await AsyncStorage.getItem('submission_pending_photos');
      if (photosRaw) {
        data.pendingPhotos = JSON.parse(photosRaw);
      }

      const interviewRaw = await AsyncStorage.getItem('submission_pending_interview');
      if (interviewRaw) {
        data.pendingInterview = JSON.parse(interviewRaw);
      }

      setOfflineData(data);
    };
    loadOfflineData();
  }, [isOfflinePending, submission]);

  // Hydrate domainInput from the existing submission record
  useEffect(() => {
    if (submission && (submission as any).requestedDomain && !domainInput) {
      setDomainInput((submission as any).requestedDomain);
    }
  }, [submission]);

  // Debounced live availability check as the user types.
  // Empty input → no API call (user wants the standard tier).
  useEffect(() => {
    const trimmed = domainInput.trim().toLowerCase();
    if (!trimmed) {
      setDomainCheckResult(null);
      setDomainCheckLoading(false);
      return;
    }
    if (!isConnected) {
      setDomainCheckResult(null);
      return;
    }

    setDomainCheckLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkDomainAvailability({
          domain: trimmed,
          maxBudgetPHP: 600,
        });
        setDomainCheckResult(result as DomainCheckResult);
      } catch (err) {
        console.error('Domain availability check failed:', err);
        setDomainCheckResult({
          valid: false,
          error: "Couldn't check, try again",
        });
      } finally {
        setDomainCheckLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [domainInput, isConnected]);

  // Tap a suggestion to use it as the new input value
  const handleSuggestionTap = (suggestedDomain: string) => {
    setDomainInput(suggestedDomain);
  };

  // Guarded navigation handlers — block spam double-taps (re-entrant navigation)
  const goBack = useGuardedPress(() => router.back());
  const editBusinessInfo = useGuardedPress(() => router.push('/(app)/submit/info'));
  const editPhotos = useGuardedPress(() => router.push('/(app)/submit/photos'));
  const editInterview = useGuardedPress(() => router.push('/(app)/submit/interview'));

  const handleSubmit = async () => {
    console.log('[Review] handleSubmit called, submissionId:', submissionId, 'submission:', !!submission, 'status:', submission?.status);
    if (!submissionId || !submission) {
      console.warn('[Review] Cannot submit: submissionId or submission is missing');
      return;
    }

    // Validate photos
    if (!submission.photos || submission.photos.length < 3) {
      setError('Please upload at least 3 photos before submitting.');
      return;
    }

    // Validate the custom domain (if any)
    if (wantsCustomDomain) {
      if (
        !domainCheckResult ||
        !domainCheckResult.valid ||
        !domainCheckResult.available ||
        !domainCheckResult.withinBudget
      ) {
        setError(
          'The custom domain you typed is not available. Pick one from the suggestions or clear the field to submit without one.'
        );
        return;
      }
    }

    Alert.alert(
      'Submit Business',
      `Submit this business for review? Total fee: ₱${totalAmount.toLocaleString()}. You won't be able to edit it after submission.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setLoading(true);
            setError(null);

            try {
              // 1. Save tier + domain choice + Phase 2 pricing (sellPrice + real
              // registrar price). Server re-clamps sellPrice to [basePrice,
              // priceCeiling] and re-quotes the domain at the moment of submit,
              // so the slider/check are convenience only — not the source of truth.
              await setDomainTier({
                id: submissionId as Id<'submissions'>,
                submissionType: submissionTier,
                requestedDomain: wantsCustomDomain
                  ? domainInput.trim().toLowerCase()
                  : undefined,
                sellPrice,
                domainPricePHP: domainAddOn || undefined,
              });

              // 2. Submit (existing flow)
              await submitSubmission({ id: submissionId as Id<'submissions'> });

              // Clear the current submission ID
              await AsyncStorage.removeItem('current_submission_id');

              // Navigate to success
              router.replace('/(app)/submit/success');
            } catch (err: any) {
              console.error('Error submitting:', err);
              setError(err.message || 'Failed to submit');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleQueueSubmit = async () => {
    if (!canSubmit) return;

    Alert.alert(
      'Queue Submission',
      'Your data is saved locally. It will automatically upload and submit when you reconnect to the internet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save & Queue',
          onPress: async () => {
            try {
              await AsyncStorage.setItem('submission_pending_submit', 'true');
              router.replace('/(app)/submit/success?queued=true');
            } catch (err: any) {
              console.error('Error queuing submission:', err);
              setError(err.message || 'Failed to queue submission');
            }
          },
        },
      ]
    );
  };

  // When offline, skip Clerk/Convex loading gates — layout already verified auth
  if (!isConnected && (!isLoaded || creator === undefined)) {
    // Offline: allow page to render without creator data
  } else if (!isLoaded || creator === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!submissionId || (!isOfflinePending && submission === undefined)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isOfflinePending && !submission) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Display size="sm" style={{ marginTop: 16, textAlign: 'center' }}>
          Submission not found
        </Display>
        <Body size="sm" color={colors.ink3} style={{ marginTop: 8, textAlign: 'center' }}>
          We couldn't locate this draft.
        </Body>
        <View style={{ marginTop: 24, alignSelf: 'stretch' }}>
          <Door
            variant="solid"
            label="Go to Dashboard"
            caption="HOME"
            onPress={() => router.replace('/(app)/dashboard')}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Compute data source: Convex submission or offline cache
  const offlinePhotoCount = offlineData?.pendingPhotos
    ? offlineData.pendingPhotos.photoUris.length + offlineData.pendingPhotos.existingPhotos.length
    : 0;

  const hasPhotos = submission
    ? (submission.photos && submission.photos.length >= 3)
    : offlinePhotoCount >= 3;
  const hasVideoInterview = submission
    ? !!submission.videoStorageId
    : offlineData?.pendingInterview?.type === 'video';
  const hasAudioInterview = submission
    ? !!submission.audioStorageId
    : offlineData?.pendingInterview?.type === 'audio';
  const hasInterview = hasAudioInterview || hasVideoInterview;

  // If a domain was typed, it must be valid + available + within budget before submitting
  const domainBlocksSubmit =
    wantsCustomDomain &&
    (domainCheckLoading ||
      !domainCheckResult ||
      !domainCheckResult.valid ||
      !domainCheckResult.available ||
      !domainCheckResult.withinBudget);

  const canSubmit = hasPhotos && !domainBlocksSubmit;

  // Video playback handlers
  const toggleVideoPlayback = async () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
  };

  const openFullscreenVideo = () => {
    setVideoError(null);
    setIsVideoLoading(true);
    setShowFullscreenVideo(true);
  };

  const closeFullscreenVideo = async () => {
    try {
      if (fullscreenVideoRef.current) {
        await fullscreenVideoRef.current.stopAsync();
        await fullscreenVideoRef.current.unloadAsync();
      }
    } catch (e) {
      console.log('Error stopping video:', e);
    }
    setShowFullscreenVideo(false);
    setVideoError(null);
    setIsVideoLoading(false);
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Resolved display values
  const displayBusinessName =
    submission?.businessName || offlineData?.formData?.businessName || 'Untitled business';
  const displayBusinessType =
    submission?.businessType || offlineData?.formData?.businessType || '—';
  const displayOwnerName =
    submission?.ownerName || offlineData?.formData?.ownerName || '—';
  const displayOwnerPhone =
    submission?.ownerPhone || offlineData?.formData?.ownerPhone || '—';
  const displayAddress = submission
    ? `${submission.address}, ${submission.city}`
    : offlineData?.formData
      ? `${offlineData.formData.address}, ${offlineData.formData.city}`
      : '—';

  const photoCount = submission?.photos?.length || offlinePhotoCount || 0;
  const photosTone: 'accent' | 'warn' = hasPhotos ? 'accent' : 'warn';
  const interviewLabel = hasInterview ? (hasVideoInterview ? 'Video' : 'Audio') : 'Optional';
  const interviewTone: 'accent' | 'neutral' = hasInterview ? 'accent' : 'neutral';

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        {/* Editorial top bar — back chevron + step counter */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity
            onPress={goBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: colors.paper3,
              borderWidth: 1,
              borderColor: colors.rule,
            }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <OfflineBanner />

        {/* Progress bar — full at step 4 */}
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
                backgroundColor: colors.accentSolid,
                borderRadius: radius.pill,
                width: '100%',
              }}
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Editorial header */}
          <View style={{ marginBottom: 18 }}>
            <Label tracking={1.8} color={colors.ink3} style={{ marginBottom: 12 }}>
              REVIEW
            </Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Display size="lg">One last </Display>
              <Display size="lg" italic color={colors.accent}>look.</Display>
            </View>
            <Body size="md" color={colors.ink2} style={{ marginTop: 14, maxWidth: 340 }}>
              Take a final pass through every detail. Once you submit, this business is locked
              for review.
            </Body>
          </View>

          {/* Error banner — mirrors login.tsx */}
          {error ? (
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
              <Body size="sm" color={colors.danger} weight="medium">{error}</Body>
            </View>
          ) : null}

          {/* Offline pending banner */}
          {isOfflinePending && (
            <View
              style={{
                backgroundColor: colors.warnBg,
                borderColor: colors.warn,
                borderWidth: 1,
                borderRadius: radius.sm,
                padding: 14,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <Ionicons name="cloud-offline-outline" size={18} color={colors.warn} style={{ marginTop: 2 }} />
              <Body size="sm" color={colors.warn} weight="medium" style={{ marginLeft: 10, flex: 1 }}>
                Your submission is saved locally. Everything will upload automatically when you're back online.
              </Body>
            </View>
          )}

          {/* Business Info Card */}
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              eyebrow="BUSINESS INFO"
              title={displayBusinessName}
              onEdit={editBusinessInfo}
            />
            <Rule style={{ marginBottom: 16 }} />
            <FieldRow label="TYPE" value={displayBusinessType} />
            <FieldRow label="OWNER" value={displayOwnerName} />
            <FieldRow label="PHONE" value={displayOwnerPhone} />
            <View>
              <Label color={colors.ink3} tracking={1.4}>ADDRESS</Label>
              <Body size="md" color={colors.ink} style={{ marginTop: 4 }}>
                {displayAddress}
              </Body>
            </View>
          </Card>

          {/* Photos Card */}
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              eyebrow="PHOTOS"
              title={`${photoCount} of 3 min`}
              onEdit={editPhotos}
              rightAdornment={<StatusChip label={hasPhotos ? 'Ready' : 'Needs more'} tone={photosTone} />}
            />
            <Rule style={{ marginBottom: 16 }} />

            {/* Online photos from Convex */}
            {photoUrls && photoUrls.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {photoUrls.slice(0, 5).map((url, index) => (
                  <View key={index}>
                    {url && !url.startsWith('convex:') ? (
                      <Image
                        source={{ uri: url }}
                        style={{
                          width: 88,
                          height: 88,
                          borderRadius: radius.sm,
                          backgroundColor: colors.paper2,
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: 88,
                          height: 88,
                          borderRadius: radius.sm,
                          backgroundColor: colors.paper2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ActivityIndicator size="small" color={colors.ink3} />
                      </View>
                    )}
                  </View>
                ))}
                {(submission?.photos?.length || 0) > 5 && (
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: radius.sm,
                      backgroundColor: colors.paper2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.rule,
                    }}
                  >
                    <Body size="md" weight="medium" color={colors.ink2}>
                      +{(submission?.photos?.length || 0) - 5}
                    </Body>
                  </View>
                )}
              </ScrollView>
            ) : offlineData?.pendingPhotos && offlineData.pendingPhotos.photoUris.length > 0 ? (
              /* Offline photo thumbnails from local URIs */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {offlineData.pendingPhotos.photoUris.slice(0, 5).map((uri, index) => (
                  <View key={index}>
                    <Image
                      source={{ uri }}
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: radius.sm,
                        backgroundColor: colors.paper2,
                      }}
                      resizeMode="cover"
                    />
                  </View>
                ))}
                {offlineData.pendingPhotos.photoUris.length > 5 && (
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: radius.sm,
                      backgroundColor: colors.paper2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.rule,
                    }}
                  >
                    <Body size="md" weight="medium" color={colors.ink2}>
                      +{offlineData.pendingPhotos.photoUris.length - 5}
                    </Body>
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Ionicons name="images-outline" size={26} color={colors.ink3} />
                <Body size="sm" color={colors.ink3} style={{ marginTop: 6 }}>
                  No photos uploaded
                </Body>
              </View>
            )}
          </Card>

          {/* Interview Card */}
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              eyebrow="INTERVIEW"
              title={hasInterview ? (hasVideoInterview ? 'Video interview' : 'Audio interview') : 'No interview yet'}
              onEdit={editInterview}
              rightAdornment={<StatusChip label={interviewLabel} tone={interviewTone} />}
            />
            <Rule style={{ marginBottom: 16 }} />

            {/* Video Player for video interviews */}
            {hasVideoInterview && videoUrl && !videoUrl.startsWith('convex:') ? (
              <View>
                <TouchableOpacity
                  onPress={openFullscreenVideo}
                  style={{
                    borderRadius: radius.md,
                    overflow: 'hidden',
                    backgroundColor: colors.ink,
                    height: 200,
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Play video interview fullscreen"
                >
                  <Video
                    ref={videoRef}
                    source={{ uri: videoUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    isMuted={true}
                    isLooping={false}
                    positionMillis={0}
                    onLoad={(status) => {
                      setVideoStatus(status);
                      // Seek to 1 second to show a frame instead of black
                      if (videoRef.current && status.isLoaded) {
                        videoRef.current.setPositionAsync(1000);
                      }
                    }}
                    onPlaybackStatusUpdate={(status) => {
                      if (status.isLoaded) {
                        setVideoStatus(status);
                        setIsVideoPlaying(status.isPlaying);
                      }
                    }}
                  />
                  {/* Play overlay */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                    }}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        borderRadius: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 4 }} />
                    </View>
                  </View>
                  {/* Duration badge */}
                  {videoStatus?.isLoaded && videoStatus?.durationMillis && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 10,
                        right: 10,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: radius.xs,
                      }}
                    >
                      <Text style={{ color: '#fff', fontFamily: fonts.monoMed, fontSize: 11 }}>
                        {formatTime(videoStatus.durationMillis)}
                      </Text>
                    </View>
                  )}
                  {/* Tap to play label */}
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 10,
                      left: 10,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: radius.xs,
                    }}
                  >
                    <Text style={{ color: '#fff', fontFamily: fonts.mono, fontSize: 11 }}>
                      Tap to play
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.accentBg,
                    }}
                  >
                    <Ionicons name="videocam" size={18} color={colors.accentInk} />
                  </View>
                  <Body size="md" color={colors.ink} style={{ marginLeft: 12 }}>
                    Video interview recorded
                  </Body>
                </View>
              </View>
            ) : hasVideoInterview && (!videoUrl || videoUrl.startsWith('convex:')) ? (
              <View>
                <View
                  style={{
                    borderRadius: radius.md,
                    backgroundColor: colors.paper2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 180,
                  }}
                >
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Body size="sm" color={colors.ink3} style={{ marginTop: 10 }}>
                    Loading video…
                  </Body>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.accentBg,
                    }}
                  >
                    <Ionicons name="videocam" size={18} color={colors.accentInk} />
                  </View>
                  <Body size="md" color={colors.ink} style={{ marginLeft: 12 }}>
                    Video interview recorded
                  </Body>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: hasAudioInterview ? colors.accentBg : colors.paper2,
                  }}
                >
                  <Ionicons
                    name={hasAudioInterview ? 'mic' : 'mic-outline'}
                    size={18}
                    color={hasAudioInterview ? colors.accentInk : colors.ink3}
                  />
                </View>
                <Body
                  size="md"
                  color={hasAudioInterview ? colors.ink : colors.ink3}
                  style={{ marginLeft: 12 }}
                >
                  {hasAudioInterview ? 'Audio interview recorded' : 'No interview recorded'}
                </Body>
              </View>
            )}

            {/* Transcription Status */}
            {hasInterview && submission && (
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.rule }}>
                {submission.transcript ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.accentBg,
                      }}
                    >
                      <Ionicons name="checkmark" size={16} color={colors.accentInk} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Body size="sm" weight="medium" color={colors.ink}>
                        Transcription complete
                      </Body>
                    </View>
                  </View>
                ) : submission.transcriptionStatus === 'failed' || submission.transcriptionStatus === 'skipped' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.dangerBg,
                      }}
                    >
                      <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Body size="sm" weight="medium" color={colors.ink}>
                        {submission.transcriptionStatus === 'skipped' ? 'Transcription skipped' : 'Transcription failed'}
                      </Body>
                      <Body size="xs" color={colors.ink3} style={{ marginTop: 2 }} numberOfLines={2}>
                        {submission.transcriptionError || 'An error occurred during transcription'}
                      </Body>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.warnBg,
                      }}
                    >
                      <ActivityIndicator size="small" color={colors.warn} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Body size="sm" weight="medium" color={colors.ink}>
                        Processing transcription…
                      </Body>
                      <Body size="xs" color={colors.ink3} style={{ marginTop: 2 }}>
                        This may take a few moments
                      </Body>
                    </View>
                  </View>
                )}
              </View>
            )}
          </Card>

          {/* Transcript Card — editorial pull-quote */}
          {hasInterview && submission?.transcript && (
            <Card style={{ marginBottom: 16 }}>
              <SectionHeader
                eyebrow="TRANSCRIPT"
                title="In their own words"
              />
              <Rule style={{ marginBottom: 16 }} />
              <View
                style={{
                  backgroundColor: colors.paper2,
                  borderLeftWidth: 3,
                  borderLeftColor: colors.accent,
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  borderRadius: radius.sm,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.serifIt,
                    fontSize: 18,
                    lineHeight: 26,
                    color: colors.ink2,
                  }}
                >
                  “{submission.transcript}”
                </Text>
              </View>
            </Card>
          )}

          {/* Custom Domain (Optional) — auto-derives the tier from whether the input has content */}
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              eyebrow="CUSTOM DOMAIN"
              title="Optional"
              rightAdornment={
                wantsCustomDomain && domainAddOn > 0
                  ? <StatusChip label={`+₱${domainAddOn.toLocaleString()}`} tone="accent" />
                  : null
              }
            />
            <Rule style={{ marginBottom: 16 }} />

            <Body size="sm" color={colors.ink2} style={{ marginBottom: 14 }}>
              Leave blank for a free subdomain. Type a domain to add a custom one —
              you're charged the domain's real registrar price (no markup, no commission).
            </Body>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.paper3,
                borderColor: colors.rule,
                borderWidth: 1,
                borderRadius: radius.sm,
                paddingHorizontal: 14,
                height: 52,
              }}
            >
              <Ionicons name="globe-outline" size={18} color={colors.ink3} />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontFamily: fonts.sans,
                  fontSize: 15,
                  color: colors.ink,
                }}
                placeholder="yourbusiness.com"
                placeholderTextColor={colors.ink3}
                value={domainInput}
                onChangeText={setDomainInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!isOfflinePending}
              />
            </View>

            {/* Live availability feedback — only when input has content */}
            {wantsCustomDomain && (
              <View style={{ marginTop: 12 }}>
                {domainCheckLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.ink3} />
                    <Body size="sm" color={colors.ink3} style={{ marginLeft: 8 }}>
                      Checking availability…
                    </Body>
                  </View>
                ) : domainCheckResult ? (
                  domainCheckResult.error ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="alert-circle" size={14} color={colors.warn} />
                      <Body size="sm" color={colors.warn} style={{ marginLeft: 6 }}>
                        {domainCheckResult.error}
                      </Body>
                    </View>
                  ) : !domainCheckResult.valid ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="alert-circle" size={14} color={colors.warn} />
                      <Body size="sm" color={colors.warn} style={{ marginLeft: 6 }}>
                        {domainCheckResult.reason || 'Invalid format — use something like juansbakery.com'}
                      </Body>
                    </View>
                  ) : domainCheckResult.available && domainCheckResult.withinBudget ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                      <Body size="sm" weight="medium" color={colors.accent} style={{ marginLeft: 6 }}>
                        Available
                      </Body>
                    </View>
                  ) : domainCheckResult.available && !domainCheckResult.withinBudget ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="close-circle" size={14} color={colors.danger} />
                      <Body size="sm" weight="medium" color={colors.danger} style={{ marginLeft: 6 }}>
                        This domain exceeds the budget — try one of the suggestions below
                      </Body>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="close-circle" size={14} color={colors.danger} />
                      <Body size="sm" weight="medium" color={colors.danger} style={{ marginLeft: 6 }}>
                        {domainCheckResult.reason || 'Already taken — try one of the suggestions below'}
                      </Body>
                    </View>
                  )
                ) : null}
              </View>
            )}

            {/* Suggestions list */}
            {wantsCustomDomain &&
              !domainCheckLoading &&
              domainCheckResult?.suggestions &&
              domainCheckResult.suggestions.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Label color={colors.ink3} style={{ marginBottom: 8 }}>
                    SIMILAR DOMAINS
                  </Label>
                  <View
                    style={{
                      backgroundColor: colors.paper2,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: colors.rule,
                      overflow: 'hidden',
                    }}
                  >
                    {domainCheckResult.suggestions.map((s, idx) => (
                      <TouchableOpacity
                        key={s.domain}
                        onPress={() => handleSuggestionTap(s.domain)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          borderTopWidth: idx > 0 ? 1 : 0,
                          borderTopColor: colors.rule,
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${s.domain}`}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                          <Body size="md" color={colors.ink} style={{ marginLeft: 8 }}>
                            {s.domain}
                          </Body>
                        </View>
                        <Body size="sm" color={colors.ink3}>
                          ₱{s.pricePHP}
                        </Body>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

            {/* Year 1 free / Year 2+ disclaimer */}
            {wantsCustomDomain && (
              <View
                style={{
                  backgroundColor: colors.warnBg,
                  borderColor: colors.warn,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  padding: 14,
                  marginTop: 16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Ionicons name="warning" size={16} color={colors.warn} style={{ marginTop: 2 }} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Body size="sm" weight="bold" color={colors.warn} style={{ marginBottom: 4 }}>
                      Year 1 included free
                    </Body>
                    <Body size="sm" color={colors.warn}>
                      Year 2 onwards is approximately ₱1,120/year and is the business owner's
                      responsibility. We do NOT auto-renew. We'll send a reminder 30 days before
                      expiry — if no action is taken, the domain expires.
                    </Body>
                  </View>
                </View>
              </View>
            )}

            {/* Why a custom domain matters */}
            <View
              style={{
                backgroundColor: colors.businessBg,
                borderColor: colors.business,
                borderWidth: 1,
                borderRadius: radius.sm,
                padding: 14,
                marginTop: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Ionicons name="information-circle" size={16} color={colors.business} style={{ marginTop: 2 }} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Body size="sm" weight="bold" color={colors.businessInk} style={{ marginBottom: 4 }}>
                    Why a custom domain matters
                  </Body>
                  <Body size="sm" color={colors.businessInk}>
                    A custom domain (like juansbakery.com) looks more professional, builds trust,
                    and ranks higher on Google. The website goes live on the domain automatically
                    once the business owner pays.
                  </Body>
                </View>
              </View>
            </View>
          </Card>

          {/* ─── Phase 2 — Price slider (creator's pricing decision) ─── */}
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              eyebrow="YOUR PRICE"
              title={isUnlocked ? 'Set the sale' : 'Launch price locked'}
              rightAdornment={
                !isUnlocked && pricingContext
                  ? <StatusChip label={`${approvedCount}/${unlockThreshold}`} tone="warn" />
                  : null
              }
            />
            <Rule style={{ marginBottom: 14 }} />
            {!pricingContext ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : (
              <>
                {!isUnlocked && (
                  <Body size="sm" color={colors.ink2} style={{ marginBottom: 14 }}>
                    Your first {unlockThreshold} submissions are locked at the launch price.
                    You've completed {approvedCount} of {unlockThreshold}. After that, you
                    set the price within ₱{BASE_PRICE.toLocaleString()}–₱{ANCHOR_PRICE.toLocaleString()} —
                    and you keep half of every sale.
                  </Body>
                )}
                <PriceSlider
                  floor={BASE_PRICE}
                  ceiling={isUnlocked ? PRICE_CEILING : BASE_PRICE}
                  anchor={ANCHOR_PRICE}
                  commissionRate={COMMISSION_RATE}
                  initialValue={sellPrice}
                  onChange={setSellPrice}
                />
              </>
            )}
          </Card>

          {/* Total fee — editorial summary */}
          <Card
            style={{
              marginBottom: 16,
              backgroundColor: colors.accentBg,
              borderColor: colors.accent,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Label tracking={1.8} color={colors.accentInk}>
                  BUSINESS PAYS
                </Label>
                <Display size="md" color={colors.accentInk} style={{ marginTop: 6 }}>
                  ₱{totalAmount.toLocaleString()}
                </Display>
                <Body size="sm" color={colors.accentInk} style={{ marginTop: 4 }}>
                  {discountPct > 0
                    ? `${discountPct}% off the ₱${ANCHOR_PRICE.toLocaleString()} marketing price`
                    : 'Full price — no discount applied'}
                </Body>
              </View>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.paper3,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.accent,
                }}
              >
                <Ionicons name="cash-outline" size={20} color={colors.accent} />
              </View>
            </View>

            {/* Breakdown */}
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.accent,
                paddingTop: 12,
                marginTop: 14,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Body size="sm" color={colors.accentInk}>Website</Body>
                <Body size="sm" weight="medium" color={colors.accentInk}>
                  ₱{sellPrice.toLocaleString()}
                </Body>
              </View>
              {wantsCustomDomain && domainAddOn > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Body size="sm" color={colors.accentInk}>
                    Custom domain ({domainInput.trim().toLowerCase()})
                  </Body>
                  <Body size="sm" weight="medium" color={colors.accentInk}>
                    ₱{domainAddOn.toLocaleString()}
                  </Body>
                </View>
              )}
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between',
                marginTop: 6, paddingTop: 8,
                borderTopWidth: 1, borderTopColor: colors.accent,
              }}>
                <Body size="sm" weight="bold" color={colors.accentInk}>
                  You'll earn (paid on owner's payment)
                </Body>
                <Body size="sm" weight="bold" color={colors.accentInk}>
                  ₱{creatorEarnings.toLocaleString()}
                </Body>
              </View>
            </View>
          </Card>

          {/* Bottom spacer so content clears the sticky Door */}
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Submit footer */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 16,
            backgroundColor: colors.paper,
            borderTopWidth: 1,
            borderTopColor: colors.rule,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <Door
            variant={!isConnected && canSubmit ? 'solid' : 'accent'}
            caption={loading ? 'SENDING' : !isConnected && canSubmit ? 'QUEUE' : 'SUBMIT'}
            label={
              loading
                ? 'Submitting…'
                : !isConnected && canSubmit
                  ? 'Save & submit when online'
                  : 'Send for review'
            }
            loading={loading}
            disabled={loading || !canSubmit}
            onPress={!isConnected ? handleQueueSubmit : handleSubmit}
            rightIcon={
              loading ? (
                <ActivityIndicator color="#fff" />
              ) : !isConnected && canSubmit ? (
                <Ionicons name="cloud-upload-outline" size={18} color={colors.paper3} style={{ marginLeft: 12 }} />
              ) : undefined
            }
          />
          {!canSubmit && !hasPhotos && (
            <Body size="sm" color={colors.warn} style={{ textAlign: 'center', marginTop: 10 }}>
              Please upload at least 3 photos to submit.
            </Body>
          )}
          {!canSubmit && hasPhotos && domainBlocksSubmit && (
            <Body size="sm" color={colors.warn} style={{ textAlign: 'center', marginTop: 10 }}>
              {domainCheckLoading
                ? 'Checking domain availability…'
                : 'Pick an available domain from the suggestions, or clear the field to submit without one.'}
            </Body>
          )}
          {!isConnected && canSubmit && (
            <Body size="sm" color={colors.warn} style={{ textAlign: 'center', marginTop: 10 }}>
              Your draft will be saved and automatically submitted when you reconnect.
            </Body>
          )}
        </View>
      </SafeAreaView>

      {/* Fullscreen Video Modal */}
      <Modal
        visible={showFullscreenVideo}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={closeFullscreenVideo}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Close Button */}
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
              <TouchableOpacity
                onPress={closeFullscreenVideo}
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityRole="button"
                accessibilityLabel="Close video"
              >
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Loading indicator */}
          {isVideoLoading && !videoError && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ color: '#fff', marginTop: 14, fontFamily: fonts.sans, fontSize: 14 }}>
                Loading video…
              </Text>
            </View>
          )}

          {/* Error state */}
          {videoError && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
              <Text style={{ color: '#fff', textAlign: 'center', marginTop: 14, fontFamily: fonts.sans, fontSize: 15 }}>
                {videoError}
              </Text>
              <TouchableOpacity
                onPress={closeFullscreenVideo}
                style={{
                  marginTop: 20,
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
              >
                <Text style={{ color: '#fff', fontFamily: fonts.sansMed, fontSize: 15 }}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Video Player */}
          {showFullscreenVideo && videoUrl && !videoUrl.startsWith('convex:') && !videoError && (
            <Video
              ref={fullscreenVideoRef}
              source={{ uri: videoUrl }}
              style={{ flex: 1 }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={true}
              isLooping={false}
              useNativeControls={true}
              progressUpdateIntervalMillis={500}
              onLoad={() => {
                setIsVideoLoading(false);
              }}
              onError={(error) => {
                console.error('Video playback error:', error);
                setIsVideoLoading(false);
                setVideoError('Failed to play video. The video may be too large or corrupted.');
              }}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded && status.didJustFinish) {
                  // Video finished playing
                }
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
