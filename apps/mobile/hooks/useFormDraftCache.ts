import { useEffect, useRef, useCallback } from 'react';
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
  savedAt: number;
}

export function useFormDraftCache(actor?: CaptureActor | null) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const key = actor ? captureStorageKey(actor.creatorId, 'submission_draft_form') : null;

  const saveDraft = useCallback((data: Omit<SubmissionFormData, 'savedAt'>) => {
    if (!key) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(async () => {
      try {
        const payload: SubmissionFormData = {
          ...data,
          savedAt: Date.now(),
        };
        await AsyncStorage.setItem(key, JSON.stringify(payload));
      } catch (err) {
        console.error('[FormDraftCache] Save error:', err);
      }
    }, DEBOUNCE_MS);
  }, [key]);

  const loadDraft = useCallback(async (): Promise<SubmissionFormData | null> => {
    if (!key) return null;
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw) as SubmissionFormData;
      // Expire drafts older than 7 days
      if (Date.now() - data.savedAt > 7 * 24 * 60 * 60 * 1000) {
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
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!key) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch (err) {
      console.error('[FormDraftCache] Clear error:', err);
    }
  }, [key]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key]);

  return { saveDraft, loadDraft, clearDraft };
}
