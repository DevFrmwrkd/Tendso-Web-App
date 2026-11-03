import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    scope: { ready: true, loading: false, error: null as string | null, isSignedIn: true, isOwner: true,
        userId: 'clerk-one', sessionId: 'session-one', scopeKey: 'clerk-one:session-one:owner-one',
        owner: { _id: 'owner-one' }, sites: [{ submissionId: 'business-one' }] },
    inbox: undefined as unknown,
    eventKey: null as string | null,
    queries: [] as Array<{ name: string; args: unknown }>,
    read: vi.fn(), all: vi.fn(), replace: vi.fn(), mutationHooks: vi.fn(),
}));

vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('next/link', async () => {
    const { createElement: element } = await import('react');
    return { default: ({ children, ...props }: { children: ReactNode }) => element('a', props, children) };
});
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: state.replace }),
    useSearchParams: () => new URLSearchParams(state.eventKey ? { eventKey: state.eventKey } : {}),
}));
vi.mock('../../hooks/useOwnerWebScope', () => ({
    useOwnerWebScope: () => {
        const key = state.scope.scopeKey;
        return { ...state.scope, isCurrent: () => state.scope.ready && state.scope.scopeKey === key };
    },
}));
vi.mock('convex/react', () => ({
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference);
        state.queries.push({ name, args });
        if (name !== 'ownerInbox:list') throw new Error(`Unexpected inbox query ${name}`);
        return args === 'skip' ? undefined : state.inbox;
    },
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
        const name = getFunctionName(reference);
        state.mutationHooks(name);
        if (name === 'ownerInbox:markRead') return state.read;
        if (name === 'ownerInbox:markAllRead') return state.all;
        throw new Error(`Unexpected inbox mutation ${name}`);
    },
}));
vi.mock('../../components/r1/Overlay', async () => {
    const { createElement: element } = await import('react');
    return { Drawer: ({ open, title, children, footer, onClose, closeLabel }: {
        open: boolean; title: ReactNode; children: ReactNode; footer: ReactNode; onClose: () => void; closeLabel: string;
    }) => open ? element('dialog', { open, 'aria-label': title },
        element('button', { 'aria-label': closeLabel, onClick: onClose }, 'Close details'), children, footer) : null };
});

import { OwnerNotifications, OwnerNotificationsView, ownerNotificationDestination,
    type OwnerWebInbox, type OwnerWebMessage } from '../../app/my-business/notifications/_components/OwnerNotifications';

type TestNode = { type: string; props: Record<string, unknown>; children: Array<TestNode | string> };
type View = { root: { findAllByType(type: string): TestNode[]; findAllByProps(props: Record<string, unknown>): TestNode[] };
    update(node: ReactNode): void; unmount(): void; toJSON(): unknown };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
let view: View | undefined;
const message = (key: string, patch: Partial<OwnerWebMessage> = {}): OwnerWebMessage => ({
    key, type: 'preview_ready', title: `Update ${key}`, body: `Full message for ${key}.\nThis second paragraph must stay readable.`,
    createdAt: 1_800_000_000_000, submissionId: 'business-one' as OwnerWebMessage['submissionId'], visitRequestId: null, read: false, ...patch,
});
const inbox = (items = [message('one'), message('two')]): OwnerWebInbox => ({
    ownerId: 'owner-one' as OwnerWebInbox['ownerId'], actorClerkId: 'clerk-one', unreadCount: items.filter(item => !item.read).length, items,
});
const text = () => JSON.stringify(view?.toJSON());
const childrenText = (node: TestNode): string => node.children.map(child => typeof child === 'string' ? child : childrenText(child)).join('');
const button = (label: string) => {
    const found = view!.root.findAllByType('button').find(node => node.props['aria-label'] === label || childrenText(node) === label);
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
};
const click = async (label: string) => { await act(async () => { (button(label).props.onClick as () => void)(); }); };
async function render(preview = false) {
    await act(async () => { view = renderer.create(preview ? createElement(OwnerNotificationsView,
        { inbox: state.inbox as OwnerWebInbox, preview: true, sites: [{ submissionId: 'business-one' as OwnedId }] }) : createElement(OwnerNotifications)); });
}
type OwnedId = NonNullable<OwnerWebMessage['submissionId']>;
const update = async () => { await act(async () => { view!.update(createElement(OwnerNotifications)); }); };

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks(); state.queries = []; state.eventKey = null;
    state.scope = { ready: true, loading: false, error: null, isSignedIn: true, isOwner: true,
        userId: 'clerk-one', sessionId: 'session-one', scopeKey: 'clerk-one:session-one:owner-one',
        owner: { _id: 'owner-one' }, sites: [{ submissionId: 'business-one' }] };
    state.inbox = inbox(); state.read.mockResolvedValue({ read: true }); state.all.mockResolvedValue({ read: true });
});
afterEach(async () => { if (view) await act(async () => view!.unmount()); view = undefined; vi.unstubAllGlobals(); });

describe('owner web notification inbox', () => {
    it('reads the current owner inbox without marking updates read on arrival or departure', async () => {
        await render();
        expect(state.queries).toEqual([{ name: 'ownerInbox:list', args: { clerkId: 'clerk-one' } }]);
        expect(text()).toContain('2 unread'); expect(state.read).not.toHaveBeenCalled(); expect(state.all).not.toHaveBeenCalled();
        await act(async () => view!.unmount()); view = undefined;
        expect(state.read).not.toHaveBeenCalled(); expect(state.all).not.toHaveBeenCalled();
    });

    it('opens the full body and marks just the clicked notification read', async () => {
        await render(); await click('Unread: Update one');
        expect(state.read).toHaveBeenCalledExactlyOnceWith({ key: 'one', clerkId: 'clerk-one' });
        expect(state.all).not.toHaveBeenCalled(); expect(text()).toContain('1 unread');
        expect(view!.root.findAllByProps({ 'data-testid': 'owner-notification-full-body' })[0].children).toEqual([message('one').body]);
        expect(view!.root.findAllByType('a').map(node => node.props.href)).toContain('/my-business/business-one');
        await click('Close owner notification');
        expect(view!.root.findAllByType('dialog')).toHaveLength(0); expect(state.all).not.toHaveBeenCalled();
    });

    it('does not rewrite an already read notification', async () => {
        state.inbox = inbox([message('one', { read: true })]); await render(); await click('Read: Update one');
        expect(view!.root.findAllByType('dialog')).toHaveLength(1); expect(state.read).not.toHaveBeenCalled();
    });

    it('requires an explicit mark-all action', async () => {
        await render(); await click('Mark all read');
        expect(state.all).toHaveBeenCalledExactlyOnceWith({ clerkId: 'clerk-one' }); expect(state.read).not.toHaveBeenCalled();
        expect(text()).toContain('All updates read'); expect(button('Mark all read').props.disabled).toBe(true);
    });

    it('keeps an unread item retryable if saving its read state fails', async () => {
        state.read.mockRejectedValueOnce(new Error('offline')); await render(); await click('Unread: Update one');
        expect(text()).toContain('Could not save read status'); expect(text()).toContain('2 unread');
        await click('Retry read status');
        expect(state.read).toHaveBeenCalledTimes(2); expect(text()).not.toContain('Could not save read status'); expect(text()).toContain('1 unread');
    });

    it('keeps mark-all failures visible and allows a deliberate retry', async () => {
        state.all.mockRejectedValueOnce(new Error('offline')); await render(); await click('Mark all read');
        expect(text()).toContain('Could not mark updates read'); expect(text()).toContain('2 unread');
        await click('Mark all read'); expect(state.all).toHaveBeenCalledTimes(2); expect(text()).toContain('All updates read');
    });

    it('opens and reads a deep-linked event only if it is in the owned inbox', async () => {
        state.eventKey = 'two'; await render();
        expect(state.read).toHaveBeenCalledExactlyOnceWith({ key: 'two', clerkId: 'clerk-one' });
        expect(view!.root.findAllByProps({ 'data-testid': 'owner-notification-full-body' })[0].children).toEqual([message('two').body]);
        await click('Close owner notification'); await update();
        expect(view!.root.findAllByType('dialog')).toHaveLength(0); expect(state.read).toHaveBeenCalledTimes(1);
    });

    it('ignores a foreign deep link instead of querying or marking the guessed event', async () => {
        state.eventKey = 'foreign-secret'; await render();
        expect(state.read).not.toHaveBeenCalled(); expect(view!.root.findAllByType('dialog')).toHaveLength(0);
        expect(state.queries.every(query => query.name === 'ownerInbox:list')).toBe(true);
    });

    it.each(['subject', 'owner'] as const)('rejects a stale %s response before rendering private content', async mismatch => {
        const value = inbox(); state.inbox = mismatch === 'subject' ? { ...value, actorClerkId: 'clerk-other' } : { ...value, ownerId: 'owner-other' };
        await render(); expect(text()).not.toContain('Update one'); expect(text()).toContain('Loading your updates');
        expect(state.mutationHooks).not.toHaveBeenCalled();
    });

    it('skips private reads while auth is unresolved and retains a safe signed-out return path', async () => {
        state.scope.ready = false; state.scope.loading = true; state.scope.isSignedIn = false;
        state.eventKey = 'one'; await render();
        expect(state.queries).toEqual([{ name: 'ownerInbox:list', args: 'skip' }]); expect(state.replace).not.toHaveBeenCalled();
        state.scope.loading = false; await update();
        expect(state.replace).toHaveBeenCalledWith(`/my-business/sign-in?returnTo=${encodeURIComponent('/my-business/notifications?eventKey=one')}`);
        expect(state.read).not.toHaveBeenCalled(); expect(state.mutationHooks).not.toHaveBeenCalled();
    });

    it('clears details on session changes and refuses callbacks captured from the old session', async () => {
        await render(); const oldOpen = button('Unread: Update two').props.onClick as () => void;
        await click('Unread: Update one'); expect(view!.root.findAllByType('dialog')).toHaveLength(1);
        state.scope.sessionId = 'session-two'; state.scope.scopeKey = 'clerk-one:session-two:owner-one'; await update();
        expect(view!.root.findAllByType('dialog')).toHaveLength(0);
        await act(async () => oldOpen()); expect(state.read).toHaveBeenCalledTimes(1);
    });

    it('deduplicates fast opens and drops read failures arriving after an account change', async () => {
        let reject!: (error: Error) => void;
        state.read.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
        await render();
        await act(async () => { const open = button('Unread: Update one').props.onClick as () => void; open(); open(); });
        expect(state.read).toHaveBeenCalledTimes(1);
        state.scope = { ...state.scope, userId: 'clerk-two', sessionId: 'session-two', scopeKey: 'clerk-two:session-two:owner-two', owner: { _id: 'owner-two' } };
        state.inbox = { ...inbox([message('other')]), actorClerkId: 'clerk-two', ownerId: 'owner-two' }; await update();
        await act(async () => reject(new Error('old request failed')));
        expect(text()).not.toContain('Could not save read status'); expect(view!.root.findAllByType('dialog')).toHaveLength(0);
        expect(text()).toContain('Update other'); expect(text()).not.toContain('Update one');
    });

    it('refuses a business action captured from a previous owner session', async () => {
        await render(); await click('Unread: Update one');
        const action = view!.root.findAllByType('a').find(node => node.props.href === '/my-business/business-one')!;
        const oldNavigate = action.props.onClick as (event: { preventDefault: () => void }) => void;
        state.scope.sessionId = 'session-two'; state.scope.scopeKey = 'clerk-one:session-two:owner-one'; await update();
        const preventDefault = vi.fn(); await act(async () => oldNavigate({ preventDefault }));
        expect(preventDefault).toHaveBeenCalledTimes(1); expect(view!.root.findAllByType('dialog')).toHaveLength(0);
    });

    it('does not show a late single-read error after an explicit mark-all succeeds', async () => {
        let reject!: (error: Error) => void;
        state.read.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
        await render(); await click('Unread: Update one'); await click('Close owner notification'); await click('Mark all read');
        await act(async () => reject(new Error('late individual failure')));
        await click('Read: Update one'); expect(text()).not.toContain('Could not save read status');
        expect(text()).toContain('All updates read'); expect(state.all).toHaveBeenCalledTimes(1);
    });

    it('authorizes destination IDs from owned rows, including visits, and rejects a foreign business action', () => {
        const visit = message('visit', { submissionId: null, visitRequestId: 'visit-one' as OwnerWebMessage['visitRequestId'] });
        expect(ownerNotificationDestination(visit, inbox([visit]), [])).toEqual({ href: '/my-business/visits/visit-one', label: 'View visit request' });
        expect(ownerNotificationDestination(message('one'), inbox(), [])).toBeNull();
        expect(ownerNotificationDestination(message('foreign'), inbox(), [{ submissionId: 'business-one' as OwnedId }])).toBeNull();
        const forged = message('one', { submissionId: 'outside-business' as OwnedId });
        expect(ownerNotificationDestination(forged, inbox(), [{ submissionId: 'business-one' as OwnedId }])?.href).toBe('/my-business/business-one');
    });

    it('lets admin samples inspect full details without live reads, mutations or action links', async () => {
        await render(true); await click('Unread: Update one');
        expect(view!.root.findAllByType('dialog')).toHaveLength(1); expect(text()).toContain(message('one').body.replace(/\n/g, '\\n'));
        expect(button('Mark all read').props.disabled).toBe(true); expect(button('Open business').props.disabled).toBe(true);
        expect(view!.root.findAllByType('a')).toHaveLength(0);
        expect(state.queries).toEqual([]); expect(state.mutationHooks).not.toHaveBeenCalled();
        expect(state.read).not.toHaveBeenCalled(); expect(state.all).not.toHaveBeenCalled();
    });
});
