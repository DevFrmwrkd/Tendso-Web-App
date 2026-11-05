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
    onFrame: (callback: () => void) => {
        nextFrame = callback;
        return () => { nextFrame = undefined; };
    },
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
interface LayerStyle { transform: string; visibility: string; values: Record<string, string>; setProperty(name: string, value: string): void }

let reducedMotion = false;
let nextFrame: (() => void) | undefined;
let renderer: TestRenderer | undefined;
let layers: { style: LayerStyle }[];
let resize: (() => void) | undefined;
let position = 0;
let viewportHeight = 844;
const trackHeight = 5000;
const descriptors = new Map<string, PropertyDescriptor | undefined>();

function defineGlobal(name: string, descriptor: PropertyDescriptor) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
}

async function scrollToProgress(progress: number) {
    position = (trackHeight - viewportHeight) * progress;
    await act(() => { nextFrame?.(); });
}

beforeEach(() => {
    layers = Array.from({ length: 6 }, () => ({ style: {
        transform: '', visibility: '', values: {} as Record<string, string>,
        setProperty(name: string, value: string) { this.values[name] = value; },
    } }));
    position = 0;
    viewportHeight = 844;
    defineGlobal('IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true });
    defineGlobal('scrollY', { get: () => position });
    defineGlobal('innerHeight', { get: () => viewportHeight });
    defineGlobal('addEventListener', { value: (_name: string, listener: () => void) => { resize = listener; } });
    defineGlobal('removeEventListener', { value: () => { resize = undefined; } });
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
                createNodeMock: ({ props }) => props.className === 'st-track' ? {
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
        position = trackHeight - viewportHeight;
        await act(() => { resize?.(); });
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
});
