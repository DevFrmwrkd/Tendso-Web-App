import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio, Video, ResizeMode } from 'expo-av';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Id } from '@tendso/convex-client';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { colors, fonts, radius, space, shadow } from '../../../theme/tokens';
import { Display, Body, Label, Door, Card, Rule, LiveDot } from '../../../components/ui/primitives';
import { useGuardedPress } from '../../../hooks/useGuardedPress';

type InterviewType = 'video' | 'audio' | null;

// SEO-optimized interview questions.
// Each question is designed to elicit answers containing local-business
// keywords (name + city + service + landmarks) so the resulting transcript
// ranks well on Google for "near me" and category-specific searches.
// The owner is gently nudged to say their full business name + city in every answer.
const INTERVIEW_QUESTIONS = [
    "What's the full name of your business, what city or area do you serve, and what do you do? Try to mention all three in one sentence.",
    "What products or services do you offer, and what are your most popular ones? Use the words customers would type into Google.",
    "Why do customers choose your business over the alternatives nearby? What makes you the best in your area?",
    "Tell us about a recent customer who loved what you did — what did they buy, and where were they from?",
    "Where exactly are you located, what are your opening hours, and how can people reach you? Mention nearby landmarks if it helps people find you.",
]

const INTERVIEW_TIPS = [
  { step: '01', text: 'Say the business name + city in every answer (helps SEO).' },
  { step: '02', text: 'Use the words your customers type into Google.' },
  { step: '03', text: 'Mention specific products, prices, and services by name.' },
  { step: '04', text: 'Include hours, address, and nearby landmarks.' },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SubmitInterviewScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);

  // Spam-click guard: stable, re-entrant-safe navigation back
  const goBack = useGuardedPress(() => router.back());

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false); // Server processing after upload
  const [error, setError] = useState<string | null>(null);

  // Interview type selection
  const [interviewType, setInterviewType] = useState<InterviewType>(null);

  // Recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasExistingRecording, setHasExistingRecording] = useState(false);
  const [existingType, setExistingType] = useState<InterviewType>(null);
  const [wantsToReRecord, setWantsToReRecord] = useState(false);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('front'); // Default to front for interviews
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showLightingTip, setShowLightingTip] = useState(true);
  const cameraRef = useRef<CameraView>(null);

  // Parallel audio recording for video transcription (separate smaller file)
  const [parallelAudioRecording, setParallelAudioRecording] = useState<Audio.Recording | null>(null);
  const [parallelAudioUri, setParallelAudioUri] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Video playback state
  const videoRef = useRef<Video>(null);
  const fullscreenVideoRef = useRef<Video>(null);
  const [videoStatus, setVideoStatus] = useState<any>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const progressBarRef = useRef<View>(null);

  // Audio playback state
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [audioStatus, setAudioStatus] = useState<any>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const isOfflinePending = submissionId === 'offline_pending';

  const submission = useQuery(
    api.submissions.getById,
    submissionId && !isOfflinePending ? { id: submissionId as Id<'submissions'> } : 'skip'
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

  // Check for existing recording
  useEffect(() => {
    if (submission?.videoStorageId) {
      setHasExistingRecording(true);
      setExistingType('video');
    } else if (submission?.audioStorageId) {
      setHasExistingRecording(true);
      setExistingType('audio');
    }
  }, [submission]);

  // Cleanup audio playback on unmount or when audioSound changes
  useEffect(() => {
    return () => {
      if (audioSound) {
        audioSound.unloadAsync();
      }
    };
  }, [audioSound]);

  // Cleanup timer and parallel audio recording on unmount only
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const requestAudioPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant microphone access to record the interview.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const startAudioRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
      setCurrentQuestion(0);
      setError(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording');
    }
  };

  const stopAudioRecording = async () => {
    if (!recording) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
      setIsRecording(false);
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError('Failed to stop recording');
    }
  };

  const pauseAudioRecording = async () => {
    if (!recording) return;

    try {
      await recording.pauseAsync();
      setIsPaused(true);
      // Pause the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {
      console.error('Failed to pause recording:', err);
      setError('Failed to pause recording');
    }
  };

  const resumeAudioRecording = async () => {
    if (!recording) return;

    try {
      await recording.startAsync();
      setIsPaused(false);
      // Resume the timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to resume recording:', err);
      setError('Failed to resume recording');
    }
  };

  const openVideoCamera = async () => {
    if (!cameraPermission?.granted) {
      const camResult = await requestCameraPermission();
      if (!camResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant camera access to record a video interview.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    if (!micPermission?.granted) {
      const micResult = await requestMicPermission();
      if (!micResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant microphone access to record audio with your video.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    setCurrentQuestion(0);
    setShowLightingTip(true);
    setShowCamera(true);
  };

  const startVideoRecording = async () => {
    if (!cameraRef.current) return;

    try {
      setIsVideoRecording(true);
      setRecordingDuration(0);
      setParallelAudioUri(null);

      // Start parallel audio recording for transcription (smaller file than video)
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording: audioRec } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setParallelAudioRecording(audioRec);
        console.log('[Interview] Parallel audio recording started for transcription');
      } catch (audioErr) {
        console.warn('[Interview] Could not start parallel audio recording:', audioErr);
        // Continue with video-only - transcription will use video file
      }

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 600, // 10 minutes max - longer videos supported with streaming upload
      });

      if (video?.uri) {
        setRecordingUri(video.uri);
        setShowCamera(false);
      }
    } catch (err) {
      console.error('Failed to record video:', err);
      setError('Failed to record video');
      // Clean up parallel audio if video failed
      if (parallelAudioRecording) {
        try {
          await parallelAudioRecording.stopAndUnloadAsync();
        } catch {}
        setParallelAudioRecording(null);
      }
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsVideoRecording(false);
    }
  };

  const stopVideoRecording = async () => {
    if (cameraRef.current && isVideoRecording) {
      cameraRef.current.stopRecording();
    }

    // Stop parallel audio recording and save URI for transcription
    if (parallelAudioRecording) {
      try {
        await parallelAudioRecording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const audioUri = parallelAudioRecording.getURI();
        if (audioUri) {
          setParallelAudioUri(audioUri);
          console.log('[Interview] Parallel audio saved:', audioUri);
        }
      } catch (err) {
        console.error('[Interview] Failed to stop parallel audio:', err);
      } finally {
        setParallelAudioRecording(null);
      }
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const nextQuestion = () => {
    if (currentQuestion < INTERVIEW_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const deleteRecording = async () => {
    // Stop and unload audio if playing
    if (audioSound) {
      await audioSound.stopAsync();
      await audioSound.unloadAsync();
      setAudioSound(null);
    }
    setRecordingUri(null);
    setParallelAudioUri(null); // Clear parallel audio too
    setRecordingDuration(0);
    setVideoStatus(null);
    setIsVideoPlaying(false);
    setAudioStatus(null);
    setIsAudioPlaying(false);
    // If user had existing recording and was re-recording, go back to showing existing
    if (hasExistingRecording) {
      setWantsToReRecord(false);
      setInterviewType(null);
    }
  };

  // Audio playback functions
  const loadAndPlayAudio = async () => {
    if (!recordingUri || interviewType !== 'audio') return;

    try {
      // If already loaded, just toggle play/pause
      if (audioSound) {
        if (isAudioPlaying) {
          await audioSound.pauseAsync();
        } else {
          // If finished, replay from start
          if (audioStatus?.didJustFinish || audioStatus?.positionMillis === audioStatus?.durationMillis) {
            await audioSound.replayAsync();
          } else {
            await audioSound.playAsync();
          }
        }
        return;
      }

      // Load the audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true },
        handleAudioStatusUpdate
      );

      setAudioSound(sound);
    } catch (err) {
      console.error('Error playing audio:', err);
    }
  };

  const handleAudioStatusUpdate = (status: any) => {
    setAudioStatus(status);
    setIsAudioPlaying(status.isPlaying);
  };

  const seekAudio = async (forward: boolean) => {
    if (audioSound && audioStatus?.positionMillis !== undefined && audioStatus?.durationMillis) {
      const newPosition = forward
        ? Math.min(audioStatus.durationMillis, audioStatus.positionMillis + 10000)
        : Math.max(0, audioStatus.positionMillis - 10000);
      await audioSound.setPositionAsync(newPosition);
    }
  };

  const toggleVideoPlayback = async () => {
    // Use fullscreen video ref if in fullscreen mode, otherwise use main video ref
    const activeVideoRef = showFullscreen ? fullscreenVideoRef : videoRef;

    if (activeVideoRef.current) {
      if (isVideoPlaying) {
        await activeVideoRef.current.pauseAsync();
      } else {
        // If video finished, replay from start
        if (videoStatus?.didJustFinish || videoStatus?.positionMillis === videoStatus?.durationMillis) {
          await activeVideoRef.current.replayAsync();
        } else {
          await activeVideoRef.current.playAsync();
        }
      }
    }
  };

  const handleVideoStatusUpdate = (status: any) => {
    setVideoStatus(status);
    setIsVideoPlaying(status.isPlaying);
  };

  const handleSeek = async (value: number) => {
    const activeVideoRef = showFullscreen ? fullscreenVideoRef : videoRef;
    if (activeVideoRef.current && videoStatus?.durationMillis) {
      await activeVideoRef.current.setPositionAsync(value * videoStatus.durationMillis);
    }
  };

  const handleProgressBarSeek = async (event: any, barWidth: number, isFullscreen: boolean = false) => {
    const activeVideoRef = isFullscreen ? fullscreenVideoRef : videoRef;
    if (activeVideoRef.current && videoStatus?.durationMillis && barWidth > 0) {
      const touchX = event.nativeEvent.locationX;
      const percentage = Math.max(0, Math.min(1, touchX / barWidth));
      const newPosition = percentage * videoStatus.durationMillis;
      await activeVideoRef.current.setPositionAsync(newPosition);
    }
  };

  const openFullscreen = async () => {
    // Pause main video first
    if (videoRef.current && isVideoPlaying) {
      await videoRef.current.pauseAsync();
    }

    setShowFullscreen(true);

    // Sync position and play state to fullscreen after it opens
    setTimeout(async () => {
      if (fullscreenVideoRef.current && videoStatus?.positionMillis) {
        await fullscreenVideoRef.current.setPositionAsync(videoStatus.positionMillis);
        if (isVideoPlaying) {
          await fullscreenVideoRef.current.playAsync();
        }
      }
    }, 150);
  };

  const closeFullscreen = async () => {
    // Pause fullscreen video first
    if (fullscreenVideoRef.current && isVideoPlaying) {
      await fullscreenVideoRef.current.pauseAsync();
    }

    // Sync position back to main video
    if (videoRef.current && videoStatus?.positionMillis) {
      await videoRef.current.setPositionAsync(videoStatus.positionMillis);
      if (isVideoPlaying) {
        await videoRef.current.playAsync();
      }
    }
    setShowFullscreen(false);
  };

  const formatTime = (millis: number) => {
    if (!millis) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNext = async () => {
    if (!submissionId) return;

    // Require selection if no existing recording
    if (!interviewType && !hasExistingRecording) {
      setError('Please select Video or Audio interview type.');
      return;
    }

    // Allow skipping if no recording but has existing
    if (!recordingUri && !hasExistingRecording) {
      setError('Please record an interview before continuing.');
      return;
    }

    // OFFLINE PATH: Save recording URI locally and navigate
    if (!isConnected || isOfflinePending) {
      try {
        if (recordingUri && interviewType) {
          await AsyncStorage.setItem('submission_pending_interview', JSON.stringify({
            recordingUri,
            parallelAudioUri: parallelAudioUri || null,
            type: interviewType,
            submissionId,
            savedAt: Date.now(),
          }));
        }
        router.push('/(app)/submit/review');
      } catch (err) {
        setError('Failed to save recording locally');
      }
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setError(null);

    // Helper function to upload a file to R2
    const uploadFile = async (
      uri: string,
      folder: string,
      contentType: string,
      fileName: string,
      trackProgress: boolean = true
    ): Promise<string> => {
      // Get R2 presigned upload URL
      const { uploadUrl, fileKey } = await generateR2UploadUrl({
        folder,
        filename: fileName,
        contentType,
      });

      let fileUri = uri;
      if (Platform.OS === 'android' && !fileUri.startsWith('file://')) {
        fileUri = 'file://' + fileUri;
      }

      if (trackProgress) {
        setUploadProgress(10);
      }

      // Read local file as a blob, then PUT to R2 presigned URL
      const localResponse = await fetch(fileUri);
      const blob = await localResponse.blob();
      console.log(`[Upload] Blob size: ${blob.size} bytes, type: ${blob.type}`);

      const uploadResult = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });

      console.log('[Upload] Response status:', uploadResult.status);

      if (trackProgress) {
        setUploadProgress(100);
        setIsProcessing(false);
      }

      if (uploadResult.ok) {
        return fileKey;
      } else {
        const errorText = await uploadResult.text();
        console.error('[Upload] Failed:', uploadResult.status, errorText);
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }
    };

    try {
      if (recordingUri && interviewType) {
        console.log('Uploading file from:', recordingUri);

        const contentType = interviewType === 'video' ? 'video/mp4' : 'audio/m4a';
        const fileName = interviewType === 'video' ? 'interview.mp4' : 'interview.m4a';
        const folder = interviewType === 'video' ? 'videos' : 'audio';

        // Upload main recording (video or audio) to R2
        const fileKey = await uploadFile(recordingUri, folder, contentType, fileName, true);

        // Phase 3 (OWNER-PORTAL-PRICING-PLAN §3.1): payout is no longer a flat
        // ₱500/₱300 split. It's computed server-side at submit time as 50% of
        // the creator's chosen sellPrice (set on the review screen's slider).
        // We do NOT pass creatorPayout from here anymore — the server is the
        // single source of truth and would just overwrite it.

        if (interviewType === 'video') {
          // For video interviews, also upload the parallel audio for transcription
          let transcriptionAudioKey: string | undefined;

          if (parallelAudioUri) {
            console.log('[Interview] Uploading parallel audio for transcription:', parallelAudioUri);
            try {
              transcriptionAudioKey = await uploadFile(
                parallelAudioUri,
                'audio',
                'audio/m4a',
                'interview-audio.m4a',
                false // Don't track progress for background upload
              );
              console.log('[Interview] Parallel audio uploaded:', transcriptionAudioKey);
            } catch (audioErr) {
              console.warn('[Interview] Failed to upload parallel audio, will use video for transcription:', audioErr);
              // Continue without parallel audio - transcription will use video file
            }
          }

          await updateSubmission({
            id: submissionId as Id<'submissions'>,
            videoStorageId: fileKey,
            audioStorageId: transcriptionAudioKey, // Use parallel audio for transcription
          });
        } else {
          await updateSubmission({
            id: submissionId as Id<'submissions'>,
            audioStorageId: fileKey,
          });
        }
      }

      router.push('/(app)/submit/review');
    } catch (err: any) {
      console.error('Error uploading recording:', err);
      setError(err.message || 'Failed to upload recording');
    } finally {
      setLoading(false);
    }
  };

  // When offline, skip Clerk/Convex loading gates — layout already verified auth
  if (!isConnected && (!isLoaded || creator === undefined)) {
    // Offline: allow page to render without creator data
  } else if (!isLoaded || creator === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!submissionId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const canContinue = !(loading || isRecording || (!recordingUri && !hasExistingRecording));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* Header — editorial back + step marker */}
      <View style={{
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.rule,
            backgroundColor: colors.paper3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isRecording || isVideoRecording ? (
            <>
              <Text style={{ color: colors.ink3, fontFamily: fonts.mono, fontSize: 11 }}>·</Text>
              <LiveDot size={6} color={colors.danger} />
              <Label tracking={1.8} color={colors.danger}>REC</Label>
            </>
          ) : null}
        </View>
      </View>

      <OfflineBanner />

      {/* Editorial progress rule */}
      <View style={{ paddingHorizontal: 24, marginBottom: 4 }}>
        <View style={{ height: 2, backgroundColor: colors.rule, borderRadius: 1, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: '75%', backgroundColor: colors.ink }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial header */}
        <Label tracking={1.8} style={{ marginBottom: 8 }}>INTERVIEW</Label>
        <View style={{ marginBottom: 12 }}>
          <Display size="lg">Talk to</Display>
          <Display size="lg" italic color={colors.accent}>the owner.</Display>
        </View>
        <Body size="md" color={colors.ink2} style={{ marginBottom: 24, maxWidth: 360 }}>
          Five questions, one short conversation. Video pays more — but a clean audio
          take works too.
        </Body>

        {/* Error banner — matches login.tsx pattern */}
        {error ? (
          <View
            style={{
              backgroundColor: colors.dangerBg,
              borderColor: colors.danger,
              borderWidth: 1,
              borderRadius: radius.sm,
              padding: 14,
              marginBottom: 18,
            }}
          >
            <Body size="sm" color={colors.danger} weight="medium">{error}</Body>
          </View>
        ) : null}

        {/* Offline notice */}
        {!isConnected && (
          <View
            style={{
              backgroundColor: colors.warnBg,
              borderColor: colors.warn,
              borderWidth: 1,
              borderRadius: radius.sm,
              padding: 14,
              marginBottom: 18,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={colors.warn} style={{ marginTop: 1 }} />
            <Body size="sm" color={colors.warn} weight="medium" style={{ flex: 1 }}>
              You're offline. Record now — we'll upload automatically when you're back online.
            </Body>
          </View>
        )}

        {/* Existing Recording Notice — Full UI when not re-recording */}
        {hasExistingRecording && !recordingUri && !wantsToReRecord && (
          <Card large style={{ padding: 26, marginBottom: 22, alignItems: 'center' }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: colors.accentBg,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <Ionicons name="checkmark-circle" size={34} color={colors.accent} />
            </View>
            <Label tracking={1.6} color={colors.accent}>SAVED</Label>
            <View style={{ marginTop: 6, alignItems: 'center' }}>
              <Display size="sm">{existingType === 'video' ? 'Video' : 'Audio'} on file,</Display>
              <Display size="sm" italic color={colors.accent}>ready to review.</Display>
            </View>
            <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
              Your interview recording has been saved. Continue to review or record a new one to replace it.
            </Body>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setWantsToReRecord(true);
                setInterviewType(existingType);
              }}
              activeOpacity={0.85}
              style={{
                marginTop: 18,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.ink,
                backgroundColor: 'transparent',
              }}
            >
              <Ionicons name="refresh" size={16} color={colors.ink} />
              <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink }}>
                Re-record {existingType === 'video' ? 'video' : 'audio'}
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Interview Type Selection */}
        {!recordingUri && !isRecording && (!hasExistingRecording || wantsToReRecord) && (
          <View style={{ marginBottom: 22 }}>
            <Label tracking={1.6} style={{ marginBottom: 10 }}>SELECT FORMAT</Label>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Video Option — preferred (becomes a TikTok asset) */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Video interview — preferred"
                activeOpacity={0.85}
                onPress={() => setInterviewType('video')}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: interviewType === 'video' ? colors.ink : colors.rule,
                  backgroundColor: interviewType === 'video' ? colors.paper3 : colors.paper3,
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: interviewType === 'video' ? colors.ink : colors.paper2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="videocam" size={22} color={interviewType === 'video' ? colors.paper3 : colors.ink3} />
                </View>
                <Body size="sm" weight="bold" color={colors.ink}>Video</Body>
                <Label tracking={1.4}>PREFERRED · TIKTOK READY</Label>
              </TouchableOpacity>

              {/* Audio Option — fallback (noisy venue, owner declined camera) */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Audio interview — fallback"
                activeOpacity={0.85}
                onPress={() => setInterviewType('audio')}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: interviewType === 'audio' ? colors.ink : colors.rule,
                  backgroundColor: colors.paper3,
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: interviewType === 'audio' ? colors.ink : colors.paper2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="mic" size={22} color={interviewType === 'audio' ? colors.paper3 : colors.ink3} />
                </View>
                <Body size="sm" weight="bold" color={colors.ink}>Audio</Body>
                <Label tracking={1.4}>FALLBACK ONLY</Label>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Interview Tips — editorial step list */}
        {(!hasExistingRecording || wantsToReRecord || recordingUri) && (
          <Card large style={{ padding: 18, marginBottom: 22 }}>
            <Label tracking={1.6} style={{ marginBottom: 6 }}>HOW IT GOES</Label>
            <View style={{ marginBottom: 10 }}>
              <Display size="sm">Four moments,</Display>
              <Display size="sm" italic color={colors.accent}>one honest take.</Display>
            </View>
            <View style={{ gap: 0 }}>
              {INTERVIEW_TIPS.map((tip, idx) => (
                <View key={tip.step}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 12 }}>
                    <View style={{ width: 32, alignItems: 'center', paddingTop: 2 }}>
                      <Text style={{
                        fontFamily: fonts.serif,
                        fontSize: 22,
                        lineHeight: 24,
                        color: colors.ink3,
                        letterSpacing: -0.3,
                      }}>
                        {tip.step}
                      </Text>
                    </View>
                    <View style={{ flex: 1, paddingTop: 4 }}>
                      <Body size="sm" color={colors.ink2}>{tip.text}</Body>
                    </View>
                  </View>
                  {idx < INTERVIEW_TIPS.length - 1 && <Rule />}
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Recording / Playback Surface */}
        {(!hasExistingRecording || wantsToReRecord || recordingUri) && (
          <View style={{ marginBottom: 22 }}>
            {recordingUri ? (
              // Recording Complete
              <>
                {interviewType === 'video' ? (
                  <View>
                    {/* Video Container — ink dark surface (intentional) */}
                    <View style={{
                      borderRadius: radius.md,
                      overflow: 'hidden',
                      backgroundColor: colors.ink,
                      borderWidth: 1,
                      borderColor: colors.ink,
                    }}>
                      <TouchableOpacity activeOpacity={0.9} onPress={toggleVideoPlayback}>
                        <Video
                          ref={videoRef}
                          source={{ uri: recordingUri }}
                          style={{ width: '100%', height: 240 }}
                          resizeMode={ResizeMode.CONTAIN}
                          isLooping={false}
                          onPlaybackStatusUpdate={handleVideoStatusUpdate}
                        />
                        {!isVideoPlaying && (
                          <View
                            style={{
                              position: 'absolute',
                              top: 0, left: 0, right: 0, bottom: 0,
                              justifyContent: 'center',
                              alignItems: 'center',
                              backgroundColor: 'rgba(0,0,0,0.32)',
                            }}
                          >
                            <View style={{
                              width: 64, height: 64, borderRadius: 32,
                              backgroundColor: colors.paper3,
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Ionicons
                                name={videoStatus?.didJustFinish ? 'refresh' : 'play'}
                                size={28}
                                color={colors.ink}
                                style={{ marginLeft: videoStatus?.didJustFinish ? 0 : 3 }}
                              />
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Custom Video Controls */}
                    <Card style={{ marginTop: 12, padding: 14 }}>
                      {/* Mono timer + duration */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Text style={{ fontFamily: fonts.monoMed, fontSize: 13, color: colors.ink, letterSpacing: 0.4 }}>
                          {formatTime(videoStatus?.positionMillis || 0)}
                        </Text>
                        <Label tracking={1.6}>PLAYBACK</Label>
                        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink3, letterSpacing: 0.4 }}>
                          {formatTime(videoStatus?.durationMillis || 0)}
                        </Text>
                      </View>

                      {/* Timeline */}
                      <View
                        style={{ height: 28, justifyContent: 'center', marginBottom: 14 }}
                        onTouchEnd={(event) => {
                          const touchX = event.nativeEvent.locationX;
                          const barWidth = event.nativeEvent.target ? SCREEN_WIDTH - 100 : 200;
                          if (videoRef.current && videoStatus?.durationMillis) {
                            const percentage = Math.max(0, Math.min(1, touchX / barWidth));
                            const newPosition = percentage * videoStatus.durationMillis;
                            videoRef.current.setPositionAsync(newPosition);
                          }
                        }}
                      >
                        <View style={{ height: 2, backgroundColor: colors.rule, borderRadius: 1, overflow: 'hidden' }}>
                          <View
                            style={{
                              height: '100%',
                              backgroundColor: colors.ink,
                              width: `${videoStatus?.durationMillis ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 : 0}%`,
                            }}
                          />
                        </View>
                        <View
                          style={{
                            position: 'absolute',
                            width: 12, height: 12, borderRadius: 6,
                            backgroundColor: colors.ink,
                            borderWidth: 2,
                            borderColor: colors.paper3,
                            left: `${videoStatus?.durationMillis ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 : 0}%`,
                            marginLeft: -6,
                            top: 8,
                          }}
                        />
                      </View>

                      {/* Playback Controls */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                        <TouchableOpacity
                          onPress={async () => {
                            if (videoRef.current && videoStatus?.positionMillis) {
                              await videoRef.current.setPositionAsync(Math.max(0, videoStatus.positionMillis - 10000));
                            }
                          }}
                          style={{
                            width: 42, height: 42, borderRadius: 21,
                            borderWidth: 1, borderColor: colors.ink,
                            backgroundColor: 'transparent',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="play-back" size={18} color={colors.ink} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={toggleVideoPlayback}
                          style={{
                            width: 60, height: 60, borderRadius: 30,
                            backgroundColor: colors.ink,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Ionicons
                            name={isVideoPlaying ? 'pause' : (videoStatus?.didJustFinish ? 'refresh' : 'play')}
                            size={26}
                            color={colors.paper3}
                            style={{ marginLeft: isVideoPlaying || videoStatus?.didJustFinish ? 0 : 2 }}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={async () => {
                            if (videoRef.current && videoStatus?.positionMillis && videoStatus?.durationMillis) {
                              await videoRef.current.setPositionAsync(Math.min(videoStatus.durationMillis, videoStatus.positionMillis + 10000));
                            }
                          }}
                          style={{
                            width: 42, height: 42, borderRadius: 21,
                            borderWidth: 1, borderColor: colors.ink,
                            backgroundColor: 'transparent',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="play-forward" size={18} color={colors.ink} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={openFullscreen}
                          style={{
                            width: 42, height: 42, borderRadius: 21,
                            borderWidth: 1, borderColor: colors.ink,
                            backgroundColor: 'transparent',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="expand" size={18} color={colors.ink} />
                        </TouchableOpacity>
                      </View>
                    </Card>

                    {/* Delete */}
                    <TouchableOpacity
                      onPress={deleteRecording}
                      activeOpacity={0.85}
                      style={{
                        alignSelf: 'center',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 18,
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderColor: colors.danger,
                        backgroundColor: colors.dangerBg,
                        marginTop: 12,
                      }}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.danger} />
                      <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.danger }}>
                        Delete & re-record
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Audio Recording Complete — editorial waveform card
                  <View>
                    <View style={{ alignItems: 'center', marginBottom: 14 }}>
                      <Label tracking={1.8} color={colors.accent}>AUDIO CAPTURED</Label>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', marginTop: 4 }}>
                        <Display size="sm">Ready to </Display>
                        <Display size="sm" italic color={colors.accent}>listen back.</Display>
                      </View>
                    </View>

                    {/* Ink dark playback surface */}
                    <View style={{
                      backgroundColor: colors.ink,
                      borderRadius: radius.lg,
                      padding: 22,
                      ...shadow.soft,
                    }}>
                      {/* Waveform marker */}
                      <View style={{ alignItems: 'center', marginBottom: 18 }}>
                        <View style={{
                          width: 56, height: 56, borderRadius: 28,
                          borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          alignItems: 'center', justifyContent: 'center',
                          marginBottom: 12,
                        }}>
                          <Ionicons name="musical-notes" size={24} color={colors.accentSolid} />
                        </View>
                        <Text style={{
                          fontFamily: fonts.monoMed,
                          fontSize: 28,
                          color: colors.paper3,
                          letterSpacing: 0.4,
                        }}>
                          {formatTime(audioStatus?.positionMillis || 0)}
                        </Text>
                        <Text style={{
                          fontFamily: fonts.mono,
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.5)',
                          letterSpacing: 1.4,
                          textTransform: 'uppercase',
                          marginTop: 4,
                        }}>
                          of {formatTime(audioStatus?.durationMillis || recordingDuration * 1000)}
                        </Text>
                      </View>

                      {/* Progress bar */}
                      <View
                        style={{
                          height: 2,
                          backgroundColor: 'rgba(255,255,255,0.15)',
                          borderRadius: 1,
                          overflow: 'hidden',
                          marginBottom: 18,
                        }}
                        onTouchEnd={async (event) => {
                          if (audioSound && audioStatus?.durationMillis) {
                            const touchX = event.nativeEvent.locationX;
                            const barWidth = SCREEN_WIDTH - 88; // account for outer padding + inner padding
                            const percentage = Math.max(0, Math.min(1, touchX / barWidth));
                            const newPosition = percentage * audioStatus.durationMillis;
                            await audioSound.setPositionAsync(newPosition);
                          }
                        }}
                      >
                        <View
                          style={{
                            height: '100%',
                            backgroundColor: colors.accentSolid,
                            width: `${audioStatus?.durationMillis ? (audioStatus.positionMillis / audioStatus.durationMillis) * 100 : 0}%`,
                          }}
                        />
                      </View>

                      {/* Playback Controls */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                        <TouchableOpacity
                          onPress={() => seekAudio(false)}
                          style={{
                            width: 44, height: 44, borderRadius: 22,
                            borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="play-back" size={18} color={colors.paper3} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={loadAndPlayAudio}
                          style={{
                            width: 64, height: 64, borderRadius: 32,
                            backgroundColor: colors.paper3,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Ionicons
                            name={isAudioPlaying ? 'pause' : (audioStatus?.didJustFinish ? 'refresh' : 'play')}
                            size={28}
                            color={colors.ink}
                            style={{ marginLeft: isAudioPlaying || audioStatus?.didJustFinish ? 0 : 3 }}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => seekAudio(true)}
                          style={{
                            width: 44, height: 44, borderRadius: 22,
                            borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="play-forward" size={18} color={colors.paper3} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={deleteRecording}
                      activeOpacity={0.85}
                      style={{
                        alignSelf: 'center',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 18,
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderColor: colors.danger,
                        backgroundColor: colors.dangerBg,
                        marginTop: 14,
                      }}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.danger} />
                      <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.danger }}>
                        Delete & re-record
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : isRecording ? (
              // Audio recording in progress — editorial cinematic
              <View>
                <View style={{
                  backgroundColor: colors.ink,
                  borderRadius: radius.lg,
                  padding: 26,
                  alignItems: 'center',
                  ...shadow.soft,
                }}>
                  {/* Status pill */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingVertical: 6, paddingHorizontal: 12,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: isPaused ? colors.warn : 'rgba(180,58,31,0.6)',
                    backgroundColor: isPaused ? 'rgba(198,138,18,0.15)' : 'rgba(180,58,31,0.15)',
                    marginBottom: 18,
                  }}>
                    {isPaused ? (
                      <Ionicons name="pause" size={11} color={colors.warn} />
                    ) : (
                      <LiveDot size={7} color={colors.danger} />
                    )}
                    <Text style={{
                      fontFamily: fonts.monoMed,
                      fontSize: 10,
                      letterSpacing: 1.6,
                      textTransform: 'uppercase',
                      color: isPaused ? colors.warn : colors.danger,
                    }}>
                      {isPaused ? 'Paused' : 'Recording'}
                    </Text>
                  </View>

                  {/* Big mono timer */}
                  <Text style={{
                    fontFamily: fonts.monoMed,
                    fontSize: 56,
                    color: colors.paper3,
                    letterSpacing: 0.4,
                    lineHeight: 60,
                  }}>
                    {formatDuration(recordingDuration)}
                  </Text>
                  <Label tracking={1.8} color={'rgba(255,255,255,0.5)'} style={{ marginTop: 4 }}>
                    ELAPSED
                  </Label>
                </View>

                {/* Question Card — paper */}
                <Card large style={{ padding: 18, marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Label tracking={1.8} color={colors.accent}>ASK THE OWNER</Label>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.ink3, letterSpacing: 1.0 }}>
                      {currentQuestion + 1} / {INTERVIEW_QUESTIONS.length}
                    </Text>
                  </View>
                  <Text style={{
                    fontFamily: fonts.serifIt,
                    fontSize: 22,
                    lineHeight: 28,
                    color: colors.ink,
                    letterSpacing: -0.3,
                    textAlign: 'center',
                    marginVertical: 10,
                  }}>
                    “{INTERVIEW_QUESTIONS[currentQuestion]}”
                  </Text>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={prevQuestion}
                      disabled={currentQuestion === 0}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingVertical: 8, paddingHorizontal: 14,
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderColor: currentQuestion === 0 ? colors.rule : colors.ink,
                        backgroundColor: 'transparent',
                        opacity: currentQuestion === 0 ? 0.45 : 1,
                      }}
                    >
                      <Ionicons name="chevron-back" size={13} color={colors.ink} />
                      <Text style={{ fontFamily: fonts.monoMed, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink }}>
                        Prev
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={nextQuestion}
                      disabled={currentQuestion === INTERVIEW_QUESTIONS.length - 1}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingVertical: 8, paddingHorizontal: 14,
                        borderRadius: radius.pill,
                        backgroundColor: currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? colors.paper2 : colors.ink,
                        opacity: currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? 0.5 : 1,
                      }}
                    >
                      <Text style={{
                        fontFamily: fonts.monoMed, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
                        color: currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? colors.ink3 : colors.paper3,
                      }}>
                        Next
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color={currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? colors.ink3 : colors.paper3} />
                    </TouchableOpacity>
                  </View>
                </Card>

                {/* Recording controls */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 18 }}>
                  {/* Pause / Resume */}
                  <TouchableOpacity
                    onPress={isPaused ? resumeAudioRecording : pauseAudioRecording}
                    activeOpacity={0.85}
                    accessibilityLabel={isPaused ? 'Resume recording' : 'Pause recording'}
                    style={{
                      width: 60, height: 60, borderRadius: 30,
                      borderWidth: 1, borderColor: colors.ink,
                      backgroundColor: 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={isPaused ? 'play' : 'pause'} size={24} color={colors.ink} style={{ marginLeft: isPaused ? 3 : 0 }} />
                  </TouchableOpacity>

                  {/* Stop */}
                  <TouchableOpacity
                    onPress={stopAudioRecording}
                    activeOpacity={0.85}
                    accessibilityLabel="Stop recording"
                    style={{
                      width: 72, height: 72, borderRadius: 36,
                      backgroundColor: colors.ink,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <View style={{ width: 22, height: 22, backgroundColor: colors.paper3, borderRadius: 3 }} />
                  </TouchableOpacity>
                </View>
                <Label tracking={1.6} style={{ textAlign: 'center', marginTop: 10 }}>
                  TAP STOP WHEN DONE
                </Label>
              </View>
            ) : interviewType ? (
              // Ready to Record
              <Card large style={{ padding: 24, alignItems: 'center' }}>
                <Label tracking={1.6}>READY</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', marginTop: 4, marginBottom: 10 }}>
                  <Display size="sm">{interviewType === 'video' ? 'Open the camera, ' : 'Tap record, '}</Display>
                  <Display size="sm" italic color={colors.accent}>{interviewType === 'video' ? 'frame the owner.' : 'begin the take.'}</Display>
                </View>
                <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginBottom: 18, maxWidth: 280 }}>
                  {interviewType === 'video'
                    ? 'Use the front camera, find good light, and let the owner speak.'
                    : 'Find a quiet spot. Use the question card to keep the conversation moving.'}
                </Body>

                {/* Big record button — danger red circle */}
                <TouchableOpacity
                  onPress={interviewType === 'video' ? openVideoCamera : startAudioRecording}
                  activeOpacity={0.85}
                  accessibilityLabel={interviewType === 'video' ? 'Open camera to record video' : 'Start audio recording'}
                  accessibilityRole="button"
                  style={{
                    width: 72, height: 72, borderRadius: 36,
                    backgroundColor: colors.danger,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 3, borderColor: colors.paper3,
                    ...shadow.soft,
                  }}
                >
                  <Ionicons
                    name={interviewType === 'video' ? 'videocam' : 'mic'}
                    size={28}
                    color={colors.paper3}
                  />
                </TouchableOpacity>
                <Label tracking={1.6} style={{ marginTop: 14 }}>
                  {interviewType === 'video' ? 'OPEN CAMERA' : 'START RECORDING'}
                </Label>
              </Card>
            ) : (
              // No type selected — gentle prompt
              <Card style={{ padding: 18, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="chevron-up" size={16} color={colors.ink3} />
                  <Label tracking={1.6}>SELECT VIDEO OR AUDIO ABOVE</Label>
                </View>
              </Card>
            )}
          </View>
        )}

        {/* Spacer to clear bottom CTA */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom CTA bar */}
      <View style={{
        paddingHorizontal: 24,
        paddingTop: 14,
        backgroundColor: colors.paper,
        borderTopWidth: 1,
        borderTopColor: colors.rule,
        paddingBottom: Math.max(insets.bottom, 16),
      }}>
        {/* Upload progress */}
        {loading && uploadProgress > 0 && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ height: 2, backgroundColor: colors.rule, borderRadius: 1, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: `${uploadProgress}%`,
                  backgroundColor: isProcessing ? colors.business : colors.ink,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : null}
              <Label tracking={1.4} color={isProcessing ? colors.warn : colors.ink3}>
                {isProcessing ? 'PROCESSING ON SERVER…' : `${uploadProgress}% UPLOADED`}
              </Label>
            </View>
          </View>
        )}

        <Door
          caption="CONTINUE"
          label={
            loading
              ? (isProcessing
                  ? 'Processing…'
                  : uploadProgress > 0
                    ? `Uploading… ${uploadProgress}%`
                    : 'Preparing upload…')
              : 'Continue to review'
          }
          variant="solid"
          loading={loading}
          disabled={!canContinue}
          onPress={handleNext}
          rightIcon={loading ? <ActivityIndicator color={colors.paper3} /> : undefined}
          accessibilityLabel="Continue to review step"
        />
      </View>

      {/* Video Camera Modal — ink dark by design (camera surface) */}
      <Modal
        visible={showCamera}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isVideoRecording) {
            setShowCamera(false);
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing={facing}
            mode="video"
          >
            <SafeAreaView style={{ flex: 1 }}>
              {/* Top Bar */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingTop: 8,
              }}>
                <TouchableOpacity
                  onPress={() => !isVideoRecording && setShowCamera(false)}
                  disabled={isVideoRecording}
                  accessibilityLabel="Close camera"
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.monoMed, fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.6, textTransform: 'uppercase' }}>
                    INTERVIEW
                  </Text>
                  <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: '#fff', letterSpacing: -0.3, marginTop: 2 }}>
                    Owner interview
                  </Text>
                </View>

                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: radius.pill,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                }}>
                  <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, color: '#fff', letterSpacing: 1.0 }}>
                    {currentQuestion + 1}/{INTERVIEW_QUESTIONS.length}
                  </Text>
                </View>
              </View>

              {/* Lighting tip */}
              {showLightingTip && !isVideoRecording && (
                <View style={{ marginHorizontal: 18, marginTop: 14 }}>
                  <View style={{
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    borderRadius: radius.md,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: 'rgba(198,138,18,0.25)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="sunny" size={20} color={colors.warn} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.monoMed, fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.6, textTransform: 'uppercase' }}>
                        LIGHTING TIP
                      </Text>
                      <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: '#fff', marginTop: 2 }}>
                        Face a light source for best results.
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowLightingTip(false)}
                      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                      accessibilityLabel="Dismiss lighting tip"
                    >
                      <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Recording timer */}
              {isVideoRecording && (
                <View style={{ alignItems: 'center', marginTop: 16 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: recordingDuration >= 180 ? colors.warn : 'rgba(180,58,31,0.7)',
                    backgroundColor: recordingDuration >= 180 ? 'rgba(198,138,18,0.85)' : 'rgba(180,58,31,0.85)',
                  }}>
                    <LiveDot size={7} color="#fff" />
                    <Text style={{ fontFamily: fonts.monoMed, fontSize: 16, color: '#fff', letterSpacing: 0.6 }}>
                      {formatDuration(recordingDuration)}
                    </Text>
                  </View>
                  {recordingDuration >= 180 && (
                    <Text style={{
                      fontFamily: fonts.mono,
                      fontSize: 10,
                      color: colors.warn,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      marginTop: 8,
                      textAlign: 'center',
                      paddingHorizontal: 18,
                    }}>
                      Long videos may take longer to upload
                    </Text>
                  )}
                </View>
              )}

              <View style={{ flex: 1 }} />

              {/* Question card overlay */}
              <View style={{ marginHorizontal: 18, marginBottom: 16 }}>
                <View style={{
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: radius.lg,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="chatbubble-outline" size={13} color={colors.accentSolid} />
                    <Text style={{ fontFamily: fonts.monoMed, fontSize: 10, color: colors.accentSolid, letterSpacing: 1.6, textTransform: 'uppercase' }}>
                      Ask the owner
                    </Text>
                  </View>
                  <Text style={{
                    fontFamily: fonts.serifIt,
                    fontSize: 20,
                    lineHeight: 26,
                    color: '#fff',
                    letterSpacing: -0.3,
                    textAlign: 'center',
                    marginVertical: 6,
                  }}>
                    “{INTERVIEW_QUESTIONS[currentQuestion]}”
                  </Text>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={prevQuestion}
                      disabled={currentQuestion === 0}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 14, paddingVertical: 8,
                        borderRadius: radius.pill,
                        backgroundColor: currentQuestion === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
                        opacity: currentQuestion === 0 ? 0.5 : 1,
                      }}
                    >
                      <Ionicons name="chevron-back" size={14} color={currentQuestion === 0 ? 'rgba(255,255,255,0.4)' : '#fff'} />
                      <Text style={{
                        fontFamily: fonts.monoMed, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
                        color: currentQuestion === 0 ? 'rgba(255,255,255,0.4)' : '#fff',
                      }}>
                        Prev
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={nextQuestion}
                      disabled={currentQuestion === INTERVIEW_QUESTIONS.length - 1}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 14, paddingVertical: 8,
                        borderRadius: radius.pill,
                        backgroundColor: currentQuestion === INTERVIEW_QUESTIONS.length - 1
                          ? 'rgba(255,255,255,0.06)'
                          : colors.accent,
                        opacity: currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? 0.5 : 1,
                      }}
                    >
                      <Text style={{
                        fontFamily: fonts.monoMed, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
                        color: currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? 'rgba(255,255,255,0.4)' : '#fff',
                      }}>
                        Next
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? 'rgba(255,255,255,0.4)' : '#fff'} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Bottom controls */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-around',
                paddingHorizontal: 32,
                paddingBottom: 28,
              }}>
                {/* Flip Camera */}
                <TouchableOpacity
                  onPress={toggleCameraFacing}
                  disabled={isVideoRecording}
                  accessibilityLabel="Flip camera"
                  style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    alignItems: 'center', justifyContent: 'center',
                    opacity: isVideoRecording ? 0.4 : 1,
                  }}
                >
                  <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
                </TouchableOpacity>

                {/* Record button — danger red circle */}
                <TouchableOpacity
                  onPress={isVideoRecording ? stopVideoRecording : startVideoRecording}
                  accessibilityLabel={isVideoRecording ? 'Stop video recording' : 'Start video recording'}
                  accessibilityRole="button"
                  style={{
                    width: 80, height: 80, borderRadius: 40,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isVideoRecording ? 'transparent' : colors.danger,
                    borderWidth: 4,
                    borderColor: '#fff',
                  }}
                >
                  {isVideoRecording ? (
                    <View style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: colors.danger }} />
                  ) : (
                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.danger }} />
                  )}
                </TouchableOpacity>

                {/* Done / Cancel */}
                <TouchableOpacity
                  onPress={() => {
                    if (isVideoRecording) {
                      stopVideoRecording();
                    } else {
                      setShowCamera(false);
                    }
                  }}
                  accessibilityLabel={isVideoRecording ? 'Finish recording' : 'Cancel'}
                  style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name={isVideoRecording ? 'checkmark' : 'close'} size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </CameraView>
        </View>
      </Modal>

      {/* Fullscreen Video Modal — ink dark by design */}
      <Modal
        visible={showFullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeFullscreen}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
              <TouchableOpacity
                onPress={closeFullscreen}
                accessibilityLabel="Close fullscreen"
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={toggleVideoPlayback}
              style={{ flex: 1 }}
            >
              <Video
                ref={fullscreenVideoRef}
                source={{ uri: recordingUri || '' }}
                style={{ flex: 1, width: SCREEN_WIDTH }}
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                onPlaybackStatusUpdate={handleVideoStatusUpdate}
              />
              {!isVideoPlaying && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <View style={{
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: 'rgba(248,245,238,0.92)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons
                      name={videoStatus?.didJustFinish ? 'refresh' : 'play'}
                      size={36}
                      color={colors.ink}
                      style={{ marginLeft: videoStatus?.didJustFinish ? 0 : 3 }}
                    />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Fullscreen Controls */}
            <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
              {/* Mono timeline */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: 'rgba(255,255,255,0.7)', width: 48, letterSpacing: 0.4 }}>
                  {formatTime(videoStatus?.positionMillis || 0)}
                </Text>
                <View
                  style={{ flex: 1, height: 32, justifyContent: 'center' }}
                  onTouchEnd={(event) => {
                    const touchX = event.nativeEvent.locationX;
                    const barWidth = SCREEN_WIDTH - 64 - 96; // padding + time labels
                    if (fullscreenVideoRef.current && videoStatus?.durationMillis) {
                      const percentage = Math.max(0, Math.min(1, touchX / barWidth));
                      const newPosition = percentage * videoStatus.durationMillis;
                      fullscreenVideoRef.current.setPositionAsync(newPosition);
                    }
                  }}
                >
                  <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        backgroundColor: colors.accentSolid,
                        width: `${videoStatus?.durationMillis ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 : 0}%`,
                      }}
                    />
                  </View>
                  <View
                    style={{
                      position: 'absolute',
                      width: 14, height: 14, borderRadius: 7,
                      backgroundColor: colors.accentSolid,
                      borderWidth: 2,
                      borderColor: '#fff',
                      left: `${videoStatus?.durationMillis ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 : 0}%`,
                      marginLeft: -7,
                      top: 9,
                    }}
                  />
                </View>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: 'rgba(255,255,255,0.7)', width: 48, textAlign: 'right', letterSpacing: 0.4 }}>
                  {formatTime(videoStatus?.durationMillis || 0)}
                </Text>
              </View>

              {/* Playback Controls */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <TouchableOpacity
                  onPress={async () => {
                    if (fullscreenVideoRef.current && videoStatus?.positionMillis) {
                      await fullscreenVideoRef.current.setPositionAsync(Math.max(0, videoStatus.positionMillis - 10000));
                    }
                  }}
                  style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="play-back" size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={toggleVideoPlayback}
                  style={{
                    width: 64, height: 64, borderRadius: 32,
                    backgroundColor: colors.paper3,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={isVideoPlaying ? 'pause' : (videoStatus?.didJustFinish ? 'refresh' : 'play')}
                    size={28}
                    color={colors.ink}
                    style={{ marginLeft: isVideoPlaying || videoStatus?.didJustFinish ? 0 : 3 }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    if (fullscreenVideoRef.current && videoStatus?.positionMillis && videoStatus?.durationMillis) {
                      await fullscreenVideoRef.current.setPositionAsync(Math.min(videoStatus.durationMillis, videoStatus.positionMillis + 10000));
                    }
                  }}
                  style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="play-forward" size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={closeFullscreen}
                  style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center', justifyContent: 'center',
                    marginLeft: 8,
                  }}
                >
                  <Ionicons name="contract" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
