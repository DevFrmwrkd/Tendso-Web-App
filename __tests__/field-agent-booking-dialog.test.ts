import { createElement, type ReactNode } from 'react';
import { ConfirmDialog } from '@/app/field-agent/_components/BookingUI';

jest.mock('react', () => jest.requireActual('../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('next/link', () => function MockLink({ children, ...props }: { children?: ReactNode }) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('a', props, children);
});

interface TestNode { props: Record<string, unknown>; findAllByType(type: string): TestNode[] }
interface TestRenderer { root: TestNode; update(element: ReactNode): void; unmount(): void }
const { create, act } = jest.requireActual('../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode, options?: { createNodeMock: (element: { type: unknown }) => unknown }): TestRenderer;
    act(callback: () => void): Promise<void>;
};
const confirm = jest.fn();
const cancel = jest.fn();
const showModal = jest.fn();
const close = jest.fn();
const documentStyle = { overflow: 'auto' };
let renderer: TestRenderer | undefined;
let consoleError: jest.SpyInstance;
const globals = new Map<string, PropertyDescriptor | undefined>();
function defineGlobal(name: string, value: unknown) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
}
function dialog(open: boolean, busy = false) {
    const props = { open, busy, title: 'Cancel this call?', confirmLabel: 'Yes, cancel it', onConfirm: confirm, onCancel: cancel, children: 'Your current time will be released.' };
    return createElement(ConfirmDialog, props);
}
async function mount(open: boolean, busy = false) {
    await act(() => {
        renderer = create(dialog(open, busy), { createNodeMock: ({ type }) => type === 'dialog' ? { showModal, close } : null });
    });
}
beforeEach(() => {
    jest.clearAllMocks();
    documentStyle.overflow = 'auto';
    defineGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    defineGlobal('document', { documentElement: { style: documentStyle } });
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
    for (const [name, descriptor] of globals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    }
    globals.clear();
});

it('opens and closes the native modal without invoking the destructive action', async () => {
    await mount(false);
    expect(showModal).not.toHaveBeenCalled();
    await act(() => { renderer!.update(dialog(true)); });
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(documentStyle.overflow).toBe('hidden');
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    await act(() => { renderer!.update(dialog(false)); });
    expect(close).toHaveBeenCalledTimes(1);
    expect(documentStyle.overflow).toBe('auto');
});

it('blocks Escape, backdrop dismissal, and buttons while a cancellation is busy', async () => {
    await mount(true, true);
    const modal = renderer!.root.findAllByType('dialog')[0];
    const preventDefault = jest.fn();
    const backdrop = {};
    await act(() => {
        (modal.props.onCancel as (event: { preventDefault: () => void }) => void)({ preventDefault });
        (modal.props.onClick as (event: { target: unknown; currentTarget: unknown }) => void)({ target: backdrop, currentTarget: backdrop });
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(renderer!.root.findAllByType('button').every(button => button.props.disabled === true)).toBe(true);
});

it('allows Escape to request dismissal when idle without confirming cancellation', async () => {
    await mount(true);
    const preventDefault = jest.fn();
    await act(() => {
        (renderer!.root.findAllByType('dialog')[0].props.onCancel as (event: { preventDefault: () => void }) => void)({ preventDefault });
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
});
