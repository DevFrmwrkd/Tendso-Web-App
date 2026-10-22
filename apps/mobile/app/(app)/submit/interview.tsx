/**
 * Field-agent interview step — design v2. Recording uses the shared camera
 * (components/v2/capture/InterviewCam, continuous mode): full-bleed, no outline, the
 * 10 simple questions as subtitles (FEATURES-QUESTIONS Q25), Next as the biggest control,
 * audio-only fallback.
 *
 * The upload + submission contract is unchanged: one recording → R2 (videos/ or audio/),
 * then submissions.update({ videoStorageId, audioStorageId }) — for video the parallel
 * audio file is the transcription source. Offline: the recording is kept in
 * `submission_pending_interview` for useOfflineSync, exactly as before.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Id } from '@tendso/convex-client';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Button, ProgressBar, ScreenShell, Text } from '../../../components/v2';
import { Buddy } from '../../../components/v2/owner/OwnerUI';
import { InterviewCam, type InterviewResult } from '../../../components/v2/capture';
import { formatClock } from '../../../components/v2/capture/level';
import { colors, radius, space } from '../../../theme/v2';
import { useGuardedPress } from '../../../hooks/useGuardedPress';

type InterviewType = 'video' | 'audio' | null;

export default function SubmitInterviewScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : 'skip');
  const { isConnected } = useNetwork();
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);
  const goBack = useGuardedPress(() => router.back());

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [interviewType, setInterviewType] = useState<InterviewType>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [parallelAudioUri, setParallelAudioUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasExistingRecording, setHasExistingRecording] = useState(false);
  const [wantsToReRecord, setWantsToReRecord] = useState(false);
  const [camera, setCamera] = useState<null | { audioOnly: boolean }>(null);

  const isOfflinePending = submissionId === 'offline_pending';
  const submission = useQuery(
    api.submissions.getById,
    submissionId && !isOfflinePending ? { id: submissionId as Id<'submissions'> } : 'skip',
  );

  // Load submission ID (same contract as before).
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  useEffect(() => {
    if (submission?.videoStorageId) {
      setHasExistingRecording(true);
    } else if (submission?.audioStorageId) {
      setHasExistingRecording(true);
    }
  }, [submission]);

  const onFinish = (r: InterviewResult) => {
    setCamera(null);
    if (!r.uri) {
      setError('The recording did not save. Please try again.');
      return;
    }
    setInterviewType(r.kind);
    setRecordingUri(r.uri);
    setParallelAudioUri(r.parallelAudioUri ?? null);
    setRecordingDuration(r.durationSec);
    setError(null);
  };

  const deleteRecording = () => {
    setRecordingUri(null);
    setParallelAudioUri(null);
    setRecordingDuration(0);
    setInterviewType(null);
    if (hasExistingRecording) setWantsToReRecord(false);
  };

  const handleNext = async () => {
    if (!submissionId) return;
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
      } catch {
        setError('Failed to save recording locally');
      }
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setError(null);

    const uploadFile = async (uri: string, folder: string, contentType: string, fileName: string, trackProgress = true): Promise<string> => {
      const { uploadUrl, fileKey } = await generateR2UploadUrl({ folder, filename: fileName, contentType });
      let fileUri = uri;
      if (Platform.OS === 'android' && !fileUri.startsWith('file://')) fileUri = 'file://' + fileUri;
      if (trackProgress) setUploadProgress(0.1);
      const blob = await (await fetch(fileUri)).blob();
      const uploadResult = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
      if (trackProgress) setUploadProgress(1);
      if (uploadResult.ok) return fileKey;
      throw new Error(`Upload failed with status ${uploadResult.status}`);
    };

    try {
      if (recordingUri && interviewType) {
        const contentType = interviewType === 'video' ? 'video/mp4' : 'audio/m4a';
        const fileName = interviewType === 'video' ? 'interview.mp4' : 'interview.m4a';
        const folder = interviewType === 'video' ? 'videos' : 'audio';
        const fileKey = await uploadFile(recordingUri, folder, contentType, fileName, true);

        // Payout is computed server-side at submit time (50% of the agent's price).
        if (interviewType === 'video') {
          let transcriptionAudioKey: string | undefined;
          if (parallelAudioUri) {
            try {
              transcriptionAudioKey = await uploadFile(parallelAudioUri, 'audio', 'audio/m4a', 'interview-audio.m4a', false);
            } catch (audioErr) {
              console.warn('[Interview] Parallel audio upload failed, transcription will use the video:', audioErr);
            }
          }
          await updateSubmission({ id: submissionId as Id<'submissions'>, videoStorageId: fileKey, audioStorageId: transcriptionAudioKey });
        } else {
          await updateSubmission({ id: submissionId as Id<'submissions'>, audioStorageId: fileKey });
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

  if ((isConnected && (!isLoaded || creator === undefined)) || !submissionId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  const cam = (
    <Modal visible={camera !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setCamera(null)} statusBarTranslucent>
      {camera ? (
        <InterviewCam
          recording="continuous"
          facing="back"
          audioOnly={camera.audioOnly}
          onFinish={onFinish}
          onClose={() => setCamera(null)}
        />
      ) : null}
    </Modal>
  );

  // A new recording to check.
  if (recordingUri) {
    return (
      <ScreenShell
        title="Interview recorded."
        subtitle={formatClock(recordingDuration)}
        onBack={goBack}
        footer={
          <>
            {loading ? <ProgressBar value={uploadProgress} tone="accent" label="Uploading interview" /> : null}
            {error ? <Text tone="danger" align="center">{error}</Text> : null}
            <Button title={isConnected ? 'Continue' : 'Save and continue'} loading={loading} onPress={handleNext} />
            <Button title="Record again" variant="ghost" disabled={loading} onPress={deleteRecording} />
          </>
        }
      >
        <OfflineBanner />
        <Playback uri={recordingUri} kind={interviewType ?? 'audio'} />
      </ScreenShell>
    );
  }

  // Already recorded earlier.
  if (hasExistingRecording && !wantsToReRecord) {
    return (
      <ScreenShell
        title="Interview saved."
        onBack={goBack}
        scroll={false}
        footer={
          <>
            {error ? <Text tone="danger" align="center">{error}</Text> : null}
            <Button title="Continue" onPress={handleNext} />
            <Button title="Record again" variant="ghost" onPress={() => setWantsToReRecord(true)} />
          </>
        }
      >
        <View style={styles.center}>
          <View style={styles.ok}><Ionicons name="checkmark" size={52} color={colors.onAccent} /></View>
        </View>
      </ScreenShell>
    );
  }

  // Talk start (SIMPLE-FLOWS C5).
  return (
    <ScreenShell
      onBack={goBack}
      scroll={false}
      footer={
        <>
          {error ? <Text tone="danger" align="center">{error}</Text> : null}
          <Button title="Start" onPress={() => setCamera({ audioOnly: false })} />
          <Pressable onPress={() => setCamera({ audioOnly: true })} accessibilityRole="button" hitSlop={8} style={styles.link}>
            <Text weight="bold" align="center">Voice only, no video</Text>
          </Pressable>
        </>
      }
    >
      <OfflineBanner />
      <View style={styles.center}>
        <Buddy size={168} />
        <Text variant="display" align="center" accessibilityRole="header">Now ask 10 questions.</Text>
      </View>
      {cam}
    </ScreenShell>
  );
}

/** Watch / listen back before sending. */
function Playback({ uri, kind }: { uri: string; kind: 'video' | 'audio' }) {
  const sound = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { sound.current?.unloadAsync().catch(() => {}); }, []);

  if (kind === 'video') {
    return (
      <View style={styles.video}>
        <Video source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} useNativeControls isLooping={false} />
      </View>
    );
  }
  const toggle = async () => {
    try {
      if (!sound.current) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (st: any) => setPlaying(!!st.isPlaying));
        sound.current = s;
        return;
      }
      if (playing) await sound.current.pauseAsync();
      else await sound.current.replayAsync();
    } catch (e) {
      console.warn('[Interview] playback failed', e);
    }
  };
  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} style={styles.audio}>
      <View style={styles.play}><Ionicons name={playing ? 'pause' : 'play'} size={36} color={colors.onAccent} /></View>
      <Text weight="bold">{playing ? 'Playing' : 'Listen back'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  link: { minHeight: 48, justifyContent: 'center' },
  ok: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  video: { height: 420, borderRadius: radius.cardLg, overflow: 'hidden', backgroundColor: colors.camera, marginTop: space.md },
  audio: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, borderRadius: radius.cardLg, backgroundColor: colors.card, marginTop: space.md },
  play: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
