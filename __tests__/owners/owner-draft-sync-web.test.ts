import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerWebScope } from '../../hooks/useOwnerWebScope';
import type { SharedDraft } from '../../hooks/useOwnerDraftSync';

const state = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), mutation: vi.fn(), upload: vi.fn(), current: true, id: 0, status: 'draft' }));
vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('convex/react', () => ({
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) => state.mutation(getFunctionName(reference), args),
    useAction: () => state.upload,
}));
vi.mock('../../lib/ownerDraftJournal', async importOriginal => ({
    ...await importOriginal<typeof import('../../lib/ownerDraftJournal')>(),
    readOwnerDraftJournal: (...args: unknown[]) => state.read(...args),
    writeOwnerDraftJournal: (...args: unknown[]) => state.write(...args),
}));

import { useOwnerDraftSync } from '../../hooks/useOwnerDraftSync';
import { OwnerDraftJournalRecoveryError, ownerDraftJournalKey } from '../../lib/ownerDraftJournal';

type Sync = ReturnType<typeof useOwnerDraftSync>;
type View = { unmount(): void; update(node: ReactNode): void };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
const views: View[] = [];
const results = new Map<string, Sync>();
let held: Map<string, Promise<unknown>>;
let lockRequest: ReturnType<typeof vi.fn>;

const scopeCurrent = () => state.current;
function scope(): OwnerWebScope {
    return { owner: { _id: 'owner-one', clerkId: 'user-one' } as OwnerWebScope['owner'], sites: [], userId: 'user-one', sessionId: 'session-one',
        scopeKey: 'user-one:session-one:owner-one', ready: true, loading: false, error: null, isSignedIn: true, isOwner: true, isCurrent: scopeCurrent };
}
const draft = { submissionId: 'business-one', status: 'draft', phase: 'draft', contentSource: 'owner_app', draftRevision: 0 } as SharedDraft;
function Harness({ name }: { name: string }) {
    results.set(name, useOwnerDraftSync({ ...draft, status: state.status }, scope()));
    return createElement('div', {}, name);
}
async function mount(name: string) {
    let view!: View;
    await act(async () => { view = renderer.create(createElement(Harness, { name })); });
    views.push(view); return view;
}
async function unmount(view: View) {
    views.splice(views.indexOf(view), 1);
    await act(async () => view.unmount());
}
const sync = (name = 'first') => results.get(name)!;

beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); state.current = true; state.id = 0; state.status = 'draft'; results.clear(); held = new Map();
    state.read.mockResolvedValue(null); state.write.mockResolvedValue(undefined);
    state.mutation.mockResolvedValue({ draftRevision: 1 });
    lockRequest = vi.fn((name: string, options: { ifAvailable: boolean; mode: string }, callback: (lock: { name: string; mode: string } | null) => Promise<unknown>) => {
        if (!options.ifAvailable || options.mode !== 'exclusive') throw new Error('Expected a non-blocking exclusive lease');
        if (held.has(name)) return Promise.resolve(callback(null));
        const promise = Promise.resolve().then(() => callback({ name, mode: 'exclusive' }));
        held.set(name, promise);
        return promise.finally(() => { if (held.get(name) === promise) held.delete(name); });
    });
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('navigator', { onLine: true, locks: { request: lockRequest } });
    vi.stubGlobal('crypto', { randomUUID: () => `operation-${++state.id}` });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(),
        setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args), clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id) });
});
afterEach(async () => {
    for (const view of views.splice(0)) await act(async () => view.unmount());
    vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('owner browser draft lease', () => {
    it('stays read-only without Web Locks and never reads, writes, replays or submits pending work', async () => {
        vi.stubGlobal('navigator', { onLine: true });
        await mount('first');
        expect(sync()).toMatchObject({ loaded: true, writable: false, storageBlocked: true });
        expect(sync().recoveryMessage).toContain('Web Locks support');
        await act(async () => {
            sync().enqueue({ kind: 'answer', index: 0, text: 'Unsafely queued', lang: 'en' });
            expect(await sync().flush()).toBe(false); expect(await sync().send()).toBe(false);
            await sync().resolveConflict(true);
        });
        expect(state.read).not.toHaveBeenCalled(); expect(state.write).not.toHaveBeenCalled(); expect(state.mutation).not.toHaveBeenCalled();
    });
    it('allows only one tab to hydrate or edit the same private journal', async () => {
        const first = await mount('first'); await mount('second');
        expect(sync('first').writable).toBe(true); expect(sync('second').writable).toBe(false);
        expect(sync('second').recoveryMessage).toContain('another tab');
        expect(state.read).toHaveBeenCalledTimes(1);
        expect(state.read).toHaveBeenCalledWith(ownerDraftJournalKey('user-one', 'business-one'));
        await act(async () => { sync('second').enqueue({ kind: 'answer', index: 0, text: 'Second tab', lang: 'en' }); expect(await sync('second').flush()).toBe(false); });
        expect(state.write).not.toHaveBeenCalled(); expect(state.mutation).not.toHaveBeenCalled();
        await unmount(first); await mount('reloaded');
        expect(sync('reloaded').writable).toBe(true); expect(state.read).toHaveBeenCalledTimes(2);
    });
    it('preserves a corrupt journal and blocks every recovery shortcut from overwriting it', async () => {
        state.read.mockRejectedValue(new OwnerDraftJournalRecoveryError());
        await mount('first');
        expect(sync()).toMatchObject({ loaded: true, writable: false, storageBlocked: true });
        expect(sync().recoveryMessage).toContain('kept unchanged');
        await act(async () => {
            sync().enqueue({ kind: 'answer', index: 0, text: 'Overwrite corrupt work', lang: 'en' });
            await sync().resolveConflict(false); await sync().resolveConflict(true);
            expect(await sync().retry()).toBe(false); expect(await sync().send()).toBe(false);
        });
        expect(state.write).not.toHaveBeenCalled(); expect(state.mutation).not.toHaveBeenCalled();
    });
    it('drains only the lease holder with the actor, business and server revision guard', async () => {
        await mount('first');
        await act(async () => sync().enqueue({ kind: 'answer', index: 4, text: 'The owner’s story', lang: 'tl' }));
        await act(async () => { expect(await sync().flush()).toBe(true); });
        expect(state.mutation).toHaveBeenCalledWith('ownerApp:saveAnswer', {
            submissionId: 'business-one', actorClerkId: 'user-one', expectedRevision: 0, index: 4, answerText: 'The owner’s story', lang: 'tl',
        });
        expect(sync().pending).toEqual([]);
        expect(state.write.mock.calls.at(-1)?.[1]).toMatchObject({ baseRevision: 1, operations: [] });
    });
    it('clears a transport error for a new edit while keeping conflict decisions blocked', async () => {
        state.mutation.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ draftRevision: 1 });
        await mount('first');
        await act(async () => sync().enqueue({ kind: 'answer', index: 0, text: 'First text', lang: 'en' }));
        await act(async () => { expect(await sync().flush()).toBe(false); });
        expect(sync().error).toBe('Connection lost');
        await act(async () => sync().enqueue({ kind: 'answer', index: 0, text: 'Corrected text', lang: 'en' }));
        expect(sync().error).toBe('');
        await act(async () => { expect(await sync().flush()).toBe(true); });
        expect(state.mutation.mock.calls.at(-1)?.[1]).toMatchObject({ answerText: 'Corrected text' });
        state.mutation.mockRejectedValueOnce({ data: { code: 'OWNER_DRAFT_CONFLICT', message: 'Review newer changes' } });
        await act(async () => sync().enqueue({ kind: 'answer', index: 1, text: 'Kept pending', lang: 'en' }));
        await act(async () => { expect(await sync().flush()).toBe(false); });
        await act(async () => sync().enqueue({ kind: 'answer', index: 1, text: 'Must not bypass conflict', lang: 'en' }));
        expect(sync().conflict).toBe(true); expect(sync().error).toBe('Review newer changes');
        expect(sync().pending).toHaveLength(1); expect(sync().pending[0]).toMatchObject({ text: 'Kept pending' });
    });
    it.each(['scope-changed', 'submitted-remotely'])('retains pending work after a late save acknowledgement when %s', async condition => {
        let acknowledge!: (value: { draftRevision: number }) => void;
        state.mutation.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
        const view = await mount('first');
        await act(async () => sync().enqueue({ kind: 'answer', index: 0, text: 'Keep this pending work', lang: 'en' }));
        let result!: Promise<boolean>;
        await act(async () => { result = sync().flush(); });
        expect(state.mutation).toHaveBeenCalledTimes(1);
        if (condition === 'scope-changed') state.current = false;
        else { state.status = 'submitted'; await act(async () => view.update(createElement(Harness, { name: 'first' }))); }
        await act(async () => acknowledge({ draftRevision: 1 }));
        expect(await result).toBe(false);
        expect(state.write.mock.calls.every(call => call[1].operations.length === 1)).toBe(true);
        expect(sync().pending).toHaveLength(1);
    });
    it('finishes admitted storage writes before releasing its lease to another tab', async () => {
        let finishWrite!: () => void;
        state.write.mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));
        const first = await mount('first');
        await act(async () => sync().enqueue({ kind: 'answer', index: 0, text: 'Keep on this browser', lang: 'en' }));
        expect(state.write).toHaveBeenCalledTimes(1);
        await unmount(first); await mount('second');
        expect(sync('second').writable).toBe(false); expect(held.size).toBe(1);
        await act(async () => finishWrite());
        await mount('reloaded'); expect(sync('reloaded').writable).toBe(true);
    });
});
