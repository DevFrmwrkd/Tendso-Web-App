import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useNetwork } from '../providers/NetworkProvider';
import { useMobileAccount } from './useMobileAccount';
import {
  completeNativeAttribution, loadNativeAttribution, saveNativeAttribution, suggestNativeAttribution,
  type AttributionSuggestion,
} from '../services/creatorAttribution';

export type CreatorAttributionOptions = { enabled?: boolean; claimAs?: 'agent' | 'owner' };
type Candidate = { suggestion: AttributionSuggestion; subject: string | null; claimAs: CreatorAttributionOptions['claimAs']; version: number };

/** A same-network match is only a question. Only explicit Yes can become a claim. */
export function useCreatorAttribution({ enabled = true, claimAs }: CreatorAttributionOptions = {}) {
  const { userId, isLoaded, isSignedIn, getToken } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const { isConnected } = useNetwork();
  const account = useMobileAccount();
  const subject = isSignedIn && userId ? userId : null;
  const online = isConnected !== false;
  const allowedRole = !subject || (!account.isLoading && !account.isBlocked && !account.isAdmin && !account.isPreview
    && account.role !== 'affiliate' && (!account.account || account.account.clerkId === subject)
    && (claimAs === undefined || (claimAs === 'owner' ? account.isOwner || !account.account : !account.isOwner)));
  const ready = enabled && isLoaded && allowedRole && (!subject || isAuthenticated);
  const existing = useQuery(api.attribution.myAttribution, ready && !!subject && online ? {} : 'skip');
  const claim = useMutation(api.attribution.claimAttribution);
  const [selection, setSelection] = useState<Candidate | null>(null);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const selectionRef = useRef<Candidate | null>(null);
  const busyRef = useRef(false);
  const latest = useRef({ subject, claimAs, ready, online, getToken, claim });
  latest.current = { subject, claimAs, ready, online, getToken, claim };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; selectionRef.current = null; epoch.current++; };
  }, []);
  const clearCandidate = () => { selectionRef.current = null; setSelection(null); };
  const showCandidate = (suggestion: AttributionSuggestion, version: number) => {
    const next = { suggestion, version, subject, claimAs };
    selectionRef.current = next; setSelection(next);
  };
  const scopeCurrent = (scope: Candidate) => mounted.current && epoch.current === scope.version
    && latest.current.subject === scope.subject && latest.current.claimAs === scope.claimAs && latest.current.ready;
  // Hide an old account's question synchronously, before passive effects reset its state.
  const activeSelection = selection && selectionRef.current === selection && scopeCurrent(selection) ? selection : null;

  const claimConfirmed = async (suggestion: AttributionSuggestion, current: () => boolean) => {
    const session = latest.current;
    if (!current() || !session.subject || !session.claimAs || !session.ready || !session.online) return;
    // Wait for Clerk hydration and recheck after it, before invoking the authenticated mutation.
    const token = await session.getToken({ template: 'convex' });
    if (!token || !current() || !latest.current.online || !latest.current.ready) {
      if (current()) setError('Reconnect to finish confirming who sent you.');
      return;
    }
    await session.claim({ handle: suggestion.creator.handle, source: 'confirmed', as: session.claimAs });
    if (!current() || !latest.current.ready) return;
    // Claimed/unchanged/already_attributed all preserve the server's first claim.
    await completeNativeAttribution(session.subject, suggestion.creator.handle, current);
    if (current()) { clearCandidate(); setPending(false); setError(null); }
  };

  useEffect(() => {
    const version = ++epoch.current;
    const current = () => mounted.current && epoch.current === version && latest.current.subject === subject
      && latest.current.claimAs === claimAs && latest.current.ready;
    clearCandidate(); setPending(false); setError(null); setBusy(false); busyRef.current = false;
    if (!ready || (subject && online && existing === undefined)) return;
    busyRef.current = true;
    void (async () => {
      const state = await loadNativeAttribution(subject, current);
      if (!state || !current()) return;
      if (subject && existing) {
        await completeNativeAttribution(subject, null, current);
        return;
      }
      if (state.pending) {
        // Signed-out consent stays local until an explicit agent/owner path is known.
        if (subject && claimAs) {
          showCandidate(state.pending, version); setPending(true); setBusy(online);
          if (online) await claimConfirmed(state.pending, current);
        }
        return;
      }
      if (state.acknowledged || !online) return;
      const token = subject ? await latest.current.getToken({ template: 'convex' }) : undefined;
      if (!current() || (subject && !token)) return;
      const suggestion = await suggestNativeAttribution(token);
      if (!current()) return;
      if (suggestion) showCandidate(suggestion, version);
      else await saveNativeAttribution(subject, null, current);
    })().catch(() => { if (current()) setError('Could not confirm who sent you. Please try again.'); })
      .finally(() => { if (current()) { busyRef.current = false; setBusy(false); } });
    return () => { if (epoch.current === version) epoch.current++; };
  }, [subject, claimAs, ready, online, existing === undefined, !!existing, retryCount]);

  const confirm = useCallback(async () => {
    if (!activeSelection || busyRef.current || !scopeCurrent(activeSelection) || selectionRef.current !== activeSelection) return;
    const { suggestion } = activeSelection;
    const session = latest.current;
    const current = () => scopeCurrent(activeSelection) && selectionRef.current === activeSelection;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const saved = await saveNativeAttribution(session.subject, suggestion, current);
      if (!saved || !current()) return;
      setPending(true);
      if (session.subject && session.claimAs) await claimConfirmed(suggestion, current);
      else clearCandidate();
    } catch { if (current()) setError('Your answer could not be confirmed. Please try again.'); }
    finally { if (scopeCurrent(activeSelection)) { busyRef.current = false; setBusy(false); } }
  }, [activeSelection]);

  const decline = useCallback(async () => {
    if (!activeSelection || busyRef.current || !scopeCurrent(activeSelection) || selectionRef.current !== activeSelection) return;
    const session = latest.current;
    const current = () => scopeCurrent(activeSelection) && selectionRef.current === activeSelection;
    busyRef.current = true; setBusy(true);
    try {
      await saveNativeAttribution(session.subject, null, current);
      if (current()) { clearCandidate(); setPending(false); setError(null); }
    } catch { if (current()) setError('Could not save your answer. Please try again.'); }
    finally { if (scopeCurrent(activeSelection)) { busyRef.current = false; setBusy(false); } }
  }, [activeSelection]);
  return { candidate: activeSelection?.suggestion ?? null, busy, error, pending, confirm, decline,
    retry: () => {
      if (activeSelection && scopeCurrent(activeSelection) && selectionRef.current === activeSelection && !busyRef.current) {
        setRetryCount(value => value + 1);
      }
    } };
}
