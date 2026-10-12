import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useConvexAuth, useQuery } from 'convex/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, type Doc } from '@tendso/convex-client';
import { useNetwork } from '../providers/NetworkProvider';
import { accountRole, accountBlocked, type MobileView } from '../services/accountAccess';

const CACHE_KEY = 'ndm_mobile_account_role';
type RoleCache = { clerkId: string; role: MobileView; blocked: boolean };
type MobileAccountState = {
  account: Doc<'creators'> | null | undefined;
  role: MobileView | null;
  view: MobileView;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOffline: boolean;
  isAdmin: boolean;
  isPreview: boolean;
  isBlocked: boolean;
  isOwner: boolean;
  setView: (view: MobileView) => void;
};
const Context = createContext<MobileAccountState | null>(null);

export function MobileAccountProvider({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;
  const canQuery = !!userId && isAuthenticated && !isOffline;
  const session = useQuery(api.adminAccess.me, canQuery ? {} : 'skip');
  // Match the authenticated Convex subject, rather than looking up a chosen id.
  const ownSession = canQuery && session?.clerkId === userId ? session : undefined;
  const account = ownSession?.creator;
  const isOwner = !!ownSession?.isOwner;
  const [cache, setCache] = useState<RoleCache | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [selection, setSelection] = useState<{ userId: string; view: MobileView } | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(CACHE_KEY).then((raw) => {
      if (!mounted || !raw) return;
      try {
        const value = JSON.parse(raw);
        if (typeof value.clerkId === 'string' && ['creator', 'affiliate', 'admin'].includes(value.role)) {
          setCache({ clerkId: value.clerkId, role: value.role, blocked: value.blocked === true });
        }
      } catch { /* An invalid cache never grants account access. */ }
    }).catch(() => {}).finally(() => { if (mounted) setCacheLoaded(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isLoaded || isOffline || authLoading) return;
    if (!isSignedIn) {
      setCache(null);
      setSelection(null);
      void AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    } else if (canQuery && account !== undefined) {
      const role = accountRole(account);
      if (!role || !account) {
        setCache(null);
        void AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
      } else {
        const next = { clerkId: userId, role, blocked: accountBlocked(account) };
        setCache(next);
        void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
      }
    }
  }, [isLoaded, isOffline, authLoading, isSignedIn, canQuery, account, userId]);

  const offlineCache = isOffline && cache && (!userId || userId === cache.clerkId) ? cache : null;
  const role = isOffline ? offlineCache?.role ?? null : accountRole(account);
  const isBlocked = isOffline ? offlineCache?.blocked ?? false : accountBlocked(account);
  // Cached roles control offline navigation only, never privileged data/actions.
  const isAdmin = canQuery && role === 'admin' && !isBlocked;
  const view = isAdmin && selection?.userId === userId ? selection.view : role ?? 'creator';
  const value = useMemo<MobileAccountState>(() => ({
    account, role, view, isAuthenticated, isOffline, isAdmin, isBlocked, isOwner,
    isPreview: isAdmin && view !== 'admin',
    isLoading: isOffline ? !cacheLoaded : !isLoaded || authLoading
      || (!!isSignedIn && (!isAuthenticated || account === undefined)),
    setView: (next) => { if (isAdmin && userId) setSelection({ userId, view: next }); },
  }), [account, role, view, isAuthenticated, isOffline, isAdmin, isBlocked, isOwner, cacheLoaded, isLoaded, authLoading, isSignedIn, userId]);
  return React.createElement(Context.Provider, { value }, children);
}

export function useMobileAccount(): MobileAccountState {
  const value = useContext(Context);
  if (!value) throw new Error('useMobileAccount requires MobileAccountProvider');
  return value;
}
