/**
 * Field-agent capture, step 3: preview the ten bilingual questions, record one
 * continuous take and keep a local copy before uploading or moving to review.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Banner, Button, Card, Loading, ProgressBar, ScreenShell, Text, TextLink } from '../../../components/v2';
import { InterviewCam, type InterviewResult } from '../../../components/v2/capture';
import { formatClock } from '../../../components/v2/capture/level';
import { EXTRA_QUESTION, INTERVIEW_QUESTIONS, type Lang } from '../../../lib/v2/captureContent';
import { colors, hit, radius, shadow, space } from '../../../theme/v2';

type CaptureSession = ReturnType<typeof useCaptureSession>;
type RecordingDraft = {
  submissionId: string;
  recordingUri: string;
  parallelAudioUri: string | null;
  type: 'video' | 'audio';
  durationSec: number;
  lang: Lang;
  interrupted?: boolean;
  savedAt: number;
  storageId?: string;
  audioStorageId?: string;
  attached?: boolean;
};

function recordingFor(value: unknown, submissionId: string): RecordingDraft | null {
  const draft = value as Partial<RecordingDraft> | null;
  if (!draft || draft.submissionId !== submissionId || !draft.recordingUri
    || typeof draft.recordingUri !== 'string' || !['video', 'audio'].includes(draft.type ?? '')) return null;
  return {
    ...draft,
    type: draft.type as 'video' | 'audio',
    submissionId,
    recordingUri: draft.recordingUri,
    parallelAudioUri: typeof draft.parallelAudioUri === 'string' ? draft.parallelAudioUri : null,
    durationSec: Number.isFinite(draft.durationSec) ? Math.max(0, draft.durationSec!) : 0,
    lang: draft.lang === 'tl' ? 'tl' : 'en',
    savedAt: draft.savedAt ?? 0,
  };
}

export default function SubmitInterviewScreen() {
  const session = useCaptureSession();
  if (!session.isReady) return <Loading />;
  if (!session.actor) return <ScreenShell title="Reconnect to open your interview"
    subtitle="Sign in with the field-agent account that started this capture." />;
  return <InterviewStep key={session.actorKey} session={session} />;
}

function InterviewStep({ session }: { session: CaptureSession }) {
  const router = useGuardedRouter();
  const generateUploadUrl = useAction(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState<RecordingDraft | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [retaking, setRetaking] = useState(false);
  const [camera, setCamera] = useState<{ audioOnly: boolean } | null>(null);
  const [closeRequest, setCloseRequest] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const persisted = useRef(true);
  const live = useRef(session);
  live.current = session;
  const current = () => mounted.current && live.current.isCurrent();
  const submission = useQuery(api.submissions.getById,
    session.canQuery && submissionId && submissionId !== 'offline_pending'
      ? { id: submissionId as Id<'submissions'> } : 'skip');
  const hasExisting = !!(submission?.videoStorageId || submission?.audioStorageId);
  const latest = useRef({ recording, camera, loading });
  latest.current = { recording, camera, loading };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => {
      try {
        let id = await live.current.read<string>('current_submission_id');
        if (!current() || !active) return;
        if (!id && await live.current.read('submission_pending_sync')) {
          id = 'offline_pending';
          await live.current.write('current_submission_id', id);
        }
        if (!current() || !active) return;
        if (!id) { router.replace('/(app)/(tabs)/dashboard'); return; }
        const draft = recordingFor(await live.current.read('submission_interview_draft'), id)
          ?? recordingFor(await live.current.read('submission_pending_interview'), id);
        if (!current() || !active) return;
        setSubmissionId(id);
        setRecording(draft);
        if (draft) setLang(draft.lang);
      } catch {
        if (current() && active) setError('Could not open your saved interview. Go back and reopen this capture.');
      } finally {
        if (current() && active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, [session.revision]));

  const goBack = useCallback(() => {
    if (busy.current) return;
    if (latest.current.camera) { setCloseRequest(value => value + 1); return; }
    if (latest.current.recording && !persisted.current) {
      Alert.alert('Recording not saved on this phone', 'Keep this screen open and try Continue again to save it.', [
        { text: 'Keep recording', style: 'cancel' },
        { text: 'Leave without saving', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }, [router]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => listener.remove();
  }, [goBack]));

  const persist = async (draft: RecordingDraft) => {
    await live.current.write('submission_interview_draft', draft);
    if (!current()) return false;
    persisted.current = true;
    return true;
  };
  const onFinish = async (result: InterviewResult) => {
    if (!current() || !submissionId || busy.current) return;
    setCamera(null);
    if (!result.uri) { setError('The recording did not save. Please try again.'); return; }
    const draft: RecordingDraft = {
      submissionId, recordingUri: result.uri, parallelAudioUri: result.parallelAudioUri ?? null,
      type: result.kind, durationSec: result.durationSec, lang: result.lang,
      interrupted: result.interrupted, savedAt: Date.now(), attached: false,
    };
    setRecording(draft); setRetaking(false); setLang(result.lang);
    persisted.current = false;
    busy.current = true; setLoading(true); setError(null);
    try { await persist(draft); }
    catch { if (current()) setError('Could not save this recording on your phone. Keep this screen open and try Continue again.'); }
    finally { busy.current = false; if (mounted.current) setLoading(false); }
  };
  const openCamera = (audioOnly: boolean) => {
    if (busy.current || !current() || !submissionId || camera) return;
    setCloseRequest(0); setError(null); setCamera({ audioOnly });
  };
  const recordAgain = () => Alert.alert('Record another take?', 'Your saved interview stays available until the new recording is ready.', [
    { text: 'Keep this take', style: 'cancel' },
    { text: 'Record again', onPress: () => { if (!busy.current && current()) setRetaking(true); } },
  ]);

  const handleNext = async () => {
    if (busy.current || !current() || !submissionId || (!recording && !hasExisting)) return;
    busy.current = true; setLoading(true); setProgress(0); setError(null);
    const origin = live.current;
    const valid = () => mounted.current && origin.isCurrent();
    const online = () => valid() && origin.canMutate();
    try {
      // A queued draft may have acquired its real server id while recording.
      const storedId = await origin.read<string>('current_submission_id');
      if (!valid()) return;
      const targetId = storedId || submissionId;
      let draft = recording ? { ...recording, submissionId: targetId } : null;
      if (draft) {
        if (!await persist(draft)) return;
        if (targetId !== submissionId) { setSubmissionId(targetId); setRecording(draft); }
      }
      if (!online() || targetId === 'offline_pending') {
        if (draft) await origin.write('submission_pending_interview', draft);
        if (valid()) router.push('/(app)/submit/review');
        return;
      }
      const upload = async (uri: string, folder: string, contentType: string, filename: string) => {
        if (!online()) throw new Error('Reconnect to upload. Your recording is saved on this phone.');
        const target = await generateUploadUrl({ folder, filename, contentType });
        if (!online()) throw new Error('Your capture connection changed. Your recording is saved on this phone.');
        const localUri = Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://')
          ? 'file://' + uri : uri;
        const body = await (await fetch(localUri)).blob();
        if (!online()) throw new Error('Reconnect to finish uploading. Your recording is saved on this phone.');
        const response = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
        if (!response.ok) throw new Error('Could not upload the recording. Your saved take is ready to retry.');
        if (!valid()) throw new Error('Your capture account changed.');
        return target.fileKey;
      };
      if (draft) {
        if (!draft.storageId) {
          const storageId = await upload(draft.recordingUri, draft.type === 'video' ? 'videos' : 'audio',
            draft.type === 'video' ? 'video/mp4' : 'audio/m4a', draft.type === 'video' ? 'interview.mp4' : 'interview.m4a');
          draft = { ...draft, storageId };
          if (!valid()) return;
          setRecording(draft);
          await persist(draft);
        }
        setProgress(0.65);
        if (draft.type === 'video' && draft.parallelAudioUri && !draft.audioStorageId) {
          // Retain both source files and retry instead of silently dropping the
          // separate audio used by transcription.
          const audioStorageId = await upload(draft.parallelAudioUri, 'audio', 'audio/m4a', 'interview-audio.m4a');
          draft = { ...draft, audioStorageId };
          if (!valid()) return;
          setRecording(draft);
          await persist(draft);
        }
        if (!online()) throw new Error('Reconnect to finish saving your interview. Your recording is saved on this phone.');
        const alreadyAttached = draft.type === 'video'
          ? submission?.videoStorageId === draft.storageId && (!draft.audioStorageId || submission?.audioStorageId === draft.audioStorageId)
          : submission?.audioStorageId === draft.storageId;
        if (!alreadyAttached) {
          if (draft.type === 'video') await updateSubmission({
            id: targetId as Id<'submissions'>, videoStorageId: draft.storageId, audioStorageId: draft.audioStorageId,
          });
          else await updateSubmission({ id: targetId as Id<'submissions'>, audioStorageId: draft.storageId });
        }
        if (!valid()) return;
        draft = { ...draft, attached: true };
        setRecording(draft);
        await persist(draft);
        if (!valid()) return;
        setProgress(1);
        await origin.remove('submission_pending_interview');
      }
      if (valid()) router.push('/(app)/submit/review');
    } catch (cause) {
      if (valid()) setError(cause instanceof Error ? cause.message : 'Could not save your interview. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  if (!ready || (session.canQuery && submissionId && submissionId !== 'offline_pending' && submission === undefined && !recording)) return <Loading />;
  if (!submissionId) return <ScreenShell title="Could not open your interview" onBack={goBack}>
    <Banner tone="danger" body={error ?? 'Go back and reopen this capture.'} />
  </ScreenShell>;
  if (session.canQuery && submissionId !== 'offline_pending' && submission === null) return <ScreenShell
    title="Capture unavailable" subtitle="Go back and reopen the business you are capturing." onBack={goBack} />;

  const modal = <Modal visible={camera !== null} animationType="fade" presentationStyle="fullScreen"
    onRequestClose={() => setCloseRequest(value => value + 1)} statusBarTranslucent>
    {camera ? <InterviewCam recording="continuous" facing="back" audioOnly={camera.audioOnly} lang={lang}
      closeRequest={closeRequest} onFinish={result => { void onFinish(result); }} onClose={() => setCamera(null)} /> : null}
  </Modal>;

  if ((recording || hasExisting) && !retaking) return <ScreenShell title={recording ? 'Interview recorded.' : 'Interview saved.'}
    subtitle={recording ? formatClock(recording.durationSec) : 'Your interview is attached to this capture.'}
    progress={0.75} onBack={goBack} contentStyle={styles.content}
    footer={<>
      {loading ? <ProgressBar value={progress} tone="accent" label="Saving interview" /> : null}
      {error ? <Banner tone="danger" body={error} /> : null}
      <Button title={session.isOffline ? 'Save and continue' : 'Continue'} loading={loading} onPress={() => { void handleNext(); }} />
      <Button title="Record again" variant="ghost" disabled={loading} onPress={recordAgain} />
    </>}>
    <OfflineBanner />
    {recording?.interrupted ? <Banner tone="warn" title="Your recording stopped early"
      body="The take so far is saved. Listen back, or record again to finish the questions." /> : null}
    {recording ? <Playback key={recording.recordingUri} uri={recording.recordingUri} kind={recording.type} /> :
      <Card style={styles.saved}><Ionicons name="checkmark-circle" size={64} color={colors.ink} />
        <Text variant="body" align="center">You can continue or record a replacement.</Text></Card>}
    {modal}
  </ScreenShell>;

  return <ScreenShell title="Now ask the owner." subtitle="10 short questions. About 5 minutes."
    progress={0.75} onBack={goBack} contentStyle={styles.content}
    headerRight={<Pressable accessibilityRole="button" accessibilityLabel={lang === 'en' ? 'Switch to Tagalog' : 'Switch to English'}
      onPress={() => setLang(value => value === 'en' ? 'tl' : 'en')} style={styles.language}>
      <Ionicons name="language-outline" size={20} color={colors.ink} /><Text variant="label">{lang.toUpperCase()}</Text>
    </Pressable>}
    footer={<>
      {error ? <Banner tone="danger" body={error} /> : null}
      <Button title="Start" icon="videocam-outline" disabled={loading} onPress={() => openCamera(false)} />
      <Button title="Voice only, no video" variant="ghost" icon="mic-outline" disabled={loading} onPress={() => openCamera(true)} />
      {recording || hasExisting ? <TextLink label="Keep saved recording" onPress={() => setRetaking(false)} style={styles.keep} /> : null}
    </>}>
    <OfflineBanner />
    <QuestionPreview lang={lang} />
    <Text variant="body" tone="ink2">Ask one question at a time. Let the owner answer in their own words.</Text>
    <Text variant="label" tone="muted">One recording, from the first question to “{EXTRA_QUESTION[lang]}”.</Text>
    {modal}
  </ScreenShell>;
}

function QuestionPreview({ lang }: { lang: Lang }) {
  const [index, setIndex] = useState(0);
  const questions = [...INTERVIEW_QUESTIONS, EXTRA_QUESTION];
  return <View style={styles.preview}>
    <View style={styles.stack}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.stackBack, styles.stackFar]} />
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.stackBack, styles.stackNear]} />
      <Card style={styles.questionCard}>
        <View style={styles.number}><Text variant="label" weight="bold">{index < 10 ? index + 1 : '+'}</Text></View>
        <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">{questions[index][lang]}</Text>
      </Card>
    </View>
    <View style={styles.questionNav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Preview previous question" disabled={index === 0}
        accessibilityState={{ disabled: index === 0 }} onPress={() => setIndex(value => Math.max(0, value - 1))}
        style={[styles.navButton, index === 0 ? styles.disabled : null]}>
        <Ionicons name="arrow-back" size={22} color={colors.ink} />
      </Pressable>
      <Text variant="label" tone="muted">{index < 10 ? `Question ${index + 1} of 10` : 'Anything else · optional'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Preview next question" disabled={index === 10}
        accessibilityState={{ disabled: index === 10 }} onPress={() => setIndex(value => Math.min(10, value + 1))}
        style={[styles.navButton, index === 10 ? styles.disabled : null]}>
        <Ionicons name="arrow-forward" size={22} color={colors.ink} />
      </Pressable>
    </View>
  </View>;
}

/** Watch or listen back before continuing. Playback never records audio. */
function Playback({ uri, kind }: { uri: string; kind: 'video' | 'audio' }) {
  const sound = useRef<Audio.Sound | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void sound.current?.unloadAsync().catch(() => {}); };
  }, []);
  if (kind === 'video') return <View style={styles.video}>
    <Video source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.CONTAIN} useNativeControls isLooping={false} />
  </View>;
  const toggle = async () => {
    if (busy.current) return;
    busy.current = true; setError(false);
    try {
      if (!sound.current) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        if (!mounted.current) return;
        const { sound: next } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (status: any) => {
          if (mounted.current) setPlaying(!!status.isPlaying);
        });
        if (!mounted.current) { await next.unloadAsync(); return; }
        sound.current = next;
      } else if (playing) await sound.current.pauseAsync();
      else {
        const status = await sound.current.getStatusAsync();
        if (status.isLoaded && status.didJustFinish) await sound.current.replayAsync();
        else await sound.current.playAsync();
      }
    } catch { if (mounted.current) setError(true); }
    finally { busy.current = false; }
  };
  return <View style={styles.audio}>
    <Button title={playing ? 'Pause playback' : 'Listen back'} icon={playing ? 'pause' : 'play'} onPress={() => { void toggle(); }} />
    {error ? <Text tone="danger">Could not play this recording. You can record another take.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: space.lg }, language: { minHeight: hit.icon, paddingHorizontal: space.md, borderRadius: radius.pill,
    backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  preview: { marginTop: space.xl, gap: space.xl }, stack: { paddingBottom: 32 },
  stackBack: { position: 'absolute', height: '92%', borderRadius: radius.tile, backgroundColor: colors.card, ...shadow.soft },
  stackNear: { left: 10, right: 10, top: 16, opacity: 0.65 }, stackFar: { left: 20, right: 20, top: 32, opacity: 0.35 },
  questionCard: { minHeight: 180, padding: space.xl, gap: space.md, borderRadius: radius.tile },
  number: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  questionNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  navButton: { width: hit.icon, height: hit.icon, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 }, keep: { alignSelf: 'center' },
  video: { height: 380, borderRadius: radius.cardLg, overflow: 'hidden', backgroundColor: colors.camera },
  audio: { padding: space.xl, backgroundColor: colors.card, borderRadius: radius.cardLg, gap: space.md },
  saved: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
});
