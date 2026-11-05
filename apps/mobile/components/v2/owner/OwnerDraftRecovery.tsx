import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useSegments } from 'expo-router';
import { useNetwork } from '../../../providers/NetworkProvider';
import { useChooseDesign, useOwnerSubmission, useSaveDraftProgress, useUpdateDraft } from '../../../lib/v2/ownerData';
import { sellKind } from '../../../lib/v2/ownerContent';
import { OWNER_SAMPLE_DATA } from '../../../lib/v2/ownerFlags';
import { ownerIntake, useOwnerIntake, type OwnerIntake } from '../../../lib/v2/ownerIntake';
import { registerOwnerDraftCheckpoint } from '../../../lib/v2/ownerDraftWrites';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import type { OwnerDraftProgress } from '../../../lib/v2/ownerTypes';
import { Banner } from '../Banner';
import { Button } from '../Button';
import { colors, space } from '../../../theme/v2';

export function ownerProgressForPath(path: string, intake: OwnerIntake): OwnerDraftProgress | null {
  const step: OwnerDraftProgress['step'] | null = intake.applyingPhoneMetadata ? intake.draftProgress?.step ?? 'details' : /start\/(sell|place)$/.test(path) ? 'details' : /start\/how$/.test(path) ? 'setup'
    : /talk(?:\/[^/]+)?$/.test(path) ? 'interview' : /photos(?:\/[^/]+)?$/.test(path) ? 'photos'
      : /(?:^|\/)design$/.test(path) ? intake.design ? 'review' : 'design' : null;
  return step ? { ...intake.draftProgress, step, how: intake.howConfirmedFor === intake.submissionId ? intake.how : undefined,
    audioOnly: intake.audioOnly, lang: intake.lang } : null;
}

/** Hydrate one owned canonical draft before capture; no cloud draft is ever built from a stale local cache. */
export function OwnerDraftRecovery({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const { me, id, site } = useOwnerSite();
  const intake = useOwnerIntake();
  const draftId = site?.phase === 'draft' ? id : null;
  const sub = useOwnerSubmission(draftId);
  const { isConnected } = useNetwork();
  const path = useSegments().join('/');
  const saveProgress = useSaveDraftProgress();
  const chooseDesign = useChooseDesign();
  const updateDraft = useUpdateDraft();
  const epoch = ownerIntake.scope();
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const lastSaved = useRef({ id: '', progress: '', design: '', kind: '' });
  const pending = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { const listener = AppState.addEventListener('change', value => setForeground(value === 'active')); return () => listener.remove(); }, []);
  useEffect(() => { pending.current = null; lastSaved.current.id = ''; setError(null); }, [epoch, draftId]);
  const current = useCallback(() => mounted.current && ownerIntake.isCurrent(epoch) && ownerIntake.get().submissionId === draftId
    && (OWNER_SAMPLE_DATA || ownerIntake.actor() === userId), [epoch, draftId, userId]);

  useEffect(() => {
    if (!draftId || !sub || sub.submissionId !== draftId || !me?.sites.some(row => row.submissionId === draftId)
      || !OWNER_SAMPLE_DATA && (sub.actorClerkId !== userId || sub.ownerId !== me.owner._id)) return;
    if (ownerIntake.restoreDraft(sub)) {
      if (lastSaved.current.id !== draftId) lastSaved.current = { id: draftId, progress: JSON.stringify(sub.draftProgress ?? {}), design: sub.templateId ?? '', kind: `${sub.businessType}:${sub.shotListKey}` };
    }
  }, [draftId, sub, me, userId, intake]);

  const checkpoint = useCallback((explicit = false): Promise<void> => {
    if (pending.current) return pending.current;
    if (!draftId || !current() || !ownerIntake.isHydrated(draftId) || !sub || sub.phase !== 'draft' || isConnected !== true) return Promise.resolve();
    if (!explicit && (!foreground || ownerIntake.get().syncNotice || ownerIntake.get().remoteConflictMetadata && !ownerIntake.get().applyingPhoneMetadata)) return Promise.resolve();
    const progress = ownerProgressForPath(path, ownerIntake.get());
    if (!progress) return Promise.resolve();
    const kind = sellKind(ownerIntake.get().kind);
    const changedKind = !!kind && `${kind.businessType}:${kind.shots}` !== lastSaved.current.kind;
    if (!ownerIntake.get().detailsDirty?.length && !changedKind && JSON.stringify(progress) === lastSaved.current.progress && (ownerIntake.get().design ?? '') === lastSaved.current.design) {
      if (ownerIntake.get().applyingPhoneMetadata) ownerIntake.finishPhoneMetadata(draftId, epoch);
      return Promise.resolve();
    }
    const request = (async () => {
      const local = ownerIntake.get();
      if (local.detailsDirty?.length || changedKind) {
        const values = { businessName: local.businessName?.trim() || sub.businessName, address: local.address?.trim() ?? sub.address,
          city: local.city?.trim() ?? sub.city, coordinates: local.coordinates ?? sub.coordinates ?? undefined };
        const patch: Partial<typeof values> & { businessType?: string; shotListKey?: string } = {};
        for (const field of local.detailsDirty ?? []) Object.assign(patch, { [field]: values[field] });
        if (changedKind && kind) Object.assign(patch, { businessType: kind.businessType, shotListKey: kind.shots });
        if (!values.businessName.trim() || !values.address.trim() && !values.coordinates) throw new Error('Add a shop name and an address or map pin before saving this draft to your account.');
        await updateDraft({ submissionId: draftId, ...patch });
        if (!current()) return;
        if (kind) lastSaved.current.kind = `${kind.businessType}:${kind.shots}`;
        const latest = ownerIntake.get();
        const remaining = latest.detailsDirty?.filter(field => JSON.stringify(latest[field]) !== JSON.stringify(patch[field]));
        ownerIntake.set({ detailsDirty: remaining?.length ? remaining : undefined });
      }
      const design = local.design;
      if (design && design !== lastSaved.current.design) {
        await chooseDesign({ submissionId: draftId, templateId: design });
        if (!current()) return;
        lastSaved.current.design = design;
      }
      const encoded = JSON.stringify(progress);
      if (encoded !== lastSaved.current.progress) {
        await saveProgress({ submissionId: draftId, progress });
        if (!current()) return;
        lastSaved.current.progress = encoded;
        ownerIntake.set({ draftProgress: progress });
      }
      if (current()) { ownerIntake.finishPhoneMetadata(draftId, epoch); setError(null); }
    })();
    pending.current = request;
    void request.then(() => { if (pending.current === request) { pending.current = null; if (current()) setSavedTick(value => value + 1); } },
      () => { if (pending.current === request) pending.current = null; });
    return request;
  }, [draftId, current, sub, isConnected, foreground, path, chooseDesign, saveProgress, updateDraft, epoch]);

  useEffect(() => registerOwnerDraftCheckpoint(checkpoint), [checkpoint, epoch]);
  const progressKey = JSON.stringify(ownerProgressForPath(path, intake));
  useEffect(() => {
    if (!draftId || !current() || !ownerIntake.isHydrated(draftId)) return;
    const timer = setTimeout(() => { void checkpoint().catch(cause => {
      if (current()) setError(cause instanceof Error ? cause.message : 'Your latest progress is saved on this phone. Reconnect to sync it.');
    }); }, 350);
    return () => clearTimeout(timer);
  }, [checkpoint, current, draftId, progressKey, intake.design, intake.kind, intake.detailsDirty, intake.businessName, intake.address, intake.city, intake.coordinates, savedTick]);

  if (draftId && (!sub || !ownerIntake.isHydrated(draftId))) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.ink} accessibilityLabel="Restoring your saved draft" /></View>;
  const paused = intake.uploads?.filter(upload => upload.submissionId === draftId && upload.pausedByRemote).length ?? 0;
  const fieldLabels: Record<string, string> = { businessName: 'shop name', address: 'address', city: 'city', coordinates: 'map pin', kind: 'business type',
    design: 'design', how: 'phone setup', audioOnly: 'recording mode', lang: 'language', draftProgress: 'resume position' };
  const phoneFields = Object.keys(intake.remoteConflictMetadata ?? {}).map(key => fieldLabels[key] ?? key);
  return <View style={{ flex: 1 }}>{draftId && (intake.syncNotice || error || phoneFields.length > 0 || paused > 0) ? <Banner tone="warn"
    body={error ?? `${intake.syncNotice ?? (paused ? 'This phone has unfinished uploads kept separate from the saved draft.' : 'Your phone’s pending changes are kept separate from the saved draft.')}${phoneFields.length ? ` Phone changes: ${phoneFields.join(', ')}.` : ''}`}
    action={intake.syncNotice || phoneFields.length || paused ? <View style={{ gap: space.sm }}><Button title="Continue with saved version" variant="ghost" size="md" disabled={intake.applyingPhoneMetadata && !error} onPress={() => { if (draftId && current()) ownerIntake.keepCloudMetadata(draftId); }} />
      {phoneFields.length ? <Button title="Use phone changes" variant="ghost" size="md" onPress={() => {
        if (!current()) return;
        Alert.alert('Apply this phone’s pending changes?', `Only these changes will replace their matching fields in the latest draft: ${phoneFields.join(', ')}. Other saved details, photos and answers stay as they are.`, [
          { text: 'Keep reviewing', style: 'cancel' }, { text: 'Apply phone changes', onPress: () => { if (draftId && current()) ownerIntake.usePhoneMetadata(draftId); } },
        ]);
      }} /> : null}{paused ? <Button title={`Use this phone’s ${paused} unfinished uploads`} variant="ghost" size="md" onPress={() => {
      if (!current()) return;
      Alert.alert('Use this phone’s unfinished uploads?', 'They will replace matching photos or answers in the latest saved draft. Other details and your design stay as saved.', [
        { text: 'Keep cloud version', style: 'cancel' }, { text: 'Use phone uploads', onPress: () => { if (draftId && current()) ownerIntake.usePausedUploads(draftId); } },
      ]);
    }} /> : null}</View> : undefined} style={{ marginHorizontal: space.gutter, marginTop: space.sm }} /> : null}{children}</View>;
}
