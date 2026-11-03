import { creatorPortalReturnPath } from '@/lib/v2/creatorPortalReturnPath';

describe('creator sign-in return destinations', () => {
    it.each([
        ['/affiliates/dashboard/my-page', '/affiliates/dashboard/my-page'],
        ['/v2/creators/portal/my-page/', '/affiliates/dashboard/my-page'],
        ['/affiliates/dashboard/payouts?from=email', '/affiliates/dashboard/payouts?from=email'],
        ['/v2/creators/portal/account', '/affiliates/dashboard/account'],
        ['/affiliates/dashboard/wallet', '/affiliates/dashboard/payouts'],
        ['/affiliates/dashboard/home#pt-links', '/affiliates/dashboard#pt-links'],
        ['/v2/creators/portal#pt-agents', '/affiliates/dashboard#pt-agents'],
        ['/affiliates/dashboard/sales?source=email&source=poster', '/affiliates/dashboard?source=email&source=poster#pt-shops'],
        ['/affiliates/dashboard/referrals', '/affiliates/dashboard#pt-agents'],
        ['/v2/creators/portal/links', '/affiliates/dashboard#pt-links'],
        ['/affiliates/dashboard#unknown', '/affiliates/dashboard'],
    ])('normalizes %s to a redesigned account destination', (input, expected) => {
        expect(creatorPortalReturnPath(input)).toBe(expected);
    });

    it.each([
        undefined, null, {}, ['x'], '', 'https://evil.example/affiliates/dashboard',
        '//evil.example/affiliates/dashboard', '/\\evil.example/affiliates/dashboard',
        '/admin', '/pay/private-token', '/affiliates/dashboard/my-page/extra',
        '/v2/creators/portal-other', '/affiliates/dashboard/../other', '/affiliates/dashboard/toString',
    ])('does not redirect to an external, unrelated or unknown route: %p', input => {
        expect(creatorPortalReturnPath(input)).toBe('/affiliates/dashboard');
    });
});
