export type MobileView = 'creator' | 'affiliate' | 'admin';
export type MobileAccount = { role?: string; status?: string; isDeleted?: boolean };

export function accountRole(account: MobileAccount | null | undefined): MobileView | null {
  if (!account) return null;
  if (account.role === undefined || account.role === 'creator') return 'creator';
  return account.role === 'affiliate' || account.role === 'admin' ? account.role : null;
}

export function accountBlocked(account: MobileAccount | null | undefined): boolean {
  return !!account && (account.isDeleted || account.status === 'deleted'
    || (account.status === 'suspended' && account.role !== 'affiliate'));
}

export function mobileHome(view: MobileView | null): string {
  if (view === 'affiliate') return '/(app)/(affiliate-tabs)/';
  if (view === 'admin') return '/(app)/admin';
  return '/(app)/(tabs)/';
}

const SHARED_ROUTES = new Set([
  'referrals', 'notifications', 'edit-profile', 'change-password',
  'terms-of-service', 'privacy-policy', 'help-faq',
]);

/** Returns a redirect for a wrong-role deep link before mounting its screen. */
export function accountRouteRedirect(view: MobileView, route: string | undefined, preview = false): string | null {
  if (!route || route === 'account-setup' || route === 'account-unavailable') return mobileHome(view);
  if (preview && route !== (view === 'affiliate' ? '(affiliate-tabs)' : '(tabs)')) return mobileHome(view);
  if (SHARED_ROUTES.has(route)) return null;
  if (view === 'affiliate') return route === '(affiliate-tabs)' ? null : mobileHome(view);
  if (view === 'admin') return route === 'admin' ? null : mobileHome(view);
  if (route === 'admin' || route === '(affiliate-tabs)') return mobileHome(view);
  return null;
}
