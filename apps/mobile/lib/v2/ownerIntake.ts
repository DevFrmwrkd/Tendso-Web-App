/**
 * What the owner chose on the start screens that the server does not keep
 * (who holds the phone, voice only, language), plus the answers before the draft
 * exists. Saved on the phone so a closed app resumes where it was.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SellKindId } from './ownerContent';
import type { Lang } from './captureContent';
import type { SubmissionId } from './ownerTypes';

/** Serializable upload journal. Keep successful entries until submit so a stale
 * server snapshot cannot enqueue the same local file again. */
export type OwnerUpload = {
  submissionId: SubmissionId;
  index: number;
  uri: string;
  uploadedUrl?: string;
  saved?: boolean;
} & (
  | { kind: 'photo'; extra: boolean; label?: string }
  | { kind: 'answer'; mediaType: 'video' | 'audio'; lang: Lang; durationSec: number }
);

export interface OwnerIntake {
  /** The name typed on the sign-up screen (sent with owners.ensure). */
  ownerName?: string;
  kind?: SellKindId;
  businessName?: string;
  address?: string;
  city?: string;
  coordinates?: { lat: number; lng: number };
  /** self = the owner films themselves (front camera); friend = someone holds the phone (back camera). */
  how?: 'self' | 'friend';
  audioOnly?: boolean;
  lang?: Lang;
  /** The draft on the server, once created. */
  submissionId?: SubmissionId;
  /** Local photo uris per guided task (for the strip while uploads finish). */
  shots?: (string | null)[];
  /** Pending photos (including extras) and interview recordings, resumable after restart. */
  uploads?: OwnerUpload[];
  /** The design picked (template code). */
  design?: string;
}

const KEY = 'tendso_owner_intake_v1';
let state: OwnerIntake = {};
let loaded = false;
let writes: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const ownerIntake = {
  get(): OwnerIntake {
    return state;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async load(): Promise<OwnerIntake> {
    if (loaded) return state;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) state = { ...JSON.parse(raw), ...state };
    } catch { /* a broken cache is just empty */ }
    loaded = true;
    emit();
    return state;
  },
  set(patch: Partial<OwnerIntake>) {
    state = { ...state, ...patch };
    emit();
    const json = JSON.stringify(state);
    writes = writes.catch(() => {}).then(() => AsyncStorage.setItem(KEY, json));
    void writes.catch(() => {});
  },
  /** Finish the journal write before starting network work or leaving capture. */
  flush(): Promise<void> { return writes; },
  /** After the site is sent (or on sign-out): start fresh next time. */
  clear() {
    state = {};
    emit();
    writes = writes.catch(() => {}).then(() => AsyncStorage.removeItem(KEY));
    void writes.catch(() => {});
  },
};

export function useOwnerIntake(): OwnerIntake {
  return useSyncExternalStore(ownerIntake.subscribe, ownerIntake.get, ownerIntake.get);
}

/** Set when someone taps "I have a business" on the welcome screen (read by the root routing). */
export const OWNER_INTENT_KEY = 'tendso_intent';

export async function setOwnerIntent(on: boolean) {
  try {
    if (on) await AsyncStorage.setItem(OWNER_INTENT_KEY, 'owner');
    else await AsyncStorage.removeItem(OWNER_INTENT_KEY);
  } catch { /* ignore */ }
}

export async function hasOwnerIntent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OWNER_INTENT_KEY)) === 'owner';
  } catch {
    return false;
  }
}
