import { createElement, type ReactNode } from 'react';

import { PortalPage } from '@/components/v2/creators/PortalPage';

jest.mock('@/convex/_generated/api', () => ({ api: jest.requireActual('convex/server').anyApi }));
import { SAMPLE_PORTAL } from '@/lib/v2/creatorSample';
import type { PortalState } from '@/lib/v2/creatorData';
import type { PortalSummary } from '@/lib/v2/creatorTypes';

jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@clerk/nextjs', () => ({
    useUser: () => ({ isLoaded: state.loaded, isSignedIn: state.signedIn, user: state.signedIn ? { id: state.actor } : null }),
    useClerk: () => ({ signOut: jest.fn() }),
}));
jest.mock('convex/react', () => ({
    useConvexAuth: () => state.auth,
    useQuery: (_reference: unknown, args: unknown) => args === 'skip' ? undefined : state.session,
}));
jest.mock('next/link', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    return ({ children, ...props }: { children?: ReactNode }) => React.createElement('a', props, children);
});
jest.mock('@/lib/v2/creatorData', () => ({ CREATORS_SAMPLE: false, usePortal: (...args: unknown[]) => portalHook(...args) }));
jest.mock('@/components/v2/creators/PortalFrame.module.css', () => ({}));
jest.mock('@/components/v2/creators/PortalUtilities', () => ({
    PortalUtilities: () => jest.requireActual('../../apps/mobile/node_modules/react').createElement('button', null, 'Notifications and sign out'),
}));
jest.mock('@/components/v2/creators/PortalView', () => ({
    PortalView: ({ data }: { data: PortalSummary }) => jest.requireActual('../../apps/mobile/node_modules/react').createElement('div', { 'data-testid': 'monthly-summary' }, `Monthly totals ${data.month.label}: ${data.now.thisMonth}`),
}));

interface TestNode {
    type: unknown;
    props: Record<string, unknown>;
    children: (TestNode | string)[];
    findAllByType(type: string): TestNode[];
}
interface TestRenderer {
    root: TestNode;
    update(element: ReactNode): void;
    unmount(): void;
}
const { create, act } = require('../../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode): TestRenderer;
    act(callback: () => void | Promise<void>): Promise<void>;
};
function session(actor = 'first-user', handle = 'mika') {
    return { clerkId: actor, creator: { _id: `${actor}-affiliate`, clerkId: actor, affiliateHandle: handle, role: 'affiliate', status: 'active', isDeleted: false }, isOwner: false };
}
const state = {
    actor: 'first-user', loaded: true, signedIn: true,
    auth: { isLoading: false, isAuthenticated: true },
    session: session() as ReturnType<typeof session> | null | undefined,
    months: new Map<string, PortalState>(),
};
const portalHook = jest.fn();
let renderer: TestRenderer | undefined;
let now: jest.SpyInstance;
let consoleError: jest.SpyInstance;

function text(node: TestNode | string): string {
    return typeof node === 'string' ? node : node.children.map(text).join('');
}
function monthInput(): TestNode {
    const input = renderer!.root.findAllByType('input').find(node => node.props.type === 'month');
    if (!input) throw new Error('Month input missing');
    return input;
}
async function mount() {
    await act(() => { renderer = create(createElement(PortalPage)); });
}
async function rerender() {
    await act(() => { renderer!.update(createElement(PortalPage)); });
}
async function changeMonth(value: string) {
    await act(() => { (monthInput().props.onChange as (event: { target: { value: string } }) => void)({ target: { value } }); });
}
function ready(month = '2026-10', name = 'Mika Santos', handle = 'mika'): PortalState {
    const [year, monthNumber] = month.split('-').map(Number);
    const offset = 8 * 60 * 60 * 1000;
    const data: PortalSummary = { ...SAMPLE_PORTAL, month: { start: Date.UTC(year, monthNumber - 1, 1) - offset, end: Date.UTC(year, monthNumber, 1) - offset, label: month }, creator: { ...SAMPLE_PORTAL.creator, name, handle } };
    return { status: 'ready', data };
}

beforeEach(() => {
    jest.clearAllMocks();
    state.actor = 'first-user';
    state.loaded = true;
    state.signedIn = true;
    state.auth = { isLoading: false, isAuthenticated: true };
    state.session = session();
    state.months = new Map([['current', ready()]]);
    portalHook.mockImplementation(({ month }: { month?: string }) => state.months.get(month ?? 'current') ?? { status: 'loading' });
    now = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 20, 4));
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const original = console.error;
    consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) return;
        original(...args);
    });
});

afterEach(async () => {
    if (renderer) await act(() => { renderer!.unmount(); });
    renderer = undefined;
    now.mockRestore();
    consoleError.mockRestore();
});

describe('creator portal month selection', () => {
    it('keeps the picker, navigation and account tools during loading while withholding stale totals', async () => {
        await mount();
        await changeMonth('2026-09');
        expect(monthInput().props.value).toBe('2026-09');
        expect(text(renderer!.root)).toContain('Loading…');
        expect(text(renderer!.root)).toContain('Mika Santos');
        expect(text(renderer!.root)).toContain('Notifications and sign out');
        expect(renderer!.root.findAllByType('nav').some(node => node.props['aria-label'] === 'Creator portal')).toBe(true);
        expect(text(renderer!.root)).not.toContain('Monthly totals');
        expect(portalHook).toHaveBeenLastCalledWith({ month: '2026-09' });

        await changeMonth('2026-08');
        expect(monthInput().props.value).toBe('2026-08');
        expect(portalHook).toHaveBeenLastCalledWith({ month: '2026-08' });
        state.months.set('2026-08', ready('2026-08'));
        await rerender();
        expect(text(renderer!.root)).toContain('Monthly totals 2026-08');
    });

    it('resets to this month while a historical month is still loading', async () => {
        await mount();
        await changeMonth('2026-09');
        const reset = renderer!.root.findAllByType('button').find(node => text(node) === 'This month');
        expect(reset).toBeDefined();
        await act(() => { (reset!.props.onClick as () => void)(); });
        expect(portalHook).toHaveBeenLastCalledWith({ month: undefined });
        expect(monthInput().props.value).toBe('2026-10');
        expect(text(renderer!.root)).toContain('Monthly totals 2026-10');
    });

    it('withholds cached totals across an account switch until the new Convex account and summary are verified', async () => {
        await mount();
        await changeMonth('2026-09');
        const callsBeforeSwitch = portalHook.mock.calls.length;
        state.actor = 'second-user';
        await rerender();
        expect(portalHook).toHaveBeenCalledTimes(callsBeforeSwitch);
        expect(text(renderer!.root)).not.toContain('Mika Santos');
        expect(text(renderer!.root)).not.toContain('Notifications and sign out');
        expect(text(renderer!.root)).not.toContain('Monthly totals');
        expect(renderer!.root.findAllByType('input')).toHaveLength(0);
        expect(renderer!.root.findAllByType('nav')).toHaveLength(0);

        // The identity query has caught up, but the summary cache still has Mika.
        state.session = session('second-user', 'nina-shops');
        await rerender();
        expect(portalHook).toHaveBeenLastCalledWith({ month: undefined });
        expect(text(renderer!.root)).not.toContain('Mika Santos');
        expect(text(renderer!.root)).not.toContain('Monthly totals');

        state.months.set('current', ready('2026-10', 'Nina Cruz', 'nina-shops'));
        await rerender();
        expect(text(renderer!.root)).toContain('Nina Cruz');
        expect(text(renderer!.root)).not.toContain('Mika Santos');
        expect(monthInput().props.value).toBe('2026-10');
    });

    it.each(['Clerk loading', 'signed out', 'Convex loading', 'Convex signed out', 'unresolved identity', 'old identity', 'old creator', 'wrong role', 'pending', 'deleted'])(
        'does not mount private summary reads while %s', async condition => {
            if (condition === 'Clerk loading') state.loaded = false;
            if (condition === 'signed out') state.signedIn = false;
            if (condition === 'Convex loading') state.auth.isLoading = true;
            if (condition === 'Convex signed out') state.auth.isAuthenticated = false;
            if (condition === 'unresolved identity') state.session = undefined;
            if (condition === 'old identity') state.session!.clerkId = 'previous-user';
            if (condition === 'old creator') state.session!.creator.clerkId = 'previous-user';
            if (condition === 'wrong role') state.session!.creator.role = 'admin';
            if (condition === 'pending') state.session!.creator.status = 'pending';
            if (condition === 'deleted') state.session!.creator.isDeleted = true;
            await mount();
            expect(portalHook).not.toHaveBeenCalled();
            expect(text(renderer!.root)).not.toContain('Mika Santos');
            expect(text(renderer!.root)).not.toContain('Monthly totals');
            expect(renderer!.root.findAllByType('nav')).toHaveLength(0);
        },
    );

    it('shows a setup recovery action instead of loading forever when the verified account has no page address', async () => {
        state.session!.creator.affiliateHandle = '';
        await mount();
        expect(portalHook).not.toHaveBeenCalled();
        expect(text(renderer!.root)).toContain('Your creator page needs setup.');
        expect(text(renderer!.root)).not.toContain('Loading…');
        expect(renderer!.root.findAllByType('a').some(node => node.props.href === '/affiliates/dashboard/account')).toBe(true);
        expect(renderer!.root.findAllByType('a').some(node => typeof node.props.href === 'string' && node.props.href.startsWith('mailto:'))).toBe(true);
    });

    it('ignores malformed, pre-2000 and future selections without changing the requested month', async () => {
        await mount();
        for (const invalid of ['2026-11', '1999-12', '2026-13', 'not-a-month']) {
            await changeMonth(invalid);
            expect(monthInput().props.value).toBe('2026-10');
            expect(portalHook).toHaveBeenLastCalledWith({ month: undefined });
        }
    });
});
