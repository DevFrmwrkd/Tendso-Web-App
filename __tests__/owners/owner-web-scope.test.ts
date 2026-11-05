import { createRequire } from 'node:module';
import { act, createElement, useLayoutEffect, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerWebScope } from '../../hooks/useOwnerWebScope';
import type { useOwnerAuth } from '../../hooks/useOwnerAuth';
import type { OwnerSite } from '../../app/my-business/_components/ownerSite';

type AuthState = { isLoaded: boolean; isSignedIn: boolean; userId: string | null; sessionId: string | null };
type Gate = ReturnType<typeof useOwnerAuth>;
const state = vi.hoisted(() => ({
    auth: {} as AuthState,
    convex: { isLoading: false, isAuthenticated: true },
    gate: {} as Gate,
    workspace: undefined as unknown,
    queries: [] as Array<{ name: string; args: unknown }>,
    ownerGateCalls: 0,
    scope: undefined as OwnerWebScope | undefined,
    duringRender: [] as boolean[],
}));

vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('@clerk/nextjs', () => ({ useAuth: () => state.auth }));
vi.mock('../../hooks/useOwnerAuth', () => ({ useOwnerAuth: () => { state.ownerGateCalls++; return state.gate; } }));
vi.mock('convex/react', () => ({
    useConvexAuth: () => state.convex,
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference);
        if (name !== 'owners:me') throw new Error(`Unexpected scope query: ${name}`);
        state.queries.push({ name, args });
        // Retain the last snapshot even for skip to test the scope's own guards.
        return state.workspace;
    },
}));

import { OwnerWebScopeProvider, useOwnerWebScope } from '../../hooks/useOwnerWebScope';

type View = { update(node: ReactNode): void; unmount(): void; toJSON(): unknown };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
let view: View | undefined;
function owner(id = 'owner-one', clerkId = 'user-one'): NonNullable<Gate['owner']> {
    return { _id: id, _creationTime: 1, clerkId, email: `${clerkId}@example.test`, name: 'Alex Santos', phone: '09171234567' } as NonNullable<Gate['owner']>;
}
function site(name = 'Business one'): OwnerSite {
    return { submissionId: name as OwnerSite['submissionId'], businessName: name, businessType: 'shop', contentSource: 'owner_app',
        publishPolicy: 'pay_then_publish', status: 'draft', phase: 'draft', publishedUrl: null, total: 4999, amountPaid: 0,
        balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: 1 };
}
const workspace = (id = 'owner-one', sites: OwnerSite[] = [site()]) => ({ owner: { _id: id, name: 'Alex Santos', email: 'owner@example.test', phone: null }, sites });
function Capture() {
    const scope = useOwnerWebScope();
    useLayoutEffect(() => {
        state.scope = scope;
        state.duringRender.push(scope.isCurrent());
    });
    return createElement('p', {}, JSON.stringify({ ready: scope.ready, loading: scope.loading, sites: scope.sites, error: scope.error }));
}
function Workspace({ children }: { children?: ReactNode }) { return OwnerWebScopeProvider({ children }); }
const tree = (children: ReactNode = createElement(Capture)) => createElement(Workspace, null, children);
async function mount(children?: ReactNode) { await act(async () => { view = renderer.create(tree(children)); }); }
async function update() { await act(async () => view!.update(tree())); }
const scope = () => {
    if (!state.scope) throw new Error('Scope was not captured');
    return state.scope;
};

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.auth = { isLoaded: true, isSignedIn: true, userId: 'user-one', sessionId: 'session-one' };
    state.convex = { isLoading: false, isAuthenticated: true };
    state.gate = { owner: owner(), isOwner: true, isSignedIn: true, loading: false, error: null };
    state.workspace = workspace(); state.queries = []; state.ownerGateCalls = 0; state.scope = undefined; state.duringRender = [];
});
afterEach(async () => {
    if (view) await act(async () => view!.unmount());
    view = undefined; vi.unstubAllGlobals();
});

describe('owner web workspace scope', () => {
    it('shares one owner/session subscription across consumers and becomes writable only after commit', async () => {
        await mount(createElement('div', {}, createElement(Capture), createElement(Capture)));
        expect(state.queries).toEqual([{ name: 'owners:me', args: {} }]);
        expect(state.ownerGateCalls).toBe(1);
        expect(scope()).toMatchObject({ ready: true, loading: false, userId: 'user-one', sessionId: 'session-one', scopeKey: 'user-one:session-one:owner-one', error: null });
        expect(scope().sites).toBe((state.workspace as { sites: OwnerSite[] }).sites);
        expect(state.duringRender).toEqual([false, false]);
        expect(scope().isCurrent()).toBe(true);
    });

    it.each([
        { isLoaded: false }, { isSignedIn: false }, { userId: null }, { sessionId: null },
    ])('skips workspace reads and hides retained data for incomplete Clerk state %j', async patch => {
        state.auth = { ...state.auth, ...patch };
        await mount();
        expect(state.queries).toEqual([{ name: 'owners:me', args: 'skip' }]);
        expect(scope().ready).toBe(false); expect(scope().sites).toBeUndefined(); expect(scope().isCurrent()).toBe(false);
    });

    it.each([{ isLoading: true, isAuthenticated: true }, { isLoading: false, isAuthenticated: false }])('waits for Convex authentication %j', async auth => {
        state.convex = auth;
        await mount();
        expect(state.queries).toEqual([{ name: 'owners:me', args: 'skip' }]);
        expect(scope()).toMatchObject({ ready: false, loading: true }); expect(scope().sites).toBeUndefined(); expect(scope().isCurrent()).toBe(false);
    });

    it.each([
        { loading: true }, { isOwner: false }, { owner: null }, { owner: owner('owner-one', 'previous-user') },
    ] as Array<Partial<Gate>>)('does not trust an unresolved or mismatched owner gate %j', async patch => {
        state.gate = { ...state.gate, ...patch };
        await mount();
        expect(state.queries).toEqual([{ name: 'owners:me', args: 'skip' }]);
        expect(scope().ready).toBe(false); expect(scope().sites).toBeUndefined(); expect(scope().isCurrent()).toBe(false);
        if (patch.isOwner === false || patch.owner === null || patch.owner?.clerkId === 'previous-user') expect(scope().owner).toBeNull();
    });

    it('keeps an unresolved canonical workspace distinct from a real empty portfolio', async () => {
        state.workspace = undefined; await mount();
        expect(scope()).toMatchObject({ ready: false, loading: true, error: null }); expect(scope().sites).toBeUndefined();
        state.workspace = workspace('owner-one', []); await update();
        expect(scope()).toMatchObject({ ready: true, loading: false, sites: [], error: null }); expect(scope().isCurrent()).toBe(true);
    });

    it.each([null, workspace('another-owner', [site('Private other business')])])('rejects a missing or foreign-owner response %j', async raw => {
        state.workspace = raw; await mount();
        expect(scope()).toMatchObject({ ready: false, loading: false, error: 'We could not load your owner workspace. Refresh and try again.' });
        expect(scope().sites).toBeUndefined(); expect(scope().isCurrent()).toBe(false);
        expect(JSON.stringify(view?.toJSON())).not.toContain('Private other business');
    });

    it('preserves the specific owner-gate failure instead of replacing it with a generic workspace error', async () => {
        state.gate = { ...state.gate, isOwner: false, error: 'Use the business owner’s email to open this website.' };
        state.workspace = null; await mount();
        expect(scope().error).toBe('Use the business owner’s email to open this website.');
        expect(scope().sites).toBeUndefined(); expect(scope().isCurrent()).toBe(false);
    });
});

describe('committed owner scope lifetime', () => {
    it('revokes a captured callback when the session rotates for the same owner', async () => {
        await mount(); const previous = scope().isCurrent;
        expect(previous()).toBe(true);
        state.auth = { ...state.auth, sessionId: 'session-two' }; await update();
        expect(previous()).toBe(false); expect(scope().isCurrent()).toBe(true);
        expect(scope().scopeKey).toBe('user-one:session-two:owner-one');
        expect(scope().owner?._id).toBe('owner-one');
    });

    it('does not expose the previous owner while Clerk, owner gate and workspace arrive separately', async () => {
        await mount(); const firstOwner = scope().isCurrent;
        state.auth = { ...state.auth, userId: 'user-two', sessionId: 'session-two' }; await update();
        expect(firstOwner()).toBe(false); expect(scope().owner).toBeNull(); expect(scope().sites).toBeUndefined(); expect(scope().ready).toBe(false);
        expect(state.queries.at(-1)?.args).toBe('skip');
        const mismatchedGate = scope().isCurrent;
        state.gate = { ...state.gate, owner: owner('owner-two', 'user-two') }; await update();
        expect(scope().owner?._id).toBe('owner-two'); expect(scope().sites).toBeUndefined(); expect(scope().ready).toBe(false);
        expect(mismatchedGate()).toBe(false); expect(firstOwner()).toBe(false);
        const waitingForWorkspace = scope().isCurrent;
        state.workspace = workspace('owner-two', [site('Second owner business')]); await update();
        expect(scope().ready).toBe(true); expect(scope().sites?.[0].businessName).toBe('Second owner business');
        expect(scope().isCurrent()).toBe(true); expect(firstOwner()).toBe(false); expect(mismatchedGate()).toBe(false); expect(waitingForWorkspace()).toBe(false);
    });

    it('invalidates existing callbacks immediately after committed role/access revocation', async () => {
        await mount(); const captured = scope().isCurrent;
        state.gate = { ...state.gate, isOwner: false }; await update();
        expect(captured()).toBe(false); expect(scope().isCurrent()).toBe(false); expect(scope().sites).toBeUndefined();
        expect(state.queries.at(-1)?.args).toBe('skip');
    });

    it('invalidates existing callbacks while the backend session is unavailable', async () => {
        await mount(); const captured = scope().isCurrent;
        state.convex = { isLoading: false, isAuthenticated: false }; await update();
        expect(captured()).toBe(false); expect(scope().ready).toBe(false); expect(scope().loading).toBe(true);
        expect(scope().sites).toBeUndefined();
    });

    it('revokes a callback when the same user is linked to a different owner row', async () => {
        await mount(); const captured = scope().isCurrent;
        state.gate = { ...state.gate, owner: owner('replacement-owner') };
        state.workspace = workspace('replacement-owner'); await update();
        expect(captured()).toBe(false); expect(scope().isCurrent()).toBe(true);
        expect(scope().scopeKey).toBe('user-one:session-one:replacement-owner');
    });

    it('keeps callbacks revoked after unmount even if an identical session mounts again', async () => {
        await mount(); const captured = scope().isCurrent;
        await act(async () => view!.unmount()); view = undefined;
        expect(captured()).toBe(false);
        await mount();
        expect(scope().scopeKey).toBe('user-one:session-one:owner-one');
        expect(scope().isCurrent()).toBe(true); expect(captured()).toBe(false);
    });
});
