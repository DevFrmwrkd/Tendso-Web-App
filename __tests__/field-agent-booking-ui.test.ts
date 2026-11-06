import { createElement, type ReactNode } from 'react';
import SlotPicker, { manilaKeyOf, type Day, type Slot } from '@/app/field-agent/_components/SlotPicker';
import { addToCalendarUrl, formatDay, formatTime, maskEmail } from '@/app/field-agent/_components/callTime';
import BookPage from '@/app/field-agent/book/page';
import ManagePage from '@/app/field-agent/manage/page';

jest.mock('react', () => jest.requireActual('../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('next/link', () => function MockLink({ children, ...props }: { children?: ReactNode }) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('a', props, children);
});
jest.mock('@/components/v2/V2Root', () => ({ V2Root: function MockRoot({ children }: { children?: ReactNode }) { return children; } }));
jest.mock('@/app/field-agent/_components/BookingShell', () => ({ __esModule: true, default: function MockShell({ title, children }: { title: ReactNode; children: ReactNode }) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('main', null, title, children);
} }));
jest.mock('@/app/field-agent/_components/BookingUI', () => {
    const React = jest.requireActual('../apps/mobile/node_modules/react');
    return {
        ...jest.requireActual('@/app/field-agent/_components/BookingUI'),
        // The browser owns native-dialog focus handling. This isolates the page's
        // explicit confirmation contract without relying on a DOM/portal in Node.
        ConfirmDialog: function MockConfirmDialog({ open, title, children, onConfirm, onCancel, confirmLabel, busy }: {
            open: boolean; title: ReactNode; children?: ReactNode; onConfirm: () => void; onCancel: () => void; confirmLabel: ReactNode; busy?: boolean;
        }) {
            return open ? React.createElement('section', { role: 'alertdialog' }, title, children,
                React.createElement('button', { onClick: onCancel, disabled: busy }, 'Keep it'),
                React.createElement('button', { onClick: onConfirm, disabled: busy }, confirmLabel)) : null;
        },
    };
});
jest.mock('next/navigation', () => ({ useSearchParams: () => ({ get: (key: string) => params[key] ?? null }) }));
jest.mock('@/convex/_generated/api', () => ({ api: {
    booking: { getAvailability: 'availability', createBooking: 'create', rescheduleByToken: 'move', cancelByToken: 'cancel' },
    nativeBookings: { getForManage: 'manage' },
} }));
jest.mock('convex/react', () => ({
    useAction: (name: string) => {
        if (name === 'availability') return availability;
        if (name === 'create') return createBooking;
        if (name === 'move') return reschedule;
        if (name === 'cancel') return cancel;
        throw new Error(`Unexpected booking action: ${name}`);
    },
    useQuery: (_name: string, args: unknown) => { queries.push(args); return args === 'skip' ? undefined : booking; },
}));

interface TestNode {
    type: unknown; props: Record<string, unknown>; children: (TestNode | string)[]; parent: TestNode | null;
    findAllByType(type: string): TestNode[];
}
interface TestRenderer { root: TestNode; unmount(): void }
const { create, act } = jest.requireActual('../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode, options?: { createNodeMock: (element: { type: unknown; props: Record<string, unknown> }) => unknown }): TestRenderer;
    act(callback: () => void | Promise<void>): Promise<void>;
};
const instant = (day: number, minute = 0) => Date.UTC(2026, 10, day, 2, minute);
const slots: Slot[] = [
    { startMs: instant(12), label: '10:00 AM', taken: false },
    { startMs: instant(12, 15), label: '10:15 AM', taken: true },
    { startMs: instant(12, 30), label: '10:30 AM', taken: true },
    { startMs: instant(12, 45), label: '10:45 AM', taken: false },
];
const days: Day[] = [
    { dateKey: '2026-11-12', label: 'Thursday, November 12', slots },
    { dateKey: '2026-11-13', label: 'Friday, November 13', slots: [{ startMs: instant(13), label: '10:00 AM', taken: false }] },
];
const availability = jest.fn();
const createBooking = jest.fn();
const reschedule = jest.fn();
const cancel = jest.fn();
const queries: unknown[] = [];
let params: Record<string, string> = {};
let booking: { name: string; email: string; startMs: number; endMs: number; status: string; manageable: boolean; meetUrl: string } | null | undefined;
let renderer: TestRenderer | undefined;
let consoleError: jest.SpyInstance;
const focusName = jest.fn();
const focusEmail = jest.fn();
function text(node: TestNode | string): string { return typeof node === 'string' ? node : node.children.map(text).join(''); }
function button(label: string) {
    const found = renderer!.root.findAllByType('button').find(node => node.props['aria-label'] === label || text(node).trim() === label);
    if (!found) throw new Error(`Button missing: ${label}`);
    return found;
}
async function mount(element: ReactNode) {
    await act(async () => {
        renderer = create(element, { createNodeMock: ({ props }) => props.autoComplete === 'name' ? { focus: focusName } : props.autoComplete === 'email' ? { focus: focusEmail } : null });
        await Promise.resolve();
    });
}
async function click(node: TestNode) { await act(async () => { (node.props.onClick as () => void)(); await Promise.resolve(); }); }
async function submit() { await act(async () => { await (renderer!.root.findAllByType('form')[0].props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault: jest.fn() }); }); }
async function change(node: TestNode, value: string) { await act(() => { (node.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } }); }); }

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.UTC(2026, 10, 6, 2));
    jest.clearAllMocks();
    queries.length = 0;
    params = {};
    booking = { name: 'Alex Rivera', email: 'alex@example.com', startMs: instant(12, 30), endMs: instant(12, 40), status: 'confirmed', manageable: true, meetUrl: 'https://example.com/sample-meet' };
    availability.mockResolvedValue({ days });
    createBooking.mockResolvedValue({ ok: true, meetUrl: 'https://example.com/sample-meet' });
    reschedule.mockResolvedValue({ ok: true });
    cancel.mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { scrollTo: jest.fn() } });
    const originalError = console.error;
    consoleError = jest.spyOn(console, 'error').mockImplementation((message: unknown, ...rest: unknown[]) => {
        if (String(message).includes('react-test-renderer is deprecated')) return;
        originalError(message, ...rest);
    });
});
afterEach(async () => {
    await act(() => { renderer?.unmount(); });
    renderer = undefined;
    consoleError.mockRestore();
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    jest.useRealTimers();
});

it('formats calendar days across the Manila midnight boundary and creates a ten-minute calendar event', () => {
    const start = Date.UTC(2026, 10, 11, 16, 15);
    expect(manilaKeyOf(start)).toBe('2026-11-12');
    expect(formatDay(start)).toBe('Thursday, November 12');
    expect(formatTime(start)).toBe('12:15 AM');
    const link = new URL(addToCalendarUrl(start, 'https://example.com/sample-meet'));
    expect(link.searchParams.get('ctz')).toBe('Asia/Manila');
    expect(link.searchParams.get('dates')).toBe('20261111T161500Z/20261111T162500Z');
    expect(maskEmail('alex@example.com')).toBe('a•••@example.com');
});

it('keeps booked and own slots in their quarter-hour positions without making them selectable', async () => {
    const select = jest.fn();
    await mount(createElement(SlotPicker, { days, activeDay: days[0].dateKey, onSelectDay: jest.fn(), selected: slots[0].startMs, onSelect: select, mine: slots[2].startMs }));
    const free = button('10:00 AM');
    expect(free.props['aria-pressed']).toBe(true);
    expect(renderer!.root.findAllByType('button').some(node => node.props['aria-label'] === '10:15 AM' || node.props['aria-label'] === '10:30 AM')).toBe(false);
    const row = free.parent!;
    expect(row.children.filter(child => typeof child !== 'string').map(child => (child as TestNode).type)).toEqual(['button', 'span', 'span', 'button']);
    expect(text(row)).toMatch(/10:00.*10:15.*10:30.*yours.*10:45/);
    await click(button('10:45 AM'));
    expect(select).toHaveBeenCalledWith(slots[3]);
});

it('honours the picker disabled state while a booking action is busy', async () => {
    await mount(createElement(SlotPicker, { days, activeDay: days[0].dateKey, onSelectDay: jest.fn(), selected: null, onSelect: jest.fn(), disabled: true }));
    expect(button('10:00 AM').props.disabled).toBe(true);
    expect(button('10:45 AM').props.disabled).toBe(true);
});

it('requires a time and clears the prior selection when choosing another day', async () => {
    await mount(createElement(BookPage));
    expect(button('Continue').props.disabled).toBe(true);
    await click(button('10:00 AM'));
    expect(button('Continue').props.disabled).toBe(false);
    const nextDay = renderer!.root.findAllByType('button').find(node => String(node.props['aria-label']).startsWith(days[1].label))!;
    await click(nextDay);
    expect(button('Continue').props.disabled).toBe(true);
    await click(button('10:00 AM'));
    await click(button('Continue'));
    expect(renderer!.root.findAllByType('form')).toHaveLength(1);
    expect(createBooking).not.toHaveBeenCalled();
});

it('validates the details form without creating a booking and focuses the invalid name', async () => {
    await mount(createElement(BookPage));
    await click(button('10:00 AM'));
    await click(button('Continue'));
    await submit();
    expect(text(renderer!.root)).toContain('Enter your full name.');
    expect(text(renderer!.root)).toContain('Enter your email');
    expect(focusName).toHaveBeenCalledTimes(1);
    expect(createBooking).not.toHaveBeenCalled();
});

it('quietly rejects the honeypot even when the visible details are valid', async () => {
    await mount(createElement(BookPage));
    await click(button('10:00 AM'));
    await click(button('Continue'));
    const inputs = renderer!.root.findAllByType('input');
    await change(inputs.find(node => node.props.autoComplete === 'name')!, 'Alex Rivera');
    await change(inputs.find(node => node.props.type === 'email')!, 'alex@example.com');
    await change(inputs.find(node => String(node.props['aria-hidden']) === 'true')!, 'https://example.com/spam');
    await submit();
    expect(createBooking).not.toHaveBeenCalled();
});

it('keeps a lost-slot explanation visible while reloading the stale availability', async () => {
    createBooking.mockResolvedValue({ ok: false, error: 'Someone just took that slot. Please pick another.' });
    await mount(createElement(BookPage));
    await click(button('10:00 AM'));
    await click(button('Continue'));
    const inputs = renderer!.root.findAllByType('input');
    await change(inputs.find(node => node.props.autoComplete === 'name')!, 'Alex Rivera');
    await change(inputs.find(node => node.props.type === 'email')!, 'alex@example.com');
    await submit();
    expect(createBooking).toHaveBeenCalledWith({ startMs: slots[0].startMs, name: 'Alex Rivera', email: 'alex@example.com' });
    expect(text(renderer!.root)).toContain('Someone just took that slot.');
    expect(button('Continue').props.disabled).toBe(true);
    expect(availability).toHaveBeenCalledTimes(2);
});

it('does not cancel on mount even when an email link explicitly asks to open cancellation', async () => {
    params = { t: 'sample-private-token', action: 'cancel' };
    await mount(createElement(ManagePage));
    expect(text(renderer!.root)).toContain('Cancel this call?');
    expect(text(renderer!.root)).toContain('a•••@example.com');
    expect(text(renderer!.root)).not.toContain('sample-private-token');
    expect(cancel).not.toHaveBeenCalled();
    expect(reschedule).not.toHaveBeenCalled();
});

it('skips private booking lookup when the manage link has no token', async () => {
    await mount(createElement(ManagePage));
    expect(text(renderer!.root)).toContain('missing its code');
    expect(queries.every(args => args === 'skip')).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
});
