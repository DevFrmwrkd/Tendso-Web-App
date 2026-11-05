import { createElement, type ReactNode } from 'react';
import { AskTendsoInline, AskTendsoLauncher } from '@/components/v2/chat/AskTendso';
import { useKnowledgeSession } from '@/components/v2/chat/useKnowledgeSession';
import { PrivateKnowledgeArticle } from '@/app/knowledge/_components/PrivateKnowledgeArticle';

jest.mock('react', () => jest.requireActual('../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@/components/v2/chat/chat.css', () => ({}));
jest.mock('@/convex/_generated/api', () => ({ api: {
    knowledge: { viewerContext: 'viewer', articleForViewer: 'article' }, knowledgeAI: { ask: 'ask' },
} }));
jest.mock('@clerk/nextjs', () => ({ useAuth: () => state.clerk }));
jest.mock('convex/react', () => ({
    useConvexAuth: () => state.auth,
    useQuery: (name: unknown, args: unknown) => {
        queries.push({ name, args });
        return args === 'skip' ? undefined : name === 'viewer' ? state.viewer : state.article;
    },
    useAction: () => askAction,
}));
jest.mock('next/link', () => function MockLink({ children, ...props }: { children?: ReactNode }) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('a', props, children);
});
jest.mock('@/components/v2', () => {
    const React = jest.requireActual('../apps/mobile/node_modules/react');
    return {
        Container: function MockContainer({ children, ...props }: { children?: ReactNode }) { return React.createElement('div', props, children); },
        Button: function MockButton({ children, ...props }: { children?: ReactNode }) { return React.createElement('a', props, children); },
    };
});
jest.mock('@/components/v2/pages-b/shared', () => ({ PbPage: function MockPage({ children }: { children?: ReactNode }) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('main', null, children);
} }));
jest.mock('@/app/knowledge/_components/KnowledgeArticle', () => ({ KnowledgeArticle: function MockArticle({ article }: { article: { title: string; body: { text: string }[] } }) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('article', null, article.title, article.body[0]?.text);
} }));

interface TestNode {
    type: unknown;
    props: Record<string, unknown>;
    children: (TestNode | string)[];
    findAllByType(type: string): TestNode[];
}
interface TestRenderer { root: TestNode; update(element: ReactNode): void; unmount(): void }
const { create, act } = jest.requireActual('../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode): TestRenderer;
    act(callback: () => void | Promise<void>): Promise<void>;
};
type Audience = 'everyone' | 'owner' | 'affiliate' | 'field_agent' | 'admin';
const viewer = (audience: Audience = 'admin', actor: string | null = 'alice') => ({
    clerkId: actor, authenticated: actor !== null, audience, canAccessWiki: audience === 'admin' || audience === 'field_agent',
    isAdmin: audience === 'admin', blocked: false,
});
const state = {
    clerk: { userId: 'alice' as string | null, sessionId: 'session-a' as string | null, isLoaded: true },
    auth: { isLoading: false, isAuthenticated: true },
    viewer: viewer() as ReturnType<typeof viewer> | undefined,
    article: undefined as { viewer: ReturnType<typeof viewer>; article: { title: string; body: { text: string }[]; workspace: string } | null } | undefined,
};
const queries: { name: unknown; args: unknown }[] = [];
const askAction = jest.fn();
let renderer: TestRenderer | undefined;
let error: jest.SpyInstance;
function text(node: TestNode | string): string { return typeof node === 'string' ? node : node.children.map(text).join(''); }
function input() { return renderer!.root.findAllByType('input')[0]; }
function form() { return renderer!.root.findAllByType('form')[0]; }
function page(floating = false) { return createElement(floating ? AskTendsoLauncher : AskTendsoInline); }
async function mount(element: ReactNode = page()) { await act(() => { renderer = create(element); }); }
async function rerender(element: ReactNode = page()) { await act(() => { renderer!.update(element); }); }
async function type(question: string) { await act(() => { (input().props.onChange as (e: unknown) => void)({ target: { value: question } }); }); }
async function submit(question: string) {
    await type(question);
    await act(() => { (form().props.onSubmit as (e: unknown) => void)({ preventDefault: jest.fn() }); });
}
async function openLauncher() {
    const button = renderer!.root.findAllByType('button').find(node => node.props.className === 'at-fab');
    await act(() => { (button!.props.onClick as () => void)(); });
}

beforeEach(() => {
    jest.clearAllMocks(); queries.length = 0;
    state.clerk = { userId: 'alice', sessionId: 'session-a', isLoaded: true };
    state.auth = { isLoading: false, isAuthenticated: true };
    state.viewer = viewer(); state.article = undefined;
    askAction.mockResolvedValue({ answer: 'Private answer [1]', grounded: true, sources: [{ slug: 'admin-guide', title: 'Admin guide' }] });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const original = console.error;
    error = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        if (String(args[0]).includes('react-test-renderer is deprecated')) return;
        original(...args);
    });
});
afterEach(async () => { if (renderer) await act(() => { renderer!.unmount(); }); renderer = undefined; error.mockRestore(); });

describe('web Ask Tendso verified sessions', () => {
    it.each([
        ['everyone', 'How much does it cost?'], ['owner', 'What is my website status?'],
        ['affiliate', 'How do creator codes work?'], ['field_agent', 'How much do I keep per site?'],
        ['admin', 'How do I manage knowledge access?'],
    ] as const)('automatically offers %s suggestions and omits caller-selected workspace', async (audience, starter) => {
        if (audience === 'everyone') {
            state.clerk.userId = null; state.clerk.sessionId = null; state.auth.isAuthenticated = false;
        }
        state.viewer = viewer(audience, state.clerk.userId);
        await mount();
        const chip = renderer!.root.findAllByType('button').find(node => text(node) === starter);
        expect(chip).toBeDefined();
        await act(() => { (chip!.props.onClick as () => void)(); });
        expect(askAction).toHaveBeenCalledWith({ query: starter, source: 'web', history: [] });
        expect(askAction.mock.calls[0][0]).not.toHaveProperty('workspace');
        expect(text(renderer!.root)).toContain('Private answer');
        expect(renderer!.root.findAllByType('a').some(node => node.props.href === '/knowledge/admin-guide')).toBe(true);
    });

    it('withholds the chat while Clerk/Convex identities are unresolved or disagree', async () => {
        state.viewer = viewer('admin', 'previous-admin');
        await mount();
        expect(renderer!.root.findAllByType('input')).toHaveLength(0);
        expect(text(renderer!.root)).toContain('Loading Ask Tendso');
        state.viewer = viewer(); state.auth.isAuthenticated = false;
        await rerender();
        expect(renderer!.root.findAllByType('input')).toHaveLength(0);
        expect(queries[queries.length - 1].args).toBe('skip');
        expect(askAction).not.toHaveBeenCalled();
    });

    it.each(['actor', 'session', 'role'] as const)('resets input, answers and history during a %s change', async change => {
        await mount();
        await submit('My private question');
        expect(text(renderer!.root)).toContain('Private answer');
        await type('Unsent private text');
        if (change === 'actor') { state.clerk.userId = 'bob'; state.viewer = viewer('owner', 'bob'); }
        if (change === 'session') state.clerk.sessionId = 'session-b';
        if (change === 'role') state.viewer = viewer('affiliate');
        await rerender();
        expect(text(renderer!.root)).not.toContain('Private answer');
        expect(text(renderer!.root)).not.toContain('My private question');
        expect(input().props.value).toBe('');
        await submit('Fresh account question');
        expect(askAction).toHaveBeenLastCalledWith({ query: 'Fresh account question', source: 'web', history: [] });
    });

    it.each(['actor', 'session', 'role'] as const)('discards an old private request completing after a %s change', async change => {
        let finish!: (value: unknown) => void;
        askAction.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        await mount(); await submit('Old private question');
        if (change === 'actor') { state.clerk.userId = 'bob'; state.viewer = viewer('owner', 'bob'); }
        if (change === 'session') state.clerk.sessionId = 'session-b';
        if (change === 'role') state.viewer = viewer('affiliate');
        await rerender();
        await act(async () => { finish({ answer: 'Delayed private admin answer', grounded: true, sources: [] }); });
        expect(text(renderer!.root)).not.toContain('Delayed private admin answer');
        expect(text(renderer!.root)).not.toContain('Old private question');
        await submit('New role question');
        expect(askAction).toHaveBeenLastCalledWith({ query: 'New role question', source: 'web', history: [] });
    });

    it('removes an existing transcript immediately when a new actor arrives before its viewer query', async () => {
        await mount(); await submit('Private admin question');
        state.clerk.userId = 'bob'; await rerender();
        expect(renderer!.root.findAllByType('input')).toHaveLength(0);
        expect(text(renderer!.root)).not.toContain('Private admin question');
        expect(text(renderer!.root)).not.toContain('Private answer');
    });

    it('resets the floating chat and its input when its verified role changes', async () => {
        await mount(page(true)); await openLauncher(); await submit('Private admin question');
        expect(askAction).toHaveBeenCalledWith({ query: 'Private admin question', source: 'chatbot', history: [] });
        await type('Private unsent text');
        state.viewer = viewer('owner'); await rerender(page(true));
        expect(renderer!.root.findAllByType('input')).toHaveLength(0);
        await openLauncher();
        expect(input().props.value).toBe('');
        expect(text(renderer!.root)).not.toContain('Private admin question');
        expect(text(renderer!.root)).toContain('What is my website status?');
    });

    it('binds the hook session key to the verified actor, session, role and wiki access', async () => {
        const Probe = () => createElement('output', null, JSON.stringify(useKnowledgeSession()));
        await mount(createElement(Probe));
        const original = text(renderer!.root);
        state.viewer = { ...viewer(), canAccessWiki: false };
        await rerender(createElement(Probe));
        expect(text(renderer!.root)).not.toBe(original);
        state.viewer = viewer('admin', 'previous-admin'); await rerender(createElement(Probe));
        const result = JSON.parse(text(renderer!.root));
        expect(result.ready).toBe(false);
        expect(result.viewer).toBeUndefined();
    });
});

describe('web private knowledge article session pairing', () => {
    const article = { title: 'Private admin article', body: [{ text: 'Confidential admin body' }], workspace: 'wiki' };
    const page = () => createElement(PrivateKnowledgeArticle, { slug: 'private-guide' });

    it('does not render retained private article data for a new actor or role', async () => {
        state.article = { viewer: viewer(), article };
        await mount(page()); expect(text(renderer!.root)).toContain('Confidential admin body');
        state.clerk.userId = 'bob'; state.viewer = viewer('owner', 'bob');
        await rerender(page());
        expect(text(renderer!.root)).not.toContain('Confidential admin body');
        expect(text(renderer!.root)).toContain('Opening the article');
        state.article = { viewer: viewer('owner', 'bob'), article: null }; await rerender(page());
        expect(text(renderer!.root)).toContain('This article isn’t available');
    });

    it('withholds a formerly allowed wiki article while permission data catches up', async () => {
        state.article = { viewer: viewer(), article }; await mount(page());
        state.viewer = { ...viewer(), canAccessWiki: false }; await rerender(page());
        expect(text(renderer!.root)).not.toContain('Confidential admin body');
        state.article = { viewer: state.viewer, article: null }; await rerender(page());
        expect(text(renderer!.root)).toContain('This article isn’t available');
    });
});
