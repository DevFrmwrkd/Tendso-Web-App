import { createElement, type ReactNode } from 'react';
import { QuizStep } from '@/app/certification-quiz/_components/QuizStep';
import CertificationQuizPage from '@/app/certification-quiz/page';
import { QUIZ } from '@/app/training/_funnel/content';
import type { Id } from '@/convex/_generated/dataModel';

jest.mock('react', () => jest.requireActual('../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('next/link', () => function Link({ children, ...props }: { children?: ReactNode }) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('a', props, children);
});
jest.mock('next/navigation', () => ({ useRouter: () => navigation }));
jest.mock('@clerk/nextjs', () => ({ useUser: () => ({ user, isLoaded: loaded }) }));
jest.mock('convex/react', () => ({
    useMutation: () => markQuizPassed,
    useQuery: () => creator,
}));
jest.mock('@/convex/_generated/api', () => ({ api: { creators: { markQuizPassed: 'quiz-pass', getByClerkId: 'creator' } } }));
jest.mock('@/components/field-agent-onboarding/OnboardingShell', () => {
    const React = jest.requireActual('../apps/mobile/node_modules/react');
    return {
        OnboardingShell: function Shell({ children, title }: { children: ReactNode; title: ReactNode }) { return React.createElement('main', null, title, children); },
        OnboardingLoading: function Loading() { return React.createElement('p', null, 'Loading your progress'); },
    };
});

interface TestNode {
    type: unknown;
    props: Record<string, unknown>;
    children: (TestNode | string)[];
    findAllByType(type: string): TestNode[];
}
interface TestRenderer { root: TestNode; update(element: ReactNode): void; unmount(): void }
const { create, act } = jest.requireActual('../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode, options?: { createNodeMock: () => unknown }): TestRenderer;
    act(callback: () => void | Promise<void>): Promise<void>;
};
const navigation = { push: jest.fn(), replace: jest.fn() };
const markQuizPassed = jest.fn();
const focus = jest.fn();
const creatorId = 'example-creator' as Id<'creators'>;
let renderer: TestRenderer | undefined;
let user: { id: string } | null;
let loaded: boolean;
let creator: { _id: Id<'creators'>; role?: string } | null | undefined;
let consoleError: jest.SpyInstance;

function text(node: TestNode | string): string { return typeof node === 'string' ? node : node.children.map(text).join(''); }
function button(label: string): TestNode {
    const found = renderer!.root.findAllByType('button').find(node => text(node).trim() === label);
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
}
function links() { return renderer!.root.findAllByType('a').map(node => ({ label: text(node).trim(), href: node.props.href })); }
async function mount(element: ReactNode = createElement(QuizStep, { creatorId })) {
    await act(() => { renderer = create(element, { createNodeMock: () => ({ focus }) }); });
}
async function press(label: string) {
    await act(async () => { await (button(label).props.onClick as () => void | Promise<void>)(); });
}
async function select(index: number) {
    await act(() => { (renderer!.root.findAllByType('input')[index].props.onChange as () => void)(); });
}
async function answer(index: number, questionIndex: number) {
    await select(index);
    await press('Check answer');
    await press(questionIndex === QUIZ.length - 1 ? 'See result' : 'Next question');
}
async function complete(indices = QUIZ.map(question => question.correct)) {
    for (let index = 0; index < indices.length; index += 1) await answer(indices[index], index);
}

beforeEach(() => {
    jest.clearAllMocks();
    user = { id: 'clerk-example' };
    loaded = true;
    creator = { _id: creatorId, role: 'creator' };
    markQuizPassed.mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
    Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback) => { callback(0); return 1; } });
    const originalError = console.error;
    consoleError = jest.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
        if (String(message).includes('react-test-renderer is deprecated')) return;
        originalError(message, ...args);
    });
});
afterEach(async () => {
    await act(() => { renderer?.unmount(); });
    renderer = undefined;
    consoleError.mockRestore();
    Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
});

it('requires a choice and locks the checked answer while showing the correct response', async () => {
    await mount();
    expect(button('Check answer').props.disabled).toBe(true);
    await select(0);
    expect(button('Check answer').props.disabled).toBe(false);
    await press('Check answer');
    expect(text(renderer!.root)).toContain(`The correct answer is B: ${QUIZ[0].options[1]}`);
    expect(renderer!.root.findAllByType('input').every(node => node.props.disabled)).toBe(true);
    expect(markQuizPassed).not.toHaveBeenCalled();
});

it('keeps all five correct answer indexes and the four-of-five pass rule', async () => {
    expect(QUIZ.map(question => question.correct)).toEqual([1, 1, 2, 1, 1]);
    expect(QUIZ[4].question).not.toMatch(/paid|payout|earn/i);
    await mount();
    await complete(QUIZ.map((question, index) => index === 0 ? 0 : question.correct));
    expect(text(renderer!.root)).toContain('You passed the quiz.');
    expect(text(renderer!.root)).toContain('4 / 5');
    expect(markQuizPassed).toHaveBeenCalledTimes(1);
    expect(markQuizPassed).toHaveBeenCalledWith({ id: creatorId });
    expect(links()).toContainEqual({ label: 'Continue to review', href: '/pending' });
    expect(text(renderer!.root)).toContain('Your certificate appears after the team approves');
});

it('keeps a failed save separate from successful submission and retries without changing the answers', async () => {
    markQuizPassed.mockRejectedValueOnce(new Error('Network failure'));
    await mount();
    await complete();
    expect(text(renderer!.root)).toContain('We couldn’t save your result.');
    expect(text(renderer!.root)).toContain('5 / 5');
    expect(links().some(link => link.href === '/pending')).toBe(false);
    expect(text(renderer!.root)).not.toContain('Your quiz pass is saved.');
    await press('Retry saving result');
    expect(markQuizPassed).toHaveBeenCalledTimes(2);
    expect(text(renderer!.root)).toContain('5 / 5');
    expect(text(renderer!.root)).toContain('Your quiz pass is saved.');
    expect(links()).toContainEqual({ label: 'Continue to review', href: '/pending' });
});

it('does not expose Continue or submit again while the result is still saving', async () => {
    let finish!: () => void;
    markQuizPassed.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    await mount();
    for (let index = 0; index < QUIZ.length - 1; index += 1) await answer(QUIZ[index].correct, index);
    await select(QUIZ[QUIZ.length - 1].correct);
    await press('Check answer');
    await act(() => { void (button('See result').props.onClick as () => Promise<void>)(); });
    expect(button('Saving…').props.disabled).toBe(true);
    expect(links().some(link => link.href === '/pending')).toBe(false);
    await act(() => { void (button('Saving…').props.onClick as () => Promise<void>)(); });
    expect(markQuizPassed).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await Promise.resolve(); });
    expect(links()).toContainEqual({ label: 'Continue to review', href: '/pending' });
});

it('keeps missing-account results local and asks the person to sign in again', async () => {
    await mount(createElement(QuizStep));
    await complete();
    expect(markQuizPassed).not.toHaveBeenCalled();
    expect(links()).toContainEqual({ label: 'Sign in again', href: '/login' });
    expect(links().some(link => link.href === '/pending')).toBe(false);
});

it('offers unlimited retakes after a failure without marking the quiz as passed', async () => {
    await mount();
    await complete(QUIZ.map(question => (question.correct + 1) % question.options.length));
    expect(text(renderer!.root)).toContain('Let’s try that again.');
    expect(text(renderer!.root)).toContain('0 / 5');
    expect(markQuizPassed).not.toHaveBeenCalled();
    await press('Try again');
    expect(text(renderer!.root)).toContain('Question 1 of 5');
    expect(button('Check answer').props.disabled).toBe(true);
    expect(renderer!.root.findAllByType('input').every(node => node.props.checked === false)).toBe(true);
});

it('reviews the first missed lesson after a failed attempt', async () => {
    await mount();
    await complete(QUIZ.map((question, index) => index === 1 || index === 2 ? 0 : question.correct));
    await press('Review the lessons');
    expect(navigation.push).toHaveBeenCalledWith('/training-lessons?lesson=2');
    expect(markQuizPassed).not.toHaveBeenCalled();
});

it.each([
    ['affiliate', '/affiliates/dashboard', 'replace'],
    ['staff', '/admin', 'replace'],
    ['admin', '/admin', 'push'],
])('preserves the %s account redirect', async (role, destination, action) => {
    creator = { _id: creatorId, role };
    await mount(createElement(CertificationQuizPage));
    expect(navigation[action as 'push' | 'replace']).toHaveBeenCalledWith(destination);
    expect(renderer!.root.findAllByType('input')).toHaveLength(0);
});

it('preserves sign-in routing and keeps the quiz hidden while account details load', async () => {
    user = null;
    creator = undefined;
    await mount(createElement(CertificationQuizPage));
    expect(navigation.push).toHaveBeenCalledWith('/login');
    expect(text(renderer!.root)).toContain('Loading your progress');
    expect(markQuizPassed).not.toHaveBeenCalled();
});

it('resets local quiz progress when the signed-in creator changes', async () => {
    await mount(createElement(CertificationQuizPage));
    await answer(QUIZ[0].correct, 0);
    expect(text(renderer!.root)).toContain('Question 2 of 5');
    creator = { _id: 'another-example-creator' as Id<'creators'>, role: 'creator' };
    await act(() => { renderer!.update(createElement(CertificationQuizPage)); });
    expect(text(renderer!.root)).toContain('Question 1 of 5');
    expect(button('Check answer').props.disabled).toBe(true);
    expect(markQuizPassed).not.toHaveBeenCalled();
});
