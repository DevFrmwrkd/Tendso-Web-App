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
  /** A separate, not-yet-created business workspace. */
  newBusiness?: boolean;
  /** Stable creation key: a retry after closing the app returns the same draft. */
  newBusinessKey?: string;
  kind?: SellKindId;
  businessName?: string;
  address?: string;
  city?: string;
  coordinates?: { lat: number; lng: number };
  detailsDirty?: Array<'businessName' | 'address' | 'city' | 'coordinates'>;
  /** self = the owner films themselves (front camera); friend = someone holds the phone (back camera). */
  how?: 'self' | 'friend';
  /** Only Next on this draft confirms the filming setup; `how` alone is a preference. */
  howConfirmedFor?: SubmissionId;
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
type BusinessDraft = Pick<OwnerIntake, 'kind' | 'businessName' | 'address' | 'city' | 'coordinates' | 'detailsDirty'
  | 'how' | 'howConfirmedFor' | 'audioOnly' | 'lang' | 'shots' | 'design'>;
let businesses = new Map<string, BusinessDraft>();
let pendingBusiness: BusinessDraft & { newBusinessKey?: string } = {};
let previousBusinessId: SubmissionId | undefined;
// A successful create is authoritative, but the reactive business list may render
// one frame later. During that handoff never select the previous business.
let awaitingBusinessId: SubmissionId | undefined;
let writes: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function businessFields(value: OwnerIntake): BusinessDraft {
  return {
    kind: value.kind, businessName: value.businessName, address: value.address, city: value.city,
    coordinates: value.coordinates, detailsDirty: value.detailsDirty, how: value.how,
    howConfirmedFor: value.howConfirmedFor, audioOnly: value.audioOnly, lang: value.lang,
    shots: value.shots, design: value.design,
  };
}

function rememberActive() {
  if (state.newBusiness) pendingBusiness = { ...businessFields(state), newBusinessKey: state.newBusinessKey };
  else if (state.submissionId) businesses.set(state.submissionId, businessFields(state));
}

function persist() {
  rememberActive();
  // Keep the active fields flat so previous per-account caches migrate directly.
  const json = JSON.stringify({ ...state, __businessDrafts: [...businesses], __newBusinessDraft: pendingBusiness,
    __previousBusinessId: previousBusinessId });
  const key = actorKey(actor);
  writes = writes.catch(() => {}).then(() => AsyncStorage.setItem(key, json));
  void writes.catch(() => {});
}

function invalidateWorkspace() {
  generation += 1;
  loaded = true;
  loading = undefined;
  uploadQueue.reset();
}

function activateBusiness(id: SubmissionId) {
  if (!state.newBusiness && state.submissionId === id) return;
  rememberActive();
  const { ownerName, uploads, how, audioOnly, lang } = state;
  state = { ownerName, uploads, how, audioOnly, lang, ...businesses.get(id), submissionId: id };
  awaitingBusinessId = undefined;
  invalidateWorkspace();
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
      businesses = new Map(); pendingBusiness = {}; previousBusinessId = undefined; awaitingBusinessId = undefined;
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
        if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
          const { __businessDrafts, __newBusinessDraft, __previousBusinessId, ...active } = cached;
          const restored = new Map<string, BusinessDraft>();
          if (Array.isArray(__businessDrafts)) for (const entry of __businessDrafts) {
            if (Array.isArray(entry) && typeof entry[0] === 'string' && entry[1] && typeof entry[1] === 'object') {
              restored.set(entry[0], businessFields(entry[1]));
            }
          }
          // Edits made while storage was loading belong to the current process.
          rememberActive();
          businesses = new Map([...restored, ...businesses]);
          if (!state.newBusiness && __newBusinessDraft && typeof __newBusinessDraft === 'object') {
            pendingBusiness = { ...businessFields(__newBusinessDraft), newBusinessKey: __newBusinessDraft.newBusinessKey };
          }
          if (!previousBusinessId && typeof __previousBusinessId === 'string') previousBusinessId = __previousBusinessId as SubmissionId;
          state = { ...active, ...state };
        }
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
    if (patch.submissionId && state.newBusiness) {
      // The just-created server draft adopts this fresh workspace's own fields.
      rememberActive();
      state = { ...state, newBusiness: undefined, newBusinessKey: undefined };
      pendingBusiness = {};
      awaitingBusinessId = patch.submissionId;
      invalidateWorkspace();
    } else if (patch.submissionId && patch.submissionId !== state.submissionId && (state.submissionId || businesses.has(patch.submissionId))) {
      activateBusiness(patch.submissionId);
    }
    state = { ...state, ...patch };
    emit();
    persist();
  },
  /** Only call with an id verified against the current owner's sites. */
  selectBusiness(id: SubmissionId) {
    activateBusiness(id);
    emit(); persist();
  },
  beginBusiness() {
    if (state.newBusiness) return;
    rememberActive();
    if (state.submissionId) previousBusinessId = state.submissionId;
    else if (!pendingBusiness.newBusinessKey) pendingBusiness = businessFields(state);
    const { ownerName, uploads, how, audioOnly, lang } = state;
    const newBusinessKey = pendingBusiness.newBusinessKey ?? `owner_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
    state = { ownerName, uploads, how, audioOnly, lang, ...pendingBusiness, newBusiness: true, newBusinessKey };
    awaitingBusinessId = undefined;
    invalidateWorkspace(); emit(); persist();
  },
  previousBusiness(): SubmissionId | undefined { return previousBusinessId; },
  isAwaitingBusiness(id: SubmissionId | undefined): boolean { return !!id && awaitingBusinessId === id; },
  confirmBusiness(id: SubmissionId) { if (awaitingBusinessId === id) awaitingBusinessId = undefined; },
  /** The caller validates the destination against the latest owned sites. */
  cancelNewBusiness(fallbackId?: SubmissionId) {
    if (!state.newBusiness) return;
    rememberActive();
    if (fallbackId) activateBusiness(fallbackId);
    else {
      state = { ownerName: state.ownerName, uploads: state.uploads };
      awaitingBusinessId = undefined;
      invalidateWorkspace();
    }
    emit(); persist();
  },
  /** Finish the journal write before starting network work or leaving capture. */
  flush(): Promise<void> { return writes; },
  /** After the site is sent (or on sign-out): start fresh next time. */
  clear() {
    generation += 1;
    state = {};
    businesses = new Map(); pendingBusiness = {}; previousBusinessId = undefined; awaitingBusinessId = undefined;
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
