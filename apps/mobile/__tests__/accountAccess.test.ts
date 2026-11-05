import { accountRole, accountBlocked, affiliateNeedsApproval, fieldAgentNeedsOnboarding, mobileHome, accountRouteRedirect } from '../services/accountAccess';

describe('native account navigation', () => {
  it('keeps legacy creators and rejects unknown account types', () => {
    expect(accountRole({})).toBe('creator');
    expect(accountRole({ role: 'creator' })).toBe('creator');
    expect(accountRole({ role: 'affiliate' })).toBe('affiliate');
    expect(accountRole({ role: 'admin' })).toBe('admin');
    expect(accountRole({ role: 'staff' })).toBeNull();
    expect(accountRole(null)).toBeNull();
  });
  it.each(['(tabs)', 'submit', 'submissions', 'training', 'certification-quiz', 'pending-review', 'leads', 'admin', 'complete-profile', 'agent-onboarding'])(
    'redirects affiliate deep link %s before creator/admin screens mount', route => {
      expect(accountRouteRedirect('affiliate', route)).toBe(mobileHome('affiliate'));
    });
  it('allows affiliate page, sales, wallet and shared account routes', () => {
    expect(accountRouteRedirect('affiliate', '(affiliate-tabs)')).toBeNull();
    expect(accountRouteRedirect('affiliate', 'affiliate')).toBeNull();
    expect(accountRouteRedirect('affiliate', 'affiliate', true)).toBeNull();
    for (const route of ['referrals', 'notifications', 'edit-profile', 'change-password']) {
      expect(accountRouteRedirect('affiliate', route)).toBeNull();
    }
  });
  it('keeps creators out of affiliate and admin screens', () => {
    expect(accountRouteRedirect('creator', 'admin')).toBe(mobileHome('creator'));
    expect(accountRouteRedirect('creator', '(affiliate-tabs)')).toBe(mobileHome('creator'));
    expect(accountRouteRedirect('creator', 'affiliate')).toBe(mobileHome('creator'));
    expect(accountRouteRedirect('admin', 'affiliate')).toBe(mobileHome('admin'));
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
  it('asks the new onboarding questions only for opted-in field agents', () => {
    expect(fieldAgentNeedsOnboarding({ role: 'creator', fieldAgentOnboardingRequired: true })).toBe(true);
    expect(fieldAgentNeedsOnboarding({ fieldAgentOnboardingRequired: true })).toBe(true);
    for (const account of [null, undefined, {}, { role: 'creator' },
      { role: 'creator', fieldAgentOnboardingRequired: false },
      { role: 'affiliate', fieldAgentOnboardingRequired: true },
      { role: 'admin', fieldAgentOnboardingRequired: true },
      { role: 'creator', fieldAgentOnboardingRequired: true, status: 'suspended' },
      { role: 'creator', fieldAgentOnboardingRequired: true, isDeleted: true }]) {
      expect(fieldAgentNeedsOnboarding(account)).toBe(false);
    }
  });
});
