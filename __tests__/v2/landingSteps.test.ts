import { createElement, type ReactNode } from 'react';

import { Steps } from '@/components/landing-v2/Steps';

jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@/components/v2', () => ({
    Label: function MockLabel({ children }: { children: ReactNode }) { return children; },
    PhoneFrame: function MockPhoneFrame({ children }: { children: ReactNode }) { return children; },
}));
jest.mock('@/components/landing-v2/screens', () => ({
    WelcomeScreen: function MockWelcome() { return null; },
    DesignPickerScreen: function MockPicker() { return null; },
    InterviewCamScreen: function MockInterview() { return null; },
    ShotGuideScreen: function MockPhotos() { return null; },
    SiteBuildingScreen: function MockBuilding() { return null; },
    SiteReadyScreen: function MockReady() { return null; },
}));
jest.mock('@/components/landing-v2/motion', () => ({
    ...jest.requireActual('@/components/landing-v2/motion'),
    useReducedMotion: () => reducedMotion,
}));

interface TestNode {
    props: Record<string, unknown>;
    findAllByType(type: string): TestNode[];
}
interface TestRenderer { root: TestNode; unmount(): void }
const { create, act } = jest.requireActual('../../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode, options: { createNodeMock: (element: { props: Record<string, unknown> }) => unknown }): TestRenderer;
    act(callback: () => void): Promise<void>;
};
interface LayerStyle { transform: string; visibility: string; willChange: string; values: Record<string, string>; setProperty: jest.Mock<void, [string, string]> }

let reducedMotion = false;
let nextFrame: FrameRequestCallback | undefined;
let renderer: TestRenderer | undefined;
let layers: { style: LayerStyle }[];
let resize: (() => void) | undefined;
let scroll: (() => void) | undefined;
let position = 0;
let viewportHeight = 844;
let pinHeight = 844;
const trackHeight = 5000;
const descriptors = new Map<string, PropertyDescriptor | undefined>();

function defineGlobal(name: string, descriptor: PropertyDescriptor) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
}

async function scrollToProgress(progress: number) {
    position = (trackHeight - pinHeight) * progress;
    scroll?.();
    await flushFrame();
}

async function flushFrame() {
    await act(() => {
        const callback = nextFrame;
        nextFrame = undefined;
        callback?.(0);
    });
}

beforeEach(() => {
    layers = Array.from({ length: 6 }, () => ({ style: {
        transform: '', visibility: '', willChange: '', values: {} as Record<string, string>,
        setProperty: jest.fn(function (this: LayerStyle, name: string, value: string) { this.values[name] = value; }),
    } }));
    position = 0;
    viewportHeight = 844;
    pinHeight = 844;
    defineGlobal('IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true });
    defineGlobal('scrollY', { get: () => position });
    defineGlobal('innerHeight', { get: () => viewportHeight });
    defineGlobal('requestAnimationFrame', { value: (callback: FrameRequestCallback) => { nextFrame = callback; return 1; } });
    defineGlobal('cancelAnimationFrame', { value: () => { nextFrame = undefined; } });
    defineGlobal('addEventListener', { value: (name: string, listener: () => void) => {
        if (name === 'resize') resize = listener;
        if (name === 'scroll') scroll = listener;
    } });
    defineGlobal('removeEventListener', { value: (name: string) => {
        if (name === 'resize') resize = undefined;
        if (name === 'scroll') scroll = undefined;
    } });
});

afterEach(async () => {
    await act(() => { renderer?.unmount(); });
    renderer = undefined;
    for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    }
    descriptors.clear();
});

describe.each([false, true])('Steps with reduced motion %s', (reduced) => {
    beforeEach(async () => {
        reducedMotion = reduced;
        await act(() => {
            renderer = create(createElement(Steps), {
                createNodeMock: ({ props }) => props.className === 'st-pin' ? {
                    get clientHeight() { return pinHeight; },
                } : props.className === 'st-track' ? {
                    offsetHeight: trackHeight,
                    querySelectorAll: () => layers,
                    getBoundingClientRect: () => ({ top: -position, bottom: trackHeight - position }),
                } : null,
            });
        });
    });

    it('keeps the final screen bright and filling the phone at the end and after resize', async () => {
        await scrollToProgress(0.995);
        const finalScreen = layers.at(-1)!.style;
        expect(finalScreen.transform).toBe('translate3d(0, 0.00%, 0) scale(1.0000)');
        expect(finalScreen.values['--dim']).toBe('0.000');
        expect(finalScreen.visibility).toBe('visible');
        expect(renderer!.root.findAllByType('button').at(-1)!.props['aria-current']).toBe('step');

        viewportHeight = 650;
        pinHeight = 650;
        position = trackHeight - viewportHeight;
        resize?.();
        await flushFrame();
        expect(finalScreen.transform).toBe('translate3d(0, 0.00%, 0) scale(1.0000)');
        expect(finalScreen.values['--dim']).toBe('0.000');

        await scrollToProgress(1.1);
        expect(finalScreen.transform).toBe('translate3d(0, 0.00%, 0) scale(1.0000)');
        expect(finalScreen.values['--dim']).toBe('0.000');
    });

    it('still recedes the previous screen when transitioning into the final screen', async () => {
        await scrollToProgress(4.95 / 6);
        expect(Number(layers[4].style.values['--dim'])).toBeGreaterThan(0);
        expect(layers[4].style.transform).not.toContain('scale(1.0000)');

        await scrollToProgress(5.05 / 6);
        expect(layers[5].style.transform).toBe('translate3d(0, 0.00%, 0) scale(1.0000)');
        expect(layers[5].style.values['--dim']).toBe('0.000');
    });

    it('keeps the active step stable when the mobile toolbar changes the visual viewport', async () => {
        await scrollToProgress(2.9 / 6);
        const buttons = () => renderer!.root.findAllByType('button');
        expect(buttons()[3].props['aria-current']).toBe('step');
        viewportHeight = 650;
        resize?.();
        await flushFrame();
        expect(buttons()[3].props['aria-current']).toBe('step');
        expect(buttons()[2].props['aria-current']).toBeUndefined();
    });

    it('does not keep an idle frame loop or repaint an unchanged final-screen hold', async () => {
        expect(nextFrame).toBeUndefined();
        await scrollToProgress(5.3 / 6);
        const dimWrites = layers.map(layer => layer.style.setProperty.mock.calls.length);
        await scrollToProgress(5.8 / 6);
        expect(layers.map(layer => layer.style.setProperty.mock.calls.length)).toEqual(dimWrites);
        expect(nextFrame).toBeUndefined();
    });

    it('releases offscreen layers and recalculates the correct screen after re-entry', async () => {
        await scrollToProgress(1.5);
        expect(layers.every(layer => layer.style.willChange === 'auto')).toBe(true);
        const dimWrites = layers.map(layer => layer.style.setProperty.mock.calls.length);
        await scrollToProgress(1.6);
        expect(layers.map(layer => layer.style.setProperty.mock.calls.length)).toEqual(dimWrites);
        await scrollToProgress(3.4 / 6);
        expect(renderer!.root.findAllByType('button')[3].props['aria-current']).toBe('step');
        expect(layers[3].style.visibility).toBe('visible');
        expect(layers[3].style.willChange).toBe('transform');
    });
});
