import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMobileAccount } from './useMobileAccount';
import { accountBlocked, accountRole } from '../services/accountAccess';
import { captureActorCacheKey, readCaptureCache, removeCaptureCache, writeCaptureCache,
  subscribeCaptureCache, type CaptureActor, type CaptureStorageKey } from '../services/captureSession';

/** Cached identity permits local drafts only; live server access authorizes APIs. */
export function useCaptureSession() {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const session = useMobileAccount();
  const [cached, setCached] = useState<{ subject: string; actor: CaptureActor | null } | null>(null);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  const known = useRef<CaptureActor | null>(null);
  const subject = isLoaded && isSignedIn === true && userId ? userId : null;
  const account = session.account;
  const eligible = !!account && account.clerkId === subject && accountRole(account) === 'creator'
    && !!account.certifiedAt && !account.rejectedAt && !accountBlocked(account) && !session.isBlocked && !session.isPreview;
  const liveActor: CaptureActor | null = eligible
    ? { creatorId: account._id, clerkId: account.clerkId } : null;
  const explicitDenial = !subject || session.isPreview || session.isBlocked || account === null
    || (!!account && !eligible) || (session.role != null && session.role !== 'creator');
  if (explicitDenial || (known.current && known.current.clerkId !== subject)) known.current = null;
  if (liveActor && session.isAuthenticated && !session.isOffline) known.current = liveActor;
  const remembered = known.current?.clerkId === subject ? known.current : null;
  const offlineActor = cached?.subject === subject ? cached.actor : null;
  const actor = explicitDenial ? null : liveActor ?? remembered ?? (session.isOffline ? offlineActor : null);
  const actorKey = actor ? `${actor.clerkId}:${actor.creatorId}` : null;
  const canQuery = !!actor && eligible && session.isAuthenticated && !session.isOffline;
  useEffect(() => subscribeCaptureCache((creatorId, key) => {
    if (creatorId === actor?.creatorId && key === 'current_submission_id') setRevision(value => value + 1);
  }), [actorKey]);
  const live = useRef({ actorKey, subject, canQuery });
  live.current = { actorKey, subject, canQuery };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    if (!subject) { setCached(null); return; }
    void AsyncStorage.getItem(captureActorCacheKey(subject)).then(raw => {
      if (!active) return;
      let value: CaptureActor | null = null;
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.clerkId === subject && typeof parsed.creatorId === 'string') value = parsed;
      } catch { /* A malformed cache never supplies an actor. */ }
      setCached({ subject, actor: value });
    }).catch(() => { if (active) setCached({ subject, actor: null }); });
    return () => { active = false; };
  }, [subject]);
  useEffect(() => {
    if (!subject || session.isOffline || session.isLoading) return;
    if (canQuery && actor) {
      void AsyncStorage.setItem(captureActorCacheKey(subject), JSON.stringify(actor)).catch(() => {});
    } else if (explicitDenial) {
      void AsyncStorage.removeItem(captureActorCacheKey(subject)).catch(() => {});
      setCached({ subject, actor: null });
    }
  }, [subject, actorKey, canQuery, explicitDenial, session.isLoading, session.isOffline]);
  const isCurrent = useCallback(() => !!actorKey && mounted.current && live.current.actorKey === actorKey
    && live.current.subject === actor?.clerkId, [actorKey, actor?.clerkId]);
  const canMutate = useCallback(() => isCurrent() && live.current.canQuery, [isCurrent]);
  const read = useCallback(async <T,>(key: CaptureStorageKey): Promise<T | null> => {
    if (!actor || !isCurrent()) return null;
    const value = await readCaptureCache<T>(actor.creatorId, key);
    return isCurrent() ? value : null;
  }, [actorKey, isCurrent]);
  const write = useCallback(async <T,>(key: CaptureStorageKey, value: T): Promise<void> => {
    if (!actor || !isCurrent()) throw new Error('Your capture account changed. Please reopen this draft.');
    await writeCaptureCache(actor.creatorId, key, value);
  }, [actorKey, isCurrent]);
  const remove = useCallback(async (key: CaptureStorageKey): Promise<void> => {
    if (!actor || !isCurrent()) return;
    await removeCaptureCache(actor.creatorId, key);
  }, [actorKey, isCurrent]);
  const isReady = isLoaded && (!!actor || (!session.isLoading
    && (!session.isOffline || cached?.subject === subject || !subject)));
  return { actor, actorKey, isReady, isOffline: session.isOffline, canQuery, isCurrent, canMutate, read, write, remove, revision };
}
