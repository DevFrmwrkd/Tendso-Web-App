import { createElement, type ReactNode } from 'react';
import LoginForm from '@/app/login/LoginForm';
import { SignInContinue } from '@/app/auth/continue/SignInContinue';
import type { SignInSession } from '@/lib/signInDestination';

jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@/convex/_generated/api', () => ({ api: jest.requireActual('convex/server').anyApi }));
jest.mock('@clerk/nextjs', () => ({
    useAuth: () => ({ isLoaded: state.loaded, isSignedIn: state.signedIn }),
    useUser: () => ({ isLoaded: state.loaded, isSignedIn: state.signedIn, user: state.userId ? { id: state.userId } : null }),
    SignIn: (props: unknown) => { widget(props); return null; },
    SignOutButton: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('convex/react', () => ({
    useConvexAuth: () => state.convex,
    useQuery: (_reference: unknown, args: unknown) => { query(args); return args === 'skip' ? undefined : state.session; },
}));
jest.mock('next/navigation', () => ({ useRouter: () => navigation }));
jest.mock('next/link', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    return function MockLink({ children, ...props }: { children: ReactNode }) { return React.createElement('a', props, children); };
});
jest.mock('@/app/auth/_components/AuthFrame', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    return { AUTH_BODY: 'auth-body', AuthFrame: ({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) => React.createElement('section', null, title, sub, children) };
});
jest.mock('@/app/auth/_components/AuthParts', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    return { SigningIn: ({ line }: { line: string }) => React.createElement('div', { role: 'status' }, line) };
});
jest.mock('@/components/r1', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    return { Button: ({ children }: { children: ReactNode }) => React.createElement('button', null, children) };
});

interface Node { children: (Node | string)[] }
interface Renderer { toJSON(): Node; update(element: ReactNode): void; unmount(): void }
const { create, act } = jest.requireActual('../../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode): Renderer;
    act(callback: () => void): Promise<void>;
};
const text = (node: Node | string): string => typeof node === 'string' ? node : (node.children ?? []).map(text).join(' ');
const navigation = { replace: jest.fn() };
const query = jest.fn();
const widget = jest.fn();
const ownSession = (actor = 'current-user', role = 'affiliate'): SignInSession => ({ clerkId: actor, isOwner: false,
    creator: { clerkId: actor, role, status: 'active', certifiedAt: 1 } });
const state = {
    loaded: true, signedIn: true, userId: 'current-user' as string | null,
    convex: { isLoading: false, isAuthenticated: true },
    session: ownSession() as SignInSession | null | undefined,
};
let renderer: Renderer | undefined;
let errors: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    state.loaded = true; state.signedIn = true; state.userId = 'current-user';
    state.convex = { isLoading: false, isAuthenticated: true }; state.session = ownSession();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const error = console.error;
    errors = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        if (String(args[0]).includes('react-test-renderer is deprecated')) return;
        error(...args);
    });
});
afterEach(async () => { if (renderer) await act(() => renderer!.unmount()); renderer = undefined; errors.mockRestore(); });

describe('common sign-in screen', () => {
    it('uses the configured Clerk methods and sends completed sign-in through verified role routing', async () => {
        state.signedIn = false; state.userId = null;
        await act(() => { renderer = create(createElement(LoginForm, { returnTo: '/dashboard' })); });
        expect(widget).toHaveBeenCalledWith(expect.objectContaining({ forceRedirectUrl: '/auth/continue', routing: 'hash' }));
        expect(navigation.replace).not.toHaveBeenCalled();
        expect(query).not.toHaveBeenCalled();
    });
    it('does not send an already-signed-in owner or creator through the field-agent dashboard', async () => {
        await act(() => { renderer = create(createElement(LoginForm, { returnTo: '/dashboard' })); });
        expect(widget).not.toHaveBeenCalled();
        expect(navigation.replace).toHaveBeenCalledWith('/auth/continue');
        expect(navigation.replace).not.toHaveBeenCalledWith('/dashboard');
    });
    it('retains a validated requested workspace through the provider handoff', async () => {
        state.signedIn = false; state.userId = null;
        await act(() => { renderer = create(createElement(LoginForm, { returnTo: '/my-business/visits/visit-one' })); });
        expect(widget).toHaveBeenCalledWith(expect.objectContaining({ forceRedirectUrl: '/auth/continue?returnTo=%2Fmy-business%2Fvisits%2Fvisit-one' }));
    });
});

describe('verified account continuation', () => {
    it('waits across an account switch until the Convex session and account match the new Clerk identity', async () => {
        await act(() => { renderer = create(createElement(SignInContinue, { returnTo: '/dashboard' })); });
        expect(navigation.replace).toHaveBeenLastCalledWith('/affiliates/dashboard');
        navigation.replace.mockClear();
        state.userId = 'new-admin';
        await act(() => renderer!.update(createElement(SignInContinue, { returnTo: '/dashboard' })));
        expect(navigation.replace).not.toHaveBeenCalled();
        state.session = { ...ownSession('current-user'), clerkId: 'new-admin' };
        await act(() => renderer!.update(createElement(SignInContinue, { returnTo: '/dashboard' })));
        expect(navigation.replace).not.toHaveBeenCalled();
        state.session = ownSession('new-admin', 'admin');
        await act(() => renderer!.update(createElement(SignInContinue, { returnTo: '/dashboard' })));
        expect(navigation.replace).toHaveBeenLastCalledWith('/admin');
    });
    it.each(['Clerk loading', 'signed out', 'Convex loading', 'Convex signed out'])('skips private session queries while %s', async condition => {
        if (condition === 'Clerk loading') state.loaded = false;
        if (condition === 'signed out') { state.signedIn = false; state.userId = null; }
        if (condition === 'Convex loading') state.convex.isLoading = true;
        if (condition === 'Convex signed out') state.convex.isAuthenticated = false;
        await act(() => { renderer = create(createElement(SignInContinue, { returnTo: '/dashboard' })); });
        expect(query.mock.calls.every(([args]) => args === 'skip')).toBe(true);
        expect(navigation.replace).toHaveBeenCalledTimes(condition === 'signed out' ? 1 : 0);
        if (condition === 'signed out') expect(navigation.replace).toHaveBeenCalledWith('/login');
    });
    it('opens an existing owner’s Today workspace without making an account or role', async () => {
        state.session = { clerkId: 'current-user', creator: null, isOwner: true };
        await act(() => { renderer = create(createElement(SignInContinue, { returnTo: '/dashboard' })); });
        expect(navigation.replace).toHaveBeenCalledWith('/my-business/today');
    });
    it('shows blocked account recovery instead of redirecting a suspended team member back into a loop', async () => {
        state.session = ownSession('current-user', 'admin'); state.session.creator!.status = 'suspended';
        await act(() => { renderer = create(createElement(SignInContinue, { returnTo: '/admin' })); });
        expect(text(renderer!.toJSON())).toContain('paused');
        expect(text(renderer!.toJSON())).toContain('Sign out');
        expect(navigation.replace).not.toHaveBeenCalled();
    });
});
