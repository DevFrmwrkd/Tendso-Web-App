import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerSite } from '../../app/my-business/_components/ownerSite';
import { ownerReturnPath } from '../../lib/ownerReturnPath';

const state = vi.hoisted(() => ({
    auth: { isOwner: true, isSignedIn: true, loading: false, error: null as string | null },
    workspace: undefined as unknown,
    submissionId: 'business-one',
    replace: vi.fn(), overview: vi.fn(), list: vi.fn(),
    queries: [] as Array<{ name: string; args: unknown }>,
}));

// Use the already installed matching renderer/React pair so real effects run.
vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: state.replace }),
    useParams: () => ({ submissionId: state.submissionId }),
}));
vi.mock('../../hooks/useOwnerAuth', () => ({ useOwnerAuth: () => state.auth }));
vi.mock('convex/react', () => ({
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference);
        state.queries.push({ name, args });
        if (name !== 'owners:me') throw new Error(`Unexpected owner route query: ${name}`);
        return args === 'skip' ? undefined : state.workspace;
    },
}));
vi.mock('../../components/shells/OwnerShell', async () => {
    const { createElement: element } = await import('react');
    return {
        OwnerShell: ({ children }: { children: ReactNode }) => element('main', { 'data-view': 'shell' }, children),
        OwnerPageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => element('header', {}, element('h1', {}, title), element('p', {}, subtitle)),
    };
});
vi.mock('../../app/my-business/_components/OwnerHome', async () => {
    const { createElement: element } = await import('react');
    return {
        SiteOverviewLoading: () => element('p', { 'data-view': 'loading' }, 'Loading businesses'),
        SiteNotAvailable: () => element('p', { 'data-view': 'unavailable' }, 'Website not available'),
        NoSite: () => element('p', { 'data-view': 'empty' }, 'No linked businesses'),
        SiteList: ({ sites }: { sites: OwnerSite[] }) => {
            state.list(sites);
            return element('section', { 'data-view': 'list' }, sites.map(site => element('div', { key: site.submissionId }, site.businessName)));
        },
    };
});
vi.mock('../../app/my-business/_components/OwnerPrivateWebsite', async () => {
    const { createElement: element } = await import('react');
    return { OwnerWebsiteOverview: ({ site }: { site: OwnerSite }) => {
        state.overview(site);
        return element('section', { 'data-view': 'website', 'data-submission-id': site.submissionId },
            site.businessName, ` · ${site.phase} · ${site.balanceDue}`);
    } };
});

import MyBusinessDashboard from '../../app/my-business/page';
import OwnerWebsitePage from '../../app/my-business/[submissionId]/page';

type TestNode = { props: Record<string, unknown> };
type View = { root: { findAllByProps(props: Record<string, unknown>): TestNode[] }; unmount(): void; toJSON(): unknown };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
const site = (name: string, overrides: Partial<OwnerSite> = {}): OwnerSite => ({
    submissionId: name as OwnerSite['submissionId'], businessName: name, businessType: 'shop',
    contentSource: 'owner_app', publishPolicy: 'pay_then_publish', status: 'draft', phase: 'draft',
    publishedUrl: null, total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false,
    openChangeRequests: 0, createdAt: 1_800_000_000_000, ...overrides,
});
const workspace = (sites: OwnerSite[]) => ({ owner: { _id: 'owner-one', email: 'owner@example.test', name: 'Owner', phone: null }, sites });
let view: View | undefined;
const visible = (name: string) => view!.root.findAllByProps({ 'data-view': name }).length > 0;
const text = () => JSON.stringify(view?.toJSON());
async function render(route: 'dashboard' | 'detail') {
    await act(async () => { view = renderer.create(createElement(route === 'dashboard' ? MyBusinessDashboard : OwnerWebsitePage)); });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks(); state.queries = []; state.submissionId = 'business-one';
    state.auth = { isOwner: true, isSignedIn: true, loading: false, error: null };
    state.workspace = workspace([site('business-one')]);
});
afterEach(async () => { if (view) await act(async () => view!.unmount()); view = undefined; vi.unstubAllGlobals(); });

describe('canonical owner workspace routes', () => {
    it('lists every canonical owned site and reads only owners.me', async () => {
        const sites = [site('business-one'), site('business-two', { phase: 'awaiting_payment', amountPaid: 500, balanceDue: 4499 })];
        state.workspace = workspace(sites); await render('dashboard');
        expect(state.queries).toEqual([{ name: 'owners:me', args: {} }]);
        expect(state.list).toHaveBeenCalledExactlyOnceWith(sites);
        expect(state.overview).not.toHaveBeenCalled();
        expect(text()).toContain('business-one'); expect(text()).toContain('business-two');
        expect(visible('list')).toBe(true); expect(visible('empty')).toBe(false);
    });

    it('passes a single canonical phase and balance directly to its overview', async () => {
        const business = site('business-one', { phase: 'ready_to_check', amountPaid: 500, balanceDue: 4499 });
        state.workspace = workspace([business]); await render('dashboard');
        expect(state.overview).toHaveBeenCalledExactlyOnceWith(business);
        expect(text()).toContain('ready_to_check'); expect(text()).toContain('4499');
        expect(state.list).not.toHaveBeenCalled(); expect(visible('website')).toBe(true);
    });

    it('renders only the selected owned business on its detail route', async () => {
        const selected = site('business-one', { phase: 'changes_requested' });
        state.workspace = workspace([selected, site('business-two')]); await render('detail');
        expect(state.queries).toEqual([{ name: 'owners:me', args: {} }]);
        expect(state.overview).toHaveBeenCalledExactlyOnceWith(selected);
        expect(text()).toContain('business-one'); expect(text()).not.toContain('business-two');
        expect(visible('unavailable')).toBe(false);
    });

    it('does not mount the website overview for a guessed foreign submission ID', async () => {
        state.submissionId = 'foreign-business'; state.workspace = workspace([site('business-one')]); await render('detail');
        expect(visible('unavailable')).toBe(true); expect(visible('website')).toBe(false);
        expect(state.overview).not.toHaveBeenCalled(); expect(text()).not.toContain('business-one');
        expect(state.queries).toEqual([{ name: 'owners:me', args: {} }]);
    });

    it.each(['dashboard', 'detail'] as const)('shows a role-conflict error on %s without an empty, unavailable or loading panel', async route => {
        state.auth = { isOwner: false, isSignedIn: true, loading: true, error: 'Use the business owner’s email to open this website.' };
        state.workspace = workspace([site('business-one')]); await render(route);
        expect(view!.root.findAllByProps({ role: 'alert' })).toHaveLength(1);
        expect(text()).toContain('Use the business owner’s email');
        for (const name of ['empty', 'unavailable', 'loading', 'list', 'website']) expect(visible(name)).toBe(false);
        expect(state.queries).toEqual([{ name: 'owners:me', args: 'skip' }]);
        expect(state.overview).not.toHaveBeenCalled(); expect(state.replace).not.toHaveBeenCalled();
    });

    it.each(['dashboard', 'detail'] as const)('keeps %s loading while the authenticated canonical query is unresolved', async route => {
        state.workspace = undefined; await render(route);
        expect(visible('loading')).toBe(true); expect(visible('empty')).toBe(false); expect(visible('unavailable')).toBe(false);
        expect(state.overview).not.toHaveBeenCalled(); expect(state.replace).not.toHaveBeenCalled();
    });

    it.each(['dashboard', 'detail'] as const)('keeps signed-out %s loading while redirecting to owner sign-in', async route => {
        state.auth = { isOwner: false, isSignedIn: false, loading: false, error: null };
        await render(route);
        expect(visible('loading')).toBe(true); expect(visible('empty')).toBe(false); expect(visible('website')).toBe(false);
        expect(state.queries).toEqual([{ name: 'owners:me', args: 'skip' }]);
        expect(state.replace).toHaveBeenCalledExactlyOnceWith(route === 'dashboard' ? '/my-business/sign-in'
            : `/my-business/sign-in?returnTo=${encodeURIComponent('/my-business/business-one')}`);
        if (route === 'detail') {
            const redirected = new URL(state.replace.mock.calls[0][0], 'https://tendso.example');
            expect(ownerReturnPath(redirected.searchParams.get('returnTo'))).toBe('/my-business/business-one');
            expect(redirected.origin).toBe('https://tendso.example');
        }
    });

    it.each(['dashboard', 'detail'] as const)('does not redirect %s before authentication finishes loading', async route => {
        state.auth = { isOwner: false, isSignedIn: false, loading: true, error: null };
        await render(route);
        expect(visible('loading')).toBe(true); expect(state.replace).not.toHaveBeenCalled();
        expect(state.overview).not.toHaveBeenCalled(); expect(state.queries[0].args).toBe('skip');
    });

    it('encodes an untrusted detail parameter and lets the sign-in whitelist reject an unsafe return path', async () => {
        state.auth = { isOwner: false, isSignedIn: false, loading: false, error: null };
        state.submissionId = 'https://other.example/path?next=admin'; await render('detail');
        const redirect = new URL(state.replace.mock.calls[0][0], 'https://tendso.example');
        expect(redirect.origin).toBe('https://tendso.example'); expect(redirect.pathname).toBe('/my-business/sign-in');
        expect(ownerReturnPath(redirect.searchParams.get('returnTo'))).toBe('/my-business');
        expect(visible('loading')).toBe(true); expect(state.overview).not.toHaveBeenCalled();
    });

    it('uses the no-business panel only after an owned canonical response is empty', async () => {
        state.workspace = workspace([]); await render('dashboard');
        expect(visible('empty')).toBe(true); expect(visible('loading')).toBe(false); expect(visible('website')).toBe(false);
        expect(state.overview).not.toHaveBeenCalled(); expect(state.list).not.toHaveBeenCalled();
    });
});
