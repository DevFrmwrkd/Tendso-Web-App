import AsyncStorage from '@react-native-async-storage/async-storage';

export type AttributionKind = 'shop' | 'earn';
export type AttributionSuggestion = {
  creator: { handle: string; name: string; photo: string | null };
  kind: AttributionKind;
  clickedAt: number;
  matchedBy: 'cookie' | 'network';
};
export type AttributionConsent = AttributionSuggestion & { confirmedAt: number };
export type NativeAttributionState = { acknowledged: boolean; pending: AttributionConsent | null; consumedBy?: string };
const PREFIX = 'ndm_creator_attribution_v1:';
export const attributionStateKey = (subject: string | null) => PREFIX + (subject ? `actor:${encodeURIComponent(subject)}` : 'anonymous');
let storageWork: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = storageWork.then(work, work);
  storageWork = result.catch(() => {});
  return result;
}
const empty = (): NativeAttributionState => ({ acknowledged: false, pending: null });
export function parseAttributionSuggestion(value: unknown): AttributionSuggestion | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, any>;
  const creator = row.creator;
  if (!creator || typeof creator.handle !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(creator.handle)
    || creator.handle.length < 3 || creator.handle.length > 30 || typeof creator.name !== 'string' || !creator.name.trim()
    || !['shop', 'earn'].includes(row.kind) || !['cookie', 'network'].includes(row.matchedBy)
    || typeof row.clickedAt !== 'number' || !Number.isFinite(row.clickedAt)) return null;
  return { creator: { handle: creator.handle, name: creator.name.trim().slice(0, 120),
    photo: typeof creator.photo === 'string' && /^https?:\/\//.test(creator.photo) ? creator.photo : null },
  kind: row.kind, clickedAt: row.clickedAt, matchedBy: row.matchedBy };
}
async function read(subject: string | null): Promise<NativeAttributionState> {
  const raw = await AsyncStorage.getItem(attributionStateKey(subject));
  if (!raw) return empty();
  try {
    const value = JSON.parse(raw);
    const suggestion = parseAttributionSuggestion(value?.pending);
    return { acknowledged: value?.acknowledged === true,
      pending: suggestion && typeof value.pending.confirmedAt === 'number' && Number.isFinite(value.pending.confirmedAt)
        ? { ...suggestion, confirmedAt: value.pending.confirmedAt } : null,
      ...(typeof value?.consumedBy === 'string' ? { consumedBy: value.consumedBy } : {}) };
  } catch { return empty(); }
}

/** Reserve a signed-out answer for the first authenticated subject, never the next login. */
export function loadNativeAttribution(subject: string | null, isCurrent: () => boolean): Promise<NativeAttributionState | null> {
  return serialized(async () => {
    const own = await read(subject);
    if (!isCurrent()) return null;
    if (!subject || own.acknowledged) return own;
    const anonymous = await read(null);
    if (!isCurrent()) return null;
    if (!anonymous.acknowledged || (anonymous.consumedBy && anonymous.consumedBy !== subject)) return own;
    // Reserve first so an account change between writes cannot give another subject this consent.
    if (!anonymous.consumedBy) await AsyncStorage.setItem(attributionStateKey(null), JSON.stringify({ ...anonymous, consumedBy: subject }));
    if (!isCurrent()) return null;
    const adopted = { acknowledged: true, pending: anonymous.pending };
    await AsyncStorage.setItem(attributionStateKey(subject), JSON.stringify(adopted));
    return isCurrent() ? adopted : null;
  });
}

/** Yes saves confirmed consent; No/null clears it. Neither operation claims a referral. */
export function saveNativeAttribution(subject: string | null, suggestion: AttributionSuggestion | null, isCurrent: () => boolean): Promise<NativeAttributionState | null> {
  return serialized(async () => {
    if (!isCurrent()) return null;
    const state = { acknowledged: true, pending: suggestion ? { ...suggestion, confirmedAt: Date.now() } : null };
    await AsyncStorage.setItem(attributionStateKey(subject), JSON.stringify(state));
    return isCurrent() ? state : null;
  });
}

export function completeNativeAttribution(subject: string, handle: string | null, isCurrent: () => boolean): Promise<void> {
  return serialized(async () => {
    const state = await read(subject);
    if (!isCurrent() || (handle && state.pending?.creator.handle !== handle)) return;
    await AsyncStorage.setItem(attributionStateKey(subject), JSON.stringify({ acknowledged: true, pending: null }));
  });
}

/** Use this deployment's HTTP endpoint. A failed/empty guess never creates an attribution. */
export async function suggestNativeAttribution(token?: string | null): Promise<AttributionSuggestion | null> {
  const configured = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
  const cloud = process.env.EXPO_PUBLIC_CONVEX_URL;
  const site = configured ?? (cloud?.endsWith('.convex.cloud') ? cloud.replace(/\.convex\.cloud$/, '.convex.site') : undefined);
  if (!site || !/^https:\/\//.test(site)) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(`${site.replace(/\/$/, '')}/attribution/suggest`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: '{}', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Could not check who sent you.');
        const body = await response.json();
        return parseAttributionSuggestion(body?.suggestion);
      })(),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Attribution lookup timed out')); }, 6000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
