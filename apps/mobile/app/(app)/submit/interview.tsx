/**
 * Field-agent capture, step 3: preview the ten bilingual questions, record one
 * continuous take and keep a local copy before uploading or moving to review.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import { InterviewPlayback } from '../../../components/field-agent/InterviewPlayback';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useCaptureProgress } from '../../../hooks/useCaptureProgress';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Banner, Button, Card, Loading, ProgressBar, ScreenShell, Text, TextLink } from '../../../components/v2';
import { InterviewCam, type InterviewResult } from '../../../components/v2/capture';
import { formatClock } from '../../../components/v2/capture/level';
import { EXTRA_QUESTION, INTERVIEW_QUESTIONS, type Lang } from '../../../lib/v2/captureContent';
import { colors, hit, radius, shadow, space } from '../../../theme/v2';
import { isEditableCaptureStatus, cachedRejectedCapture, type CaptureSnapshot } from '../../../services/captureEdit';
import { retainCaptureRecording } from '../../../services/captureRecordingFiles';

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
    || typeof draft.recordingUri !== 'string' || !draft.recordingUri.trim() || !['video', 'audio'].includes(draft.type ?? '')) return null;
  return {
    ...draft,
    type: draft.type as 'video' | 'audio',
    submissionId,
    recordingUri: draft.recordingUri.trim(),
    parallelAudioUri: typeof draft.parallelAudioUri === 'string' && draft.parallelAudioUri.trim() ? draft.parallelAudioUri.trim() : null,
    durationSec: Number.isFinite(draft.durationSec) ? Math.max(0, draft.durationSec!) : 0,
    lang: draft.lang === 'tl' ? 'tl' : 'en',
    savedAt: Number.isFinite(draft.savedAt) ? draft.savedAt! : 0,
    storageId: typeof draft.storageId === 'string' && draft.storageId.trim() ? draft.storageId.trim() : undefined,
    audioStorageId: typeof draft.audioStorageId === 'string' && draft.audioStorageId.trim() ? draft.audioStorageId.trim() : undefined,
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
  const { resumed, returnTo, draftId: requestedId } = useLocalSearchParams<{ resumed?: string; returnTo?: string; draftId?: string }>();
  const generateUploadUrl = useAction(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [savedCapture, setSavedCapture] = useState<CaptureSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState<RecordingDraft | null>(null);
  const [missingMedia, setMissingMedia] = useState({ primary: false, audio: false });
  const [lang, setLang] = useState<Lang>('en');
  const [retaking, setRetaking] = useState(false);
  const [camera, setCamera] = useState<{ audioOnly: boolean; submissionId: string; run: number } | null>(null);
  const cameraSequence = useRef(0);
  const [closeRequest, setCloseRequest] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const persisted = useRef(true);
  const draftId = useRef<string | null>(null);
  const migratedDraftId = useRef<string | null>(null);
  const live = useRef(session);
  live.current = session;
  const current = () => mounted.current && live.current.isCurrent();
  const serverSubmission = useQuery(api.submissions.getById,
    session.canQuery && submissionId && submissionId !== 'offline_pending'
      ? { id: submissionId as Id<'submissions'> } : 'skip');
  const ownedServerSubmission = serverSubmission && serverSubmission.creatorId !== session.actor?.creatorId ? null : serverSubmission;
  const submission = ownedServerSubmission ?? (session.isOffline ? cachedRejectedCapture(savedCapture, submissionId, session.actor?.creatorId) ?? ownedServerSubmission : ownedServerSubmission);
  useCaptureProgress(session, 'interview', submissionId, ready && (session.isOffline || submissionId === 'offline_pending'
    || !!submission && submission.creatorId === session.actor?.creatorId && isEditableCaptureStatus(submission.status)));
  const hasExisting = !!(submission?.videoStorageId || submission?.audioStorageId || submission?.videoUrl || submission?.audioUrl);
  const primaryStorageId = recording?.storageId ?? (!recording ? submission?.videoStorageId || submission?.audioStorageId : undefined);
  const storedPrimaryUrl = useQuery(api.files.getUrl, session.canQuery && primaryStorageId ? { storageId: primaryStorageId } : 'skip');
  const missingUnuploaded = !!recording && (missingMedia.primary && !recording.storageId
    || missingMedia.audio && !recording.audioStorageId);
  const directUrl = !recording ? submission?.videoUrl || submission?.audioUrl : recording.storageId === submission?.videoStorageId
    ? submission?.videoUrl : recording.storageId === submission?.audioStorageId ? submission?.audioUrl : undefined;
  const playbackUri = recording && !missingMedia.primary ? recording.recordingUri : storedPrimaryUrl || directUrl;
  const playbackKind = recording?.type ?? (submission?.videoStorageId || submission?.videoUrl ? 'video' : 'audio');
  const latest = useRef({ recording, camera, loading });
  latest.current = { recording, camera, loading };

  const keepFiles = async (draft: RecordingDraft, valid: () => boolean) => {
    const scope = { creatorId: String(live.current.actor!.creatorId), submissionId: draft.submissionId, isCurrent: valid };
    const primary = await retainCaptureRecording(draft.recordingUri, draft.type === 'video' ? 'mp4' : 'm4a', scope)
      .catch(cause => { if (draft.storageId) return { uri: draft.recordingUri, missing: true }; throw cause; });
    if (!primary || !valid()) return null;
    // A camera failure can return its parallel audio as the primary audio take.
    // Only video takes require a second source file.
    const parallelAudioUri = draft.type === 'video' ? draft.parallelAudioUri : null;
    const audio = parallelAudioUri ? await retainCaptureRecording(parallelAudioUri, 'm4a', scope)
      .catch(cause => { if (draft.audioStorageId) return { uri: parallelAudioUri, missing: true }; throw cause; }) : null;
    if (!valid() || parallelAudioUri && !audio) return null;
    return { draft: { ...draft, recordingUri: primary.uri, parallelAudioUri: audio?.uri ?? null },
      missing: { primary: primary.missing, audio: !!audio?.missing } };
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!draftId.current) setReady(false);
    void (async () => {
      try {
        let id = await live.current.read<string>('current_submission_id');
        if (!current() || !active) return;
        const pending = await live.current.read<{ creatorId?: string; existingDraftId?: string }>('submission_pending_sync');
        const ownedPending = pending?.creatorId === live.current.actor?.creatorId;
        if (!id && ownedPending && (!requestedId || requestedId === 'offline_pending')) {
          id = 'offline_pending';
          await live.current.write('current_submission_id', id);
        }
        if (!current() || !active) return;
        if (!id) { router.replace('/(app)/(tabs)/dashboard'); return; }
        if (id !== 'offline_pending' && ownedPending && pending?.existingDraftId === id) migratedDraftId.current = id;
        const migrated = id === migratedDraftId.current;
        if (requestedId && requestedId !== id && !(requestedId === 'offline_pending' && migrated)) {
          draftId.current = null; setSubmissionId(null); setCamera(null); setRecording(null);
          setError('This interview belongs to a different capture. Go back and reopen the correct draft.'); return;
        }
        if (draftId.current && draftId.current !== id) {
          if (draftId.current === 'offline_pending' && migrated) {
            setCamera(previous => previous?.submissionId === 'offline_pending' ? { ...previous, submissionId: id! } : previous);
          } else {
            setReady(false); setCamera(null); setRecording(null); setRetaking(false); setError(null);
          }
          persisted.current = true;
        }
        draftId.current = id;
        const storedDraft = await live.current.read('submission_interview_draft');
        const storedPending = await live.current.read('submission_pending_interview');
        const forCapture = (value: unknown) => {
          const saved = recordingFor(value, id!);
          if (saved || !migrated) return saved;
          const previous = recordingFor(value, 'offline_pending');
          return previous ? { ...previous, submissionId: id! } : null;
        };
        const savedDraft = forCapture(storedDraft), queuedDraft = forCapture(storedPending);
        const legacyBackup = !!savedDraft && !!queuedDraft && savedDraft.type === 'video' && queuedDraft.type === savedDraft.type
          && savedDraft.recordingUri === queuedDraft.recordingUri && !!queuedDraft.parallelAudioUri
          && !!storedDraft && typeof storedDraft === 'object' && !Object.prototype.hasOwnProperty.call(storedDraft, 'parallelAudioUri');
        const draft = legacyBackup ? { ...savedDraft!, parallelAudioUri: queuedDraft!.parallelAudioUri,
          audioStorageId: savedDraft!.audioStorageId ?? queuedDraft!.audioStorageId } : savedDraft ?? queuedDraft;
        const snapshot = await live.current.read<CaptureSnapshot>('submission_snapshot');
        if (!current() || !active) return;
        setSubmissionId(id);
        setSavedCapture(snapshot?.submissionId === id && snapshot.creatorId === live.current.actor?.creatorId ? snapshot : null);
        setRecording(draft);
        setMissingMedia({ primary: false, audio: false });
        if (draft) setLang(draft.lang);
        if (draft) {
          const valid = () => active && current() && draftId.current === id;
          const retained = await keepFiles(draft, valid);
          if (!retained || !valid()) return;
          if (await live.current.read('current_submission_id') !== id || !valid()) return;
          if (legacyBackup || retained.draft.recordingUri !== draft.recordingUri || retained.draft.parallelAudioUri !== draft.parallelAudioUri)
            await live.current.write('submission_interview_draft', retained.draft);
          if (!valid()) return;
          setRecording(retained.draft); setMissingMedia(retained.missing);
        }
      } catch {
        if (current() && active) setError('Could not open your saved interview. Go back and reopen this capture.');
      } finally {
        if (current() && active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, [session.revision, requestedId]));

  const goBack = useCallback(() => {
    if (busy.current) return;
    if (latest.current.camera) { setCloseRequest(value => value + 1); return; }
    if (latest.current.recording && !persisted.current) {
      const origin = live.current, leavingId = draftId.current;
      Alert.alert('Recording not saved on this phone', 'Keep this screen open and try Continue again to save it.', [
        { text: 'Keep recording', style: 'cancel' },
        { text: 'Leave without saving', style: 'destructive', onPress: () => { if (current() && origin.isCurrent() && draftId.current === leavingId) router.back(); } },
      ]);
      return;
    }
    if (returnTo === 'review') router.back();
    else if (resumed === '1' && submissionId) router.replace({ pathname: '/(app)/submit/photos', params: { draftId: submissionId, resumed: '1' } } as never);
    else router.back();
  }, [router, resumed, returnTo, submissionId]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => listener.remove();
  }, [goBack]));

  const persist = async (draft: RecordingDraft) => {
    const origin = live.current;
    const valid = () => current() && origin.isCurrent() && draftId.current === draft.submissionId;
    if (await origin.read('current_submission_id') !== draft.submissionId || !valid()) return null;
    const retained = await keepFiles(draft, valid);
    if (!retained || !valid()) return null;
    if (retained.missing.primary && !draft.storageId || retained.missing.audio && !draft.audioStorageId)
      throw new Error('This recording is no longer on this device. Record another take to continue.');
    if (await origin.read('current_submission_id') !== draft.submissionId || !valid()) return null;
    await origin.write('submission_interview_draft', retained.draft);
    if (!valid() || await origin.read('current_submission_id') !== draft.submissionId || !valid()) return null;
    setRecording(retained.draft); setMissingMedia(retained.missing);
    persisted.current = true;
    return retained.draft;
  };
  const onFinish = async (result: InterviewResult, fromCapture: string, fromRun: number) => {
    if (!current() || draftId.current !== fromCapture || latest.current.camera?.run !== fromRun || busy.current) return;
    const origin = live.current;
    busy.current = true; setLoading(true);
    const valid = () => current() && origin.isCurrent() && draftId.current === fromCapture;
    try {
      if (await origin.read('current_submission_id') !== fromCapture || !valid()) return;
      setCamera(null);
      if (!result.uri?.trim()) { setError('The recording did not save. Please try again.'); return; }
      const draft: RecordingDraft = {
        submissionId: fromCapture, recordingUri: result.uri, parallelAudioUri: result.parallelAudioUri ?? null,
        type: result.kind, durationSec: result.durationSec, lang: result.lang,
        interrupted: result.interrupted, savedAt: Date.now(), attached: false,
      };
      setRecording(draft); setMissingMedia({ primary: false, audio: false }); setRetaking(false); setLang(result.lang);
      persisted.current = false;
      setError(null);
      await persist(draft);
    } catch { if (valid()) setError('Could not save this recording on your phone. Keep this screen open and try Continue again.'); }
    finally { busy.current = false; if (current()) setLoading(false); }
  };
  const openCamera = (audioOnly: boolean) => {
    if (busy.current || !current() || !submissionId || draftId.current !== submissionId || camera || (submission && !isEditableCaptureStatus(submission.status))) return;
    setCloseRequest(0); setError(null); setCamera({ audioOnly, submissionId, run: ++cameraSequence.current });
  };
  const recordAgain = () => { const fromCapture = draftId.current; Alert.alert('Record another take?', 'Your saved interview stays available until the new recording is ready.', [
    { text: 'Keep this take', style: 'cancel' },
    { text: 'Record again', onPress: () => { if (!busy.current && current() && draftId.current === fromCapture) setRetaking(true); } },
  ]); };

  const handleNext = async () => {
    if (busy.current || !current() || !submissionId || (!recording && !hasExisting) || (submission && !isEditableCaptureStatus(submission.status))) return;
    busy.current = true; setLoading(true); setProgress(0); setError(null);
    const origin = live.current;
    const targetId = submissionId;
    const valid = () => current() && origin.isCurrent() && draftId.current === targetId;
    const sameDraft = async () => valid() && await origin.read('current_submission_id') === targetId && valid();
    const online = () => valid() && origin.canMutate();
    const continueCapture = async () => {
      if (!await sameDraft()) { if (valid()) setError('Your capture changed. Reopen this interview to continue.'); return; }
      if (returnTo === 'review' || submission?.status === 'rejected') router.back();
      else router.push('/(app)/submit/design');
    };
    try {
      // ID migration is loaded from owned cache by hydration. A stale Continue
      // must never attach this take to whichever capture replaced the pointer.
      if (!await sameDraft()) { if (valid()) setError('Your capture changed. Reopen this interview to continue.'); return; }
      let draft = recording ? { ...recording, submissionId: targetId } : null;
      if (draft) {
        const retained = await persist(draft);
        if (!retained) return;
        draft = retained;
      }
      if (!online() || targetId === 'offline_pending') {
        if (!await sameDraft()) return;
        if (draft) await origin.write('submission_pending_interview', draft);
        await continueCapture();
        return;
      }
      const upload = async (uri: string, folder: string, contentType: string, filename: string) => {
        if (!online() || !await sameDraft()) throw new Error('Reconnect or reopen this capture to upload. Your recording is saved on this phone.');
        const target = await generateUploadUrl({ folder, filename, contentType });
        if (!online() || !await sameDraft()) throw new Error('Your capture connection changed. Your recording is saved on this phone.');
        const localUri = Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://')
          ? 'file://' + uri : uri;
        const body = await (await fetch(localUri)).blob();
        if (!online() || !await sameDraft()) throw new Error('Reconnect or reopen this capture to finish uploading. Your recording is saved on this phone.');
        const response = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
        if (!response.ok) throw new Error('Could not upload the recording. Your saved take is ready to retry.');
        if (!await sameDraft()) throw new Error('Your capture changed. Your recording is saved on this phone.');
        return target.fileKey;
      };
      if (draft) {
        if (!draft.storageId) {
          const storageId = await upload(draft.recordingUri, draft.type === 'video' ? 'videos' : 'audio',
            draft.type === 'video' ? 'video/mp4' : 'audio/m4a', draft.type === 'video' ? 'interview.mp4' : 'interview.m4a');
          draft = { ...draft, storageId };
          if (!await sameDraft()) return;
          setRecording(draft);
          await persist(draft);
        }
        setProgress(0.65);
        if (draft.type === 'video' && draft.parallelAudioUri && !draft.audioStorageId) {
          // Retain both source files and retry instead of silently dropping the
          // separate audio used by transcription.
          const audioStorageId = await upload(draft.parallelAudioUri, 'audio', 'audio/m4a', 'interview-audio.m4a');
          draft = { ...draft, audioStorageId };
          if (!await sameDraft()) return;
          setRecording(draft);
          await persist(draft);
        }
        if (!online() || !await sameDraft()) throw new Error('Reconnect or reopen this capture to finish saving your interview. Your recording is saved on this phone.');
        const alreadyAttached = draft.type === 'video'
          ? submission?.videoStorageId === draft.storageId && (!draft.audioStorageId || submission?.audioStorageId === draft.audioStorageId)
          : submission?.audioStorageId === draft.storageId;
        if (!alreadyAttached) {
          if (draft.type === 'video') await updateSubmission({
            id: targetId as Id<'submissions'>, videoStorageId: draft.storageId, audioStorageId: draft.audioStorageId,
          });
          else await updateSubmission({ id: targetId as Id<'submissions'>, audioStorageId: draft.storageId });
        }
        if (!await sameDraft()) return;
        draft = { ...draft, attached: true };
        setRecording(draft);
        await persist(draft);
        if (!await sameDraft()) return;
        setProgress(1);
        const queued = await origin.read<{ submissionId?: string }>('submission_pending_interview');
        if (!await sameDraft()) return;
        if (queued?.submissionId === targetId) await origin.remove('submission_pending_interview');
      }
      await continueCapture();
    } catch (cause) {
      if (valid()) setError(cause instanceof Error ? cause.message : 'Could not save your interview. Please try again.');
    } finally {
      busy.current = false;
      if (current()) setLoading(false);
    }
  };

  if (!ready || (session.canQuery && submissionId && submissionId !== 'offline_pending' && submission === undefined && !recording)) return <Loading />;
  if (!submissionId) return <ScreenShell title="Could not open your interview" onBack={goBack}>
    <Banner tone="danger" body={error ?? 'Go back and reopen this capture.'} />
  </ScreenShell>;
  if (session.canQuery && submissionId !== 'offline_pending' && (submission === null || (submission
    && (submission.creatorId !== session.actor?.creatorId || !isEditableCaptureStatus(submission.status))))) return <ScreenShell
    title="Capture unavailable" subtitle="Go back and reopen the business you are capturing." onBack={goBack} />;

  const modal = <Modal visible={camera !== null} animationType="fade" presentationStyle="fullScreen"
    onRequestClose={() => setCloseRequest(value => value + 1)} statusBarTranslucent>
    {camera ? <InterviewCam key={camera.run} recording="continuous" facing="back" audioOnly={camera.audioOnly} lang={lang}
      closeRequest={closeRequest} onFinish={result => { void onFinish(result, camera.submissionId, camera.run); }} onClose={() => {
        if (current() && latest.current.camera?.run === camera.run && draftId.current === camera.submissionId) setCamera(null);
      }} /> : null}
  </Modal>;

  if ((recording || hasExisting) && !retaking) return <ScreenShell title={recording ? 'Interview recorded.' : 'Interview saved.'}
    subtitle={recording ? formatClock(recording.durationSec) : 'Your interview is attached to this capture.'}
    progress={0.6} onBack={goBack} contentStyle={styles.content}
    footer={<>
      {loading ? <ProgressBar value={progress} tone="accent" label="Saving interview" /> : null}
      {error ? <Banner tone="danger" body={error} /> : null}
      <Button title={returnTo === 'review' || submission?.status === 'rejected' ? 'Save changes' : session.isOffline ? 'Save and continue' : 'Continue'} loading={loading} disabled={missingUnuploaded} onPress={() => { void handleNext(); }} />
      <Button title="Record again" variant="ghost" disabled={loading} onPress={recordAgain} />
    </>}>
    <OfflineBanner />
    {submission?.status === 'rejected' ? <Banner tone="danger" title="What needs fixing" body={submission.rejectionReason || 'Keep the saved take or record a replacement if the interview needs correcting.'} /> : null}
    {recording?.interrupted ? <Banner tone="warn" title="Your recording stopped early"
      body="The take so far is saved. Listen back, or record again to finish the questions." /> : null}
    {missingUnuploaded ? <Banner tone="warn" body="This recording is no longer on this device. Record another take to continue." /> : null}
    {playbackUri ? <InterviewPlayback key={playbackUri} uri={playbackUri} kind={playbackKind} onUnavailable={() => {
      if (current() && recording?.storageId && !missingMedia.primary) setMissingMedia(value => ({ ...value, primary: true }));
    }} /> :
      <Card style={styles.saved}><Ionicons name="checkmark-circle" size={64} color={colors.ink} />
        <Text variant="body" align="center">You can continue or record a replacement.</Text></Card>}
    {modal}
  </ScreenShell>;

  return <ScreenShell title="Now ask the owner." subtitle="10 short questions. About 5 minutes."
    progress={0.6} onBack={goBack} contentStyle={styles.content}
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
    {submission?.status === 'rejected' ? <Banner tone="danger" title="What needs fixing" body={submission.rejectionReason || 'Keep the saved take or record a replacement if the interview needs correcting.'} /> : null}
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
  saved: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
});
