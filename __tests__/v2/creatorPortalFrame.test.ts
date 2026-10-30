import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { redirect } from 'next/navigation';

import CanonicalMyPage, { metadata } from '@/app/v2/creators/portal/my-page/page';
import LegacyAffiliateSectionPage from '@/app/affiliates/dashboard/[section]/page';
import { AffiliateDashboardBoundary } from '@/app/affiliates/dashboard/_components/AffiliateShell';
import { AffiliateSectionContent } from '@/app/affiliates/dashboard/_components/AffiliateSectionContent';
import { PortalFrame } from '@/components/v2/creators/PortalFrame';
import { PortalPage } from '@/components/v2/creators/PortalPage';
import { PortalView } from '@/components/v2/creators/PortalView';
import { usePortal, type PortalState } from '@/lib/v2/creatorData';
import { SAMPLE_PORTAL } from '@/lib/v2/creatorSample';

jest.mock('@clerk/nextjs', () => ({ useClerk: () => ({ signOut: jest.fn() }) }));
jest.mock('next/navigation', () => ({
    redirect: jest.fn(() => { throw new Error('NEXT_REDIRECT'); }),
    notFound: jest.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
jest.mock('@/lib/v2/creatorData', () => ({ CREATORS_SAMPLE: false, usePortal: jest.fn() }));
jest.mock('@/components/v2/creators/PortalView', () => ({ PortalView: jest.fn(() => 'portal-overview-content') }));
jest.mock('@/components/v2/creators/PortalFrame.module.css', () => ({}));
jest.mock('@/app/affiliates/dashboard/_components/AffiliateShell', () => ({
    AffiliateDashboardBoundary: jest.fn(({ children }: { children?: import('react').ReactNode }) => children),
}));
jest.mock('@/app/affiliates/dashboard/_components/AffiliateSectionContent', () => ({
    AffiliateSectionContent: jest.fn(() => 'protected-page-editor'),
}));

const EDITOR = '/v2/creators/portal/my-page';
const NAV_HREFS = [
    '/v2/creators/portal#top', '/v2/creators/portal#pt-links', '/v2/creators/portal#pt-agents',
    '/v2/creators/portal#pt-shops', '/v2/creators/portal#pt-pay', EDITOR,
];
const identity = { name: 'Ana Cruz', photo: null };

function nav(html: string): string {
    const value = html.match(/<nav\b[^>]*aria-label="Creator portal"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    if (!value) throw new Error('Creator portal navigation missing');
    return value;
}

function hrefs(html: string): string[] {
    return [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => match[1]);
}

function footer(html: string): string {
    const value = html.match(/<footer\b[^>]*class="cp-mini-foot"[^>]*>([\s\S]*?)<\/footer>/)?.[1];
    if (!value) throw new Error('Shared portal footer missing');
    return value;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(usePortal).mockReturnValue({ status: 'signed_out' });
});

describe('shared creator portal frame', () => {
    it('keeps navigation order, identity, main spacing and footer the same on Home and My page', () => {
        const pages = (['home', 'my-page'] as const).map(currentPage => renderToStaticMarkup(createElement(PortalFrame, {
            identity, currentPage, children: `${currentPage}-content`,
        })));

        for (const [index, html] of pages.entries()) {
            const navigation = nav(html);
            expect(hrefs(navigation)).toEqual(NAV_HREFS);
            const labels = [...navigation.matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map(match => match[1]);
            expect(labels).toEqual(['Home', 'Links', 'Agents', 'Shops', 'Payouts', 'My page']);
            const current = navigation.match(/<a\b[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g) ?? [];
            expect(current).toHaveLength(1);
            expect(current[0]).toContain(`href="${index === 0 ? NAV_HREFS[0] : EDITOR}"`);
            expect(html).toContain('aria-label="Edit your creator page"');
            expect(html).toContain(identity.name);
            expect(html).toMatch(/<main\b[^>]*class="[^"]*\bwrap\b[^"]*\bpt-main\b[^"]*"[^>]*id="top"/);
            expect(html).toContain(index === 0 ? 'home-content' : 'my-page-content');
            expect(html).not.toContain('Back to portal');
            expect(html).not.toContain('/affiliates/dashboard/my-page');
        }
        expect(footer(pages[0])).toBe(footer(pages[1]));
        expect(footer(pages[0])).toContain('Creator rules');
        expect(footer(pages[0])).toContain('Paid on real sales only. Your 5% is paid once the shop has paid in full.');
    });

    it('keeps sample navigation local instead of opening a real account editor', () => {
        const html = renderToStaticMarkup(createElement(PortalFrame, { identity, sample: true, children: 'sample-content' }));
        expect(hrefs(nav(html))).toEqual(['#top', '#pt-links', '#pt-agents', '#pt-shops', '#pt-pay', '#pt-links']);
        expect(html).not.toContain(`href="${EDITOR}"`);
        expect(html).not.toContain('href="/affiliates/dashboard/my-page"');
    });

    it('does not show an account identity or navigation before the portal is ready', () => {
        const html = renderToStaticMarkup(createElement(PortalFrame, {
            right: createElement('a', { href: '/v2/creators/signup' }, 'Log in'), children: 'loading-content',
        }));
        expect(html).toContain('Log in');
        expect(html).not.toContain('aria-label="Creator portal"');
        expect(html).not.toContain('Edit your creator page');
        expect(html).toContain('loading-content');
        expect(footer(html)).toContain('Privacy');
    });
});

describe('portal home uses the shared frame', () => {
    it.each(['active', 'suspended'] as const)('keeps the verified %s portal state and canonical editor entry', status => {
        const data = { ...SAMPLE_PORTAL, creator: { ...SAMPLE_PORTAL.creator, ...identity, status } };
        jest.mocked(usePortal).mockReturnValue({ status: 'ready', data });
        const html = renderToStaticMarkup(createElement(PortalPage));
        expect(hrefs(nav(html))).toEqual(NAV_HREFS);
        expect(html).toContain('portal-overview-content');
        expect(html).toContain(identity.name);
        expect(jest.mocked(PortalView).mock.calls[0]?.[0]).toMatchObject({ data, sample: false, compactIncome: true });
        if (status === 'suspended') expect(html).toContain('Your creator account is paused.');
    });

    it.each([
        [{ status: 'loading' }, 'Loading…'],
        [{ status: 'signed_out' }, 'Log in to your portal.'],
        [{ status: 'none' }, 'You have not applied yet.'],
        [{ status: 'other_account' }, 'This email has another Tendso account.'],
        [{ status: 'pending', handle: 'ana', code: 'ANA' }, 'We are reviewing your page.'],
    ] as const)('does not mount account navigation or finance content for %p', (state, message) => {
        jest.mocked(usePortal).mockReturnValue(state as PortalState);
        const html = renderToStaticMarkup(createElement(PortalPage));
        expect(html).toContain(message);
        expect(html).not.toContain('aria-label="Creator portal"');
        expect(PortalView).not.toHaveBeenCalled();
    });
});

describe('canonical My page route and old URL compatibility', () => {
    it('uses the existing account boundary once and requests only the page section', async () => {
        const page = await CanonicalMyPage();
        expect(page.type).toBe(AffiliateDashboardBoundary);
        expect(page.props.children.type).toBe(AffiliateSectionContent);
        expect(page.props.children.props).toEqual({ section: 'my-page' });
        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it('redirects only the old My page route to the canonical portal URL', async () => {
        await expect(LegacyAffiliateSectionPage({ params: Promise.resolve({ section: 'my-page' }) })).rejects.toThrow('NEXT_REDIRECT');
        expect(redirect).toHaveBeenCalledTimes(1);
        expect(redirect).toHaveBeenCalledWith(EDITOR);
        jest.mocked(redirect).mockClear();
        for (const section of ['sales', 'wallet', 'referrals', 'account']) {
            const page = await LegacyAffiliateSectionPage({ params: Promise.resolve({ section }) });
            expect(page.type).toBe(AffiliateSectionContent);
            expect(page.props.section).toBe(section);
        }
        expect(redirect).not.toHaveBeenCalled();
    });
});
