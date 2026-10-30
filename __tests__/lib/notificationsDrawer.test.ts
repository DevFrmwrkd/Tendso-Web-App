import { createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';

import { NotificationsDrawer } from '@/app/notifications/_components/NotificationsDrawer';
import type { Doc } from '@/convex/_generated/dataModel';

// The installed renderer belongs to the mobile workspace, so its React must match too.
jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@clerk/nextjs', () => ({
    useUser: () => ({ user: state.user, isLoaded: state.loaded, isSignedIn: state.signedIn }),
}));
jest.mock('convex/react', () => ({
    useConvexAuth: () => state.auth,
    useConvex: () => convexClient,
    useQuery: (...args: unknown[]) => liveQuery(...args),
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference) === 'notifications:markAsRead' ? markAsRead : markAllAsRead,
}));
jest.mock('@/convex/_generated/api', () => ({ api: jest.requireActual('convex/server').anyApi }));
jest.mock('next/link', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    return ({ children, ...props }: { children?: ReactNode }) => React.createElement('a', props, children);
});
jest.mock('@/components/r1', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    const host = (type: string) => ({ children, ...props }: { children?: ReactNode }) => React.createElement(type, props, children);
    return {
        Button: host('button'), ButtonLink: host('a'), RowButton: host('button'), RowLink: host('a'), List: host('div'), Dot: host('span'), Icon: host('span'), SkeletonRows: host('div'),
        Loading: ({ label, children }: { label: string; children: ReactNode }) => React.createElement('div', { role: 'status', 'aria-label': label }, children),
        EmptyState: ({ title, body, action }: { title: string; body: string; action?: ReactNode }) => React.createElement('div', null, title, body, action),
        Drawer: ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children?: ReactNode }) => open ? React.createElement('section', { 'aria-label': title },
            React.createElement('button', { onClick: onClose }, 'Close notifications'), children) : null,
        Segmented: ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: ReactNode }[] }) => React.createElement('div', { role: 'group' },
            options.map(option => React.createElement('button', { key: option.value, 'aria-pressed': value === option.value, onClick: () => onChange(option.value) }, option.label))),
    };
});

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

const account: Doc<'creators'> = {
    _id: 'own-affiliate' as Doc<'creators'>['_id'], _creationTime: 1,
    clerkId: 'current-user', email: 'affiliate@example.com', role: 'affiliate', status: 'active', balance: 0,
};
function notification(id: string, title: string, extra: Partial<Doc<'notifications'>> = {}): Doc<'notifications'> {
    return { _id: id as Doc<'notifications'>['_id'], _creationTime: 1, creatorId: account._id, type: 'system', title,
        body: `Full notification body for ${title}. Last sentence must remain available.`, read: false, sentAt: 1, ...extra };
}
const first = notification('first-message', 'First unread message');
const second = notification('second-message', 'Second unread message');
const readMessage = notification('read-message', 'Previously read message', { read: true });
const state = {
    user: { id: 'current-user' } as { id: string } | null,
    loaded: true,
    signedIn: true,
    auth: { isAuthenticated: true, isLoading: false },
    notifications: [first, second, readMessage] as Doc<'notifications'>[] | undefined,
};
const markAsRead = jest.fn();
const markAllAsRead = jest.fn();
const detailsQuery = jest.fn();
const convexClient = { query: detailsQuery };
const liveQuery = jest.fn();
let renderer: TestRenderer | undefined;
let consoleError: jest.SpyInstance;

function text(node: TestNode | string): string {
    return typeof node === 'string' ? node : node.children.map(text).join('');
}
function button(label: string): TestNode {
    const found = renderer!.root.findAllByType('button').find(node => text(node).includes(label));
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
}
async function click(label: string) {
    await act(async () => { (button(label).props.onClick as () => unknown)(); await Promise.resolve(); });
}
async function mount(creator: Doc<'creators'> | null = account, open = true, onClose = jest.fn()) {
    await act(async () => { renderer = create(createElement(NotificationsDrawer, { creator, open, onClose })); });
    return onClose;
}
async function update(creator: Doc<'creators'> | null = account, open = true) {
    await act(async () => { renderer!.update(createElement(NotificationsDrawer, { creator, open, onClose: jest.fn() })); });
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
    return { promise, resolve, reject };
}

beforeEach(() => {
    jest.clearAllMocks();
    state.user = { id: 'current-user' };
    state.loaded = true;
    state.signedIn = true;
    state.auth = { isAuthenticated: true, isLoading: false };
    state.notifications = [first, second, readMessage];
    markAsRead.mockResolvedValue(undefined);
    markAllAsRead.mockResolvedValue(undefined);
    detailsQuery.mockImplementation((_reference: unknown, args: { id: string }) => Promise.resolve(state.notifications?.find(row => row._id === args.id) ?? null));
    liveQuery.mockImplementation((reference, args) => {
        if (args === 'skip') return undefined;
        if (getFunctionName(reference) === 'notifications:getByCreator') return state.notifications;
        if (getFunctionName(reference) === 'submissions:getByCreatorId') return [];
        throw new Error(`Unexpected drawer query: ${getFunctionName(reference)}`);
    });
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
    consoleError.mockRestore();
});

describe('web notification full-message reader', () => {
    it('does not mark messages read just because the drawer opens or closes', async () => {
        const close = await mount();
        expect(text(renderer!.root)).toContain(first.title);
        expect(markAsRead).not.toHaveBeenCalled();
        expect(markAllAsRead).not.toHaveBeenCalled();
        expect(detailsQuery).not.toHaveBeenCalled();
        await click('Close notifications');
        expect(close).toHaveBeenCalledTimes(1);
        await update(account, false);
        expect(markAsRead).not.toHaveBeenCalled();
        expect(markAllAsRead).not.toHaveBeenCalled();
    });

    it('opens the full tapped message and marks only that unread message', async () => {
        await mount();
        await click(first.title);
        expect(text(renderer!.root)).toContain(first.body);
        expect(text(renderer!.root)).toContain('Back to notifications');
        expect(markAsRead).toHaveBeenCalledTimes(1);
        expect(markAsRead).toHaveBeenCalledWith({ id: first._id });
        expect(markAllAsRead).not.toHaveBeenCalled();
        expect(detailsQuery).toHaveBeenCalledWith(expect.anything(), { id: first._id });
        await click('Back to notifications');
        await click(readMessage.title);
        expect(text(renderer!.root)).toContain(readMessage.body);
        expect(markAsRead).toHaveBeenCalledTimes(1);
    });

    it('loads the complete original announcement while retaining the notification snapshot', async () => {
        const loading = deferred<Doc<'notifications'>>();
        const announcement = notification('announcement-message', 'Long announcement', { body: 'Notification snapshot.', data: { announcementId: 'announcement-one' } });
        state.notifications = [announcement];
        detailsQuery.mockReturnValue(loading.promise);
        await mount();
        await click(announcement.title);
        expect(text(renderer!.root)).toContain('Loading original announcement…');
        expect(text(renderer!.root)).toContain(announcement.body);
        const original = 'Complete original announcement.\n\nThe final paragraph is longer than the notification preview and remains readable.';
        await act(async () => { loading.resolve({ ...announcement, body: original }); });
        expect(text(renderer!.root)).toContain(original);
        expect(text(renderer!.root)).not.toContain('Loading original announcement…');
    });

    it('keeps the snapshot on a detail failure and retries the original message explicitly', async () => {
        detailsQuery.mockRejectedValueOnce(new Error('Network unavailable'));
        await mount();
        await click(first.title);
        expect(text(renderer!.root)).toContain('Could not load the full message.');
        expect(text(renderer!.root)).toContain(first.body);
        detailsQuery.mockResolvedValueOnce({ ...first, body: 'Recovered full message.' });
        await click('Retry');
        expect(detailsQuery).toHaveBeenCalledTimes(2);
        expect(text(renderer!.root)).toContain('Recovered full message.');
        expect(text(renderer!.root)).not.toContain('Could not load the full message.');
        expect(markAsRead).toHaveBeenCalledTimes(1);
    });

    it('marks all read only after that explicit action and uses the current recipient', async () => {
        await mount();
        expect(markAllAsRead).not.toHaveBeenCalled();
        await click('Mark all read');
        expect(markAllAsRead).toHaveBeenCalledTimes(1);
        expect(markAllAsRead).toHaveBeenCalledWith({ creatorId: account._id });
        expect(markAsRead).not.toHaveBeenCalled();
    });

    it('returns to the inbox after closing and reopening instead of restoring a selected message', async () => {
        await mount();
        await click(first.title);
        expect(text(renderer!.root)).toContain('Back to notifications');
        await update(account, false);
        await update(account, true);
        expect(text(renderer!.root)).toContain(second.title);
        expect(text(renderer!.root)).not.toContain('Back to notifications');
    });

    it.each([
        { role: 'affiliate', type: 'system', data: { submissionId: 'shop-one' }, href: '/v2/creators/portal#pt-shops' },
        { role: 'affiliate', type: 'payout_sent', data: {}, href: '/v2/creators/portal/payouts' },
        { role: 'creator', type: 'system', data: { submissionId: 'shop-one' }, href: '/submissions?open=shop-one' },
        { role: 'creator', type: 'certification', data: { showCertificate: true }, href: '/profile?certificate=1' },
        { role: 'creator', type: 'system', data: { articleSlug: 'owner-interview' }, href: '/knowledge/owner-interview' },
    ] as const)('offers $href explicitly after a $role reads the full message', async scenario => {
        const message = notification('destination-message', 'Update with a destination', { type: scenario.type, data: scenario.data });
        state.notifications = [message];
        await mount({ ...account, role: scenario.role, certifiedAt: 1 });
        expect(renderer!.root.findAllByType('a')).toHaveLength(0);
        await click(message.title);
        expect(text(renderer!.root)).toContain(message.body);
        expect(renderer!.root.findAllByType('a').map(node => node.props.href)).toEqual([scenario.href]);
    });

    it.each([
        { role: 'affiliate', data: { showCertificate: true, articleSlug: 'owner-interview', href: 'https://external.example' } },
        { role: 'creator', data: { articleSlug: '../unsafe', href: 'https://external.example' } },
    ] as const)('does not turn unsupported or external payload destinations into $role navigation', async scenario => {
        const message = notification('unsafe-destination', 'Informational update', { data: scenario.data });
        state.notifications = [message];
        await mount({ ...account, role: scenario.role, certifiedAt: 1 });
        await click(message.title);
        expect(renderer!.root.findAllByType('a')).toHaveLength(0);
    });
});

describe('notification reader account isolation', () => {
    it('never asks field-agent submissions queries for an affiliate inbox', async () => {
        await mount();
        const calls = liveQuery.mock.calls.filter(([reference, args]) => getFunctionName(reference) === 'submissions:getByCreatorId' && args !== 'skip');
        expect(calls).toHaveLength(0);
    });

    it.each(['closed', 'Clerk loading', 'Clerk signed out', 'Convex loading', 'Convex signed out', 'previous account'])(
        'does not read or mount an inbox while %s', async condition => {
            if (condition === 'Clerk loading') state.loaded = false;
            if (condition === 'Clerk signed out') { state.signedIn = false; state.user = null; }
            if (condition === 'Convex loading') state.auth.isLoading = true;
            if (condition === 'Convex signed out') state.auth.isAuthenticated = false;
            if (condition === 'previous account') state.user = { id: 'different-clerk-user' };
            await mount(account, condition !== 'closed');
            expect(liveQuery.mock.calls.every(([, args]) => args === 'skip')).toBe(true);
            expect(detailsQuery).not.toHaveBeenCalled();
            expect(markAsRead).not.toHaveBeenCalled();
            expect(text(renderer!.root)).not.toContain(first.title);
        },
    );

    it.each(['foreign recipient', 'different message'] as const)('does not show cached foreign list rows or a detail response for a %s', async mismatch => {
        const foreign = notification('foreign-message', 'Another recipient secret', { creatorId: 'another-affiliate' as Doc<'creators'>['_id'] });
        state.notifications = [first, foreign];
        detailsQuery.mockResolvedValue(mismatch === 'foreign recipient' ? foreign : { ...foreign, creatorId: account._id });
        await mount();
        expect(text(renderer!.root)).not.toContain(foreign.title);
        await click(first.title);
        expect(text(renderer!.root)).toContain(first.body);
        expect(text(renderer!.root)).not.toContain(foreign.body);
        expect(markAsRead).toHaveBeenCalledWith({ id: first._id });
    });

    it('does not attach a late read failure to another selected message in the same account', async () => {
        const pendingRead = deferred<void>();
        markAsRead.mockReturnValueOnce(pendingRead.promise);
        await mount();
        await click(first.title);
        await click('Back to notifications');
        await click(second.title);
        await act(async () => { pendingRead.reject(new Error('First read failed late')); });
        expect(text(renderer!.root)).toContain(second.body);
        expect(text(renderer!.root)).not.toContain('Could not mark');
        expect(text(renderer!.root)).not.toContain('Retry marking read');
        expect(markAsRead).toHaveBeenNthCalledWith(1, { id: first._id });
        expect(markAsRead).toHaveBeenNthCalledWith(2, { id: second._id });
    });

    it('unmounts the old selection and ignores old read/detail failures after an account switch', async () => {
        const pendingRead = deferred<void>();
        const pendingDetail = deferred<Doc<'notifications'>>();
        markAsRead.mockReturnValueOnce(pendingRead.promise);
        detailsQuery.mockReturnValueOnce(pendingDetail.promise);
        await mount();
        await click(first.title);
        const nextAccount = { ...account, _id: 'new-affiliate' as Doc<'creators'>['_id'], clerkId: 'new-clerk-user' };
        const nextMessage = notification('new-message', 'New recipient inbox', { creatorId: nextAccount._id });
        state.user = { id: nextAccount.clerkId };
        state.notifications = [nextMessage];
        await update(nextAccount);
        await act(async () => { pendingRead.reject(new Error('Old read failed')); pendingDetail.reject(new Error('Old detail failed')); });
        expect(text(renderer!.root)).toContain(nextMessage.title);
        expect(text(renderer!.root)).not.toContain('Back to notifications');
        expect(text(renderer!.root)).not.toContain(first.title);
        expect(text(renderer!.root)).not.toContain('Could not');
        expect(text(renderer!.root)).not.toContain("Couldn't");
    });
});
