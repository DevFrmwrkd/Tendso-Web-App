import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useNetwork } from '../../providers/NetworkProvider';
import { useOwnerSite } from './useOwnerSite';

/** Async UI work belongs to the account and site that opened the screen. */
export function useOwnerScope() {
  const owner = useOwnerSite();
  const { userId } = useAuth();
  const { isConnected } = useNetwork();
  const accountKey = `${userId ?? 'owner'}:${owner.me?.owner._id ?? ''}`;
  const scopeKey = `${accountKey}:${owner.id ?? ''}`;
  const live = useRef(scopeKey);
  live.current = scopeKey;
  const liveAccount = useRef(accountKey);
  liveAccount.current = accountKey;
  const livePhase = useRef(owner.site?.phase);
  livePhase.current = owner.site?.phase;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = useCallback(() => mounted.current && live.current === scopeKey, [scopeKey]);
  const isAccountCurrent = useCallback(() => mounted.current && liveAccount.current === accountKey, [accountKey]);
  const isDraftCurrent = useCallback(() => mounted.current && live.current === scopeKey && livePhase.current === 'draft', [scopeKey]);
  return { ...owner, accountKey, scopeKey, isCurrent, isAccountCurrent, isDraftCurrent, isOffline: isConnected === false };
}
