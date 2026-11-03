import type { Doc } from '@tendso/convex-client';

export type AdminSession = {
  account: Doc<'creators'> | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOffline: boolean;
  isAdmin: boolean;
};

/** Only the authenticated live account grants admin permissions. */
export function canUseAdminTools(session: AdminSession): boolean {
  const { account } = session;
  return !session.isLoading && session.isAuthenticated && !session.isOffline && session.isAdmin &&
    !!account && account.role === 'admin' && !account.isDeleted &&
    account.status !== 'deleted' && account.status !== 'suspended';
}

export function accountHome(account: AdminSession['account']) {
  return account?.role === 'affiliate' ? '/(app)/(affiliate-tabs)' as const : '/(app)/(tabs)' as const;
}
