import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
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

export default function SubmissionDetailScreen() {
  const router = useGuardedRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

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
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#E4B05E" />
      </View>
    );
  }

  if (!submission) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4 py-4 flex-row items-center border-b border-zinc-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-zinc-50"
          >
            <Ionicons name="arrow-back" size={20} color="#18181b" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-zinc-900 ml-4">Submission</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-lg font-bold text-zinc-900 mt-4">Submission Not Found</Text>
          <Text className="text-zinc-500 text-center mt-2">
            This submission may have been deleted or doesn't exist.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusBadge = () => {
    const isIncomplete =
      !submission.photos ||
      submission.photos.length === 0 ||
      (!submission.videoStorageId && !submission.audioStorageId);
    const isDraft = submission.status === 'draft' || isIncomplete;

    if (submission.status === 'approved') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Verified', icon: 'checkmark-circle' };
    if (submission.status === 'rejected') return { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: 'close-circle' };
    if (isDraft) return { bg: 'bg-zinc-100', text: 'text-zinc-600', label: 'Draft', icon: 'time' };
    if (submission.status === 'website_generated') return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Website Ready', icon: 'globe' };
    if (submission.status === 'deployed') return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Deployed', icon: 'rocket' };
    if (submission.status === 'pending_payment') return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Payment', icon: 'time' };
    if (submission.status === 'paid') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Paid', icon: 'cash' };
    if (submission.status === 'completed') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed', icon: 'checkmark-done-circle' };
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Review', icon: 'hourglass' };
  };

  const badge = getStatusBadge();
  const isIncomplete =
    !submission.photos ||
    submission.photos.length === 0 ||
    (!submission.videoStorageId && !submission.audioStorageId);
  const isDraft = submission.status === 'draft' || isIncomplete;

  const hasVideo = !!submission.videoStorageId;
  const hasAudio = !!submission.audioStorageId && !hasVideo;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center border-b border-zinc-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-zinc-50"
        >
          <Ionicons name="arrow-back" size={20} color="#18181b" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-zinc-900 ml-4 flex-1" numberOfLines={1}>
          {submission.businessName}
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View className="px-4 py-4">
          <View className={`rounded-2xl p-4 ${badge.bg}`}>
            <View className="flex-row items-center">
              <Ionicons name={badge.icon as any} size={24} color={badge.text.includes('emerald') ? '#E4B05E' : badge.text.includes('red') ? '#ef4444' : badge.text.includes('yellow') ? '#eab308' : badge.text.includes('blue') ? '#3b82f6' : badge.text.includes('purple') ? '#8b5cf6' : '#71717a'} />
              <Text className={`text-lg font-bold ml-2 ${badge.text}`}>{badge.label}</Text>
            </View>
            <Text className="text-zinc-600 text-sm mt-2">
              Submitted on {new Date(submission._creationTime).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Status Progress Notes */}
        {submission.status === 'submitted' && (
          <View className="px-4 pb-2">
            <View className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex-row">
              <Ionicons name="eye" size={20} color="#ca8a04" style={{ marginTop: 2 }} />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-yellow-800">Under Review</Text>
                <Text className="text-xs text-yellow-700 mt-1 leading-4">
                  Great job on completing your submission! Our team is now reviewing your entry. This usually takes 24–48 hours. We'll notify you once it's been verified.
                </Text>
              </View>
            </View>
          </View>
        )}

        {submission.status === 'approved' && (
          <View className="px-4 pb-2">
            <View className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex-row">
              <Ionicons name="construct" size={20} color="#3b82f6" style={{ marginTop: 2 }} />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-blue-800">Website In Progress</Text>
                <Text className="text-xs text-blue-600 mt-1 leading-4">
                  Your submission has been verified and approved! We're now building a professional website for this business. Hang tight — this usually doesn't take long.
                </Text>
              </View>
            </View>
          </View>
        )}

        {(submission.status === 'website_generated' || submission.status === 'deployed') && (
          <View className="px-4 pb-2">
            <View className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex-row">
              <Ionicons name="rocket" size={20} color="#8b5cf6" style={{ marginTop: 2 }} />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-purple-800">Website Ready & Deployed</Text>
                <Text className="text-xs text-purple-600 mt-1 leading-4">
                  The website has been generated and is now live! We'll be sending it to the business owner shortly. Sit back and wait for the good news.
                </Text>
              </View>
            </View>
          </View>
        )}

        {submission.status === 'pending_payment' && (
          <View className="px-4 pb-2">
            <View className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex-row">
              <Ionicons name="hourglass" size={20} color="#d97706" style={{ marginTop: 2 }} />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-amber-800">Awaiting Business Owner Payment</Text>
                <Text className="text-xs text-amber-700 mt-1 leading-4">
                  We've sent the deployed website to the business owner. Once they complete their payment, you'll receive your commission. We'll notify you as soon as it's confirmed!
                </Text>
              </View>
            </View>
          </View>
        )}

        {(submission.status === 'paid' || submission.status === 'completed') && (
          <View className="px-4 pb-2">
            <View className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex-row">
              <Ionicons name="checkmark-done-circle" size={20} color="#E4B05E" style={{ marginTop: 2 }} />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-emerald-800">Paid — business confirmed.</Text>
                <Text className="text-xs text-emerald-700 mt-1 leading-4">
                  You earned{' '}
                  {submission.creatorPayout ? `₱${submission.creatorPayout.toLocaleString()}` : 'your commission'}{' '}
                  — 50% of the sale price, credited the moment the business paid.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Business Info */}
        <View className="px-4 py-2">
          <Text className="text-base font-bold text-zinc-900 mb-3">Business Information</Text>

          <View className="bg-zinc-50 rounded-xl p-4 space-y-3">
            <View className="flex-row items-center">
              <Ionicons name="business" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Business Name</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.businessName}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Ionicons name="pricetag" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Business Type</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.businessType}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Ionicons name="person" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Owner</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.ownerName}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Ionicons name="call" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Phone</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.ownerPhone}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Ionicons name="location" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Address</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.address}, {submission.city}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Photos Section */}
        <View className="px-4 py-4">
          <Text className="text-base font-bold text-zinc-900 mb-3">
            Photos ({submission.photos?.length || 0})
          </Text>

          {photoUrls && photoUrls.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              {photoUrls.map((url, index) => (
                url && !url.startsWith('convex:') ? (
                  <View key={index} className="mx-1">
                    <Image
                      source={{ uri: url }}
                      className="w-32 h-32 rounded-xl bg-zinc-100"
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <View key={index} className="mx-1 w-32 h-32 rounded-xl bg-zinc-100 items-center justify-center">
                    <ActivityIndicator size="small" color="#a1a1aa" />
                  </View>
                )
              ))}
            </ScrollView>
          ) : (
            <View className="bg-zinc-50 rounded-xl p-6 items-center">
              <Ionicons name="images-outline" size={32} color="#a1a1aa" />
              <Text className="text-zinc-500 text-sm mt-2">No photos uploaded</Text>
            </View>
          )}
        </View>

        {/* Interview Section */}
        <View className="px-4 py-4">
          <Text className="text-base font-bold text-zinc-900 mb-3">Interview</Text>

          <View className="bg-zinc-50 rounded-xl p-4">
            {submission.videoStorageId || submission.audioStorageId ? (
              <View>
                {/* Inline Video Player */}
                {hasVideo && videoStreamUrl ? (
                  <View className="mb-3">
                    {/* Inline preview — tap opens fullscreen */}
                    <TouchableOpacity
                      onPress={openFullscreenVideo}
                      className="rounded-xl overflow-hidden bg-zinc-900"
                      style={{ height: 200 }}
                      activeOpacity={0.8}
                    >
                      <Video
                        ref={videoRef}
                        source={{ uri: videoStreamUrl }}
                        style={{ width: '100%', height: '100%' }}
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
                      <View className="absolute inset-0 items-center justify-center bg-black/20">
                        <View className="w-16 h-16 bg-black/60 rounded-full items-center justify-center">
                          <Ionicons name="play" size={32} color="white" style={{ marginLeft: 4 }} />
                        </View>
                      </View>
                      {/* Duration badge */}
                      {videoStatus?.isLoaded && videoStatus?.durationMillis && (
                        <View className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded">
                          <Text className="text-white text-xs font-medium">
                            {formatTime(videoStatus.durationMillis)}
                          </Text>
                        </View>
                      )}
                      <View className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded">
                        <Text className="text-white text-xs">Tap to play fullscreen</Text>
                      </View>
                    </TouchableOpacity>
                    <View className="flex-row items-center mt-3">
                      <View className="w-8 h-8 rounded-full items-center justify-center bg-emerald-100">
                        <Ionicons name="videocam" size={16} color="#E4B05E" />
                      </View>
                      <Text className="ml-2 text-sm text-zinc-700">Video interview recorded</Text>
                    </View>
                  </View>
                ) : hasVideo && !videoStreamUrl ? (
                  <View className="mb-3">
                    <View className="rounded-xl bg-zinc-100 items-center justify-center" style={{ height: 180 }}>
                      <ActivityIndicator size="large" color="#a1a1aa" />
                      <Text className="text-zinc-500 text-sm mt-2">Loading video...</Text>
                    </View>
                  </View>
                ) : null}

                {/* Audio Player */}
                {hasAudio && (
                  <View className="mb-3">
                    <TouchableOpacity
                      className={`flex-row items-center p-4 rounded-xl ${isAudioPlaying ? 'bg-emerald-100' : 'bg-white'}`}
                      onPress={handleAudioPress}
                      disabled={isAudioLoading || !audioStreamUrl}
                    >
                      <View className={`w-12 h-12 rounded-full items-center justify-center ${isAudioPlaying ? 'bg-emerald-500' : 'bg-emerald-100'}`}>
                        {isAudioLoading ? (
                          <ActivityIndicator size="small" color={isAudioPlaying ? '#fff' : '#E4B05E'} />
                        ) : (
                          <Ionicons
                            name={isAudioPlaying ? 'pause' : 'play'}
                            size={24}
                            color={isAudioPlaying ? '#fff' : '#E4B05E'}
                          />
                        )}
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-sm font-medium text-zinc-900">Audio Interview</Text>
                        <Text className="text-xs text-zinc-500">
                          {isAudioLoading
                            ? 'Loading...'
                            : isAudioPlaying
                              ? `Playing ${formatTime(audioPosition)} / ${formatTime(audioDuration)}`
                              : audioStreamUrl
                                ? 'Tap to play'
                                : 'Loading audio...'}
                        </Text>
                      </View>
                      <Ionicons name="musical-notes" size={20} color="#a1a1aa" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Transcription */}
                {submission.transcript ? (
                  <View className="mt-1">
                    <TouchableOpacity
                      className="flex-row items-center justify-between py-2"
                      onPress={() => setShowTranscript(!showTranscript)}
                    >
                      <View className="flex-row items-center">
                        <Ionicons name="document-text" size={16} color="#E4B05E" />
                        <Text className="text-sm font-medium text-emerald-600 ml-2">
                          Transcription
                        </Text>
                      </View>
                      <Ionicons
                        name={showTranscript ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#71717a"
                      />
                    </TouchableOpacity>
                    {showTranscript && (
                      <View className="bg-white rounded-lg p-3 mt-1">
                        <Text className="text-sm text-zinc-700 leading-5">
                          {submission.transcript}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : submission.transcriptionStatus === 'processing' ? (
                  <View className="flex-row items-center mt-2">
                    <ActivityIndicator size="small" color="#E4B05E" />
                    <Text className="text-xs text-zinc-500 ml-2">Generating transcription...</Text>
                  </View>
                ) : submission.transcriptionStatus === 'failed' || submission.transcriptionStatus === 'skipped' ? (
                  <View className="flex-row items-center mt-2">
                    <Ionicons name="alert-circle" size={14} color="#f59e0b" />
                    <Text className="text-xs text-zinc-500 ml-2">
                      {submission.transcriptionError || 'Transcription unavailable'}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View className="items-center py-2">
                <Ionicons name="mic-off-outline" size={32} color="#a1a1aa" />
                <Text className="text-zinc-500 text-sm mt-2">No interview uploaded</Text>
              </View>
            )}
          </View>
        </View>

        {/* Earnings Section */}
        <View className="px-4 py-4 mb-6">
          <Text className="text-base font-bold text-zinc-900 mb-3">Your Earnings</Text>

          <View className={`rounded-xl p-4 ${isDraft ? 'bg-zinc-50' : 'bg-emerald-50'}`}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className={`text-xs font-medium ${isDraft ? 'text-zinc-500' : 'text-emerald-600'}`}>
                  {submission.status === 'paid' || submission.status === 'completed'
                    ? 'Paid'
                    : isDraft
                    ? 'Expected'
                    : 'Pending — credited when business pays'}
                </Text>
                <Text className={`text-2xl font-bold ${isDraft ? 'text-zinc-400' : 'text-emerald-700'}`}>
                  {submission.creatorPayout ? `₱${submission.creatorPayout.toLocaleString()}` : '--'}
                </Text>
                {submission.creatorPayout && !isDraft && (
                  <Text className="text-xs text-emerald-600 mt-1">
                    50% of the sale price · domain excluded
                  </Text>
                )}
                {isDraft && !submission.creatorPayout && (
                  <Text className="text-xs text-zinc-400 mt-1">
                    Set your price on the review screen to see your earnings
                  </Text>
                )}
              </View>
              <View className={`w-12 h-12 rounded-full items-center justify-center ${isDraft ? 'bg-zinc-100' : 'bg-emerald-100'}`}>
                <Ionicons name="cash" size={24} color={isDraft ? '#a1a1aa' : '#E4B05E'} />
              </View>
            </View>
          </View>
        </View>

        {/* Custom Domain status — only shown when a custom domain was requested */}
        {(submission as any).requestedDomain && (
          <View className="px-4 py-4 mb-2">
            <Text className="text-base font-bold text-zinc-900 mb-3">Custom Domain</Text>
            {(() => {
              const domainStatus = (submission as any).domainStatus as
                | 'not_requested'
                | 'pending_payment'
                | 'registering'
                | 'configuring_dns'
                | 'provisioning_ssl'
                | 'live'
                | 'failed'
                | undefined;
              const requestedDomain = (submission as any).requestedDomain as string;
              const failureReason = (submission as any).domainFailureReason as
                | string
                | undefined;

              const statusMeta: Record<
                string,
                { icon: string; iconColor: string; bgClass: string; label: string; description: string }
              > = {
                pending_payment: {
                  icon: 'time-outline',
                  iconColor: '#f59e0b',
                  bgClass: 'bg-amber-50 border border-amber-200',
                  label: 'Awaiting business owner payment',
                  description: 'Domain setup will start automatically once your client pays.',
                },
                registering: {
                  icon: 'sync-outline',
                  iconColor: '#3b82f6',
                  bgClass: 'bg-blue-50 border border-blue-200',
                  label: 'Registering domain',
                  description: 'Reserving your domain with the registrar...',
                },
                configuring_dns: {
                  icon: 'sync-outline',
                  iconColor: '#3b82f6',
                  bgClass: 'bg-blue-50 border border-blue-200',
                  label: 'Configuring DNS',
                  description: 'Connecting your domain to Cloudflare...',
                },
                provisioning_ssl: {
                  icon: 'lock-closed-outline',
                  iconColor: '#3b82f6',
                  bgClass: 'bg-blue-50 border border-blue-200',
                  label: 'Provisioning SSL certificate',
                  description: 'Securing your site with HTTPS...',
                },
                live: {
                  icon: 'checkmark-circle',
                  iconColor: '#E4B05E',
                  bgClass: 'bg-emerald-50 border border-emerald-200',
                  label: 'Live',
                  description: 'Your domain is now serving the website.',
                },
                failed: {
                  icon: 'close-circle',
                  iconColor: '#ef4444',
                  bgClass: 'bg-red-50 border border-red-200',
                  label: 'Setup failed',
                  description: failureReason || 'Something went wrong during setup.',
                },
              };

              const meta = statusMeta[domainStatus || 'pending_payment'];

              return (
                <View className={`rounded-xl p-4 ${meta.bgClass}`}>
                  <View className="flex-row items-start">
                    <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                      <Ionicons
                        name={meta.icon as any}
                        size={20}
                        color={meta.iconColor}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      {domainStatus === 'live' ? (
                        <TouchableOpacity
                          onPress={() => {
                            void openExternalUrl(requestedDomain);
                          }}
                        >
                          <Text className="text-base font-bold text-zinc-900">
                            {requestedDomain}
                          </Text>
                          <View className="flex-row items-center mt-1">
                            <Text className="text-xs text-emerald-700 font-semibold">
                              ✓ {meta.label}
                            </Text>
                            <Ionicons
                              name="open-outline"
                              size={12}
                              color="#E4B05E"
                              style={{ marginLeft: 4 }}
                            />
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <Text className="text-sm font-bold text-zinc-900">
                            {requestedDomain}
                          </Text>
                          <Text className="text-xs font-semibold text-zinc-700 mt-1">
                            {meta.label}
                          </Text>
                        </>
                      )}
                      <Text className="text-xs text-zinc-600 mt-1 leading-5">
                        {meta.description}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* Deployed Website URL */}
        {['deployed', 'pending_payment', 'paid', 'completed', 'website_generated'].includes(submission.status) &&
          liveWebsiteUrl && (
          <View className="px-4 py-4 mb-6">
            <Text className="text-base font-bold text-zinc-900 mb-3">Website</Text>
            <TouchableOpacity
              className="bg-purple-50 rounded-xl p-4 flex-row items-center"
              onPress={() => {
                void openExternalUrl(liveWebsiteUrl);
              }}
            >
              <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center">
                <Ionicons name="globe" size={20} color="#8b5cf6" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-medium text-purple-700">View Live Website</Text>
                <Text className="text-xs text-purple-500" numberOfLines={1}>
                  {liveWebsiteUrl}
                </Text>
              </View>
              <Ionicons name="open-outline" size={20} color="#8b5cf6" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Continue Submission Button (for drafts) */}
      {isDraft && (
        <View className="px-4 py-4 border-t border-zinc-100">
          <TouchableOpacity
            className="bg-emerald-500 rounded-xl py-4 items-center"
            onPress={async () => {
              await AsyncStorage.setItem('current_submission_id', submission._id);
              const route = !submission.photos || submission.photos.length === 0
                ? '/(app)/submit/photos'
                : !submission.videoStorageId && !submission.audioStorageId
                ? '/(app)/submit/interview'
                : '/(app)/submit/review';
              router.push(route as any);
            }}
          >
            <Text className="text-white font-bold text-base">Continue Submission</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fullscreen Video Modal */}
      <Modal
        visible={showFullscreenVideo}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={closeFullscreenVideo}
      >
        <View className="flex-1 bg-black">
          {/* Close Button */}
          <SafeAreaView className="absolute top-0 left-0 right-0 z-10">
            <View className="flex-row justify-between items-center px-4 py-2">
              <TouchableOpacity
                onPress={closeFullscreenVideo}
                className="w-12 h-12 bg-black/60 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Loading indicator */}
          {isVideoLoading && !videoError && (
            <View className="absolute inset-0 items-center justify-center">
              <ActivityIndicator size="large" color="white" />
              <Text className="text-white mt-4">Loading video...</Text>
            </View>
          )}

          {/* Error state */}
          {videoError && (
            <View className="absolute inset-0 items-center justify-center px-6">
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text className="text-white text-center mt-4">{videoError}</Text>
              <TouchableOpacity
                onPress={closeFullscreenVideo}
                className="mt-4 px-6 py-3 bg-zinc-700 rounded-xl"
              >
                <Text className="text-white font-semibold">Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Fullscreen Video Player */}
          {showFullscreenVideo && videoStreamUrl && !videoError && (
            <Video
              ref={fullscreenVideoRef}
              source={{ uri: videoStreamUrl }}
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
                setVideoError('Failed to play video. Please check your connection and try again.');
              }}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
