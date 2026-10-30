import { createElement, type ReactNode } from 'react';

import { PortalPage } from '@/components/v2/creators/PortalPage';
import { SAMPLE_PORTAL } from '@/lib/v2/creatorSample';
import type { PortalState } from '@/lib/v2/creatorData';
import type { PortalSummary } from '@/lib/v2/creatorTypes';

jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@clerk/nextjs', () => ({
    useUser: () => ({ user: { id: state.actor } }),
    useClerk: () => ({ signOut: jest.fn() }),
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
const state = { actor: 'first-user', months: new Map<string, PortalState>() };
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
function ready(month = '2026-10', name = 'Mika Santos'): PortalState {
    const [year, monthNumber] = month.split('-').map(Number);
    const offset = 8 * 60 * 60 * 1000;
    const data: PortalSummary = { ...SAMPLE_PORTAL, month: { start: Date.UTC(year, monthNumber - 1, 1) - offset, end: Date.UTC(year, monthNumber, 1) - offset, label: month }, creator: { ...SAMPLE_PORTAL.creator, name } };
    return { status: 'ready', data };
}

beforeEach(() => {
    jest.clearAllMocks();
    state.actor = 'first-user';
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

    it('clears cached identity and selected month immediately when the Clerk actor changes', async () => {
        await mount();
        await changeMonth('2026-09');
        state.actor = 'second-user';
        state.months.clear();
        await rerender();
        expect(portalHook).toHaveBeenLastCalledWith({ month: undefined });
        expect(text(renderer!.root)).not.toContain('Mika Santos');
        expect(text(renderer!.root)).not.toContain('Notifications and sign out');
        expect(text(renderer!.root)).not.toContain('Monthly totals');
        expect(renderer!.root.findAllByType('input')).toHaveLength(0);
        expect(renderer!.root.findAllByType('nav')).toHaveLength(0);

        state.months.set('current', ready('2026-10', 'Nina Cruz'));
        await rerender();
        expect(text(renderer!.root)).toContain('Nina Cruz');
        expect(text(renderer!.root)).not.toContain('Mika Santos');
        expect(monthInput().props.value).toBe('2026-10');
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
