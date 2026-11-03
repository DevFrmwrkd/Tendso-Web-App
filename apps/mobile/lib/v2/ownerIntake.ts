/**
 * Per-owner local cache of the shared draft and the files still uploading from
 * this phone. Cloud revisions protect a web edit from an older device journal.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SellKindId } from './ownerContent';
import type { Lang } from './captureContent';
import type { OwnerDraftProgress, OwnerSubmission, SubmissionId } from './ownerTypes';
import { sellKindFromServer } from './ownerContent';
import { uploadQueue } from './uploadQueue';

/** Serializable upload journal. Keep successful entries until submit so a stale
 * server snapshot cannot enqueue the same local file again. */
export type OwnerUpload = {
  submissionId: SubmissionId;
  index: number;
  uri: string;
  uploadedUrl?: string;
  saved?: boolean;
  /** Kept on this phone after another device changes the draft; never replay automatically. */
  pausedByRemote?: boolean;
} & (
  | { kind: 'photo'; extra: boolean; label?: string }
  | { kind: 'answer'; mediaType: 'video' | 'audio'; lang: Lang; durationSec: number }
);

export type OwnerPendingMetadata = Partial<Pick<OwnerIntake, 'businessName' | 'address' | 'city' | 'coordinates' | 'kind' | 'design' | 'how' | 'audioOnly' | 'lang' | 'draftProgress'>>;

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
  /** Last server acknowledgement, scoped to this business. Never infer it from local timestamps. */
  draftRevision?: number;
  draftProgress?: OwnerDraftProgress;
  syncNotice?: string;
  /** Recoverable phone edits, kept apart from the displayed cloud version until an explicit choice. */
  remoteConflictMetadata?: OwnerPendingMetadata;
  applyingPhoneMetadata?: boolean;
  draftMetadataBase?: OwnerPendingMetadata;
}

const KEY = 'tendso_owner_intake_v1';
const actorKey = (id: string | null) => `tendso_owner_intake_v2:${id ? encodeURIComponent(id) : 'guest'}`;
let actor: string | null = null;
let session: string | null | undefined;
let generation = 0;
let state: OwnerIntake = {};
let loaded = false;
let loading: Promise<OwnerIntake> | undefined;
type BusinessDraft = Pick<OwnerIntake, 'kind' | 'businessName' | 'address' | 'city' | 'coordinates' | 'detailsDirty'
  | 'how' | 'howConfirmedFor' | 'audioOnly' | 'lang' | 'shots' | 'design' | 'draftRevision' | 'draftProgress' | 'syncNotice'
  | 'remoteConflictMetadata' | 'applyingPhoneMetadata' | 'draftMetadataBase'>;
let businesses = new Map<string, BusinessDraft>();
const hydrated = new Set<string>();
const writing = new Map<string, number>();
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
    draftRevision: value.draftRevision, draftProgress: value.draftProgress, syncNotice: value.syncNotice,
    remoteConflictMetadata: value.remoteConflictMetadata, applyingPhoneMetadata: value.applyingPhoneMetadata, draftMetadataBase: value.draftMetadataBase,
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
  async bindActor(id: string | null, sessionId?: string | null): Promise<OwnerIntake> {
    if (actor === id && sessionId !== undefined && session !== sessionId) {
      session = sessionId;
      hydrated.clear(); invalidateWorkspace(); emit();
    }
    if (actor !== id) {
      const name = actor === null && id ? state.ownerName : undefined;
      actor = id;
      session = sessionId;
      generation += 1;
      state = name ? { ownerName: name } : {};
      businesses = new Map(); pendingBusiness = {}; previousBusinessId = undefined; awaitingBusinessId = undefined;
      hydrated.clear();
      writing.clear();
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
  actor(): string | null { return actor; },
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
      state = { ...state, draftRevision: businesses.get(patch.submissionId)?.draftRevision, newBusiness: undefined, newBusinessKey: undefined };
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
  revision(id: SubmissionId): number | undefined { return state.submissionId === id ? state.draftRevision : businesses.get(id)?.draftRevision; },
  isHydrated(id: SubmissionId): boolean { return hydrated.has(id); },
  usePausedUploads(id: SubmissionId) {
    if (state.submissionId !== id || !hydrated.has(id)) return;
    const shots = [...(state.shots ?? [])];
    const uploads = state.uploads?.map(upload => {
      if (upload.submissionId !== id || !upload.pausedByRemote) return upload;
      if (upload.kind === 'photo' && !upload.extra) shots[upload.index] = upload.uri;
      return { ...upload, pausedByRemote: undefined };
    });
    this.set({ uploads, shots, syncNotice: undefined });
  },
  keepCloudMetadata(id: SubmissionId) {
    if (state.submissionId === id) this.set({ remoteConflictMetadata: undefined, applyingPhoneMetadata: undefined, syncNotice: undefined,
      uploads: state.uploads?.filter(upload => upload.submissionId !== id || !upload.pausedByRemote) });
  },
  usePhoneMetadata(id: SubmissionId) {
    if (state.submissionId !== id || !hydrated.has(id) || !state.remoteConflictMetadata) return;
    const metadata = state.remoteConflictMetadata;
    const fields = (['businessName', 'address', 'city', 'coordinates'] as const).filter(key => key in metadata);
    this.set({ ...metadata, detailsDirty: fields.length ? fields : state.detailsDirty,
      ...(metadata.how ? { howConfirmedFor: id } : {}), applyingPhoneMetadata: true, syncNotice: undefined });
  },
  finishPhoneMetadata(id: SubmissionId, scope: number) {
    if (state.submissionId === id && this.isCurrent(scope) && state.applyingPhoneMetadata) this.set({ remoteConflictMetadata: undefined, applyingPhoneMetadata: undefined });
  },
  beginWrite(id: SubmissionId) { const key = `${generation}:${id}`; writing.set(key, (writing.get(key) ?? 0) + 1); },
  finishWrite(id: SubmissionId, scope: number) {
    const key = `${scope}:${id}`; const left = Math.max(0, (writing.get(key) ?? 1) - 1);
    if (left) writing.set(key, left); else writing.delete(key);
    if (this.isCurrent(scope)) { state = { ...state }; emit(); }
  },
  /** Fresh create has revision zero; this also seeds the first guarded details save before attachment. */
  primeRevision(id: SubmissionId, revision: number) {
    businesses.set(id, { ...businesses.get(id), draftRevision: revision });
  },
  acknowledge(id: SubmissionId, revision: number, scope: number, args?: Record<string, unknown>) {
    if (!this.isCurrent(scope) || !Number.isSafeInteger(revision) || revision < 0) return;
    const before = this.revision(id);
    if (before !== undefined && revision < before) return;
    businesses.set(id, { ...businesses.get(id), draftRevision: revision });
    if (state.submissionId === id) {
      const base = { ...state.draftMetadataBase };
      if (args) {
        for (const key of ['businessName', 'address', 'city', 'coordinates'] as const) if (key in args) Object.assign(base, { [key]: args[key] });
        if (typeof args.businessType === 'string') base.kind = sellKindFromServer(args.businessType, typeof args.shotListKey === 'string' ? args.shotListKey : undefined).id;
        if (typeof args.templateId === 'string') base.design = args.templateId;
        if (args.progress && typeof args.progress === 'object') {
          const progress = args.progress as OwnerDraftProgress;
          base.draftProgress = progress; base.how = progress.how; base.audioOnly = progress.audioOnly; base.lang = progress.lang;
        }
      }
      state = { ...state, draftRevision: revision, draftMetadataBase: base }; emit(); persist();
    }
  },
  /** Canonical snapshots replace stale device caches, while unsent files remain recoverable locally. */
  restoreDraft(draft: OwnerSubmission): boolean {
    const id = draft.submissionId;
    if (state.submissionId !== id || draft.phase !== 'draft' || draft.actorClerkId && draft.actorClerkId !== actor) return false;
    const revision = draft.draftRevision ?? 0;
    const previous = state.draftRevision;
    if (previous !== undefined && revision < previous) return false; // Query may lag a mutation acknowledgement.
    if (hydrated.has(id) && previous === revision) return true;
    if (previous !== undefined && revision > previous && (writing.get(`${generation}:${id}`) ?? 0) > 0) return false;
    const changedElsewhere = previous !== undefined ? revision > previous : revision > 0
      && (!!state.detailsDirty?.length || !!state.shots?.some(Boolean) || !!state.uploads?.some(upload => upload.submissionId === id));
    const preserveLocal = !changedElsewhere && (previous === revision || previous === undefined && revision === 0);
    const metadataBase = state.draftMetadataBase;
    const pendingMetadata: OwnerPendingMetadata = { ...state.remoteConflictMetadata };
    if (changedElsewhere) {
      for (const key of state.detailsDirty ?? []) Object.assign(pendingMetadata, { [key]: state[key] });
      for (const key of ['kind', 'design', 'how', 'audioOnly', 'lang', 'draftProgress'] as const) {
        if (state[key] !== undefined && (!metadataBase || JSON.stringify(state[key]) !== JSON.stringify(metadataBase[key])))
          Object.assign(pendingMetadata, { [key]: state[key] });
      }
    }
    const uploads = (state.uploads ?? []).map(upload => {
      if (upload.submissionId !== id) return upload;
      const remoteUrl = upload.kind === 'photo' ? draft.shots.find(shot => shot.index === upload.index && shot.extra === upload.extra)?.url
        : draft.interview.find(answer => answer.index === upload.index)?.mediaUrl;
      if (upload.uploadedUrl && remoteUrl === upload.uploadedUrl) return { ...upload, saved: true, pausedByRemote: undefined };
      return changedElsewhere && !upload.saved ? { ...upload, pausedByRemote: true } : upload;
    });
    // Legacy pre-journal files also remain on this device, but cannot replace cloud photos after a remote edit.
    if (changedElsewhere) state.shots?.forEach((uri, index) => {
      if (uri && !/^https?:\/\//.test(uri) && !uploads.some(upload => upload.submissionId === id && upload.kind === 'photo' && !upload.extra && upload.index === index))
        uploads.push({ kind: 'photo', submissionId: id, index, uri, extra: false, pausedByRemote: true });
    });
    const shots: (string | null)[] = [];
    draft.shots.filter(shot => !shot.extra).forEach(shot => { shots[shot.index] = shot.url; });
    uploads.forEach(upload => { if (upload.submissionId === id && upload.kind === 'photo' && !upload.extra && !upload.saved && !upload.pausedByRemote) shots[upload.index] = upload.uri; });
    const progress = draft.draftProgress ?? undefined;
    const localDetails = preserveLocal && state.detailsDirty?.length ? Object.fromEntries(state.detailsDirty.map(key => [key, state[key]])) : {};
    state = { ...state, ...localDetails, kind: preserveLocal && state.kind ? state.kind : sellKindFromServer(draft.businessType, draft.shotListKey).id,
      businessName: draft.businessName, address: draft.address, city: draft.city, coordinates: draft.coordinates ?? undefined, ...localDetails,
      detailsDirty: preserveLocal ? state.detailsDirty : undefined,
      how: preserveLocal && state.howConfirmedFor === id ? state.how : progress?.how ?? state.how,
      howConfirmedFor: progress?.how || preserveLocal && state.howConfirmedFor === id ? id : undefined,
      audioOnly: preserveLocal ? state.audioOnly ?? progress?.audioOnly : progress?.audioOnly,
      lang: preserveLocal ? state.lang ?? progress?.lang : progress?.lang,
      design: preserveLocal ? state.design ?? draft.templateId ?? undefined : draft.templateId ?? undefined,
      shots, uploads, draftRevision: revision, draftProgress: progress,
      draftMetadataBase: { businessName: draft.businessName, address: draft.address, city: draft.city, coordinates: draft.coordinates ?? undefined,
        kind: sellKindFromServer(draft.businessType, draft.shotListKey).id, design: draft.templateId ?? undefined,
        how: progress?.how, audioOnly: progress?.audioOnly, lang: progress?.lang, draftProgress: progress },
      remoteConflictMetadata: Object.keys(pendingMetadata).length ? pendingMetadata : undefined,
      applyingPhoneMetadata: changedElsewhere ? undefined : state.applyingPhoneMetadata,
      syncNotice: changedElsewhere ? 'A newer version of this draft is saved. We loaded it and kept this phone’s unfinished uploads separate so they cannot replace your saved changes.' : state.syncNotice };
    if (changedElsewhere) invalidateWorkspace();
    hydrated.add(id); emit(); persist();
    return true;
  },
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
    hydrated.clear();
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
