import { loginContinuationHref, loginReturnPath } from '@/app/auth/_components/loginReturnPath';
import { signInDestination, type SignInAccount, type SignInSession } from '@/lib/signInDestination';

const account = (extra: Partial<SignInAccount> = {}): SignInAccount => ({ clerkId: 'current-user', role: 'creator', status: 'active', certifiedAt: 1, ...extra });
const session = (creator: SignInAccount | null, isOwner = false): SignInSession => ({ clerkId: 'current-user', creator, isOwner });
const input = (creator: SignInAccount | null = account(), isOwner = false, returnTo?: string) => ({
    clerkLoaded: true, userId: 'current-user', convexLoading: false, convexAuthenticated: true, session: session(creator, isOwner), returnTo,
});

describe('one verified sign-in destination for every Tendso account', () => {
    it.each([
        ['admin', account({ role: 'admin' }), false, '/admin'],
        ['staff', account({ role: 'staff' }), false, '/admin'],
        ['creator', account({ role: 'affiliate' }), false, '/affiliates/dashboard'],
        ['pending creator', account({ role: 'affiliate', status: 'pending' }), false, '/affiliates/dashboard'],
        ['suspended creator read access', account({ role: 'affiliate', status: 'suspended' }), false, '/affiliates/dashboard'],
        ['certified field agent', account(), false, '/dashboard'],
        ['legacy certified field agent', account({ role: undefined }), false, '/dashboard'],
        ['field agent needing training', account({ certifiedAt: undefined }), false, '/training'],
        ['field agent awaiting approval', account({ certifiedAt: undefined, quizPassedAt: 1 }), false, '/pending'],
        ['field agent needing corrections', account({ certifiedAt: undefined, quizPassedAt: 1, rejectedAt: 2 }), false, '/verification-rejected'],
        ['business owner', null, true, '/my-business/today'],
        ['unprofiled identity', null, false, '/onboarding'],
    ] as const)('opens the correct workspace for %s', (_label, creator, owner, href) => {
        expect(signInDestination(input(creator, owner))).toEqual({ status: 'ready', href });
    });

    it.each(['admin', 'staff', 'creator'] as const)('shows an explicit unavailable state for suspended %s access', role => {
        expect(signInDestination(input(account({ role, status: 'suspended' })))).toMatchObject({ status: 'blocked' });
    });
    it.each([account({ isDeleted: true }), account({ status: 'deleted' }), account({ role: 'unexpected' })])('does not create a replacement role or redirect-loop an unavailable account', creator => {
        expect(signInDestination(input(creator))).toMatchObject({ status: 'blocked' });
    });

    it.each([
        { clerkLoaded: false }, { userId: 'new-user' }, { convexLoading: true }, { convexAuthenticated: false }, { session: undefined },
        { session: { ...session(account()), clerkId: 'previous-user' } },
        { session: session(account({ clerkId: 'previous-user' })) },
    ])('withholds destinations while authentication is unresolved or stale: %p', change => {
        expect(signInDestination({ ...input(), ...change })).toEqual({ status: 'loading' });
    });
    it('sends signed-out identities back to sign-in and reports an unusable verified session explicitly', () => {
        expect(signInDestination({ ...input(), userId: null })).toEqual({ status: 'signed_out' });
        expect(signInDestination({ ...input(), session: null })).toMatchObject({ status: 'blocked' });
    });
});

describe('return destinations obey the verified account role', () => {
    it('keeps admin detail links and enforces the existing staff allowlist', () => {
        expect(signInDestination(input(account({ role: 'admin' }), false, '/admin/submissions/abc'))).toEqual({ status: 'ready', href: '/admin/submissions/abc' });
        expect(signInDestination(input(account({ role: 'staff' }), false, '/admin/bookings'))).toEqual({ status: 'ready', href: '/admin/bookings' });
        expect(signInDestination(input(account({ role: 'staff' }), false, '/admin/payouts'))).toEqual({ status: 'ready', href: '/admin' });
    });
    it('keeps owner visits, notification links and private payment tokens with existing validation', () => {
        for (const returnTo of ['/my-business/visits/owned-visit', '/my-business/notifications?eventKey=site:one', `/pay/${'a'.repeat(64)}`]) {
            expect(signInDestination(input(null, true, returnTo))).toEqual({ status: 'ready', href: returnTo });
        }
    });
    it('normalizes creator editor aliases and keeps pending creators on the review status', () => {
        expect(signInDestination(input(account({ role: 'affiliate' }), false, '/v2/creators/portal/my-page'))).toEqual({ status: 'ready', href: '/affiliates/dashboard/my-page' });
        expect(signInDestination(input(account({ role: 'affiliate', status: 'pending' }), false, '/affiliates/dashboard/my-page'))).toEqual({ status: 'ready', href: '/affiliates/dashboard' });
    });
    it.each([
        [account(), false, '/admin', '/dashboard'],
        [account({ role: 'affiliate' }), false, '/admin', '/affiliates/dashboard'],
        [account({ role: 'admin' }), false, '/my-business/today', '/admin'],
        [null, true, '/admin', '/my-business/today'],
        [null, false, '/admin', '/onboarding'],
    ] as const)('never lets a return URL assign another role', (creator, owner, returnTo, href) => {
        expect(signInDestination(input(creator, owner, returnTo))).toEqual({ status: 'ready', href });
    });
    it('preserves a certified agent’s wiki return without skipping training for an uncertified agent', () => {
        expect(signInDestination(input(account(), false, '/knowledge?ws=wiki'))).toEqual({ status: 'ready', href: '/knowledge?ws=wiki' });
        expect(signInDestination(input(account({ certifiedAt: undefined }), false, '/knowledge?ws=wiki'))).toEqual({ status: 'ready', href: '/training' });
    });
});

describe('common sign-in URL validation', () => {
    it.each(['https://evil.example/admin', '//evil.example', '/\\evil.example', '/admin/../profile', '/admin/%2e%2e/profile', '/admin/%5cattack', '/admin/path#unchecked', '/v2/my-site', '/auth/continue?returnTo=/admin', '/knowledge?ws=wiki&redirect_url=https://evil.example'])('drops external, malformed and unapproved destinations: %s', value => {
        expect(loginReturnPath(value)).toBe('/auth/continue');
        expect(loginContinuationHref(value)).toBe('/auth/continue');
    });
    it('uses one continuation route for normal login and encoded safe returns', () => {
        expect(loginContinuationHref('/dashboard')).toBe('/auth/continue');
        expect(loginContinuationHref('/my-business/today')).toBe('/auth/continue?returnTo=%2Fmy-business%2Ftoday');
        expect(loginReturnPath(['/knowledge?ws=wiki', 'https://evil.example'])).toBe('/knowledge?ws=wiki');
    });
});
