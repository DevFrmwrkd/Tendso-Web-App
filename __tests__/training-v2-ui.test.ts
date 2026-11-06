import { createElement, type ReactNode } from 'react';

import { LearnStep } from '@/app/training/_funnel/LearnStep';
import { lessonIndexFromQuery, nextIncompleteLesson, TRAINING_LESSONS } from '@/app/training/_funnel/trainingContent';

jest.mock('react', () => jest.requireActual('../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('next/link', () => function MockLink({ children, ...props }: { children?: ReactNode }) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('a', props, children);
});
jest.mock('next/image', () => function MockImage(props: Record<string, unknown>) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('img', props);
});
jest.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => lessonQuery }) }));

interface TestNode {
    type: unknown;
    props: Record<string, unknown>;
    children: (TestNode | string)[];
    findAllByType(type: string): TestNode[];
}
interface TestRenderer { root: TestNode; unmount(): void }
const { create, act } = jest.requireActual('../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode, options?: { createNodeMock: () => unknown }): TestRenderer;
    act(callback: () => void | Promise<void>): Promise<void>;
};
let renderer: TestRenderer | undefined;
let lessonQuery: string | null = null;
const storage = new Map<string, string>();
let consoleError: jest.SpyInstance;
function text(node: TestNode | string): string { return typeof node === 'string' ? node : node.children.map(text).join(''); }
function button(label: string): TestNode {
    const found = renderer!.root.findAllByType('button').find(node => text(node).trim() === label || node.props['aria-label'] === label);
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
}
async function click(label: string) { await act(() => { (button(label).props.onClick as () => void)(); }); }
async function mount(userId = 'training-fixture-one') {
    await act(() => { renderer = create(createElement(LearnStep, { userId }), { createNodeMock: () => ({ focus: jest.fn() }) }); });
}
function quizLinks() { return renderer!.root.findAllByType('a').filter(node => node.props.href === '/certification-quiz'); }

beforeEach(() => {
    lessonQuery = null;
    storage.clear();
    const events = new EventTarget();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        dispatchEvent: events.dispatchEvent.bind(events),
    } });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
    const original = console.error;
    consoleError = jest.spyOn(console, 'error').mockImplementation((message: unknown, ...rest: unknown[]) => {
        if (String(message).includes('react-test-renderer is deprecated')) return;
        original(message, ...rest);
    });
});
afterEach(async () => {
    await act(() => { renderer?.unmount(); });
    renderer = undefined;
    consoleError.mockRestore();
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
});

it('accepts valid lesson review links and sends invalid or missing links to the overview', () => {
    expect(lessonIndexFromQuery('1')).toBe(0);
    expect(lessonIndexFromQuery('5')).toBe(4);
    for (const value of [null, '', ' ', '0', '6', '1.5', 'nope']) expect(lessonIndexFromQuery(value)).toBe(-1);
    expect(nextIncompleteLesson([false, false, true, false, false], 4)).toBe(0);
    expect(nextIncompleteLesson([true, true, true, true, false], 4)).toBe(-1);
});

it('shows a useful overview with a locked quiz before any lesson is completed', async () => {
    await mount();
    expect(text(renderer!.root)).toContain('A little practice. A better first visit.');
    expect(button('Take the quiz').props.disabled).toBe(true);
    expect(quizLinks()).toHaveLength(0);
    expect(renderer!.root.findAllByType('button').filter(node => String(node.props['aria-label']).startsWith('Lesson '))).toHaveLength(5);
});

it('opening and leaving a later lesson never marks earlier lessons as complete', async () => {
    await mount('training-open-only');
    await click('Lesson 5: The shots we need, not completed');
    expect(text(renderer!.root)).toContain('Include an owner portrait, the shop front, and a shot of the work they do.');
    await click('All lessons');
    expect(storage.has('tendso.lessons.v1.training-open-only')).toBe(false);
    expect(button('Take the quiz').props.disabled).toBe(true);
});

it('completes just the reviewed lesson and then opens the first unfinished lesson', async () => {
    lessonQuery = '5';
    await mount('training-out-of-order');
    await click('Got it · next lesson');
    expect(storage.get('tendso.lessons.v1.training-out-of-order')).toBe('00001');
    expect(renderer!.root.findAllByType('h2').map(text)).toContain('Good lighting');
    expect(button('Lesson 5: The shots we need, completed')).toBeDefined();
    expect(button('Take the quiz').props.disabled).toBe(true);
});

it('unlocks the quiz only after five individual completions, and relocks after undo', async () => {
    await mount('training-all-five');
    await click('Start learning');
    for (let index = 0; index < 4; index += 1) {
        await click('Got it · next lesson');
        expect(quizLinks()).toHaveLength(0);
    }
    await click('Finish lesson');
    expect(storage.get('tendso.lessons.v1.training-all-five')).toBe('11111');
    expect(quizLinks().length).toBeGreaterThan(0);
    await click('Lesson 2: Clear audio, completed');
    await click('Mark as not done');
    expect(storage.get('tendso.lessons.v1.training-all-five')).toBe('10111');
    expect(quizLinks()).toHaveLength(0);
    expect(button('Take the quiz').props.disabled).toBe(true);
});

it('restores saved completion for this user without leaking it to another user', async () => {
    storage.set('tendso.lessons.v1.training-returning', '10100');
    await mount('training-returning');
    expect(button('Lesson 1: Good lighting, completed')).toBeDefined();
    expect(button('Lesson 3: Photos that sell, completed')).toBeDefined();
    await click('Continue training');
    expect(renderer!.root.findAllByType('h2').map(text)).toContain('Clear audio');
    await act(() => { renderer!.unmount(); });
    await mount('training-another-person');
    expect(button('Lesson 1: Good lighting, not completed')).toBeDefined();
    expect(button('Take the quiz').props.disabled).toBe(true);
});

it('uses labeled portrait, shop-front and craft examples without promising payment for three photos', () => {
    const last = TRAINING_LESSONS[4];
    expect(last.photos.map(photo => photo.label)).toEqual(['Portrait', 'Shop front', 'Craft']);
    expect(JSON.stringify(last)).not.toMatch(/before you get paid|three photos are needed/i);
    expect(TRAINING_LESSONS.every(lesson => lesson.photos.every(photo => photo.alt.length > 20))).toBe(true);
});
