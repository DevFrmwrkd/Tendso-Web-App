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
  /** The design picked (template code). */
  design?: string;
}

const KEY = 'tendso_owner_intake_v1';
let state: OwnerIntake = {};
let loaded = false;
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
    void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  },
  /** After the site is sent (or on sign-out): start fresh next time. */
  clear() {
    state = {};
    emit();
    void AsyncStorage.removeItem(KEY).catch(() => {});
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
