import { createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';

import { CreatorCodeSettings } from '@/app/affiliates/dashboard/_components/CreatorCodeSettings';
import { DashboardContent } from '@/app/affiliates/dashboard/_components/Dashboard';
import AffiliateJoinPage from '@/app/affiliates/join/page';
import { SignupFlow } from '@/components/v2/creators/SignupFlow';
import type { Doc } from '@/convex/_generated/dataModel';
import type { Availability } from '@/lib/v2/creatorTypes';

jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@clerk/nextjs', () => ({
    useAuth: () => ({ isLoaded: state.loaded, isSignedIn: state.signedIn, userId: state.user?.id }),
    useUser: () => ({ isLoaded: state.loaded, isSignedIn: state.signedIn, user: state.user }),
    useClerk: () => ({ signOut: jest.fn() }),
    useSignIn: () => ({ isLoaded: true, signIn: {} }),
    useSignUp: () => ({ isLoaded: true, signUp: {} }),
}));
jest.mock('convex/react', () => ({
    useConvexAuth: () => state.auth,
    useConvex: () => convexClient,
    useQuery: (...args: unknown[]) => liveQuery(...args),
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
        const name = getFunctionName(reference);
        mutationHook(name);
        if (name === 'creatorProgram:apply') return apply;
        if (name === 'affiliates:create') return createAffiliate;
        if (/:update(Code|CreatorCode)$/.test(name)) return updateCode;
        throw new Error(`Unexpected custom-code mutation: ${name}`);
    },
}));
jest.mock('@/convex/_generated/api', () => ({ api: jest.requireActual('convex/server').anyApi }));
jest.mock('next/link', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    return ({ children, ...props }: { children?: ReactNode }) => React.createElement('a', props, children);
});
jest.mock('next/navigation', () => ({ useRouter: () => navigation, useSearchParams: () => ({ get: () => null }) }));
jest.mock('@/app/auth/_components/AuthFrame', () => ({
    AUTH_BODY: 'auth-body',
    AuthFrame: ({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) => {
        const React = jest.requireActual('../../apps/mobile/node_modules/react');
        return React.createElement('main', null, React.createElement('h1', null, title), sub, children);
    },
}));
jest.mock('@/components/v2/creators/Photo', () => ({ Photo: () => null }));
jest.mock('@/app/affiliates/dashboard/_components/MyPage.module.css', () => ({}));
jest.mock('@/app/affiliates/dashboard/_components/PageSettings', () => ({ PageSettings: () => null }));
jest.mock('@/components/v2/creators/CreatorPagePreview', () => ({
    CreatorPagePreview: ({ card }: { card: { code: string | null; price: number } }) => jest.requireActual('../../apps/mobile/node_modules/react').createElement('div', { 'data-testid': 'public-card', 'data-code': card.code, 'data-price': card.price }),
}));
jest.mock('@/app/affiliates/dashboard/_components/ShareTools', () => ({
    ShareTools: ({ referralCode, price }: { referralCode?: string; price: number }) => jest.requireActual('../../apps/mobile/node_modules/react').createElement('div', { 'data-testid': 'sharing-materials', 'data-code': referralCode, 'data-price': price }),
}));

interface TestNode {
    type: unknown;
    props: Record<string, unknown>;
    children: (TestNode | string)[];
    findAllByType(type: string): TestNode[];
}
interface TestRenderer {
    root: TestNode;
    update(element: ReactNode): void;
    unmount(): void;
}
const { create, act } = require('../../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode): TestRenderer;
    act(callback: () => void | Promise<void>): Promise<void>;
};

const account: Doc<'creators'> = {
    _id: 'own-affiliate' as Doc<'creators'>['_id'], _creationTime: 1, clerkId: 'current-user',
    email: 'mika@example.com', firstName: 'Mika', lastName: 'Santos', role: 'affiliate', status: 'active', balance: 0,
    affiliateHandle: 'mika-shops', affiliateDisplayName: 'Mika Santos', referralCode: 'MIKA30', affiliatePrice: 2200,
};
type CodeSetup = { creatorId: Doc<'creators'>['_id']; code: string | null; canChoose: boolean; chosenAt: number | null };
function setup(code = 'MIKA30', canChoose = true, creatorId = account._id): CodeSetup {
    return { creatorId, code, canChoose, chosenAt: canChoose ? null : 100 };
}
const state = {
    loaded: true, signedIn: true,
    user: { id: 'current-user', fullName: 'Mika Santos', firstName: 'Mika', primaryEmailAddress: { emailAddress: 'mika@example.com' } } as { id: string; fullName: string; firstName: string; primaryEmailAddress: { emailAddress: string } } | null,
    auth: { isAuthenticated: true, isLoading: false, isRefreshing: false },
    publicCodeValue: undefined as string | undefined,
    takenCodes: new Set<string>(),
    setup: setup() as CodeSetup | Error | undefined,
};
const liveQuery = jest.fn();
const codeQuery = jest.fn();
const convexClient = { query: codeQuery };
const updateCode = jest.fn();
const apply = jest.fn();
const createAffiliate = jest.fn();
const mutationHook = jest.fn();
const navigation = { replace: jest.fn(), push: jest.fn() };
let renderer: TestRenderer | undefined;
let consoleError: jest.SpyInstance;

function availability(input: { handle?: string; code?: string }): Availability {
    const code = input.code;
    const taken = !!code && state.takenCodes.has(code);
    return {
        handle: input.handle ? { value: input.handle, available: true, error: null } : null,
        code: code ? { value: state.publicCodeValue ?? code, available: !taken, error: taken ? 'That code is already taken. Choose another one.' : null } : null,
    };
}
function text(node: TestNode | string): string {
    return typeof node === 'string' ? node : node.children.map(text).join('');
}
function input(label = 'Your creator code'): TestNode {
    const wrapper = renderer!.root.findAllByType('label').find(node => text(node).includes(label));
    const controls = renderer!.root.findAllByType('input');
    const found = wrapper?.findAllByType('input')[0]
        ?? controls.find(node => wrapper?.props.htmlFor && node.props.id === wrapper.props.htmlFor)
        ?? controls.find(node => node.props['aria-label'] === label);
    if (!found) throw new Error(`Input not found: ${label}`);
    return found;
}
function button(label: string): TestNode {
    const found = renderer!.root.findAllByType('button').find(node => text(node).trim() === label);
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
}
async function mount(element: ReactNode = createElement(CreatorCodeSettings, { account })) {
    await act(() => { renderer = create(element); });
}
async function rerender(element: ReactNode = createElement(CreatorCodeSettings, { account })) {
    await act(() => { renderer!.update(element); });
}
async function change(value: string, label = 'Your creator code') {
    await act(() => { (input(label).props.onChange as (event: { target: { value: string } }) => void)({ target: { value } }); });
}
async function settleDebounce() {
    await act(async () => { jest.advanceTimersByTime(400); await Promise.resolve(); });
}
async function click(label: string) {
    await act(async () => { (button(label).props.onClick as () => unknown)(); await Promise.resolve(); });
}
async function submit() {
    const form = renderer!.root.findAllByType('form')[0];
    if (!form) throw new Error('Form missing');
    await act(async () => { (form.props.onSubmit as (event: { preventDefault: () => void }) => unknown)({ preventDefault: jest.fn() }); await Promise.resolve(); });
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
async function signupStepFour() {
    await mount(createElement(SignupFlow));
    await click('Instagram');
    await change('@mika.shops', 'Instagram');
    const audience = renderer!.root.findAllByType('button').find(node => node.props.role === 'radio');
    if (!audience) throw new Error('Audience option missing');
    await act(() => { (audience.props.onClick as () => void)(); });
    await submit();
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    state.loaded = true;
    state.signedIn = true;
    state.user = { id: 'current-user', fullName: 'Mika Santos', firstName: 'Mika', primaryEmailAddress: { emailAddress: 'mika@example.com' } };
    state.auth = { isAuthenticated: true, isLoading: false, isRefreshing: false };
    state.publicCodeValue = undefined;
    state.takenCodes = new Set();
    state.setup = setup();
    liveQuery.mockImplementation((reference, args) => {
        if (args === 'skip') return undefined;
        switch (getFunctionName(reference)) {
            case 'creatorProgram:myApplication': return { status: 'none' };
            case 'creatorProgram:checkAvailability': return availability(args);
            case 'creatorProgram:codeSetup': {
                if (state.setup instanceof Error) throw state.setup;
                return state.setup;
            }
            case 'creators:getByClerkId': return null;
            case 'businessOwners:me': return null;
            default: throw new Error(`Unexpected custom-code subscription: ${getFunctionName(reference)}`);
        }
    });
    codeQuery.mockImplementation((reference, args) => {
        const result = availability(args);
        switch (getFunctionName(reference)) {
            case 'creatorProgram:checkAvailability': return Promise.resolve(result);
            case 'creatorProgram:checkCodeAvailability': return Promise.resolve(result.code);
            default: throw new Error(`Unexpected custom-code availability query: ${getFunctionName(reference)}`);
        }
    });
    updateCode.mockImplementation(({ code }: { code: string }) => Promise.resolve({ code }));
    apply.mockResolvedValue(undefined);
    createAffiliate.mockResolvedValue('new-affiliate');
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const original = console.error;
    consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) return;
        if (state.setup instanceof Error && args.includes(state.setup)) return;
        original(...args);
    });
});

afterEach(async () => {
    if (renderer) await act(() => { renderer!.unmount(); });
    renderer = undefined;
    jest.useRealTimers();
    consoleError.mockRestore();
});

describe('creator code settings', () => {
    it.each([{ preview: true, status: 'active' }, { preview: false, status: 'suspended' }] as const)('keeps code read-only without availability reads for preview=$preview, status=$status', async ({ preview, status }) => {
        await mount(createElement(CreatorCodeSettings, { account: { ...account, status }, preview }));
        expect(input().props.disabled || input().props.readOnly).toBe(true);
        expect(codeQuery).not.toHaveBeenCalled();
        expect(updateCode).not.toHaveBeenCalled();
        expect(mutationHook).not.toHaveBeenCalledWith('creatorProgram:updateCode');
    });

    it.each(['previous Clerk actor', 'Clerk loading', 'signed out', 'Convex loading', 'unauthenticated'])(
        'does not read setup, check availability or mount a write hook while %s', async condition => {
        if (condition === 'previous Clerk actor') state.user = { ...state.user!, id: 'another-clerk-user' };
        if (condition === 'Clerk loading') state.loaded = false;
        if (condition === 'signed out') { state.user = null; state.signedIn = false; }
        if (condition === 'Convex loading') state.auth.isLoading = true;
        if (condition === 'unauthenticated') state.auth.isAuthenticated = false;
        await mount();
        expect(codeQuery).not.toHaveBeenCalled();
        expect(updateCode).not.toHaveBeenCalled();
        expect(input().props.disabled || input().props.readOnly).toBe(true);
        expect(liveQuery.mock.calls.filter(([reference]) => getFunctionName(reference) === 'creatorProgram:codeSetup').every(([, args]) => args === 'skip')).toBe(true);
        expect(mutationHook).not.toHaveBeenCalledWith('creatorProgram:updateCode');
    });

    it.each(['CUSTOM30', 'AFFLEGACY'])('uses server eligibility to lock %s without availability or mutation hooks', async code => {
        state.setup = setup(code, false);
        await mount(createElement(CreatorCodeSettings, { account: { ...account, referralCode: code } }));
        expect(input().props.value).toBe(code);
        expect(input().props.disabled || input().props.readOnly).toBe(true);
        expect(text(renderer!.root)).toContain('This is your permanent creator code. It cannot be changed.');
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
        expect(codeQuery).not.toHaveBeenCalled();
        expect(mutationHook).not.toHaveBeenCalledWith('creatorProgram:updateCode');
        expect(liveQuery.mock.calls.map(([reference, args]) => [getFunctionName(reference), args])).toEqual([
            ['creatorProgram:codeSetup', {}],
        ]);
    });

    it('keeps setup loading read-only rather than assuming this account may choose a code', async () => {
        state.setup = undefined;
        await mount();
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
        expect(input().props.disabled || input().props.readOnly).toBe(true);
        expect(codeQuery).not.toHaveBeenCalled();
        expect(mutationHook).not.toHaveBeenCalledWith('creatorProgram:updateCode');
    });

    it('keeps setup errors read-only and retries the server permission read explicitly', async () => {
        state.setup = new Error('Code setup unavailable');
        await mount();
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
        expect(codeQuery).not.toHaveBeenCalled();
        expect(mutationHook).not.toHaveBeenCalledWith('creatorProgram:updateCode');
        state.setup = setup('MIKA30', false);
        await click('Retry');
        expect(text(renderer!.root)).toContain('This is your permanent creator code. It cannot be changed.');
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
    });

    it('does not accept cached setup permission from another creator', async () => {
        state.setup = setup('FOREIGN30', true, 'another-affiliate' as Doc<'creators'>['_id']);
        await mount();
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
        expect(input().props.value).toBe('MIKA30');
        expect(codeQuery).not.toHaveBeenCalled();
        expect(mutationHook).not.toHaveBeenCalledWith('creatorProgram:updateCode');
    });

    it('refreshes a clean code field when the live saved code changes elsewhere', async () => {
        await mount();
        expect(input().props.value).toBe('MIKA30');
        state.setup = setup('NINA30');
        await rerender(createElement(CreatorCodeSettings, { account: { ...account, referralCode: 'NINA30' } }));
        expect(input().props.value).toBe('NINA30');
        expect(updateCode).not.toHaveBeenCalled();
    });

    it('preserves an unsaved code draft when the live saved code changes elsewhere', async () => {
        await mount();
        await change('SHOPS30');
        state.setup = setup('NINA30');
        await rerender(createElement(CreatorCodeSettings, { account: { ...account, referralCode: 'NINA30' } }));
        expect(input().props.value).toBe('SHOPS30');
        expect(updateCode).not.toHaveBeenCalled();
    });

    it('uppercases a separate code draft, checks it after debounce, and saves only the code', async () => {
        await mount();
        expect(button('Set my code').props.disabled).toBe(false);
        expect(text(renderer!.root)).toContain('Choose carefully. You cannot change this code later.');
        codeQuery.mockClear();
        await change('shops30');
        expect(input().props.value).toBe('SHOPS30');
        expect(codeQuery).not.toHaveBeenCalled();
        await settleDebounce();
        expect(codeQuery).toHaveBeenCalledWith(expect.anything(), { code: 'SHOPS30' });
        expect(button('Set my code').props.disabled).toBe(false);
        await submit();
        expect(updateCode).toHaveBeenCalledWith({ code: 'SHOPS30' });
        expect(account.referralCode).toBe('MIKA30');
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
        state.setup = setup('SHOPS30', false);
        await rerender();
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
        expect(updateCode).toHaveBeenCalledTimes(1);
    });

    it('confirms and locks a same-code result even when the account code itself does not change', async () => {
        await mount();
        expect(button('Set my code').props.disabled).toBe(false);
        await submit();
        expect(updateCode).toHaveBeenCalledWith({ code: 'MIKA30' });
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
        state.setup = setup('MIKA30', false);
        await rerender();
        expect(input().props.value).toBe('MIKA30');
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
    });

    it.each(['ABC', 'MIKA-30', 'ABCDEFGHIJKLMNOPQ'])('rejects invalid code %s without checking or saving it', async value => {
        await mount();
        codeQuery.mockClear();
        await change(value);
        await settleDebounce();
        expect(button('Set my code').props.disabled).toBe(true);
        expect(codeQuery).not.toHaveBeenCalled();
        await submit();
        expect(updateCode).not.toHaveBeenCalled();
    });

    it('never enables saving a newer draft from an older availability response', async () => {
        const oldCheck = deferred<NonNullable<Availability['code']>>();
        const newCheck = deferred<NonNullable<Availability['code']>>();
        await mount();
        codeQuery.mockReturnValueOnce(oldCheck.promise).mockReturnValueOnce(newCheck.promise);
        await change('FIRST30');
        await settleDebounce();
        await change('SECOND30');
        await act(async () => { oldCheck.resolve(availability({ code: 'FIRST30' }).code!); });
        expect(button('Set my code').props.disabled).toBe(true);
        await settleDebounce();
        expect(button('Set my code').props.disabled).toBe(true);
        await act(async () => { newCheck.resolve(availability({ code: 'SECOND30' }).code!); });
        expect(button('Set my code').props.disabled).toBe(false);
    });

    it('shows an availability failure and retries without losing the draft', async () => {
        await mount();
        codeQuery.mockClear();
        codeQuery.mockRejectedValueOnce(new Error('Offline'));
        await change('SHOPS30');
        await settleDebounce();
        expect(button('Set my code').props.disabled).toBe(true);
        const retry = renderer!.root.findAllByType('button').find(node => text(node).includes('Check again'));
        expect(retry).toBeDefined();
        await act(async () => { (retry!.props.onClick as () => void)(); await Promise.resolve(); });
        expect(codeQuery).toHaveBeenCalledTimes(2);
        expect(input().props.value).toBe('SHOPS30');
        expect(button('Set my code').props.disabled).toBe(false);
    });

    it('keeps a taken code visible and blocks saving before any mutation', async () => {
        state.takenCodes.add('SHOPS30');
        await mount();
        await change('SHOPS30');
        await settleDebounce();
        expect(text(renderer!.root)).toContain('That code is already taken.');
        expect(input().props.value).toBe('SHOPS30');
        expect(button('Set my code').props.disabled).toBe(true);
        await submit();
        expect(updateCode).not.toHaveBeenCalled();
    });

    it('shows an atomic collision failure and preserves the unsaved draft for retry', async () => {
        updateCode.mockRejectedValueOnce(new ConvexError('That code was just taken. Choose another one.'));
        await mount();
        await change('SHOPS30');
        await settleDebounce();
        await submit();
        expect(text(renderer!.root)).toContain('That code was just taken. Choose another one.');
        expect(input().props.value).toBe('SHOPS30');
        expect(account.referralCode).toBe('MIKA30');
    });

    it.each(['availability', 'save'] as const)('removes the choice form when the %s response says the code was already set', async stage => {
        const message = 'Your creator code is already set and cannot be changed.';
        await mount();
        await change('SHOPS30');
        if (stage === 'availability') codeQuery.mockResolvedValueOnce({ value: 'SHOPS30', available: false, error: message });
        else updateCode.mockRejectedValueOnce(new ConvexError(message));
        await settleDebounce();
        if (stage === 'save') await submit();
        expect(text(renderer!.root)).toContain(message);
        expect(renderer!.root.findAllByType('form')).toHaveLength(0);
        expect(updateCode).toHaveBeenCalledTimes(stage === 'save' ? 1 : 0);
    });

    it('does not attach an old save failure or draft to a newly signed-in actor', async () => {
        const oldSave = deferred<{ code: string }>();
        updateCode.mockReturnValueOnce(oldSave.promise);
        await mount();
        await change('SHOPS30');
        await settleDebounce();
        await submit();
        const next = { ...account, _id: 'next-affiliate' as Doc<'creators'>['_id'], clerkId: 'next-clerk-user', referralCode: 'NINA30' };
        state.user = { ...state.user!, id: next.clerkId };
        state.setup = setup('NINA30', true, next._id);
        await rerender(createElement(CreatorCodeSettings, { account: next }));
        await act(async () => { oldSave.reject(new ConvexError('Old actor save failed.')); });
        expect(input().props.value).toBe('NINA30');
        expect(text(renderer!.root)).not.toContain('Old actor save failed.');
        expect(text(renderer!.root)).not.toContain('SHOPS30');
    });

    it('keeps preview and poster/share code on the saved account until the live account refreshes', async () => {
        await mount(createElement(DashboardContent, { account }));
        await click('Your offer');
        await change('SHOPS30');
        await settleDebounce();
        await submit();
        const materials = () => renderer!.root.findAllByType('div').filter(node => ['public-card', 'sharing-materials'].includes(node.props['data-testid'] as string));
        expect(materials()).toHaveLength(2);
        for (const node of materials()) {
            expect(node.props['data-code']).toBe('MIKA30');
            expect(node.props['data-price']).toBe(3499);
        }
        state.setup = setup('SHOPS30', false);
        await rerender(createElement(DashboardContent, { account: { ...account, referralCode: 'SHOPS30' } }));
        for (const node of materials()) expect(node.props['data-code']).toBe('SHOPS30');
    });
});

describe('creator signup custom code', () => {
    it('keeps a chosen code independent of the page handle and submits the fixed-offer application', async () => {
        await signupStepFour();
        expect(text(renderer!.root)).toContain('Choose carefully. You cannot change this code later.');
        await change('mikashops', 'Your name on Tendso');
        await change('shops30');
        await change('mikaonline', 'Your name on Tendso');
        await settleDebounce();
        expect(input().props.value).toBe('SHOPS30');
        expect(button('Send for review').props.disabled).toBe(false);
        await submit();
        expect(apply).toHaveBeenCalledWith(expect.objectContaining({ handle: 'mikaonline', code: 'SHOPS30' }));
        expect(apply.mock.calls[0][0]).not.toHaveProperty('price');
        expect(apply.mock.calls[0][0]).not.toHaveProperty('affiliatePrice');
    });

    it('requires availability for the exact independent code instead of accepting an old response', async () => {
        await signupStepFour();
        await change('mikashops', 'Your name on Tendso');
        state.publicCodeValue = 'OLDREPLY';
        await change('SHOPS30');
        await settleDebounce();
        expect(button('Send for review').props.disabled).toBe(true);
        await submit();
        expect(apply).not.toHaveBeenCalled();
        state.publicCodeValue = undefined;
        const retry = renderer!.root.findAllByType('button').find(node => text(node).includes('Check again'));
        expect(retry).toBeDefined();
        await act(async () => { (retry!.props.onClick as () => void)(); await Promise.resolve(); });
        expect(button('Send for review').props.disabled).toBe(false);
    });

    it('keeps an unavailable custom code visible and prevents application submission', async () => {
        state.takenCodes.add('SHOPS30');
        await signupStepFour();
        await change('mikashops', 'Your name on Tendso');
        await change('SHOPS30');
        await settleDebounce();
        expect(text(renderer!.root)).toContain('That code is already taken.');
        expect(input().props.value).toBe('SHOPS30');
        expect(button('Send for review').props.disabled).toBe(true);
        await submit();
        expect(apply).not.toHaveBeenCalled();
    });
});

describe('legacy affiliate signup custom code', () => {
    async function fillProfile() {
        await mount(createElement(AffiliateJoinPage));
        await change('0917 123 4567', 'Mobile number');
        await change('mika-legacy', 'Page handle');
    }

    it('keeps code independent of the handle and requires its exact public availability check before creating the account', async () => {
        await fillProfile();
        expect(text(renderer!.root)).toContain('Choose carefully. You cannot change this code later.');
        expect(input().props.value).toBe('');
        expect(button('Create affiliate account').props.disabled).toBe(true);
        await change('legacy30');
        expect(input().props.value).toBe('LEGACY30');
        expect(button('Create affiliate account').props.disabled).toBe(true);
        expect(codeQuery).not.toHaveBeenCalled();
        await submit();
        expect(createAffiliate).not.toHaveBeenCalled();
        await settleDebounce();
        expect(codeQuery).toHaveBeenCalledWith(expect.anything(), { code: 'LEGACY30' });
        expect(button('Create affiliate account').props.disabled).toBe(false);
        await submit();
        expect(createAffiliate).toHaveBeenCalledWith(expect.objectContaining({
            email: 'mika@example.com', phone: '09171234567', handle: 'mika-legacy', code: 'LEGACY30',
        }));
        expect(createAffiliate.mock.calls[0][0]).not.toHaveProperty('price');
        expect(navigation.replace).toHaveBeenCalledWith('/affiliates/dashboard');
    });

    it('preserves the entered profile and code when the final server save reports a collision', async () => {
        createAffiliate.mockRejectedValueOnce(new ConvexError('That code is already taken. Choose another one.'));
        await fillProfile();
        await change('LEGACY30');
        await settleDebounce();
        await submit();
        expect(text(renderer!.root)).toContain('That code is already taken. Choose another one.');
        expect(input().props.value).toBe('LEGACY30');
        expect(input('Page handle').props.value).toBe('mika-legacy');
        expect(input('Mobile number').props.value).toBe('09171234567');
        expect(navigation.replace).not.toHaveBeenCalled();
    });
});
