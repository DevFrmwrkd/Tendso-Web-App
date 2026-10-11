import { useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_KEY = 'submission_draft_form';
const DEBOUNCE_MS = 500;

export interface SubmissionFormData {
  businessName: string;
  businessType: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  address: string;
  city: string;
  savedAt: number;
}

export function useFormDraftCache() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const saveDraft = useCallback((data: Omit<SubmissionFormData, 'savedAt'>) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(async () => {
      try {
        const payload: SubmissionFormData = {
          ...data,
          savedAt: Date.now(),
        };
        await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch (err) {
        console.error('[FormDraftCache] Save error:', err);
      }
    }, DEBOUNCE_MS);
  }, []);

  const loadDraft = useCallback(async (): Promise<SubmissionFormData | null> => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SubmissionFormData;
      // Expire drafts older than 7 days
      if (Date.now() - data.savedAt > 7 * 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(DRAFT_KEY);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[FormDraftCache] Load error:', err);
      return null;
    }
  }, []);

  const clearDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      console.error('[FormDraftCache] Clear error:', err);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { saveDraft, loadDraft, clearDraft };
}
