import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  BackHandler,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import type { Id } from '@tendso/convex-client';
import { colors, fonts, radius, space, shadow } from '../../../theme/tokens';
import { Display, Body, Label, Door, Card, Rule, LiveDot } from '../../../components/ui/primitives';

export default function SubmitSuccessScreen() {
  const router = useRouter();
  const { queued } = useLocalSearchParams<{ queued?: string }>();
  const isQueued = queued === 'true';
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Load submission ID — only clear it if NOT queued (offline sync still needs it)
  useEffect(() => {
    const loadSubmissionId = async () => {
      const id = await AsyncStorage.getItem('current_submission_id');
      if (id) {
        setSubmissionId(id);
        if (!isQueued) {
          await AsyncStorage.removeItem('current_submission_id');
        }
      }
    };
    loadSubmissionId();
  }, [isQueued]);

  // Intercept back button to go to dashboard instead of back through submit flow
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/(app)/dashboard');
        return true; // Prevent default back behavior
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        subscription.remove();
      };
    }, [router])
  );

  // Query the submission to check transcription status (skip for queued/offline_pending)
  const canQuery = submissionId && submissionId !== 'offline_pending' && !isQueued;
  const submission = useQuery(
    api.submissions.getById,
    canQuery ? { id: submissionId as Id<'submissions'> } : 'skip'
  );

  const hasInterview = submission?.videoStorageId || submission?.audioStorageId;
  const hasTranscription = !!submission?.transcript;
  const transcriptionFailed = submission?.transcriptionStatus === 'failed' || submission?.transcriptionStatus === 'skipped';
  const isProcessing = hasInterview && !hasTranscription && !transcriptionFailed;
  const requestedDomain = (submission as any)?.requestedDomain as string | undefined;
  const businessName = (submission as any)?.businessName as string | undefined;

  // Short submission tag (last 6 chars, uppercase) for editorial reference
  const shortTag = submissionId && submissionId !== 'offline_pending'
    ? submissionId.slice(-6).toUpperCase()
    : 'OFFLINE';

  // ── Queued (offline) success state ──
  if (isQueued) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 28,
            paddingTop: space.xl,
            paddingBottom: space.xl,
            justifyContent: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Eyebrow */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: space.lg }}>
            <LiveDot size={6} color={colors.warn} />
            <Label tracking={1.8} color={colors.warn}>QUEUED · OFFLINE</Label>
          </View>

          {/* Hero icon */}
          <View style={{ alignItems: 'center', marginBottom: space.lg }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: colors.warnBg,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.rule,
              }}
            >
              <Ionicons name="cloud-upload-outline" size={40} color={colors.warn} />
            </View>
          </View>

          {/* Editorial headline */}
          <View style={{ alignItems: 'center', marginBottom: space.md }}>
            <Display size="lg">Saved</Display>
            <Display size="lg" italic color={colors.accent}>on paper.</Display>
          </View>

          <Body
            size="md"
            color={colors.ink2}
            style={{ textAlign: 'center', marginBottom: space.lg, paddingHorizontal: 4 }}
          >
            Your submission is tucked safely on your device. The moment you reconnect, it
            will upload automatically and head to our admin team for review.
          </Body>

          {/* Info card */}
          <Card style={{ marginBottom: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="information-circle-outline" size={16} color={colors.ink3} />
              <Label tracking={1.6}>WHEN YOU&apos;RE BACK ONLINE</Label>
            </View>
            <Rule style={{ marginBottom: 10 }} />
            <View style={{ gap: 8 }}>
              <Body size="sm" color={colors.ink2}>
                <Text style={{ fontFamily: fonts.mono, color: colors.ink3 }}>01  </Text>
                Business info, photos, and interview upload automatically.
              </Body>
              <Body size="sm" color={colors.ink2}>
                <Text style={{ fontFamily: fonts.mono, color: colors.ink3 }}>02  </Text>
                Your submission is sent to the admin queue for review.
              </Body>
              <Body size="sm" color={colors.ink2}>
                <Text style={{ fontFamily: fonts.mono, color: colors.ink3 }}>03  </Text>
                You receive a notification confirming the sync.
              </Body>
            </View>
          </Card>

          {/* Doors */}
          <View style={{ gap: 10 }}>
            <Door
              caption="HOME"
              label="Back to dashboard"
              variant="solid"
              onPress={() => router.replace('/(app)/dashboard')}
              accessibilityLabel="Back to dashboard"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Normal (online) success state ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 28,
          paddingTop: space.xl,
          paddingBottom: space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Mono eyebrow */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: space.lg }}>
          <Label tracking={1.8} color={colors.live}>● SUBMITTED</Label>
        </View>

        {/* Hero checkmark — accent emerald in paper3 circle */}
        <View style={{ alignItems: 'center', marginBottom: space.lg }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: colors.accentBg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.rule,
              ...shadow.soft,
            }}
          >
            <Ionicons name="checkmark" size={44} color={colors.accent} />
          </View>
        </View>

        {/* Editorial headline */}
        <View style={{ alignItems: 'center', marginBottom: space.md }}>
          <Display size="lg">You&apos;re</Display>
          <Display size="lg" italic color={colors.accent}>in motion.</Display>
        </View>

        <Body
          size="md"
          color={colors.ink2}
          style={{ textAlign: 'center', marginBottom: space.lg, paddingHorizontal: 4 }}
        >
          Our admin team will review your submission within 24 hours. We&apos;ll send you a
          notification the moment your business is verified.
        </Body>

        {/* Submission detail Card — paper3 with rule */}
        <Card style={{ marginBottom: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Label tracking={1.6}>SUBMISSION</Label>
            <Label tracking={1.6} color={colors.ink3}>#{shortTag}</Label>
          </View>
          <Rule style={{ marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <Display size="sm" color={colors.ink}>
              {businessName || 'Business'}
            </Display>
          </View>
          <Body size="sm" color={colors.ink3} style={{ marginTop: 6 }}>
            Submitted just now · Awaiting verification.
          </Body>
        </Card>

        {/* Custom Domain Status Card — only when creator picked the with_custom_domain tier */}
        {requestedDomain && (
          <Card style={{ marginBottom: space.md, backgroundColor: colors.businessBg, borderColor: colors.business }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="globe-outline" size={16} color={colors.business} />
              <Label tracking={1.6} color={colors.business}>CUSTOM DOMAIN</Label>
            </View>
            <Body size="sm" weight="bold" color={colors.businessInk}>
              {requestedDomain} — coming soon.
            </Body>
            <Body size="sm" color={colors.businessInk} style={{ marginTop: 6 }}>
              Once the business owner pays, the domain will be automatically registered and
              connected to the website. This usually takes 2-6 minutes.
            </Body>
            <Body size="xs" weight="medium" color={colors.business} style={{ marginTop: 8 }}>
              You&apos;ll get a notification when it&apos;s live.
            </Body>
          </Card>
        )}

        {/* Transcription Status Card */}
        {hasInterview && (
          <Card
            style={{
              marginBottom: space.md,
              backgroundColor: hasTranscription
                ? colors.accentBg
                : transcriptionFailed
                ? colors.dangerBg
                : colors.warnBg,
              borderColor: hasTranscription
                ? colors.accent
                : transcriptionFailed
                ? colors.danger
                : colors.warn,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {hasTranscription ? (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Label tracking={1.4} color={colors.accentInk}>TRANSCRIPTION COMPLETE</Label>
                    <Body size="xs" color={colors.accentInk} style={{ marginTop: 2 }}>
                      Your interview has been transcribed successfully.
                    </Body>
                  </View>
                </>
              ) : transcriptionFailed ? (
                <>
                  <Ionicons name="alert-circle" size={20} color={colors.danger} />
                  <View style={{ flex: 1 }}>
                    <Label tracking={1.4} color={colors.danger}>
                      {submission?.transcriptionStatus === 'skipped' ? 'TRANSCRIPTION SKIPPED' : 'TRANSCRIPTION FAILED'}
                    </Label>
                    <Body size="xs" color={colors.danger} style={{ marginTop: 2 }}>
                      {submission?.transcriptionError || 'Your submission is still valid and will be reviewed.'}
                    </Body>
                  </View>
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color={colors.warn} />
                  <View style={{ flex: 1 }}>
                    <Label tracking={1.4} color={colors.warn}>PROCESSING TRANSCRIPTION</Label>
                    <Body size="xs" color={colors.warn} style={{ marginTop: 2 }}>
                      Your interview is being transcribed. This may take a moment.
                    </Body>
                  </View>
                </>
              )}
            </View>
          </Card>
        )}

        {/* Actions — inline, no pinned CTA bar */}
        <View style={{ gap: 10, marginTop: space.sm }}>
          <Door
            caption="HOME"
            label="Back to dashboard"
            variant="solid"
            onPress={() => router.replace('/(app)/dashboard')}
            accessibilityLabel="Back to dashboard"
          />
          <Door
            caption="ANOTHER"
            label="Submit another business"
            variant="ghost"
            onPress={() => router.push('/(app)/submit/info' as any)}
            accessibilityLabel="Submit another business"
          />
        </View>

        {/* Bottom brand mark — Google Sans Flex wordmark */}
        <View style={{ marginTop: space.xl, alignItems: 'center', opacity: 0.5 }}>
          <Body
            size="xs"
            color={colors.ink3}
            style={{ fontFamily: fonts.wordmarkMed, letterSpacing: 2.4, textTransform: 'uppercase' }}
          >
            Tendso
          </Body>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
