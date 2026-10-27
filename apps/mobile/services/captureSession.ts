import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Id } from '@tendso/convex-client';

export type CaptureActor = { creatorId: Id<'creators'>; clerkId: string };
export type CaptureStorageKey = 'current_submission_id' | 'submission_pending_sync'
  | 'submission_pending_photos' | 'submission_pending_interview' | 'submission_pending_submit'
  | 'submission_draft_form' | 'submission_photo_tasks' | 'submission_interview_draft' | 'submission_last_sent' | 'submission_snapshot';

const listeners = new Set<(creatorId: string, key: CaptureStorageKey) => void>();
export function subscribeCaptureCache(listener: (creatorId: string, key: CaptureStorageKey) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function captureStorageKey(creatorId: string, key: CaptureStorageKey): string {
  return `capture:v2:${creatorId}:${key}`;
}

/** Local capture data belongs to one server creator, never to the next login. */
export async function readCaptureCache<T>(creatorId: string, key: CaptureStorageKey): Promise<T | null> {
  const raw = await AsyncStorage.getItem(captureStorageKey(creatorId, key));
  if (raw != null) {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  // Legacy globals stay in the sync hook, where server ownership is checked
  // before media are touched. Screens never expose unowned cached records.
  return null;
}

export async function writeCaptureCache<T>(creatorId: string, key: CaptureStorageKey, value: T): Promise<void> {
  await AsyncStorage.setItem(captureStorageKey(creatorId, key), JSON.stringify(value));
  listeners.forEach(listener => listener(creatorId, key));
}

export async function removeCaptureCache(creatorId: string, key: CaptureStorageKey): Promise<void> {
  await AsyncStorage.removeItem(captureStorageKey(creatorId, key));
  listeners.forEach(listener => listener(creatorId, key));
}

export const captureActorCacheKey = (clerkId: string) => `capture:actor:${clerkId}`;
