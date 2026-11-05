import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerWebScope } from '../../hooks/useOwnerWebScope';
import type { SharedDraft, useOwnerDraftSync } from '../../hooks/useOwnerDraftSync';

type SyncState = ReturnType<typeof useOwnerDraftSync> & { writable: boolean };
const state = vi.hoisted(() => ({
    scope: {} as OwnerWebScope, draft: undefined as SharedDraft | undefined,
    sync: {} as SyncState, syncReads: 0, syncDraft: undefined as SharedDraft | undefined,
    queries: [] as Array<{ name: string; args: unknown }>,
    push: vi.fn(), replace: vi.fn(), mutate: vi.fn(), action: vi.fn(),
}));
vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push, replace: state.replace }) }));
vi.mock('next/dynamic', async () => {
    const { createElement: element } = await import('react');
    return { default: () => (props: Record<string, unknown>) => element('div', { 'data-map-picker': true, ...props }) };
});
vi.mock('next/link', async () => {
    const { createElement: element } = await import('react');
    return { default: ({ children, ...props }: { children: ReactNode }) => element('a', props, children) };
});
vi.mock('../../components/shells/OwnerShell', async () => {
    const { createElement: element } = await import('react');
    return {
        OwnerShell: ({ children }: { children: ReactNode }) => element('main', {}, children),
        OwnerPageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => element('header', {}, element('h1', {}, title), subtitle),
    };
});
vi.mock('../../app/my-business/_components/OwnerSectionBoundary', async () => {
    const { createElement: element } = await import('react');
    return { OwnerSectionBoundary: ({ children }: { children: ReactNode }) => element('div', {}, children) };
});
vi.mock('../../hooks/useOwnerWebScope', () => ({ useOwnerWebScope: () => state.scope }));
vi.mock('../../hooks/useOwnerDraftSync', () => ({ useOwnerDraftSync: (draft: SharedDraft) => { state.syncReads++; state.syncDraft = draft; return state.sync; } }));
vi.mock('convex/react', () => ({
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference); state.queries.push({ name, args });
        if (name !== 'ownerApp:getSubmission') throw new Error(`Unexpected draft page query ${name}`);
        // Deliberately return an old result for skip: the page must enforce its own scope gate.
        return state.draft;
    },
    useMutation: () => state.mutate, useAction: () => state.action,
}));
vi.mock('../../components/r1', async () => {
    const { createElement: element } = await import('react');
    type Children = { children?: ReactNode };
    return {
        Button: ({ children, ...props }: Children & Record<string, unknown>) => element('button', props, children),
        Field: ({ label, children }: Children & { label: string }) => element('label', {}, label, children),
        Input: (props: Record<string, unknown>) => element('input', props),
        Select: ({ children, ...props }: Children & Record<string, unknown>) => element('select', props, children),
        Textarea: (props: Record<string, unknown>) => element('textarea', props),
        ConfirmDialog: ({ open, title, children, confirmLabel, cancelLabel, busy, onConfirm, onCancel }: Children & {
            open: boolean; title: string; confirmLabel: string; cancelLabel: string; busy?: boolean; onConfirm: () => void; onCancel: () => void;
        }) => open ? element('section', { role: 'dialog', 'aria-label': title }, element('h2', {}, title), children,
            element('button', { 'data-confirm': true, disabled: busy, onClick: onConfirm }, confirmLabel),
            element('button', { 'data-cancel': true, disabled: busy, onClick: onCancel }, cancelLabel)) : null,
    };
});

import { OwnerDraftPage, NewOwnerDraftPage } from '../../app/my-business/drafts/_components/OwnerDraft';
import { ownerDraftDesignOptions } from '../../lib/ownerSharedDraft';

type TestNode = { props: Record<string, unknown>; findAllByType(type: string): TestNode[] };
type View = { root: { findAllByType(type: string): TestNode[] }; update(node: ReactNode): void; unmount(): void; toJSON(): unknown };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
const submissionId = 'shared-draft-one';
const designs = () => ownerDraftDesignOptions('Restaurant');
let view: View | undefined;

function draft(patch: Partial<SharedDraft> = {}): SharedDraft {
    return {
        actorClerkId: 'owner-user', ownerId: 'owner-one' as SharedDraft['ownerId'], submissionId: submissionId as SharedDraft['submissionId'],
        ownerName: 'Alex Santos', ownerPhone: '09171234567', businessName: 'Alex Kitchen', businessType: 'Restaurant',
        contentSource: 'owner_app', publishPolicy: 'pay_then_publish', status: 'draft', phase: 'draft', publishedUrl: null,
        total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: 1,
        address: '12 Main St', city: 'Marikina', province: null, barangay: null, coordinates: null, shotListKey: 'food',
        interview: Array.from({ length: 10 }, (_, index): SharedDraft['interview'][number] => ({ index, questionEn: `Question ${index}`, questionTl: `Tanong ${index}`, lang: 'en',
            answerText: index === 1 ? undefined : `Saved answer ${index}`, updatedAt: 1, mediaType: index === 0 ? 'audio' : index === 1 ? 'video' : undefined,
            ...(index === 0 ? { mediaUrl: 'https://uploads.example.test/story.m4a', durationSec: 31 }
                : index === 1 ? { mediaUrl: 'https://uploads.example.test/location.mp4', durationSec: 24 } : {}),
        })),
        shots: [
            { index: 0, extra: false, url: 'https://uploads.example.test/front.jpg', label: 'Shop front', updatedAt: 1 },
            { index: 2, extra: false, url: 'https://uploads.example.test/food.jpg', label: 'Signature dish', updatedAt: 1 },
            { index: 0, extra: true, url: 'https://uploads.example.test/extra.jpg', label: 'Extra dining area', updatedAt: 1 },
            { index: 4, extra: true, url: 'https://uploads.example.test/menu.jpg', label: 'Extra menu', updatedAt: 1 },
        ],
        templateId: designs()[1].code, templateIds: [designs()[1].code, designs()[0].code], fontChoice: null, colorChoice: null,
        ownerApprovedAt: null, previewReadyAt: null, draftRevision: 12, draftUpdatedAt: 1,
        draftProgress: { step: 'review', how: 'friend', audioOnly: true, lang: 'en' }, ...patch,
    };
}
function scope(): OwnerWebScope {
    return {
        owner: { _id: 'owner-one', clerkId: 'owner-user', email: 'alex@example.test', name: 'Alex Santos', phone: '09171234567' } as NonNullable<OwnerWebScope['owner']>,
        sites: state.draft ? [state.draft] : [], userId: 'owner-user', sessionId: 'session-one', scopeKey: 'owner-user:session-one:owner-one',
        ready: true, loading: false, error: null, isSignedIn: true, isOwner: true, isCurrent: vi.fn(() => true),
    };
}
function content(value: unknown): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map(content).join('');
    if (value && typeof value === 'object' && 'props' in value) return content((value as { props: { children?: unknown } }).props.children);
    return '';
}
const text = () => JSON.stringify(view?.toJSON());
const nodes = (type: string) => view!.root.findAllByType(type);
const buttons = () => nodes('button');
function button(label: string): TestNode {
    const found = buttons().find(item => content(item.props.children).trim() === label);
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
}
async function click(node: TestNode) { await act(async () => { (node.props.onClick as () => unknown)(); }); }
async function change(node: TestNode, value: string) { await act(async () => { (node.props.onChange as (event: { target: { value: string } }) => unknown)({ target: { value } }); }); }
const tree = (isNew = false) => isNew ? createElement(NewOwnerDraftPage) : createElement(OwnerDraftPage, { submissionId });
async function mount(isNew = false) { await act(async () => { view = renderer.create(tree(isNew)); }); }
const activeStep = () => buttons().find(item => item.props['aria-current'] === 'step');

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.draft = draft(); state.scope = scope(); state.syncReads = 0; state.syncDraft = undefined; state.queries = [];
    state.push.mockReset(); state.replace.mockReset(); state.mutate.mockReset(); state.action.mockReset();
    state.sync = {
        loaded: true, writable: true, storageBlocked: false, recoveryMessage: '', busy: false, connected: true, conflict: false, error: '', storageWarning: '', pending: [], optimistic: [],
        enqueue: vi.fn(), flush: vi.fn(async () => true), retry: vi.fn(async () => true), resolveConflict: vi.fn(async () => {}), send: vi.fn(async () => true),
    };
});
afterEach(async () => { if (view) await act(async () => view!.unmount()); view = undefined; vi.unstubAllGlobals(); });

describe('shared owner draft access and identity', () => {
    it.each(['actor', 'owner', 'business', 'not-ready'])('does not hydrate a retained snapshot for a mismatched %s scope', async mismatch => {
        if (mismatch === 'actor') state.draft = draft({ actorClerkId: 'other-user' });
        if (mismatch === 'owner') state.draft = draft({ ownerId: 'other-owner' as SharedDraft['ownerId'] });
        if (mismatch === 'business') state.draft = draft({ submissionId: 'other-draft' as SharedDraft['submissionId'] });
        if (mismatch === 'not-ready') state.scope.ready = false;
        await mount();
        expect(state.syncReads).toBe(0); expect(text()).not.toContain('Alex Kitchen'); expect(nodes('textarea')).toHaveLength(0);
        expect(state.queries[0].name).toBe('ownerApp:getSubmission');
        if (mismatch === 'not-ready') expect(state.queries[0].args).toBe('skip');
    });

    it('offers owner sign-in with this exact draft return path while skipping private reads', async () => {
        state.scope = { ...state.scope, ready: false, isSignedIn: false, userId: null };
        await mount();
        expect(nodes('a').some(node => node.props.href === `/my-business/sign-in?returnTo=${encodeURIComponent(`/my-business/drafts/${submissionId}`)}`)).toBe(true);
        expect(state.queries[0].args).toBe('skip'); expect(state.syncReads).toBe(0); expect(text()).not.toContain('Alex Kitchen');
    });

    it.each([{ status: 'submitted', phase: 'building' }, { status: 'draft', phase: 'draft', contentSource: 'field_agent' }] as const)
    ('keeps a noneditable business read-only and sends website updates through Ask for a change: %j', async patch => {
        state.draft = draft(patch); await mount();
        expect(text()).toContain('Use Ask for a change'); expect(text()).toContain('already been sent');
        expect(nodes('a').some(node => node.props.href === `/my-business/${submissionId}`)).toBe(true);
        expect(nodes('input')).toHaveLength(0); expect(nodes('textarea')).toHaveLength(0); expect(state.syncReads).toBe(0);
        expect(state.mutate).not.toHaveBeenCalled(); expect(state.action).not.toHaveBeenCalled();
    });
});

describe('canonical owner capture restored on web', () => {
    it('keeps phone audio/video attached while showing a pending typed answer', async () => {
        state.draft = draft({ draftProgress: { step: 'interview', questionIndex: 2, lang: 'en' } });
        state.sync.optimistic = [{ id: 'typed-answer', kind: 'answer', index: 0, text: 'Corrected introduction', lang: 'en' }];
        await mount();
        expect(nodes('textarea')[0].props.value).toBe('Corrected introduction');
        expect(nodes('audio').map(node => node.props.src)).toEqual(['https://uploads.example.test/story.m4a']);
        expect(nodes('video').map(node => node.props.src)).toEqual(['https://uploads.example.test/location.mp4']);
        expect(nodes('textarea')[1].props.value).toBe('');
        await change(nodes('textarea')[0], 'Edited on web');
        expect(state.sync.enqueue).toHaveBeenCalledWith({ kind: 'answer', index: 0, text: 'Edited on web', lang: 'en' });
        expect(state.syncDraft?.interview[0]).toMatchObject({ mediaUrl: 'https://uploads.example.test/story.m4a', mediaType: 'audio', durationSec: 31 });
    });

    it('renders sparse guided and extra photos by their saved slot and removes the selected extra only after confirmation', async () => {
        state.draft = draft({ draftProgress: { step: 'photos' } }); await mount();
        expect(nodes('img').map(node => node.props.src).sort()).toEqual(state.draft.shots.map(photo => photo.url).sort());
        const extra = nodes('article').find(node => content(node.props.children).includes('Extra menu'))!;
        const remove = extra.findAllByType('button').find(node => content(node.props.children) === 'Remove')!;
        await click(remove);
        expect(state.sync.enqueue).not.toHaveBeenCalled(); expect(text()).toContain('Remove Extra menu?');
        await click(button('Remove photo'));
        expect(state.sync.enqueue).toHaveBeenCalledWith({ kind: 'remove-photo', index: 4, extra: true });
    });

    it('keeps a saved non-first matching design selected and preserves additional saved picks', async () => {
        state.draft = draft({ draftProgress: { step: 'design' } }); await mount();
        const selected = buttons().filter(node => node.props['aria-pressed'] === true);
        expect(selected).toHaveLength(1); expect(content(selected[0].props.children)).toBe('Selected');
        expect(state.syncDraft?.templateId).toBe(designs()[1].code);
        expect(state.syncDraft?.templateIds).toEqual([designs()[1].code, designs()[0].code]);
        expect(nodes('iframe').map(node => node.props.src)).toEqual(designs().map(item => item.preview));
        expect(state.sync.enqueue).not.toHaveBeenCalled();
    });

    it('retains a mismatched previous design without recommending it for a different business type or allowing review', async () => {
        const law = ownerDraftDesignOptions('Law Office');
        state.draft = draft({ businessType: 'Law Office', templateId: designs()[0].code, templateIds: [designs()[0].code], draftProgress: { step: 'review' } });
        await mount();
        expect(text()).toContain('belongs to another business type');
        expect(nodes('iframe').map(node => node.props.src)).toEqual(law.map(item => item.preview));
        expect(state.syncDraft?.templateId).toBe(designs()[0].code); expect(buttons().some(node => node.props['aria-pressed'] === true)).toBe(false);
        await click(button('Save and continue'));
        expect(content(activeStep()?.props.children)).toContain('Design'); expect(state.sync.flush).not.toHaveBeenCalled();
        expect(state.sync.send).not.toHaveBeenCalled(); expect(state.sync.enqueue).not.toHaveBeenCalled();
    });
});

describe('draft save, navigation and explicit submission', () => {
    it('flushes before advancing and stays on the current step when saving fails', async () => {
        state.draft = draft({ draftProgress: { step: 'details' } });
        vi.mocked(state.sync.flush).mockResolvedValueOnce(false); await mount();
        await click(button('Save and continue'));
        expect(state.sync.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'progress', progress: expect.objectContaining({ step: 'interview' }) }));
        expect(state.sync.flush).toHaveBeenCalledOnce(); expect(content(activeStep()?.props.children)).toContain('Your business');
        expect(state.push).not.toHaveBeenCalled(); expect(state.replace).not.toHaveBeenCalled();
        await click(button('Save and continue'));
        expect(content(activeStep()?.props.children)).toContain('Your story'); expect(nodes('textarea')).toHaveLength(11);
    });

    it('does not leave the draft when Save and exit cannot finish syncing', async () => {
        vi.mocked(state.sync.flush).mockResolvedValue(false); await mount();
        await click(button('Save and exit'));
        expect(state.sync.flush).toHaveBeenCalledOnce(); expect(state.push).not.toHaveBeenCalled(); expect(state.replace).not.toHaveBeenCalled();
        vi.mocked(state.sync.flush).mockResolvedValue(true); await click(button('Save and exit'));
        expect(state.push).toHaveBeenCalledWith('/my-business/today');
    });

    it('requires explicit confirmation and navigates only after a successful mocked submission', async () => {
        vi.mocked(state.sync.send).mockResolvedValueOnce(false); await mount();
        expect(button('Send for review').props.disabled).toBe(false);
        await click(button('Send for review'));
        expect(text()).toContain('Send this business for review?'); expect(text()).toContain('private preview before paying');
        expect(state.sync.send).not.toHaveBeenCalled(); expect(state.replace).not.toHaveBeenCalled();
        await click(buttons().find(node => node.props['data-confirm'] === true)!);
        expect(state.sync.send).toHaveBeenCalledOnce(); expect(state.replace).not.toHaveBeenCalled();
        await click(button('Send for review')); await click(buttons().find(node => node.props['data-confirm'] === true)!);
        expect(state.replace).toHaveBeenCalledWith(`/my-business/${submissionId}`);
        expect(state.mutate).not.toHaveBeenCalled(); expect(state.action).not.toHaveBeenCalled();
    });

    it.each(['offline', 'busy', 'conflict', 'pending', 'not-writable'])('does not enable sending when sync is %s', async condition => {
        if (condition === 'offline') state.sync.connected = false;
        if (condition === 'busy') state.sync.busy = true;
        if (condition === 'conflict') state.sync.conflict = true;
        if (condition === 'pending') state.sync.pending = [{ id: 'waiting', kind: 'progress', progress: { step: 'review' } }];
        if (condition === 'not-writable') state.sync.writable = false;
        await mount();
        expect(buttons().filter(node => content(node.props.children) === 'Send for review').every(node => node.props.disabled === true)).toBe(true);
        expect(state.sync.send).not.toHaveBeenCalled(); expect(state.replace).not.toHaveBeenCalled();
    });

    it('does not redirect a completed operation after the current owner session has changed', async () => {
        let finish: ((value: boolean) => void) | undefined;
        vi.mocked(state.sync.send).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        await mount(); await click(button('Send for review'));
        await click(buttons().find(node => node.props['data-confirm'] === true)!);
        vi.mocked(state.scope.isCurrent).mockReturnValue(false);
        await act(async () => { finish!(true); });
        expect(state.replace).not.toHaveBeenCalled(); expect(state.push).not.toHaveBeenCalled();
    });
});

describe('new authenticated business setup', () => {
    it('starts blank even when the owner already has another business', async () => {
        await mount(true);
        expect(nodes('input')[0].props.value).toBe(''); expect(nodes('select')[0].props.value).toBe('Other');
        expect(button('Start business setup').props.disabled).toBe(true); expect(text()).not.toContain('Alex Kitchen');
        expect(state.syncReads).toBe(0); expect(state.queries).toEqual([]); expect(state.mutate).not.toHaveBeenCalled();
        await change(nodes('input')[0], 'Second business');
        expect(button('Start business setup').props.disabled).toBe(false);
    });

    it('caps only the owner’s three open self-serve drafts and does not create a fourth business', async () => {
        state.scope.sites = [draft(), draft({ submissionId: 'two' as SharedDraft['submissionId'] }), draft({ submissionId: 'three' as SharedDraft['submissionId'] })];
        await mount(true); await change(nodes('input')[0], 'Fourth business');
        expect(text()).toContain('three open drafts'); expect(button('Start business setup').props.disabled).toBe(true);
        await act(async () => { (nodes('form')[0].props.onSubmit as (event: { preventDefault(): void }) => unknown)({ preventDefault() {} }); });
        expect(state.mutate).not.toHaveBeenCalled(); expect(state.replace).not.toHaveBeenCalled();
    });

    it('retries the same frozen creation payload after a lost response rather than making another business', async () => {
        const cache = new Map<string, string>();
        vi.stubGlobal('localStorage', { getItem: (key: string) => cache.get(key) ?? null, setItem: (key: string, value: string) => cache.set(key, value), removeItem: (key: string) => cache.delete(key) });
        vi.stubGlobal('crypto', { randomUUID: () => 'stable-new-business-key' });
        state.mutate.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce('new-draft');
        await mount(true); await change(nodes('input')[0], '  Second business  ');
        const submit = async () => { await act(async () => { (nodes('form')[0].props.onSubmit as (event: { preventDefault(): void }) => unknown)({ preventDefault() {} }); }); };
        await submit();
        expect(state.replace).not.toHaveBeenCalled(); expect(nodes('input')[0].props.disabled).toBe(true);
        expect(button('Continue saved business').props.disabled).toBe(false);
        expect(cache.size).toBe(1);
        await submit();
        expect(state.mutate).toHaveBeenCalledTimes(2); expect(state.mutate.mock.calls[0][0]).toEqual(state.mutate.mock.calls[1][0]);
        expect(state.mutate.mock.calls[0][0]).toMatchObject({ businessName: 'Second business', businessType: 'Other', clientDraftKey: 'stable-new-business-key', actorClerkId: 'owner-user' });
        expect(state.replace).toHaveBeenCalledWith('/my-business/drafts/new-draft'); expect(cache.size).toBe(0);
    });

    it('requires an authenticated ready owner before mounting the new business form', async () => {
        state.scope = { ...state.scope, ready: false, isSignedIn: false, userId: null }; await mount(true);
        expect(nodes('form')).toHaveLength(0); expect(nodes('input')).toHaveLength(0);
        expect(nodes('a').some(node => node.props.href === `/my-business/sign-in?returnTo=${encodeURIComponent('/my-business/drafts/new')}`)).toBe(true);
        expect(state.mutate).not.toHaveBeenCalled();
    });
});
