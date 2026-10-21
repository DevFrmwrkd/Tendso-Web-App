import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useLocalSearchParams } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Id } from '@tendso/convex-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, Video, ResizeMode } from 'expo-av';
import { openExternalUrl } from '../../../services/links';
import { colors, radius, shadow, space } from '../../../theme/v2';
import {
  Avatar,
  Banner,
  Button,
  Card,
  CheckRow,
  Chip,
  EmptyState,
  Loading,
  ScreenShell,
  SectionLabel,
  Text,
  formatPeso,
  shortDate,
  submissionStatus,
  type CheckState,
} from '../../../components/v2';
import type { ChipTone } from '../../../components/v2';

/** How far a submission has got, in the order the backend moves it. */
const STAGE_RANK: Record<string, number> = {
  draft: 0,
  pending: 1,
  submitted: 1,
  in_review: 1,
  approved: 2,
  website_generated: 3,
  deployed: 4,
  pending_payment: 5,
  paid: 6,
  completed: 6,
  unpublished: 3, // taken down: it was built, but it is no longer public
};

const WEBSITE_ROW_STATUSES = ['deployed', 'pending_payment', 'paid', 'completed', 'website_generated'];

type DomainStatus =
  | 'not_requested'
  | 'pending_payment'
  | 'registering'
  | 'configuring_dns'
  | 'provisioning_ssl'
  | 'live'
  | 'failed';

export default function SubmissionDetailScreen() {
  const router = useGuardedRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: windowWidth } = useWindowDimensions();

  const submission = useQuery(
    api.submissions.getByIdWithCreator,
    id ? { id: id as Id<'submissions'> } : 'skip'
  );

  // Preserve the legacy response's URL preference while using canonical types.
  const legacyDeployedUrl = submission && 'deployedUrl' in submission &&
    typeof submission.deployedUrl === 'string' ? submission.deployedUrl : undefined;
  const liveWebsiteUrl = legacyDeployedUrl || submission?.websiteUrl;

  const photoUrls = useQuery(
    api.files.getMultipleUrls,
    submission?.photos && submission.photos.length > 0
      ? { storageIds: submission.photos }
      : 'skip'
  );

  // Use presigned S3 URLs for media streaming (r2.dev public URLs don't support range requests)
  const videoStreamUrl = useQuery(
    api.r2.getStreamableUrl,
    submission?.videoStorageId
      ? { fileKey: submission.videoStorageId }
      : 'skip'
  );

  const audioStreamUrl = useQuery(
    api.r2.getStreamableUrl,
    submission?.audioStorageId && !submission?.videoStorageId
      ? { fileKey: submission.audioStorageId }
      : 'skip'
  );

  // Video player state
  const videoRef = useRef<Video>(null);
  const fullscreenVideoRef = useRef<Video>(null);
  const [videoStatus, setVideoStatus] = useState<any>(null);
  const [showFullscreenVideo, setShowFullscreenVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  // Audio player state
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const [showTranscript, setShowTranscript] = useState(false);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioSound) {
        audioSound.unloadAsync();
      }
    };
  }, [audioSound]);

  // Audio playback
  const handleAudioPress = async () => {
    if (!audioStreamUrl) return;

    // If already loaded, toggle play/pause
    if (audioSound) {
      try {
        const status = await audioSound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await audioSound.pauseAsync();
            setIsAudioPlaying(false);
          } else {
            await audioSound.playAsync();
            setIsAudioPlaying(true);
          }
          return;
        }
      } catch {}
    }

    // Load and play from presigned URL
    try {
      setIsAudioLoading(true);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioStreamUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        (status) => {
          if (status.isLoaded) {
            setIsAudioPlaying(status.isPlaying);
            setAudioPosition(status.positionMillis || 0);
            setAudioDuration(status.durationMillis || 0);
            if (status.didJustFinish) {
              setIsAudioPlaying(false);
              setAudioPosition(0);
            }
          }
        }
      );

      setAudioSound(sound);
      setIsAudioPlaying(true);
    } catch (err) {
      console.error('Audio playback error:', err);
    } finally {
      setIsAudioLoading(false);
    }
  };

  // Video fullscreen handlers
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

  if (submission === undefined) {
    return <Loading />;
  }

  if (!submission) {
    return (
      <ScreenShell onBack={() => router.back()} contentStyle={styles.centerBody}>
        <EmptyState
          icon="alert-circle-outline"
          title="Shop not found"
          body="It may have been deleted."
        />
      </ScreenShell>
    );
  }

  const isIncomplete =
    !submission.photos ||
    submission.photos.length === 0 ||
    (!submission.videoStorageId && !submission.audioStorageId);
  const isDraft = submission.status === 'draft' || isIncomplete;

  // Approved and rejected win over "draft" (same order the badge always used).
  const showDraft = isDraft && submission.status !== 'approved' && submission.status !== 'rejected';
  const badge = submissionStatus(submission.status, showDraft);

  const hasVideo = !!submission.videoStorageId;
  const hasAudio = !!submission.audioStorageId && !hasVideo;

  const sub = submission as any;
  const isRejected = submission.status === 'rejected';
  const rank = STAGE_RANK[submission.status] ?? 1;
  const photoCount = submission.photos?.length || 0;
  const payoutText = submission.creatorPayout ? formatPeso(submission.creatorPayout) : '--';
  const isPaid = submission.status === 'paid' || submission.status === 'completed';
  const showWebsiteRow = WEBSITE_ROW_STATUSES.includes(submission.status) && !!liveWebsiteUrl;
  const heroUrl = photoUrls?.[0] && !photoUrls[0].startsWith('convex:') ? photoUrls[0] : null;

  // ---- Status timeline, built from the real fields ----
  const submittedDone = submission.status !== 'draft';
  const approvedDone = !isRejected && rank >= 2;
  const readyDone = !isRejected && rank >= 3;
  const liveDone = !isRejected && rank >= 4;
  const paidDone = !isRejected && rank >= 6;

  const mediaWord = hasVideo ? 'video interview' : hasAudio ? 'audio interview' : 'no interview';
  const steps: { key: string; title: string; subtitle: string; done: boolean; bad?: boolean }[] = [
    {
      key: 'submitted',
      title: 'Submitted',
      subtitle: submittedDone
        ? `${shortDate(submission._creationTime)} · ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}, ${mediaWord}`
        : 'Add photos and the interview',
      done: submittedDone,
    },
    {
      key: 'approved',
      title: 'Approved',
      subtitle: isRejected
        ? 'Not approved'
        : approvedDone
          ? `${submission.reviewedAt ? `${shortDate(submission.reviewedAt)} · ` : ''}by the Tendso team`
          : 'The Tendso team checks it',
      done: approvedDone,
      bad: isRejected,
    },
    {
      key: 'ready',
      title: 'Website ready',
      subtitle: readyDone ? 'The owner sees it first' : 'About 20 minutes after approval',
      done: readyDone,
    },
    {
      key: 'live',
      title: 'Live',
      subtitle: liveDone ? (liveWebsiteUrl ?? 'The site is public') : 'Goes public when it is ready',
      done: liveDone,
    },
    {
      key: 'paid',
      title: 'Paid',
      subtitle: paidDone
        ? `${submission.paidAt ? `${shortDate(submission.paidAt)} · ` : ''}${submission.creatorPayout ? `you kept ${formatPeso(submission.creatorPayout)}` : 'you kept half'}`
        : 'The owner pays, you keep half',
      done: paidDone,
    },
  ];
  const firstOpen = !isRejected && submittedDone ? steps.findIndex((s) => !s.done) : -1;
  const stepState = (s: (typeof steps)[number], i: number): CheckState =>
    s.bad ? 'bad' : s.done ? 'ok' : i === firstOpen ? 'now' : 'todo';

  // ---- Per-status note ----
  let note: { tone: 'info' | 'ok' | 'warn' | 'danger' | 'neutral'; title: string; body: string } | null = null;
  if (isRejected) {
    note = { tone: 'danger', title: 'Not approved', body: submission.rejectionReason || 'Please check the photos and the interview.' };
  } else if (submission.status === 'submitted' || submission.status === 'in_review') {
    note = { tone: 'info', title: 'In review', body: 'The site is ready about 20 minutes after review. The owner sees it first, then pays.' };
  } else if (submission.status === 'approved') {
    note = { tone: 'info', title: 'Building the site', body: 'About 20 minutes. The owner sees it first, then pays.' };
  } else if (submission.status === 'website_generated' || submission.status === 'deployed') {
    note = { tone: 'ok', title: 'The site is ready', body: 'Show it to the owner. They say yes, then pay. You keep half.' };
  } else if (submission.status === 'pending_payment') {
    note = { tone: 'warn', title: 'Waiting for the owner to pay', body: "You keep half the price. If they don't pay, the site comes down." };
  } else if (isPaid) {
    note = { tone: 'ok', title: 'Paid', body: 'The owner paid. You kept half of the price.' };
  } else if (submission.status === 'unpublished') {
    note = { tone: 'warn', title: 'Site taken down', body: "The owner hasn't paid yet." };
  } else if (showDraft) {
    note = { tone: 'neutral', title: 'Not sent yet', body: 'Add the photos and the interview to send it.' };
  }

  const tile = Math.floor((windowWidth - space.gutter * 2 - space.sm * 2) / 3);

  const callOwner = () => {
    const phone = (submission.ownerPhone || '').replace(/\s+/g, '');
    if (phone) void Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <>
      <ScreenShell
        title={submission.businessName}
        onBack={() => router.back()}
        footer={
          isDraft ? (
            <Button
              title="Continue submission"
              onPress={async () => {
                await AsyncStorage.setItem('current_submission_id', submission._id);
                const route = !submission.photos || submission.photos.length === 0
                  ? '/(app)/submit/photos'
                  : !submission.videoStorageId && !submission.audioStorageId
                  ? '/(app)/submit/interview'
                  : '/(app)/submit/review';
                router.push(route as any);
              }}
            />
          ) : undefined
        }
        contentStyle={styles.body}
      >
        <Chip label={badge.label} tone={badge.tone} style={styles.statusChip} />

        {heroUrl ? (
          <Image source={{ uri: heroUrl }} style={styles.hero} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : null}

        {note ? <Banner tone={note.tone} title={note.title} body={note.body} /> : null}

        {/* Website link */}
        {showWebsiteRow ? (
          <Card
            onPress={() => {
              void openExternalUrl(liveWebsiteUrl as string);
            }}
            accessibilityLabel="Open the website"
            style={styles.linkCard}
          >
            <View style={styles.linkText}>
              <Text variant="label" weight="bold" tone="muted">
                Website
              </Text>
              <Text variant="bodyLg" weight="bold" numberOfLines={1}>
                {liveWebsiteUrl}
              </Text>
            </View>
            <View style={styles.openPill}>
              <Ionicons name="open-outline" size={18} color={colors.onAccent} />
              <Text variant="chip" tone="onAccent">
                Open
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Owner */}
        <Card style={styles.ownerCard}>
          <View style={styles.ownerTop}>
            <Avatar name={submission.ownerName} size={48} />
            <View style={styles.ownerText}>
              <Text variant="bodyLg" weight="bold" numberOfLines={1}>
                {submission.ownerName}
              </Text>
              <Text variant="label" weight="medium" tone="muted" numberOfLines={1}>
                Owner · {submission.ownerPhone}
              </Text>
            </View>
            <Pressable
              onPress={callOwner}
              accessibilityRole="button"
              accessibilityLabel={`Call ${submission.ownerName}`}
              style={styles.callBtn}
            >
              <Ionicons name="call" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <Text variant="label" weight="medium" tone="muted">
            {submission.businessType} · {submission.address}, {submission.city}
          </Text>
        </Card>

        {/* Custom domain: only when one was requested */}
        {sub.requestedDomain
          ? (() => {
              const domainStatus = sub.domainStatus as DomainStatus | undefined;
              const requestedDomain = sub.requestedDomain as string;
              const failureReason = sub.domainFailureReason as string | undefined;

              const statusMeta: Record<string, { tone: ChipTone; label: string; description: string }> = {
                pending_payment: {
                  tone: 'warn',
                  label: 'Waiting for the owner to pay',
                  description: 'Setup starts once your client pays.',
                },
                registering: { tone: 'info', label: 'Registering domain', description: 'Reserving it with the registrar.' },
                configuring_dns: { tone: 'info', label: 'Connecting domain', description: 'Pointing it to the site.' },
                provisioning_ssl: { tone: 'info', label: 'Securing with HTTPS', description: 'Almost done.' },
                live: { tone: 'ok', label: 'Live', description: 'The domain now shows the website.' },
                failed: { tone: 'danger', label: 'Setup failed', description: failureReason || 'Something went wrong during setup.' },
              };
              const meta = statusMeta[domainStatus || 'pending_payment'];

              const inner = (
                <>
                  <View style={styles.domainTop}>
                    <View style={styles.domainText}>
                      <Text variant="label" weight="bold" tone="muted">
                        Custom domain
                      </Text>
                      <Text variant="bodyLg" weight="bold" numberOfLines={1}>
                        {requestedDomain}
                      </Text>
                    </View>
                    {domainStatus === 'live' ? (
                      <View style={styles.openPill}>
                        <Ionicons name="open-outline" size={18} color={colors.onAccent} />
                        <Text variant="chip" tone="onAccent">
                          Open
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Chip label={meta.label} tone={meta.tone} />
                  <Text variant="label" weight="medium" tone="muted">
                    {meta.description}
                  </Text>
                </>
              );

              return domainStatus === 'live' ? (
                <Card
                  onPress={() => {
                    void openExternalUrl(requestedDomain);
                  }}
                  accessibilityLabel={`Open ${requestedDomain}`}
                  style={styles.domainCard}
                >
                  {inner}
                </Card>
              ) : (
                <Card style={styles.domainCard}>{inner}</Card>
              );
            })()
          : null}

        {/* Status timeline */}
        <SectionLabel style={styles.sectionGap}>Status</SectionLabel>
        <View style={styles.timeline}>
          {steps.map((s, i) => (
            <CheckRow key={s.key} title={s.title} subtitle={s.subtitle} state={stepState(s, i)} />
          ))}
        </View>

        {/* Earnings */}
        <SectionLabel style={styles.sectionGap}>Your earnings</SectionLabel>
        <Card style={styles.earnCard}>
          <View style={styles.earnText}>
            <Text variant="label" weight="semibold" tone="muted">
              {isPaid ? 'Paid' : isDraft ? 'Expected' : 'When the owner pays'}
            </Text>
            <Text variant="title" tone={submission.creatorPayout ? 'ink' : 'muted'}>
              {payoutText}
            </Text>
            {submission.creatorPayout && !isDraft ? (
              <Text variant="label" weight="medium" tone="muted">
                Half of the price · domain not included
              </Text>
            ) : null}
            {isDraft && !submission.creatorPayout ? (
              <Text variant="label" weight="medium" tone="muted">
                Set your price on the review screen.
              </Text>
            ) : null}
          </View>
          <View style={styles.earnIcon}>
            <Ionicons name="cash-outline" size={26} color={colors.onAccent} />
          </View>
        </Card>

        {/* Interview */}
        <SectionLabel style={styles.sectionGap}>Interview</SectionLabel>
        {submission.videoStorageId || submission.audioStorageId ? (
          <View style={styles.interview}>
            {/* Inline video player */}
            {hasVideo && videoStreamUrl ? (
              <View style={styles.videoWrap}>
                {/* Inline preview: tap opens fullscreen */}
                <Pressable
                  onPress={openFullscreenVideo}
                  accessibilityRole="button"
                  accessibilityLabel="Play the video interview full screen"
                  style={styles.videoBox}
                >
                  <Video
                    ref={videoRef}
                    source={{ uri: videoStreamUrl }}
                    style={styles.videoFill}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    isMuted={true}
                    isLooping={false}
                    onLoad={(status) => {
                      setVideoStatus(status);
                      if (videoRef.current && status.isLoaded) {
                        videoRef.current.setPositionAsync(1000);
                      }
                    }}
                    onPlaybackStatusUpdate={(status) => {
                      if (status.isLoaded) {
                        setVideoStatus(status);
                      }
                    }}
                  />
                  {/* Play overlay */}
                  <View style={styles.playOverlay}>
                    <View style={styles.playBtn}>
                      <Ionicons name="play" size={32} color={colors.onAccent} style={styles.playIcon} />
                    </View>
                  </View>
                  {videoStatus?.isLoaded && videoStatus?.durationMillis ? (
                    <View style={[styles.badge, styles.badgeRight]}>
                      <Text variant="label" tone="onDark" weight="semibold">
                        {formatTime(videoStatus.durationMillis)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.badge, styles.badgeLeft]}>
                    <Text variant="label" tone="onDark" weight="semibold">
                      Tap to play
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : hasVideo && !videoStreamUrl ? (
              <View style={[styles.videoBox, styles.videoLoading]}>
                <ActivityIndicator size="large" color={colors.onDark} />
                <Text variant="label" tone="onDark">
                  Loading video...
                </Text>
              </View>
            ) : null}

            {/* Audio player */}
            {hasAudio ? (
              <Pressable
                onPress={handleAudioPress}
                disabled={isAudioLoading || !audioStreamUrl}
                accessibilityRole="button"
                accessibilityLabel={isAudioPlaying ? 'Pause the audio interview' : 'Play the audio interview'}
                accessibilityState={{ disabled: isAudioLoading || !audioStreamUrl }}
                style={[styles.audioRow, shadow.soft, isAudioPlaying ? styles.audioRowOn : null]}
              >
                <View style={[styles.audioBtn, isAudioPlaying ? styles.audioBtnOn : null]}>
                  {isAudioLoading ? (
                    <ActivityIndicator size="small" color={isAudioPlaying ? colors.onDark : colors.onAccent} />
                  ) : (
                    <Ionicons
                      name={isAudioPlaying ? 'pause' : 'play'}
                      size={26}
                      color={isAudioPlaying ? colors.onDark : colors.onAccent}
                    />
                  )}
                </View>
                <View style={styles.audioText}>
                  <Text variant="bodyLg" weight="bold">
                    Audio interview
                  </Text>
                  <Text variant="label" weight="medium" tone="muted">
                    {isAudioLoading
                      ? 'Loading...'
                      : isAudioPlaying
                        ? `Playing ${formatTime(audioPosition)} / ${formatTime(audioDuration)}`
                        : audioStreamUrl
                          ? 'Tap to play'
                          : 'Loading audio...'}
                  </Text>
                </View>
                <Ionicons name="musical-notes" size={22} color={colors.ink3} />
              </Pressable>
            ) : null}

            {/* Transcription */}
            {submission.transcript ? (
              <View>
                <Pressable
                  onPress={() => setShowTranscript(!showTranscript)}
                  accessibilityRole="button"
                  accessibilityLabel={showTranscript ? 'Hide the transcription' : 'Show the transcription'}
                  accessibilityState={{ expanded: showTranscript }}
                  style={styles.transcriptHead}
                >
                  <Ionicons name="document-text-outline" size={22} color={colors.ink} />
                  <Text variant="body" weight="semibold" style={styles.flex}>
                    Transcription
                  </Text>
                  <Ionicons name={showTranscript ? 'chevron-up' : 'chevron-down'} size={22} color={colors.ink3} />
                </Pressable>
                {showTranscript ? (
                  <Card style={styles.transcriptBody}>
                    <Text variant="body" tone="ink2">
                      {submission.transcript}
                    </Text>
                  </Card>
                ) : null}
              </View>
            ) : submission.transcriptionStatus === 'processing' ? (
              <View style={styles.inlineNote}>
                <ActivityIndicator size="small" color={colors.ink} />
                <Text variant="label" weight="medium" tone="muted">
                  Writing the transcription...
                </Text>
              </View>
            ) : submission.transcriptionStatus === 'failed' || submission.transcriptionStatus === 'skipped' ? (
              <View style={styles.inlineNote}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.warn} />
                <Text variant="label" weight="medium" tone="muted" style={styles.flex}>
                  {submission.transcriptionError || 'Transcription unavailable'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="mic-off-outline" size={32} color={colors.ink3} />
            <Text variant="label" weight="medium" tone="muted">
              No interview uploaded
            </Text>
          </Card>
        )}

        {/* Photos */}
        <SectionLabel style={styles.sectionGap}>{`Photos · ${photoCount}`}</SectionLabel>
        {photoUrls && photoUrls.length > 0 ? (
          <View style={styles.grid}>
            {photoUrls.map((url, index) =>
              url && !url.startsWith('convex:') ? (
                <Image
                  key={index}
                  source={{ uri: url }}
                  style={[styles.photo, { width: tile, height: tile }]}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View key={index} style={[styles.photo, styles.photoLoading, { width: tile, height: tile }]}>
                  <ActivityIndicator size="small" color={colors.ink3} />
                </View>
              )
            )}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="images-outline" size={32} color={colors.ink3} />
            <Text variant="label" weight="medium" tone="muted">
              No photos uploaded
            </Text>
          </Card>
        )}
      </ScreenShell>

      {/* Fullscreen video modal */}
      <Modal
        visible={showFullscreenVideo}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={closeFullscreenVideo}
      >
        <View style={styles.modalRoot}>
          {/* Close button */}
          <SafeAreaView style={styles.modalTop}>
            <View style={styles.modalTopRow}>
              <Pressable
                onPress={closeFullscreenVideo}
                accessibilityRole="button"
                accessibilityLabel="Close video"
                style={styles.modalClose}
              >
                <Ionicons name="close" size={28} color={colors.onDark} />
              </Pressable>
            </View>
          </SafeAreaView>

          {/* Loading indicator */}
          {isVideoLoading && !videoError ? (
            <View style={styles.modalCenter}>
              <ActivityIndicator size="large" color={colors.onDark} />
              <Text variant="body" tone="onDark" style={styles.modalGap}>
                Loading video...
              </Text>
            </View>
          ) : null}

          {/* Error state */}
          {videoError ? (
            <View style={[styles.modalCenter, styles.modalPad]}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.onDark} />
              <Text variant="bodyLg" tone="onDark" align="center" style={styles.modalGap}>
                {videoError}
              </Text>
              <Button title="Close" variant="ghost" size="md" fullWidth={false} onPress={closeFullscreenVideo} style={styles.modalGap} />
            </View>
          ) : null}

          {/* Fullscreen video player */}
          {showFullscreenVideo && videoStreamUrl && !videoError ? (
            <Video
              ref={fullscreenVideoRef}
              source={{ uri: videoStreamUrl }}
              style={styles.flex}
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
                setVideoError('Failed to play video. Please check your connection and try again.');
              }}
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerBody: { flexGrow: 1, justifyContent: 'center' },
  body: { gap: space.md, paddingTop: space.lg },
  statusChip: { marginTop: -space.sm },
  hero: { width: '100%', height: 160, borderRadius: radius.cardLg, backgroundColor: colors.bg2 },
  sectionGap: { marginTop: space.sm },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  linkText: { flex: 1, gap: 2 },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  ownerCard: { gap: space.md },
  ownerTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ownerText: { flex: 1, gap: 2 },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainCard: { gap: space.sm, alignItems: 'flex-start' },
  domainTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
  domainText: { flex: 1, gap: 2 },
  timeline: { gap: space.sm },
  earnCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  earnText: { flex: 1, gap: 2 },
  earnIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interview: { gap: space.md },
  videoWrap: { gap: space.sm },
  videoBox: { height: 200, borderRadius: radius.cardLg, overflow: 'hidden', backgroundColor: colors.ink },
  videoFill: { width: '100%', height: '100%' },
  videoLoading: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,10,8,0.2)',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { marginLeft: 4 },
  badge: {
    position: 'absolute',
    bottom: space.sm,
    backgroundColor: colors.scrim,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  badgeLeft: { left: space.sm },
  badgeRight: { right: space.sm },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 72,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  audioRowOn: { borderColor: colors.ink },
  audioBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBtnOn: { backgroundColor: colors.ink },
  audioText: { flex: 1, gap: 2 },
  transcriptHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  transcriptBody: { marginTop: space.xs },
  inlineNote: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  emptyCard: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  photo: { borderRadius: radius.field, backgroundColor: colors.bg2 },
  photoLoading: { alignItems: 'center', justifyContent: 'center' },
  modalRoot: { flex: 1, backgroundColor: '#000000' },
  modalTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm },
  modalClose: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  modalPad: { paddingHorizontal: space.xl },
  modalGap: { marginTop: space.lg },
});
