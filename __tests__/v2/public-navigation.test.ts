import { createElement, type ReactNode } from 'react';
import { Nav, isCurrentNavPage } from '@/components/v2/Nav';
import { Footer } from '@/components/v2/Footer';
import { Button } from '@/components/v2/Button';

jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));
jest.mock('next/link', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    return ({ children, ...props }: { children?: ReactNode }) => React.createElement('a', props, children);
});

interface Node {
    type: unknown;
    props: Record<string, unknown>;
    findAllByType(type: string): Node[];
    findByProps(props: Record<string, unknown>): Node;
}
interface Renderer { root: Node; update(element: ReactNode): void; unmount(): void }
const { create, act } = require('../../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode): Renderer;
    act(callback: () => void | Promise<void>): Promise<void>;
};
let mockPathname = '/';
const views: Renderer[] = [];

beforeEach(() => {
    mockPathname = '/';
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        scrollY: 0, addEventListener: jest.fn(), removeEventListener: jest.fn(),
    } });
    const error = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) return;
        error(...args);
    });
});
afterEach(async () => {
    await act(() => { for (const view of views.splice(0)) view.unmount(); });
    Reflect.deleteProperty(globalThis, 'window');
    jest.restoreAllMocks();
});

async function render(element: ReactNode) {
    let view!: Renderer;
    await act(() => { view = create(element); });
    views.push(view);
    return view;
}

describe('public navigation current page', () => {
    it.each([
        ['/affiliates', '/affiliates'], ['/affiliates/', '/affiliates'], ['/v2/creators', '/affiliates'],
        ['/v2/creators/', '/affiliates'], ['/for-business', '/for-business'], ['/v2/business', '/for-business'],
        ['/v2/field-agents', '/for-field-agents'], ['/v2/examples', '/examples'], ['/v2/help', '/help'],
        ['/v2/about', '/about'], ['/affiliates?ref=MIKA30', '/affiliates'],
    ])('recognizes %s as the current canonical page %s', (pathname, href) => {
        expect(isCurrentNavPage(pathname, href)).toBe(true);
    });

    it('does not mistake home fragments, external links or a similar prefix for the current page', () => {
        expect(isCurrentNavPage('/', '/#how')).toBe(false);
        expect(isCurrentNavPage('/v2', '/#download')).toBe(false);
        expect(isCurrentNavPage('/affiliates-other', '/affiliates')).toBe(false);
        expect(isCurrentNavPage('/affiliates', 'https://other.example/affiliates')).toBe(false);
        expect(isCurrentNavPage('/affiliates', '//other.example/affiliates')).toBe(false);
        expect(isCurrentNavPage(null, '/affiliates')).toBe(false);
    });

    it('keeps Creators marked current when opening the mobile menu and closes it after a link is selected', async () => {
        mockPathname = '/affiliates';
        const view = await render(createElement(Nav));
        const currentLinks = () => view.root.findAllByType('a').filter(link => link.props['aria-current'] === 'page');
        expect(currentLinks()).toHaveLength(1);
        expect(currentLinks()[0].props.href).toBe('/affiliates');
        await act(() => { (view.root.findByProps({ 'aria-label': 'Menu' }).props.onClick as () => void)(); });
        expect(view.root.findByProps({ 'aria-label': 'Close menu' }).props['aria-expanded']).toBe(true);
        expect(currentLinks()).toHaveLength(1);
        expect(currentLinks()[0].props.href).toBe('/affiliates');
        await act(() => {
            (view.root.findByProps({ 'aria-label': 'Main' }).props.onClick as (event: unknown) => void)({ target: { closest: () => ({}) } });
        });
        expect(view.root.findByProps({ 'aria-label': 'Menu' }).props['aria-expanded']).toBe(false);
        mockPathname = '/help';
        await act(() => { view.update(createElement(Nav)); });
        expect(currentLinks()).toHaveLength(1);
        expect(currentLinks()[0].props.href).toBe('/help');
    });
});

it('keeps footer calls to action as enabled native section links alongside the decorative wordmark', async () => {
    const actions = createElement('div', null,
        createElement(Button, { href: '#download', children: 'Download the app' }),
        createElement(Button, { href: '#hire', variant: 'ghost', children: 'Hire an agent' }),
    );
    const view = await render(createElement(Footer, { actions }));
    const actionsInFooter = view.root.findAllByType('a').filter(link => String(link.props.className).includes('v2-btn'));
    expect(actionsInFooter.map(link => link.props.href)).toEqual(['#download', '#hire']);
    for (const action of actionsInFooter) {
        expect(action.props['aria-disabled']).toBeUndefined();
        expect(action.props.onClick).toBeUndefined();
    }
    expect(view.root.findByProps({ 'aria-hidden': 'true' }).props.className).toContain('v2-foot-mark');
    expect(view.root.findAllByType('a').some(link => link.props.href === '/#hire')).toBe(true);
});
