import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { Banner, Button, Loading, ScreenShell } from '../../../components/v2';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { activeCaptureId, CAPTURE_RESUME_KEYS, captureResumeStep, validCaptureResumeId,
  type CaptureResumeCache } from '../../../services/captureResume';
import { isEditableCaptureStatus } from '../../../services/captureEdit';

/** Explicit Submit entry only; reopening the app or an existing capture never redirects here. */
export default function SubmitEntry() {
  const capture = useCaptureSession();
  if (!capture.isReady) return <Loading />;
  if (!capture.actor) return <ScreenShell title="Reconnect to open your capture">
    <Banner tone="warn" body="Sign in with your certified field-agent account to continue." />
  </ScreenShell>;
  return <ResumeCapture key={capture.actorKey} capture={capture} />;
}

function ResumeCapture({ capture }: { capture: ReturnType<typeof useCaptureSession> }) {
  const router = useGuardedRouter();
  const [cache, setCache] = useState<CaptureResumeCache | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const opening = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setCache(null); setError(false); opening.current = false;
    void Promise.all(CAPTURE_RESUME_KEYS.map(key => capture.read(key))).then(values => {
      if (active && capture.isCurrent()) setCache(Object.fromEntries(CAPTURE_RESUME_KEYS.map((key, index) => [key, values[index]])));
    }).catch(() => { if (active && capture.isCurrent()) setError(true); });
    return () => { active = false; };
  }, [capture.actorKey, capture.read, attempt]);
  const target = cache ? activeCaptureId(cache, capture.actor!.creatorId) : null;
  const fromForm = !!target && !!cache
    && !activeCaptureId({ ...cache, submission_draft_form: null }, capture.actor!.creatorId);
  const server = useQuery(api.submissions.getById, cache && capture.canQuery && target && target !== 'offline_pending'
    ? { id: target as Id<'submissions'> } : 'skip');
  const newest = useQuery(api.submissions.getDraftByCreatorId, cache && !target && capture.canQuery
    ? { creatorId: capture.actor!.creatorId } : 'skip');
  const chosen = target ?? (newest ? validCaptureResumeId(newest._id) : null);
  const record = target ? server : newest;
  const waiting = !cache || (!capture.isOffline && (!capture.canQuery
    || (target && target !== 'offline_pending' ? server === undefined : !target && newest === undefined)));
  const forbidden = !!record && (record.creatorId !== capture.actor?.creatorId || !isEditableCaptureStatus(record.status)
    || record.contentSource === 'owner_app' || record.contentSource === 'owner_intake');
  const saved = cache?.submission_snapshot as { submissionId?: string; creatorId?: string; status?: string } | null;
  const sent = cache?.submission_last_sent as { submissionId?: string; queued?: boolean; sentAt?: number } | null;
  const form = cache?.submission_draft_form as { savedAt?: number } | null;
  const newerPlaceholderForm = fromForm && target === 'offline_pending' && typeof form?.savedAt === 'number'
    && typeof sent?.sentAt === 'number' && form.savedAt > sent.sentAt;
  const offlineSent = capture.isOffline && !!target && (sent?.submissionId === target && sent.queued === false && !newerPlaceholderForm
    || saved?.submissionId === target && saved.creatorId === capture.actor?.creatorId
      && !!saved.status && !isEditableCaptureStatus(saved.status));
  const unavailable = forbidden
    || offlineSent
    || (!!target && target !== 'offline_pending' && capture.canQuery && server === null);
  useEffect(() => {
    if (waiting || error || unavailable || !cache || opening.current || !capture.isCurrent()) return;
    let active = true;
    const currentScreen = () => active && mounted.current && capture.isCurrent();
    opening.current = true;
    void (async () => {
      const current = await capture.read<string>('current_submission_id');
      if (!currentScreen()) return;
      if (current !== (cache.current_submission_id ?? null)) { setAttempt(value => value + 1); return; }
      if (!chosen) { router.replace('/(app)/submit/info' as never); return; }
      // Offline local data permits local work only; live API access stays screen-authorized.
      if (current !== chosen) await capture.write('current_submission_id', chosen);
      if (!currentScreen() || await capture.read('current_submission_id') !== chosen || !currentScreen()) return;
      const step = fromForm ? 'info' : captureResumeStep(chosen, capture.actor!.creatorId, cache, record);
      router.replace({ pathname: `/(app)/submit/${step}`, params: { draftId: chosen, resumed: '1' } } as never);
    })().catch(() => { if (currentScreen()) { opening.current = false; setError(true); } });
    return () => { active = false; opening.current = false; };
  }, [waiting, error, unavailable, chosen, target, fromForm, cache, record, capture.actorKey, capture.canQuery, capture.isOffline]);
  if (error || unavailable) return <ScreenShell title="Your saved capture" onBack={() => router.back()}>
    <Banner tone="warn" body={unavailable ? 'This capture is no longer editable or available for your account. Your saved work has not been changed.'
      : 'Could not open your saved capture. Your work is still saved on this phone.'} />
    {!unavailable ? <Button title="Try again" onPress={() => setAttempt(value => value + 1)} /> : null}
    <Button title="View submissions" variant="ghost" onPress={() => router.replace('/(app)/submissions' as never)} />
  </ScreenShell>;
  return <Loading label="Opening your capture" />;
}
