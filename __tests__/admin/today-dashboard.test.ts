import { createElement, type ComponentProps, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load, type CheerioAPI } from 'cheerio';
import { getFunctionName } from 'convex/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    actor: 'admin-one' as string | null,
    visitActor: 'admin-one',
    visits: [] as Array<{ _id: string; shopName: string; city: string }>,
    visitsLoading: false,
    submissions: [] as Array<Record<string, unknown>>,
    pendingAgents: [] as Array<{ firstName: string; lastName: string; quizPassedAt: number }> | undefined,
    failed: [] as Array<{ creatorName: string; amount: number; createdAt: number }>,
    queries: [] as Array<{ name: string; args: unknown }>,
    scheduleLoading: false,
    calendarError: null as string | null,
    calls: [] as Array<Record<string, unknown>>,
    unanswered: [] as Array<Record<string, unknown>>,
    write: vi.fn(),
    refresh: vi.fn(),
}));

const NOW = Date.UTC(2026, 10, 3, 18); // Nov 4, 2am in Manila; still Nov 3 in UTC.

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: state.actor }) }));
vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: ComponentProps<'a'> & { children?: ReactNode }) => createElement('a', { ...props, href }, children),
}));
vi.mock('convex/react', () => ({
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        const name = getFunctionName(reference);
        state.queries.push({ name, args });
        if (args === 'skip') return undefined;
        switch (name) {
            case 'submissions:getAllWithCreator': return state.submissions;
            case 'admin:checkBackfillNeeded': return false;
            case 'analytics:getAllAnalytics': return [];
            case 'domains:getTotalHostingerDomainCostsPHP': return 0;
            case 'admin:getPromoStats': return { compedCount: 0, compedPayoutTotal: 0 };
            case 'withdrawals:getByStatus': return (args as { status: string }).status === 'failed' ? state.failed : [];
            case 'creators:listPendingApproval': return state.pendingAgents;
            case 'visitRequests:listAdmin': return state.visitsLoading ? undefined : { actorClerkId: state.visitActor, requests: state.visits };
            case 'nativeBookings:getSlotConfig': return { windows: [[540, 1020]] };
            default: throw new Error(`Unexpected dashboard query: ${name}`);
        }
    },
    useMutation: () => state.write,
    useAction: () => state.write,
}));
vi.mock('@/hooks/useCallSchedule', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../hooks/useCallSchedule')>();
    return {
        ...actual,
        useNow: () => Date.UTC(2026, 10, 3, 18),
        useCallSchedule: () => ({
            upcoming: state.calls, needsAttendance: state.unanswered, calendarError: state.calendarError,
            loading: state.scheduleLoading, refresh: state.refresh, refreshing: false, lastRefreshed: null,
        }),
    };
});

import AdminToday from '../../app/admin/_components/AdminToday';
import StaffDashboard from '../../app/admin/_components/StaffDashboard';

function submission(id: string, status: string) {
    return { _id: id, _creationTime: NOW - 60_000, businessName: `${id} shop`, businessType: 'Other',
        city: 'Marikina', status, creator: { firstName: 'Test', lastName: 'Agent' } };
}
function call(id: string, startMs = NOW + 15 * 60_000, extra: Record<string, unknown> = {}) {
    return { key: id, name: `${id} caller`, startMs, endMs: startMs + 10 * 60_000, email: `${id}@example.test`,
        meetUrl: `https://meet.google.com/test-${id}`, source: 'page', origin: 'page', bookingId: null,
        eventId: null, outsideHours: false, ...extra };
}
function render(component: typeof AdminToday | typeof StaffDashboard) {
    return load(renderToStaticMarkup(createElement(component)));
}
function metric($: CheerioAPI, label: string) {
    return $('a').filter((_index, element) => $(element).text().includes(label)).first();
}
function body($: CheerioAPI) { return $('body').text(); }

beforeEach(() => {
    state.actor = 'admin-one'; state.visitActor = 'admin-one'; state.visits = []; state.visitsLoading = false;
    state.submissions = []; state.pendingAgents = []; state.failed = []; state.queries = [];
    state.scheduleLoading = false; state.calendarError = null; state.calls = []; state.unanswered = [];
    state.write.mockReset(); state.refresh.mockReset();
});

describe('admin Today work queues', () => {
    it('binds requested visit queries to the current subject and opens the visit queue', () => {
        state.visits = [{ _id: 'visit-one', shopName: 'Kanto Cuts', city: 'Marikina' }, { _id: 'visit-two', shopName: 'Kusina', city: 'Pasig' }];
        const $ = render(AdminToday);
        expect(state.queries.find(query => query.name === 'visitRequests:listAdmin')?.args).toEqual({ status: 'requested', clerkId: 'admin-one' });
        expect(metric($, 'Visits to assign').find('strong').text()).toBe('2');
        expect(metric($, 'Visits to assign').attr('href')).toBe('/admin/visits');
        expect($('a').filter((_index, element) => $(element).text() === 'Assign shop visits').attr('href')).toBe('/admin/visits');
        expect(body($)).toContain('The visit is confirmed after the agent accepts.');
        expect(state.write).not.toHaveBeenCalled();
    });

    it('does not show a false all-clear while visit requests are still loading', () => {
        state.visitsLoading = true;
        const $ = render(AdminToday);
        expect($('[role="status"]').filter((_index, element) => $(element).text() === "Loading today's summary").length).toBe(1);
        expect(metric($, 'Visits to assign').find('strong')).toHaveLength(0);
        expect(body($)).not.toContain('You’re up to date.');
        expect(body($)).not.toContain('Everything is moving.');
    });

    it('discards a visit envelope from an old subject instead of showing its details or count', () => {
        state.visitActor = 'previous-admin';
        state.visits = [{ _id: 'foreign-visit', shopName: 'Private old account shop', city: 'Pasig' }];
        const $ = render(AdminToday);
        expect(body($)).not.toContain('Private old account shop');
        expect(metric($, 'Visits to assign').find('strong')).toHaveLength(0);
        expect(body($)).not.toContain('You’re up to date.');
    });

    it('skips the visit query while the Clerk subject is unavailable', () => {
        state.actor = null;
        const $ = render(AdminToday);
        expect(state.queries.find(query => query.name === 'visitRequests:listAdmin')?.args).toBe('skip');
        expect(body($)).not.toContain('You’re up to date.');
    });

    it('treats pending field-agent approvals as work even when other queues are empty', () => {
        state.pendingAgents = [{ firstName: 'Mika', lastName: 'Santos', quizPassedAt: NOW - 86_400_000 }];
        const $ = render(AdminToday);
        expect(metric($, 'Agents to approve').find('strong').text()).toBe('1');
        expect(metric($, 'Agents to approve').attr('href')).toBe('/admin/creators?view=pending');
        expect(body($)).toContain('field agent is waiting for approval');
        expect(body($)).toContain('Mika Santos passed the quiz');
        expect(body($)).not.toContain('You’re up to date.');
        expect($('a').filter((_index, element) => $(element).text() === 'Review field agents').attr('href')).toBe('/admin/creators?view=pending');
    });

    it('counts only submitted and in-review submissions as reviews, preserving all-status recent links', () => {
        state.submissions = ['submitted', 'in_review', 'draft', 'rejected', 'approved', 'completed'].map((status, index) => submission(`business-${index}`, status));
        const $ = render(AdminToday);
        expect(metric($, 'Submissions to review').find('strong').text()).toBe('2');
        expect(metric($, 'Submissions to review').attr('href')).toBe('/admin/submissions');
        expect($('a[href="/admin/submissions?status=all&open=business-0"]').length).toBe(1);
        expect($('a[href="/admin/submissions?status=all"]').text()).toContain('Show all 6 submissions');
    });

    it('shows zero failed payouts without creating a failed-payout action row', () => {
        const $ = render(AdminToday);
        expect(metric($, 'Failed payouts').find('strong').text()).toBe('0');
        expect(metric($, 'Failed payouts').attr('href')).toBe('/admin/payouts');
        expect(body($)).not.toContain('See failed payouts');
        expect(body($)).toContain('You’re up to date.');
    });

    it('surfaces actual failed payouts and routes to payouts without initiating a financial action', () => {
        state.failed = [{ creatorName: 'Test Agent', amount: 1500, createdAt: NOW - 3600_000 }];
        const $ = render(AdminToday);
        expect(metric($, 'Failed payouts').find('strong').text()).toBe('1');
        expect(body($)).toContain('creator payout failed');
        expect($('a').filter((_index, element) => $(element).text() === 'See failed payouts').attr('href')).toBe('/admin/payouts');
        expect(state.write).not.toHaveBeenCalled();
    });

    it('shows the limited visit list as 200+ rather than claiming a full queue total', () => {
        state.visits = Array.from({ length: 200 }, (_unused, index) => ({ _id: `visit-${index}`, shopName: `shop-${index}`, city: 'Pasig' }));
        expect(metric(render(AdminToday), 'Visits to assign').find('strong').text()).toBe('200+');
    });

    it('keeps call-calendar failures visible instead of presenting a complete external schedule', () => {
        state.calendarError = 'Calendar unavailable';
        const $ = render(AdminToday);
        expect(body($)).toContain('Showing calls booked through this app only.');
        expect(body($)).toContain('Calendar unavailable');
    });
});

describe('staff Today remains call-only', () => {
    it('renders Manila-day calls and links only to the staff call workspace', () => {
        state.calls = [call('today'), call('tomorrow', NOW + 86_400_000)];
        const $ = render(StaffDashboard);
        expect(metric($, 'Calls ahead today').find('strong').text()).toBe('1');
        expect(body($)).toContain('Wednesday, November 4');
        expect(body($)).toContain('today caller');
        expect(body($)).not.toContain('tomorrow caller');
        expect($('a[aria-label="Join the call with today caller"]').attr('href')).toBe('https://meet.google.com/test-today');
        expect($('a[href^="/admin"]').toArray().map(element => $(element).attr('href'))).not.toEqual([]);
        expect($('a[href^="/admin"]').toArray().every(element => $(element).attr('href') === '/admin/bookings')).toBe(true);
        expect(state.queries).toEqual([]);
        expect(state.write).not.toHaveBeenCalled();
    });

    it('surfaces owed call outcomes without mounting admin data queries', () => {
        state.unanswered = [call('finished', NOW - 3600_000)];
        const $ = render(StaffDashboard);
        expect(metric($, 'Outcomes to record').find('strong').text()).toBe('1');
        expect($('a').filter((_index, element) => $(element).text() === 'Mark who came').attr('href')).toBe('/admin/bookings');
        expect(body($)).not.toContain('All caught up');
        expect(state.queries).toEqual([]);
        expect(state.write).not.toHaveBeenCalled();
    });

    it('does not claim no calls or all caught up while the staff schedule is loading', () => {
        state.scheduleLoading = true;
        const $ = render(StaffDashboard);
        expect(metric($, 'Calls ahead today').find('strong')).toHaveLength(0);
        expect(body($)).not.toContain('No more calls today');
        expect(body($)).not.toContain('All caught up');
        expect(state.queries).toEqual([]);
    });
});
