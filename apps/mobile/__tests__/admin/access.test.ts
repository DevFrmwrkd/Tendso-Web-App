import type { Doc } from '@tendso/convex-client';
import { accountHome, canUseAdminTools, type AdminSession } from '../../components/admin/access';

const account = { _id: 'admin-1', clerkId: 'clerk-admin', role: 'admin', status: 'active' } as Doc<'creators'>;
const ready: AdminSession = { account, isLoading: false, isAuthenticated: true, isOffline: false, isAdmin: true };

describe('native admin access', () => {
  it.each(['active', 'pending', undefined])('accepts live nonblocked admin status %s', status => {
    expect(canUseAdminTools({ ...ready, account: { ...account, status } })).toBe(true);
  });
  it.each(['creator', 'affiliate', 'staff', 'system', undefined])('denies actual role %s even when UI selection claims admin', role => {
    expect(canUseAdminTools({ ...ready, account: { ...account, role } as Doc<'creators'> })).toBe(false);
  });
  it.each([
    { isLoading: true }, { isAuthenticated: false }, { isOffline: true }, { isAdmin: false }, { account: null }, { account: undefined },
    { account: { ...account, isDeleted: true } }, { account: { ...account, status: 'deleted' } }, { account: { ...account, status: 'suspended' } },
  ])('denies incomplete/offline/blocked session %#', change => {
    expect(canUseAdminTools({ ...ready, ...change })).toBe(false);
  });
  it('sends affiliates to their own navigation and creators to creator navigation', () => {
    expect(accountHome({ ...account, role: 'affiliate' })).toBe('/(app)/(affiliate-tabs)/');
    expect(accountHome({ ...account, role: 'creator' })).toBe('/(app)/(tabs)/');
  });
});
