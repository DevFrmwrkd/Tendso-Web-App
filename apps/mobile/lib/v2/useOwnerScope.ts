import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useNetwork } from '../../providers/NetworkProvider';
import { useOwnerSite } from './useOwnerSite';
import { ownerIntake } from './ownerIntake';

/** Async UI work belongs to the account and site that opened the screen. */
export function useOwnerScope() {
  const owner = useOwnerSite();
  const { userId, sessionId } = useAuth();
  const { isConnected } = useNetwork();
  const accountKey = `${userId ?? 'owner'}:${sessionId ?? ''}:${owner.me?.owner._id ?? ''}`;
  const intakeScope = ownerIntake.scope();
  const scopeKey = `${accountKey}:${owner.isNewBusiness ? `new:${ownerIntake.get().newBusinessKey ?? ''}` : owner.id ?? ''}:${intakeScope}`;
  const live = useRef(scopeKey);
  live.current = scopeKey;
  const liveAccount = useRef(accountKey);
  liveAccount.current = accountKey;
  const livePhase = useRef(owner.site?.phase);
  livePhase.current = owner.site?.phase;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = useCallback(() => mounted.current && live.current === scopeKey && ownerIntake.isCurrent(intakeScope), [scopeKey, intakeScope]);
  const isAccountCurrent = useCallback(() => mounted.current && liveAccount.current === accountKey && ownerIntake.isCurrent(intakeScope), [accountKey, intakeScope]);
  /** For an intentional workspace attachment, also check its newly captured epoch/id. */
  const isActorCurrent = useCallback(() => mounted.current && liveAccount.current === accountKey, [accountKey]);
  const isDraftCurrent = useCallback(() => mounted.current && live.current === scopeKey && livePhase.current === 'draft' && ownerIntake.isCurrent(intakeScope), [scopeKey, intakeScope]);
  return { ...owner, accountKey, scopeKey, isCurrent, isAccountCurrent, isActorCurrent, isDraftCurrent, isOffline: isConnected === false };
}
