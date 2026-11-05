import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerWebScope } from '../../hooks/useOwnerWebScope';
import type { OwnerSite } from '../../app/my-business/_components/ownerSite';
import type { OwnerVisit } from '../../app/my-business/visits/_components/visitPresentation';

const state = vi.hoisted(() => ({ scope: {} as OwnerWebScope, current: true, data: {} as Record<string, unknown>, queries: [] as Array<{ name: string; args: unknown }>, mutation: vi.fn(), replace: vi.fn() }));
vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('next/link', async () => {
    const { createElement: element } = await import('react');
    return { default: ({ children, ...props }: { children: ReactNode }) => element('a', props, children) };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock('next/dynamic', async () => {
    const { createElement: element } = await import('react');
    return { default: () => (props: { value: unknown; onChange: (point: { lat: number; lng: number }) => void; requiredPin?: boolean; disabled?: boolean }) => element('button', {
        'data-map': true, type: 'button', 'data-required-pin': props.requiredPin, disabled: props.disabled,
        onClick: () => props.onChange({ lat: 14.5, lng: 121 }),
    }, 'Choose pin') };
});
vi.mock('../../hooks/useOwnerWebScope', () => ({ useOwnerWebScope: () => state.scope }));
vi.mock('convex/react', () => ({
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference); state.queries.push({ name, args });
        return args === 'skip' ? undefined : state.data[name];
    },
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) => state.mutation(getFunctionName(reference), args),
}));
vi.mock('../../components/shells/OwnerShell', async () => {
    const { createElement: element } = await import('react');
    return {
        OwnerShell: ({ children }: { children: ReactNode }) => element('main', {}, children),
        OwnerPageHeader: ({ title }: { title: string }) => element('h1', {}, title),
    };
});
vi.mock('../../app/my-business/_components/OwnerSectionBoundary', async () => {
    const { createElement: element } = await import('react');
    return { OwnerSectionBoundary: ({ children }: { children: ReactNode }) => element('div', {}, children) };
});
vi.mock('../../components/r1', async () => {
    const { createElement: element } = await import('react');
    return {
        Field: ({ children, label, error }: { children: ReactNode; label: string; error?: string }) => element('label', {}, label, children, error),
        Input: (props: Record<string, unknown>) => element('input', props),
        Loading: ({ label }: { label: string }) => element('p', { role: 'status' }, label),
        ConfirmDialog: ({ open, onConfirm, onCancel, children, busy }: { open: boolean; onConfirm: () => void; onCancel: () => void; children: ReactNode; busy?: boolean }) => open ? element('section', { 'data-confirmation': true }, children,
            element('button', { 'data-confirm': true, onClick: onConfirm, disabled: busy }, 'Confirm cancellation'),
            element('button', { onClick: onCancel, disabled: busy }, 'Keep visit')) : null,
    };
});

import { OwnerVisitsView, OwnerVisitDetailsView } from '../../app/my-business/visits/_components/OwnerVisits';
import { OwnerVisitsPage, OwnerVisitDetailsPage } from '../../app/my-business/visits/_components/OwnerVisitPages';
import { OwnerVisitRequestPage } from '../../app/my-business/visits/_components/OwnerVisitRequestForm';
import { selectedVisitBusiness, validVisitPhone, validVisitPin, visitDraftErrors, visitSchedule, visitStatusLabel, type VisitDraft } from '../../app/my-business/visits/_components/visitPresentation';

type TestNode = { props: Record<string, unknown>; children: Array<TestNode | string>; findAllByProps(props: Record<string, unknown>): TestNode[] };
type View = { root: TestNode & { findAllByType(type: string): TestNode[] }; update(node: ReactNode): void; unmount(): void; toJSON(): unknown };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
const views: View[] = [];
async function mount(node: ReactNode) { let view!: View; await act(async () => { view = renderer.create(node); }); views.push(view); return view; }
const text = (view: View) => JSON.stringify(view.toJSON());
const bodyOf = (node: TestNode): string => node.children.map(child => typeof child === 'string' ? child : bodyOf(child)).join('');
const button = (view: View, title: string) => view.root.findAllByType('button').find(node => bodyOf(node).trim() === title)!;
const call = (node: TestNode, name: string, arg?: unknown) => (node.props[name] as (value?: unknown) => void)(arg);

function site(): OwnerSite {
    return { submissionId: 'business-one' as OwnerSite['submissionId'], businessName: 'Owned Bakery', businessType: 'bakery', contentSource: 'owner_app',
        publishPolicy: 'pay_then_publish', status: 'draft', phase: 'draft', publishedUrl: null, total: 4999, amountPaid: 0,
        balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: 1 };
}
function visit(overrides: Partial<OwnerVisit> = {}): OwnerVisit {
    return { _id: 'visit-one' as OwnerVisit['_id'], _creationTime: 1, ownerId: 'owner-one' as OwnerVisit['ownerId'], actorClerkId: 'owner-user',
        requestKey: 'stable-request-key', shopName: 'Owned Bakery', ownerName: 'Alex Santos', phone: '+639171234567', email: 'alex@example.test',
        address: '123 Main Street', city: 'Marikina', coordinates: { lat: 14.5, lng: 121 }, preferredWhen: 'Tomorrow',
        status: 'requested', revision: 2, createdAt: 1, updatedAt: 2, assignedAgent: null, ...overrides };
}
function ready(key = 'owner-user:session-one:owner-one'): OwnerWebScope {
    return { owner: { _id: 'owner-one', clerkId: 'owner-user', name: 'Alex Santos', email: 'alex@example.test', phone: '09171234567' } as OwnerWebScope['owner'],
        sites: [site()], userId: 'owner-user', sessionId: 'session-one', scopeKey: key, ready: true, loading: false, error: null,
        isSignedIn: true, isOwner: true, isCurrent: () => state.current && state.scope.scopeKey === key && state.scope.ready };
}
const validDraft = (): VisitDraft => ({ shopName: 'Corner Store', address: '123 Main Street', city: 'Marikina', phone: '09171234567', coordinates: { lat: 14.5, lng: 121 }, preferredWhen: 'Today' });
async function completeNewForm(view: View) {
    const input = (key: string, value: string) => view.root.findAllByType('input').find(node => node.props[key] === value)!;
    await act(async () => {
        call(input('autoComplete', 'organization'), 'onChange', { target: { value: 'New Corner Store' } });
        call(input('autoComplete', 'street-address'), 'onChange', { target: { value: '123 Main Street' } });
        call(input('autoComplete', 'address-level2'), 'onChange', { target: { value: 'Marikina' } });
        call(view.root.findAllByProps({ 'data-map': true })[0], 'onClick');
    });
}
async function submit(view: View) { await act(async () => { call(view.root.findAllByType('form')[0], 'onSubmit', { preventDefault: vi.fn() }); }); }

beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    state.current = true; state.scope = ready(); state.queries = [];
    state.data = { 'visitRequests:listMine': { actorClerkId: 'owner-user', ownerId: 'owner-one', requests: [visit()] }, 'visitRequests:getMine': visit() };
    state.mutation.mockReset().mockResolvedValue(visit()); state.replace.mockReset();
    vi.stubGlobal('navigator', { onLine: true }); vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'one-stable-request-key') });
});
afterEach(async () => { for (const view of views.splice(0)) await act(async () => view.unmount()); vi.unstubAllGlobals(); });

describe('owner visit validation and matching', () => {
    it('leaves a new shop unassociated and matches only an explicitly owned business', () => {
        expect(selectedVisitBusiness([site()], undefined)).toBeNull();
        expect(selectedVisitBusiness([site()], 'another-business')).toBeNull();
        expect(selectedVisitBusiness([site()], 'business-one')?.businessName).toBe('Owned Bakery');
    });
    it.each([{ lat: 3.9, lng: 121 }, { lat: 23, lng: 121 }, { lat: 14, lng: 115 }, { lat: 14, lng: 128 }, { lat: NaN, lng: 121 }, { lat: 14, lng: Infinity }])('rejects invalid Philippine coordinates %j', point => expect(validVisitPin(point)).toBe(false));
    it.each(['09171234567', '+63 917 123 4567', '9171234567'])('accepts native-compatible phone %s', phone => expect(validVisitPhone(phone)).toBe(true));
    it.each(['123', '+1 212 555 1234', '091712345678'])('rejects invalid phone %s', phone => expect(validVisitPhone(phone)).toBe(false));
    it('requires a shop name, street, city, Philippine phone and confirmed pin', () => {
        expect(visitDraftErrors(validDraft())).toEqual({});
        expect(Object.keys(visitDraftErrors({ ...validDraft(), shopName: ' ', address: 'x', city: 'x', phone: '', coordinates: null }))).toEqual(['shopName', 'address', 'city', 'coordinates', 'phone']);
        expect(visitDraftErrors({ ...validDraft(), shopName: 'x'.repeat(121), address: 'x'.repeat(301), city: 'x'.repeat(121) })).toMatchObject({ shopName: expect.any(String), address: expect.any(String), city: expect.any(String) });
    });
    it('uses the same owner-facing statuses and explicit Philippine time', () => {
        expect(['requested', 'assigned', 'confirmed', 'completed', 'cancelled'].map(status => visitStatusLabel(status as OwnerVisit['status']))).toEqual(['Request received', 'Awaiting acceptance', 'Visit confirmed', 'Visit completed', 'Cancelled']);
        expect(visitSchedule(Date.parse('2026-11-03T01:00:00Z'))).toContain('9:00');
        expect(visitSchedule(Date.parse('2026-11-03T01:00:00Z'))).toContain('Philippine time');
        expect(visitSchedule(NaN)).toBe('Time not set yet');
    });
});

describe('owner visit reads and preview presentation', () => {
    it.each([{ ready: false, loading: true }, { ready: false, isSignedIn: false }, { ready: false, isOwner: false }])('skips private queries when scope is unavailable %j', async change => {
        state.scope = { ...ready(), ...change };
        const view = await mount(createElement(OwnerVisitsPage));
        expect(state.queries.every(query => query.args === 'skip')).toBe(true);
        expect(text(view)).not.toContain('Owned Bakery');
    });
    it('rejects another actor or owner result instead of exposing their requests', async () => {
        state.data['visitRequests:listMine'] = { actorClerkId: 'other-user', ownerId: 'other-owner', requests: [visit({ shopName: 'Private other shop' })] };
        const view = await mount(createElement(OwnerVisitsPage));
        expect(text(view)).not.toContain('Private other shop'); expect(text(view)).toContain('unavailable for this account');
    });
    it('keeps loading distinct from an empty authoritative list', async () => {
        state.data['visitRequests:listMine'] = undefined;
        const view = await mount(createElement(OwnerVisitsPage));
        expect(text(view)).toContain('Loading visit requests'); expect(text(view)).not.toContain('No visit requests yet');
        state.data['visitRequests:listMine'] = { actorClerkId: 'owner-user', ownerId: 'owner-one', requests: [] };
        await act(async () => view.update(createElement(OwnerVisitsPage)));
        expect(text(view)).toContain('No visit requests yet');
    });
    it('filters a stale foreign-owner row from an otherwise matching envelope', async () => {
        state.data['visitRequests:listMine'] = { actorClerkId: 'owner-user', ownerId: 'owner-one', requests: [visit(), visit({ _id: 'other' as OwnerVisit['_id'], ownerId: 'other-owner' as OwnerVisit['ownerId'], shopName: 'Foreign shop' })] };
        const view = await mount(createElement(OwnerVisitsPage));
        expect(text(view)).toContain('Owned Bakery'); expect(text(view)).not.toContain('Foreign shop');
    });
    it('renders sample requests without reads, writes or outbound contact links', async () => {
        const request = visit({ status: 'assigned', assignedAgent: { id: 'agent' as NonNullable<OwnerVisit['assignedAgent']>['id'], name: 'Sam Reyes', phone: '09171234567', profileImage: null } });
        const view = await mount(createElement('div', {}, createElement(OwnerVisitsView, { requests: [request], preview: true, hrefForVisit: id => `/admin/preview/owner?visit=${id}` }), createElement(OwnerVisitDetailsView, { request, preview: true })));
        expect(state.queries).toEqual([]); expect(state.mutation).not.toHaveBeenCalled();
        expect(view.root.findAllByType('a').map(node => node.props.href)).toEqual(['/admin/preview/owner?visit=visit-one', '/admin/preview/owner?visit=visit-one']);
        for (const title of ['Request a visit', 'Call field agent', 'View directions', 'Cancel visit']) expect(button(view, title).props.disabled).toBe(true);
    });
});

describe('owner visit request writes', () => {
    it('starts a new-shop request blank despite having another selected business', async () => {
        const view = await mount(createElement(OwnerVisitRequestPage));
        expect(view.root.findAllByType('input').find(node => node.props.autoComplete === 'organization')?.props.value).toBe('');
        expect(view.root.findAllByProps({ 'data-map': true })[0].props['data-required-pin']).toBe(true);
        expect(state.mutation).not.toHaveBeenCalled();
    });
    it('prefills only an explicitly owned submission and rejects a foreign selection', async () => {
        const owned = await mount(createElement(OwnerVisitRequestPage, { submissionId: 'business-one' }));
        expect(owned.root.findAllByType('input').find(node => node.props.autoComplete === 'organization')?.props.value).toBe('Owned Bakery');
        const foreign = await mount(createElement(OwnerVisitRequestPage, { submissionId: 'not-owned' }));
        expect(foreign.root.findAllByType('form')).toHaveLength(0); expect(text(foreign)).toContain('not linked to your owner account');
    });
    it('does not submit invalid input, including a missing map pin', async () => {
        const view = await mount(createElement(OwnerVisitRequestPage)); await submit(view);
        expect(state.mutation).not.toHaveBeenCalled();
    });
    it('retries with one idempotency key and sends authenticated contact identity', async () => {
        state.mutation.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(visit());
        const view = await mount(createElement(OwnerVisitRequestPage)); await completeNewForm(view); await submit(view); await submit(view);
        expect(state.mutation).toHaveBeenCalledTimes(2);
        const first = state.mutation.mock.calls[0][1], second = state.mutation.mock.calls[1][1];
        expect(first).toMatchObject({ clerkId: 'owner-user', ownerName: 'Alex Santos', email: 'alex@example.test', phone: '09171234567', shopName: 'New Corner Store', city: 'Marikina', coordinates: { lat: 14.5, lng: 121 }, preferredWhen: 'Today' });
        expect(first).not.toHaveProperty('submissionId'); expect(first.requestKey).toBe(second.requestKey);
        expect(state.replace).toHaveBeenCalledWith('/my-business/visits/visit-one');
    });
    it('locks submitted details after a lost response and retries the exact payload without disabling retry', async () => {
        state.mutation.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(visit());
        const view = await mount(createElement(OwnerVisitRequestPage)); await completeNewForm(view); await submit(view);
        const first = structuredClone(state.mutation.mock.calls[0][1]);
        for (const input of view.root.findAllByType('input').filter(node => node.props.type !== 'radio')) expect(input.props.disabled).toBe(true);
        expect(view.root.findAllByType('fieldset')[0].props.disabled).toBe(true);
        expect(view.root.findAllByProps({ 'data-map': true })[0].props.disabled).toBe(true);
        expect(button(view, 'Retry same request').props.disabled).toBe(false);
        expect(text(view)).toContain('These details are locked for this attempt');
        expect(view.root.findAllByType('a').some(node => node.props.href === '/my-business/visits' && bodyOf(node).includes('Check visit requests'))).toBe(true);
        await act(async () => {
            for (const input of view.root.findAllByType('input').filter(node => node.props.type !== 'radio')) call(input, 'onChange', { target: { value: 'Changed after submission' } });
            call(view.root.findAllByType('input').find(node => node.props.type === 'radio' && node.props.value === 'Tomorrow')!, 'onChange');
            call(view.root.findAllByProps({ 'data-map': true })[0], 'onClick');
        });
        expect(view.root.findAllByType('input').find(node => node.props.autoComplete === 'organization')?.props.value).toBe(first.shopName);
        expect(view.root.findAllByType('input').find(node => node.props.type === 'radio' && node.props.value === 'Today')?.props.checked).toBe(true);
        await submit(view);
        expect(state.mutation).toHaveBeenCalledTimes(2);
        expect(state.mutation.mock.calls[1][1]).toEqual(first);
        expect(state.replace).toHaveBeenCalledWith('/my-business/visits/visit-one');
    });
    it('blocks double submission synchronously', async () => {
        let resolve!: (value: OwnerVisit) => void;
        state.mutation.mockImplementation(() => new Promise<OwnerVisit>(done => { resolve = done; }));
        const view = await mount(createElement(OwnerVisitRequestPage)); await completeNewForm(view);
        await act(async () => { const form = view.root.findAllByType('form')[0]; call(form, 'onSubmit', { preventDefault: vi.fn() }); call(form, 'onSubmit', { preventDefault: vi.fn() }); });
        expect(state.mutation).toHaveBeenCalledTimes(1);
        await act(async () => resolve(visit()));
    });
    it('ignores a late request completion after the owner session changes', async () => {
        let resolve!: (value: OwnerVisit) => void;
        state.mutation.mockImplementation(() => new Promise<OwnerVisit>(done => { resolve = done; }));
        const view = await mount(createElement(OwnerVisitRequestPage)); await completeNewForm(view); await submit(view);
        state.scope = { ...ready('owner-user:session-two:owner-one'), sessionId: 'session-two' };
        await act(async () => view.update(createElement(OwnerVisitRequestPage)));
        await act(async () => resolve(visit()));
        expect(state.replace).not.toHaveBeenCalled();
    });
    it('does not navigate on a mismatched server actor or owner', async () => {
        state.mutation.mockResolvedValue(visit({ actorClerkId: 'other-user' }));
        const view = await mount(createElement(OwnerVisitRequestPage)); await completeNewForm(view); await submit(view);
        expect(state.replace).not.toHaveBeenCalled(); expect(text(view)).toContain('Your account changed');
    });
    it('blocks writes while offline', async () => {
        vi.stubGlobal('navigator', { onLine: false });
        const view = await mount(createElement(OwnerVisitRequestPage)); await completeNewForm(view); await submit(view);
        expect(state.mutation).not.toHaveBeenCalled(); expect(text(view)).toContain('Reconnect to send');
    });
});

describe('owner visit cancellation', () => {
    it('requires confirmation and sends the exact current revision', async () => {
        const view = await mount(createElement(OwnerVisitDetailsPage, { visitId: 'visit-one' }));
        await act(async () => call(button(view, 'Cancel visit'), 'onClick'));
        expect(state.mutation).not.toHaveBeenCalled();
        await act(async () => call(view.root.findAllByProps({ 'data-confirm': true })[0], 'onClick'));
        expect(state.mutation).toHaveBeenCalledWith('visitRequests:cancel', { id: 'visit-one', clerkId: 'owner-user', expectedRevision: 2 });
        expect(text(view)).toContain('Your visit was cancelled');
    });
    it('rejects a stale confirmation after the request changes', async () => {
        const view = await mount(createElement(OwnerVisitDetailsPage, { visitId: 'visit-one' }));
        await act(async () => call(button(view, 'Cancel visit'), 'onClick'));
        state.data['visitRequests:getMine'] = visit({ revision: 3, status: 'assigned' });
        await act(async () => view.update(createElement(OwnerVisitDetailsPage, { visitId: 'visit-one' })));
        await act(async () => call(view.root.findAllByProps({ 'data-confirm': true })[0], 'onClick'));
        expect(state.mutation).not.toHaveBeenCalled(); expect(text(view)).toContain('This visit changed');
    });
    it('does not reveal or cancel another owner’s request', async () => {
        state.data['visitRequests:getMine'] = visit({ ownerId: 'other-owner' as OwnerVisit['ownerId'], shopName: 'Private shop' });
        const view = await mount(createElement(OwnerVisitDetailsPage, { visitId: 'visit-one' }));
        expect(text(view)).not.toContain('Private shop'); expect(view.root.findAllByProps({ 'data-confirm': true })).toHaveLength(0); expect(state.mutation).not.toHaveBeenCalled();
    });
});
