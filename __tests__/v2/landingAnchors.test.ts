import { createElement, type ReactNode } from 'react';

import { Reveals } from '@/components/landing-v2/Reveals';

jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));

interface TestRenderer { unmount(): void }
const { create, act } = jest.requireActual('../../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode): TestRenderer;
    act(callback: () => void): Promise<void>;
};

type Listener = (event: MouseEvent) => void;
const descriptors = new Map<string, PropertyDescriptor | undefined>();
const windowListeners = new Map<string, Listener>();
const documentListeners = new Map<string, { listener: Listener; capture: boolean }>();
const observers: RevealObserver[] = [];
const operations: string[] = [];
const elements: TestElement[] = [];
const scrollTo = jest.fn();
let renderer: TestRenderer | undefined;
let location: URL;
let reducedMotion = false;
let outer: TestElement;
let inner: TestElement;
let downloadWrapper: TestElement;
let pending: TestElement;

class TestElement {
    readonly classes = new Set<string>();
    readonly attributes = new Set<string>();
    readonly scrollIntoView = jest.fn();
    href: string | null = null;
    target = '';
    top = 10000;
    classList = {
        add: (name: string) => {
            this.classes.add(name);
            if (name === 'is-in') operations.push(`reveal:${this.id}`);
        },
        remove: (name: string) => { this.classes.delete(name); },
        contains: (name: string) => this.classes.has(name),
    };

    constructor(readonly id: string, readonly parentElement: TestElement | null = null, readonly reveal = false) {
        elements.push(this);
    }

    matches(selector: string): boolean {
        if (selector === '[data-reveal]') return this.reveal;
        if (selector === '.lv2') return this.classes.has('lv2');
        if (selector === 'a[href]') return this.href !== null;
        throw new Error(`Unexpected selector: ${selector}`);
    }

    closest(selector: string): TestElement | null {
        if (this.matches(selector)) return this;
        return this.parentElement?.closest(selector) ?? null;
    }

    hasAttribute(name: string) { return this.attributes.has(name); }
    getBoundingClientRect() { return { top: this.top }; }
}

class RevealObserver {
    readonly observed = new Set<TestElement>();
    disconnected = false;
    constructor(readonly callback: IntersectionObserverCallback) { observers.push(this); }
    observe(element: TestElement) {
        operations.push(`observe:${element.id}`);
        this.observed.add(element);
    }
    unobserve(element: TestElement) { this.observed.delete(element); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
}

function defineGlobal(name: string, descriptor: PropertyDescriptor) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
}

async function mountReveals() {
    await act(() => { renderer = create(createElement(Reveals)); });
}

function clickLink(href = '#hire', overrides: Partial<MouseEvent> = {}, options: { target?: string; download?: boolean } = {}) {
    const link = new TestElement('clicked-link');
    link.href = href;
    link.target = options.target ?? '';
    if (options.download) link.attributes.add('download');
    const label = new TestElement('clicked-label', link);
    const preventDefault = jest.fn();
    const event = {
        target: label,
        button: 0,
        defaultPrevented: false,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault,
        ...overrides,
    } as unknown as MouseEvent;
    documentListeners.get('click')?.listener(event);
    return { event, preventDefault };
}

function expectNoScriptScroll() {
    expect(scrollTo).not.toHaveBeenCalled();
    expect(elements.every(element => element.scrollIntoView.mock.calls.length === 0)).toBe(true);
}

beforeEach(() => {
    location = new URL('https://tendso.test/?campaign=qa');
    reducedMotion = false;
    windowListeners.clear();
    documentListeners.clear();
    observers.length = 0;
    operations.length = 0;
    elements.length = 0;
    scrollTo.mockClear();
    const landing = new TestElement('landing');
    landing.classes.add('lv2');
    outer = new TestElement('outer-reveal', landing, true);
    inner = new TestElement('inner-reveal', outer, true);
    new TestElement('hire', inner);
    downloadWrapper = new TestElement('download-reveal', landing, true);
    new TestElement('download', downloadWrapper);
    pending = new TestElement('unrelated-reveal', landing, true);
    new TestElement('outside-landing', null, true);

    defineGlobal('IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true });
    defineGlobal('window', { value: globalThis });
    defineGlobal('location', { get: () => location });
    defineGlobal('innerHeight', { value: 900 });
    defineGlobal('scrollTo', { value: scrollTo });
    defineGlobal('matchMedia', { value: () => ({ matches: reducedMotion }) });
    defineGlobal('IntersectionObserver', { value: RevealObserver });
    defineGlobal('addEventListener', { value: (name: string, listener: Listener) => { windowListeners.set(name, listener); } });
    defineGlobal('removeEventListener', { value: (name: string, listener: Listener) => {
        if (windowListeners.get(name) === listener) windowListeners.delete(name);
    } });
    defineGlobal('document', { value: {
        getElementById: (id: string) => elements.find(element => element.id === id) ?? null,
        querySelectorAll: (selector: string) => {
            if (!selector.startsWith('.lv2 [data-reveal]')) throw new Error(`Unexpected document selector: ${selector}`);
            const excludedClass = selector.match(/:not\(\.([^)]*)\)/)?.[1];
            return elements.filter(element => element.reveal && element.closest('.lv2') && (!excludedClass || !element.classes.has(excludedClass)));
        },
        addEventListener: (name: string, listener: Listener, capture = false) => { documentListeners.set(name, { listener, capture }); },
        removeEventListener: (name: string, listener: Listener, capture = false) => {
            const registered = documentListeners.get(name);
            if (registered?.listener === listener && registered.capture === capture) documentListeners.delete(name);
        },
    } });
});

afterEach(async () => {
    await act(() => { renderer?.unmount(); });
    renderer = undefined;
    expect(windowListeners.size).toBe(0);
    expect(documentListeners.size).toBe(0);
    expect(observers.every(observer => observer.disconnected)).toBe(true);
    for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    }
    descriptors.clear();
});

describe('landing fragment navigation', () => {
    it('reveals every targeted ancestor before arming other content on a direct deep link', async () => {
        location.hash = '#h%69re';
        await mountReveals();

        expect(inner.classes.has('is-in')).toBe(true);
        expect(outer.classes.has('is-in')).toBe(true);
        expect(pending.classes.has('is-in')).toBe(false);
        expect(observers[0].observed.has(inner)).toBe(false);
        expect(observers[0].observed.has(outer)).toBe(false);
        const firstObservation = operations.findIndex(operation => operation.startsWith('observe:'));
        expect(operations.indexOf('reveal:inner-reveal')).toBeLessThan(firstObservation);
        expect(operations.indexOf('reveal:outer-reveal')).toBeLessThan(firstObservation);
        expectNoScriptScroll();
    });

    it('reveals a new hash destination and stops observing its previously hidden parent', async () => {
        await mountReveals();
        expect(observers[0].observed.has(downloadWrapper)).toBe(true);
        location.hash = '#download';
        windowListeners.get('hashchange')?.({} as MouseEvent);

        expect(downloadWrapper.classes.has('is-in')).toBe(true);
        expect(observers[0].observed.has(downloadWrapper)).toBe(false);
        expect(inner.classes.has('is-in')).toBe(false);
        expectNoScriptScroll();
    });

    it('reveals the current same-document hash on capture click without taking over native navigation', async () => {
        await mountReveals();
        // Router history updates and repeat clicks need not dispatch hashchange.
        location.hash = '#hire';
        expect(inner.classes.has('is-in')).toBe(false);
        expect(documentListeners.get('click')?.capture).toBe(true);
        const { preventDefault } = clickLink(location.href);

        expect(inner.classes.has('is-in')).toBe(true);
        expect(outer.classes.has('is-in')).toBe(true);
        expect(preventDefault).not.toHaveBeenCalled();
        expectNoScriptScroll();
    });

    it.each([
        ['middle button', '#hire', { button: 1 }, {}],
        ['meta key', '#hire', { metaKey: true }, {}],
        ['control key', '#hire', { ctrlKey: true }, {}],
        ['shift key', '#hire', { shiftKey: true }, {}],
        ['alt key', '#hire', { altKey: true }, {}],
        ['prevented event', '#hire', { defaultPrevented: true }, {}],
        ['external origin', 'https://elsewhere.test/?campaign=qa#hire', {}, {}],
        ['another path', '/for-business?campaign=qa#hire', {}, {}],
        ['another query', '/?campaign=other#hire', {}, {}],
        ['new tab', '#hire', {}, { target: '_blank' }],
        ['download link', '#hire', {}, { download: true }],
        ['invalid URL', 'https://[invalid', {}, {}],
    ] as const)('ignores %s without revealing the destination', async (_name, href, event, options) => {
        await mountReveals();
        const { preventDefault } = clickLink(href, event, options);
        expect(inner.classes.has('is-in')).toBe(false);
        expect(outer.classes.has('is-in')).toBe(false);
        expect(preventDefault).not.toHaveBeenCalled();
        expectNoScriptScroll();
    });

    it('safely ignores malformed hashes and destinations outside the landing scope', async () => {
        location.hash = '#%E0%A4%A';
        await mountReveals();
        location.hash = '#outside-landing';
        expect(() => windowListeners.get('hashchange')?.({} as MouseEvent)).not.toThrow();
        expect(elements.find(element => element.id === 'outside-landing')!.classes.has('is-in')).toBe(false);
        expect(inner.classes.has('is-in')).toBe(false);
    });

    it('reobserves still-hidden armed content after an effect remount and releases it on intersection', async () => {
        await mountReveals();
        expect(inner.classes.has('is-armed')).toBe(true);
        const firstObserver = observers[0];
        await act(() => { renderer!.unmount(); });
        renderer = undefined;
        expect(firstObserver.disconnected).toBe(true);

        await mountReveals();
        const nextObserver = observers.at(-1)!;
        expect(nextObserver.observed.has(inner)).toBe(true);
        expect(nextObserver.observed.has(outer)).toBe(true);
        nextObserver.callback([{
            target: inner,
            isIntersecting: true,
            intersectionRatio: 0.5,
        } as unknown as IntersectionObserverEntry], nextObserver as unknown as IntersectionObserver);
        expect(inner.classes.has('is-in')).toBe(true);
        expect(nextObserver.observed.has(inner)).toBe(false);
        expect(nextObserver.observed.has(pending)).toBe(true);
    });

    it('keeps reduced-motion content visible without waiting for an observer callback', async () => {
        reducedMotion = true;
        await mountReveals();
        expect(inner.classes.has('is-in')).toBe(true);
        expect(downloadWrapper.classes.has('is-in')).toBe(true);
        expect(observers[0].observed.size).toBe(0);
    });
});
