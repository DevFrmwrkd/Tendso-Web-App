import { useEffect, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureStorageKey, type CaptureActor } from '../services/captureSession';

const DEBOUNCE_MS = 500;

export interface SubmissionFormData {
  businessName: string;
  businessType: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  address: string;
  city: string;
  coordinates?: { lat: number; lng: number };
  prospectLeadId?: string;
  submissionId?: string;
  savedAt: number;
}

export function useFormDraftCache(actor?: CaptureActor | null) {
  const key = actor ? captureStorageKey(actor.creatorId, 'submission_draft_form') : null;
  // Keep each actor's pending payload and writes together, including on cleanup.
  // A background/unmount flush must never write into the next signed-in account.
  const store = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: SubmissionFormData | null = null;
    let writes = Promise.resolve();
    const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
    const flush = () => {
      cancel();
      const payload = pending;
      pending = null;
      if (key && payload) writes = writes.then(() => AsyncStorage.setItem(key, JSON.stringify(payload)))
        .catch(err => { console.error('[FormDraftCache] Save error:', err); });
      return writes;
    };
    return {
      save(data: Omit<SubmissionFormData, 'savedAt'>) {
        if (!key) return;
        cancel();
        pending = { ...data, savedAt: Date.now() };
        timer = setTimeout(() => { void flush(); }, DEBOUNCE_MS);
      },
      flush,
      clear() {
        cancel(); pending = null;
        if (key) writes = writes.then(() => AsyncStorage.removeItem(key))
          .catch(err => { console.error('[FormDraftCache] Clear error:', err); });
        return writes;
      },
    };
  }, [key]);

  const saveDraft = useCallback((data: Omit<SubmissionFormData, 'savedAt'>) => {
    store.save(data);
  }, [store]);

  const loadDraft = useCallback(async (): Promise<SubmissionFormData | null> => {
    if (!key) return null;
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw) as SubmissionFormData;
      // Expire drafts older than 7 days
      if (!Number.isFinite(data.savedAt) || Date.now() - data.savedAt > 7 * 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[FormDraftCache] Load error:', err);
      return null;
    }
  }, [key]);

  const clearDraft = useCallback(async () => {
    await store.clear();
  }, [store]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') void store.flush();
    });
    return () => { listener.remove(); void store.flush(); };
  }, [store]);

  return { saveDraft, loadDraft, clearDraft };
}
