import { isCreatorAccount } from '@/lib/accounts';
import { creatorRedirect } from '@/lib/creatorGate';

describe('account routing', () => {
    it('routes affiliates home before every creator certification state', () => {
        for (const lifecycle of [{}, { quizPassedAt: 1 }, { certifiedAt: 2 }, { rejectedAt: 3 }]) {
            expect(creatorRedirect({ role: 'affiliate', ...lifecycle })).toBe('/affiliates/dashboard');
        }
    });

    it('preserves the creator, admin and staff lifecycle', () => {
        expect(creatorRedirect({})).toBe('/training');
        expect(creatorRedirect({ quizPassedAt: 1 })).toBe('/pending');
        expect(creatorRedirect({ rejectedAt: 1 })).toBe('/verification-rejected');
        expect(creatorRedirect({ certifiedAt: 1 })).toBeNull();
        expect(creatorRedirect({ role: 'admin' })).toBeNull();
        expect(creatorRedirect({ role: 'staff', certifiedAt: 1 })).toBe('/admin');
    });

    it('counts only field creators, including legacy rows', () => {
        expect(isCreatorAccount({})).toBe(true);
        expect(isCreatorAccount({ role: 'creator' })).toBe(true);
        for (const role of ['affiliate', 'admin', 'staff', 'system']) {
            expect(isCreatorAccount({ role })).toBe(false);
        }
        expect(isCreatorAccount(null)).toBe(false);
    });
});
