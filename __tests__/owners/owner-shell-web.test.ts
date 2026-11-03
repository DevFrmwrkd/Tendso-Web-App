import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    pathname: '/my-business',
    scope: { ready: true, userId: 'owner-user' as string | null, scopeKey: 'owner-user:session-one:owner-one', owner: { _id: 'owner-one', name: 'Alex Santos', email: 'alex@example.test' } },
    inbox: undefined as unknown, failInbox: false,
    queries: [] as Array<{ name: string; args: unknown }>, scopeReads: 0,
}));
vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('next/link', async () => {
    const { createElement: element } = await import('react');
    return { default: ({ children, ...props }: { children: ReactNode }) => element('a', props, children) };
});
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
vi.mock('../../hooks/useOwnerWebScope', async () => {
    const { createElement: element } = await import('react');
    return {
        OwnerWebScopeProvider: ({ children }: { children: ReactNode }) => element('div', {}, children),
        useOwnerWebScope: () => { state.scopeReads++; return state.scope; },
    };
});
vi.mock('convex/react', () => ({
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference); state.queries.push({ name, args });
        if (name !== 'ownerInbox:list') throw new Error(`Unexpected shell query ${name}`);
        if (args !== 'skip' && state.failInbox) throw new Error('Private inbox subscription failed');
        // Keep a previous result for skip so the shell must apply its scope guard.
        return state.inbox;
    },
}));

import { OwnerShell, OwnerShellView } from '../../components/shells/OwnerShell';

type Node = { props: Record<string, unknown> };
type View = { root: { findAllByType(type: string): Node[]; findAllByProps(props: Record<string, unknown>): Node[] }; update(node: ReactNode): void; unmount(): void; toJSON(): unknown };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
let view: View | undefined;
function LiveShell() {
    return OwnerShell({ children: createElement('p', {}, 'Owner page content') });
}
function PreviewShell() {
    return OwnerShellView({ preview: true, previewSection: 'notifications', name: 'Sample owner', unreadCount: 3, children: createElement('p', {}, 'Sample page') });
}
function SlottedShell() {
    return OwnerShellView({ notificationSlot: createElement('span', { 'data-custom-bell': true }, 'Custom notification slot'), children: createElement('p', {}, 'Page') });
}
const shell = () => createElement(LiveShell);
async function mount(node: ReactNode = shell()) { await act(async () => { view = renderer.create(node); }); }
async function update() { await act(async () => view!.update(shell())); }
const text = () => JSON.stringify(view?.toJSON());
const anchors = () => view!.root.findAllByType('a');
const inbox = (count = 2) => ({ actorClerkId: 'owner-user', ownerId: 'owner-one', unreadCount: count, items: [] });
const bell = () => anchors().find(node => node.props.href === '/my-business/notifications')!;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.pathname = '/my-business';
    state.scope = { ready: true, userId: 'owner-user', scopeKey: 'owner-user:session-one:owner-one', owner: { _id: 'owner-one', name: 'Alex Santos', email: 'alex@example.test' } };
    state.inbox = inbox(); state.failInbox = false; state.queries = []; state.scopeReads = 0;
});
afterEach(async () => { if (view) await act(async () => view!.unmount()); view = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('owner shell notification count', () => {
    it('shows a verified unread badge while keeping all owner navigation and page content', async () => {
        await mount();
        expect(state.queries).toEqual([{ name: 'ownerInbox:list', args: { clerkId: 'owner-user' } }]);
        expect(bell().props['aria-label']).toBe('Notifications, 2 unread');
        expect(anchors().map(node => node.props.href)).toEqual(expect.arrayContaining(['/my-business/today', '/my-business', '/my-business/visits', '/my-business/notifications', '/profile']));
        expect(text()).toContain('Alex Santos'); expect(text()).toContain('Owner page content');
    });

    it.each([null, undefined, { ...inbox(41), actorClerkId: 'other-user' }, { ...inbox(41), ownerId: 'other-owner' }])('does not expose unverified unread counts %j', async value => {
        state.inbox = value; await mount();
        expect(bell().props['aria-label']).toBe('Notifications');
        expect(view!.root.findAllByProps({ 'aria-label': 'Notifications, 41 unread' })).toHaveLength(0);
        expect(text()).toContain('Owner page content');
    });

    it('skips inbox reads before readiness and hides a retained prior-account badge', async () => {
        state.scope.ready = false; state.inbox = inbox(41); await mount();
        expect(state.queries).toEqual([{ name: 'ownerInbox:list', args: 'skip' }]);
        expect(bell().props['aria-label']).toBe('Notifications'); expect(text()).toContain('Owner page content');
    });

    it('marks the live inbox route active even while its optional subscription is loading', async () => {
        state.pathname = '/my-business/notifications'; state.inbox = undefined; await mount();
        expect(bell().props['aria-current']).toBe('page'); expect(bell().props['aria-label']).toBe('Notifications');
    });

    it('renders a normal active bell and preserves navigation when the inbox subscription throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        state.pathname = '/my-business/notifications'; state.failInbox = true; await mount();
        expect(bell().props['aria-current']).toBe('page'); expect(bell().props['aria-label']).toBe('Notifications');
        expect(anchors().map(node => node.props.href)).toEqual(expect.arrayContaining(['/my-business/today', '/my-business', '/my-business/visits']));
        expect(text()).toContain('Owner page content'); expect(text()).not.toContain('Private inbox subscription failed');
    });

    it('resets a failed badge boundary when the authenticated scope changes', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        state.failInbox = true; await mount();
        expect(bell().props['aria-label']).toBe('Notifications');
        state.failInbox = false; state.inbox = inbox(7); await update();
        // An unchanged boundary stays in its safe fallback until remount/recovery.
        expect(bell().props['aria-label']).toBe('Notifications');
        state.scope = { ...state.scope, scopeKey: 'owner-user:session-two:owner-one' }; await update();
        expect(bell().props['aria-label']).toBe('Notifications, 7 unread'); expect(text()).toContain('Owner page content');
    });
});

describe('auth-free owner shell presentation', () => {
    it('keeps preview navigation and its explicit unread sample independent of live queries', async () => {
        await mount(createElement(PreviewShell));
        expect(state.scopeReads).toBe(0); expect(state.queries).toEqual([]);
        const notification = anchors().find(node => node.props.href === '/admin/preview/owner?section=notifications');
        expect(notification?.props['aria-label']).toBe('Notifications, 3 unread'); expect(notification?.props['aria-current']).toBe('page');
        expect(text()).toContain('Sample page');
    });

    it('accepts a supplied notification slot without mounting a second default bell', async () => {
        await mount(createElement(SlottedShell));
        expect(view!.root.findAllByProps({ 'data-custom-bell': true })).toHaveLength(1);
        expect(anchors().some(node => node.props.href === '/my-business/notifications')).toBe(false);
        expect(state.scopeReads).toBe(0); expect(state.queries).toEqual([]);
    });
});
