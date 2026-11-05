import { createRequire } from 'node:module';
import { createElement, act, type ReactNode } from 'react';
import { getFunctionName, type FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

const state = vi.hoisted(() => ({
    actor: 'owner1', session: 'session1', authenticated: true, loading: false,
    snapshot: null as unknown, run: vi.fn(), queries: [] as string[], mutations: [] as string[],
}));
// Reuse the existing matched React/renderer pair; no web dependency installation.
vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: state.actor, sessionId: state.session }) }));
vi.mock('convex/react', () => ({
    useConvexAuth: () => ({ isAuthenticated: state.authenticated, isLoading: state.loading }),
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) => { state.queries.push(getFunctionName(reference)); return state.snapshot; },
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => { state.mutations.push(getFunctionName(reference)); return state.run; },
}));
vi.mock('../../components/r1', async () => {
    const { createElement: element } = await import('react');
    return {
        Button: ({ children, variant: _variant, ...props }: { children: ReactNode; variant?: string }) => element('button', props, children),
        Field: ({ label, help, children }: { label: string; help?: string; children: ReactNode }) => element('label', {}, label, children, help),
        Input: (props: Record<string, unknown>) => element('input', props),
        Dialog: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) =>
            open ? element('dialog', { open: true, 'aria-label': title }, children, footer) : null,
        ConfirmDialog: ({ open, title, children, onCancel, onConfirm, confirmLabel, cancelLabel, busy }: {
            open: boolean; title: string; children: ReactNode; onCancel: () => void; onConfirm: () => void;
            confirmLabel: string; cancelLabel: string; busy: boolean;
        }) => open ? element('dialog', { open: true, 'aria-label': title }, children,
            element('button', { onClick: onCancel, disabled: busy }, cancelLabel),
            element('button', { onClick: onConfirm, disabled: busy }, confirmLabel)) : null,
    };
});

import { OwnerPaymentSimulator } from '../../app/my-business/_components/OwnerPaymentSimulator';

type Snapshot = NonNullable<FunctionReturnType<typeof api.paymentSimulator.get>>;
type TestNode = { props: { children?: unknown; disabled?: boolean; onClick?: () => void; onChange?: (event: { target: { value: string } }) => void } };
type View = { root: { findAllByType(type: string): TestNode[] }; update(node: ReactNode): void; unmount(): void; toJSON(): unknown };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
const id = 'submission1' as Id<'submissions'>;
const now = 1_800_000_000_000;
const snapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
    simulationOnly: true, withdrawable: false, actorClerkId: 'owner1', ownerId: 'owner1' as Id<'businessOwners'>,
    submissionId: id, businessName: '[TEST] Corner shop', sessionId: null, currency: 'PHP', total: 4999,
    amountPaid: 0, balanceDue: 4999, minDeposit: 500, revision: 0, attempt: 1, referenceCode: 'SIM-NOT-STARTED',
    paymentStatus: 'unpaid', requestStatus: 'open', reviewStatus: 'none', pendingReview: null, lastReceiptId: null,
    priceChanged: false, canReset: true, events: [], ...overrides,
});
const event = (message: string, action: Snapshot['events'][number]['action'] = 'full'): Snapshot['events'][number] => ({
    id: 'event1', action, outcome: 'applied', amount: 4999, createdAt: now, message,
});
let view: View | undefined;
const text = () => JSON.stringify(view?.toJSON());
function button(label: string) {
    const found = view!.root.findAllByType('button').find(node => node.props.children === label);
    if (!found) throw new Error(`Missing button ${label}`);
    return found;
}
async function click(label: string) {
    await act(async () => { const node = button(label); expect(node.props.disabled).not.toBe(true); node.props.onClick!(); });
}
async function render(submissionId = id) {
    await act(async () => {
        const node = createElement(OwnerPaymentSimulator, { submissionId });
        if (view) view.update(node); else view = renderer.create(node);
    });
}
async function open() { await render(); await click('Open payment simulator'); }

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://diligent-ibex-454.convex.cloud');
    vi.clearAllMocks(); state.actor = 'owner1'; state.session = 'session1'; state.authenticated = true; state.loading = false;
    state.snapshot = snapshot(); state.queries = []; state.mutations = [];
    state.run.mockImplementation(async () => state.snapshot);
});
afterEach(async () => { if (view) await act(async () => view!.unmount()); view = undefined; vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('owner web payment simulator', () => {
    it('does not query the undeployed simulator module on a production or unconfigured backend', async () => {
        for (const origin of ['https://energetic-panther-693.convex.cloud', '']) {
            vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', origin); await render(); expect(view!.toJSON()).toBeNull();
        }
        expect(state.queries).toHaveLength(0); expect(state.mutations).toHaveLength(0);
    });

    it('hides the entry unless the authoritative snapshot belongs to this authenticated actor and business', async () => {
        for (const value of [null, undefined, snapshot({ actorClerkId: 'another-owner' }), snapshot({ submissionId: 'other' as Id<'submissions'> })]) {
            state.snapshot = value; await render(); expect(view!.toJSON()).toBeNull();
        }
        state.authenticated = false; await render(); expect(view!.toJSON()).toBeNull();
        expect(state.run).not.toHaveBeenCalled();
    });

    it('clearly separates test amounts from real payments, publication and payouts', async () => {
        await open();
        expect(text()).toContain('Test only — no real money.');
        expect(text()).toContain('No payouts, publication, domain changes or emails.');
        expect(text()).toContain('Simulated balance'); expect(text()).toContain('Simulated status');
        expect(state.queries.every(name => name === 'paymentSimulator:get')).toBe(true);
        expect(state.mutations.every(name => name === 'paymentSimulator:run')).toBe(true);
    });

    it.each([
        ['Simulate full payment', 'full', {}, undefined],
        ['Simulate down payment', 'deposit', {}, 500],
        ['Simulate remaining balance', 'balance', { amountPaid: 500, balanceDue: 4499, paymentStatus: 'deposit_paid' }, undefined],
    ] as const)('scopes %s to the server revision and current quote', async (label, action, overrides, amount) => {
        state.snapshot = snapshot(overrides); await open(); await click(label);
        expect(state.run).toHaveBeenCalledExactlyOnceWith({ submissionId: id, action, requestId: expect.stringMatching(/^web_[a-zA-Z0-9_-]+$/),
            expectedRevision: 0, expectedTotal: 4999, ...(amount === undefined ? {} : { amount }) });
    });

    it('requires a whole-PHP down payment and sends the edited amount', async () => {
        await open();
        const change = async (value: string) => act(async () => view!.root.findAllByType('input')[0].props.onChange!({ target: { value } }));
        await change('500.5'); expect(button('Simulate down payment').props.disabled).toBe(true);
        await change('875'); await click('Simulate down payment');
        expect(state.run.mock.calls[0][0].amount).toBe(875);
    });

    it('leaves an unmatched receipt uncredited until simulated team confirmation', async () => {
        state.run.mockImplementationOnce(async () => {
            state.snapshot = snapshot({ revision: 1, reviewStatus: 'needs_review', pendingReview: { receiptId: 'receipt1', amount: 4999, kind: 'full' } });
            return state.snapshot;
        });
        await open(); await click('Simulate unmatched receipt');
        expect(state.run.mock.calls[0][0]).toMatchObject({ action: 'unmatched', amount: 4999 });
        expect(text()).toContain('It has not been credited.');
        expect(button('Simulate full payment').props.disabled).toBe(true);
        await click('Confirm test receipt');
        expect(state.run.mock.calls[1][0]).toMatchObject({ action: 'approve_review', expectedRevision: 1 });
    });

    it('renews an expired test request without dropping its simulated deposit', async () => {
        state.snapshot = snapshot({ revision: 3, amountPaid: 500, balanceDue: 4499, paymentStatus: 'deposit_paid', requestStatus: 'expired' });
        state.run.mockImplementationOnce(async () => {
            state.snapshot = snapshot({ revision: 4, attempt: 2, amountPaid: 500, balanceDue: 4499, paymentStatus: 'deposit_paid' });
            return state.snapshot;
        });
        await open(); await click('Pay again (test)');
        expect(state.run.mock.calls[0][0]).toMatchObject({ action: 'renew', expectedRevision: 3 });
        expect(text()).toContain('Down payment recorded'); expect(text()).toContain('₱4,499.00');
        expect(button('Simulate remaining balance').props.disabled).toBe(false);
    });

    it('offers Pay again after explicitly expiring the isolated checkout', async () => {
        state.run.mockImplementationOnce(async () => {
            state.snapshot = snapshot({ revision: 1, requestStatus: 'expired' }); return state.snapshot;
        });
        await open(); await click('Expire test checkout');
        expect(state.run.mock.calls[0][0]).toMatchObject({ action: 'expire' });
        expect(text()).toContain('Test checkout expired'); await click('Pay again (test)');
        expect(state.run.mock.calls[1][0]).toMatchObject({ action: 'renew', expectedRevision: 1 });
    });

    it('offers duplicate receipt replay without crediting money on the client', async () => {
        state.snapshot = snapshot({ amountPaid: 4999, balanceDue: 0, paymentStatus: 'paid', requestStatus: 'paid', lastReceiptId: 'receipt1' });
        state.run.mockImplementationOnce(async () => {
            state.snapshot = snapshot({ amountPaid: 4999, balanceDue: 0, paymentStatus: 'paid', requestStatus: 'paid', lastReceiptId: 'receipt1',
                events: [event('Duplicate simulated receipt ignored. No second credit.', 'duplicate')] });
            return state.snapshot;
        });
        await open(); await click('Replay last test receipt');
        expect(state.run.mock.calls[0][0]).toMatchObject({ action: 'duplicate' });
        expect(text()).toContain('No second credit.'); expect(text()).toContain('Simulated paid');
    });

    it('asks before restarting simulated payments and makes reset the only action after price drift', async () => {
        state.snapshot = snapshot({ priceChanged: true }); await open();
        expect(button('Simulate full payment').props.disabled).toBe(true);
        expect(button('Expire test checkout').props.disabled).toBe(true);
        await click('Reset test'); expect(state.run).not.toHaveBeenCalled();
        expect(text()).toContain('Real payments and business status stay unchanged.');
        await click('Reset simulated payments');
        expect(state.run.mock.calls[0][0]).toMatchObject({ action: 'reset' });
    });

    it('keeps reset available after a practice-limit error and displays the clean server message', async () => {
        state.run.mockRejectedValueOnce(new ConvexError('Practice limit reached. Reset this test.'));
        await open(); await click('Simulate full payment');
        expect(text()).toContain('Practice limit reached. Reset this test.');
        await click('Reset test'); await click('Reset simulated payments');
        expect(state.run.mock.calls[1][0]).toMatchObject({ action: 'reset' });
    });

    it('deduplicates rapid test actions while one request is pending', async () => {
        let finish!: (value: Snapshot) => void;
        state.run.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })); await open();
        const press = button('Simulate full payment').props.onClick!;
        await act(async () => { press(); press(); }); expect(state.run).toHaveBeenCalledTimes(1);
        expect(text()).toContain('Applying test step');
        await act(async () => finish(snapshot()));
    });

    it.each(['account', 'session', 'business'] as const)('discards a pending completion when the %s changes', async change => {
        let finish!: (value: Snapshot) => void;
        state.run.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })); await open(); await click('Simulate full payment');
        const nextId = change === 'business' ? 'submission2' as Id<'submissions'> : id;
        if (change === 'account') state.actor = 'owner2';
        if (change === 'session') state.session = 'session2';
        state.snapshot = snapshot({ actorClerkId: state.actor, submissionId: nextId }); await render(nextId);
        await act(async () => finish(snapshot({ events: [event('OLD COMPLETION MUST NOT APPEAR')] })));
        expect(text()).not.toContain('OLD COMPLETION'); expect(view!.root.findAllByType('dialog')).toHaveLength(0);
    });

    it('hides revoked eligibility even when an old operation finishes', async () => {
        let finish!: (value: Snapshot) => void;
        state.run.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })); await open(); await click('Simulate full payment');
        state.snapshot = null; await render();
        await act(async () => finish(snapshot({ events: [event('OLD COMPLETION')] })));
        expect(view!.toJSON()).toBeNull();
    });

    it.each(['revision', 'quote'] as const)('ignores an old completion after the server %s changes', async change => {
        let finish!: (value: Snapshot) => void;
        state.run.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })); await open(); await click('Simulate full payment');
        state.snapshot = change === 'revision' ? snapshot({ revision: 5 }) : snapshot({ total: 3999, balanceDue: 3999 });
        await render();
        await act(async () => finish(snapshot({ revision: 1, events: [event('OLD COMPLETION MUST NOT APPEAR')] })));
        expect(text()).not.toContain('OLD COMPLETION');
    });
});
