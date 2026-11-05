import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { EmptyState, Loading, ScreenShell } from '../../../components/v2';
import { CaptureDesignGallery } from '../../../components/field-agent/CaptureDesignGallery';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useCaptureProgress } from '../../../hooks/useCaptureProgress';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { captureDesign, captureDesignChoices, captureDesignMatchesBusinessType, selectedCaptureDesignCode } from '../../../services/captureDesign';
import type { CaptureDesignDraft } from '../../../services/captureSession';
import { isEditableCaptureStatus, type CaptureSnapshot } from '../../../services/captureEdit';
import { normalizeCaptureBusinessType } from '../../../../../lib/captureDesign';

type CaptureSession = ReturnType<typeof useCaptureSession>;
type QueuedChoice = { submissionId: string; templateId?: string; savedAt?: number };

export default function SubmitDesignScreen() {
  const capture = useCaptureSession();
  const router = useGuardedRouter();
  const { draftId, returnTo, resumed } = useLocalSearchParams<{ draftId?: string; returnTo?: string; resumed?: string }>();
  if (!capture.isReady) return <Loading label="Loading your capture" />;
  if (!capture.actor || !capture.actorKey) return <ScreenShell onBack={() => router.back()}>
    <EmptyState title="Reconnect to choose a design" body="Open this capture with your field-agent account." />
  </ScreenShell>;
  return <CaptureDesignStep key={`${capture.actorKey}:${JSON.stringify(draftId ?? null)}`} capture={capture}
    requestedDraftId={draftId} returnToReview={returnTo === 'review'} resumed={resumed === '1'} />;
}

function CaptureDesignStep({ capture, requestedDraftId, returnToReview, resumed }: {
  capture: CaptureSession; requestedDraftId?: string; returnToReview: boolean; resumed: boolean;
}) {
  const router = useGuardedRouter();
  const choose = useMutation(api.submissions.chooseDesign);
  const [id, setId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [pendingBusinessType, setPendingBusinessType] = useState<string | null>(null);
  const [cachedEditable, setCachedEditable] = useState(true);
  const [cachedFeedback, setCachedFeedback] = useState<string | undefined>();
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
  const migratedDraftId = useRef<string | null>(null);
  const draftId = useRef(id);
  draftId.current = id;
  const canQuery = capture.canQuery && !!id && id !== 'offline_pending';
  const raw = useQuery(api.submissions.getById, canQuery ? { id: id as Id<'submissions'> } : 'skip');
  const submission = raw && raw.creatorId === capture.actor?.creatorId ? raw : null;
  const currentType = pendingBusinessType ?? submission?.businessType ?? businessType;
  const categorySyncPending = !!pendingBusinessType && !!submission
    && normalizeCaptureBusinessType(pendingBusinessType) !== normalizeCaptureBusinessType(submission.businessType);
  const latest = useRef({ currentType, categorySyncPending });
  latest.current = { currentType, categorySyncPending };
  useCaptureProgress(capture, 'design', id, hydrated && ((capture.isOffline || id === 'offline_pending') && cachedEditable && !!businessType
    || !!submission && isEditableCaptureStatus(submission.status)
      && submission.contentSource !== 'owner_app' && submission.contentSource !== 'owner_intake'));
  const current = () => mounted.current && focus.current && capture.isCurrent();
  const goBack = useCallback(() => {
    if (busy.current) return;
    if (returnToReview) router.back();
    else if (resumed && draftId.current) router.replace({ pathname: '/(app)/submit/interview', params: { draftId: draftId.current, resumed: '1' } } as never);
    else router.back();
  }, [router, resumed, returnToReview]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => listener.remove();
  }, [goBack]));
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
          capture.read<CaptureSnapshot>('submission_snapshot'),
          capture.read<CaptureDesignDraft>('submission_design'),
          capture.read<QueuedChoice>('submission_pending_submit'),
        ]);
        if (!active || !current()) return;
        const target = storedId ?? (pending && pending.creatorId === capture.actor?.creatorId ? 'offline_pending' : null);
        const matchingPending = !!pending && pending.creatorId === capture.actor?.creatorId &&
          (target === 'offline_pending' ? !pending.existingDraftId || pending.existingDraftId === 'offline_pending'
            : pending.existingDraftId === target);
        const migrating = target !== 'offline_pending' && !!target && matchingPending;
        if (requestedDraftId === 'offline_pending' && migrating) migratedDraftId.current = target;
        if (requestedDraftId !== undefined && (typeof requestedDraftId !== 'string' || !requestedDraftId
          || (target !== requestedDraftId && target !== migratedDraftId.current))) {
          setId(null); setBusinessType(null); setPendingBusinessType(null); setCachedEditable(false); setHydrated(true); return;
        }
        if (target !== draftId.current) touched.current = false;
        draftId.current = target; setId(target);
        const matches = (value: string | undefined) => value === target || (migrating && value === 'offline_pending');
        const ownSnapshot = snapshot && matches(snapshot.submissionId) && snapshot.creatorId === capture.actor?.creatorId ? snapshot : null;
        const pendingType = matchingPending ? pending.formData?.businessType ?? null : null;
        setPendingBusinessType(pendingType);
        setBusinessType(pendingType ?? ownSnapshot?.businessType ?? null);
        setCachedEditable(!ownSnapshot || ((ownSnapshot.status === undefined || isEditableCaptureStatus(ownSnapshot.status))
          && ownSnapshot.contentSource !== 'owner_app' && ownSnapshot.contentSource !== 'owner_intake'));
        setCachedFeedback(ownSnapshot?.status === 'rejected'
          ? ownSnapshot.rejectionReason || 'Review the feedback and keep or change the saved design.' : undefined);
        const local = saved && matches(saved.submissionId) ? { ...saved, submissionId: target! }
          : ownSnapshot?.templateId ? { submissionId: target!, templateId: ownSnapshot.templateId, savedAt: 0 } : null;
        const finalChoice = queued && matches(queued.submissionId) ? { ...queued, submissionId: target! } : null;
        setLocalChoice(local); setQueuedChoice(finalChoice);
        if (!touched.current) setSelectedCode(selectedCaptureDesignCode(target, local, finalChoice));
        setHydrated(true);
      } catch { if (active && current()) { setError('Could not load this capture. Reopen the design step to try again.'); setHydrated(true); } }
    })();
    return () => { active = false; focus.current = false; setFocused(false); };
  }, [capture.actorKey, capture.read, capture.revision, capture.canQuery, requestedDraftId]));

  useEffect(() => {
    if (hydrated && !touched.current) setSelectedCode(selectedCaptureDesignCode(id, localChoice, queuedChoice, submission?.templateId));
  }, [hydrated, id, localChoice, queuedChoice, submission?.templateId]);

  const useDesign = async (code: string) => {
    const design = captureDesign(code);
    if (!design || !id || busy.current || !current()) return;
    if (!captureDesignMatchesBusinessType(latest.current.currentType, code)) {
      setError('Choose a design for this business type.'); return;
    }
    if (canQuery && (!submission || !isEditableCaptureStatus(submission.status)
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
      if (!captureDesignMatchesBusinessType(latest.current.currentType, design.code)) throw new Error('The business type changed. Choose a matching design.');
      if (capture.canMutate() && savingId !== 'offline_pending' && !latest.current.categorySyncPending) {
        await choose({ id: savingId as Id<'submissions'>, templateId: design.code });
        if (!sameDraft() || !capture.canMutate()) return;
      } else if (!capture.isOffline && savingId !== 'offline_pending' && !latest.current.categorySyncPending) {
        throw new Error('Your design is saved on this device. Reconnect and try again.');
      }
      if (!captureDesignMatchesBusinessType(latest.current.currentType, design.code)) throw new Error('The business type changed. Choose a matching design.');
      const currentPointer = await capture.read<string>('current_submission_id');
      if (sameDraft() && currentPointer === savingId) {
        if (returnToReview) router.back();
        else router.push('/(app)/submit/review');
      }
    } catch (cause) { if (sameDraft()) setError(cause instanceof Error ? cause.message : 'Could not save this design. Please try again.'); }
    finally { busy.current = false; if (mounted.current && capture.isCurrent()) setSaving(false); }
  };

  if (!focused || !hydrated || (canQuery && raw === undefined)) return <Loading label="Loading designs" />;
  const unavailable = !id || (canQuery && (!submission || !isEditableCaptureStatus(submission.status)
    || submission.contentSource === 'owner_app' || submission.contentSource === 'owner_intake')) || (!canQuery && (!businessType || !cachedEditable));
  if (unavailable) return <ScreenShell onBack={() => router.back()}><EmptyState title="Open your capture first"
    body="Choose a design for a draft or rejected capture from your field-agent account." actionLabel="About the shop"
    onAction={() => router.replace('/(app)/submit/info' as never)} /></ScreenShell>;
  const matchingSelection = captureDesignMatchesBusinessType(currentType, selectedCode) ? selectedCode : null;
  return <CaptureDesignGallery key={`${id}:${currentType}`} designs={captureDesignChoices(currentType, matchingSelection)}
    selectedCode={matchingSelection} onSelect={code => { if (!busy.current && current()) { touched.current = true; setSelectedCode(code); } }}
    onUse={useDesign} onBack={goBack} busy={saving} error={error}
    reviewFeedback={submission?.status === 'rejected' ? submission.rejectionReason || 'Review the feedback and keep or change the saved design.'
      : !canQuery ? cachedFeedback : undefined}
    disabled={!capture.isOffline && !capture.canMutate()} isOffline={capture.isOffline} />;
}
