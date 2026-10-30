import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { EmptyState, Loading, ScreenShell } from '../../../components/v2';
import { CaptureDesignGallery } from '../../../components/field-agent/CaptureDesignGallery';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { captureDesign, captureDesignChoices, selectedCaptureDesignCode } from '../../../services/captureDesign';
import type { CaptureDesignDraft } from '../../../services/captureSession';

type CaptureSession = ReturnType<typeof useCaptureSession>;
type QueuedChoice = { submissionId: string; templateId?: string; savedAt?: number };

export default function SubmitDesignScreen() {
  const capture = useCaptureSession();
  const router = useGuardedRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  if (!capture.isReady) return <Loading label="Loading your capture" />;
  if (!capture.actor || !capture.actorKey) return <ScreenShell onBack={() => router.back()}>
    <EmptyState title="Reconnect to choose a design" body="Open this capture with your field-agent account." />
  </ScreenShell>;
  return <CaptureDesignStep key={capture.actorKey} capture={capture} returnToReview={returnTo === 'review'} />;
}

function CaptureDesignStep({ capture, returnToReview }: { capture: CaptureSession; returnToReview: boolean }) {
  const router = useGuardedRouter();
  const choose = useMutation(api.submissions.chooseDesign);
  const [id, setId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [localChoice, setLocalChoice] = useState<CaptureDesignDraft | null>(null);
  const [queuedChoice, setQueuedChoice] = useState<QueuedChoice | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [focused, setFocused] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const focus = useRef(true);
  const touched = useRef(false);
  const draftId = useRef(id);
  draftId.current = id;
  const canQuery = capture.canQuery && !!id && id !== 'offline_pending';
  const raw = useQuery(api.submissions.getById, canQuery ? { id: id as Id<'submissions'> } : 'skip');
  const submission = raw && raw.creatorId === capture.actor?.creatorId ? raw : null;
  const current = () => mounted.current && focus.current && capture.isCurrent();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    focus.current = true;
    setFocused(true);
    void (async () => {
      try {
        const [storedId, pending, snapshot, saved, queued] = await Promise.all([
          capture.read<string>('current_submission_id'),
          capture.read<{ creatorId: string; existingDraftId?: string; formData?: { businessType?: string } }>('submission_pending_sync'),
          capture.read<{ submissionId: string; creatorId: string; businessType?: string }>('submission_snapshot'),
          capture.read<CaptureDesignDraft>('submission_design'),
          capture.read<QueuedChoice>('submission_pending_submit'),
        ]);
        if (!active || !current()) return;
        const target = storedId ?? (pending && pending.creatorId === capture.actor?.creatorId ? 'offline_pending' : null);
        if (target !== draftId.current) touched.current = false;
        draftId.current = target; setId(target);
        const matchingPending = !!pending && pending.creatorId === capture.actor?.creatorId &&
          (target === 'offline_pending' || pending.existingDraftId === target);
        setBusinessType(matchingPending ? pending?.formData?.businessType ?? null
          : snapshot?.submissionId === target && snapshot.creatorId === capture.actor?.creatorId ? snapshot.businessType ?? null : null);
        const local = saved?.submissionId === target ? saved : null;
        const finalChoice = queued?.submissionId === target ? queued : null;
        setLocalChoice(local); setQueuedChoice(finalChoice);
        if (!touched.current) setSelectedCode(selectedCaptureDesignCode(target, local, finalChoice));
        setHydrated(true);
      } catch { if (active && current()) { setError('Could not load this capture. Reopen the design step to try again.'); setHydrated(true); } }
    })();
    return () => { active = false; focus.current = false; setFocused(false); };
  }, [capture.actorKey, capture.read, capture.revision, capture.canQuery]));

  useEffect(() => {
    if (hydrated && !touched.current) setSelectedCode(selectedCaptureDesignCode(id, localChoice, queuedChoice, submission?.templateId));
  }, [hydrated, id, localChoice, queuedChoice, submission?.templateId]);

  const useDesign = async (code: string) => {
    const design = captureDesign(code);
    if (!design || !id || busy.current || !current()) return;
    if (canQuery && (!submission || submission.status !== 'draft'
      || submission.contentSource === 'owner_app' || submission.contentSource === 'owner_intake')) return;
    if (!capture.isOffline && !capture.canMutate()) { setError('Reconnect with your field-agent account to save this design.'); return; }
    const savingId = id;
    const sameDraft = () => current() && draftId.current === savingId;
    busy.current = true; setSaving(true); setError(null);
    try {
      const pointer = await capture.read<string>('current_submission_id');
      if (!sameDraft() || pointer !== savingId) throw new Error('The capture changed. Reopen its design step.');
      const choice = { submissionId: savingId, templateId: design.code, savedAt: Date.now() };
      await capture.write('submission_design', choice);
      if (!sameDraft()) return;
      if (capture.canMutate() && savingId !== 'offline_pending') {
        await choose({ id: savingId as Id<'submissions'>, templateId: design.code });
        if (!sameDraft() || !capture.canMutate()) return;
      } else if (!capture.isOffline && savingId !== 'offline_pending') {
        throw new Error('Your design is saved on this device. Reconnect and try again.');
      }
      const currentPointer = await capture.read<string>('current_submission_id');
      if (sameDraft() && currentPointer === savingId) {
        if (returnToReview) router.back();
        else router.push('/(app)/submit/review');
      }
    } catch (cause) { if (sameDraft()) setError(cause instanceof Error ? cause.message : 'Could not save this design. Please try again.'); }
    finally { busy.current = false; if (mounted.current && capture.isCurrent()) setSaving(false); }
  };

  if (!focused || !hydrated || (canQuery && raw === undefined)) return <Loading label="Loading designs" />;
  const unavailable = !id || (canQuery && (!submission || submission.status !== 'draft'
    || submission.contentSource === 'owner_app' || submission.contentSource === 'owner_intake')) || (!capture.canQuery && !businessType);
  if (unavailable) return <ScreenShell onBack={() => router.back()}><EmptyState title="Open your capture first"
    body="Choose a design for a draft from your field-agent account." actionLabel="About the shop"
    onAction={() => router.replace('/(app)/submit/info' as never)} /></ScreenShell>;
  return <CaptureDesignGallery key={id} designs={captureDesignChoices(submission?.businessType ?? businessType, selectedCode)}
    selectedCode={selectedCode} onSelect={code => { if (!busy.current && current()) { touched.current = true; setSelectedCode(code); } }}
    onUse={useDesign} onBack={() => { if (!busy.current) router.back(); }} busy={saving} error={error}
    disabled={!capture.isOffline && !capture.canMutate()} isOffline={capture.isOffline} />;
}
