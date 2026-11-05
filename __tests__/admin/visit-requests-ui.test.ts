import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import type { AdminVisit, VisitAgent } from '../../app/admin/visits/_components/visitAdmin';

const state = vi.hoisted(() => ({
    actor: 'admin-one', session: 'session-one', admin: true, loading: false, authenticated: true, convexLoading: false,
    requestsActor: 'admin-one', agentsActor: 'admin-one', requestsLoading: false, agentsLoading: false, search: '',
    requests: [] as unknown[], agents: [] as unknown[], assign: vi.fn(), cancel: vi.fn(),
    queries: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));
vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: state.actor, sessionId: state.session }) }));
vi.mock('../../hooks/useAdmin', () => ({ useAdminAuth: () => ({ isAdmin: state.admin, loading: state.loading }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock('convex/react', () => ({
    useConvexAuth: () => ({ isAuthenticated: state.authenticated, isLoading: state.convexLoading }),
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: Record<string, unknown>) => {
        const name = getFunctionName(reference); state.queries.push({ name, args });
        if (name === 'visitRequests:listAdmin') return state.requestsLoading ? undefined : { actorClerkId: state.requestsActor,
            requests: (state.requests as AdminVisit[]).filter(visit => !args.status || visit.status === args.status) };
        if (name === 'visitRequests:listAssignableAgents') return state.agentsLoading ? undefined : { actorClerkId: state.agentsActor, agents: state.agents };
        throw new Error(`Unexpected visit query ${name}`);
    },
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
        const name = getFunctionName(reference);
        if (name === 'visitRequests:assign') return state.assign;
        if (name === 'visitRequests:cancel') return state.cancel;
        throw new Error(`Unexpected visit mutation ${name}`);
    },
}));
vi.mock('../../app/admin/components/AdminLayout', async () => {
    const { createElement: element } = await import('react');
    return { default: ({ children }: { children: ReactNode }) => element('main', { 'data-admin-shell': true }, children) };
});
vi.mock('../../app/admin/_components/PanelBoundary', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../components/r1', async () => {
    const { createElement: element } = await import('react');
    return {
        PageHeader: ({ title, sub }: { title: string; sub: string }) => element('header', {}, element('h1', {}, title), element('p', {}, sub)),
        EmptyState: ({ title, body }: { title: string; body: string }) => element('section', {}, element('h2', {}, title), element('p', {}, body)),
        Loading: ({ label, children }: { label: string; children: ReactNode }) => element('div', { role: 'status', 'aria-label': label }, children),
        SkeletonRows: () => element('div', {}, 'Loading shapes'),
        Status: ({ word }: { word: string }) => element('span', {}, word),
        Button: ({ children, variant: _variant, size: _size, ...props }: { children: ReactNode; variant?: string; size?: string }) => { void _variant; void _size; return element('button', props, children); },
        Field: ({ label, children, help }: { label: string; children: ReactNode; help?: string }) => element('fieldset', { 'data-field': label }, element('legend', {}, label), children, help),
        Input: (props: Record<string, unknown>) => element('input', props),
        Select: ({ children, ...props }: { children: ReactNode }) => element('select', props, children),
        Textarea: (props: Record<string, unknown>) => element('textarea', props),
        Drawer: ({ open, title, children, footer, onClose }: { open: boolean; title: string; children: ReactNode; footer: ReactNode; onClose: () => void }) => open
            ? element('dialog', { open: true, 'data-dialog': 'details' }, element('h2', {}, title), element('button', { onClick: onClose }, 'Close visit details'), children, footer) : null,
        ConfirmDialog: ({ open, title, children, onCancel, onConfirm, confirmLabel, cancelLabel, busy }: {
            open: boolean; title: string; children: ReactNode; onCancel: () => void; onConfirm: () => void; confirmLabel: string; cancelLabel: string; busy: boolean;
        }) => open ? element('dialog', { open: true, 'data-dialog': 'confirmation' }, element('h2', {}, title), children,
            element('button', { onClick: onCancel, disabled: busy }, cancelLabel), element('button', { onClick: onConfirm, disabled: busy }, confirmLabel)) : null,
    };
});

import AdminVisitsPage from '../../app/admin/visits/page';
import { parsePhilippineSchedule, philippineInputValue } from '../../app/admin/visits/_components/visitAdmin';

type TestNode = { props: { children?: unknown; disabled?: boolean; value?: string; href?: string; onClick?: () => void;
    onChange?: (event: { target: { value: string } }) => void; [key: string]: unknown }; findAllByType(type: string): TestNode[] };
type View = { root: { findAllByType(type: string): TestNode[]; findAllByProps(props: Record<string, unknown>): TestNode[] }; update(node: ReactNode): void; unmount(): void; toJSON(): unknown };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode): View };
const NOW = Date.UTC(2026, 10, 3, 2);
const visitId = 'visit-one' as Id<'ownerVisitRequests'>;
const agentId = 'agent-one' as Id<'creators'>;
const agent = (overrides: Partial<VisitAgent> = {}): VisitAgent => ({ id: agentId, name: 'Mika Agent', email: 'mika@example.test', phone: '639181234567', workCity: 'Marikina', profileImage: null, ...overrides });
const visit = (overrides: Partial<AdminVisit> = {}): AdminVisit => ({
    _id: visitId, _creationTime: NOW - 86400000, ownerId: 'owner-one' as Id<'businessOwners'>, requestKey: 'visit_fixture_one',
    actorClerkId: 'admin-one', shopName: 'Corner shop', ownerName: 'Shop Owner', phone: '639171234567', email: 'owner@example.test',
    address: '12 Main Street', city: 'Marikina', coordinates: { lat: 14.6, lng: 121 }, preferredWhen: 'Wednesday morning',
    status: 'requested', assignedAgent: null, createdAt: NOW - 86400000, updatedAt: NOW - 86400000, revision: 4, ...overrides,
});
let view: View | undefined;
const text = () => JSON.stringify(view?.toJSON());
function button(label: string) {
    const found = view!.root.findAllByType('button').find(node => node.props.children === label);
    if (!found) throw new Error(`Missing button ${label}`); return found;
}
const hasButton = (label: string) => view!.root.findAllByType('button').some(node => node.props.children === label);
async function click(label: string) { await act(async () => { const found = button(label); expect(found.props.disabled).not.toBe(true); found.props.onClick!(); }); }
async function change(label: string, type: string, value: string) {
    await act(async () => { const field = view!.root.findAllByProps({ 'data-field': label })[0]; field.findAllByType(type)[0].props.onChange!({ target: { value } }); });
}
async function render() { await act(async () => { const node = createElement(AdminVisitsPage); if (view) view.update(node); else view = renderer.create(node); }); }
async function open() { await render(); await click('Corner shop'); }
async function fillAssignment() {
    await change('Field agent', 'select', agentId);
    await change('Visit date and time (Philippine time, UTC+8)', 'input', '2026-11-04T09:30');
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.spyOn(Date, 'now').mockReturnValue(NOW);
    state.actor = 'admin-one'; state.session = 'session-one'; state.admin = true; state.loading = false;
    state.authenticated = true; state.convexLoading = false; state.requestsActor = 'admin-one'; state.agentsActor = 'admin-one';
    state.requestsLoading = false; state.agentsLoading = false; state.search = ''; state.queries = [];
    state.requests = [visit()]; state.agents = [agent()];
    state.assign.mockReset().mockImplementation(async (args: { id: AdminVisit['_id']; agentId: VisitAgent['id']; scheduledAt: number; adminNote: string }) => {
        const before = (state.requests as AdminVisit[]).find(row => row._id === args.id)!;
        const chosen = (state.agents as VisitAgent[]).find(row => row.id === args.agentId)!;
        const result = { ...before, status: 'assigned' as const, assignedAgentId: chosen.id, scheduledAt: args.scheduledAt, adminNote: args.adminNote,
            assignedAgent: { id: chosen.id, name: chosen.name, phone: chosen.phone, profileImage: chosen.profileImage }, revision: before.revision + 1 };
        state.requests = [result]; return result;
    });
    state.cancel.mockReset().mockImplementation(async (args: { reason: string }) => {
        const result = { ...(state.requests[0] as AdminVisit), status: 'cancelled' as const, cancellationReason: args.reason, cancelledAt: NOW, revision: 5 };
        state.requests = [result]; return result;
    });
});
afterEach(async () => { if (view) await act(async () => view!.unmount()); view = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('admin visit requests queue', () => {
    it('never starts protected visit queries for a non-admin', async () => {
        state.admin = false; await render(); expect(state.queries).toHaveLength(0);
        expect(text()).toContain('Admin access required'); expect(text()).not.toContain('Corner shop');
    });

    it('keeps the admin frame while auth or request data loads', async () => {
        state.loading = true; await render(); expect(state.queries).toHaveLength(0);
        expect(view!.root.findAllByProps({ 'data-admin-shell': true })).toHaveLength(1);
        state.loading = false; state.requestsLoading = true; await render();
        expect(view!.root.findAllByProps({ 'aria-label': 'Loading visit requests' })).toHaveLength(1);
        expect(view!.root.findAllByProps({ 'data-admin-shell': true })).toHaveLength(1);
    });

    it('suppresses a cached response from another authenticated actor', async () => {
        state.requestsActor = 'previous-admin'; await render();
        expect(text()).not.toContain('Corner shop'); expect(text()).not.toContain('owner@example.test');
        expect(text()).not.toContain('14.6'); expect(state.assign).not.toHaveBeenCalled();
    });

    it('shows the request, private contact details and a pin-based directions link in its drawer', async () => {
        await open(); expect(text()).toContain('Wednesday morning'); expect(text()).toContain('12 Main Street');
        expect(text()).toContain('owner@example.test'); expect(text()).toContain('Shop Owner');
        const anchors = view!.root.findAllByType('a');
        expect(anchors.some(node => node.props.href === 'https://www.google.com/maps/dir/?api=1&destination=14.6%2C121')).toBe(true);
        expect(anchors.some(node => node.props.href === 'tel:639171234567')).toBe(true);
        expect(anchors.some(node => node.props.href === 'mailto:owner%40example.test')).toBe(true);
        expect(view!.root.findAllByType('img')).toHaveLength(0);
    });

    it('passes the actor and selected status filter to the authoritative queue', async () => {
        await render(); await click('Awaiting acceptance');
        expect(state.queries).toContainEqual({ name: 'visitRequests:listAdmin', args: { clerkId: 'admin-one', status: 'assigned' } });
        expect(state.queries).toContainEqual({ name: 'visitRequests:listAssignableAgents', args: { clerkId: 'admin-one' } });
        expect(text()).toContain('No visits in this view');
    });

    it('assigns a certified agent using Philippine wall time and the current revision', async () => {
        await open(); await fillAssignment(); await change('Admin note (optional)', 'textarea', '  Bring a tripod.  '); await click('Assign visit');
        expect(state.assign).toHaveBeenCalledExactlyOnceWith({ id: visitId, agentId, scheduledAt: Date.UTC(2026, 10, 4, 1, 30),
            adminNote: 'Bring a tripod.', expectedRevision: 4, clerkId: 'admin-one' });
        expect(text()).toContain('Awaiting acceptance'); expect(text()).toContain('not confirmed yet');
    });

    it('prefills and updates an unaccepted assignment with the latest revision', async () => {
        const next = agent({ id: 'agent-two' as Id<'creators'>, name: 'Leo Agent', email: 'leo@example.test' });
        state.agents = [agent(), next];
        state.requests = [visit({ status: 'assigned', revision: 7, assignedAgentId: agentId,
            assignedAgent: { id: agentId, name: 'Mika Agent', phone: null, profileImage: null },
            scheduledAt: Date.UTC(2026, 10, 4, 1), adminNote: 'Arrive early.' })];
        await open();
        expect(view!.root.findAllByType('select')[0].props.value).toBe(agentId);
        expect(view!.root.findAllByType('input')[0].props.value).toBe('2026-11-04T09:00');
        await change('Field agent', 'select', next.id);
        await change('Visit date and time (Philippine time, UTC+8)', 'input', '2026-11-04T10:00');
        await click('Update assignment');
        expect(state.assign).toHaveBeenCalledExactlyOnceWith({ id: visitId, agentId: next.id, scheduledAt: Date.UTC(2026, 10, 4, 2),
            adminNote: 'Arrive early.', expectedRevision: 7, clerkId: 'admin-one' });
    });

    it('withholds cached or missing eligible agents instead of allowing arbitrary assignment', async () => {
        state.agentsActor = 'previous-admin'; await open();
        expect(text()).not.toContain('Mika Agent'); expect(button('Assign visit').props.disabled).toBe(true);
        state.agentsActor = 'admin-one'; state.agents = []; await render();
        expect(text()).toContain('No active certified field agents are available'); expect(button('Assign visit').props.disabled).toBe(true);
    });

    it.each(['2026-11-02T09:30', '2027-11-04T09:30', '2026-02-30T09:30'])('rejects an invalid or out-of-range proposed time %s before mutation', async schedule => {
        await open(); await fillAssignment(); await change('Visit date and time (Philippine time, UTC+8)', 'input', schedule); await click('Assign visit');
        expect(state.assign).not.toHaveBeenCalled(); expect(text()).toContain('Choose a valid future visit time within the next 365 days');
    });

    it('shows decline details and allows reassignment after an agent declines', async () => {
        state.requests = [visit({ declineReason: 'Outside my service area.' })]; await open();
        expect(text()).toContain('Needs reassignment'); expect(text()).toContain('Outside my service area.');
        expect(hasButton('Assign visit')).toBe(true);
    });

    it.each(['confirmed', 'completed', 'cancelled'] as const)('keeps %s visits out of the assignment form', async status => {
        state.requests = [visit({ status })]; await open();
        expect(hasButton('Assign visit')).toBe(false); expect(hasButton('Update assignment')).toBe(false);
        expect(hasButton('Cancel visit')).toBe(status === 'confirmed');
    });

    it('requires confirmation before revision-guarded cancellation', async () => {
        await open(); await click('Cancel visit'); expect(state.cancel).not.toHaveBeenCalled();
        await change('Cancellation reason (optional)', 'textarea', '  Owner requested another day.  '); await click('Cancel this visit');
        expect(state.cancel).toHaveBeenCalledExactlyOnceWith({ id: visitId, reason: 'Owner requested another day.', expectedRevision: 4, clerkId: 'admin-one' });
        expect(text()).toContain('Cancelled'); expect(text()).toContain('Owner requested another day.');
    });

    it('deduplicates rapid assignment taps while the mutation is pending', async () => {
        let finish!: (value: AdminVisit) => void; state.assign.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        await open(); await fillAssignment(); const press = button('Assign visit').props.onClick!;
        await act(async () => { press(); press(); }); expect(state.assign).toHaveBeenCalledTimes(1);
        await act(async () => finish(visit({ revision: 5, status: 'assigned' })));
    });

    it('rejects an old drawer callback after the request revision changes', async () => {
        await open(); await fillAssignment(); const oldPress = button('Assign visit').props.onClick!;
        state.requests = [visit({ revision: 5 })]; await render(); await act(async () => oldPress());
        expect(state.assign).not.toHaveBeenCalled(); expect(text()).toContain('This request changed. Review its latest details');
    });

    it.each(['account', 'session'] as const)('discards a pending mutation result when the %s changes', async scope => {
        let finish!: (value: AdminVisit) => void; state.assign.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        await open(); await fillAssignment(); await click('Assign visit');
        if (scope === 'account') state.actor = 'admin-two'; else state.session = 'session-two';
        state.requestsActor = state.actor; state.agentsActor = state.actor; state.requests = [visit({ actorClerkId: state.actor })]; await render();
        await act(async () => finish(visit({ status: 'assigned', revision: 5 })));
        expect(text()).not.toContain('was assigned. The agent must accept');
        expect(view!.root.findAllByProps({ 'data-dialog': 'details' })).toHaveLength(0);
    });

    it('does not overwrite newer visit state with a late assignment result', async () => {
        let finish!: (value: AdminVisit) => void; state.assign.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        await open(); await fillAssignment(); await click('Assign visit');
        state.requests = [visit({ status: 'confirmed', revision: 6 })]; await render();
        await act(async () => finish(visit({ status: 'assigned', revision: 5 })));
        expect(text()).not.toContain('was assigned. The agent must accept'); expect(text()).toContain('Confirmed');
    });

    it('does not replace another visit opened from a notification while an old assignment finishes', async () => {
        let finish!: (value: AdminVisit) => void; state.assign.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const other = visit({ _id: 'visit-two' as Id<'ownerVisitRequests'>, shopName: 'Other shop' });
        state.requests = [visit(), other]; await open(); await fillAssignment(); await click('Assign visit');
        state.search = 'open=visit-two'; await render();
        await act(async () => finish(visit({ status: 'assigned', revision: 5 })));
        const details = view!.root.findAllByProps({ 'data-dialog': 'details' })[0];
        expect(details.findAllByType('h2').some(node => node.props.children === 'Other shop')).toBe(true);
        expect(text()).not.toContain('was assigned. The agent must accept');
    });

    it('opens an authorized notification deep link without querying a guessed request ID', async () => {
        state.search = `open=${visitId}`; await render();
        expect(view!.root.findAllByProps({ 'data-dialog': 'details' })).toHaveLength(1);
        expect(state.queries.every(query => query.name === 'visitRequests:listAdmin' || query.name === 'visitRequests:listAssignableAgents')).toBe(true);
    });

    it('keeps cancellation errors visible inside the confirmation dialog', async () => {
        state.cancel.mockRejectedValueOnce(new ConvexError('This visit changed. Refresh and try again.'));
        await open(); await click('Cancel visit'); await click('Cancel this visit');
        const confirmation = view!.root.findAllByProps({ 'data-dialog': 'confirmation' })[0];
        expect(confirmation.findAllByType('p').some(node => node.props.role === 'alert' && String(node.props.children).includes('This visit changed.'))).toBe(true);
    });
});

describe('Philippine visit schedule conversion', () => {
    it('round-trips UTC+8 wall time independently of the workstation timezone and rejects normalized invalid dates', () => {
        const timestamp = parsePhilippineSchedule('2026-11-04T09:30');
        expect(timestamp).toBe(Date.UTC(2026, 10, 4, 1, 30));
        expect(philippineInputValue(timestamp!)).toBe('2026-11-04T09:30');
        expect(parsePhilippineSchedule('2026-02-30T09:30')).toBeNull();
        expect(parsePhilippineSchedule('2026-11-04T09:30Z')).toBeNull();
    });
});
