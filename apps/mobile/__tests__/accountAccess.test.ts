import { accountRole, accountBlocked, affiliateNeedsApproval, mobileHome, accountRouteRedirect } from '../services/accountAccess';

describe('native account navigation', () => {
  it('keeps legacy creators and rejects unknown account types', () => {
    expect(accountRole({})).toBe('creator');
    expect(accountRole({ role: 'creator' })).toBe('creator');
    expect(accountRole({ role: 'affiliate' })).toBe('affiliate');
    expect(accountRole({ role: 'admin' })).toBe('admin');
    expect(accountRole({ role: 'staff' })).toBeNull();
    expect(accountRole(null)).toBeNull();
  });
  it.each(['(tabs)', 'submit', 'submissions', 'training', 'certification-quiz', 'pending-review', 'leads', 'admin', 'complete-profile'])(
    'redirects affiliate deep link %s before creator/admin screens mount', route => {
      expect(accountRouteRedirect('affiliate', route)).toBe(mobileHome('affiliate'));
    });
  it('allows affiliate page, sales, wallet and shared account routes', () => {
    expect(accountRouteRedirect('affiliate', '(affiliate-tabs)')).toBeNull();
    for (const route of ['referrals', 'notifications', 'edit-profile', 'change-password']) {
      expect(accountRouteRedirect('affiliate', route)).toBeNull();
    }
  });
  it('keeps creators out of affiliate and admin screens', () => {
    expect(accountRouteRedirect('creator', 'admin')).toBe(mobileHome('creator'));
    expect(accountRouteRedirect('creator', '(affiliate-tabs)')).toBe(mobileHome('creator'));
    expect(accountRouteRedirect('creator', 'submit')).toBeNull();
  });
  it.each(['affiliate', 'creator'] as const)('blocks mutation screens in admin %s preview', view => {
    for (const route of ['submit', 'edit-profile', 'change-password', 'complete-profile', 'admin', 'referrals']) {
      expect(accountRouteRedirect(view, route, true)).toBe(mobileHome(view));
    }
  });
  it('preserves suspended affiliate history access but blocks suspended creators/admins', () => {
    expect(accountBlocked({ role: 'affiliate', status: 'suspended' })).toBe(false);
    expect(accountBlocked({ role: 'creator', status: 'suspended' })).toBe(true);
    expect(accountBlocked({ role: 'admin', status: 'suspended' })).toBe(true);
    expect(accountBlocked({ role: 'affiliate', isDeleted: true })).toBe(true);
    expect(accountBlocked({ role: 'affiliate', status: 'deleted' })).toBe(true);
  });
  it('requires approval only for pending affiliates without changing existing account rules', () => {
    expect(affiliateNeedsApproval({ role: 'affiliate', status: 'pending' })).toBe(true);
    for (const account of [null, undefined, {}, { role: 'affiliate', status: 'active' },
      { role: 'affiliate', status: 'suspended' }, { role: 'creator', status: 'pending' },
      { role: 'admin', status: 'pending' }, { role: 'affiliate', status: 'pending', isDeleted: true }]) {
      expect(affiliateNeedsApproval(account)).toBe(false);
    }
  });
});
