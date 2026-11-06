import { createElement, type ReactNode } from 'react';

import { Hero } from '@/components/landing-v2/Hero';

jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('next/image', () => ({ __esModule: true, default: function MockImage() { return null; } }));
jest.mock('@/components/v2', () => ({
    Button: function MockButton({ children }: { children: ReactNode }) { return children; },
    PhoneFrame: function MockPhoneFrame({ children }: { children: ReactNode }) { return children; },
}));
jest.mock('@/components/landing-v2/StoreStatus', () => ({
    StoreStatus: function MockStoreStatus() { return null; },
}));
jest.mock('@/components/landing-v2/screens', () => ({
    InterviewCamScreen: function MockCamera(props: Record<string, unknown>) {
        return createElement('interview-camera', props);
    },
}));
jest.mock('@/components/landing-v2/motion', () => ({
    ...jest.requireActual('@/components/landing-v2/motion'),
    useReducedMotion: () => reducedMotion,
    onFrame: (callback: FrameRequestCallback) => {
        decorativeFrames.add(callback);
        return () => { decorativeFrames.delete(callback); };
    },
}));

interface TestNode {
    props: Record<string, unknown>;
    findAllByType(type: string): TestNode[];
}
interface TestRenderer { root: TestNode; update(element: ReactNode): void; unmount(): void }
const { create, act } = jest.requireActual('../../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode, options: { createNodeMock: (element: { props: Record<string, unknown> }) => unknown }): TestRenderer;
    act(callback: () => void): Promise<void>;
};

class ElementStyle {
    left = '';
    top = '';
    width = '';
    height = '';
    transform = '';
    borderRadius = '';
    opacity = '';
    visibility = '';
    filter = '';
    zIndex = '';
    values: Record<string, string> = {};
    setProperty(name: string, value: string) { this.values[name] = value; }
}

function makeElement() {
    const classes = new Set<string>();
    const styleWrites: [string, unknown][] = [];
    return {
        style: new Proxy(new ElementStyle(), {
            set(target, key, value) {
                styleWrites.push([String(key), value]);
                return Reflect.set(target, key, value);
            },
        }),
        styleWrites,
        classes,
        textContent: '',
        classList: {
            add: (name: string) => { classes.add(name); },
            remove: (name: string) => { classes.delete(name); },
            contains: (name: string) => classes.has(name),
            toggle: (name: string, enabled: boolean) => {
                if (enabled) classes.add(name);
                else classes.delete(name);
                return enabled;
            },
        },
    };
}

class VisibilityObserver {
    readonly observed = new Set<Element>();
    disconnected = false;
    constructor(readonly callback: IntersectionObserverCallback, readonly options?: IntersectionObserverInit) {
        observers.push(this);
    }
    observe(element: Element) { this.observed.add(element); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
}

type MockElement = ReturnType<typeof makeElement>;
const decorativeFrames = new Set<FrameRequestCallback>();
const descriptors = new Map<string, PropertyDescriptor | undefined>();
const windowListeners = new Map<string, () => void>();
const documentListeners = new Map<string, () => void>();
const scheduledFrames = new Map<number, FrameRequestCallback>();
const observers: VisibilityObserver[] = [];
const getElementById = jest.fn(() => null);
let nextFrameId = 0;
let renderer: TestRenderer | undefined;
let reducedMotion = false;
let position = 0;
let heroWidth = 1200;
let heroHeight = 900;
let viewportHeight = 900;
let documentHidden = false;
let stage: MockElement;
let world: MockElement;
let copy: MockElement;
let phone: MockElement;
let hero: MockElement & {
    readonly clientWidth: number;
    readonly clientHeight: number;
    getBoundingClientRect(): { top: number; bottom: number; height: number };
    querySelector(selector: string): MockElement | undefined;
    querySelectorAll(selector: string): MockElement[];
};

function defineGlobal(name: string, descriptor: PropertyDescriptor) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
}

async function flushFrame() {
    await act(() => {
        const pending = [...scheduledFrames.values()];
        scheduledFrames.clear();
        pending.forEach(callback => callback(0));
    });
}

async function moveTo(y: number) {
    position = y;
    windowListeners.get('scroll')?.();
    await flushFrame();
}

async function setIntersection(ratio: number) {
    await act(() => {
        const observer = observers.filter(item => !item.disconnected).at(-1);
        expect(observer).toBeDefined();
        observer!.callback([{
            target: hero,
            isIntersecting: ratio > 0,
            intersectionRatio: ratio,
        } as unknown as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
    });
}

async function mountHero() {
    await act(() => {
        renderer = create(createElement(Hero), {
            createNodeMock: ({ props }) => props.className === 'hero' ? hero : null,
        });
    });
}

function cameraPlaying() {
    return renderer!.root.findAllByType('interview-camera')[0].props.playing;
}

beforeEach(() => {
    position = 0;
    heroWidth = 1200;
    heroHeight = 900;
    viewportHeight = 900;
    documentHidden = false;
    reducedMotion = false;
    nextFrameId = 0;
    decorativeFrames.clear();
    scheduledFrames.clear();
    windowListeners.clear();
    documentListeners.clear();
    observers.length = 0;
    getElementById.mockClear();
    stage = makeElement();
    world = makeElement();
    copy = makeElement();
    phone = makeElement();
    const nodes: Record<string, MockElement> = {
        '.stage': stage,
        '.world': world,
        '.hero-copy': copy,
        '.hero-phone': phone,
        '.buddy': makeElement(),
        '.buddy-say': makeElement(),
        '.buddy-load i': makeElement(),
    };
    const cards = Array.from({ length: 4 }, () => makeElement());
    hero = {
        ...makeElement(),
        clientWidth: heroWidth,
        clientHeight: heroHeight,
        getBoundingClientRect: () => ({ top: -position, bottom: heroHeight - position, height: heroHeight }),
        querySelector: selector => nodes[selector],
        querySelectorAll: selector => selector === '.site-card' ? cards : [],
    };
    // Keep live measurements: the ES2017 object-spread transform would snapshot inline getters.
    Object.defineProperties(hero, {
        clientWidth: { get: () => heroWidth },
        clientHeight: { get: () => heroHeight },
    });
    defineGlobal('IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true });
    defineGlobal('window', { value: globalThis });
    defineGlobal('scrollY', { get: () => position });
    defineGlobal('innerWidth', { get: () => heroWidth });
    defineGlobal('innerHeight', { get: () => viewportHeight });
    defineGlobal('IntersectionObserver', { value: VisibilityObserver });
    defineGlobal('requestAnimationFrame', { value: (callback: FrameRequestCallback) => {
        const id = ++nextFrameId;
        scheduledFrames.set(id, callback);
        return id;
    } });
    defineGlobal('cancelAnimationFrame', { value: (id: number) => { scheduledFrames.delete(id); } });
    defineGlobal('addEventListener', { value: (name: string, listener: () => void) => { windowListeners.set(name, listener); } });
    defineGlobal('removeEventListener', { value: (name: string) => { windowListeners.delete(name); } });
    defineGlobal('document', { value: {
        get hidden() { return documentHidden; },
        getElementById,
        addEventListener: (name: string, listener: () => void) => { documentListeners.set(name, listener); },
        removeEventListener: (name: string) => { documentListeners.delete(name); },
    } });
});

afterEach(async () => {
    await act(() => { renderer?.unmount(); });
    renderer = undefined;
    expect(decorativeFrames.size).toBe(0);
    expect(scheduledFrames.size).toBe(0);
    expect(observers.every(observer => observer.disconnected)).toBe(true);
    for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    }
    descriptors.clear();
});

describe('Hero as an independent section', () => {
    it('keeps its own layout and copy during scrolling without reading or writing a gallery slot', async () => {
        await mountHero();
        await setIntersection(1);
        const stageWrites = [...stage.styleWrites];
        const copyWrites = [...copy.styleWrites];

        await moveTo(600);
        await setIntersection(0.3);
        expect(cameraPlaying()).toBe(true);
        expect(decorativeFrames.size).toBe(1);
        await moveTo(1600);
        await setIntersection(0);
        await moveTo(0);
        await setIntersection(1);

        expect(getElementById).not.toHaveBeenCalled();
        expect(stage.styleWrites).toEqual(stageWrites);
        expect(copy.styleWrites).toEqual(copyWrites);
        expect(stage.classes.has('is-docked')).toBe(false);
        expect(hero.classes.has('is-collapsing')).toBe(false);
        expect(cameraPlaying()).toBe(true);
    });

    it('pauses the camera and decorative loop offscreen, then resumes when part of the hero is visible', async () => {
        await mountHero();
        const observer = observers.at(-1)!;
        expect([...observer.observed]).toEqual([hero]);
        expect(cameraPlaying()).toBe(false);
        expect(decorativeFrames.size).toBe(0);
        await setIntersection(1);
        expect(cameraPlaying()).toBe(true);
        expect(decorativeFrames.size).toBe(1);

        await setIntersection(0);
        expect(cameraPlaying()).toBe(false);
        expect(decorativeFrames.size).toBe(0);
        expect(hero.classes.has('is-paused')).toBe(true);
        await setIntersection(0.005);
        expect(cameraPlaying()).toBe(false);
        expect(decorativeFrames.size).toBe(0);
        await setIntersection(0.05);
        expect(cameraPlaying()).toBe(true);
        expect(decorativeFrames.size).toBe(1);
        expect(hero.classes.has('is-paused')).toBe(false);
        await setIntersection(0.5);
        expect(decorativeFrames.size).toBe(1);
    });

    it('pauses a hidden tab and only resumes if the hero is also onscreen', async () => {
        await mountHero();
        await setIntersection(1);
        await act(() => {
            documentHidden = true;
            documentListeners.get('visibilitychange')?.();
        });
        expect(cameraPlaying()).toBe(false);
        expect(decorativeFrames.size).toBe(0);

        await setIntersection(0.5);
        expect(cameraPlaying()).toBe(false);
        expect(decorativeFrames.size).toBe(0);
        await setIntersection(0);
        await act(() => {
            documentHidden = false;
            documentListeners.get('visibilitychange')?.();
        });
        expect(cameraPlaying()).toBe(false);
        expect(decorativeFrames.size).toBe(0);
        await setIntersection(0.5);
        expect(cameraPlaying()).toBe(true);
        expect(decorativeFrames.size).toBe(1);
    });

    it('uses the stable mobile section height when the browser toolbar changes innerHeight', async () => {
        heroWidth = 390;
        heroHeight = 844;
        viewportHeight = 844;
        await mountHero();
        await setIntersection(0.3);
        expect(world.style.height).toBe('844px');
        const phoneWidth = phone.style.values['--hp'];
        const stageWrites = [...stage.styleWrites];
        const copyWrites = [...copy.styleWrites];

        viewportHeight = 1000;
        windowListeners.get('resize')?.();
        await flushFrame();

        expect(world.style.height).toBe('844px');
        expect(phone.style.values['--hp']).toBe(phoneWidth);
        expect(stage.styleWrites).toEqual(stageWrites);
        expect(copy.styleWrites).toEqual(copyWrites);
        expect(cameraPlaying()).toBe(true);
        expect(decorativeFrames.size).toBe(1);
        expect(getElementById).not.toHaveBeenCalled();
    });

    it('resumes the interview when reduced motion is turned off and the hero is visible', async () => {
        await mountHero();
        await setIntersection(1);
        expect(cameraPlaying()).toBe(true);
        await act(() => {
            reducedMotion = true;
            renderer!.update(createElement(Hero));
        });
        expect(cameraPlaying()).toBe(false);
        expect(decorativeFrames.size).toBe(0);

        await act(() => {
            reducedMotion = false;
            renderer!.update(createElement(Hero));
        });
        await setIntersection(1);
        expect(cameraPlaying()).toBe(true);
        expect(decorativeFrames.size).toBe(1);
    });
});
