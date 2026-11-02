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
import { uploadQueue } from './uploadQueue';

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
const actorKey = (id: string | null) => `tendso_owner_intake_v2:${id ? encodeURIComponent(id) : 'guest'}`;
let actor: string | null = null;
let generation = 0;
let state: OwnerIntake = {};
let loaded = false;
let loading: Promise<OwnerIntake> | undefined;
let writes: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const ownerIntake = {
  /** Bind before rendering capture or resuming jobs. Never carry a draft to a
   * different login; anonymous signup contributes only the typed name. */
  async bindActor(id: string | null): Promise<OwnerIntake> {
    if (actor !== id) {
      const name = actor === null && id ? state.ownerName : undefined;
      actor = id;
      generation += 1;
      state = name ? { ownerName: name } : {};
      loaded = false;
      loading = undefined;
      uploadQueue.reset();
      emit();
      if (name) {
        writes = writes.catch(() => {}).then(() => AsyncStorage.removeItem(actorKey(null)));
        void writes.catch(() => {});
      }
    }
    return this.load();
  },
  scope(): number { return generation; },
  isCurrent(scope: number): boolean { return scope === generation; },
  get(): OwnerIntake {
    return state;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async load(): Promise<OwnerIntake> {
    if (loaded) return state;
    if (loading) return loading;
    const scope = generation;
    const key = actorKey(actor);
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (scope !== generation) return state;
        const cached = raw ? JSON.parse(raw) : null;
        if (cached && typeof cached === 'object' && !Array.isArray(cached)) state = { ...cached, ...state };
      } catch { /* a broken cache is just empty */ }
      if (scope === generation) {
        loaded = true;
        loading = undefined;
        emit();
      }
      return state;
    })();
    return loading;
  },
  /** The old unscoped cache is adopted only after the server confirms ownership. */
  async migrateLegacy(ownedIds: readonly SubmissionId[]): Promise<void> {
    if (!actor || state.submissionId) return;
    const scope = generation;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw || scope !== generation || state.submissionId) return;
      const cached = JSON.parse(raw) as OwnerIntake;
      if (!cached || !cached.submissionId || !ownedIds.includes(cached.submissionId)) return;
      this.set({ ...cached, ...state });
      await this.flush();
      // Removing legacy data cannot erase a different actor's v2 cache.
      await AsyncStorage.removeItem(KEY);
    } catch { /* Leave the legacy cache intact if migration could not persist. */ }
  },
  set(patch: Partial<OwnerIntake>) {
    if (patch.submissionId && state.submissionId && patch.submissionId !== state.submissionId) {
      // Site-specific values have no embedded id. Do not reinterpret them as
      // another shop's photos or business details when the owner switches sites.
      const { ownerName, how, audioOnly, lang, uploads } = state;
      state = { ownerName, how, audioOnly, lang, uploads };
      generation += 1;
      uploadQueue.reset();
    }
    state = { ...state, ...patch };
    emit();
    const json = JSON.stringify(state);
    const key = actorKey(actor);
    writes = writes.catch(() => {}).then(() => AsyncStorage.setItem(key, json));
    void writes.catch(() => {});
  },
  /** Finish the journal write before starting network work or leaving capture. */
  flush(): Promise<void> { return writes; },
  /** After the site is sent (or on sign-out): start fresh next time. */
  clear() {
    generation += 1;
    state = {};
    loaded = true;
    loading = undefined;
    uploadQueue.reset();
    emit();
    const key = actorKey(actor);
    writes = writes.catch(() => {}).then(() => AsyncStorage.removeItem(key));
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
